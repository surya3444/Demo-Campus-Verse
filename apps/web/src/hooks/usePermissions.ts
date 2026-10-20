'use client';

import { AI_TOOL_PERMISSIONS } from '@/components/ai/assistant.constants';
import { useMemo, useCallback } from 'react';
import { useAuthStore } from '@/store/authStore';

interface UsePermissionsReturn {
  permissions: Record<string, string[]>;
  hasPermission: (module: string, action: string) => boolean;
  hasAnyPermission: (checks: Array<{ module: string; action: string }>) => boolean;
  hasAllPermissions: (checks: Array<{ module: string; action: string }>) => boolean;
  canView: (module: string) => boolean;
  canCreate: (module: string) => boolean;
  canEdit: (module: string) => boolean;
  canDelete: (module: string) => boolean;
  isGroupOwner: boolean;
  isOrgModerator: boolean;
  isOrgAdmin: boolean;
  isBranchAdmin: boolean;
  roleLevel: number;
  /** Whether the AI assistant is offered to this user. */
  canUseAssistant: boolean;
}

export function usePermissions(): UsePermissionsReturn {
  const { user } = useAuthStore();

  const permissions = useMemo(() => user?.permissions || {}, [user?.permissions]);
  const roleCode = user?.roleCode || '';
  const roleLevel = user?.roleLevel || 999;

  const hasPermission = useCallback(
    (module: string, action: string): boolean => {
      const modulePermissions = permissions[module];
      return modulePermissions?.includes(action) || false;
    },
    [permissions]
  );

  const hasAnyPermission = useCallback(
    (checks: Array<{ module: string; action: string }>): boolean => {
      return checks.some(({ module, action }) => hasPermission(module, action));
    },
    [hasPermission]
  );

  const hasAllPermissions = useCallback(
    (checks: Array<{ module: string; action: string }>): boolean => {
      return checks.every(({ module, action }) => hasPermission(module, action));
    },
    [hasPermission]
  );

  const canView = useCallback(
    (module: string): boolean => hasPermission(module, 'view'),
    [hasPermission]
  );

  const canCreate = useCallback(
    (module: string): boolean => hasPermission(module, 'create'),
    [hasPermission]
  );

  const canEdit = useCallback(
    (module: string): boolean => hasPermission(module, 'edit'),
    [hasPermission]
  );

  const canDelete = useCallback(
    (module: string): boolean => hasPermission(module, 'delete'),
    [hasPermission]
  );

  const isGroupOwner = roleCode === 'GROUP_OWNER';
  const isOrgModerator = roleCode === 'ORG_MODERATOR';
  const isOrgAdmin = roleCode === 'ORG_ADMIN';
  const isBranchAdmin = roleCode === 'BRANCH_ADMIN';

  // Staff can drive every module they have access to through the assistant;
  // students get it when they hold one of its student-data permissions.
  const canUseAssistant =
    roleCode && roleCode !== 'STUDENT'
      ? Object.keys(permissions ?? {}).length > 0 || isGroupOwner
      : hasAnyPermission(AI_TOOL_PERMISSIONS);

  return {
    permissions,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    canView,
    canCreate,
    canEdit,
    canDelete,
    isGroupOwner,
    isOrgModerator,
    isOrgAdmin,
    isBranchAdmin,
    roleLevel,
    canUseAssistant,
  };
}
