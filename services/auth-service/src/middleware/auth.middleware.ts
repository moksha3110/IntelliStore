import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../errors/app-error';
import type { TokenService } from '../services/token.service';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: { id: string; email: string };
    }
  }
}

export function requireAuth(tokenService: TokenService) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw AppError.unauthorized('Missing bearer token');
    }

    const token = header.slice('Bearer '.length);
    const claims = tokenService.verifyAccessToken(token);
    req.user = { id: claims.sub, email: claims.email };
    next();
  };
}
