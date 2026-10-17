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
  UserPlus,
  ArrowRight,
  ArrowUpRight,
  IndianRupee,
  Sparkles,
  CalendarDays,
  UserMinus,
  Bell,
  AlertTriangle,
  Clock,
  Calendar as CalendarIcon,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { dashboardApi } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { useBranchStore } from '@/store/branchStore';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import {
  formatCurrency,
  formatDateLabel,
  GENDER_COLORS,
  type DashboardKPIs,
  type FinanceMetrics,
  type StudentMetrics,
  type AttendanceMetrics,
  type Alert,
} from '../utils';
import { SetupChecklist } from '../SetupChecklist';

const PIPELINE_STAGES: Array<{ key: 'leads' | 'converted'; label: string }> = [
  { key: 'leads', label: 'Total Leads' },
  { key: 'converted', label: 'Converted' },
];

export function OwnerDashboard() {
  const { user } = useAuthStore();
  const selectedBranchId = useBranchStore((s) => s.selectedBranchId);
  const getSelectedBranch = useBranchStore((s) => s.getSelectedBranch);
  const availableBranches = useBranchStore((s) => s.availableBranches);
  const [viewMode, setViewMode] = useState<'branch' | 'overall'>('branch');

  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState<DashboardKPIs | null>(null);
  const [financeMetrics, setFinanceMetrics] = useState<FinanceMetrics | null>(null);
  const [studentMetrics, setStudentMetrics] = useState<StudentMetrics | null>(null);
  const [attendanceMetrics, setAttendanceMetrics] = useState<AttendanceMetrics | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const branchIds = viewMode === 'branch' && selectedBranchId ? [selectedBranchId] : undefined;
      const [kpisRes, financeRes, studentRes, attendanceRes, alertsRes] = await Promise.all([
        dashboardApi.getOwnerKPIs(branchIds),
        dashboardApi.getOwnerFinanceMetrics(branchIds),
        dashboardApi.getOwnerStudentMetrics(branchIds),
        dashboardApi.getOwnerAttendanceMetrics(branchIds),
        dashboardApi.getAlerts().catch(() => ({ data: { alerts: [] } })),
      ]);
      if (kpisRes.success) setKpis(kpisRes.data);
      if (financeRes.success) setFinanceMetrics(financeRes.data);
      if (studentRes.success) setStudentMetrics(studentRes.data);
      if (attendanceRes.success) setAttendanceMetrics(attendanceRes.data);
      if (alertsRes.success) setAlerts(alertsRes.data.alerts || []);
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err);
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }, [viewMode, selectedBranchId]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const currentBranch = getSelectedBranch();
  const showBranchToggle = availableBranches.length > 0;

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  })();

  const dateLabel = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="space-y-10 pb-12">
      <EditorialHeader
        eyebrow={
          viewMode === 'overall' ? 'Group Overview' : (currentBranch?.name ?? 'Branch Overview')
        }
        date={dateLabel}
        greeting={greeting}
        userName={user?.profile?.displayName?.split(' ')[0] ?? 'there'}
        rightSlot={
          showBranchToggle ? <ScopeSwitcher viewMode={viewMode} onChange={setViewMode} /> : null
        }
      />

      {error && (
        <div className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
          <AlertCircle className="h-4 w-4 text-destructive" />
          <p className="flex-1 text-sm text-destructive">{error}</p>
          <Button variant="outline" size="sm" onClick={fetchDashboardData}>
            Retry
          </Button>
        </div>
      )}

      <SetupChecklist />

      <HeroKPIStrip
        loading={loading}
        kpis={kpis}
        newAdmissions={studentMetrics?.newAdmissionsThisMonth ?? 0}
      />

      {alerts.length > 0 && <AlertsRibbon alerts={alerts} />}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <AttendancePanel
          loading={loading}
          attendanceMetrics={attendanceMetrics}
          attendanceRate={kpis?.attendance?.rate ?? 0}
        />
        <TodaysPulse
          loading={loading}
          todaysCollection={financeMetrics?.todaysCollection}
          modeBreakdown={financeMetrics?.collectionByMode}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <DistributionPanel loading={loading} studentMetrics={studentMetrics} />
        <AdmissionsPanel loading={loading} kpis={kpis} />
        <FinanceBreakdown loading={loading} kpis={kpis} />
      </div>

      <ActionsRow />
    </div>
  );
}

// ───────────────────────────── Editorial Header ─────────────────────────────

function EditorialHeader({
  eyebrow,
  date,
  greeting,
  userName,
  rightSlot,
}: {
  eyebrow: string;
  date: string;
  greeting: string;
  userName: string;
  rightSlot?: React.ReactNode;
}) {
  const maskFade = 'radial-gradient(ellipse 70% 120% at 50% 50%, black 40%, transparent 92%)';
  return (
    <header className="relative pb-8">
      {/* Atmospheric wash — extends beyond the container's padding using viewport-width
          insets so the gradient spans the full main-content area edge-to-edge. The
          mask-image fades all four sides into the page background. The dashboard's
          outer wrapper has overflow-x-hidden so the bleed never creates a scroll bar. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-y-8"
        style={{
          left: '-50vw',
          right: '-50vw',
          background:
            'radial-gradient(ellipse 35% 90% at 30% 50%, hsl(var(--primary) / 0.10), transparent 70%), radial-gradient(ellipse 30% 80% at 70% 60%, hsl(var(--accent) / 0.08), transparent 70%)',
          WebkitMaskImage: maskFade,
          maskImage: maskFade,
        }}
      />

      <div className="relative flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2 min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
            <Sparkles className="h-3 w-3 shrink-0 text-accent" />
            <span className="min-w-0">{eyebrow}</span>
            <span className="hidden h-px w-8 bg-border sm:block" />
            <span>{date}</span>
          </div>
          <h1 className="font-display text-4xl font-bold leading-[1.15] tracking-tight text-foreground md:text-5xl">
            {greeting},{' '}
            <span className="bg-gradient-to-r from-primary via-primary to-accent bg-clip-text text-transparent">
              {userName}.
            </span>
          </h1>
        </div>
        {rightSlot}
      </div>
    </header>
  );
}

function ScopeSwitcher({
  viewMode,
  onChange,
}: {
  viewMode: 'branch' | 'overall';
  onChange: (m: 'branch' | 'overall') => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground whitespace-nowrap">
        Showing
      </span>
      <div
        role="tablist"
        aria-label="Dashboard scope"
        className="inline-flex items-center rounded-full border border-border bg-card p-1 shadow-soft"
      >
        <button
          role="tab"
          aria-selected={viewMode === 'branch'}
          onClick={() => onChange('branch')}
          className={`rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
            viewMode === 'branch'
              ? 'bg-foreground text-background shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          This Branch
        </button>
        <button
          role="tab"
          aria-selected={viewMode === 'overall'}
          onClick={() => onChange('overall')}
          className={`rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
            viewMode === 'overall'
              ? 'bg-foreground text-background shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          All Branches
        </button>
      </div>
    </div>
  );
}

// ──────────────────────────── Hero KPI Strip ────────────────────────────────

function HeroKPIStrip({
  loading,
  kpis,
  newAdmissions,
}: {
  loading: boolean;
  kpis: DashboardKPIs | null;
  newAdmissions: number;
}) {
  const attendanceRate = kpis?.attendance?.rate ?? 0;
  const items = [
    {
      label: 'Students',
      value: kpis?.students?.total?.toLocaleString() ?? '0',
      footnote:
        newAdmissions > 0 ? (
          <span className="inline-flex items-center gap-1 text-success">
            <UserPlus className="h-3 w-3" /> +{newAdmissions} this month
          </span>
        ) : (
          <span className="text-muted-foreground">Active enrolment</span>
        ),
      accent: false,
      icon: GraduationCap,
    },
    {
      label: 'Collected',
      value: `₹${formatCurrency(kpis?.finance?.totalCollected ?? 0)}`,
      footnote: (
        <span className="text-muted-foreground">
          {kpis?.finance?.collectionRate ?? 0}% of billed
        </span>
      ),
      accent: true,
      icon: Wallet,
    },
    {
      label: "Today's Attendance",
      value: `${attendanceRate}%`,
      footnote: (
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
        <Link
          href="/communications/sms"
          className="inline-flex items-center gap-1 text-muted-foreground transition-colors hover:text-foreground"
        >
          <Bell className="h-3 w-3" /> Send reminders
          <ArrowRight className="h-3 w-3" />
        </Link>
      ),
      accent: false,
      icon: AlertCircle,
      destructive: true,
    },
  ];

  return (
    <section
      aria-label="Key performance indicators"
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
              {/* serial number, editorial touch */}
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

// ──────────────────────────── Alerts Ribbon ─────────────────────────────────

function AlertsRibbon({ alerts }: { alerts: Alert[] }) {
  return (
    <section className="space-y-3">
      <header className="flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
          Requires Attention · {alerts.length}
        </p>
        <span className="h-px flex-1 bg-border ml-4" />
      </header>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {alerts.slice(0, 4).map((alert) => {
          const Icon =
            alert.type === 'fee_due'
              ? IndianRupee
              : alert.type === 'low_attendance'
                ? AlertTriangle
                : alert.type === 'pending_approvals'
                  ? Clock
                  : alert.type === 'upcoming_events'
                    ? CalendarIcon
                    : Bell;
          const tone =
            alert.severity === 'critical'
              ? 'border-destructive/30 bg-destructive/[0.03] hover:bg-destructive/[0.06] text-destructive'
              : alert.severity === 'warning'
                ? 'border-warning/30 bg-warning/[0.03] hover:bg-warning/[0.06] text-warning'
                : 'border-info/30 bg-info/[0.03] hover:bg-info/[0.06] text-info';
          return (
            <Link
              key={alert.id}
              href={alert.link}
              className={`group flex items-center gap-3 rounded-xl border px-4 py-3 transition-all ${tone}`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <div className="flex-1 min-w-0 text-foreground">
                <p className="truncate text-sm font-medium">{alert.title}</p>
                <p className="text-xs text-muted-foreground">{alert.count} items pending</p>
              </div>
              <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </Link>
          );
        })}
      </div>
    </section>
  );
}

// ────────────────────────── Attendance Panel ────────────────────────────────

function AttendancePanel({
  loading,
  attendanceMetrics,
  attendanceRate,
}: {
  loading: boolean;
  attendanceMetrics: AttendanceMetrics | null;
  attendanceRate: number;
}) {
  const data =
    attendanceMetrics?.weeklyTrend?.map((d) => ({
      name: formatDateLabel(d.date),
      present: d.present,
      absent: Math.max(0, d.total - d.present),
      rate: Math.round(d.rate),
    })) ?? [];

  return (
    <section className="lg:col-span-2 rounded-2xl border border-border bg-card shadow-soft">
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            Weekly Attendance
          </p>
          <h3 className="font-display text-lg font-semibold mt-0.5">
            {attendanceRate}%{' '}
            <span className="text-sm font-normal text-muted-foreground">today</span>
          </h3>
        </div>
        <Link
          href="/attendance/reports"
          className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground inline-flex items-center gap-1"
        >
          Full report <ArrowUpRight className="h-3 w-3" />
        </Link>
      </header>
      <div className="px-2 py-4 sm:px-4">
        {loading ? (
          <Skeleton className="h-[260px] w-full" />
        ) : data.length === 0 ? (
          <EmptyState message="No attendance recorded for this week" />
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data} barCategoryGap="22%">
              <defs>
                <linearGradient id="presentGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--success))" stopOpacity={0.95} />
                  <stop offset="100%" stopColor="hsl(var(--success))" stopOpacity={0.6} />
                </linearGradient>
                <linearGradient id="absentGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--destructive))" stopOpacity={0.55} />
                  <stop offset="100%" stopColor="hsl(var(--destructive))" stopOpacity={0.25} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="2 4" stroke="hsl(var(--border))" vertical={false} />
              <XAxis
                dataKey="name"
                axisLine={false}
                tickLine={false}
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                width={32}
              />
              <Tooltip
                cursor={{ fill: 'hsl(var(--muted) / 0.4)' }}
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '10px',
                  fontSize: 12,
                  boxShadow: '0 8px 24px -4px rgb(0 0 0 / 0.08)',
                }}
              />
              <Bar
                dataKey="present"
                name="Present"
                fill="url(#presentGrad)"
                radius={[6, 6, 0, 0]}
              />
              <Bar dataKey="absent" name="Absent" fill="url(#absentGrad)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </section>
  );
}

// ────────────────────────── Today's Pulse ───────────────────────────────────

function TodaysPulse({
  loading,
  todaysCollection,
  modeBreakdown,
}: {
  loading: boolean;
  todaysCollection: FinanceMetrics['todaysCollection'] | undefined;
  modeBreakdown: FinanceMetrics['collectionByMode'] | undefined;
}) {
  const modes = modeBreakdown
    ? Object.entries(modeBreakdown)
        .map(([k, v]) => ({ key: k, ...v }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 4)
    : [];
  const modeTotal = modes.reduce((s, m) => s + m.total, 0);

  return (
    <section className="rounded-2xl border border-border bg-gradient-to-br from-card via-card to-primary/[0.03] shadow-soft">
      <header className="flex items-baseline justify-between border-b border-border px-6 py-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
          Today&apos;s Pulse
        </p>
        <span className="text-[10px] tabular-nums text-muted-foreground/70">
          {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
        </span>
      </header>

      <div className="space-y-6 px-6 py-6">
        {/* Today's collection — hero metric */}
        <div>
          <p className="text-xs text-muted-foreground">Collection so far</p>
          {loading ? (
            <Skeleton className="mt-2 h-10 w-32" />
          ) : (
            <div className="mt-1 flex items-baseline gap-2">
              <span className="font-display text-4xl font-bold tracking-tight tabular-nums">
                ₹{formatCurrency(todaysCollection?.total ?? 0)}
              </span>
              <span className="text-xs text-muted-foreground">
                · {todaysCollection?.count ?? 0} txn
              </span>
            </div>
          )}
        </div>

        {/* Mode breakdown bars */}
        <div className="space-y-3 border-t border-border pt-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            By payment mode
          </p>
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          ) : modes.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">No transactions yet today.</p>
          ) : (
            <ul className="space-y-2.5">
              {modes.map((m) => {
                const pct = modeTotal > 0 ? (m.total / modeTotal) * 100 : 0;
                return (
                  <li key={m.key} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="capitalize text-foreground">{m.key.replace('_', ' ')}</span>
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
      </div>
    </section>
  );
}

// ────────────────────── Distribution / Admissions / Finance ─────────────────

function DistributionPanel({
  loading,
  studentMetrics,
}: {
  loading: boolean;
  studentMetrics: StudentMetrics | null;
}) {
  const chartData = studentMetrics?.genderDistribution
    ? Object.entries(studentMetrics.genderDistribution)
        .filter(([, c]) => c > 0)
        .map(([gender, count]) => ({
          name: gender.charAt(0).toUpperCase() + gender.slice(1),
          value: count,
          color: GENDER_COLORS[gender] ?? GENDER_COLORS.unknown,
        }))
    : [];
  const total = chartData.reduce((s, x) => s + x.value, 0);

  const topClasses = (studentMetrics?.byClass ?? []).slice(0, 4);

  return (
    <section className="rounded-2xl border border-border bg-card shadow-soft">
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
          Student Distribution
        </p>
        <span className="text-xs tabular-nums text-muted-foreground">{total} total</span>
      </header>
      <div className="px-6 py-5 space-y-5">
        {loading ? (
          <Skeleton className="h-44 w-full" />
        ) : chartData.length === 0 ? (
          <EmptyState message="No student data yet" />
        ) : (
          <>
            <div className="relative">
              <ResponsiveContainer width="100%" height={150}>
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={68}
                    paddingAngle={4}
                    dataKey="value"
                    stroke="hsl(var(--card))"
                    strokeWidth={3}
                  >
                    {chartData.map((entry, idx) => (
                      <Cell key={idx} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '10px',
                      fontSize: 12,
                    }}
                    formatter={(v: number, n: string) => [
                      `${v} (${Math.round((v / total) * 100)}%)`,
                      n,
                    ]}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-display text-2xl font-bold tabular-nums">{total}</span>
                <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  Students
                </span>
              </div>
            </div>
            <ul className="grid grid-cols-2 gap-2 text-xs">
              {chartData.map((c) => (
                <li key={c.name} className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: c.color }} />
                  <span className="text-muted-foreground">{c.name}</span>
                  <span className="ml-auto tabular-nums font-medium">{c.value}</span>
                </li>
              ))}
            </ul>
            {topClasses.length > 0 && (
              <div className="border-t border-border pt-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground mb-2">
                  Largest classes
                </p>
                <ul className="space-y-1.5 text-xs">
                  {topClasses.map((c) => (
                    <li key={c.classId} className="flex items-center justify-between">
                      <span className="text-foreground truncate pr-2">{c.className}</span>
                      <span className="tabular-nums text-muted-foreground">{c.count}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}

function AdmissionsPanel({ loading, kpis }: { loading: boolean; kpis: DashboardKPIs | null }) {
  const totalLeads = kpis?.admissions?.totalLeads ?? 0;
  const converted = kpis?.admissions?.converted ?? 0;
  const conversionRate = kpis?.admissions?.conversionRate ?? 0;

  return (
    <section className="rounded-2xl border border-border bg-card shadow-soft">
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
          Admissions Pipeline
        </p>
        <Link
          href="/admissions"
          className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          Open <ArrowUpRight className="h-3 w-3" />
        </Link>
      </header>
      <div className="px-6 py-6 space-y-6">
        {loading ? (
          <>
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-10 w-full" />
          </>
        ) : (
          <>
            {/* Pipeline flow */}
            <div className="flex items-center gap-2">
              {PIPELINE_STAGES.map((stage, i) => {
                const value = stage.key === 'leads' ? totalLeads : converted;
                const isLast = i === PIPELINE_STAGES.length - 1;
                return (
                  <div key={stage.key} className="flex flex-1 items-center gap-2">
                    <div
                      className={`flex-1 rounded-xl border px-4 py-4 text-center ${
                        stage.key === 'converted'
                          ? 'border-success/30 bg-success/5'
                          : 'border-primary/30 bg-primary/5'
                      }`}
                    >
                      <p
                        className={`font-display text-3xl font-bold tabular-nums ${
                          stage.key === 'converted' ? 'text-success' : 'text-primary'
                        }`}
                      >
                        {value}
                      </p>
                      <p className="mt-0.5 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                        {stage.label}
                      </p>
                    </div>
                    {!isLast && (
                      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground/60" />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Conversion bar */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Conversion rate</span>
                <span className="font-display font-semibold tabular-nums">{conversionRate}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted/60">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-primary via-accent to-success transition-all"
                  style={{ width: `${Math.min(100, conversionRate)}%` }}
                />
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function FinanceBreakdown({ loading, kpis }: { loading: boolean; kpis: DashboardKPIs | null }) {
  const totalBilled = kpis?.finance?.totalBilled ?? 0;
  const totalCollected = kpis?.finance?.totalCollected ?? 0;
  const totalDue = kpis?.finance?.totalDue ?? 0;
  const collectionRate = kpis?.finance?.collectionRate ?? 0;

  const segments = [
    {
      label: 'Collected',
      value: totalCollected,
      color: 'bg-success',
      textColor: 'text-success',
    },
    {
      label: 'Outstanding',
      value: totalDue,
      color: 'bg-destructive/70',
      textColor: 'text-destructive',
    },
  ];

  return (
    <section className="rounded-2xl border border-border bg-card shadow-soft">
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
          Finance Breakdown
        </p>
        <Link
          href="/finance/dues"
          className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          Dues <ArrowUpRight className="h-3 w-3" />
        </Link>
      </header>
      <div className="px-6 py-6 space-y-6">
        {loading ? (
          <>
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-16 w-full" />
          </>
        ) : (
          <>
            {/* Total billed hero */}
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Total Billed
              </p>
              <p className="mt-1 font-display text-3xl font-bold tracking-tight tabular-nums">
                ₹{formatCurrency(totalBilled)}
              </p>
            </div>

            {/* Stacked progress bar */}
            <div className="space-y-2">
              <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted/60">
                {totalBilled > 0 ? (
                  <>
                    <div
                      className="h-full bg-success transition-all"
                      style={{ width: `${(totalCollected / totalBilled) * 100}%` }}
                    />
                    <div
                      className="h-full bg-destructive/70 transition-all"
                      style={{ width: `${(totalDue / totalBilled) * 100}%` }}
                    />
                  </>
                ) : (
                  <div className="h-full" />
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                <span className="font-semibold text-foreground tabular-nums">
                  {collectionRate}%
                </span>{' '}
                collection rate
              </p>
            </div>

            {/* Segments */}
            <ul className="space-y-2.5">
              {segments.map((s) => (
                <li
                  key={s.label}
                  className="flex items-center justify-between border-b border-border/60 pb-2 last:border-b-0 last:pb-0"
                >
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${s.color}`} />
                    <span className="text-xs text-muted-foreground">{s.label}</span>
                  </div>
                  <span className={`text-sm font-semibold tabular-nums ${s.textColor}`}>
                    ₹{formatCurrency(s.value)}
                  </span>
                </li>
              ))}
            </ul>
          </>
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
    { label: 'Calendar', href: '/communications/calendar', icon: CalendarDays },
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

// ────────────────────────────── Empty State ────────────────────────────────

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex h-44 flex-col items-center justify-center gap-2 text-center">
      <div className="h-px w-12 bg-border" />
      <p className="text-xs text-muted-foreground italic">{message}</p>
      <div className="h-px w-12 bg-border" />
    </div>
  );
}

// kept unused import warnings happy
void UserMinus;
