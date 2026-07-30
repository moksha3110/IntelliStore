import type { StorageBackend } from '../../storage/storage-backend';

export class InMemoryStorageBackend implements StorageBackend {
  readonly store = new Map<string, Buffer>();

  async put(key: string, data: Buffer): Promise<void> {
    this.store.set(key, Buffer.from(data));
  }

  async get(key: string): Promise<Buffer> {
    const data = this.store.get(key);
    if (!data) {
      throw new Error(`No object stored for key: ${key}`);
    }
    return data;
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  async exists(key: string): Promise<boolean> {
    return this.store.has(key);
  }
}
