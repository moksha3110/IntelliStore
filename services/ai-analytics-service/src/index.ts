import { createLogger } from '@intellistore/shared-logger';
import { config } from './config';
import { createApp } from './app';

const logger = createLogger({ serviceName: config.serviceName });
const app = createApp(logger);

app.listen(config.port, () => {
  logger.info(`${config.serviceName} listening on port ${config.port}`);
});
