import { createLogger } from '@intellistore/shared-logger';
import { config } from './config';
import { createApp } from './app';
import { storageBackend } from './container';

const logger = createLogger({ serviceName: config.serviceName });

async function main(): Promise<void> {
  logger.info(`initializing storage backend (${config.storageBackendType})`);
  await storageBackend.init?.();

  const app = createApp(logger);
  app.listen(config.port, () => {
    logger.info(`${config.serviceName} listening on port ${config.port}`);
  });
}

main().catch((err) => {
  logger.error({ err }, 'failed to start storage-service');
  process.exit(1);
});
