"""
SupplySync Automated Test Suite
Validates mathematical optimization invariants, baseline heuristic, demand forecasting,
and API contracts against edge cases and physical FMCG supply chain constraints.
"""

import pytest
from fastapi.testclient import TestClient

from engine.main import app
from engine.demo_data import (
    get_demo_products,
    get_demo_warehouses,
    get_demo_destinations,
    get_demo_inventory_batches,
    get_demo_routes,
    get_demo_demand_records
)
from engine.baseline import run_baseline_allocation
from engine.optimizer import run_ortools_optimization
from engine.validator import validate_plan_invariants, InvariantViolationError
from engine.comparator import compare_plans
from engine.demand import evaluate_forecasting_models

client = TestClient(app)


def test_api_health():
    """Verify engine health check."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "OR-Tools" in data["solver"]


def test_master_data_integrity():
    """Verify demo dataset structure and operational challenge definitions."""
    products = get_demo_products()
    warehouses = get_demo_warehouses()
    destinations = get_demo_destinations()
    batches = get_demo_inventory_batches()
    routes = get_demo_routes()
    demand = get_demo_demand_records()

    assert len(products) == 5
    assert len(warehouses) == 4
    assert len(destinations) == 8
    assert len(batches) >= 14
    assert len(routes) == 32
    assert len(demand) == 40

    # Ensure expired batch exists for testing exclusion
    expired_batches = [b for b in batches if b.is_expired or b.days_to_expiry <= 0]
    assert len(expired_batches) >= 1
    assert any(b.batch_id == "BATCH-001-DEL-EXPIRED" for b in expired_batches)

    # Ensure scarce product PROD-004 exists with demand > supply
    prod_4_demand = sum(d.forecasted_demand for d in demand if d.product_id == "PROD-004")
    prod_4_supply = sum(b.quantity for b in batches if b.product_id == "PROD-004" and not b.is_expired)
    assert prod_4_demand > prod_4_supply, f"PROD-004 must be scarce! Demand: {prod_4_demand}, Supply: {prod_4_supply}"


def test_baseline_allocation_invariants():
    """Verify that baseline allocation passes all 10 invariant checks."""
    products = get_demo_products()
    warehouses = get_demo_warehouses()
    destinations = get_demo_destinations()
    batches = get_demo_inventory_batches()
    routes = get_demo_routes()
    demand = get_demo_demand_records()

    plan = run_baseline_allocation(products, warehouses, destinations, batches, routes, demand)
    audit_messages = validate_plan_invariants(plan, products, warehouses, destinations, batches, routes, demand)
    assert len(audit_messages) >= 5

    # Invariant 4: No expired batch allocated
    allocated_batches = {r.batch_id for r in plan.recommendations}
    assert "BATCH-001-DEL-EXPIRED" not in allocated_batches


def test_ortools_optimizer_invariants_and_superiority():
    """Verify that OR-Tools optimizer passes invariants and improves on baseline."""
    products = get_demo_products()
    warehouses = get_demo_warehouses()
    destinations = get_demo_destinations()
    batches = get_demo_inventory_batches()
    routes = get_demo_routes()
    demand = get_demo_demand_records()

    baseline_plan = run_baseline_allocation(products, warehouses, destinations, batches, routes, demand)
    opt_plan = run_ortools_optimization(products, warehouses, destinations, batches, routes, demand)

    # Invariants audit
    audit_messages = validate_plan_invariants(opt_plan, products, warehouses, destinations, batches, routes, demand)
    assert len(audit_messages) >= 5

    # Verify optimizer achieves equal or superior fulfillment
    assert opt_plan.metrics.fulfillment_rate_pct >= baseline_plan.metrics.fulfillment_rate_pct

    # Verify no expired stock allocated
    allocated_batches = {r.batch_id for r in opt_plan.recommendations}
    assert "BATCH-001-DEL-EXPIRED" not in allocated_batches

    # Verify scarce SKU PROD-004 allocation does not exceed physical stock
    prod_4_supply = sum(b.quantity for b in batches if b.product_id == "PROD-004" and not b.is_expired)
    prod_4_allocated = sum(r.allocated_quantity for r in opt_plan.recommendations if r.product_id == "PROD-004")
    assert prod_4_allocated <= prod_4_supply


def test_comparison_audit_metrics():
    """Verify side-by-side comparison calculation."""
    products = get_demo_products()
    warehouses = get_demo_warehouses()
    destinations = get_demo_destinations()
    batches = get_demo_inventory_batches()
    routes = get_demo_routes()
    demand = get_demo_demand_records()

    baseline_plan = run_baseline_allocation(products, warehouses, destinations, batches, routes, demand)
    opt_plan = run_ortools_optimization(products, warehouses, destinations, batches, routes, demand)

    audit = compare_plans(baseline_plan, opt_plan)
    assert audit.baseline_metrics.strategy == "baseline"
    assert audit.optimized_metrics.strategy == "optimized_ortools"
    assert isinstance(audit.cost_reduction_pct, float)
    assert isinstance(audit.fulfillment_improvement_pct, float)
    assert isinstance(audit.stockout_reduction_pct, float)
    assert len(audit.summary_verdict) > 20


def test_demand_forecasting_evaluation():
    """Verify chronological demand backtesting."""
    res = evaluate_forecasting_models(product_id="PROD-001", destination_id="DEST-PUNE", horizon_days=7)
    assert res["product_id"] == "PROD-001"
    assert res["destination_id"] == "DEST-PUNE"
    assert res["forecasted_demand_total"] > 0
    assert "baseline_sma" in res["evaluation_metrics"]
    assert "ml_regression" in res["evaluation_metrics"]
    assert res["evaluation_metrics"]["baseline_sma"]["mae"] > 0


def test_api_endpoints():
    """Verify full FastAPI lifecycle."""
    # 1. Master data endpoint
    resp_master = client.get("/api/master-data")
    assert resp_master.status_code == 200
    data = resp_master.json()
    assert "products" in data
    assert "warehouses" in data

    # 2. Compare endpoint
    resp_compare = client.post("/api/compare", json={"planning_horizon_days": 7})
    assert resp_compare.status_code == 200
    compare_data = resp_compare.json()
    assert "baseline_metrics" in compare_data
    assert "optimized_metrics" in compare_data

    # 3. Export CSV endpoint
    resp_opt = client.post("/api/optimize", json={"planning_horizon_days": 7})
    assert resp_opt.status_code == 200
    opt_plan = resp_opt.json()
    run_id = opt_plan["run_id"]

    resp_export = client.get(f"/api/export/{run_id}")
    assert resp_export.status_code == 200
    assert resp_export.headers["content-type"].startswith("text/csv")
    csv_text = resp_export.text
    assert "Recommendation ID" in csv_text
    assert "Allocated Quantity" in csv_text
