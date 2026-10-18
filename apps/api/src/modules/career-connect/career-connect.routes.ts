import { Router } from 'express';
import { studentParamGuard } from '../teaching/scope';
import { authenticate } from '../../middleware/auth';
import { requireBranch, requirePermission } from '../../middleware/rbac';
import { requireModule } from '../../middleware/moduleGating';
import { validateBody, validateQuery } from '../../middleware/validate';
import { requireInstitutionType } from './middleware/institutionTypeGuard';
import { careerHubService } from './reports/careerHub.service';
import { success } from '../../utils/response';
import { companyController } from './companies/company.controller';
import { driveController } from './drives/drive.controller';
import { offerController } from './drives/offer.controller';
import { jobPostingController } from './jobBoard/jobPosting.controller';
import { jobApplicationController } from './jobBoard/jobApplication.controller';
import { studentProfileController } from './studentProfile/studentProfile.controller';
import { counselingController } from './counseling/counseling.controller';
import { assessmentController } from './counseling/assessment.controller';
import { resourceController } from './counseling/resource.controller';
import { alumniProfileController } from './alumni/alumniProfile.controller';
import { mentorshipController } from './alumni/mentorship.controller';
import { referralController } from './alumni/referral.controller';
import { eventController } from './alumni/event.controller';
import { placementReportController } from './reports/placementReport.controller';
import { counselingReportController } from './reports/counselingReport.controller';
import { alumniReportController } from './reports/alumniReport.controller';
import {
  createCompanySchema,
  updateCompanySchema,
  companyQuerySchema,
  updateCompanyStatusSchema,
  addCompanyContactSchema,
  addCompanyVisitSchema,
  createDriveSchema,
  updateDriveSchema,
  driveQuerySchema,
  updateDriveStatusSchema,
  addDriveRoundSchema,
  updateDriveRoundSchema,
  submitRoundResultsSchema,
  createOfferSchema,
  respondOfferSchema,
  createJobPostingSchema,
  updateJobPostingSchema,
  jobPostingQuerySchema,
  createJobApplicationSchema,
  updateJobApplicationStatusSchema,
  updateStudentProfileSchema,
  addSkillSchema,
  addCertificationSchema,
  addProjectSchema,
  addExperienceSchema,
  updatePreferencesSchema,
  studentProfileQuerySchema,
  createCounselingSessionSchema,
  updateCounselingSessionSchema,
  counselingSessionQuerySchema,
  createAssessmentSchema,
  updateAssessmentSchema,
  assessmentQuerySchema,
  createResourceSchema,
  updateResourceSchema,
  resourceQuerySchema,
  updateAlumniProfileSchema,
  alumniQuerySchema,
  createMentorshipSchema,
  updateMentorshipSchema,
  addMentorshipSessionSchema,
  mentorshipQuerySchema,
  createReferralSchema,
  updateReferralSchema,
  referStudentSchema,
  referralQuerySchema,
  createAlumniEventSchema,
  updateAlumniEventSchema,
  alumniEventQuerySchema,
} from '@campus-verse/shared/schemas';

const router: ReturnType<typeof Router> = Router();

// Apply authentication, module check, and branch check to all routes
router.use(authenticate);
router.use(requireModule('careerConnect'));
router.use(requireBranch);

// Every :studentId here is a student: callers only reach students in their scope.
router.param('studentId', studentParamGuard);

// ============ Companies (College/University only) ============

router.get(
  '/companies',
  requireInstitutionType('placement'),
  requirePermission('careerConnect.companies', 'view'),
  validateQuery(companyQuerySchema),
  companyController.list
);

router.post(
  '/companies',
  requireInstitutionType('placement'),
  requirePermission('careerConnect.companies', 'create'),
  validateBody(createCompanySchema),
  companyController.create
);

router.get(
  '/companies/:id',
  requireInstitutionType('placement'),
  requirePermission('careerConnect.companies', 'view'),
  companyController.getById
);

router.put(
  '/companies/:id',
  requireInstitutionType('placement'),
  requirePermission('careerConnect.companies', 'edit'),
  validateBody(updateCompanySchema),
  companyController.update
);

router.delete(
  '/companies/:id',
  requireInstitutionType('placement'),
  requirePermission('careerConnect.companies', 'delete'),
  companyController.delete
);

router.put(
  '/companies/:id/status',
  requireInstitutionType('placement'),
  requirePermission('careerConnect.companies', 'edit'),
  validateBody(updateCompanyStatusSchema),
  companyController.updateStatus
);

// Company contacts
router.post(
  '/companies/:id/contacts',
  requireInstitutionType('placement'),
  requirePermission('careerConnect.companies', 'edit'),
  validateBody(addCompanyContactSchema),
  companyController.addContact
);

router.put(
  '/companies/:id/contacts/:contactId',
  requireInstitutionType('placement'),
  requirePermission('careerConnect.companies', 'edit'),
  validateBody(addCompanyContactSchema),
  companyController.updateContact
);

router.delete(
  '/companies/:id/contacts/:contactId',
  requireInstitutionType('placement'),
  requirePermission('careerConnect.companies', 'edit'),
  companyController.removeContact
);

// Company visits
router.post(
  '/companies/:id/visits',
  requireInstitutionType('placement'),
  requirePermission('careerConnect.companies', 'edit'),
  validateBody(addCompanyVisitSchema),
  companyController.addVisit
);

router.get(
  '/companies/:id/visits',
  requireInstitutionType('placement'),
  requirePermission('careerConnect.companies', 'view'),
  companyController.getVisits
);

// ============ Placement Drives (College/University only) ============

// Stats must be before :id to avoid matching 'stats' as an id
router.get(
  '/drives/stats',
  requireInstitutionType('placement'),
  requirePermission('careerConnect.drives', 'view'),
  driveController.getStats
);

router.get(
  '/drives',
  requireInstitutionType('placement'),
  requirePermission('careerConnect.drives', 'view'),
  validateQuery(driveQuerySchema),
  driveController.list
);

router.post(
  '/drives',
  requireInstitutionType('placement'),
  requirePermission('careerConnect.drives', 'create'),
  validateBody(createDriveSchema),
  driveController.create
);

router.get(
  '/drives/:id',
  requireInstitutionType('placement'),
  requirePermission('careerConnect.drives', 'view'),
  driveController.getById
);

router.put(
  '/drives/:id',
  requireInstitutionType('placement'),
  requirePermission('careerConnect.drives', 'edit'),
  validateBody(updateDriveSchema),
  driveController.update
);

router.delete(
  '/drives/:id',
  requireInstitutionType('placement'),
  requirePermission('careerConnect.drives', 'delete'),
  driveController.delete
);

router.put(
  '/drives/:id/status',
  requireInstitutionType('placement'),
  requirePermission('careerConnect.drives', 'edit'),
  validateBody(updateDriveStatusSchema),
  driveController.updateStatus
);

// Drive rounds
router.post(
  '/drives/:id/rounds',
  requireInstitutionType('placement'),
  requirePermission('careerConnect.drives', 'edit'),
  validateBody(addDriveRoundSchema),
  driveController.addRound
);

router.put(
  '/drives/:id/rounds/:roundId',
  requireInstitutionType('placement'),
  requirePermission('careerConnect.drives', 'edit'),
  validateBody(updateDriveRoundSchema),
  driveController.updateRound
);

router.delete(
  '/drives/:id/rounds/:roundId',
  requireInstitutionType('placement'),
  requirePermission('careerConnect.drives', 'edit'),
  driveController.removeRound
);

// Drive registrations
router.post(
  '/drives/:id/register',
  requireInstitutionType('placement'),
  requirePermission('careerConnect.drives', 'view'),
  driveController.registerStudent
);

router.delete(
  '/drives/:id/register/:studentId',
  requireInstitutionType('placement'),
  requirePermission('careerConnect.drives', 'edit'),
  driveController.unregisterStudent
);

router.get(
  '/drives/:id/registrations',
  requireInstitutionType('placement'),
  requirePermission('careerConnect.drives', 'view'),
  driveController.getRegistrations
);

// Round results
router.post(
  '/drives/:id/rounds/:roundId/results',
  requireInstitutionType('placement'),
  requirePermission('careerConnect.drives', 'manage_results'),
  validateBody(submitRoundResultsSchema),
  driveController.submitRoundResults
);

// Offers
router.post(
  '/drives/:id/offers',
  requireInstitutionType('placement'),
  requirePermission('careerConnect.drives', 'manage_results'),
  validateBody(createOfferSchema),
  offerController.createOffer
);

router.get(
  '/drives/:id/offers',
  requireInstitutionType('placement'),
  requirePermission('careerConnect.drives', 'view'),
  offerController.getOffersByDrive
);

router.put(
  '/offers/:offerId/respond',
  requireInstitutionType('placement'),
  requirePermission('careerConnect.drives', 'view'),
  validateBody(respondOfferSchema),
  offerController.respondToOffer
);

// ============ Job Board (College/University only) ============

router.get(
  '/jobs',
  requireInstitutionType('placement'),
  requirePermission('careerConnect.jobBoard', 'view'),
  validateQuery(jobPostingQuerySchema),
  jobPostingController.list
);

router.post(
  '/jobs',
  requireInstitutionType('placement'),
  requirePermission('careerConnect.jobBoard', 'create'),
  validateBody(createJobPostingSchema),
  jobPostingController.create
);

router.get(
  '/jobs/:id',
  requireInstitutionType('placement'),
  requirePermission('careerConnect.jobBoard', 'view'),
  jobPostingController.getById
);

router.put(
  '/jobs/:id',
  requireInstitutionType('placement'),
  requirePermission('careerConnect.jobBoard', 'edit'),
  validateBody(updateJobPostingSchema),
  jobPostingController.update
);

router.delete(
  '/jobs/:id',
  requireInstitutionType('placement'),
  requirePermission('careerConnect.jobBoard', 'delete'),
  jobPostingController.delete
);

router.put(
  '/jobs/:id/status',
  requireInstitutionType('placement'),
  requirePermission('careerConnect.jobBoard', 'edit'),
  jobPostingController.updateStatus
);

// Job applications
router.post(
  '/jobs/:id/apply',
  requireInstitutionType('placement'),
  requirePermission('careerConnect.jobBoard', 'apply'),
  validateBody(createJobApplicationSchema),
  jobApplicationController.apply
);

router.get(
  '/jobs/:id/applications',
  requireInstitutionType('placement'),
  requirePermission('careerConnect.jobBoard', 'manage_applications'),
  jobApplicationController.getByPosting
);

router.get(
  '/applications/my',
  requireInstitutionType('placement'),
  requirePermission('careerConnect.jobBoard', 'view'),
  jobApplicationController.getMyApplications
);

router.put(
  '/applications/:id/status',
  requireInstitutionType('placement'),
  requirePermission('careerConnect.jobBoard', 'manage_applications'),
  validateBody(updateJobApplicationStatusSchema),
  jobApplicationController.updateStatus
);

// ============ Student Career Profiles (College/University only) ============

router.get(
  '/student-profiles',
  requireInstitutionType('placement'),
  requirePermission('careerConnect.studentProfiles', 'view'),
  validateQuery(studentProfileQuerySchema),
  studentProfileController.listProfiles
);

// "My profile" must be before :studentId to avoid matching 'my' as a studentId
router.get(
  '/student-profiles/my',
  requireInstitutionType('placement'),
  requirePermission('careerConnect.studentProfiles', 'view'),
  studentProfileController.getMyProfile
);

router.get(
  '/student-profiles/:studentId',
  requireInstitutionType('placement'),
  requirePermission('careerConnect.studentProfiles', 'view'),
  studentProfileController.getProfile
);

router.put(
  '/student-profiles/:studentId',
  requireInstitutionType('placement'),
  requirePermission('careerConnect.studentProfiles', 'edit'),
  validateBody(updateStudentProfileSchema),
  studentProfileController.updateProfile
);

// Skills
router.post(
  '/student-profiles/:studentId/skills',
  requireInstitutionType('placement'),
  requirePermission('careerConnect.studentProfiles', 'edit'),
  validateBody(addSkillSchema),
  studentProfileController.addSkill
);

router.delete(
  '/student-profiles/:studentId/skills/:itemId',
  requireInstitutionType('placement'),
  requirePermission('careerConnect.studentProfiles', 'edit'),
  studentProfileController.removeSkill
);

// Certifications
router.post(
  '/student-profiles/:studentId/certifications',
  requireInstitutionType('placement'),
  requirePermission('careerConnect.studentProfiles', 'edit'),
  validateBody(addCertificationSchema),
  studentProfileController.addCertification
);

router.delete(
  '/student-profiles/:studentId/certifications/:itemId',
  requireInstitutionType('placement'),
  requirePermission('careerConnect.studentProfiles', 'edit'),
  studentProfileController.removeCertification
);

// Projects
router.post(
  '/student-profiles/:studentId/projects',
  requireInstitutionType('placement'),
  requirePermission('careerConnect.studentProfiles', 'edit'),
  validateBody(addProjectSchema),
  studentProfileController.addProject
);

router.delete(
  '/student-profiles/:studentId/projects/:itemId',
  requireInstitutionType('placement'),
  requirePermission('careerConnect.studentProfiles', 'edit'),
  studentProfileController.removeProject
);

// Experience
router.post(
  '/student-profiles/:studentId/experience',
  requireInstitutionType('placement'),
  requirePermission('careerConnect.studentProfiles', 'edit'),
  validateBody(addExperienceSchema),
  studentProfileController.addExperience
);

router.delete(
  '/student-profiles/:studentId/experience/:itemId',
  requireInstitutionType('placement'),
  requirePermission('careerConnect.studentProfiles', 'edit'),
  studentProfileController.removeExperience
);

// Preferences
router.put(
  '/student-profiles/:studentId/preferences',
  requireInstitutionType('placement'),
  requirePermission('careerConnect.studentProfiles', 'edit'),
  validateBody(updatePreferencesSchema),
  studentProfileController.updatePreferences
);

// ============ Career Counseling Sessions (School only) ============

router.get(
  '/counseling/sessions',
  requireInstitutionType('counseling'),
  requirePermission('careerConnect.counseling', 'view'),
  validateQuery(counselingSessionQuerySchema),
  counselingController.list
);

router.post(
  '/counseling/sessions',
  requireInstitutionType('counseling'),
  requirePermission('careerConnect.counseling', 'create'),
  validateBody(createCounselingSessionSchema),
  counselingController.create
);

router.get(
  '/counseling/sessions/:id',
  requireInstitutionType('counseling'),
  requirePermission('careerConnect.counseling', 'view'),
  counselingController.getById
);

router.put(
  '/counseling/sessions/:id',
  requireInstitutionType('counseling'),
  requirePermission('careerConnect.counseling', 'edit'),
  validateBody(updateCounselingSessionSchema),
  counselingController.update
);

router.delete(
  '/counseling/sessions/:id',
  requireInstitutionType('counseling'),
  requirePermission('careerConnect.counseling', 'delete'),
  counselingController.delete
);

// ============ Career Assessments (School only) ============

router.get(
  '/assessments',
  requireInstitutionType('counseling'),
  requirePermission('careerConnect.counseling', 'view'),
  validateQuery(assessmentQuerySchema),
  assessmentController.list
);

router.post(
  '/assessments',
  requireInstitutionType('counseling'),
  requirePermission('careerConnect.counseling', 'create'),
  validateBody(createAssessmentSchema),
  assessmentController.create
);

router.get(
  '/assessments/:id',
  requireInstitutionType('counseling'),
  requirePermission('careerConnect.counseling', 'view'),
  assessmentController.getById
);

router.put(
  '/assessments/:id',
  requireInstitutionType('counseling'),
  requirePermission('careerConnect.counseling', 'edit'),
  validateBody(updateAssessmentSchema),
  assessmentController.update
);

router.delete(
  '/assessments/:id',
  requireInstitutionType('counseling'),
  requirePermission('careerConnect.counseling', 'delete'),
  assessmentController.delete
);

// ============ Career Resources (School only) ============

router.get(
  '/resources',
  requireInstitutionType('counseling'),
  requirePermission('careerConnect.resources', 'view'),
  validateQuery(resourceQuerySchema),
  resourceController.list
);

router.post(
  '/resources',
  requireInstitutionType('counseling'),
  requirePermission('careerConnect.resources', 'create'),
  validateBody(createResourceSchema),
  resourceController.create
);

router.get(
  '/resources/:id',
  requireInstitutionType('counseling'),
  requirePermission('careerConnect.resources', 'view'),
  resourceController.getById
);

router.put(
  '/resources/:id',
  requireInstitutionType('counseling'),
  requirePermission('careerConnect.resources', 'edit'),
  validateBody(updateResourceSchema),
  resourceController.update
);

router.delete(
  '/resources/:id',
  requireInstitutionType('counseling'),
  requirePermission('careerConnect.resources', 'delete'),
  resourceController.delete
);

// ============ Alumni Network (All institution types) ============

router.get(
  '/alumni',
  requirePermission('careerConnect.alumni', 'view'),
  validateQuery(alumniQuerySchema),
  alumniProfileController.list
);

// Fixed paths must come before :id to avoid matching as an id parameter
router.get(
  '/alumni/my-profile',
  requirePermission('careerConnect.alumni', 'view'),
  alumniProfileController.getMyProfile
);

// Alumni Referrals (nested under /alumni/ — must be before /alumni/:id)
router.get(
  '/alumni/referrals',
  requirePermission('careerConnect.mentorship', 'view'),
  validateQuery(referralQuerySchema),
  referralController.list
);

router.post(
  '/alumni/referrals',
  requirePermission('careerConnect.mentorship', 'create'),
  validateBody(createReferralSchema),
  referralController.create
);

router.get(
  '/alumni/referrals/:id',
  requirePermission('careerConnect.mentorship', 'view'),
  referralController.getById
);

router.put(
  '/alumni/referrals/:id',
  requirePermission('careerConnect.mentorship', 'edit'),
  validateBody(updateReferralSchema),
  referralController.update
);

router.delete(
  '/alumni/referrals/:id',
  requirePermission('careerConnect.mentorship', 'delete'),
  referralController.delete
);

router.post(
  '/alumni/referrals/:id/refer',
  requirePermission('careerConnect.mentorship', 'edit'),
  validateBody(referStudentSchema),
  referralController.referStudent
);

// Alumni Events (nested under /alumni/ — must be before /alumni/:id)
router.get(
  '/alumni/events',
  requirePermission('careerConnect.events', 'view'),
  validateQuery(alumniEventQuerySchema),
  eventController.list
);

router.post(
  '/alumni/events',
  requirePermission('careerConnect.events', 'create'),
  validateBody(createAlumniEventSchema),
  eventController.create
);

router.get(
  '/alumni/events/:id',
  requirePermission('careerConnect.events', 'view'),
  eventController.getById
);

router.put(
  '/alumni/events/:id',
  requirePermission('careerConnect.events', 'edit'),
  validateBody(updateAlumniEventSchema),
  eventController.update
);

router.delete(
  '/alumni/events/:id',
  requirePermission('careerConnect.events', 'delete'),
  eventController.delete
);

router.put(
  '/alumni/events/:id/status',
  requirePermission('careerConnect.events', 'edit'),
  eventController.updateStatus
);

router.post(
  '/alumni/events/:id/register',
  requirePermission('careerConnect.events', 'register'),
  eventController.register
);

// Alumni profile by ID (after all fixed /alumni/* paths)
router.get(
  '/alumni/:id',
  requirePermission('careerConnect.alumni', 'view'),
  alumniProfileController.getById
);

router.put(
  '/alumni/:id',
  requirePermission('careerConnect.alumni', 'edit'),
  validateBody(updateAlumniProfileSchema),
  alumniProfileController.update
);

router.put(
  '/alumni/:id/verify',
  requirePermission('careerConnect.alumni', 'verify'),
  alumniProfileController.verify
);

// ============ Mentorship Programs (All institution types) ============

router.get(
  '/mentorship/programs',
  requirePermission('careerConnect.mentorship', 'view'),
  validateQuery(mentorshipQuerySchema),
  mentorshipController.list
);

router.post(
  '/mentorship/programs',
  requirePermission('careerConnect.mentorship', 'create'),
  validateBody(createMentorshipSchema),
  mentorshipController.create
);

router.get(
  '/mentorship/programs/:id',
  requirePermission('careerConnect.mentorship', 'view'),
  mentorshipController.getById
);

router.put(
  '/mentorship/programs/:id',
  requirePermission('careerConnect.mentorship', 'edit'),
  validateBody(updateMentorshipSchema),
  mentorshipController.update
);

router.delete(
  '/mentorship/programs/:id',
  requirePermission('careerConnect.mentorship', 'delete'),
  mentorshipController.delete
);

router.post(
  '/mentorship/programs/:id/sessions',
  requirePermission('careerConnect.mentorship', 'edit'),
  validateBody(addMentorshipSessionSchema),
  mentorshipController.addSession
);

// ============ Reports ============

// Placement reports (College/University only)
// Career Connect home: everything the hub page shows, in one read
router.get(
  '/hub',
  requireInstitutionType('placement'),
  requirePermission('careerConnect.drives', 'view'),
  async (req, res, next) => {
    try {
      success(res, await careerHubService.get(req.tenantId!, req.branchId!));
    } catch (e) {
      next(e);
    }
  }
);

router.get(
  '/reports/placement-summary',
  requireInstitutionType('placement'),
  requirePermission('careerConnect.reports', 'view'),
  placementReportController.getSummary
);

router.get(
  '/reports/company-wise',
  requireInstitutionType('placement'),
  requirePermission('careerConnect.reports', 'view'),
  placementReportController.getCompanyWise
);

router.get(
  '/reports/department-wise',
  requireInstitutionType('placement'),
  requirePermission('careerConnect.reports', 'view'),
  placementReportController.getDepartmentWise
);

router.get(
  '/reports/salary-analysis',
  requireInstitutionType('placement'),
  requirePermission('careerConnect.reports', 'view'),
  placementReportController.getSalaryAnalysis
);

router.get(
  '/reports/placement-trends',
  requireInstitutionType('placement'),
  requirePermission('careerConnect.reports', 'view'),
  placementReportController.getTrends
);

// Counseling reports (School only)
router.get(
  '/reports/counseling-summary',
  requireInstitutionType('counseling'),
  requirePermission('careerConnect.reports', 'view'),
  counselingReportController.getSummary
);

router.get(
  '/reports/assessment-analytics',
  requireInstitutionType('counseling'),
  requirePermission('careerConnect.reports', 'view'),
  counselingReportController.getAssessmentAnalytics
);

// Alumni reports (All institution types)
router.get(
  '/reports/alumni-demographics',
  requirePermission('careerConnect.reports', 'view'),
  alumniReportController.getDemographics
);

router.get(
  '/reports/mentorship-impact',
  requirePermission('careerConnect.reports', 'view'),
  alumniReportController.getMentorshipImpact
);

export default router;
