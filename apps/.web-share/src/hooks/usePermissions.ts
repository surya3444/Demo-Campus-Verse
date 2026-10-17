'use client';

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
  };
}
