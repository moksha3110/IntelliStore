import { config } from './config';
import { HttpMetadataClient } from './clients/metadata.client';
import { DownloadService } from './services/download.service';
import { UploadService } from './services/upload.service';
import { LocalFsStorageBackend } from './storage/local-fs-storage-backend';

export const storageBackend = new LocalFsStorageBackend(config.storageDataDir);
export const metadataClient = new HttpMetadataClient(config.metadataServiceUrl);

export const uploadService = new UploadService(storageBackend, metadataClient, {
  chunkSizeBytes: config.chunkSizeBytes,
});

export const downloadService = new DownloadService(storageBackend, metadataClient);
