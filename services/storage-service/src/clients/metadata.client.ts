import type { ApiResponse } from '@intellistore/shared-types';
import { AppError } from '../errors/app-error';

export interface ChunkPayload {
  chunkIndex: number;
  sizeBytes: number;
  checksum: string;
  storageKey: string;
}

export interface RegisterFilePayload {
  fileName: string;
  mimeType: string;
  checksum: string;
  chunks: ChunkPayload[];
}

export interface AddVersionPayload {
  mimeType: string;
  checksum: string;
  chunks: ChunkPayload[];
}

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

export interface ChunkDto {
  id: string;
  fileVersionId: string;
  chunkIndex: number;
  sizeBytes: number;
  checksum: string;
  storageKey: string;
}

export interface RegisterFileResult {
  file: FileRecordDto;
  version: FileVersionDto;
  chunks: ChunkDto[];
}

export interface FileDetailResult {
  file: FileRecordDto;
  versions: FileVersionDto[];
}

export interface VersionDetailResult {
  version: FileVersionDto;
  chunks: ChunkDto[];
}

export interface MetadataClient {
  registerFile(bearerToken: string, payload: RegisterFilePayload): Promise<RegisterFileResult>;
  addVersion(
    bearerToken: string,
    fileId: string,
    payload: AddVersionPayload,
  ): Promise<{ version: FileVersionDto; chunks: ChunkDto[] }>;
  getFileDetail(bearerToken: string, fileId: string): Promise<FileDetailResult>;
  getVersionDetail(
    bearerToken: string,
    fileId: string,
    versionNumber: number,
  ): Promise<VersionDetailResult>;
}

export class HttpMetadataClient implements MetadataClient {
  constructor(private readonly baseUrl: string) {}

  registerFile(bearerToken: string, payload: RegisterFilePayload): Promise<RegisterFileResult> {
    return this.request<RegisterFileResult>('POST', '/files', bearerToken, payload);
  }

  addVersion(
    bearerToken: string,
    fileId: string,
    payload: AddVersionPayload,
  ): Promise<{ version: FileVersionDto; chunks: ChunkDto[] }> {
    return this.request('POST', `/files/${fileId}/versions`, bearerToken, payload);
  }

  getFileDetail(bearerToken: string, fileId: string): Promise<FileDetailResult> {
    return this.request('GET', `/files/${fileId}`, bearerToken);
  }

  getVersionDetail(
    bearerToken: string,
    fileId: string,
    versionNumber: number,
  ): Promise<VersionDetailResult> {
    return this.request('GET', `/files/${fileId}/versions/${versionNumber}`, bearerToken);
  }

  private async request<T>(
    method: 'GET' | 'POST',
    path: string,
    bearerToken: string,
    body?: unknown,
  ): Promise<T> {
    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${bearerToken}`,
          'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
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
