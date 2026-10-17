'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Users,
  GraduationCap,
  UserCheck,
  AlertCircle,
  Receipt,
  MessageSquare,
  Wallet,
  CalendarDays,
  UserMinus,
  CheckCircle2,
  ArrowUpRight,
  IndianRupee,
  Bell,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { dashboardApi } from '@/lib/api';
import { useBranchStore } from '@/store/branchStore';
import { formatCurrency, type Alert } from '../utils';
import { SetupChecklist } from '../SetupChecklist';
import { CheckInCard } from '../CheckInCard';
import { DashboardHeader, AlertsRibbon, Panel, Meter } from '../kit';
import { useQuery } from '@tanstack/react-query';

interface BranchKPIs {
  students: { total: number; active: number; newThisMonth: number };
  staff: { total: number; presentToday: number; onLeave: number };
  finance: {
    totalBilled: number;
    totalCollected: number;
    totalDue: number;
    collectionRate: number;
  };
  attendance: { rate: number; present: number; absent: number; total: number };
}

interface TodaySummary {
  feeCollection: {
    total: number;
    count: number;
    byMode: Record<string, { total: number; count: number }>;
  };
  attendance: { studentRate: number; staffPresent: number; staffTotal: number };
  staffOnLeave: Array<{ name: string; leaveType: string; returnDate?: string }>;
  upcomingEvents: Array<{ title: string; date: string; type: string }>;
  recentAnnouncements: Array<{ title: string; createdAt: string }>;
}

export function BranchDashboard() {
  const selectedBranchId = useBranchStore((s) => s.selectedBranchId);
  const getSelectedBranch = useBranchStore((s) => s.getSelectedBranch);
  const currentBranch = getSelectedBranch();

  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState<BranchKPIs | null>(null);
  const [todaySummary, setTodaySummary] = useState<TodaySummary | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [kpisRes, todayRes, alertsRes] = await Promise.all([
        dashboardApi.getBranchKPIs(),
        dashboardApi.getBranchTodaySummary(),
        dashboardApi.getAlerts().catch(() => ({ success: true, data: { alerts: [] } })),
      ]);
      if (kpisRes.success) setKpis(kpisRes.data);
      if (todayRes.success) setTodaySummary(todayRes.data);
      if (alertsRes.success) setAlerts(alertsRes.data.alerts || []);
    } catch (err) {
      console.error('Failed to fetch branch dashboard data:', err);
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData, selectedBranchId]);

  return (
    <div className="space-y-10 pb-12">
      <DashboardHeader
        scope={currentBranch?.name}
        subtitle="Everything happening on campus today — money, people and what needs you."
      />

      {error && (
        <div className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
          <AlertCircle className="h-4 w-4 text-destructive" />
          <p className="flex-1 text-sm text-destructive">{error}</p>
          <Button variant="outline" size="sm" onClick={fetchData}>
            Retry
          </Button>
        </div>
      )}

      <BranchKPIStrip loading={loading} kpis={kpis} todaySummary={todaySummary} />

      <AlertsRibbon alerts={alerts} />

      <SetupChecklist />

      {/* Self check-in/out — renders only when the admin has a linked staff profile */}
      <CheckInCard />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <CollectionPanel loading={loading} kpis={kpis} todaySummary={todaySummary} />
        <StaffOnLeavePanel
          loading={loading}
          staffOnLeave={todaySummary?.staffOnLeave ?? []}
          totalOnLeave={kpis?.staff?.onLeave ?? 0}
        />
      </div>

      <DepartmentsPanel />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <UpcomingEventsPanel loading={loading} events={todaySummary?.upcomingEvents ?? []} />
        <AnnouncementsPanel
          loading={loading}
          announcements={todaySummary?.recentAnnouncements ?? []}
        />
      </div>

      <ActionsRow />
    </div>
  );
}

// ────────────────────────── KPI Strip ───────────────────────────────────────

function BranchKPIStrip({
  loading,
  kpis,
  todaySummary,
}: {
  loading: boolean;
  kpis: BranchKPIs | null;
  todaySummary: TodaySummary | null;
}) {
  const attendanceRate = kpis?.attendance?.rate ?? 0;
  const marked = (kpis?.attendance?.total ?? 0) > 0;
  const items = [
    {
      label: 'Active Students',
      value: (kpis?.students?.active ?? kpis?.students?.total ?? 0).toLocaleString(),
      footnote:
        kpis?.students?.newThisMonth && kpis.students.newThisMonth > 0 ? (
          <span className="text-success">+{kpis.students.newThisMonth} this month</span>
        ) : (
          <span className="text-muted-foreground">Active enrolment</span>
        ),
      accent: false,
      icon: GraduationCap,
    },
    {
      label: "Today's Collection",
      value: `₹${formatCurrency(todaySummary?.feeCollection?.total ?? 0)}`,
      footnote: (
        <span className="text-muted-foreground">
          {todaySummary?.feeCollection?.count ?? 0} transactions
        </span>
      ),
      accent: true,
      icon: IndianRupee,
    },
    {
      label: 'Attendance',
      value: marked ? `${attendanceRate}%` : '—',
      footnote: !marked ? (
        <span className="text-muted-foreground">Not marked yet today</span>
      ) : (
        <span
          className={
            attendanceRate >= 90
              ? 'text-success'
              : attendanceRate >= 75
                ? 'text-warning'
                : 'text-destructive'
          }
        >
          {attendanceRate >= 90 ? 'Excellent' : attendanceRate >= 75 ? 'Steady' : 'Needs attention'}
        </span>
      ),
      accent: false,
      icon: UserCheck,
    },
    {
      label: 'Outstanding',
      value: `₹${formatCurrency(kpis?.finance?.totalDue ?? 0)}`,
      footnote: (
        <span className="text-muted-foreground">
          {kpis?.finance?.collectionRate ?? 0}% collected
        </span>
      ),
      accent: false,
      icon: Wallet,
      destructive: true,
    },
  ];

  return (
    <section
      aria-label="Branch KPIs"
      className="relative overflow-hidden rounded-2xl border border-border bg-card shadow-soft"
    >
      <div className="pointer-events-none absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
      <div className="grid grid-cols-1 divide-y divide-border md:grid-cols-2 md:divide-x md:divide-y-0 lg:grid-cols-4">
        {items.map((item, i) => {
          const Icon = item.icon;
          return (
            <div
              key={item.label}
              className={`relative flex flex-col gap-3 px-6 py-7 ${item.accent ? 'bg-gradient-to-br from-primary/5 via-transparent to-transparent' : ''}`}
            >
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                  {item.label}
                </p>
                <Icon
                  className={`h-3.5 w-3.5 ${item.accent ? 'text-primary' : item.destructive ? 'text-destructive/70' : 'text-muted-foreground'}`}
                />
              </div>
              {loading ? (
                <Skeleton className="h-12 w-32" />
              ) : (
                <p
                  className={`font-display text-[44px] font-bold leading-none tracking-tight tabular-nums ${item.destructive ? 'text-destructive' : item.accent ? 'text-primary' : 'text-foreground'}`}
                >
                  {item.value}
                </p>
              )}
              <div className="text-xs">
                {loading ? <Skeleton className="h-3 w-24" /> : item.footnote}
              </div>
              <span className="absolute right-5 top-2 text-[10px] font-mono text-muted-foreground/40">
                0{i + 1}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ─────────────────────── Collection Panel ───────────────────────────────────

function CollectionPanel({
  loading,
  kpis,
  todaySummary,
}: {
  loading: boolean;
  kpis: BranchKPIs | null;
  todaySummary: TodaySummary | null;
}) {
  const billed = kpis?.finance?.totalBilled ?? 0;
  const collected = kpis?.finance?.totalCollected ?? 0;
  const due = kpis?.finance?.totalDue ?? 0;
  const rate = kpis?.finance?.collectionRate ?? 0;

  const modes = todaySummary?.feeCollection?.byMode
    ? Object.entries(todaySummary.feeCollection.byMode)
        .map(([k, v]) => ({ key: k, ...v }))
        .sort((a, b) => b.total - a.total)
    : [];
  const modeTotal = modes.reduce((s, m) => s + m.total, 0);

  return (
    <section className="rounded-2xl border border-border bg-card shadow-soft lg:col-span-2">
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            Fee Collection
          </p>
          <h3 className="font-display text-lg font-semibold mt-0.5">
            ₹{formatCurrency(collected)}{' '}
            <span className="text-sm font-normal text-muted-foreground">
              of ₹{formatCurrency(billed)}
            </span>
          </h3>
        </div>
        <Link
          href="/finance/reports"
          className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          Reports <ArrowUpRight className="h-3 w-3" />
        </Link>
      </header>

      <div className="px-6 py-6 space-y-6">
        {loading ? (
          <>
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </>
        ) : (
          <>
            {/* Stacked progress bar */}
            <div className="space-y-2">
              <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted/60">
                {billed > 0 ? (
                  <>
                    <div
                      className="h-full bg-success transition-all"
                      style={{ width: `${(collected / billed) * 100}%` }}
                    />
                    <div
                      className="h-full bg-destructive/70 transition-all"
                      style={{ width: `${(due / billed) * 100}%` }}
                    />
                  </>
                ) : (
                  <div className="h-full" />
                )}
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">
                  <span className="font-semibold text-foreground tabular-nums">{rate}%</span>{' '}
                  collected
                </span>
                <span className="text-muted-foreground tabular-nums">
                  ₹{formatCurrency(due)} due
                </span>
              </div>
            </div>

            {/* 3-up tabular row */}
            <ul className="grid grid-cols-3 gap-4 border-y border-border py-5">
              <li>
                <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  Billed
                </p>
                <p className="font-display text-xl font-semibold tabular-nums mt-1">
                  ₹{formatCurrency(billed)}
                </p>
              </li>
              <li>
                <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  Collected
                </p>
                <p className="font-display text-xl font-semibold tabular-nums text-success mt-1">
                  ₹{formatCurrency(collected)}
                </p>
              </li>
              <li>
                <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  Outstanding
                </p>
                <p className="font-display text-xl font-semibold tabular-nums text-destructive mt-1">
                  ₹{formatCurrency(due)}
                </p>
              </li>
            </ul>

            {/* By mode */}
            <div className="space-y-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                Today by mode
              </p>
              {modes.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">
                  No transactions captured today.
                </p>
              ) : (
                <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  {modes.map((m) => {
                    const pct = modeTotal > 0 ? (m.total / modeTotal) * 100 : 0;
                    return (
                      <li key={m.key} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="capitalize text-foreground">
                            {m.key.replace('_', ' ')}
                          </span>
                          <span className="tabular-nums text-muted-foreground">
                            ₹{formatCurrency(m.total)}
                          </span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-muted/60">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </>
        )}
      </div>
    </section>
  );
}

// ─────────────────────── Staff On Leave ─────────────────────────────────────

function StaffOnLeavePanel({
  loading,
  staffOnLeave,
  totalOnLeave,
}: {
  loading: boolean;
  staffOnLeave: TodaySummary['staffOnLeave'];
  totalOnLeave: number;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card shadow-soft">
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
          Staff on Leave
        </p>
        <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-semibold tabular-nums">
          {totalOnLeave}
        </span>
      </header>
      <div className="px-6 py-6">
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : staffOnLeave.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-6">
            <CheckCircle2 className="h-8 w-8 text-success/60" />
            <p className="text-sm text-muted-foreground">All staff present today</p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {staffOnLeave.slice(0, 5).map((s, idx) => (
              <li key={idx} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted">
                  <UserMinus className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{s.name}</p>
                  <p className="text-xs text-muted-foreground capitalize">
                    {s.leaveType.replace('_', ' ')}
                    {s.returnDate
                      ? ` · returns ${new Date(s.returnDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
                      : ''}
                  </p>
                </div>
              </li>
            ))}
            {staffOnLeave.length > 5 && (
              <li className="pt-3">
                <Link
                  href="/hr/leaves"
                  className="inline-flex w-full items-center justify-center gap-1 rounded-lg border border-dashed border-border py-2 text-xs text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors"
                >
                  +{staffOnLeave.length - 5} more on leave
                  <ArrowUpRight className="h-3 w-3" />
                </Link>
              </li>
            )}
          </ul>
        )}
      </div>
    </section>
  );
}

// ─────────────────────── Upcoming Events ────────────────────────────────────

function UpcomingEventsPanel({
  loading,
  events,
}: {
  loading: boolean;
  events: TodaySummary['upcomingEvents'];
}) {
  return (
    <section className="rounded-2xl border border-border bg-card shadow-soft">
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
          Upcoming Events
        </p>
        <Link
          href="/communications/calendar"
          className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          Calendar <ArrowUpRight className="h-3 w-3" />
        </Link>
      </header>
      <div className="px-6 py-6">
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : events.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-6">
            <CalendarDays className="h-8 w-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">No upcoming events scheduled</p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {events.slice(0, 4).map((event, idx) => {
              const eventDate = new Date(event.date);
              const day = eventDate.toLocaleDateString('en-US', { day: '2-digit' });
              const month = eventDate.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
              return (
                <li key={idx} className="flex items-center gap-4 py-3 first:pt-0 last:pb-0">
                  <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl border border-border bg-muted/40 text-center">
                    <span className="font-display text-sm font-bold leading-none tabular-nums">
                      {day}
                    </span>
                    <span className="text-[9px] font-semibold tracking-wider text-muted-foreground">
                      {month}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{event.title}</p>
                    <p className="text-xs text-muted-foreground capitalize">
                      {event.type.replace('_', ' ')}
                    </p>
                  </div>
                  <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}

// ─────────────────────── Announcements ─────────────────────────────────────

function AnnouncementsPanel({
  loading,
  announcements,
}: {
  loading: boolean;
  announcements: TodaySummary['recentAnnouncements'];
}) {
  return (
    <section className="rounded-2xl border border-border bg-card shadow-soft">
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
          Recent Announcements
        </p>
        <Link
          href="/communications/announcements"
          className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          View all <ArrowUpRight className="h-3 w-3" />
        </Link>
      </header>
      <div className="px-6 py-6">
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : announcements.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-6">
            <Bell className="h-8 w-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">No announcements yet</p>
          </div>
        ) : (
          <ul className="space-y-4">
            {announcements.slice(0, 4).map((a, idx) => (
              <li key={idx} className="border-l-2 border-primary/40 pl-4">
                <p className="text-sm font-medium leading-snug">{a.title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {new Date(a.createdAt).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

// ──────────────────────────── Actions Row ───────────────────────────────────

function ActionsRow() {
  const actions = [
    { label: 'Mark Attendance', href: '/attendance/mark', icon: UserCheck },
    { label: 'Collect Fee', href: '/finance/fee-counter', icon: Receipt },
    { label: 'Add Student', href: '/students?action=add', icon: GraduationCap },
    { label: 'Send SMS', href: '/communications/sms', icon: MessageSquare },
    { label: 'Manage Staff', href: '/hr/staff', icon: Users },
  ];

  return (
    <section className="space-y-3">
      <header className="flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
          Quick actions
        </p>
        <span className="ml-4 h-px flex-1 bg-border" />
      </header>
      <div className="flex flex-wrap gap-2">
        {actions.map((a) => {
          const Icon = a.icon;
          return (
            <Link
              key={a.href}
              href={a.href}
              className="group inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-xs font-medium text-foreground transition-all hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
            >
              <Icon className="h-3.5 w-3.5 text-muted-foreground transition-colors group-hover:text-primary" />
              {a.label}
              <ArrowUpRight className="h-3 w-3 opacity-0 transition-all group-hover:opacity-100 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </Link>
          );
        })}
      </div>
    </section>
  );
}

// ─────────────────────── Departments (universities/colleges) ────────────────

function DepartmentsPanel() {
  const { data } = useQuery({
    queryKey: ['dash-scope-breakdown'],
    queryFn: () => dashboardApi.getScopeBreakdown(),
  });
  const rows = (data?.data?.rows ?? []) as Array<{
    id: string;
    name: string;
    meta: string | null;
    students: number;
    faculty: number | null;
    attendancePct: number | null;
  }>;
  if (data?.data?.level !== 'department' || rows.length === 0) return null;
  return (
    <Panel
      eyebrow="Departments"
      title={`${rows.length} departments`}
      action={{ label: 'All departments', href: '/organization/departments' }}
    >
      <div className="grid grid-cols-1 gap-x-10 gap-y-4 md:grid-cols-2">
        {rows.map((r) => (
          <div key={r.id} className="space-y-1.5">
            <div className="flex items-baseline justify-between gap-3">
              <p className="truncate text-sm font-medium">{r.name}</p>
              <p className="shrink-0 text-xs text-muted-foreground tabular-nums">
                {r.students} students · {r.faculty ?? 0} faculty
              </p>
            </div>
            <Meter value={r.attendancePct} />
          </div>
        ))}
      </div>
    </Panel>
  );
}
