"""
SupplySync Audit Interpretation, Cost Accounting & Scenario Verification Tests
Triwizathon 2026 | Problem Statement 2

Verifies:
1. Neutral, evidence-based audit verdict for equal baseline and optimizer performance.
2. Clear distinction between equal performance, optimizer superiority, trade-offs, and inferior performance.
3. Consistent economic cost accounting:
   total_economic_cost = freight_cost + shortage_penalty
   savings = baseline_total_economic_cost - optimizer_total_economic_cost
4. Zero-cost baseline safety and negative savings preservation (never clamped to zero).
5. Comprehensive scenario coverage:
   - Equal cost unconstrained demand fulfillment (Scenario 14).
   - Insufficient inventory (Scenario 1).
   - Route capacity constraints (Scenario 6).
   - Route cost differential optimization (Scenario 8).
   - FEFO batch expiry prioritization (Scenario 3).
   - Global multi-depot optimization superiority (Scenario 15).
   - Explicit negative savings / optimizer cost-exceedance test case.
"""

import pytest
from engine.models import (
    Product, Warehouse, Destination, InventoryBatch, Route, DemandRecord,
    OptimizationPlan, OptimizationMetrics, ComparisonAudit
)
from engine.optimizer import run_ortools_optimization
from engine.baseline import run_baseline_allocation
from engine.comparator import compare_plans
from engine.validator import validate_plan_invariants
from engine.benchmarks import (
    build_scenario_1_high_demand_scarce_supply,
    build_scenario_3_products_approaching_expiry,
    build_scenario_6_tight_vehicle_weight_capacity,
    build_scenario_8_expensive_vs_cheap_alternatives,
    build_scenario_14_unconstrained_benchmark,
    build_scenario_15_global_optimization_superiority
)


def test_equal_performance_audit_verdict_neutral():
    """Verify that equal performance produces a neutral verdict without fabricated claims."""
    products, warehouses, destinations, batches, routes, demand = build_scenario_14_unconstrained_benchmark()

    # Run baseline and optimizer on identical inputs
    base_plan = run_baseline_allocation(products, warehouses, destinations, batches, routes, demand)
    opt_plan = run_ortools_optimization(products, warehouses, destinations, batches, routes, demand)

    validate_plan_invariants(base_plan, products, warehouses, destinations, batches, routes, demand)
    validate_plan_invariants(opt_plan, products, warehouses, destinations, batches, routes, demand)

    audit = compare_plans(base_plan, opt_plan)

    # 1. Equal outcome status
    assert audit.outcome_status == "equal"
    assert audit.cost_savings_amount == 0.0
    assert audit.cost_reduction_pct == 0.0
    assert audit.total_evaluated_savings == 0.0
    assert audit.total_evaluated_savings_pct == 0.0
    assert audit.fulfillment_improvement_pct == 0.0
    assert audit.stockout_reduction_pct == 0.0
    assert audit.waste_reduction_units == 0

    # 2. Evidence-based neutral verdict text
    assert "identical performance" in audit.summary_verdict.lower()
    assert "globally optimal" in audit.summary_verdict.lower()
    # Must NOT claim superiority or savings
    assert "outperformed" not in audit.summary_verdict.lower()
    assert "saved" not in audit.summary_verdict.lower()


def test_optimizer_superiority_audit_reconciliation():
    """Verify exact economic cost accounting and superiority verdict on multi-depot bottleneck (Scenario 15)."""
    products, warehouses, destinations, batches, routes, demand = build_scenario_15_global_optimization_superiority()

    base_plan = run_baseline_allocation(products, warehouses, destinations, batches, routes, demand)
    opt_plan = run_ortools_optimization(products, warehouses, destinations, batches, routes, demand)

    validate_plan_invariants(base_plan, products, warehouses, destinations, batches, routes, demand)
    validate_plan_invariants(opt_plan, products, warehouses, destinations, batches, routes, demand)

    audit = compare_plans(base_plan, opt_plan)

    # Baseline cost: $100 freight + $1,625 shortage = $1,725.00
    assert base_plan.metrics.total_transport_cost == 100.0
    assert base_plan.metrics.estimated_shortage_cost == 1625.0
    assert base_plan.metrics.total_evaluated_cost == 1725.0

    # Optimizer cost: $275 freight + $0 shortage = $275.00
    assert opt_plan.metrics.total_transport_cost == 275.0
    assert opt_plan.metrics.estimated_shortage_cost == 0.0
    assert opt_plan.metrics.total_evaluated_cost == 275.0

    # Accounting assertions:
    # Net economic savings: 1725.00 - 275.00 = $1,450.00
    assert audit.total_evaluated_savings == 1450.0
    assert audit.total_evaluated_savings_pct == 84.06
    assert audit.outcome_status == "optimizer_superior"
    assert "outperformed" in audit.summary_verdict.lower()
    assert "84.06%" in audit.summary_verdict


def test_negative_savings_and_inferior_performance_handling():
    """Verify that negative savings remain negative and are never clamped to zero."""
    # Synthetic metrics where optimizer incurred higher economic cost than baseline
    b_metrics = OptimizationMetrics(
        strategy="baseline",
        total_demand_units=100,
        total_fulfilled_units=100,
        total_unmet_units=0,
        fulfillment_rate_pct=100.0,
        total_transport_cost=200.0,
        avg_unit_transport_cost=2.0,
        active_shipment_lanes=1,
        expiring_stock_utilized_units=50,
        estimated_avoided_waste_units=50,
        potential_waste_unallocated_units=0,
        destinations_with_shortages=0,
        estimated_shortage_cost=0.0,
        total_evaluated_cost=200.0,
        solver_runtime_ms=5.0,
        solver_status="GREEDY_HEURISTIC"
    )

    o_metrics = OptimizationMetrics(
        strategy="optimized_ortools",
        total_demand_units=100,
        total_fulfilled_units=100,
        total_unmet_units=0,
        fulfillment_rate_pct=100.0,
        total_transport_cost=260.0,  # $60 higher freight
        avg_unit_transport_cost=2.6,
        active_shipment_lanes=1,
        expiring_stock_utilized_units=50,
        estimated_avoided_waste_units=50,
        potential_waste_unallocated_units=0,
        destinations_with_shortages=0,
        estimated_shortage_cost=0.0,
        total_evaluated_cost=260.0,  # $60 higher economic cost
        solver_runtime_ms=15.0,
        solver_status="FEASIBLE"
    )

    dummy_b_plan = OptimizationPlan(
        run_id="run-base-test", strategy="baseline", planning_horizon_days=7,
        metrics=b_metrics, recommendations=[], shortages=[]
    )
    dummy_o_plan = OptimizationPlan(
        run_id="run-opt-test", strategy="optimized_ortools", planning_horizon_days=7,
        metrics=o_metrics, recommendations=[], shortages=[]
    )

    audit = compare_plans(dummy_b_plan, dummy_o_plan)

    # 1. Negative savings must remain strictly negative
    assert audit.cost_savings_amount == -60.0
    assert audit.cost_reduction_pct == -30.0
    assert audit.total_evaluated_savings == -60.0
    assert audit.total_evaluated_savings_pct == -30.0

    # 2. Outcome status must reflect inferior performance
    assert audit.outcome_status == "optimizer_inferior"
    assert "lower total economic cost" in audit.summary_verdict
    assert "-$60.00" in audit.summary_verdict or "$60.00" in audit.summary_verdict


def test_zero_cost_baseline_safe_handling():
    """Verify that zero cost baselines (zero demand or zero tariff) do not cause division by zero."""
    b_metrics = OptimizationMetrics(
        strategy="baseline",
        total_demand_units=0,
        total_fulfilled_units=0,
        total_unmet_units=0,
        fulfillment_rate_pct=100.0,
        total_transport_cost=0.0,
        avg_unit_transport_cost=0.0,
        active_shipment_lanes=0,
        expiring_stock_utilized_units=0,
        estimated_avoided_waste_units=0,
        potential_waste_unallocated_units=0,
        destinations_with_shortages=0,
        estimated_shortage_cost=0.0,
        total_evaluated_cost=0.0,
        solver_runtime_ms=1.0,
        solver_status="OPTIMAL"
    )
    o_metrics = b_metrics.model_copy()

    plan_b = OptimizationPlan(run_id="r1", strategy="baseline", planning_horizon_days=7, metrics=b_metrics, recommendations=[], shortages=[])
    plan_o = OptimizationPlan(run_id="r2", strategy="optimized_ortools", planning_horizon_days=7, metrics=o_metrics, recommendations=[], shortages=[])

    audit = compare_plans(plan_b, plan_o)
    assert audit.cost_savings_amount == 0.0
    assert audit.cost_reduction_pct == 0.0
    assert audit.total_evaluated_savings == 0.0
    assert audit.total_evaluated_savings_pct == 0.0
    assert audit.outcome_status == "equal"


def test_scenario_insufficient_inventory():
    """Verify behavior when inventory is insufficient to satisfy demand (Scenario 1)."""
    products, warehouses, destinations, batches, routes, demand = build_scenario_1_high_demand_scarce_supply()

    base_plan = run_baseline_allocation(products, warehouses, destinations, batches, routes, demand)
    opt_plan = run_ortools_optimization(products, warehouses, destinations, batches, routes, demand)

    validate_plan_invariants(base_plan, products, warehouses, destinations, batches, routes, demand)
    validate_plan_invariants(opt_plan, products, warehouses, destinations, batches, routes, demand)

    # Total demand = 300, Available inventory = 150
    assert opt_plan.metrics.total_demand_units == 300
    assert opt_plan.metrics.total_fulfilled_units == 150
    assert opt_plan.metrics.total_unmet_units == 150
    assert opt_plan.metrics.fulfillment_rate_pct == 50.0
    assert len(opt_plan.shortages) > 0


def test_scenario_route_weight_capacity_constraint():
    """Verify behavior when route weight capacity binds strictly (Scenario 6)."""
    products, warehouses, destinations, batches, routes, demand = build_scenario_6_tight_vehicle_weight_capacity()

    opt_plan = run_ortools_optimization(products, warehouses, destinations, batches, routes, demand)
    validate_plan_invariants(opt_plan, products, warehouses, destinations, batches, routes, demand)

    # 6.0 kg item on 300.0 kg lane -> exactly 50 units allocated!
    assert opt_plan.metrics.total_fulfilled_units == 50
    assert opt_plan.metrics.total_weight_shipped_kg == 300.0
    assert opt_plan.metrics.total_unmet_units == 50


def test_scenario_different_route_costs():
    """Verify that optimizer selects cheaper route corridor (Scenario 8)."""
    products, warehouses, destinations, batches, routes, demand = build_scenario_8_expensive_vs_cheap_alternatives()

    opt_plan = run_ortools_optimization(products, warehouses, destinations, batches, routes, demand)
    validate_plan_invariants(opt_plan, products, warehouses, destinations, batches, routes, demand)

    # Demand = 50. Route WH-NEAR ($2.00) vs WH-FAR ($8.00). Must pick WH-NEAR!
    assert opt_plan.metrics.total_fulfilled_units == 50
    assert opt_plan.metrics.total_transport_cost == 100.0  # 50 * $2.00
    assert opt_plan.recommendations[0].source_warehouse_id == "WH-NEAR"


def test_scenario_fefo_expiry_prioritization():
    """Verify that FEFO prioritizes batch approaching expiration (Scenario 3)."""
    products, warehouses, destinations, batches, routes, demand = build_scenario_3_products_approaching_expiry()

    opt_plan = run_ortools_optimization(products, warehouses, destinations, batches, routes, demand)
    validate_plan_invariants(opt_plan, products, warehouses, destinations, batches, routes, demand)

    # B-URGENT (5 days to expiry) vs B-FRESH (14 days to expiry). Demand = 100.
    # Optimizer must allocate B-URGENT first!
    assert opt_plan.metrics.total_fulfilled_units == 100
    assert opt_plan.recommendations[0].batch_id == "B-URGENT"
    assert opt_plan.metrics.expiring_stock_utilized_units == 100
