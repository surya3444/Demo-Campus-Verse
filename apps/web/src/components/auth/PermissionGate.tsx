'use client';

import { ReactNode } from 'react';
import { usePermissions } from '@/hooks/usePermissions';

interface PermissionGateProps {
  children: ReactNode;
  module: string;
  action?: string;
  actions?: string[];
  requireAll?: boolean;
  fallback?: ReactNode;
}

export function PermissionGate({
  children,
  module,
  action,
  actions,
  requireAll = false,
  fallback = null,
}: PermissionGateProps) {
  const { hasPermission, hasAnyPermission, hasAllPermissions } = usePermissions();

  let hasAccess = false;

  if (action) {
    hasAccess = hasPermission(module, action);
  } else if (actions && actions.length > 0) {
    const checks = actions.map((a) => ({ module, action: a }));
    hasAccess = requireAll ? hasAllPermissions(checks) : hasAnyPermission(checks);
  }

  if (!hasAccess) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

interface MultiPermissionGateProps {
  children: ReactNode;
  permissions: Array<{ module: string; action: string }>;
  requireAll?: boolean;
  fallback?: ReactNode;
}

export function MultiPermissionGate({
  children,
  permissions,
  requireAll = false,
  fallback = null,
}: MultiPermissionGateProps) {
  const { hasAnyPermission, hasAllPermissions } = usePermissions();

  const hasAccess = requireAll ? hasAllPermissions(permissions) : hasAnyPermission(permissions);

  if (!hasAccess) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

interface RoleGateProps {
  children: ReactNode;
  roles: string[];
  fallback?: ReactNode;
}

export function RoleGate({ children, roles, fallback = null }: RoleGateProps) {
  const { isGroupOwner, isOrgModerator, isOrgAdmin, isBranchAdmin } = usePermissions();

  const roleChecks: Record<string, boolean> = {
    GROUP_OWNER: isGroupOwner,
    ORG_MODERATOR: isOrgModerator,
    ORG_ADMIN: isOrgAdmin,
    BRANCH_ADMIN: isBranchAdmin,
  };

  const hasRole = roles.some((role) => roleChecks[role]);

  if (!hasRole) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
