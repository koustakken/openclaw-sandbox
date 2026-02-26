import fs from 'node:fs';
import path from 'node:path';
import BetterSqlite3 from 'better-sqlite3';

const dbPath = process.env.DATABASE_PATH ?? path.resolve(process.cwd(), 'data/auth.db');
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

export const db: BetterSqlite3.Database = new BetterSqlite3(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS refresh_tokens (
    token TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`);
