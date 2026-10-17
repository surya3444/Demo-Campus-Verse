import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { requireBranch, requirePermission } from '../../middleware/rbac';
import { requireModule } from '../../middleware/moduleGating';
import { validateBody, validateQuery } from '../../middleware/validate';
// Import from the /schemas subpath like every other routes file — the root
// barrel drags in the whole package and shifts type resolution.
import {
  obeSettingsSchema,
  createObeProgramSchema,
  updateObeProgramSchema,
  obeProgramCorrectiveActionsSchema,
  upsertCourseOutcomesSchema,
  createObeOfferingSchema,
  updateObeOfferingSchema,
  obeOfferingStatusSchema,
  obeOfferingQuerySchema,
  obeInstrumentSchema,
  obeBulkMarksSchema,
  obeMarksImportSchema,
  obeCoCorrectiveActionsSchema,
  obeSurveyResponseSchema,
} from '@campus-verse/shared/schemas';
import { obeSettingsController } from './settings.controller';
import { obeProgramController } from './program.controller';
import { obeOutcomeController } from './outcome.controller';
import { obeOfferingController } from './offering.controller';
import { obeMarksController } from './marks.controller';
import { obeAttainmentController } from './attainment.controller';
import { obeSurveyController } from './survey.controller';
import { obeReportController } from './report.controller';

const router: Router = Router();

router.use(authenticate);
router.use(requireModule('obe'));
router.use(requireBranch);

// ── Settings ──
router.get('/settings', requirePermission('obe.settings', 'view'), obeSettingsController.get);
router.put(
  '/settings',
  requirePermission('obe.settings', 'edit'),
  validateBody(obeSettingsSchema),
  obeSettingsController.update
);

// ── Programs (PO/PSO definitions) ──
router.get('/programs', requirePermission('obe.programs', 'view'), obeProgramController.findAll);
router.post(
  '/programs',
  requirePermission('obe.programs', 'create'),
  validateBody(createObeProgramSchema),
  obeProgramController.create
);
router.get(
  '/programs/:id',
  requirePermission('obe.programs', 'view'),
  obeProgramController.findById
);
router.put(
  '/programs/:id',
  requirePermission('obe.programs', 'edit'),
  validateBody(updateObeProgramSchema),
  obeProgramController.update
);
router.delete(
  '/programs/:id',
  requirePermission('obe.programs', 'delete'),
  obeProgramController.delete
);
router.put(
  '/programs/:id/corrective-actions',
  requirePermission('obe.attainment', 'edit'),
  validateBody(obeProgramCorrectiveActionsSchema),
  obeProgramController.updateCorrectiveActions
);

// ── Course outcomes + mapping matrices ──
router.get('/outcomes', requirePermission('obe.outcomes', 'view'), obeOutcomeController.get);
router.get(
  '/outcomes/by-program',
  requirePermission('obe.outcomes', 'view'),
  obeOutcomeController.listForProgram
);
router.put(
  '/outcomes',
  requirePermission('obe.outcomes', 'edit'),
  validateBody(upsertCourseOutcomesSchema),
  obeOutcomeController.upsert
);

// ── Exam links (static — must come before /offerings/:id) ──
router.get(
  '/exam-links',
  requirePermission('obe.offerings', 'view'),
  obeOfferingController.examLinkCandidates
);

// ── Offerings ──
router.get(
  '/offerings',
  requirePermission('obe.offerings', 'view'),
  validateQuery(obeOfferingQuerySchema),
  obeOfferingController.findAll
);
router.post(
  '/offerings',
  requirePermission('obe.offerings', 'create'),
  validateBody(createObeOfferingSchema),
  obeOfferingController.create
);
router.get(
  '/offerings/:id',
  requirePermission('obe.offerings', 'view'),
  obeOfferingController.findById
);
router.put(
  '/offerings/:id',
  requirePermission('obe.offerings', 'edit'),
  validateBody(updateObeOfferingSchema),
  obeOfferingController.update
);
router.delete(
  '/offerings/:id',
  requirePermission('obe.offerings', 'delete'),
  obeOfferingController.delete
);
router.post(
  '/offerings/:id/status',
  requirePermission('obe.offerings', 'edit'),
  validateBody(obeOfferingStatusSchema),
  obeOfferingController.setStatus
);
router.get(
  '/offerings/:id/cohort',
  requirePermission('obe.offerings', 'view'),
  obeOfferingController.getCohort
);

// ── Instruments ──
router.post(
  '/offerings/:id/instruments',
  requirePermission('obe.offerings', 'edit'),
  validateBody(obeInstrumentSchema),
  obeOfferingController.addInstrument
);
router.put(
  '/offerings/:id/instruments/:instrumentId',
  requirePermission('obe.offerings', 'edit'),
  validateBody(obeInstrumentSchema),
  obeOfferingController.updateInstrument
);
router.delete(
  '/offerings/:id/instruments/:instrumentId',
  requirePermission('obe.offerings', 'edit'),
  obeOfferingController.deleteInstrument
);

// ── Marks ──
router.get(
  '/offerings/:id/instruments/:instrumentId/marks',
  requirePermission('obe.marks', 'view'),
  obeMarksController.getGrid
);
router.put(
  '/offerings/:id/instruments/:instrumentId/marks',
  requirePermission('obe.marks', 'edit'),
  validateBody(obeBulkMarksSchema),
  obeMarksController.bulkUpsert
);
router.post(
  '/offerings/:id/instruments/:instrumentId/marks/import',
  requirePermission('obe.marks', 'import'),
  validateBody(obeMarksImportSchema),
  obeMarksController.importCsv
);

// ── Attainment ──
router.post(
  '/offerings/:id/compute',
  requirePermission('obe.attainment', 'compute'),
  obeAttainmentController.compute
);
router.get(
  '/offerings/:id/attainment',
  requirePermission('obe.attainment', 'view'),
  obeAttainmentController.get
);
router.put(
  '/offerings/:id/corrective-actions',
  requirePermission('obe.attainment', 'edit'),
  validateBody(obeCoCorrectiveActionsSchema),
  obeAttainmentController.updateCorrectiveActions
);
router.post(
  '/offerings/:id/finalize',
  requirePermission('obe.offerings', 'finalize'),
  obeAttainmentController.finalize
);
router.post(
  '/offerings/:id/reopen',
  requirePermission('obe.offerings', 'finalize'),
  obeAttainmentController.reopen
);

// ── Surveys ──
// Self-scoped: any authenticated user sees the open surveys for their own
// student record — no staff permission required (transport /enrollments/my
// pattern). Must come before /surveys/:offeringId.
router.get('/surveys/my', obeSurveyController.findMine);
router.post(
  '/surveys/:offeringId/respond',
  requirePermission('obe.surveys', 'submit'),
  validateBody(obeSurveyResponseSchema),
  obeSurveyController.respond
);
router.post(
  '/offerings/:id/survey/open',
  requirePermission('obe.surveys', 'manage'),
  obeSurveyController.open
);
router.post(
  '/offerings/:id/survey/close',
  requirePermission('obe.surveys', 'manage'),
  obeSurveyController.close
);
router.get(
  '/offerings/:id/survey/results',
  requirePermission('obe.surveys', 'view'),
  obeSurveyController.results
);

// ── Reports ──
router.get(
  '/programs/:id/attainment',
  requirePermission('obe.reports', 'view'),
  obeReportController.programAttainment
);
router.get(
  '/programs/:id/attainment/export',
  requirePermission('obe.reports', 'export'),
  obeReportController.exportProgram
);
router.get(
  '/offerings/:id/report/export',
  requirePermission('obe.reports', 'export'),
  obeReportController.exportCourse
);

// ── Accreditation documents (NBA SAR / NAAC SSR / NIRF) ──
// `?format=pdf` on the first two renders the printable file; without it the
// same document comes back as JSON for the on-screen preview.
router.get(
  '/programs/:id/accreditation/nba',
  requirePermission('obe.reports', 'view'),
  obeReportController.nbaCriterion3
);
router.get(
  '/programs/:id/accreditation/naac',
  requirePermission('obe.reports', 'view'),
  obeReportController.naacKeyIndicator26
);
router.get(
  '/accreditation/nirf',
  requirePermission('obe.reports', 'view'),
  obeReportController.nirf
);

export default router;
