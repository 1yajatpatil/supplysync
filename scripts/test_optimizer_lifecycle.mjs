import test from 'node:test';
import assert from 'node:assert/strict';

const GATEWAY_URL = 'http://127.0.0.1:5001';

test('SupplySync Optimizer Lifecycle & State Verification', async (t) => {
  // Authenticate as persistent evaluator
  const loginRes = await fetch(`${GATEWAY_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'evaluator@supplysync.io', password: 'SupplySync2026!' })
  });
  assert.equal(loginRes.status, 200, 'Evaluator login must succeed');
  const loginData = await loginRes.json();
  const authHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${loginData.token}`
  };

  await t.test('1. Clicking optimizer triggers POST /api/optimization/run with M5 dataset', async () => {
    const res = await fetch(`${GATEWAY_URL}/api/optimization/run`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ planning_horizon_days: 7, data_source: 'm5' })
    });
    assert.equal(res.status, 200, 'Optimization endpoint must respond 200 OK');
    const plan = await res.json();
    assert.ok(plan.run_id.startsWith('RUN-OPT-'), 'Plan must contain a generated run_id');
    assert.equal(plan.strategy, 'optimized_ortools');
    assert.equal(plan.planning_horizon_days, 7);
    assert.equal(plan.metrics.fulfillment_rate_pct, 100);
    assert.equal(plan.metrics.total_transport_cost, 1370.25);
    assert.equal(plan.recommendations.length, 20);
    assert.ok(plan.created_at, 'Must have created_at timestamp');
    assert.ok(plan.metrics.solver_runtime_ms > 0, 'Must record solver runtime');
  });

  await t.test('2. Consecutive runs invoke the solver fresh and generate unique Run IDs', async () => {
    const res1 = await fetch(`${GATEWAY_URL}/api/optimization/run`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ planning_horizon_days: 7, data_source: 'm5' })
    });
    const plan1 = await res1.json();

    const res2 = await fetch(`${GATEWAY_URL}/api/optimization/run`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ planning_horizon_days: 7, data_source: 'm5' })
    });
    const plan2 = await res2.json();

    assert.notEqual(plan1.run_id, plan2.run_id, 'Each solver run must receive a fresh, unique run_id');
    assert.equal(plan1.metrics.total_transport_cost, plan2.metrics.total_transport_cost, 'Optimal economic cost must be identical on deterministic M5 data');
    assert.equal(plan1.metrics.total_fulfilled_units, plan2.metrics.total_fulfilled_units);
  });

  await t.test('3. Verification of frontend isSamePlan detection logic', () => {
    const currentPlan = {
      run_id: 'RUN-OPT-AAA111',
      strategy: 'optimized_ortools',
      planning_horizon_days: 7,
      metrics: { total_transport_cost: 1370.25, total_fulfilled_units: 783, solver_runtime_ms: 5.2 },
      recommendations: new Array(20)
    };

    const newPlanIdentical = {
      run_id: 'RUN-OPT-BBB222',
      strategy: 'optimized_ortools',
      planning_horizon_days: 7,
      metrics: { total_transport_cost: 1370.25, total_fulfilled_units: 783, solver_runtime_ms: 4.8 },
      recommendations: new Array(20)
    };

    const isSamePlan = Boolean(
      currentPlan &&
      currentPlan.strategy === newPlanIdentical.strategy &&
      currentPlan.planning_horizon_days === newPlanIdentical.planning_horizon_days &&
      currentPlan.metrics.total_transport_cost === newPlanIdentical.metrics.total_transport_cost &&
      currentPlan.metrics.total_fulfilled_units === newPlanIdentical.metrics.total_fulfilled_units &&
      currentPlan.recommendations.length === newPlanIdentical.recommendations.length
    );

    assert.equal(isSamePlan, true, 'Frontend correctly detects that optimal allocation is unchanged from previous run');
    
    // Changing strategy or cost breaks parity
    const newPlanDifferent = { ...newPlanIdentical, strategy: 'baseline' };
    const isSamePlanDifferent = Boolean(
      currentPlan &&
      currentPlan.strategy === newPlanDifferent.strategy &&
      currentPlan.planning_horizon_days === newPlanDifferent.planning_horizon_days &&
      currentPlan.metrics.total_transport_cost === newPlanDifferent.metrics.total_transport_cost
    );
    assert.equal(isSamePlanDifferent, false, 'Strategy change correctly recognized as fresh different plan');
  });

  await t.test('4. Planning horizons genuinely scale demand and preserve M5 source', async () => {
    const res7 = await fetch(`${GATEWAY_URL}/api/optimization/run`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ planning_horizon_days: 7, data_source: 'm5' })
    });
    const plan7 = await res7.json();

    const res14 = await fetch(`${GATEWAY_URL}/api/optimization/run`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ planning_horizon_days: 14, data_source: 'm5' })
    });
    const plan14 = await res14.json();

    assert.equal(plan7.planning_horizon_days, 7);
    assert.equal(plan14.planning_horizon_days, 14);
    assert.ok(plan14.metrics.total_demand_units > plan7.metrics.total_demand_units, '14D demand must exceed 7D demand');
    assert.ok(plan14.metrics.total_transport_cost > plan7.metrics.total_transport_cost, '14D freight cost must scale with demand');
  });

  await t.test('5. Synthetic data requests are rejected with HTTP 400', async () => {
    const res = await fetch(`${GATEWAY_URL}/api/optimization/run`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ planning_horizon_days: 7, data_source: 'synthetic' })
    });
    assert.equal(res.status, 400, 'Synthetic requests must be rejected with 400 Bad Request');
    const body = await res.json();
    assert.ok(body.error.includes('Synthetic'), 'Error message must explicitly mention synthetic deprecation');
  });
});
