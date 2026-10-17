import { Router } from 'express';
import { studentParamGuard } from '../teaching/scope';
import { authenticate } from '../../middleware/auth';
import { requireBranch, requirePermission } from '../../middleware/rbac';
import { requireModule } from '../../middleware/moduleGating';
import { validateBody } from '../../middleware/validate';
import { hostelController } from './hostel.controller';
import { roomController } from './room.controller';
import { bedAllocationController } from './bedAllocation.controller';
import { hostelReportController } from './hostelReport.controller';
import { hostelSettingsController } from './hostelSettings.controller';
import {
  createHostelSchema,
  updateHostelSchema,
  createRoomSchema,
  updateRoomSchema,
  createBedAllocationSchema,
  vacateBedSchema,
  transferBedSchema,
  updateHostelSettingsSchema,
} from '@campus-verse/shared/schemas';

const router: ReturnType<typeof Router> = Router();

// Apply authentication, module check, and branch check to all routes
router.use(authenticate);
router.use(requireModule('hostel'));
router.use(requireBranch);

// Every :studentId here is a student: callers only reach students in their scope.
router.param('studentId', studentParamGuard);

// ============ Hostels ============

// Stats endpoint (before :id routes to avoid conflicts)
router.get(
  '/hostels/stats',
  requirePermission('hostel.hostels', 'view'),
  hostelController.getStats
);

// CRUD operations
router.get('/hostels', requirePermission('hostel.hostels', 'view'), hostelController.findAll);

router.post(
  '/hostels',
  requirePermission('hostel.hostels', 'create'),
  validateBody(createHostelSchema),
  hostelController.create
);

router.get('/hostels/:id', requirePermission('hostel.hostels', 'view'), hostelController.findById);

router.put(
  '/hostels/:id',
  requirePermission('hostel.hostels', 'edit'),
  validateBody(updateHostelSchema),
  hostelController.update
);

router.delete(
  '/hostels/:id',
  requirePermission('hostel.hostels', 'delete'),
  hostelController.delete
);

// ============ Rooms ============

router.get('/rooms', requirePermission('hostel.rooms', 'view'), roomController.findAll);

router.post(
  '/rooms',
  requirePermission('hostel.rooms', 'create'),
  validateBody(createRoomSchema),
  roomController.create
);

router.get('/rooms/:id', requirePermission('hostel.rooms', 'view'), roomController.findById);

router.put(
  '/rooms/:id',
  requirePermission('hostel.rooms', 'edit'),
  validateBody(updateRoomSchema),
  roomController.update
);

router.put(
  '/rooms/:id/status',
  requirePermission('hostel.rooms', 'edit'),
  roomController.updateStatus
);

router.delete('/rooms/:id', requirePermission('hostel.rooms', 'delete'), roomController.delete);

// ============ Allocations ============

// Stats endpoint (before :id routes)
router.get(
  '/allocations/stats',
  requirePermission('hostel.allocations', 'view'),
  bedAllocationController.getStats
);

// Student-specific endpoint (before :id routes)
router.get(
  '/allocations/student/:studentId',
  requirePermission('hostel.allocations', 'view'),
  bedAllocationController.findByStudent
);

router.get(
  '/allocations',
  requirePermission('hostel.allocations', 'view'),
  bedAllocationController.findAll
);

router.post(
  '/allocations',
  requirePermission('hostel.allocations', 'create'),
  validateBody(createBedAllocationSchema),
  bedAllocationController.allocate
);

router.get(
  '/allocations/:id',
  requirePermission('hostel.allocations', 'view'),
  bedAllocationController.findById
);

router.post(
  '/allocations/:id/vacate',
  requirePermission('hostel.allocations', 'edit'),
  validateBody(vacateBedSchema),
  bedAllocationController.vacate
);

router.post(
  '/allocations/:id/transfer',
  requirePermission('hostel.allocations', 'edit'),
  validateBody(transferBedSchema),
  bedAllocationController.transfer
);

// ============ Reports ============

router.get(
  '/reports/occupancy',
  requirePermission('hostel.reports', 'view'),
  hostelReportController.getOccupancyReport
);

router.get(
  '/reports/vacancy',
  requirePermission('hostel.reports', 'view'),
  hostelReportController.getVacancyReport
);

router.get(
  '/reports/class-wise',
  requirePermission('hostel.reports', 'view'),
  hostelReportController.getClassWiseReport
);

// ============ Settings ============

router.get(
  '/settings',
  requirePermission('hostel.settings', 'view'),
  hostelSettingsController.getSettings
);

router.put(
  '/settings',
  requirePermission('hostel.settings', 'edit'),
  validateBody(updateHostelSettingsSchema),
  hostelSettingsController.updateSettings
);

export default router;
