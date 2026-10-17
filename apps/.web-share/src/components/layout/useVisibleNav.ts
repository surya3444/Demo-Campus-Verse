'use client';

import { useMemo } from 'react';
import { Settings } from 'lucide-react';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuthStore } from '@/store/authStore';
import { useBranchStore } from '@/store/branchStore';
import { AI_TOOL_PERMISSIONS } from '@/components/ai/assistant.constants';
import { NAV_SECTIONS, getStudentNavSections, type NavModule, type NavSection } from './nav.config';

/** A module that survived filtering; settingsHref is set only when permitted. */
export type VisibleModule = NavModule & { settingsHref?: string };

export interface VisibleSection {
  id: string;
  label?: string;
  modules: VisibleModule[];
}

/**
 * The navigation this user may see: subscription, permission, role and
 * institution-type gates from nav.config.ts, evaluated in one pass. Shared by
 * the sidebar and the global search so both offer exactly the same pages.
 */
export function useVisibleNav(): VisibleSection[] {
  const { hasPermission, hasAnyPermission, isGroupOwner, isOrgAdmin, isBranchAdmin } =
    usePermissions();
  const { user } = useAuthStore();

  // Get tenant's enabled modules from subscription
  const enabledModules = useMemo(
    () => user?.tenant?.subscription?.features || [],
    [user?.tenant?.subscription?.features]
  );
  const selectedBranch = useBranchStore((state) => state.getSelectedBranch());
  const institutionType = selectedBranch?.institutionType;

  return useMemo<VisibleSection[]>(() => {
    // Students get their own dedicated tree
    if (user?.roleCode === 'STUDENT') {
      return getStudentNavSections(enabledModules);
    }

    const isAdminRole = isGroupOwner || isOrgAdmin || isBranchAdmin;

    // The AI assistant needs at least one queryable-data permission (mirrors
    // the widget + page gate); a single module.permission can't express
    // "any of".
    const hasAiAccess = isGroupOwner || hasAnyPermission(AI_TOOL_PERMISSIONS);

    // Teaching module is only for teachers — check for teacher-specific
    // permissions (exclude teaching.timetable which admins also have for
    // managing schedules)
    const teacherOnlyKeys = [
      'teaching.myClasses',
      'teaching.myStudents',
      'teaching.lessonPlans',
      'teaching.assignments',
      'teaching.grades',
    ];
    const hasTeachingPermissions = user?.permissions
      ? Object.keys(user.permissions).some((key) => teacherOnlyKeys.includes(key))
      : false;

    const passesSpecialGate = (module: NavModule): boolean => {
      switch (module.specialGate) {
        case 'aiAssistant':
          return hasAiAccess;
        case 'multiInstitution':
          return (user?.institutions?.length ?? 0) >= 2;
        case 'teaching':
          return hasTeachingPermissions || isAdminRole;
        case 'hideForBranchAdmin':
          return !isBranchAdmin;
        default:
          return true;
      }
    };

    const filterModule = (module: NavModule): VisibleModule | null => {
      if (!passesSpecialGate(module)) return null;
      if (module.hideForAdmins && isAdminRole) return null;
      if (module.hideForGroupOwner && isGroupOwner) return null;

      const subscriptionId = module.subscriptionModule ?? module.id;
      if (!module.alwaysAvailable && !enabledModules.includes(subscriptionId)) {
        return null;
      }

      if (module.permission && !isGroupOwner) {
        if (!hasPermission(module.permission.module, module.permission.action)) {
          if (!module.children) return null;
        }
      }

      const settingsHref =
        module.settings &&
        (isGroupOwner ||
          hasPermission(module.settings.permission.module, module.settings.permission.action))
          ? module.settings.href
          : undefined;

      if (module.children) {
        const filteredChildren = module.children.filter((child) => {
          // Institution-type gate applies only once a branch is selected.
          if (
            child.institutionTypes &&
            institutionType &&
            !child.institutionTypes.includes(institutionType)
          ) {
            return false;
          }
          if (!child.permission) return true;
          if (isGroupOwner) {
            // Group Owner is not a staff member — hide personal items
            return child.permission.action !== 'view-own';
          }
          return hasPermission(child.permission.module, child.permission.action);
        });

        if (filteredChildren.length === 0) {
          // A user whose only grant in this module is its settings (e.g. an
          // exams-config-only role) still needs a way in.
          if (settingsHref) {
            return {
              ...module,
              children: [{ name: 'Settings', href: settingsHref, icon: Settings }],
            };
          }
          return null;
        }
        return { ...module, children: filteredChildren, settingsHref };
      }

      return { ...module, settingsHref };
    };

    return NAV_SECTIONS.map((section: NavSection) => ({
      id: section.id,
      label: section.label,
      modules: section.modules.map(filterModule).filter((m): m is VisibleModule => m !== null),
    })).filter((section) => section.modules.length > 0);
  }, [
    hasPermission,
    hasAnyPermission,
    isGroupOwner,
    isOrgAdmin,
    isBranchAdmin,
    enabledModules,
    user,
    institutionType,
  ]);
}
