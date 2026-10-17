import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { requireBranch, requirePermission } from '../../middleware/rbac';
import { requireModule } from '../../middleware/moduleGating';
import { validateBody } from '../../middleware/validate';
import {
  createFeedbackTicketSchema,
  updateFeedbackTicketSchema,
  addFeedbackResponseSchema,
  assignFeedbackTicketSchema,
  updateFeedbackStatusSchema,
  submitSatisfactionSchema,
} from '@campus-verse/shared/schemas';
import { feedbackController } from './feedback.controller';

const router: ReturnType<typeof Router> = Router();

// Apply authentication and module gating
router.use(authenticate);
router.use(requireModule('feedback'));
router.use(requireBranch);

// ── Stats (must be before /:id) ──
router.get('/stats', requirePermission('feedback.tickets', 'view'), feedbackController.getStats);

// ── Tickets CRUD ──
router.get('/', requirePermission('feedback.tickets', 'view'), feedbackController.findAll);
router.post(
  '/',
  requirePermission('feedback.tickets', 'create'),
  validateBody(createFeedbackTicketSchema),
  feedbackController.create
);
router.get('/:id', requirePermission('feedback.tickets', 'view'), feedbackController.findById);
router.put(
  '/:id',
  requirePermission('feedback.tickets', 'edit'),
  validateBody(updateFeedbackTicketSchema),
  feedbackController.update
);
router.delete('/:id', requirePermission('feedback.tickets', 'delete'), feedbackController.delete);

// ── Assignment ──
router.put(
  '/:id/assign',
  requirePermission('feedback.tickets', 'assign'),
  validateBody(assignFeedbackTicketSchema),
  feedbackController.assign
);

// ── Status changes ──
router.put(
  '/:id/status',
  requirePermission('feedback.tickets', 'view'),
  validateBody(updateFeedbackStatusSchema),
  feedbackController.updateStatus
);
router.put(
  '/:id/escalate',
  requirePermission('feedback.tickets', 'escalate'),
  feedbackController.escalate
);

// ── Responses ──
router.post(
  '/:id/responses',
  requirePermission('feedback.tickets', 'view'),
  validateBody(addFeedbackResponseSchema),
  feedbackController.addResponse
);

// ── Satisfaction ──
router.put(
  '/:id/satisfaction',
  requirePermission('feedback.tickets', 'create'),
  validateBody(submitSatisfactionSchema),
  feedbackController.submitSatisfaction
);

export default router;
