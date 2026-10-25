"""
Automated Test Suite for Fix 1 (M5 Loader Optimization) and Fix 2 (Arrival Shelf-Life Constraints)
Covers chronological ordering, entity mapping, cache invalidation, performance benchmarking,
and Tests A, B, C, D, E for arrival shelf-life constraints.
"""

import time
import pytest
from pathlib import Path
from datetime import datetime, timedelta

from engine.models import (
    Product,
    Warehouse,
    Destination,
    InventoryBatch,
    Route,
    DemandRecord
)
from engine.m5_loader import M5DataLoader, clear_m5_cache
from engine.demand import evaluate_forecasting_models
from engine.optimizer import run_ortools_optimization
from engine.baseline import run_baseline_allocation
from engine.validator import validate_plan_invariants, InvariantViolationError


# ---------------------------------------------------------------------------
# FIX 1: M5 Loader Tests
# ---------------------------------------------------------------------------

def test_m5_loader_sample_entities_and_mapping():
    """Verify entity discovery and item-store mapping."""
    loader = M5DataLoader()
    stores, items = loader.get_available_entities()
    assert len(stores) >= 2
    assert len(items) >= 2
    assert "CA_1" in stores
    assert "FOODS_1_001" in items


def test_m5_loader_chronological_ordering():
    """Verify that daily observations are strictly chronological."""
    loader = M5DataLoader()
    stores, items = loader.get_available_entities()
    ts = loader.load_time_series(items[0], stores[0])
    
    assert len(ts) >= 30
    for i in range(len(ts) - 1):
        assert ts[i]["day_index"] + 1 == ts[i+1]["day_index"]
        # Dates should be sequentially increasing
        d1 = datetime.strptime(ts[i]["date"], "%Y-%m-%d")
        d2 = datetime.strptime(ts[i+1]["date"], "%Y-%m-%d")
        assert (d2 - d1).days == 1


def test_m5_loader_missing_series_explicit_keyerror():
    """Verify that querying a missing item or store explicitly raises KeyError."""
    loader = M5DataLoader()
    with pytest.raises(KeyError) as exc_info:
        loader.load_time_series("NON_EXISTENT_SKU", "CA_1")
    assert "NON_EXISTENT_SKU" in str(exc_info.value)

    with pytest.raises(KeyError) as exc_info2:
        loader.load_time_series("FOODS_1_001", "NON_EXISTENT_STORE")
    assert "NON_EXISTENT_STORE" in str(exc_info2.value)


def test_m5_loader_cache_reuse():
    """Verify that repeated queries hit cache without re-reading CSV."""
    clear_m5_cache()
    loader = M5DataLoader()
    stores, items = loader.get_available_entities()

    # First access loads into cache
    ts1 = loader.load_time_series(items[0], stores[0])
    # Second access reads from cache
    ts2 = loader.load_time_series(items[0], stores[0])
    assert ts1 == ts2
    assert len(ts1) == len(ts2)


def test_m5_loader_cache_invalidation(tmp_path):
    """Verify cache invalidation when sales CSV is modified."""
    # Create temporary dataset directory
    tmp_m5 = tmp_path / "m5"
    tmp_m5.mkdir()
    
    cal_content = "date,wm_yr_wk,weekday,wday,month,year,d\n2011-01-29,11101,Saturday,1,1,2011,d_1\n2011-01-30,11101,Sunday,2,1,2011,d_2\n"
    (tmp_m5 / "calendar.csv").write_text(cal_content)
    
    sales_file = tmp_m5 / "sales_train_validation.csv"
    sales_file.write_text("id,item_id,dept_id,cat_id,store_id,state_id,d_1,d_2\nITEM1_STORE1,ITEM1,D,C,STORE1,CA,5,10\n")
    
    # Custom loader pointing to tmp_m5
    loader = M5DataLoader()
    loader.active_dir = tmp_m5
    loader.source_type = "test_custom"

    ts_initial = loader.load_time_series("ITEM1", "STORE1")
    assert ts_initial[0]["demand"] == 5
    assert ts_initial[1]["demand"] == 10

    # Modify file content and change mtime
    time.sleep(0.05)
    sales_file.write_text("id,item_id,dept_id,cat_id,store_id,state_id,d_1,d_2\nITEM1_STORE1,ITEM1,D,C,STORE1,CA,99,88\n")
    
    ts_updated = loader.load_time_series("ITEM1", "STORE1")
    assert ts_updated[0]["demand"] == 99
    assert ts_updated[1]["demand"] == 88


def test_m5_loader_50_queries_performance_benchmark():
    """
    Benchmark retrieval of 50 series queries using the active representative dataset.
    Defensible target: 50 queries must complete in < 250ms (typically ~5-20ms).
    """
    clear_m5_cache()
    loader = M5DataLoader()
    stores, items = loader.get_available_entities()

    t0 = time.perf_counter()
    for i in range(50):
        item = items[i % len(items)]
        store = stores[i % len(stores)]
        ts = loader.load_time_series(item, store)
        assert len(ts) > 0
    t1 = time.perf_counter()

    elapsed_ms = (t1 - t0) * 1000.0
    print(f"\n[BENCHMARK] 50 M5 series queries executed in {elapsed_ms:.2f}ms ({elapsed_ms/50:.3f}ms/query)")
    assert elapsed_ms < 500.0, f"50 queries took {elapsed_ms}ms, exceeding 500ms threshold!"


def test_m5_loader_forecasting_api_compatibility():
    """Verify that evaluate_forecasting_models works cleanly with the optimized loader."""
    res = evaluate_forecasting_models(
        product_id="FOODS_1_001",
        destination_id="CA_1",
        horizon_days=7,
        data_source="m5"
    )
    assert res["data_source"] == "m5"
    assert res["product_id"] == "FOODS_1_001"
    assert res["destination_id"] == "CA_1"
    assert res["forecasted_demand_total"] > 0
    assert "wape_pct" in res["evaluation_metrics"]["baseline_sma"]


# ---------------------------------------------------------------------------
# FIX 2: Arrival Shelf-Life Tests (Tests A, B, C, D, E)
# ---------------------------------------------------------------------------

def _build_test_scenario(
    days_to_expiry: int,
    transit_time_days: int,
    min_shelf_life_required_days: int
):
    """Helper to assemble a single product, warehouse, destination, and route scenario."""
    prod = Product(
        id="P-TEST",
        name="Test Perishable Product",
        category="Test Category",
        uom="units",
        unit_weight_kg=1.0,
        shelf_life_days=30,
        holding_cost_per_day=0.1,
        shortage_penalty_per_unit=50.0,
        min_shelf_life_required_days=min_shelf_life_required_days
    )
    wh = Warehouse(
        id="WH-1",
        name="Test Warehouse",
        city="Test City",
        state="CA",
        latitude=34.0,
        longitude=-118.0,
        storage_capacity_units=10000
    )
    dest = Destination(
        id="DEST-1",
        name="Test Store",
        city="Store City",
        state="CA",
        latitude=34.5,
        longitude=-117.5,
        tier="Tier-1",
        service_level_target=0.95
    )
    route = Route(
        source_warehouse_id="WH-1",
        destination_id="DEST-1",
        unit_cost=2.0,
        distance_km=100.0,
        transit_time_days=transit_time_days,
        max_capacity_units=1000
    )
    batch = InventoryBatch(
        batch_id="BATCH-TEST",
        product_id="P-TEST",
        warehouse_id="WH-1",
        quantity=500,
        manufacturing_date="2026-10-01",
        expiry_date="2026-10-31",
        days_to_expiry=days_to_expiry,
        is_expired=False,
        status="usable"
    )
    demand = [
        DemandRecord(
            destination_id="DEST-1",
            product_id="P-TEST",
            forecasted_demand=100,
            historical_avg_daily=14.0,
            confidence_interval_pct=0.90
        )
    ]
    return [prod], [wh], [dest], [batch], [route], demand


def test_shelf_life_test_a_arrives_expired():
    """
    Test A — Shipment arrives expired:
    - Remaining shelf life at dispatch: 3 days.
    - Route transit time: 4 days.
    - Expected result: zero allocation from this batch on this route.
    """
    prods, whs, dests, batches, routes, demand = _build_test_scenario(
        days_to_expiry=3,
        transit_time_days=4,
        min_shelf_life_required_days=1
    )
    plan = run_ortools_optimization(prods, whs, dests, batches, routes, demand)
    
    # Must allocate 0 units from this batch
    allocated_qty = sum(r.allocated_quantity for r in plan.recommendations if r.batch_id == "BATCH-TEST")
    assert allocated_qty == 0, f"Expected 0 units allocated, got {allocated_qty}"
    assert plan.metrics.total_unmet_units == 100
    assert plan.metrics.fulfillment_rate_pct == 0.0


def test_shelf_life_test_b_insufficient_arrival_shelf_life():
    """
    Test B — Shipment arrives with insufficient shelf life:
    - Remaining shelf life: 5 days.
    - Transit time: 2 days.
    - Required shelf life on arrival: 4 days (remaining on arrival = 3d < 4d required).
    - Expected result: zero allocation from this batch on this route.
    """
    prods, whs, dests, batches, routes, demand = _build_test_scenario(
        days_to_expiry=5,
        transit_time_days=2,
        min_shelf_life_required_days=4
    )
    plan = run_ortools_optimization(prods, whs, dests, batches, routes, demand)
    
    allocated_qty = sum(r.allocated_quantity for r in plan.recommendations if r.batch_id == "BATCH-TEST")
    assert allocated_qty == 0, f"Expected 0 units allocated for insufficient arrival shelf-life, got {allocated_qty}"
    assert plan.metrics.total_unmet_units == 100


def test_shelf_life_test_c_meets_shelf_life_requirement():
    """
    Test C — Shipment meets shelf-life requirement:
    - Remaining shelf life: 8 days.
    - Transit time: 2 days.
    - Required shelf life on arrival: 4 days (remaining on arrival = 6d >= 4d required).
    - Expected result: shipment remains eligible and is allocated to fulfill demand.
    """
    prods, whs, dests, batches, routes, demand = _build_test_scenario(
        days_to_expiry=8,
        transit_time_days=2,
        min_shelf_life_required_days=4
    )
    plan = run_ortools_optimization(prods, whs, dests, batches, routes, demand)
    
    allocated_qty = sum(r.allocated_quantity for r in plan.recommendations if r.batch_id == "BATCH-TEST")
    assert allocated_qty == 100, f"Expected 100 units allocated, got {allocated_qty}"
    assert plan.metrics.total_unmet_units == 0
    assert plan.metrics.fulfillment_rate_pct == 100.0

    # Validator must verify and pass
    audit_msgs = validate_plan_invariants(plan, prods, whs, dests, batches, routes, demand)
    assert any("Arrival shelf-life" in msg or "Invariant 4 & 4B" in msg for msg in audit_msgs)


def test_shelf_life_test_d_alternative_route_selection():
    """
    Test D — Alternative route selection:
    - A batch has 5 days of shelf life. Required on arrival: 3 days.
    - Route 1 (slow long-haul): transit time 3 days (arrival shelf life = 2d < 3d -> INELIGIBLE).
    - Route 2 (express air/corridor): transit time 1 day (arrival shelf life = 4d >= 3d -> ELIGIBLE).
    - Expected result: optimizer uses the eligible fast route to fulfill demand despite higher cost.
    """
    prod = Product(
        id="P-PERISHABLE",
        name="Fresh Cream",
        category="Dairy",
        uom="units",
        unit_weight_kg=1.0,
        shelf_life_days=14,
        holding_cost_per_day=0.1,
        shortage_penalty_per_unit=80.0,
        min_shelf_life_required_days=3
    )
    wh_slow = Warehouse(id="WH-SLOW", name="Slow Warehouse", city="City A", state="CA", latitude=34.0, longitude=-118.0, storage_capacity_units=5000)
    wh_fast = Warehouse(id="WH-FAST", name="Fast Express Hub", city="City B", state="CA", latitude=34.1, longitude=-118.1, storage_capacity_units=5000)
    dest = Destination(id="DEST-A", name="Store Cluster", city="City C", state="CA", latitude=34.5, longitude=-117.5, tier="Tier-1", service_level_target=0.95)

    # Slow route is cheaper ($1.50) but takes 3 days transit (5 - 3 = 2d < 3d required) -> INELIGIBLE
    route_slow = Route(source_warehouse_id="WH-SLOW", destination_id="DEST-A", unit_cost=1.50, distance_km=500.0, transit_time_days=3, max_capacity_units=1000)
    # Fast route is more expensive ($3.50) but takes 1 day transit (5 - 1 = 4d >= 3d required) -> ELIGIBLE
    route_fast = Route(source_warehouse_id="WH-FAST", destination_id="DEST-A", unit_cost=3.50, distance_km=100.0, transit_time_days=1, max_capacity_units=1000)

    batch_slow = InventoryBatch(batch_id="BATCH-SLOW-5D", product_id="P-PERISHABLE", warehouse_id="WH-SLOW", quantity=200, manufacturing_date="2026-10-01", expiry_date="2026-10-29", days_to_expiry=5, is_expired=False, status="near_expiry")
    batch_fast = InventoryBatch(batch_id="BATCH-FAST-5D", product_id="P-PERISHABLE", warehouse_id="WH-FAST", quantity=200, manufacturing_date="2026-10-01", expiry_date="2026-10-29", days_to_expiry=5, is_expired=False, status="near_expiry")

    demand = [DemandRecord(destination_id="DEST-A", product_id="P-PERISHABLE", forecasted_demand=150, historical_avg_daily=20.0, confidence_interval_pct=0.90)]

    plan = run_ortools_optimization(
        products=[prod],
        warehouses=[wh_slow, wh_fast],
        destinations=[dest],
        batches=[batch_slow, batch_fast],
        routes=[route_slow, route_fast],
        demand_records=demand
    )

    # Must allocate ONLY from WH-FAST; WH-SLOW must have 0 allocations
    allocated_slow = sum(r.allocated_quantity for r in plan.recommendations if r.source_warehouse_id == "WH-SLOW")
    allocated_fast = sum(r.allocated_quantity for r in plan.recommendations if r.source_warehouse_id == "WH-FAST")

    assert allocated_slow == 0, f"WH-SLOW was allocated {allocated_slow} units despite arriving with insufficient shelf life!"
    assert allocated_fast == 150, f"WH-FAST was expected to fulfill 150 units, got {allocated_fast}"
    assert plan.metrics.fulfillment_rate_pct == 100.0


def test_shelf_life_test_e_validator_rejects_ineligible_arrival():
    """
    Test E — Validator Independent Verification:
    Verify that validate_plan_invariants raises InvariantViolationError if a plan contains
    an allocation that arrives with insufficient shelf life.
    """
    prods, whs, dests, batches, routes, demand = _build_test_scenario(
        days_to_expiry=5,
        transit_time_days=3,
        min_shelf_life_required_days=3  # 5 - 3 = 2d < 3d required
    )
    
    # Intentionally craft a plan that violates arrival shelf life
    from engine.models import OptimizationPlan, OptimizationMetrics, ShipmentRecommendation
    invalid_plan = OptimizationPlan(
        run_id="RUN-TEST-INVALID",
        strategy="baseline",
        created_at="2026-10-25T00:00:00Z",
        planning_horizon_days=7,
        metrics=OptimizationMetrics(
            strategy="baseline",
            total_demand_units=100,
            total_fulfilled_units=100,
            total_unmet_units=0,
            fulfillment_rate_pct=100.0,
            total_transport_cost=200.0,
            avg_unit_transport_cost=2.0,
            active_shipment_lanes=1,
            expiring_stock_utilized_units=0,
            estimated_avoided_waste_units=0,
            potential_waste_unallocated_units=0,
            destinations_with_shortages=0,
            solver_runtime_ms=1.0,
            solver_status="FEASIBLE"
        ),
        recommendations=[
            ShipmentRecommendation(
                recommendation_id="REC-BAD-01",
                product_id="P-TEST",
                product_name="Test Perishable Product",
                source_warehouse_id="WH-1",
                source_warehouse_name="Test Warehouse",
                destination_id="DEST-1",
                destination_name="Test Store",
                batch_id="BATCH-TEST",
                allocated_quantity=100,
                unit_transport_cost=2.0,
                total_transport_cost=200.0,
                destination_demand=100,
                batch_days_to_expiry=5,
                rationale="Test bad allocation"
            )
        ],
        shortages=[]
    )

    with pytest.raises(InvariantViolationError) as exc_info:
        validate_plan_invariants(invalid_plan, prods, whs, dests, batches, routes, demand)
    
    assert "Invariant 4B Violated" in str(exc_info.value)
