import { publishJson, type AmqpChannel } from '@intellistore/shared-queue';
import type { Logger } from '@intellistore/shared-logger';
import type { ChunkUploadedBatchEvent } from '@intellistore/shared-types';
import type { EventPublisher } from './event-publisher';

export class RabbitMqEventPublisher implements EventPublisher {
  constructor(
    private readonly channel: AmqpChannel,
    private readonly queueName: string,
    private readonly logger: Logger,
  ) {}

  async publishChunkUploaded(event: ChunkUploadedBatchEvent): Promise<void> {
    try {
      await publishJson(this.channel, this.queueName, event);
    } catch (err) {
      this.logger.error({ err, fileId: event.fileId }, 'failed to publish chunk-uploaded event');
    }
  }
}
