import { createStaffRouteSchema, createDepartmentRouteSchema } from '@campus-verse/shared/schemas';
import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { requireAnyPermission, requireBranch, requirePermission } from '../../middleware/rbac';
import { requireModule } from '../../middleware/moduleGating';
import { staffController } from './staff.controller';
import { leaveController } from './leave.controller';
import { departmentController } from './department.controller';
import { staffAttendanceController } from './staffAttendance.controller';
import { hrSettingsController } from './hrSettings.controller';
import { payrollController } from './payroll.controller';
import { payrollService } from './payroll.service';
import { success } from '../../utils/response';
import { ApiError } from '../../middleware/errorHandler';
import { promotionController } from './promotion.controller';
import { razorpayXPayoutController } from './razorpayXPayout.controller';
import { imageUpload, requireS3Configured } from '../upload/upload.middleware';
import { validateBody } from '../../middleware/validate';
import {
  createSalaryStructureSchema,
  updateSalaryStructureSchema,
  assignSalarySchema,
  reviseSalarySchema,
  addCustomDeductionSchema,
  processPayrollSchema,
  updateDisbursementSchema,
  bulkDisbursementSchema,
  markRunPaidSchema,
  payrollSettingsSchema,
  selfCheckSchema,
  createPromotionPolicySchema,
  updatePromotionPolicySchema,
  promoteStaffSchema,
  rejectPromotionSchema,
} from '@campus-verse/shared';

const router: ReturnType<typeof Router> = Router();

router.use(authenticate);
router.use(requireModule('hr'));
router.use(requireBranch);

// ============ Staff ============
router.get('/staff/stats', requirePermission('hr.staff', 'view'), staffController.getStats);

router.get(
  '/staff/pending-approvals',
  requirePermission('hr.staff', 'view'),
  staffController.getPendingApprovals
);

router.get('/staff', requirePermission('hr.staff', 'view'), staffController.findAll);

router.post(
  '/staff',
  requirePermission('hr.staff', 'create'),
  validateBody(createStaffRouteSchema),
  staffController.create
);

router.put(
  '/staff/:id/approve',
  requirePermission('hr.staff', 'edit'),
  staffController.approveStaff
);

router.put('/staff/:id/reject', requirePermission('hr.staff', 'edit'), staffController.rejectStaff);

// ============ Promotions (designation ladder + payroll revision) ============

router.get(
  '/promotion-policies',
  requirePermission('hr.settings', 'view'),
  promotionController.listPolicies
);
router.post(
  '/promotion-policies',
  requirePermission('hr.settings', 'edit'),
  validateBody(createPromotionPolicySchema),
  promotionController.createPolicy
);
router.put(
  '/promotion-policies/:id',
  requirePermission('hr.settings', 'edit'),
  validateBody(updatePromotionPolicySchema),
  promotionController.updatePolicy
);
router.delete(
  '/promotion-policies/:id',
  requirePermission('hr.settings', 'edit'),
  promotionController.deletePolicy
);

router.get(
  '/promotions',
  requirePermission('hr.promotions', 'view'),
  promotionController.listPromotions
);
router.post(
  '/staff/:id/promote',
  requirePermission('hr.promotions', 'create'),
  validateBody(promoteStaffSchema),
  promotionController.promote
);
router.post(
  '/promotions/:id/approve',
  requirePermission('hr.promotions', 'approve'),
  promotionController.approve
);
router.post(
  '/promotions/:id/reject',
  requirePermission('hr.promotions', 'reject'),
  validateBody(rejectPromotionSchema),
  promotionController.reject
);

router.get('/staff/:id', requirePermission('hr.staff', 'view'), staffController.findById);

router.put('/staff/:id', requirePermission('hr.staff', 'edit'), staffController.update);

router.delete('/staff/:id', requirePermission('hr.staff', 'delete'), staffController.delete);

router.post(
  '/staff/:id/photo',
  requirePermission('hr.staff', 'edit'),
  requireS3Configured,
  imageUpload.single('file'),
  staffController.uploadPhoto
);

router.put(
  '/staff/:id/status',
  requirePermission('hr.staff', 'edit'),
  staffController.updateStatus
);

router.get(
  '/staff/bulk-upload/template',
  requirePermission('hr.staff', 'view'),
  staffController.getBulkUploadTemplate
);

router.post(
  '/staff/bulk-upload/validate',
  requirePermission('hr.staff', 'create'),
  staffController.validateBulkUpload
);

router.post(
  '/staff/bulk-upload',
  requirePermission('hr.staff', 'create'),
  staffController.processBulkUpload
);

// ============ Staff Attendance ============
router.get(
  '/attendance',
  requirePermission('hr.attendance', 'view'),
  staffAttendanceController.findByDate
);

router.post(
  '/attendance',
  requirePermission('hr.attendance', 'create'),
  staffAttendanceController.markAttendance
);

router.get(
  '/attendance/my',
  requirePermission('hr.attendance', 'view'),
  staffAttendanceController.getMyAttendance
);

// Self check-in/out — self-service, no hr.attendance permission required
// (any staff member can punch in/out for themselves, like /payslips/my)
router.get('/attendance/self/today', staffAttendanceController.getSelfToday);

router.post(
  '/attendance/self/check-in',
  validateBody(selfCheckSchema),
  staffAttendanceController.selfCheckIn
);

router.post(
  '/attendance/self/check-out',
  validateBody(selfCheckSchema),
  staffAttendanceController.selfCheckOut
);

router.get(
  '/attendance/reports/daily',
  requirePermission('hr.attendance', 'view'),
  staffAttendanceController.getDailyReport
);

router.get(
  '/attendance/reports/monthly',
  requirePermission('hr.attendance', 'view'),
  staffAttendanceController.getMonthlyReport
);

// Export Routes
router.get(
  '/attendance/export/daily',
  requirePermission('hr.attendance', 'view'),
  staffAttendanceController.exportDailyReport
);

router.get(
  '/attendance/export/monthly',
  requirePermission('hr.attendance', 'view'),
  staffAttendanceController.exportMonthlyReport
);

router.post(
  '/attendance/lock',
  requirePermission('hr.attendance', 'edit'),
  staffAttendanceController.lockAttendance
);

router.post(
  '/attendance/unlock',
  requirePermission('hr.attendance', 'edit'),
  staffAttendanceController.unlockAttendance
);

// ============ Leaves ============
// Leave vocabulary is view / create / approve / reject. 'edit' is what older
// HOD role records carry for approving, so it's still honoured.
const canDecideLeave = requireAnyPermission([
  { module: 'hr.leaves', action: 'approve' },
  { module: 'hr.leaves', action: 'reject' },
  { module: 'hr.leaves', action: 'edit' },
]);
const ID = ':id([0-9a-fA-F]{24})';
router.get('/leaves/my', requirePermission('hr.leaves', 'view'), leaveController.getMyLeaves);

router.get('/leaves/balance', requirePermission('hr.leaves', 'view'), leaveController.getBalance);

router.get('/leaves/reports', canDecideLeave, leaveController.getReport);

router.get('/leaves', requirePermission('hr.leaves', 'view'), leaveController.findAll);

router.post('/leaves', requirePermission('hr.leaves', 'create'), leaveController.apply);

// Approval routes must be before /:id to avoid being caught by the param route
router.get('/leaves/pending-approvals', canDecideLeave, leaveController.getPendingApprovals);

router.get('/leaves/approval-stats', canDecideLeave, leaveController.getApprovalStats);

router.get(`/leaves/${ID}`, requirePermission('hr.leaves', 'view'), leaveController.findById);

router.put(
  `/leaves/${ID}/approve`,
  requireAnyPermission([
    { module: 'hr.leaves', action: 'approve' },
    { module: 'hr.leaves', action: 'edit' },
  ]),
  leaveController.approve
);

router.put(
  `/leaves/${ID}/reject`,
  requireAnyPermission([
    { module: 'hr.leaves', action: 'reject' },
    { module: 'hr.leaves', action: 'edit' },
  ]),
  leaveController.reject
);

// Owners cancel their own leave; managers anyone's in scope — checked in the controller.
router.delete(`/leaves/${ID}`, requirePermission('hr.leaves', 'view'), leaveController.cancel);

// ============ Departments ============
router.get(
  '/departments',
  requirePermission('hr.staff', 'view'),
  departmentController.findAllDepartments
);

router.post(
  '/departments',
  requirePermission('hr.staff', 'create'),
  validateBody(createDepartmentRouteSchema),
  departmentController.createDepartment
);

router.get(
  '/departments/:id',
  requirePermission('hr.staff', 'view'),
  departmentController.findDepartmentById
);

router.put(
  '/departments/:id',
  requirePermission('hr.staff', 'edit'),
  departmentController.updateDepartment
);

router.delete(
  '/departments/:id',
  requirePermission('hr.staff', 'delete'),
  departmentController.deleteDepartment
);

// ============ Designations ============
router.get(
  '/designations',
  requirePermission('hr.staff', 'view'),
  departmentController.findAllDesignations
);

router.post(
  '/designations',
  requirePermission('hr.staff', 'create'),
  departmentController.createDesignation
);

router.get(
  '/designations/:id',
  requirePermission('hr.staff', 'view'),
  departmentController.findDesignationById
);

router.put(
  '/designations/:id',
  requirePermission('hr.staff', 'edit'),
  departmentController.updateDesignation
);

router.delete(
  '/designations/:id',
  requirePermission('hr.staff', 'delete'),
  departmentController.deleteDesignation
);

// ============ Workload ============
router.get('/workload', requirePermission('hr.workload', 'view'), staffController.getWorkload);

router.post(
  '/workload',
  requirePermission('hr.workload', 'create'),
  staffController.assignWorkload
);

router.put(
  '/workload/:id',
  requirePermission('hr.workload', 'edit'),
  staffController.updateWorkload
);

// ============ Resignations ============
router.get('/resignations', requirePermission('hr.staff', 'view'), staffController.getResignations);

router.post(
  '/resignations',
  requirePermission('hr.staff', 'create'),
  staffController.submitResignation
);

router.get(
  '/resignations/my',
  requirePermission('hr.staff', 'view'),
  staffController.getMyResignation
);

router.put(
  '/resignations/:id/approve',
  requirePermission('hr.staff', 'edit'),
  staffController.approveResignation
);

router.put(
  '/resignations/:id/reject',
  requirePermission('hr.staff', 'edit'),
  staffController.rejectResignation
);

router.delete(
  '/resignations/:id/withdraw',
  requirePermission('hr.staff', 'view'),
  staffController.withdrawResignation
);

// ============ Payroll - Salary Structures ============
router.get(
  '/salary-structures',
  requirePermission('hr.payroll', 'view'),
  payrollController.getSalaryStructures
);
router.post(
  '/salary-structures',
  requirePermission('hr.payroll', 'create'),
  validateBody(createSalaryStructureSchema),
  payrollController.createSalaryStructure
);
router.get(
  '/salary-structures/suggest/:staffId',
  requirePermission('hr.payroll', 'view'),
  payrollController.suggestSalaryStructures
);
router.get(
  '/salary-structures/:id',
  requirePermission('hr.payroll', 'view'),
  payrollController.getSalaryStructureById
);
router.put(
  '/salary-structures/:id',
  requirePermission('hr.payroll', 'edit'),
  validateBody(updateSalaryStructureSchema),
  payrollController.updateSalaryStructure
);
router.delete(
  '/salary-structures/:id',
  requirePermission('hr.payroll', 'edit'),
  payrollController.deleteSalaryStructure
);

// ============ Payroll - Salary Assignments ============
router.get(
  '/salary-assignments',
  requirePermission('hr.payroll', 'view'),
  payrollController.getSalaryAssignments
);
router.get(
  '/salary-assignments/staff/:staffId',
  requirePermission('hr.payroll', 'view'),
  payrollController.getStaffSalaryAssignment
);
router.post(
  '/salary-assignments',
  requirePermission('hr.payroll', 'create'),
  validateBody(assignSalarySchema),
  payrollController.assignSalary
);
router.put(
  '/salary-assignments/:id',
  requirePermission('hr.payroll', 'edit'),
  validateBody(reviseSalarySchema),
  payrollController.reviseSalary
);
router.post(
  '/salary-assignments/:id/custom-deductions',
  requirePermission('hr.payroll', 'edit'),
  validateBody(addCustomDeductionSchema),
  payrollController.addCustomDeduction
);
router.put(
  '/salary-assignments/:id/custom-deductions/:code',
  requirePermission('hr.payroll', 'edit'),
  payrollController.updateCustomDeduction
);

// ============ Payroll - Payroll Runs ============
router.get(
  '/payroll-runs',
  requirePermission('hr.payroll', 'view'),
  payrollController.getPayrollRuns
);
router.post(
  '/payroll-runs',
  requirePermission('hr.payroll', 'create'),
  validateBody(processPayrollSchema),
  payrollController.processPayroll
);
router.get(
  '/payroll-runs/:id',
  requirePermission('hr.payroll', 'view'),
  payrollController.getPayrollRunById
);
router.put(
  '/payroll-runs/:id/finalize',
  requirePermission('hr.payroll', 'finalize'),
  payrollController.finalizePayroll
);
router.put(
  '/payroll-runs/:id/cancel',
  requirePermission('hr.payroll', 'finalize'),
  payrollController.cancelPayroll
);

// ============ Payroll - Payslips ============
router.get('/payslips/my', payrollController.getMyPayslips);
router.get('/payslips', requirePermission('hr.payslips', 'view'), payrollController.getPayslips);
router.get('/payslips/:id', payrollController.getPayslipById);
router.put(
  '/payslips/:id/disbursement',
  requirePermission('hr.payroll', 'edit'),
  validateBody(updateDisbursementSchema),
  payrollController.updateDisbursement
);
// Payroll rules in plain words, a payslip preview for any salary, and the
// CampusPay sandbox payout (simulated — no provider is called)
router.get('/payroll/rules', requirePermission('hr.payroll', 'view'), async (req, res, next) => {
  try {
    success(res, await payrollService.getRules(req.tenantId!, req.branchId!));
  } catch (e) {
    next(e);
  }
});
router.post('/payroll/preview', requirePermission('hr.payroll', 'view'), async (req, res, next) => {
  try {
    const earnings = Array.isArray(req.body?.earnings) ? req.body.earnings : [];
    if (!earnings.length) throw new ApiError('VALIDATION_ERROR', 'Add at least one earning', 400);
    success(res, await payrollService.preview(req.tenantId!, req.branchId!, req.body));
  } catch (e) {
    next(e);
  }
});
router.post('/payroll-runs/:id/simulate-payout', requirePermission('hr.payroll', 'edit'), async (req, res, next) => {
  try {
    success(res, await payrollService.simulatePayout(req.tenantId!, req.branchId!, req.params.id as string, req.user!.userId));
  } catch (e) {
    next(e);
  }
});

// A finalized run paid from the campus's own bank: record it in one step
router.put(
  '/payroll-runs/:id/mark-paid',
  requirePermission('hr.payroll', 'edit'),
  validateBody(markRunPaidSchema),
  payrollController.markRunPaid
);

router.put(
  '/payslips/bulk-disbursement',
  requirePermission('hr.payroll', 'edit'),
  validateBody(bulkDisbursementSchema),
  payrollController.bulkUpdateDisbursement
);

// ============ Payroll Settings ============
router.get(
  '/settings/payroll',
  requirePermission('hr.settings', 'view'),
  payrollController.getPayrollSettings
);
router.put(
  '/settings/payroll',
  requirePermission('hr.settings', 'edit'),
  validateBody(payrollSettingsSchema),
  payrollController.updatePayrollSettings
);

// ============ RazorpayX Salary Payouts ============
// Per-branch integration. `hr.payroll:pay` is a distinct permission from
// `edit` so schools can grant "manage payroll" without granting "actually
// move money".
router.get(
  '/settings/razorpay-x',
  requirePermission('hr.settings', 'view'),
  razorpayXPayoutController.getSettings
);
router.post(
  '/settings/razorpay-x/connect',
  requirePermission('hr.settings', 'edit'),
  razorpayXPayoutController.connect
);
router.post(
  '/settings/razorpay-x/verify',
  requirePermission('hr.settings', 'edit'),
  razorpayXPayoutController.verify
);
router.delete(
  '/settings/razorpay-x',
  requirePermission('hr.settings', 'edit'),
  razorpayXPayoutController.disconnect
);
router.get(
  '/settings/razorpay-x/balance',
  requirePermission('hr.settings', 'view'),
  razorpayXPayoutController.getBalance
);

router.post(
  '/staff/:id/razorpay-x/sync',
  requirePermission('hr.staff', 'edit'),
  razorpayXPayoutController.syncStaff
);

// Where a run's money goes: by pay component and by department
router.get(
  '/payroll-runs/:id/breakdown',
  requirePermission('hr.payroll', 'view'),
  payrollController.getRunBreakdown
);

router.get(
  '/payroll-runs/:id/pay-summary',
  requirePermission('hr.payroll', 'view'),
  razorpayXPayoutController.getRunPaySummary
);
router.post(
  '/payroll-runs/:id/pay',
  requirePermission('hr.payroll', 'pay'),
  razorpayXPayoutController.payRun
);
router.post(
  '/payslips/:id/pay',
  requirePermission('hr.payroll', 'pay'),
  razorpayXPayoutController.payPayslip
);
router.post(
  '/payslips/:id/payout/refresh',
  requirePermission('hr.payroll', 'pay'),
  razorpayXPayoutController.refreshPayout
);

// ============ Settings ============
router.get('/settings', requirePermission('hr.settings', 'view'), hrSettingsController.getSettings);
router.put(
  '/settings',
  requirePermission('hr.settings', 'edit'),
  hrSettingsController.updateSettings
);

// Leave Types in Settings
router.post(
  '/settings/leave-types',
  requirePermission('hr.settings', 'edit'),
  hrSettingsController.addLeaveType
);
router.put(
  '/settings/leave-types/:code',
  requirePermission('hr.settings', 'edit'),
  hrSettingsController.updateLeaveType
);
router.delete(
  '/settings/leave-types/:code',
  requirePermission('hr.settings', 'edit'),
  hrSettingsController.deleteLeaveType
);

// Shifts in Settings
router.post(
  '/settings/shifts',
  requirePermission('hr.settings', 'edit'),
  hrSettingsController.addShift
);
router.put(
  '/settings/shifts/:code',
  requirePermission('hr.settings', 'edit'),
  hrSettingsController.updateShift
);
router.delete(
  '/settings/shifts/:code',
  requirePermission('hr.settings', 'edit'),
  hrSettingsController.deleteShift
);

// Weekly Offs
router.put(
  '/settings/weekly-offs',
  requirePermission('hr.settings', 'edit'),
  hrSettingsController.updateWeeklyOffs
);

// Leave Encashment
router.put(
  '/settings/leave-encashment',
  requirePermission('hr.settings', 'edit'),
  hrSettingsController.updateLeaveEncashment
);

export default router;
