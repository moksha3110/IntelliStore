import { config } from './config';
import { HttpMetadataClient } from './clients/metadata.client';
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

export const storageBackend = createStorageBackend();
export const metadataClient = new HttpMetadataClient(config.metadataServiceUrl);

export const uploadService = new UploadService(storageBackend, metadataClient, {
  chunkSizeBytes: config.chunkSizeBytes,
});

export const downloadService = new DownloadService(storageBackend, metadataClient);
