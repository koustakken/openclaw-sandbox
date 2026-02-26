import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { db } from '../db';
import type { PublicUser, User } from '../types/auth';

const registerSchema = z.object({
  email: z.email(),
  password: z.string().min(8)
});

const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1)
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1)
});

type UserRow = {
  id: string;
  email: string;
  password_hash: string;
  created_at: string;
};

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

export async function registerUser(email: string, password: string): Promise<PublicUser> {
  const normalizedEmail = email.toLowerCase().trim();

  const existing = db
    .prepare('SELECT id, email, password_hash, created_at FROM users WHERE email = ?')
    .get(normalizedEmail) as UserRow | undefined;

  if (existing) {
    throw new Error('USER_ALREADY_EXISTS');
  }

  const user: User = {
    id: crypto.randomUUID(),
    email: normalizedEmail,
    passwordHash: await bcrypt.hash(password, 10),
    createdAt: new Date().toISOString()
  };

  db.prepare('INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)').run(
    user.id,
    user.email,
    user.passwordHash,
    user.createdAt
  );

  return toPublicUser(user);
}

export async function loginUser(email: string, password: string): Promise<PublicUser> {
  const normalizedEmail = email.toLowerCase().trim();

  const row = db
    .prepare('SELECT id, email, password_hash, created_at FROM users WHERE email = ?')
    .get(normalizedEmail) as UserRow | undefined;

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

export function issueRefreshToken(user: PublicUser): string {
  const refreshToken = crypto.randomUUID();

  db.prepare('INSERT INTO refresh_tokens (token, user_id, created_at) VALUES (?, ?, ?)').run(
    refreshToken,
    user.id,
    new Date().toISOString()
  );

  return refreshToken;
}

export function rotateRefreshToken(refreshToken: string): {
  accessToken: string;
  refreshToken: string;
} {
  const row = db
    .prepare(
      `SELECT u.id, u.email, u.password_hash, u.created_at
       FROM refresh_tokens rt
       JOIN users u ON u.id = rt.user_id
       WHERE rt.token = ?`
    )
    .get(refreshToken) as UserRow | undefined;

  if (!row) {
    throw new Error('INVALID_REFRESH_TOKEN');
  }

  db.prepare('DELETE FROM refresh_tokens WHERE token = ?').run(refreshToken);

  const user = toUser(row);
  const publicUser = toPublicUser(user);
  const nextRefreshToken = issueRefreshToken(publicUser);

  return {
    accessToken: signAccessToken(publicUser),
    refreshToken: nextRefreshToken
  };
}

export function revokeRefreshToken(refreshToken: string) {
  db.prepare('DELETE FROM refresh_tokens WHERE token = ?').run(refreshToken);
}
