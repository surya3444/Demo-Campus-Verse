import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import {
  requireAcademics,
  requireAnyPermission,
  requirePermission,
  requireBranch,
} from '../../middleware/rbac';
import { validateBody } from '../../middleware/validate';
import { branchController } from './branch.controller';
import { institutionController } from './institution.controller';
import { programController } from './program.controller';
import { branchSettingsController } from './branchSettings.controller';
import { userController } from './user.controller';
import { roleController } from './role.controller';
import { academicBatchController } from './academicBatch.controller';
import { classController } from './class.controller';
import { sectionController } from './section.controller';
import { subjectController } from './subject.controller';
import { settingsController } from './settings.controller';
import { customFieldController } from './customField.controller';
import { approvalController } from './approval.controller';
import { approvalSettingsController } from './approvalSettings.controller';
import { scheduledJobController } from './scheduledJob.controller';
import { onboardingController } from './onboarding.controller';
import { infrastructureController } from './infrastructure.controller';
import { departmentOverviewController } from './departmentOverview.controller';
import { overviewController } from './overview.controller';
import {
  createBranchSchema,
  updateBranchSchema,
  createInstitutionSchema,
  updateInstitutionSchema,
  createProgramSchema,
  updateProgramSchema,
  createUserSchema,
  updateUserSchema,
  createRoleSchema,
  createAcademicBatchSchema,
  copyAcademicStructureSchema,
  academicTermSchema,
  createClassSchema,
  createSectionSchema,
  updateSectionBatchesSchema,
  assignLabBatchSchema,
  createSubjectSchema,
  updateSubjectSchema,
  academicHierarchyConfigSchema,
  createBuildingSchema,
  updateBuildingSchema,
  createInfraRoomSchema,
  updateInfraRoomSchema,
  addFloorSchema,
  updateFloorSchema,
  updateModulesSchema,
} from '@campus-verse/shared';

const router: ReturnType<typeof Router> = Router();

// All routes require authentication
router.use(authenticate);

// ============ Branches ============
router.get(
  '/branches',
  requirePermission('organization.branches', 'view'),
  branchController.findAll
);

router.post(
  '/branches',
  requirePermission('organization.branches', 'create'),
  validateBody(createBranchSchema),
  branchController.create
);

router.get(
  '/branches/locations',
  requirePermission('organization.branches', 'view'),
  branchController.getLocations
);

router.get(
  '/branches/:id',
  requirePermission('organization.branches', 'view'),
  branchController.findById
);

router.put(
  '/branches/:id',
  requirePermission('organization.branches', 'edit'),
  validateBody(updateBranchSchema),
  branchController.update
);

router.delete(
  '/branches/:id',
  requirePermission('organization.branches', 'delete'),
  branchController.delete
);

router.get(
  '/branches/:id/stats',
  requirePermission('organization.branches', 'view'),
  branchController.getStats
);

// ============ Institutions (constituent institutions of a university) ============
router.get(
  '/institutions',
  requireBranch,
  requirePermission('organization.branches', 'view'),
  institutionController.findAll
);

router.post(
  '/institutions',
  requireBranch,
  requireAcademics('create', { module: 'organization.branches', action: 'create' }),
  validateBody(createInstitutionSchema),
  institutionController.create
);

router.get(
  '/institutions/:id',
  requirePermission('organization.branches', 'view'),
  institutionController.findById
);

router.put(
  '/institutions/:id',
  requireAcademics('edit', { module: 'organization.branches', action: 'edit' }),
  validateBody(updateInstitutionSchema),
  institutionController.update
);

router.delete(
  '/institutions/:id',
  requireAcademics('delete', { module: 'organization.branches', action: 'delete' }),
  institutionController.delete
);

// ============ Programs (degree programs offered by departments) ============
router.get('/programs', requireBranch, programController.findAll);

router.post(
  '/programs',
  requireAcademics('create'),
  requireBranch,
  validateBody(createProgramSchema),
  programController.create
);

router.get('/programs/:id', programController.findById);

router.put(
  '/programs/:id',
  requireAcademics('edit'),
  validateBody(updateProgramSchema),
  programController.update
);

router.delete('/programs/:id', requireAcademics('delete'), programController.delete);

// ============ Branch Settings ============
router.get(
  '/branches/:branchId/settings',
  requirePermission('organization.settings', 'view'),
  branchSettingsController.getSettings
);

router.put(
  '/branches/:branchId/settings',
  requirePermission('organization.settings', 'edit'),
  branchSettingsController.updateSettings
);

router.get(
  '/branches/:branchId/settings/effective',
  requirePermission('organization.settings', 'view'),
  branchSettingsController.getEffectiveSettings
);

router.post(
  '/branches/:branchId/settings/holidays',
  requirePermission('organization.settings', 'edit'),
  branchSettingsController.addHoliday
);

router.delete(
  '/branches/:branchId/settings/holidays',
  requirePermission('organization.settings', 'edit'),
  branchSettingsController.removeHoliday
);

// ============ Users ============
router.get('/users', requirePermission('organization.users', 'view'), userController.findAll);

router.post(
  '/users',
  requirePermission('organization.users', 'create'),
  validateBody(createUserSchema),
  userController.create
);

router.get('/users/:id', requirePermission('organization.users', 'view'), userController.findById);

router.put(
  '/users/:id',
  requirePermission('organization.users', 'edit'),
  validateBody(updateUserSchema),
  userController.update
);

router.put(
  '/users/:id/status',
  requirePermission('organization.users', 'edit'),
  userController.updateStatus
);

router.post(
  '/users/:id/reset-password',
  requirePermission('organization.users', 'edit'),
  userController.resetPassword
);

router.delete(
  '/users/:id',
  requirePermission('organization.users', 'delete'),
  userController.delete
);

// ============ Roles ============
router.get('/roles', requirePermission('organization.roles', 'view'), roleController.findAll);

// Get roles that current user can assign to others (for dropdowns)
router.get(
  '/roles/assignable',
  requirePermission('organization.roles', 'view'),
  roleController.getAssignableRoles
);

router.post(
  '/roles',
  requirePermission('organization.roles', 'create'),
  validateBody(createRoleSchema),
  roleController.create
);

router.get('/roles/:id', requirePermission('organization.roles', 'view'), roleController.findById);

router.put('/roles/:id', requirePermission('organization.roles', 'edit'), roleController.update);

router.delete(
  '/roles/:id',
  requirePermission('organization.roles', 'delete'),
  roleController.delete
);

// ============ Academic Batches ============
router.get('/academic-batches', academicBatchController.findAll);

router.get('/academic-batches/current', academicBatchController.getCurrent);

router.post(
  '/academic-batches',
  requireAcademics('create'),
  validateBody(createAcademicBatchSchema),
  academicBatchController.create
);

router.get('/academic-batches/:id', academicBatchController.findById);

router.put('/academic-batches/:id', requireAcademics('edit'), academicBatchController.update);

router.put(
  '/academic-batches/:id/activate',
  requireAcademics('edit'),
  academicBatchController.setAsCurrent
);

router.delete('/academic-batches/:id', requireAcademics('delete'), academicBatchController.delete);

// Start a new academic year: copy the last year's classes and sections into it
router.post(
  '/academic-batches/:id/copy-structure',
  requireAcademics('create'),
  requireBranch,
  validateBody(copyAcademicStructureSchema),
  classController.copyStructure
);

// Terms (semesters) within a batch
router.post(
  '/academic-batches/:id/terms',
  requireAcademics('create'),
  validateBody(academicTermSchema),
  academicBatchController.addTerm
);

router.put(
  '/academic-batches/:id/terms/:termId',
  requireAcademics('edit'),
  validateBody(academicTermSchema),
  academicBatchController.updateTerm
);

router.delete(
  '/academic-batches/:id/terms/:termId',
  requireAcademics('edit'),
  academicBatchController.deleteTerm
);

// ============ Classes ============
// Aggregated tree (classes → sections → subjects) — must precede /classes/:id
router.get('/classes/tree', classController.getTree);
router.get('/classes', classController.findAll);

router.post(
  '/classes',
  requireAcademics('create'),
  validateBody(createClassSchema),
  classController.create
);

router.get('/classes/:id', classController.findById);

router.put('/classes/:id', requireAcademics('edit'), classController.update);

router.put('/classes/:id/status', requireAcademics('edit'), classController.updateStatus);

router.delete('/classes/:id', requireAcademics('delete'), classController.delete);

// Class Subjects (read-only — aggregated across all sections of the class)
router.get('/classes/:id/subjects', classController.getSubjects);

// ============ Sections ============
router.get('/sections', sectionController.findAll);

router.get('/classes/:classId/sections', sectionController.findByClassId);

router.post(
  '/classes/:classId/sections',
  requireAcademics('create'),
  validateBody(createSectionSchema.omit({ classId: true })),
  sectionController.create
);

router.get('/sections/:id', sectionController.findById);

router.put('/sections/:id', requireAcademics('edit'), sectionController.update);

router.put('/sections/:id/status', requireAcademics('edit'), sectionController.updateStatus);

router.delete('/sections/:id', requireAcademics('delete'), sectionController.delete);

router.get('/sections/:id/student-count', sectionController.getStudentCount);

// Lab batches (subdivisions of a section for practical scheduling)
router.put(
  '/sections/:id/batches',
  requireAcademics('edit'),
  validateBody(updateSectionBatchesSchema),
  sectionController.updateBatches
);

router.put(
  '/sections/:id/batches/assign',
  requireAcademics('edit'),
  validateBody(assignLabBatchSchema),
  sectionController.assignStudentsToBatches
);

router.put(
  '/sections/:id/assign-teacher',
  requireAcademics('edit'),
  sectionController.assignTeacher
);

router.get('/sections/teachers/available', sectionController.getTeachers);

// Section Subjects (authoritative source — subjects + per-section teacher assignments)
router.get('/sections/:id/subjects', sectionController.getSubjects);

router.post('/sections/:id/subjects', requireAcademics('create'), sectionController.assignSubject);

router.put(
  '/sections/:id/subjects/:subjectId',
  requireAcademics('edit'),
  sectionController.updateSubject
);

router.delete(
  '/sections/:id/subjects/:subjectId',
  requireAcademics('delete'),
  sectionController.removeSubject
);

// ============ Overview (headline counts for the Organization hub) ============
router.get(
  '/overview',
  requireBranch,
  requirePermission('organization.settings', 'view'),
  overviewController.getOverview
);

// ============ Departments (overview read model; CRUD lives in /hr) ============
router.get(
  '/departments/overview',
  requireBranch,
  requirePermission('organization.settings', 'view'),
  departmentOverviewController.getOverview
);
router.get(
  '/departments/:id([0-9a-fA-F]{24})/people',
  requireBranch,
  requirePermission('organization.settings', 'view'),
  departmentOverviewController.getPeople
);

// ============ Subjects ============
router.get('/subjects', subjectController.findAll);

router.post(
  '/subjects',
  requireAcademics('create'),
  validateBody(createSubjectSchema),
  subjectController.create
);

// Where each subject is used and who teaches it (before /subjects/:id).
router.get(
  '/subjects/usage',
  requireBranch,
  requireAnyPermission([
    { module: 'organization.settings', action: 'view' },
    { module: 'organization.academics', action: 'view' },
  ]),
  subjectController.usage
);

router.get('/subjects/:id', subjectController.findById);

router.put(
  '/subjects/:id',
  requireAcademics('edit'),
  validateBody(updateSubjectSchema),
  subjectController.update
);

router.delete('/subjects/:id', requireAcademics('delete'), subjectController.delete);

// ============ Settings ============
// Organization profile (all settings combined)
router.get(
  '/profile',
  requirePermission('organization.settings', 'view'),
  settingsController.getProfile
);

// General settings (timezone, date format, currency, fiscal year)
router.get(
  '/settings',
  requirePermission('organization.settings', 'view'),
  settingsController.getSettings
);
router.put(
  '/settings',
  requirePermission('organization.settings', 'edit'),
  settingsController.updateSettings
);

// Contact information
router.get(
  '/contact',
  requirePermission('organization.settings', 'view'),
  settingsController.getContact
);
router.put(
  '/contact',
  requirePermission('organization.settings', 'edit'),
  settingsController.updateContact
);

// Legal information (entity name, GST, PAN, registration, board)
router.get(
  '/legal',
  requirePermission('organization.settings', 'view'),
  settingsController.getLegalInfo
);
router.put(
  '/legal',
  requirePermission('organization.settings', 'edit'),
  settingsController.updateLegalInfo
);

// Branding (logo, colors)
router.get(
  '/branding',
  requirePermission('organization.settings', 'view'),
  settingsController.getBranding
);
router.put(
  '/branding',
  requirePermission('organization.settings', 'edit'),
  settingsController.updateBranding
);

// Modules (enabled features)
router.get(
  '/modules',
  requirePermission('organization.settings', 'view'),
  settingsController.getModules
);
router.put(
  '/modules',
  requirePermission('organization.settings', 'edit'),
  validateBody(updateModulesSchema),
  settingsController.updateModules
);

// Academic Hierarchy Configuration
// Level labels (Department → Year → Section) that student, attendance and
// teaching screens render with — any signed-in user may read them.
router.get('/academic-hierarchy', settingsController.getAcademicHierarchy);
router.put(
  '/academic-hierarchy',
  requirePermission('organization.settings', 'edit'),
  validateBody(academicHierarchyConfigSchema),
  settingsController.updateAcademicHierarchy
);
router.post(
  '/academic-hierarchy/reset',
  requirePermission('organization.settings', 'edit'),
  settingsController.resetAcademicHierarchy
);

// ============ Custom Fields ============
router.get(
  '/custom-fields',
  requirePermission('organization.settings', 'view'),
  customFieldController.findAll
);

router.post(
  '/custom-fields',
  requirePermission('organization.settings', 'edit'),
  customFieldController.create
);

// Read-only schema lookup — needed by any UI that renders a module's form
// (e.g. student details, lead form). These are configuration schemas, not data,
// so any authenticated tenant user may read them. Mutating routes still
// require organization.settings:edit/delete.
router.get('/custom-fields/module/:module', customFieldController.getByModule);

router.put(
  '/custom-fields/reorder',
  requirePermission('organization.settings', 'edit'),
  customFieldController.reorder
);

router.get(
  '/custom-fields/:id',
  requirePermission('organization.settings', 'view'),
  customFieldController.findById
);

router.put(
  '/custom-fields/:id',
  requirePermission('organization.settings', 'edit'),
  customFieldController.update
);

router.delete(
  '/custom-fields/:id',
  requirePermission('organization.settings', 'delete'),
  customFieldController.delete
);

// ============ Approvals ============
router.get(
  '/approvals',
  requirePermission('organization.settings', 'view'),
  approvalController.getPendingApprovals
);

router.get(
  '/approvals/history',
  requirePermission('organization.settings', 'view'),
  approvalController.getApprovalHistory
);

router.post(
  '/approvals/concession/:id/undo',
  requirePermission('organization.settings', 'edit'),
  approvalController.undoConcessionApproval
);

router.post(
  '/approvals/fee-cancellation/:id/undo',
  requirePermission('organization.settings', 'edit'),
  approvalController.undoFeeCancellation
);

// ============ Approval Settings ============
router.get(
  '/approval-settings',
  requirePermission('organization.settings', 'view'),
  approvalSettingsController.getSettings
);

router.put(
  '/approval-settings/email/:entityType',
  requirePermission('organization.settings', 'edit'),
  approvalSettingsController.updateEmailSettings
);

router.put(
  '/approval-settings/auto-approve',
  requirePermission('organization.settings', 'edit'),
  approvalSettingsController.updateAutoApproveThreshold
);

router.put(
  '/approval-settings/escalation',
  requirePermission('organization.settings', 'edit'),
  approvalSettingsController.updateEscalationSettings
);

// ============ Scheduled Jobs ============
router.get(
  '/scheduled-jobs',
  requirePermission('organization.settings', 'view'),
  scheduledJobController.getJobs
);

router.get(
  '/scheduled-jobs/templates',
  requirePermission('organization.settings', 'view'),
  scheduledJobController.getJobTemplates
);

router.post(
  '/scheduled-jobs',
  requirePermission('organization.settings', 'edit'),
  scheduledJobController.createJob
);

router.get(
  '/scheduled-jobs/:id',
  requirePermission('organization.settings', 'view'),
  scheduledJobController.getJob
);

router.put(
  '/scheduled-jobs/:id',
  requirePermission('organization.settings', 'edit'),
  scheduledJobController.updateJob
);

router.put(
  '/scheduled-jobs/:id/status',
  requirePermission('organization.settings', 'edit'),
  scheduledJobController.toggleJobStatus
);

router.delete(
  '/scheduled-jobs/:id',
  requirePermission('organization.settings', 'delete'),
  scheduledJobController.deleteJob
);

router.post(
  '/scheduled-jobs/:id/run',
  requirePermission('organization.settings', 'edit'),
  scheduledJobController.runJobNow
);

router.get(
  '/scheduled-jobs/:id/executions',
  requirePermission('organization.settings', 'view'),
  scheduledJobController.getJobExecutions
);

// ============ Infrastructure - Buildings ============
router.get(
  '/infrastructure/stats',
  requirePermission('organization.infrastructure', 'view'),
  infrastructureController.getStats
);

router.get(
  '/infrastructure/buildings',
  requirePermission('organization.infrastructure', 'view'),
  infrastructureController.findAllBuildings
);

router.post(
  '/infrastructure/buildings',
  requirePermission('organization.infrastructure', 'create'),
  validateBody(createBuildingSchema),
  infrastructureController.createBuilding
);

router.get(
  '/infrastructure/buildings/:id',
  requirePermission('organization.infrastructure', 'view'),
  infrastructureController.findBuildingById
);

router.put(
  '/infrastructure/buildings/:id',
  requirePermission('organization.infrastructure', 'edit'),
  validateBody(updateBuildingSchema),
  infrastructureController.updateBuilding
);

router.delete(
  '/infrastructure/buildings/:id',
  requirePermission('organization.infrastructure', 'delete'),
  infrastructureController.deleteBuilding
);

// Infrastructure - Building Floors
router.post(
  '/infrastructure/buildings/:id/floors',
  requirePermission('organization.infrastructure', 'edit'),
  validateBody(addFloorSchema),
  infrastructureController.addFloor
);

router.put(
  '/infrastructure/buildings/:id/floors/:floorId',
  requirePermission('organization.infrastructure', 'edit'),
  validateBody(updateFloorSchema),
  infrastructureController.updateFloor
);

router.delete(
  '/infrastructure/buildings/:id/floors/:floorId',
  requirePermission('organization.infrastructure', 'edit'),
  infrastructureController.removeFloor
);

// ============ Infrastructure - Rooms ============
router.get(
  '/infrastructure/rooms',
  requirePermission('organization.infrastructure', 'view'),
  infrastructureController.findAllRooms
);

router.post(
  '/infrastructure/rooms',
  requirePermission('organization.infrastructure', 'create'),
  validateBody(createInfraRoomSchema),
  infrastructureController.createRoom
);

router.get(
  '/infrastructure/rooms/:id',
  requirePermission('organization.infrastructure', 'view'),
  infrastructureController.findRoomById
);

router.put(
  '/infrastructure/rooms/:id',
  requirePermission('organization.infrastructure', 'edit'),
  validateBody(updateInfraRoomSchema),
  infrastructureController.updateRoom
);

router.delete(
  '/infrastructure/rooms/:id',
  requirePermission('organization.infrastructure', 'delete'),
  infrastructureController.deleteRoom
);

// ============ Onboarding ============
router.get('/onboarding/status', onboardingController.getStatus);

router.put('/onboarding/complete', onboardingController.complete);

export default router;
