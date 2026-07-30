import { connectWithRetry, subscribeEvent } from '@intellistore/shared-queue';
import {
  EVENTS_EXCHANGE,
  ROUTING_KEYS,
  type FileAccessedEvent,
} from '@intellistore/shared-types';
import { config } from './config';
import { createApp } from './app';
import { accessStatsRepository, logger } from './container';

async function main(): Promise<void> {
  logger.info('connecting to RabbitMQ');
  const connection = await connectWithRetry({
    host: config.RABBITMQ_HOST,
    port: config.RABBITMQ_PORT,
    user: config.RABBITMQ_USER,
    password: config.RABBITMQ_PASSWORD,
  });
  const channel = await connection.createChannel();

  await subscribeEvent<FileAccessedEvent>(
    channel,
    EVENTS_EXCHANGE,
    config.fileAccessQueue,
    [ROUTING_KEYS.fileAccessed],
    async (event) => {
      await accessStatsRepository.recordAccess(event.fileId, event.accessedAt);
      logger.info({ fileId: event.fileId }, 'recorded file access');
    },
  );
  logger.info(`subscribed to "${ROUTING_KEYS.fileAccessed}" via queue "${config.fileAccessQueue}"`);

  const app = createApp(logger);
  app.listen(config.port, () => {
    logger.info(`${config.serviceName} listening on port ${config.port}`);
  });
}

main().catch((err) => {
  logger.error({ err }, 'failed to start ai-analytics-service');
  process.exit(1);
});
