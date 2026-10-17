import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { requirePermission } from '../../middleware/rbac';
import { schedulerController } from './scheduler.controller';

const router: ReturnType<typeof Router> = Router();

// All routes require authentication
router.use(authenticate);

// ============ Scheduled Jobs ============
router.get(
  '/jobs',
  requirePermission('organization.settings', 'view'),
  schedulerController.findAll
);

router.post(
  '/jobs',
  requirePermission('organization.settings', 'edit'),
  schedulerController.create
);

router.get(
  '/jobs/:id',
  requirePermission('organization.settings', 'view'),
  schedulerController.findById
);

router.put(
  '/jobs/:id',
  requirePermission('organization.settings', 'edit'),
  schedulerController.update
);

router.delete(
  '/jobs/:id',
  requirePermission('organization.settings', 'delete'),
  schedulerController.delete
);

router.get(
  '/jobs/:id/history',
  requirePermission('organization.settings', 'view'),
  schedulerController.getHistory
);

router.post(
  '/jobs/:id/run',
  requirePermission('organization.settings', 'edit'),
  schedulerController.runJob
);

router.post(
  '/jobs/:id/pause',
  requirePermission('organization.settings', 'edit'),
  schedulerController.pauseJob
);

router.post(
  '/jobs/:id/resume',
  requirePermission('organization.settings', 'edit'),
  schedulerController.resumeJob
);

export default router;
