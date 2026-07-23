import jwt from 'jsonwebtoken';

export type TokenType = 'access' | 'refresh';

export interface TokenClaims {
  sub: string;
  email: string;
  type: TokenType;
}

export class TokenError extends Error {
  constructor(message = 'Invalid or expired token') {
    super(message);
    this.name = 'TokenError';
  }
}

export function signToken(
  claims: TokenClaims,
  secret: string,
  expiresIn: string,
): string {
  return jwt.sign(claims, secret, { expiresIn } as jwt.SignOptions);
}

export function verifyToken(token: string, secret: string, expectedType: TokenType): TokenClaims {
  let decoded: jwt.JwtPayload | string;
  try {
    decoded = jwt.verify(token, secret);
  } catch {
    throw new TokenError();
  }

  if (typeof decoded === 'string') {
    throw new TokenError('Malformed token');
  }

  const { sub, email, type } = decoded as Partial<TokenClaims>;
  if (!sub || !email || type !== expectedType) {
    throw new TokenError('Malformed token');
  }

  return { sub, email, type };
}

export function extractBearerToken(authorizationHeader: string | undefined): string {
  if (!authorizationHeader?.startsWith('Bearer ')) {
    throw new TokenError('Missing bearer token');
  }
  return authorizationHeader.slice('Bearer '.length);
}
