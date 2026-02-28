import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';
import { z } from 'zod';
import { db } from '../db';
import type { PublicUser, User } from '../types/auth';

const registerSchema = z.object({
  username: z
    .string()
    .min(3)
    .regex(/^[a-zA-Z0-9_\-.]+$/),
  email: z.email(),
  password: z.string().min(8)
});

const loginSchema = z.object({
  email: z.string().min(1),
  password: z.string().min(1)
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1)
});

const MAX_SESSIONS_PER_USER = 5;

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

type UserRow = {
  id: string;
  email: string;
  password_hash: string;
  created_at: string;
};

const databaseUrl = process.env.DATABASE_URL;
const normalizedDatabaseUrl = databaseUrl?.replace('sslmode=require', 'sslmode=no-verify');
const pool = normalizedDatabaseUrl
  ? new Pool({
      connectionString: normalizedDatabaseUrl,
      ssl: { rejectUnauthorized: false }
    })
  : null;
let pgReady = false;

async function ensurePgSchema() {
  if (!pool || pgReady) return;

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS refresh_tokens (
      token_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL
    );
  `);

  pgReady = true;
}

function toUser(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    createdAt: row.created_at
  };
}

function toPublicUser(user: User): PublicUser {
  const { passwordHash: _passwordHash, ...rest } = user;
  return rest;
}

export function parseRegisterInput(input: unknown) {
  return registerSchema.parse(input);
}

export function parseLoginInput(input: unknown) {
  return loginSchema.parse(input);
}

export function parseRefreshInput(input: unknown) {
  return refreshSchema.parse(input);
}

let demoSeeded = false;

async function seedDemoUsers() {
  if (demoSeeded) return;
  demoSeeded = true;

  const demos = [
    { username: 'tema', email: 'tema@example.com', password: 'password123' },
    { username: 'ilya', email: 'ilya@example.com', password: 'password123' },
    { username: 'anna', email: 'anna@example.com', password: 'password123' }
  ];

  for (const d of demos) {
    const existing = await findUserByEmail(d.email);
    if (!existing) {
      try {
        await registerUser(d.username, d.email, d.password);
      } catch {
        // ignore seed errors
      }
    }
  }
}

async function findUserByUsername(username: string): Promise<UserRow | undefined> {
  await ensureProfilesSchema();

  if (pool) {
    await ensurePgSchema();
    const result = await pool.query<UserRow>(
      `SELECT u.id, u.email, u.password_hash, u.created_at
       FROM user_profiles p
       JOIN users u ON u.id = p.user_id
       WHERE p.username = $1
       LIMIT 1`,
      [username]
    );
    return result.rows[0];
  }

  return db
    .prepare(
      `SELECT u.id as id, u.email as email, u.password_hash as password_hash, u.created_at as created_at
       FROM user_profiles p
       JOIN users u ON u.id = p.user_id
       WHERE p.username = ?
       LIMIT 1`
    )
    .get(username) as UserRow | undefined;
}

async function findUserByEmail(email: string): Promise<UserRow | undefined> {
  if (pool) {
    await ensurePgSchema();
    const result = await pool.query<UserRow>(
      'SELECT id, email, password_hash, created_at FROM users WHERE email = $1 LIMIT 1',
      [email]
    );
    return result.rows[0];
  }

  return db
    .prepare('SELECT id, email, password_hash, created_at FROM users WHERE email = ?')
    .get(email) as UserRow | undefined;
}

async function insertUser(user: User): Promise<void> {
  if (pool) {
    await ensurePgSchema();
    await pool.query(
      'INSERT INTO users (id, email, password_hash, created_at) VALUES ($1, $2, $3, $4)',
      [user.id, user.email, user.passwordHash, user.createdAt]
    );
    return;
  }

  db.prepare('INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)').run(
    user.id,
    user.email,
    user.passwordHash,
    user.createdAt
  );
}

async function ensureProfilesSchema() {
  if (pool) {
    await ensurePgSchema();
    await pool.query(
      `CREATE TABLE IF NOT EXISTS user_profiles (
        user_id TEXT PRIMARY KEY,
        username TEXT NOT NULL DEFAULT '',
        first_name TEXT NOT NULL DEFAULT '',
        last_name TEXT NOT NULL DEFAULT '',
        contacts TEXT NOT NULL DEFAULT '',
        city TEXT NOT NULL DEFAULT '',
        weight_category TEXT NOT NULL DEFAULT '',
        current_weight DOUBLE PRECISION NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL
      )`
    );
    await pool.query("ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS username TEXT DEFAULT ''");
    return;
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS user_profiles (
      user_id TEXT PRIMARY KEY,
      username TEXT NOT NULL DEFAULT '',
      first_name TEXT NOT NULL DEFAULT '',
      last_name TEXT NOT NULL DEFAULT '',
      contacts TEXT NOT NULL DEFAULT '',
      city TEXT NOT NULL DEFAULT '',
      weight_category TEXT NOT NULL DEFAULT '',
      current_weight REAL NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL
    )
  `);
  try {
    db.exec("ALTER TABLE user_profiles ADD COLUMN username TEXT NOT NULL DEFAULT ''");
  } catch {
    // exists
  }
}

async function isUsernameTaken(username: string, exceptUserId?: string): Promise<boolean> {
  await ensureProfilesSchema();
  if (pool) {
    const result = await pool.query<{ user_id: string }>(
      'SELECT user_id FROM user_profiles WHERE username = $1 LIMIT 1',
      [username]
    );
    const uid = result.rows[0]?.user_id;
    return Boolean(uid && uid !== exceptUserId);
  }

  const row = db.prepare('SELECT user_id FROM user_profiles WHERE username = ?').get(username) as
    | { user_id: string }
    | undefined;
  return Boolean(row?.user_id && row.user_id !== exceptUserId);
}

async function upsertUsername(userId: string, username: string) {
  await ensureProfilesSchema();
  const now = new Date().toISOString();

  if (pool) {
    await pool.query(
      `INSERT INTO user_profiles (user_id, username, updated_at)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id) DO UPDATE SET username = EXCLUDED.username, updated_at = EXCLUDED.updated_at`,
      [userId, username, now]
    );
    return;
  }

  const exists = db.prepare('SELECT user_id FROM user_profiles WHERE user_id = ?').get(userId);
  if (exists) {
    db.prepare('UPDATE user_profiles SET username = ?, updated_at = ? WHERE user_id = ?').run(
      username,
      now,
      userId
    );
  } else {
    db.prepare('INSERT INTO user_profiles (user_id, username, updated_at) VALUES (?, ?, ?)').run(
      userId,
      username,
      now
    );
  }
}

export async function registerUser(
  username: string,
  email: string,
  password: string
): Promise<PublicUser> {
  await seedDemoUsers();
  const normalizedEmail = email.toLowerCase().trim();
  const normalizedUsername = username.trim().toLowerCase();

  const existing = await findUserByEmail(normalizedEmail);
  if (existing) {
    throw new Error('USER_ALREADY_EXISTS');
  }
  if (await isUsernameTaken(normalizedUsername)) {
    throw new Error('USERNAME_TAKEN');
  }

  const user: User = {
    id: crypto.randomUUID(),
    email: normalizedEmail,
    passwordHash: await bcrypt.hash(password, 10),
    createdAt: new Date().toISOString()
  };

  await insertUser(user);
  await upsertUsername(user.id, normalizedUsername);
  return toPublicUser(user);
}

export async function loginUser(email: string, password: string): Promise<PublicUser> {
  await seedDemoUsers();
  const login = email.toLowerCase().trim();

  const row = login.includes('@') ? await findUserByEmail(login) : await findUserByUsername(login);
  if (!row) {
    throw new Error('INVALID_CREDENTIALS');
  }

  const user = toUser(row);
  const isValid = await bcrypt.compare(password, user.passwordHash);
  if (!isValid) {
    throw new Error('INVALID_CREDENTIALS');
  }

  return toPublicUser(user);
}

export function signAccessToken(user: PublicUser): string {
  const secret = process.env.JWT_SECRET ?? 'dev-secret-change-me';

  return jwt.sign(
    {
      sub: user.id,
      email: user.email
    },
    secret,
    { expiresIn: '15m' }
  );
}

export function verifyAccessToken(token: string): { sub: string; email: string } {
  const secret = process.env.JWT_SECRET ?? 'dev-secret-change-me';
  return jwt.verify(token, secret) as { sub: string; email: string };
}

async function cleanupSessions(userId: string) {
  if (pool) {
    await ensurePgSchema();
    await pool.query(
      `DELETE FROM refresh_tokens
       WHERE token_hash IN (
         SELECT token_hash
         FROM refresh_tokens
         WHERE user_id = $1
         ORDER BY created_at DESC
         OFFSET $2
       )`,
      [userId, MAX_SESSIONS_PER_USER]
    );
    return;
  }

  db.prepare(
    `DELETE FROM refresh_tokens
     WHERE token_hash IN (
       SELECT token_hash
       FROM refresh_tokens
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT -1 OFFSET ?
     )`
  ).run(userId, MAX_SESSIONS_PER_USER);
}

export async function issueRefreshToken(user: PublicUser): Promise<string> {
  const refreshToken = crypto.randomUUID();
  const tokenHash = hashToken(refreshToken);
  const createdAt = new Date().toISOString();

  if (pool) {
    await ensurePgSchema();
    await pool.query(
      'INSERT INTO refresh_tokens (token_hash, user_id, created_at) VALUES ($1, $2, $3)',
      [tokenHash, user.id, createdAt]
    );
  } else {
    db.prepare('INSERT INTO refresh_tokens (token_hash, user_id, created_at) VALUES (?, ?, ?)').run(
      tokenHash,
      user.id,
      createdAt
    );
  }

  await cleanupSessions(user.id);
  return refreshToken;
}

export async function rotateRefreshToken(refreshToken: string): Promise<{
  accessToken: string;
  refreshToken: string;
}> {
  const tokenHash = hashToken(refreshToken);

  let row: UserRow | undefined;
  if (pool) {
    await ensurePgSchema();
    const result = await pool.query<UserRow>(
      `SELECT u.id, u.email, u.password_hash, u.created_at
       FROM refresh_tokens rt
       JOIN users u ON u.id = rt.user_id
       WHERE rt.token_hash = $1
       LIMIT 1`,
      [tokenHash]
    );
    row = result.rows[0];
  } else {
    row = db
      .prepare(
        `SELECT u.id, u.email, u.password_hash, u.created_at
         FROM refresh_tokens rt
         JOIN users u ON u.id = rt.user_id
         WHERE rt.token_hash = ?`
      )
      .get(tokenHash) as UserRow | undefined;
  }

  if (!row) {
    throw new Error('INVALID_REFRESH_TOKEN');
  }

  if (pool) {
    await pool.query('DELETE FROM refresh_tokens WHERE token_hash = $1', [tokenHash]);
  } else {
    db.prepare('DELETE FROM refresh_tokens WHERE token_hash = ?').run(tokenHash);
  }

  const user = toUser(row);
  const publicUser = toPublicUser(user);
  const nextRefreshToken = await issueRefreshToken(publicUser);

  return {
    accessToken: signAccessToken(publicUser),
    refreshToken: nextRefreshToken
  };
}

export async function revokeRefreshToken(refreshToken: string) {
  const tokenHash = hashToken(refreshToken);

  if (pool) {
    await ensurePgSchema();
    await pool.query('DELETE FROM refresh_tokens WHERE token_hash = $1', [tokenHash]);
    return;
  }

  db.prepare('DELETE FROM refresh_tokens WHERE token_hash = ?').run(tokenHash);
}

async function findUserById(userId: string): Promise<UserRow | undefined> {
  if (pool) {
    await ensurePgSchema();
    const result = await pool.query<UserRow>(
      'SELECT id, email, password_hash, created_at FROM users WHERE id = $1 LIMIT 1',
      [userId]
    );
    return result.rows[0];
  }

  return db
    .prepare('SELECT id, email, password_hash, created_at FROM users WHERE id = ?')
    .get(userId) as UserRow | undefined;
}

export async function changePassword(userId: string, currentPassword: string, newPassword: string) {
  const row = await findUserById(userId);
  if (!row) throw new Error('USER_NOT_FOUND');

  const valid = await bcrypt.compare(currentPassword, row.password_hash);
  if (!valid) throw new Error('INVALID_CREDENTIALS');

  const nextHash = await bcrypt.hash(newPassword, 10);

  if (pool) {
    await ensurePgSchema();
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [nextHash, userId]);
    return;
  }

  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(nextHash, userId);
}

export async function deleteAccount(userId: string) {
  if (pool) {
    await ensurePgSchema();
    await pool.query('DELETE FROM refresh_tokens WHERE user_id = $1', [userId]);
    await pool.query('DELETE FROM users WHERE id = $1', [userId]);
    return;
  }

  db.prepare('DELETE FROM refresh_tokens WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM users WHERE id = ?').run(userId);
}
