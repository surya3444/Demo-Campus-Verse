'use client';

import { useMemo } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { School, Users, Trophy, TrendingUp } from 'lucide-react';
import type { PlatformStatistics } from '@/lib/api';
import { Skeleton } from '@/components/ui/skeleton';
import { SectionCard } from '@/components/dashboard/SectionCard';

const TYPE_COLORS: Record<string, string> = {
  school: '#0ea5e9', // sky-500
  college: '#8b5cf6', // violet-500
  university: '#10b981', // emerald-500
  unknown: '#94a3b8', // slate-400
};

const colorForType = (type: string) => TYPE_COLORS[type] ?? TYPE_COLORS.unknown;

/** Shared themed tooltip styling — mirrors the web app's recharts chrome. */
const TOOLTIP_STYLE = {
  backgroundColor: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '10px',
  fontSize: 12,
  boxShadow: '0 8px 24px -4px rgb(0 0 0 / 0.08)',
} as const;

const AXIS_TICK = { fill: 'hsl(var(--muted-foreground))', fontSize: 11 } as const;

interface Props {
  stats: PlatformStatistics | null;
  loading: boolean;
}

export function StatisticsCharts({ stats, loading }: Props) {
  return (
    <>
      <GrowthTrend stats={stats} loading={loading} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <InstitutionDonut stats={stats} loading={loading} />
        <StaffDonut stats={stats} loading={loading} />
      </div>

      <TopOrgsBarChart stats={stats} loading={loading} />
    </>
  );
}

/* ─────────────────── Growth trend (6 months) ─────────────────── */

function GrowthTrend({ stats, loading }: Props) {
  const data = stats?.monthlyGrowth ?? [];
  const hasData = data.some((d) => d.organizations > 0 || d.students > 0);

  return (
    <SectionCard
      eyebrow="Platform growth"
      title="New organizations & students · last 6 months"
      badge={<Legend />}
    >
      {loading ? (
        <Skeleton className="h-[300px] w-full" />
      ) : !hasData ? (
        <Empty icon={TrendingUp} label="Not enough history to chart growth yet" />
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={data} margin={{ top: 10, right: 8, left: -12, bottom: 0 }}>
            <defs>
              <linearGradient id="studentsArea" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.22} />
                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="2 4" stroke="hsl(var(--border))" vertical={false} />
            <XAxis dataKey="month" axisLine={false} tickLine={false} tick={AXIS_TICK} />
            <YAxis
              yAxisId="students"
              axisLine={false}
              tickLine={false}
              tick={AXIS_TICK}
              width={36}
              allowDecimals={false}
            />
            <YAxis
              yAxisId="orgs"
              orientation="right"
              axisLine={false}
              tickLine={false}
              tick={AXIS_TICK}
              width={28}
              allowDecimals={false}
            />
            <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ stroke: 'hsl(var(--border))' }} />
            <Area
              yAxisId="students"
              type="monotone"
              dataKey="students"
              name="New students"
              stroke="hsl(var(--primary))"
              strokeWidth={2.5}
              fill="url(#studentsArea)"
              dot={false}
              activeDot={{ r: 4 }}
            />
            <Line
              yAxisId="orgs"
              type="monotone"
              dataKey="organizations"
              name="New organizations"
              stroke="hsl(var(--brand-cyan))"
              strokeWidth={2.5}
              dot={{ r: 3, fill: 'hsl(var(--brand-cyan))', strokeWidth: 0 }}
              activeDot={{ r: 5 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </SectionCard>
  );
}

function Legend() {
  return (
    <span className="flex items-center gap-3 text-[11px] text-muted-foreground">
      <span className="flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-primary" /> Students
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-[hsl(var(--brand-cyan))]" /> Organizations
      </span>
    </span>
  );
}

/* ─────────────────── Institution type donut ─────────────────── */

function InstitutionDonut({ stats, loading }: Props) {
  const data = useMemo(
    () =>
      (stats?.byInstitutionType ?? []).map((d) => ({
        name: d.type,
        value: d.count,
        color: colorForType(d.type),
      })),
    [stats]
  );
  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <SectionCard eyebrow="By institution type" title="Organization mix">
      {loading ? (
        <Skeleton className="h-[220px] w-full" />
      ) : total === 0 ? (
        <Empty icon={School} label="No organizations yet" />
      ) : (
        <div className="flex flex-col items-center gap-6 sm:flex-row">
          <div className="relative h-[180px] w-[180px] shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={56}
                  outerRadius={82}
                  paddingAngle={3}
                  stroke="hsl(var(--card))"
                  strokeWidth={3}
                >
                  {data.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  formatter={(v: number, n: string) => [
                    `${v} (${Math.round((v / total) * 100)}%)`,
                    n.charAt(0).toUpperCase() + n.slice(1),
                  ]}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-display text-2xl font-bold tabular-nums text-foreground">
                {total}
              </span>
              <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Orgs
              </span>
            </div>
          </div>
          <ul className="flex-1 space-y-2.5 self-stretch">
            {data.map((d) => (
              <li key={d.name} className="flex items-center justify-between gap-3 text-sm">
                <span className="flex items-center gap-2 min-w-0">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: d.color }}
                  />
                  <span className="truncate capitalize text-foreground">{d.name}</span>
                </span>
                <span className="tabular-nums text-muted-foreground shrink-0">
                  {d.value}
                  <span className="ml-1.5 text-muted-foreground/50">
                    {Math.round((d.value / total) * 100)}%
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </SectionCard>
  );
}

/* ─────────────────── Staff composition donut ─────────────────── */

function StaffDonut({ stats, loading }: Props) {
  const teachers = stats?.staff.teachers ?? 0;
  const nonTeaching = stats?.staff.nonTeaching ?? 0;
  const total = teachers + nonTeaching;
  const data = [
    { name: 'Teaching', value: teachers, color: 'hsl(var(--primary))' },
    { name: 'Non-teaching', value: nonTeaching, color: 'hsl(var(--brand-cyan))' },
  ];

  return (
    <SectionCard eyebrow="Workforce" title="Staff composition">
      {loading ? (
        <Skeleton className="h-[220px] w-full" />
      ) : total === 0 ? (
        <Empty icon={Users} label="No staff recorded yet" />
      ) : (
        <div className="flex flex-col items-center gap-6 sm:flex-row">
          <div className="relative h-[180px] w-[180px] shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={56}
                  outerRadius={82}
                  paddingAngle={3}
                  stroke="hsl(var(--card))"
                  strokeWidth={3}
                >
                  {data.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  formatter={(v: number, n: string) => [
                    `${v} (${Math.round((v / total) * 100)}%)`,
                    n,
                  ]}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-display text-2xl font-bold tabular-nums text-foreground">
                {total}
              </span>
              <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Staff
              </span>
            </div>
          </div>
          <ul className="flex-1 space-y-2.5 self-stretch">
            {data.map((d) => (
              <li key={d.name} className="flex items-center justify-between gap-3 text-sm">
                <span className="flex items-center gap-2 min-w-0">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: d.color }}
                  />
                  <span className="truncate text-foreground">{d.name}</span>
                </span>
                <span className="tabular-nums text-muted-foreground shrink-0">
                  {d.value}
                  <span className="ml-1.5 text-muted-foreground/50">
                    {Math.round((d.value / total) * 100)}%
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </SectionCard>
  );
}

/* ─────────────────── Top organizations bar chart ─────────────────── */

function TopOrgsBarChart({ stats, loading }: Props) {
  const data = useMemo(
    () =>
      (stats?.topOrganizations ?? []).map((o) => ({
        name: o.name,
        students: o.students,
        color: colorForType(o.institutionType),
      })),
    [stats]
  );

  return (
    <SectionCard
      eyebrow="Largest tenants"
      title="Top organizations by students"
      action={{ href: '/organizations', label: 'All organizations' }}
    >
      {loading ? (
        <Skeleton className="h-[260px] w-full" />
      ) : data.length === 0 ? (
        <Empty icon={Trophy} label="No enrolled students yet" />
      ) : (
        <ResponsiveContainer width="100%" height={Math.max(data.length * 52, 140)}>
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 4, right: 24, left: 8, bottom: 4 }}
            barCategoryGap="28%"
          >
            <defs>
              <linearGradient id="orgBar" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.85} />
                <stop offset="100%" stopColor="hsl(var(--brand-cyan))" stopOpacity={0.9} />
              </linearGradient>
            </defs>
            <CartesianGrid horizontal={false} strokeDasharray="2 4" stroke="hsl(var(--border))" />
            <XAxis
              type="number"
              axisLine={false}
              tickLine={false}
              tick={AXIS_TICK}
              allowDecimals={false}
            />
            <YAxis
              type="category"
              dataKey="name"
              axisLine={false}
              tickLine={false}
              tick={{ ...AXIS_TICK, fontSize: 12 }}
              width={150}
            />
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              cursor={{ fill: 'hsl(var(--muted) / 0.4)' }}
              formatter={(v: number) => [`${v.toLocaleString('en-IN')} students`, 'Students']}
            />
            <Bar dataKey="students" fill="url(#orgBar)" radius={[0, 6, 6, 0]} maxBarSize={28} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </SectionCard>
  );
}

/* ─────────────────── shared ─────────────────── */

function Empty({ icon: Icon, label }: { icon: typeof School; label: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12">
      <Icon className="h-8 w-8 text-muted-foreground/40" />
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}
