"""
SupplySync Exhaustive Search Oracle Regression & Verification Tests
Triwizathon 2026 | Problem Statement 2

Verifies that the MILP lexicographic optimizer produces solutions that match
the exact global optimum found by an independent brute-force exhaustive enumeration oracle.
"""

import pytest
from engine.models import Product, Warehouse, Destination, InventoryBatch, Route, DemandRecord
from engine.optimizer import run_ortools_optimization
from engine.baseline import run_baseline_allocation
from engine.exhaustive_oracle import solve_exhaustive_oracle
from engine.validator import validate_plan_invariants


def test_oracle_vs_milp_fefo_tie_breaking_equal_cost():
    """
    Two warehouses with identical $2.00 freight tariff.
    WH-1 has urgent batch (3 days to expiry).
    WH-2 has fresh batch (20 days to expiry).
    Both oracle and MILP must select WH-1 (FEFO).
    """
    prod = Product(id="P1", name="Milk", category="Dairy", unit_weight_kg=1.0, shelf_life_days=30, min_shelf_life_required_days=1, shortage_penalty_per_unit=20.0)
    wh1 = Warehouse(id="WH-1", name="W1", city="C1", state="S1", latitude=0, longitude=0, storage_capacity_units=100)
    wh2 = Warehouse(id="WH-2", name="W2", city="C2", state="S2", latitude=0, longitude=0, storage_capacity_units=100)
    dest = Destination(id="D1", name="Store 1", city="C3", state="S3", latitude=0, longitude=0, tier="Tier-1")

    batches = [
        InventoryBatch(batch_id="B-URGENT", product_id="P1", warehouse_id="WH-1", quantity=10, manufacturing_date="2026-10-01", expiry_date="2026-10-28", days_to_expiry=3, unit_cost=2.0, is_expired=False),
        InventoryBatch(batch_id="B-FRESH", product_id="P1", warehouse_id="WH-2", quantity=10, manufacturing_date="2026-10-01", expiry_date="2026-11-15", days_to_expiry=20, unit_cost=2.0, is_expired=False),
    ]
    routes = [
        Route(source_warehouse_id="WH-1", destination_id="D1", unit_cost=2.0, distance_km=100, transit_time_days=1),
        Route(source_warehouse_id="WH-2", destination_id="D1", unit_cost=2.0, distance_km=100, transit_time_days=1),
    ]
    demands = [DemandRecord(destination_id="D1", product_id="P1", forecasted_demand=10, historical_avg_daily=1.4)]

    # 1. Exhaustive search ground truth
    oracle_res = solve_exhaustive_oracle([prod], [wh1, wh2], [dest], batches, routes, demands)
    
    # 2. MILP Lexicographic
    milp_plan = run_ortools_optimization([prod], [wh1, wh2], [dest], batches, routes, demands)

    # Reconcile true economic cost
    assert milp_plan.metrics.total_evaluated_cost == pytest.approx(oracle_res["min_economic_cost"], abs=1e-4)
    assert milp_plan.metrics.total_evaluated_cost == 20.0  # 10 units * $2.00

    # Verify FEFO selection
    assert len(milp_plan.recommendations) == 1
    assert milp_plan.recommendations[0].batch_id == "B-URGENT"
    assert ("WH-1", "D1", "P1", "B-URGENT") in oracle_res["best_allocation"]


def test_oracle_vs_milp_low_tariffs_no_distortion():
    """
    Very low tariffs ($0.005 vs $0.008 per unit).
    Route A has $0.005 tariff with fresh stock (15 days).
    Route B has $0.008 tariff with urgent stock (2 days).
    Economic optimum MUST pick Route A ($0.005) despite older stock.
    """
    prod = Product(id="P1", name="Salt", category="Pantry", unit_weight_kg=0.5, shelf_life_days=365, min_shelf_life_required_days=1, shortage_penalty_per_unit=5.0)
    wh1 = Warehouse(id="WH-1", name="W1", city="C1", state="S1", latitude=0, longitude=0, storage_capacity_units=100)
    wh2 = Warehouse(id="WH-2", name="W2", city="C2", state="S2", latitude=0, longitude=0, storage_capacity_units=100)
    dest = Destination(id="D1", name="Store 1", city="C3", state="S3", latitude=0, longitude=0, tier="Tier-2")

    batches = [
        InventoryBatch(batch_id="B-FRESH", product_id="P1", warehouse_id="WH-1", quantity=20, manufacturing_date="2026-10-01", expiry_date="2026-11-01", days_to_expiry=15, unit_cost=0.5, is_expired=False),
        InventoryBatch(batch_id="B-URGENT", product_id="P1", warehouse_id="WH-2", quantity=20, manufacturing_date="2026-10-01", expiry_date="2026-10-27", days_to_expiry=2, unit_cost=0.5, is_expired=False),
    ]
    routes = [
        Route(source_warehouse_id="WH-1", destination_id="D1", unit_cost=0.005, distance_km=50, transit_time_days=1),
        Route(source_warehouse_id="WH-2", destination_id="D1", unit_cost=0.008, distance_km=80, transit_time_days=1),
    ]
    demands = [DemandRecord(destination_id="D1", product_id="P1", forecasted_demand=10, historical_avg_daily=1.4)]

    oracle_res = solve_exhaustive_oracle([prod], [wh1, wh2], [dest], batches, routes, demands)
    milp_plan = run_ortools_optimization([prod], [wh1, wh2], [dest], batches, routes, demands)

    assert milp_plan.metrics.total_evaluated_cost == pytest.approx(oracle_res["min_economic_cost"], abs=1e-4)
    # 10 units * $0.005 = $0.05
    assert milp_plan.metrics.total_evaluated_cost == pytest.approx(0.05, abs=1e-4)
    assert milp_plan.recommendations[0].source_warehouse_id == "WH-1"


def test_oracle_vs_milp_multi_product_corridor_sharing():
    """
    Two products sharing the SAME corridor with tight gross weight capacity (15 kg).
    Product 1 weighs 2 kg/unit, shortage penalty $30.
    Product 2 weighs 1 kg/unit, shortage penalty $10.
    Demand: 10 units P1 (20 kg), 10 units P2 (10 kg). Total weight = 30 kg > 15 kg capacity!
    Oracle and MILP must prioritize the higher-penalty product to minimize total shortage cost.
    """
    p1 = Product(id="P1", name="Heavy Item", category="Cat1", unit_weight_kg=2.0, shelf_life_days=60, min_shelf_life_required_days=1, shortage_penalty_per_unit=30.0)
    p2 = Product(id="P2", name="Light Item", category="Cat2", unit_weight_kg=1.0, shelf_life_days=60, min_shelf_life_required_days=1, shortage_penalty_per_unit=10.0)
    wh = Warehouse(id="WH-1", name="W1", city="C1", state="S1", latitude=0, longitude=0, storage_capacity_units=100)
    dest = Destination(id="D1", name="Store 1", city="C3", state="S3", latitude=0, longitude=0, tier="Tier-2")

    batches = [
        InventoryBatch(batch_id="B-P1", product_id="P1", warehouse_id="WH-1", quantity=20, manufacturing_date="2026-10-01", expiry_date="2026-12-01", days_to_expiry=45, unit_cost=1.0, is_expired=False),
        InventoryBatch(batch_id="B-P2", product_id="P2", warehouse_id="WH-1", quantity=20, manufacturing_date="2026-10-01", expiry_date="2026-12-01", days_to_expiry=45, unit_cost=1.0, is_expired=False),
    ]
    routes = [
        Route(source_warehouse_id="WH-1", destination_id="D1", unit_cost=1.0, distance_km=100, transit_time_days=1, max_capacity_kg=15.0)
    ]
    demands = [
        DemandRecord(destination_id="D1", product_id="P1", forecasted_demand=10, historical_avg_daily=1.4),
        DemandRecord(destination_id="D1", product_id="P2", forecasted_demand=10, historical_avg_daily=1.4),
    ]

    oracle_res = solve_exhaustive_oracle([p1, p2], [wh], [dest], batches, routes, demands)
    milp_plan = run_ortools_optimization([p1, p2], [wh], [dest], batches, routes, demands)
    base_plan = run_baseline_allocation([p1, p2], [wh], [dest], batches, routes, demands)

    # 1. MILP exactly matches oracle global optimum
    assert milp_plan.metrics.total_evaluated_cost == pytest.approx(oracle_res["min_economic_cost"], abs=1e-4)

    # 2. Both plans satisfy corridor gross weight capacity (<= 15.0 kg)
    audit_milp = validate_plan_invariants(milp_plan, [p1, p2], [wh], [dest], batches, routes, demands)
    audit_base = validate_plan_invariants(base_plan, [p1, p2], [wh], [dest], batches, routes, demands)
    assert len(audit_milp) > 0
    assert len(audit_base) > 0

    assert milp_plan.metrics.total_weight_shipped_kg <= 15.0 + 1e-4
    assert base_plan.metrics.total_weight_shipped_kg <= 15.0 + 1e-4


def test_oracle_vs_milp_fefo_preserves_per_commodity_fulfillment():
    """
    Multi-commodity test: Two products with differing batch expiry dates.
    P1 has batch B1 expiring in 2 days.
    P2 has batch B2 expiring in 60 days.
    Both have demand = 5, shortage penalty = $20.00, freight tariff = $1.00.
    Phase 2 FEFO must strictly preserve the fulfillment of both products (5 P1, 5 P2)
    without cross-commodity quantity shifting.
    """
    p1 = Product(id="P1", name="Perishable Milk", category="Dairy", unit_weight_kg=1.0, shelf_life_days=10, min_shelf_life_required_days=1, shortage_penalty_per_unit=20.0)
    p2 = Product(id="P2", name="Canned Beans", category="Pantry", unit_weight_kg=1.0, shelf_life_days=180, min_shelf_life_required_days=1, shortage_penalty_per_unit=20.0)
    wh = Warehouse(id="WH-1", name="Main Hub", city="Dallas", state="TX", latitude=0, longitude=0, storage_capacity_units=100)
    dest = Destination(id="D1", name="Supercenter", city="Austin", state="TX", latitude=0, longitude=0, tier="Tier-1")

    batches = [
        InventoryBatch(batch_id="B-P1-URGENT", product_id="P1", warehouse_id="WH-1", quantity=5, manufacturing_date="2026-10-01", expiry_date="2026-10-27", days_to_expiry=2, unit_cost=1.0, is_expired=False),
        InventoryBatch(batch_id="B-P2-FRESH", product_id="P2", warehouse_id="WH-1", quantity=5, manufacturing_date="2026-10-01", expiry_date="2027-04-01", days_to_expiry=60, unit_cost=1.0, is_expired=False),
    ]
    routes = [
        Route(source_warehouse_id="WH-1", destination_id="D1", unit_cost=1.0, distance_km=100, transit_time_days=1, max_capacity_units=20)
    ]
    demands = [
        DemandRecord(destination_id="D1", product_id="P1", forecasted_demand=5, historical_avg_daily=1.0),
        DemandRecord(destination_id="D1", product_id="P2", forecasted_demand=5, historical_avg_daily=1.0),
    ]

    oracle_res = solve_exhaustive_oracle([p1, p2], [wh], [dest], batches, routes, demands)
    milp_plan = run_ortools_optimization([p1, p2], [wh], [dest], batches, routes, demands)

    # 1. Economic cost parity with Oracle ($10.00 total freight, $0 shortage)
    assert milp_plan.metrics.total_evaluated_cost == pytest.approx(oracle_res["min_economic_cost"], abs=1e-4)
    assert milp_plan.metrics.total_evaluated_cost == 10.0
    assert milp_plan.metrics.total_fulfilled_units == 10
    assert milp_plan.metrics.total_unmet_units == 0

    # 2. Both commodities fulfilled exactly
    p1_fulfilled = sum(r.allocated_quantity for r in milp_plan.recommendations if r.product_id == "P1")
    p2_fulfilled = sum(r.allocated_quantity for r in milp_plan.recommendations if r.product_id == "P2")
    assert p1_fulfilled == 5
    assert p2_fulfilled == 5

    # 3. Independent validator passes
    audit = validate_plan_invariants(milp_plan, [p1, p2], [wh], [dest], batches, routes, demands)
    assert len(audit) > 0
    assert milp_plan.metrics.lexicographic_phase == "phase2_fefo_optimal"
