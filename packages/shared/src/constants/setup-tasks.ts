/**
 * Source of truth for the "Finish setting up" checklist that appears on the
 * admin dashboard until the school is operationally ready. Each task has a
 * deterministic id, a category for grouping, copy for the UI, and a target
 * URL to deep-link the admin to the right settings page.
 *
 * The status (done / pending) is computed server-side in the dashboard's
 * setup-status service by checking the relevant Mongo collection.
 */

export type SetupTaskCategory = 'identity' | 'academics' | 'people' | 'money' | 'operations';

export interface SetupTaskDefinition {
  id: string;
  category: SetupTaskCategory;
  title: string;
  description: string;
  href: string;
  /** Whether the dashboard should treat this as a hard blocker for "100%". */
  required: boolean;
}

export const SETUP_TASKS: SetupTaskDefinition[] = [
  // ─── Identity ────────────────────────────────────────────────────────────
  {
    id: 'branding',
    category: 'identity',
    title: 'Add your school logo and brand colours',
    description:
      'Your logo and primary colour appear on the sidebar, receipts, and parent communications.',
    href: '/organization/settings?section=branding',
    required: true,
  },
  {
    id: 'address',
    category: 'identity',
    title: 'Complete your contact address',
    description: 'Used on fee receipts, certificates, and the public-facing admission form.',
    href: '/organization/settings?section=contact',
    required: false,
  },

  // ─── Academics ───────────────────────────────────────────────────────────
  {
    id: 'sections',
    category: 'academics',
    title: 'Add sections to your classes',
    description: "You can't enrol students until each class has at least one section.",
    href: '/organization/academic-structure',
    required: true,
  },
  {
    id: 'subjects',
    category: 'academics',
    title: 'Build your subject library',
    description: 'Subjects power timetables, lesson plans, gradebook, and assignments.',
    href: '/organization/academic-structure',
    required: true,
  },
  {
    id: 'class_teachers',
    category: 'academics',
    title: 'Assign class teachers to sections',
    description: 'Class teachers own attendance and parent communication for their section.',
    href: '/organization/academic-structure',
    required: false,
  },

  // ─── People ──────────────────────────────────────────────────────────────
  {
    id: 'staff',
    category: 'people',
    title: 'Add your staff',
    description:
      'Create records for your principal, teachers, and office staff so they can sign in and be assigned to classes.',
    href: '/hr/staff',
    required: true,
  },

  // ─── Money ───────────────────────────────────────────────────────────────
  {
    id: 'fee_structure',
    category: 'money',
    title: 'Create your first fee structure',
    description:
      'Fee structures hold tuition, transport, and lab fees for a class. The fee counter needs at least one to collect payments.',
    href: '/finance/fee-structures',
    required: true,
  },
  {
    id: 'fee_assignment',
    category: 'money',
    title: 'Assign fees to students',
    description:
      'Each enrolled student needs a fee assignment so dues can be tracked and receipts can be issued.',
    href: '/finance/fee-structures?tab=assignments',
    required: false,
  },

  // ─── Operations ──────────────────────────────────────────────────────────
  {
    id: 'admission_sources',
    category: 'operations',
    title: 'Configure admission sources',
    description:
      'Pre-populate Walk-in, Referral, Website etc. so leads can be tagged at capture time.',
    href: '/admissions/settings?tab=sources',
    required: false,
  },
  {
    id: 'communications',
    category: 'operations',
    title: 'Set up SMS or email provider',
    description:
      'Connect a provider so attendance alerts, fee reminders, and announcements actually reach parents.',
    href: '/communications/settings?tab=sms',
    required: false,
  },
];

export type SetupInstitutionType = 'school' | 'college' | 'university';

/**
 * Copy overrides per institution type. The base SETUP_TASKS copy is written
 * for schools; colleges and universities swap in their own terminology
 * (streams/departments, faculty, dean). Task ids/hrefs/required never vary.
 */
const SETUP_TASK_COPY: Record<
  Exclude<SetupInstitutionType, 'school'>,
  Record<string, Partial<Pick<SetupTaskDefinition, 'title' | 'description'>>>
> = {
  college: {
    branding: { title: 'Add your college logo and brand colours' },
    sections: {
      title: 'Add sections to your streams',
      description: "You can't enrol students until each stream has at least one section.",
    },
    class_teachers: {
      title: 'Assign faculty in charge to sections',
      description: 'Faculty in charge own attendance and parent communication for their section.',
    },
    staff: {
      description:
        'Create records for your principal, faculty, and office staff so they can sign in and be assigned to classes.',
    },
    fee_structure: {
      description:
        'Fee structures hold tuition, transport, and lab fees for a stream. The fee counter needs at least one to collect payments.',
    },
  },
  university: {
    branding: { title: 'Add your university logo and brand colours' },
    sections: {
      title: 'Add sections to your departments',
      description: "You can't enrol students until each department has at least one section.",
    },
    class_teachers: {
      title: 'Assign faculty in charge to sections',
      description: 'Faculty in charge own attendance and student communication for their section.',
    },
    staff: {
      description:
        'Create records for your dean, faculty, and office staff so they can sign in and be assigned to classes.',
    },
    fee_structure: {
      description:
        'Fee structures hold tuition, transport, and lab fees for a department. The fee counter needs at least one to collect payments.',
    },
  },
};

/** SETUP_TASKS with copy adapted to the branch's institution type. */
export function getSetupTasks(institutionType?: string): SetupTaskDefinition[] {
  if (institutionType !== 'college' && institutionType !== 'university') return SETUP_TASKS;
  const overrides = SETUP_TASK_COPY[institutionType];
  return SETUP_TASKS.map((task) => ({ ...task, ...overrides[task.id] }));
}

export const SETUP_TASK_CATEGORY_LABELS: Record<SetupTaskCategory, string> = {
  identity: 'Identity',
  academics: 'Academics',
  people: 'People',
  money: 'Money',
  operations: 'Operations',
};

export type SetupTaskStatus = 'done' | 'pending' | 'dismissed';

export interface SetupTaskState {
  id: string;
  status: SetupTaskStatus;
  /** When the user explicitly snoozed this task; absent if never dismissed. */
  dismissedAt?: string;
}

export interface SetupStatusPayload {
  tasks: SetupTaskState[];
  /** % of REQUIRED tasks completed — drives the progress bar. */
  requiredPercent: number;
  /** True when every required task is `done`; signals the panel to disappear. */
  allRequiredDone: boolean;
}
