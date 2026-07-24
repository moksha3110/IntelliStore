import type { Logger } from '@intellistore/shared-logger';
import type { NodeRepository } from '../repositories/node.repository';
import type { ReplicaRepository } from '../repositories/replica.repository';
import type { ReplicationService } from './replication.service';

export interface SelfHealingServiceOptions {
  replicationFactor: number;
}

export class SelfHealingService {
  private timer: ReturnType<typeof setInterval> | undefined;

  constructor(
    private readonly nodeRepository: NodeRepository,
    private readonly replicaRepository: ReplicaRepository,
    private readonly replicationService: ReplicationService,
    private readonly options: SelfHealingServiceOptions,
    private readonly logger?: Logger,
  ) {}

  async healOnce(): Promise<void> {
    await this.markReplicasOnUnhealthyNodesLost();
    await this.reconcileUnderReplicatedChunks();
  }

  /**
   * Bookkeeping pass: a replica whose node just went unhealthy is no longer
   * trustworthy, so mark it lost. This runs once per node-health transition -
   * the actual healing retry logic lives in reconcileUnderReplicatedChunks,
   * which re-evaluates real replication counts every sweep regardless of when
   * or why a chunk fell short.
   */
  private async markReplicasOnUnhealthyNodesLost(): Promise<void> {
    const nodes = await this.nodeRepository.listAll();
    const unhealthyNodeIds = nodes.filter((node) => !node.isHealthy).map((node) => node.id);
    if (unhealthyNodeIds.length === 0) return;

    const atRiskReplicas = (await this.replicaRepository.listByNodeIds(unhealthyNodeIds)).filter(
      (replica) => replica.status !== 'lost',
    );

    for (const replica of atRiskReplicas) {
      await this.replicaRepository.markLost(replica.id);
      this.logger?.warn(
        { chunkId: replica.chunkId, nodeId: replica.nodeId },
        'replica marked lost: hosting node is unhealthy',
      );
    }
  }

  /**
   * Reconciliation pass: re-checks actual vs. desired replica count for every
   * chunk (not just ones that just changed), so a chunk that couldn't be
   * healed immediately (no eligible nodes) is retried on the next sweep once
   * a node becomes available again.
   */
  private async reconcileUnderReplicatedChunks(): Promise<void> {
    const underReplicated = await this.replicaRepository.listUnderReplicated(
      this.options.replicationFactor,
    );

    for (const chunk of underReplicated) {
      const needed = this.options.replicationFactor - chunk.syncedCount;
      const existingNodeIds = await this.replicaRepository.listNodeIdsForChunk(chunk.chunkId);

      try {
        const healed = await this.replicationService.healChunk(
          chunk.chunkId,
          chunk.storageKey,
          chunk.sizeBytes,
          needed,
          existingNodeIds,
        );
        if (healed.length > 0) {
          this.logger?.info(
            { chunkId: chunk.chunkId, restored: healed.length, needed },
            'self-healing restored chunk replicas',
          );
        }
      } catch (err) {
        this.logger?.error({ err, chunkId: chunk.chunkId }, 'self-healing failed to restore chunk replicas');
      }
    }
  }

  start(intervalMs: number): void {
    this.timer = setInterval(() => {
      this.healOnce().catch((err) => {
        this.logger?.error({ err }, 'self-healing sweep failed');
      });
    }, intervalMs);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
  }
}
