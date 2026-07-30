import type { MetadataClient, SystemStatsDto } from '../clients/metadata.client';
import type { DiagnosticsDto, ReplicationClient, StorageNodeDto } from '../clients/replication.client';
import type { AccessStatsRepository } from '../repositories/access-stats.repository';
import { scoreFileTemperature, type ScoringOptions, type TemperatureResult } from '../scoring/temperature-scoring';

const HIGH_UTILIZATION_THRESHOLD = 0.8;

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const exp = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, exp);
  return `${exp === 0 ? value : value.toFixed(1)} ${units[exp]}`;
}

export interface FileRecommendation {
  fileId: string;
  fileName: string;
  sizeBytes: number;
  accessCount: number;
  lastAccessedAt: string | null;
  temperature: TemperatureResult;
}

export interface OverviewResult {
  storage: SystemStatsDto;
  nodes: StorageNodeDto[];
  diagnostics: DiagnosticsDto;
  fileTemperatureBreakdown: { hot: number; cold: number };
  recommendations: string[];
}

export class AnalyticsService {
  constructor(
    private readonly metadataClient: MetadataClient,
    private readonly replicationClient: ReplicationClient,
    private readonly accessStatsRepository: AccessStatsRepository,
    private readonly scoringOptions: ScoringOptions,
  ) {}

  async getFileRecommendations(bearerToken: string): Promise<FileRecommendation[]> {
    const files = await this.metadataClient.listFiles(bearerToken);
    const stats = await this.accessStatsRepository.findByFileIds(files.map((f) => f.file.id));
    const statsByFileId = new Map(stats.map((s) => [s.fileId, s]));

    return files
      .map(({ file, latestVersion }) => {
        const stat = statsByFileId.get(file.id);
        const accessCount = stat?.accessCount ?? 0;
        const lastAccessedAt = stat?.lastAccessedAt ?? null;

        return {
          fileId: file.id,
          fileName: file.fileName,
          sizeBytes: latestVersion?.sizeBytes ?? 0,
          accessCount,
          lastAccessedAt,
          temperature: scoreFileTemperature(
            { createdAt: file.createdAt, accessCount, lastAccessedAt },
            this.scoringOptions,
          ),
        };
      })
      .sort((a, b) => a.temperature.score - b.temperature.score);
  }

  async getOverview(bearerToken: string): Promise<OverviewResult> {
    const [storage, nodes, diagnostics, fileRecommendations] = await Promise.all([
      this.metadataClient.getSystemStats(bearerToken),
      this.replicationClient.getNodes(bearerToken),
      this.replicationClient.getDiagnostics(bearerToken),
      this.getFileRecommendations(bearerToken),
    ]);

    const hot = fileRecommendations.filter((f) => f.temperature.tier === 'hot').length;
    const cold = fileRecommendations.length - hot;

    const recommendations = [
      ...this.nodeCapacityRecommendations(nodes),
      ...this.diagnosticsRecommendations(diagnostics),
      ...(storage.dedupedBytes > 0
        ? [
            `Deduplication is saving ${formatBytes(storage.dedupedBytes)} by storing identical chunks once.`,
          ]
        : []),
      ...(cold > 0
        ? [`${cold} of your file(s) are classified cold — consider archiving to reduce hot-storage costs.`]
        : []),
    ];

    return {
      storage,
      nodes,
      diagnostics,
      fileTemperatureBreakdown: { hot, cold },
      recommendations,
    };
  }

  private nodeCapacityRecommendations(nodes: StorageNodeDto[]): string[] {
    return nodes
      .filter((node) => node.capacityBytes > 0 && node.usedBytes / node.capacityBytes > HIGH_UTILIZATION_THRESHOLD)
      .map((node) => {
        const utilization = Math.round((node.usedBytes / node.capacityBytes) * 100);
        return `Node "${node.name}" is at ${utilization}% capacity — consider provisioning additional storage nodes.`;
      });
  }

  private diagnosticsRecommendations(diagnostics: DiagnosticsDto): string[] {
    const recommendations: string[] = [];
    if (diagnostics.underReplicatedChunkCount > 0) {
      recommendations.push(
        `${diagnostics.underReplicatedChunkCount} chunk(s) are under-replicated — self-healing should resolve this shortly, but investigate if it persists.`,
      );
    }
    if (diagnostics.unhealthyNodes > 0) {
      recommendations.push(
        `${diagnostics.unhealthyNodes} of ${diagnostics.totalNodes} storage node(s) are currently unhealthy.`,
      );
    }
    return recommendations;
  }
}
