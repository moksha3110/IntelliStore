import { sha256 } from '../chunking/chunking.service';
import type { MetadataClient } from '../clients/metadata.client';
import { AppError } from '../errors/app-error';
import type { StorageBackend } from '../storage/storage-backend';

export interface DownloadResult {
  buffer: Buffer;
  fileName: string;
  mimeType: string;
  versionNumber: number;
}

export class DownloadService {
  constructor(
    private readonly storageBackend: StorageBackend,
    private readonly metadataClient: MetadataClient,
  ) {}

  async download(
    bearerToken: string,
    fileId: string,
    versionNumber?: number,
  ): Promise<DownloadResult> {
    const fileDetail = await this.metadataClient.getFileDetail(bearerToken, fileId);
    if (fileDetail.versions.length === 0) {
      throw AppError.notFound('File has no versions');
    }

    const targetVersion = versionNumber ?? fileDetail.versions[0].versionNumber;
    const versionDetail = await this.metadataClient.getVersionDetail(
      bearerToken,
      fileId,
      targetVersion,
    );

    const chunkBuffers = await Promise.all(
      versionDetail.chunks.map((chunk) => this.storageBackend.get(chunk.storageKey)),
    );
    const combined = Buffer.concat(chunkBuffers);

    if (sha256(combined) !== versionDetail.version.checksum) {
      throw AppError.integrityFailure('Reconstructed file failed checksum verification');
    }

    return {
      buffer: combined,
      fileName: fileDetail.file.fileName,
      mimeType: versionDetail.version.mimeType,
      versionNumber: versionDetail.version.versionNumber,
    };
  }
}
