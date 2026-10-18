'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Bandage,
  Brain,
  ClipboardList,
  Eye,
  FileHeart,
  HeartPulse,
  Loader2,
  ShieldCheck,
  Stethoscope,
  Syringe,
  Thermometer,
  type LucideIcon,
} from 'lucide-react';
import { healthApi } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/authStore';
import { Reveal } from '@/components/clubs/clubVisuals';
import {
  ChartTip,
  Counter,
  PremiumBadge,
  Ring,
  SectionCard,
  Stage,
} from '@/components/connect/premium';

const TEAL = '#14b8a6';
const CYAN = '#0abfff';
const ROSE = '#f43f5e';
const AMBER = '#f59e0b';

const ECG =
  'M0 60 L120 60 L135 60 L145 35 L155 85 L165 15 L178 100 L190 60 L260 60 L280 52 L300 60 L420 60 L435 60 L445 35 L455 85 L465 15 L478 100 L490 60 L560 60 L580 52 L600 60';

function complaintIcon(c: string): LucideIcon {
  if (/fever|cold|cough/i.test(c)) return Thermometer;
  if (/headache|migraine|dizz/i.test(c)) return Brain;
  if (/sprain|cut|abrasion|knee|ankle/i.test(c)) return Bandage;
  if (/eye/i.test(c)) return Eye;
  return Stethoscope;
}

const STATUS: Record<string, { label: string; cls: string; live?: boolean }> = {
  in_progress: {
    label: 'In sick room',
    cls: 'bg-rose-500/10 text-rose-600 dark:text-rose-300',
    live: true,
  },
  returned_to_class: {
    label: 'Back in class',
    cls: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  },
  sent_home: { label: 'Sent home', cls: 'bg-amber-500/10 text-amber-700 dark:text-amber-300' },
  referred: { label: 'Referred', cls: 'bg-violet-500/10 text-violet-700 dark:text-violet-300' },
  under_observation: { label: 'Observation', cls: 'bg-sky-500/10 text-sky-700 dark:text-sky-300' },
};

const time = (d: string) =>
  new Date(d).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });

export default function HealthConnectHome() {
  const org =
    (useAuthStore((s) => s.user?.tenant) as { name?: string } | undefined)?.name ?? 'your campus';
  const q = useQuery({
    queryKey: ['health-hub'],
    queryFn: () => healthApi.getHub().then((r) => r.data),
  });
  const h = q.data;
  if (q.isLoading || !h) {
    return (
      <div className="flex h-72 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  const k = h.kpis;
  const checkRate = k.checkupsTotal ? Math.round((k.checkupsDone / k.checkupsTotal) * 100) : 0;
  const bmiColors = [AMBER, TEAL, '#fb923c', ROSE];
  const links: Array<[string, string, LucideIcon]> = [
    ['Health records', '/health/records', FileHeart],
    ['Sick-room visits', '/health/visits', Stethoscope],
    ['Check-ups', '/health/checkups', ClipboardList],
    ['Vaccinations', '/health/vaccinations', Syringe],
    ['Reports', '/health/reports', BarChart3],
  ];

  return (
    <div className="space-y-7">
      {/* Hero */}
      <Stage glow={[TEAL, CYAN]} className="animate-[club-fade-up_0.6s_both]">
        <svg
          viewBox="0 0 600 120"
          preserveAspectRatio="none"
          className="pointer-events-none absolute inset-x-0 top-1/2 h-40 w-full -translate-y-1/2 opacity-40"
        >
          <path
            d={ECG}
            fill="none"
            stroke={TEAL}
            strokeWidth="2.5"
            strokeLinejoin="round"
            strokeDasharray="1200"
            className="animate-[hc-ecg_3.2s_linear_infinite]"
            style={{ filter: `drop-shadow(0 0 6px ${TEAL})` }}
          />
        </svg>
        <div className="relative grid items-center gap-10 px-6 py-10 sm:px-10 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <div>
            <div className="flex flex-wrap items-center gap-2 animate-[club-fade-up_0.5s_both]">
              <PremiumBadge label="Health Connect" />
              <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/80 ring-1 ring-white/15">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-rose-400" />
                </span>
                Live
              </span>
            </div>
            <h1 className="mt-5 font-display text-5xl font-extrabold leading-[1.03] tracking-tight sm:text-6xl">
              {'Every student,'.split(' ').map((w, i) => (
                <span
                  key={i}
                  className="mr-[0.22em] inline-block animate-[club-letter_0.8s_cubic-bezier(.2,.8,.2,1)_both]"
                  style={{ animationDelay: `${150 + i * 110}ms` }}
                >
                  {w}
                </span>
              ))}
              <br />
              <span className="club-gradient-text">looked after.</span>
            </h1>
            <p className="mt-4 max-w-xl text-lg text-white/80 animate-[club-fade-up_0.6s_0.5s_both]">
              Campus wellbeing at {org}, live — {k.records.toLocaleString('en-IN')} health records,{' '}
              {k.checkupsDone} check-ups done and {k.vaccinesGiven} vaccinations given.
            </p>
            <div className="mt-7 grid max-w-xl grid-cols-3 gap-3 animate-[club-fade-up_0.6s_0.7s_both]">
              {[
                ['In sick room now', k.inSickRoom, HeartPulse, 'text-rose-300'],
                ['Visits today', k.visitsToday, Stethoscope, 'text-teal-300'],
                ['This week', k.visitsWeek, Activity, 'text-cyan-300'],
              ].map(([label, value, Icon, tone]) => {
                const I = Icon as LucideIcon;
                return (
                  <div
                    key={label as string}
                    className="rounded-2xl bg-white/10 p-3 ring-1 ring-white/15 backdrop-blur"
                  >
                    <I className={cn('h-4 w-4', tone as string)} />
                    <p className="mt-1.5 font-display text-2xl font-extrabold tabular-nums">
                      <Counter value={value as number} />
                    </p>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/55">
                      {label as string}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="relative mx-auto flex items-center justify-center">
            <span className="absolute h-64 w-64 rounded-full bg-teal-400/20 blur-3xl" />
            <span className="absolute h-56 w-56 rounded-full border border-white/10 animate-[club-pulse-ring_2.4s_ease-out_infinite]" />
            <Ring
              value={k.vaccinationCompliance}
              size={230}
              stroke={14}
              color={TEAL}
              track="rgba(255,255,255,0.12)"
            >
              <HeartPulse className="h-12 w-12 text-rose-400 animate-[hc-beat_1.6s_ease-in-out_infinite]" />
              <p className="mt-1 font-display text-4xl font-extrabold">
                {k.vaccinationCompliance}%
              </p>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/60">
                Vaccination compliance
              </p>
            </Ring>
          </div>
        </div>
      </Stage>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Reveal>
          <div className="flex items-center gap-4 rounded-[22px] border bg-card p-5">
            <Ring value={checkRate} size={82} stroke={9} color={CYAN}>
              <span className="font-display text-base font-extrabold">{checkRate}%</span>
            </Ring>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Check-ups done
              </p>
              <p className="font-display text-3xl font-extrabold tabular-nums">
                <Counter value={k.checkupsDone} />
              </p>
              <p className="text-xs text-muted-foreground">of {k.checkupsTotal} scheduled</p>
            </div>
          </div>
        </Reveal>
        {[
          [
            'Average BMI',
            k.averageBmi.toFixed(1),
            Activity,
            'from-teal-500 to-emerald-400',
            'Healthy range 18.5–25',
          ],
          [
            'Visits this month',
            `${k.visitsMonth}`,
            Stethoscope,
            'from-[#05286e] to-[#0abfff]',
            `${k.visitsWeek} in the last 7 days`,
          ],
          [
            'Allergy alerts',
            `${k.allergyAlerts}`,
            AlertTriangle,
            'from-rose-500 to-orange-400',
            `${k.overdue} vaccinations overdue`,
          ],
        ].map(([label, value, Icon, grad, note], i) => {
          const I = Icon as LucideIcon;
          return (
            <Reveal key={label as string} delay={(i + 1) * 80}>
              <div className="relative overflow-hidden rounded-[22px] border bg-card p-5">
                <span
                  className={cn(
                    'flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-lg',
                    grad as string
                  )}
                >
                  <I className="h-5 w-5" />
                </span>
                <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {label as string}
                </p>
                <p className="font-display text-3xl font-extrabold">{value as string}</p>
                <p className="text-xs text-muted-foreground">{note as string}</p>
                <div
                  className={cn(
                    'absolute -right-8 -top-8 h-28 w-28 rounded-full bg-gradient-to-br opacity-10 blur-xl',
                    grad as string
                  )}
                />
              </div>
            </Reveal>
          );
        })}
      </div>

      {/* Trend + today */}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Reveal>
          <SectionCard
            title="Sick-room visits · last 30 days"
            subtitle="Illness, injuries and routine visits per day"
          >
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={h.trend}
                  margin={{ top: 10, right: 6, left: -18, bottom: 0 }}
                  barCategoryGap="22%"
                >
                  <CartesianGrid
                    strokeDasharray="3 6"
                    vertical={false}
                    stroke="hsl(var(--border))"
                  />
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    fontSize={11}
                    interval={4}
                  />
                  <YAxis tickLine={false} axisLine={false} fontSize={11} allowDecimals={false} />
                  <Tooltip content={<ChartTip />} cursor={{ fill: 'hsl(var(--muted))' }} />
                  <Bar
                    dataKey="illness"
                    name="Illness"
                    stackId="v"
                    fill={TEAL}
                    animationDuration={1200}
                  />
                  <Bar
                    dataKey="injury"
                    name="Injury"
                    stackId="v"
                    fill={ROSE}
                    animationDuration={1400}
                  />
                  <Bar
                    dataKey="other"
                    name="Routine & other"
                    stackId="v"
                    fill={CYAN}
                    radius={[6, 6, 0, 0]}
                    animationDuration={1600}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </SectionCard>
        </Reveal>
        <Reveal delay={100}>
          <SectionCard
            title="Today’s sick room"
            subtitle={`${k.visitsToday} visit${k.visitsToday === 1 ? '' : 's'} so far`}
            action={
              <Link
                href="/health/visits"
                className="text-sm font-semibold text-primary hover:underline"
              >
                All visits
              </Link>
            }
          >
            <ul className="space-y-2.5">
              {h.today.map((v, i) => {
                const st =
                  STATUS[
                    v.status === 'in_progress' ? 'in_progress' : (v.outcome ?? 'returned_to_class')
                  ] ?? STATUS.returned_to_class;
                const I = complaintIcon(v.complaint);
                return (
                  <li
                    key={v._id}
                    className="flex items-center gap-3 rounded-2xl border p-2.5 animate-[club-fade-up_0.5s_both]"
                    style={{ animationDelay: `${i * 70}ms` }}
                  >
                    <span className="relative">
                      {v.photo ? (
                        <img src={v.photo} alt="" className="h-11 w-11 rounded-full object-cover" />
                      ) : (
                        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-muted font-bold">
                          {v.name[0]}
                        </span>
                      )}
                      <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-card shadow ring-1 ring-border">
                        <I className="h-3 w-3 text-teal-600" />
                      </span>
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{v.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {v.complaint} · {time(v.time)}
                      </p>
                    </div>
                    <span
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold',
                        st.cls
                      )}
                    >
                      {st.live && (
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-rose-500" />
                      )}
                      {st.label}
                    </span>
                  </li>
                );
              })}
              {!h.today.length && (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  A quiet day — no visits yet.
                </p>
              )}
            </ul>
          </SectionCard>
        </Reveal>
      </div>

      {/* Complaints + BMI + vision */}
      <div className="grid gap-5 lg:grid-cols-3">
        <Reveal>
          <SectionCard title="Top complaints" subtitle="Last 30 days">
            <ul className="space-y-3">
              {h.complaints.map((c, i) => {
                const I = complaintIcon(c.name);
                const max = h.complaints[0]?.value || 1;
                return (
                  <li key={c.name}>
                    <div className="mb-1 flex items-center gap-2 text-sm">
                      <I className="h-4 w-4 text-teal-600" />
                      <span className="flex-1 truncate font-medium">{c.name}</span>
                      <span className="font-bold tabular-nums">{c.value}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full origin-left rounded-full bg-gradient-to-r from-teal-500 to-cyan-400 animate-[club-progress_1.2s_cubic-bezier(.2,.8,.2,1)_both]"
                        style={{
                          width: `${(c.value / max) * 100}%`,
                          animationDelay: `${i * 90}ms`,
                        }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </SectionCard>
        </Reveal>
        <Reveal delay={80}>
          <SectionCard title="BMI at check-ups" subtitle={`${k.checkupsDone} students measured`}>
            <div className="relative h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={h.bmiBands}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={62}
                    outerRadius={92}
                    paddingAngle={3}
                    cornerRadius={8}
                    animationDuration={1500}
                    stroke="none"
                  >
                    {h.bmiBands.map((_, i) => (
                      <Cell key={i} fill={bmiColors[i]} />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <p className="font-display text-3xl font-extrabold">{k.averageBmi.toFixed(1)}</p>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Average BMI
                </p>
              </div>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-1.5 text-xs">
              {h.bmiBands.map((b, i) => (
                <span key={b.name} className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: bmiColors[i] }} />
                  {b.name} <b className="ml-auto tabular-nums">{b.value}</b>
                </span>
              ))}
            </div>
          </SectionCard>
        </Reveal>
        <Reveal delay={160}>
          <SectionCard title="How visits end" subtitle="Outcomes this month">
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={h.outcomes}
                  layout="vertical"
                  margin={{ top: 0, right: 36, left: 0, bottom: 0 }}
                >
                  <XAxis type="number" hide />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={118}
                    tickLine={false}
                    axisLine={false}
                    fontSize={12}
                    className="capitalize"
                  />
                  <Tooltip content={<ChartTip />} cursor={{ fill: 'hsl(var(--muted))' }} />
                  <Bar
                    dataKey="value"
                    name="Visits"
                    radius={10}
                    barSize={18}
                    animationDuration={1500}
                  >
                    {h.outcomes.map((o, i) => (
                      <Cell
                        key={i}
                        fill={
                          /sent home/.test(o.name) ? AMBER : /refer/.test(o.name) ? '#8b5cf6' : TEAL
                        }
                      />
                    ))}
                    <LabelList
                      dataKey="value"
                      position="right"
                      className="fill-foreground text-xs font-bold"
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </SectionCard>
        </Reveal>
      </div>

      {/* Vaccines + due */}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Reveal>
          <SectionCard title="Vaccine coverage" subtitle="Doses given against doses planned">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {h.coverage.map((c, i) => (
                <div
                  key={c.name}
                  className="flex flex-col items-center rounded-2xl border p-4 text-center animate-[club-fade-up_0.5s_both]"
                  style={{ animationDelay: `${i * 70}ms` }}
                >
                  <Ring
                    value={c.rate}
                    size={92}
                    stroke={9}
                    color={c.rate >= 75 ? TEAL : c.rate >= 55 ? AMBER : ROSE}
                  >
                    <span className="font-display text-lg font-extrabold">{c.rate}%</span>
                  </Ring>
                  <p className="mt-2 text-sm font-semibold">{c.name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {c.completed} of {c.total} doses
                  </p>
                </div>
              ))}
            </div>
          </SectionCard>
        </Reveal>
        <Reveal delay={100}>
          <SectionCard
            title="Vaccinations due"
            subtitle="Next doses and anything overdue"
            action={<ShieldCheck className="h-5 w-5 text-teal-500" />}
          >
            <ul className="space-y-2.5">
              {h.dueSoon.map((v) => (
                <li
                  key={v._id}
                  className={cn(
                    'flex items-center gap-3 rounded-2xl border p-2.5',
                    v.overdue && 'border-rose-500/30 bg-rose-500/5'
                  )}
                >
                  {v.photo ? (
                    <img src={v.photo} alt="" className="h-10 w-10 rounded-full object-cover" />
                  ) : (
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-muted font-bold">
                      {v.name[0]}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{v.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{v.vaccine}</p>
                  </div>
                  <span
                    className={cn(
                      'rounded-full px-2.5 py-1 text-[11px] font-semibold',
                      v.overdue
                        ? 'bg-rose-500/15 text-rose-600'
                        : 'bg-teal-500/10 text-teal-700 dark:text-teal-300'
                    )}
                  >
                    {v.overdue
                      ? 'Overdue'
                      : new Date(v.date).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                        })}
                  </span>
                </li>
              ))}
              {!h.dueSoon.length && (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Everyone is up to date.
                </p>
              )}
            </ul>
          </SectionCard>
        </Reveal>
      </div>

      {/* Explore */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {links.map(([label, href, Icon], i) => (
          <Reveal key={href} delay={i * 50}>
            <Link
              href={href}
              className="group flex items-center gap-3 rounded-2xl border bg-card p-4 transition hover:-translate-y-0.5 hover:border-teal-500/40 hover:shadow-md"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-[#05286e] text-white transition-transform group-hover:rotate-6">
                <Icon className="h-5 w-5" />
              </span>
              <span className="flex-1 font-semibold">{label}</span>
              <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </Link>
          </Reveal>
        ))}
      </div>
      <p className="pb-2 text-center text-[11px] text-muted-foreground">
        Health information is visible only to people with health permissions.
      </p>
    </div>
  );
}
