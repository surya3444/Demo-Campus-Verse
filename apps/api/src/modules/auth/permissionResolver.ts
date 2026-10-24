import {
  PERMISSIONS as ALL_PERMISSIONS,
  ORG_ADMIN_PERMISSIONS,
  BRANCH_ADMIN_PERMISSIONS,
  HOD_PERMISSIONS,
  TEACHER_PERMISSIONS,
  ADMISSION_COUNSELOR_PERMISSIONS,
  ACCOUNTANT_PERMISSIONS,
  HR_MANAGER_PERMISSIONS,
  RECEPTIONIST_PERMISSIONS,
  STUDENT_PERMISSIONS,
  PLACEMENT_OFFICER_PERMISSIONS,
  CAREER_COUNSELOR_PERMISSIONS,
  HOSTEL_WARDEN_PERMISSIONS,
  INVENTORY_MANAGER_PERMISSIONS,
  ADMIN_TOGGLED_PERMISSIONS,
  SYSTEM_ROLES,
} from '@campus-verse/shared/constants';

type Permissions = Record<string, string[]>;

export interface RoleLike {
  code: string;
  permissions?: Permissions;
  /**
   * Every permission key that existed when an admin last saved this role in the
   * Roles editor. Set means "customised": the saved role is the truth, and only
   * modules added to the platform after that save are switched on by default.
   */
  permissionKeysSeen?: string[];
}

/** Features every role has until an admin switches them off for that role. */
const ON_FOR_EVERY_ROLE: Permissions = { 'ai.assistant': ['use'] };

/** The out-of-the-box permission set of each built-in role. */
const DEFAULTS: Record<string, Permissions> = {
  ORG_ADMIN: ORG_ADMIN_PERMISSIONS,
  BRANCH_ADMIN: BRANCH_ADMIN_PERMISSIONS,
  INSTITUTION_ADMIN: BRANCH_ADMIN_PERMISSIONS,
  HOD: HOD_PERMISSIONS,
  TEACHER: TEACHER_PERMISSIONS,
  ADMISSION_COUNSELOR: ADMISSION_COUNSELOR_PERMISSIONS,
  ACCOUNTANT: ACCOUNTANT_PERMISSIONS,
  HR_MANAGER: HR_MANAGER_PERMISSIONS,
  RECEPTIONIST: RECEPTIONIST_PERMISSIONS,
  STUDENT: STUDENT_PERMISSIONS,
  PLACEMENT_OFFICER: PLACEMENT_OFFICER_PERMISSIONS,
  CAREER_COUNSELOR: CAREER_COUNSELOR_PERMISSIONS,
  HOSTEL_WARDEN: HOSTEL_WARDEN_PERMISSIONS,
  INVENTORY_MANAGER: INVENTORY_MANAGER_PERMISSIONS,
};

const FULL_ACCESS: readonly string[] = [SYSTEM_ROLES.GROUP_OWNER, SYSTEM_ROLES.ORG_MODERATOR];
// Admin roles always took their defaults verbatim (until customised).
const ADMIN_DEFAULT_ONLY: readonly string[] = [SYSTEM_ROLES.ORG_ADMIN, SYSTEM_ROLES.BRANCH_ADMIN];
// Teacher-workspace keys don't belong to admin roles. Admins keep
// teaching.timetable (they build timetables) and teaching.grades (gradebook).
const TEACHER_ONLY = [
  'teaching.myClasses',
  'teaching.myStudents',
  'teaching.lessonPlans',
  'teaching.assignments',
];
const NO_TEACHER_KEYS: readonly string[] = [
  ...FULL_ACCESS,
  ...ADMIN_DEFAULT_ONLY,
  'INSTITUTION_ADMIN',
];

// Admins used to be waved through these modules by a blanket check; their
// defaults now include them in full instead, so access is unchanged but can be
// switched off per role like anything else.
const ADMIN_FULL_MODULE_PREFIXES = [
  'teaching.',
  'courses.',
  'careerConnect.',
  'hostel.',
  'health.',
  'certificates.',
  'communications.',
  'inventory.',
  'expense.',
  'visitor.',
  'feedback.',
  'transport.',
  'obe.',
  'dashboard.fees',
];
const ADMIN_CODES: readonly string[] = [...ADMIN_DEFAULT_ONLY, 'INSTITUTION_ADMIN'];

// Every staff role works tasks and raises issues; leaders also hand work down.
const ASSIGNS_WORK: readonly string[] = [...ADMIN_DEFAULT_ONLY, 'INSTITUTION_ADMIN', 'HOD'];

export function defaultPermissions(code: string): Permissions | null {
  if (FULL_ACCESS.includes(code)) return { ...(ALL_PERMISSIONS as unknown as Permissions) };
  if (!DEFAULTS[code]) return null;
  const base: Permissions = { ...DEFAULTS[code] };
  if (code !== 'STUDENT') {
    base['workspace.tasks'] = ASSIGNS_WORK.includes(code) ? ['view', 'assign'] : ['view'];
    base['workspace.issues'] = ['view', 'raise'];
  }
  if (ADMIN_CODES.includes(code)) {
    for (const [key, actions] of Object.entries(ALL_PERMISSIONS as unknown as Permissions)) {
      if (ADMIN_FULL_MODULE_PREFIXES.some((p) => key.startsWith(p))) base[key] = [...actions];
    }
  }
  return base;
}

/** Every permission key the platform currently knows (stamped on save). */
export function allPermissionKeys(): string[] {
  return Object.keys(ALL_PERMISSIONS);
}

/**
 * The permissions a role actually grants. Custom roles are exactly what was
 * saved. Built-in roles start from their defaults (so new modules appear
 * without a migration); once an admin saves one in the Roles editor, the saved
 * choices win — including anything switched off — and only modules added to
 * the platform since then are topped up.
 */
export function resolvePermissions(role: RoleLike): Permissions {
  const stored = role.permissions ?? {};
  const defaults = defaultPermissions(role.code);
  if (!defaults) {
    // Custom roles: exactly what was saved, plus platform features every role
    // gets until an admin decides on them in the editor.
    const result = { ...stored };
    const seen = new Set(role.permissionKeysSeen ?? []);
    for (const [key, actions] of Object.entries(ON_FOR_EVERY_ROLE)) {
      if (!seen.has(key) && !result[key]) result[key] = [...actions];
    }
    return result;
  }

  let result: Permissions;
  if (FULL_ACCESS.includes(role.code)) {
    result = defaults;
  } else if (role.permissionKeysSeen?.length) {
    const seen = new Set(role.permissionKeysSeen);
    result = { ...stored };
    for (const [key, actions] of Object.entries(defaults)) {
      if (!seen.has(key) && !result[key]) result[key] = [...actions];
    }
  } else if (ADMIN_DEFAULT_ONLY.includes(role.code)) {
    result = defaults;
  } else {
    result = { ...stored, ...defaults };
    // Admin-toggled keys follow the saved role only, so switching one off sticks.
    for (const key of ADMIN_TOGGLED_PERMISSIONS) {
      if (stored[key]) result[key] = stored[key];
      else delete result[key];
    }
  }

  if (NO_TEACHER_KEYS.includes(role.code)) {
    for (const key of TEACHER_ONLY) delete result[key];
  }
  return result;
}
