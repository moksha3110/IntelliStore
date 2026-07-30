import { createLogger } from '@intellistore/shared-logger';
import { config } from './config';
import { pool } from './db/pool';
import { PgNotificationRepository } from './repositories/notification.repository';
import { NotificationService } from './services/notification.service';

export const logger = createLogger({ serviceName: config.serviceName });

export const notificationRepository = new PgNotificationRepository(pool);
export const notificationService = new NotificationService(notificationRepository);
