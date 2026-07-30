import { beforeEach, describe, expect, it } from 'vitest';
import { AppError } from '../../errors/app-error';
import { FileService } from '../file.service';
import { InMemoryFileRepository } from './in-memory-file.repository';

const OWNER_A = 'owner-a';
const OWNER_B = 'owner-b';

function sampleInput(overrides: Partial<{ fileName: string; checksum: string }> = {}) {
  return {
    fileName: overrides.fileName ?? 'report.pdf',
    mimeType: 'application/pdf',
    checksum: overrides.checksum ?? 'checksum-v1',
    chunks: [
      { chunkIndex: 0, sizeBytes: 1024, checksum: 'chunk-0', storageKey: 'files/a/0' },
      { chunkIndex: 1, sizeBytes: 512, checksum: 'chunk-1', storageKey: 'files/a/1' },
    ],
  };
}

describe('FileService', () => {
  let fileService: FileService;

  beforeEach(() => {
    fileService = new FileService(new InMemoryFileRepository());
  });

  it('registers a file with a first version summing chunk sizes', async () => {
    const result = await fileService.registerFile(OWNER_A, sampleInput());

    expect(result.file.ownerId).toBe(OWNER_A);
    expect(result.version.versionNumber).toBe(1);
    expect(result.version.sizeBytes).toBe(1536);
    expect(result.chunks).toHaveLength(2);
  });

  it('lists files for the owner with their latest version', async () => {
    await fileService.registerFile(OWNER_A, sampleInput());
    const list = await fileService.listFiles(OWNER_A);

    expect(list).toHaveLength(1);
    expect(list[0].latestVersion?.versionNumber).toBe(1);
  });

  it('does not list another owner\'s files', async () => {
    await fileService.registerFile(OWNER_A, sampleInput());
    const list = await fileService.listFiles(OWNER_B);
    expect(list).toHaveLength(0);
  });

  it('adds a new version and increments the version number', async () => {
    const { file } = await fileService.registerFile(OWNER_A, sampleInput());

    const { version } = await fileService.addVersion(OWNER_A, file.id, {
      mimeType: 'application/pdf',
      checksum: 'checksum-v2',
      chunks: [{ chunkIndex: 0, sizeBytes: 2048, checksum: 'chunk-0-v2', storageKey: 'files/a/v2/0' }],
    });

    expect(version.versionNumber).toBe(2);
    expect(version.sizeBytes).toBe(2048);

    const detail = await fileService.getFile(OWNER_A, file.id);
    expect(detail.versions.map((v) => v.versionNumber)).toEqual([2, 1]);
  });

  it('rejects adding a version to a file owned by someone else', async () => {
    const { file } = await fileService.registerFile(OWNER_A, sampleInput());

    await expect(
      fileService.addVersion(OWNER_B, file.id, sampleInput({ checksum: 'attacker-checksum' })),
    ).rejects.toThrow(AppError);
  });

  it('retrieves a specific version with its chunks', async () => {
    const { file } = await fileService.registerFile(OWNER_A, sampleInput());

    const detail = await fileService.getVersion(OWNER_A, file.id, 1);
    expect(detail.chunks).toHaveLength(2);
    expect(detail.chunks[0].chunkIndex).toBe(0);
  });

  it('throws not-found for a version that does not exist', async () => {
    const { file } = await fileService.registerFile(OWNER_A, sampleInput());
    await expect(fileService.getVersion(OWNER_A, file.id, 99)).rejects.toThrow(AppError);
  });

  it('excludes soft-deleted files from listing and detail lookups', async () => {
    const { file } = await fileService.registerFile(OWNER_A, sampleInput());
    await fileService.deleteFile(OWNER_A, file.id);

    const list = await fileService.listFiles(OWNER_A);
    expect(list).toHaveLength(0);

    await expect(fileService.getFile(OWNER_A, file.id)).rejects.toThrow(AppError);
  });

  it('rejects deleting a file owned by someone else', async () => {
    const { file } = await fileService.registerFile(OWNER_A, sampleInput());
    await expect(fileService.deleteFile(OWNER_B, file.id)).rejects.toThrow(AppError);
  });

  it('searches the caller\'s files by name, case-insensitively', async () => {
    await fileService.registerFile(OWNER_A, sampleInput({ fileName: 'Annual-Report.pdf' }));
    await fileService.registerFile(OWNER_A, sampleInput({ fileName: 'vacation.jpg' }));
    await fileService.registerFile(OWNER_A, sampleInput({ fileName: 'report-draft.docx' }));

    const results = await fileService.searchFiles(OWNER_A, 'report');
    expect(results.map((r) => r.file.fileName).sort()).toEqual([
      'Annual-Report.pdf',
      'report-draft.docx',
    ]);
  });

  it('does not return another owner\'s files or soft-deleted files in search', async () => {
    await fileService.registerFile(OWNER_B, sampleInput({ fileName: 'report-secret.pdf' }));
    const { file: del } = await fileService.registerFile(OWNER_A, sampleInput({ fileName: 'report-old.pdf' }));
    await fileService.deleteFile(OWNER_A, del.id);
    await fileService.registerFile(OWNER_A, sampleInput({ fileName: 'report-live.pdf' }));

    const results = await fileService.searchFiles(OWNER_A, 'report');
    expect(results.map((r) => r.file.fileName)).toEqual(['report-live.pdf']);
  });

  it('rejects an empty search query', async () => {
    await expect(fileService.searchFiles(OWNER_A, '   ')).rejects.toThrow(AppError);
  });

  it('returns files with their latest version from search', async () => {
    const { file } = await fileService.registerFile(OWNER_A, sampleInput({ fileName: 'searchme.pdf' }));
    await fileService.addVersion(OWNER_A, file.id, {
      mimeType: 'application/pdf',
      checksum: 'v2',
      chunks: [{ chunkIndex: 0, sizeBytes: 999, checksum: 'c', storageKey: 'k' }],
    });

    const [result] = await fileService.searchFiles(OWNER_A, 'searchme');
    expect(result.latestVersion?.versionNumber).toBe(2);
  });

  it('computes system-wide stats across all owners, excluding soft-deleted files from totals', async () => {
    await fileService.registerFile(OWNER_A, sampleInput());
    const { file: fileB } = await fileService.registerFile(OWNER_B, sampleInput());
    await fileService.addVersion(OWNER_B, fileB.id, {
      mimeType: 'application/pdf',
      checksum: 'checksum-v2',
      chunks: [{ chunkIndex: 0, sizeBytes: 2000, checksum: 'chunk-0-v2', storageKey: 'files/b/v2/0' }],
    });
    const { file: deletedFile } = await fileService.registerFile(OWNER_A, sampleInput());
    await fileService.deleteFile(OWNER_A, deletedFile.id);

    const stats = await fileService.getSystemStats();

    expect(stats.totalFiles).toBe(2); // deleted file excluded
    expect(stats.totalVersions).toBe(4); // 2 files x v1, 1 extra v2, 1 deleted file's v1
    expect(stats.totalBytes).toBe(1536 + 2000); // fileA's v1 (1024+512) + fileB's latest v2 (2000)

    // sampleInput reuses the same two storage keys ('files/a/0','files/a/1')
    // for all three files, so those chunks dedup. logical = every chunk row;
    // physical = distinct storage keys.
    // 7 chunk rows: 3 files x 2 v1 chunks + fileB's 1 v2 chunk.
    expect(stats.logicalChunkBytes).toBe(3 * 1536 + 2000); // 6608
    expect(stats.physicalChunkBytes).toBe(1024 + 512 + 2000); // 3 distinct keys = 3536
    expect(stats.dedupedBytes).toBe(6608 - 3536); // 3072 saved by dedup
  });
});
