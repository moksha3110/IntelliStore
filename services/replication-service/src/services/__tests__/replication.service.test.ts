import { beforeEach, describe, expect, it } from 'vitest';
import { ReplicationService } from '../replication.service';
import { FakeNodeStorage } from './fake-node-storage';
import { InMemoryNodeRepository, makeNode } from './in-memory-node.repository';
import { InMemoryReplicaRepository } from './in-memory-replica.repository';

describe('ReplicationService', () => {
  let nodeRepository: InMemoryNodeRepository;
  let replicaRepository: InMemoryReplicaRepository;
  let nodeStorage: FakeNodeStorage;
  let replicationService: ReplicationService;

  beforeEach(() => {
    nodeRepository = new InMemoryNodeRepository([
      makeNode({ id: 'node-1', bucket: 'bucket-1', usedBytes: 0 }),
      makeNode({ id: 'node-2', bucket: 'bucket-2', usedBytes: 0 }),
      makeNode({ id: 'node-3', bucket: 'bucket-3', usedBytes: 0 }),
    ]);
    replicaRepository = new InMemoryReplicaRepository();
    nodeStorage = new FakeNodeStorage();
    replicationService = new ReplicationService(nodeRepository, replicaRepository, nodeStorage, {
      replicationFactor: 2,
      primaryBucket: 'primary-bucket',
    });
  });

  it('copies the chunk to replicationFactor healthy nodes and records replicas', async () => {
    const replicas = await replicationService.replicateChunk('chunk-1', 'session/0', 1000);

    expect(replicas).toHaveLength(2);
    expect(nodeStorage.copyCalls).toHaveLength(2);
    for (const call of nodeStorage.copyCalls) {
      expect(call.sourceBucket).toBe('primary-bucket');
      expect(call.key).toBe('session/0');
    }

    const stored = await replicaRepository.listByChunk('chunk-1');
    expect(stored).toHaveLength(2);
    expect(stored.every((r) => r.status === 'synced')).toBe(true);
  });

  it('increments used bytes on each target node', async () => {
    await replicationService.replicateChunk('chunk-1', 'session/0', 1500);

    const nodes = await nodeRepository.listAll();
    const targeted = nodes.filter((n) => n.usedBytes > 0);
    expect(targeted).toHaveLength(2);
    expect(targeted.every((n) => n.usedBytes === 1500)).toBe(true);
  });

  it('prefers the least-used healthy nodes', async () => {
    nodeRepository = new InMemoryNodeRepository([
      makeNode({ id: 'node-1', bucket: 'bucket-1', usedBytes: 5000 }),
      makeNode({ id: 'node-2', bucket: 'bucket-2', usedBytes: 100 }),
      makeNode({ id: 'node-3', bucket: 'bucket-3', usedBytes: 200 }),
    ]);
    replicationService = new ReplicationService(nodeRepository, replicaRepository, nodeStorage, {
      replicationFactor: 2,
      primaryBucket: 'primary-bucket',
    });

    await replicationService.replicateChunk('chunk-1', 'session/0', 100);

    const destBuckets = nodeStorage.copyCalls.map((c) => c.destBucket);
    expect(destBuckets).toEqual(['bucket-2', 'bucket-3']);
  });

  it('skips unhealthy nodes', async () => {
    nodeRepository = new InMemoryNodeRepository([
      makeNode({ id: 'node-1', bucket: 'bucket-1', isHealthy: false }),
      makeNode({ id: 'node-2', bucket: 'bucket-2' }),
      makeNode({ id: 'node-3', bucket: 'bucket-3' }),
    ]);
    replicationService = new ReplicationService(nodeRepository, replicaRepository, nodeStorage, {
      replicationFactor: 2,
      primaryBucket: 'primary-bucket',
    });

    await replicationService.replicateChunk('chunk-1', 'session/0', 100);

    const destBuckets = nodeStorage.copyCalls.map((c) => c.destBucket);
    expect(destBuckets).not.toContain('bucket-1');
    expect(destBuckets).toHaveLength(2);
  });

  it('continues to other nodes when one copy fails, and still records the successes', async () => {
    nodeStorage.failForBuckets.add('bucket-1');

    const replicas = await replicationService.replicateChunk('chunk-1', 'session/0', 100);

    expect(replicas).toHaveLength(1);
    expect(replicas[0].nodeId).toBe('node-2');
  });

  it('throws when every target node fails', async () => {
    nodeStorage.failForBuckets.add('bucket-1');
    nodeStorage.failForBuckets.add('bucket-2');

    await expect(replicationService.replicateChunk('chunk-1', 'session/0', 100)).rejects.toThrow(
      'Failed to replicate chunk chunk-1 to any node',
    );
  });

  it('throws when there are no healthy nodes at all', async () => {
    nodeRepository = new InMemoryNodeRepository([
      makeNode({ id: 'node-1', bucket: 'bucket-1', isHealthy: false }),
    ]);
    replicationService = new ReplicationService(nodeRepository, replicaRepository, nodeStorage, {
      replicationFactor: 2,
      primaryBucket: 'primary-bucket',
    });

    await expect(replicationService.replicateChunk('chunk-1', 'session/0', 100)).rejects.toThrow(
      'No healthy storage nodes available for replication',
    );
  });

  it('is idempotent when replicating the same chunk twice (upsert semantics)', async () => {
    // Large usedBytes gaps so the tiny 100-byte increments from each call don't
    // change which two nodes rank as "least used" between calls.
    nodeRepository = new InMemoryNodeRepository([
      makeNode({ id: 'node-1', bucket: 'bucket-1', usedBytes: 0 }),
      makeNode({ id: 'node-2', bucket: 'bucket-2', usedBytes: 10 }),
      makeNode({ id: 'node-3', bucket: 'bucket-3', usedBytes: 1_000_000 }),
    ]);
    replicationService = new ReplicationService(nodeRepository, replicaRepository, nodeStorage, {
      replicationFactor: 2,
      primaryBucket: 'primary-bucket',
    });

    await replicationService.replicateChunk('chunk-1', 'session/0', 100);
    await replicationService.replicateChunk('chunk-1', 'session/0', 100);

    const stored = await replicaRepository.listByChunk('chunk-1');
    expect(stored).toHaveLength(2);
  });

  it('reports diagnostics reflecting node health and under-replicated chunks', async () => {
    await replicationService.replicateChunk('chunk-1', 'session/0', 1000);
    await nodeRepository.setHealth('node-1', false, new Date().toISOString());
    // Force chunk-2 under-replicated by giving it only 1 replica directly.
    await replicaRepository.upsert('chunk-2', 'node-2', 'session/1', 500, 'synced');

    const diagnostics = await replicationService.getDiagnostics();

    expect(diagnostics.totalNodes).toBe(3);
    expect(diagnostics.healthyNodes).toBe(2);
    expect(diagnostics.unhealthyNodes).toBe(1);
    expect(diagnostics.underReplicatedChunkCount).toBe(1);
  });
});
