"""
SupplySync Data Models
Pydantic schemas for FMCG products, warehouses, destinations, inventory batches, routes, and optimization runs.
"""

from typing import List, Optional, Dict, Any, Union
from pydantic import BaseModel, Field, model_validator
from datetime import date


class Product(BaseModel):
    id: str = Field(..., description="Unique product identifier (e.g. PROD-001)")
    name: str = Field(..., description="Commercial product name")
    category: str = Field("General", description="FMCG category: Dairy, Packaged Food, Personal Care, Beverage, etc.")
    uom: str = Field("units", description="Unit of measurement (cases, units, kg)")
    unit_weight_kg: float = Field(1.0, description="Unit weight in kg for transport capacity calculations")
    shelf_life_days: int = Field(90, description="Total shelf life in days from production")
    holding_cost_per_day: float = Field(0.05, description="Daily holding cost per unit in warehouse")
    shortage_penalty_per_unit: float = Field(25.0, description="Penalty for unmet unit customer demand")
    min_shelf_life_required_days: int = Field(7, description="Minimum shelf life required upon arrival at retailer")
    observed_sell_price: Optional[float] = Field(None, description="Observed M5 historical selling price ($/unit)")
    price_source: str = Field("configured", description="'real_m5' or 'configured'")
    estimated_margin_pct: Optional[float] = Field(0.25, description="Estimated retail margin ratio (0.25 = 25%)")
    waste_cost_per_unit: Optional[float] = Field(None, description="Estimated inventory loss per spoiled unit ($)")
    economic_note: str = Field(
        "Observed retail selling price from M5. Shortage penalties, holding costs, and margins are estimated economic assumptions.",
        description="Clarification of observed vs estimated figures"
    )

    @model_validator(mode="before")
    @classmethod
    def normalize_product(cls, data: Any) -> Any:
        if isinstance(data, dict):
            if "product_id" in data and "id" not in data:
                data["id"] = data["product_id"]
            if "unit_price" in data and "observed_sell_price" not in data:
                data["observed_sell_price"] = float(data["unit_price"])
        return data


class Warehouse(BaseModel):
    id: str = Field(..., description="Unique warehouse identifier (e.g. WH-MUMBAI)")
    name: str = Field(..., description="Warehouse or regional distribution center name")
    city: str = Field("Unknown", description="City or region location")
    state: str = Field("US", description="State")
    latitude: float = Field(0.0, description="Geographic latitude coordinate")
    longitude: float = Field(0.0, description="Geographic longitude coordinate")
    storage_capacity_units: int = Field(100000, description="Maximum unit capacity")

    @model_validator(mode="before")
    @classmethod
    def normalize_warehouse(cls, data: Any) -> Any:
        if isinstance(data, dict):
            if "warehouse_id" in data and "id" not in data:
                data["id"] = data["warehouse_id"]
            if "max_capacity" in data and "storage_capacity_units" not in data:
                data["storage_capacity_units"] = int(data["max_capacity"])
            elif "capacity" in data and "storage_capacity_units" not in data:
                data["storage_capacity_units"] = int(data["capacity"])
            if "location" in data and ("city" not in data or data.get("city") == "Unknown"):
                parts = str(data["location"]).split(",")
                data["city"] = parts[0].strip()
                if len(parts) > 1:
                    data["state"] = parts[1].strip()
        return data


class Destination(BaseModel):
    id: str = Field(..., description="Unique destination identifier (e.g. DEST-PUNE)")
    name: str = Field(..., description="Distributor or retail cluster name")
    city: str = Field("Unknown", description="City or district")
    state: str = Field("US", description="State")
    latitude: float = Field(0.0, description="Geographic latitude coordinate")
    longitude: float = Field(0.0, description="Geographic longitude coordinate")
    tier: str = Field("Tier-1", description="Customer tier: Tier-1, Tier-2, or Regional Supermarket")
    service_level_target: float = Field(0.95, description="Target SLA fulfillment rate (0.0 to 1.0)")

    @model_validator(mode="before")
    @classmethod
    def normalize_destination(cls, data: Any) -> Any:
        if isinstance(data, dict):
            if "destination_id" in data and "id" not in data:
                data["id"] = data["destination_id"]
            if "priority_tier" in data and "tier" not in data:
                data["tier"] = f"Tier-{data['priority_tier']}"
            if "location" in data and ("city" not in data or data.get("city") == "Unknown"):
                parts = str(data["location"]).split(",")
                data["city"] = parts[0].strip()
                if len(parts) > 1:
                    data["state"] = parts[1].strip()
        return data


class InventoryBatch(BaseModel):
    batch_id: str = Field(..., description="Unique inventory batch ID")
    product_id: str = Field(..., description="Associated product ID")
    warehouse_id: str = Field(..., description="Holding warehouse ID")
    quantity: int = Field(..., description="Available physical unit quantity")
    manufacturing_date: str = Field("2026-01-01", description="Batch manufacturing date (YYYY-MM-DD)")
    expiry_date: str = Field("2026-12-31", description="Batch expiration date (YYYY-MM-DD)")
    days_to_expiry: int = Field(90, description="Remaining days until expiration from planning date")
    is_expired: bool = Field(False, description="Whether the batch is already past expiration")
    status: str = Field("usable", description="usable | near_expiry | expired")

    @model_validator(mode="before")
    @classmethod
    def normalize_batch(cls, data: Any) -> Any:
        if isinstance(data, dict):
            if "available_quantity" in data and "quantity" not in data:
                data["quantity"] = int(data["available_quantity"])
            if "days_until_expiry" in data and "days_to_expiry" not in data:
                data["days_to_expiry"] = int(data["days_until_expiry"])
            if "days_to_expiry" in data:
                dte = int(data["days_to_expiry"])
                if dte <= 0:
                    data["is_expired"] = True
                    data["status"] = "expired"
                elif dte <= 15:
                    data["status"] = "near_expiry"
        return data


class Route(BaseModel):
    source_warehouse_id: str = Field(..., description="Source warehouse ID")
    destination_id: str = Field(..., description="Target destination ID")
    unit_cost: float = Field(..., description="Transportation cost per unit along this route")
    distance_km: float = Field(100.0, description="Distance between origin and destination in km")
    transit_time_days: int = Field(1, description="Estimated transit time in days")
    max_capacity_units: Optional[int] = Field(None, description="Max unit throughput on this corridor")
    max_capacity_kg: Optional[float] = Field(None, description="Max weight capacity in kg on this corridor")

    @model_validator(mode="before")
    @classmethod
    def normalize_route(cls, data: Any) -> Any:
        if isinstance(data, dict):
            if "warehouse_id" in data and "source_warehouse_id" not in data:
                data["source_warehouse_id"] = data["warehouse_id"]
            if "dest_id" in data and "destination_id" not in data:
                data["destination_id"] = data["dest_id"]
            if "transport_cost_per_unit" in data and "unit_cost" not in data:
                data["unit_cost"] = float(data["transport_cost_per_unit"])
            elif "transportation_cost" in data and "unit_cost" not in data:
                data["unit_cost"] = float(data["transportation_cost"])
            elif "cost_per_unit" in data and "unit_cost" not in data:
                data["unit_cost"] = float(data["cost_per_unit"])
            if "capacity_units" in data and "max_capacity_units" not in data:
                data["max_capacity_units"] = int(data["capacity_units"])
        return data


class DemandRecord(BaseModel):
    destination_id: str = Field(..., description="Destination ID")
    product_id: str = Field(..., description="Product ID")
    forecasted_demand: int = Field(..., description="Estimated demand units for the planning horizon")
    historical_avg_daily: float = Field(1.0, description="Historical average daily consumption")
    confidence_interval_pct: float = Field(0.90, description="Forecast confidence interval")

    @model_validator(mode="before")
    @classmethod
    def normalize_demand(cls, data: Any) -> Any:
        if isinstance(data, dict):
            if "quantity" in data and "forecasted_demand" not in data:
                data["forecasted_demand"] = int(data["quantity"])
            elif "demand" in data and "forecasted_demand" not in data:
                data["forecasted_demand"] = int(data["demand"])
            if "historical_avg_daily" not in data:
                fd = float(data.get("forecasted_demand", 7))
                data["historical_avg_daily"] = max(0.1, round(fd / 7.0, 2))
        return data


class ShipmentRecommendation(BaseModel):
    recommendation_id: str
    product_id: str
    product_name: str
    source_warehouse_id: str
    source_warehouse_name: str
    destination_id: str
    destination_name: str
    batch_id: str
    allocated_quantity: int
    unit_transport_cost: float
    total_transport_cost: float
    destination_demand: int
    batch_days_to_expiry: int
    rationale: str
    total_weight_kg: float = Field(0.0, description="Total physical shipment weight in kg")
    observed_unit_price: Optional[float] = Field(None, description="Observed M5 selling price ($/unit)")
    constraints_honored: List[str] = Field(default_factory=list)


class ShortageDetail(BaseModel):
    destination_id: str
    destination_name: str
    product_id: str
    product_name: str
    demand: int
    fulfilled: int
    unmet_quantity: int
    shortage_percentage: float
    criticality: str  # 'High' | 'Medium' | 'Low'


class OptimizationMetrics(BaseModel):
    strategy: str  # 'baseline' | 'optimized_ortools'
    total_demand_units: int
    total_fulfilled_units: int
    total_unmet_units: int
    fulfillment_rate_pct: float
    total_transport_cost: float
    avg_unit_transport_cost: float
    active_shipment_lanes: int
    expiring_stock_utilized_units: int
    estimated_avoided_waste_units: int
    potential_waste_unallocated_units: int
    destinations_with_shortages: int
    total_weight_shipped_kg: float = Field(0.0, description="Total weight of all allocated shipments in kg")
    estimated_shortage_cost: float = Field(0.0, description="Estimated economic penalty of unmet customer demand ($)")
    observed_sales_revenue: Optional[float] = Field(None, description="Observed retail sales revenue from M5 pricing ($)")
    economic_assumptions_note: str = Field(
        "Transportation costs reflect configured freight tariffs. Shortage penalties and holding costs are estimated commercial parameters.",
        description="Clarification of observed vs estimated figures"
    )
    solver_runtime_ms: float
    solver_status: str
    total_evaluated_cost: Optional[float] = Field(None, description="True economic cost: actual transport cost + estimated shortage penalty ($)")
    solver_objective_value: Optional[float] = Field(None, description="Raw mathematical solver objective value from Phase 1 economic minimization ($)")
    best_bound: Optional[float] = Field(None, description="Best dual bound from branch-and-cut solver ($)")
    mip_gap: Optional[float] = Field(None, description="Relative optimality gap: abs(obj - best_bound) / abs(obj)")
    lexicographic_phase: Optional[str] = Field(None, description="Lexicographic optimization phase reached ('phase1_economic_only' or 'phase2_fefo_optimal')")


class OptimizationPlan(BaseModel):
    run_id: str
    strategy: str
    created_at: str = Field(default="2026-10-25T00:00:00Z")
    planning_horizon_days: int
    data_source: str = "m5"
    metrics: OptimizationMetrics
    recommendations: List[ShipmentRecommendation]
    shortages: List[ShortageDetail]


class ComparisonAudit(BaseModel):
    baseline_metrics: OptimizationMetrics
    optimized_metrics: OptimizationMetrics
    cost_savings_amount: float
    cost_reduction_pct: float
    fulfillment_improvement_pct: float
    stockout_reduction_pct: float
    waste_reduction_units: int
    waste_reduction_pct: float
    runtime_comparison_ms: Dict[str, float]
    summary_verdict: str
    total_evaluated_savings: Optional[float] = Field(None, description="Net savings in total evaluated economic cost (freight + shortage penalties) ($)")
    total_evaluated_savings_pct: Optional[float] = Field(None, description="Percentage reduction in total evaluated economic cost (%)")
    outcome_status: str = Field("equal", description="'equal' | 'optimizer_superior' | 'tradeoff' | 'optimizer_inferior'")
    economic_breakdown: Optional[Dict[str, float]] = Field(None, description="Detailed side-by-side cost reconciliation")

