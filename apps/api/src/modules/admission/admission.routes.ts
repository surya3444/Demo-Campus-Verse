import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { requireBranch, requirePermission } from '../../middleware/rbac';
import { requireModule } from '../../middleware/moduleGating';
import { validateBody } from '../../middleware/validate';
import {
  enrollApplicationSchema,
  createLeadRouteSchema,
  createApplicationRouteSchema,
} from '@campus-verse/shared/schemas';
import { leadController } from './lead.controller';
import { applicationController } from './application.controller';
import { pipelineController } from './pipeline.controller';
import { settingsController } from './settings.controller';
import { reportController } from './report.controller';
import { bulkUploadController } from './bulkUpload.controller';
import { formController } from './form.controller';
import { ObjectId } from 'mongodb';
import { collections } from '../../config/database';
import { ApiError } from '../../middleware/errorHandler';
import { getScopedClassIds } from '../../middleware/scope';

const router: ReturnType<typeof Router> = Router();

// ============ Public Web Forms (No Authentication) ============
router.get('/public/forms/enquiry/:branchId', settingsController.getPublicEnquiryForm);
router.post('/public/forms/enquiry/:branchId', settingsController.submitPublicEnquiry);
router.get('/public/forms/application/:branchId', settingsController.getPublicApplicationForm);
router.post('/public/forms/application/:branchId', settingsController.submitPublicApplication);

// ============ Dynamic Forms - Public Routes ============
router.get('/public/forms/:slug', formController.getPublicForm);
router.post('/public/forms/:slug/submit', formController.submitPublicForm);

// All routes below require authentication and module access
router.use(authenticate);
router.use(requireModule('admissions'));
router.use(requireBranch);

// Institution / department / program admins act only on leads and
// applications for classes in their scope (lists are narrowed the same way).
router.param('id', async (req, _res, next, id) => {
  try {
    const kind = req.path.startsWith('/applications/')
      ? 'application'
      : req.path.startsWith('/leads/')
        ? 'lead'
        : null;
    if (!kind || !ObjectId.isValid(id)) return next();
    const scoped = await getScopedClassIds(req);
    if (!scoped) return next();
    const doc =
      kind === 'application'
        ? await collections.applications.findOne(
            { _id: new ObjectId(id), tenantId: new ObjectId(req.tenantId!) },
            { projection: { classId: 1 } }
          )
        : await collections.leads.findOne(
            { _id: new ObjectId(id), tenantId: new ObjectId(req.tenantId!) },
            { projection: { 'interestedIn.classId': 1 } }
          );
    if (!doc) return next();
    const classId = kind === 'application' ? doc.classId : doc.interestedIn?.classId;
    if (!classId || !scoped.some((c) => c.equals(classId as ObjectId))) {
      throw new ApiError(
        'ADMISSION_OUT_OF_SCOPE',
        `This ${kind} is outside your access scope`,
        403
      );
    }
    next();
  } catch (err) {
    next(err);
  }
});

// ============ Pipeline (Kanban) ============
router.get(
  '/pipeline',
  requirePermission('admissions.leads', 'view'),
  pipelineController.getPipeline
);

router.put(
  '/pipeline/:id/move',
  requirePermission('admissions.leads', 'edit'),
  pipelineController.moveCard
);

router.post(
  '/pipeline/:id/convert',
  requirePermission('admissions.applications', 'create'),
  pipelineController.convertLead
);

// ============ Leads ============
router.get('/leads/stats', requirePermission('admissions.leads', 'view'), leadController.getStats);

router.get(
  '/leads/followups/due',
  requirePermission('admissions.leads', 'view'),
  leadController.getFollowupsDue
);

router.get(
  '/leads/followups/overdue',
  requirePermission('admissions.leads', 'view'),
  leadController.getOverdueFollowups
);

router.get(
  '/leads/followups/stats',
  requirePermission('admissions.leads', 'view'),
  leadController.getFollowupStats
);

router.get('/leads', requirePermission('admissions.leads', 'view'), leadController.findAll);

router.post(
  '/leads',
  requirePermission('admissions.leads', 'create'),
  validateBody(createLeadRouteSchema),
  leadController.create
);

router.get('/leads/:id', requirePermission('admissions.leads', 'view'), leadController.findById);

router.put('/leads/:id', requirePermission('admissions.leads', 'edit'), leadController.update);

router.delete('/leads/:id', requirePermission('admissions.leads', 'delete'), leadController.delete);

router.put(
  '/leads/:id/stage',
  requirePermission('admissions.leads', 'edit'),
  leadController.updateStage
);

router.post(
  '/leads/:id/followup',
  requirePermission('admissions.leads', 'edit'),
  leadController.addFollowup
);

router.put(
  '/leads/:id/followup/:followupIndex/complete',
  requirePermission('admissions.leads', 'edit'),
  leadController.completeFollowup
);

router.post(
  '/leads/:id/convert',
  requirePermission('admissions.applications', 'create'),
  applicationController.convertFromLead
);

// ============ Applications ============
router.get(
  '/applications/stats',
  requirePermission('admissions.applications', 'view'),
  applicationController.getStats
);

router.get(
  '/applications',
  requirePermission('admissions.applications', 'view'),
  applicationController.findAll
);

router.post(
  '/applications',
  requirePermission('admissions.applications', 'create'),
  validateBody(createApplicationRouteSchema),
  applicationController.create
);

router.get(
  '/applications/:id',
  requirePermission('admissions.applications', 'view'),
  applicationController.findById
);

router.put(
  '/applications/:id',
  requirePermission('admissions.applications', 'edit'),
  applicationController.update
);

router.delete(
  '/applications/:id',
  requirePermission('admissions.applications', 'delete'),
  applicationController.delete
);

router.put(
  '/applications/:id/status',
  requirePermission('admissions.applications', 'edit'),
  applicationController.updateStatus
);

router.post(
  '/applications/:id/enroll',
  requirePermission('admissions.applications', 'edit'),
  validateBody(enrollApplicationSchema),
  applicationController.enroll
);

// ============ Bulk Upload ============
router.get(
  '/bulk-upload/applications/template',
  requirePermission('admissions.applications', 'view'),
  bulkUploadController.getApplicationTemplate
);

router.get(
  '/bulk-upload/leads/template',
  requirePermission('admissions.leads', 'view'),
  bulkUploadController.getLeadTemplate
);

router.post(
  '/bulk-upload/applications',
  requirePermission('admissions.applications', 'create'),
  bulkUploadController.uploadApplications
);

router.post(
  '/bulk-upload/leads',
  requirePermission('admissions.leads', 'create'),
  bulkUploadController.uploadLeads
);

// ============ Settings ============
router.get(
  '/settings',
  requirePermission('admissions.settings', 'view'),
  settingsController.getSettings
);
router.put(
  '/settings',
  requirePermission('admissions.settings', 'edit'),
  settingsController.updateSettings
);

// ============ Sources ============
router.get(
  '/sources',
  requirePermission('admissions.settings', 'view'),
  settingsController.getSources
);
router.post(
  '/sources',
  requirePermission('admissions.settings', 'edit'),
  settingsController.createSource
);
router.put(
  '/sources/:id',
  requirePermission('admissions.settings', 'edit'),
  settingsController.updateSource
);
router.delete(
  '/sources/:id',
  requirePermission('admissions.settings', 'edit'),
  settingsController.deleteSource
);

// ============ Agents ============
router.get(
  '/agents',
  requirePermission('admissions.settings', 'view'),
  settingsController.getAgents
);
router.post(
  '/agents',
  requirePermission('admissions.settings', 'edit'),
  settingsController.createAgent
);
router.get(
  '/agents/:id',
  requirePermission('admissions.settings', 'view'),
  settingsController.getAgent
);
router.get(
  '/agents/:id/stats',
  requirePermission('admissions.reports', 'view'),
  settingsController.getAgentStats
);
router.put(
  '/agents/:id',
  requirePermission('admissions.settings', 'edit'),
  settingsController.updateAgent
);
router.delete(
  '/agents/:id',
  requirePermission('admissions.settings', 'edit'),
  settingsController.deleteAgent
);

// ============ Reports ============
router.get(
  '/reports/leads',
  requirePermission('admissions.reports', 'view'),
  reportController.getLeadsReport
);
router.get(
  '/reports/leads/conversion',
  requirePermission('admissions.reports', 'view'),
  reportController.getLeadsConversionReport
);
router.get(
  '/reports/applications',
  requirePermission('admissions.reports', 'view'),
  reportController.getApplicationsReport
);
router.get(
  '/reports/applications/processing-time',
  requirePermission('admissions.reports', 'view'),
  reportController.getApplicationProcessingTime
);
router.get(
  '/reports/analytics',
  requirePermission('admissions.reports', 'view'),
  reportController.getAdmissionAnalytics
);

// ============ Dynamic Forms ============
router.get('/forms', requirePermission('admissions.settings', 'view'), formController.getForms);
router.post('/forms', requirePermission('admissions.settings', 'edit'), formController.createForm);
router.get('/forms/:id', requirePermission('admissions.settings', 'view'), formController.getForm);
router.put(
  '/forms/:id',
  requirePermission('admissions.settings', 'edit'),
  formController.updateForm
);
router.delete(
  '/forms/:id',
  requirePermission('admissions.settings', 'edit'),
  formController.deleteForm
);
router.post(
  '/forms/:id/duplicate',
  requirePermission('admissions.settings', 'edit'),
  formController.duplicateForm
);

// Form Submissions
router.get(
  '/forms/:formId/submissions',
  requirePermission('admissions.leads', 'view'),
  formController.getSubmissions
);
router.get(
  '/submissions/:submissionId',
  requirePermission('admissions.leads', 'view'),
  formController.getSubmission
);
router.put(
  '/submissions/:submissionId/status',
  requirePermission('admissions.leads', 'edit'),
  formController.updateSubmissionStatus
);

export default router;
