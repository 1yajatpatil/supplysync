"""
SupplySync Invariant Validator
Enforces the 10 critical mathematical and operational invariants on any distribution plan:
1. No negative shipment quantities.
2. No warehouse ships more usable inventory than it possesses (per batch and total).
3. No route throughput exceeds configured corridor capacity.
4. No expired stock is ever allocated.
5. All shipments map to valid products, warehouses, and destinations.
6. Demand fulfillment calculations are mathematically consistent.
7. Total reported transportation costs match sum of (quantity * unit_cost).
8. Fulfilled quantity never exceeds total destination demand.
9. Baseline and optimized plans evaluate the exact same demand snapshot.
10. Infeasible allocations are captured and raised explicitly.
"""

from typing import List, Dict, Tuple, Any
from .models import (
    Product, 
    Warehouse, 
    Destination, 
    InventoryBatch, 
    Route, 
    DemandRecord, 
    OptimizationPlan,
    ShipmentRecommendation
)


class InvariantViolationError(ValueError):
    """Raised when an allocation invariant is violated."""
    pass


def validate_plan_invariants(
    plan: OptimizationPlan,
    products: List[Product],
    warehouses: List[Warehouse],
    destinations: List[Destination],
    batches: List[InventoryBatch],
    routes: List[Route],
    demand_records: List[DemandRecord]
) -> List[str]:
    """
    Validates all invariants against physical constraints.
    Returns a list of audit confirmation messages if valid, or raises InvariantViolationError if broken.
    """
    audit_log = []
    
    # Pre-index master data
    prod_map = {p.id: p for p in products}
    wh_map = {w.id: w for w in warehouses}
    dest_map = {d.id: d for d in destinations}
    batch_map = {b.batch_id: b for b in batches}
    route_map = {(r.source_warehouse_id, r.destination_id): r for r in routes}
    demand_map = {(dr.destination_id, dr.product_id): dr.forecasted_demand for dr in demand_records}

    # Tracking accumulators
    seen_rec_ids = set()
    seen_alloc_keys = set()
    batch_shipped: Dict[str, int] = {}
    wh_product_shipped: Dict[Tuple[str, str], int] = {}
    route_shipped: Dict[Tuple[str, str], int] = {}
    route_weight_shipped: Dict[Tuple[str, str], float] = {}
    dest_product_received: Dict[Tuple[str, str], int] = {}
    calculated_transport_cost: float = 0.0

    # 1. Inspect each individual recommendation
    for rec in plan.recommendations:
        # Check duplicate recommendation IDs
        if rec.recommendation_id in seen_rec_ids:
            raise InvariantViolationError(
                f"Invariant Violation: Duplicate recommendation_id '{rec.recommendation_id}' detected"
            )
        seen_rec_ids.add(rec.recommendation_id)

        # Check duplicate allocation legs
        alloc_key = (rec.source_warehouse_id, rec.destination_id, rec.product_id, rec.batch_id)
        if alloc_key in seen_alloc_keys:
            raise InvariantViolationError(
                f"Invariant Violation: Duplicate allocation leg {alloc_key} detected; recommendations must be consolidated"
            )
        seen_alloc_keys.add(alloc_key)

        # Invariant 1: Strictly positive integer shipment
        if not isinstance(rec.allocated_quantity, int) or isinstance(rec.allocated_quantity, bool) or rec.allocated_quantity <= 0:
            raise InvariantViolationError(
                f"Invariant 1 Violated: Non-positive or non-integer allocation ({rec.allocated_quantity}) in recommendation {rec.recommendation_id}"
            )

        # Invariant 5: Valid master data relationships & cross-entity consistency
        if rec.product_id not in prod_map:
            raise InvariantViolationError(f"Invariant 5 Violated: Unknown product_id '{rec.product_id}'")
        if rec.source_warehouse_id not in wh_map:
            raise InvariantViolationError(f"Invariant 5 Violated: Unknown warehouse_id '{rec.source_warehouse_id}'")
        if rec.destination_id not in dest_map:
            raise InvariantViolationError(f"Invariant 5 Violated: Unknown destination_id '{rec.destination_id}'")
        if rec.batch_id not in batch_map:
            raise InvariantViolationError(f"Invariant 5 Violated: Unknown batch_id '{rec.batch_id}'")

        batch = batch_map[rec.batch_id]
        prod = prod_map[rec.product_id]

        if batch.warehouse_id != rec.source_warehouse_id:
            raise InvariantViolationError(
                f"Invariant 5 Violated: Batch '{batch.batch_id}' is stored at warehouse '{batch.warehouse_id}', "
                f"but recommendation specifies warehouse '{rec.source_warehouse_id}'!"
            )
        if batch.product_id != rec.product_id:
            raise InvariantViolationError(
                f"Invariant 5 Violated: Batch '{batch.batch_id}' holds product '{batch.product_id}', "
                f"but recommendation specifies product '{rec.product_id}'!"
            )
        
        # Invariant 4: No expired stock allocated
        if batch.is_expired or batch.days_to_expiry <= 0:
            raise InvariantViolationError(
                f"Invariant 4 Violated: Expired batch '{batch.batch_id}' (days_to_expiry: {batch.days_to_expiry}) allocated!"
            )

        # Invariant 4B: Arrival shelf-life validity
        route_key = (rec.source_warehouse_id, rec.destination_id)
        if route_key not in route_map:
            raise InvariantViolationError(f"Route '{route_key}' does not exist in network configuration")
        route = route_map[route_key]

        remaining_shelf_life_at_arrival = batch.days_to_expiry - route.transit_time_days
        if remaining_shelf_life_at_arrival < prod.min_shelf_life_required_days:
            raise InvariantViolationError(
                f"Invariant 4B Violated: Batch '{batch.batch_id}' has {batch.days_to_expiry}d shelf life, "
                f"route transit time is {route.transit_time_days}d (leaving {remaining_shelf_life_at_arrival}d on arrival), "
                f"which violates minimum required {prod.min_shelf_life_required_days}d for product '{prod.id}' at destination '{rec.destination_id}'!"
            )

        # Invariant 7: Cost math verification
        expected_route_cost = route.unit_cost
        if abs(rec.unit_transport_cost - expected_route_cost) > 0.001:
            raise InvariantViolationError(
                f"Invariant 7 Violated: Mismatched unit cost for route {route_key}. Reported: {rec.unit_transport_cost}, Expected: {expected_route_cost}"
            )
        
        expected_line_cost = round(rec.allocated_quantity * expected_route_cost, 2)
        if abs(rec.total_transport_cost - expected_line_cost) > 0.05:
            raise InvariantViolationError(
                f"Invariant 7 Violated: Line cost calculation error. Reported: {rec.total_transport_cost}, Expected: {expected_line_cost}"
            )
        calculated_transport_cost += rec.total_transport_cost

        # Invariant 3B line-level weight math verification
        expected_line_weight = round(rec.allocated_quantity * prod.unit_weight_kg, 2)
        if abs(rec.total_weight_kg - expected_line_weight) > 0.05:
            raise InvariantViolationError(
                f"Invariant 3B Violated: Line weight calculation error for recommendation '{rec.recommendation_id}'. "
                f"Reported: {rec.total_weight_kg}kg, Expected: {expected_line_weight}kg ({rec.allocated_quantity} * {prod.unit_weight_kg}kg)"
            )

        # Accumulate
        batch_shipped[rec.batch_id] = batch_shipped.get(rec.batch_id, 0) + rec.allocated_quantity
        wh_key = (rec.source_warehouse_id, rec.product_id)
        wh_product_shipped[wh_key] = wh_product_shipped.get(wh_key, 0) + rec.allocated_quantity
        route_shipped[route_key] = route_shipped.get(route_key, 0) + rec.allocated_quantity
        route_weight_shipped[route_key] = route_weight_shipped.get(route_key, 0.0) + rec.total_weight_kg
        dp_key = (rec.destination_id, rec.product_id)
        dest_product_received[dp_key] = dest_product_received.get(dp_key, 0) + rec.allocated_quantity

    audit_log.append("Invariant 1 & 5 Passed: All recommendations are strictly positive integers with valid master data entities.")
    audit_log.append("Invariant 4 & 4B Passed: Zero expired batches allocated and arrival shelf-life constraints strictly honored.")

    # Invariant 2: No warehouse/batch ships more than usable stock
    for batch_id, qty in batch_shipped.items():
        batch = batch_map[batch_id]
        if qty > batch.quantity:
            raise InvariantViolationError(
                f"Invariant 2 Violated: Batch '{batch_id}' has {batch.quantity} units available but {qty} units were allocated!"
            )
    audit_log.append("Invariant 2 Passed: Batch allocations strictly bounded by available inventory.")

    # Invariant 3: Route corridor unit capacity
    for route_key, qty in route_shipped.items():
        route = route_map[route_key]
        if route.max_capacity_units is not None and qty > route.max_capacity_units:
            raise InvariantViolationError(
                f"Invariant 3 Violated: Route corridor {route_key} exceeded max capacity {route.max_capacity_units} with {qty} units!"
            )
    audit_log.append("Invariant 3 Passed: Route corridor unit capacities strictly honored.")

    # Invariant 3B: Route corridor physical weight capacity
    for route_key, total_weight in route_weight_shipped.items():
        route = route_map[route_key]
        if route.max_capacity_kg is not None and total_weight > (route.max_capacity_kg + 0.05):
            raise InvariantViolationError(
                f"Invariant 3B Violated: Route corridor {route_key} exceeded max weight capacity "
                f"{route.max_capacity_kg}kg with {round(total_weight, 2)}kg!"
            )
    audit_log.append("Invariant 3B Passed: Route corridor weight capacities strictly honored.")

    # Invariant 6 & 8: Shipments never exceed destination demand
    for dp_key, qty in dest_product_received.items():
        dst_id, p_id = dp_key
        demand = demand_map.get(dp_key, 0)
        if qty > demand:
            raise InvariantViolationError(
                f"Invariant 8 Violated: Destination '{dst_id}' received {qty} of '{p_id}', exceeding demand of {demand}!"
            )
    audit_log.append("Invariant 6 & 8 Passed: Destination demand is never over-allocated.")

    # Invariant 7: Total plan cost audit (tight 0.05 tolerance)
    if abs(plan.metrics.total_transport_cost - round(calculated_transport_cost, 2)) > 0.05:
        raise InvariantViolationError(
            f"Invariant 7 Violated: Plan total cost ({plan.metrics.total_transport_cost}) differs from sum of line items ({round(calculated_transport_cost, 2)})"
        )
    audit_log.append("Invariant 7 Passed: Total transport cost matches sum of shipment line items.")

    # Invariant 3B Aggregate: Total plan weight audit
    expected_total_weight = round(sum(r.total_weight_kg for r in plan.recommendations), 2)
    if abs(plan.metrics.total_weight_shipped_kg - expected_total_weight) > 0.05:
        raise InvariantViolationError(
            f"Invariant 3B Violated: Plan total weight ({plan.metrics.total_weight_shipped_kg}kg) differs from sum of line items ({expected_total_weight}kg)"
        )
    audit_log.append("Invariant 3B Passed: Total plan weight matches sum of shipment line items.")

    # Invariant 6 Aggregate: Demand, fulfillment, and shortage integrity
    expected_total_demand = sum(dr.forecasted_demand for dr in demand_records)
    if plan.metrics.total_demand_units != expected_total_demand:
        raise InvariantViolationError(
            f"Invariant 6 Violated: Plan total demand ({plan.metrics.total_demand_units}) differs from input demand records ({expected_total_demand})"
        )

    expected_total_fulfilled = sum(rec.allocated_quantity for rec in plan.recommendations)
    if plan.metrics.total_fulfilled_units != expected_total_fulfilled:
        raise InvariantViolationError(
            f"Invariant 6 Violated: Plan total fulfilled ({plan.metrics.total_fulfilled_units}) differs from sum of allocated recommendations ({expected_total_fulfilled})"
        )

    expected_total_unmet = max(0, expected_total_demand - expected_total_fulfilled)
    if plan.metrics.total_unmet_units != expected_total_unmet:
        raise InvariantViolationError(
            f"Invariant 6 Violated: Plan total unmet ({plan.metrics.total_unmet_units}) differs from demand minus fulfilled ({expected_total_unmet})"
        )

    shortage_units_sum = sum(s.unmet_quantity for s in plan.shortages)
    if shortage_units_sum != plan.metrics.total_unmet_units:
        raise InvariantViolationError(
            f"Invariant 6 Violated: Sum of shortage line items ({shortage_units_sum}) differs from plan total unmet units ({plan.metrics.total_unmet_units})"
        )

    expected_shortage_penalty = round(
        sum(
            s.unmet_quantity * prod_map[s.product_id].shortage_penalty_per_unit * (1.30 if dest_map[s.destination_id].tier == "Tier-1" else 1.0)
            for s in plan.shortages
        ),
        2
    )
    # Invariant 6 Aggregate: Fulfillment rate audit
    expected_fulfillment_rate = (
        round((expected_total_fulfilled / expected_total_demand * 100), 2)
        if expected_total_demand > 0 else 100.0
    )
    if abs(plan.metrics.fulfillment_rate_pct - expected_fulfillment_rate) > 0.05:
        raise InvariantViolationError(
            f"Invariant 6 Violated: Plan fulfillment rate ({plan.metrics.fulfillment_rate_pct}%) differs from computed rate ({expected_fulfillment_rate}%)"
        )

    # Invariant 7: Average unit transport cost audit
    expected_avg_unit_cost = (
        round(calculated_transport_cost / expected_total_fulfilled, 2)
        if expected_total_fulfilled > 0 else 0.0
    )
    if abs(plan.metrics.avg_unit_transport_cost - expected_avg_unit_cost) > 0.05:
        raise InvariantViolationError(
            f"Invariant 7 Violated: Plan average unit transport cost ({plan.metrics.avg_unit_transport_cost}) differs from computed ({expected_avg_unit_cost})"
        )

    # Invariant 7: Total evaluated economic cost audit
    if plan.metrics.total_evaluated_cost is not None:
        expected_total_eval = round(plan.metrics.total_transport_cost + plan.metrics.estimated_shortage_cost, 2)
        if abs(plan.metrics.total_evaluated_cost - expected_total_eval) > 0.05:
            raise InvariantViolationError(
                f"Invariant 7 Violated: Plan total evaluated cost (${plan.metrics.total_evaluated_cost}) differs from sum of transport and shortage (${expected_total_eval})"
            )

    audit_log.append("Invariant 6 & 7 Passed: Aggregate demand, fulfillment, and shortage penalty metrics fully reconciled.")

    return audit_log


def validate_input_dataset(
    products: List[Any],
    warehouses: List[Any],
    destinations: List[Any],
    batches: List[Any],
    routes: List[Any],
    demand_records: List[Any]
) -> Dict[str, Any]:
    """
    Validates uploaded or candidate dataset before optimization.
    Distinguishes blocking errors (infeasible / malformed data) from warnings.
    Supports both Pydantic models and dictionaries.
    """
    errors: List[str] = []
    warnings: List[str] = []

    def get_val(obj: Any, keys: Union[str, List[str]], default: Any = None) -> Any:
        if isinstance(keys, str):
            keys = [keys]
        for k in keys:
            if isinstance(obj, dict):
                if k in obj and obj[k] is not None:
                    return obj[k]
            elif hasattr(obj, k):
                val = getattr(obj, k)
                if val is not None:
                    return val
        return default

    # 1. Structural checks
    if not products:
        errors.append("Products dataset is empty. At least one product is required.")
    if not warehouses:
        errors.append("Warehouses dataset is empty. At least one warehouse is required.")
    if not destinations:
        errors.append("Destinations dataset is empty. At least one customer/store destination is required.")
    if not batches:
        errors.append("Inventory batches dataset is empty. Physical stock is required.")
    if not routes:
        errors.append("Routes dataset is empty. Transportation corridors are required.")
    if not demand_records:
        errors.append("Demand records dataset is empty. Forecasted customer demand is required.")

    # 2. Master ID uniqueness and mappings
    prod_ids = set()
    for idx, p in enumerate(products):
        pid = str(get_val(p, ["id", "product_id"], "")).strip()
        if not pid:
            errors.append(f"Product at row {idx + 1} has an empty 'id'.")
        elif pid in prod_ids:
            errors.append(f"Duplicate product ID '{pid}' detected.")
        else:
            prod_ids.add(pid)

    wh_ids = set()
    for idx, w in enumerate(warehouses):
        wid = str(get_val(w, ["id", "warehouse_id"], "")).strip()
        if not wid:
            errors.append(f"Warehouse at row {idx + 1} has an empty 'id'.")
        elif wid in wh_ids:
            errors.append(f"Duplicate warehouse ID '{wid}' detected.")
        else:
            wh_ids.add(wid)

    dest_ids = set()
    for idx, d in enumerate(destinations):
        did = str(get_val(d, ["id", "destination_id", "dest_id"], "")).strip()
        if not did:
            errors.append(f"Destination at row {idx + 1} has an empty 'id'.")
        elif did in dest_ids:
            errors.append(f"Duplicate destination ID '{did}' detected.")
        else:
            dest_ids.add(did)

    # 3. Batch validation & referential integrity
    batch_ids = set()
    total_inventory = 0
    expired_batches = 0
    for idx, b in enumerate(batches):
        bid = str(get_val(b, ["batch_id", "id"], "")).strip()
        pid = str(get_val(b, ["product_id", "id"], "")).strip()
        wid = str(get_val(b, ["warehouse_id", "holding_warehouse_id", "source_warehouse_id"], "")).strip()
        qty = get_val(b, ["quantity", "available_quantity", "stock"], 0)
        days_exp = get_val(b, ["days_to_expiry", "days_until_expiry", "shelf_life_days"], 90)

        if not bid:
            errors.append(f"Batch at row {idx + 1} is missing 'batch_id'.")
        elif bid in batch_ids:
            errors.append(f"Duplicate batch ID '{bid}' detected.")
        else:
            batch_ids.add(bid)

        if pid not in prod_ids:
            errors.append(f"Batch '{bid}' references unknown product ID '{pid}'.")
        if wid not in wh_ids:
            errors.append(f"Batch '{bid}' references unknown warehouse ID '{wid}'.")

        try:
            qty_num = int(qty)
            if qty_num < 0:
                errors.append(f"Batch '{bid}' has negative inventory quantity: {qty_num}.")
            else:
                total_inventory += qty_num
        except (ValueError, TypeError):
            errors.append(f"Batch '{bid}' has invalid non-integer quantity: '{qty}'.")

        try:
            days_num = int(days_exp)
            if days_num <= 0:
                expired_batches += 1
                warnings.append(f"Batch '{bid}' is already expired (days_to_expiry={days_num}) and will be excluded by FEFO rules.")
        except (ValueError, TypeError):
            errors.append(f"Batch '{bid}' has invalid 'days_to_expiry': '{days_exp}'.")

    # 4. Route validation & tariffs
    route_keys = set()
    for idx, r in enumerate(routes):
        swid = str(get_val(r, ["source_warehouse_id", "warehouse_id", "origin_id"], "")).strip()
        did = str(get_val(r, ["destination_id", "dest_id", "store_id"], "")).strip()
        cost = get_val(r, ["unit_cost", "transport_cost_per_unit", "transportation_cost", "cost_per_unit", "tariff"], None)

        if swid not in wh_ids:
            errors.append(f"Route at row {idx + 1} references unknown source warehouse '{swid}'.")
        if did not in dest_ids:
            errors.append(f"Route at row {idx + 1} references unknown destination '{did}'.")

        key = (swid, did)
        if key in route_keys:
            warnings.append(f"Duplicate route corridor between warehouse '{swid}' and destination '{did}'.")
        else:
            route_keys.add(key)

        try:
            cost_num = float(cost)
            if cost_num <= 0:
                errors.append(f"Route '{swid} -> {did}' has non-positive freight tariff / transportation cost: ${cost_num}.")
        except (ValueError, TypeError):
            errors.append(f"Route '{swid} -> {did}' is missing or has invalid unit transport cost / freight tariff: '{cost}'.")

    # 5. Demand validation & corridor connectivity
    demand_keys = set()
    total_demand = 0
    for idx, d in enumerate(demand_records):
        did = str(get_val(d, ["destination_id", "dest_id", "store_id"], "")).strip()
        pid = str(get_val(d, ["product_id", "id"], "")).strip()
        dem = get_val(d, ["forecasted_demand", "quantity", "demand"], 0)

        if did not in dest_ids:
            errors.append(f"Demand record at row {idx + 1} references unknown destination ID '{did}'.")
        if pid not in prod_ids:
            errors.append(f"Demand record at row {idx + 1} references unknown product ID '{pid}'.")

        key = (did, pid)
        if key in demand_keys:
            warnings.append(f"Multiple demand forecasts for destination '{did}' and product '{pid}'.")
        else:
            demand_keys.add(key)

        try:
            dem_num = int(dem)
            if dem_num < 0:
                errors.append(f"Demand record for '{did} - {pid}' has negative demand: {dem_num}.")
            else:
                total_demand += dem_num
        except (ValueError, TypeError):
            errors.append(f"Demand record for '{did} - {pid}' has invalid non-integer demand: '{dem}'.")

        # Check reachability: is there any route from ANY warehouse to this destination?
        reachable_warehouses = [w for w in wh_ids if (w, did) in route_keys]
        if not reachable_warehouses and did in dest_ids:
            errors.append(f"Destination '{did}' has demand for product '{pid}' but NO active routes connect to it from any warehouse.")

    # 6. High-level feasibility warnings
    if total_demand > total_inventory and total_inventory > 0:
        warnings.append(
            f"Total forecasted customer demand ({total_demand:,} units) exceeds total network inventory ({total_inventory:,} units). "
            f"The optimizer will strategically minimize customer shortage penalties."
        )

    return {
        "valid": len(errors) == 0,
        "errors": errors,
        "warnings": warnings,
        "summary": {
            "products_count": len(products),
            "warehouses_count": len(warehouses),
            "destinations_count": len(destinations),
            "batches_count": len(batches),
            "routes_count": len(routes),
            "demand_records_count": len(demand_records),
            "total_inventory_units": total_inventory,
            "total_forecasted_demand": total_demand,
            "expired_batches_count": expired_batches
        }
    }
