import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { requireBranch, requirePermission } from '../../middleware/rbac';
import { requireModule } from '../../middleware/moduleGating';
import { validateBody } from '../../middleware/validate';
import { healthRecordController } from './healthRecord.controller';
import { healthCheckupController } from './healthCheckup.controller';
import { vaccinationController } from './vaccination.controller';
import { medicalVisitController } from './medicalVisit.controller';
import { healthSettingsController } from './healthSettings.controller';
import { healthReportController } from './healthReport.controller';
import {
  createHealthRecordSchema,
  updateHealthRecordSchema,
  createHealthCheckupSchema,
  updateHealthCheckupSchema,
  completeHealthCheckupSchema,
  createCheckupCampaignSchema,
  updateCheckupCampaignSchema,
  createVaccinationSchema,
  updateVaccinationSchema,
  administerVaccinationSchema,
  createMedicalVisitSchema,
  updateMedicalVisitSchema,
  closeMedicalVisitSchema,
  updateHealthSettingsSchema,
} from '@campus-verse/shared/schemas';

const router: ReturnType<typeof Router> = Router();

// Apply authentication, module check, and branch check to all routes
router.use(authenticate);
router.use(requireModule('health'));
router.use(requireBranch);

// ============ Health Records ============

// Stats endpoint (before :id routes)
router.get(
  '/records/stats',
  requirePermission('health.records', 'view'),
  healthRecordController.getStats
);

// Get by person (before :id routes)
router.get(
  '/records/person/:personType/:personId',
  requirePermission('health.records', 'view'),
  healthRecordController.findByPerson
);

// Sync/create record for person
router.post(
  '/records/sync/:personType/:personId',
  requirePermission('health.records', 'create'),
  healthRecordController.syncFromPerson
);

// CRUD operations
router.get('/records', requirePermission('health.records', 'view'), healthRecordController.findAll);

router.post(
  '/records',
  requirePermission('health.records', 'create'),
  validateBody(createHealthRecordSchema),
  healthRecordController.create
);

router.get(
  '/records/:id',
  requirePermission('health.records', 'view'),
  healthRecordController.findById
);

router.put(
  '/records/:id',
  requirePermission('health.records', 'edit'),
  validateBody(updateHealthRecordSchema),
  healthRecordController.update
);

router.delete(
  '/records/:id',
  requirePermission('health.records', 'delete'),
  healthRecordController.delete
);

// Dismiss alert
router.post(
  '/records/:id/dismiss-alert',
  requirePermission('health.records', 'edit'),
  healthRecordController.dismissAlert
);

// ============ Health Checkups ============

// Stats endpoint (before :id routes)
router.get(
  '/checkups/stats',
  requirePermission('health.checkups', 'view'),
  healthCheckupController.getCheckupStats
);

// CRUD operations
router.get(
  '/checkups',
  requirePermission('health.checkups', 'view'),
  healthCheckupController.findAllCheckups
);

router.post(
  '/checkups',
  requirePermission('health.checkups', 'create'),
  validateBody(createHealthCheckupSchema),
  healthCheckupController.createCheckup
);

router.get(
  '/checkups/:id([0-9a-fA-F]{24})',
  requirePermission('health.checkups', 'view'),
  healthCheckupController.findCheckupById
);

router.put(
  '/checkups/:id',
  requirePermission('health.checkups', 'edit'),
  validateBody(updateHealthCheckupSchema),
  healthCheckupController.updateCheckup
);

// Complete checkup
router.post(
  '/checkups/:id/complete',
  requirePermission('health.checkups', 'edit'),
  validateBody(completeHealthCheckupSchema),
  healthCheckupController.completeCheckup
);

// ============ Checkup Campaigns ============

router.get(
  '/checkups/campaigns',
  requirePermission('health.checkups', 'view'),
  healthCheckupController.findAllCampaigns
);

router.post(
  '/checkups/campaigns',
  requirePermission('health.checkups', 'create'),
  validateBody(createCheckupCampaignSchema),
  healthCheckupController.createCampaign
);

router.get(
  '/checkups/campaigns/:id',
  requirePermission('health.checkups', 'view'),
  healthCheckupController.findCampaignById
);

router.put(
  '/checkups/campaigns/:id',
  requirePermission('health.checkups', 'edit'),
  validateBody(updateCheckupCampaignSchema),
  healthCheckupController.updateCampaign
);

router.post(
  '/checkups/campaigns/:id/start',
  requirePermission('health.checkups', 'create'),
  healthCheckupController.startCampaign
);

// ============ Vaccinations ============

// Stats endpoint (before :id routes)
router.get(
  '/vaccinations/stats',
  requirePermission('health.vaccinations', 'view'),
  vaccinationController.getStats
);

// Due vaccinations
router.get(
  '/vaccinations/due',
  requirePermission('health.vaccinations', 'view'),
  vaccinationController.getDue
);

// Mark overdue (admin action)
router.post(
  '/vaccinations/mark-overdue',
  requirePermission('health.vaccinations', 'edit'),
  vaccinationController.markOverdue
);

// CRUD operations
router.get(
  '/vaccinations',
  requirePermission('health.vaccinations', 'view'),
  vaccinationController.findAll
);

router.post(
  '/vaccinations',
  requirePermission('health.vaccinations', 'create'),
  validateBody(createVaccinationSchema),
  vaccinationController.create
);

router.get(
  '/vaccinations/:id',
  requirePermission('health.vaccinations', 'view'),
  vaccinationController.findById
);

router.put(
  '/vaccinations/:id',
  requirePermission('health.vaccinations', 'edit'),
  validateBody(updateVaccinationSchema),
  vaccinationController.update
);

router.delete(
  '/vaccinations/:id',
  requirePermission('health.vaccinations', 'delete'),
  vaccinationController.delete
);

// Administer vaccination
router.post(
  '/vaccinations/:id/administer',
  requirePermission('health.vaccinations', 'edit'),
  validateBody(administerVaccinationSchema),
  vaccinationController.administer
);

// ============ Medical Visits ============

// Stats endpoint (before :id routes)
router.get(
  '/visits/stats',
  requirePermission('health.visits', 'view'),
  medicalVisitController.getStats
);

// Today's visits
router.get(
  '/visits/today',
  requirePermission('health.visits', 'view'),
  medicalVisitController.getTodayVisits
);

// CRUD operations
router.get('/visits', requirePermission('health.visits', 'view'), medicalVisitController.findAll);

router.post(
  '/visits',
  requirePermission('health.visits', 'create'),
  validateBody(createMedicalVisitSchema),
  medicalVisitController.create
);

router.get(
  '/visits/:id',
  requirePermission('health.visits', 'view'),
  medicalVisitController.findById
);

router.put(
  '/visits/:id',
  requirePermission('health.visits', 'edit'),
  validateBody(updateMedicalVisitSchema),
  medicalVisitController.update
);

// Close visit
router.put(
  '/visits/:id/close',
  requirePermission('health.visits', 'edit'),
  validateBody(closeMedicalVisitSchema),
  medicalVisitController.close
);

// Notify parent
router.post(
  '/visits/:id/notify-parent',
  requirePermission('health.visits', 'edit'),
  medicalVisitController.notifyParent
);

// ============ Reports ============

router.get(
  '/reports/dashboard',
  requirePermission('health.reports', 'view'),
  healthReportController.getDashboard
);

router.get(
  '/reports/growth/:personId',
  requirePermission('health.reports', 'view'),
  healthReportController.getGrowthChart
);

router.get(
  '/reports/summary/:personId',
  requirePermission('health.reports', 'view'),
  healthReportController.getHealthSummary
);

router.get(
  '/reports/health-card/:personId',
  requirePermission('health.reports', 'export'),
  healthReportController.exportHealthCard
);

router.get(
  '/reports/compliance',
  requirePermission('health.reports', 'view'),
  healthReportController.getComplianceReport
);

// ============ Settings ============

router.get(
  '/settings',
  requirePermission('health.settings', 'view'),
  healthSettingsController.getSettings
);

router.put(
  '/settings',
  requirePermission('health.settings', 'edit'),
  validateBody(updateHealthSettingsSchema),
  healthSettingsController.updateSettings
);

router.post(
  '/settings/initialize',
  requirePermission('health.settings', 'edit'),
  healthSettingsController.initializeSettings
);

export default router;
