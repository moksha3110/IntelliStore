import type { ApiResponse } from '@intellistore/shared-types';
import { AppError } from '../errors/app-error';

export interface FileRecordDto {
  id: string;
  ownerId: string;
  fileName: string;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface FileVersionDto {
  id: string;
  fileId: string;
  versionNumber: number;
  sizeBytes: number;
  mimeType: string;
  checksum: string;
  createdAt: string;
}

export interface FileWithLatestVersionDto {
  file: FileRecordDto;
  latestVersion: FileVersionDto | null;
}

export interface SystemStatsDto {
  totalFiles: number;
  totalVersions: number;
  totalChunks: number;
  totalBytes: number;
  logicalChunkBytes: number;
  physicalChunkBytes: number;
  dedupedBytes: number;
}

export interface MetadataClient {
  listFiles(bearerToken: string): Promise<FileWithLatestVersionDto[]>;
  getSystemStats(bearerToken: string): Promise<SystemStatsDto>;
}

export class HttpMetadataClient implements MetadataClient {
  constructor(private readonly baseUrl: string) {}

  listFiles(bearerToken: string): Promise<FileWithLatestVersionDto[]> {
    return this.request('GET', '/files', bearerToken);
  }

  getSystemStats(bearerToken: string): Promise<SystemStatsDto> {
    return this.request('GET', '/files/_stats', bearerToken);
  }

  private async request<T>(method: 'GET', path: string, bearerToken: string): Promise<T> {
    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: { Authorization: `Bearer ${bearerToken}` },
      });
    } catch {
      throw AppError.badGateway('Metadata service is unreachable');
    }

    const json = (await res.json()) as ApiResponse<T>;
    if (!json.success) {
      throw new AppError(res.status, json.error.code, json.error.message, json.error.details);
    }
    return json.data;
  }
}
