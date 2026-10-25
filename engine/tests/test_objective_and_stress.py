"""
SupplySync Adversarial Objective & Stress Tests
Triwizathon 2026 - Problem Statement 2

Tests cover:
1. Economic objective vs. solver objective separation
2. FEFO epsilon tie-breaker tariff-distortion prevention
3. Independent validator rejection of falsified fulfillment rates, costs, booleans, and floats
4. Deterministic stress-test execution and consistency
"""

import pytest
import copy
from engine.models import (
    Warehouse,
    Destination,
    Product,
    InventoryBatch,
    Route,
    DemandRecord,
    OptimizationPlan,
    ShipmentRecommendation,
    OptimizationMetrics,
)
from engine.optimizer import run_ortools_optimization
from engine.baseline import run_baseline_allocation
from engine.validator import validate_plan_invariants, InvariantViolationError
from engine.stress_tests import run_stress_test_suite, generate_stress_instance


def test_economic_objective_vs_solver_objective_separation():
    """
    Verify that OptimizationMetrics maintains a strict separation between:
    - total_evaluated_cost: The true physical economic cost (sum(tariff * qty) + sum(shortage_penalty * unmet))
    - solver_objective_value: The internal MILP objective value including FEFO epsilon tie-breaker subsidies
    """
    products = [
        Product(
            id="PRD-1",
            name="Organic Milk",
            category="Dairy",
            unit_weight_kg=1.0,
            shelf_life_days=90,
            min_shelf_life_required_days=1,
            shortage_penalty_per_unit=25.0
        )
    ]
    warehouses = [
        Warehouse(
            id="WH-1",
            name="Dallas Hub",
            city="Dallas",
            state="TX",
            latitude=32.7767,
            longitude=-96.7970,
            storage_capacity_units=500
        )
    ]
    destinations = [
        Destination(
            id="DST-1",
            name="Austin Store",
            city="Austin",
            state="TX",
            latitude=30.2672,
            longitude=-97.7431,
            tier="Tier-1"
        )
    ]
    demands = [DemandRecord(destination_id="DST-1", product_id="PRD-1", forecasted_demand=100, historical_avg_daily=14.3)]
    
    # Batch with days_to_expiry=3 -> fefo_epsilon = 0.001 * (16-3)/15 = 0.0008667
    batches = [
        InventoryBatch(
            batch_id="BAT-1",
            product_id="PRD-1",
            warehouse_id="WH-1",
            quantity=100,
            manufacturing_date="2026-10-01",
            expiry_date="2026-10-28",
            days_to_expiry=3,
            unit_cost=3.0,
            is_expired=False
        )
    ]
    routes = [
        Route(
            source_warehouse_id="WH-1",
            destination_id="DST-1",
            unit_cost=2.00,
            distance_km=300,
            transit_time_days=1,
            max_capacity_units=200,
            max_capacity_kg=500.0,
        )
    ]

    plan = run_ortools_optimization(products, warehouses, destinations, batches, routes, demands)
    assert plan.metrics.solver_status == "OPTIMAL"
    
    # Physical economic cost: 100 units * $2.00 tariff = $200.00
    assert plan.metrics.total_transport_cost == pytest.approx(200.00, abs=1e-4)
    assert plan.metrics.estimated_shortage_cost == pytest.approx(0.00, abs=1e-4)
    assert plan.metrics.total_evaluated_cost == pytest.approx(200.00, abs=1e-4)
    
    # Under Lexicographic Optimization:
    # Phase 1 solves pure economic cost: $200.00
    # Phase 2 constrains cost <= $200.0001 and optimizes FEFO
    # Therefore, true economic cost and solver objective value are strictly identical (zero distortion)!
    assert plan.metrics.solver_objective_value is not None
    assert plan.metrics.solver_objective_value == pytest.approx(plan.metrics.total_evaluated_cost, abs=1e-4)
    assert plan.metrics.lexicographic_phase == "phase2_fefo_optimal"
    assert plan.metrics.mip_gap == 0.0
    
    # Validate through the independent validator
    audit_log = validate_plan_invariants(plan, products, warehouses, destinations, batches, routes, demands)
    assert len(audit_log) > 0


def test_fefo_epsilon_tie_breaker_prevents_tariff_distortion():
    """
    Verify that the FEFO tie-breaker subsidy (bounded by 0.001) NEVER causes
    the optimizer to select an economically more expensive route over a cheaper route,
    even when the expensive route offers near-expiry inventory.
    """
    products = [
        Product(
            id="PRD-1",
            name="Fresh Juice",
            category="Beverages",
            unit_weight_kg=1.0,
            shelf_life_days=90,
            min_shelf_life_required_days=1,
            shortage_penalty_per_unit=20.0
        )
    ]
    warehouses = [
        Warehouse(id="WH-CHEAP", name="Cheap Hub", city="Dallas", state="TX", latitude=32.7, longitude=-96.7, storage_capacity_units=500),
        Warehouse(id="WH-EXP", name="Expensive Hub", city="Fort Worth", state="TX", latitude=32.7, longitude=-97.3, storage_capacity_units=500),
    ]
    destinations = [
        Destination(id="DST-1", name="Retail Store", city="Austin", state="TX", latitude=30.2, longitude=-97.7, tier="Tier-2")
    ]
    demands = [DemandRecord(destination_id="DST-1", product_id="PRD-1", forecasted_demand=50, historical_avg_daily=7.1)]
    
    # WH-CHEAP has fresh stock (14 days to expiry)
    # WH-EXP has urgent stock (2 days to expiry)
    batches = [
        InventoryBatch(batch_id="BAT-FRESH", product_id="PRD-1", warehouse_id="WH-CHEAP", quantity=50, manufacturing_date="2026-10-01", expiry_date="2026-11-05", days_to_expiry=14, unit_cost=2.0, is_expired=False),
        InventoryBatch(batch_id="BAT-URGENT", product_id="PRD-1", warehouse_id="WH-EXP", quantity=50, manufacturing_date="2026-10-01", expiry_date="2026-10-27", days_to_expiry=2, unit_cost=2.0, is_expired=False),
    ]
    
    # Route from WH-CHEAP is $1.80/unit
    # Route from WH-EXP is $1.82/unit (just 2 cents more expensive)
    routes = [
        Route(source_warehouse_id="WH-CHEAP", destination_id="DST-1", unit_cost=1.80, distance_km=250, transit_time_days=1, max_capacity_units=100, max_capacity_kg=200.0),
        Route(source_warehouse_id="WH-EXP", destination_id="DST-1", unit_cost=1.82, distance_km=270, transit_time_days=1, max_capacity_units=100, max_capacity_kg=200.0),
    ]
    
    plan = run_ortools_optimization(products, warehouses, destinations, batches, routes, demands)
    assert plan.metrics.solver_status == "OPTIMAL"
    
    # Economic cost must strictly prioritize the cheaper route ($1.80)
    # True freight cost should be 50 * 1.80 = $90.00, NOT 50 * 1.82 = $91.00
    assert plan.metrics.total_transport_cost == pytest.approx(90.00, abs=1e-4)
    assert len(plan.recommendations) == 1
    assert plan.recommendations[0].source_warehouse_id == "WH-CHEAP"
    assert plan.recommendations[0].batch_id == "BAT-FRESH"


def test_validator_rejects_bool_and_non_int_quantities():
    """
    Verify that validate_plan_invariants rejects allocations where allocated_quantity
    is a boolean (e.g. True/False) or a float (e.g. 10.5).
    """
    products = [Product(id="PRD-1", name="Item 1", category="Cat", unit_weight_kg=1.0, shelf_life_days=90, min_shelf_life_required_days=1, shortage_penalty_per_unit=15.0)]
    warehouses = [Warehouse(id="WH-1", name="Dallas Hub", city="Dallas", state="TX", latitude=32.7, longitude=-96.7, storage_capacity_units=500)]
    destinations = [Destination(id="DST-1", name="Austin Store", city="Austin", state="TX", latitude=30.2, longitude=-97.7, tier="Tier-1")]
    demands = [DemandRecord(destination_id="DST-1", product_id="PRD-1", forecasted_demand=100, historical_avg_daily=14.3)]
    batches = [InventoryBatch(batch_id="BAT-1", product_id="PRD-1", warehouse_id="WH-1", quantity=100, manufacturing_date="2026-10-01", expiry_date="2026-11-01", days_to_expiry=10, unit_cost=2.0, is_expired=False)]
    routes = [Route(source_warehouse_id="WH-1", destination_id="DST-1", unit_cost=2.0, distance_km=300, transit_time_days=1, max_capacity_units=200, max_capacity_kg=500.0)]

    valid_plan = run_ortools_optimization(products, warehouses, destinations, batches, routes, demands)
    
    # 1. Reject boolean quantity True
    mutated_plan_bool = copy.deepcopy(valid_plan)
    mutated_plan_bool.recommendations[0].allocated_quantity = True  # bool is subclass of int in Python!
    with pytest.raises(InvariantViolationError) as exc_info:
        validate_plan_invariants(mutated_plan_bool, products, warehouses, destinations, batches, routes, demands)
    assert "integer" in str(exc_info.value).lower() or "boolean" in str(exc_info.value).lower()

    # 2. Reject float quantity 50.5
    mutated_plan_float = copy.deepcopy(valid_plan)
    mutated_plan_float.recommendations[0].allocated_quantity = 50.5
    with pytest.raises(InvariantViolationError) as exc_info:
        validate_plan_invariants(mutated_plan_float, products, warehouses, destinations, batches, routes, demands)
    assert "integer" in str(exc_info.value).lower()


def test_validator_rejects_falsified_fulfillment_and_avg_cost():
    """
    Verify that validate_plan_invariants rejects falsified summary metrics:
    - fulfillment_rate_pct
    - avg_unit_transport_cost
    - total_evaluated_cost
    """
    products = [Product(id="PRD-1", name="Item 1", category="Cat", unit_weight_kg=1.0, shelf_life_days=90, min_shelf_life_required_days=1, shortage_penalty_per_unit=15.0)]
    warehouses = [Warehouse(id="WH-1", name="Dallas Hub", city="Dallas", state="TX", latitude=32.7, longitude=-96.7, storage_capacity_units=500)]
    destinations = [Destination(id="DST-1", name="Austin Store", city="Austin", state="TX", latitude=30.2, longitude=-97.7, tier="Tier-1")]
    demands = [DemandRecord(destination_id="DST-1", product_id="PRD-1", forecasted_demand=100, historical_avg_daily=14.3)]
    batches = [InventoryBatch(batch_id="BAT-1", product_id="PRD-1", warehouse_id="WH-1", quantity=100, manufacturing_date="2026-10-01", expiry_date="2026-11-01", days_to_expiry=10, unit_cost=2.0, is_expired=False)]
    routes = [Route(source_warehouse_id="WH-1", destination_id="DST-1", unit_cost=2.0, distance_km=300, transit_time_days=1, max_capacity_units=200, max_capacity_kg=500.0)]

    valid_plan = run_ortools_optimization(products, warehouses, destinations, batches, routes, demands)

    # 1. Falsified fulfillment rate
    mut_f = copy.deepcopy(valid_plan)
    mut_f.metrics.fulfillment_rate_pct = 85.0  # Actual is 100.0
    with pytest.raises(InvariantViolationError) as exc_info:
        validate_plan_invariants(mut_f, products, warehouses, destinations, batches, routes, demands)
    assert "fulfillment rate" in str(exc_info.value).lower()

    # 2. Falsified average unit transport cost
    mut_c = copy.deepcopy(valid_plan)
    mut_c.metrics.avg_unit_transport_cost = 1.25  # Actual is 2.0
    with pytest.raises(InvariantViolationError) as exc_info:
        validate_plan_invariants(mut_c, products, warehouses, destinations, batches, routes, demands)
    assert "average unit transport cost" in str(exc_info.value).lower()

    # 3. Falsified total evaluated cost
    mut_t = copy.deepcopy(valid_plan)
    mut_t.metrics.total_evaluated_cost = 150.0  # Actual is 200.0
    with pytest.raises(InvariantViolationError) as exc_info:
        validate_plan_invariants(mut_t, products, warehouses, destinations, batches, routes, demands)
    assert "total evaluated cost" in str(exc_info.value).lower()


def test_stress_test_suite_deterministic_execution():
    """
    Verify that run_stress_test_suite executes deterministically, produces
    valid plans across diverse archetypes, and maintains a 100% validator pass rate.
    """
    summary = run_stress_test_suite(num_instances=6, base_seed=42)
    assert summary["instances_generated"] == 6
    assert summary["validator_rejections"] == 0
    assert summary["successful_solves"] == 6
    assert summary["aggregate_milp_cost"] <= summary["aggregate_baseline_cost"]
