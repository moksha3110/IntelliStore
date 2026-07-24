import type { AccessStatsRepository, FileAccessStats } from '../../repositories/access-stats.repository';

export class InMemoryAccessStatsRepository implements AccessStatsRepository {
  private readonly stats = new Map<string, FileAccessStats>();

  async recordAccess(fileId: string, accessedAt: string): Promise<void> {
    const existing = this.stats.get(fileId);
    this.stats.set(fileId, {
      fileId,
      accessCount: (existing?.accessCount ?? 0) + 1,
      firstAccessedAt: existing?.firstAccessedAt ?? accessedAt,
      lastAccessedAt: accessedAt,
    });
  }

  async findByFileId(fileId: string): Promise<FileAccessStats | null> {
    return this.stats.get(fileId) ?? null;
  }

  async findByFileIds(fileIds: string[]): Promise<FileAccessStats[]> {
    return fileIds.map((id) => this.stats.get(id)).filter((s): s is FileAccessStats => Boolean(s));
  }

  seed(stat: FileAccessStats): void {
    this.stats.set(stat.fileId, stat);
  }
}
