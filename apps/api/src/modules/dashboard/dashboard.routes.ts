import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { requireBranch, requirePermission, requireAnyPermission } from '../../middleware/rbac';
import { dashboardController } from './dashboard.controller';
import { teacherDashboardController } from './teacherDashboard.controller';
import { studentDashboardController } from './studentDashboard.controller';

const router: ReturnType<typeof Router> = Router();

router.use(authenticate);

// ============ Filter Options ============
router.get(
  '/filters',
  requireAnyPermission([
    { module: 'dashboard.ownerView', action: 'view' },
    { module: 'dashboard.branchView', action: 'view' },
  ]),
  dashboardController.getFilterOptions
);

// ============ Alerts ============
router.get(
  '/alerts',
  requireAnyPermission([
    { module: 'dashboard.ownerView', action: 'view' },
    { module: 'dashboard.branchView', action: 'view' },
  ]),
  dashboardController.getAlerts
);

// ============ Student Dashboard ============
router.get('/student', requireBranch, studentDashboardController.getStudentDashboard);

// ============ Teacher Dashboard ============
router.get(
  '/teacher',
  requireBranch,
  requirePermission('teaching.myClasses', 'view'),
  teacherDashboardController.getTeacherDashboard
);

// ============ Owner Dashboard (Cross-branch) ============
router.get(
  '/owner/kpis',
  requirePermission('dashboard.ownerView', 'view'),
  dashboardController.getOwnerKPIs
);

router.get(
  '/owner/kpis/filtered',
  requirePermission('dashboard.ownerView', 'view'),
  dashboardController.getOwnerKPIsFiltered
);

router.get(
  '/owner/students',
  requirePermission('dashboard.ownerView', 'view'),
  dashboardController.getOwnerStudentMetrics
);

router.get(
  '/owner/finance',
  requirePermission('dashboard.ownerView', 'view'),
  dashboardController.getOwnerFinanceMetrics
);

router.get(
  '/owner/attendance',
  requirePermission('dashboard.ownerView', 'view'),
  dashboardController.getOwnerAttendanceMetrics
);

router.get(
  '/owner/staff',
  requirePermission('dashboard.ownerView', 'view'),
  dashboardController.getOwnerStaffMetrics
);

router.get(
  '/owner/admissions',
  requirePermission('dashboard.ownerView', 'view'),
  dashboardController.getOwnerAdmissionMetrics
);

// ============ Academic Batch Metrics ============
router.get(
  '/academic-batch/:academicBatchId',
  requireAnyPermission([
    { module: 'dashboard.ownerView', action: 'view' },
    { module: 'dashboard.branchView', action: 'view' },
  ]),
  dashboardController.getMetricsByAcademicBatch
);

// ============ Branch Dashboard ============
router.get(
  '/branch/kpis',
  requireBranch,
  requirePermission('dashboard.branchView', 'view'),
  dashboardController.getBranchKPIs
);

router.get(
  '/branch/today',
  requireBranch,
  requirePermission('dashboard.branchView', 'view'),
  dashboardController.getBranchTodaySummary
);

router.get(
  '/scope/breakdown',
  requireBranch,
  requirePermission('dashboard.branchView', 'view'),
  dashboardController.getScopeBreakdown
);

// ============ Reports ============
router.get('/reports/custom', requirePermission('dashboard.reports', 'view'), (_req, res) => {
  res.json({
    success: true,
    data: {
      hasData: false,
      message: 'No custom reports configured yet',
      reports: [],
      availableReportTypes: ['attendance', 'finance', 'students', 'staff'],
    },
  });
});

router.post('/reports/generate', requirePermission('dashboard.reports', 'create'), (_req, res) => {
  res.json({
    success: true,
    data: {
      hasData: false,
      message: 'Report generation requires report configuration',
      reportId: null,
    },
  });
});

router.get('/reports/scheduled', requirePermission('dashboard.reports', 'view'), (_req, res) => {
  res.json({
    success: true,
    data: {
      hasData: false,
      message: 'No scheduled reports configured',
      scheduledReports: [],
    },
  });
});

router.post('/reports/schedule', requirePermission('dashboard.reports', 'create'), (_req, res) => {
  res.json({
    success: true,
    data: {
      hasData: false,
      message: 'Report scheduling requires a valid report configuration',
      scheduleId: null,
    },
  });
});

// ============ Setup Checklist (admin-only) ============
router.get(
  '/setup-status',
  requireAnyPermission([
    { module: 'organization.settings', action: 'view' },
    { module: 'dashboard.ownerView', action: 'view' },
  ]),
  dashboardController.getSetupStatus
);

router.post(
  '/setup-status/dismiss',
  requirePermission('organization.settings', 'edit'),
  dashboardController.dismissSetupTask
);

// Audit logs moved to the dedicated /api/v1/audit module (real implementation).

export default router;
