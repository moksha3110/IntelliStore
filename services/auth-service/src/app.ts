import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import type { Logger } from '@intellistore/shared-logger';
import type { ApiResponse } from '@intellistore/shared-types';
import { healthRouter } from './routes/health.route';

export function createApp(logger: Logger): Express {
  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(express.json());

  app.use((req, _res, next) => {
    logger.info({ method: req.method, path: req.path }, 'incoming request');
    next();
  });

  app.use(healthRouter);

  app.use((_req: Request, res: Response) => {
    const body: ApiResponse<never> = {
      success: false,
      error: { code: 'NOT_FOUND', message: 'Route not found' },
    };
    res.status(404).json(body);
  });

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    logger.error({ err }, 'unhandled error');
    const body: ApiResponse<never> = {
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
    };
    res.status(500).json(body);
  });

  return app;
}
