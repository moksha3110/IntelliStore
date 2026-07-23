import { connectWithRetry } from '@intellistore/shared-queue';
import { config } from './config';
import { createApp } from './app';
import { initUploadService, logger, storageBackend } from './container';
import { RabbitMqEventPublisher } from './events/rabbitmq-event-publisher';

async function main(): Promise<void> {
  logger.info(`initializing storage backend (${config.storageBackendType})`);
  await storageBackend.init?.();

  logger.info('connecting to RabbitMQ');
  const connection = await connectWithRetry({
    host: config.RABBITMQ_HOST,
    port: config.RABBITMQ_PORT,
    user: config.RABBITMQ_USER,
    password: config.RABBITMQ_PASSWORD,
  });
  const channel = await connection.createChannel();
  initUploadService(new RabbitMqEventPublisher(channel, config.chunkUploadsQueue, logger));

  const app = createApp(logger);
  app.listen(config.port, () => {
    logger.info(`${config.serviceName} listening on port ${config.port}`);
  });
}

main().catch((err) => {
  logger.error({ err }, 'failed to start storage-service');
  process.exit(1);
});
