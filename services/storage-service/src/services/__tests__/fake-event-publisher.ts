import type { ChunkUploadedBatchEvent, FileAccessedEvent } from '@intellistore/shared-types';
import type { EventPublisher } from '../../events/event-publisher';

export class FakeEventPublisher implements EventPublisher {
  publishedEvents: ChunkUploadedBatchEvent[] = [];
  accessEvents: FileAccessedEvent[] = [];

  async publishChunkUploaded(event: ChunkUploadedBatchEvent): Promise<void> {
    this.publishedEvents.push(event);
  }

  async publishFileAccessed(event: FileAccessedEvent): Promise<void> {
    this.accessEvents.push(event);
  }
}
