import { createLogger } from '@intellistore/shared-logger';

const nodeName = process.env.NODE_NAME ?? 'node-1';
const replicationServiceUrl = process.env.REPLICATION_SERVICE_URL ?? 'http://localhost:4004';
const intervalMs = Number(process.env.HEARTBEAT_INTERVAL_MS ?? 3000);

const logger = createLogger({ serviceName: `node-agent:${nodeName}` });

async function sendHeartbeat(): Promise<void> {
  try {
    const res = await fetch(`${replicationServiceUrl}/nodes/${nodeName}/heartbeat`, {
      method: 'POST',
    });
    if (!res.ok) {
      logger.warn({ status: res.status }, 'heartbeat rejected');
      return;
    }
    logger.info('heartbeat sent');
  } catch (err) {
    logger.error({ err }, 'failed to send heartbeat');
  }
}

logger.info(`simulating node "${nodeName}" heartbeats every ${intervalMs}ms to ${replicationServiceUrl}`);
void sendHeartbeat();
setInterval(() => void sendHeartbeat(), intervalMs);
