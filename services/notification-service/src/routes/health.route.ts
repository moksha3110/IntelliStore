import { Router } from 'express';
import type { ApiResponse } from '@intellistore/shared-types';

export const healthRouter = Router();

interface HealthPayload {
  service: string;
  status: 'ok';
  uptimeSeconds: number;
  timestamp: string;
}

healthRouter.get('/health', (_req, res) => {
  const body: ApiResponse<HealthPayload> = {
    success: true,
    data: {
      service: 'notification-service',
      status: 'ok',
      uptimeSeconds: process.uptime(),
      timestamp: new Date().toISOString(),
    },
  };
  res.status(200).json(body);
});
