import type { NextFunction, Request, Response } from 'express';
import { verifyAccessToken } from '../services/authService';

export type AuthPayload = {
  sub: string;
  email: string;
};

export type AuthenticatedRequest = Request & {
  auth?: AuthPayload;
};

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;

  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const token = header.slice('Bearer '.length);

  try {
    req.auth = verifyAccessToken(token);
    return next();
  } catch {
    return res.status(401).json({ message: 'Invalid token' });
  }
}
