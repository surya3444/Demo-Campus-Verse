'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ClipboardCheck, HeartPulse, Plus, ShieldCheck, Stethoscope, Syringe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { healthApi } from '@/lib/api';
import { usePermissions } from '@/hooks/usePermissions';
import {
  ACCENT,
  ChartTip,
  Empty,
  Meter,
  PageTitle,
  Panel,
  PersonCell,
  Pill,
  Skeleton,
  Faces,
  FeatureCard,
  FeatureNumber,
  MiniBars,
  Ring,
  fmtDate,
  fmtTime,
} from '@/components/connect/kit';

const TEAL = ACCENT.health.hex;
const OUTCOME: Record<string, { label: string; tone: 'green' | 'amber' | 'violet' | 'blue' }> = {
  returned_to_class: { label: 'Back in class', tone: 'green' },
  sent_home: { label: 'Sent home', tone: 'amber' },
  referred: { label: 'Referred', tone: 'violet' },
  under_observation: { label: 'Observation', tone: 'blue' },
};

export default function HealthOverview() {
  const { hasPermission } = usePermissions();
  const q = useQuery({
    queryKey: ['health-hub'],
    queryFn: () => healthApi.getHub().then((r) => r.data),
  });
  const h = q.data;
  const today = new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  if (!h) {
    return (
      <>
        <PageTitle title="Campus health" description={today} />
        <Panel>
          <Skeleton rows={8} />
        </Panel>
      </>
    );
  }
  const k = h.kpis;
  const checkRate = k.checkupsTotal ? Math.round((k.checkupsDone / k.checkupsTotal) * 100) : 0;
  const daily = h.trend.map((t) => t.illness + t.injury + t.other);
  const bmiTotal = h.bmiBands.reduce((n, b) => n + b.value, 0) || 1;
  const maxComplaint = Math.max(1, ...h.complaints.map((c) => c.value));

  return (
    <div className="space-y-6">
      <PageTitle
        title="Campus health"
        description={`${today} · ${k.records.toLocaleString('en-IN')} health records on file`}
        actions={
          <>
            <Button variant="outline" size="sm" asChild>
              <Link href="/health/reports">Reports</Link>
            </Button>
            {hasPermission('health.visits', 'create') && (
              <Button size="sm" asChild className="bg-teal-600 hover:bg-teal-700">
                <Link href="/health/visits/new">
                  <Plus className="mr-1.5 h-4 w-4" />
                  Log a visit
                </Link>
              </Button>
            )}
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <FeatureCard accent="health" solid label="Sick-room visits today" icon={Stethoscope}>
          <div className="flex items-center gap-3">
            <FeatureNumber value={k.visitsToday} />
            {k.inSickRoom > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-medium">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
                </span>
                {k.inSickRoom} resting now
              </span>
            )}
          </div>
          <p className="mt-1.5 text-xs text-white/75">{k.visitsWeek} this week · {k.visitsMonth} this month</p>
          {h.today.length > 0 && (
            <Link
              href="/health/visits"
              className="mt-auto flex items-center gap-2.5 rounded-xl bg-white/10 px-2.5 py-2 text-xs backdrop-blur transition hover:bg-white/15 [margin-top:1rem]"
            >
              <Faces people={h.today.slice(0, 5)} max={5} size={24} />
              <span className="min-w-0 truncate text-white/85">
                Latest: <span className="font-semibold text-white">{h.today[0].name.split(' ')[0]}</span> · {h.today[0].complaint}
              </span>
            </Link>
          )}
        </FeatureCard>

        <FeatureCard accent="health" label="Visits, last 30 days" icon={HeartPulse}>
          <FeatureNumber value={k.visitsMonth} />
          <p className="mt-1.5 text-xs text-muted-foreground">
            Mostly {h.complaints[0]?.name?.toLowerCase() ?? 'routine'} · {k.visitsWeek} this week
          </p>
          <MiniBars data={daily} color={TEAL} height={40} className="mt-auto [margin-top:1rem]" />
        </FeatureCard>

        <FeatureCard accent="health" label="Check-ups completed" icon={ClipboardCheck}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <FeatureNumber value={k.checkupsDone} />
              <p className="mt-1.5 text-xs text-muted-foreground">of {k.checkupsTotal} scheduled</p>
            </div>
            <Ring value={checkRate} size={68} stroke={6} color={TEAL}>
              <span className="text-sm font-semibold tabular-nums">{checkRate}%</span>
            </Ring>
          </div>
          <div className="mt-auto flex items-center justify-between rounded-xl bg-teal-50 px-3 py-2 text-xs dark:bg-teal-500/10 [margin-top:1rem]">
            <span className="text-muted-foreground">Average BMI</span>
            <span className="font-semibold tabular-nums text-teal-700 dark:text-teal-300">{k.averageBmi}</span>
          </div>
        </FeatureCard>

        <FeatureCard accent="health" label="Vaccination compliance" icon={ShieldCheck}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <FeatureNumber value={k.vaccinationCompliance} format={(n) => `${Math.round(n)}%`} />
              <p className="mt-1.5 text-xs text-muted-foreground">{k.vaccinesGiven} doses given</p>
            </div>
            <Ring value={k.vaccinationCompliance} size={68} stroke={6} color={TEAL}>
              <ShieldCheck className="h-5 w-5 text-teal-600" />
            </Ring>
          </div>
          <Link
            href="/health/vaccinations"
            className={`mt-auto flex items-center justify-between rounded-xl px-3 py-2 text-xs transition [margin-top:1rem] ${k.overdue ? 'bg-rose-50 text-rose-700 hover:bg-rose-100/70 dark:bg-rose-500/10 dark:text-rose-300' : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10'}`}
          >
            <span>{k.overdue ? `${k.overdue} doses overdue` : 'Nothing overdue'}</span>
            <span className="font-medium">{k.overdue ? 'Remind →' : '✓'}</span>
          </Link>
        </FeatureCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
        <Panel
          title="Sick room today"
          action={
            <Link
              href="/health/visits"
              className="text-sm font-medium text-teal-700 hover:underline dark:text-teal-300"
            >
              All visits
            </Link>
          }
          bodyClassName="px-0 pb-2"
        >
          {h.today.length ? (
            <ul className="divide-y divide-border/60">
              {h.today.map((v) => {
                const o =
                  v.status === 'in_progress' ? null : OUTCOME[v.outcome ?? 'returned_to_class'];
                return (
                  <li key={v._id}>
                    <Link
                      href={`/health/visits/${v._id}`}
                      className="flex items-center gap-3 px-5 py-2.5 hover:bg-muted/40"
                    >
                      <div className="min-w-0 flex-1">
                        <PersonCell person={v} sub={`${v.complaint} · ${fmtTime(v.time)}`} />
                      </div>
                      {o ? (
                        <Pill tone={o.tone}>{o.label}</Pill>
                      ) : (
                        <Pill tone="red">In sick room</Pill>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <Empty icon={Stethoscope} title="A quiet day" text="No sick-room visits yet today." />
          )}
        </Panel>

        <Panel
          title="Visits over the last 30 days"
          description="Illness, injuries and routine visits"
        >
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={h.trend}
                margin={{ top: 4, right: 4, left: -26, bottom: 0 }}
                barCategoryGap="28%"
              >
                <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="2 4" />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  fontSize={11}
                  interval={5}
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  fontSize={11}
                  allowDecimals={false}
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                />
                <Tooltip
                  content={<ChartTip />}
                  cursor={{ fill: 'hsl(var(--muted))', opacity: 0.5 }}
                />
                <Bar dataKey="illness" name="Illness" stackId="v" fill={TEAL} />
                <Bar dataKey="injury" name="Injury" stackId="v" fill="#5eead4" />
                <Bar
                  dataKey="other"
                  name="Routine"
                  stackId="v"
                  fill="#cbd5e1"
                  radius={[3, 3, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 flex gap-4 text-xs text-muted-foreground">
            {[
              ['Illness', TEAL],
              ['Injury', '#5eead4'],
              ['Routine', '#cbd5e1'],
            ].map(([l, c]) => (
              <span key={l} className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-sm" style={{ background: c }} />
                {l}
              </span>
            ))}
          </div>
        </Panel>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel title="Common complaints" description="Last 30 days">
          <ul className="space-y-3">
            {h.complaints.map((c) => (
              <li key={c.name}>
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="truncate">{c.name}</span>
                  <span className="tabular-nums text-muted-foreground">{c.value}</span>
                </div>
                <Meter value={(c.value / maxComplaint) * 100} color={TEAL} className="mt-1.5" />
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="BMI at check-ups" description={`${k.checkupsDone} students measured`}>
          <div className="flex h-3 overflow-hidden rounded-full">
            {h.bmiBands.map((b, i) => (
              <span
                key={b.name}
                style={{
                  width: `${(b.value / bmiTotal) * 100}%`,
                  background: ['#fbbf24', TEAL, '#fb923c', '#f43f5e'][i],
                }}
              />
            ))}
          </div>
          <ul className="mt-4 space-y-2.5 text-sm">
            {h.bmiBands.map((b, i) => (
              <li key={b.name} className="flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 rounded-sm"
                  style={{ background: ['#fbbf24', TEAL, '#fb923c', '#f43f5e'][i] }}
                />
                <span className="flex-1">{b.name}</span>
                <span className="tabular-nums text-muted-foreground">{b.value}</span>
                <span className="w-10 text-right tabular-nums">
                  {Math.round((b.value / bmiTotal) * 100)}%
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-4 border-t pt-3 text-xs text-muted-foreground">
            Average BMI {k.averageBmi} · healthy range 18.5–25
          </p>
        </Panel>

        <Panel title="How visits ended" description="Last 30 days">
          <ul className="space-y-3">
            {h.outcomes.map((o) => {
              const total = h.outcomes.reduce((n, x) => n + x.value, 0) || 1;
              return (
                <li key={o.name}>
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="capitalize">{o.name}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {Math.round((o.value / total) * 100)}%
                    </span>
                  </div>
                  <Meter value={(o.value / total) * 100} color={TEAL} className="mt-1.5" />
                </li>
              );
            })}
          </ul>
        </Panel>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Panel
          title="Vaccine coverage"
          description="Doses given against doses planned"
          bodyClassName="px-0 pb-2"
        >
          <div className="divide-y divide-border/60">
            {h.coverage.map((c) => (
              <div
                key={c.name}
                className="grid grid-cols-[minmax(0,1fr)_140px_90px_48px] items-center gap-4 px-5 py-2.5 text-sm"
              >
                <span className="flex items-center gap-2 truncate font-medium">
                  <Syringe className="h-3.5 w-3.5 text-teal-600" />
                  {c.name}
                </span>
                <Meter value={c.rate} color={c.rate >= 75 ? TEAL : '#f59e0b'} />
                <span className="text-right tabular-nums text-muted-foreground">
                  {c.completed} of {c.total}
                </span>
                <span className="text-right font-medium tabular-nums">{c.rate}%</span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel
          title="Doses due"
          action={
            <Link
              href="/health/vaccinations"
              className="text-sm font-medium text-teal-700 hover:underline dark:text-teal-300"
            >
              All vaccinations
            </Link>
          }
          bodyClassName="px-0 pb-2"
        >
          <ul className="divide-y divide-border/60">
            {h.dueSoon.map((v) => (
              <li key={v._id}>
                <Link
                  href={`/health/records/${v.recordId}`}
                  className="flex items-center gap-3 px-5 py-2.5 hover:bg-muted/40"
                >
                  <div className="min-w-0 flex-1">
                    <PersonCell person={v} sub={v.vaccine} />
                  </div>
                  {v.overdue ? (
                    <Pill tone="red">Overdue</Pill>
                  ) : (
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {fmtDate(v.date, { day: 'numeric', month: 'short' })}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  );
}
