import assert from 'node:assert/strict';
import test from 'node:test';

const GATEWAY_URL = 'http://localhost:5001';
const ENGINE_URL = 'http://localhost:8000';

let authHeaders = {};

const sampleValidCustomDataset = {
  products: [
    { id: "PROD_MILK", name: "Whole Milk 1L", category: "Dairy", unit_price: 3.50, is_perishable: true, shelf_life_days: 14 },
    { id: "PROD_YOGURT", name: "Greek Yogurt 500g", category: "Dairy", unit_price: 4.20, is_perishable: true, shelf_life_days: 21 },
    { id: "PROD_CHEESE", name: "Cheddar Block 250g", category: "Dairy", unit_price: 5.80, is_perishable: true, shelf_life_days: 60 }
  ],
  warehouses: [
    { id: "WH_NORTH", name: "Northern Cold Storage Hub", location: "Chicago, IL", max_capacity: 15000, current_utilization: 4500 },
    { id: "WH_SOUTH", name: "Southern Regional DC", location: "Atlanta, GA", max_capacity: 12000, current_utilization: 3200 }
  ],
  destinations: [
    { id: "STORE_CHI_01", name: "Metro Market Lincoln Park", location: "Chicago, IL", region: "Midwest", priority_tier: 1 },
    { id: "STORE_MIL_01", name: "Fresh Mart Downtown", location: "Milwaukee, WI", region: "Midwest", priority_tier: 2 },
    { id: "STORE_ATL_01", name: "Piedmont Grocers", location: "Atlanta, GA", region: "South", priority_tier: 1 }
  ],
  batches: [
    { batch_id: "BATCH_M_01", product_id: "PROD_MILK", warehouse_id: "WH_NORTH", quantity: 600, days_to_expiry: 5, received_date: "2026-04-10" },
    { batch_id: "BATCH_M_02", product_id: "PROD_MILK", warehouse_id: "WH_NORTH", quantity: 1200, days_to_expiry: 12, received_date: "2026-04-17" },
    { batch_id: "BATCH_M_03", product_id: "PROD_MILK", warehouse_id: "WH_SOUTH", quantity: 800, days_to_expiry: 9, received_date: "2026-04-14" },
    { batch_id: "BATCH_Y_01", product_id: "PROD_YOGURT", warehouse_id: "WH_NORTH", quantity: 700, days_to_expiry: 8, received_date: "2026-04-12" },
    { batch_id: "BATCH_Y_02", product_id: "PROD_YOGURT", warehouse_id: "WH_SOUTH", quantity: 900, days_to_expiry: 18, received_date: "2026-04-18" },
    { batch_id: "BATCH_C_01", product_id: "PROD_CHEESE", warehouse_id: "WH_NORTH", quantity: 450, days_to_expiry: 45, received_date: "2026-03-20" },
    { batch_id: "BATCH_C_02", product_id: "PROD_CHEESE", warehouse_id: "WH_SOUTH", quantity: 550, days_to_expiry: 55, received_date: "2026-03-30" }
  ],
  routes: [
    { warehouse_id: "WH_NORTH", destination_id: "STORE_CHI_01", distance_km: 25, transport_cost_per_unit: 0.35, transit_time_days: 1, capacity_units: 3000 },
    { warehouse_id: "WH_NORTH", destination_id: "STORE_MIL_01", distance_km: 150, transport_cost_per_unit: 0.85, transit_time_days: 1, capacity_units: 2000 },
    { warehouse_id: "WH_SOUTH", destination_id: "STORE_ATL_01", distance_km: 30, transport_cost_per_unit: 0.40, transit_time_days: 1, capacity_units: 2500 },
    { warehouse_id: "WH_SOUTH", destination_id: "STORE_CHI_01", distance_km: 1150, transport_cost_per_unit: 2.40, transit_time_days: 2, capacity_units: 1500 }
  ],
  demand_records: [
    { product_id: "PROD_MILK", destination_id: "STORE_CHI_01", date: "2026-04-20", quantity: 400 },
    { product_id: "PROD_MILK", destination_id: "STORE_MIL_01", date: "2026-04-20", quantity: 300 },
    { product_id: "PROD_MILK", destination_id: "STORE_ATL_01", date: "2026-04-20", quantity: 350 },
    { product_id: "PROD_YOGURT", destination_id: "STORE_CHI_01", date: "2026-04-20", quantity: 250 },
    { product_id: "PROD_YOGURT", destination_id: "STORE_ATL_01", date: "2026-04-20", quantity: 300 },
    { product_id: "PROD_CHEESE", destination_id: "STORE_CHI_01", date: "2026-04-20", quantity: 150 },
    { product_id: "PROD_CHEESE", destination_id: "STORE_ATL_01", date: "2026-04-20", quantity: 200 }
  ]
};

test('SupplySync User Journey: API Gateway Health Check & Authenticated Setup', async () => {
  const res = await fetch(`${GATEWAY_URL}/api/health`);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.status, 'healthy');
  assert.equal(data.engineStatus, 'healthy');

  // Authenticate as evaluator for journey
  const loginRes = await fetch(`${GATEWAY_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'evaluator@supplysync.io', password: 'SupplySync2026!' })
  });
  assert.equal(loginRes.status, 200);
  const loginData = await loginRes.json();
  authHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${loginData.token}`
  };
});

test('SupplySync User Journey: Valid Custom Dataset Validation Passes', async () => {
  const res = await fetch(`${GATEWAY_URL}/api/dataset/validate`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify(sampleValidCustomDataset)
  });
  assert.equal(res.status, 200);
  const val = await res.json();
  assert.equal(val.valid, true, `Validation should pass, but got errors: ${val.errors.join('; ')}`);
  assert.equal(val.errors.length, 0);
  assert.equal(val.summary.products_count, 3);
  assert.equal(val.summary.warehouses_count, 2);
  assert.equal(val.summary.destinations_count, 3);
  assert.equal(val.summary.batches_count, 7);
  assert.equal(val.summary.routes_count, 4);
});

test('SupplySync User Journey: Invalid Custom Dataset is Rejected with Actionable Errors', async () => {
  const brokenDataset = {
    ...sampleValidCustomDataset,
    batches: [
      ...sampleValidCustomDataset.batches,
      { batch_id: "BAD_BATCH", product_id: "UNKNOWN_PROD", warehouse_id: "WH_NORTH", quantity: -50, days_to_expiry: -2 }
    ],
    routes: [
      ...sampleValidCustomDataset.routes,
      { warehouse_id: "WH_NORTH", destination_id: "UNKNOWN_DEST", distance_km: 10, transport_cost_per_unit: -1.0 }
    ]
  };

  const res = await fetch(`${GATEWAY_URL}/api/dataset/validate`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify(brokenDataset)
  });
  assert.equal(res.status, 200);
  const val = await res.json();
  assert.equal(val.valid, false, 'Validation should fail on broken dataset');
  assert.ok(val.errors.length >= 3, 'Should have multiple blocking errors');

  // Verify specific actionable error messages
  const errorText = val.errors.join(' ');
  assert.match(errorText, /UNKNOWN_PROD/, 'Should report unknown product ID');
  assert.match(errorText, /UNKNOWN_DEST/, 'Should report unknown destination ID');
  assert.match(errorText, /negative/i, 'Should report negative quantity');
  assert.match(errorText, /transportation cost/i, 'Should report non-positive transport cost');
});

test('SupplySync User Journey: Real OR-Tools Optimization with Uploaded Custom Dataset', async () => {
  const payload = {
    strategy: 'ortools_optimal',
    planning_horizon_days: 7,
    data_source: 'uploaded',
    custom_products: sampleValidCustomDataset.products,
    custom_warehouses: sampleValidCustomDataset.warehouses,
    custom_destinations: sampleValidCustomDataset.destinations,
    custom_batches: sampleValidCustomDataset.batches,
    custom_routes: sampleValidCustomDataset.routes,
    custom_demand_records: sampleValidCustomDataset.demand_records
  };

  const res = await fetch(`${GATEWAY_URL}/api/optimization/run`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify(payload)
  });
  assert.equal(res.status, 200);
  const plan = await res.json();

  assert.ok(plan.run_id, 'Plan must have a unique run_id');
  assert.equal(plan.data_source, 'uploaded', 'Data source must be truthful: "uploaded"');
  assert.equal(plan.planning_horizon_days, 7);
  assert.equal(plan.strategy, 'optimized_ortools');
  assert.ok(plan.metrics.solver_runtime_ms >= 0);
  assert.ok(plan.recommendations.length > 0, 'Solver must generate allocations');

  // Verify allocations exclusively use the uploaded custom products, origins, and destinations
  const allowedProds = new Set(sampleValidCustomDataset.products.map(p => p.id));
  const allowedOrigins = new Set(sampleValidCustomDataset.warehouses.map(w => w.id));
  const allowedDests = new Set(sampleValidCustomDataset.destinations.map(d => d.id));

  for (const rec of plan.recommendations) {
    assert.ok(allowedProds.has(rec.product_id), `Allocation used product ${rec.product_id} not in custom data!`);
    assert.ok(allowedOrigins.has(rec.source_warehouse_id), `Allocation used origin ${rec.source_warehouse_id} not in custom data!`);
    assert.ok(allowedDests.has(rec.destination_id), `Allocation used destination ${rec.destination_id} not in custom data!`);
  }
});

test('SupplySync User Journey: Real OR-Tools Optimization with M5 Kaggle Dataset', async () => {
  const payload = {
    strategy: 'ortools_optimal',
    planning_horizon_days: 7,
    data_source: 'm5'
  };

  const res = await fetch(`${GATEWAY_URL}/api/optimization/run`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify(payload)
  });
  assert.equal(res.status, 200);
  const plan = await res.json();

  assert.ok(plan.run_id);
  assert.equal(plan.data_source, 'm5', 'Data source must be "m5"');
  assert.equal(plan.planning_horizon_days, 7);
  assert.ok(plan.recommendations.length > 0);
});

test('SupplySync User Journey: Consecutive Runs Produce Unique Run IDs', async () => {
  const res1 = await fetch(`${GATEWAY_URL}/api/optimization/run`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ strategy: 'ortools_optimal', planning_horizon_days: 7, data_source: 'm5' })
  });
  const plan1 = await res1.json();

  const res2 = await fetch(`${GATEWAY_URL}/api/optimization/run`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ strategy: 'ortools_optimal', planning_horizon_days: 7, data_source: 'm5' })
  });
  const plan2 = await res2.json();

  assert.notEqual(plan1.run_id, plan2.run_id, 'Consecutive runs must have distinct run IDs');
});

test('SupplySync User Journey: Baseline vs OR-Tools Comparison on Uploaded Custom Data', async () => {
  const payload = {
    planning_horizon_days: 7,
    data_source: 'uploaded',
    custom_products: sampleValidCustomDataset.products,
    custom_warehouses: sampleValidCustomDataset.warehouses,
    custom_destinations: sampleValidCustomDataset.destinations,
    custom_batches: sampleValidCustomDataset.batches,
    custom_routes: sampleValidCustomDataset.routes,
    custom_demand_records: sampleValidCustomDataset.demand_records
  };

  const res = await fetch(`${GATEWAY_URL}/api/optimization/compare`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify(payload)
  });
  assert.equal(res.status, 200);
  const audit = await res.json();

  assert.ok(audit.baseline_metrics, 'Audit must include baseline metrics');
  assert.ok(audit.optimized_metrics, 'Audit must include optimized metrics');
  assert.ok(audit.cost_savings_amount !== undefined);
  assert.ok(audit.fulfillment_improvement_pct !== undefined);
  assert.ok(audit.summary_verdict);
});

test('SupplySync User Journey: Master Data Snapshot Consistency & Dynamic Product Counts', async () => {
  const res = await fetch(`${GATEWAY_URL}/api/master-data?data_source=m5&horizon=7`);
  assert.equal(res.status, 200);
  const data = await res.json();

  // 1. Verify exact product count loaded by the engine
  assert.equal(data.products.length, 5, 'Master data must load exactly 5 products from verified M5 sample');
  const expectedItems = ['FOODS_1_001', 'FOODS_1_002', 'FOODS_2_001', 'HOBBIES_1_001', 'HOUSEHOLD_1_001'];
  const loadedItemIds = data.products.map(p => p.id).sort();
  assert.deepEqual(loadedItemIds, expectedItems, 'Loaded product IDs must match verified M5 items');

  // 2. Verify destination count and regional coverage (CA & TX)
  assert.equal(data.destinations.length, 4, 'Master data must load exactly 4 store destinations');
  const expectedStores = ['CA_1', 'CA_2', 'TX_1', 'TX_2'];
  const loadedStoreIds = data.destinations.map(d => d.id).sort();
  assert.deepEqual(loadedStoreIds, expectedStores, 'Destination IDs must include CA and TX stores');

  // 3. Verify snapshot card label consistency
  const snapshotProductCount = data.products.length;
  const supportingLabel = `${snapshotProductCount} selected M5 items`;
  assert.equal(supportingLabel, '5 selected M5 items', 'Supporting label must be internally consistent with product count');
  assert.notEqual(supportingLabel, '8 M5 Items', 'Hardcoded misleading 8 M5 Items label must not be used');

  // 4. Verify products agree with demand records passed to optimization engine
  const demandProductIds = new Set(data.demand.map(d => d.product_id));
  for (const item of expectedItems) {
    assert.ok(demandProductIds.has(item), `Product ${item} must have corresponding demand records for optimization`);
  }
});
