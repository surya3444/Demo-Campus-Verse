'use client';

import { ReactNode, useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { usePermissions } from '@/hooks/usePermissions';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: ReactNode;
  requiredPermissions?: Array<{ module: string; action: string }>;
  requireAll?: boolean;
  allowedRoles?: string[];
  redirectTo?: string;
}

export function ProtectedRoute({
  children,
  requiredPermissions,
  requireAll = false,
  allowedRoles,
  redirectTo = '/login',
}: ProtectedRouteProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, user } = useAuthStore();
  const { hasAnyPermission, hasAllPermissions } = usePermissions();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    // Wait for hydration
    const timer = setTimeout(() => {
      setIsChecking(false);
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (isChecking) return;

    if (!isAuthenticated) {
      router.push(redirectTo);
      return;
    }

    // Check if organization is pending approval
    if (user?.tenant?.status === 'pending') {
      router.push('/pending-approval');
      return;
    }

    // Redirect GROUP_OWNER to onboarding if not completed
    if (
      user?.tenant?.status === 'active' &&
      user?.tenant?.onboardingCompleted === false &&
      user?.roleCode === 'GROUP_OWNER' &&
      !pathname?.startsWith('/onboarding')
    ) {
      router.push('/onboarding');
      return;
    }

    // Check role access
    if (allowedRoles && allowedRoles.length > 0 && user?.roleCode) {
      if (!allowedRoles.includes(user.roleCode)) {
        router.push('/unauthorized');
        return;
      }
    }

    // Check permission access
    if (requiredPermissions && requiredPermissions.length > 0) {
      const hasAccess = requireAll
        ? hasAllPermissions(requiredPermissions)
        : hasAnyPermission(requiredPermissions);

      if (!hasAccess) {
        router.push('/unauthorized');
        return;
      }
    }
  }, [
    isChecking,
    isAuthenticated,
    user,
    pathname,
    requiredPermissions,
    requireAll,
    allowedRoles,
    hasAnyPermission,
    hasAllPermissions,
    router,
    redirectTo,
  ]);

  if (isChecking) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}
