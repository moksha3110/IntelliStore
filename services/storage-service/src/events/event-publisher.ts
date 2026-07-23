import type { ChunkUploadedBatchEvent } from '@intellistore/shared-types';

export interface EventPublisher {
  publishChunkUploaded(event: ChunkUploadedBatchEvent): Promise<void>;
}
