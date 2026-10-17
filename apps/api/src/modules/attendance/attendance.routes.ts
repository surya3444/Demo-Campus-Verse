import { Router } from 'express';
import { studentParamGuard } from '../teaching/scope';
import { authenticate } from '../../middleware/auth';
import { requireBranch, requirePermission } from '../../middleware/rbac';
import { requireModule } from '../../middleware/moduleGating';
import { validateBody } from '../../middleware/validate';
import { studentAttendanceController } from './studentAttendance.controller';
import { holidayController } from './holiday.controller';
import { attendanceSettingsController } from './attendanceSettings.controller';
import {
  createHolidaySchema,
  updateHolidaySchema,
  markAttendanceSchema,
} from '@campus-verse/shared';

const router: ReturnType<typeof Router> = Router();

router.use(authenticate);
router.use(requireModule('attendance'));
router.use(requireBranch);

// Every :studentId here is a student: callers only reach students in their scope.
router.param('studentId', studentParamGuard);

// ============ Student Attendance ============
router.get(
  '/students',
  requirePermission('attendance.view', 'view'),
  studentAttendanceController.getAttendance
);

router.post(
  '/students',
  requirePermission('attendance.mark', 'create'),
  validateBody(markAttendanceSchema),
  studentAttendanceController.markAttendance
);

router.put(
  '/students/:id',
  requirePermission('attendance.mark', 'edit'),
  studentAttendanceController.updateRecord
);

router.put(
  '/students/:id/lock',
  requirePermission('attendance.mark', 'edit'),
  studentAttendanceController.lockAttendance
);

router.get(
  '/students/:studentId/history',
  requirePermission('attendance.view', 'view'),
  studentAttendanceController.getStudentHistory
);

// ============ Reports ============
router.get(
  '/reports/daily',
  requirePermission('attendance.reports', 'view'),
  studentAttendanceController.getDailyReport
);

router.get(
  '/reports/class-wise',
  requirePermission('attendance.reports', 'view'),
  studentAttendanceController.getClassWiseReport
);

router.get(
  '/reports/student-wise',
  requirePermission('attendance.reports', 'view'),
  studentAttendanceController.getStudentWiseReport
);

// Subject-wise % + exam eligibility (universities marking lecture-wise).
router.get(
  '/reports/subject-wise',
  requirePermission('attendance.reports', 'view'),
  studentAttendanceController.subjectWiseReport
);

router.get(
  '/reports/monthly',
  requirePermission('attendance.reports', 'view'),
  studentAttendanceController.getMonthlyReport
);

// ============ Export ============
router.get(
  '/export/daily',
  requirePermission('attendance.reports', 'view'),
  studentAttendanceController.exportDailyReport
);

router.get(
  '/export/student-wise',
  requirePermission('attendance.reports', 'view'),
  studentAttendanceController.exportStudentWiseReport
);

// ============ Settings ============
router.get(
  '/settings',
  requirePermission('attendance.view', 'view'),
  attendanceSettingsController.getSettings
);
router.put(
  '/settings',
  requirePermission('attendance.settings', 'edit'),
  attendanceSettingsController.updateSettings
);

// Attendance Statuses
router.post(
  '/settings/statuses',
  requirePermission('attendance.settings', 'edit'),
  attendanceSettingsController.addAttendanceStatus
);
router.put(
  '/settings/statuses/:code',
  requirePermission('attendance.settings', 'edit'),
  attendanceSettingsController.updateAttendanceStatus
);
router.delete(
  '/settings/statuses/:code',
  requirePermission('attendance.settings', 'edit'),
  attendanceSettingsController.deleteAttendanceStatus
);

// Working Days and Holiday Integration
router.get(
  '/working-days',
  requirePermission('attendance.view', 'view'),
  attendanceSettingsController.getWorkingDaysInRange
);

router.get(
  '/students/:studentId/stats',
  requirePermission('attendance.reports', 'view'),
  attendanceSettingsController.getStudentAttendanceStats
);

router.get(
  '/low-attendance',
  requirePermission('attendance.reports', 'view'),
  attendanceSettingsController.getLowAttendanceStudents
);

// ============ Self-Service ============
router.get(
  '/self/:studentId',
  requirePermission('attendance.view', 'view'),
  studentAttendanceController.getStudentSelfAttendance
);

router.get(
  '/parent/children',
  requirePermission('attendance.view', 'view'),
  studentAttendanceController.getParentChildAttendance
);

// ============ Bulk Upload ============
router.get(
  '/bulk-upload/template',
  requirePermission('attendance.mark', 'view'),
  studentAttendanceController.getBulkUploadTemplate
);

router.post(
  '/bulk-upload/validate',
  requirePermission('attendance.mark', 'create'),
  studentAttendanceController.validateBulkUpload
);

router.post(
  '/bulk-upload',
  requirePermission('attendance.mark', 'create'),
  studentAttendanceController.processBulkUpload
);

// ============ Holidays ============
router.get('/holidays', requirePermission('attendance.view', 'view'), holidayController.findAll);

router.get(
  '/holidays/stats',
  requirePermission('attendance.view', 'view'),
  holidayController.getStats
);

router.get(
  '/holidays/:id',
  requirePermission('attendance.view', 'view'),
  holidayController.findById
);

router.post(
  '/holidays',
  requirePermission('attendance.mark', 'create'),
  validateBody(createHolidaySchema),
  holidayController.create
);

router.put(
  '/holidays/:id',
  requirePermission('attendance.mark', 'edit'),
  validateBody(updateHolidaySchema),
  holidayController.update
);

router.delete(
  '/holidays/:id',
  requirePermission('attendance.mark', 'delete'),
  holidayController.delete
);

export default router;
