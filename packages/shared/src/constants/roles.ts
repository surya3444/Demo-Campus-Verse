import {
  BRANCH_ADMIN_PERMISSIONS,
  HOD_PERMISSIONS,
  TEACHER_PERMISSIONS,
  ADMISSION_COUNSELOR_PERMISSIONS,
  ACCOUNTANT_PERMISSIONS,
  HR_MANAGER_PERMISSIONS,
  RECEPTIONIST_PERMISSIONS,
  PLACEMENT_OFFICER_PERMISSIONS,
  CAREER_COUNSELOR_PERMISSIONS,
  HOSTEL_WARDEN_PERMISSIONS,
  INVENTORY_MANAGER_PERMISSIONS,
  STUDENT_PERMISSIONS,
} from './permissions';

/**
 * System Roles with hierarchy:
 *
 * Level 0: GROUP_OWNER - Full control of the group (can have multiple orgs)
 * Level 1: ORG_MODERATOR - Same access as owner, but cannot create/edit other moderators
 * Level 2: ORG_ADMIN - Admin access to a single organization
 * Level 3: BRANCH_ADMIN - Admin access to a single branch
 */
export const SYSTEM_ROLES = {
  GROUP_OWNER: 'GROUP_OWNER',
  ORG_MODERATOR: 'ORG_MODERATOR',
  ORG_ADMIN: 'ORG_ADMIN',
  BRANCH_ADMIN: 'BRANCH_ADMIN',
} as const;

export type SystemRole = (typeof SYSTEM_ROLES)[keyof typeof SYSTEM_ROLES];

/**
 * Role hierarchy levels - lower number = higher privilege
 */
export const ROLE_HIERARCHY: Record<string, number> = {
  [SYSTEM_ROLES.GROUP_OWNER]: 0,
  [SYSTEM_ROLES.ORG_MODERATOR]: 1,
  [SYSTEM_ROLES.ORG_ADMIN]: 2,
  [SYSTEM_ROLES.BRANCH_ADMIN]: 3,
  INSTITUTION_ADMIN: 3,
  HOD: 5,
  TEACHER: 10,
  ADMISSION_COUNSELOR: 10,
  ACCOUNTANT: 10,
  HR_MANAGER: 10,
  PLACEMENT_OFFICER: 10,
  CAREER_COUNSELOR: 10,
  HOSTEL_WARDEN: 10,
  INVENTORY_MANAGER: 10,
  RECEPTIONIST: 15,
  STUDENT: 20,
};

/**
 * Role-level bands. Levels 0–3 are admin/system roles, 10–19 are operational
 * staff roles (teacher, accountant, receptionist, …), 20+ are students.
 */
export const MIN_STAFF_ROLE_LEVEL = 10;
export const STUDENT_ROLE_LEVEL = 20;

/**
 * True for operational staff roles — the ones that can hold employment and be
 * targeted by HR features like salary structures. Excludes admin/system roles
 * (level < 10) and students (level >= 20).
 */
export function isStaffRoleLevel(level: number | undefined | null): boolean {
  return (level ?? -1) >= MIN_STAFF_ROLE_LEVEL && (level ?? -1) < STUDENT_ROLE_LEVEL;
}

/**
 * Role display names
 */
export const ROLE_DISPLAY_NAMES: Record<string, string> = {
  [SYSTEM_ROLES.GROUP_OWNER]: 'Group Owner',
  [SYSTEM_ROLES.ORG_MODERATOR]: 'Org Moderator',
  [SYSTEM_ROLES.ORG_ADMIN]: 'Org Admin',
  [SYSTEM_ROLES.BRANCH_ADMIN]: 'Branch Admin',
  INSTITUTION_ADMIN: 'Institution Admin',
  HOD: 'Head of Department',
  TEACHER: 'Teacher',
  ADMISSION_COUNSELOR: 'Admission Counselor',
  ACCOUNTANT: 'Accountant',
  HR_MANAGER: 'HR Manager',
  PLACEMENT_OFFICER: 'Placement Officer',
  CAREER_COUNSELOR: 'Career Counselor',
  HOSTEL_WARDEN: 'Hostel Warden',
  INVENTORY_MANAGER: 'Inventory Manager',
  RECEPTIONIST: 'Receptionist',
  STUDENT: 'Student',
};

/**
 * Roles that can manage other roles at their level or below
 */
export const MANAGER_ROLES: SystemRole[] = [
  SYSTEM_ROLES.GROUP_OWNER,
  SYSTEM_ROLES.ORG_MODERATOR,
  SYSTEM_ROLES.ORG_ADMIN,
  SYSTEM_ROLES.BRANCH_ADMIN,
];

/**
 * Roles that have access to account-level features (billing, subscriptions)
 */
export const ACCOUNT_LEVEL_ROLES: SystemRole[] = [
  SYSTEM_ROLES.GROUP_OWNER,
  SYSTEM_ROLES.ORG_MODERATOR,
];

/**
 * Roles that have access to organization-level features
 */
export const ORG_LEVEL_ROLES: SystemRole[] = [
  SYSTEM_ROLES.GROUP_OWNER,
  SYSTEM_ROLES.ORG_MODERATOR,
  SYSTEM_ROLES.ORG_ADMIN,
];

/**
 * Check if a role can manage another role based on hierarchy
 */
export function canManageRole(managerRole: string, targetRole: string): boolean {
  const managerLevel = ROLE_HIERARCHY[managerRole];
  const targetLevel = ROLE_HIERARCHY[targetRole];

  if (managerLevel === undefined || targetLevel === undefined) {
    return false;
  }

  // Special case: ORG_MODERATOR cannot manage other ORG_MODERATORs
  if (managerRole === SYSTEM_ROLES.ORG_MODERATOR && targetRole === SYSTEM_ROLES.ORG_MODERATOR) {
    return false;
  }

  // Lower level number = higher privilege
  return managerLevel < targetLevel;
}

/**
 * Get all roles that a given role can assign
 */
export function getAssignableRoles(role: string): SystemRole[] {
  const roleLevel = ROLE_HIERARCHY[role];
  if (roleLevel === undefined) return [];

  // Special case: ORG_MODERATOR cannot assign other ORG_MODERATORs
  if (role === SYSTEM_ROLES.ORG_MODERATOR) {
    return (Object.entries(ROLE_HIERARCHY) as [SystemRole, number][])
      .filter(([roleName, level]) => level > roleLevel && roleName !== SYSTEM_ROLES.ORG_MODERATOR)
      .map(([roleName]) => roleName);
  }

  return (Object.entries(ROLE_HIERARCHY) as [SystemRole, number][])
    .filter(([, level]) => level > roleLevel)
    .map(([roleName]) => roleName);
}

/**
 * Default operational roles seeded for every new tenant.
 * These are NOT system roles - tenant admins can customize or delete them.
 */
export const DEFAULT_ROLES = [
  {
    name: 'Institution Admin',
    code: 'INSTITUTION_ADMIN',
    description:
      'Runs one institution on a campus (e.g. the engineering college); scope it to the institution',
    level: 3,
    permissions: BRANCH_ADMIN_PERMISSIONS,
  },
  {
    name: 'Head of Department',
    code: 'HOD',
    description: "Teaches and oversees one department's students, staff and results",
    level: 5,
    permissions: HOD_PERMISSIONS,
  },
  {
    name: 'Teacher',
    code: 'TEACHER',
    description: 'Classroom-level access for marking attendance and viewing students',
    level: 10,
    permissions: TEACHER_PERMISSIONS,
  },
  {
    name: 'Admission Counselor',
    code: 'ADMISSION_COUNSELOR',
    description: 'Full access to leads and applications in the admission pipeline',
    level: 10,
    permissions: ADMISSION_COUNSELOR_PERMISSIONS,
  },
  {
    name: 'Accountant',
    code: 'ACCOUNTANT',
    description: 'Finance operations including fee collection, reports, and concessions',
    level: 10,
    permissions: ACCOUNTANT_PERMISSIONS,
  },
  {
    name: 'HR Manager',
    code: 'HR_MANAGER',
    description: 'Staff management, HR attendance, leave approvals, and workload tracking',
    level: 10,
    permissions: HR_MANAGER_PERMISSIONS,
  },
  {
    name: 'Placement Officer',
    code: 'PLACEMENT_OFFICER',
    description:
      'Placement drives, company relations, job board, and student career profile management',
    level: 10,
    permissions: PLACEMENT_OFFICER_PERMISSIONS,
  },
  {
    name: 'Career Counselor',
    code: 'CAREER_COUNSELOR',
    description:
      'Career counseling sessions, assessments, and resource library management for schools',
    level: 10,
    permissions: CAREER_COUNSELOR_PERMISSIONS,
  },
  {
    name: 'Hostel Warden',
    code: 'HOSTEL_WARDEN',
    description:
      'Hostel operations including room management, bed allocations, and occupancy tracking',
    level: 10,
    permissions: HOSTEL_WARDEN_PERMISSIONS,
  },
  {
    name: 'Inventory Manager',
    code: 'INVENTORY_MANAGER',
    description:
      'Full inventory management including asset tracking, procurement, and issue/return operations',
    level: 10,
    permissions: INVENTORY_MANAGER_PERMISSIONS,
  },
  {
    name: 'Receptionist',
    code: 'RECEPTIONIST',
    description:
      'Front desk operations with view access to students, attendance, and health visits',
    level: 15,
    permissions: RECEPTIONIST_PERMISSIONS,
  },
  {
    name: 'Student',
    code: 'STUDENT',
    description: 'Student portal access for viewing assignments, timetable, and attendance',
    level: 20,
    permissions: STUDENT_PERMISSIONS,
  },
];

/**
 * Built-in administrator roles. Only these skip permission checks for
 * admin-bypass modules (rbac.ts); a custom role does not gain that by being
 * given a low level.
 */
export const ADMIN_ROLE_CODES: readonly string[] = [
  SYSTEM_ROLES.GROUP_OWNER,
  SYSTEM_ROLES.ORG_MODERATOR,
  SYSTEM_ROLES.ORG_ADMIN,
  SYSTEM_ROLES.BRANCH_ADMIN,
  'INSTITUTION_ADMIN',
];
