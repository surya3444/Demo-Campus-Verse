'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import {
  UserCheck,
  AlertCircle,
  Clock,
  CalendarDays,
  CalendarOff,
  FileText,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Hourglass,
  Briefcase,
} from 'lucide-react';
import { useSidebarTheme } from '@/contexts/SidebarThemeContext';
import { hrApi } from '@/lib/api';
import { usePermissions } from '@/hooks/usePermissions';
import Link from 'next/link';
import { WelcomeHeader } from '../WelcomeHeader';
import { QuickActions } from '../QuickActions';
import { CheckInCard } from '../CheckInCard';
import { NoticeboardCard } from '../NoticeboardCard';
import { PayslipCard } from '../PayslipCard';
import { UpcomingEventsCard } from '../UpcomingEventsCard';
import { RaiseTicketDialog } from '../RaiseTicketDialog';

interface LeaveBalance {
  leaveType: string;
  code: string;
  total: number;
  used: number;
  pending: number;
  available: number;
}

interface MyLeave {
  _id: string;
  leaveType: string;
  fromDate: string;
  toDate: string;
  days: number;
  status: string;
  reason: string;
  createdAt: string;
}

interface WorkloadItem {
  _id: string;
  subject: { name: string; code: string };
  class: { displayName: string };
  sections: Array<{ name: string }>;
  periodsPerWeek: number;
}

export function StaffDashboard() {
  const { themeId } = useSidebarTheme();
  const isLightMode = themeId === 'arctic';
  const { hasPermission } = usePermissions();

  const canViewLeaves = hasPermission('hr.leaves', 'view');
  const canViewWorkload = hasPermission('hr.workload', 'view');
  const canRaiseTicket = hasPermission('feedback.tickets', 'create');
  const canViewAnnouncements = hasPermission('communications.announcements', 'view');
  const canViewAllPayslips = hasPermission('hr.payslips', 'view');
  const canViewCalendar = hasPermission('communications.calendar', 'view');

  const [loading, setLoading] = useState(true);
  const [leaveBalances, setLeaveBalances] = useState<LeaveBalance[]>([]);
  const [recentLeaves, setRecentLeaves] = useState<MyLeave[]>([]);
  const [workload, setWorkload] = useState<WorkloadItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const promises: Promise<unknown>[] = [];
      const promiseKeys: string[] = [];

      if (canViewLeaves) {
        promises.push(hrApi.getLeaveBalance());
        promiseKeys.push('balance');
        promises.push(hrApi.getMyLeaves({ limit: 5 }));
        promiseKeys.push('leaves');
      }
      if (canViewWorkload) {
        promises.push(hrApi.getWorkload({}));
        promiseKeys.push('workload');
      }

      const results = await Promise.allSettled(promises);

      results.forEach((result, index) => {
        if (result.status !== 'fulfilled') return;
        const value = result.value as { success: boolean; data: unknown };
        if (!value.success) return;

        switch (promiseKeys[index]) {
          case 'balance': {
            const data = value.data as { balances?: LeaveBalance[] };
            setLeaveBalances(data.balances || (value.data as LeaveBalance[]) || []);
            break;
          }
          case 'leaves':
            setRecentLeaves((value.data as MyLeave[]) || []);
            break;
          case 'workload': {
            const wd = value.data;
            setWorkload(Array.isArray(wd) ? wd : (wd as { data?: WorkloadItem[] })?.data || []);
            break;
          }
        }
      });
    } catch (err) {
      console.error('Failed to fetch staff dashboard data:', err);
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }, [canViewLeaves, canViewWorkload]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const quickStats = [
    {
      icon: <UserCheck className={`h-4 w-4 ${isLightMode ? 'text-blue-500' : 'text-accent'}`} />,
      label: 'Available',
      value: leaveBalances.reduce((sum, b) => sum + b.available, 0),
    },
    {
      icon: <CalendarOff className={`h-4 w-4 ${isLightMode ? 'text-slate-600' : ''}`} />,
      label: 'Leaves Used',
      value: leaveBalances.reduce((sum, b) => sum + b.used, 0),
    },
    {
      icon: <Briefcase className={`h-4 w-4 ${isLightMode ? 'text-slate-600' : ''}`} />,
      label: 'Classes',
      value: workload.length,
    },
  ];

  const quickActions = [
    ...(canViewLeaves
      ? [
          {
            label: 'Apply Leave',
            href: '/hr/leaves/apply',
            icon: CalendarDays,
            iconColor: 'text-primary',
          },
          { label: 'My Leaves', href: '/hr/leaves/my', icon: FileText, iconColor: 'text-info' },
        ]
      : []),
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return (
          <Badge variant="success" className="gap-1">
            <CheckCircle2 className="h-3 w-3" /> Approved
          </Badge>
        );
      case 'rejected':
        return (
          <Badge variant="destructive" className="gap-1">
            <XCircle className="h-3 w-3" /> Rejected
          </Badge>
        );
      case 'pending':
        return (
          <Badge variant="warning" className="gap-1">
            <Hourglass className="h-3 w-3" /> Pending
          </Badge>
        );
      case 'cancelled':
        return (
          <Badge variant="outline" className="gap-1">
            Cancelled
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <WelcomeHeader
        loading={loading}
        quickStats={quickStats}
        subtitle="Here's your personal dashboard."
      />

      {error && (
        <div className="flex items-center gap-3 p-4 rounded-lg border border-destructive/20 bg-destructive/5">
          <AlertCircle className="h-5 w-5 text-destructive" />
          <p className="text-sm text-destructive flex-1">{error}</p>
          <Button variant="outline" size="sm" onClick={fetchData}>
            Retry
          </Button>
        </div>
      )}

      <CheckInCard />

      <QuickActions actions={quickActions}>
        {canRaiseTicket && <RaiseTicketDialog myTicketsHref="/feedback" />}
      </QuickActions>

      {/* Leave Balance Cards */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Leave Balance
        </h3>
        {loading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        ) : leaveBalances.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {leaveBalances.map((balance) => (
              <Card key={balance.code}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium">{balance.leaveType}</p>
                    <Badge variant="outline" className="text-xs">
                      {balance.available}/{balance.total}
                    </Badge>
                  </div>
                  <Progress
                    value={
                      balance.total > 0
                        ? ((balance.total - balance.available) / balance.total) * 100
                        : 0
                    }
                    className="h-2"
                  />
                  <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                    <span>Used: {balance.used}</span>
                    {balance.pending > 0 && <span>Pending: {balance.pending}</span>}
                    <span>Available: {balance.available}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              <CalendarOff className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
              No leave balance data available
            </CardContent>
          </Card>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Leaves */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base font-semibold">Recent Leave Requests</CardTitle>
            <Link href="/hr/leaves/my">
              <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground h-8">
                View All <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))}
              </div>
            ) : recentLeaves.length > 0 ? (
              <div className="space-y-3">
                {recentLeaves.map((leave) => (
                  <div
                    key={leave._id}
                    className="flex items-center gap-3 p-3 rounded-lg bg-muted/30"
                  >
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <CalendarDays className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">{leave.leaveType}</p>
                        <span className="text-xs text-muted-foreground">
                          {leave.days} day{leave.days > 1 ? 's' : ''}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {new Date(leave.fromDate).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                        })}
                        {leave.fromDate !== leave.toDate && (
                          <>
                            {' '}
                            -{' '}
                            {new Date(leave.toDate).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                            })}
                          </>
                        )}
                      </p>
                    </div>
                    {getStatusBadge(leave.status)}
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-sm text-muted-foreground">
                <FileText className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
                No recent leave requests
              </div>
            )}
          </CardContent>
        </Card>

        {/* Teaching Workload */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base font-semibold">My Workload</CardTitle>
            <Badge variant="outline">
              {workload.reduce((sum, w) => sum + w.periodsPerWeek, 0)} periods/week
            </Badge>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))}
              </div>
            ) : workload.length > 0 ? (
              <div className="space-y-3">
                {workload.map((item) => (
                  <div
                    key={item._id}
                    className="flex items-center gap-3 p-3 rounded-lg bg-muted/30"
                  >
                    <div className="h-8 w-8 rounded-full bg-info/10 flex items-center justify-center shrink-0">
                      <Briefcase className="h-4 w-4 text-info" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{item.subject.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.class.displayName}
                        {item.sections.length > 0 && (
                          <> - {item.sections.map((s) => s.name).join(', ')}</>
                        )}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-xs shrink-0">
                      {item.periodsPerWeek}p/w
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-sm text-muted-foreground">
                <Clock className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
                No workload assigned
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Noticeboard + what's next + payslip */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {canViewAnnouncements && <NoticeboardCard viewAllHref="/communications/announcements" />}
        </div>
        <div className="space-y-6">
          <UpcomingEventsCard
            calendarHref={canViewCalendar ? '/communications/calendar' : undefined}
          />
          <PayslipCard allPayslipsHref={canViewAllPayslips ? '/hr/payroll/payslips' : undefined} />
        </div>
      </div>
    </div>
  );
}
