export const serviceUrls = {
  auth: process.env.NEXT_PUBLIC_AUTH_SERVICE_URL ?? 'http://localhost:4001',
  metadata: process.env.NEXT_PUBLIC_METADATA_SERVICE_URL ?? 'http://localhost:4002',
  storage: process.env.NEXT_PUBLIC_STORAGE_SERVICE_URL ?? 'http://localhost:4003',
  replication: process.env.NEXT_PUBLIC_REPLICATION_SERVICE_URL ?? 'http://localhost:4004',
  aiAnalytics: process.env.NEXT_PUBLIC_AI_ANALYTICS_SERVICE_URL ?? 'http://localhost:4005',
};
