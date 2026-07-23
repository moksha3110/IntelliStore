import { mkdirSync, promises as fs } from 'node:fs';
import { dirname, normalize, resolve, sep } from 'node:path';
import type { StorageBackend } from './storage-backend';

export class LocalFsStorageBackend implements StorageBackend {
  constructor(private readonly baseDir: string) {
    mkdirSync(baseDir, { recursive: true });
  }

  private resolveKeyPath(key: string): string {
    const resolved = resolve(this.baseDir, normalize(key));
    const base = resolve(this.baseDir) + sep;
    if (!resolved.startsWith(base)) {
      throw new Error(`Refusing to access storage key outside base directory: ${key}`);
    }
    return resolved;
  }

  async put(key: string, data: Buffer): Promise<void> {
    const filePath = this.resolveKeyPath(key);
    await fs.mkdir(dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, data);
  }

  async get(key: string): Promise<Buffer> {
    return fs.readFile(this.resolveKeyPath(key));
  }

  async delete(key: string): Promise<void> {
    await fs.rm(this.resolveKeyPath(key), { force: true });
  }
}
