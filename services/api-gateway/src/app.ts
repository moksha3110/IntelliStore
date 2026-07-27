import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import type { Logger } from '@intellistore/shared-logger';
import type { ApiResponse } from '@intellistore/shared-types';
import { config } from './config';
import { healthRouter } from './routes/health.route';
import { mountProxies } from './routes/proxy';

export function createApp(logger: Logger): Express {
  const app = express();

  app.use(helmet());
  app.use(cors());

  app.use((req, _res, next) => {
    logger.info({ method: req.method, path: req.path }, 'incoming request');
    next();
  });

  // NOTE: deliberately no body parser. The gateway only proxies — parsing the
  // body here would consume the request stream and break both JSON POSTs and
  // multipart uploads forwarded downstream. Health routes are GET-only.
  app.use(healthRouter);

  // Rate limit only the proxied API surface, so k8s liveness/readiness probes
  // on /health are never throttled.
  app.use(
    '/api',
    rateLimit({
      windowMs: config.rateLimit.windowMs,
      limit: config.rateLimit.max,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
      message: {
        success: false,
        error: { code: 'RATE_LIMITED', message: 'Too many requests, slow down' },
      },
    }),
  );

  mountProxies(app, logger);

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
