import { Router } from 'express';
import type { ApiResponse } from '@intellistore/shared-types';
import { analyticsService } from '../container';
import { AppError } from '../errors/app-error';
import { asyncHandler } from '../middleware/async-handler';
import { requireAuth } from '../middleware/auth.middleware';

export const analyticsRouter = Router();

analyticsRouter.use(requireAuth);

function requireBearerToken(req: { bearerToken?: string }): string {
  if (!req.bearerToken) {
    throw AppError.unauthorized();
  }
  return req.bearerToken;
}

analyticsRouter.get(
  '/files',
  asyncHandler(async (req, res) => {
    const result = await analyticsService.getFileRecommendations(requireBearerToken(req));
    const body: ApiResponse<typeof result> = { success: true, data: result };
    res.status(200).json(body);
  }),
);

analyticsRouter.get(
  '/overview',
  asyncHandler(async (req, res) => {
    const result = await analyticsService.getOverview(requireBearerToken(req));
    const body: ApiResponse<typeof result> = { success: true, data: result };
    res.status(200).json(body);
  }),
);
