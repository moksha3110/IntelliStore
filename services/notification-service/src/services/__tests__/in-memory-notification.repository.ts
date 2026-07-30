import { randomUUID } from 'node:crypto';
import type {
  CreateNotificationInput,
  NotificationRecord,
  NotificationRepository,
} from '../../repositories/notification.repository';

export class InMemoryNotificationRepository implements NotificationRepository {
  private readonly rows: NotificationRecord[] = [];

  async create(input: CreateNotificationInput): Promise<NotificationRecord> {
    const record: NotificationRecord = {
      id: randomUUID(),
      ownerId: input.ownerId,
      type: input.type,
      message: input.message,
      fileId: input.fileId,
      isRead: false,
      createdAt: new Date().toISOString(),
    };
    this.rows.push(record);
    return record;
  }

  async listByOwner(ownerId: string, limit: number): Promise<NotificationRecord[]> {
    return this.rows
      .filter((r) => r.ownerId === ownerId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit);
  }

  async unreadCount(ownerId: string): Promise<number> {
    return this.rows.filter((r) => r.ownerId === ownerId && !r.isRead).length;
  }

  async markRead(ownerId: string, notificationId: string): Promise<boolean> {
    const row = this.rows.find((r) => r.id === notificationId && r.ownerId === ownerId);
    if (!row) return false;
    row.isRead = true;
    return true;
  }

  async markAllRead(ownerId: string): Promise<number> {
    let count = 0;
    for (const row of this.rows) {
      if (row.ownerId === ownerId && !row.isRead) {
        row.isRead = true;
        count += 1;
      }
    }
    return count;
  }
}
