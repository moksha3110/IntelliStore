import type { NextFunction, Request, Response } from 'express';
import { extractBearerToken, verifyToken, TokenError } from '@intellistore/shared-auth';
import { AppError } from '../errors/app-error';
import { config } from '../config';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: { id: string; email: string };
      bearerToken?: string;
    }
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  try {
    const token = extractBearerToken(req.headers.authorization);
    const claims = verifyToken(token, config.JWT_SECRET, 'access');
    req.user = { id: claims.sub, email: claims.email };
    req.bearerToken = token;
    next();
  } catch (err) {
    if (err instanceof TokenError) {
      throw AppError.unauthorized(err.message);
    }
    throw err;
  }
}
