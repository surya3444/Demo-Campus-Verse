import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { requirePermission } from '../../middleware/rbac';
import { validateQuery } from '../../middleware/validate';
import { auditController, auditQuerySchema } from './audit.controller';

const router: ReturnType<typeof Router> = Router();

router.use(authenticate);

// Tenant-wide activity log (across branches) — no requireBranch. Scoped to the
// caller's tenant in the service; gated by the existing dashboard.audit permission.
// Distinct module names for the filter dropdown.
router.get('/modules', requirePermission('dashboard.audit', 'view'), (req, res, next) =>
  auditController.getModules(req, res, next)
);

router.get(
  '/logs',
  requirePermission('dashboard.audit', 'view'),
  validateQuery(auditQuerySchema),
  auditController.getLogs
);

router.get(
  '/logs/export',
  requirePermission('dashboard.audit', 'export'),
  validateQuery(auditQuerySchema),
  auditController.exportLogs
);

export default router;
