import path from 'path';
import fs from 'fs';

// Using Node.js native SQLite database sync module
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { DatabaseSync } = require('node:sqlite');

export interface UserRecord {
  id: string;
  email: string;
  name: string;
  password_hash: string;
  role: string;
  created_at: string;
  updated_at: string;
}

export interface SessionRecord {
  id: string;
  user_id: string;
  created_at: string;
  expires_at: string;
  revoked_at: string | null;
}

export interface UserRunRecord {
  run_id: string;
  user_id: string;
  strategy: string;
  planning_horizon_days: number;
  data_source: string;
  created_at: string;
}

// Database location
const DB_DIR = path.resolve(__dirname, '../../data');
const DB_PATH = process.env.DATABASE_PATH || path.join(DB_DIR, 'supplysync.db');

let dbInstance: any = null;

export function getDatabase(): any {
  if (dbInstance) {
    return dbInstance;
  }

  // Ensure target directory exists
  const targetDir = path.dirname(DB_PATH);
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  dbInstance = new DatabaseSync(DB_PATH);

  // Enable WAL mode and foreign keys for durability and performance
  dbInstance.exec('PRAGMA journal_mode = WAL;');
  dbInstance.exec('PRAGMA foreign_keys = ON;');

  // Initialize schema
  dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'planner',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      revoked_at TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

    CREATE TABLE IF NOT EXISTS user_runs (
      run_id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      strategy TEXT NOT NULL,
      planning_horizon_days INTEGER NOT NULL,
      data_source TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_user_runs_user_id ON user_runs(user_id);
  `);

  return dbInstance;
}

export const db = {
  get: getDatabase
};
