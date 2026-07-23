import type { Pool } from 'pg';

export type ReplicaStatus = 'pending' | 'synced' | 'degraded' | 'lost';

export interface ChunkReplicaRecord {
  id: string;
  chunkId: string;
  nodeId: string;
  storageKey: string;
  status: ReplicaStatus;
  lastVerifiedAt: string | null;
  createdAt: string;
}

interface ChunkReplicaRow {
  id: string;
  chunk_id: string;
  node_id: string;
  storage_key: string;
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
    status: row.status,
    lastVerifiedAt: row.last_verified_at,
    createdAt: row.created_at,
  };
}

export interface ReplicaRepository {
  listByChunk(chunkId: string): Promise<ChunkReplicaRecord[]>;
  upsert(
    chunkId: string,
    nodeId: string,
    storageKey: string,
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

  async upsert(
    chunkId: string,
    nodeId: string,
    storageKey: string,
    status: ReplicaStatus,
  ): Promise<ChunkReplicaRecord> {
    const result = await this.pool.query<ChunkReplicaRow>(
      `INSERT INTO chunk_replicas (chunk_id, node_id, storage_key, status, last_verified_at)
       VALUES ($1, $2, $3, $4, now())
       ON CONFLICT (chunk_id, node_id)
       DO UPDATE SET status = EXCLUDED.status, last_verified_at = now()
       RETURNING *`,
      [chunkId, nodeId, storageKey, status],
    );
    return toReplica(result.rows[0]);
  }
}
