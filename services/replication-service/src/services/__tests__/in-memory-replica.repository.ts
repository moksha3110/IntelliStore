import type {
  ChunkReplicaRecord,
  ReplicaRepository,
  ReplicaStatus,
  UnderReplicatedChunk,
} from '../../repositories/replica.repository';

export class InMemoryReplicaRepository implements ReplicaRepository {
  private readonly replicas = new Map<string, ChunkReplicaRecord>();

  async listByChunk(chunkId: string): Promise<ChunkReplicaRecord[]> {
    return [...this.replicas.values()].filter((r) => r.chunkId === chunkId);
  }

  async listByNodeIds(nodeIds: string[]): Promise<ChunkReplicaRecord[]> {
    return [...this.replicas.values()].filter((r) => nodeIds.includes(r.nodeId));
  }

  async listNodeIdsForChunk(chunkId: string): Promise<string[]> {
    return [...this.replicas.values()].filter((r) => r.chunkId === chunkId).map((r) => r.nodeId);
  }

  async countByStatus(chunkId: string, status: ReplicaStatus): Promise<number> {
    return [...this.replicas.values()].filter((r) => r.chunkId === chunkId && r.status === status)
      .length;
  }

  async markLost(replicaId: string): Promise<void> {
    const record = this.replicas.get(replicaId);
    if (record) record.status = 'lost';
  }

  async listUnderReplicated(desiredCount: number): Promise<UnderReplicatedChunk[]> {
    const byChunk = new Map<string, ChunkReplicaRecord[]>();
    for (const record of this.replicas.values()) {
      const existing = byChunk.get(record.chunkId);
      if (existing) existing.push(record);
      else byChunk.set(record.chunkId, [record]);
    }

    const result: UnderReplicatedChunk[] = [];
    for (const [chunkId, records] of byChunk) {
      const syncedCount = records.filter((r) => r.status === 'synced').length;
      if (syncedCount < desiredCount) {
        result.push({
          chunkId,
          storageKey: records[0].storageKey,
          sizeBytes: records[0].sizeBytes,
          syncedCount,
        });
      }
    }
    return result;
  }

  async upsert(
    chunkId: string,
    nodeId: string,
    storageKey: string,
    sizeBytes: number,
    status: ReplicaStatus,
  ): Promise<ChunkReplicaRecord> {
    const key = `${chunkId}:${nodeId}`;
    const record: ChunkReplicaRecord = {
      id: key,
      chunkId,
      nodeId,
      storageKey,
      sizeBytes,
      status,
      lastVerifiedAt: new Date().toISOString(),
      createdAt: this.replicas.get(key)?.createdAt ?? new Date().toISOString(),
    };
    this.replicas.set(key, record);
    return record;
  }
}
