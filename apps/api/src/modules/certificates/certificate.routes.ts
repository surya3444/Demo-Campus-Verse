import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { requireBranch, requirePermission } from '../../middleware/rbac';
import { requireModule } from '../../middleware/moduleGating';
import { certificateController } from './certificate.controller';
import { certificateSettingsController } from './certificateSettings.controller';

const router: ReturnType<typeof Router> = Router();

router.use(authenticate);
router.use(requireModule('certificates'));

// ============ Certificate Types (Tenant-level) ============
router.get(
  '/types',
  requirePermission('certificates.types', 'view'),
  certificateController.findAllTypes
);

router.post(
  '/types',
  requirePermission('certificates.types', 'create'),
  certificateController.createType
);

router.get(
  '/types/:id',
  requirePermission('certificates.types', 'view'),
  certificateController.findTypeById
);

router.put(
  '/types/:id',
  requirePermission('certificates.types', 'edit'),
  certificateController.updateType
);

// ============ Certificate Requests (Branch-level) ============
router.use(requireBranch);

// Stats & Reports
router.get(
  '/stats',
  requirePermission('certificates.requests', 'view'),
  certificateController.getStats
);
router.get(
  '/reports',
  requirePermission('certificates.requests', 'view'),
  certificateController.getReport
);

router.get(
  '/requests',
  requirePermission('certificates.requests', 'view'),
  certificateController.findAllRequests
);

router.post(
  '/requests',
  requirePermission('certificates.requests', 'create'),
  certificateController.createRequest
);

router.get(
  '/requests/:id',
  requirePermission('certificates.requests', 'view'),
  certificateController.findRequestById
);

router.put(
  '/requests/:id/approve',
  requirePermission('certificates.requests', 'edit'),
  certificateController.approveRequest
);

router.put(
  '/requests/:id/reject',
  requirePermission('certificates.requests', 'edit'),
  certificateController.rejectRequest
);

router.put(
  '/requests/:id/issue',
  requirePermission('certificates.requests', 'edit'),
  certificateController.issueRequest
);

// ============ ID Cards ============
router.get(
  '/id-cards/templates',
  requirePermission('certificates.idcards', 'view'),
  certificateController.findAllIdCardTemplates
);

router.post(
  '/id-cards/templates',
  requirePermission('certificates.idcards', 'create'),
  certificateController.createIdCardTemplate
);

router.post(
  '/id-cards/generate',
  requirePermission('certificates.idcards', 'create'),
  certificateController.generateIdCard
);

router.post(
  '/id-cards/bulk-generate',
  requirePermission('certificates.idcards', 'create'),
  certificateController.bulkGenerateIdCards
);

// ============ Settings ============
router.get(
  '/settings',
  requirePermission('certificates.settings', 'view'),
  certificateSettingsController.getSettings
);
router.put(
  '/settings',
  requirePermission('certificates.settings', 'edit'),
  certificateSettingsController.updateSettings
);

// Staff Certificate Types
router.post(
  '/settings/staff-types',
  requirePermission('certificates.settings', 'edit'),
  certificateSettingsController.addStaffCertificateType
);
router.put(
  '/settings/staff-types/:code',
  requirePermission('certificates.settings', 'edit'),
  certificateSettingsController.updateStaffCertificateType
);
router.delete(
  '/settings/staff-types/:code',
  requirePermission('certificates.settings', 'edit'),
  certificateSettingsController.deleteStaffCertificateType
);

// Number Generation
router.post(
  '/generate-number',
  requirePermission('certificates.requests', 'create'),
  certificateSettingsController.generateCertificateNumber
);
router.post(
  '/id-cards/generate-number',
  requirePermission('certificates.idcards', 'create'),
  certificateSettingsController.generateIdCardNumber
);

export default router;
