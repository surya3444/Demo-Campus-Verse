'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import {
  Clock,
  CalendarDays,
  CalendarOff,
  ClipboardCheck,
  BookOpen,
  GraduationCap,
  CheckCircle2,
  AlertTriangle,
  FileText,
  ChevronRight,
  Users,
} from 'lucide-react';
import { useSidebarTheme } from '@/contexts/SidebarThemeContext';
import { dashboardApi } from '@/lib/api';
import { usePermissions } from '@/hooks/usePermissions';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { WelcomeHeader } from '../WelcomeHeader';
import { QuickActions } from '../QuickActions';
import { CheckInCard } from '../CheckInCard';
import { NoticeboardCard } from '../NoticeboardCard';
import { PayslipCard } from '../PayslipCard';
import { RaiseTicketDialog } from '../RaiseTicketDialog';

interface TimetableSlot {
  slotName: string;
  startTime: string;
  endTime: string;
  slotType: 'period' | 'break' | 'lunch' | 'assembly';
  slotOrder: number;
  sectionId?: string;
  sectionName?: string;
  classId?: string;
  className?: string;
  subjectId?: string;
  subjectName?: string;
  roomNumber?: string;
  attendanceMarked: boolean;
}

interface UnmarkedAttendance {
  sectionId: string;
  sectionName: string;
  className: string;
  subjectName: string;
  slotName: string;
}

interface PendingGrading {
  assignmentId: string;
  title: string;
  sectionName: string;
  subjectName: string;
  totalStudents: number;
  gradedCount: number;
}

interface UpcomingPtm {
  eventId: string;
  title: string;
  date: string;
  startTime?: string;
  endTime?: string;
  location?: string;
}

interface LeaveBalance {
  leaveType: string;
  total: number;
  used: number;
  pending: number;
  available: number;
}

interface TeacherDashboardData {
  timetable: TimetableSlot[];
  pendingTasks: {
    unmarkedAttendance: UnmarkedAttendance[];
    pendingGrading: PendingGrading[];
    upcomingPtms: UpcomingPtm[];
  };
  personalStats: {
    leaveBalance: LeaveBalance[];
    totalPeriodsPerWeek: number;
    totalSections: number;
    todayPeriods: { total: number; completed: number; remaining: number };
  };
}

export function TeacherDashboard() {
  const { themeId } = useSidebarTheme();
  const isLightMode = themeId === 'arctic';
  const { hasPermission } = usePermissions();

  const { data, isLoading, error, refetch } = useQuery<{
    success: boolean;
    data: TeacherDashboardData;
  }>({
    queryKey: ['teacher-dashboard'],
    queryFn: () => dashboardApi.getTeacherDashboard(),
  });

  const dashData = data?.data;
  const timetable = dashData?.timetable || [];
  const pendingTasks = dashData?.pendingTasks;
  const personalStats = dashData?.personalStats;

  const classPeriods = timetable.filter((s) => s.slotType === 'period' && s.sectionId);
  const unmarkedCount = pendingTasks?.unmarkedAttendance?.length || 0;
  const gradingCount = pendingTasks?.pendingGrading?.length || 0;

  const quickStats = [
    {
      icon: <BookOpen className={`h-4 w-4 ${isLightMode ? 'text-blue-500' : 'text-accent'}`} />,
      label: "Today's Classes",
      value: classPeriods.length,
    },
    {
      icon: (
        <ClipboardCheck
          className={`h-4 w-4 ${isLightMode ? 'text-amber-500' : 'text-amber-400'}`}
        />
      ),
      label: 'Pending Attendance',
      value: unmarkedCount,
    },
    {
      icon: (
        <GraduationCap
          className={`h-4 w-4 ${isLightMode ? 'text-purple-500' : 'text-purple-400'}`}
        />
      ),
      label: 'To Grade',
      value: gradingCount,
    },
  ];

  const quickActions = [
    ...(hasPermission('teaching.timetable', 'view')
      ? [
          {
            label: 'View Timetable',
            href: '/teaching/timetable',
            icon: CalendarDays,
            iconColor: 'text-primary',
          },
        ]
      : []),
    ...(hasPermission('teaching.myClasses', 'view')
      ? [{ label: 'My Classes', href: '/teaching/my-classes', icon: Users, iconColor: 'text-info' }]
      : []),
    ...(hasPermission('teaching.lessonPlans', 'view')
      ? [
          {
            label: 'Lesson Plans',
            href: '/teaching/lesson-plans',
            icon: BookOpen,
            iconColor: 'text-green-600',
          },
        ]
      : []),
    ...(hasPermission('teaching.assignments', 'view')
      ? [
          {
            label: 'Assignments',
            href: '/teaching/assignments',
            icon: FileText,
            iconColor: 'text-purple-600',
          },
        ]
      : []),
    ...(hasPermission('hr.leaves', 'view')
      ? [
          {
            label: 'Apply Leave',
            href: '/hr/leaves/apply',
            icon: CalendarOff,
            iconColor: 'text-muted-foreground',
          },
        ]
      : []),
  ];

  const now = new Date();
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  return (
    <div className="space-y-6">
      <WelcomeHeader
        loading={isLoading}
        quickStats={quickStats}
        subtitle="Here's your teaching schedule for today."
      />

      {error && (
        <div className="flex items-center gap-3 p-4 rounded-lg border border-destructive/20 bg-destructive/5">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          <p className="text-sm text-destructive flex-1">Failed to load dashboard data</p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      )}

      <CheckInCard />

      <QuickActions actions={quickActions}>
        {hasPermission('feedback.tickets', 'create') && (
          <RaiseTicketDialog myTicketsHref="/feedback" />
        )}
      </QuickActions>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Today's Timetable */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base font-semibold">Today&apos;s Schedule</CardTitle>
            {personalStats && (
              <Badge variant="outline" className="text-xs">
                {personalStats.todayPeriods.completed}/{personalStats.todayPeriods.total} done
              </Badge>
            )}
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-16" />
                ))}
              </div>
            ) : timetable.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                <CalendarDays className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
                No schedule for today
              </div>
            ) : (
              <div className="space-y-2">
                {timetable.map((slot, index) => {
                  const isPast = slot.endTime <= currentTime;
                  const isCurrent = slot.startTime <= currentTime && slot.endTime > currentTime;

                  if (slot.slotType !== 'period') {
                    return (
                      <div
                        key={index}
                        className={`flex items-center gap-3 px-3 py-2 rounded-lg ${
                          isPast ? 'opacity-50' : ''
                        } bg-muted/30`}
                      >
                        <div className="text-xs text-muted-foreground w-24 shrink-0">
                          {slot.startTime} - {slot.endTime}
                        </div>
                        <div className="text-sm text-muted-foreground italic capitalize">
                          {slot.slotType === 'lunch'
                            ? 'Lunch Break'
                            : slot.slotType === 'break'
                              ? 'Break'
                              : slot.slotName}
                        </div>
                      </div>
                    );
                  }

                  if (!slot.sectionId) {
                    // Free period
                    return (
                      <div
                        key={index}
                        className={`flex items-center gap-3 px-3 py-2 rounded-lg ${
                          isPast ? 'opacity-50' : ''
                        } bg-muted/20 border border-dashed`}
                      >
                        <div className="text-xs text-muted-foreground w-24 shrink-0">
                          {slot.startTime} - {slot.endTime}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {slot.slotName} - Free Period
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={index}
                      className={`flex items-center gap-3 p-3 rounded-lg border ${
                        isCurrent
                          ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                          : isPast
                            ? 'opacity-60 bg-muted/20'
                            : 'bg-card'
                      }`}
                    >
                      <div className="text-xs text-muted-foreground w-24 shrink-0">
                        <div>{slot.startTime}</div>
                        <div>{slot.endTime}</div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium truncate">
                            {slot.className} - {slot.sectionName}
                          </p>
                          {isCurrent && (
                            <Badge variant="default" className="text-[10px] px-1.5 py-0">
                              Now
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {slot.subjectName}
                          {slot.roomNumber && ` | Room ${slot.roomNumber}`}
                        </p>
                      </div>
                      <div className="shrink-0">
                        {slot.attendanceMarked ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        ) : isPast ? (
                          <AlertTriangle className="h-4 w-4 text-amber-500" />
                        ) : (
                          <Clock className="h-4 w-4 text-muted-foreground/40" />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pending Tasks */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-base font-semibold">Pending Tasks</CardTitle>
              <Badge
                variant={unmarkedCount + gradingCount > 0 ? 'destructive' : 'outline'}
                className="text-xs"
              >
                {unmarkedCount + gradingCount} pending
              </Badge>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-14" />
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Unmarked Attendance */}
                  {pendingTasks?.unmarkedAttendance?.map((item, i) => (
                    <div
                      key={`att-${i}`}
                      className="flex items-center gap-3 p-3 rounded-lg bg-amber-500/5 border border-amber-500/20"
                    >
                      <div className="h-8 w-8 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0">
                        <ClipboardCheck className="h-4 w-4 text-amber-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">
                          Attendance: {item.className} - {item.sectionName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {item.subjectName} | {item.slotName}
                        </p>
                      </div>
                    </div>
                  ))}

                  {/* Pending Grading */}
                  {pendingTasks?.pendingGrading?.map((item) => (
                    <Link
                      key={item.assignmentId}
                      href={`/teaching/assignments/${item.assignmentId}`}
                    >
                      <div className="flex items-center gap-3 p-3 rounded-lg bg-purple-500/5 border border-purple-500/20 hover:bg-purple-500/10 transition-colors cursor-pointer">
                        <div className="h-8 w-8 rounded-full bg-purple-500/10 flex items-center justify-center shrink-0">
                          <GraduationCap className="h-4 w-4 text-purple-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{item.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {item.sectionName} | {item.gradedCount}/{item.totalStudents} graded
                          </p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                      </div>
                    </Link>
                  ))}

                  {/* Upcoming PTMs */}
                  {pendingTasks?.upcomingPtms?.map((ptm) => (
                    <div
                      key={ptm.eventId}
                      className="flex items-center gap-3 p-3 rounded-lg bg-blue-500/5 border border-blue-500/20"
                    >
                      <div className="h-8 w-8 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0">
                        <Users className="h-4 w-4 text-blue-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{ptm.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(ptm.date).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                          })}
                          {ptm.startTime && `, ${ptm.startTime}`}
                          {ptm.location && ` | ${ptm.location}`}
                        </p>
                      </div>
                    </div>
                  ))}

                  {unmarkedCount === 0 &&
                    gradingCount === 0 &&
                    !pendingTasks?.upcomingPtms?.length && (
                      <div className="py-6 text-center text-sm text-muted-foreground">
                        <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-500/50" />
                        All caught up! No pending tasks.
                      </div>
                    )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Leave Balance Cards */}
      {personalStats && personalStats.leaveBalance.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Leave Balance
          </h3>
          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-24" />
              ))}
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {personalStats.leaveBalance.map((balance, i) => (
                <Card key={i}>
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
          )}
        </div>
      )}

      {/* Noticeboard + payslip */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <NoticeboardCard
            viewAllHref={
              hasPermission('communications.announcements', 'view')
                ? '/communications/announcements'
                : undefined
            }
          />
        </div>
        <div className="space-y-6">
          <PayslipCard
            allPayslipsHref={
              hasPermission('hr.payslips', 'view') ? '/hr/payroll/payslips' : undefined
            }
          />
        </div>
      </div>
    </div>
  );
}
