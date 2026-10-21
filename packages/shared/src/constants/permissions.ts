/**
 * Permissions an admin switches on or off per role in the Roles editor, where
 * the saved role is the only source of truth. Login normally tops built-in
 * operational roles up with their canonical set (so new modules appear without
 * a migration); for these keys that would undo the admin's choice, so they are
 * left out of the top-up. Defaults still come from the role sets below at seed.
 */
export const ADMIN_TOGGLED_PERMISSIONS: readonly string[] = ['dashboard.fees'];

/**
 * Full permissions - all actions for all modules
 * Used by: ORG_OWNER, ORG_MODERATOR
 */
export const PERMISSIONS = {
  // Organization
  'organization.branches': ['view', 'create', 'edit', 'delete'],
  'organization.users': ['view', 'create', 'edit', 'delete', 'reset-password'],
  'organization.roles': ['view', 'create', 'edit', 'delete'],
  'organization.settings': ['view', 'edit', 'delete'],
  // Institutions, departments, programs, academic years, classes, sections, subjects.
  'organization.academics': ['view', 'create', 'edit', 'delete'],
  'organization.infrastructure': ['view', 'create', 'edit', 'delete'],

  // Students
  'students.list': ['view', 'create', 'edit', 'delete', 'bulk-upload', 'export'],
  'students.details': ['view', 'edit'],
  'students.enrollment': ['view', 'create', 'edit'],
  'students.promotion': ['view', 'create'],
  'students.reports': ['view', 'export'],
  // Fee details (dues, payments, installments) wherever a student profile is shown.
  'students.fees': ['view'],

  // Admissions
  'admissions.leads': ['view', 'create', 'edit', 'delete', 'assign', 'convert'],
  'admissions.applications': ['view', 'create', 'edit', 'approve', 'reject', 'enroll'],
  'admissions.settings': ['view', 'edit'],
  'admissions.reports': ['view', 'export'],

  // Finance
  'finance.feeCounter': ['view', 'collect', 'cancel', 'refund'],
  'finance.feeStructures': ['view', 'create', 'edit', 'delete'],
  'finance.collections': ['view', 'export'],
  'finance.dues': ['view', 'export'],
  'finance.concessions': ['view', 'create', 'approve', 'reject'],
  'finance.scholarships': ['view', 'create', 'edit', 'approve', 'reject'],
  'finance.reports': ['view', 'export'],
  'finance.settings': ['view', 'edit'],
  'finance.structures': ['view', 'create', 'edit', 'delete'],
  'finance.assignments': ['view', 'create', 'edit', 'delete'],
  'finance.transactions': ['view', 'create', 'edit'],
  'finance.wallets': ['view', 'create', 'edit'],
  'finance.approvals': ['view', 'edit'],

  // Attendance
  'attendance.mark': ['view', 'create', 'edit'],
  'attendance.view': ['view'],
  'attendance.reports': ['view', 'export'],
  'attendance.settings': ['view', 'edit'],

  // HR
  'hr.staff': ['view', 'create', 'edit', 'delete'],
  'hr.attendance': ['view', 'create', 'edit'],
  'hr.leaves': ['view', 'create', 'approve', 'reject'],
  'hr.promotions': ['view', 'create', 'approve', 'reject'],
  'hr.workload': ['view', 'create', 'edit'],
  'hr.payroll': ['view', 'create', 'edit', 'finalize', 'pay'],
  'hr.payslips': ['view'],
  'hr.settings': ['view', 'edit'],

  // Health
  'health.records': ['view', 'create', 'edit', 'delete'],
  'health.checkups': ['view', 'create', 'edit', 'delete'],
  'health.vaccinations': ['view', 'create', 'edit', 'delete'],
  'health.visits': ['view', 'create', 'edit', 'delete'],
  'health.reports': ['view', 'export'],
  'health.settings': ['view', 'edit'],
  // Upcoming partner benefits: cInsurance and Pharma-C.
  'health.benefits': ['view'],

  // Certificates
  'certificates.types': ['view', 'create', 'edit', 'delete'],
  'certificates.requests': ['view', 'create', 'edit', 'delete', 'approve', 'reject'],
  'certificates.idcards': ['view', 'create', 'edit', 'delete'],
  'certificates.settings': ['view', 'edit'],

  // Communications
  'communications.sms': ['view', 'send'],
  'communications.announcements': ['view', 'create', 'edit', 'delete', 'publish'],
  'communications.calendar': ['view', 'create', 'edit', 'delete'],
  'communications.settings': ['view', 'edit'],
  'communications.reports': ['view', 'export'],

  // Teaching
  'teaching.myClasses': ['view'],
  'teaching.myStudents': ['view'],
  'teaching.timetable': ['view', 'create', 'edit', 'delete'],
  'teaching.lessonPlans': ['view', 'create', 'edit', 'delete'],
  'teaching.assignments': ['view', 'create', 'edit', 'delete'],
  'teaching.grades': ['view', 'create', 'edit'],
  'teaching.liveClasses': ['view', 'create', 'edit', 'delete'],

  // Career Connect
  'careerConnect.companies': ['view', 'create', 'edit', 'delete'],
  'careerConnect.drives': ['view', 'create', 'edit', 'delete', 'manage_results'],
  'careerConnect.jobBoard': ['view', 'create', 'edit', 'delete', 'apply', 'manage_applications'],
  'careerConnect.studentProfiles': ['view', 'create', 'edit', 'delete', 'export'],
  'careerConnect.counseling': ['view', 'create', 'edit', 'delete', 'conduct'],
  'careerConnect.resources': ['view', 'create', 'edit', 'delete', 'publish'],
  'careerConnect.alumni': ['view', 'create', 'edit', 'delete', 'verify'],
  'careerConnect.mentorship': ['view', 'create', 'edit', 'delete', 'participate'],
  'careerConnect.events': ['view', 'create', 'edit', 'delete', 'register'],
  'careerConnect.reports': ['view', 'export'],
  'careerConnect.settings': ['view', 'edit'],

  // Courses & Online Teaching
  'courses.courses': ['view', 'create', 'edit', 'delete', 'approve'],
  'courses.lessons': ['view', 'create', 'edit', 'delete'],
  'courses.quizzes': ['view', 'create', 'edit', 'delete'],
  'courses.enrollments': ['view', 'create', 'edit', 'delete'],
  'courses.progress': ['view'],
  'courses.reports': ['view', 'export'],
  'courses.settings': ['view', 'edit'],

  // Course Registration (universities/colleges — CBCS/NEP schemes)
  'registration.schemes': ['view', 'create', 'edit', 'delete', 'publish'],
  'registration.registrations': ['view', 'export', 'override'],
  'registration.self': ['view', 'create', 'edit'],

  // Hostel
  'hostel.hostels': ['view', 'create', 'edit', 'delete'],
  'hostel.rooms': ['view', 'create', 'edit', 'delete'],
  'hostel.allocations': ['view', 'create', 'edit', 'transfer', 'vacate'],
  'hostel.reports': ['view', 'export'],
  'hostel.settings': ['view', 'edit'],

  // Campus Feed
  'campusFeed.posts': ['view', 'create', 'edit', 'delete', 'pin', 'flag', 'moderate'],

  // Clubs: everyone signed in can browse and join; these let a role run them.
  'clubs.manage': ['create', 'edit'],

  // Inventory
  'inventory.assets': ['view', 'create', 'edit', 'delete'],
  'inventory.categories': ['view', 'create', 'edit', 'delete'],
  'inventory.procurement': ['view', 'create', 'edit', 'approve'],
  'inventory.issue': ['view', 'create', 'edit', 'return'],
  'inventory.reports': ['view', 'export'],
  'inventory.settings': ['view', 'edit'],

  // Expense Management
  'expense.requests': ['view', 'create', 'edit', 'delete'],
  'expense.approvals': ['view', 'approve', 'reject'],
  'expense.reimbursements': ['view', 'create', 'edit', 'process'],
  'expense.budgets': ['view', 'create', 'edit', 'delete'],
  'expense.reports': ['view', 'export'],
  'expense.settings': ['view', 'edit'],

  // Visitor Management
  'visitor.visitors': ['view', 'create', 'edit', 'delete'],
  'visitor.passes': ['view', 'create', 'revoke'],
  'visitor.logs': ['view', 'export'],
  'visitor.dashboard': ['view'],
  'visitor.settings': ['view', 'edit'],

  // Concerns & Feedback
  'feedback.tickets': ['view', 'edit', 'delete', 'assign', 'resolve', 'escalate'],
  'feedback.reports': ['view', 'export'],

  // Transport
  'transport.buses': ['view', 'create', 'edit', 'delete'],
  'transport.stops': ['view', 'create', 'edit', 'delete'],
  'transport.enrollments': ['view', 'create', 'edit', 'withdraw'],
  'transport.reports': ['view', 'export'],
  'transport.settings': ['view', 'edit'],

  // Exams & Report Cards
  'exams.config': ['view', 'edit'],
  'exams.exams': ['view', 'create', 'edit', 'delete'],
  'exams.schedules': ['view', 'create', 'edit', 'delete'],
  'exams.marks': ['view', 'create', 'edit'],
  'exams.results': ['view', 'publish'],
  'exams.reportCards': ['view', 'generate', 'publish'],
  'exams.hallTickets': ['view', 'generate'],
  'exams.promotion': ['view', 'commit'],

  // OBE Attainment (CO/PO/PSO)
  'obe.programs': ['view', 'create', 'edit', 'delete'],
  'obe.outcomes': ['view', 'create', 'edit', 'delete'],
  'obe.offerings': ['view', 'create', 'edit', 'delete', 'finalize'],
  'obe.marks': ['view', 'create', 'edit', 'import'],
  'obe.attainment': ['view', 'compute', 'edit'],
  'obe.surveys': ['view', 'manage', 'submit'],
  'obe.reports': ['view', 'export'],
  'obe.settings': ['view', 'edit'],

  // Dashboard
  'dashboard.ownerView': ['view'],
  'dashboard.branchView': ['view'],
  'dashboard.fees': ['view'],
  'dashboard.reports': ['view', 'create', 'export'],
  'dashboard.audit': ['view', 'export'],

  // Reports
  'reports.view': ['view'],
  'reports.export': ['export'],

  // AI Assistant — the chat-over-your-data assistant. The assistant only ever
  // exposes the data-query tools a user is already permitted for, so this is a
  // soft on/off switch for the feature rather than the real data gate.
  'ai.assistant': ['use'],
} as const;

/**
 * Org Admin permissions - full operational access within the organization
 * Used by: ORG_ADMIN
 */
export const ORG_ADMIN_PERMISSIONS: Record<string, string[]> = {
  // Organization - limited (can view branches, manage users, but not create branches)
  'organization.branches': ['view'],
  'organization.users': ['view', 'create', 'edit', 'delete', 'reset-password'],
  'organization.roles': ['view'],
  'organization.settings': ['view'],
  // Institutions, departments, programs, academic years, classes, sections, subjects.
  'organization.academics': ['view', 'create', 'edit', 'delete'],
  'organization.infrastructure': ['view', 'create', 'edit', 'delete'],

  // Full access to operational modules
  'students.list': ['view', 'create', 'edit', 'delete', 'bulk-upload', 'export'],
  'students.details': ['view', 'edit'],
  'students.enrollment': ['view', 'create', 'edit'],
  'students.promotion': ['view', 'create'],
  'students.reports': ['view', 'export'],

  'admissions.leads': ['view', 'create', 'edit', 'delete', 'assign', 'convert'],
  'admissions.applications': ['view', 'create', 'edit', 'approve', 'reject', 'enroll'],
  'admissions.settings': ['view', 'edit'],
  'admissions.reports': ['view', 'export'],

  'finance.feeCounter': ['view', 'collect', 'cancel', 'refund'],
  'finance.feeStructures': ['view', 'create', 'edit', 'delete'],
  'finance.collections': ['view', 'export'],
  'finance.dues': ['view', 'export'],
  'finance.concessions': ['view', 'create', 'approve', 'reject'],
  'finance.scholarships': ['view', 'create', 'edit', 'approve', 'reject'],
  'finance.reports': ['view', 'export'],
  'finance.settings': ['view', 'edit'],
  'finance.structures': ['view', 'create', 'edit', 'delete'],
  'finance.assignments': ['view', 'create', 'edit', 'delete'],
  'finance.transactions': ['view', 'create', 'edit'],
  'finance.wallets': ['view', 'create', 'edit'],
  'finance.approvals': ['view', 'edit'],

  'attendance.mark': ['view', 'create', 'edit'],
  'attendance.view': ['view'],
  'attendance.reports': ['view', 'export'],
  'attendance.settings': ['view', 'edit'],

  'hr.staff': ['view', 'create', 'edit', 'delete'],
  'hr.attendance': ['view', 'create', 'edit'],
  'hr.leaves': ['view', 'create', 'approve', 'reject'],
  'hr.promotions': ['view', 'create', 'approve', 'reject'],
  'hr.workload': ['view', 'create', 'edit'],
  'hr.payroll': ['view', 'create', 'edit', 'finalize', 'pay'],
  'hr.payslips': ['view'],
  'hr.settings': ['view', 'edit'],

  // Health - full access for org admin
  'health.records': ['view', 'create', 'edit', 'delete'],
  'health.checkups': ['view', 'create', 'edit', 'delete'],
  'health.vaccinations': ['view', 'create', 'edit', 'delete'],
  'health.visits': ['view', 'create', 'edit', 'delete'],
  'health.reports': ['view', 'export'],
  'health.settings': ['view', 'edit'],

  // Certificates - full access for org admin
  'certificates.types': ['view', 'create', 'edit', 'delete'],
  'certificates.requests': ['view', 'create', 'edit', 'delete', 'approve', 'reject'],
  'certificates.idcards': ['view', 'create', 'edit', 'delete'],
  'certificates.settings': ['view', 'edit'],

  // Teaching - full access for org admin
  'teaching.myClasses': ['view'],
  'teaching.myStudents': ['view'],
  'teaching.timetable': ['view', 'create', 'edit', 'delete'],
  'teaching.lessonPlans': ['view', 'create', 'edit', 'delete'],
  'teaching.assignments': ['view', 'create', 'edit', 'delete'],
  'teaching.grades': ['view', 'create', 'edit'],
  'teaching.liveClasses': ['view', 'create', 'edit', 'delete'],

  'communications.sms': ['view', 'send'],
  'communications.announcements': ['view', 'create', 'edit', 'delete', 'publish'],
  'communications.calendar': ['view', 'create', 'edit', 'delete'],
  'communications.settings': ['view', 'edit'],
  'communications.reports': ['view', 'export'],

  // Career Connect - full access for org admin
  'careerConnect.companies': ['view', 'create', 'edit', 'delete'],
  'careerConnect.drives': ['view', 'create', 'edit', 'delete', 'manage_results'],
  'careerConnect.jobBoard': ['view', 'create', 'edit', 'delete', 'apply', 'manage_applications'],
  'careerConnect.studentProfiles': ['view', 'create', 'edit', 'delete', 'export'],
  'careerConnect.counseling': ['view', 'create', 'edit', 'delete', 'conduct'],
  'careerConnect.resources': ['view', 'create', 'edit', 'delete', 'publish'],
  'careerConnect.alumni': ['view', 'create', 'edit', 'delete', 'verify'],
  'careerConnect.mentorship': ['view', 'create', 'edit', 'delete', 'participate'],
  'careerConnect.events': ['view', 'create', 'edit', 'delete', 'register'],
  'careerConnect.reports': ['view', 'export'],
  'careerConnect.settings': ['view', 'edit'],

  // Courses & Online Teaching - full access for org admin
  'courses.courses': ['view', 'create', 'edit', 'delete', 'approve'],
  'courses.lessons': ['view', 'create', 'edit', 'delete'],
  'courses.quizzes': ['view', 'create', 'edit', 'delete'],
  'courses.enrollments': ['view', 'create', 'edit', 'delete'],
  'courses.progress': ['view'],
  'courses.reports': ['view', 'export'],
  'courses.settings': ['view', 'edit'],

  // Course Registration - full access for org admin
  'registration.schemes': ['view', 'create', 'edit', 'delete', 'publish'],
  'registration.registrations': ['view', 'export', 'override'],

  // Hostel - full access for org admin
  'hostel.hostels': ['view', 'create', 'edit', 'delete'],
  'hostel.rooms': ['view', 'create', 'edit', 'delete'],
  'hostel.allocations': ['view', 'create', 'edit', 'transfer', 'vacate'],
  'hostel.reports': ['view', 'export'],
  'hostel.settings': ['view', 'edit'],

  // Campus Feed - full access for org admin
  'campusFeed.posts': ['view', 'create', 'edit', 'delete', 'pin', 'flag', 'moderate'],

  // Inventory - full access for org admin
  'inventory.assets': ['view', 'create', 'edit', 'delete'],
  'inventory.categories': ['view', 'create', 'edit', 'delete'],
  'inventory.procurement': ['view', 'create', 'edit', 'approve'],
  'inventory.issue': ['view', 'create', 'edit', 'return'],
  'inventory.reports': ['view', 'export'],
  'inventory.settings': ['view', 'edit'],

  // Expense - full access for org admin
  'expense.requests': ['view', 'create', 'edit', 'delete'],
  'expense.approvals': ['view', 'approve', 'reject'],
  'expense.reimbursements': ['view', 'create', 'edit', 'process'],
  'expense.budgets': ['view', 'create', 'edit', 'delete'],
  'expense.reports': ['view', 'export'],
  'expense.settings': ['view', 'edit'],

  // Visitor - full access for org admin
  'visitor.visitors': ['view', 'create', 'edit', 'delete'],
  'visitor.passes': ['view', 'create', 'revoke'],
  'visitor.logs': ['view', 'export'],
  'visitor.dashboard': ['view'],
  'visitor.settings': ['view', 'edit'],

  // Feedback - manage only (no create - admins resolve, not submit)
  'feedback.tickets': ['view', 'edit', 'delete', 'assign', 'resolve', 'escalate'],
  'feedback.reports': ['view', 'export'],

  // Transport - full access for org admin
  'transport.buses': ['view', 'create', 'edit', 'delete'],
  'transport.stops': ['view', 'create', 'edit', 'delete'],
  'transport.enrollments': ['view', 'create', 'edit', 'withdraw'],
  'transport.reports': ['view', 'export'],
  'transport.settings': ['view', 'edit'],

  // Exams - full access for org admin
  'exams.config': ['view', 'edit'],
  'exams.exams': ['view', 'create', 'edit', 'delete'],
  'exams.schedules': ['view', 'create', 'edit', 'delete'],
  'exams.marks': ['view', 'create', 'edit'],
  'exams.results': ['view', 'publish'],
  'exams.reportCards': ['view', 'generate', 'publish'],
  'exams.hallTickets': ['view', 'generate'],
  'exams.promotion': ['view', 'commit'],

  // OBE Attainment - full access for org admin
  'obe.programs': ['view', 'create', 'edit', 'delete'],
  'obe.outcomes': ['view', 'create', 'edit', 'delete'],
  'obe.offerings': ['view', 'create', 'edit', 'delete', 'finalize'],
  'obe.marks': ['view', 'create', 'edit', 'import'],
  'obe.attainment': ['view', 'compute', 'edit'],
  'obe.surveys': ['view', 'manage'],
  'obe.reports': ['view', 'export'],
  'obe.settings': ['view', 'edit'],

  'dashboard.branchView': ['view'],
  'dashboard.fees': ['view'],
  'dashboard.reports': ['view', 'create', 'export'],
  'dashboard.audit': ['view', 'export'],

  'reports.view': ['view'],
  'reports.export': ['export'],
  'students.fees': ['view'],
  'health.benefits': ['view'],
  'clubs.manage': ['create', 'edit'],
  'ai.assistant': ['use'],
};

/**
 * Branch Admin permissions - administrative access within a single branch
 * Used by: BRANCH_ADMIN
 */
export const BRANCH_ADMIN_PERMISSIONS: Record<string, string[]> = {
  'organization.branches': ['view'],
  'organization.users': ['view', 'create', 'edit'],
  'organization.roles': ['view'],
  'organization.settings': ['view'],
  // Institutions, departments, programs, academic years, classes, sections, subjects.
  'organization.academics': ['view', 'create', 'edit', 'delete'],
  'organization.infrastructure': ['view', 'create', 'edit'],

  'students.list': ['view', 'create', 'edit', 'bulk-upload', 'export'],
  'students.details': ['view', 'edit'],
  'students.enrollment': ['view', 'create', 'edit'],
  'students.promotion': ['view', 'create'],
  'students.reports': ['view', 'export'],

  'admissions.leads': ['view', 'create', 'edit', 'assign', 'convert'],
  'admissions.applications': ['view', 'create', 'edit', 'approve', 'reject', 'enroll'],
  'admissions.settings': ['view'],
  'admissions.reports': ['view', 'export'],

  'finance.feeCounter': ['view', 'collect'],
  'finance.feeStructures': ['view'],
  'finance.collections': ['view', 'export'],
  'finance.dues': ['view', 'export'],
  'finance.concessions': ['view', 'create'],
  'finance.scholarships': ['view', 'create', 'edit'],
  'finance.reports': ['view', 'export'],
  'finance.settings': ['view'],
  'finance.structures': ['view'],
  'finance.assignments': ['view', 'create', 'edit'],
  'finance.transactions': ['view', 'create'],
  'finance.wallets': ['view', 'create'],
  'finance.approvals': ['view'],

  'attendance.mark': ['view', 'create', 'edit'],
  'attendance.view': ['view'],
  'attendance.reports': ['view', 'export'],
  'attendance.settings': ['view'],

  'hr.staff': ['view', 'create', 'edit'],
  'hr.attendance': ['view', 'create', 'edit'],
  'hr.leaves': ['view', 'create', 'approve', 'reject'],
  'hr.promotions': ['view', 'create', 'approve', 'reject'],
  'hr.workload': ['view', 'create', 'edit'],
  'hr.payroll': ['view', 'create', 'edit', 'finalize', 'pay'],
  'hr.payslips': ['view'],
  'hr.settings': ['view'],

  // Health - branch admin can view, create, and edit (no delete)
  'health.records': ['view', 'create', 'edit'],
  'health.checkups': ['view', 'create', 'edit'],
  'health.vaccinations': ['view', 'create', 'edit'],
  'health.visits': ['view', 'create', 'edit'],
  'health.reports': ['view', 'export'],
  'health.settings': ['view'],

  // Certificates - branch admin can view, create, and edit (no delete types)
  'certificates.types': ['view'],
  'certificates.requests': ['view', 'create', 'edit', 'approve', 'reject'],
  'certificates.idcards': ['view', 'create', 'edit'],
  'certificates.settings': ['view'],

  // Teaching - full access for branch admin
  'teaching.myClasses': ['view'],
  'teaching.myStudents': ['view'],
  'teaching.timetable': ['view', 'create', 'edit', 'delete'],
  'teaching.lessonPlans': ['view', 'create', 'edit', 'delete'],
  'teaching.assignments': ['view', 'create', 'edit', 'delete'],
  'teaching.grades': ['view', 'create', 'edit'],
  'teaching.liveClasses': ['view', 'create', 'edit', 'delete'],

  'communications.sms': ['view', 'send'],
  'communications.announcements': ['view', 'create', 'edit', 'publish'],
  'communications.calendar': ['view', 'create', 'edit'],
  'communications.settings': ['view'],
  'communications.reports': ['view', 'export'],

  // Career Connect - branch admin (no delete, no settings edit)
  'careerConnect.companies': ['view', 'create', 'edit'],
  'careerConnect.drives': ['view', 'create', 'edit', 'manage_results'],
  'careerConnect.jobBoard': ['view', 'create', 'edit', 'apply', 'manage_applications'],
  'careerConnect.studentProfiles': ['view', 'create', 'edit', 'export'],
  'careerConnect.counseling': ['view', 'create', 'edit', 'conduct'],
  'careerConnect.resources': ['view', 'create', 'edit', 'publish'],
  'careerConnect.alumni': ['view', 'create', 'edit', 'verify'],
  'careerConnect.mentorship': ['view', 'create', 'edit', 'participate'],
  'careerConnect.events': ['view', 'create', 'edit', 'register'],
  'careerConnect.reports': ['view', 'export'],
  'careerConnect.settings': ['view'],

  // Courses & Online Teaching - branch admin
  'courses.courses': ['view', 'create', 'edit', 'delete'],
  'courses.lessons': ['view', 'create', 'edit', 'delete'],
  'courses.quizzes': ['view', 'create', 'edit', 'delete'],
  'courses.enrollments': ['view', 'create', 'edit'],
  'courses.progress': ['view'],
  'courses.reports': ['view', 'export'],
  'courses.settings': ['view'],

  // Course Registration - branch admin (no delete)
  'registration.schemes': ['view', 'create', 'edit', 'publish'],
  'registration.registrations': ['view', 'export', 'override'],

  // Hostel - branch admin (no delete on hostels)
  'hostel.hostels': ['view', 'create', 'edit'],
  'hostel.rooms': ['view', 'create', 'edit', 'delete'],
  'hostel.allocations': ['view', 'create', 'edit', 'transfer', 'vacate'],
  'hostel.reports': ['view', 'export'],
  'hostel.settings': ['view', 'edit'],

  // Campus Feed - full access for branch admin
  'campusFeed.posts': ['view', 'create', 'edit', 'delete', 'pin', 'flag', 'moderate'],

  // Inventory - branch admin (no delete on categories)
  'inventory.assets': ['view', 'create', 'edit', 'delete'],
  'inventory.categories': ['view', 'create', 'edit'],
  'inventory.procurement': ['view', 'create', 'edit', 'approve'],
  'inventory.issue': ['view', 'create', 'edit', 'return'],
  'inventory.reports': ['view', 'export'],
  'inventory.settings': ['view', 'edit'],

  // Expense - branch admin (no delete on budgets)
  'expense.requests': ['view', 'create', 'edit', 'delete'],
  'expense.approvals': ['view', 'approve', 'reject'],
  'expense.reimbursements': ['view', 'create', 'edit', 'process'],
  'expense.budgets': ['view', 'create', 'edit'],
  'expense.reports': ['view', 'export'],
  'expense.settings': ['view'],

  // Visitor - branch admin (no delete, view settings only)
  'visitor.visitors': ['view', 'create', 'edit'],
  'visitor.passes': ['view', 'create', 'revoke'],
  'visitor.logs': ['view', 'export'],
  'visitor.dashboard': ['view'],
  'visitor.settings': ['view'],

  // Feedback - branch admin manages tickets (no create, no delete)
  'feedback.tickets': ['view', 'edit', 'assign', 'resolve', 'escalate'],
  'feedback.reports': ['view', 'export'],

  // Transport - branch admin
  'transport.buses': ['view', 'create', 'edit', 'delete'],
  'transport.stops': ['view', 'create', 'edit', 'delete'],
  'transport.enrollments': ['view', 'create', 'edit', 'withdraw'],
  'transport.reports': ['view', 'export'],
  'transport.settings': ['view', 'edit'],

  // Exams - branch admin full access
  'exams.config': ['view', 'edit'],
  'exams.exams': ['view', 'create', 'edit', 'delete'],
  'exams.schedules': ['view', 'create', 'edit', 'delete'],
  'exams.marks': ['view', 'create', 'edit'],
  'exams.results': ['view', 'publish'],
  'exams.reportCards': ['view', 'generate', 'publish'],
  'exams.hallTickets': ['view', 'generate'],
  'exams.promotion': ['view', 'commit'],

  // OBE Attainment - branch admin full access
  'obe.programs': ['view', 'create', 'edit', 'delete'],
  'obe.outcomes': ['view', 'create', 'edit', 'delete'],
  'obe.offerings': ['view', 'create', 'edit', 'delete', 'finalize'],
  'obe.marks': ['view', 'create', 'edit', 'import'],
  'obe.attainment': ['view', 'compute', 'edit'],
  'obe.surveys': ['view', 'manage'],
  'obe.reports': ['view', 'export'],
  'obe.settings': ['view', 'edit'],

  'dashboard.branchView': ['view'],
  'dashboard.fees': ['view'],
  'dashboard.reports': ['view', 'export'],
  'dashboard.audit': ['view'],

  'reports.view': ['view'],
  'reports.export': ['export'],
  'students.fees': ['view'],
  'health.benefits': ['view'],
  'clubs.manage': ['create', 'edit'],
  'ai.assistant': ['use'],
};

/**
 * Teacher permissions - classroom-level access
 * Used by: TEACHER (default operational role)
 */
export const TEACHER_PERMISSIONS: Record<string, string[]> = {
  'students.list': ['view'],
  'students.details': ['view'],
  'students.reports': ['view'],

  'attendance.mark': ['view', 'create', 'edit'],
  'attendance.view': ['view'],
  'attendance.reports': ['view', 'export'],

  'communications.announcements': ['view'],
  'communications.calendar': ['view'],

  'hr.leaves': ['view', 'create'],
  'hr.workload': ['view'],
  'hr.payslips': ['view-own'],

  // Campus Feed - teachers can view and create
  'campusFeed.posts': ['view', 'create'],

  'health.records': ['view'],

  // Teaching - teachers have full access to their own content
  'teaching.myClasses': ['view'],
  'teaching.myStudents': ['view'],
  'teaching.timetable': ['view'],
  'teaching.lessonPlans': ['view', 'create', 'edit', 'delete'],
  'teaching.assignments': ['view', 'create', 'edit', 'delete'],
  'teaching.grades': ['view', 'create', 'edit'],
  'teaching.liveClasses': ['view', 'create', 'edit', 'delete'],

  // Exams - teachers view schedules and enter marks for their papers
  'exams.exams': ['view'],
  'exams.schedules': ['view'],
  'exams.marks': ['view', 'create', 'edit'],
  'exams.results': ['view'],

  // OBE Attainment - teachers author COs and run attainment for their own
  // courses (services narrow writes to offerings they coordinate/teach)
  'obe.programs': ['view'],
  'obe.outcomes': ['view', 'create', 'edit'],
  'obe.offerings': ['view', 'edit'],
  'obe.marks': ['view', 'create', 'edit', 'import'],
  'obe.attainment': ['view', 'compute', 'edit'],
  'obe.surveys': ['view', 'manage'],
  'obe.reports': ['view', 'export'],

  // Courses & Online Teaching - teachers can create and manage courses
  'courses.courses': ['view', 'create', 'edit'],
  'courses.lessons': ['view', 'create', 'edit'],
  'courses.quizzes': ['view', 'create', 'edit'],
  'courses.enrollments': ['view'],
  'courses.progress': ['view'],

  // Inventory - teachers can view their assigned assets
  'inventory.assets': ['view'],
  'inventory.issue': ['view'],

  // Expense - teachers can create and view own expense requests
  'expense.requests': ['view', 'create'],

  // Feedback - teachers can submit and view own tickets
  'feedback.tickets': ['view', 'create'],

  'dashboard.branchView': ['view'],
  'ai.assistant': ['use'],
};

/**
 * Admission Counselor permissions - full admissions access
 * Used by: ADMISSION_COUNSELOR (default operational role)
 */
/**
 * Head of Department: everything a teacher has, plus oversight of the
 * department's students, staff, leaves, exams, registration and OBE. Scope
 * (which department) comes from the user's accessScope, not from here.
 */
export const HOD_PERMISSIONS: Record<string, string[]> = {
  ...TEACHER_PERMISSIONS,
  'students.list': ['view', 'export'],
  'students.details': ['view'],
  'students.reports': ['view', 'export'],
  'attendance.view': ['view'],
  'attendance.reports': ['view', 'export'],
  'hr.staff': ['view'],
  'hr.leaves': ['view', 'create', 'approve', 'reject'],
  'exams.exams': ['view'],
  'exams.marks': ['view'],
  'registration.registrations': ['view'],
  'registration.schemes': ['view'],
  'obe.offerings': ['view'],
  'obe.attainment': ['view'],
  'obe.reports': ['view'],
  'dashboard.branchView': ['view'],
  'dashboard.fees': ['view'],
  'ai.assistant': ['use'],
};

export const ADMISSION_COUNSELOR_PERMISSIONS: Record<string, string[]> = {
  // Every employee applies for (and sees) their own leave.
  'hr.leaves': ['view', 'create'],
  'admissions.leads': ['view', 'create', 'edit', 'assign', 'convert'],
  'admissions.applications': ['view', 'create', 'edit', 'approve', 'reject', 'enroll'],
  'admissions.reports': ['view', 'export'],

  'students.list': ['view'],
  'students.details': ['view'],

  'communications.announcements': ['view', 'create'],
  'communications.calendar': ['view'],

  'campusFeed.posts': ['view', 'create'],

  'feedback.tickets': ['view', 'create'],

  'dashboard.branchView': ['view'],
  'ai.assistant': ['use'],
};

/**
 * Accountant permissions - finance operations
 * Used by: ACCOUNTANT (default operational role)
 */
export const ACCOUNTANT_PERMISSIONS: Record<string, string[]> = {
  // Every employee applies for (and sees) their own leave.
  'hr.leaves': ['view', 'create'],
  'finance.feeCounter': ['view', 'collect', 'cancel', 'refund'],
  'finance.feeStructures': ['view'],
  'finance.collections': ['view', 'export'],
  'finance.dues': ['view', 'export'],
  'finance.concessions': ['view', 'create'],
  'finance.scholarships': ['view', 'create', 'edit'],
  'finance.reports': ['view', 'export'],
  'finance.structures': ['view'],
  'finance.assignments': ['view'],
  'finance.transactions': ['view', 'create'],
  'finance.wallets': ['view'],

  'students.list': ['view'],
  'students.details': ['view'],

  'campusFeed.posts': ['view', 'create'],

  // Expense - accountants can view, approve, and report on expenses
  'expense.requests': ['view', 'create', 'edit'],
  'expense.approvals': ['view', 'approve', 'reject'],
  'expense.reimbursements': ['view', 'create', 'process'],
  'expense.budgets': ['view'],
  'expense.reports': ['view', 'export'],

  'feedback.tickets': ['view', 'create'],

  'dashboard.branchView': ['view'],
  'dashboard.fees': ['view'],

  'reports.view': ['view'],
  'reports.export': ['export'],
  'students.fees': ['view'],
  'ai.assistant': ['use'],
};

/**
 * HR Manager permissions - staff and HR operations
 * Used by: HR_MANAGER (default operational role)
 */
export const HR_MANAGER_PERMISSIONS: Record<string, string[]> = {
  'hr.staff': ['view', 'create', 'edit'],
  'hr.attendance': ['view', 'create', 'edit'],
  'hr.leaves': ['view', 'create', 'approve', 'reject'],
  'hr.promotions': ['view', 'create', 'approve', 'reject'],
  'hr.workload': ['view', 'create', 'edit'],
  'hr.payroll': ['view', 'create', 'edit', 'pay'],
  'hr.payslips': ['view', 'view-own'],
  'hr.settings': ['view'],

  'communications.announcements': ['view', 'create'],
  'communications.calendar': ['view'],

  'campusFeed.posts': ['view', 'create'],

  // Inventory - HR managers can view staff asset assignments
  'inventory.assets': ['view'],
  'inventory.issue': ['view'],

  // Expense - HR managers can create and view own expense requests
  'expense.requests': ['view', 'create'],

  'feedback.tickets': ['view', 'create'],

  'dashboard.branchView': ['view'],

  'reports.view': ['view'],
  'ai.assistant': ['use'],
};

/**
 * Receptionist permissions - front desk operations
 * Used by: RECEPTIONIST (default operational role)
 */
export const RECEPTIONIST_PERMISSIONS: Record<string, string[]> = {
  // Every employee applies for (and sees) their own leave.
  'hr.leaves': ['view', 'create'],
  'students.list': ['view'],
  'students.details': ['view'],

  'attendance.view': ['view'],

  'communications.announcements': ['view'],
  'communications.calendar': ['view'],

  'health.records': ['view'],
  'health.visits': ['view', 'create'],

  'certificates.requests': ['view'],

  'campusFeed.posts': ['view', 'create'],

  // Visitor - receptionist is the primary operator
  'visitor.visitors': ['view', 'create', 'edit'],
  'visitor.passes': ['view', 'create'],
  'visitor.logs': ['view'],
  'visitor.dashboard': ['view'],
  'visitor.settings': ['view'],

  'feedback.tickets': ['view', 'create'],

  'dashboard.branchView': ['view'],
  'ai.assistant': ['use'],
};

/**
 * Student permissions - minimal view access for student portal
 * Used by: STUDENT (default operational role)
 */
export const STUDENT_PERMISSIONS: Record<string, string[]> = {
  'teaching.assignments': ['view'],
  'teaching.grades': ['view'],
  'teaching.lessonPlans': ['view'],
  'teaching.myClasses': ['view'],
  'teaching.timetable': ['view'],
  'teaching.liveClasses': ['view'],

  // Exams - students see upcoming exams and their own published results
  'exams.exams': ['view'],
  'exams.schedules': ['view'],
  'exams.results': ['view'],
  'exams.reportCards': ['view'],
  'exams.hallTickets': ['view'],

  // OBE Attainment - students only submit course-end surveys
  'obe.surveys': ['submit'],

  'students.details': ['view'],

  'attendance.view': ['view'],

  'finance.feeStructures': ['view'],

  // Course Registration - students register themselves
  'registration.self': ['view', 'create', 'edit'],

  'hostel.allocations': ['view'],

  'communications.announcements': ['view'],
  'communications.calendar': ['view'],

  // Campus Feed - students can view and create posts
  'campusFeed.posts': ['view', 'create'],

  // Courses - students can view courses, lessons, quizzes and their own progress
  'courses.courses': ['view'],
  'courses.lessons': ['view'],
  'courses.quizzes': ['view'],
  'courses.enrollments': ['view'],
  'courses.progress': ['view'],

  'feedback.tickets': ['view', 'create'],

  'dashboard.branchView': ['view'],
  'dashboard.fees': ['view'],
  'students.fees': ['view'], // their own fees only (self-scoped)
  'ai.assistant': ['use'],
};

/**
 * Placement Officer permissions - placement & career operations (colleges/universities)
 * Used by: PLACEMENT_OFFICER (default operational role)
 */
export const PLACEMENT_OFFICER_PERMISSIONS: Record<string, string[]> = {
  // Every employee applies for (and sees) their own leave.
  'hr.leaves': ['view', 'create'],
  'careerConnect.companies': ['view', 'create', 'edit', 'delete'],
  'careerConnect.drives': ['view', 'create', 'edit', 'delete', 'manage_results'],
  'careerConnect.jobBoard': ['view', 'create', 'edit', 'delete', 'manage_applications'],
  'careerConnect.studentProfiles': ['view', 'create', 'edit', 'export'],
  'careerConnect.alumni': ['view', 'create', 'edit', 'verify'],
  'careerConnect.mentorship': ['view', 'create', 'edit', 'participate'],
  'careerConnect.events': ['view', 'create', 'edit', 'delete', 'register'],
  'careerConnect.reports': ['view', 'export'],
  'careerConnect.settings': ['view', 'edit'],

  // Courses - placement officers can manage courses
  'courses.courses': ['view', 'create', 'edit', 'delete'],
  'courses.lessons': ['view', 'create', 'edit'],
  'courses.quizzes': ['view', 'create', 'edit'],
  'courses.enrollments': ['view', 'create'],
  'courses.progress': ['view'],

  'students.list': ['view'],
  'students.details': ['view'],

  'communications.announcements': ['view', 'create'],
  'communications.calendar': ['view'],

  'dashboard.branchView': ['view'],
  'ai.assistant': ['use'],
};

/**
 * Career Counselor permissions - counseling & resources (schools)
 * Used by: CAREER_COUNSELOR (default operational role)
 */
export const CAREER_COUNSELOR_PERMISSIONS: Record<string, string[]> = {
  // Every employee applies for (and sees) their own leave.
  'hr.leaves': ['view', 'create'],
  'careerConnect.counseling': ['view', 'create', 'edit', 'delete', 'conduct'],
  'careerConnect.resources': ['view', 'create', 'edit', 'delete', 'publish'],
  'careerConnect.alumni': ['view'],
  'careerConnect.events': ['view', 'register'],
  'careerConnect.reports': ['view', 'export'],

  // Courses - counselors can manage courses
  'courses.courses': ['view', 'create', 'edit'],
  'courses.lessons': ['view', 'create', 'edit'],
  'courses.quizzes': ['view'],
  'courses.enrollments': ['view'],
  'courses.progress': ['view'],

  'students.list': ['view'],
  'students.details': ['view'],

  'communications.announcements': ['view'],
  'communications.calendar': ['view'],

  'dashboard.branchView': ['view'],
  'ai.assistant': ['use'],
};

/**
 * Hostel Warden permissions - hostel operations
 * Used by: HOSTEL_WARDEN (default operational role)
 */
export const HOSTEL_WARDEN_PERMISSIONS: Record<string, string[]> = {
  // Every employee applies for (and sees) their own leave.
  'hr.leaves': ['view', 'create'],
  'hostel.hostels': ['view'],
  'hostel.rooms': ['view', 'edit'],
  'hostel.allocations': ['view', 'create', 'edit', 'transfer', 'vacate'],
  'hostel.reports': ['view'],
  'hostel.settings': ['view'],

  'students.list': ['view'],
  'students.details': ['view'],

  'feedback.tickets': ['view', 'create'],

  'dashboard.branchView': ['view'],
  'ai.assistant': ['use'],
};

/**
 * Inventory Manager permissions - full inventory access + expense view
 * Used by: INVENTORY_MANAGER (default operational role)
 */
export const INVENTORY_MANAGER_PERMISSIONS: Record<string, string[]> = {
  // Every employee applies for (and sees) their own leave.
  'hr.leaves': ['view', 'create'],
  'inventory.assets': ['view', 'create', 'edit', 'delete'],
  'inventory.categories': ['view', 'create', 'edit', 'delete'],
  'inventory.procurement': ['view', 'create', 'edit', 'approve'],
  'inventory.issue': ['view', 'create', 'edit', 'return'],
  'inventory.reports': ['view', 'export'],
  'inventory.settings': ['view', 'edit'],

  'expense.requests': ['view', 'create'],
  'expense.reports': ['view'],

  'campusFeed.posts': ['view', 'create'],

  'feedback.tickets': ['view', 'create'],

  'dashboard.branchView': ['view'],
  'ai.assistant': ['use'],
};

export type PermissionModule = keyof typeof PERMISSIONS;
export type PermissionAction<T extends PermissionModule> = (typeof PERMISSIONS)[T][number];
