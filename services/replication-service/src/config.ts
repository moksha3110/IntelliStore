import { getBaseEnv, loadServicePort } from '@intellistore/shared-config';

const DEFAULT_REPLICATION_FACTOR = 2;

export const config = {
  ...getBaseEnv(),
  serviceName: 'replication-service',
  port: loadServicePort('REPLICATION_SERVICE_PORT', 4004),
  replicationFactor: Number(process.env.REPLICATION_FACTOR ?? DEFAULT_REPLICATION_FACTOR),
  chunkUploadsQueue: process.env.CHUNK_UPLOADS_QUEUE ?? 'chunk-uploads',
  minioUseSSL: process.env.MINIO_USE_SSL === 'true',
};
