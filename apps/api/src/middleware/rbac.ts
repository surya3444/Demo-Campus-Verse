import { Request, Response, NextFunction } from 'express';
import { TokenPayload } from '@campus-verse/shared';
import { tagMiddleware } from './meta';
import { ApiError } from './errorHandler';


/**
 * Pure permission check shared by route middleware (requirePermission) and the
 * AI Assistant tool registry, so both agree on exactly what a user may access.
 * Returns true if the user holds `action` on `module`, accounting for the admin
 * bypass on late-added modules.
 */
export function hasPermission(
  user: (Pick<TokenPayload, 'permissions' | 'roleLevel'> & { roleCode?: string }) | undefined,
  module: string,
  action: string
): boolean {
  if (!user || !user.permissions) return false;

  // No role-based bypass: built-in roles are topped up with newly added modules
  // at sign-in (auth/permissionResolver), so an admin's saved choices — including
  // switching a module off — are honoured everywhere.
  return user.permissions[module]?.includes(action) ?? false;
}

// S1-15: User-friendly module names for error messages
const MODULE_DISPLAY_NAMES: Record<string, string> = {
  'organization.academics': 'academic structure',
  'organization.branches': 'branches',
  'organization.users': 'users',
  'organization.roles': 'roles',
  'organization.settings': 'organization settings',
  'organization.approvals': 'approvals',
  'students.list': 'students',
  'students.enrollment': 'student enrollment',
  'students.promotion': 'student promotion',
  'admissions.leads': 'admission leads',
  'admissions.applications': 'applications',
  'admissions.settings': 'admission settings',
  'finance.feeCounter': 'fee counter',
  'finance.feeStructures': 'fee structures',
  'finance.collections': 'fee collections',
  'finance.reports': 'finance reports',
  'finance.settings': 'finance settings',
  'finance.approvals': 'finance approvals',
  'attendance.mark': 'attendance marking',
  'attendance.view': 'attendance records',
  'attendance.reports': 'attendance reports',
  'hr.staff': 'staff management',
  'hr.attendance': 'staff attendance',
  'hr.leaves': 'leave management',
  'hr.settings': 'HR settings',
  'certificates.requests': 'certificate requests',
  'certificates.types': 'certificate types',
  'communications.sms': 'SMS communications',
  'communications.announcements': 'announcements',
  'communications.settings': 'communication settings',
  'health.records': 'health records',
  'health.checkups': 'health checkups',
  'health.vaccinations': 'vaccinations',
  'teaching.myClasses': 'my classes',
  'teaching.myStudents': 'my students',
  'teaching.timetable': 'timetable',
  'teaching.lessonPlans': 'lesson plans',
  'teaching.assignments': 'assignments',
  'teaching.grades': 'grades',
  'teaching.liveClasses': 'live classes',
  'careerConnect.companies': 'placement companies',
  'careerConnect.drives': 'placement drives',
  'careerConnect.jobBoard': 'job board',
  'careerConnect.studentProfiles': 'student career profiles',
  'careerConnect.counseling': 'career counseling',
  'careerConnect.resources': 'career resources',
  'careerConnect.alumni': 'alumni network',
  'careerConnect.mentorship': 'mentorship programs',
  'careerConnect.events': 'alumni events',
  'careerConnect.reports': 'career connect reports',
  'careerConnect.settings': 'career connect settings',
  'courses.courses': 'courses',
  'courses.lessons': 'lessons',
  'courses.quizzes': 'quizzes',
  'courses.enrollments': 'course enrollments',
  'courses.progress': 'course progress',
  'courses.reports': 'course reports',
  'courses.settings': 'course settings',
  'hostel.hostels': 'hostels',
  'hostel.rooms': 'hostel rooms',
  'hostel.allocations': 'hostel allocations',
  'hostel.reports': 'hostel reports',
  'hostel.settings': 'hostel settings',
  'inventory.assets': 'inventory assets',
  'inventory.categories': 'asset categories',
  'inventory.procurement': 'procurement',
  'inventory.issue': 'asset issue/return',
  'inventory.reports': 'inventory reports',
  'inventory.settings': 'inventory settings',
  'expense.requests': 'expense requests',
  'expense.approvals': 'expense approvals',
  'expense.reimbursements': 'reimbursements',
  'expense.budgets': 'budgets',
  'expense.reports': 'expense reports',
  'expense.settings': 'expense settings',
  'visitor.visitors': 'visitors',
  'visitor.passes': 'visitor passes',
  'visitor.logs': 'visitor logs',
  'visitor.dashboard': 'visitor dashboard',
  'visitor.settings': 'visitor settings',
  'feedback.tickets': 'feedback tickets',
  'feedback.reports': 'feedback reports',
  'transport.buses': 'transport buses',
  'transport.stops': 'transport stops',
  'transport.enrollments': 'transport enrollments',
  'transport.reports': 'transport reports',
  'transport.settings': 'transport settings',
  'obe.programs': 'OBE programs',
  'obe.outcomes': 'course outcomes',
  'obe.offerings': 'OBE course offerings',
  'obe.marks': 'OBE assessment marks',
  'obe.attainment': 'attainment computation',
  'obe.surveys': 'course-end surveys',
  'obe.reports': 'OBE reports',
  'obe.settings': 'OBE settings',
};

// S1-15: User-friendly action names
const ACTION_DISPLAY_NAMES: Record<string, string> = {
  view: 'view',
  create: 'create',
  edit: 'update',
  delete: 'delete',
  'bulk-upload': 'bulk upload',
};

export function requirePermission(module: string, action: string) {
  return tagMiddleware({ permission: [{ module, action }] }, (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new ApiError('AUTH_UNAUTHORIZED', 'Please log in to continue', 401);
    }

    if (!req.user.permissions) {
      throw new ApiError(
        'PERMISSION_DENIED',
        'Your account does not have any permissions. Please contact your administrator.',
        403
      );
    }

    if (!hasPermission(req.user, module, action)) {
      // S1-15: Generate user-friendly error message
      const moduleName = MODULE_DISPLAY_NAMES[module] || module.split('.').pop() || module;
      const actionName = ACTION_DISPLAY_NAMES[action] || action;

      throw new ApiError(
        'PERMISSION_DENIED',
        `You don't have permission to ${actionName} ${moduleName}. Please contact your administrator to request access.`,
        403
      );
    }

    next();
  });
}

export function requireAnyPermission(permissions: Array<{ module: string; action: string }>) {
  return tagMiddleware({ permission: permissions }, (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new ApiError('AUTH_UNAUTHORIZED', 'Please log in to continue', 401);
    }

    const userPermissions = req.user.permissions;

    if (!userPermissions) {
      throw new ApiError(
        'PERMISSION_DENIED',
        'Your account does not have any permissions. Please contact your administrator.',
        403
      );
    }

    const hasAnyPermission = permissions.some(({ module, action }) => {
      const modulePermissions = userPermissions[module];
      return modulePermissions?.includes(action);
    });

    if (!hasAnyPermission) {
      throw new ApiError(
        'PERMISSION_DENIED',
        "You don't have permission for this action. Please contact your administrator to request access.",
        403
      );
    }

    next();
  });
}

export function requireBranch(req: Request, _res: Response, next: NextFunction): void {
  if (!req.branchId) {
    throw new ApiError('BRANCH_REQUIRED', 'X-Branch-Id header is required', 400);
  }
  next();
}

/**
 * Academic structure (institutions, departments, programs, academic years,
 * classes, sections, subjects): the dedicated organization.academics
 * permission that campus and institution admins hold, or the organisation-
 * level permission that guarded these routes before.
 */
export function requireAcademics(
  action: 'create' | 'edit' | 'delete',
  legacy: { module: string; action: string } = {
    module: 'organization.settings',
    action: action === 'delete' ? 'delete' : 'edit',
  }
) {
  return requireAnyPermission([legacy, { module: 'organization.academics', action }]);
}
