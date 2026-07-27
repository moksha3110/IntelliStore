import { Router } from 'express';
import type { ApiResponse } from '@intellistore/shared-types';
import { config } from '../config';

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
      service: 'api-gateway',
      status: 'ok',
      uptimeSeconds: process.uptime(),
      timestamp: new Date().toISOString(),
    },
  };
  res.status(200).json(body);
});

interface UpstreamHealth {
  service: string;
  reachable: boolean;
}

// Aggregate view of every upstream's liveness, so an operator (or the
// dashboard) can see the whole platform's health from one call.
healthRouter.get('/health/services', async (_req, res) => {
  const targets: Record<string, string> = {
    'auth-service': config.upstreams.auth,
    'metadata-service': config.upstreams.metadata,
    'storage-service': config.upstreams.storage,
    'replication-service': config.upstreams.replication,
    'ai-analytics-service': config.upstreams.aiAnalytics,
  };

  const results: UpstreamHealth[] = await Promise.all(
    Object.entries(targets).map(async ([service, url]) => {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3000);
        const upstream = await fetch(`${url}/health`, { signal: controller.signal });
        clearTimeout(timeout);
        return { service, reachable: upstream.ok };
      } catch {
        return { service, reachable: false };
      }
    }),
  );

  const allHealthy = results.every((r) => r.reachable);
  const body: ApiResponse<{ allHealthy: boolean; services: UpstreamHealth[] }> = {
    success: true,
    data: { allHealthy, services: results },
  };
  res.status(200).json(body);
});
