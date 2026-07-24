import type {
  FileWithLatestVersionDto,
  MetadataClient,
  SystemStatsDto,
} from '../../clients/metadata.client';

export class FakeMetadataClient implements MetadataClient {
  files: FileWithLatestVersionDto[] = [];
  systemStats: SystemStatsDto = { totalFiles: 0, totalVersions: 0, totalChunks: 0, totalBytes: 0 };

  async listFiles(_bearerToken: string): Promise<FileWithLatestVersionDto[]> {
    return this.files;
  }

  async getSystemStats(_bearerToken: string): Promise<SystemStatsDto> {
    return this.systemStats;
  }
}
