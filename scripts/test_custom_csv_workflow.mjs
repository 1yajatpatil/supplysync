import assert from 'node:assert/strict';
import test from 'node:test';

const GATEWAY_URL = 'http://localhost:5001';
const ENGINE_URL = 'http://localhost:8000';

let authHeaders = {};

// Clean custom enterprise dataset with non-demo enterprise identifiers
const enterpriseCustomDataset = {
  products: [
    { id: "SKU_BEV_001", name: "Sparkling Lemon Water 500ml", category: "Beverages", uom: "cases", unit_weight_kg: 6.5, shelf_life_days: 180, holding_cost_per_day: 0.04, shortage_penalty_per_unit: 22.0, min_shelf_life_required_days: 14 },
    { id: "SKU_DAIRY_002", name: "Organic Low-Fat Milk 1L", category: "Dairy", uom: "units", unit_weight_kg: 1.05, shelf_life_days: 18, holding_cost_per_day: 0.08, shortage_penalty_per_unit: 28.0, min_shelf_life_required_days: 5 },
    { id: "SKU_SNACK_003", name: "Roasted Almonds 200g", category: "Snacks", uom: "units", unit_weight_kg: 0.25, shelf_life_days: 365, holding_cost_per_day: 0.02, shortage_penalty_per_unit: 15.0, min_shelf_life_required_days: 30 }
  ],
  warehouses: [
    { id: "DC_DALLAS_NORTH", name: "Dallas Regional Fulfillment Hub", city: "Dallas", state: "TX", latitude: 32.7767, longitude: -96.7970, storage_capacity_units: 80000 },
    { id: "DC_AUSTIN_CENTRAL", name: "Austin Metro Distribution Center", city: "Austin", state: "TX", latitude: 30.2672, longitude: -97.7431, storage_capacity_units: 60000 }
  ],
  destinations: [
    { id: "STORE_HOUSTON_01", name: "Supercenter Houston Galleria", city: "Houston", state: "TX", latitude: 29.7604, longitude: -95.3698, tier: "Tier-1", service_level_target: 0.98 },
    { id: "STORE_SANANTONIO_02", name: "San Antonio Market Square", city: "San Antonio", state: "TX", latitude: 29.4241, longitude: -98.4936, tier: "Tier-2", service_level_target: 0.92 }
  ],
  batches: [
    { batch_id: "LOT-BEV-2026-01", product_id: "SKU_BEV_001", warehouse_id: "DC_DALLAS_NORTH", quantity: 500, days_to_expiry: 120, manufacturing_date: "2026-09-01", expiry_date: "2027-01-01" },
    { batch_id: "LOT-BEV-2026-02", product_id: "SKU_BEV_001", warehouse_id: "DC_AUSTIN_CENTRAL", quantity: 400, days_to_expiry: 90, manufacturing_date: "2026-08-15", expiry_date: "2026-11-15" },
    { batch_id: "LOT-DAIRY-FEFO-01", product_id: "SKU_DAIRY_002", warehouse_id: "DC_DALLAS_NORTH", quantity: 300, days_to_expiry: 8, manufacturing_date: "2026-10-18", expiry_date: "2026-10-26" },
    { batch_id: "LOT-DAIRY-NEW-02", product_id: "SKU_DAIRY_002", warehouse_id: "DC_DALLAS_NORTH", quantity: 600, days_to_expiry: 16, manufacturing_date: "2026-10-22", expiry_date: "2026-11-03" },
    { batch_id: "LOT-SNACK-2026-01", product_id: "SKU_SNACK_003", warehouse_id: "DC_AUSTIN_CENTRAL", quantity: 1000, days_to_expiry: 300, manufacturing_date: "2026-06-01", expiry_date: "2027-04-01" }
  ],
  routes: [
    { source_warehouse_id: "DC_DALLAS_NORTH", destination_id: "STORE_HOUSTON_01", unit_cost: 2.10, distance_km: 385.0, transit_time_days: 1, max_capacity_units: 700, max_capacity_kg: 5000.0 },
    { source_warehouse_id: "DC_DALLAS_NORTH", destination_id: "STORE_SANANTONIO_02", unit_cost: 2.80, distance_km: 440.0, transit_time_days: 1, max_capacity_units: 600, max_capacity_kg: 4000.0 },
    { source_warehouse_id: "DC_AUSTIN_CENTRAL", destination_id: "STORE_HOUSTON_01", unit_cost: 1.60, distance_km: 260.0, transit_time_days: 1, max_capacity_units: 800, max_capacity_kg: 6000.0 },
    { source_warehouse_id: "DC_AUSTIN_CENTRAL", destination_id: "STORE_SANANTONIO_02", unit_cost: 1.10, distance_km: 130.0, transit_time_days: 1, max_capacity_units: 900, max_capacity_kg: 6000.0 }
  ],
  demand_records: [
    { destination_id: "STORE_HOUSTON_01", product_id: "SKU_BEV_001", forecasted_demand: 250, historical_avg_daily: 35.7, confidence_interval_pct: 0.95 },
    { destination_id: "STORE_HOUSTON_01", product_id: "SKU_DAIRY_002", forecasted_demand: 320, historical_avg_daily: 45.7, confidence_interval_pct: 0.94 },
    { destination_id: "STORE_SANANTONIO_02", product_id: "SKU_BEV_001", forecasted_demand: 180, historical_avg_daily: 25.7, confidence_interval_pct: 0.92 },
    { destination_id: "STORE_SANANTONIO_02", product_id: "SKU_SNACK_003", forecasted_demand: 400, historical_avg_daily: 57.1, confidence_interval_pct: 0.96 }
  ]
};

test('Custom CSV Workflow: Authenticate as Evaluator', async () => {
  const loginRes = await fetch(`${GATEWAY_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'evaluator@supplysync.io', password: 'SupplySync2026!' })
  });
  assert.equal(loginRes.status, 200);
  const data = await loginRes.json();
  authHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${data.token}`
  };
});

test('Custom CSV Workflow: Valid Enterprise Dataset Passes Pre-Solve Validation', async () => {
  const res = await fetch(`${GATEWAY_URL}/api/dataset/validate`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify(enterpriseCustomDataset)
  });
  assert.equal(res.status, 200);
  const val = await res.json();
  assert.equal(val.valid, true, `Expected valid, got errors: ${val.errors.join('; ')}`);
  assert.equal(val.summary.products_count, 3);
  assert.equal(val.summary.warehouses_count, 2);
  assert.equal(val.summary.destinations_count, 2);
  assert.equal(val.summary.batches_count, 5);
  assert.equal(val.summary.routes_count, 4);
  assert.equal(val.summary.total_inventory_units, 2800);
  assert.equal(val.summary.total_forecasted_demand, 1150);
});

test('Custom CSV Workflow: Rejects Missing Required Columns & Bad References', async () => {
  const brokenDataset = {
    ...enterpriseCustomDataset,
    batches: [
      { batch_id: "BAD_BATCH_1", product_id: "NONEXISTENT_SKU", warehouse_id: "DC_DALLAS_NORTH", quantity: 100, days_to_expiry: 30 },
      { batch_id: "BAD_BATCH_2", product_id: "SKU_BEV_001", warehouse_id: "NONEXISTENT_DC", quantity: -20, days_to_expiry: 10 }
    ],
    routes: [
      { source_warehouse_id: "DC_DALLAS_NORTH", destination_id: "NONEXISTENT_DEST", unit_cost: -0.50 }
    ]
  };

  const res = await fetch(`${GATEWAY_URL}/api/dataset/validate`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify(brokenDataset)
  });
  assert.equal(res.status, 200);
  const val = await res.json();
  assert.equal(val.valid, false);
  const errorText = val.errors.join(' ');
  assert.match(errorText, /NONEXISTENT_SKU/);
  assert.match(errorText, /NONEXISTENT_DC/);
  assert.match(errorText, /NONEXISTENT_DEST/);
  assert.match(errorText, /negative/i);
  assert.match(errorText, /transportation cost/i);
});

test('Custom CSV Workflow: Uploaded Data Reaches OR-Tools and Does Not Fall Back to M5', async () => {
  const payload = {
    planning_horizon_days: 7,
    data_source: 'uploaded',
    custom_products: enterpriseCustomDataset.products,
    custom_warehouses: enterpriseCustomDataset.warehouses,
    custom_destinations: enterpriseCustomDataset.destinations,
    custom_batches: enterpriseCustomDataset.batches,
    custom_routes: enterpriseCustomDataset.routes,
    custom_demand_records: enterpriseCustomDataset.demand_records
  };

  const res = await fetch(`${GATEWAY_URL}/api/optimization/run`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify(payload)
  });
  assert.equal(res.status, 200);
  const plan = await res.json();

  assert.equal(plan.data_source, 'uploaded');
  assert.equal(plan.strategy, 'optimized_ortools');
  assert.equal(plan.metrics.total_demand_units, 1150);
  assert.ok(plan.recommendations.length > 0);

  // Verify allocations strictly use enterprise identifiers, NOT M5 IDs
  const validSkus = new Set(["SKU_BEV_001", "SKU_DAIRY_002", "SKU_SNACK_003"]);
  const validDcs = new Set(["DC_DALLAS_NORTH", "DC_AUSTIN_CENTRAL"]);
  const validDests = new Set(["STORE_HOUSTON_01", "STORE_SANANTONIO_02"]);

  for (const rec of plan.recommendations) {
    assert.ok(validSkus.has(rec.product_id), `Unexpected product: ${rec.product_id}`);
    assert.ok(validDcs.has(rec.source_warehouse_id), `Unexpected origin DC: ${rec.source_warehouse_id}`);
    assert.ok(validDests.has(rec.destination_id), `Unexpected destination: ${rec.destination_id}`);
    assert.ok(!rec.product_id.includes("FOODS"), "Should not contain M5 food IDs");
    assert.ok(!rec.source_warehouse_id.includes("PACIFIC"), "Should not contain M5 warehouse IDs");
  }
});

test('Custom CSV Workflow: Incomplete Custom Dataset is Rejected with HTTP 400 (No Silent Fallback)', async () => {
  // Send custom data source with missing custom_batches
  const incompletePayload = {
    planning_horizon_days: 7,
    data_source: 'uploaded',
    custom_products: enterpriseCustomDataset.products,
    custom_warehouses: enterpriseCustomDataset.warehouses,
    custom_destinations: enterpriseCustomDataset.destinations,
    // custom_batches omitted!
    custom_routes: enterpriseCustomDataset.routes,
    custom_demand_records: enterpriseCustomDataset.demand_records
  };

  const res = await fetch(`${GATEWAY_URL}/api/optimization/run`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify(incompletePayload)
  });
  assert.equal(res.status, 502); // Express proxies 400 from engine as 502 with details, or engine directly returns 400
  const errData = await res.json();
  const text = JSON.stringify(errData);
  assert.match(text, /Incomplete custom company dataset/i, 'Must explicitly reject incomplete custom dataset and refuse silent fallback');
});

test('Custom CSV Workflow: Two-Phase FEFO Prioritization Verified on Custom Batches', async () => {
  // Store Houston needs 320 units of SKU_DAIRY_002.
  // Dallas DC has two batches: LOT-DAIRY-FEFO-01 (300 units, 8 days left) and LOT-DAIRY-NEW-02 (600 units, 16 days left).
  // The FEFO optimizer must prioritize all 300 units of the near-expiry batch before dipping into the newer batch.
  const payload = {
    planning_horizon_days: 7,
    data_source: 'uploaded',
    custom_products: enterpriseCustomDataset.products,
    custom_warehouses: enterpriseCustomDataset.warehouses,
    custom_destinations: enterpriseCustomDataset.destinations,
    custom_batches: enterpriseCustomDataset.batches,
    custom_routes: enterpriseCustomDataset.routes,
    custom_demand_records: enterpriseCustomDataset.demand_records
  };

  const res = await fetch(`${GATEWAY_URL}/api/optimization/run`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify(payload)
  });
  assert.equal(res.status, 200);
  const plan = await res.json();

  const dairyHoustonRecs = plan.recommendations.filter(
    r => r.product_id === "SKU_DAIRY_002" && r.destination_id === "STORE_HOUSTON_01"
  );
  assert.ok(dairyHoustonRecs.length >= 1);
  const fefoBatchAllocation = dairyHoustonRecs.find(r => r.batch_id === "LOT-DAIRY-FEFO-01");
  assert.ok(fefoBatchAllocation, 'Near-expiry FEFO batch must be selected');
  assert.equal(fefoBatchAllocation.allocated_quantity, 300, 'Must exhaust entire 300-unit near-expiry batch');
});

test('Custom CSV Workflow: Baseline vs OR-Tools Comparison Works on Custom Data', async () => {
  const payload = {
    planning_horizon_days: 7,
    data_source: 'uploaded',
    custom_products: enterpriseCustomDataset.products,
    custom_warehouses: enterpriseCustomDataset.warehouses,
    custom_destinations: enterpriseCustomDataset.destinations,
    custom_batches: enterpriseCustomDataset.batches,
    custom_routes: enterpriseCustomDataset.routes,
    custom_demand_records: enterpriseCustomDataset.demand_records
  };

  const res = await fetch(`${GATEWAY_URL}/api/optimization/compare`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify(payload)
  });
  assert.equal(res.status, 200);
  const audit = await res.json();

  assert.ok(audit.baseline_metrics);
  assert.ok(audit.optimized_metrics);
  assert.equal(audit.baseline_metrics.total_demand_units, 1150);
  assert.equal(audit.optimized_metrics.total_demand_units, 1150);
  assert.ok(audit.summary_verdict.length > 0);
});

test('Custom CSV Workflow: Bundled M5 Workflow Preserved and Functional', async () => {
  const res = await fetch(`${GATEWAY_URL}/api/optimization/run`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ strategy: 'ortools_optimal', planning_horizon_days: 7, data_source: 'm5' })
  });
  assert.equal(res.status, 200);
  const plan = await res.json();
  assert.equal(plan.data_source, 'm5');
  assert.equal(plan.metrics.total_demand_units, 783);
});
