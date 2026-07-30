import { beforeEach, describe, expect, it } from 'vitest';
import type { ChunkUploadedBatchEvent, FileAccessedEvent } from '@intellistore/shared-types';
import { NOTIFICATION_TYPES, NotificationService } from '../notification.service';
import { InMemoryNotificationRepository } from './in-memory-notification.repository';

const OWNER = 'owner-1';

function uploadEvent(overrides: Partial<ChunkUploadedBatchEvent> = {}): ChunkUploadedBatchEvent {
  return {
    fileId: 'file-1',
    ownerId: OWNER,
    fileName: 'report.pdf',
    versionId: 'version-1',
    versionNumber: 1,
    chunks: [{ chunkId: 'c1', storageKey: 's/0', sizeBytes: 100 }],
    ...overrides,
  };
}

function accessEvent(overrides: Partial<FileAccessedEvent> = {}): FileAccessedEvent {
  return {
    fileId: 'file-1',
    ownerId: OWNER,
    fileName: 'report.pdf',
    versionId: 'version-1',
    versionNumber: 1,
    accessedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('NotificationService', () => {
  let repo: InMemoryNotificationRepository;
  let service: NotificationService;

  beforeEach(() => {
    repo = new InMemoryNotificationRepository();
    service = new NotificationService(repo);
  });

  it('creates an upload notification scoped to the file owner', async () => {
    const notification = await service.handleChunkUploaded(uploadEvent());

    expect(notification.ownerId).toBe(OWNER);
    expect(notification.type).toBe(NOTIFICATION_TYPES.fileUploaded);
    expect(notification.message).toMatch(/report\.pdf.*uploaded/i);
    expect(notification.isRead).toBe(false);
  });

  it('phrases a new-version upload differently from a first upload', async () => {
    const first = await service.handleChunkUploaded(uploadEvent({ versionNumber: 1 }));
    const second = await service.handleChunkUploaded(uploadEvent({ versionNumber: 3 }));

    expect(first.message).not.toMatch(/version/i);
    expect(second.message).toMatch(/version \(v3\)/i);
  });

  it('creates an access notification on download', async () => {
    const notification = await service.handleFileAccessed(accessEvent());

    expect(notification.type).toBe(NOTIFICATION_TYPES.fileAccessed);
    expect(notification.message).toMatch(/downloaded/i);
  });

  it('lists a user\'s notifications newest-first with an unread count', async () => {
    await service.handleChunkUploaded(uploadEvent());
    await service.handleFileAccessed(accessEvent());

    const { notifications, unreadCount } = await service.list(OWNER);
    expect(notifications).toHaveLength(2);
    expect(unreadCount).toBe(2);
  });

  it('does not leak notifications across owners', async () => {
    await service.handleChunkUploaded(uploadEvent({ ownerId: 'owner-A' }));
    await service.handleChunkUploaded(uploadEvent({ ownerId: 'owner-B' }));

    const listA = await service.list('owner-A');
    expect(listA.notifications).toHaveLength(1);
    expect(listA.notifications[0].ownerId).toBe('owner-A');
  });

  it('marks a single notification read (owner-scoped)', async () => {
    const n = await service.handleChunkUploaded(uploadEvent());

    expect(await service.markRead('someone-else', n.id)).toBe(false);
    expect(await service.markRead(OWNER, n.id)).toBe(true);

    const { unreadCount } = await service.list(OWNER);
    expect(unreadCount).toBe(0);
  });

  it('marks all of a user\'s notifications read', async () => {
    await service.handleChunkUploaded(uploadEvent());
    await service.handleFileAccessed(accessEvent());

    const updated = await service.markAllRead(OWNER);
    expect(updated).toBe(2);
    expect((await service.list(OWNER)).unreadCount).toBe(0);
  });
});
