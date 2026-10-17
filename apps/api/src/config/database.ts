import { MongoClient, Db, Collection, Document } from 'mongodb';
import { logger } from '../lib/logger';
import { env } from './env';

let client: MongoClient;
let db: Db;

export async function connectDatabase(): Promise<Db> {
  if (db) return db;

  client = new MongoClient(env.MONGODB_URI, {
    maxPoolSize: 50,
    minPoolSize: 10,
    maxIdleTimeMS: 30000,
    connectTimeoutMS: 10000,
    socketTimeoutMS: 45000,
  });

  try {
    await client.connect();
    db = client.db();

    // Verify connection
    await db.command({ ping: 1 });
    logger.info('Connected to MongoDB');

    return db;
  } catch (error) {
    logger.error({ err: error }, 'MongoDB connection failed');
    throw error;
  }
}

export function getDb(): Db {
  if (!db) throw new Error('Database not initialized. Call connectDatabase() first.');
  return db;
}

export async function closeDatabase(): Promise<void> {
  if (client) {
    await client.close();
    logger.info('MongoDB connection closed');
  }
}

// Type-safe collection getters
interface Collections {
  tenants: Collection<Document>;
  institutions: Collection<Document>;
  branches: Collection<Document>;
  programs: Collection<Document>;
  teachingAssignments: Collection<Document>;
  scholarships: Collection<Document>;
  promotionPolicies: Collection<Document>;
  staffPromotions: Collection<Document>;
  users: Collection<Document>;
  roles: Collection<Document>;
  academicBatches: Collection<Document>;
  classes: Collection<Document>;
  sections: Collection<Document>;
  subjects: Collection<Document>;
  programSchemes: Collection<Document>;
  courseRegistrations: Collection<Document>;
  students: Collection<Document>;
  studentEnrollments: Collection<Document>;
  bulkUploads: Collection<Document>;
  leads: Collection<Document>;
  applications: Collection<Document>;
  feeStructures: Collection<Document>;
  feeAssignments: Collection<Document>;
  feeTransactions: Collection<Document>;
  concessions: Collection<Document>;
  studentAttendance: Collection<Document>;
  staff: Collection<Document>;
  staffAttendance: Collection<Document>;
  leaves: Collection<Document>;
  leaveBalances: Collection<Document>;
  departments: Collection<Document>;
  designations: Collection<Document>;
  announcements: Collection<Document>;
  events: Collection<Document>;
  smsLogs: Collection<Document>;
  certificateTypes: Collection<Document>;
  certificateRequests: Collection<Document>;
  idCardTemplates: Collection<Document>;
  idCardDesigns: Collection<Document>;
  auditLogs: Collection<Document>;
  aiConversations: Collection<Document>;
  settings: Collection<Document>;
  counters: Collection<Document>;
  // Super Admin & Signup
  superAdmins: Collection<Document>;
  organizationSignups: Collection<Document>;
  pendingOrganizations: Collection<Document>;
  // New collections for Modules 1 & 2
  branchSettings: Collection<Document>;
  scheduledJobs: Collection<Document>;
  jobExecutions: Collection<Document>;
  customFields: Collection<Document>;
  approvalAudits: Collection<Document>;
  approvalSettings: Collection<Document>;
  holidays: Collection<Document>;
  admissionSettings: Collection<Document>;
  admissionSources: Collection<Document>;
  admissionAgents: Collection<Document>;
  forms: Collection<Document>;
  formSubmissions: Collection<Document>;
  hrSettings: Collection<Document>;
  financeSettings: Collection<Document>;
  communicationSettings: Collection<Document>;
  attendanceSettings: Collection<Document>;
  certificateSettings: Collection<Document>;
  resignations: Collection<Document>;
  // Finance approval & wallet
  approvalRequests: Collection<Document>;
  wallets: Collection<Document>;
  walletTransactions: Collection<Document>;
  // File uploads
  uploads: Collection<Document>;
  // Health module
  healthRecords: Collection<Document>;
  healthCheckups: Collection<Document>;
  healthCheckupCampaigns: Collection<Document>;
  vaccinations: Collection<Document>;
  medicalVisits: Collection<Document>;
  healthSettings: Collection<Document>;
  // Teaching module
  timetableSlots: Collection<Document>;
  timetableEntries: Collection<Document>;
  lessonPlans: Collection<Document>;
  assignments: Collection<Document>;
  grades: Collection<Document>;
  questionnaires: Collection<Document>;
  questionnaireSubmissions: Collection<Document>;
  assignmentSubmissions: Collection<Document>;
  // Live classes
  liveClasses: Collection<Document>;
  liveClassParticipants: Collection<Document>;
  liveClassMessages: Collection<Document>;
  liveClassPolls: Collection<Document>;
  liveClassPollResponses: Collection<Document>;
  liveClassWhiteboardSnapshots: Collection<Document>;
  webhookEvents: Collection<Document>;
  // Career Connect module
  placementCompanies: Collection<Document>;
  placementDrives: Collection<Document>;
  placementDriveResults: Collection<Document>;
  placementOffers: Collection<Document>;
  jobPostings: Collection<Document>;
  jobApplications: Collection<Document>;
  studentCareerProfiles: Collection<Document>;
  careerCounselingSessions: Collection<Document>;
  careerAssessments: Collection<Document>;
  careerResources: Collection<Document>;
  alumniProfiles: Collection<Document>;
  mentorshipPrograms: Collection<Document>;
  alumniReferrals: Collection<Document>;
  alumniEvents: Collection<Document>;
  careerConnectSettings: Collection<Document>;
  // Courses & Online Teaching module
  courses: Collection<Document>;
  lessons: Collection<Document>;
  quizzes: Collection<Document>;
  courseEnrollments: Collection<Document>;
  lessonProgress: Collection<Document>;
  quizAttempts: Collection<Document>;
  courseSettings: Collection<Document>;
  // Hostel module
  hostels: Collection<Document>;
  rooms: Collection<Document>;
  bedAllocations: Collection<Document>;
  hostelSettings: Collection<Document>;
  // Infrastructure module
  buildings: Collection<Document>;
  infrastructureRooms: Collection<Document>;
  // Payroll module
  salaryStructures: Collection<Document>;
  staffSalaryAssignments: Collection<Document>;
  payrollRuns: Collection<Document>;
  payslips: Collection<Document>;
  // Campus Feed module
  feedPosts: Collection<Document>;
  // Inventory module
  assets: Collection<Document>;
  assetCategories: Collection<Document>;
  procurements: Collection<Document>;
  assetIssues: Collection<Document>;
  inventorySettings: Collection<Document>;
  // Expense module
  expenses: Collection<Document>;
  budgets: Collection<Document>;
  reimbursements: Collection<Document>;
  expenseSettings: Collection<Document>;
  // Visitor module
  visitors: Collection<Document>;
  visitorPasses: Collection<Document>;
  visitorSettings: Collection<Document>;
  // Feedback module
  feedbackTickets: Collection<Document>;
  // Transport module
  transportBuses: Collection<Document>;
  transportEnrollments: Collection<Document>;
  transportSettings: Collection<Document>;
  // Marketing / Demo leads (public site)
  marketingLeads: Collection<Document>;
  marketingLeadSettings: Collection<Document>;
  // Blog (public site)
  blogPosts: Collection<Document>;
  // Careers (public site)
  careerVacancies: Collection<Document>;
  careerApplications: Collection<Document>;
  // Exams module
  examSettings: Collection<Document>;
  exams: Collection<Document>;
  examSchedules: Collection<Document>;
  examResults: Collection<Document>;
  coScholasticResults: Collection<Document>;
  reportCards: Collection<Document>;
  hallTickets: Collection<Document>;
  promotionRuns: Collection<Document>;
  // OBE module
  obeSettings: Collection<Document>;
  obePrograms: Collection<Document>;
  obeCourseOutcomes: Collection<Document>;
  obeOfferings: Collection<Document>;
  obeInstruments: Collection<Document>;
  obeMarks: Collection<Document>;
  obeSurveyResponses: Collection<Document>;
  obeAttainments: Collection<Document>;
}

export const collections: Collections = {
  get tenants() {
    return getDb().collection('tenants');
  },
  get branches() {
    return getDb().collection('branches');
  },
  get institutions() {
    return getDb().collection('institutions');
  },
  get programs() {
    return getDb().collection('programs');
  },
  get teachingAssignments() {
    return getDb().collection('teaching_assignments');
  },
  get scholarships() {
    return getDb().collection('scholarships');
  },
  get promotionPolicies() {
    return getDb().collection('promotion_policies');
  },
  get staffPromotions() {
    return getDb().collection('staff_promotions');
  },
  get users() {
    return getDb().collection('users');
  },
  get roles() {
    return getDb().collection('roles');
  },
  get academicBatches() {
    return getDb().collection('academic_batches');
  },
  get classes() {
    return getDb().collection('classes');
  },
  get sections() {
    return getDb().collection('sections');
  },
  get subjects() {
    return getDb().collection('subjects');
  },
  get programSchemes() {
    return getDb().collection('program_schemes');
  },
  get courseRegistrations() {
    return getDb().collection('course_registrations');
  },
  get students() {
    return getDb().collection('students');
  },
  get studentEnrollments() {
    return getDb().collection('student_enrollments');
  },
  get bulkUploads() {
    return getDb().collection('bulk_uploads');
  },
  get leads() {
    return getDb().collection('leads');
  },
  get applications() {
    return getDb().collection('applications');
  },
  get feeStructures() {
    return getDb().collection('fee_structures');
  },
  get feeAssignments() {
    return getDb().collection('fee_assignments');
  },
  get feeTransactions() {
    return getDb().collection('fee_transactions');
  },
  get concessions() {
    return getDb().collection('concessions');
  },
  get studentAttendance() {
    return getDb().collection('student_attendance');
  },
  get staff() {
    return getDb().collection('staff');
  },
  get staffAttendance() {
    return getDb().collection('staff_attendance');
  },
  get leaves() {
    return getDb().collection('leaves');
  },
  get leaveBalances() {
    return getDb().collection('leave_balances');
  },
  get departments() {
    return getDb().collection('departments');
  },
  get designations() {
    return getDb().collection('designations');
  },
  get announcements() {
    return getDb().collection('announcements');
  },
  get events() {
    return getDb().collection('events');
  },
  get smsLogs() {
    return getDb().collection('sms_logs');
  },
  get certificateTypes() {
    return getDb().collection('certificate_types');
  },
  get certificateRequests() {
    return getDb().collection('certificate_requests');
  },
  get idCardTemplates() {
    return getDb().collection('id_card_templates');
  },
  get idCardDesigns() {
    return getDb().collection('id_card_designs');
  },
  get auditLogs() {
    return getDb().collection('audit_logs');
  },
  get aiConversations() {
    return getDb().collection('ai_conversations');
  },
  get settings() {
    return getDb().collection('settings');
  },
  get counters() {
    return getDb().collection('counters');
  },
  // Super Admin & Signup
  get superAdmins() {
    return getDb().collection('super_admins');
  },
  get organizationSignups() {
    return getDb().collection('organization_signups');
  },
  get pendingOrganizations() {
    return getDb().collection('pending_organizations');
  },
  // New collections for Modules 1 & 2
  get branchSettings() {
    return getDb().collection('branch_settings');
  },
  get scheduledJobs() {
    return getDb().collection('scheduled_jobs');
  },
  get jobExecutions() {
    return getDb().collection('job_executions');
  },
  get customFields() {
    return getDb().collection('custom_fields');
  },
  get approvalAudits() {
    return getDb().collection('approval_audits');
  },
  get approvalSettings() {
    return getDb().collection('approval_settings');
  },
  get holidays() {
    return getDb().collection('holidays');
  },
  get admissionSettings() {
    return getDb().collection('admission_settings');
  },
  get admissionSources() {
    return getDb().collection('admission_sources');
  },
  get admissionAgents() {
    return getDb().collection('admission_agents');
  },
  get forms() {
    return getDb().collection('forms');
  },
  get formSubmissions() {
    return getDb().collection('form_submissions');
  },
  get hrSettings() {
    return getDb().collection('hr_settings');
  },
  get financeSettings() {
    return getDb().collection('finance_settings');
  },
  get communicationSettings() {
    return getDb().collection('communication_settings');
  },
  get attendanceSettings() {
    return getDb().collection('attendance_settings');
  },
  get certificateSettings() {
    return getDb().collection('certificate_settings');
  },
  get resignations() {
    return getDb().collection('resignations');
  },
  // Finance approval & wallet
  get approvalRequests() {
    return getDb().collection('approval_requests');
  },
  get wallets() {
    return getDb().collection('wallets');
  },
  get walletTransactions() {
    return getDb().collection('wallet_transactions');
  },
  // File uploads
  get uploads() {
    return getDb().collection('uploads');
  },
  // Health module
  get healthRecords() {
    return getDb().collection('health_records');
  },
  get healthCheckups() {
    return getDb().collection('health_checkups');
  },
  get healthCheckupCampaigns() {
    return getDb().collection('health_checkup_campaigns');
  },
  get vaccinations() {
    return getDb().collection('vaccinations');
  },
  get medicalVisits() {
    return getDb().collection('medical_visits');
  },
  get healthSettings() {
    return getDb().collection('health_settings');
  },
  // Teaching module
  get timetableSlots() {
    return getDb().collection('timetable_slots');
  },
  get timetableEntries() {
    return getDb().collection('timetable_entries');
  },
  get lessonPlans() {
    return getDb().collection('lesson_plans');
  },
  get assignments() {
    return getDb().collection('assignments');
  },
  get grades() {
    return getDb().collection('grades');
  },
  get questionnaires() {
    return getDb().collection('questionnaires');
  },
  get questionnaireSubmissions() {
    return getDb().collection('questionnaire_submissions');
  },
  get assignmentSubmissions() {
    return getDb().collection('assignment_submissions');
  },
  // Live classes
  get liveClasses() {
    return getDb().collection('live_classes');
  },
  get liveClassParticipants() {
    return getDb().collection('live_class_participants');
  },
  get liveClassMessages() {
    return getDb().collection('live_class_messages');
  },
  get liveClassPolls() {
    return getDb().collection('live_class_polls');
  },
  get liveClassPollResponses() {
    return getDb().collection('live_class_poll_responses');
  },
  get liveClassWhiteboardSnapshots() {
    return getDb().collection('live_class_whiteboard_snapshots');
  },
  get webhookEvents() {
    return getDb().collection('webhook_events');
  },
  // Career Connect module
  get placementCompanies() {
    return getDb().collection('placement_companies');
  },
  get placementDrives() {
    return getDb().collection('placement_drives');
  },
  get placementDriveResults() {
    return getDb().collection('placement_drive_results');
  },
  get placementOffers() {
    return getDb().collection('placement_offers');
  },
  get jobPostings() {
    return getDb().collection('job_postings');
  },
  get jobApplications() {
    return getDb().collection('job_applications');
  },
  get studentCareerProfiles() {
    return getDb().collection('student_career_profiles');
  },
  get careerCounselingSessions() {
    return getDb().collection('career_counseling_sessions');
  },
  get careerAssessments() {
    return getDb().collection('career_assessments');
  },
  get careerResources() {
    return getDb().collection('career_resources');
  },
  get alumniProfiles() {
    return getDb().collection('alumni_profiles');
  },
  get mentorshipPrograms() {
    return getDb().collection('mentorship_programs');
  },
  get alumniReferrals() {
    return getDb().collection('alumni_referrals');
  },
  get alumniEvents() {
    return getDb().collection('alumni_events');
  },
  get careerConnectSettings() {
    return getDb().collection('career_connect_settings');
  },
  // Courses & Online Teaching module
  get courses() {
    return getDb().collection('courses');
  },
  get lessons() {
    return getDb().collection('lessons');
  },
  get quizzes() {
    return getDb().collection('quizzes');
  },
  get courseEnrollments() {
    return getDb().collection('course_enrollments');
  },
  get lessonProgress() {
    return getDb().collection('lesson_progress');
  },
  get quizAttempts() {
    return getDb().collection('quiz_attempts');
  },
  get courseSettings() {
    return getDb().collection('course_settings');
  },
  // Hostel module
  get hostels() {
    return getDb().collection('hostels');
  },
  get rooms() {
    return getDb().collection('rooms');
  },
  get bedAllocations() {
    return getDb().collection('bed_allocations');
  },
  get hostelSettings() {
    return getDb().collection('hostel_settings');
  },
  // Infrastructure module
  get buildings() {
    return getDb().collection('buildings');
  },
  get infrastructureRooms() {
    return getDb().collection('infrastructure_rooms');
  },
  // Payroll module
  get salaryStructures() {
    return getDb().collection('salary_structures');
  },
  get staffSalaryAssignments() {
    return getDb().collection('staff_salary_assignments');
  },
  get payrollRuns() {
    return getDb().collection('payroll_runs');
  },
  get payslips() {
    return getDb().collection('payslips');
  },
  // Campus Feed module
  get feedPosts() {
    return getDb().collection('feed_posts');
  },
  // Inventory module
  get assets() {
    return getDb().collection('assets');
  },
  get assetCategories() {
    return getDb().collection('asset_categories');
  },
  get procurements() {
    return getDb().collection('procurements');
  },
  get assetIssues() {
    return getDb().collection('asset_issues');
  },
  get inventorySettings() {
    return getDb().collection('inventory_settings');
  },
  // Expense module
  get expenses() {
    return getDb().collection('expenses');
  },
  get budgets() {
    return getDb().collection('budgets');
  },
  get reimbursements() {
    return getDb().collection('reimbursements');
  },
  get expenseSettings() {
    return getDb().collection('expense_settings');
  },
  // Visitor module
  get visitors() {
    return getDb().collection('visitors');
  },
  get visitorPasses() {
    return getDb().collection('visitor_passes');
  },
  get visitorSettings() {
    return getDb().collection('visitor_settings');
  },
  // Feedback module
  get feedbackTickets() {
    return getDb().collection('feedback_tickets');
  },
  // Transport module
  get transportBuses() {
    return getDb().collection('transport_buses');
  },
  get transportEnrollments() {
    return getDb().collection('transport_enrollments');
  },
  get transportSettings() {
    return getDb().collection('transport_settings');
  },
  // Marketing / Demo leads
  get marketingLeads() {
    return getDb().collection('marketing_leads');
  },
  get marketingLeadSettings() {
    return getDb().collection('marketing_lead_settings');
  },
  // Blog
  get blogPosts() {
    return getDb().collection('blog_posts');
  },
  // Careers
  get careerVacancies() {
    return getDb().collection('career_vacancies');
  },
  get careerApplications() {
    return getDb().collection('career_applications');
  },
  // Exams module
  get examSettings() {
    return getDb().collection('exam_settings');
  },
  get exams() {
    return getDb().collection('exams');
  },
  get examSchedules() {
    return getDb().collection('exam_schedules');
  },
  get examResults() {
    return getDb().collection('exam_results');
  },
  get coScholasticResults() {
    return getDb().collection('co_scholastic_results');
  },
  get reportCards() {
    return getDb().collection('report_cards');
  },
  get hallTickets() {
    return getDb().collection('hall_tickets');
  },
  get promotionRuns() {
    return getDb().collection('promotion_runs');
  },
  // OBE module
  get obeSettings() {
    return getDb().collection('obe_settings');
  },
  get obePrograms() {
    return getDb().collection('obe_programs');
  },
  get obeCourseOutcomes() {
    return getDb().collection('obe_course_outcomes');
  },
  get obeOfferings() {
    return getDb().collection('obe_offerings');
  },
  get obeInstruments() {
    return getDb().collection('obe_instruments');
  },
  get obeMarks() {
    return getDb().collection('obe_marks');
  },
  get obeSurveyResponses() {
    return getDb().collection('obe_survey_responses');
  },
  get obeAttainments() {
    return getDb().collection('obe_attainments');
  },
};
