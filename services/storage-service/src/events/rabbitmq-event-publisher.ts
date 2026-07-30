import { publishEvent, type AmqpChannel } from '@intellistore/shared-queue';
import type { Logger } from '@intellistore/shared-logger';
import {
  EVENTS_EXCHANGE,
  ROUTING_KEYS,
  type ChunkUploadedBatchEvent,
  type FileAccessedEvent,
} from '@intellistore/shared-types';
import type { EventPublisher } from './event-publisher';

// Publishes domain events to the shared topic exchange, so replication,
// analytics, and notifications can each subscribe independently (fan-out).
export class RabbitMqEventPublisher implements EventPublisher {
  constructor(
    private readonly channel: AmqpChannel,
    private readonly logger: Logger,
  ) {}

  async publishChunkUploaded(event: ChunkUploadedBatchEvent): Promise<void> {
    try {
      await publishEvent(this.channel, EVENTS_EXCHANGE, ROUTING_KEYS.chunkUploaded, event);
    } catch (err) {
      this.logger.error({ err, fileId: event.fileId }, 'failed to publish chunk-uploaded event');
    }
  }

  async publishFileAccessed(event: FileAccessedEvent): Promise<void> {
    try {
      await publishEvent(this.channel, EVENTS_EXCHANGE, ROUTING_KEYS.fileAccessed, event);
    } catch (err) {
      this.logger.error({ err, fileId: event.fileId }, 'failed to publish file-accessed event');
    }
  }
}
