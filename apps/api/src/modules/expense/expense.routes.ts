import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { requireBranch, requirePermission } from '../../middleware/rbac';
import { requireModule } from '../../middleware/moduleGating';
import { validateBody } from '../../middleware/validate';
import {
  createExpenseSchema,
  updateExpenseSchema,
  createBudgetSchema,
  updateBudgetSchema,
  createReimbursementSchema,
} from '@campus-verse/shared/schemas';
import { expenseController } from './expense.controller';
import { budgetController } from './budget.controller';
import { reimbursementController } from './reimbursement.controller';
import { expenseSettingsController } from './expenseSettings.controller';

const router: ReturnType<typeof Router> = Router();

// Apply authentication and module gating
router.use(authenticate);
router.use(requireModule('expense'));
router.use(requireBranch);

// ── Static expense routes (must come before /:id) ──
router.get('/stats', requirePermission('expense.requests', 'view'), expenseController.getStats);
router.get('/my', requirePermission('expense.requests', 'view'), expenseController.getMyExpenses);

// ── Budgets (must come before /:id) ──
router.get('/budgets', requirePermission('expense.budgets', 'view'), budgetController.findAll);
router.post(
  '/budgets',
  requirePermission('expense.budgets', 'create'),
  validateBody(createBudgetSchema),
  budgetController.create
);
router.get('/budgets/:id', requirePermission('expense.budgets', 'view'), budgetController.findById);
router.put(
  '/budgets/:id',
  requirePermission('expense.budgets', 'edit'),
  validateBody(updateBudgetSchema),
  budgetController.update
);
router.delete(
  '/budgets/:id',
  requirePermission('expense.budgets', 'delete'),
  budgetController.delete
);

// ── Reimbursements (must come before /:id) ──
router.get(
  '/reimbursements',
  requirePermission('expense.reimbursements', 'view'),
  reimbursementController.findAll
);
router.post(
  '/reimbursements',
  requirePermission('expense.reimbursements', 'create'),
  validateBody(createReimbursementSchema),
  reimbursementController.create
);
router.put(
  '/reimbursements/:id/approve',
  requirePermission('expense.reimbursements', 'process'),
  reimbursementController.approve
);
router.put(
  '/reimbursements/:id/process',
  requirePermission('expense.reimbursements', 'process'),
  reimbursementController.process
);

// ── Settings (must come before /:id) ──
router.get(
  '/settings',
  requirePermission('expense.settings', 'view'),
  expenseSettingsController.get
);
router.put(
  '/settings',
  requirePermission('expense.settings', 'edit'),
  expenseSettingsController.update
);

// ── Expenses CRUD ──
router.get('/', requirePermission('expense.requests', 'view'), expenseController.findAll);
router.post(
  '/',
  requirePermission('expense.requests', 'create'),
  validateBody(createExpenseSchema),
  expenseController.create
);
router.get('/:id', requirePermission('expense.requests', 'view'), expenseController.findById);
router.put(
  '/:id',
  requirePermission('expense.requests', 'edit'),
  validateBody(updateExpenseSchema),
  expenseController.update
);
router.delete('/:id', requirePermission('expense.requests', 'delete'), expenseController.delete);
router.put(
  '/:id/submit',
  requirePermission('expense.requests', 'create'),
  expenseController.submit
);
router.put(
  '/:id/approve',
  requirePermission('expense.approvals', 'approve'),
  expenseController.approve
);
router.put(
  '/:id/reject',
  requirePermission('expense.approvals', 'reject'),
  expenseController.reject
);
router.put(
  '/:id/mark-paid',
  requirePermission('expense.approvals', 'approve'),
  expenseController.markPaid
);

export default router;
