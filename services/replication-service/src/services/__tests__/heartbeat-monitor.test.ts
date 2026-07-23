import { describe, expect, it } from 'vitest';
import { HeartbeatMonitor } from '../heartbeat-monitor';
import { InMemoryNodeRepository, makeNode } from './in-memory-node.repository';

const STALE_MS = 15_000;

describe('HeartbeatMonitor', () => {
  it('marks a healthy node unhealthy once its heartbeat exceeds the staleness window', async () => {
    const now = Date.now();
    const repo = new InMemoryNodeRepository([
      makeNode({
        id: 'node-1',
        isHealthy: true,
        lastHeartbeatAt: new Date(now - STALE_MS - 1000).toISOString(),
      }),
    ]);
    const monitor = new HeartbeatMonitor(repo, STALE_MS);

    await monitor.sweepOnce(now);

    const node = await repo.findById('node-1');
    expect(node?.isHealthy).toBe(false);
  });

  it('leaves a node healthy when its heartbeat is within the staleness window', async () => {
    const now = Date.now();
    const repo = new InMemoryNodeRepository([
      makeNode({
        id: 'node-1',
        isHealthy: true,
        lastHeartbeatAt: new Date(now - 1000).toISOString(),
      }),
    ]);
    const monitor = new HeartbeatMonitor(repo, STALE_MS);

    await monitor.sweepOnce(now);

    const node = await repo.findById('node-1');
    expect(node?.isHealthy).toBe(true);
  });

  it('marks a node with no heartbeat at all as unhealthy', async () => {
    const repo = new InMemoryNodeRepository([
      makeNode({ id: 'node-1', isHealthy: true, lastHeartbeatAt: null }),
    ]);
    const monitor = new HeartbeatMonitor(repo, STALE_MS);

    await monitor.sweepOnce();

    const node = await repo.findById('node-1');
    expect(node?.isHealthy).toBe(false);
  });

  it('does not touch nodes that are already unhealthy', async () => {
    const now = Date.now();
    const repo = new InMemoryNodeRepository([
      makeNode({
        id: 'node-1',
        isHealthy: false,
        lastHeartbeatAt: new Date(now - 1000).toISOString(),
      }),
    ]);
    const monitor = new HeartbeatMonitor(repo, STALE_MS);

    await monitor.sweepOnce(now);

    const node = await repo.findById('node-1');
    expect(node?.isHealthy).toBe(false);
  });

  it('evaluates each node independently', async () => {
    const now = Date.now();
    const repo = new InMemoryNodeRepository([
      makeNode({ id: 'fresh', isHealthy: true, lastHeartbeatAt: new Date(now - 1000).toISOString() }),
      makeNode({
        id: 'stale',
        isHealthy: true,
        lastHeartbeatAt: new Date(now - STALE_MS - 1000).toISOString(),
      }),
    ]);
    const monitor = new HeartbeatMonitor(repo, STALE_MS);

    await monitor.sweepOnce(now);

    expect((await repo.findById('fresh'))?.isHealthy).toBe(true);
    expect((await repo.findById('stale'))?.isHealthy).toBe(false);
  });
});
