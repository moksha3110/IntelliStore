export interface StorageBackend {
  /** Optional one-time setup (e.g. ensuring a bucket exists) run before the server starts accepting traffic. */
  init?(): Promise<void>;
  put(key: string, data: Buffer): Promise<void>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  /** True if an object already exists at `key`. Used for content-addressed deduplication. */
  exists(key: string): Promise<boolean>;
}
