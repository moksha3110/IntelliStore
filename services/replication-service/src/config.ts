import { getBaseEnv, loadServicePort } from '@intellistore/shared-config';

const DEFAULT_REPLICATION_FACTOR = 2;
const DEFAULT_HEARTBEAT_STALE_MS = 15_000;
const DEFAULT_HEARTBEAT_SWEEP_INTERVAL_MS = 5_000;
const DEFAULT_SELF_HEALING_INTERVAL_MS = 10_000;

export const config = {
  ...getBaseEnv(),
  serviceName: 'replication-service',
  port: loadServicePort('REPLICATION_SERVICE_PORT', 4004),
  replicationFactor: Number(process.env.REPLICATION_FACTOR ?? DEFAULT_REPLICATION_FACTOR),
  chunkUploadsQueue: process.env.CHUNK_UPLOADS_QUEUE ?? 'chunk-uploads',
  minioUseSSL: process.env.MINIO_USE_SSL === 'true',
  heartbeatStaleMs: Number(process.env.HEARTBEAT_STALE_MS ?? DEFAULT_HEARTBEAT_STALE_MS),
  heartbeatSweepIntervalMs: Number(
    process.env.HEARTBEAT_SWEEP_INTERVAL_MS ?? DEFAULT_HEARTBEAT_SWEEP_INTERVAL_MS,
  ),
  selfHealingIntervalMs: Number(
    process.env.SELF_HEALING_INTERVAL_MS ?? DEFAULT_SELF_HEALING_INTERVAL_MS,
  ),
};
