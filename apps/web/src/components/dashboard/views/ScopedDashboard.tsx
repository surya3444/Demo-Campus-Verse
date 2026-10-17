'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  GraduationCap,
  Users,
  UserCheck,
  Wallet,
  Layers,
  CalendarDays,
  ArrowUpRight,
  BookOpen,
  ClipboardCheck,
  Target,
  FileBarChart,
  CalendarOff,
  ListChecks,
  type LucideIcon,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { dashboardApi } from '@/lib/api';
import { usePermissions } from '@/hooks/usePermissions';
import { formatCurrency, type Alert } from '../utils';
import { CheckInCard } from '../CheckInCard';
import { NoticeboardCard } from '../NoticeboardCard';
import {
  DashboardHeader,
  StatStrip,
  Panel,
  Meter,
  EmptyNote,
  AlertsRibbon,
  type Stat,
} from '../kit';

/** Dean (institution scope), HOD (department scope) and Program Coordinator (program scope). */
export type ScopeVariant = 'institution' | 'department' | 'program';

interface BranchKPIs {
  students: { total: number; newThisMonth: number };
  staff: { total: number; presentToday: number; onLeave: number };
  /** null when this role isn't allowed fees on the dashboard (dashboard.fees). */
  finance: {
    totalBilled: number;
    totalCollected: number;
    totalDue: number;
    collectionRate: number;
  } | null;
  attendance: { rate: number; present: number; total: number };
  pendingLeaves: number;
}

interface BreakdownRow {
  id: string;
  name: string;
  meta: string | null;
  students: number;
  faculty: number | null;
  attendancePct: number | null;
}

interface Breakdown {
  title: string | null;
  level: 'department' | 'section';
  rows: BreakdownRow[];
}

interface ClassSlot {
  startTime: string;
  endTime: string;
  slotType: string;
  sectionId?: string;
  className?: string;
  sectionName?: string;
  subjectName?: string;
  attendanceMarked: boolean;
}

interface QuickLink {
  label: string;
  href: string;
  icon: LucideIcon;
  perm?: string;
}

const COPY: Record<
  ScopeVariant,
  { subtitle: string; unit: string; breakdownEyebrow: string; links: QuickLink[] }
> = {
  institution: {
    subtitle: 'How your institution is doing today, department by department.',
    unit: 'Faculty',
    breakdownEyebrow: 'Departments',
    links: [
      { label: 'Students', href: '/students', icon: GraduationCap, perm: 'students.list' },
      {
        label: 'Attendance reports',
        href: '/attendance/reports',
        icon: ClipboardCheck,
        perm: 'attendance.reports',
      },
      { label: 'Examinations', href: '/exams', icon: ListChecks, perm: 'exams.exams' },
      { label: 'Accreditation (OBE)', href: '/obe/reports', icon: Target, perm: 'obe.reports' },
      {
        label: 'Fee reports',
        href: '/finance/reports',
        icon: FileBarChart,
        perm: 'finance.reports',
      },
    ],
  },
  department: {
    subtitle: 'Your department at a glance — sections, faculty and today’s attendance.',
    unit: 'Faculty',
    breakdownEyebrow: 'Sections',
    links: [
      { label: 'Students', href: '/students', icon: GraduationCap, perm: 'students.list' },
      {
        label: 'Mark attendance',
        href: '/attendance/mark',
        icon: ClipboardCheck,
        perm: 'attendance.mark',
      },
      {
        label: 'Timetable',
        href: '/teaching/timetable',
        icon: CalendarDays,
        perm: 'teaching.timetable',
      },
      { label: 'Course outcomes', href: '/obe/outcomes', icon: Target, perm: 'obe.outcomes' },
      { label: 'Leave requests', href: '/hr/leaves', icon: CalendarOff, perm: 'hr.leaves' },
    ],
  },
  program: {
    subtitle: 'Your program at a glance — cohorts, attendance and outcomes.',
    unit: 'Faculty',
    breakdownEyebrow: 'Cohorts',
    links: [
      { label: 'Students', href: '/students', icon: GraduationCap, perm: 'students.list' },
      { label: 'Program outcomes', href: '/obe/programs', icon: Target, perm: 'obe.programs' },
      {
        label: 'Course registration',
        href: '/registration',
        icon: BookOpen,
        perm: 'registration.registrations',
      },
      {
        label: 'Accreditation reports',
        href: '/obe/reports',
        icon: FileBarChart,
        perm: 'obe.reports',
      },
      {
        label: 'Attendance reports',
        href: '/attendance/reports',
        icon: ClipboardCheck,
        perm: 'attendance.reports',
      },
    ],
  },
};

export function ScopedDashboard({ variant }: { variant: ScopeVariant }) {
  const { hasPermission } = usePermissions();
  const copy = COPY[variant];

  const kpisQ = useQuery({
    queryKey: ['dash-scope-kpis'],
    queryFn: () => dashboardApi.getBranchKPIs(),
  });
  const breakdownQ = useQuery({
    queryKey: ['dash-scope-breakdown'],
    queryFn: () => dashboardApi.getScopeBreakdown(),
  });
  const alertsQ = useQuery({
    queryKey: ['dash-scope-alerts'],
    queryFn: () => dashboardApi.getAlerts(),
  });
  // HODs and coordinators usually teach too; hidden when there is no staff record.
  const teachQ = useQuery({
    queryKey: ['teacher-dashboard'],
    queryFn: () => dashboardApi.getTeacherDashboard(),
    enabled: hasPermission('teaching.myClasses', 'view'),
    retry: false,
  });

  const kpis = kpisQ.data?.data as BranchKPIs | undefined;
  const breakdown = breakdownQ.data?.data as Breakdown | undefined;
  const alerts = (alertsQ.data?.data?.alerts ?? []) as Alert[];
  const myClasses = ((teachQ.data?.data?.timetable ?? []) as ClassSlot[]).filter(
    (s) => s.slotType === 'period' && s.sectionId
  );
  const loading = kpisQ.isLoading;

  const attendance = kpis?.attendance;
  const stats: Stat[] = [
    {
      label: 'Students',
      value: (kpis?.students.total ?? 0).toLocaleString('en-IN'),
      footnote:
        kpis && kpis.students.newThisMonth > 0 ? (
          <span className="text-success">+{kpis.students.newThisMonth} this month</span>
        ) : (
          'Active enrolment'
        ),
      icon: GraduationCap,
      href: hasPermission('students.list', 'view') ? '/students' : undefined,
    },
    {
      label: copy.unit,
      value: (kpis?.staff.total ?? 0).toLocaleString('en-IN'),
      footnote: kpis
        ? `${kpis.staff.presentToday} in today${kpis.staff.onLeave ? ` · ${kpis.staff.onLeave} on leave` : ''}`
        : null,
      icon: Users,
    },
    {
      label: 'Attendance today',
      value: attendance && attendance.total > 0 ? `${attendance.rate}%` : '—',
      footnote:
        attendance && attendance.total > 0
          ? `${attendance.present} of ${attendance.total} present`
          : 'Not marked yet today',
      icon: UserCheck,
      tone: 'accent',
    },
    kpis && !kpis.finance
      ? {
          // Fees hidden for this role — leave requests are the next thing they act on.
          label: 'Leave requests',
          value: kpis.pendingLeaves,
          footnote: kpis.pendingLeaves ? 'Awaiting a decision' : 'Nothing pending',
          icon: CalendarOff,
          tone: kpis.pendingLeaves ? 'danger' : 'default',
          href: hasPermission('hr.leaves', 'view') ? '/hr/leaves' : undefined,
        }
      : {
          label: 'Fees collected',
          value: `${kpis?.finance?.collectionRate ?? 0}%`,
          footnote: kpis?.finance ? `₹${formatCurrency(kpis.finance.totalDue)} outstanding` : null,
          icon: Wallet,
          tone: kpis?.finance && kpis.finance.collectionRate < 50 ? 'danger' : 'default',
        },
  ];

  const links = copy.links.filter((l) => !l.perm || hasPermission(l.perm, 'view'));

  return (
    <div className="space-y-8 pb-12">
      <DashboardHeader scope={breakdown?.title} subtitle={copy.subtitle} />

      <StatStrip stats={stats} loading={loading} />

      <CheckInCard />

      <AlertsRibbon alerts={alerts} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Panel
          eyebrow={copy.breakdownEyebrow}
          title={
            breakdown
              ? `${breakdown.rows.length} ${copy.breakdownEyebrow.toLowerCase().replace(/s$/, breakdown.rows.length === 1 ? '' : 's')}`
              : undefined
          }
          className="lg:col-span-2"
        >
          <BreakdownTable loading={breakdownQ.isLoading} breakdown={breakdown} />
        </Panel>

        <div className="space-y-6">
          {myClasses.length > 0 && (
            <Panel
              eyebrow="My classes today"
              action={{ label: 'Timetable', href: '/teaching/timetable' }}
            >
              <ul className="space-y-3">
                {myClasses.map((c) => (
                  <li key={`${c.startTime}-${c.sectionId}`} className="flex items-center gap-3">
                    <span className="w-12 shrink-0 font-mono text-xs text-muted-foreground">
                      {c.startTime}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{c.subjectName}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {c.className} · {c.sectionName}
                      </p>
                    </div>
                    {c.attendanceMarked && <UserCheck className="h-4 w-4 shrink-0 text-success" />}
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          {links.length > 0 && (
            <Panel eyebrow="Go to">
              <ul className="-my-1 divide-y divide-border">
                {links.map((l) => (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      className="group flex items-center gap-3 py-2.5 text-sm transition-colors hover:text-primary"
                    >
                      <l.icon className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
                      <span className="flex-1">{l.label}</span>
                      <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground/50 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                    </Link>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </div>
      </div>

      <NoticeboardCard
        viewAllHref={
          hasPermission('communications.announcements', 'view')
            ? '/communications/announcements'
            : undefined
        }
      />
    </div>
  );
}

function BreakdownTable({ loading, breakdown }: { loading: boolean; breakdown?: Breakdown }) {
  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }
  if (!breakdown || breakdown.rows.length === 0) {
    return <EmptyNote icon={Layers}>Nothing to show yet.</EmptyNote>;
  }
  const showFaculty = breakdown.level === 'department';
  // Sections of one department all start "Department · …"; drop the repeat.
  const first = breakdown.rows[0].name.split(' · ')[0];
  const sharedPrefix =
    !showFaculty && breakdown.rows.every((r) => r.name.startsWith(`${first} · `))
      ? `${first} · `
      : '';
  return (
    <div className="-mx-6 overflow-x-auto">
      <table className="w-full min-w-[520px] text-sm">
        <thead>
          <tr className="text-left text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            <th className="px-6 pb-3 font-semibold">{showFaculty ? 'Department' : 'Section'}</th>
            <th className="px-3 pb-3 text-right font-semibold">Students</th>
            {showFaculty && <th className="px-3 pb-3 text-right font-semibold">Faculty</th>}
            <th className="w-48 whitespace-nowrap px-6 pb-3 font-semibold">Attendance (30d)</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {breakdown.rows.map((r) => (
            <tr key={r.id}>
              <td className="px-6 py-3">
                <p className="font-medium">{r.name.slice(sharedPrefix.length)}</p>
                {showFaculty && (
                  <p className="text-xs text-muted-foreground">
                    {r.meta ? `HOD · ${r.meta}` : 'No HOD assigned'}
                  </p>
                )}
              </td>
              <td className="px-3 py-3 text-right tabular-nums">{r.students}</td>
              {showFaculty && (
                <td className="px-3 py-3 text-right tabular-nums">{r.faculty ?? 0}</td>
              )}
              <td className="px-6 py-3">
                <Meter value={r.attendancePct} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
