import { Router } from 'express';
import { getHealth } from '../services/healthService';

export const healthRouter: Router = Router();

healthRouter.get('/', (_req, res) => {
  res.json(getHealth());
});
