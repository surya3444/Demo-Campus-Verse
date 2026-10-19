import { Router } from 'express';
import { studentParamGuard } from '../teaching/scope';
import multer from 'multer';
import { authenticate } from '../../middleware/auth';
import { requireBranch, requirePermission } from '../../middleware/rbac';
import { requireModule } from '../../middleware/moduleGating';
import { validateBody } from '../../middleware/validate';
import { studentController } from './student.controller';
import { studentBulkUploadController } from './bulkUpload.controller';
import { studentAiMappingController } from './aiMapping.controller';
import { idCardDesignController } from './idCardDesign.controller';
import {
  createStudentSchema,
  updateStudentSchema,
  transferStudentSchema,
  updateStudentStatusSchema,
  saveIdCardDesignSchema,
} from '@campus-verse/shared';
import { imageUpload, requireS3Configured } from '../upload/upload.middleware';
import { student360Service } from './student360.service';
import { success } from '../../utils/response';

// In-memory storage for the AI-mapped bulk upload — we hand the buffer
// straight to ExcelJS / OpenAI, no disk or S3 involvement.
const aiUploadParser = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

const router: ReturnType<typeof Router> = Router();

// All routes require authentication, module access, and branch context
router.use(authenticate);
router.use(requireModule('students'));
router.use(requireBranch);

// Every :id here is a student: callers only reach students in their scope.
router.param('id', studentParamGuard);

// Stats and reports (must be before /:id routes)
router.get('/stats', requirePermission('students.list', 'view'), studentController.getStats);

router.get(
  '/reports/class-wise',
  requirePermission('students.reports', 'view'),
  studentController.getClassWiseReport
);

router.get(
  '/reports/section-wise',
  requirePermission('students.reports', 'view'),
  studentController.getSectionWiseReport
);

router.get(
  '/reports/active',
  requirePermission('students.reports', 'view'),
  studentController.getActiveStudentReport
);

router.get(
  '/reports/category-wise',
  requirePermission('students.reports', 'view'),
  studentController.getCategoryWiseReport
);

router.get(
  '/reports/new-admissions',
  requirePermission('students.reports', 'view'),
  studentController.getNewAdmissionsReport
);

// Alumni
router.get(
  '/alumni',
  requirePermission('students.reports', 'view'),
  studentController.getAlumniList
);
router.get(
  '/alumni/stats',
  requirePermission('students.reports', 'view'),
  studentController.getAlumniStats
);

// Bulk operations
router.get(
  '/bulk-upload/template',
  requirePermission('students.list', 'view'),
  studentBulkUploadController.getTemplate
);

router.post(
  '/bulk-upload/ai-parse',
  requirePermission('students.list', 'create'),
  aiUploadParser.single('file'),
  studentAiMappingController.parse
);

router.post(
  '/bulk-upload/validate',
  requirePermission('students.list', 'create'),
  studentBulkUploadController.validate
);

router.post(
  '/bulk-upload',
  requirePermission('students.list', 'create'),
  studentBulkUploadController.process
);

// Bulk upload history (plural path, distinct from /bulk-upload above)
router.get(
  '/bulk-uploads',
  requirePermission('students.list', 'view'),
  studentBulkUploadController.listUploads
);

// Hard-deletes the batch and every student it created. Same delete perm as
// individual student deletion.
router.delete(
  '/bulk-uploads/:id',
  requirePermission('students.list', 'delete'),
  studentBulkUploadController.deleteUpload
);

router.post(
  '/bulk-promote',
  requirePermission('students.list', 'edit'),
  studentController.bulkPromote
);

// Bulk operations driven by selection on the list page
router.post(
  '/bulk-status',
  requirePermission('students.details', 'edit'),
  studentController.bulkUpdateStatus
);

router.post(
  '/bulk-shuffle',
  requirePermission('students.details', 'edit'),
  studentController.bulkShuffle
);

router.post(
  '/bulk-delete',
  requirePermission('students.list', 'delete'),
  studentController.bulkDelete
);

router.post(
  '/bulk-export',
  requirePermission('students.list', 'view'),
  studentController.exportSelected
);

router.get('/export', requirePermission('students.list', 'view'), studentController.exportStudents);

// Student CRUD
router.get('/', requirePermission('students.list', 'view'), studentController.findAll);

router.post(
  '/',
  requirePermission('students.list', 'create'),
  validateBody(createStudentSchema),
  studentController.create
);

// ID card designs (before '/:id' so the path isn't read as a student id)
router.get(
  '/id-card-designs',
  requirePermission('certificates.idcards', 'view'),
  idCardDesignController.list
);
router.post(
  '/id-card-designs',
  requirePermission('certificates.idcards', 'create'),
  validateBody(saveIdCardDesignSchema),
  idCardDesignController.create
);
router.put(
  '/id-card-designs/:designId',
  requirePermission('certificates.idcards', 'edit'),
  validateBody(saveIdCardDesignSchema),
  idCardDesignController.update
);
router.post(
  '/id-card-designs/:designId/default',
  requirePermission('certificates.idcards', 'edit'),
  idCardDesignController.setDefault
);
router.delete(
  '/id-card-designs/:designId',
  requirePermission('certificates.idcards', 'delete'),
  idCardDesignController.remove
);

router.get('/:id', requirePermission('students.details', 'view'), studentController.findById);

// Student 360: every module's view of one student in a single read
router.get('/:id/360', requirePermission('students.details', 'view'), async (req, res, next) => {
  try {
    success(res, await student360Service.get(req.tenantId!, req.params.id as string, req.user!));
  } catch (e) {
    next(e);
  }
});

router.put(
  '/:id',
  requirePermission('students.details', 'edit'),
  validateBody(updateStudentSchema),
  studentController.update
);

// Photo upload
router.post(
  '/:id/photo',
  requirePermission('students.details', 'edit'),
  requireS3Configured,
  imageUpload.single('file'),
  studentController.uploadPhoto
);

// Delete is gated by students.list:delete (the catalog-level perm that
// admins/owners have). students.details only carries view/edit.
router.delete('/:id', requirePermission('students.list', 'delete'), studentController.delete);

// Status and actions
router.put(
  '/:id/status',
  requirePermission('students.details', 'edit'),
  validateBody(updateStudentStatusSchema),
  studentController.updateStatus
);

// Reset the student's portal-account password (returns a new temp password)
router.post(
  '/:id/reset-portal-password',
  requirePermission('students.details', 'edit'),
  studentController.resetPortalPassword
);

router.get(
  '/:id/enrollments',
  requirePermission('students.details', 'view'),
  studentController.getEnrollmentHistory
);

// Promote / Shuffle / Transfer
router.post(
  '/:id/promote',
  requirePermission('students.details', 'edit'),
  studentController.promote
);

router.post(
  '/:id/shuffle',
  requirePermission('students.details', 'edit'),
  studentController.shuffle
);

router.post(
  '/:id/transfer',
  requirePermission('students.details', 'edit'),
  validateBody(transferStudentSchema),
  studentController.transfer
);

router.get(
  '/:id/fee-summary',
  requirePermission('students.details', 'view'),
  studentController.getFeeSummary
);

router.get(
  '/:id/attendance-summary',
  requirePermission('students.details', 'view'),
  studentController.getAttendanceSummary
);

export default router;
