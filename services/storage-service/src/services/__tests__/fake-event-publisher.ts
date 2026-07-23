import type { ChunkUploadedBatchEvent } from '@intellistore/shared-types';
import type { EventPublisher } from '../../events/event-publisher';

export class FakeEventPublisher implements EventPublisher {
  publishedEvents: ChunkUploadedBatchEvent[] = [];

  async publishChunkUploaded(event: ChunkUploadedBatchEvent): Promise<void> {
    this.publishedEvents.push(event);
  }
}
