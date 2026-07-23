export interface User {
  id: string;
  email: string;
  displayName: string;
  createdAt: string;
  updatedAt: string;
}

export interface FileMetadata {
  id: string;
  ownerId: string;
  fileName: string;
  sizeBytes: number;
  mimeType: string;
  checksum: string;
  version: number;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ChunkMetadata {
  id: string;
  fileId: string;
  index: number;
  sizeBytes: number;
  checksum: string;
  storageKey: string;
}

export type ReplicaStatus = 'pending' | 'synced' | 'degraded' | 'lost';

export interface ChunkReplica {
  id: string;
  chunkId: string;
  nodeId: string;
  status: ReplicaStatus;
  lastVerifiedAt: string | null;
}

export type StorageTier = 'hot' | 'cold';

export interface StorageNode {
  id: string;
  address: string;
  isHealthy: boolean;
  lastHeartbeatAt: string | null;
  capacityBytes: number;
  usedBytes: number;
}

export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

export interface JwtPayload {
  sub: string;
  email: string;
  iat?: number;
  exp?: number;
}
