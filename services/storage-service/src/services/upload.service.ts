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

export interface DedupInfo {
  totalChunks: number;
  storedChunks: number;
  dedupedChunks: number;
  bytesSaved: number;
}

export type UploadResult = RegisterFileResult & { dedup: DedupInfo };

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
  ): Promise<UploadResult> {
    const { newlyWrittenKeys, payload, dedup } = await this.storeChunks(buffer, mimeType);

    const result = await this.registerWithCleanup(newlyWrittenKeys, () =>
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
    return { ...result, dedup };
  }

  async uploadNewVersion(
    bearerToken: string,
    fileId: string,
    mimeType: string,
    buffer: Buffer,
  ): Promise<{ version: FileVersionDto; chunks: ChunkDto[]; dedup: DedupInfo }> {
    const { newlyWrittenKeys, payload, dedup } = await this.storeChunks(buffer, mimeType);

    const result = await this.registerWithCleanup(newlyWrittenKeys, () =>
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
    return { ...result, dedup };
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
  ): Promise<{ newlyWrittenKeys: string[]; payload: AddVersionPayload; dedup: DedupInfo }> {
    if (buffer.length === 0) {
      throw AppError.badRequest('Cannot upload an empty file');
    }

    const pieces = splitIntoChunks(buffer, this.options.chunkSizeBytes);
    // Content-addressed storage: the key IS the chunk's SHA-256. Identical chunk
    // content therefore maps to the same object and is stored exactly once
    // (deduplication), no matter which file or user uploaded it.
    const newlyWrittenKeys: string[] = [];
    let dedupedChunks = 0;
    let bytesSaved = 0;

    for (const piece of pieces) {
      const key = `chunks/${piece.checksum}`;
      if (await this.storageBackend.exists(key)) {
        dedupedChunks += 1;
        bytesSaved += piece.sizeBytes;
      } else {
        await this.storageBackend.put(key, piece.data);
        newlyWrittenKeys.push(key);
      }
    }

    return {
      newlyWrittenKeys,
      payload: {
        mimeType,
        checksum: sha256(buffer),
        chunks: pieces.map((piece) => ({
          chunkIndex: piece.index,
          sizeBytes: piece.sizeBytes,
          checksum: piece.checksum,
          storageKey: `chunks/${piece.checksum}`,
        })),
      },
      dedup: {
        totalChunks: pieces.length,
        storedChunks: newlyWrittenKeys.length,
        dedupedChunks,
        bytesSaved,
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
