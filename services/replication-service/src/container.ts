import { createLogger } from '@intellistore/shared-logger';
import { config } from './config';
import { pool } from './db/pool';
import { PgNodeRepository } from './repositories/node.repository';
import { PgReplicaRepository } from './repositories/replica.repository';
import { ReplicationService } from './services/replication.service';
import { MinioNodeStorage } from './storage/minio-node-storage';

export const logger = createLogger({ serviceName: config.serviceName });

export const nodeRepository = new PgNodeRepository(pool);
export const replicaRepository = new PgReplicaRepository(pool);

export const nodeStorage = new MinioNodeStorage({
  endPoint: config.MINIO_ENDPOINT,
  port: config.MINIO_PORT,
  useSSL: config.minioUseSSL,
  accessKey: config.MINIO_ROOT_USER,
  secretKey: config.MINIO_ROOT_PASSWORD,
});

export const replicationService = new ReplicationService(
  nodeRepository,
  replicaRepository,
  nodeStorage,
  { replicationFactor: config.replicationFactor, primaryBucket: config.MINIO_BUCKET },
  logger,
);
