'use client';

import { usePermissions } from '@/hooks/usePermissions';
import { useAuthStore } from '@/store/authStore';
import { OwnerDashboard } from '@/components/dashboard/views/OwnerDashboard';
import { BranchDashboard } from '@/components/dashboard/views/BranchDashboard';
import { TeacherDashboard } from '@/components/dashboard/views/TeacherDashboard';
import { StaffDashboard } from '@/components/dashboard/views/StaffDashboard';
import { StudentDashboard } from '@/components/dashboard/views/StudentDashboard';
import { ScopedDashboard } from '@/components/dashboard/views/ScopedDashboard';

export default function DashboardPage() {
  const { isGroupOwner, isOrgModerator, isBranchAdmin, isOrgAdmin, hasPermission } =
    usePermissions();
  const { user } = useAuthStore();

  // Student — student-focused dashboard
  if (user?.roleCode === 'STUDENT') {
    return <StudentDashboard />;
  }

  // Owner/Moderator — cross-branch aggregation dashboard
  if (isGroupOwner || isOrgModerator) {
    return <OwnerDashboard />;
  }

  // Branch Admin / Org Admin — branch-level operational dashboard
  if (isBranchAdmin || isOrgAdmin) {
    return <BranchDashboard />;
  }

  // Dean / HOD / Program Coordinator — an overview of what they look after,
  // decided by access scope (roles all carry dashboard.branchView, so it can't).
  const scopeType = user?.accessScope?.type;
  if (scopeType === 'institution' || scopeType === 'department' || scopeType === 'program') {
    return <ScopedDashboard variant={scopeType} />;
  }

  // Teacher — teaching-focused dashboard with schedule, tasks, stats
  if (hasPermission('teaching.myClasses', 'view')) {
    return <TeacherDashboard />;
  }

  // Default — staff self-service dashboard (attendance, leaves, workload)
  return <StaffDashboard />;
}
