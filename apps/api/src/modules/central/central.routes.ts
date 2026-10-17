import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { requirePermission, requireAnyPermission } from '../../middleware/rbac';
import { centralController } from './central.controller';

/**
 * `/central` — the "All institutions" mode (doc §9.2).
 *
 * No requireBranch anywhere in this router: these endpoints span branches by
 * design and resolve their branch set from the caller's access scope.
 * Permissions reuse the module each view belongs to, so a finance head sees
 * the finance rollup without gaining the HR one.
 */
const router: ReturnType<typeof Router> = Router();

router.use(authenticate);

// Which institutions the caller can roll up (drives the UI switcher entry).
router.get('/scope', centralController.scope);

router.get(
  '/overview',
  requireAnyPermission([
    { module: 'dashboard.ownerView', action: 'view' },
    { module: 'organization.branches', action: 'view' },
  ]),
  centralController.overview
);

router.get('/finance', requirePermission('finance.reports', 'view'), centralController.finance);

router.get(
  '/admissions',
  requireAnyPermission([
    { module: 'admissions.applications', action: 'view' },
    { module: 'admissions.leads', action: 'view' },
  ]),
  centralController.admissions
);

router.get('/hr', requirePermission('hr.staff', 'view'), centralController.hr);

router.get(
  '/academics',
  requireAnyPermission([
    { module: 'obe.reports', action: 'view' },
    { module: 'dashboard.ownerView', action: 'view' },
  ]),
  centralController.academics
);

router.get('/branch-map', centralController.branchMap);

export default router;
