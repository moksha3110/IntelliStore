import type { NodeStorage } from '../../storage/node-storage';

export class FakeNodeStorage implements NodeStorage {
  copyCalls: { sourceBucket: string; key: string; destBucket: string }[] = [];
  failForBuckets = new Set<string>();

  async ensureBucket(_bucket: string): Promise<void> {
    // no-op for the fake
  }

  async copyToNode(sourceBucket: string, key: string, destBucket: string): Promise<void> {
    if (this.failForBuckets.has(destBucket)) {
      throw new Error(`simulated copy failure for bucket ${destBucket}`);
    }
    this.copyCalls.push({ sourceBucket, key, destBucket });
  }
}
