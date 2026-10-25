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
from pydantic import BaseModel, model_validator

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
from .validator import validate_plan_invariants, validate_input_dataset
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


def get_dataset_bundle(data_source: str = "m5", horizon_days: int = 7):
    """
    Retrieves the complete data network for the Real M5 retail sales dataset and planning horizon.
    Generates genuine demand forecasts scaled to the requested horizon (7D, 14D, 30D).
    Synthetic data is rejected; Real M5 Kaggle data is the exclusive data source.
    """
    if data_source.lower() in ("synthetic", "fmcg", "demo"):
        raise HTTPException(
            status_code=400,
            detail="Synthetic FMCG data has been deprecated and removed. SupplySync operates exclusively on Real M5 retail sales data."
        )

    m5_status = get_m5_status()
    if not m5_status.get("available", False):
        missing = [f for f in ("sales_train_validation.csv", "calendar.csv", "sell_prices.csv") if f not in m5_status.get("files_present", [])]
        raise HTTPException(
            status_code=503,
            detail=f"Required M5 dataset files (sales_train_validation.csv, calendar.csv, sell_prices.csv) are missing or unreadable in data/m5: {missing}. Please provide required M5 dataset files."
        )

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


@app.get("/health")
def health_check():
    m5_info = get_m5_status()
    return {
        "status": "healthy",
        "service": "SupplySync Optimization & Forecasting Engine",
        "solver": "Google OR-Tools SCIP MILP",
        "dataset": "Real M5 Kaggle Retail Data",
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
    data_source: str = Query("m5", description="Dataset source: 'm5' (exclusive)"),
    horizon: int = Query(7, description="Planning horizon days (7, 14, 30)")
):
    """
    Returns the complete Real M5 master dataset including products, warehouses,
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
        "data_source": "m5",
        "horizon_days": horizon
    }


class ForecastRequest(BaseModel):
    product_id: str
    destination_id: str
    horizon_days: int = 7
    data_source: str = "m5"


@app.post("/api/forecast")
def get_forecast(req: ForecastRequest):
    """
    Evaluates chronological demand forecasting models on Real M5 sales records and returns projections.
    """
    if req.data_source.lower() in ("synthetic", "fmcg", "demo"):
        raise HTTPException(
            status_code=400,
            detail="Synthetic demand forecasting is deprecated. Real M5 data is the exclusive source."
        )
    return evaluate_forecasting_models(
        product_id=req.product_id,
        destination_id=req.destination_id,
        horizon_days=req.horizon_days,
        data_source="m5"
    )


class DatasetValidationRequest(BaseModel):
    products: List[Dict[str, Any]] = []
    warehouses: List[Dict[str, Any]] = []
    destinations: List[Dict[str, Any]] = []
    batches: List[Dict[str, Any]] = []
    routes: List[Dict[str, Any]] = []
    demand_records: List[Dict[str, Any]] = []


@app.post("/api/dataset/validate")
def validate_dataset_endpoint(req: DatasetValidationRequest):
    """
    Performs authoritative pre-optimization data validation on uploaded/candidate datasets.
    """
    return validate_input_dataset(
        products=req.products,
        warehouses=req.warehouses,
        destinations=req.destinations,
        batches=req.batches,
        routes=req.routes,
        demand_records=req.demand_records
    )


class OptimizationRequest(BaseModel):
    planning_horizon_days: int = 7
    data_source: str = "m5"
    custom_products: Optional[List[Product]] = None
    custom_warehouses: Optional[List[Warehouse]] = None
    custom_destinations: Optional[List[Destination]] = None
    custom_batches: Optional[List[InventoryBatch]] = None
    custom_routes: Optional[List[Route]] = None
    custom_demand: Optional[List[DemandRecord]] = None
    custom_demand_records: Optional[List[DemandRecord]] = None

    @model_validator(mode="before")
    @classmethod
    def populate_planning_horizon(cls, data: Any) -> Any:
        if isinstance(data, dict):
            if "custom_demand_records" in data and ("custom_demand" not in data or data["custom_demand"] is None):
                data["custom_demand"] = data["custom_demand_records"]
            if "planning_horizon_days" not in data or data["planning_horizon_days"] is None:
                if "horizon_days" in data and data["horizon_days"] is not None:
                    data["planning_horizon_days"] = int(data["horizon_days"])
                elif "horizon" in data and data["horizon"] is not None:
                    data["planning_horizon_days"] = int(data["horizon"])
            elif isinstance(data.get("planning_horizon_days"), str):
                data["planning_horizon_days"] = int(data["planning_horizon_days"])
        return data


def resolve_request_dataset(req: OptimizationRequest):
    """
    Authoritatively resolves the dataset for an optimization/baseline/comparison request.
    Strictly distinguishes custom company data from the bundled Walmart M5 sample.
    Never falls back to M5 or demo data when custom source is requested.
    """
    source_lower = (req.data_source or "m5").lower()

    if source_lower in ("synthetic", "fmcg", "demo"):
        raise HTTPException(
            status_code=400,
            detail="Synthetic demo data source is deprecated. Choose 'uploaded' for custom company data or 'm5' for the Walmart sample."
        )

    if source_lower in ("uploaded", "custom"):
        # Custom dataset requested - verify all 6 entity sets are present
        missing = []
        if not req.custom_products or len(req.custom_products) == 0:
            missing.append("products")
        if not req.custom_warehouses or len(req.custom_warehouses) == 0:
            missing.append("warehouses")
        if not req.custom_destinations or len(req.custom_destinations) == 0:
            missing.append("destinations")
        if not req.custom_batches or len(req.custom_batches) == 0:
            missing.append("batches")
        if not req.custom_routes or len(req.custom_routes) == 0:
            missing.append("routes")
        if not req.custom_demand or len(req.custom_demand) == 0:
            missing.append("demand")

        if missing:
            raise HTTPException(
                status_code=400,
                detail=f"Incomplete custom company dataset: missing required entities ({', '.join(missing)}). SupplySync will not silently fall back to sample data."
            )

        return (
            req.custom_products,
            req.custom_warehouses,
            req.custom_destinations,
            req.custom_batches,
            req.custom_routes,
            req.custom_demand
        )

    # Otherwise load bundled M5 sample
    return get_dataset_bundle(req.data_source, req.planning_horizon_days)


@app.post("/api/baseline", response_model=OptimizationPlan)
def run_baseline(req: OptimizationRequest):
    """
    Executes the greedy demand-priority baseline distribution strategy and validates invariants.
    """
    products, warehouses, destinations, batches, routes, demand = resolve_request_dataset(req)

    plan = run_baseline_allocation(
        products=products,
        warehouses=warehouses,
        destinations=destinations,
        batches=batches,
        routes=routes,
        demand_records=demand,
        planning_horizon_days=req.planning_horizon_days,
        data_source=req.data_source
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
    products, warehouses, destinations, batches, routes, demand = resolve_request_dataset(req)

    try:
        plan = run_ortools_optimization(
            products=products,
            warehouses=warehouses,
            destinations=destinations,
            batches=batches,
            routes=routes,
            demand_records=demand,
            planning_horizon_days=req.planning_horizon_days,
            data_source=req.data_source
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
    products, warehouses, destinations, batches, routes, demand = resolve_request_dataset(req)

    try:
        baseline_plan = run_baseline_allocation(
            products=products,
            warehouses=warehouses,
            destinations=destinations,
            batches=batches,
            routes=routes,
            demand_records=demand,
            planning_horizon_days=req.planning_horizon_days,
            data_source=req.data_source
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
            planning_horizon_days=req.planning_horizon_days,
            data_source=req.data_source
        )
        validate_plan_invariants(optimized_plan, products, warehouses, destinations, batches, routes, demand)
        RUNS_STORE[optimized_plan.run_id] = optimized_plan

        return compare_plans(baseline_plan, optimized_plan)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Comparison failed: {str(e)}")


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
