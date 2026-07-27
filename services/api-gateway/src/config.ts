import { getBaseEnv, loadServicePort } from '@intellistore/shared-config';

export const config = {
  ...getBaseEnv(),
  serviceName: 'api-gateway',
  port: loadServicePort('API_GATEWAY_PORT', 4000),
  upstreams: {
    auth: process.env.AUTH_SERVICE_URL ?? 'http://localhost:4001',
    metadata: process.env.METADATA_SERVICE_URL ?? 'http://localhost:4002',
    storage: process.env.STORAGE_SERVICE_URL ?? 'http://localhost:4003',
    replication: process.env.REPLICATION_SERVICE_URL ?? 'http://localhost:4004',
    aiAnalytics: process.env.AI_ANALYTICS_SERVICE_URL ?? 'http://localhost:4005',
  },
  rateLimit: {
    windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS ?? 60_000),
    max: Number(process.env.RATE_LIMIT_MAX ?? 300),
  },
};
