"""
SupplySync Phase 3 Benchmark & Validation Automated Tests
Triwizathon 2026 | Problem Statement 2

Covers:
- All 15 deterministic benchmark scenarios.
- Verification that MILP strictly outperforms greedy heuristic on multi-depot bottleneck lanes (Scenario 15).
- Verification that baseline and optimizer produce identical solutions on unconstrained lanes (Scenario 14).
- Independent validator mutation audit (asserting 100% rejection of corrupt plans).
- Economic assumption sensitivity verification.
- Dataset validation CLI execution.
"""

import pytest
from engine.benchmarks import (
    run_all_benchmarks,
    run_single_benchmark_scenario,
    run_sensitivity_analysis,
    run_validator_mutation_audit
)
from scripts.validate_full_m5 import validate_m5_directory
from pathlib import Path


def test_phase3_all_15_scenarios_execute_and_validate():
    """Verify that all 15 deterministic benchmark scenarios run and satisfy invariants."""
    results = run_all_benchmarks()
    assert len(results) == 15, f"Expected 15 benchmark scenarios, got {len(results)}"
    
    for r in results:
        assert r["optimizer"]["fulfilled"] >= 0
        assert r["baseline"]["fulfilled"] >= 0
        assert r["comparison"]["invariants_validated"] is True, f"Invariant validation failed on Scenario {r['scenario_id']}"


def test_phase3_scenario_15_milp_superiority():
    """Verify exact economic reconciliation for Scenario 15 (Tariff Trap)."""
    res = run_single_benchmark_scenario(15)
    
    base = res["baseline"]
    opt = res["optimizer"]
    comp = res["comparison"]
    
    # Exact economic reconciliation:
    # Baseline:
    # Dest-1 (Tier-1) allocated 50 from WH-1 @ $2.00 = $100.00 freight.
    # Dest-2 (Tier-1) stockout: 50 units * $25.00 * 1.30 (Tier-1 SLA) = $1,625.00 shortage penalty.
    # Total evaluated Baseline cost = $1,725.00.
    assert base["fulfilled"] == 50
    assert base["unmet"] == 50
    assert base["transport_cost"] == 100.0
    assert base["shortage_cost"] == 1625.0
    assert base["total_evaluated_cost"] == 1725.0

    # MILP Optimizer:
    # Dest-1 allocated 50 from WH-2 @ $3.00 = $150.00 freight.
    # Dest-2 allocated 50 from WH-1 @ $2.50 = $125.00 freight.
    # Total evaluated MILP cost = $275.00 freight + $0 shortage = $275.00.
    assert opt["fulfilled"] == 100
    assert opt["unmet"] == 0
    assert opt["transport_cost"] == 275.0
    assert opt["shortage_cost"] == 0.0
    assert opt["total_evaluated_cost"] == 275.0
    assert opt["solver_status"] == "OPTIMAL"

    # Comparative savings:
    # Net savings: $1,725.00 - $275.00 = $1,450.00.
    # Cost reduction: $1,450 / $1,725 * 100 = 84.06%.
    assert comp["cost_savings"] == 1450.0
    assert comp["cost_reduction_pct"] == 84.06


def test_phase3_scenario_14_baseline_optimizer_parity():
    """Verify that baseline and optimizer produce identical results on simple unconstrained lane."""
    res = run_single_benchmark_scenario(14)
    
    assert res["optimizer"]["fulfilled"] == res["baseline"]["fulfilled"]
    assert res["optimizer"]["total_evaluated_cost"] == res["baseline"]["total_evaluated_cost"]
    assert res["comparison"]["cost_savings"] == 0.0


def test_phase3_scenario_6_weight_capacity_binding():
    """Verify that corridor vehicle weight capacity binds strictly before unit count."""
    res = run_single_benchmark_scenario(6)
    
    # 6.0 kg item on 300.0 kg weight capacity lane -> max 50 units!
    assert res["optimizer"]["fulfilled"] == 50
    assert res["optimizer"]["weight_shipped_kg"] == 300.0
    assert res["optimizer"]["unmet"] == 50


def test_phase3_scenario_11_solver_status_and_slack_feasibility():
    """Verify that Scenario 11 returns OPTIMAL status with 100% shortage slack when supply is ineligible."""
    res = run_single_benchmark_scenario(11)
    
    # In standard mode (with shortage slack), model is mathematically FEASIBLE and OPTIMAL
    # All stock expires before transit, so 0 units can be shipped and all 50 units are shortage slack
    assert res["optimizer"]["solver_status"] == "OPTIMAL"
    assert res["optimizer"]["fulfilled"] == 0
    assert res["optimizer"]["unmet"] == 50
    assert res["optimizer"]["transport_cost"] == 0.0
    # Tier-1 shortage: 50 * $50.00 * 1.30 = $3,250.00
    assert res["optimizer"]["shortage_cost"] == 3250.0
    assert res["optimizer"]["total_evaluated_cost"] == 3250.0
    assert res["baseline"]["total_evaluated_cost"] == 3250.0
    assert res["comparison"]["cost_savings"] == 0.0


def test_phase3_genuine_model_infeasibility():
    """Verify that genuine model infeasibility is raised when strict demand equality is enforced."""
    from engine.benchmarks import build_scenario_11_zero_eligible_supply
    from engine.optimizer import run_ortools_optimization, OptimizationInfeasibleError

    prods, whs, dests, batches, routes, demands = build_scenario_11_zero_eligible_supply()

    # Enforce strict demand satisfaction (disallowing shortage slack):
    # Since all batches arrive expired, NO shipments can be scheduled to satisfy demand.
    # The solver must return INFEASIBLE and raise OptimizationInfeasibleError.
    with pytest.raises(OptimizationInfeasibleError) as exc_info:
        run_ortools_optimization(prods, whs, dests, batches, routes, demands, enforce_strict_demand=True)
    
    assert "INFEASIBLE" in str(exc_info.value)
    assert "code 2" in str(exc_info.value)


def test_phase3_solver_timeout_and_error_handling():
    """Verify that solver timeout (NOT_SOLVED) and suboptimal (FEASIBLE) states are handled safely."""
    from unittest.mock import patch
    from ortools.linear_solver import pywraplp
    from engine.benchmarks import build_scenario_14_unconstrained_benchmark
    from engine.optimizer import run_ortools_optimization, OptimizationInfeasibleError

    prods, whs, dests, batches, routes, demands = build_scenario_14_unconstrained_benchmark()

    # 1. Verify NOT_SOLVED status (timeout condition) triggers OptimizationInfeasibleError with exact code
    with patch.object(pywraplp.Solver, 'Solve', return_value=pywraplp.Solver.NOT_SOLVED):
        with pytest.raises(OptimizationInfeasibleError) as exc_info:
            run_ortools_optimization(prods, whs, dests, batches, routes, demands)
        assert "NOT_SOLVED" in str(exc_info.value)
        assert "code 6" in str(exc_info.value)

    # 2. Verify suboptimal FEASIBLE status is faithfully captured in OptimizationMetrics
    with patch.object(pywraplp.Solver, 'Solve', return_value=pywraplp.Solver.FEASIBLE):
        plan = run_ortools_optimization(prods, whs, dests, batches, routes, demands)
        assert plan.metrics.solver_status == "FEASIBLE"


def test_phase3_validator_mutation_testing():
    """Verify that independent validator rejects 100% of deliberately corrupted plans across 24 mutations."""
    mutation_results = run_validator_mutation_audit()
    assert mutation_results["mutations_tested"] == 24
    assert mutation_results["mutations_rejected"] == 24
    assert mutation_results["rejection_rate_pct"] == 100.0


def test_phase3_economic_sensitivity_tradeoff():
    """Verify that increasing shortage penalties preserves or increases fulfillment."""
    sensitivity = run_sensitivity_analysis()
    assert len(sensitivity) == 5
    
    # Verify non-decreasing fulfillment or stable fulfillment as penalty increases
    fulfillments = [s["fulfilled_units"] for s in sensitivity]
    assert all(fulfillments[i] <= fulfillments[i+1] for i in range(len(fulfillments)-1))


def test_phase3_dataset_validator_cli_on_sample():
    """Verify that the standalone validation script successfully validates the bundled sample."""
    sample_dir = Path("data/m5/sample")
    report = validate_m5_directory(sample_dir)
    
    assert report["integrity"] is True
    assert report["cross_validation_passed"] is True
    assert report["performance"]["stores_count"] >= 4
    assert report["performance"]["items_count"] >= 5
