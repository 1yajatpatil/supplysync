"""
SupplySync Mathematical Distribution Optimizer
Google OR-Tools Mixed-Integer Linear Programming (MILP) Engine:
- Formulates multi-echelon FMCG distribution across Warehouses (w), Destinations (d), Products (p), and Batches (b).
- Decision variables:
    x[w, d, p, b] >= 0 (Integer shipment quantity)
    u[d, p] >= 0 (Unmet demand slack variable)
- Hard physical constraints:
    1. Usable batch availability: sum_d x[w, d, p, b] <= usable_qty[w, p, b]
    2. Route capacity: sum_{p, b} x[w, d, p, b] <= route_capacity[w, d]
    3. Demand conservation: sum_{w, b} x[w, d, p, b] + u[d, p] == demand[d, p]
    4. Expiry filtering: Expired batches (days_to_expiry <= 0) have usable_qty == 0
- Objective function:
    Minimize Total Landed Freight + Unmet Demand Penalties + Avoidable Expiry Risk Penalties - FEFO Urgency Bonus
"""

import time
import uuid
from datetime import datetime, timezone
from typing import List, Dict, Tuple, Optional
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
    """
    start_time = time.time()

    # Pre-index mappings
    prod_map = {p.id: p for p in products}
    wh_map = {w.id: w for w in warehouses}
    dest_map = {d.id: d for d in destinations}
    batch_map = {b.batch_id: b for b in batches}
    route_map = {(r.source_warehouse_id, r.destination_id): r for r in routes}
    demand_map = {(dr.destination_id, dr.product_id): dr.forecasted_demand for dr in demand_records}

    # Filter out expired batches - Invariant 4
    usable_batches = [
        b for b in batches 
        if not b.is_expired and b.days_to_expiry > 0 and b.quantity > 0
    ]

    # Initialize Google OR-Tools solver (SCIP MILP solver)
    solver = pywraplp.Solver.CreateSolver('SCIP')
    if not solver:
        # Fallback to CBC or GLOP if SCIP is unavailable
        solver = pywraplp.Solver.CreateSolver('CBC') or pywraplp.Solver.CreateSolver('GLOP')
    
    if not solver:
        raise RuntimeError("Failed to initialize Google OR-Tools MIP solver backend.")

    # Decision variables: x[w, d, p, b]
    # Representing integer units shipped from warehouse w to destination d for product p from batch b
    x_vars: Dict[Tuple[str, str, str, str], Any] = {}
    
    # Slack variables for unmet demand: u[d, p]
    u_vars: Dict[Tuple[str, str], Any] = {}

    for d in destinations:
        for p in products:
            dp_key = (d.id, p.id)
            d_qty = demand_map.get(dp_key, 0)
            u_vars[dp_key] = solver.IntVar(0, d_qty, f"unmet_{d.id}_{p.id}")

    # Build valid routes & batch shipment variables
    for b in usable_batches:
        w_id = b.warehouse_id
        p_id = b.product_id
        for d in destinations:
            route_key = (w_id, d.id)
            if route_key in route_map:
                var_key = (w_id, d.id, p_id, b.batch_id)
                # Upper bound cannot exceed batch quantity
                x_vars[var_key] = solver.IntVar(0, b.quantity, f"x_{w_id}_{d.id}_{p_id}_{b.batch_id}")

    # 1. Constraint: Batch Usable Inventory limit
    # For every batch b, sum_d x[w, d, p, b] <= b.quantity
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

    # 2. Constraint: Route corridor capacity
    # For each route corridor (w, d), sum_{p, b} x[w, d, p, b] <= route.max_capacity_units
    for (w_id, d_id), route in route_map.items():
        if route.max_capacity_units is not None:
            corridor_shipments = []
            for (vw_id, vd_id, vp_id, vb_id), var in x_vars.items():
                if vw_id == w_id and vd_id == d_id:
                    corridor_shipments.append(var)
            if corridor_shipments:
                solver.Add(solver.Sum(corridor_shipments) <= route.max_capacity_units)

    # 3. Constraint: Demand conservation
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

    # 4. Objective Function Formulation:
    # Minimize:
    #   sum(x * unit_transport_cost)
    #   + sum(u * shortage_penalty)
    #   + FEFO incentives: batches with earlier expiry receive a priority bonus
    objective = solver.Objective()

    for (w_id, d_id, p_id, b_id), var in x_vars.items():
        route = route_map[(w_id, d_id)]
        batch = batch_map[b_id]
        
        # Base coefficient is unit freight tariff
        coeff = route.unit_cost
        
        # FEFO bonus: If remaining shelf life is low (<= 15 days), subsidize coefficient
        # to ensure the solver prioritizes moving near-expiry inventory before fresh stock
        if 0 < batch.days_to_expiry <= 15:
            # Expiry mitigation subsidy
            coeff -= 4.0  # Encourages immediate dispatch of near-expiry stock
        
        objective.SetCoefficient(var, coeff)

    for (d_id, p_id), u_var in u_vars.items():
        prod = prod_map[p_id]
        dest = dest_map[d_id]
        
        # Higher tier customers carry elevated shortage penalty to preserve SLAs
        tier_multiplier = 1.3 if dest.tier == "Tier-1" else 1.0
        penalty = prod.shortage_penalty_per_unit * tier_multiplier
        objective.SetCoefficient(u_var, penalty)

    objective.SetMinimization()

    # Set 15-second safety timeout on solver
    solver.SetTimeLimit(15000)

    # Execute optimization
    status = solver.Solve()

    if status not in (pywraplp.Solver.OPTIMAL, pywraplp.Solver.FEASIBLE):
        raise OptimizationInfeasibleError(
            f"OR-Tools solver returned status code {status}. Constraints may be mutually contradictory."
        )

    solver_status_str = "OPTIMAL" if status == pywraplp.Solver.OPTIMAL else "FEASIBLE"

    # Extract decision variables and construct explainable recommendations
    recommendations: List[ShipmentRecommendation] = []
    fulfilled_per_dp: Dict[Tuple[str, str], int] = {}
    total_transport_cost = 0.0
    rec_counter = 1

    for (w_id, d_id, p_id, b_id), var in x_vars.items():
        qty = int(round(var.solution_value()))
        if qty > 0:
            route = route_map[(w_id, d_id)]
            batch = batch_map[b_id]
            prod = prod_map[p_id]
            dest = dest_map[d_id]
            line_cost = round(qty * route.unit_cost, 2)
            total_transport_cost += line_cost

            dp_key = (d_id, p_id)
            fulfilled_per_dp[dp_key] = fulfilled_per_dp.get(dp_key, 0) + qty

            # Synthesize explainability rationale
            reasons = []
            constraints_met = [
                f"Batch {b_id} stock limit ({batch.quantity} units)",
                f"Destination demand ({demand_map.get(dp_key, 0)} units)",
                "Zero expired inventory"
            ]
            if route.max_capacity_units is not None:
                constraints_met.append(f"Lane throughput limit ({route.max_capacity_units} units)")

            if 0 < batch.days_to_expiry <= 15:
                reasons.append(f"FEFO Prioritized: Batch expires in {batch.days_to_expiry} days; prioritized to eliminate avoidable waste.")
            else:
                reasons.append(f"Optimal Landed Freight: Cost-minimized lane (${route.unit_cost:.2f}/unit) from {wh_map[w_id].city}.")

            if dest.tier == "Tier-1":
                reasons.append("SLA Protected: Prioritized for Tier-1 retail service level.")

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
                    total_transport_cost=line_cost,
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

    # Expiry waste analysis
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
        total_transport_cost=round(total_transport_cost, 2),
        avg_unit_transport_cost=round(total_transport_cost / total_fulfilled, 2) if total_fulfilled > 0 else 0.0,
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
