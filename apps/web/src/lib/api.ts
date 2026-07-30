import type { ApiResponse } from '@intellistore/shared-types';
import { gatewayUrl } from './config';
import { getStoredSession, type StoredUser } from './auth-storage';

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function unwrap<T>(res: Response): Promise<T> {
  const json = (await res.json()) as ApiResponse<T>;
  if (!json.success) {
    throw new ApiError(json.error.message, json.error.code, res.status);
  }
  return json.data;
}

function authHeader(): Record<string, string> {
  const session = getStoredSession();
  return session ? { Authorization: `Bearer ${session.accessToken}` } : {};
}

// Every request goes through the single gateway origin; paths carry the
// gateway's routing prefix (/api/auth, /api/files, /api/storage, ...).
async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${gatewayUrl}${path}`, { headers: { ...authHeader() } });
  return unwrap<T>(res);
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${gatewayUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader() },
    body: JSON.stringify(body),
  });
  return unwrap<T>(res);
}

export interface AuthResult {
  user: StoredUser;
  tokens: { accessToken: string; refreshToken: string };
}

export function registerAccount(input: {
  email: string;
  password: string;
  displayName: string;
}): Promise<AuthResult> {
  return postJson('/api/auth/register', input);
}

export function login(input: { email: string; password: string }): Promise<AuthResult> {
  return postJson('/api/auth/login', input);
}

export interface FileRecordDto {
  id: string;
  ownerId: string;
  fileName: string;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface FileVersionDto {
  id: string;
  fileId: string;
  versionNumber: number;
  sizeBytes: number;
  mimeType: string;
  checksum: string;
  createdAt: string;
}

export interface FileWithLatestVersionDto {
  file: FileRecordDto;
  latestVersion: FileVersionDto | null;
}

export function listFiles(): Promise<FileWithLatestVersionDto[]> {
  return getJson('/api/files');
}

export function searchFiles(query: string): Promise<FileWithLatestVersionDto[]> {
  return getJson(`/api/files/search?q=${encodeURIComponent(query)}`);
}

export async function uploadFile(file: File): Promise<unknown> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${gatewayUrl}/api/storage`, {
    method: 'POST',
    headers: { ...authHeader() },
    body: formData,
  });
  return unwrap(res);
}

export async function downloadFile(fileId: string, fileName: string): Promise<void> {
  const res = await fetch(`${gatewayUrl}/api/storage/${fileId}/download`, {
    headers: { ...authHeader() },
  });
  if (!res.ok) {
    const json = (await res.json()) as ApiResponse<never>;
    if (!json.success) {
      throw new ApiError(json.error.message, json.error.code, res.status);
    }
  }

  const blob = await res.blob();
  const blobUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(blobUrl);
}

export interface StorageNodeDto {
  id: string;
  name: string;
  bucket: string;
  isHealthy: boolean;
  lastHeartbeatAt: string | null;
  capacityBytes: number;
  usedBytes: number;
}

export function listNodes(): Promise<StorageNodeDto[]> {
  return getJson('/api/replication/nodes');
}

export type StorageTier = 'hot' | 'cold';

export interface TemperatureResultDto {
  score: number;
  tier: StorageTier;
  recommendation: string;
}

export interface FileRecommendationDto {
  fileId: string;
  fileName: string;
  sizeBytes: number;
  accessCount: number;
  lastAccessedAt: string | null;
  temperature: TemperatureResultDto;
}

export interface SystemStatsDto {
  totalFiles: number;
  totalVersions: number;
  totalChunks: number;
  totalBytes: number;
  logicalChunkBytes: number;
  physicalChunkBytes: number;
  dedupedBytes: number;
}

export interface DiagnosticsDto {
  totalNodes: number;
  healthyNodes: number;
  unhealthyNodes: number;
  underReplicatedChunkCount: number;
}

export interface OverviewDto {
  storage: SystemStatsDto;
  nodes: StorageNodeDto[];
  diagnostics: DiagnosticsDto;
  fileTemperatureBreakdown: { hot: number; cold: number };
  recommendations: string[];
}

export function getAnalyticsOverview(): Promise<OverviewDto> {
  return getJson('/api/analytics/overview');
}

export function getFileRecommendations(): Promise<FileRecommendationDto[]> {
  return getJson('/api/analytics/files');
}

export interface NotificationDto {
  id: string;
  ownerId: string;
  type: string;
  message: string;
  fileId: string | null;
  isRead: boolean;
  createdAt: string;
}

export interface NotificationListDto {
  notifications: NotificationDto[];
  unreadCount: number;
}

export function getNotifications(): Promise<NotificationListDto> {
  return getJson('/api/notifications');
}

export function markNotificationRead(id: string): Promise<{ id: string; isRead: true }> {
  return postJson(`/api/notifications/${id}/read`, {});
}

export function markAllNotificationsRead(): Promise<{ updated: number }> {
  return postJson('/api/notifications/read-all', {});
}
