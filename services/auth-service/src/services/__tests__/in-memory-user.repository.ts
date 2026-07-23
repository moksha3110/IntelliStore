import { randomUUID } from 'node:crypto';
import type { CreateUserInput, UserRecord, UserRepository } from '../../repositories/user.repository';

export class InMemoryUserRepository implements UserRepository {
  private readonly usersById = new Map<string, UserRecord>();

  async findByEmail(email: string): Promise<UserRecord | null> {
    for (const user of this.usersById.values()) {
      if (user.email === email) return user;
    }
    return null;
  }

  async findById(id: string): Promise<UserRecord | null> {
    return this.usersById.get(id) ?? null;
  }

  async create(input: CreateUserInput): Promise<UserRecord> {
    const now = new Date().toISOString();
    const record: UserRecord = {
      id: randomUUID(),
      email: input.email,
      passwordHash: input.passwordHash,
      displayName: input.displayName,
      createdAt: now,
      updatedAt: now,
    };
    this.usersById.set(record.id, record);
    return record;
  }
}
