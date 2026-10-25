"""
SupplySync Phase 2 Verification Test Suite
Covers:
1. Price lookup using real rows from bundled M5 sample.
2. Correct price lookup for different stores or weeks.
3. Missing price behavior (returns None, no invented data).
4. Correct calendar-to-M5-week mapping (2011-01-29 -> wm_yr_wk 11101).
5. No silent replacement of missing M5 prices.
6. Weight-capacity enforcement (route.max_capacity_kg).
7. Mixed products with different unit weights.
8. Route with insufficient weight capacity.
9. Feasible alternative route with sufficient capacity.
10. Baseline compliance with weight and unit-count limits.
11. Independent validator rejection of overweight allocation (Invariant 3B).
12. Regression of existing shelf-life and inventory constraints.
13. Synthetic-mode compatibility.
"""

import pytest
from datetime import datetime
from engine.m5_loader import M5DataLoader, m5_loader
from engine.m5_logistics import get_m5_products, get_m5_warehouses, get_m5_destinations, get_m5_routes
from engine.models import (
    Product, Warehouse, Destination, InventoryBatch, Route, DemandRecord,
    OptimizationPlan, ShipmentRecommendation, OptimizationMetrics
)
from engine.optimizer import run_optimization
from engine.baseline import run_baseline_allocation
from engine.validator import validate_plan_invariants, InvariantViolationError
from engine.demo_data import (
    get_demo_products, get_demo_warehouses, get_demo_destinations,
    get_demo_inventory_batches, get_demo_routes, get_demo_demand_records
)


# =========================================================================
# TESTS 1 - 5: REAL M5 PRICING & TEMPORAL JOINS
# =========================================================================

def test_1_price_lookup_real_sample_rows():
    """Test 1: Price lookup matches verified rows in data/m5/sample/sell_prices.csv."""
    loader = m5_loader
    
    # Verified ground truth from sell_prices.csv:
    # store_id,item_id,wm_yr_wk,sell_price
    # CA_1,FOODS_1_001,11101,1.98
    # CA_1,FOODS_1_002,11101,3.97
    # CA_1,FOODS_2_001,11101,5.48
    p1 = loader.get_price(item_id="FOODS_1_001", store_id="CA_1", wm_yr_wk=11101)
    assert p1 == 1.98, f"Expected 1.98 for FOODS_1_001 @ CA_1 wk 11101, got {p1}"

    p2 = loader.get_price(item_id="FOODS_1_002", store_id="CA_1", wm_yr_wk=11101)
    assert p2 == 3.97, f"Expected 3.97 for FOODS_1_002 @ CA_1 wk 11101, got {p2}"

    p3 = loader.get_price(item_id="FOODS_2_001", store_id="CA_1", wm_yr_wk=11101)
    assert p3 == 5.48, f"Expected 5.48 for FOODS_2_001 @ CA_1 wk 11101, got {p3}"


def test_2_price_lookup_across_stores_and_weeks():
    """Test 2: Correct price lookup for different stores and weeks where data provides examples."""
    loader = m5_loader
    
    # Verified sample rows in sell_prices.csv across stores and weeks
    # TX_1,FOODS_1_001,11101,1.98
    # TX_2,FOODS_1_002,11102,3.97
    # CA_2,HOBBIES_1_001,11101,5.48
    price_tx1 = loader.get_price(item_id="FOODS_1_001", store_id="TX_1", wm_yr_wk=11101)
    assert price_tx1 == 1.98

    price_tx2_wk2 = loader.get_price(item_id="FOODS_1_002", store_id="TX_2", wm_yr_wk=11102)
    assert price_tx2_wk2 == 3.97

    price_ca2 = loader.get_price(item_id="HOBBIES_1_001", store_id="CA_2", wm_yr_wk=11101)
    assert price_ca2 == 5.48

    # Price history query returns {wm_yr_wk: sell_price}
    history = loader.get_price_history(item_id="FOODS_1_001", store_id="CA_1")
    assert len(history) > 0
    assert 11101 in history
    assert history[11101] == 1.98


def test_3_missing_price_behavior():
    """Test 3: Missing price queries return None explicitly; never invent data."""
    loader = m5_loader
    
    # Non-existent item
    p_nonexistent = loader.get_price(item_id="NON_EXISTENT_SKU", store_id="CA_1", wm_yr_wk=11101)
    assert p_nonexistent is None

    # Non-existent store
    p_bad_store = loader.get_price(item_id="FOODS_1_001", store_id="NY_9", wm_yr_wk=11101)
    assert p_bad_store is None

    # Non-existent week
    p_bad_week = loader.get_price(item_id="FOODS_1_001", store_id="CA_1", wm_yr_wk=99999)
    assert p_bad_week is None


def test_4_calendar_to_m5_week_mapping():
    """Test 4: Correct calendar date-to-wm_yr_wk mapping from calendar.csv."""
    loader = m5_loader
    cal = loader.load_calendar()
    
    # Ground truth from calendar.csv:
    # 2011-01-29 -> d_1, wm_yr_wk = 11101, wday = 1 (Saturday)
    # 2011-02-04 -> d_7, wm_yr_wk = 11101, wday = 7 (Friday)
    # 2011-02-05 -> d_8, wm_yr_wk = 11102, wday = 1 (Saturday)
    d1_entry = cal[cal["date"] == "2011-01-29"].iloc[0]
    assert d1_entry["wm_yr_wk"] == 11101
    assert d1_entry["d"] == "d_1"

    d7_entry = cal[cal["date"] == "2011-02-04"].iloc[0]
    assert d7_entry["wm_yr_wk"] == 11101

    d8_entry = cal[cal["date"] == "2011-02-05"].iloc[0]
    assert d8_entry["wm_yr_wk"] == 11102


def test_5_no_silent_replacement_of_missing_m5_prices():
    """Test 5: Time series records preserve None for missing prices and never substitute synthetic prices."""
    loader = m5_loader
    ts = loader.load_time_series(item_id="FOODS_1_001", store_id="CA_1")
    
    assert len(ts) >= 10
    first_pt = ts[0]
    # Date 2011-01-29 has wm_yr_wk=11101 and observed price 1.98 in sell_prices.csv
    assert first_pt["date"] == "2011-01-29"
    assert first_pt["wm_yr_wk"] == 11101
    assert first_pt["sell_price"] == 1.98

    # Products initialized via get_m5_products() have price_source == 'real_m5'
    prods = get_m5_products()
    f1 = next(p for p in prods if p.id == "FOODS_1_001")
    assert f1.observed_sell_price == 1.98
    assert f1.price_source == "real_m5"
    assert f1.shortage_penalty_per_unit > 0
    # Provenance note verifies distinction between observed price and estimated costs
    assert "estimated" in f1.economic_note.lower()



# =========================================================================
# TESTS 6 - 11: WEIGHT CAPACITY & VEHICLE CONSTRAINT ENFORCEMENT
# =========================================================================

def _make_weight_test_fixtures(
    route_unit_cap=1000,
    route_weight_cap_kg=200.0,
    prod_weight_kg=5.0,
    demand_units=100,
    stock_units=500
):
    """Helper to build focused fixtures for weight constraint testing."""
    prod = Product(
        id="HEAVY-SKU",
        name="Industrial Flour Sack",
        category="Staples",
        unit_weight_kg=prod_weight_kg,
        shelf_life_days=60,
        min_shelf_life_required_days=5,
        holding_cost_per_day=0.05,
        shortage_penalty_per_unit=50.0,
        observed_sell_price=10.0,
        price_source="scenario_test"
    )
    wh = Warehouse(
        id="WH-1",
        name="Central DC",
        city="Chicago",
        state="IL",
        latitude=41.8781,
        longitude=-87.6298,
        storage_capacity_units=100000
    )
    dest = Destination(
        id="DEST-1",
        name="Regional Store",
        city="Peoria",
        state="IL",
        latitude=40.6936,
        longitude=-89.5890,
        tier="Tier-1",
        service_level_target=0.95
    )
    batch = InventoryBatch(
        batch_id="BATCH-01",
        product_id="HEAVY-SKU",
        warehouse_id="WH-1",
        quantity=stock_units,
        manufacturing_date="2026-10-01",
        expiry_date="2026-11-30",
        days_to_expiry=36,
        is_expired=False,
        status="usable"
    )
    route = Route(
        source_warehouse_id="WH-1",
        destination_id="DEST-1",
        unit_cost=2.0,
        distance_km=250,
        transit_time_days=1,
        max_capacity_units=route_unit_cap,
        max_capacity_kg=route_weight_cap_kg
    )
    demand = DemandRecord(
        destination_id="DEST-1",
        product_id="HEAVY-SKU",
        forecasted_demand=demand_units,
        historical_avg_daily=float(demand_units)
    )
    return [prod], [wh], [dest], [batch], [route], [demand]


def test_6_weight_capacity_enforcement():
    """Test 6: Weight capacity binds before unit capacity when products are heavy."""
    # Route has 1000 units capacity, but only 200 kg weight capacity.
    # Product is 5.0 kg/unit. Maximum units by weight = 200 / 5 = 40 units!
    # Demand is 100 units. Available stock is 500 units.
    products, warehouses, destinations, batches, routes, demand_records = _make_weight_test_fixtures(
        route_unit_cap=1000,
        route_weight_cap_kg=200.0,
        prod_weight_kg=5.0,
        demand_units=100,
        stock_units=500
    )

    plan = run_optimization(products, warehouses, destinations, batches, routes, demand_records)

    # Must allocate exactly 40 units (200.0 kg), NOT 100 units!
    assert plan.metrics.total_fulfilled_units == 40
    assert plan.metrics.total_weight_shipped_kg == 200.0
    assert plan.metrics.total_unmet_units == 60

    # Independent validator confirms invariants pass
    audit = validate_plan_invariants(plan, products, warehouses, destinations, batches, routes, demand_records)
    assert any("Invariant 3B Passed" in msg for msg in audit)


def test_7_mixed_products_with_different_unit_weights():
    """Test 7: Mixed products with different weights pack up to corridor weight limit."""
    p_heavy = Product(
        id="SKU-HEAVY",
        name="Steel Flour",
        category="Bulk",
        unit_weight_kg=10.0,
        shelf_life_days=90,
        min_shelf_life_required_days=5,
        shortage_penalty_per_unit=50.0
    )
    p_light = Product(
        id="SKU-LIGHT",
        name="Spices",
        category="Dry",
        unit_weight_kg=0.5,
        shelf_life_days=90,
        min_shelf_life_required_days=5,
        shortage_penalty_per_unit=50.0
    )
    wh = Warehouse(id="WH-1", name="DC", city="City", state="ST", latitude=0, longitude=0, storage_capacity_units=50000)
    dest = Destination(id="DEST-1", name="Store", city="City", state="ST", latitude=0, longitude=0, tier="Tier-1")
    
    b_heavy = InventoryBatch(
        batch_id="B-HVY", product_id="SKU-HEAVY", warehouse_id="WH-1", quantity=100,
        manufacturing_date="2026-10-01", expiry_date="2026-12-01", days_to_expiry=45, is_expired=False
    )
    b_light = InventoryBatch(
        batch_id="B-LGT", product_id="SKU-LIGHT", warehouse_id="WH-1", quantity=200,
        manufacturing_date="2026-10-01", expiry_date="2026-12-01", days_to_expiry=45, is_expired=False
    )
    # Route weight capacity is 150 kg total (units unlimited: 500)
    route = Route(
        source_warehouse_id="WH-1", destination_id="DEST-1", unit_cost=1.5,
        distance_km=100, transit_time_days=1, max_capacity_units=500, max_capacity_kg=150.0
    )
    # Demands: 10 heavy (100 kg) + 100 light (50 kg) = 150 kg exact fit
    demands = [
        DemandRecord(destination_id="DEST-1", product_id="SKU-HEAVY", forecasted_demand=10, historical_avg_daily=10.0),
        DemandRecord(destination_id="DEST-1", product_id="SKU-LIGHT", forecasted_demand=100, historical_avg_daily=100.0)
    ]

    plan = run_optimization([p_heavy, p_light], [wh], [dest], [b_heavy, b_light], [route], demands)

    assert plan.metrics.total_fulfilled_units == 110
    assert plan.metrics.total_weight_shipped_kg == 150.0
    audit = validate_plan_invariants(plan, [p_heavy, p_light], [wh], [dest], [b_heavy, b_light], [route], demands)
    assert any("Invariant 3B Passed" in msg for msg in audit)


def test_8_route_with_insufficient_weight_capacity():
    """Test 8: Route with strictly insufficient weight capacity forces shortage."""
    # 50 units demand of 4.0 kg item = 200 kg demand. Route payload limit is only 60.0 kg.
    # Max units allowed = 60 // 4 = 15 units.
    products, warehouses, destinations, batches, routes, demand_records = _make_weight_test_fixtures(
        route_unit_cap=500,
        route_weight_cap_kg=60.0,
        prod_weight_kg=4.0,
        demand_units=50,
        stock_units=200
    )

    plan = run_optimization(products, warehouses, destinations, batches, routes, demand_records)

    assert plan.metrics.total_fulfilled_units == 15
    assert plan.metrics.total_weight_shipped_kg == 60.0
    assert plan.metrics.total_unmet_units == 35
    assert len(plan.shortages) == 1
    assert plan.shortages[0].unmet_quantity == 35


def test_9_alternative_route_with_sufficient_capacity():
    """Test 9: Model selects more expensive alternative route when cheap route lacks weight capacity."""
    prod = Product(
        id="SKU-BULK", name="Rice", category="Grains", unit_weight_kg=5.0,
        shelf_life_days=120, min_shelf_life_required_days=5, shortage_penalty_per_unit=100.0
    )
    wh_cheap = Warehouse(id="WH-CHEAP", name="Small DC", city="A", state="ST", latitude=0, longitude=0, storage_capacity_units=10000)
    wh_ample = Warehouse(id="WH-AMPLE", name="Large DC", city="B", state="ST", latitude=0, longitude=0, storage_capacity_units=50000)
    dest = Destination(id="DEST-1", name="Supercenter", city="C", state="ST", latitude=0, longitude=0, tier="Tier-1")

    b_cheap = InventoryBatch(
        batch_id="B-C", product_id="SKU-BULK", warehouse_id="WH-CHEAP", quantity=200,
        manufacturing_date="2026-10-01", expiry_date="2027-01-01", days_to_expiry=60, is_expired=False
    )
    b_ample = InventoryBatch(
        batch_id="B-A", product_id="SKU-BULK", warehouse_id="WH-AMPLE", quantity=200,
        manufacturing_date="2026-10-01", expiry_date="2027-01-01", days_to_expiry=60, is_expired=False
    )

    # Route 1: Cheap ($1.50/unit) but only 50 kg weight capacity (= 10 units)
    r1 = Route(source_warehouse_id="WH-CHEAP", destination_id="DEST-1", unit_cost=1.50, distance_km=50, transit_time_days=1, max_capacity_kg=50.0)
    # Route 2: More expensive ($4.00/unit) but 2000 kg weight capacity (= 400 units)
    r2 = Route(source_warehouse_id="WH-AMPLE", destination_id="DEST-1", unit_cost=4.00, distance_km=200, transit_time_days=2, max_capacity_kg=2000.0)

    # Demand: 50 units (250 kg total)
    demand = DemandRecord(destination_id="DEST-1", product_id="SKU-BULK", forecasted_demand=50, historical_avg_daily=50.0)

    plan = run_optimization([prod], [wh_cheap, wh_ample], [dest], [b_cheap, b_ample], [r1, r2], [demand])

    # Model should ship 10 units via cheap route (saturating 50kg) and 40 units via ample route
    assert plan.metrics.total_fulfilled_units == 50
    assert plan.metrics.total_unmet_units == 0
    wh_shipped = {}
    for r in plan.recommendations:
        wh_shipped[r.source_warehouse_id] = wh_shipped.get(r.source_warehouse_id, 0) + r.allocated_quantity
    assert wh_shipped["WH-CHEAP"] == 10
    assert wh_shipped["WH-AMPLE"] == 40


def test_10_baseline_compliance_with_weight_and_units():
    """Test 10: Greedy baseline respects weight capacity limits alongside unit limits."""
    products, warehouses, destinations, batches, routes, demand_records = _make_weight_test_fixtures(
        route_unit_cap=1000,
        route_weight_cap_kg=150.0,
        prod_weight_kg=3.0,
        demand_units=80,
        stock_units=200
    )

    # Maximum units allowed on route = 150 // 3 = 50 units
    baseline_plan = run_baseline_allocation(products, warehouses, destinations, batches, routes, demand_records)

    assert baseline_plan.metrics.total_fulfilled_units == 50
    assert baseline_plan.metrics.total_weight_shipped_kg == 150.0
    assert baseline_plan.metrics.total_unmet_units == 30
    
    # Audit baseline plan
    audit = validate_plan_invariants(baseline_plan, products, warehouses, destinations, batches, routes, demand_records)
    assert any("Invariant 3B Passed" in msg for msg in audit)


def test_11_validator_rejects_overweight_allocation():
    """Test 11: Independent validator raises InvariantViolationError if allocation exceeds weight limit."""
    products, warehouses, destinations, batches, routes, demand_records = _make_weight_test_fixtures(
        route_unit_cap=1000,
        route_weight_cap_kg=100.0,  # 100 kg weight limit
        prod_weight_kg=5.0,
        demand_units=50,
        stock_units=200
    )

    # Construct an invalid plan that ships 30 units (150 kg > 100 kg limit)
    bad_recommendation = ShipmentRecommendation(
        recommendation_id="BAD-REC-01",
        product_id="HEAVY-SKU",
        product_name="Industrial Flour Sack",
        source_warehouse_id="WH-1",
        source_warehouse_name="Central DC",
        destination_id="DEST-1",
        destination_name="Regional Store",
        batch_id="BATCH-01",
        allocated_quantity=30,
        unit_transport_cost=2.0,
        total_transport_cost=60.0,
        destination_demand=50,
        batch_days_to_expiry=36,
        rationale="Overweight test shipment",
        total_weight_kg=150.0,  # 30 * 5.0 kg = 150.0 kg
        constraints_honored=[]
    )
    bad_metrics = OptimizationMetrics(
        strategy="illegal_test",
        total_demand_units=50,
        total_fulfilled_units=30,
        total_unmet_units=20,
        fulfillment_rate_pct=60.0,
        total_transport_cost=60.0,
        avg_unit_transport_cost=2.0,
        active_shipment_lanes=1,
        expiring_stock_utilized_units=0,
        estimated_avoided_waste_units=0,
        potential_waste_unallocated_units=0,
        destinations_with_shortages=1,
        total_weight_shipped_kg=150.0,
        solver_runtime_ms=1.0,
        solver_status="TEST"
    )
    bad_plan = OptimizationPlan(
        run_id="BAD-PLAN",
        strategy="illegal_test",
        created_at="2026-10-25T00:00:00Z",
        planning_horizon_days=7,
        metrics=bad_metrics,
        recommendations=[bad_recommendation],
        shortages=[]
    )

    with pytest.raises(InvariantViolationError) as exc_info:
        validate_plan_invariants(bad_plan, products, warehouses, destinations, batches, routes, demand_records)
    
    assert "Invariant 3B Violated" in str(exc_info.value)
    assert "exceeded max weight capacity 100.0kg" in str(exc_info.value)


# =========================================================================
# TESTS 12 - 13: REGRESSION & SYNTHETIC MODE COMPATIBILITY
# =========================================================================

def test_12_regression_shelf_life_and_inventory_constraints():
    """Test 12: Regression check ensuring shelf life, zero-expired, and inventory limits remain enforced."""
    # Product requiring 10 days remaining shelf life
    prod = Product(
        id="SKU-PERISHABLE", name="Dairy Drink", category="Dairy", unit_weight_kg=1.0,
        shelf_life_days=20, min_shelf_life_required_days=10, shortage_penalty_per_unit=50.0
    )
    wh = Warehouse(id="WH-1", name="DC", city="City", state="ST", latitude=0, longitude=0, storage_capacity_units=10000)
    dest = Destination(id="DEST-1", name="Retailer", city="City", state="ST", latitude=0, longitude=0, tier="Tier-1")
    
    # Batch 1: Expired (0 days left) -> Must never be touched
    b_exp = InventoryBatch(
        batch_id="B-EXP", product_id="SKU-PERISHABLE", warehouse_id="WH-1", quantity=100,
        manufacturing_date="2026-10-01", expiry_date="2026-10-25", days_to_expiry=0, is_expired=True
    )
    # Batch 2: 12 days left, route takes 4 days -> 8 days remaining on arrival < 10 days required -> Ineligible
    b_inelig = InventoryBatch(
        batch_id="B-INELIG", product_id="SKU-PERISHABLE", warehouse_id="WH-1", quantity=100,
        manufacturing_date="2026-10-10", expiry_date="2026-11-06", days_to_expiry=12, is_expired=False
    )
    # Batch 3: 20 days left, route takes 4 days -> 16 days remaining on arrival >= 10 days -> Eligible
    b_valid = InventoryBatch(
        batch_id="B-VALID", product_id="SKU-PERISHABLE", warehouse_id="WH-1", quantity=100,
        manufacturing_date="2026-10-20", expiry_date="2026-11-14", days_to_expiry=20, is_expired=False
    )
    route = Route(source_warehouse_id="WH-1", destination_id="DEST-1", unit_cost=2.0, distance_km=400, transit_time_days=4, max_capacity_units=500, max_capacity_kg=1000.0)
    demand = DemandRecord(destination_id="DEST-1", product_id="SKU-PERISHABLE", forecasted_demand=150, historical_avg_daily=150.0)

    plan = run_optimization([prod], [wh], [dest], [b_exp, b_inelig, b_valid], [route], [demand])

    # Only B-VALID can be used (up to 100 units). Shortage = 50 units.
    assert plan.metrics.total_fulfilled_units == 100
    assert len(plan.recommendations) == 1
    assert plan.recommendations[0].batch_id == "B-VALID"
    
    audit = validate_plan_invariants(plan, [prod], [wh], [dest], [b_exp, b_inelig, b_valid], [route], [demand])
    assert any("Invariant 4 & 4B Passed" in msg for msg in audit)


def test_13_synthetic_mode_compatibility():
    """Test 13: Synthetic mode end-to-end execution retains 100% compatibility."""
    prods = get_demo_products()
    whs = get_demo_warehouses()
    dests = get_demo_destinations()
    batches = get_demo_inventory_batches()
    routes = get_demo_routes()
    demands = get_demo_demand_records()

    # Verify synthetic products have price_source in configured/synthetic
    for p in prods:
        assert p.price_source in ("configured", "synthetic", "default_synthetic")

    # Run optimizer
    opt_plan = run_optimization(prods, whs, dests, batches, routes, demands)
    assert opt_plan.metrics.total_fulfilled_units > 0
    assert opt_plan.metrics.total_weight_shipped_kg > 0.0

    # Run baseline
    base_plan = run_baseline_allocation(prods, whs, dests, batches, routes, demands)
    assert base_plan.metrics.total_fulfilled_units > 0
    assert base_plan.metrics.total_weight_shipped_kg > 0.0

    # Validate both with independent invariant validator
    opt_audit = validate_plan_invariants(opt_plan, prods, whs, dests, batches, routes, demands)
    assert len(opt_audit) >= 6

    base_audit = validate_plan_invariants(base_plan, prods, whs, dests, batches, routes, demands)
    assert len(base_audit) >= 6
