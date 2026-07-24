import type { ChunkUploadedBatchEvent, FileAccessedEvent } from '@intellistore/shared-types';

export interface EventPublisher {
  publishChunkUploaded(event: ChunkUploadedBatchEvent): Promise<void>;
  publishFileAccessed(event: FileAccessedEvent): Promise<void>;
}
