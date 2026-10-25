import test from 'node:test';
import assert from 'node:assert/strict';

const GATEWAY_URL = 'http://localhost:5001';

test('SupplySync Authentication & Real Authorization Security Suite', async (t) => {
  const randomSuffix = Math.random().toString(36).substring(2, 9);
  const userA = {
    email: `planner_${randomSuffix}@supplysync.io`,
    password: 'SecurePassword123!',
    name: 'Primary Planner'
  };
  const userB = {
    email: `auditor_${randomSuffix}@supplysync.io`,
    password: 'AnotherPassword456!',
    name: 'Secondary Auditor'
  };

  let sessionCookieUserA = '';
  let sessionTokenUserA = '';
  let sessionTokenUserB = '';
  let createdRunId = '';

  await t.test('1. Reject invalid email formats during registration', async () => {
    const invalidEmails = ['notanemail', 'user@', '@domain.com', 'user@domain', 'user name@domain.com'];
    for (const badEmail of invalidEmails) {
      const res = await fetch(`${GATEWAY_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: badEmail, password: 'ValidPassword123!' })
      });
      assert.equal(res.status, 400, `Expected 400 for bad email: ${badEmail}`);
      const data = await res.json();
      assert.ok(data.error.includes('email'), 'Response should mention invalid email');
    }
  });

  await t.test('2. Reject weak or short passwords during registration', async () => {
    const weakPasswords = ['short', '1234567', 'passwordonly', '123456789'];
    for (const badPassword of weakPasswords) {
      const res = await fetch(`${GATEWAY_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: `test_${Math.random()}@example.com`, password: badPassword })
      });
      assert.equal(res.status, 400, `Expected 400 for bad password: ${badPassword}`);
      const data = await res.json();
      assert.ok(data.error || data.message);
    }
  });

  await t.test('3. Successfully register new persistent user and set HttpOnly cookie', async () => {
    const res = await fetch(`${GATEWAY_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userA)
    });
    assert.equal(res.status, 201, 'Registration should return 201 Created');

    // Extract cookie
    const setCookie = res.headers.get('set-cookie');
    assert.ok(setCookie, 'Registration must set session cookie');
    assert.ok(setCookie.includes('supplysync_session='), 'Cookie name must be supplysync_session');
    assert.ok(setCookie.toLowerCase().includes('httponly'), 'Session cookie must be HttpOnly');

    sessionCookieUserA = setCookie.split(';')[0];

    const data = await res.json();
    assert.equal(data.user.email, userA.email.toLowerCase());
    assert.equal(data.user.name, userA.name);
    assert.equal(data.user.role, 'planner');
    assert.ok(data.token, 'Registration should return session token');
    assert.equal(data.user.password_hash, undefined, 'Password hash MUST NEVER be returned to client');
    assert.equal(data.user.password, undefined, 'Plaintext password MUST NEVER be returned');

    sessionTokenUserA = data.token;
  });

  await t.test('4. Prevent duplicate registration with clear conflict message', async () => {
    const res = await fetch(`${GATEWAY_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userA)
    });
    assert.equal(res.status, 409, 'Duplicate email registration must return 409 Conflict');
    const data = await res.json();
    assert.ok(data.message.toLowerCase().includes('already exists'));
  });

  await t.test('5. Reject login with incorrect password using generic error', async () => {
    const res = await fetch(`${GATEWAY_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: userA.email, password: 'WrongPassword999!' })
    });
    assert.equal(res.status, 401, 'Bad credentials must return 401 Unauthorized');
    const data = await res.json();
    assert.equal(data.message, 'Invalid email or password.');
  });

  await t.test('6. Reject login with non-existent email using identical generic error', async () => {
    const res = await fetch(`${GATEWAY_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'ghost_user@doesnotexist.io', password: 'AnyPassword123!' })
    });
    assert.equal(res.status, 401, 'Non-existent account must return 401');
    const data = await res.json();
    assert.equal(data.message, 'Invalid email or password.');
  });

  await t.test('7. Successful login returns sanitized profile and valid session token', async () => {
    const res = await fetch(`${GATEWAY_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: userA.email, password: userA.password })
    });
    assert.equal(res.status, 200, 'Valid login must return 200 OK');
    const data = await res.json();
    assert.equal(data.user.email, userA.email.toLowerCase());
    assert.equal(data.user.password_hash, undefined);
    assert.ok(data.token);
  });

  await t.test('8. Pre-seeded default evaluator login works for judges/evaluators', async () => {
    const res = await fetch(`${GATEWAY_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'evaluator@supplysync.io', password: 'SupplySync2026!' })
    });
    assert.equal(res.status, 200, 'Default evaluator login must succeed');
    const data = await res.json();
    assert.equal(data.user.email, 'evaluator@supplysync.io');
    assert.equal(data.user.role, 'lead_planner');
  });

  await t.test('9. Protected endpoints reject unauthenticated requests with 401', async () => {
    const endpoints = [
      { path: '/api/optimization/run', method: 'POST', body: { planning_horizon_days: 7 } },
      { path: '/api/optimization/baseline', method: 'POST', body: { planning_horizon_days: 7 } },
      { path: '/api/optimization/compare', method: 'POST', body: { planning_horizon_days: 7 } },
      { path: '/api/dataset/validate', method: 'POST', body: {} },
      { path: '/api/forecast/predict', method: 'POST', body: { product_id: '1', destination_id: '1' } },
      { path: '/api/auth/me', method: 'GET' }
    ];

    for (const ep of endpoints) {
      const res = await fetch(`${GATEWAY_URL}${ep.path}`, {
        method: ep.method,
        headers: { 'Content-Type': 'application/json' },
        ...(ep.body ? { body: JSON.stringify(ep.body) } : {})
      });
      assert.equal(res.status, 401, `Unauthenticated ${ep.method} ${ep.path} must be rejected with 401`);
      const data = await res.json();
      assert.equal(data.error, 'Unauthorized');
    }
  });

  await t.test('10. Protected endpoints reject invalid or forged session tokens with 401', async () => {
    const res = await fetch(`${GATEWAY_URL}/api/optimization/run`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': 'Bearer sess_forged_invalid_token_12345'
      },
      body: JSON.stringify({ planning_horizon_days: 7, data_source: 'm5' })
    });
    assert.equal(res.status, 401, 'Forged token must return 401');
  });

  await t.test('11. Authenticated user can execute optimization and record ownership', async () => {
    const res = await fetch(`${GATEWAY_URL}/api/optimization/run`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': sessionCookieUserA
      },
      body: JSON.stringify({ planning_horizon_days: 7, data_source: 'm5' })
    });
    assert.equal(res.status, 200, 'Authenticated optimization run must succeed');
    const plan = await res.json();
    assert.ok(plan.run_id);
    createdRunId = plan.run_id;

    // User A can view and export their own run
    const viewRes = await fetch(`${GATEWAY_URL}/api/runs/${createdRunId}`, {
      headers: { 'Cookie': sessionCookieUserA }
    });
    assert.equal(viewRes.status, 200, 'User A must be able to view their own run');

    const exportRes = await fetch(`${GATEWAY_URL}/api/optimization/runs/${createdRunId}/export`, {
      headers: { 'Cookie': sessionCookieUserA }
    });
    assert.equal(exportRes.status, 200, 'User A must be able to export their own run');
    const csv = await exportRes.text();
    assert.ok(csv.includes('Run ID'));
  });

  await t.test('12. Cross-user access denial: User B cannot access or export User A run', async () => {
    // Register User B
    const regB = await fetch(`${GATEWAY_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userB)
    });
    assert.equal(regB.status, 201);
    const dataB = await regB.json();
    sessionTokenUserB = dataB.token;

    // User B attempts to access User A's run
    const unauthorizedView = await fetch(`${GATEWAY_URL}/api/runs/${createdRunId}`, {
      headers: { 'Authorization': `Bearer ${sessionTokenUserB}` }
    });
    assert.equal(unauthorizedView.status, 403, 'Cross-user run inspection must return 403 Forbidden');
    const viewErr = await unauthorizedView.json();
    assert.equal(viewErr.error, 'Forbidden');

    // User B attempts to export User A's run
    const unauthorizedExport = await fetch(`${GATEWAY_URL}/api/optimization/runs/${createdRunId}/export`, {
      headers: { 'Authorization': `Bearer ${sessionTokenUserB}` }
    });
    assert.equal(unauthorizedExport.status, 403, 'Cross-user run export must return 403 Forbidden');
  });

  await t.test('13. Persistent session verification via GET /api/auth/me', async () => {
    const res = await fetch(`${GATEWAY_URL}/api/auth/me`, {
      headers: { 'Cookie': sessionCookieUserA }
    });
    assert.equal(res.status, 200, 'GET /api/auth/me must return 200 for active session');
    const data = await res.json();
    assert.equal(data.user.email, userA.email.toLowerCase());
    assert.equal(data.user.password_hash, undefined);
  });

  await t.test('14. Logout invalidates the session server-side; reuse is rejected with 401', async () => {
    const logoutRes = await fetch(`${GATEWAY_URL}/api/auth/logout`, {
      method: 'POST',
      headers: { 'Cookie': sessionCookieUserA }
    });
    assert.equal(logoutRes.status, 200, 'Logout must return 200 OK');

    // Verify the invalidated token is rejected by GET /api/auth/me
    const verifyAfterLogout = await fetch(`${GATEWAY_URL}/api/auth/me`, {
      headers: { 'Cookie': sessionCookieUserA }
    });
    assert.equal(verifyAfterLogout.status, 401, 'Logged out session must be rejected with 401');

    // Verify the invalidated token cannot execute optimization
    const optAfterLogout = await fetch(`${GATEWAY_URL}/api/optimization/run`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Cookie': sessionCookieUserA 
      },
      body: JSON.stringify({ planning_horizon_days: 7 })
    });
    assert.equal(optAfterLogout.status, 401, 'Logged out session cannot execute optimization');
  });

  await t.test('15. Session tokens are cryptographically hashed in SQLite store (raw token never saved)', async () => {
    // In node native sqlite: inspect data/supplysync.db
    const { DatabaseSync } = await import('node:sqlite');
    const path = await import('node:path');
    const crypto = await import('node:crypto');
    
    const dbPath = path.resolve('data/supplysync.db');
    const db = new DatabaseSync(dbPath);

    // Verify sessionTokenUserB raw string is NOT in the database
    const rawStmt = db.prepare('SELECT * FROM sessions WHERE id = ?');
    const rawResult = rawStmt.get(sessionTokenUserB);
    assert.equal(rawResult, undefined, 'Raw session token MUST NEVER be stored in the database');

    // Verify its SHA-256 hash IS in the database
    const hash = crypto.createHash('sha256').update(sessionTokenUserB).digest('hex');
    const hashResult = rawStmt.get(hash);
    assert.ok(hashResult, 'SHA-256 token hash must exist in the database');
    db.close();
  });

  await t.test('16. CSRF Defense: Untrusted Origin headers on state-changing requests are rejected with 403', async () => {
    const maliciousOrigins = ['https://evil-phishing.com', 'http://malicious-site.org', 'null'];
    for (const origin of maliciousOrigins) {
      const res = await fetch(`${GATEWAY_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': origin
        },
        body: JSON.stringify({ email: 'evaluator@supplysync.io', password: 'InvalidPassword123!' })
      });
      assert.equal(res.status, 403, `Untrusted Origin '${origin}' must be rejected with 403 Forbidden`);
      const data = await res.json();
      assert.equal(data.error, 'Forbidden');
      assert.ok(data.message.toLowerCase().includes('csrf'));
    }
  });

  await t.test('17. CSRF Defense: Authorized frontend origins pass verification', async () => {
    const res = await fetch(`${GATEWAY_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'http://localhost:5173'
      },
      body: JSON.stringify({ email: 'nonexistent@example.com', password: 'InvalidPassword123!' })
    });
    // Should pass CSRF check and proceed to auth check (returning 401 Unauthorized for nonexistent user, NOT 403 Forbidden)
    assert.equal(res.status, 401, 'Request from authorized origin http://localhost:5173 must pass CSRF check');
  });

  await t.test('18. Evaluator credentials are secure (no hardcoded password leak in response)', async () => {
    const res = await fetch(`${GATEWAY_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'evaluator@supplysync.io', password: process.env.DEMO_USER_PASSWORD || 'SupplySync2026!' })
    });
    assert.equal(res.status, 200, 'Configured evaluator login must succeed');
    const data = await res.json();
    assert.equal(data.user.email, 'evaluator@supplysync.io');
    assert.equal(data.user.password_hash, undefined);
    assert.equal(data.user.password, undefined);
  });

  await t.test('19. Secure server-side demo evaluator login works in development without client credentials', async () => {
    const res = await fetch(`${GATEWAY_URL}/api/auth/demo-login`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Origin': 'http://localhost:5173'
      }
    });
    assert.equal(res.status, 200, 'Server-side demo login must succeed in dev environment');
    const data = await res.json();
    assert.equal(data.user.email, 'evaluator@supplysync.io');
    assert.ok(data.token);
    assert.equal(data.user.password_hash, undefined);
    assert.equal(data.user.password, undefined);

    const setCookie = res.headers.get('set-cookie');
    assert.ok(setCookie && setCookie.includes('supplysync_session='), 'Must set HttpOnly session cookie');
  });
});
