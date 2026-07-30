import { randomUUID } from 'node:crypto';
import { sha256, splitIntoChunks } from '../chunking/chunking.service';
import type {
  AddVersionPayload,
  ChunkDto,
  FileVersionDto,
  MetadataClient,
  RegisterFileResult,
} from '../clients/metadata.client';
import { AppError } from '../errors/app-error';
import type { EventPublisher } from '../events/event-publisher';
import type { StorageBackend } from '../storage/storage-backend';

export interface UploadServiceOptions {
  chunkSizeBytes: number;
}

export class UploadService {
  constructor(
    private readonly storageBackend: StorageBackend,
    private readonly metadataClient: MetadataClient,
    private readonly eventPublisher: EventPublisher,
    private readonly options: UploadServiceOptions,
  ) {}

  async uploadNewFile(
    bearerToken: string,
    fileName: string,
    mimeType: string,
    buffer: Buffer,
  ): Promise<RegisterFileResult> {
    const { chunkKeys, payload } = await this.storeChunks(buffer, mimeType);

    const result = await this.registerWithCleanup(chunkKeys, () =>
      this.metadataClient.registerFile(bearerToken, { fileName, ...payload }),
    );
    await this.publishChunkUploaded({
      fileId: result.file.id,
      ownerId: result.file.ownerId,
      fileName: result.file.fileName,
      versionId: result.version.id,
      versionNumber: result.version.versionNumber,
      chunks: result.chunks,
    });
    return result;
  }

  async uploadNewVersion(
    bearerToken: string,
    fileId: string,
    mimeType: string,
    buffer: Buffer,
  ): Promise<{ version: FileVersionDto; chunks: ChunkDto[] }> {
    const { chunkKeys, payload } = await this.storeChunks(buffer, mimeType);

    const result = await this.registerWithCleanup(chunkKeys, () =>
      this.metadataClient.addVersion(bearerToken, fileId, payload),
    );
    // The addVersion response carries the version but not the owning file, so
    // fetch the file record for the owner/name the notification event needs.
    const detail = await this.metadataClient.getFileDetail(bearerToken, fileId);
    await this.publishChunkUploaded({
      fileId,
      ownerId: detail.file.ownerId,
      fileName: detail.file.fileName,
      versionId: result.version.id,
      versionNumber: result.version.versionNumber,
      chunks: result.chunks,
    });
    return result;
  }

  private async publishChunkUploaded(input: {
    fileId: string;
    ownerId: string;
    fileName: string;
    versionId: string;
    versionNumber: number;
    chunks: ChunkDto[];
  }): Promise<void> {
    await this.eventPublisher.publishChunkUploaded({
      fileId: input.fileId,
      ownerId: input.ownerId,
      fileName: input.fileName,
      versionId: input.versionId,
      versionNumber: input.versionNumber,
      chunks: input.chunks.map((chunk) => ({
        chunkId: chunk.id,
        storageKey: chunk.storageKey,
        sizeBytes: chunk.sizeBytes,
      })),
    });
  }

  private async storeChunks(
    buffer: Buffer,
    mimeType: string,
  ): Promise<{ chunkKeys: string[]; payload: AddVersionPayload }> {
    if (buffer.length === 0) {
      throw AppError.badRequest('Cannot upload an empty file');
    }

    const pieces = splitIntoChunks(buffer, this.options.chunkSizeBytes);
    const sessionId = randomUUID();
    const chunkKeys: string[] = [];

    for (const piece of pieces) {
      const key = `${sessionId}/${piece.index}`;
      await this.storageBackend.put(key, piece.data);
      chunkKeys.push(key);
    }

    return {
      chunkKeys,
      payload: {
        mimeType,
        checksum: sha256(buffer),
        chunks: pieces.map((piece, i) => ({
          chunkIndex: piece.index,
          sizeBytes: piece.sizeBytes,
          checksum: piece.checksum,
          storageKey: chunkKeys[i],
        })),
      },
    };
  }

  private async registerWithCleanup<T>(
    chunkKeys: string[],
    register: () => Promise<T>,
  ): Promise<T> {
    try {
      return await register();
    } catch (err) {
      await Promise.allSettled(chunkKeys.map((key) => this.storageBackend.delete(key)));
      throw err;
    }
  }
}
