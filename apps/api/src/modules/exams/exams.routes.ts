import { Router } from 'express';
import { studentParamGuard } from '../teaching/scope';
import { authenticate } from '../../middleware/auth';
import { requireBranch, requirePermission } from '../../middleware/rbac';
import { requireModule } from '../../middleware/moduleGating';
import { validateBody } from '../../middleware/validate';
import {
  bulkResultsSchema,
  bulkScheduleSchema,
  createExamSchema,
  createResultSchema,
  createScheduleSchema,
  examSettingsSchema,
  examStatusSchema,
  publishResultsSchema,
  updateExamSchema,
  updateScheduleSchema,
} from '@campus-verse/shared/schemas';

import { examSettingsController } from './settings.controller';
import { examController } from './exam.controller';
import { scheduleController } from './schedule.controller';
import { marksController } from './marks.controller';
import { reportCardController } from './reportCard.controller';
import { hallTicketController } from './hallTicket.controller';
import { promotionController } from './promotion.controller';

const router: ReturnType<typeof Router> = Router();

// All routes require authentication, the 'exams' module to be enabled for the
// tenant, and a branch context (X-Branch-Id header).
router.use(authenticate);
router.use(requireModule('exams'));
router.use(requireBranch);

// Every :studentId here is a student: callers only reach students in their scope.
router.param('studentId', studentParamGuard);

/* ────────────────────── Settings ────────────────────── */

router.get('/settings', requirePermission('exams.config', 'view'), examSettingsController.get);
router.put(
  '/settings',
  requirePermission('exams.config', 'edit'),
  validateBody(examSettingsSchema.partial()),
  examSettingsController.update
);

/* ────────────────────── Exam CRUD ────────────────────── */

router.get('/', requirePermission('exams.exams', 'view'), examController.list);

router.post(
  '/',
  requirePermission('exams.exams', 'create'),
  validateBody(createExamSchema),
  examController.create
);

router.get(
  '/:id([0-9a-fA-F]{24})',
  requirePermission('exams.exams', 'view'),
  examController.findById
);

router.put(
  '/:id',
  requirePermission('exams.exams', 'edit'),
  validateBody(updateExamSchema),
  examController.update
);

router.delete('/:id', requirePermission('exams.exams', 'delete'), examController.delete);

router.put(
  '/:id/status',
  requirePermission('exams.exams', 'edit'),
  validateBody(examStatusSchema),
  examController.setStatus
);

/* ────────────────────── Schedules ────────────────────── */

router.get(
  '/schedules/list',
  requirePermission('exams.schedules', 'view'),
  scheduleController.list
);

router.post(
  '/schedules',
  requirePermission('exams.schedules', 'create'),
  validateBody(createScheduleSchema),
  scheduleController.create
);

router.post(
  '/schedules/bulk',
  requirePermission('exams.schedules', 'create'),
  validateBody(bulkScheduleSchema),
  scheduleController.bulkCreate
);

router.put(
  '/schedules/:id',
  requirePermission('exams.schedules', 'edit'),
  validateBody(updateScheduleSchema),
  scheduleController.update
);

router.delete(
  '/schedules/:id',
  requirePermission('exams.schedules', 'delete'),
  scheduleController.delete
);

/* ────────────────────── Marks ────────────────────── */

router.get(
  '/marks/paper-section',
  requirePermission('exams.marks', 'view'),
  marksController.listForPaperSection
);

router.post(
  '/marks',
  requirePermission('exams.marks', 'create'),
  validateBody(createResultSchema),
  marksController.upsert
);

router.post(
  '/marks/bulk',
  requirePermission('exams.marks', 'create'),
  validateBody(bulkResultsSchema),
  marksController.bulkUpsert
);

/* ────────────────────── Results ────────────────────── */

router.get(
  '/results/section-report',
  requirePermission('exams.results', 'view'),
  marksController.sectionReport
);

router.get(
  '/results/student/:studentId',
  requirePermission('exams.results', 'view'),
  marksController.listForStudent
);

router.post(
  '/results/publish',
  requirePermission('exams.results', 'publish'),
  validateBody(publishResultsSchema),
  marksController.publishResults
);

/* ────────────────────── Report Cards ────────────────────── */

router.get(
  '/report-cards',
  requirePermission('exams.reportCards', 'view'),
  reportCardController.list
);

router.post(
  '/report-cards/generate',
  requirePermission('exams.reportCards', 'generate'),
  reportCardController.generate
);

router.post(
  '/report-cards/bulk-publish',
  requirePermission('exams.reportCards', 'publish'),
  reportCardController.bulkPublish
);

router.get(
  '/report-cards/student/:studentId',
  requirePermission('exams.reportCards', 'view'),
  reportCardController.listForStudent
);

// Consolidated transcript (credits, SGPA per semester, CGPA, backlogs).
router.get(
  '/transcripts/student/:studentId',
  requirePermission('exams.reportCards', 'view'),
  reportCardController.transcript
);

router.get(
  '/report-cards/:id',
  requirePermission('exams.reportCards', 'view'),
  reportCardController.getById
);

router.post(
  '/report-cards/:id/publish',
  requirePermission('exams.reportCards', 'publish'),
  reportCardController.publish
);

router.post(
  '/report-cards/:id/unpublish',
  requirePermission('exams.reportCards', 'publish'),
  reportCardController.unpublish
);

/* ────────────────────── Hall Tickets ────────────────────── */

router.get(
  '/hall-tickets',
  requirePermission('exams.hallTickets', 'view'),
  hallTicketController.list
);

router.post(
  '/hall-tickets/generate',
  requirePermission('exams.hallTickets', 'generate'),
  hallTicketController.generate
);

router.get(
  '/hall-tickets/student/:studentId',
  requirePermission('exams.hallTickets', 'view'),
  hallTicketController.listForStudent
);

router.get(
  '/hall-tickets/:id',
  requirePermission('exams.hallTickets', 'view'),
  hallTicketController.getById
);

router.patch(
  '/hall-tickets/:id/seat',
  requirePermission('exams.hallTickets', 'generate'),
  hallTicketController.updateSeat
);

/* ────────────────────── Promotion ────────────────────── */

router.get(
  '/promotions/runs',
  requirePermission('exams.promotion', 'view'),
  promotionController.list
);

router.post(
  '/promotions/runs',
  requirePermission('exams.promotion', 'view'),
  promotionController.createRun
);

router.get(
  '/promotions/runs/:id',
  requirePermission('exams.promotion', 'view'),
  promotionController.getById
);

router.patch(
  '/promotions/runs/:id/decisions/:studentId',
  requirePermission('exams.promotion', 'view'),
  promotionController.overrideDecision
);

router.post(
  '/promotions/runs/:id/commit',
  requirePermission('exams.promotion', 'commit'),
  promotionController.commit
);

router.delete(
  '/promotions/runs/:id',
  requirePermission('exams.promotion', 'view'),
  promotionController.delete
);

export default router;
