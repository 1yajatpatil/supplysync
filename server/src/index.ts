import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import {
  isValidEmail,
  validatePassword,
  createUser,
  getUserByEmail,
  verifyPassword,
  createSession,
  verifySession,
  revokeSession,
  sanitizeUser,
  recordUserRun,
  userOwnsRun,
  seedDefaultEvaluator
} from './auth';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;
const ENGINE_URL = process.env.OPTIMIZATION_SERVICE_URL || 'http://localhost:8000';
const isProd = process.env.NODE_ENV === 'production';

// Explicitly configured trusted frontend origins
const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:5001',
  'http://127.0.0.1:5001'
];

const envOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean)
  : [];

const ALLOWED_ORIGIN_SET = new Set([...DEFAULT_ALLOWED_ORIGINS, ...envOrigins]);

export function isOriginAllowed(origin?: string): boolean {
  if (!origin) return true; // Non-browser or programmatic API request without Origin header
  if (ALLOWED_ORIGIN_SET.has(origin)) return true;
  if (!isProd && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return true;
  return false;
}

// Production CORS restricting access to explicit origins (no wildcard with credentials)
app.use(cors({
  origin: (origin, callback) => {
    if (isOriginAllowed(origin)) {
      return callback(null, true);
    }
    // Block CORS without throwing a 500 exception
    return callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));

// CSRF Origin verification middleware for state-changing requests
app.use((req: Request, res: Response, next: NextFunction): void => {
  const stateChanging = ['POST', 'PUT', 'DELETE', 'PATCH'];
  if (!stateChanging.includes(req.method)) {
    return next();
  }

  const origin = req.headers.origin;
  if (origin && !isOriginAllowed(origin)) {
    res.status(403).json({
      error: 'Forbidden',
      message: 'CSRF validation failed: Request origin is not authorized.'
    });
    return;
  }
  next();
});

const AUTH_COOKIE_NAME = 'supplysync_session';
const COOKIE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export function getAuthCookieOptions() {
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: (isProd ? 'strict' : 'lax') as 'strict' | 'lax',
    path: '/',
    maxAge: COOKIE_MAX_AGE_MS
  };
}

// Helper to extract session token from cookie or Authorization header
function extractToken(req: Request): string | null {
  // 1. Check HttpOnly cookie
  if (req.cookies && req.cookies[AUTH_COOKIE_NAME]) {
    return req.cookies[AUTH_COOKIE_NAME];
  }
  // 2. Check Authorization Bearer header (preserved for automated test scripts)
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7).trim();
  }
  return null;
}

// Authentication & Authorization Middleware
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const token = extractToken(req);
  if (!token) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication required to perform this action. Please log in.'
    });
    return;
  }

  const verified = verifySession(token);
  if (!verified) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Session is invalid, revoked, or expired. Please log in again.'
    });
    return;
  }

  (req as any).user = sanitizeUser(verified.user);
  (req as any).sessionId = verified.session.id;
  next();
}

// Helper to fetch from Python Optimization Service with timeout
async function fetchEngine(path: string, options: RequestInit = {}): Promise<any> {
  const url = `${ENGINE_URL}${path}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20000); // 20s timeout

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`Engine returned ${response.status}: ${errBody}`);
    }

    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('text/csv')) {
      return await response.text();
    }
    return await response.json();
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error(`Optimization Engine request to '${path}' timed out.`);
    }
    throw err;
  }
}

// ----------------------------------------------------
// Public Authentication Endpoints
// ----------------------------------------------------

// POST /api/auth/register
app.post('/api/auth/register', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, name } = req.body || {};

    if (!email || !isValidEmail(email)) {
      res.status(400).json({
        error: 'Invalid email address',
        message: 'Please provide a valid corporate or professional email address.'
      });
      return;
    }

    const passwordCheck = validatePassword(password);
    if (!passwordCheck.valid) {
      res.status(400).json({
        error: 'Invalid password',
        message: passwordCheck.error || 'Password does not meet complexity requirements.'
      });
      return;
    }

    const existingUser = getUserByEmail(email);
    if (existingUser) {
      res.status(409).json({
        error: 'Conflict',
        message: 'An account with this email address already exists. Please log in instead.'
      });
      return;
    }

    const newUser = await createUser({
      email,
      password,
      name,
      role: 'planner'
    });

    const session = createSession(newUser.id);

    // Set secure HttpOnly cookie with strict/lax sameSite and production HTTPS flag
    res.cookie(AUTH_COOKIE_NAME, session.token, getAuthCookieOptions());

    res.status(201).json({
      user: sanitizeUser(newUser),
      token: session.token,
      message: 'Account registered successfully.'
    });
  } catch (err: any) {
    console.error('[Auth] Registration error:', err);
    res.status(500).json({
      error: 'Registration failed',
      message: 'An unexpected internal error occurred during registration.'
    });
  }
});

// POST /api/auth/login
app.post('/api/auth/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body || {};

    if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Email and password are required fields.'
      });
      return;
    }

    const user = getUserByEmail(email);
    if (!user) {
      // Generic error to prevent account enumeration
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid email or password.'
      });
      return;
    }

    const isMatch = await verifyPassword(password, user.password_hash);
    if (!isMatch) {
      // Generic error to prevent account enumeration
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid email or password.'
      });
      return;
    }

    const session = createSession(user.id);

    // Set secure HttpOnly cookie with strict/lax sameSite and production HTTPS flag
    res.cookie(AUTH_COOKIE_NAME, session.token, getAuthCookieOptions());

    res.json({
      user: sanitizeUser(user),
      token: session.token,
      message: 'Logged in successfully.'
    });
  } catch (err: any) {
    console.error('[Auth] Login error:', err);
    res.status(500).json({
      error: 'Login failed',
      message: 'An unexpected internal error occurred during authentication.'
    });
  }
});

// POST /api/auth/demo-login
// Secure server-side evaluator authentication (active only in development/evaluation; disabled in production)
app.post('/api/auth/demo-login', async (req: Request, res: Response): Promise<void> => {
  if (isProd) {
    res.status(403).json({
      error: 'Forbidden',
      message: 'Automated demo login is disabled in production environments. Please sign in with your credentials.'
    });
    return;
  }

  const demoEmail = 'evaluator@supplysync.io';
  const user = getUserByEmail(demoEmail);
  if (!user) {
    res.status(404).json({
      error: 'Not Found',
      message: 'Evaluator account not found. Ensure DEMO_USER_PASSWORD is set on the server.'
    });
    return;
  }

  const session = createSession(user.id);
  res.cookie(AUTH_COOKIE_NAME, session.token, getAuthCookieOptions());

  res.json({
    user: sanitizeUser(user),
    token: session.token,
    message: 'Logged in successfully as Triwizathon Evaluator.'
  });
});

// POST /api/auth/logout
app.post('/api/auth/logout', (req: Request, res: Response): void => {
  const token = extractToken(req);
  if (token) {
    revokeSession(token);
  }
  const cookieOpts = getAuthCookieOptions();
  res.clearCookie(AUTH_COOKIE_NAME, {
    httpOnly: cookieOpts.httpOnly,
    secure: cookieOpts.secure,
    sameSite: cookieOpts.sameSite,
    path: cookieOpts.path
  });
  res.json({
    message: 'Logged out successfully. Session has been invalidated.'
  });
});

// GET /api/auth/me
app.get('/api/auth/me', (req: Request, res: Response): void => {
  const token = extractToken(req);
  if (!token) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Not authenticated.'
    });
    return;
  }

  const verified = verifySession(token);
  if (!verified) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Session has expired or been revoked.'
    });
    return;
  }

  res.json({
    user: sanitizeUser(verified.user)
  });
});

// ----------------------------------------------------
// Public Diagnostic & Read-Only Catalog APIs
// ----------------------------------------------------

// Health Check
app.get('/api/health', async (req: Request, res: Response) => {
  let engineStatus = 'unreachable';
  try {
    const data = await fetchEngine('/health');
    engineStatus = data.status || 'healthy';
  } catch {
    engineStatus = 'offline';
  }

  res.json({
    status: 'healthy',
    gateway: 'Node.js Express Gateway',
    engineStatus,
    timestamp: new Date().toISOString()
  });
});

// Dataset Diagnostics API
app.get('/api/dataset-status', async (req: Request, res: Response) => {
  try {
    const data = await fetchEngine('/api/dataset-status');
    res.json(data);
  } catch (err: any) {
    res.status(502).json({ error: 'Failed to retrieve dataset status', details: err.message });
  }
});

// M5 Master Data APIs (Exclusively Real M5 Retail Dataset)
app.get('/api/master-data', async (req: Request, res: Response) => {
  try {
    if (req.query.data_source === 'synthetic' || req.query.data_source === 'fmcg') {
      res.status(400).json({ error: 'Synthetic FMCG data has been removed. Real M5 Kaggle data is the exclusive source.' });
      return;
    }
    const horizon = req.query.horizon || 7;
    const data = await fetchEngine(`/api/master-data?data_source=m5&horizon=${horizon}`);
    res.json(data);
  } catch (err: any) {
    res.status(502).json({ error: 'Failed to retrieve master data from optimization engine', details: err.message });
  }
});

app.get('/api/products', async (req: Request, res: Response) => {
  try {
    if (req.query.data_source === 'synthetic' || req.query.data_source === 'fmcg') {
      res.status(400).json({ error: 'Synthetic FMCG data has been removed. Real M5 Kaggle data is the exclusive source.' });
      return;
    }
    const horizon = req.query.horizon || 7;
    const data = await fetchEngine(`/api/master-data?data_source=m5&horizon=${horizon}`);
    res.json(data.products || []);
  } catch (err: any) {
    res.status(502).json({ error: err.message });
  }
});

app.get('/api/warehouses', async (req: Request, res: Response) => {
  try {
    if (req.query.data_source === 'synthetic' || req.query.data_source === 'fmcg') {
      res.status(400).json({ error: 'Synthetic FMCG data has been removed. Real M5 Kaggle data is the exclusive source.' });
      return;
    }
    const horizon = req.query.horizon || 7;
    const data = await fetchEngine(`/api/master-data?data_source=m5&horizon=${horizon}`);
    res.json(data.warehouses || []);
  } catch (err: any) {
    res.status(502).json({ error: err.message });
  }
});

app.get('/api/destinations', async (req: Request, res: Response) => {
  try {
    if (req.query.data_source === 'synthetic' || req.query.data_source === 'fmcg') {
      res.status(400).json({ error: 'Synthetic FMCG data has been removed. Real M5 Kaggle data is the exclusive source.' });
      return;
    }
    const horizon = req.query.horizon || 7;
    const data = await fetchEngine(`/api/master-data?data_source=m5&horizon=${horizon}`);
    res.json(data.destinations || []);
  } catch (err: any) {
    res.status(502).json({ error: err.message });
  }
});

app.get('/api/inventory', async (req: Request, res: Response) => {
  try {
    if (req.query.data_source === 'synthetic' || req.query.data_source === 'fmcg') {
      res.status(400).json({ error: 'Synthetic FMCG data has been removed. Real M5 Kaggle data is the exclusive source.' });
      return;
    }
    const horizon = req.query.horizon || 7;
    const data = await fetchEngine(`/api/master-data?data_source=m5&horizon=${horizon}`);
    res.json(data.batches || []);
  } catch (err: any) {
    res.status(502).json({ error: err.message });
  }
});

app.get('/api/demand', async (req: Request, res: Response) => {
  try {
    if (req.query.data_source === 'synthetic' || req.query.data_source === 'fmcg') {
      res.status(400).json({ error: 'Synthetic FMCG data has been removed. Real M5 Kaggle data is the exclusive source.' });
      return;
    }
    const horizon = req.query.horizon || 7;
    const data = await fetchEngine(`/api/master-data?data_source=m5&horizon=${horizon}`);
    res.json(data.demand || []);
  } catch (err: any) {
    res.status(502).json({ error: err.message });
  }
});

app.get('/api/routes', async (req: Request, res: Response) => {
  try {
    if (req.query.data_source === 'synthetic' || req.query.data_source === 'fmcg') {
      res.status(400).json({ error: 'Synthetic FMCG data has been removed. Real M5 Kaggle data is the exclusive source.' });
      return;
    }
    const horizon = req.query.horizon || 7;
    const data = await fetchEngine(`/api/master-data?data_source=m5&horizon=${horizon}`);
    res.json(data.routes || []);
  } catch (err: any) {
    res.status(502).json({ error: err.message });
  }
});

// ----------------------------------------------------
// Protected Planning & Optimization Operations
// ----------------------------------------------------

// Demand Forecasting API (Protected)
app.post('/api/forecast/predict', requireAuth, async (req: Request, res: Response) => {
  try {
    if (req.body?.data_source === 'synthetic' || req.body?.data_source === 'fmcg') {
      res.status(400).json({ error: 'Synthetic demand forecasting is deprecated. Real M5 data is the exclusive source.' });
      return;
    }
    const payload = { ...(req.body || {}), data_source: 'm5' };
    const result = await fetchEngine('/api/forecast', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    res.json(result);
  } catch (err: any) {
    res.status(502).json({ error: 'Demand forecasting failed', details: err.message });
  }
});

// Dataset Pre-Optimization Validation API (Protected)
app.post('/api/dataset/validate', requireAuth, async (req: Request, res: Response) => {
  try {
    const result = await fetchEngine('/api/dataset/validate', {
      method: 'POST',
      body: JSON.stringify(req.body || {})
    });
    res.json(result);
  } catch (err: any) {
    res.status(502).json({ error: 'Dataset validation failed', details: err.message });
  }
});

// Baseline Distribution API (Protected)
app.post('/api/optimization/baseline', requireAuth, async (req: Request, res: Response) => {
  try {
    if (req.body?.data_source === 'synthetic' || req.body?.data_source === 'fmcg') {
      res.status(400).json({ error: 'Synthetic data is deprecated. Real M5 data is the exclusive source.' });
      return;
    }
    const horizon = Number(req.body?.planning_horizon_days || req.body?.horizon_days || req.body?.horizon || 7);
    const dataSource = (req.body?.data_source === 'uploaded' || req.body?.data_source === 'custom') ? req.body.data_source : 'm5';
    const payload = { ...(req.body || {}), planning_horizon_days: horizon, data_source: dataSource };
    const plan = await fetchEngine('/api/baseline', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    // Record run ownership
    const currentUser = (req as any).user;
    if (currentUser?.id && plan?.run_id) {
      recordUserRun(plan.run_id, currentUser.id, plan.strategy || 'baseline', horizon, dataSource);
    }

    res.json(plan);
  } catch (err: any) {
    res.status(502).json({ error: 'Baseline distribution failed', details: err.message });
  }
});

// Constrained Optimization API (Protected)
app.post('/api/optimization/run', requireAuth, async (req: Request, res: Response) => {
  try {
    if (req.body?.data_source === 'synthetic' || req.body?.data_source === 'fmcg') {
      res.status(400).json({ error: 'Synthetic data is deprecated. Real M5 data is the exclusive source.' });
      return;
    }
    const horizon = Number(req.body?.planning_horizon_days || req.body?.horizon_days || req.body?.horizon || 7);
    const dataSource = (req.body?.data_source === 'uploaded' || req.body?.data_source === 'custom') ? req.body.data_source : 'm5';
    const payload = { ...(req.body || {}), planning_horizon_days: horizon, data_source: dataSource };
    const plan = await fetchEngine('/api/optimize', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    // Record run ownership
    const currentUser = (req as any).user;
    if (currentUser?.id && plan?.run_id) {
      recordUserRun(plan.run_id, currentUser.id, plan.strategy || 'optimized_ortools', horizon, dataSource);
    }

    res.json(plan);
  } catch (err: any) {
    res.status(502).json({ error: 'Optimization engine run failed', details: err.message });
  }
});

// Baseline vs. Optimized Comparison API (Protected)
app.post('/api/optimization/compare', requireAuth, async (req: Request, res: Response) => {
  try {
    if (req.body?.data_source === 'synthetic' || req.body?.data_source === 'fmcg') {
      res.status(400).json({ error: 'Synthetic data is deprecated. Real M5 data is the exclusive source.' });
      return;
    }
    const horizon = Number(req.body?.planning_horizon_days || req.body?.horizon_days || req.body?.horizon || 7);
    const dataSource = (req.body?.data_source === 'uploaded' || req.body?.data_source === 'custom') ? req.body.data_source : 'm5';
    const payload = { ...(req.body || {}), planning_horizon_days: horizon, data_source: dataSource };
    const audit = await fetchEngine('/api/compare', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    // Record run ownership for generated runs
    const currentUser = (req as any).user;
    if (currentUser?.id) {
      if (audit?.baseline_plan?.run_id) {
        recordUserRun(audit.baseline_plan.run_id, currentUser.id, 'baseline', horizon, dataSource);
      }
      if (audit?.optimized_plan?.run_id) {
        recordUserRun(audit.optimized_plan.run_id, currentUser.id, 'optimized_ortools', horizon, dataSource);
      }
    }

    res.json(audit);
  } catch (err: any) {
    res.status(502).json({ error: 'Optimization comparison failed', details: err.message });
  }
});

// Saved Planning Run Lookup API (Protected with Ownership Verification)
app.get('/api/runs/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const runId = req.params.id;
    const currentUser = (req as any).user;

    if (!userOwnsRun(runId, currentUser.id)) {
      res.status(403).json({
        error: 'Forbidden',
        message: 'Access denied: You do not have permission to view this planning run.'
      });
      return;
    }

    const runData = await fetchEngine(`/api/runs/${runId}`);
    res.json(runData);
  } catch (err: any) {
    res.status(502).json({ error: 'Failed to retrieve planning run', details: err.message });
  }
});

// Plan CSV Export API (Protected with Ownership Verification)
app.get('/api/optimization/runs/:id/export', requireAuth, async (req: Request, res: Response) => {
  try {
    const runId = req.params.id;
    const currentUser = (req as any).user;

    if (!userOwnsRun(runId, currentUser.id)) {
      res.status(403).json({
        error: 'Forbidden',
        message: 'Access denied: You do not have permission to export this planning run.'
      });
      return;
    }

    const csvContent = await fetchEngine(`/api/export/${runId}`);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=supplysync_distribution_${runId}.csv`);
    res.send(csvContent);
  } catch (err: any) {
    res.status(502).json({ error: 'Failed to export distribution plan', details: err.message });
  }
});

// Initialize server and seed default persistent evaluator account
async function startServer() {
  await seedDefaultEvaluator();

  app.listen(PORT, () => {
    console.log(`SupplySync API Gateway listening on http://localhost:${PORT}`);
    console.log(`Optimization Engine Target: ${ENGINE_URL}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start SupplySync API Gateway:', err);
  process.exit(1);
});
