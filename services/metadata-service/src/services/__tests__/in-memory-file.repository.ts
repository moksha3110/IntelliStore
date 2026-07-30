import { randomUUID } from 'node:crypto';
import type {
  ChunkInput,
  ChunkRecord,
  FileRecord,
  FileRepository,
  FileVersionRecord,
  SystemStats,
} from '../../repositories/file.repository';

export class InMemoryFileRepository implements FileRepository {
  private readonly files = new Map<string, FileRecord>();
  private readonly versions = new Map<string, FileVersionRecord[]>();
  private readonly chunks = new Map<string, ChunkRecord[]>();

  async createFile(ownerId: string, fileName: string): Promise<FileRecord> {
    const now = new Date().toISOString();
    const file: FileRecord = {
      id: randomUUID(),
      ownerId,
      fileName,
      isDeleted: false,
      createdAt: now,
      updatedAt: now,
    };
    this.files.set(file.id, file);
    this.versions.set(file.id, []);
    return file;
  }

  async findFileById(id: string): Promise<FileRecord | null> {
    const file = this.files.get(id);
    return file && !file.isDeleted ? file : null;
  }

  async listFilesByOwner(ownerId: string): Promise<FileRecord[]> {
    return [...this.files.values()]
      .filter((file) => file.ownerId === ownerId && !file.isDeleted)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async searchByOwner(ownerId: string, query: string): Promise<FileRecord[]> {
    const needle = query.toLowerCase();
    return [...this.files.values()]
      .filter(
        (file) =>
          file.ownerId === ownerId &&
          !file.isDeleted &&
          file.fileName.toLowerCase().includes(needle),
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async softDeleteFile(id: string): Promise<void> {
    const file = this.files.get(id);
    if (file) file.isDeleted = true;
  }

  async createVersion(
    fileId: string,
    version: { sizeBytes: number; mimeType: string; checksum: string },
    chunks: ChunkInput[],
  ): Promise<{ version: FileVersionRecord; chunks: ChunkRecord[] }> {
    const existing = this.versions.get(fileId) ?? [];
    const versionNumber = existing.length + 1;
    const record: FileVersionRecord = {
      id: randomUUID(),
      fileId,
      versionNumber,
      sizeBytes: version.sizeBytes,
      mimeType: version.mimeType,
      checksum: version.checksum,
      createdAt: new Date().toISOString(),
    };
    existing.push(record);
    this.versions.set(fileId, existing);

    const chunkRecords: ChunkRecord[] = chunks.map((chunk) => ({
      id: randomUUID(),
      fileVersionId: record.id,
      chunkIndex: chunk.chunkIndex,
      sizeBytes: chunk.sizeBytes,
      checksum: chunk.checksum,
      storageKey: chunk.storageKey,
    }));
    this.chunks.set(record.id, chunkRecords);

    return { version: record, chunks: chunkRecords };
  }

  async listVersions(fileId: string): Promise<FileVersionRecord[]> {
    return [...(this.versions.get(fileId) ?? [])].sort(
      (a, b) => b.versionNumber - a.versionNumber,
    );
  }

  async findVersion(fileId: string, versionNumber: number): Promise<FileVersionRecord | null> {
    const found = (this.versions.get(fileId) ?? []).find(
      (version) => version.versionNumber === versionNumber,
    );
    return found ?? null;
  }

  async latestVersion(fileId: string): Promise<FileVersionRecord | null> {
    const list = this.versions.get(fileId) ?? [];
    if (list.length === 0) return null;
    return list.reduce((latest, current) =>
      current.versionNumber > latest.versionNumber ? current : latest,
    );
  }

  async listChunks(fileVersionId: string): Promise<ChunkRecord[]> {
    return [...(this.chunks.get(fileVersionId) ?? [])].sort(
      (a, b) => a.chunkIndex - b.chunkIndex,
    );
  }

  async getSystemStats(): Promise<SystemStats> {
    // Matches the SQL implementation's semantics: version/chunk counts are
    // unconditional totals, only totalBytes and totalFiles are scoped to
    // non-deleted files (a soft-deleted file's historical rows still count
    // toward version/chunk totals, but not toward "current" logical bytes).
    const activeFiles = [...this.files.values()].filter((file) => !file.isDeleted);
    let totalVersions = 0;
    let totalBytes = 0;

    for (const versions of this.versions.values()) {
      totalVersions += versions.length;
    }

    for (const file of activeFiles) {
      const versions = this.versions.get(file.id) ?? [];
      const latest = versions.reduce<FileVersionRecord | null>(
        (best, current) => (!best || current.versionNumber > best.versionNumber ? current : best),
        null,
      );
      if (latest) totalBytes += latest.sizeBytes;
    }

    const allChunks = [...this.chunks.values()].flat();
    const logicalChunkBytes = allChunks.reduce((sum, c) => sum + c.sizeBytes, 0);
    const distinctByKey = new Map<string, number>();
    for (const c of allChunks) distinctByKey.set(c.storageKey, c.sizeBytes);
    const physicalChunkBytes = [...distinctByKey.values()].reduce((sum, s) => sum + s, 0);

    return {
      totalFiles: activeFiles.length,
      totalVersions,
      totalChunks: allChunks.length,
      totalBytes,
      logicalChunkBytes,
      physicalChunkBytes,
      dedupedBytes: logicalChunkBytes - physicalChunkBytes,
    };
  }
}
