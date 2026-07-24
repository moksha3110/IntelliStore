import type { Pool } from 'pg';

export type ReplicaStatus = 'pending' | 'synced' | 'degraded' | 'lost';

export interface ChunkReplicaRecord {
  id: string;
  chunkId: string;
  nodeId: string;
  storageKey: string;
  sizeBytes: number;
  status: ReplicaStatus;
  lastVerifiedAt: string | null;
  createdAt: string;
}

interface ChunkReplicaRow {
  id: string;
  chunk_id: string;
  node_id: string;
  storage_key: string;
  size_bytes: string;
  status: ReplicaStatus;
  last_verified_at: string | null;
  created_at: string;
}

function toReplica(row: ChunkReplicaRow): ChunkReplicaRecord {
  return {
    id: row.id,
    chunkId: row.chunk_id,
    nodeId: row.node_id,
    storageKey: row.storage_key,
    sizeBytes: Number(row.size_bytes),
    status: row.status,
    lastVerifiedAt: row.last_verified_at,
    createdAt: row.created_at,
  };
}

export interface UnderReplicatedChunk {
  chunkId: string;
  storageKey: string;
  sizeBytes: number;
  syncedCount: number;
}

export interface ReplicaRepository {
  listByChunk(chunkId: string): Promise<ChunkReplicaRecord[]>;
  /** All replica rows currently placed on any of the given node ids, regardless of status. */
  listByNodeIds(nodeIds: string[]): Promise<ChunkReplicaRecord[]>;
  /** All node ids that currently have any replica row (any status) for a chunk. */
  listNodeIdsForChunk(chunkId: string): Promise<string[]>;
  countByStatus(chunkId: string, status: ReplicaStatus): Promise<number>;
  markLost(replicaId: string): Promise<void>;
  /**
   * Every chunk whose synced-replica count is below `desiredCount`, regardless
   * of when or why it fell short. Re-checking this on every sweep (rather than
   * only reacting to a node's health transition) is what lets healing retry a
   * chunk that couldn't be repaired immediately, once a node becomes available.
   */
  listUnderReplicated(desiredCount: number): Promise<UnderReplicatedChunk[]>;
  upsert(
    chunkId: string,
    nodeId: string,
    storageKey: string,
    sizeBytes: number,
    status: ReplicaStatus,
  ): Promise<ChunkReplicaRecord>;
}

export class PgReplicaRepository implements ReplicaRepository {
  constructor(private readonly pool: Pool) {}

  async listByChunk(chunkId: string): Promise<ChunkReplicaRecord[]> {
    const result = await this.pool.query<ChunkReplicaRow>(
      'SELECT * FROM chunk_replicas WHERE chunk_id = $1',
      [chunkId],
    );
    return result.rows.map(toReplica);
  }

  async listByNodeIds(nodeIds: string[]): Promise<ChunkReplicaRecord[]> {
    if (nodeIds.length === 0) return [];
    const result = await this.pool.query<ChunkReplicaRow>(
      'SELECT * FROM chunk_replicas WHERE node_id = ANY($1::uuid[])',
      [nodeIds],
    );
    return result.rows.map(toReplica);
  }

  async listNodeIdsForChunk(chunkId: string): Promise<string[]> {
    const result = await this.pool.query<{ node_id: string }>(
      'SELECT node_id FROM chunk_replicas WHERE chunk_id = $1',
      [chunkId],
    );
    return result.rows.map((row) => row.node_id);
  }

  async countByStatus(chunkId: string, status: ReplicaStatus): Promise<number> {
    const result = await this.pool.query<{ count: string }>(
      'SELECT count(*) FROM chunk_replicas WHERE chunk_id = $1 AND status = $2',
      [chunkId, status],
    );
    return Number(result.rows[0].count);
  }

  async markLost(replicaId: string): Promise<void> {
    await this.pool.query("UPDATE chunk_replicas SET status = 'lost' WHERE id = $1", [replicaId]);
  }

  async listUnderReplicated(desiredCount: number): Promise<UnderReplicatedChunk[]> {
    const result = await this.pool.query<{
      chunk_id: string;
      storage_key: string;
      size_bytes: string;
      synced_count: string;
    }>(
      `SELECT
         chunk_id,
         MAX(storage_key) AS storage_key,
         MAX(size_bytes) AS size_bytes,
         count(*) FILTER (WHERE status = 'synced') AS synced_count
       FROM chunk_replicas
       GROUP BY chunk_id
       HAVING count(*) FILTER (WHERE status = 'synced') < $1`,
      [desiredCount],
    );
    return result.rows.map((row) => ({
      chunkId: row.chunk_id,
      storageKey: row.storage_key,
      sizeBytes: Number(row.size_bytes),
      syncedCount: Number(row.synced_count),
    }));
  }

  async upsert(
    chunkId: string,
    nodeId: string,
    storageKey: string,
    sizeBytes: number,
    status: ReplicaStatus,
  ): Promise<ChunkReplicaRecord> {
    const result = await this.pool.query<ChunkReplicaRow>(
      `INSERT INTO chunk_replicas (chunk_id, node_id, storage_key, size_bytes, status, last_verified_at)
       VALUES ($1, $2, $3, $4, $5, now())
       ON CONFLICT (chunk_id, node_id)
       DO UPDATE SET status = EXCLUDED.status, size_bytes = EXCLUDED.size_bytes, last_verified_at = now()
       RETURNING *`,
      [chunkId, nodeId, storageKey, sizeBytes, status],
    );
    return toReplica(result.rows[0]);
  }
}
