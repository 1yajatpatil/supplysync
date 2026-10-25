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



def _build_milp_instance(
    products: List[Product],
    warehouses: List[Warehouse],
    destinations: List[Destination],
    usable_batches: List[InventoryBatch],
    route_map: Dict[Tuple[str, str], Route],
    demand_map: Dict[Tuple[str, str], int],
    prod_map: Dict[str, Product],
    dest_map: Dict[str, Destination],
    batch_map: Dict[str, InventoryBatch],
    enforce_strict_demand: bool,
    phase: int = 1,
    max_economic_cost: Optional[float] = None,
    min_total_fulfilled: Optional[int] = None,
    min_fulfilled_per_dp: Optional[Dict[Tuple[str, str], int]] = None
) -> Tuple[pywraplp.Solver, Dict[Tuple[str, str, str, str], Any], Dict[Tuple[str, str], Any]]:
    solver = pywraplp.Solver.CreateSolver('SCIP') or pywraplp.Solver.CreateSolver('CBC')
    if not solver:
        raise RuntimeError(
            "No compatible Mixed-Integer Programming solver available (SCIP or CBC required). "
            "Continuous LP solvers (like GLOP) cannot enforce integer shipment constraints."
        )

    x_vars: Dict[Tuple[str, str, str, str], Any] = {}
    u_vars: Dict[Tuple[str, str], Any] = {}
    cost_terms = []

    for d in destinations:
        for p in products:
            dp_key = (d.id, p.id)
            d_qty = demand_map.get(dp_key, 0)
            u_max = 0 if enforce_strict_demand else d_qty
            u_vars[dp_key] = solver.IntVar(0, u_max, f"unmet_{d.id}_{p.id}")

    for b in usable_batches:
        w_id = b.warehouse_id
        p_id = b.product_id
        prod = prod_map[p_id]
        for d in destinations:
            route_key = (w_id, d.id)
            if route_key in route_map:
                route = route_map[route_key]
                if (b.days_to_expiry - route.transit_time_days) >= prod.min_shelf_life_required_days:
                    var_key = (w_id, d.id, p_id, b.batch_id)
                    x_vars[var_key] = solver.IntVar(0, b.quantity, f"x_{w_id}_{d.id}_{p_id}_{b.batch_id}")

    # Constraint A: Batch inventory limit
    for b in usable_batches:
        w_id = b.warehouse_id
        p_id = b.product_id
        batch_shipments = [x_vars[(w_id, d.id, p_id, b.batch_id)] for d in destinations if (w_id, d.id, p_id, b.batch_id) in x_vars]
        if batch_shipments:
            solver.Add(solver.Sum(batch_shipments) <= b.quantity)

    # Constraint B: Route corridor capacity limit
    for (w_id, d_id), route in route_map.items():
        if route.max_capacity_units is not None:
            corridor_shipments = [var for (vw, vd, vp, vb), var in x_vars.items() if vw == w_id and vd == d_id]
            if corridor_shipments:
                solver.Add(solver.Sum(corridor_shipments) <= route.max_capacity_units)

    # Constraint B2: Route corridor weight capacity limit
    for (w_id, d_id), route in route_map.items():
        if route.max_capacity_kg is not None:
            corridor_weight_terms = [
                var * prod_map[vp].unit_weight_kg
                for (vw, vd, vp, vb), var in x_vars.items()
                if vw == w_id and vd == d_id and prod_map[vp].unit_weight_kg > 0
            ]
            if corridor_weight_terms:
                solver.Add(solver.Sum(corridor_weight_terms) <= route.max_capacity_kg)

    # Constraint C: Demand conservation
    for d in destinations:
        for p in products:
            dp_key = (d.id, p.id)
            d_qty = demand_map.get(dp_key, 0)
            incoming = [var for (vw, vd, vp, vb), var in x_vars.items() if vd == d.id and vp == p.id]
            if incoming:
                solver.Add(solver.Sum(incoming) + u_vars[dp_key] == d_qty)
            else:
                solver.Add(u_vars[dp_key] == d_qty)

    objective = solver.Objective()
    for (w_id, d_id, p_id, b_id), var in x_vars.items():
        tariff = route_map[(w_id, d_id)].unit_cost
        cost_terms.append((var, tariff))

    for (d_id, p_id), u_var in u_vars.items():
        prod = prod_map[p_id]
        dest = dest_map[d_id]
        tier_multiplier = 1.30 if dest.tier == "Tier-1" else 1.0
        penalty = prod.shortage_penalty_per_unit * tier_multiplier
        cost_terms.append((u_var, penalty))

    if phase == 1:
        # Phase 1: Minimize Pure Economic Cost (freight + shortage penalties)
        for var, coeff in cost_terms:
            objective.SetCoefficient(var, coeff)
        objective.SetMinimization()
    else:
        # Phase 2: Minimize shelf-life consumption subject to exact economic optimality
        cost_bound_constraint = solver.Constraint(-solver.infinity(), (max_economic_cost or 0.0) + 1e-4)
        for var, coeff in cost_terms:
            cost_bound_constraint.SetCoefficient(var, coeff)

        if min_total_fulfilled is not None:
            fulfilled_bound_constraint = solver.Constraint(float(min_total_fulfilled), solver.infinity())
            for var in x_vars.values():
                fulfilled_bound_constraint.SetCoefficient(var, 1.0)

        if min_fulfilled_per_dp is not None:
            for (d_id, p_id), min_qty in min_fulfilled_per_dp.items():
                if min_qty > 0:
                    dp_bound = solver.Constraint(float(min_qty), solver.infinity())
                    for (vw, vd, vp, vb), var in x_vars.items():
                        if vd == d_id and vp == p_id:
                            dp_bound.SetCoefficient(var, 1.0)

        for (w_id, d_id, p_id, b_id), var in x_vars.items():
            batch = batch_map[b_id]
            objective.SetCoefficient(var, float(batch.days_to_expiry))
        objective.SetMinimization()

    return solver, x_vars, u_vars


def run_ortools_optimization(
    products: List[Product],
    warehouses: List[Warehouse],
    destinations: List[Destination],
    batches: List[InventoryBatch],
    routes: List[Route],
    demand_records: List[DemandRecord],
    planning_horizon_days: int = 7,
    enforce_strict_demand: bool = False,
    time_limit_ms: int = 15000,
    data_source: str = "m5"
) -> OptimizationPlan:
    """
    Executes constrained Mixed-Integer Programming distribution optimization using Google OR-Tools.
    Enforces discrete integer shipment quantities, strict physical network constraints,
    and two-phase lexicographic optimization (Phase 1: Pure Economic Cost; Phase 2: FEFO).
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

    STATUS_NAME_MAP = {
        pywraplp.Solver.OPTIMAL: "OPTIMAL",
        pywraplp.Solver.FEASIBLE: "FEASIBLE",
        pywraplp.Solver.INFEASIBLE: "INFEASIBLE",
        pywraplp.Solver.UNBOUNDED: "UNBOUNDED",
        pywraplp.Solver.ABNORMAL: "ABNORMAL",
        pywraplp.Solver.MODEL_INVALID: "MODEL_INVALID",
        pywraplp.Solver.NOT_SOLVED: "NOT_SOLVED",
    }

    # 1. Phase 1: Pure Economic Cost Minimization
    solver1, x1, u1 = _build_milp_instance(
        products, warehouses, destinations, usable_batches, route_map, demand_map,
        prod_map, dest_map, batch_map, enforce_strict_demand, phase=1
    )
    solver1.SetTimeLimit(time_limit_ms)
    status1 = solver1.Solve()

    if status1 not in (pywraplp.Solver.OPTIMAL, pywraplp.Solver.FEASIBLE):
        status_name = STATUS_NAME_MAP.get(status1, f"UNKNOWN_{status1}")
        raise OptimizationInfeasibleError(
            f"OR-Tools solver failed with status {status_name} (code {status1}). "
            f"Constraints may be mutually contradictory, demand unmet without shortage slack, or network disconnected."
        )

    solver_status_str = "OPTIMAL" if status1 == pywraplp.Solver.OPTIMAL else "FEASIBLE"
    p1_optimal_cost = solver1.Objective().Value()
    try:
        best_bound_val = solver1.Objective().BestBound()
    except Exception:
        best_bound_val = p1_optimal_cost if status1 == pywraplp.Solver.OPTIMAL else None

    if status1 == pywraplp.Solver.OPTIMAL:
        mip_gap_val = 0.0
    elif best_bound_val is not None and abs(p1_optimal_cost) > 1e-6:
        mip_gap_val = round(abs(p1_optimal_cost - best_bound_val) / abs(p1_optimal_cost), 4)
    else:
        mip_gap_val = None

    lexicographic_phase_str = "phase1_economic_only"
    active_x_vars = x1

    # 2. Phase 2: FEFO Prioritization with Pure Economic Cost Invariant
    # Executed in a fresh clean solver to guarantee zero state leakage or C++ sync warnings
    if status1 == pywraplp.Solver.OPTIMAL:
        p1_total_fulfilled = sum(int(round(var.solution_value())) for var in x1.values())
        elapsed_so_far_ms = (time.time() - start_time) * 1000
        remaining_time_ms = max(500, int(time_limit_ms - elapsed_so_far_ms))

        # Track per-(dest, prod) fulfilled in Phase 1 to guarantee exact preservation
        p1_fulfilled_per_dp: Dict[Tuple[str, str], int] = {}
        for (vw, vd, vp, vb), var in x1.items():
            qty = int(round(var.solution_value()))
            if qty > 0:
                dp = (vd, vp)
                p1_fulfilled_per_dp[dp] = p1_fulfilled_per_dp.get(dp, 0) + qty

        solver2, x2, u2 = _build_milp_instance(
            products, warehouses, destinations, usable_batches, route_map, demand_map,
            prod_map, dest_map, batch_map, enforce_strict_demand, phase=2,
            max_economic_cost=p1_optimal_cost, min_total_fulfilled=p1_total_fulfilled,
            min_fulfilled_per_dp=p1_fulfilled_per_dp
        )
        solver2.SetTimeLimit(remaining_time_ms)
        status2 = solver2.Solve()

        if status2 in (pywraplp.Solver.OPTIMAL, pywraplp.Solver.FEASIBLE):
            active_x_vars = x2
            lexicographic_phase_str = "phase2_fefo_optimal" if status2 == pywraplp.Solver.OPTIMAL else "phase2_fefo_feasible"

    # Extract decision variables and construct explainable recommendations
    recommendations: List[ShipmentRecommendation] = []
    fulfilled_per_dp: Dict[Tuple[str, str], int] = {}
    actual_total_freight_cost = 0.0
    rec_counter = 1

    for (w_id, d_id, p_id, b_id), var in active_x_vars.items():
        qty = int(round(var.solution_value()))
        if qty > 0:
            route = route_map[(w_id, d_id)]
            batch = batch_map[b_id]
            prod = prod_map[p_id]
            dest = dest_map[d_id]
            # Actual reported freight cost is strictly based on original route tariff
            line_freight = round(qty * route.unit_cost, 2)
            actual_total_freight_cost += line_freight
            line_weight = round(qty * prod.unit_weight_kg, 2)

            dp_key = (d_id, p_id)
            fulfilled_per_dp[dp_key] = fulfilled_per_dp.get(dp_key, 0) + qty

            # Structured explainability
            reasons = []
            constraints_met = [
                f"Batch {b_id} availability ({batch.quantity} units available)",
                f"Destination demand ({demand_map.get(dp_key, 0)} units)",
                "Zero expired inventory enforced",
                f"Arrival shelf life verified ({batch.days_to_expiry - route.transit_time_days}d remaining >= {prod.min_shelf_life_required_days}d required)"
            ]
            if route.max_capacity_units is not None:
                constraints_met.append(f"Lane throughput limit ({route.max_capacity_units} units)")
            if route.max_capacity_kg is not None:
                constraints_met.append(f"Lane payload weight limit ({route.max_capacity_kg} kg)")

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
                    total_weight_kg=line_weight,
                    observed_unit_price=prod.observed_sell_price,
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

    total_weight_shipped = round(sum(r.total_weight_kg for r in recommendations), 2)
    estimated_shortage_penalty = round(
        sum(
            s.unmet_quantity * prod_map[s.product_id].shortage_penalty_per_unit * (1.30 if dest_map[s.destination_id].tier == "Tier-1" else 1.0)
            for s in shortages
        ),
        2
    )
    has_observed_prices = any(p.observed_sell_price is not None for p in products)
    observed_revenue = (
        round(sum(r.allocated_quantity * (r.observed_unit_price or 0.0) for r in recommendations if r.observed_unit_price is not None), 2)
        if has_observed_prices else None
    )

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
        total_weight_shipped_kg=total_weight_shipped,
        estimated_shortage_cost=estimated_shortage_penalty,
        observed_sales_revenue=observed_revenue,
        solver_runtime_ms=elapsed_ms,
        solver_status=solver_status_str,
        total_evaluated_cost=round(actual_total_freight_cost + estimated_shortage_penalty, 2),
        solver_objective_value=round(p1_optimal_cost, 2),
        best_bound=round(best_bound_val, 2) if best_bound_val is not None else None,
        mip_gap=mip_gap_val,
        lexicographic_phase=lexicographic_phase_str
    )

    return OptimizationPlan(
        run_id=f"RUN-OPT-{uuid.uuid4().hex[:8].upper()}",
        strategy="optimized_ortools",
        created_at=datetime.now(timezone.utc).isoformat(),
        planning_horizon_days=planning_horizon_days,
        data_source=data_source,
        metrics=metrics,
        recommendations=recommendations,
        shortages=shortages
    )


# Alias for backward and ergonomic compatibility
run_optimization = run_ortools_optimization

