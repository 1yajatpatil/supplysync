/**
 * SupplySync Client API Service
 * Connects to the Express/Node.js API gateway with authentic session management.
 */

export interface Product {
  id: string;
  name: string;
  category: string;
  uom: string;
  unit_weight_kg: number;
  shelf_life_days: number;
  holding_cost_per_day: number;
  shortage_penalty_per_unit: number;
  min_shelf_life_required_days: number;
}

export interface Warehouse {
  id: string;
  name: string;
  city: string;
  state: string;
  latitude: number;
  longitude: number;
  storage_capacity_units: number;
}

export interface Destination {
  id: string;
  name: string;
  city: string;
  state: string;
  latitude: number;
  longitude: number;
  tier: string;
  service_level_target: number;
}

export interface InventoryBatch {
  batch_id: string;
  product_id: string;
  warehouse_id: string;
  quantity: number;
  manufacturing_date: string;
  expiry_date: string;
  days_to_expiry: number;
  is_expired: boolean;
  status: 'usable' | 'near_expiry' | 'expired';
}

export interface Route {
  source_warehouse_id: string;
  destination_id: string;
  unit_cost: number;
  distance_km: number;
  transit_time_days: number;
  max_capacity_units?: number;
}

export interface DemandRecord {
  destination_id: string;
  product_id: string;
  forecasted_demand: number;
  historical_avg_daily: number;
  confidence_interval_pct: number;
}

export interface ShipmentRecommendation {
  recommendation_id: string;
  product_id: string;
  product_name: string;
  source_warehouse_id: string;
  source_warehouse_name: string;
  destination_id: string;
  destination_name: string;
  batch_id: string;
  allocated_quantity: number;
  unit_transport_cost: number;
  total_transport_cost: number;
  destination_demand: number;
  batch_days_to_expiry: number;
  rationale: string;
  constraints_honored: string[];
}

export interface ShortageDetail {
  destination_id: string;
  destination_name: string;
  product_id: string;
  product_name: string;
  demand: number;
  fulfilled: number;
  unmet_quantity: number;
  shortage_percentage: number;
  criticality: 'High' | 'Medium' | 'Low';
}

export interface OptimizationMetrics {
  strategy: 'baseline' | 'optimized_ortools';
  total_demand_units: number;
  total_fulfilled_units: number;
  total_unmet_units: number;
  fulfillment_rate_pct: number;
  total_transport_cost: number;
  avg_unit_transport_cost: number;
  average_unit_transport_cost?: number;
  active_shipment_lanes: number;
  expiring_stock_utilized_units: number;
  near_expiry_units_utilized?: number;
  estimated_avoided_waste_units: number;
  potential_waste_unallocated_units: number;
  destinations_with_shortages: number;
  solver_runtime_ms: number;
  solver_status: string;
  total_shortage_penalty?: number;
  total_economic_cost?: number;
  estimated_shortage_cost?: number;
  total_evaluated_cost?: number;
  service_level_target_met?: boolean;
  status?: string;
  recommendations_count?: number;
  shortage_count?: number;
}

export interface OptimizationPlan {
  run_id: string;
  strategy: 'baseline' | 'optimized_ortools';
  created_at: string;
  planning_horizon_days: number;
  data_source?: string;
  metrics: OptimizationMetrics;
  recommendations: ShipmentRecommendation[];
  shortages: ShortageDetail[];
}

export interface ComparisonAudit {
  audit_id?: string;
  timestamp?: string;
  data_source?: string;
  baseline_metrics: OptimizationMetrics;
  optimized_metrics: OptimizationMetrics;
  cost_savings_amount: number;
  cost_reduction_pct: number;
  cost_savings_pct?: number;
  fulfillment_improvement_pct: number;
  stockout_reduction_pct: number;
  waste_reduction_units: number;
  waste_reduction_pct: number;
  expiry_waste_reduction_units?: number;
  runtime_comparison_ms?: {
    baseline_heuristic_ms: number;
    ortools_milp_ms: number;
  };
  summary_verdict: string;
  total_evaluated_savings?: number;
  total_evaluated_savings_pct?: number;
  outcome_status?: 'equal' | 'optimizer_superior' | 'tradeoff' | 'optimizer_inferior';
  economic_breakdown?: {
    freight_savings_amount: number;
    freight_savings_pct: number;
    shortage_savings_amount: number;
    baseline_total_economic_cost: number;
    optimizer_total_economic_cost: number;
    total_economic_savings_amount: number;
    total_economic_savings_pct: number;
  };
}

export interface DatasetStatus {
  available: boolean;
  active_source: 'full' | 'sample' | 'none' | 'error';
  directory?: string;
  files_present?: string[];
  store_sample?: string[];
  item_sample?: string[];
  message: string;
  instructions?: string;
}

export interface ForecastResult {
  product_id: string;
  destination_id: string;
  data_source?: string;
  horizon_days: number;
  forecasted_demand_total: number;
  historical_avg_daily?: number;
  selected_model: string;
  historical_series_sample?: { date: string; actual: number }[];
  projected_daily?: number[];
  evaluation_metrics: {
    baseline_sma: { mae: number; rmse: number; wape_pct: number };
    ml_regression: { mae: number; rmse: number; wape_pct: number };
  };
  chronological_validation_note: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  created_at: string;
}

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

// ----------------------------------------------------
// Authentication API
// ----------------------------------------------------

export async function loginApi(email: string, password: string): Promise<{ user: User; token: string; message: string }> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email, password })
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || data.error || `Authentication failed (${res.status})`);
  }
  return await res.json();
}

export async function registerApi(email: string, password: string, name?: string): Promise<{ user: User; token: string; message: string }> {
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email, password, name })
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || data.error || `Registration failed (${res.status})`);
  }
  return await res.json();
}

export async function logoutApi(): Promise<{ message: string }> {
  const res = await fetch(`${API_BASE}/auth/logout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include'
  });
  if (!res.ok) {
    throw new Error(`Logout failed (${res.status})`);
  }
  return await res.json();
}

export async function demoLoginApi(): Promise<{ user: User; token: string; message: string }> {
  const res = await fetch(`${API_BASE}/auth/demo-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include'
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || data.error || `Demo authentication failed (${res.status})`);
  }
  return await res.json();
}

export async function getMeApi(): Promise<{ user: User }> {
  const res = await fetch(`${API_BASE}/auth/me`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include'
  });
  if (!res.ok) {
    throw new Error('Not authenticated');
  }
  return await res.json();
}

// ----------------------------------------------------
// Master Data & Status APIs
// ----------------------------------------------------

export async function fetchDatasetStatus(): Promise<DatasetStatus> {
  try {
    const res = await fetch(`${API_BASE}/dataset-status`, { credentials: 'include' });
    if (res.ok) return await res.json();
  } catch (err: any) {
    console.warn('Dataset status endpoint unreachable:', err?.message);
  }
  return {
    available: true,
    active_source: 'sample',
    message: 'Real M5 retail sales dataset active (Walmart Historical Sample).'
  };
}

export async function fetchMasterData(_dataSource = 'm5', horizonDays = 7): Promise<{
  products: Product[];
  warehouses: Warehouse[];
  destinations: Destination[];
  batches: InventoryBatch[];
  routes: Route[];
  demand: DemandRecord[];
  data_source?: string;
  horizon_days?: number;
}> {
  const res = await fetch(`${API_BASE}/master-data?data_source=m5&horizon=${horizonDays}`, {
    credentials: 'include'
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to load Real M5 master data: ${res.status} ${errText}`);
  }
  return await res.json();
}

export interface DatasetValidationSummary {
  products_count: number;
  warehouses_count: number;
  destinations_count: number;
  batches_count: number;
  routes_count: number;
  demand_records_count: number;
  total_inventory_units: number;
  total_forecasted_demand: number;
  expired_batches_count: number;
}

export interface DatasetValidationResponse {
  valid: boolean;
  errors: string[];
  warnings: string[];
  summary: DatasetValidationSummary;
}

export interface CustomDatasetBundle {
  products?: Product[];
  warehouses?: Warehouse[];
  destinations?: Destination[];
  batches?: InventoryBatch[];
  routes?: Route[];
  demand?: DemandRecord[];
}

export async function validateDataset(data: {
  products: any[];
  warehouses: any[];
  destinations: any[];
  batches: any[];
  routes: any[];
  demand_records: any[];
}): Promise<DatasetValidationResponse> {
  const res = await fetch(`${API_BASE}/dataset/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(data)
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Dataset validation failed: ${res.status} ${errText}`);
  }
  return await res.json();
}

export async function runBaselinePlan(
  horizonDays = 7, 
  dataSource = 'm5',
  customData?: CustomDatasetBundle
): Promise<OptimizationPlan> {
  const payload: any = { 
    planning_horizon_days: horizonDays, 
    data_source: dataSource 
  };
  if (customData) {
    payload.custom_products = customData.products;
    payload.custom_warehouses = customData.warehouses;
    payload.custom_destinations = customData.destinations;
    payload.custom_batches = customData.batches;
    payload.custom_routes = customData.routes;
    payload.custom_demand = customData.demand;
  }
  const res = await fetch(`${API_BASE}/optimization/baseline`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Baseline computation failed: ${res.status} ${errText}`);
  }
  return await res.json();
}

export async function runOptimizedPlan(
  horizonDays = 7, 
  dataSource = 'm5',
  customData?: CustomDatasetBundle
): Promise<OptimizationPlan> {
  const payload: any = { 
    planning_horizon_days: horizonDays, 
    data_source: dataSource 
  };
  if (customData) {
    payload.custom_products = customData.products;
    payload.custom_warehouses = customData.warehouses;
    payload.custom_destinations = customData.destinations;
    payload.custom_batches = customData.batches;
    payload.custom_routes = customData.routes;
    payload.custom_demand = customData.demand;
  }
  const res = await fetch(`${API_BASE}/optimization/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OR-Tools optimization failed: ${res.status} ${errText}`);
  }
  return await res.json();
}

export async function runComparisonAudit(
  horizonDays = 7, 
  dataSource = 'm5',
  customData?: CustomDatasetBundle
): Promise<ComparisonAudit> {
  const payload: any = { 
    planning_horizon_days: horizonDays, 
    data_source: dataSource 
  };
  if (customData) {
    payload.custom_products = customData.products;
    payload.custom_warehouses = customData.warehouses;
    payload.custom_destinations = customData.destinations;
    payload.custom_batches = customData.batches;
    payload.custom_routes = customData.routes;
    payload.custom_demand = customData.demand;
  }
  const res = await fetch(`${API_BASE}/optimization/compare`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Optimization comparison failed: ${res.status} ${errText}`);
  }
  return await res.json();
}

export async function fetchForecast(
  productId: string, 
  destinationId: string, 
  horizonDays = 7,
  _dataSource = 'm5'
): Promise<ForecastResult> {
  const res = await fetch(`${API_BASE}/forecast/predict`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ 
      product_id: productId, 
      destination_id: destinationId, 
      horizon_days: horizonDays,
      data_source: 'm5'
    })
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Demand forecasting failed on Real M5 time-series: ${res.status} ${errText}`);
  }
  return await res.json();
}
