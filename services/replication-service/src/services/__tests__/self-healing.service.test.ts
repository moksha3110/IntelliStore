import { beforeEach, describe, expect, it } from 'vitest';
import { ReplicationService } from '../replication.service';
import { SelfHealingService } from '../self-healing.service';
import { FakeNodeStorage } from './fake-node-storage';
import { InMemoryNodeRepository, makeNode } from './in-memory-node.repository';
import { InMemoryReplicaRepository } from './in-memory-replica.repository';

describe('SelfHealingService', () => {
  let nodeRepository: InMemoryNodeRepository;
  let replicaRepository: InMemoryReplicaRepository;
  let nodeStorage: FakeNodeStorage;
  let replicationService: ReplicationService;
  let selfHealingService: SelfHealingService;

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
    selfHealingService = new SelfHealingService(
      nodeRepository,
      replicaRepository,
      replicationService,
      { replicationFactor: 2 },
    );
  });

  it('does nothing when all nodes are healthy', async () => {
    await replicationService.replicateChunk('chunk-1', 'session/0', 1000);
    const before = await replicaRepository.listByChunk('chunk-1');

    await selfHealingService.healOnce();

    const after = await replicaRepository.listByChunk('chunk-1');
    expect(after).toEqual(before);
  });

  it('marks replicas on a newly-unhealthy node as lost and replaces them on a healthy node', async () => {
    await replicationService.replicateChunk('chunk-1', 'session/0', 1000);
    const initialReplicas = await replicaRepository.listByChunk('chunk-1');
    expect(initialReplicas).toHaveLength(2);
    const [replicaA, replicaB] = initialReplicas;

    // Simulate replicaA's node going unhealthy.
    await nodeRepository.setHealth(replicaA.nodeId, false, new Date().toISOString());

    await selfHealingService.healOnce();

    const afterHealing = await replicaRepository.listByChunk('chunk-1');
    const lostReplica = afterHealing.find((r) => r.id === replicaA.id);
    expect(lostReplica?.status).toBe('lost');

    const syncedReplicas = afterHealing.filter((r) => r.status === 'synced');
    expect(syncedReplicas).toHaveLength(2);
    // The still-healthy original replica should still be one of them.
    expect(syncedReplicas.some((r) => r.id === replicaB.id)).toBe(true);
    // The new replica must be on a node other than the one that just went unhealthy.
    expect(syncedReplicas.every((r) => r.nodeId !== replicaA.nodeId)).toBe(true);
  });

  it('does not re-heal a chunk whose replica was already marked lost in an earlier sweep', async () => {
    await replicationService.replicateChunk('chunk-1', 'session/0', 1000);
    const [replicaA] = await replicaRepository.listByChunk('chunk-1');

    await nodeRepository.setHealth(replicaA.nodeId, false, new Date().toISOString());
    await selfHealingService.healOnce();
    const afterFirstSweep = await replicaRepository.listByChunk('chunk-1');

    await selfHealingService.healOnce();
    const afterSecondSweep = await replicaRepository.listByChunk('chunk-1');

    expect(afterSecondSweep).toEqual(afterFirstSweep);
  });

  it('does not attempt healing when replication factor is already satisfied by remaining nodes', async () => {
    // 3 healthy nodes, factor 1: only 1 replica placed, so losing its node needs healing to 1.
    nodeRepository = new InMemoryNodeRepository([
      makeNode({ id: 'node-1', bucket: 'bucket-1' }),
      makeNode({ id: 'node-2', bucket: 'bucket-2' }),
      makeNode({ id: 'node-3', bucket: 'bucket-3' }),
    ]);
    replicationService = new ReplicationService(nodeRepository, replicaRepository, nodeStorage, {
      replicationFactor: 1,
      primaryBucket: 'primary-bucket',
    });
    selfHealingService = new SelfHealingService(
      nodeRepository,
      replicaRepository,
      replicationService,
      { replicationFactor: 1 },
    );

    await replicationService.replicateChunk('chunk-1', 'session/0', 1000);
    const [onlyReplica] = await replicaRepository.listByChunk('chunk-1');

    await nodeRepository.setHealth(onlyReplica.nodeId, false, new Date().toISOString());
    await selfHealingService.healOnce();

    const afterHealing = await replicaRepository.listByChunk('chunk-1');
    const synced = afterHealing.filter((r) => r.status === 'synced');
    expect(synced).toHaveLength(1);
    expect(synced[0].nodeId).not.toBe(onlyReplica.nodeId);
  });

  it('logs but does not throw when no healthy nodes remain to heal onto', async () => {
    await replicationService.replicateChunk('chunk-1', 'session/0', 1000);
    const replicas = await replicaRepository.listByChunk('chunk-1');

    for (const replica of replicas) {
      await nodeRepository.setHealth(replica.nodeId, false, new Date().toISOString());
    }
    await nodeRepository.setHealth('node-3', false, new Date().toISOString());

    await expect(selfHealingService.healOnce()).resolves.toBeUndefined();

    const afterHealing = await replicaRepository.listByChunk('chunk-1');
    expect(afterHealing.every((r) => r.status === 'lost')).toBe(true);
  });

  it('retries healing on a later sweep once a node becomes available again', async () => {
    // node-3 starts unhealthy, so when node-1 (holding a replica) also goes
    // down, node-2 is the only healthy node - but it already has a replica,
    // so there's no eligible target and the first sweep can't fully heal.
    nodeRepository = new InMemoryNodeRepository([
      makeNode({ id: 'node-1', bucket: 'bucket-1', usedBytes: 0 }),
      makeNode({ id: 'node-2', bucket: 'bucket-2', usedBytes: 0 }),
      makeNode({ id: 'node-3', bucket: 'bucket-3', usedBytes: 0, isHealthy: false }),
    ]);
    replicationService = new ReplicationService(nodeRepository, replicaRepository, nodeStorage, {
      replicationFactor: 2,
      primaryBucket: 'primary-bucket',
    });
    selfHealingService = new SelfHealingService(
      nodeRepository,
      replicaRepository,
      replicationService,
      { replicationFactor: 2 },
    );

    await replicationService.replicateChunk('chunk-1', 'session/0', 1000);
    const [replicaA] = await replicaRepository.listByChunk('chunk-1');
    await nodeRepository.setHealth(replicaA.nodeId, false, new Date().toISOString());

    await selfHealingService.healOnce();
    const afterFirstSweep = await replicaRepository.listByChunk('chunk-1');
    expect(afterFirstSweep.filter((r) => r.status === 'synced')).toHaveLength(1);

    // node-3 comes back online.
    await nodeRepository.setHealth('node-3', true, new Date().toISOString());
    await selfHealingService.healOnce();

    const afterSecondSweep = await replicaRepository.listByChunk('chunk-1');
    const synced = afterSecondSweep.filter((r) => r.status === 'synced');
    expect(synced).toHaveLength(2);
    expect(synced.some((r) => r.nodeId === 'node-3')).toBe(true);
  });
});
