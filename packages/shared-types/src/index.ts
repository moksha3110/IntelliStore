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

// Domain events flow through a single topic exchange; each service binds its
// own queue to the routing keys it cares about (fan-out, not a work queue).
export const EVENTS_EXCHANGE = 'intellistore.events';
export const ROUTING_KEYS = {
  chunkUploaded: 'chunk.uploaded',
  fileAccessed: 'file.accessed',
} as const;

export interface ChunkUploadedEvent {
  chunkId: string;
  storageKey: string;
  sizeBytes: number;
}

export interface ChunkUploadedBatchEvent {
  fileId: string;
  ownerId: string;
  fileName: string;
  versionId: string;
  versionNumber: number;
  chunks: ChunkUploadedEvent[];
}

export interface FileAccessedEvent {
  fileId: string;
  ownerId: string;
  fileName: string;
  versionId: string;
  versionNumber: number;
  accessedAt: string;
}
