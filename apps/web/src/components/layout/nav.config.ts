import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  PartyPopper,
  Compass,
  PlusCircle,
  IdCard,
  ArrowLeftRight,
  ArrowRightLeft,
  Award,
  BarChart3,
  BedDouble,
  Bell,
  BookMarked,
  BookOpen,
  BookOpenCheck,
  Bot,
  Briefcase,
  Building2,
  Bus,
  Calendar,
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  CheckCircle,
  ClipboardCheck,
  ClipboardList,
  Clock,
  CreditCard,
  Eye,
  FileEdit,
  FileSpreadsheet,
  FileText,
  FormInput,
  GitBranch,
  GraduationCap,
  Handshake,
  Heart,
  History,
  Hotel,
  IndianRupee,
  Kanban,
  Landmark,
  LayoutDashboard,
  Warehouse,
  CheckCheck,
  Layers,
  Megaphone,
  MessageCircleWarning,
  MessageSquare,
  Newspaper,
  Package,
  Presentation,
  Receipt,
  School,
  ScrollText,
  Shield,
  Star,
  Stethoscope,
  Syringe,
  Target,
  TrendingUp,
  Upload,
  UserCheck,
  UserCog,
  UserPlus,
  Users,
  Video,
  Wallet,
} from 'lucide-react';

export interface NavPermission {
  module: string;
  action: string;
}

export interface NavChild {
  name: string;
  href: string;
  icon: LucideIcon;
  permission?: NavPermission;
  /**
   * Show only for these institution types. Applies only once a branch is
   * selected — with no branch context the item stays visible.
   */
  institutionTypes?: Array<'school' | 'college' | 'university'>;
  /** Display name for university tenants ("Branches" → "Campuses"). */
  universityLabel?: string;
  /** Small sub-heading this item sits under inside an expanded module. */
  group?: string;
  /** Match only this exact path, not its sub-pages (for a module's root page). */
  exact?: boolean;
  /** Visible when the user holds any one of these (instead of `permission`). */
  anyPermission?: NavPermission[];
}

export interface NavModule {
  id: string;
  name: string;
  icon: LucideIcon;
  href?: string;
  permission?: NavPermission;
  children?: NavChild[];
  /**
   * The module's settings page — rendered as a gear on the module row instead
   * of occupying a child slot. Same URL and permission as before.
   */
  settings?: { href: string; permission: NavPermission };
  /** Visible regardless of the tenant's subscribed feature modules. */
  alwaysAvailable?: boolean;
  /** Premium add-on: shown with a gold star in the sidebar. */
  premium?: boolean;
  /**
   * Feature-module id used for the subscription gate when it differs from
   * `id` (My Workspace items live outside their source module).
   */
  subscriptionModule?: string;
  /** Personal item — hidden from GROUP_OWNER, ORG_ADMIN and BRANCH_ADMIN. */
  hideForAdmins?: boolean;
  /** Personal item admins may keep — hidden from GROUP_OWNER only. */
  hideForGroupOwner?: boolean;
  /** Gates that need runtime context beyond a single permission check. */
  specialGate?: 'aiAssistant' | 'multiInstitution' | 'teaching' | 'hideForBranchAdmin';
}

export interface NavSection {
  id: string;
  /** Uppercase group header; omitted for the pinned top section. */
  label?: string;
  modules: NavModule[];
}

/**
 * Staff/admin navigation, grouped into scannable sections. This is data only —
 * every gate (subscription, permission, role, institution type) is declared
 * here and evaluated in one place in Sidebar.tsx.
 */
export const NAV_SECTIONS: NavSection[] = [
  {
    id: 'overview',
    modules: [
      {
        id: 'dashboard',
        name: 'Dashboard',
        icon: LayoutDashboard,
        href: '/dashboard',
        alwaysAvailable: true,
        permission: { module: 'dashboard.branchView', action: 'view' },
      },
      {
        id: 'ai-assistant',
        name: 'AI Assistant',
        icon: Bot,
        href: '/assistant',
        alwaysAvailable: true,
        // Needs at least one queryable-data permission — 'aiAssistant' gate.
        specialGate: 'aiAssistant',
      },
      {
        id: 'central',
        name: 'All Institutions',
        icon: Layers,
        href: '/central',
        alwaysAvailable: true,
        // Only meaningful for tenants with >1 constituent institution.
        specialGate: 'multiInstitution',
        permission: { module: 'organization.branches', action: 'view' },
      },
    ],
  },
  {
    id: 'workspace',
    label: 'My Workspace',
    modules: [
      {
        id: 'my-payslips',
        name: 'My Payslips',
        icon: Receipt,
        href: '/hr/payroll/payslips/my',
        subscriptionModule: 'hr',
        hideForGroupOwner: true,
        permission: { module: 'hr.payslips', action: 'view-own' },
      },
      {
        id: 'my-expenses',
        name: 'My Expenses',
        icon: CreditCard,
        href: '/expenses/my',
        subscriptionModule: 'expense',
        hideForAdmins: true,
        permission: { module: 'expense.requests', action: 'view' },
      },
      {
        id: 'my-assets',
        name: 'My Assets',
        icon: UserCheck,
        href: '/inventory/issues/my',
        subscriptionModule: 'inventory',
        hideForAdmins: true,
        permission: { module: 'inventory.issue', action: 'view' },
      },
      {
        id: 'submit-concern',
        name: 'Submit Concern',
        icon: MessageCircleWarning,
        href: '/feedback/new',
        subscriptionModule: 'feedback',
        hideForAdmins: true,
        permission: { module: 'feedback.tickets', action: 'create' },
      },
    ],
  },
  {
    id: 'academics',
    label: 'Academics',
    modules: [
      {
        id: 'academic-structure',
        name: 'Academic Structure',
        icon: School,
        alwaysAvailable: true,
        children: [
          // Campus → institution → department → program → year → section.
          // Each page's data needs these grants; without them it loads empty.
          // Explorer walks the tree level by level (and holds the setup guide);
          // the other three list one kind of thing across the whole campus.
          {
            name: 'Explorer',
            href: '/organization/explorer',
            icon: Layers,
            anyPermission: [
              { module: 'organization.branches', action: 'view' },
              { module: 'organization.settings', action: 'view' },
              { module: 'organization.academics', action: 'view' },
            ],
          },
          {
            name: 'Classes & Sections',
            href: '/organization/academic-structure',
            icon: School,
            anyPermission: [
              { module: 'organization.settings', action: 'view' },
              { module: 'organization.academics', action: 'view' },
            ],
          },
          {
            name: 'Subjects',
            href: '/organization/subjects',
            icon: BookMarked,
            anyPermission: [
              { module: 'organization.settings', action: 'view' },
              { module: 'organization.academics', action: 'view' },
            ],
          },
          {
            // Build each section's week: only its subjects and the teachers who can take them.
            name: 'Timetable',
            href: '/organization/timetable',
            icon: CalendarClock,
            permission: { module: 'teaching.timetable', action: 'create' },
          },
          {
            // Departments only apply to college/university (Department → Year).
            name: 'Departments',
            href: '/organization/departments',
            icon: Building2,
            institutionTypes: ['college', 'university'],
            permission: { module: 'organization.settings', action: 'view' },
          },
        ],
      },
      {
        id: 'students',
        name: 'Students',
        icon: GraduationCap,
        children: [
          {
            name: 'All Students',
            href: '/students',
            icon: Users,
            permission: { module: 'students.list', action: 'view' },
          },
          {
            name: 'ID Cards',
            href: '/students/id-cards',
            icon: IdCard,
            permission: { module: 'certificates.idcards', action: 'view' },
          },
          {
            name: 'Bulk Upload',
            href: '/students/bulk-upload',
            icon: Upload,
            permission: { module: 'students.list', action: 'bulk-upload' },
          },
          {
            name: 'Upload History',
            href: '/students/bulk-upload-history',
            icon: History,
            permission: { module: 'students.list', action: 'bulk-upload' },
          },
          {
            name: 'Reports',
            href: '/students/reports',
            icon: BarChart3,
            permission: { module: 'students.list', action: 'view' },
          },
        ],
      },
      {
        id: 'admissions',
        name: 'Admissions',
        icon: UserPlus,
        settings: {
          href: '/admissions/settings',
          permission: { module: 'admissions.settings', action: 'view' },
        },
        children: [
          {
            name: 'Pipeline',
            href: '/admissions',
            icon: Kanban,
            permission: { module: 'admissions.leads', action: 'view' },
          },
          {
            name: 'Leads',
            href: '/admissions/leads',
            icon: Users,
            permission: { module: 'admissions.leads', action: 'view' },
          },
          {
            name: 'Applications',
            href: '/admissions/applications',
            icon: FileText,
            permission: { module: 'admissions.applications', action: 'view' },
          },
          {
            name: 'Followups',
            href: '/admissions/followups',
            icon: Clock,
            permission: { module: 'admissions.leads', action: 'view' },
          },
          {
            name: 'Bulk Upload',
            href: '/admissions/bulk-upload',
            icon: Upload,
            permission: { module: 'admissions.applications', action: 'create' },
          },
        ],
      },
      {
        id: 'attendance',
        name: 'Attendance',
        icon: CalendarCheck,
        children: [
          {
            name: 'Mark Attendance',
            href: '/attendance/mark',
            icon: ClipboardCheck,
            permission: { module: 'attendance.mark', action: 'view' },
          },
          {
            name: 'View Attendance',
            href: '/attendance/view',
            icon: Eye,
            permission: { module: 'attendance.view', action: 'view' },
          },
          {
            name: 'Holidays',
            href: '/attendance/holidays',
            icon: CalendarDays,
            permission: { module: 'attendance.holidays', action: 'view' },
          },
        ],
      },
      {
        id: 'teaching',
        name: 'Teaching',
        icon: Presentation,
        // Teachers (own-content permissions) and admin roles only.
        specialGate: 'teaching',
        children: [
          {
            name: 'My Classes',
            href: '/teaching/my-classes',
            icon: Users,
            permission: { module: 'teaching.myClasses', action: 'view' },
          },
          {
            name: 'My Timetable',
            href: '/teaching/timetable',
            icon: CalendarClock,
            permission: { module: 'teaching.timetable', action: 'view' },
          },
          {
            name: 'Lesson Plans',
            href: '/teaching/lesson-plans',
            icon: FileEdit,
            permission: { module: 'teaching.lessonPlans', action: 'view' },
          },
          {
            name: 'Assignments',
            href: '/teaching/assignments',
            icon: ClipboardList,
            permission: { module: 'teaching.assignments', action: 'view' },
          },
          {
            name: 'Gradebook',
            href: '/teaching/gradebook',
            icon: BookMarked,
            permission: { module: 'teaching.grades', action: 'view' },
          },
          {
            name: 'Live Classes',
            href: '/teaching/live-classes',
            icon: Video,
            permission: { module: 'teaching.liveClasses', action: 'view' },
          },
          {
            name: 'My Courses',
            href: '/teaching/my-courses',
            icon: GraduationCap,
            permission: { module: 'courses.courses', action: 'view' },
          },
        ],
      },
      {
        // Single entry — curriculum and registrations are tabs on one page.
        id: 'registration',
        name: 'Course Registration',
        icon: BookOpenCheck,
        href: '/registration',
        permission: { module: 'registration.registrations', action: 'view' },
      },
      {
        id: 'exams',
        name: 'Exams',
        icon: ScrollText,
        settings: {
          href: '/exams/settings',
          permission: { module: 'exams.config', action: 'view' },
        },
        children: [
          {
            name: 'All Exams',
            href: '/exams',
            icon: ScrollText,
            permission: { module: 'exams.exams', action: 'view' },
          },
          {
            name: 'Promotion',
            href: '/exams/promotion',
            icon: ArrowRightLeft,
            permission: { module: 'exams.promotion', action: 'view' },
          },
        ],
      },
      {
        id: 'obe',
        name: 'OBE Attainment',
        icon: Target,
        settings: {
          href: '/obe/settings',
          permission: { module: 'obe.settings', action: 'view' },
        },
        // Ordered as the workflow runs: define the program's POs/PSOs, author
        // COs and the mapping matrix, then run offerings (marks → attainment).
        children: [
          {
            name: 'Programs',
            href: '/obe/programs',
            icon: GraduationCap,
            permission: { module: 'obe.programs', action: 'view' },
          },
          {
            name: 'Course Outcomes',
            href: '/obe/outcomes',
            icon: BookOpen,
            permission: { module: 'obe.outcomes', action: 'view' },
          },
          {
            name: 'Offerings',
            href: '/obe',
            icon: Target,
            permission: { module: 'obe.offerings', action: 'view' },
          },
          {
            name: 'Accreditation',
            href: '/obe/reports',
            icon: FileText,
            permission: { module: 'obe.reports', action: 'view' },
          },
        ],
      },
      {
        id: 'courses',
        name: 'Courses',
        icon: BookOpen,
        settings: {
          href: '/courses/settings',
          permission: { module: 'courses.settings', action: 'view' },
        },
        children: [
          {
            name: 'All Courses',
            href: '/courses',
            icon: BookOpen,
            permission: { module: 'courses.courses', action: 'view' },
          },
          {
            name: 'Reports',
            href: '/courses/reports',
            icon: BarChart3,
            permission: { module: 'courses.reports', action: 'view' },
          },
        ],
      },
    ],
  },
  {
    id: 'campus',
    label: 'Campus',
    modules: [
      {
        id: 'hostel',
        name: 'Hostel',
        icon: Hotel,
        settings: {
          href: '/hostel/settings',
          permission: { module: 'hostel.settings', action: 'view' },
        },
        children: [
          {
            name: 'Dashboard',
            href: '/hostel',
            icon: Activity,
            permission: { module: 'hostel.hostels', action: 'view' },
          },
          {
            name: 'Hostels',
            href: '/hostel/hostels',
            icon: Building2,
            permission: { module: 'hostel.hostels', action: 'view' },
          },
          {
            name: 'Rooms',
            href: '/hostel/rooms',
            icon: BedDouble,
            permission: { module: 'hostel.rooms', action: 'view' },
          },
          {
            name: 'Allocations',
            href: '/hostel/allocations',
            icon: Users,
            permission: { module: 'hostel.allocations', action: 'view' },
          },
          {
            name: 'Reports',
            href: '/hostel/reports',
            icon: BarChart3,
            permission: { module: 'hostel.reports', action: 'view' },
          },
        ],
      },
      {
        id: 'transport',
        name: 'Transport',
        icon: Bus,
        settings: {
          href: '/transport/settings',
          permission: { module: 'transport.settings', action: 'view' },
        },
        children: [
          {
            name: 'Buses',
            href: '/transport',
            icon: Bus,
            permission: { module: 'transport.buses', action: 'view' },
          },
          {
            name: 'Enrollments',
            href: '/transport/enrollments',
            icon: UserCheck,
            permission: { module: 'transport.enrollments', action: 'view' },
          },
        ],
      },
      {
        id: 'clubs',
        name: 'Clubs',
        icon: PartyPopper,
        alwaysAvailable: true,
        children: [
          { name: 'Explore Clubs', href: '/clubs', icon: Compass, exact: true },
          { name: 'My Clubs', href: '/clubs/mine', icon: Heart },
          {
            name: 'Create Club',
            href: '/clubs/new',
            icon: PlusCircle,
            permission: { module: 'communications.calendar', action: 'create' },
          },
        ],
      },
      {
        id: 'health',
        name: 'Health Connect',
        icon: Heart,
        premium: true,
        settings: {
          href: '/health/settings',
          permission: { module: 'health.settings', action: 'view' },
        },
        children: [
          {
            name: 'Dashboard',
            href: '/health',
            icon: Activity,
            permission: { module: 'health.records', action: 'view' },
          },
          {
            name: 'Health Records',
            href: '/health/records',
            icon: Heart,
            permission: { module: 'health.records', action: 'view' },
          },
          {
            name: 'Checkups',
            href: '/health/checkups',
            icon: Stethoscope,
            permission: { module: 'health.checkups', action: 'view' },
          },
          {
            name: 'Vaccinations',
            href: '/health/vaccinations',
            icon: Syringe,
            permission: { module: 'health.vaccinations', action: 'view' },
          },
          {
            name: 'Medical Visits',
            href: '/health/visits',
            icon: ClipboardCheck,
            permission: { module: 'health.visits', action: 'view' },
          },
          {
            name: 'Reports',
            href: '/health/reports',
            icon: BarChart3,
            permission: { module: 'health.reports', action: 'view' },
          },
        ],
      },
      {
        id: 'visitor',
        name: 'Visitors',
        icon: UserCheck,
        settings: {
          href: '/visitors/settings',
          permission: { module: 'visitor.settings', action: 'view' },
        },
        children: [
          {
            name: 'Dashboard',
            href: '/visitors',
            icon: LayoutDashboard,
            permission: { module: 'visitor.dashboard', action: 'view' },
          },
          {
            name: 'Register',
            href: '/visitors/register',
            icon: UserPlus,
            permission: { module: 'visitor.visitors', action: 'create' },
          },
          {
            name: 'Logs',
            href: '/visitors/logs',
            icon: ClipboardList,
            permission: { module: 'visitor.logs', action: 'view' },
          },
        ],
      },
      {
        id: 'feedback',
        name: 'Concerns & Feedback',
        icon: MessageCircleWarning,
        children: [
          {
            name: 'All Tickets',
            href: '/feedback',
            icon: ClipboardList,
            permission: { module: 'feedback.tickets', action: 'view' },
          },
        ],
      },
      {
        id: 'communications',
        name: 'Communications',
        icon: Bell,
        settings: {
          href: '/communications/settings',
          permission: { module: 'communications.settings', action: 'view' },
        },
        children: [
          {
            name: 'Campus Feed',
            href: '/feed',
            icon: Newspaper,
          },
          {
            name: 'SMS',
            href: '/communications/sms',
            icon: MessageSquare,
            permission: { module: 'communications.sms', action: 'view' },
          },
          {
            name: 'Announcements',
            href: '/communications/announcements',
            icon: Megaphone,
            permission: { module: 'communications.announcements', action: 'view' },
          },
          {
            name: 'Calendar',
            href: '/communications/calendar',
            icon: CalendarDays,
            permission: { module: 'communications.calendar', action: 'view' },
          },
        ],
      },
      {
        id: 'careerConnect',
        name: 'Career Connect',
        icon: Briefcase,
        premium: true,
        children: [
          {
            name: 'Companies',
            href: '/career-connect/companies',
            icon: Building2,
            institutionTypes: ['college', 'university'],
            permission: { module: 'careerConnect.companies', action: 'view' },
          },
          {
            name: 'Placement Drives',
            href: '/career-connect/drives',
            icon: GraduationCap,
            institutionTypes: ['college', 'university'],
            permission: { module: 'careerConnect.drives', action: 'view' },
          },
          {
            name: 'Job Board',
            href: '/career-connect/job-board',
            icon: FileText,
            institutionTypes: ['college', 'university'],
            permission: { module: 'careerConnect.jobBoard', action: 'view' },
          },
          {
            name: 'Student Profiles',
            href: '/career-connect/student-profile',
            icon: UserCheck,
            institutionTypes: ['college', 'university'],
            permission: { module: 'careerConnect.studentProfiles', action: 'view' },
          },
          {
            // Coming soon: an AI placement office (Campus Verse flagship).
            name: 'Virtual Placement Office',
            href: '/career-connect/virtual-placement-office',
            icon: Bot,
            institutionTypes: ['college', 'university'],
            permission: { module: 'careerConnect.drives', action: 'view' },
          },
          {
            name: 'Counseling',
            href: '/career-connect/counseling/sessions',
            icon: Heart,
            institutionTypes: ['school'],
            permission: { module: 'careerConnect.counseling', action: 'view' },
          },
          {
            name: 'Alumni',
            href: '/career-connect/alumni/directory',
            icon: Handshake,
            permission: { module: 'careerConnect.alumni', action: 'view' },
          },
          {
            name: 'Reports',
            href: '/career-connect/reports',
            icon: BarChart3,
            permission: { module: 'careerConnect.reports', action: 'view' },
          },
        ],
      },
    ],
  },
  {
    id: 'operations',
    label: 'Operations',
    modules: [
      {
        id: 'finance',
        name: 'Finance',
        icon: IndianRupee,
        settings: {
          href: '/finance/settings',
          permission: { module: 'finance.settings', action: 'view' },
        },
        children: [
          {
            name: 'Fee Counter',
            href: '/finance/fee-counter',
            icon: Wallet,
            permission: { module: 'finance.feeCounter', action: 'view' },
          },
          {
            name: 'Fee Structures',
            href: '/finance/fee-structures',
            icon: Receipt,
            permission: { module: 'finance.feeStructures', action: 'view' },
          },
          {
            name: 'Scholarships',
            href: '/finance/scholarships',
            icon: GraduationCap,
            permission: { module: 'finance.scholarships', action: 'view' },
          },
          {
            name: 'Approvals',
            href: '/finance/approvals',
            icon: CheckCircle,
            permission: { module: 'finance.approvals', action: 'view' },
          },
          {
            name: 'Reports',
            href: '/finance/reports',
            icon: BarChart3,
            permission: { module: 'finance.reports', action: 'view' },
          },
        ],
      },
      {
        id: 'hr',
        name: 'HR',
        icon: Users,
        settings: {
          href: '/hr/settings',
          permission: { module: 'hr.settings', action: 'view' },
        },
        children: [
          {
            name: 'Staff',
            href: '/hr/staff',
            icon: Briefcase,
            permission: { module: 'hr.staff', action: 'view' },
          },
          {
            name: 'Departments',
            href: '/hr/departments',
            icon: Building2,
            permission: { module: 'hr.staff', action: 'view' },
          },
          {
            name: 'Attendance',
            href: '/hr/attendance',
            icon: Clock,
            permission: { module: 'hr.attendance', action: 'view' },
          },
          {
            name: 'Leaves',
            href: '/hr/leaves',
            icon: CalendarDays,
            permission: { module: 'hr.leaves', action: 'view' },
          },
          {
            name: 'Leave Approvals',
            href: '/hr/approvals',
            icon: CheckCircle,
            // 'edit' is the legacy approver grant on older HOD roles.
            anyPermission: [
              { module: 'hr.leaves', action: 'approve' },
              { module: 'hr.leaves', action: 'edit' },
            ],
          },
          {
            name: 'Payroll',
            href: '/hr/payroll',
            icon: IndianRupee,
            permission: { module: 'hr.payroll', action: 'view' },
          },
          {
            name: 'Promotions',
            href: '/hr/promotions',
            icon: TrendingUp,
            permission: { module: 'hr.promotions', action: 'view' },
          },
          {
            name: 'Workload',
            href: '/hr/workload',
            icon: FileSpreadsheet,
            permission: { module: 'hr.workload', action: 'view' },
          },
          // Timetables are built in Academic Structure → Timetable (one place);
          // a staff member's week is on their HR profile and in its "By teacher" view.
        ],
      },
      {
        id: 'inventory',
        name: 'Inventory',
        icon: Package,
        settings: {
          href: '/inventory/settings',
          permission: { module: 'inventory.settings', action: 'view' },
        },
        children: [
          {
            name: 'Assets',
            href: '/inventory',
            icon: Package,
            permission: { module: 'inventory.assets', action: 'view' },
          },
          {
            name: 'Categories',
            href: '/inventory/categories',
            icon: Kanban,
            permission: { module: 'inventory.categories', action: 'view' },
          },
          {
            name: 'Procurement',
            href: '/inventory/procurement',
            icon: ClipboardList,
            permission: { module: 'inventory.procurement', action: 'view' },
          },
          {
            name: 'Issue / Return',
            href: '/inventory/issues',
            icon: ArrowLeftRight,
            permission: { module: 'inventory.issue', action: 'view' },
          },
        ],
      },
      {
        id: 'expense',
        name: 'Expenses',
        icon: Receipt,
        settings: {
          href: '/expenses/settings',
          permission: { module: 'expense.settings', action: 'view' },
        },
        children: [
          {
            name: 'All Expenses',
            href: '/expenses',
            icon: Receipt,
            permission: { module: 'expense.requests', action: 'view' },
          },
          {
            name: 'Budgets',
            href: '/expenses/budgets',
            icon: Wallet,
            permission: { module: 'expense.budgets', action: 'view' },
          },
          {
            name: 'Reimbursements',
            href: '/expenses/reimbursements',
            icon: ArrowLeftRight,
            permission: { module: 'expense.reimbursements', action: 'view' },
          },
        ],
      },
      {
        id: 'certificates',
        name: 'Certificates',
        icon: Award,
        children: [
          {
            name: 'Requests',
            href: '/certificates',
            icon: FileText,
            permission: { module: 'certificates.requests', action: 'view' },
          },
          {
            name: 'Reports',
            href: '/certificates/reports',
            icon: BarChart3,
            permission: { module: 'certificates.requests', action: 'view' },
          },
          {
            name: 'Templates',
            href: '/certificates/templates',
            icon: ClipboardList,
            permission: { module: 'certificates.types', action: 'view' },
          },
        ],
      },
    ],
  },
  {
    id: 'administration',
    label: 'Administration',
    modules: [
      {
        id: 'organization',
        name: 'Organization',
        icon: Building2,
        alwaysAvailable: true,
        // S1-01: hidden entirely for BRANCH_ADMIN.
        specialGate: 'hideForBranchAdmin',
        settings: {
          href: '/organization/settings',
          permission: { module: 'organization.settings', action: 'view' },
        },
        children: [
          {
            name: 'Overview',
            href: '/organization',
            icon: LayoutDashboard,
            exact: true,
            permission: { module: 'organization.settings', action: 'view' },
          },
          // Structure — what the organization is made of, top-down.
          {
            name: 'Institutions',
            href: '/organization/institutions',
            icon: Landmark,
            group: 'Structure',
            permission: { module: 'organization.branches', action: 'view' },
          },
          {
            name: 'Branches',
            href: '/organization/branches',
            icon: GitBranch,
            group: 'Structure',
            // Universities operate campuses that host constituent institutions.
            universityLabel: 'Campuses',
            permission: { module: 'organization.branches', action: 'view' },
          },
          {
            name: 'Infrastructure',
            href: '/organization/infrastructure',
            icon: Warehouse,
            group: 'Structure',
            permission: { module: 'organization.infrastructure', action: 'view' },
          },
          // People & access — who can do what.
          {
            name: 'Users',
            href: '/organization/users',
            icon: UserCog,
            group: 'People & access',
            permission: { module: 'organization.users', action: 'view' },
          },
          {
            name: 'Roles',
            href: '/organization/roles',
            icon: Shield,
            group: 'People & access',
            permission: { module: 'organization.roles', action: 'view' },
          },
          {
            name: 'Approvals',
            href: '/organization/approvals',
            icon: CheckCheck,
            group: 'People & access',
            permission: { module: 'organization.settings', action: 'view' },
          },
          // System — configuration most admins set once.
          {
            name: 'Custom Fields',
            href: '/organization/custom-fields',
            icon: FormInput,
            group: 'System',
            permission: { module: 'organization.settings', action: 'view' },
          },
          {
            name: 'Scheduled Jobs',
            href: '/organization/schedule-jobs',
            icon: Calendar,
            group: 'System',
            permission: { module: 'organization.settings', action: 'view' },
          },
        ],
      },
      {
        id: 'audit',
        name: 'Activity Logs',
        icon: ScrollText,
        href: '/audit',
        alwaysAvailable: true,
        permission: { module: 'dashboard.audit', action: 'view' },
      },
    ],
  },
];

/**
 * Student navigation — a single unlabeled section. Children vary with the
 * tenant's subscribed modules, so this is a builder rather than a constant.
 */
export function getStudentNavSections(enabledModules: string[]): NavSection[] {
  return [
    {
      id: 'student',
      modules: [
        {
          id: 'dashboard',
          name: 'Dashboard',
          icon: LayoutDashboard,
          href: '/dashboard',
        },
        {
          id: 'student-academics',
          name: 'Academics',
          icon: BookOpen,
          children: [
            // Course registration only when the tenant has the module enabled
            ...(enabledModules.includes('registration')
              ? [
                  {
                    name: 'Course Registration',
                    href: '/student/registration',
                    icon: BookOpenCheck,
                  },
                ]
              : []),
            { name: 'My Timetable', href: '/student/timetable', icon: Calendar },
            { name: 'Live Classes', href: '/student/live-classes', icon: Video },
            { name: 'Assignments', href: '/student/assignments', icon: ClipboardList },
            { name: 'Attendance', href: '/student/attendance', icon: ClipboardCheck },
            { name: 'Gradebook', href: '/student/grades', icon: Award },
            // Exit surveys are the indirect half of OBE attainment
            ...(enabledModules.includes('obe')
              ? [{ name: 'Course Surveys', href: '/student/course-surveys', icon: Star }]
              : []),
            // Transcript needs BOTH: registration (credits exist at all) and
            // exams (it reads /exams/transcripts, which requireModule('exams')
            // gates). Checking only registration left a menu item that 403s.
            ...(enabledModules.includes('registration') && enabledModules.includes('exams')
              ? [{ name: 'Transcript', href: '/student/transcript', icon: ScrollText }]
              : []),
          ],
        },
        {
          id: 'student-finance',
          name: 'Finance',
          icon: IndianRupee,
          children: [{ name: 'Fee Details', href: '/student/fees', icon: Receipt }],
        },
        {
          id: 'student-hostel',
          name: 'Hostel',
          icon: Hotel,
          children: [{ name: 'My Allocation', href: '/student/hostel', icon: BedDouble }],
        },
        {
          id: 'student-clubs',
          name: 'Clubs',
          icon: PartyPopper,
          children: [
            { name: 'Explore Clubs', href: '/clubs', icon: Compass, exact: true },
            { name: 'My Clubs', href: '/clubs/mine', icon: Heart },
          ],
        },
        {
          id: 'student-comms',
          name: 'Communications',
          icon: Bell,
          children: [
            { name: 'Campus Feed', href: '/feed', icon: Newspaper },
            { name: 'Announcements', href: '/student/announcements', icon: Megaphone },
            { name: 'Calendar', href: '/student/calendar', icon: CalendarDays },
          ],
        },
        {
          id: 'student-feedback',
          name: 'Concerns & Feedback',
          icon: MessageCircleWarning,
          children: [
            { name: 'My Tickets', href: '/student/feedback', icon: ClipboardList },
            { name: 'Submit Concern', href: '/student/feedback/new', icon: UserPlus },
          ],
        },
      ],
    },
  ];
}
