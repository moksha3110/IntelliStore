import bcrypt from 'bcryptjs';
import type { User } from '@intellistore/shared-types';
import { AppError } from '../errors/app-error';
import type { UserRecord, UserRepository } from '../repositories/user.repository';
import type { LoginInput, RegisterInput } from '../validation/auth.schema';
import type { TokenPair, TokenService } from './token.service';

const BCRYPT_SALT_ROUNDS = 12;

function toPublicUser(record: UserRecord): User {
  return {
    id: record.id,
    email: record.email,
    displayName: record.displayName,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export interface AuthResult {
  user: User;
  tokens: TokenPair;
}

export class AuthService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly tokenService: TokenService,
  ) {}

  async register(input: RegisterInput): Promise<AuthResult> {
    const existing = await this.userRepository.findByEmail(input.email);
    if (existing) {
      throw AppError.conflict('An account with this email already exists');
    }

    const passwordHash = await bcrypt.hash(input.password, BCRYPT_SALT_ROUNDS);
    const record = await this.userRepository.create({
      email: input.email,
      passwordHash,
      displayName: input.displayName,
    });

    return {
      user: toPublicUser(record),
      tokens: this.tokenService.issueTokenPair({ id: record.id, email: record.email }),
    };
  }

  async login(input: LoginInput): Promise<AuthResult> {
    const record = await this.userRepository.findByEmail(input.email);
    if (!record) {
      throw AppError.unauthorized('Invalid email or password');
    }

    const passwordMatches = await bcrypt.compare(input.password, record.passwordHash);
    if (!passwordMatches) {
      throw AppError.unauthorized('Invalid email or password');
    }

    return {
      user: toPublicUser(record),
      tokens: this.tokenService.issueTokenPair({ id: record.id, email: record.email }),
    };
  }

  async refresh(refreshToken: string): Promise<TokenPair> {
    const claims = this.tokenService.verifyRefreshToken(refreshToken);

    const record = await this.userRepository.findById(claims.sub);
    if (!record) {
      throw AppError.unauthorized('User no longer exists');
    }

    return this.tokenService.issueTokenPair({ id: record.id, email: record.email });
  }

  async getProfile(userId: string): Promise<User> {
    const record = await this.userRepository.findById(userId);
    if (!record) {
      throw AppError.notFound('User not found');
    }
    return toPublicUser(record);
  }
}
