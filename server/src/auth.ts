import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { getDatabase, UserRecord, SessionRecord, UserRunRecord } from './db';

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const SESSION_EXPIRY_HOURS = parseInt(process.env.SESSION_EXPIRY_HOURS || '24', 10);

export function normalizeEmail(email: string): string {
  if (typeof email !== 'string') return '';
  return email.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  const normalized = normalizeEmail(email);
  if (normalized.length > 254) return false;
  return EMAIL_REGEX.test(normalized);
}

export function validatePassword(password: string): { valid: boolean; error?: string } {
  if (!password || typeof password !== 'string') {
    return { valid: false, error: 'Password is required' };
  }
  if (password.length < 8) {
    return { valid: false, error: 'Password must be at least 8 characters long' };
  }
  if (password.length > 128) {
    return { valid: false, error: 'Password cannot exceed 128 characters' };
  }
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasNumberOrSymbol = /[0-9!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password);
  if (!hasLetter || !hasNumberOrSymbol) {
    return { valid: false, error: 'Password must contain both letters and numbers/symbols' };
  }
  return { valid: true };
}

export function sanitizeUser(user: UserRecord): { id: string; email: string; name: string; role: string; created_at: string } {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    created_at: user.created_at
  };
}

export async function hashPassword(password: string): Promise<string> {
  const saltRounds = 10;
  return await bcrypt.hash(password, saltRounds);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return await bcrypt.compare(password, hash);
}

export function getUserByEmail(email: string): UserRecord | null {
  const db = getDatabase();
  const normalized = normalizeEmail(email);
  const stmt = db.prepare('SELECT * FROM users WHERE email = ?');
  const user = stmt.get(normalized) as UserRecord | undefined;
  return user || null;
}

export function getUserById(id: string): UserRecord | null {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM users WHERE id = ?');
  const user = stmt.get(id) as UserRecord | undefined;
  return user || null;
}

export async function createUser(params: {
  email: string;
  password: string;
  name?: string;
  role?: string;
}): Promise<UserRecord> {
  const db = getDatabase();
  const normalized = normalizeEmail(params.email);
  const name = (params.name && params.name.trim()) || normalized.split('@')[0];
  const role = params.role || 'planner';
  const id = `usr_${crypto.randomBytes(12).toString('hex')}`;
  const passwordHash = await hashPassword(params.password);
  const now = new Date().toISOString();

  const stmt = db.prepare(`
    INSERT INTO users (id, email, name, password_hash, role, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(id, normalized, name, passwordHash, role, now, now);

  return {
    id,
    email: normalized,
    name,
    password_hash: passwordHash,
    role,
    created_at: now,
    updated_at: now
  };
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function createSession(userId: string, expiryHours = SESSION_EXPIRY_HOURS): { token: string; expiresAt: string } {
  const db = getDatabase();
  const token = `sess_${crypto.randomBytes(32).toString('hex')}`;
  const tokenHash = hashToken(token);
  const now = new Date();
  const expires = new Date(now.getTime() + expiryHours * 60 * 60 * 1000);
  const createdAtStr = now.toISOString();
  const expiresAtStr = expires.toISOString();

  const stmt = db.prepare(`
    INSERT INTO sessions (id, user_id, created_at, expires_at, revoked_at)
    VALUES (?, ?, ?, ?, NULL)
  `);
  stmt.run(tokenHash, userId, createdAtStr, expiresAtStr);

  return {
    token,
    expiresAt: expiresAtStr
  };
}

export function verifySession(token: string): { user: UserRecord; session: SessionRecord } | null {
  if (!token || typeof token !== 'string') return null;

  const db = getDatabase();
  const tokenHash = hashToken(token);
  const stmt = db.prepare(`
    SELECT 
      s.id as session_id,
      s.user_id,
      s.created_at as session_created_at,
      s.expires_at,
      s.revoked_at,
      u.id as user_id_val,
      u.email,
      u.name,
      u.password_hash,
      u.role,
      u.created_at as user_created_at,
      u.updated_at as user_updated_at
    FROM sessions s
    JOIN users u ON s.user_id = u.id
    WHERE s.id = ?
  `);

  const row = stmt.get(tokenHash) as any;
  if (!row) return null;

  // Check if session has been revoked
  if (row.revoked_at !== null) {
    return null;
  }

  // Check if session has expired
  const expiresAt = new Date(row.expires_at);
  if (isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
    return null;
  }

  const user: UserRecord = {
    id: row.user_id_val,
    email: row.email,
    name: row.name,
    password_hash: row.password_hash,
    role: row.role,
    created_at: row.user_created_at,
    updated_at: row.user_updated_at
  };

  const session: SessionRecord = {
    id: row.session_id,
    user_id: row.user_id,
    created_at: row.session_created_at,
    expires_at: row.expires_at,
    revoked_at: row.revoked_at
  };

  return { user, session };
}

export function revokeSession(token: string): boolean {
  if (!token || typeof token !== 'string') return false;
  const db = getDatabase();
  const tokenHash = hashToken(token);
  const now = new Date().toISOString();
  const stmt = db.prepare(`
    UPDATE sessions
    SET revoked_at = ?
    WHERE id = ? AND revoked_at IS NULL
  `);
  const result = stmt.run(now, tokenHash);
  return result.changes > 0;
}

export function recordUserRun(
  runId: string, 
  userId: string, 
  strategy: string, 
  planningHorizonDays: number, 
  dataSource: string
): void {
  const db = getDatabase();
  const now = new Date().toISOString();
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO user_runs (run_id, user_id, strategy, planning_horizon_days, data_source, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  stmt.run(runId, userId, strategy, planningHorizonDays, dataSource, now);
}

export function getUserRun(runId: string): UserRunRecord | null {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM user_runs WHERE run_id = ?');
  const run = stmt.get(runId) as UserRunRecord | undefined;
  return run || null;
}

export function userOwnsRun(runId: string, userId: string): boolean {
  const run = getUserRun(runId);
  if (!run) return false;
  return run.user_id === userId;
}

/**
 * Ensures a persistent evaluator account exists for demonstration purposes.
 * Evaluator credentials are NEVER hardcoded in source code; they must be supplied via DEMO_USER_PASSWORD.
 * In production, seeding fails safely if DEMO_USER_PASSWORD is missing or uses known insecure defaults.
 */
export async function seedDefaultEvaluator(): Promise<void> {
  const defaultEmail = 'evaluator@supplysync.io';
  const existing = getUserByEmail(defaultEmail);
  if (existing) {
    return;
  }

  const password = process.env.DEMO_USER_PASSWORD;
  if (!password) {
    console.log('[Auth] Evaluator auto-seeding skipped: DEMO_USER_PASSWORD environment variable not set.');
    return;
  }

  const isProd = process.env.NODE_ENV === 'production';
  if (isProd) {
    if (password.length < 12 || password === 'SupplySync2026!') {
      console.warn('[Auth] Production evaluator seeding disabled: DEMO_USER_PASSWORD must be at least 12 characters and not use known development defaults.');
      return;
    }
  }

  await createUser({
    email: defaultEmail,
    password,
    name: 'Triwizathon Evaluator',
    role: 'lead_planner'
  });
  console.log(`[Auth] Seeded evaluator account: ${defaultEmail}`);
}
