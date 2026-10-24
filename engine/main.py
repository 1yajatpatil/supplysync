"""
SupplySync FastAPI Service
Main application exposing REST endpoints for FMCG master data, demand forecasting,
baseline distribution allocation, constrained OR-Tools optimization, plan comparison, and CSV export.
Supports both Synthetic FMCG Demo dataset and Real M5 Kaggle Dataset.
"""

import io
import csv
from typing import List, Dict, Optional, Any
from fastapi import FastAPI, HTTPException, Response, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from .models import (
    Product, 
    Warehouse, 
    Destination, 
    InventoryBatch, 
    Route, 
    DemandRecord, 
    OptimizationPlan,
    ComparisonAudit
)
from .demo_data import (
    get_demo_products,
    get_demo_warehouses,
    get_demo_destinations,
    get_demo_inventory_batches,
    get_demo_routes,
    get_demo_demand_records
)
from .m5_loader import get_m5_status, M5DataLoader
from .m5_logistics import (
    get_m5_products,
    get_m5_destinations,
    get_m5_warehouses,
    get_m5_routes,
    get_m5_inventory_batches
)
from .demand import evaluate_forecasting_models, generate_forecasted_demand_records
from .baseline import run_baseline_allocation
from .optimizer import run_ortools_optimization
from .validator import validate_plan_invariants
from .comparator import compare_plans

app = FastAPI(
    title="SupplySync Engine",
    description="FMCG Distribution Intelligence & Constrained Inventory Optimization Service",
    version="1.1.0"
)

# Enable CORS for local client and API gateway
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory store for optimization run persistence
RUNS_STORE: Dict[str, OptimizationPlan] = {}


def get_dataset_bundle(data_source: str = "synthetic", horizon_days: int = 7):
    """
    Retrieves the complete data network for the specified data source and planning horizon.
    Generates genuine demand forecasts scaled to the requested horizon (7D, 14D, 30D).
    """
    if data_source == "m5":
        loader = M5DataLoader()
        products = get_m5_products(loader)
        destinations = get_m5_destinations(loader)
        warehouses = get_m5_warehouses()
        routes = get_m5_routes(destinations, warehouses)
        batches = get_m5_inventory_batches(products, warehouses)
        demand = generate_forecasted_demand_records(
            products=products,
            destinations=destinations,
            horizon_days=horizon_days,
            data_source="m5"
        )
        return products, warehouses, destinations, batches, routes, demand
    else:
        products = get_demo_products()
        warehouses = get_demo_warehouses()
        destinations = get_demo_destinations()
        batches = get_demo_inventory_batches()
        routes = get_demo_routes()
        # Scale demand forecasts according to planning horizon
        demand = generate_forecasted_demand_records(
            products=products,
            destinations=destinations,
            horizon_days=horizon_days,
            data_source="synthetic"
        )
        return products, warehouses, destinations, batches, routes, demand


@app.get("/health")
def health_check():
    m5_info = get_m5_status()
    return {
        "status": "healthy",
        "service": "SupplySync Optimization & Forecasting Engine",
        "solver": "Google OR-Tools SCIP MILP",
        "m5_available": m5_info.get("available", False),
        "m5_source": m5_info.get("active_source", "none"),
        "version": "1.1.0"
    }


@app.get("/api/dataset-status")
def dataset_status():
    """
    Returns diagnostics on M5 dataset presence, file checklist, and active source.
    """
    return get_m5_status()


@app.get("/api/master-data")
def get_master_data(
    data_source: str = Query("synthetic", description="'synthetic' or 'm5'"),
    horizon: int = Query(7, description="Planning horizon days (7, 14, 30)")
):
    """
    Returns the complete FMCG master dataset including products, warehouses,
    destinations, inventory batches with expiry dates, routes, and demand records.
    """
    products, warehouses, destinations, batches, routes, demand = get_dataset_bundle(data_source, horizon)
    return {
        "products": products,
        "warehouses": warehouses,
        "destinations": destinations,
        "batches": batches,
        "routes": routes,
        "demand": demand,
        "data_source": data_source,
        "horizon_days": horizon
    }


class ForecastRequest(BaseModel):
    product_id: str
    destination_id: str
    horizon_days: int = 7
    data_source: str = "synthetic"


@app.post("/api/forecast")
def get_forecast(req: ForecastRequest):
    """
    Evaluates chronological demand forecasting models and returns projections.
    """
    return evaluate_forecasting_models(
        product_id=req.product_id,
        destination_id=req.destination_id,
        horizon_days=req.horizon_days,
        data_source=req.data_source
    )


class OptimizationRequest(BaseModel):
    planning_horizon_days: int = 7
    data_source: str = "synthetic"
    custom_products: Optional[List[Product]] = None
    custom_warehouses: Optional[List[Warehouse]] = None
    custom_destinations: Optional[List[Destination]] = None
    custom_batches: Optional[List[InventoryBatch]] = None
    custom_routes: Optional[List[Route]] = None
    custom_demand: Optional[List[DemandRecord]] = None


@app.post("/api/baseline", response_model=OptimizationPlan)
def run_baseline(req: OptimizationRequest):
    """
    Executes the greedy demand-priority baseline distribution strategy and validates invariants.
    """
    if req.custom_products and req.custom_warehouses and req.custom_destinations and req.custom_batches and req.custom_routes and req.custom_demand:
        products = req.custom_products
        warehouses = req.custom_warehouses
        destinations = req.custom_destinations
        batches = req.custom_batches
        routes = req.custom_routes
        demand = req.custom_demand
    else:
        products, warehouses, destinations, batches, routes, demand = get_dataset_bundle(
            req.data_source, req.planning_horizon_days
        )

    plan = run_baseline_allocation(
        products=products,
        warehouses=warehouses,
        destinations=destinations,
        batches=batches,
        routes=routes,
        demand_records=demand,
        planning_horizon_days=req.planning_horizon_days
    )

    # Validate physical invariants
    validate_plan_invariants(
        plan=plan,
        products=products,
        warehouses=warehouses,
        destinations=destinations,
        batches=batches,
        routes=routes,
        demand_records=demand
    )

    RUNS_STORE[plan.run_id] = plan
    return plan


@app.post("/api/optimize", response_model=OptimizationPlan)
def run_optimizer(req: OptimizationRequest):
    """
    Executes constrained OR-Tools Mixed-Integer Programming distribution optimization
    with batch-level FEFO expiry handling, and validates all invariants.
    """
    if req.custom_products and req.custom_warehouses and req.custom_destinations and req.custom_batches and req.custom_routes and req.custom_demand:
        products = req.custom_products
        warehouses = req.custom_warehouses
        destinations = req.custom_destinations
        batches = req.custom_batches
        routes = req.custom_routes
        demand = req.custom_demand
    else:
        products, warehouses, destinations, batches, routes, demand = get_dataset_bundle(
            req.data_source, req.planning_horizon_days
        )

    try:
        plan = run_ortools_optimization(
            products=products,
            warehouses=warehouses,
            destinations=destinations,
            batches=batches,
            routes=routes,
            demand_records=demand,
            planning_horizon_days=req.planning_horizon_days
        )
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Optimization failed: {str(e)}")

    # Strict invariant validation
    validate_plan_invariants(
        plan=plan,
        products=products,
        warehouses=warehouses,
        destinations=destinations,
        batches=batches,
        routes=routes,
        demand_records=demand
    )

    RUNS_STORE[plan.run_id] = plan
    return plan


@app.post("/api/compare", response_model=ComparisonAudit)
def run_comparison(req: OptimizationRequest):
    """
    Executes both baseline and OR-Tools optimizer under identical starting inputs
    and returns an objective, mathematically validated comparison audit.
    """
    if req.custom_products and req.custom_warehouses and req.custom_destinations and req.custom_batches and req.custom_routes and req.custom_demand:
        products = req.custom_products
        warehouses = req.custom_warehouses
        destinations = req.custom_destinations
        batches = req.custom_batches
        routes = req.custom_routes
        demand = req.custom_demand
    else:
        products, warehouses, destinations, batches, routes, demand = get_dataset_bundle(
            req.data_source, req.planning_horizon_days
        )

    baseline_plan = run_baseline_allocation(
        products=products,
        warehouses=warehouses,
        destinations=destinations,
        batches=batches,
        routes=routes,
        demand_records=demand,
        planning_horizon_days=req.planning_horizon_days
    )
    validate_plan_invariants(baseline_plan, products, warehouses, destinations, batches, routes, demand)
    RUNS_STORE[baseline_plan.run_id] = baseline_plan

    optimized_plan = run_ortools_optimization(
        products=products,
        warehouses=warehouses,
        destinations=destinations,
        batches=batches,
        routes=routes,
        demand_records=demand,
        planning_horizon_days=req.planning_horizon_days
    )
    validate_plan_invariants(optimized_plan, products, warehouses, destinations, batches, routes, demand)
    RUNS_STORE[optimized_plan.run_id] = optimized_plan

    return compare_plans(baseline_plan, optimized_plan)


@app.get("/api/runs/{run_id}")
def get_run(run_id: str):
    if run_id not in RUNS_STORE:
        raise HTTPException(status_code=404, detail=f"Run '{run_id}' not found.")
    return RUNS_STORE[run_id]


@app.get("/api/export/{run_id}")
def export_plan_csv(run_id: str):
    """
    Exports a distribution plan as a structured, RFC-4180 compliant CSV.
    """
    if run_id not in RUNS_STORE:
        raise HTTPException(status_code=404, detail=f"Run '{run_id}' not found.")
    
    plan = RUNS_STORE[run_id]
    output = io.StringIO()
    writer = csv.writer(output)

    # Header
    writer.writerow([
        "Run ID",
        "Strategy",
        "Recommendation ID",
        "Product ID",
        "Product Name",
        "Source Warehouse ID",
        "Source Warehouse Name",
        "Destination ID",
        "Destination Name",
        "Batch ID",
        "Batch Days to Expiry",
        "Allocated Quantity",
        "Unit Transport Cost ($)",
        "Total Transport Cost ($)",
        "Destination Demand",
        "Rationale",
        "Constraints Honored"
    ])

    for r in plan.recommendations:
        writer.writerow([
            plan.run_id,
            plan.strategy,
            r.recommendation_id,
            r.product_id,
            r.product_name,
            r.source_warehouse_id,
            r.source_warehouse_name,
            r.destination_id,
            r.destination_name,
            r.batch_id,
            r.batch_days_to_expiry,
            r.allocated_quantity,
            f"{r.unit_transport_cost:.2f}",
            f"{r.total_transport_cost:.2f}",
            r.destination_demand,
            r.rationale,
            "; ".join(r.constraints_honored)
        ])

    csv_content = output.getvalue()
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename=supplysync_distribution_{run_id}.csv"
        }
    )
