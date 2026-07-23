import { Router } from 'express';
import multer from 'multer';
import type { ApiResponse } from '@intellistore/shared-types';
import { config } from '../config';
import { downloadService, uploadService } from '../container';
import { AppError } from '../errors/app-error';
import { asyncHandler } from '../middleware/async-handler';
import { requireAuth } from '../middleware/auth.middleware';

export const uploadRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.maxUploadSizeBytes },
});

uploadRouter.use(requireAuth);

function requireBearerToken(req: { bearerToken?: string }): string {
  if (!req.bearerToken) {
    throw AppError.unauthorized();
  }
  return req.bearerToken;
}

uploadRouter.post(
  '/',
  upload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      throw AppError.badRequest('Missing "file" field in multipart form data');
    }
    const fileName = (req.body?.fileName as string | undefined) || req.file.originalname;

    const result = await uploadService.uploadNewFile(
      requireBearerToken(req),
      fileName,
      req.file.mimetype,
      req.file.buffer,
    );
    const body: ApiResponse<typeof result> = { success: true, data: result };
    res.status(201).json(body);
  }),
);

uploadRouter.post(
  '/:id/versions',
  upload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      throw AppError.badRequest('Missing "file" field in multipart form data');
    }

    const result = await uploadService.uploadNewVersion(
      requireBearerToken(req),
      req.params.id,
      req.file.mimetype,
      req.file.buffer,
    );
    const body: ApiResponse<typeof result> = { success: true, data: result };
    res.status(201).json(body);
  }),
);

uploadRouter.get(
  '/:id/download',
  asyncHandler(async (req, res) => {
    const result = await downloadService.download(requireBearerToken(req), req.params.id);
    res.set('Content-Type', result.mimeType);
    res.set('Content-Disposition', `attachment; filename="${result.fileName}"`);
    res.set('X-File-Version', String(result.versionNumber));
    res.status(200).send(result.buffer);
  }),
);

uploadRouter.get(
  '/:id/versions/:versionNumber/download',
  asyncHandler(async (req, res) => {
    const versionNumber = Number(req.params.versionNumber);
    if (!Number.isInteger(versionNumber) || versionNumber < 1) {
      throw AppError.badRequest('versionNumber must be a positive integer');
    }

    const result = await downloadService.download(
      requireBearerToken(req),
      req.params.id,
      versionNumber,
    );
    res.set('Content-Type', result.mimeType);
    res.set('Content-Disposition', `attachment; filename="${result.fileName}"`);
    res.set('X-File-Version', String(result.versionNumber));
    res.status(200).send(result.buffer);
  }),
);
