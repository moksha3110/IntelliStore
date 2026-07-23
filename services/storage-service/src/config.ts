import { join } from 'node:path';
import { getBaseEnv, loadServicePort } from '@intellistore/shared-config';

const DEFAULT_CHUNK_SIZE_BYTES = 4 * 1024 * 1024;
const DEFAULT_MAX_UPLOAD_SIZE_BYTES = 100 * 1024 * 1024;

export const config = {
  ...getBaseEnv(),
  serviceName: 'storage-service',
  port: loadServicePort('STORAGE_SERVICE_PORT', 4003),
  metadataServiceUrl: process.env.METADATA_SERVICE_URL ?? 'http://localhost:4002',
  chunkSizeBytes: Number(process.env.CHUNK_SIZE_BYTES ?? DEFAULT_CHUNK_SIZE_BYTES),
  maxUploadSizeBytes: Number(process.env.MAX_UPLOAD_SIZE_BYTES ?? DEFAULT_MAX_UPLOAD_SIZE_BYTES),
  storageDataDir: process.env.STORAGE_DATA_DIR ?? join(process.cwd(), '.data', 'chunks'),
  storageBackendType: (process.env.STORAGE_BACKEND ?? 'minio') as 'minio' | 'local',
  minioUseSSL: process.env.MINIO_USE_SSL === 'true',
};
