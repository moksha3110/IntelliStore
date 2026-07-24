import type { Logger } from '@intellistore/shared-logger';
import type { NodeRepository, StorageNodeRecord } from '../repositories/node.repository';
import type { ChunkReplicaRecord, ReplicaRepository } from '../repositories/replica.repository';
import type { NodeStorage } from '../storage/node-storage';

export interface ReplicationServiceOptions {
  replicationFactor: number;
  primaryBucket: string;
}

export class ReplicationService {
  constructor(
    private readonly nodeRepository: NodeRepository,
    private readonly replicaRepository: ReplicaRepository,
    private readonly nodeStorage: NodeStorage,
    private readonly options: ReplicationServiceOptions,
    private readonly logger?: Logger,
  ) {}

  async replicateChunk(
    chunkId: string,
    storageKey: string,
    sizeBytes: number,
  ): Promise<ChunkReplicaRecord[]> {
    const healthyNodes = await this.nodeRepository.listHealthy();
    if (healthyNodes.length === 0) {
      throw new Error('No healthy storage nodes available for replication');
    }

    const targets = healthyNodes.slice(0, this.options.replicationFactor);
    return this.copyToTargets(chunkId, storageKey, sizeBytes, targets);
  }

  /**
   * Restores replication for a chunk that has fallen below the desired
   * replica count (e.g. because a node hosting a replica went unhealthy).
   * Picks up to `neededCount` healthy nodes, skipping any in `excludeNodeIds`
   * (nodes that already have a replica row for this chunk, healthy or not).
   */
  async healChunk(
    chunkId: string,
    storageKey: string,
    sizeBytes: number,
    neededCount: number,
    excludeNodeIds: string[],
  ): Promise<ChunkReplicaRecord[]> {
    if (neededCount <= 0) return [];

    const healthyNodes = await this.nodeRepository.listHealthy();
    const targets = healthyNodes
      .filter((node) => !excludeNodeIds.includes(node.id))
      .slice(0, neededCount);

    if (targets.length === 0) {
      this.logger?.warn({ chunkId }, 'no eligible healthy nodes available to heal chunk');
      return [];
    }

    return this.copyToTargets(chunkId, storageKey, sizeBytes, targets);
  }

  private async copyToTargets(
    chunkId: string,
    storageKey: string,
    sizeBytes: number,
    targets: StorageNodeRecord[],
  ): Promise<ChunkReplicaRecord[]> {
    const results: ChunkReplicaRecord[] = [];

    for (const node of targets) {
      try {
        await this.replicateToNode(storageKey, sizeBytes, node);
        const replica = await this.replicaRepository.upsert(
          chunkId,
          node.id,
          storageKey,
          sizeBytes,
          'synced',
        );
        results.push(replica);
      } catch (err) {
        this.logger?.error({ err, nodeId: node.id, chunkId }, 'failed to replicate chunk to node');
      }
    }

    if (results.length === 0) {
      throw new Error(`Failed to replicate chunk ${chunkId} to any node`);
    }

    return results;
  }

  private async replicateToNode(
    storageKey: string,
    sizeBytes: number,
    node: StorageNodeRecord,
  ): Promise<void> {
    await this.nodeStorage.copyToNode(this.options.primaryBucket, storageKey, node.bucket);
    await this.nodeRepository.incrementUsedBytes(node.id, sizeBytes);
  }

  listReplicas(chunkId: string): Promise<ChunkReplicaRecord[]> {
    return this.replicaRepository.listByChunk(chunkId);
  }

  listNodes(): Promise<StorageNodeRecord[]> {
    return this.nodeRepository.listAll();
  }

  async getDiagnostics(): Promise<{
    totalNodes: number;
    healthyNodes: number;
    unhealthyNodes: number;
    underReplicatedChunkCount: number;
  }> {
    const nodes = await this.nodeRepository.listAll();
    const healthyNodes = nodes.filter((node) => node.isHealthy).length;
    const underReplicated = await this.replicaRepository.listUnderReplicated(
      this.options.replicationFactor,
    );

    return {
      totalNodes: nodes.length,
      healthyNodes,
      unhealthyNodes: nodes.length - healthyNodes,
      underReplicatedChunkCount: underReplicated.length,
    };
  }
}
