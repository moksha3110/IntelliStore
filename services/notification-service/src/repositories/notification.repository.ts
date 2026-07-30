import type { Pool } from 'pg';

export interface NotificationRecord {
  id: string;
  ownerId: string;
  type: string;
  message: string;
  fileId: string | null;
  isRead: boolean;
  createdAt: string;
}

export interface CreateNotificationInput {
  ownerId: string;
  type: string;
  message: string;
  fileId: string | null;
}

interface NotificationRow {
  id: string;
  owner_id: string;
  type: string;
  message: string;
  file_id: string | null;
  is_read: boolean;
  created_at: string;
}

function toRecord(row: NotificationRow): NotificationRecord {
  return {
    id: row.id,
    ownerId: row.owner_id,
    type: row.type,
    message: row.message,
    fileId: row.file_id,
    isRead: row.is_read,
    createdAt: row.created_at,
  };
}

export interface NotificationRepository {
  create(input: CreateNotificationInput): Promise<NotificationRecord>;
  listByOwner(ownerId: string, limit: number): Promise<NotificationRecord[]>;
  unreadCount(ownerId: string): Promise<number>;
  markRead(ownerId: string, notificationId: string): Promise<boolean>;
  markAllRead(ownerId: string): Promise<number>;
}

export class PgNotificationRepository implements NotificationRepository {
  constructor(private readonly pool: Pool) {}

  async create(input: CreateNotificationInput): Promise<NotificationRecord> {
    const result = await this.pool.query<NotificationRow>(
      `INSERT INTO notifications (owner_id, type, message, file_id)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [input.ownerId, input.type, input.message, input.fileId],
    );
    return toRecord(result.rows[0]);
  }

  async listByOwner(ownerId: string, limit: number): Promise<NotificationRecord[]> {
    const result = await this.pool.query<NotificationRow>(
      'SELECT * FROM notifications WHERE owner_id = $1 ORDER BY created_at DESC LIMIT $2',
      [ownerId, limit],
    );
    return result.rows.map(toRecord);
  }

  async unreadCount(ownerId: string): Promise<number> {
    const result = await this.pool.query<{ count: string }>(
      'SELECT count(*) FROM notifications WHERE owner_id = $1 AND is_read = false',
      [ownerId],
    );
    return Number(result.rows[0].count);
  }

  async markRead(ownerId: string, notificationId: string): Promise<boolean> {
    const result = await this.pool.query(
      'UPDATE notifications SET is_read = true WHERE id = $1 AND owner_id = $2',
      [notificationId, ownerId],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async markAllRead(ownerId: string): Promise<number> {
    const result = await this.pool.query(
      'UPDATE notifications SET is_read = true WHERE owner_id = $1 AND is_read = false',
      [ownerId],
    );
    return result.rowCount ?? 0;
  }
}
