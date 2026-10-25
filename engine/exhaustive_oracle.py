"""
SupplySync Exhaustive Search Oracle
Triwizathon 2026 | Problem Statement 2

Provides an independent, brute-force exhaustive enumeration oracle for tiny
distribution network instances. Completely decoupled from Google OR-Tools and SCIP.
Used as an absolute ground-truth benchmark for mathematical optimality verification.
"""

from typing import List, Dict, Tuple, Any, Optional
import itertools
from engine.models import Product, Warehouse, Destination, InventoryBatch, Route, DemandRecord


def solve_exhaustive_oracle(
    products: List[Product],
    warehouses: List[Warehouse],
    destinations: List[Destination],
    batches: List[InventoryBatch],
    routes: List[Route],
    demand_records: List[DemandRecord],
) -> Dict[str, Any]:
    """
    Exhaustively enumerates ALL feasible integer allocation vectors and finds
    the global minimum true economic cost, breaking economic ties by FEFO
    (minimizing total shelf-life consumption).
    """
    prod_map = {p.id: p for p in products}
    dest_map = {d.id: d for d in destinations}
    route_map = {(r.source_warehouse_id, r.destination_id): r for r in routes}
    batch_map = {b.batch_id: b for b in batches}
    demand_map = {(dr.destination_id, dr.product_id): dr.forecasted_demand for dr in demand_records}

    # Identify eligible decision variables (w, d, p, b)
    eligible_legs = []
    for (w_id, d_id), route in route_map.items():
        for b in batches:
            if b.warehouse_id == w_id and not b.is_expired:
                prod = prod_map[b.product_id]
                # Shelf-life on arrival
                if (b.days_to_expiry - route.transit_time_days) >= prod.min_shelf_life_required_days:
                    # Check demand exists
                    if demand_map.get((d_id, prod.id), 0) > 0:
                        max_possible = min(
                            b.quantity,
                            demand_map[(d_id, prod.id)],
                            route.max_capacity_units if route.max_capacity_units is not None else 999999
                        )
                        eligible_legs.append((w_id, d_id, prod.id, b.batch_id, max_possible))

    if not eligible_legs:
        # Zero allocation possible; 100% shortage
        total_shortage = sum(
            dr.forecasted_demand * prod_map[dr.product_id].shortage_penalty_per_unit * (1.30 if dest_map[dr.destination_id].tier == "Tier-1" else 1.0)
            for dr in demand_records
        )
        return {
            "min_economic_cost": round(total_shortage, 2),
            "best_fefo_score": 0.0,
            "best_allocation": {},
            "total_evaluated": 1,
            "optimal_solutions_count": 1
        }

    # Range of candidate values for each eligible leg
    var_ranges = [range(max_val + 1) for (_, _, _, _, max_val) in eligible_legs]

    min_cost = float("inf")
    best_fefo = float("inf")
    best_allocation = {}
    optimal_count = 0
    total_evaluated = 0

    for combo in itertools.product(*var_ranges):
        total_evaluated += 1
        alloc_dict = {eligible_legs[i][:4]: combo[i] for i in range(len(combo))}

        # 1. Batch capacity constraint: sum_d x <= Q_batch
        valid = True
        batch_shipped = {}
        for (w_id, d_id, p_id, b_id), qty in alloc_dict.items():
            batch_shipped[b_id] = batch_shipped.get(b_id, 0) + qty
            if batch_shipped[b_id] > batch_map[b_id].quantity:
                valid = False
                break
        if not valid:
            continue

        # 2. Destination demand bound: sum_w,b x <= D_{d,p}
        dest_received = {}
        for (w_id, d_id, p_id, b_id), qty in alloc_dict.items():
            dp = (d_id, p_id)
            dest_received[dp] = dest_received.get(dp, 0) + qty
            if dest_received[dp] > demand_map.get(dp, 0):
                valid = False
                break
        if not valid:
            continue

        # 3. Route unit and weight capacity
        route_units = {}
        route_weight = {}
        for (w_id, d_id, p_id, b_id), qty in alloc_dict.items():
            r_key = (w_id, d_id)
            route = route_map[r_key]
            route_units[r_key] = route_units.get(r_key, 0) + qty
            if route.max_capacity_units is not None and route_units[r_key] > route.max_capacity_units:
                valid = False
                break

            prod = prod_map[p_id]
            route_weight[r_key] = route_weight.get(r_key, 0.0) + (qty * prod.unit_weight_kg)
            if route.max_capacity_kg is not None and route_weight[r_key] > (route.max_capacity_kg + 1e-5):
                valid = False
                break
        if not valid:
            continue

        # Compute true economic cost: freight + shortage penalty
        freight_cost = sum(
            qty * route_map[(w_id, d_id)].unit_cost
            for (w_id, d_id, p_id, b_id), qty in alloc_dict.items()
        )
        shortage_cost = 0.0
        for (d_id, p_id), demand in demand_map.items():
            fulfilled = dest_received.get((d_id, p_id), 0)
            unmet = demand - fulfilled
            tier_mult = 1.30 if dest_map[d_id].tier == "Tier-1" else 1.0
            shortage_cost += unmet * prod_map[p_id].shortage_penalty_per_unit * tier_mult

        total_cost = round(freight_cost + shortage_cost, 4)

        # Compute FEFO score: sum(days_to_expiry * qty)
        fefo_score = sum(
            qty * batch_map[b_id].days_to_expiry
            for (w_id, d_id, p_id, b_id), qty in alloc_dict.items()
        )

        # Lexicographic minimization: primary = economic cost, secondary = FEFO score
        if total_cost < min_cost - 1e-4:
            min_cost = total_cost
            best_fefo = fefo_score
            best_allocation = {k: v for k, v in alloc_dict.items() if v > 0}
            optimal_count = 1
        elif abs(total_cost - min_cost) <= 1e-4:
            optimal_count += 1
            if fefo_score < best_fefo:
                best_fefo = fefo_score
                best_allocation = {k: v for k, v in alloc_dict.items() if v > 0}

    return {
        "min_economic_cost": round(min_cost, 2),
        "best_fefo_score": best_fefo,
        "best_allocation": best_allocation,
        "total_evaluated": total_evaluated,
        "optimal_solutions_count": optimal_count
    }
