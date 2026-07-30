import { connectWithRetry, subscribeEvent } from '@intellistore/shared-queue';
import {
  EVENTS_EXCHANGE,
  ROUTING_KEYS,
  type ChunkUploadedBatchEvent,
  type FileAccessedEvent,
} from '@intellistore/shared-types';
import { config } from './config';
import { createApp } from './app';
import { logger, notificationService } from './container';

async function main(): Promise<void> {
  logger.info('connecting to RabbitMQ');
  const connection = await connectWithRetry({
    host: config.RABBITMQ_HOST,
    port: config.RABBITMQ_PORT,
    user: config.RABBITMQ_USER,
    password: config.RABBITMQ_PASSWORD,
  });
  const channel = await connection.createChannel();

  await subscribeEvent<ChunkUploadedBatchEvent>(
    channel,
    EVENTS_EXCHANGE,
    config.chunkUploadedQueue,
    [ROUTING_KEYS.chunkUploaded],
    async (event) => {
      try {
        const notification = await notificationService.handleChunkUploaded(event);
        logger.info(
          { ownerId: event.ownerId, notificationId: notification.id },
          'created upload notification',
        );
      } catch (err) {
        logger.error({ err, fileId: event.fileId }, 'failed to handle chunk-uploaded event');
        throw err;
      }
    },
  );

  await subscribeEvent<FileAccessedEvent>(
    channel,
    EVENTS_EXCHANGE,
    config.fileAccessedQueue,
    [ROUTING_KEYS.fileAccessed],
    async (event) => {
      try {
        const notification = await notificationService.handleFileAccessed(event);
        logger.info(
          { ownerId: event.ownerId, notificationId: notification.id },
          'created access notification',
        );
      } catch (err) {
        logger.error({ err, fileId: event.fileId }, 'failed to handle file-accessed event');
        throw err;
      }
    },
  );

  logger.info('subscribed to chunk-uploaded and file-accessed events');

  const app = createApp(logger);
  app.listen(config.port, () => {
    logger.info(`${config.serviceName} listening on port ${config.port}`);
  });
}

main().catch((err) => {
  logger.error({ err }, 'failed to start notification-service');
  process.exit(1);
});
