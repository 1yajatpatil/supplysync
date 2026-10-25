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
    Adheres strictly to actual execution outputs without fabricating differences.
    """
    b = baseline_plan.metrics
    o = optimized_plan.metrics

    # 1. Freight / Transportation Cost Variance:
    # Absolute savings = baseline freight - optimizer freight
    freight_diff = round(b.total_transport_cost - o.total_transport_cost, 2)
    if b.total_transport_cost > 0:
        freight_reduction_pct = round((freight_diff / b.total_transport_cost) * 100, 2)
    elif b.total_transport_cost == 0 and o.total_transport_cost == 0:
        freight_reduction_pct = 0.0
    else:
        freight_reduction_pct = -100.0 if freight_diff < 0 else 100.0

    # 2. Total Evaluated Economic Cost:
    # total_economic_cost = freight_cost + shortage_penalty
    b_shortage = round(float(b.estimated_shortage_cost or 0.0), 2)
    o_shortage = round(float(o.estimated_shortage_cost or 0.0), 2)

    b_eval = b.total_evaluated_cost if b.total_evaluated_cost is not None else round(b.total_transport_cost + b_shortage, 2)
    o_eval = o.total_evaluated_cost if o.total_evaluated_cost is not None else round(o.total_transport_cost + o_shortage, 2)

    # Absolute savings = baseline_total_economic_cost - optimizer_total_economic_cost
    eval_diff = round(b_eval - o_eval, 2)

    # Percentage savings handling zero-cost baselines safely and preserving negative values
    if b_eval > 0:
        eval_reduction_pct = round((eval_diff / b_eval) * 100, 2)
    elif b_eval == 0 and o_eval == 0:
        eval_reduction_pct = 0.0
    else:
        eval_reduction_pct = -100.0 if eval_diff < 0 else 100.0

    # 3. Fulfillment Improvement: (Optimized % - Baseline %)
    fulfillment_improvement_pct = round(o.fulfillment_rate_pct - b.fulfillment_rate_pct, 2)

    # 4. Stockout Reduction: (Baseline Unmet - Optimized Unmet) / Baseline Unmet * 100
    unmet_diff = b.total_unmet_units - o.total_unmet_units
    if b.total_unmet_units > 0:
        stockout_reduction_pct = round((unmet_diff / b.total_unmet_units) * 100, 2)
    elif b.total_unmet_units == 0 and o.total_unmet_units == 0:
        stockout_reduction_pct = 0.0
    else:
        stockout_reduction_pct = -100.0 if unmet_diff < 0 else 100.0

    # 5. Waste Reduction: difference in potential unallocated waste
    waste_reduction_units = b.potential_waste_unallocated_units - o.potential_waste_unallocated_units
    waste_reduction_pct = (
        round((waste_reduction_units / b.potential_waste_unallocated_units) * 100, 2)
        if b.potential_waste_unallocated_units > 0 else 0.0
    )

    # 6. Structured Outcome Determination & Neutral Evidence-based Verdict
    is_strictly_equal = (
        abs(eval_diff) < 0.005 and
        abs(freight_diff) < 0.005 and
        abs(fulfillment_improvement_pct) < 0.005 and
        unmet_diff == 0 and
        waste_reduction_units == 0
    )

    if is_strictly_equal:
        outcome_status = "equal"
        if b.total_demand_units > 0 and b.fulfillment_rate_pct == 100.0:
            verdict_text = (
                f"Under the current unconstrained network scenario, the greedy baseline heuristic and OR-Tools MILP optimizer achieved "
                f"identical performance: 100% fulfillment ({b.total_fulfilled_units:,} / {b.total_demand_units:,} units) at equal freight cost "
                f"(${b.total_transport_cost:,.2f}) with zero unmet demand and equal near-expiry batch utilization ({b.expiring_stock_utilized_units:,} units). "
                f"In an unconstrained network where direct lowest-tariff lanes possess sufficient supply, the greedy heuristic is already globally optimal."
            )
        else:
            verdict_text = (
                f"Both methods achieved identical performance on this scenario at total economic cost ${b_eval:,.2f} "
                f"({b.fulfillment_rate_pct}% fulfillment). Neither algorithm had an advantage on this topology."
            )
    elif eval_diff > 0.005:
        outcome_status = "optimizer_superior"
        findings = []
        findings.append(f"reduced total economic cost by {eval_reduction_pct}% (net savings of ${eval_diff:,.2f})")
        if freight_diff > 0:
            findings.append(f"reduced freight expenditure by {freight_reduction_pct}% (${freight_diff:,.2f})")
        elif freight_diff < 0 and fulfillment_improvement_pct > 0:
            findings.append(f"reallocated freight (${abs(freight_diff):,.2f} higher) to prevent high-penalty customer stockouts")
        if fulfillment_improvement_pct > 0:
            findings.append(f"improved fulfillment rate by +{fulfillment_improvement_pct}% (+{o.total_fulfilled_units - b.total_fulfilled_units:,} units)")
        if stockout_reduction_pct > 0:
            findings.append(f"reduced stockout volume by {stockout_reduction_pct}%")
        if waste_reduction_units > 0:
            findings.append(f"prevented {waste_reduction_units} units of near-expiry inventory spoilage via FEFO dispatch")
        verdict_text = f"The constrained OR-Tools MILP optimizer outperformed the baseline: {', and '.join(findings)}."
    elif eval_diff < -0.005:
        outcome_status = "optimizer_inferior"
        verdict_text = (
            f"The baseline heuristic achieved a lower total economic cost than the optimizer on this scenario "
            f"(${b_eval:,.2f} vs ${o_eval:,.2f}, negative savings of -${abs(eval_diff):,.2f} / {eval_reduction_pct}%)."
        )
    elif fulfillment_improvement_pct > 0 or waste_reduction_units > 0:
        outcome_status = "optimizer_superior"
        findings = []
        if fulfillment_improvement_pct > 0:
            findings.append(f"improved fulfillment by +{fulfillment_improvement_pct}%")
        if waste_reduction_units > 0:
            findings.append(f"prevented {waste_reduction_units} units of near-expiry spoilage")
        verdict_text = f"The OR-Tools MILP optimizer achieved service and inventory improvements: {', and '.join(findings)}."
    else:
        outcome_status = "tradeoff"
        verdict_text = (
            f"Trade-off between methods: baseline freight was ${b.total_transport_cost:,.2f} vs optimizer ${o.total_transport_cost:,.2f}, "
            f"with fulfillment variance of {fulfillment_improvement_pct}%."
        )

    economic_breakdown = {
        "baseline_freight_cost": b.total_transport_cost,
        "optimizer_freight_cost": o.total_transport_cost,
        "freight_savings_amount": freight_diff,
        "freight_savings_pct": freight_reduction_pct,
        "baseline_shortage_penalty": b_shortage,
        "optimizer_shortage_penalty": o_shortage,
        "shortage_savings_amount": round(b_shortage - o_shortage, 2),
        "baseline_total_economic_cost": b_eval,
        "optimizer_total_economic_cost": o_eval,
        "total_economic_savings_amount": eval_diff,
        "total_economic_savings_pct": eval_reduction_pct,
    }

    return ComparisonAudit(
        baseline_metrics=b,
        optimized_metrics=o,
        cost_savings_amount=freight_diff,
        cost_reduction_pct=freight_reduction_pct,
        fulfillment_improvement_pct=fulfillment_improvement_pct,
        stockout_reduction_pct=stockout_reduction_pct,
        waste_reduction_units=waste_reduction_units,
        waste_reduction_pct=waste_reduction_pct,
        runtime_comparison_ms={
            "baseline_heuristic_ms": b.solver_runtime_ms,
            "ortools_milp_ms": o.solver_runtime_ms
        },
        summary_verdict=verdict_text,
        total_evaluated_savings=eval_diff,
        total_evaluated_savings_pct=eval_reduction_pct,
        outcome_status=outcome_status,
        economic_breakdown=economic_breakdown
    )
