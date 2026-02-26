import express, { type Express } from 'express';
import cors from 'cors';
import { healthRouter } from './routes/health';

export function createApp(): Express {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.use('/health', healthRouter);

  return app;
}
