export interface NodeStorage {
  ensureBucket(bucket: string): Promise<void>;
  copyToNode(sourceBucket: string, key: string, destBucket: string): Promise<void>;
}
