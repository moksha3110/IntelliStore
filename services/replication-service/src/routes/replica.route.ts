import { Router } from 'express';
import type { ApiResponse } from '@intellistore/shared-types';
import { replicationService } from '../container';
import { asyncHandler } from '../middleware/async-handler';
import { requireAuth } from '../middleware/auth.middleware';

export const replicaRouter = Router();

replicaRouter.use(requireAuth);

replicaRouter.get(
  '/nodes',
  asyncHandler(async (_req, res) => {
    const nodes = await replicationService.listNodes();
    const body: ApiResponse<typeof nodes> = { success: true, data: nodes };
    res.status(200).json(body);
  }),
);

replicaRouter.get(
  '/diagnostics',
  asyncHandler(async (_req, res) => {
    const diagnostics = await replicationService.getDiagnostics();
    const body: ApiResponse<typeof diagnostics> = { success: true, data: diagnostics };
    res.status(200).json(body);
  }),
);

replicaRouter.get(
  '/chunks/:chunkId/replicas',
  asyncHandler(async (req, res) => {
    const replicas = await replicationService.listReplicas(req.params.chunkId);
    const body: ApiResponse<typeof replicas> = { success: true, data: replicas };
    res.status(200).json(body);
  }),
);
