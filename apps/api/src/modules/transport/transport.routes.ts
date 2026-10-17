import { Router } from 'express';
import { studentParamGuard } from '../teaching/scope';
import { authenticate } from '../../middleware/auth';
import { requireBranch, requirePermission } from '../../middleware/rbac';
import { requireModule } from '../../middleware/moduleGating';
import { validateBody } from '../../middleware/validate';
import {
  createBusSchema,
  updateBusSchema,
  createTransportEnrollmentSchema,
  updateTransportEnrollmentSchema,
  withdrawEnrollmentSchema,
  transportSettingsSchema,
} from '@campus-verse/shared/schemas';
import { busController } from './bus.controller';
import { enrollmentController } from './enrollment.controller';
import { transportSettingsController } from './settings.controller';

const router: ReturnType<typeof Router> = Router();

router.use(authenticate);
router.use(requireModule('transport'));
router.use(requireBranch);

// Every :studentId here is a student: callers only reach students in their scope.
router.param('studentId', studentParamGuard);

// ── Stats (must come before /buses/:id) ──
router.get('/buses/stats', requirePermission('transport.buses', 'view'), busController.getStats);

// ── Settings (must come before /buses/:id) ──
router.get(
  '/settings',
  requirePermission('transport.settings', 'view'),
  transportSettingsController.get
);
router.put(
  '/settings',
  requirePermission('transport.settings', 'edit'),
  validateBody(transportSettingsSchema),
  transportSettingsController.update
);

// ── Buses CRUD ──
router.get('/buses', requirePermission('transport.buses', 'view'), busController.findAll);
router.post(
  '/buses',
  requirePermission('transport.buses', 'create'),
  validateBody(createBusSchema),
  busController.create
);
router.get('/buses/:id', requirePermission('transport.buses', 'view'), busController.findById);
router.put(
  '/buses/:id',
  requirePermission('transport.buses', 'edit'),
  validateBody(updateBusSchema),
  busController.update
);
router.delete('/buses/:id', requirePermission('transport.buses', 'delete'), busController.delete);

// ── Enrollments ──
// Self-scoped: any authenticated user can view their own active transport
// enrollment (resolved via user → student record link). No specific
// `transport.enrollments` permission required since the result is filtered to
// the caller's own data.
router.get('/enrollments/my', enrollmentController.findMine);

router.get(
  '/enrollments/student/:studentId',
  requirePermission('transport.enrollments', 'view'),
  enrollmentController.findByStudent
);
router.get(
  '/enrollments',
  requirePermission('transport.enrollments', 'view'),
  enrollmentController.findAll
);
router.post(
  '/enrollments',
  requirePermission('transport.enrollments', 'create'),
  validateBody(createTransportEnrollmentSchema),
  enrollmentController.create
);
router.get(
  '/enrollments/:id',
  requirePermission('transport.enrollments', 'view'),
  enrollmentController.findById
);
router.put(
  '/enrollments/:id',
  requirePermission('transport.enrollments', 'edit'),
  validateBody(updateTransportEnrollmentSchema),
  enrollmentController.update
);
router.post(
  '/enrollments/:id/withdraw',
  requirePermission('transport.enrollments', 'withdraw'),
  validateBody(withdrawEnrollmentSchema),
  enrollmentController.withdraw
);

export default router;
