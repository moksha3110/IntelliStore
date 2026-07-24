import type { Pool } from 'pg';

export interface FileAccessStats {
  fileId: string;
  accessCount: number;
  firstAccessedAt: string | null;
  lastAccessedAt: string | null;
}

interface FileAccessStatsRow {
  file_id: string;
  access_count: number;
  first_accessed_at: string | null;
  last_accessed_at: string | null;
}

function toStats(row: FileAccessStatsRow): FileAccessStats {
  return {
    fileId: row.file_id,
    accessCount: row.access_count,
    firstAccessedAt: row.first_accessed_at,
    lastAccessedAt: row.last_accessed_at,
  };
}

export interface AccessStatsRepository {
  recordAccess(fileId: string, accessedAt: string): Promise<void>;
  findByFileId(fileId: string): Promise<FileAccessStats | null>;
  findByFileIds(fileIds: string[]): Promise<FileAccessStats[]>;
}

export class PgAccessStatsRepository implements AccessStatsRepository {
  constructor(private readonly pool: Pool) {}

  async recordAccess(fileId: string, accessedAt: string): Promise<void> {
    await this.pool.query(
      `INSERT INTO file_access_stats (file_id, access_count, first_accessed_at, last_accessed_at)
       VALUES ($1, 1, $2, $2)
       ON CONFLICT (file_id)
       DO UPDATE SET
         access_count = file_access_stats.access_count + 1,
         last_accessed_at = EXCLUDED.last_accessed_at,
         updated_at = now()`,
      [fileId, accessedAt],
    );
  }

  async findByFileId(fileId: string): Promise<FileAccessStats | null> {
    const result = await this.pool.query<FileAccessStatsRow>(
      'SELECT * FROM file_access_stats WHERE file_id = $1',
      [fileId],
    );
    return result.rows[0] ? toStats(result.rows[0]) : null;
  }

  async findByFileIds(fileIds: string[]): Promise<FileAccessStats[]> {
    if (fileIds.length === 0) return [];
    const result = await this.pool.query<FileAccessStatsRow>(
      'SELECT * FROM file_access_stats WHERE file_id = ANY($1::uuid[])',
      [fileIds],
    );
    return result.rows.map(toStats);
  }
}
