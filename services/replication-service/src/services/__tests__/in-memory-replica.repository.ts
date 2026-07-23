import type {
  ChunkReplicaRecord,
  ReplicaRepository,
  ReplicaStatus,
} from '../../repositories/replica.repository';

export class InMemoryReplicaRepository implements ReplicaRepository {
  private readonly replicas = new Map<string, ChunkReplicaRecord>();

  async listByChunk(chunkId: string): Promise<ChunkReplicaRecord[]> {
    return [...this.replicas.values()].filter((r) => r.chunkId === chunkId);
  }

  async upsert(
    chunkId: string,
    nodeId: string,
    storageKey: string,
    status: ReplicaStatus,
  ): Promise<ChunkReplicaRecord> {
    const key = `${chunkId}:${nodeId}`;
    const record: ChunkReplicaRecord = {
      id: key,
      chunkId,
      nodeId,
      storageKey,
      status,
      lastVerifiedAt: new Date().toISOString(),
      createdAt: this.replicas.get(key)?.createdAt ?? new Date().toISOString(),
    };
    this.replicas.set(key, record);
    return record;
  }
}
