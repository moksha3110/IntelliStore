import { getBaseEnv, loadServicePort } from '@intellistore/shared-config';

const DEFAULT_RECENCY_HALF_LIFE_DAYS = 14;
const DEFAULT_FREQUENCY_CAP = 20;
const DEFAULT_HOT_THRESHOLD = 50;
const DEFAULT_COLD_AGE_THRESHOLD_DAYS = 30;

export const config = {
  ...getBaseEnv(),
  serviceName: 'ai-analytics-service',
  port: loadServicePort('AI_ANALYTICS_SERVICE_PORT', 4005),
  metadataServiceUrl: process.env.METADATA_SERVICE_URL ?? 'http://localhost:4002',
  replicationServiceUrl: process.env.REPLICATION_SERVICE_URL ?? 'http://localhost:4004',
  fileAccessQueue: process.env.FILE_ACCESS_QUEUE ?? 'file-access-events',
  scoring: {
    recencyHalfLifeDays: Number(
      process.env.RECENCY_HALF_LIFE_DAYS ?? DEFAULT_RECENCY_HALF_LIFE_DAYS,
    ),
    frequencyCap: Number(process.env.FREQUENCY_CAP ?? DEFAULT_FREQUENCY_CAP),
    hotThreshold: Number(process.env.HOT_THRESHOLD ?? DEFAULT_HOT_THRESHOLD),
    coldAgeThresholdDays: Number(
      process.env.COLD_AGE_THRESHOLD_DAYS ?? DEFAULT_COLD_AGE_THRESHOLD_DAYS,
    ),
  },
};
