import { Router } from 'express';
import type { ApiResponse } from '@intellistore/shared-types';
import { notificationService } from '../container';
import { AppError } from '../errors/app-error';
import { asyncHandler } from '../middleware/async-handler';
import { requireAuth } from '../middleware/auth.middleware';

export const notificationRouter = Router();

notificationRouter.use(requireAuth);

function ownerId(req: { user?: { id: string } }): string {
  if (!req.user) throw AppError.unauthorized();
  return req.user.id;
}

notificationRouter.get(
  '/notifications',
  asyncHandler(async (req, res) => {
    const result = await notificationService.list(ownerId(req));
    const body: ApiResponse<typeof result> = { success: true, data: result };
    res.status(200).json(body);
  }),
);

notificationRouter.post(
  '/notifications/read-all',
  asyncHandler(async (req, res) => {
    const updated = await notificationService.markAllRead(ownerId(req));
    const body: ApiResponse<{ updated: number }> = { success: true, data: { updated } };
    res.status(200).json(body);
  }),
);

notificationRouter.post(
  '/notifications/:id/read',
  asyncHandler(async (req, res) => {
    const found = await notificationService.markRead(ownerId(req), req.params.id);
    if (!found) {
      throw AppError.notFound('Notification not found');
    }
    const body: ApiResponse<{ id: string; isRead: true }> = {
      success: true,
      data: { id: req.params.id, isRead: true },
    };
    res.status(200).json(body);
  }),
);
