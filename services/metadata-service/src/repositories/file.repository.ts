import type { Pool } from 'pg';

export interface FileRecord {
  id: string;
  ownerId: string;
  fileName: string;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface FileVersionRecord {
  id: string;
  fileId: string;
  versionNumber: number;
  sizeBytes: number;
  mimeType: string;
  checksum: string;
  createdAt: string;
}

export interface ChunkRecord {
  id: string;
  fileVersionId: string;
  chunkIndex: number;
  sizeBytes: number;
  checksum: string;
  storageKey: string;
}

export interface ChunkInput {
  chunkIndex: number;
  sizeBytes: number;
  checksum: string;
  storageKey: string;
}

interface FileRow {
  id: string;
  owner_id: string;
  file_name: string;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

interface FileVersionRow {
  id: string;
  file_id: string;
  version_number: number;
  size_bytes: string;
  mime_type: string;
  checksum: string;
  created_at: string;
}

interface ChunkRow {
  id: string;
  file_version_id: string;
  chunk_index: number;
  size_bytes: string;
  checksum: string;
  storage_key: string;
}

function toFile(row: FileRow): FileRecord {
  return {
    id: row.id,
    ownerId: row.owner_id,
    fileName: row.file_name,
    isDeleted: row.is_deleted,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toFileVersion(row: FileVersionRow): FileVersionRecord {
  return {
    id: row.id,
    fileId: row.file_id,
    versionNumber: row.version_number,
    sizeBytes: Number(row.size_bytes),
    mimeType: row.mime_type,
    checksum: row.checksum,
    createdAt: row.created_at,
  };
}

function toChunk(row: ChunkRow): ChunkRecord {
  return {
    id: row.id,
    fileVersionId: row.file_version_id,
    chunkIndex: row.chunk_index,
    sizeBytes: Number(row.size_bytes),
    checksum: row.checksum,
    storageKey: row.storage_key,
  };
}

export interface SystemStats {
  totalFiles: number;
  totalVersions: number;
  totalChunks: number;
  totalBytes: number;
  // Deduplication: logical chunk bytes = sum over every chunk row; physical =
  // sum over *distinct* content-addressed storage keys (each stored once);
  // saved = the difference eliminated by dedup.
  logicalChunkBytes: number;
  physicalChunkBytes: number;
  dedupedBytes: number;
}

export interface FileRepository {
  createFile(ownerId: string, fileName: string): Promise<FileRecord>;
  findFileById(id: string): Promise<FileRecord | null>;
  listFilesByOwner(ownerId: string): Promise<FileRecord[]>;
  softDeleteFile(id: string): Promise<void>;
  getSystemStats(): Promise<SystemStats>;

  createVersion(
    fileId: string,
    version: { sizeBytes: number; mimeType: string; checksum: string },
    chunks: ChunkInput[],
  ): Promise<{ version: FileVersionRecord; chunks: ChunkRecord[] }>;
  listVersions(fileId: string): Promise<FileVersionRecord[]>;
  findVersion(fileId: string, versionNumber: number): Promise<FileVersionRecord | null>;
  latestVersion(fileId: string): Promise<FileVersionRecord | null>;
  listChunks(fileVersionId: string): Promise<ChunkRecord[]>;
}

export class PgFileRepository implements FileRepository {
  constructor(private readonly pool: Pool) {}

  async createFile(ownerId: string, fileName: string): Promise<FileRecord> {
    const result = await this.pool.query<FileRow>(
      `INSERT INTO files (owner_id, file_name) VALUES ($1, $2) RETURNING *`,
      [ownerId, fileName],
    );
    return toFile(result.rows[0]);
  }

  async findFileById(id: string): Promise<FileRecord | null> {
    const result = await this.pool.query<FileRow>(
      'SELECT * FROM files WHERE id = $1 AND is_deleted = false',
      [id],
    );
    return result.rows[0] ? toFile(result.rows[0]) : null;
  }

  async listFilesByOwner(ownerId: string): Promise<FileRecord[]> {
    const result = await this.pool.query<FileRow>(
      'SELECT * FROM files WHERE owner_id = $1 AND is_deleted = false ORDER BY created_at DESC',
      [ownerId],
    );
    return result.rows.map(toFile);
  }

  async softDeleteFile(id: string): Promise<void> {
    await this.pool.query('UPDATE files SET is_deleted = true, updated_at = now() WHERE id = $1', [
      id,
    ]);
  }

  async getSystemStats(): Promise<SystemStats> {
    const result = await this.pool.query<{
      total_files: string;
      total_versions: string;
      total_chunks: string;
      total_bytes: string;
      logical_chunk_bytes: string;
      physical_chunk_bytes: string;
    }>(`
      SELECT
        (SELECT count(*) FROM files WHERE is_deleted = false) AS total_files,
        (SELECT count(*) FROM file_versions) AS total_versions,
        (SELECT count(*) FROM chunks) AS total_chunks,
        (SELECT COALESCE(SUM(latest.size_bytes), 0) FROM (
           SELECT DISTINCT ON (fv.file_id) fv.size_bytes
           FROM file_versions fv
           JOIN files f ON f.id = fv.file_id AND f.is_deleted = false
           ORDER BY fv.file_id, fv.version_number DESC
         ) latest) AS total_bytes,
        (SELECT COALESCE(SUM(size_bytes), 0) FROM chunks) AS logical_chunk_bytes,
        (SELECT COALESCE(SUM(size_bytes), 0) FROM (
           SELECT DISTINCT storage_key, size_bytes FROM chunks
         ) distinct_chunks) AS physical_chunk_bytes
    `);
    const row = result.rows[0];
    const logicalChunkBytes = Number(row.logical_chunk_bytes);
    const physicalChunkBytes = Number(row.physical_chunk_bytes);
    return {
      totalFiles: Number(row.total_files),
      totalVersions: Number(row.total_versions),
      totalChunks: Number(row.total_chunks),
      totalBytes: Number(row.total_bytes),
      logicalChunkBytes,
      physicalChunkBytes,
      dedupedBytes: logicalChunkBytes - physicalChunkBytes,
    };
  }

  async createVersion(
    fileId: string,
    version: { sizeBytes: number; mimeType: string; checksum: string },
    chunks: ChunkInput[],
  ): Promise<{ version: FileVersionRecord; chunks: ChunkRecord[] }> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const nextVersionResult = await client.query<{ next: number }>(
        'SELECT COALESCE(MAX(version_number), 0) + 1 AS next FROM file_versions WHERE file_id = $1',
        [fileId],
      );
      const nextVersionNumber = nextVersionResult.rows[0].next;

      const versionResult = await client.query<FileVersionRow>(
        `INSERT INTO file_versions (file_id, version_number, size_bytes, mime_type, checksum)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [fileId, nextVersionNumber, version.sizeBytes, version.mimeType, version.checksum],
      );
      const versionRow = versionResult.rows[0];

      const chunkRows: ChunkRow[] = [];
      for (const chunk of chunks) {
        const chunkResult = await client.query<ChunkRow>(
          `INSERT INTO chunks (file_version_id, chunk_index, size_bytes, checksum, storage_key)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING *`,
          [versionRow.id, chunk.chunkIndex, chunk.sizeBytes, chunk.checksum, chunk.storageKey],
        );
        chunkRows.push(chunkResult.rows[0]);
      }

      await client.query('UPDATE files SET updated_at = now() WHERE id = $1', [fileId]);
      await client.query('COMMIT');

      return { version: toFileVersion(versionRow), chunks: chunkRows.map(toChunk) };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async listVersions(fileId: string): Promise<FileVersionRecord[]> {
    const result = await this.pool.query<FileVersionRow>(
      'SELECT * FROM file_versions WHERE file_id = $1 ORDER BY version_number DESC',
      [fileId],
    );
    return result.rows.map(toFileVersion);
  }

  async findVersion(fileId: string, versionNumber: number): Promise<FileVersionRecord | null> {
    const result = await this.pool.query<FileVersionRow>(
      'SELECT * FROM file_versions WHERE file_id = $1 AND version_number = $2',
      [fileId, versionNumber],
    );
    return result.rows[0] ? toFileVersion(result.rows[0]) : null;
  }

  async latestVersion(fileId: string): Promise<FileVersionRecord | null> {
    const result = await this.pool.query<FileVersionRow>(
      'SELECT * FROM file_versions WHERE file_id = $1 ORDER BY version_number DESC LIMIT 1',
      [fileId],
    );
    return result.rows[0] ? toFileVersion(result.rows[0]) : null;
  }

  async listChunks(fileVersionId: string): Promise<ChunkRecord[]> {
    const result = await this.pool.query<ChunkRow>(
      'SELECT * FROM chunks WHERE file_version_id = $1 ORDER BY chunk_index ASC',
      [fileVersionId],
    );
    return result.rows.map(toChunk);
  }
}
