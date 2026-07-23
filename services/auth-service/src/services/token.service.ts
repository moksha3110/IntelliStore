import jwt from 'jsonwebtoken';
import { AppError } from '../errors/app-error';

export type TokenType = 'access' | 'refresh';

export interface TokenClaims {
  sub: string;
  email: string;
  type: TokenType;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface TokenServiceOptions {
  accessSecret: string;
  refreshSecret: string;
  accessExpiresIn: string;
  refreshExpiresIn: string;
}

export class TokenService {
  constructor(private readonly options: TokenServiceOptions) {}

  issueTokenPair(user: { id: string; email: string }): TokenPair {
    const accessToken = jwt.sign(
      { sub: user.id, email: user.email, type: 'access' } satisfies TokenClaims,
      this.options.accessSecret,
      { expiresIn: this.options.accessExpiresIn } as jwt.SignOptions,
    );

    const refreshToken = jwt.sign(
      { sub: user.id, email: user.email, type: 'refresh' } satisfies TokenClaims,
      this.options.refreshSecret,
      { expiresIn: this.options.refreshExpiresIn } as jwt.SignOptions,
    );

    return { accessToken, refreshToken };
  }

  verifyAccessToken(token: string): TokenClaims {
    return this.verify(token, this.options.accessSecret, 'access');
  }

  verifyRefreshToken(token: string): TokenClaims {
    return this.verify(token, this.options.refreshSecret, 'refresh');
  }

  private verify(token: string, secret: string, expectedType: TokenType): TokenClaims {
    let decoded: jwt.JwtPayload | string;
    try {
      decoded = jwt.verify(token, secret);
    } catch {
      throw AppError.unauthorized('Invalid or expired token');
    }

    if (typeof decoded === 'string') {
      throw AppError.unauthorized('Malformed token');
    }

    const { sub, email, type } = decoded as Partial<TokenClaims>;
    if (!sub || !email || type !== expectedType) {
      throw AppError.unauthorized('Malformed token');
    }

    return { sub, email, type };
  }
}
