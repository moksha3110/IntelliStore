import type { ApiResponse } from '@intellistore/shared-types';
import { AppError } from '../errors/app-error';

export interface StorageNodeDto {
  id: string;
  name: string;
  bucket: string;
  isHealthy: boolean;
  lastHeartbeatAt: string | null;
  capacityBytes: number;
  usedBytes: number;
}

export interface DiagnosticsDto {
  totalNodes: number;
  healthyNodes: number;
  unhealthyNodes: number;
  underReplicatedChunkCount: number;
}

export interface ReplicationClient {
  getNodes(bearerToken: string): Promise<StorageNodeDto[]>;
  getDiagnostics(bearerToken: string): Promise<DiagnosticsDto>;
}

export class HttpReplicationClient implements ReplicationClient {
  constructor(private readonly baseUrl: string) {}

  getNodes(bearerToken: string): Promise<StorageNodeDto[]> {
    return this.request('/nodes', bearerToken);
  }

  getDiagnostics(bearerToken: string): Promise<DiagnosticsDto> {
    return this.request('/diagnostics', bearerToken);
  }

  private async request<T>(path: string, bearerToken: string): Promise<T> {
    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}${path}`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${bearerToken}` },
      });
    } catch {
      throw AppError.badGateway('Replication service is unreachable');
    }

    const json = (await res.json()) as ApiResponse<T>;
    if (!json.success) {
      throw new AppError(res.status, json.error.code, json.error.message, json.error.details);
    }
    return json.data;
  }
}
