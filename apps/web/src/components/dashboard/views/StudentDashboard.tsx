'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Clock,
  BookOpen,
  ClipboardList,
  CheckCircle2,
  Calendar,
  BedDouble,
  IndianRupee,
  Megaphone,
  ChevronRight,
  FileQuestion,
} from 'lucide-react';
import { dashboardApi } from '@/lib/api';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { DashboardHeader, StatStrip } from '../kit';
import { QuickActions } from '../QuickActions';
import { RaiseTicketDialog } from '../RaiseTicketDialog';
import { MyTransportCard } from '../MyTransportCard';

interface ScheduleSlot {
  slotName: string;
  startTime: string;
  endTime: string;
  slotType: string;
  slotOrder: number;
  subjectName: string;
  teacherName: string;
  roomNumber?: string;
}

interface UpcomingAssignment {
  _id: string;
  title: string;
  type: 'assignment' | 'questionnaire';
  dueDate?: string;
  totalMarks: number;
  hasQuestions: boolean;
}

interface StudentDashboardData {
  student: {
    name: string;
    admissionNumber: string;
    className: string;
    sectionName: string;
    rollNumber: string;
  };
  todaySchedule: ScheduleSlot[];
  assignments: {
    pending: number;
    upcoming: UpcomingAssignment[];
  };
  attendance: {
    present: number;
    absent: number;
    late: number;
    total: number;
    percentage: number;
  };
  /** null when the student's role isn't allowed fees on the dashboard (dashboard.fees). */
  fees: {
    totalDue: number;
    totalPaid: number;
    balance: number;
  } | null;
  hostel: {
    hostelName: string;
    roomNumber: string;
    bedNumber: string;
  } | null;
  announcements: {
    _id: string;
    title: string;
    message: string;
    createdAt: string;
  }[];
}

export function StudentDashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ['student-dashboard'],
    queryFn: () => dashboardApi.getStudentDashboard(),
  });

  const dashboard = data?.data as StudentDashboardData | undefined;

  const quickActions = [
    { label: 'My Timetable', href: '/student/timetable', icon: Calendar },
    { label: 'Assignments', href: '/student/assignments', icon: ClipboardList },
    { label: 'Attendance', href: '/student/attendance', icon: CheckCircle2 },
    ...(dashboard?.fees
      ? [{ label: 'Fee Details', href: '/student/fees', icon: IndianRupee }]
      : []),
  ];

  // Current period detection
  const getCurrentSlotIndex = (schedule: ScheduleSlot[]) => {
    const now = new Date();
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    return schedule.findIndex((s) => s.startTime <= currentTime && s.endTime > currentTime);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-40 w-full rounded-xl" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (!dashboard?.student) {
    return (
      <div className="text-center py-12">
        <BookOpen className="mx-auto h-12 w-12 text-muted-foreground/50" />
        <h3 className="mt-4 text-lg font-medium">Student profile not found</h3>
        <p className="text-muted-foreground">Please contact your administrator.</p>
      </div>
    );
  }

  const currentSlotIdx = getCurrentSlotIndex(dashboard.todaySchedule);
  const todaysClasses = dashboard.todaySchedule.filter(
    (s) => !['break', 'lunch', 'assembly'].includes(s.slotType)
  );
  const nowTime = new Date().toTimeString().slice(0, 5);
  const nextClass = todaysClasses.find((s) => s.startTime > nowTime);

  return (
    <div className="space-y-6">
      <DashboardHeader
        scope={`${dashboard.student.className} · ${dashboard.student.sectionName}`}
        subtitle="Here's your day — classes, work due and anything that needs you."
      />

      <StatStrip
        stats={[
          {
            label: 'Attendance · this month',
            value: dashboard.attendance.total > 0 ? `${dashboard.attendance.percentage}%` : '—',
            footnote:
              dashboard.attendance.total > 0
                ? `${dashboard.attendance.present} of ${dashboard.attendance.total} days present`
                : 'No classes marked yet',
            icon: CheckCircle2,
            tone:
              dashboard.attendance.total > 0 && dashboard.attendance.percentage < 75
                ? 'danger'
                : 'accent',
            href: '/student/attendance',
          },
          {
            label: 'Work due',
            value: dashboard.assignments.pending,
            footnote: 'Assignments & quizzes',
            icon: ClipboardList,
            href: '/student/assignments',
          },
          dashboard.fees
            ? {
                label: 'Fee balance',
                value:
                  dashboard.fees.balance > 0
                    ? `₹${dashboard.fees.balance.toLocaleString('en-IN')}`
                    : 'Cleared',
                footnote: `₹${dashboard.fees.totalPaid.toLocaleString('en-IN')} paid so far`,
                icon: IndianRupee,
                tone: dashboard.fees.balance > 0 ? 'danger' : 'success',
                href: '/student/fees',
              }
            : {
                // Fees hidden for this role — show the day's classes instead.
                label: 'Classes today',
                value: todaysClasses.length,
                footnote: nextClass
                  ? `Next: ${nextClass.subjectName || nextClass.slotName} at ${nextClass.startTime}`
                  : todaysClasses.length
                    ? 'All done for today'
                    : 'No classes scheduled',
                icon: Calendar,
                href: '/student/timetable',
              },
          {
            label: 'Hostel',
            value: dashboard.hostel ? dashboard.hostel.roomNumber : '—',
            footnote: dashboard.hostel
              ? `${dashboard.hostel.hostelName} · Bed ${dashboard.hostel.bedNumber}`
              : 'Not allocated',
            icon: BedDouble,
          },
        ]}
      />

      <QuickActions actions={quickActions}>
        <RaiseTicketDialog myTicketsHref="/student/feedback" />
      </QuickActions>

      {/* My Transport — only renders if the student has an active enrollment */}
      <MyTransportCard />

      {/* Main Content Row */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Today's Schedule */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="h-4 w-4 text-blue-500" />
              Today&apos;s Schedule
            </CardTitle>
          </CardHeader>
          <CardContent>
            {dashboard.todaySchedule.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No classes scheduled today
              </p>
            ) : (
              <div className="space-y-2">
                {dashboard.todaySchedule.map((slot, idx) => {
                  const isCurrent = idx === currentSlotIdx;
                  const isPast = currentSlotIdx >= 0 ? idx < currentSlotIdx : false;
                  const isBreak = ['break', 'lunch', 'assembly'].includes(slot.slotType);

                  return (
                    <div
                      key={idx}
                      className={`flex items-center gap-3 p-2.5 rounded-lg border transition-colors ${
                        isCurrent
                          ? 'border-primary bg-primary/5'
                          : isPast
                            ? 'opacity-50'
                            : 'border-transparent'
                      }`}
                    >
                      <div className="text-xs text-muted-foreground w-20 shrink-0">
                        {slot.startTime} - {slot.endTime}
                      </div>
                      <div className="flex-1 min-w-0">
                        {isBreak ? (
                          <p className="text-sm text-muted-foreground italic capitalize">
                            {slot.slotType}
                          </p>
                        ) : (
                          <>
                            <p className="text-sm font-medium truncate">
                              {slot.subjectName || slot.slotName}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              {[
                                slot.subjectName ? slot.slotName : null,
                                slot.teacherName,
                                slot.roomNumber ? `Room ${slot.roomNumber}` : null,
                              ]
                                .filter(Boolean)
                                .join(' · ')}
                            </p>
                          </>
                        )}
                      </div>
                      {isCurrent && (
                        <Badge variant="default" className="text-[10px] shrink-0">
                          Now
                        </Badge>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pending Assignments & Quizzes */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <ClipboardList className="h-4 w-4 text-amber-500" />
                Upcoming Work
              </CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/student/assignments">
                  View All <ChevronRight className="ml-1 h-3 w-3" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {dashboard.assignments.upcoming.length === 0 ? (
              <div className="text-center py-6">
                <CheckCircle2 className="mx-auto h-8 w-8 text-green-500/50" />
                <p className="text-sm text-muted-foreground mt-2">All caught up!</p>
              </div>
            ) : (
              <div className="space-y-2">
                {dashboard.assignments.upcoming.map((item) => (
                  <Link
                    key={item._id}
                    href={
                      item.type === 'questionnaire'
                        ? `/teaching/questionnaires/${item._id}`
                        : item.hasQuestions
                          ? `/teaching/assignments/${item._id}/submit`
                          : `/teaching/assignments/${item._id}`
                    }
                    className="flex items-center gap-3 p-2.5 rounded-lg border hover:bg-muted/50 transition-colors"
                  >
                    {item.type === 'questionnaire' ? (
                      <FileQuestion className="h-4 w-4 text-purple-500 shrink-0" />
                    ) : (
                      <ClipboardList className="h-4 w-4 text-blue-500 shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.totalMarks} marks
                        {item.dueDate && ` · Due ${new Date(item.dueDate).toLocaleDateString()}`}
                      </p>
                    </div>
                    {item.hasQuestions && (
                      <Badge variant="outline" className="text-[10px] shrink-0">
                        Answer
                      </Badge>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Announcements */}
      {dashboard.announcements.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Megaphone className="h-4 w-4 text-orange-500" />
              Recent Announcements
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {dashboard.announcements.map((ann) => (
                <div key={ann._id} className="border-b last:border-0 pb-3 last:pb-0">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">{ann.title}</p>
                    <span className="text-xs text-muted-foreground">
                      {new Date(ann.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  {ann.message && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{ann.message}</p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
