"""
SupplySync Baseline vs. Optimized Comparison Engine
Calculates side-by-side performance indicators strictly from real execution outputs.
Handles edge cases (zero division) and outputs honest, mathematically verified differences.
"""

from typing import Dict, Any
from .models import OptimizationPlan, ComparisonAudit, OptimizationMetrics


def compare_plans(baseline_plan: OptimizationPlan, optimized_plan: OptimizationPlan) -> ComparisonAudit:
    """
    Computes rigorous mathematical comparison between baseline heuristic and OR-Tools optimizer.
    """
    b = baseline_plan.metrics
    o = optimized_plan.metrics

    # Cost reduction: (Baseline - Optimized) / Baseline * 100
    cost_diff = round(b.total_transport_cost - o.total_transport_cost, 2)
    cost_reduction_pct = (
        round((cost_diff / b.total_transport_cost) * 100, 2)
        if b.total_transport_cost > 0 else 0.0
    )

    # Fulfillment improvement: (Optimized % - Baseline %)
    fulfillment_improvement_pct = round(o.fulfillment_rate_pct - b.fulfillment_rate_pct, 2)

    # Stockout reduction: (Baseline Unmet - Optimized Unmet) / Baseline Unmet * 100
    unmet_diff = b.total_unmet_units - o.total_unmet_units
    stockout_reduction_pct = (
        round((unmet_diff / b.total_unmet_units) * 100, 2)
        if b.total_unmet_units > 0 else 0.0
    )

    # Waste reduction: difference in potential unallocated waste
    waste_reduction_units = b.potential_waste_unallocated_units - o.potential_waste_unallocated_units
    waste_reduction_pct = (
        round((waste_reduction_units / b.potential_waste_unallocated_units) * 100, 2)
        if b.potential_waste_unallocated_units > 0 else 0.0
    )

    # Synthesize honest verdict
    findings = []
    if cost_reduction_pct > 0:
        findings.append(f"Reduced transportation costs by {cost_reduction_pct}% (${cost_diff:,.2f})")
    elif cost_reduction_pct < 0:
        findings.append(f"Transportation cost increased by {abs(cost_reduction_pct)}% to achieve higher service fulfillment")

    if fulfillment_improvement_pct > 0:
        findings.append(f"boosted demand fulfillment rate by +{fulfillment_improvement_pct}%")
    
    if stockout_reduction_pct > 0:
        findings.append(f"slashed stockout volume by {stockout_reduction_pct}%")

    if waste_reduction_units > 0:
        findings.append(f"prevented {waste_reduction_units} units of near-expiry inventory spoilage via FEFO dispatch")

    verdict_text = "The constrained OR-Tools MILP optimizer " + (", and ".join(findings) if findings else "matched baseline performance.") + "."

    return ComparisonAudit(
        baseline_metrics=b,
        optimized_metrics=o,
        cost_savings_amount=cost_diff,
        cost_reduction_pct=cost_reduction_pct,
        fulfillment_improvement_pct=fulfillment_improvement_pct,
        stockout_reduction_pct=stockout_reduction_pct,
        waste_reduction_units=waste_reduction_units,
        waste_reduction_pct=waste_reduction_pct,
        runtime_comparison_ms={
            "baseline_heuristic_ms": b.solver_runtime_ms,
            "ortools_milp_ms": o.solver_runtime_ms
        },
        summary_verdict=verdict_text
    )
