import { Router } from 'express';
import { authRateLimiter } from '../../middleware/rateLimit';
import { authenticateSuperAdmin } from '../../middleware/superAdminAuth';
import { validateBody } from '../../middleware/validate';
import { adminController } from './admin.controller';
import {
  superAdminLoginSchema,
  rejectOrganizationSchema,
  approveOrganizationSchema,
  deleteOrganizationSchema,
  updateModulesSchema,
} from '@campus-verse/shared';

const router: ReturnType<typeof Router> = Router();

// ============ Public Admin Routes ============
router.post('/login', authRateLimiter, validateBody(superAdminLoginSchema), adminController.login);
router.post('/refresh', adminController.refresh);

// ============ Protected Admin Routes ============
router.use(authenticateSuperAdmin);

router.post('/logout', adminController.logout);
router.get('/dashboard/stats', adminController.getDashboardStats);
router.get('/statistics', adminController.getPlatformStatistics);
router.get('/organizations', adminController.getOrganizations);
router.get('/organizations/archived', adminController.getArchivedOrganizations);
router.get('/organizations/:id', adminController.getOrganization);
router.put(
  '/organizations/:id/approve',
  validateBody(approveOrganizationSchema),
  adminController.approveOrganization
);
router.put(
  '/organizations/:id/reject',
  validateBody(rejectOrganizationSchema),
  adminController.rejectOrganization
);
router.put('/organizations/:id/archive', adminController.archiveOrganization);
router.put('/organizations/:id/unarchive', adminController.unarchiveOrganization);
router.delete(
  '/organizations/:id',
  validateBody(deleteOrganizationSchema),
  adminController.deleteOrganization
);
router.put('/organizations/:id/reapply-settings', adminController.updateReapplySettings);
router.put(
  '/organizations/:id/modules',
  validateBody(updateModulesSchema),
  adminController.updateOrganizationModules
);

// Migration endpoint to fix role levels
router.post('/migrate/role-levels', adminController.migrateRoleLevels);

export default router;
