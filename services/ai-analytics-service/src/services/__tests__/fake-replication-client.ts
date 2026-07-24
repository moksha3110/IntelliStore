import type { DiagnosticsDto, ReplicationClient, StorageNodeDto } from '../../clients/replication.client';

export class FakeReplicationClient implements ReplicationClient {
  nodes: StorageNodeDto[] = [];
  diagnostics: DiagnosticsDto = {
    totalNodes: 0,
    healthyNodes: 0,
    unhealthyNodes: 0,
    underReplicatedChunkCount: 0,
  };

  async getNodes(_bearerToken: string): Promise<StorageNodeDto[]> {
    return this.nodes;
  }

  async getDiagnostics(_bearerToken: string): Promise<DiagnosticsDto> {
    return this.diagnostics;
  }
}
