"""
SupplySync Data Models
Pydantic schemas for FMCG products, warehouses, destinations, inventory batches, routes, and optimization runs.
"""

from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from datetime import date


class Product(BaseModel):
    id: str = Field(..., description="Unique product identifier (e.g. PROD-001)")
    name: str = Field(..., description="Commercial product name")
    category: str = Field(..., description="FMCG category: Dairy, Packaged Food, Personal Care, Beverage, etc.")
    uom: str = Field("units", description="Unit of measurement (cases, units, kg)")
    unit_weight_kg: float = Field(1.0, description="Unit weight in kg for transport capacity calculations")
    shelf_life_days: int = Field(90, description="Total shelf life in days from production")
    holding_cost_per_day: float = Field(0.05, description="Daily holding cost per unit in warehouse")
    shortage_penalty_per_unit: float = Field(25.0, description="Penalty for unmet unit customer demand")
    min_shelf_life_required_days: int = Field(7, description="Minimum shelf life required upon arrival at retailer")


class Warehouse(BaseModel):
    id: str = Field(..., description="Unique warehouse identifier (e.g. WH-MUMBAI)")
    name: str = Field(..., description="Warehouse or regional distribution center name")
    city: str = Field(..., description="City or region location")
    state: str = Field(..., description="State")
    latitude: float = Field(..., description="Geographic latitude coordinate")
    longitude: float = Field(..., description="Geographic longitude coordinate")
    storage_capacity_units: int = Field(100000, description="Maximum unit capacity")


class Destination(BaseModel):
    id: str = Field(..., description="Unique destination identifier (e.g. DEST-PUNE)")
    name: str = Field(..., description="Distributor or retail cluster name")
    city: str = Field(..., description="City or district")
    state: str = Field(..., description="State")
    latitude: float = Field(..., description="Geographic latitude coordinate")
    longitude: float = Field(..., description="Geographic longitude coordinate")
    tier: str = Field("Tier-1", description="Customer tier: Tier-1, Tier-2, or Regional Supermarket")
    service_level_target: float = Field(0.95, description="Target SLA fulfillment rate (0.0 to 1.0)")


class InventoryBatch(BaseModel):
    batch_id: str = Field(..., description="Unique inventory batch ID")
    product_id: str = Field(..., description="Associated product ID")
    warehouse_id: str = Field(..., description="Holding warehouse ID")
    quantity: int = Field(..., description="Available physical unit quantity")
    manufacturing_date: str = Field(..., description="Batch manufacturing date (YYYY-MM-DD)")
    expiry_date: str = Field(..., description="Batch expiration date (YYYY-MM-DD)")
    days_to_expiry: int = Field(..., description="Remaining days until expiration from planning date")
    is_expired: bool = Field(False, description="Whether the batch is already past expiration")
    status: str = Field("usable", description="usable | near_expiry | expired")


class Route(BaseModel):
    source_warehouse_id: str = Field(..., description="Source warehouse ID")
    destination_id: str = Field(..., description="Target destination ID")
    unit_cost: float = Field(..., description="Transportation cost per unit along this route")
    distance_km: float = Field(..., description="Distance between origin and destination in km")
    transit_time_days: int = Field(1, description="Estimated transit time in days")
    max_capacity_units: Optional[int] = Field(None, description="Max unit throughput on this corridor")


class DemandRecord(BaseModel):
    destination_id: str = Field(..., description="Destination ID")
    product_id: str = Field(..., description="Product ID")
    forecasted_demand: int = Field(..., description="Estimated demand units for the planning horizon")
    historical_avg_daily: float = Field(..., description="Historical average daily consumption")
    confidence_interval_pct: float = Field(0.90, description="Forecast confidence interval")


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
    solver_runtime_ms: float
    solver_status: str


class OptimizationPlan(BaseModel):
    run_id: str
    strategy: str
    created_at: str
    planning_horizon_days: int
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
