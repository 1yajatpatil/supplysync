"""
SupplySync Baseline Distribution Strategy
A realistic, reproducible heuristic benchmark allocation strategy:
- Evaluates destinations in priority order (Tier-1 before Tier-2).
- For each product, identifies available stock at candidate warehouses.
- Greedily selects the warehouse with the lowest direct transportation cost.
- Allocates min(remaining_demand, available_inventory, remaining_route_capacity).
- Allocates stock without global joint optimization or batch FEFO reordering.
- Serves as the defensible real-world baseline to measure mathematical optimization improvements.
"""

import time
import uuid
from datetime import datetime, timezone
from typing import List, Dict, Tuple
from .models import (
    Product, 
    Warehouse, 
    Destination, 
    InventoryBatch, 
    Route, 
    DemandRecord,
    ShipmentRecommendation,
    ShortageDetail,
    OptimizationMetrics,
    OptimizationPlan
)


def run_baseline_allocation(
    products: List[Product],
    warehouses: List[Warehouse],
    destinations: List[Destination],
    batches: List[InventoryBatch],
    routes: List[Route],
    demand_records: List[DemandRecord],
    planning_horizon_days: int = 7
) -> OptimizationPlan:
    """
    Executes the greedy demand-priority baseline distribution strategy.
    """
    start_time = time.time()
    
    prod_map = {p.id: p for p in products}
    wh_map = {w.id: w for w in warehouses}
    dest_map = {d.id: d for d in destinations}
    
    # Track available inventory per batch (only usable batches with days_to_expiry > 0)
    batch_inventory: Dict[str, int] = {}
    wh_batches: Dict[Tuple[str, str], List[InventoryBatch]] = {}
    
    for b in batches:
        if not b.is_expired and b.days_to_expiry > 0:
            batch_inventory[b.batch_id] = b.quantity
            key = (b.warehouse_id, b.product_id)
            if key not in wh_batches:
                wh_batches[key] = []
            wh_batches[key].append(b)

    # Route lookup: (source_wh, dest_id) -> Route
    route_map: Dict[Tuple[str, str], Route] = {}
    route_remaining_cap: Dict[Tuple[str, str], int] = {}
    for r in routes:
        route_map[(r.source_warehouse_id, r.destination_id)] = r
        route_remaining_cap[(r.source_warehouse_id, r.destination_id)] = (
            r.max_capacity_units if r.max_capacity_units is not None else 999999999
        )

    # Sort destinations by tier (Tier-1 first) then by total demand
    dest_order = sorted(
        destinations, 
        key=lambda d: (0 if d.tier == 'Tier-1' else 1, d.id)
    )

    recommendations: List[ShipmentRecommendation] = []
    fulfilled_per_dp: Dict[Tuple[str, str], int] = {}
    total_transport_cost = 0.0
    rec_counter = 1

    # Demand map
    demand_by_dp = {(dr.destination_id, dr.product_id): dr.forecasted_demand for dr in demand_records}

    for dest in dest_order:
        for prod in products:
            dp_key = (dest.id, prod.id)
            remaining_demand = demand_by_dp.get(dp_key, 0)
            if remaining_demand <= 0:
                continue

            # Candidate warehouses connected to this destination with stock of this product
            candidate_whs = []
            for wh in warehouses:
                route_key = (wh.id, dest.id)
                if route_key in route_map and route_remaining_cap[route_key] > 0:
                    # Check available stock
                    batch_list = wh_batches.get((wh.id, prod.id), [])
                    wh_stock = sum(batch_inventory.get(b.batch_id, 0) for b in batch_list)
                    if wh_stock > 0:
                        candidate_whs.append((route_map[route_key].unit_cost, wh.id, batch_list))

            # Greedy rule: Sort by lowest unit freight cost
            candidate_whs.sort(key=lambda item: item[0])

            for unit_cost, wh_id, candidate_batches in candidate_whs:
                if remaining_demand <= 0:
                    break
                
                route_key = (wh_id, dest.id)
                available_route_cap = route_remaining_cap[route_key]
                if available_route_cap <= 0:
                    continue

                for b in candidate_batches:
                    if remaining_demand <= 0 or available_route_cap <= 0:
                        break
                    
                    b_avail = batch_inventory.get(b.batch_id, 0)
                    if b_avail <= 0:
                        continue

                    # Allocation quantity
                    alloc_qty = min(remaining_demand, b_avail, available_route_cap)
                    if alloc_qty <= 0:
                        continue

                    line_cost = round(alloc_qty * unit_cost, 2)
                    total_transport_cost += line_cost

                    # Update trackers
                    remaining_demand -= alloc_qty
                    batch_inventory[b.batch_id] -= alloc_qty
                    available_route_cap -= alloc_qty
                    route_remaining_cap[route_key] = available_route_cap
                    fulfilled_per_dp[dp_key] = fulfilled_per_dp.get(dp_key, 0) + alloc_qty

                    recommendations.append(
                        ShipmentRecommendation(
                            recommendation_id=f"BASE-REC-{rec_counter:04d}",
                            product_id=prod.id,
                            product_name=prod.name,
                            source_warehouse_id=wh_id,
                            source_warehouse_name=wh_map[wh_id].name,
                            destination_id=dest.id,
                            destination_name=dest.name,
                            batch_id=b.batch_id,
                            allocated_quantity=alloc_qty,
                            unit_transport_cost=unit_cost,
                            total_transport_cost=line_cost,
                            destination_demand=demand_by_dp.get(dp_key, 0),
                            batch_days_to_expiry=b.days_to_expiry,
                            rationale=f"Greedy lowest direct tariff (${unit_cost:.2f}/unit) to satisfy {dest.tier} demand.",
                            constraints_honored=[
                                "Physical stock availability",
                                "Route capacity limit",
                                "Zero expired stock"
                            ]
                        )
                    )
                    rec_counter += 1

    # Compute shortfalls & audit metrics
    shortages: List[ShortageDetail] = []
    total_demand = sum(demand_by_dp.values())
    total_fulfilled = sum(fulfilled_per_dp.values())
    total_unmet = total_demand - total_fulfilled
    destinations_with_shortages_set = set()

    for (d_id, p_id), d_qty in demand_by_dp.items():
        f_qty = fulfilled_per_dp.get((d_id, p_id), 0)
        if f_qty < d_qty:
            unmet = d_qty - f_qty
            destinations_with_shortages_set.add(d_id)
            shortage_pct = round((unmet / d_qty) * 100, 1)
            criticality = "High" if shortage_pct > 30 else ("Medium" if shortage_pct > 10 else "Low")
            shortages.append(
                ShortageDetail(
                    destination_id=d_id,
                    destination_name=dest_map[d_id].name,
                    product_id=p_id,
                    product_name=prod_map[p_id].name,
                    demand=d_qty,
                    fulfilled=f_qty,
                    unmet_quantity=unmet,
                    shortage_percentage=shortage_pct,
                    criticality=criticality
                )
            )

    # Estimate near-expiry stock used vs left at risk
    near_expiry_batches = [b for b in batches if not b.is_expired and 0 < b.days_to_expiry <= 15]
    expiring_stock_utilized = 0
    potential_waste_unallocated = 0
    for b in near_expiry_batches:
        allocated = b.quantity - batch_inventory.get(b.batch_id, 0)
        expiring_stock_utilized += allocated
        potential_waste_unallocated += batch_inventory.get(b.batch_id, 0)

    elapsed_ms = round((time.time() - start_time) * 1000, 2)
    fulfillment_rate = round((total_fulfilled / total_demand * 100), 2) if total_demand > 0 else 100.0

    metrics = OptimizationMetrics(
        strategy="baseline",
        total_demand_units=total_demand,
        total_fulfilled_units=total_fulfilled,
        total_unmet_units=total_unmet,
        fulfillment_rate_pct=fulfillment_rate,
        total_transport_cost=round(total_transport_cost, 2),
        avg_unit_transport_cost=round(total_transport_cost / total_fulfilled, 2) if total_fulfilled > 0 else 0.0,
        active_shipment_lanes=len(recommendations),
        expiring_stock_utilized_units=expiring_stock_utilized,
        estimated_avoided_waste_units=expiring_stock_utilized,
        potential_waste_unallocated_units=potential_waste_unallocated,
        destinations_with_shortages=len(destinations_with_shortages_set),
        solver_runtime_ms=elapsed_ms,
        solver_status="FEASIBLE_GREEDY_HEURISTIC"
    )

    return OptimizationPlan(
        run_id=f"RUN-BASE-{uuid.uuid4().hex[:8].upper()}",
        strategy="baseline",
        created_at=datetime.now(timezone.utc).isoformat(),
        planning_horizon_days=planning_horizon_days,
        metrics=metrics,
        recommendations=recommendations,
        shortages=shortages
    )
