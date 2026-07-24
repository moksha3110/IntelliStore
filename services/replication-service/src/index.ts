import { connectWithRetry, consumeJson } from '@intellistore/shared-queue';
import type { ChunkUploadedBatchEvent } from '@intellistore/shared-types';
import { config } from './config';
import { createApp } from './app';
import {
  heartbeatMonitor,
  logger,
  nodeRepository,
  nodeStorage,
  replicationService,
  selfHealingService,
} from './container';

async function main(): Promise<void> {
  logger.info('ensuring simulated storage node buckets exist');
  const nodes = await nodeRepository.listAll();
  for (const node of nodes) {
    await nodeStorage.ensureBucket(node.bucket);
  }

  logger.info('connecting to RabbitMQ');
  const connection = await connectWithRetry({
    host: config.RABBITMQ_HOST,
    port: config.RABBITMQ_PORT,
    user: config.RABBITMQ_USER,
    password: config.RABBITMQ_PASSWORD,
  });
  const channel = await connection.createChannel();

  await consumeJson<ChunkUploadedBatchEvent>(channel, config.chunkUploadsQueue, async (event) => {
    logger.info(
      { fileId: event.fileId, versionId: event.versionId, chunkCount: event.chunks.length },
      'received chunk-uploads event',
    );
    for (const chunk of event.chunks) {
      await replicationService.replicateChunk(chunk.chunkId, chunk.storageKey, chunk.sizeBytes);
    }
  });
  logger.info(`consuming queue "${config.chunkUploadsQueue}"`);

  heartbeatMonitor.start(config.heartbeatSweepIntervalMs);
  logger.info(
    `heartbeat staleness sweep running every ${config.heartbeatSweepIntervalMs}ms (stale after ${config.heartbeatStaleMs}ms)`,
  );

  selfHealingService.start(config.selfHealingIntervalMs);
  logger.info(`self-healing sweep running every ${config.selfHealingIntervalMs}ms`);

  const app = createApp(logger);
  app.listen(config.port, () => {
    logger.info(`${config.serviceName} listening on port ${config.port}`);
  });
}

main().catch((err) => {
  logger.error({ err }, 'failed to start replication-service');
  process.exit(1);
});
