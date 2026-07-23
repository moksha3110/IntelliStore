import { signToken, verifyToken, TokenError, type TokenClaims } from '@intellistore/shared-auth';
import { AppError } from '../errors/app-error';

export type { TokenClaims };

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
    const accessToken = signToken(
      { sub: user.id, email: user.email, type: 'access' },
      this.options.accessSecret,
      this.options.accessExpiresIn,
    );

    const refreshToken = signToken(
      { sub: user.id, email: user.email, type: 'refresh' },
      this.options.refreshSecret,
      this.options.refreshExpiresIn,
    );

    return { accessToken, refreshToken };
  }

  verifyAccessToken(token: string): TokenClaims {
    return this.verify(token, this.options.accessSecret, 'access');
  }

  verifyRefreshToken(token: string): TokenClaims {
    return this.verify(token, this.options.refreshSecret, 'refresh');
  }

  private verify(token: string, secret: string, expectedType: TokenClaims['type']): TokenClaims {
    try {
      return verifyToken(token, secret, expectedType);
    } catch (err) {
      if (err instanceof TokenError) {
        throw AppError.unauthorized(err.message);
      }
      throw err;
    }
  }
}
