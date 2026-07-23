import { Router } from 'express';
import type { ApiResponse, User } from '@intellistore/shared-types';
import { authService, tokenService } from '../container';
import { AppError } from '../errors/app-error';
import { asyncHandler } from '../middleware/async-handler';
import { requireAuth } from '../middleware/auth.middleware';
import { validateBody } from '../middleware/validate';
import { loginSchema, refreshSchema, registerSchema } from '../validation/auth.schema';
import type { AuthResult } from '../services/auth.service';
import type { TokenPair } from '../services/token.service';

export const authRouter = Router();

authRouter.post(
  '/register',
  validateBody(registerSchema),
  asyncHandler(async (req, res) => {
    const result = await authService.register(req.body);
    const body: ApiResponse<AuthResult> = { success: true, data: result };
    res.status(201).json(body);
  }),
);

authRouter.post(
  '/login',
  validateBody(loginSchema),
  asyncHandler(async (req, res) => {
    const result = await authService.login(req.body);
    const body: ApiResponse<AuthResult> = { success: true, data: result };
    res.status(200).json(body);
  }),
);

authRouter.post(
  '/refresh',
  validateBody(refreshSchema),
  asyncHandler(async (req, res) => {
    const tokens = await authService.refresh(req.body.refreshToken);
    const body: ApiResponse<TokenPair> = { success: true, data: tokens };
    res.status(200).json(body);
  }),
);

authRouter.get(
  '/me',
  requireAuth(tokenService),
  asyncHandler(async (req, res) => {
    if (!req.user) {
      throw AppError.unauthorized();
    }
    const user = await authService.getProfile(req.user.id);
    const body: ApiResponse<User> = { success: true, data: user };
    res.status(200).json(body);
  }),
);
