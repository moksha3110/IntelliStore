import { beforeEach, describe, expect, it } from 'vitest';
import type { ScoringOptions } from '../../scoring/temperature-scoring';
import { AnalyticsService } from '../analytics.service';
import { FakeMetadataClient } from './fake-metadata-client';
import { FakeReplicationClient } from './fake-replication-client';
import { InMemoryAccessStatsRepository } from './in-memory-access-stats.repository';

const NOW = Date.now();
function daysAgo(days: number): string {
  return new Date(NOW - days * 24 * 60 * 60 * 1000).toISOString();
}

const scoringOptions: ScoringOptions = {
  recencyHalfLifeDays: 14,
  frequencyCap: 20,
  hotThreshold: 50,
  coldAgeThresholdDays: 30,
};

function makeFile(id: string, fileName: string, createdAt: string, sizeBytes = 1000) {
  return {
    file: {
      id,
      ownerId: 'owner-1',
      fileName,
      isDeleted: false,
      createdAt,
      updatedAt: createdAt,
    },
    latestVersion: {
      id: `${id}-v1`,
      fileId: id,
      versionNumber: 1,
      sizeBytes,
      mimeType: 'application/octet-stream',
      checksum: 'checksum',
      createdAt,
    },
  };
}

describe('AnalyticsService', () => {
  let metadataClient: FakeMetadataClient;
  let replicationClient: FakeReplicationClient;
  let accessStatsRepository: InMemoryAccessStatsRepository;
  let analyticsService: AnalyticsService;

  beforeEach(() => {
    metadataClient = new FakeMetadataClient();
    replicationClient = new FakeReplicationClient();
    accessStatsRepository = new InMemoryAccessStatsRepository();
    analyticsService = new AnalyticsService(
      metadataClient,
      replicationClient,
      accessStatsRepository,
      scoringOptions,
    );
  });

  describe('getFileRecommendations', () => {
    it('defaults to zero access count for a file with no recorded accesses', async () => {
      metadataClient.files = [makeFile('file-1', 'archive.zip', daysAgo(100))];

      const [recommendation] = await analyticsService.getFileRecommendations('token');

      expect(recommendation.accessCount).toBe(0);
      expect(recommendation.lastAccessedAt).toBeNull();
      expect(recommendation.temperature.tier).toBe('cold');
    });

    it('classifies a frequently and recently accessed file as hot', async () => {
      metadataClient.files = [makeFile('file-1', 'active-doc.pdf', daysAgo(90))];
      accessStatsRepository.seed({
        fileId: 'file-1',
        accessCount: 15,
        firstAccessedAt: daysAgo(80),
        lastAccessedAt: daysAgo(1),
      });

      const [recommendation] = await analyticsService.getFileRecommendations('token');

      expect(recommendation.accessCount).toBe(15);
      expect(recommendation.temperature.tier).toBe('hot');
    });

    it('sorts recommendations coldest-first', async () => {
      metadataClient.files = [
        makeFile('hot-file', 'hot.pdf', daysAgo(10)),
        makeFile('cold-file', 'cold.pdf', daysAgo(200)),
      ];
      accessStatsRepository.seed({
        fileId: 'hot-file',
        accessCount: 20,
        firstAccessedAt: daysAgo(5),
        lastAccessedAt: daysAgo(0),
      });
      accessStatsRepository.seed({
        fileId: 'cold-file',
        accessCount: 1,
        firstAccessedAt: daysAgo(150),
        lastAccessedAt: daysAgo(150),
      });

      const recommendations = await analyticsService.getFileRecommendations('token');

      expect(recommendations.map((r) => r.fileId)).toEqual(['cold-file', 'hot-file']);
    });
  });

  describe('getOverview', () => {
    it('aggregates storage stats, nodes, diagnostics, and hot/cold breakdown', async () => {
      metadataClient.systemStats = { totalFiles: 2, totalVersions: 2, totalChunks: 4, totalBytes: 2000 };
      metadataClient.files = [
        makeFile('hot-file', 'hot.pdf', daysAgo(10)),
        makeFile('cold-file', 'cold.pdf', daysAgo(200)),
      ];
      accessStatsRepository.seed({
        fileId: 'hot-file',
        accessCount: 20,
        firstAccessedAt: daysAgo(5),
        lastAccessedAt: daysAgo(0),
      });
      replicationClient.nodes = [
        { id: 'n1', name: 'node-1', bucket: 'b1', isHealthy: true, lastHeartbeatAt: null, capacityBytes: 1000, usedBytes: 100 },
      ];
      replicationClient.diagnostics = { totalNodes: 1, healthyNodes: 1, unhealthyNodes: 0, underReplicatedChunkCount: 0 };

      const overview = await analyticsService.getOverview('token');

      expect(overview.storage.totalFiles).toBe(2);
      expect(overview.nodes).toHaveLength(1);
      expect(overview.fileTemperatureBreakdown).toEqual({ hot: 1, cold: 1 });
      expect(overview.recommendations).toContain(
        '1 of your file(s) are classified cold — consider archiving to reduce hot-storage costs.',
      );
    });

    it('recommends provisioning when a node exceeds 80% capacity', async () => {
      replicationClient.nodes = [
        { id: 'n1', name: 'node-1', bucket: 'b1', isHealthy: true, lastHeartbeatAt: null, capacityBytes: 1000, usedBytes: 900 },
      ];

      const overview = await analyticsService.getOverview('token');

      expect(overview.recommendations.some((r) => r.includes('node-1') && r.includes('90%'))).toBe(true);
    });

    it('does not flag a node under the capacity threshold', async () => {
      replicationClient.nodes = [
        { id: 'n1', name: 'node-1', bucket: 'b1', isHealthy: true, lastHeartbeatAt: null, capacityBytes: 1000, usedBytes: 100 },
      ];

      const overview = await analyticsService.getOverview('token');

      expect(overview.recommendations.some((r) => r.includes('node-1'))).toBe(false);
    });

    it('surfaces under-replication and unhealthy-node diagnostics as recommendations', async () => {
      replicationClient.diagnostics = {
        totalNodes: 3,
        healthyNodes: 2,
        unhealthyNodes: 1,
        underReplicatedChunkCount: 4,
      };

      const overview = await analyticsService.getOverview('token');

      expect(overview.recommendations).toContain(
        '4 chunk(s) are under-replicated — self-healing should resolve this shortly, but investigate if it persists.',
      );
      expect(overview.recommendations).toContain('1 of 3 storage node(s) are currently unhealthy.');
    });

    it('omits the cold-files recommendation when there are no cold files', async () => {
      metadataClient.files = [makeFile('hot-file', 'hot.pdf', daysAgo(10))];
      accessStatsRepository.seed({
        fileId: 'hot-file',
        accessCount: 20,
        firstAccessedAt: daysAgo(5),
        lastAccessedAt: daysAgo(0),
      });

      const overview = await analyticsService.getOverview('token');

      expect(overview.recommendations.some((r) => r.includes('classified cold'))).toBe(false);
    });
  });
});
