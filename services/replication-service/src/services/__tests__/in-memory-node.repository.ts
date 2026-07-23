import type { NodeRepository, StorageNodeRecord } from '../../repositories/node.repository';

export class InMemoryNodeRepository implements NodeRepository {
  constructor(private readonly nodes: StorageNodeRecord[]) {}

  async listAll(): Promise<StorageNodeRecord[]> {
    return [...this.nodes];
  }

  async listHealthy(): Promise<StorageNodeRecord[]> {
    return this.nodes.filter((node) => node.isHealthy).sort((a, b) => a.usedBytes - b.usedBytes);
  }

  async findById(id: string): Promise<StorageNodeRecord | null> {
    return this.nodes.find((node) => node.id === id) ?? null;
  }

  async incrementUsedBytes(id: string, deltaBytes: number): Promise<void> {
    const node = this.nodes.find((n) => n.id === id);
    if (node) node.usedBytes += deltaBytes;
  }

  async setHealth(id: string, isHealthy: boolean, heartbeatAt: string): Promise<void> {
    const node = this.nodes.find((n) => n.id === id);
    if (node) {
      node.isHealthy = isHealthy;
      node.lastHeartbeatAt = heartbeatAt;
    }
  }
}

export function makeNode(overrides: Partial<StorageNodeRecord> = {}): StorageNodeRecord {
  return {
    id: overrides.id ?? 'node-1',
    name: overrides.name ?? 'node-1',
    bucket: overrides.bucket ?? 'intellistore-node-1',
    isHealthy: overrides.isHealthy ?? true,
    lastHeartbeatAt: overrides.lastHeartbeatAt ?? null,
    capacityBytes: overrides.capacityBytes ?? 10_000_000_000,
    usedBytes: overrides.usedBytes ?? 0,
  };
}
