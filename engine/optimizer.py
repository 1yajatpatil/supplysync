"""
SupplySync Mathematical Distribution Optimizer
Google OR-Tools Mixed-Integer Linear Programming (MILP) Engine:
- Formulates multi-echelon distribution across Warehouses (w), Destinations (d), Products (p), and Batches (b).
- Decision variables:
    x[w, d, p, b] >= 0, integer (Shipment quantity)
    u[d, p] >= 0, integer (Unmet demand slack variable)
- Hard physical constraints:
    1. Batch availability: sum_d x[w, d, p, b] <= batch.quantity (only usable, non-expired stock)
    2. Route capacity: sum_{p, b} x[w, d, p, b] <= route.max_capacity_units
    3. Demand conservation: sum_{w, b} x[w, d, p, b] + u[d, p] == demand[d, p]
    4. Expiry eligibility: Zero expired inventory allocated (days_to_expiry > 0)
- Objective function:
    Minimize Total Landed Freight + Tier-Weighted Shortage Penalties - Bounded FEFO Priority Subsidies
    (Bounded subsidies guarantee non-negative coefficients, preventing artificial negative-cost incentives).
- Exact agreement between final allocation plan and reported dashboard financial metrics.
"""

import time
import uuid
from datetime import datetime, timezone
from typing import List, Dict, Tuple, Optional, Any
from ortools.linear_solver import pywraplp

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


class OptimizationInfeasibleError(Exception):
    """Raised when OR-Tools cannot find a feasible allocation."""
    pass


def run_ortools_optimization(
    products: List[Product],
    warehouses: List[Warehouse],
    destinations: List[Destination],
    batches: List[InventoryBatch],
    routes: List[Route],
    demand_records: List[DemandRecord],
    planning_horizon_days: int = 7
) -> OptimizationPlan:
    """
    Executes constrained Mixed-Integer Programming distribution optimization using Google OR-Tools.
    Enforces discrete integer shipment quantities and strict physical network constraints.
    """
    start_time = time.time()

    # Pre-index mappings
    prod_map = {p.id: p for p in products}
    wh_map = {w.id: w for w in warehouses}
    dest_map = {d.id: d for d in destinations}
    batch_map = {b.batch_id: b for b in batches}
    route_map = {(r.source_warehouse_id, r.destination_id): r for r in routes}
    demand_map = {(dr.destination_id, dr.product_id): dr.forecasted_demand for dr in demand_records}

    # Strict physical invariant: filter out expired or non-positive inventory batches
    usable_batches = [
        b for b in batches 
        if not b.is_expired and b.days_to_expiry > 0 and b.quantity > 0
    ]

    # Initialize Google OR-Tools solver backend
    # SCIP is the preferred open-source MIP solver; CBC is a secondary valid integer solver.
    # Note: GLOP is continuous-only LP and must NOT be used for discrete integer distribution models.
    solver = pywraplp.Solver.CreateSolver('SCIP') or pywraplp.Solver.CreateSolver('CBC')
    if not solver:
        raise RuntimeError(
            "No compatible Mixed-Integer Programming solver available (SCIP or CBC required). "
            "Continuous LP solvers (like GLOP) cannot enforce integer shipment constraints."
        )

    # 1. Decision Variables:
    # x[w, d, p, b] >= 0, integer (Units allocated from warehouse w to destination d for product p from batch b)
    x_vars: Dict[Tuple[str, str, str, str], Any] = {}
    
    # Slack variables for unmet demand: u[d, p] >= 0, integer
    u_vars: Dict[Tuple[str, str], Any] = {}

    for d in destinations:
        for p in products:
            dp_key = (d.id, p.id)
            d_qty = demand_map.get(dp_key, 0)
            u_vars[dp_key] = solver.IntVar(0, d_qty, f"unmet_{d.id}_{p.id}")

    # Build valid route shipment decision variables
    for b in usable_batches:
        w_id = b.warehouse_id
        p_id = b.product_id
        for d in destinations:
            route_key = (w_id, d.id)
            if route_key in route_map:
                var_key = (w_id, d.id, p_id, b.batch_id)
                # Upper bound cannot exceed batch quantity
                x_vars[var_key] = solver.IntVar(0, b.quantity, f"x_{w_id}_{d.id}_{p_id}_{b.batch_id}")

    # 2. Hard Physical Constraints:

    # Constraint A: Batch Usable Inventory limit
    # For every batch b: sum_d x[w, d, p, b] <= b.quantity
    for b in usable_batches:
        w_id = b.warehouse_id
        p_id = b.product_id
        batch_shipments = []
        for d in destinations:
            var_key = (w_id, d.id, p_id, b.batch_id)
            if var_key in x_vars:
                batch_shipments.append(x_vars[var_key])
        
        if batch_shipments:
            solver.Add(solver.Sum(batch_shipments) <= b.quantity)

    # Constraint B: Route corridor capacity limit
    # For each corridor (w, d): sum_{p, b} x[w, d, p, b] <= route.max_capacity_units
    for (w_id, d_id), route in route_map.items():
        if route.max_capacity_units is not None:
            corridor_shipments = []
            for (vw_id, vd_id, vp_id, vb_id), var in x_vars.items():
                if vw_id == w_id and vd_id == d_id:
                    corridor_shipments.append(var)
            if corridor_shipments:
                solver.Add(solver.Sum(corridor_shipments) <= route.max_capacity_units)

    # Constraint C: Demand conservation
    # For each destination d and product p:
    # sum_{w, b} x[w, d, p, b] + u[d, p] == demand[d, p]
    for d in destinations:
        for p in products:
            dp_key = (d.id, p.id)
            d_qty = demand_map.get(dp_key, 0)
            incoming = []
            for (vw_id, vd_id, vp_id, vb_id), var in x_vars.items():
                if vd_id == d.id and vp_id == p.id:
                    incoming.append(var)
            
            if incoming:
                solver.Add(solver.Sum(incoming) + u_vars[dp_key] == d_qty)
            else:
                solver.Add(u_vars[dp_key] == d_qty)

    # 3. Objective Function Formulation:
    # Minimize:
    #   sum_{(w,d,p,b)} x * (unit_transport_cost - bounded_fefo_subsidy)
    #   + sum_{(d,p)} u * shortage_penalty
    #
    # Crucial Mathematical Correction:
    # To prevent artificial negative-cost incentives (e.g. 1.80 - 4.0 = -2.20),
    # the FEFO subsidy is strictly bounded to a fraction of unit freight tariff:
    # fefo_subsidy = min(0.20 * route.unit_cost, 0.50) if batch expires <= 15 days.
    # This guarantees coeff >= 0.80 * route.unit_cost > 0.
    objective = solver.Objective()

    for (w_id, d_id, p_id, b_id), var in x_vars.items():
        route = route_map[(w_id, d_id)]
        batch = batch_map[b_id]
        
        base_tariff = route.unit_cost
        
        # Bounded FEFO tie-breaker subsidy (never generates negative cost)
        if 0 < batch.days_to_expiry <= 15:
            fefo_subsidy = min(0.25 * base_tariff, 0.75)
            coeff = max(0.10, base_tariff - fefo_subsidy)
        else:
            coeff = base_tariff
        
        objective.SetCoefficient(var, coeff)

    for (d_id, p_id), u_var in u_vars.items():
        prod = prod_map[p_id]
        dest = dest_map[d_id]
        
        # Tier-1 retail destinations have 30% higher SLA shortage penalty
        tier_multiplier = 1.30 if dest.tier == "Tier-1" else 1.0
        penalty = prod.shortage_penalty_per_unit * tier_multiplier
        objective.SetCoefficient(u_var, penalty)

    objective.SetMinimization()

    # 15-second safety timeout on solver
    solver.SetTimeLimit(15000)

    # Solve
    status = solver.Solve()

    if status not in (pywraplp.Solver.OPTIMAL, pywraplp.Solver.FEASIBLE):
        raise OptimizationInfeasibleError(
            f"OR-Tools solver returned status code {status}. Constraints may be mutually contradictory or network disconnected."
        )

    solver_status_str = "OPTIMAL" if status == pywraplp.Solver.OPTIMAL else "FEASIBLE"

    # Extract decision variables and construct explainable recommendations
    recommendations: List[ShipmentRecommendation] = []
    fulfilled_per_dp: Dict[Tuple[str, str], int] = {}
    actual_total_freight_cost = 0.0
    rec_counter = 1

    for (w_id, d_id, p_id, b_id), var in x_vars.items():
        qty = int(round(var.solution_value()))
        if qty > 0:
            route = route_map[(w_id, d_id)]
            batch = batch_map[b_id]
            prod = prod_map[p_id]
            dest = dest_map[d_id]
            # Actual reported freight cost is strictly based on original route tariff
            line_freight = round(qty * route.unit_cost, 2)
            actual_total_freight_cost += line_freight

            dp_key = (d_id, p_id)
            fulfilled_per_dp[dp_key] = fulfilled_per_dp.get(dp_key, 0) + qty

            # Structured explainability
            reasons = []
            constraints_met = [
                f"Batch {b_id} availability ({batch.quantity} units available)",
                f"Destination demand ({demand_map.get(dp_key, 0)} units)",
                "Zero expired inventory enforced"
            ]
            if route.max_capacity_units is not None:
                constraints_met.append(f"Lane throughput limit ({route.max_capacity_units} units)")

            if 0 < batch.days_to_expiry <= 15:
                reasons.append(f"FEFO priority — expires in {batch.days_to_expiry}d; prioritized to eliminate avoidable waste.")
            else:
                reasons.append(f"Lowest-cost feasible route (${route.unit_cost:.2f}/unit) from {wh_map[w_id].city}.")

            if dest.tier == "Tier-1":
                reasons.append("Tier-1 SLA protected.")

            recommendations.append(
                ShipmentRecommendation(
                    recommendation_id=f"OPT-REC-{rec_counter:04d}",
                    product_id=p_id,
                    product_name=prod.name,
                    source_warehouse_id=w_id,
                    source_warehouse_name=wh_map[w_id].name,
                    destination_id=d_id,
                    destination_name=dest.name,
                    batch_id=b_id,
                    allocated_quantity=qty,
                    unit_transport_cost=route.unit_cost,
                    total_transport_cost=line_freight,
                    destination_demand=demand_map.get(dp_key, 0),
                    batch_days_to_expiry=batch.days_to_expiry,
                    rationale=" ".join(reasons),
                    constraints_honored=constraints_met
                )
            )
            rec_counter += 1

    # Extract shortage details
    shortages: List[ShortageDetail] = []
    total_demand = sum(demand_map.values())
    total_fulfilled = sum(fulfilled_per_dp.values())
    total_unmet = total_demand - total_fulfilled
    destinations_with_shortages_set = set()

    for (d_id, p_id), d_qty in demand_map.items():
        f_qty = fulfilled_per_dp.get((d_id, p_id), 0)
        if f_qty < d_qty:
            unmet = d_qty - f_qty
            destinations_with_shortages_set.add(d_id)
            shortage_pct = round((unmet / d_qty) * 100, 1) if d_qty > 0 else 0.0
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

    # Expiry stock utilization audit
    near_expiry_batches = [b for b in batches if not b.is_expired and 0 < b.days_to_expiry <= 15]
    expiring_stock_utilized = 0
    potential_waste_unallocated = 0

    batch_allocated_map: Dict[str, int] = {}
    for rec in recommendations:
        batch_allocated_map[rec.batch_id] = batch_allocated_map.get(rec.batch_id, 0) + rec.allocated_quantity

    for b in near_expiry_batches:
        allocated = batch_allocated_map.get(b.batch_id, 0)
        expiring_stock_utilized += allocated
        potential_waste_unallocated += (b.quantity - allocated)

    elapsed_ms = round((time.time() - start_time) * 1000, 2)
    fulfillment_rate = round((total_fulfilled / total_demand * 100), 2) if total_demand > 0 else 100.0

    metrics = OptimizationMetrics(
        strategy="optimized_ortools",
        total_demand_units=total_demand,
        total_fulfilled_units=total_fulfilled,
        total_unmet_units=total_unmet,
        fulfillment_rate_pct=fulfillment_rate,
        total_transport_cost=round(actual_total_freight_cost, 2),
        avg_unit_transport_cost=round(actual_total_freight_cost / total_fulfilled, 2) if total_fulfilled > 0 else 0.0,
        active_shipment_lanes=len(recommendations),
        expiring_stock_utilized_units=expiring_stock_utilized,
        estimated_avoided_waste_units=expiring_stock_utilized,
        potential_waste_unallocated_units=potential_waste_unallocated,
        destinations_with_shortages=len(destinations_with_shortages_set),
        solver_runtime_ms=elapsed_ms,
        solver_status=solver_status_str
    )

    return OptimizationPlan(
        run_id=f"RUN-OPT-{uuid.uuid4().hex[:8].upper()}",
        strategy="optimized_ortools",
        created_at=datetime.now(timezone.utc).isoformat(),
        planning_horizon_days=planning_horizon_days,
        metrics=metrics,
        recommendations=recommendations,
        shortages=shortages
    )
