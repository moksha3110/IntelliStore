import { Router } from 'express';
import type { ApiResponse } from '@intellistore/shared-types';
import { nodeRepository } from '../container';
import { AppError } from '../errors/app-error';
import { asyncHandler } from '../middleware/async-handler';

export const heartbeatRouter = Router();

// Intentionally unauthenticated: this stands in for a node's own liveness ping
// in a topology where storage nodes are simulated, not separate deployable
// units. In production this would sit behind network-level restriction (e.g.
// only reachable from the storage-node subnet / mTLS), not a user JWT - a
// storage node has no user identity to present.
heartbeatRouter.post(
  '/nodes/:name/heartbeat',
  asyncHandler(async (req, res) => {
    const node = await nodeRepository.findByName(req.params.name);
    if (!node) {
      throw AppError.notFound(`Unknown node: ${req.params.name}`);
    }

    await nodeRepository.setHealth(node.id, true, new Date().toISOString());

    const body: ApiResponse<{ name: string; isHealthy: true }> = {
      success: true,
      data: { name: node.name, isHealthy: true },
    };
    res.status(200).json(body);
  }),
);
