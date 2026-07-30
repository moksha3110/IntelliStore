import { AppError } from '../errors/app-error';
import type {
  ChunkRecord,
  FileRecord,
  FileRepository,
  FileVersionRecord,
  SystemStats,
} from '../repositories/file.repository';
import type { CreateFileInput, CreateVersionInput } from '../validation/file.schema';

export interface FileWithLatestVersion {
  file: FileRecord;
  latestVersion: FileVersionRecord | null;
}

export interface FileDetail {
  file: FileRecord;
  versions: FileVersionRecord[];
}

export interface VersionDetail {
  version: FileVersionRecord;
  chunks: ChunkRecord[];
}

function totalSize(chunks: { sizeBytes: number }[]): number {
  return chunks.reduce((sum, chunk) => sum + chunk.sizeBytes, 0);
}

export class FileService {
  constructor(private readonly fileRepository: FileRepository) {}

  private async getOwnedFile(ownerId: string, fileId: string): Promise<FileRecord> {
    const file = await this.fileRepository.findFileById(fileId);
    if (!file || file.ownerId !== ownerId) {
      throw AppError.notFound('File not found');
    }
    return file;
  }

  async registerFile(
    ownerId: string,
    input: CreateFileInput,
  ): Promise<{ file: FileRecord; version: FileVersionRecord; chunks: ChunkRecord[] }> {
    const file = await this.fileRepository.createFile(ownerId, input.fileName);
    const { version, chunks } = await this.fileRepository.createVersion(
      file.id,
      { sizeBytes: totalSize(input.chunks), mimeType: input.mimeType, checksum: input.checksum },
      input.chunks,
    );
    return { file, version, chunks };
  }

  async addVersion(
    ownerId: string,
    fileId: string,
    input: CreateVersionInput,
  ): Promise<{ version: FileVersionRecord; chunks: ChunkRecord[] }> {
    await this.getOwnedFile(ownerId, fileId);
    return this.fileRepository.createVersion(
      fileId,
      { sizeBytes: totalSize(input.chunks), mimeType: input.mimeType, checksum: input.checksum },
      input.chunks,
    );
  }

  async listFiles(ownerId: string): Promise<FileWithLatestVersion[]> {
    const files = await this.fileRepository.listFilesByOwner(ownerId);
    return this.withLatestVersions(files);
  }

  async searchFiles(ownerId: string, query: string): Promise<FileWithLatestVersion[]> {
    const trimmed = query.trim();
    if (trimmed.length === 0) {
      throw AppError.badRequest('Search query must not be empty');
    }
    const files = await this.fileRepository.searchByOwner(ownerId, trimmed);
    return this.withLatestVersions(files);
  }

  private withLatestVersions(files: FileRecord[]): Promise<FileWithLatestVersion[]> {
    return Promise.all(
      files.map(async (file) => ({
        file,
        latestVersion: await this.fileRepository.latestVersion(file.id),
      })),
    );
  }

  async getFile(ownerId: string, fileId: string): Promise<FileDetail> {
    const file = await this.getOwnedFile(ownerId, fileId);
    const versions = await this.fileRepository.listVersions(file.id);
    return { file, versions };
  }

  async getVersion(
    ownerId: string,
    fileId: string,
    versionNumber: number,
  ): Promise<VersionDetail> {
    await this.getOwnedFile(ownerId, fileId);
    const version = await this.fileRepository.findVersion(fileId, versionNumber);
    if (!version) {
      throw AppError.notFound('Version not found');
    }
    const chunks = await this.fileRepository.listChunks(version.id);
    return { version, chunks };
  }

  async deleteFile(ownerId: string, fileId: string): Promise<void> {
    await this.getOwnedFile(ownerId, fileId);
    await this.fileRepository.softDeleteFile(fileId);
  }

  getSystemStats(): Promise<SystemStats> {
    return this.fileRepository.getSystemStats();
  }
}
