import { Router } from 'express';
import { z } from 'zod';
import {
  issueRefreshToken,
  loginUser,
  parseLoginInput,
  parseRefreshInput,
  parseRegisterInput,
  registerUser,
  revokeRefreshToken,
  rotateRefreshToken,
  signAccessToken
} from '../services/authService';
import { requireAuth, type AuthenticatedRequest } from '../middleware/authMiddleware';

export const authRouter: Router = Router();

authRouter.post('/register', async (req, res) => {
  try {
    const { email, password } = parseRegisterInput(req.body);
    const user = await registerUser(email, password);

    return res.status(201).json({
      user,
      accessToken: signAccessToken(user),
      refreshToken: issueRefreshToken(user)
    });
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

    return res.json({
      user,
      accessToken: signAccessToken(user),
      refreshToken: issueRefreshToken(user)
    });
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

authRouter.post('/refresh', (req, res) => {
  try {
    const { refreshToken } = parseRefreshInput(req.body);
    const rotated = rotateRefreshToken(refreshToken);
    return res.json(rotated);
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ message: 'Invalid input', issues: err.issues });
    }

    if (err instanceof Error && err.message === 'INVALID_REFRESH_TOKEN') {
      return res.status(401).json({ message: 'Invalid refresh token' });
    }

    return res.status(500).json({ message: 'Internal server error' });
  }
});

authRouter.post('/logout', (req, res) => {
  try {
    const { refreshToken } = parseRefreshInput(req.body);
    revokeRefreshToken(refreshToken);
    return res.status(204).send();
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ message: 'Invalid input', issues: err.issues });
    }

    return res.status(500).json({ message: 'Internal server error' });
  }
});

authRouter.get('/me', requireAuth, (req: AuthenticatedRequest, res) => {
  return res.json({ user: req.auth });
});
