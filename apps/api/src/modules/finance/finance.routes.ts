import { createFeeStructureSchema } from '@campus-verse/shared/schemas';
import { Router } from 'express';
import { studentParamGuard } from '../teaching/scope';
import { authenticate } from '../../middleware/auth';
import { requireBranch, requirePermission } from '../../middleware/rbac';
import { requireModule } from '../../middleware/moduleGating';
import { feeStructureController } from './feeStructure.controller';
import { feeAssignmentController } from './feeAssignment.controller';
import { feeTransactionController } from './feeTransaction.controller';
import { feeCounterController } from './feeCounter.controller';
import { concessionController } from './concession.controller';
import { scholarshipController } from './scholarship.controller';
import { validateBody } from '../../middleware/validate';
import {
  createScholarshipSchema,
  rejectScholarshipSchema,
  scholarshipDisbursementSchema,
} from '@campus-verse/shared/schemas';
import { financeReportsController } from './reports.controller';
import { feeImportController } from './feeImport.controller';
import { financeSettingsController } from './financeSettings.controller';
import { razorpayRouteController } from './razorpayRoute.controller';
import { approvalRequestController } from './approvalRequest.controller';
import { walletController } from './wallet.controller';

const router: ReturnType<typeof Router> = Router();

router.use(authenticate);
router.use(requireModule('finance'));
router.use(requireBranch);

// Every :studentId here is a student: callers only reach students in their scope.
router.param('studentId', studentParamGuard);

// ============ Fee Counter ============
router.get(
  '/fee-counter/students',
  requirePermission('finance.feeCounter', 'view'),
  feeCounterController.searchStudents
);
router.get(
  '/fee-counter/stats',
  requirePermission('finance.feeCounter', 'view'),
  feeCounterController.getStats
);
router.get(
  '/fee-counter/dues',
  requirePermission('finance.feeCounter', 'view'),
  feeCounterController.getDues
);
router.post(
  '/fee-counter/collect',
  requirePermission('finance.feeCounter', 'collect'),
  feeCounterController.collectFee
);
router.post(
  '/fee-counter/sync',
  requirePermission('finance.feeCounter', 'collect'),
  feeCounterController.syncAssignments
);

// ============ Fee Structures ============
router.get(
  '/structures',
  requirePermission('finance.feeStructures', 'view'),
  feeStructureController.findAll
);
router.get(
  '/structures/for-section/:sectionId',
  requirePermission('finance.feeStructures', 'view'),
  feeStructureController.findForSection
);
router.get(
  '/structures/:id',
  requirePermission('finance.feeStructures', 'view'),
  feeStructureController.findById
);
router.get(
  '/structures/:id/assignment-count',
  requirePermission('finance.feeStructures', 'view'),
  feeStructureController.getAssignmentCount
);
router.post(
  '/structures',
  requirePermission('finance.feeStructures', 'create'),
  validateBody(createFeeStructureSchema),
  feeStructureController.create
);
router.put(
  '/structures/:id',
  requirePermission('finance.feeStructures', 'edit'),
  feeStructureController.update
);
router.delete(
  '/structures/:id',
  requirePermission('finance.feeStructures', 'delete'),
  feeStructureController.delete
);
router.post(
  '/structures/:id/clone',
  requirePermission('finance.feeStructures', 'create'),
  feeStructureController.clone
);

// ============ Fee Assignments ============
// Using feeStructures permission since assignments are part of fee structure management
router.get(
  '/assignments',
  requirePermission('finance.feeStructures', 'view'),
  feeAssignmentController.findAll
);
router.get(
  '/assignments/unassigned',
  requirePermission('finance.feeStructures', 'view'),
  financeReportsController.getUnassignedStudents
);
router.get(
  '/assignments/student/:studentId',
  requirePermission('finance.feeStructures', 'view'),
  feeAssignmentController.getByStudent
);
router.get(
  '/assignments/:id',
  requirePermission('finance.feeStructures', 'view'),
  feeAssignmentController.findById
);
router.post(
  '/assignments',
  requirePermission('finance.feeStructures', 'create'),
  feeAssignmentController.create
);
router.post(
  '/assignments/bulk',
  requirePermission('finance.feeStructures', 'create'),
  feeAssignmentController.bulkCreate
);
router.put(
  '/assignments/:id',
  requirePermission('finance.feeStructures', 'edit'),
  feeAssignmentController.update
);
router.post(
  '/assignments/calculate-fines',
  requirePermission('finance.feeStructures', 'edit'),
  feeAssignmentController.calculateFines
);

// ============ Fee Assignment Bulk Upload ============
router.post(
  '/assignments/upload',
  requirePermission('finance.feeStructures', 'create'),
  feeImportController.uploadFeeAssignments
);
router.post(
  '/assignments/upload/validate',
  requirePermission('finance.feeStructures', 'create'),
  feeImportController.validateFeeAssignments
);
router.get(
  '/assignments/upload/template',
  requirePermission('finance.feeStructures', 'view'),
  feeImportController.getFeeUploadTemplate
);

// ============ Fee Transactions ============
router.get(
  '/transactions',
  requirePermission('finance.transactions', 'view'),
  feeTransactionController.findAll
);
router.get(
  '/transactions/day-sheet',
  requirePermission('finance.transactions', 'view'),
  feeTransactionController.getDaySheet
);
router.get(
  '/transactions/summary',
  requirePermission('finance.transactions', 'view'),
  feeTransactionController.getCollectionSummary
);
router.get(
  '/transactions/:id',
  requirePermission('finance.transactions', 'view'),
  feeTransactionController.findById
);
router.get(
  '/transactions/:id/receipt',
  requirePermission('finance.transactions', 'view'),
  feeTransactionController.getReceipt
);
router.post(
  '/transactions/collect',
  requirePermission('finance.transactions', 'create'),
  feeTransactionController.collect
);
router.post(
  '/transactions/online-payment/initiate',
  requirePermission('finance.transactions', 'create'),
  feeTransactionController.initiateOnlinePayment
);
router.post(
  '/transactions/online-payment/verify',
  requirePermission('finance.transactions', 'create'),
  feeTransactionController.verifyOnlinePayment
);
router.post(
  '/transactions/:id/cancel',
  requirePermission('finance.transactions', 'edit'),
  feeTransactionController.cancel
);
router.post(
  '/transactions/:id/refund',
  requirePermission('finance.transactions', 'edit'),
  feeTransactionController.refund
);

// ============ Concessions ============
router.get(
  '/concessions',
  requirePermission('finance.concessions', 'view'),
  concessionController.findAll
);
router.get(
  '/concessions/stats',
  requirePermission('finance.concessions', 'view'),
  concessionController.getStats
);
router.get(
  '/concessions/:id',
  requirePermission('finance.concessions', 'view'),
  concessionController.findById
);
router.post(
  '/concessions',
  requirePermission('finance.concessions', 'create'),
  concessionController.create
);
// NOTE: these previously required the undeclared 'edit' action, which no role
// map grants — approve/reject now use the declared action names.
router.post(
  '/concessions/:id/approve',
  requirePermission('finance.concessions', 'approve'),
  concessionController.approve
);
router.post(
  '/concessions/:id/reject',
  requirePermission('finance.concessions', 'reject'),
  concessionController.reject
);

// ============ Scholarships (receivables — govt fee reimbursement etc.) ============
router.get(
  '/scholarships',
  requirePermission('finance.scholarships', 'view'),
  scholarshipController.findAll
);
router.get(
  '/scholarships/stats',
  requirePermission('finance.scholarships', 'view'),
  scholarshipController.getStats
);
router.get(
  '/scholarships/:id',
  requirePermission('finance.scholarships', 'view'),
  scholarshipController.findById
);
router.post(
  '/scholarships',
  requirePermission('finance.scholarships', 'create'),
  validateBody(createScholarshipSchema),
  scholarshipController.create
);
router.post(
  '/scholarships/:id/approve',
  requirePermission('finance.scholarships', 'approve'),
  scholarshipController.approve
);
router.post(
  '/scholarships/:id/reject',
  requirePermission('finance.scholarships', 'reject'),
  validateBody(rejectScholarshipSchema),
  scholarshipController.reject
);
router.post(
  '/scholarships/:id/disbursements',
  requirePermission('finance.scholarships', 'edit'),
  validateBody(scholarshipDisbursementSchema),
  scholarshipController.recordDisbursement
);
router.delete(
  '/scholarships/:id',
  requirePermission('finance.scholarships', 'edit'),
  scholarshipController.delete
);

// ============ Concession Bulk Upload ============
router.post(
  '/concessions/upload',
  requirePermission('finance.concessions', 'create'),
  feeImportController.uploadConcessions
);
router.post(
  '/concessions/upload/validate',
  requirePermission('finance.concessions', 'create'),
  feeImportController.validateConcessions
);
router.get(
  '/concessions/upload/template',
  requirePermission('finance.concessions', 'view'),
  feeImportController.getConcessionUploadTemplate
);

// ============ Reports - Due Reports ============
router.get(
  '/reports/dues/summary',
  requirePermission('finance.reports', 'view'),
  financeReportsController.getDuesSummary
);

router.get(
  '/reports/dues/class-wise',
  requirePermission('finance.reports', 'view'),
  financeReportsController.getClassWiseDues
);

router.get(
  '/reports/dues/branch-wise',
  requirePermission('finance.reports', 'view'),
  financeReportsController.getBranchWiseDues
);

router.get(
  '/reports/dues/student-wise',
  requirePermission('finance.reports', 'view'),
  financeReportsController.getStudentWiseDues
);

router.get(
  '/reports/dues/siblings',
  requirePermission('finance.reports', 'view'),
  financeReportsController.getSiblingDues
);

router.get(
  '/reports/dues/installment-wise',
  requirePermission('finance.reports', 'view'),
  financeReportsController.getInstallmentWiseDues
);

// ============ Send Due Reminder ============
router.post(
  '/dues/send-reminder',
  requirePermission('finance.dues', 'view'),
  financeReportsController.sendDueReminder
);

// ============ Reports - Collection Reports ============
router.get(
  '/reports/collections/by-fee-type',
  requirePermission('finance.reports', 'view'),
  financeReportsController.getFeeTypeReport
);

router.get(
  '/reports/student/:studentId/statement',
  requirePermission('finance.reports', 'view'),
  financeReportsController.getStudentStatement
);

router.get(
  '/reports/transactions/by-fee-type',
  requirePermission('finance.reports', 'view'),
  financeReportsController.getFeeTypeWiseTransactions
);

router.get(
  '/reports/concessions/class-wise',
  requirePermission('finance.reports', 'view'),
  financeReportsController.getClassWiseConcessionReport
);

router.get(
  '/reports/concessions/student-wise',
  requirePermission('finance.reports', 'view'),
  financeReportsController.getStudentWiseConcessionReport
);

// ============ Wallets ============
router.get('/wallets', requirePermission('finance.wallets', 'view'), walletController.findAll);
router.get(
  '/wallets/stats',
  requirePermission('finance.wallets', 'view'),
  walletController.getStats
);
router.get(
  '/wallets/student/:studentId',
  requirePermission('finance.wallets', 'view'),
  walletController.findByStudent
);
router.get('/wallets/:id', requirePermission('finance.wallets', 'view'), walletController.findById);
router.get(
  '/wallets/:id/transactions',
  requirePermission('finance.wallets', 'view'),
  walletController.getTransactions
);
router.post('/wallets', requirePermission('finance.wallets', 'create'), walletController.create);
router.post(
  '/wallets/get-or-create',
  requirePermission('finance.wallets', 'create'),
  walletController.getOrCreate
);
router.post(
  '/wallets/:id/top-up',
  requirePermission('finance.wallets', 'edit'),
  walletController.topUp
);
router.post(
  '/wallets/:id/debit',
  requirePermission('finance.wallets', 'edit'),
  walletController.debit
);
router.patch(
  '/wallets/:id/status',
  requirePermission('finance.wallets', 'edit'),
  walletController.toggleStatus
);

// ============ Approval Requests ============
router.get(
  '/approval-requests',
  requirePermission('finance.approvals', 'view'),
  approvalRequestController.findAll
);
router.get(
  '/approval-requests/stats',
  requirePermission('finance.approvals', 'view'),
  approvalRequestController.getStats
);
router.get(
  '/approval-requests/:id',
  requirePermission('finance.approvals', 'view'),
  approvalRequestController.findById
);
router.post(
  '/approval-requests',
  requirePermission('finance.transactions', 'edit'),
  approvalRequestController.create
);
router.post(
  '/approval-requests/:id/approve',
  requirePermission('finance.approvals', 'edit'),
  approvalRequestController.approve
);
router.post(
  '/approval-requests/:id/reject',
  requirePermission('finance.approvals', 'edit'),
  approvalRequestController.reject
);

// ============ Finance Settings ============
router.get(
  '/settings',
  requirePermission('finance.settings', 'view'),
  financeSettingsController.getSettings
);
router.put(
  '/settings',
  requirePermission('finance.settings', 'edit'),
  financeSettingsController.updateSettings
);

// Bank Accounts
router.post(
  '/settings/bank-accounts',
  requirePermission('finance.settings', 'edit'),
  financeSettingsController.addBankAccount
);
router.put(
  '/settings/bank-accounts/:accountId',
  requirePermission('finance.settings', 'edit'),
  financeSettingsController.updateBankAccount
);
router.delete(
  '/settings/bank-accounts/:accountId',
  requirePermission('finance.settings', 'edit'),
  financeSettingsController.deleteBankAccount
);

// Payment Methods
router.put(
  '/settings/payment-methods/:code',
  requirePermission('finance.settings', 'edit'),
  financeSettingsController.updatePaymentMethod
);

// Wallet Categories
router.post(
  '/settings/wallet-categories',
  requirePermission('finance.settings', 'edit'),
  financeSettingsController.addWalletCategory
);

// Mandatory Fields
router.put(
  '/settings/mandatory-fields/:methodCode',
  requirePermission('finance.settings', 'edit'),
  financeSettingsController.updateMandatoryFields
);

// Application Fee Settings
router.put(
  '/settings/application-fee',
  requirePermission('finance.settings', 'edit'),
  financeSettingsController.updateApplicationFeeSettings
);

// Wallet Sequence Settings
router.put(
  '/settings/wallet-sequence',
  requirePermission('finance.settings', 'edit'),
  financeSettingsController.updateWalletSequenceSettings
);

// ============ Razorpay Route (per-branch linked account) ============
router.get(
  '/settings/razorpay-route',
  requirePermission('finance.settings', 'view'),
  razorpayRouteController.get
);
router.post(
  '/settings/razorpay-route/onboard',
  requirePermission('finance.settings', 'edit'),
  razorpayRouteController.onboard
);
router.post(
  '/settings/razorpay-route/refresh',
  requirePermission('finance.settings', 'edit'),
  razorpayRouteController.refresh
);
router.delete(
  '/settings/razorpay-route',
  requirePermission('finance.settings', 'edit'),
  razorpayRouteController.disconnect
);

// ============ Total Paid and Due Report ============
router.get(
  '/reports/total-paid-due',
  requirePermission('finance.reports', 'view'),
  financeReportsController.getTotalPaidAndDueReport
);

export default router;
