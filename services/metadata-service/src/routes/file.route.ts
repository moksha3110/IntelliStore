import { Router } from 'express';
import type { ApiResponse } from '@intellistore/shared-types';
import { fileService } from '../container';
import { AppError } from '../errors/app-error';
import { asyncHandler } from '../middleware/async-handler';
import { requireAuth } from '../middleware/auth.middleware';
import { validateBody } from '../middleware/validate';
import { createFileSchema, createVersionSchema } from '../validation/file.schema';

export const fileRouter = Router();

fileRouter.use(requireAuth);

function ownerId(req: { user?: { id: string } }): string {
  if (!req.user) {
    throw AppError.unauthorized();
  }
  return req.user.id;
}

fileRouter.post(
  '/',
  validateBody(createFileSchema),
  asyncHandler(async (req, res) => {
    const result = await fileService.registerFile(ownerId(req), req.body);
    const body: ApiResponse<typeof result> = { success: true, data: result };
    res.status(201).json(body);
  }),
);

fileRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const result = await fileService.listFiles(ownerId(req));
    const body: ApiResponse<typeof result> = { success: true, data: result };
    res.status(200).json(body);
  }),
);

// Registered before "/:id" so "_stats" isn't captured as a file id.
fileRouter.get(
  '/_stats',
  asyncHandler(async (_req, res) => {
    const result = await fileService.getSystemStats();
    const body: ApiResponse<typeof result> = { success: true, data: result };
    res.status(200).json(body);
  }),
);

fileRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const result = await fileService.getFile(ownerId(req), req.params.id);
    const body: ApiResponse<typeof result> = { success: true, data: result };
    res.status(200).json(body);
  }),
);

fileRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await fileService.deleteFile(ownerId(req), req.params.id);
    res.status(204).send();
  }),
);

fileRouter.post(
  '/:id/versions',
  validateBody(createVersionSchema),
  asyncHandler(async (req, res) => {
    const result = await fileService.addVersion(ownerId(req), req.params.id, req.body);
    const body: ApiResponse<typeof result> = { success: true, data: result };
    res.status(201).json(body);
  }),
);

fileRouter.get(
  '/:id/versions/:versionNumber',
  asyncHandler(async (req, res) => {
    const versionNumber = Number(req.params.versionNumber);
    if (!Number.isInteger(versionNumber) || versionNumber < 1) {
      throw AppError.badRequest('versionNumber must be a positive integer');
    }
    const result = await fileService.getVersion(ownerId(req), req.params.id, versionNumber);
    const body: ApiResponse<typeof result> = { success: true, data: result };
    res.status(200).json(body);
  }),
);
