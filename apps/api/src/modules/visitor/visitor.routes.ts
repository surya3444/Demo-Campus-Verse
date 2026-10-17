import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { requireBranch, requirePermission } from '../../middleware/rbac';
import { requireModule } from '../../middleware/moduleGating';
import { validateBody } from '../../middleware/validate';
import {
  createVisitorSchema,
  updateVisitorSchema,
  visitorSettingsSchema,
} from '@campus-verse/shared/schemas';
import { visitorController } from './visitor.controller';
import { visitorPassController } from './visitorPass.controller';
import { visitorLogController } from './visitorLog.controller';
import { visitorSettingsController } from './visitorSettings.controller';

const router: ReturnType<typeof Router> = Router();

// Apply authentication and module gating
router.use(authenticate);
router.use(requireModule('visitor'));
router.use(requireBranch);

// ── Stats (must be before /:id) ──
router.get('/stats', requirePermission('visitor.dashboard', 'view'), visitorController.getStats);

// ── Logs (must be before /:id) ──
router.get('/logs', requirePermission('visitor.logs', 'view'), visitorLogController.getLogs);
router.get(
  '/logs/export',
  requirePermission('visitor.logs', 'export'),
  visitorLogController.exportLogs
);

// ── Pass Verification (must be before /:id) ──
router.get(
  '/pass/:passCode',
  requirePermission('visitor.passes', 'view'),
  visitorPassController.verify
);

// ── Settings (must be before /:id) ──
router.get(
  '/settings',
  requirePermission('visitor.settings', 'view'),
  visitorSettingsController.get
);
router.put(
  '/settings',
  requirePermission('visitor.settings', 'edit'),
  validateBody(visitorSettingsSchema),
  visitorSettingsController.update
);

// ── Visitors CRUD ──
router.get('/', requirePermission('visitor.visitors', 'view'), visitorController.findAll);
router.post(
  '/',
  requirePermission('visitor.visitors', 'create'),
  validateBody(createVisitorSchema),
  visitorController.create
);
router.get('/:id', requirePermission('visitor.visitors', 'view'), visitorController.findById);
router.put(
  '/:id',
  requirePermission('visitor.visitors', 'edit'),
  validateBody(updateVisitorSchema),
  visitorController.update
);
router.delete('/:id', requirePermission('visitor.visitors', 'delete'), visitorController.delete);

// ── Check-in / Check-out ──
router.put(
  '/:id/check-in',
  requirePermission('visitor.visitors', 'create'),
  visitorController.checkIn
);
router.put(
  '/:id/check-out',
  requirePermission('visitor.visitors', 'create'),
  visitorController.checkOut
);

// ── Passes ──
router.post(
  '/:id/pass',
  requirePermission('visitor.passes', 'create'),
  visitorPassController.generate
);
router.put(
  '/:id/pass/revoke',
  requirePermission('visitor.passes', 'revoke'),
  visitorPassController.revoke
);

export default router;
