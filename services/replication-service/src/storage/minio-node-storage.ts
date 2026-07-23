import { Client as MinioClient, CopyConditions } from 'minio';
import type { NodeStorage } from './node-storage';

export interface MinioNodeStorageOptions {
  endPoint: string;
  port: number;
  useSSL: boolean;
  accessKey: string;
  secretKey: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class MinioNodeStorage implements NodeStorage {
  private readonly client: MinioClient;

  constructor(options: MinioNodeStorageOptions) {
    this.client = new MinioClient({
      endPoint: options.endPoint,
      port: options.port,
      useSSL: options.useSSL,
      accessKey: options.accessKey,
      secretKey: options.secretKey,
    });
  }

  async ensureBucket(bucket: string): Promise<void> {
    const maxAttempts = 10;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const exists = await this.client.bucketExists(bucket);
        if (!exists) {
          await this.client.makeBucket(bucket);
        }
        return;
      } catch (err) {
        if (attempt === maxAttempts) throw err;
        await sleep(1000);
      }
    }
  }

  async copyToNode(sourceBucket: string, key: string, destBucket: string): Promise<void> {
    await this.client.copyObject(destBucket, key, `/${sourceBucket}/${key}`, new CopyConditions());
  }
}
