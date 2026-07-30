import type { ChunkUploadedBatchEvent, FileAccessedEvent } from '@intellistore/shared-types';
import type {
  NotificationRecord,
  NotificationRepository,
} from '../repositories/notification.repository';

export const NOTIFICATION_TYPES = {
  fileUploaded: 'file.uploaded',
  fileAccessed: 'file.accessed',
} as const;

export interface NotificationList {
  notifications: NotificationRecord[];
  unreadCount: number;
}

export class NotificationService {
  constructor(
    private readonly repository: NotificationRepository,
    private readonly listLimit = 50,
  ) {}

  async handleChunkUploaded(event: ChunkUploadedBatchEvent): Promise<NotificationRecord> {
    const message =
      event.versionNumber > 1
        ? `New version (v${event.versionNumber}) of "${event.fileName}" uploaded and is being replicated.`
        : `"${event.fileName}" uploaded successfully and is being replicated across storage nodes.`;

    return this.repository.create({
      ownerId: event.ownerId,
      type: NOTIFICATION_TYPES.fileUploaded,
      message,
      fileId: event.fileId,
    });
  }

  async handleFileAccessed(event: FileAccessedEvent): Promise<NotificationRecord> {
    return this.repository.create({
      ownerId: event.ownerId,
      type: NOTIFICATION_TYPES.fileAccessed,
      message: `"${event.fileName}" was downloaded.`,
      fileId: event.fileId,
    });
  }

  async list(ownerId: string): Promise<NotificationList> {
    const [notifications, unreadCount] = await Promise.all([
      this.repository.listByOwner(ownerId, this.listLimit),
      this.repository.unreadCount(ownerId),
    ]);
    return { notifications, unreadCount };
  }

  markRead(ownerId: string, notificationId: string): Promise<boolean> {
    return this.repository.markRead(ownerId, notificationId);
  }

  markAllRead(ownerId: string): Promise<number> {
    return this.repository.markAllRead(ownerId);
  }
}
