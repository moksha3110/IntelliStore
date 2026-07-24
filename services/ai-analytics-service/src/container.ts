import { createLogger } from '@intellistore/shared-logger';
import { config } from './config';
import { HttpMetadataClient } from './clients/metadata.client';
import { HttpReplicationClient } from './clients/replication.client';
import { pool } from './db/pool';
import { PgAccessStatsRepository } from './repositories/access-stats.repository';
import { AnalyticsService } from './services/analytics.service';

export const logger = createLogger({ serviceName: config.serviceName });

export const accessStatsRepository = new PgAccessStatsRepository(pool);
export const metadataClient = new HttpMetadataClient(config.metadataServiceUrl);
export const replicationClient = new HttpReplicationClient(config.replicationServiceUrl);

export const analyticsService = new AnalyticsService(
  metadataClient,
  replicationClient,
  accessStatsRepository,
  config.scoring,
);
