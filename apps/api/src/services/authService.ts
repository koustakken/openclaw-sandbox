import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import type { PublicUser, User } from '../types/auth';

const registerSchema = z.object({
  email: z.email(),
  password: z.string().min(8)
});

const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1)
});

const users = new Map<string, User>();

function toPublicUser(user: User): PublicUser {
  const rest = { ...user };
  delete rest.passwordHash;
  return rest;
}

export function parseRegisterInput(input: unknown) {
  return registerSchema.parse(input);
}

export function parseLoginInput(input: unknown) {
  return loginSchema.parse(input);
}

export async function registerUser(email: string, password: string): Promise<PublicUser> {
  const normalizedEmail = email.toLowerCase().trim();

  if (users.has(normalizedEmail)) {
    throw new Error('USER_ALREADY_EXISTS');
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user: User = {
    id: crypto.randomUUID(),
    email: normalizedEmail,
    passwordHash,
    createdAt: new Date().toISOString()
  };

  users.set(normalizedEmail, user);
  return toPublicUser(user);
}

export async function loginUser(email: string, password: string): Promise<PublicUser> {
  const normalizedEmail = email.toLowerCase().trim();
  const user = users.get(normalizedEmail);

  if (!user) {
    throw new Error('INVALID_CREDENTIALS');
  }

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
    { expiresIn: '7d' }
  );
}

export function verifyAccessToken(token: string): { sub: string; email: string } {
  const secret = process.env.JWT_SECRET ?? 'dev-secret-change-me';
  return jwt.verify(token, secret) as { sub: string; email: string };
}

export function getUserByEmail(email: string): PublicUser | null {
  const user = users.get(email.toLowerCase().trim());
  return user ? toPublicUser(user) : null;
}
