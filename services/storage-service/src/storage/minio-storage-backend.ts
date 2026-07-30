import type { Readable } from 'node:stream';
import { Client as MinioClient } from 'minio';
import type { StorageBackend } from './storage-backend';

export interface MinioStorageBackendOptions {
  endPoint: string;
  port: number;
  useSSL: boolean;
  accessKey: string;
  secretKey: string;
  bucket: string;
}

async function streamToBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class MinioStorageBackend implements StorageBackend {
  private readonly client: MinioClient;
  private readonly bucket: string;

  constructor(options: MinioStorageBackendOptions) {
    this.client = new MinioClient({
      endPoint: options.endPoint,
      port: options.port,
      useSSL: options.useSSL,
      accessKey: options.accessKey,
      secretKey: options.secretKey,
    });
    this.bucket = options.bucket;
  }

  async init(): Promise<void> {
    const maxAttempts = 10;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const exists = await this.client.bucketExists(this.bucket);
        if (!exists) {
          await this.client.makeBucket(this.bucket);
        }
        return;
      } catch (err) {
        if (attempt === maxAttempts) throw err;
        await sleep(1000);
      }
    }
  }

  async put(key: string, data: Buffer): Promise<void> {
    await this.client.putObject(this.bucket, key, data);
  }

  async get(key: string): Promise<Buffer> {
    const stream = await this.client.getObject(this.bucket, key);
    return streamToBuffer(stream);
  }

  async delete(key: string): Promise<void> {
    await this.client.removeObject(this.bucket, key);
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.client.statObject(this.bucket, key);
      return true;
    } catch {
      // statObject throws (NoSuchKey / NotFound) when the object is absent.
      return false;
    }
  }
}
