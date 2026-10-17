/**
 * Available modules in CampusVerse platform
 * Core modules are always enabled, optional modules can be selected during registration
 */

export const MODULES = {
  // Core modules - always enabled
  core: {
    code: 'core',
    name: 'Core',
    description:
      'Essential organization management including branches, users, roles, and academic structure',
    features: [
      'organization',
      'branches',
      'users',
      'roles',
      'classes',
      'subjects',
      'sections',
      'academicBatches',
    ],
    required: true,
    icon: 'Building2',
  },

  // Optional modules
  admissions: {
    code: 'admissions',
    name: 'Admissions',
    description: 'Student admission leads, applications, and enrollment management',
    features: ['leads', 'applications', 'enrollment'],
    required: true,
    icon: 'UserPlus',
  },

  students: {
    code: 'students',
    name: 'Students',
    description: 'Student records, profiles, and academic management',
    features: ['list', 'details', 'enrollment', 'promotion'],
    required: true,
    icon: 'GraduationCap',
  },

  finance: {
    code: 'finance',
    name: 'Finance',
    description: 'Fee collection, fee structures, concessions, and financial reports',
    features: ['feeCounter', 'feeStructures', 'collections', 'dues', 'concessions', 'reports'],
    required: false,
    icon: 'Wallet',
  },

  hr: {
    code: 'hr',
    name: 'HR & Staff',
    description: 'Staff management, payroll, leaves, and workload tracking',
    features: ['staff', 'attendance', 'leaves', 'workload'],
    required: false,
    icon: 'Users',
  },

  attendance: {
    code: 'attendance',
    name: 'Attendance',
    description: 'Student attendance marking, tracking, and reports',
    features: ['mark', 'view', 'reports'],
    required: true,
    icon: 'ClipboardCheck',
  },

  communications: {
    code: 'communications',
    name: 'Communications',
    description: 'SMS notifications, announcements, and academic calendar',
    features: ['sms', 'announcements', 'calendar'],
    required: true,
    icon: 'MessageSquare',
  },

  certificates: {
    code: 'certificates',
    name: 'Certificates',
    description: 'Certificate templates and generation for students',
    features: ['templates', 'generation'],
    required: false,
    icon: 'Award',
  },

  health: {
    code: 'health',
    name: 'Health',
    description:
      'Health records, checkups, vaccinations, and medical visits for students and staff',
    features: ['records', 'checkups', 'vaccinations', 'visits', 'reports'],
    required: false,
    icon: 'Heart',
  },

  teaching: {
    code: 'teaching',
    name: 'Teaching',
    description: 'Teacher workspace with timetable, lesson plans, assignments, and gradebook',
    features: ['myClasses', 'timetable', 'lessonPlans', 'assignments', 'grades', 'liveClasses'],
    required: false,
    icon: 'BookOpen',
  },

  careerConnect: {
    code: 'careerConnect',
    name: 'Career Connect',
    description:
      'Placement drives, job board, career counseling, alumni network, and student career profiles',
    features: [
      'companies',
      'drives',
      'jobBoard',
      'studentProfiles',
      'counseling',
      'resources',
      'alumni',
      'mentorship',
      'events',
      'reports',
      'settings',
    ],
    required: false,
    icon: 'Briefcase',
  },

  courses: {
    code: 'courses',
    name: 'Courses & Online Teaching',
    description:
      'Course management, video lessons, quizzes, student enrollment, and progress tracking',
    features: ['courses', 'lessons', 'quizzes', 'enrollments', 'progress', 'reports', 'settings'],
    required: false,
    icon: 'BookOpen',
  },

  hostel: {
    code: 'hostel',
    name: 'Hostel',
    description: 'Hostel management with room allocation, vacancy tracking, and occupancy reports',
    features: ['hostels', 'rooms', 'allocations', 'reports', 'settings'],
    required: false,
    icon: 'Hotel',
  },

  campusFeed: {
    code: 'campusFeed',
    name: 'Campus Feed',
    description:
      'Social feed for campus-wide posts, likes, comments, media sharing, and moderation',
    features: ['posts'],
    required: false,
    icon: 'Newspaper',
  },

  inventory: {
    code: 'inventory',
    name: 'Inventory',
    description:
      'Asset tracking, stock management, procurement, and issue/return of institutional assets',
    features: ['assets', 'categories', 'procurement', 'issue', 'reports', 'settings'],
    required: false,
    icon: 'Package',
  },

  expense: {
    code: 'expense',
    name: 'Expense Management',
    description:
      'Expense requests, approvals, reimbursements, budget tracking, and expense reports',
    features: ['requests', 'approvals', 'reimbursements', 'budgets', 'reports', 'settings'],
    required: false,
    icon: 'Receipt',
  },

  feedback: {
    code: 'feedback',
    name: 'Concerns & Feedback',
    description:
      'Grievance submission, ticket tracking, resolution workflow, and satisfaction surveys',
    features: ['tickets', 'reports'],
    required: false,
    icon: 'MessageCircleWarning',
  },

  visitor: {
    code: 'visitor',
    name: 'Visitor Management',
    description: 'Visitor registration, check-in/out, digital passes, and visitor logs',
    features: ['visitors', 'passes', 'logs', 'dashboard', 'settings'],
    required: false,
    icon: 'UserCheck',
  },

  transport: {
    code: 'transport',
    name: 'Transport',
    description:
      'School bus fleet management with Google Maps routes, stops, per-stop or flat pricing, and student enrollment',
    features: ['buses', 'stops', 'enrollments', 'reports', 'settings'],
    required: false,
    icon: 'Bus',
  },

  aiAssistant: {
    code: 'aiAssistant',
    name: 'AI Assistant',
    description:
      'Conversational assistant that answers questions about your data (students, fees, attendance, admissions, staff) and links you to the right page — instead of digging through menus',
    features: ['chat'],
    required: false,
    icon: 'Sparkles',
  },

  registration: {
    code: 'registration',
    name: 'Course Registration',
    description:
      'Semester-wise curriculum schemes (CBCS/NEP), elective baskets with seat caps, student self-registration with credit limits, fee-clearance gating, and add/drop windows. For colleges and universities.',
    features: ['schemes', 'registrations', 'overview'],
    required: false,
    icon: 'BookOpenCheck',
  },

  exams: {
    code: 'exams',
    name: 'Exams & Report Cards',
    description:
      'Term-scoped exams, paper scheduling per section, marks entry, grading scales, PDF report cards, hall tickets, result-publish notifications, and year-end promotion.',
    features: [
      'config',
      'exams',
      'schedules',
      'marks',
      'results',
      'reportCards',
      'hallTickets',
      'promotion',
    ],
    required: false,
    icon: 'ClipboardList',
  },

  obe: {
    code: 'obe',
    name: 'OBE Attainment',
    description:
      'NBA/NAAC outcome-based education: PO/PSO/CO definitions, CO-PO mapping matrices, question-wise assessment capture, direct/indirect CO attainment, PO/PSO attainment dashboards and accreditation exports.',
    features: [
      'programs',
      'outcomes',
      'offerings',
      'marks',
      'attainment',
      'surveys',
      'reports',
      'settings',
    ],
    required: false,
    icon: 'Target',
  },
} as const;

// Module codes
export const MODULE_CODES = Object.keys(MODULES) as ModuleCode[];

// Core module codes (always enabled) — derived from the `required` flag so the
// MODULES table stays the single source of truth.
export const CORE_MODULES: ModuleCode[] = MODULE_CODES.filter((code) => MODULES[code].required);

// Optional module codes
export const OPTIONAL_MODULES: ModuleCode[] = MODULE_CODES.filter(
  (code) => !MODULES[code].required
);

// Default modules for new signups (core + commonly requested)
export const DEFAULT_REQUESTED_MODULES: ModuleCode[] = [
  'core',
  'students',
  'attendance',
  'teaching',
];

/**
 * Defaults tuned to the institution type. Colleges and universities run on
 * semester registration, exams, placements and hostels out of the gate —
 * shipping them with a school's module set means the features they bought
 * are switched off on day one.
 */
export function defaultModulesFor(institutionType?: string): ModuleCode[] {
  if (institutionType === 'college' || institutionType === 'university') {
    return [
      ...DEFAULT_REQUESTED_MODULES,
      'registration',
      'exams',
      'obe',
      'careerConnect',
      'hostel',
      // Departments are the TOP of a university's academic hierarchy, but their
      // registry (and the staff who head them) lives in HR. Without it the
      // Departments page is read-only and the subject catalogue silently drops
      // its owner-department and minimum-designation fields.
      'hr',
    ];
  }
  return DEFAULT_REQUESTED_MODULES;
}

// Types
export type ModuleCode = keyof typeof MODULES;
export type Module = (typeof MODULES)[ModuleCode];

// Helper functions
export function isValidModuleCode(code: string): code is ModuleCode {
  return code in MODULES;
}

export function getModuleByCode(code: ModuleCode): Module {
  return MODULES[code];
}

export function getCoreModules(): Module[] {
  return CORE_MODULES.map((code) => MODULES[code]);
}

export function getOptionalModules(): Module[] {
  return OPTIONAL_MODULES.map((code) => MODULES[code]);
}

export function getAllModules(): Module[] {
  return MODULE_CODES.map((code) => MODULES[code]);
}

// Validate requested modules (must include core)
export function validateRequestedModules(modules: string[]): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check for invalid module codes
  for (const module of modules) {
    if (!isValidModuleCode(module)) {
      errors.push(`Invalid module code: ${module}`);
    }
  }

  // Core must be included
  if (!modules.includes('core')) {
    errors.push('Core module is required');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// Ensure core modules are included
export function ensureCoreModules(modules: string[]): ModuleCode[] {
  const moduleSet = new Set(modules.filter(isValidModuleCode));
  CORE_MODULES.forEach((core) => moduleSet.add(core));
  return Array.from(moduleSet);
}
