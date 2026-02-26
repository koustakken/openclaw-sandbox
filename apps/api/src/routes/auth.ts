import { Router } from 'express';
import { z } from 'zod';
import {
  loginUser,
  parseLoginInput,
  parseRegisterInput,
  registerUser,
  signAccessToken
} from '../services/authService';
import { requireAuth, type AuthenticatedRequest } from '../middleware/authMiddleware';

export const authRouter: Router = Router();

authRouter.post('/register', async (req, res) => {
  try {
    const { email, password } = parseRegisterInput(req.body);
    const user = await registerUser(email, password);
    const accessToken = signAccessToken(user);

    return res.status(201).json({ user, accessToken });
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ message: 'Invalid input', issues: err.issues });
    }

    if (err instanceof Error && err.message === 'USER_ALREADY_EXISTS') {
      return res.status(409).json({ message: 'User already exists' });
    }

    return res.status(500).json({ message: 'Internal server error' });
  }
});

authRouter.post('/login', async (req, res) => {
  try {
    const { email, password } = parseLoginInput(req.body);
    const user = await loginUser(email, password);
    const accessToken = signAccessToken(user);

    return res.json({ user, accessToken });
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ message: 'Invalid input', issues: err.issues });
    }

    if (err instanceof Error && err.message === 'INVALID_CREDENTIALS') {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    return res.status(500).json({ message: 'Internal server error' });
  }
});

authRouter.get('/me', requireAuth, (req: AuthenticatedRequest, res) => {
  return res.json({ user: req.auth });
});
