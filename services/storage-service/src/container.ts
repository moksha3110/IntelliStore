import { createLogger } from '@intellistore/shared-logger';
import { config } from './config';
import { HttpMetadataClient } from './clients/metadata.client';
import type { EventPublisher } from './events/event-publisher';
import { DownloadService } from './services/download.service';
import { UploadService } from './services/upload.service';
import { LocalFsStorageBackend } from './storage/local-fs-storage-backend';
import { MinioStorageBackend } from './storage/minio-storage-backend';
import type { StorageBackend } from './storage/storage-backend';

function createStorageBackend(): StorageBackend {
  if (config.storageBackendType === 'local') {
    return new LocalFsStorageBackend(config.storageDataDir);
  }

  return new MinioStorageBackend({
    endPoint: config.MINIO_ENDPOINT,
    port: config.MINIO_PORT,
    useSSL: config.minioUseSSL,
    accessKey: config.MINIO_ROOT_USER,
    secretKey: config.MINIO_ROOT_PASSWORD,
    bucket: config.MINIO_BUCKET,
  });
}

export const logger = createLogger({ serviceName: config.serviceName });

export const storageBackend = createStorageBackend();
export const metadataClient = new HttpMetadataClient(config.metadataServiceUrl);
export const downloadService = new DownloadService(storageBackend, metadataClient);

// Depends on a RabbitMQ connection, which is established asynchronously in
// index.ts before the server starts accepting requests; see initUploadService.
export let uploadService: UploadService;

export function initUploadService(eventPublisher: EventPublisher): void {
  uploadService = new UploadService(storageBackend, metadataClient, eventPublisher, {
    chunkSizeBytes: config.chunkSizeBytes,
  });
}
