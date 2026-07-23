import type { Pool } from 'pg';

export interface StorageNodeRecord {
  id: string;
  name: string;
  bucket: string;
  isHealthy: boolean;
  lastHeartbeatAt: string | null;
  capacityBytes: number;
  usedBytes: number;
}

interface StorageNodeRow {
  id: string;
  name: string;
  bucket: string;
  is_healthy: boolean;
  last_heartbeat_at: string | null;
  capacity_bytes: string;
  used_bytes: string;
}

function toNode(row: StorageNodeRow): StorageNodeRecord {
  return {
    id: row.id,
    name: row.name,
    bucket: row.bucket,
    isHealthy: row.is_healthy,
    lastHeartbeatAt: row.last_heartbeat_at,
    capacityBytes: Number(row.capacity_bytes),
    usedBytes: Number(row.used_bytes),
  };
}

export interface NodeRepository {
  listAll(): Promise<StorageNodeRecord[]>;
  listHealthy(): Promise<StorageNodeRecord[]>;
  findById(id: string): Promise<StorageNodeRecord | null>;
  incrementUsedBytes(id: string, deltaBytes: number): Promise<void>;
  setHealth(id: string, isHealthy: boolean, heartbeatAt: string): Promise<void>;
}

export class PgNodeRepository implements NodeRepository {
  constructor(private readonly pool: Pool) {}

  async listAll(): Promise<StorageNodeRecord[]> {
    const result = await this.pool.query<StorageNodeRow>('SELECT * FROM storage_nodes ORDER BY name');
    return result.rows.map(toNode);
  }

  async listHealthy(): Promise<StorageNodeRecord[]> {
    const result = await this.pool.query<StorageNodeRow>(
      'SELECT * FROM storage_nodes WHERE is_healthy = true ORDER BY used_bytes ASC',
    );
    return result.rows.map(toNode);
  }

  async findById(id: string): Promise<StorageNodeRecord | null> {
    const result = await this.pool.query<StorageNodeRow>('SELECT * FROM storage_nodes WHERE id = $1', [
      id,
    ]);
    return result.rows[0] ? toNode(result.rows[0]) : null;
  }

  async incrementUsedBytes(id: string, deltaBytes: number): Promise<void> {
    await this.pool.query(
      'UPDATE storage_nodes SET used_bytes = used_bytes + $2, updated_at = now() WHERE id = $1',
      [id, deltaBytes],
    );
  }

  async setHealth(id: string, isHealthy: boolean, heartbeatAt: string): Promise<void> {
    await this.pool.query(
      'UPDATE storage_nodes SET is_healthy = $2, last_heartbeat_at = $3, updated_at = now() WHERE id = $1',
      [id, isHealthy, heartbeatAt],
    );
  }
}
