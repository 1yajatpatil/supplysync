"""
SupplySync Automated Test Suite
Validates mathematical optimization invariants, baseline heuristic, demand forecasting,
M5 Kaggle data integration, and API contracts against edge cases and physical FMCG supply chain constraints.
"""

import pytest
from fastapi.testclient import TestClient

from engine.main import app, get_dataset_bundle
from engine.demo_data import (
    get_demo_products,
    get_demo_warehouses,
    get_demo_destinations,
    get_demo_inventory_batches,
    get_demo_routes,
    get_demo_demand_records
)
from engine.m5_loader import M5DataLoader, get_m5_status, get_m5_directory
from engine.m5_logistics import (
    get_m5_products,
    get_m5_destinations,
    get_m5_warehouses,
    get_m5_routes,
    get_m5_inventory_batches
)
from engine.baseline import run_baseline_allocation
from engine.optimizer import run_ortools_optimization
from engine.validator import validate_plan_invariants, InvariantViolationError
from engine.comparator import compare_plans
from engine.demand import (
    evaluate_forecasting_models,
    generate_forecasted_demand_records,
    calculate_wape
)

client = TestClient(app)


def test_api_health():
    """Verify engine health check."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "OR-Tools" in data["solver"]
    assert "m5_available" in data


def test_dataset_status_endpoint():
    """Verify dataset diagnostics endpoint."""
    response = client.get("/api/dataset-status")
    assert response.status_code == 200
    data = response.json()
    assert data["available"] is True
    assert data["active_source"] in ("full", "sample")


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


def test_m5_data_loader_and_time_series():
    """Verify loading real M5 calendar and sales history."""
    loader = M5DataLoader()
    cal = loader.load_calendar()
    assert "date" in cal.columns
    assert "d" in cal.columns

    stores, items = loader.get_available_entities()
    assert len(stores) >= 2
    assert len(items) >= 2

    # Load time-series for first available item/store
    series = loader.load_time_series(items[0], stores[0])
    assert len(series) >= 60
    assert "demand" in series[0]
    assert "day_of_week" in series[0]
    assert "date" in series[0]


def test_m5_logistics_mapping():
    """Verify configured logistics scenario mapped to M5 identifiers."""
    loader = M5DataLoader()
    destinations = get_m5_destinations(loader)
    products = get_m5_products(loader)
    warehouses = get_m5_warehouses()
    routes = get_m5_routes(destinations, warehouses)
    batches = get_m5_inventory_batches(products, warehouses)

    # Identifiers must match M5
    stores, items = loader.get_available_entities()
    dest_ids = {d.id for d in destinations}
    prod_ids = {p.id for p in products}
    for s in stores:
        assert s in dest_ids
    for it in items:
        assert it in prod_ids

    # Routes must connect each warehouse to each store
    assert len(routes) == len(warehouses) * len(destinations)


def test_planning_horizon_scaling_7_14_30():
    """Verify that changing planning horizon genuinely scales forecasted demand."""
    products = get_demo_products()
    destinations = get_demo_destinations()

    d7 = generate_forecasted_demand_records(products, destinations, horizon_days=7, data_source="synthetic")
    d14 = generate_forecasted_demand_records(products, destinations, horizon_days=14, data_source="synthetic")
    d30 = generate_forecasted_demand_records(products, destinations, horizon_days=30, data_source="synthetic")

    sum_7 = sum(d.forecasted_demand for d in d7)
    sum_14 = sum(d.forecasted_demand for d in d14)
    sum_30 = sum(d.forecasted_demand for d in d30)

    # Demand for 14 days must be approximately double 7 days, and 30 days must be larger than 14
    assert sum_14 > sum_7 * 1.5, f"14D demand ({sum_14}) should exceed 7D demand ({sum_7})"
    assert sum_30 > sum_14 * 1.5, f"30D demand ({sum_30}) should exceed 14D demand ({sum_14})"


def test_wape_metric_calculation():
    """Verify robust WAPE error metric avoids division by zero on zero-sales days."""
    y_true = [10.0, 0.0, 0.0, 5.0, 15.0]
    y_pred = [8.0, 2.0, 0.0, 5.0, 12.0]
    wape = calculate_wape(y_true, y_pred)
    # Sum true = 30. Sum abs err = 2 + 2 + 0 + 0 + 3 = 7. WAPE = 7/30*100 = 23.33%
    assert 23.0 <= wape <= 24.0

    # All zeros edge case
    assert calculate_wape([0.0, 0.0], [0.0, 0.0]) == 0.0


def test_baseline_allocation_invariants():
    """Verify that baseline allocation passes all invariant checks."""
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


def test_m5_mode_optimization_end_to_end():
    """
    Mandatory Acceptance Criterion:
    Real M5 sales history -> Prepared time series -> Demand forecast -> OR-Tools optimizer -> Valid allocation plan.
    """
    products, warehouses, destinations, batches, routes, demand = get_dataset_bundle("m5", horizon_days=7)
    
    # Run optimizer on M5 dataset bundle
    plan = run_ortools_optimization(
        products=products,
        warehouses=warehouses,
        destinations=destinations,
        batches=batches,
        routes=routes,
        demand_records=demand,
        planning_horizon_days=7
    )

    # Invariant audit
    audit_messages = validate_plan_invariants(plan, products, warehouses, destinations, batches, routes, demand)
    assert len(audit_messages) >= 5
    assert plan.metrics.fulfillment_rate_pct > 0
    assert len(plan.recommendations) > 0

    # Ensure recommendations carry real M5 item and store IDs
    rec_products = {r.product_id for r in plan.recommendations}
    rec_destinations = {r.destination_id for r in plan.recommendations}
    assert any("FOODS" in pid or "HOBBIES" in pid or "HOUSEHOLD" in pid for pid in rec_products)
    assert any("CA_" in did or "TX_" in did for did in rec_destinations)


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
    assert "wape_pct" in res["evaluation_metrics"]["baseline_sma"]
    assert res["evaluation_metrics"]["baseline_sma"]["mae"] > 0


def test_api_endpoints():
    """Verify full FastAPI lifecycle."""
    # 1. Master data endpoint
    resp_master = client.get("/api/master-data?data_source=synthetic&horizon=7")
    assert resp_master.status_code == 200
    data = resp_master.json()
    assert "products" in data
    assert "warehouses" in data

    # 2. Master data endpoint for M5
    resp_m5 = client.get("/api/master-data?data_source=m5&horizon=14")
    assert resp_m5.status_code == 200
    data_m5 = resp_m5.json()
    assert data_m5["data_source"] == "m5"
    assert data_m5["horizon_days"] == 14

    # 3. Compare endpoint
    resp_compare = client.post("/api/compare", json={"planning_horizon_days": 7, "data_source": "synthetic"})
    assert resp_compare.status_code == 200
    compare_data = resp_compare.json()
    assert "baseline_metrics" in compare_data
    assert "optimized_metrics" in compare_data

    # 4. Export CSV endpoint
    resp_opt = client.post("/api/optimize", json={"planning_horizon_days": 7, "data_source": "synthetic"})
    assert resp_opt.status_code == 200
    opt_plan = resp_opt.json()
    run_id = opt_plan["run_id"]

    resp_export = client.get(f"/api/export/{run_id}")
    assert resp_export.status_code == 200
    assert resp_export.headers["content-type"].startswith("text/csv")
    csv_text = resp_export.text
    assert "Recommendation ID" in csv_text
    assert "Allocated Quantity" in csv_text
