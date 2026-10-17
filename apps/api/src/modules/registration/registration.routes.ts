import { Router } from 'express';
import { studentParamGuard } from '../teaching/scope';
import { authenticate } from '../../middleware/auth';
import { requirePermission, requireBranch } from '../../middleware/rbac';
import { requireModule } from '../../middleware/moduleGating';
import { validateBody } from '../../middleware/validate';
// Import from the /schemas subpath like every other routes file — the root
// barrel drags in the whole package and shifts type resolution.
import {
  createSchemeSchema,
  updateSchemeSchema,
  cloneSchemeSchema,
  submitRegistrationSchema,
  updateRegistrationSchema,
} from '@campus-verse/shared/schemas';
import { schemeController } from './scheme.controller';
import { registrationController } from './registration.controller';

// Explicitly annotated: with declaration emit under pnpm's nested node_modules,
// the inferred type can't be named portably (TS2742) and the Docker build fails
// even though a local `tsc` succeeds.
const router: Router = Router();

router.use(authenticate);
router.use(requireModule('registration'));
router.use(requireBranch);

// Every :studentId here is a student: callers only reach students in their scope.
router.param('studentId', studentParamGuard);

// ─── Program schemes (registrar) ─────────────────────────────────────────────

router.get('/schemes', requirePermission('registration.schemes', 'view'), schemeController.findAll);

router.post(
  '/schemes',
  requirePermission('registration.schemes', 'create'),
  validateBody(createSchemeSchema),
  schemeController.create
);

router.get(
  '/schemes/:id',
  requirePermission('registration.schemes', 'view'),
  schemeController.findById
);

router.put(
  '/schemes/:id',
  requirePermission('registration.schemes', 'edit'),
  validateBody(updateSchemeSchema),
  schemeController.update
);

router.post(
  '/schemes/:id/publish',
  requirePermission('registration.schemes', 'publish'),
  schemeController.publish
);

router.post(
  '/schemes/:id/archive',
  requirePermission('registration.schemes', 'publish'),
  schemeController.archive
);

router.post(
  '/schemes/:id/clone',
  requirePermission('registration.schemes', 'create'),
  validateBody(cloneSchemeSchema),
  schemeController.clone
);

router.delete(
  '/schemes/:id',
  requirePermission('registration.schemes', 'delete'),
  schemeController.delete
);

// ─── Student self-service ────────────────────────────────────────────────────

router.get(
  '/my/context',
  requirePermission('registration.self', 'view'),
  registrationController.myContext
);

router.post(
  '/my/registrations',
  requirePermission('registration.self', 'create'),
  validateBody(submitRegistrationSchema),
  registrationController.submitMine
);

router.put(
  '/my/registrations/:termId',
  requirePermission('registration.self', 'edit'),
  validateBody(updateRegistrationSchema),
  registrationController.updateMine
);

router.delete(
  '/my/registrations/:termId',
  requirePermission('registration.self', 'edit'),
  registrationController.withdrawMine
);

// ─── Registrar / admin ───────────────────────────────────────────────────────

router.get(
  '/terms/:termId/registrations',
  requirePermission('registration.registrations', 'view'),
  registrationController.listForTerm
);

router.get(
  '/terms/:termId/pending',
  requirePermission('registration.registrations', 'view'),
  registrationController.pendingForTerm
);

router.get(
  '/terms/:termId/overview',
  requirePermission('registration.registrations', 'view'),
  registrationController.overview
);

router.post(
  '/students/:studentId/registrations',
  requirePermission('registration.registrations', 'override'),
  validateBody(submitRegistrationSchema),
  registrationController.submitForStudent
);

router.delete(
  '/students/:studentId/registrations/:termId',
  requirePermission('registration.registrations', 'override'),
  registrationController.withdrawForStudent
);

export default router;
