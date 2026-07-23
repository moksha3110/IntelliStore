import type { Logger } from '@intellistore/shared-logger';
import type { NodeRepository } from '../repositories/node.repository';

export class HeartbeatMonitor {
  private timer: ReturnType<typeof setInterval> | undefined;

  constructor(
    private readonly nodeRepository: NodeRepository,
    private readonly staleMs: number,
    private readonly logger?: Logger,
  ) {}

  async sweepOnce(now: number = Date.now()): Promise<void> {
    const nodes = await this.nodeRepository.listAll();

    for (const node of nodes) {
      if (!node.isHealthy) continue;

      const lastBeat = node.lastHeartbeatAt ? new Date(node.lastHeartbeatAt).getTime() : null;
      const isStale = lastBeat === null || now - lastBeat > this.staleMs;

      if (isStale) {
        await this.nodeRepository.markStale(node.id);
        this.logger?.warn(
          { nodeId: node.id, name: node.name, lastHeartbeatAt: node.lastHeartbeatAt },
          'node marked unhealthy: no heartbeat within staleness window',
        );
      }
    }
  }

  start(intervalMs: number): void {
    this.timer = setInterval(() => {
      this.sweepOnce().catch((err) => {
        this.logger?.error({ err }, 'heartbeat staleness sweep failed');
      });
    }, intervalMs);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
  }
}
