'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ArrowRight,
  BarChart3,
  Bot,
  Briefcase,
  Building2,
  CalendarClock,
  Crown,
  FileText,
  GraduationCap,
  Handshake,
  IndianRupee,
  Loader2,
  Medal,
  Rocket,
  Sparkles,
  Trophy,
  UserCheck,
  Users,
} from 'lucide-react';
import { careerConnectApi, type CareerHub } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/authStore';
import { usePermissions } from '@/hooks/usePermissions';
import { Reveal, Tilt } from '@/components/clubs/clubVisuals';
import {
  ChartTip,
  CompanyLogo,
  Counter,
  PremiumBadge,
  Ring,
  SectionCard,
  Stage,
  lpa,
} from '@/components/connect/premium';

const CYAN = '#0abfff';
const NAVY = '#05286e';
const GOLD = '#f5b301';

/** Offer cards that slide in one after another, like a live feed. */
function LiveOffers({ offers }: { offers: CareerHub['recentPlacements'] }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (offers.length < 2) return;
    const t = setInterval(() => setI((v) => (v + 1) % offers.length), 2400);
    return () => clearInterval(t);
  }, [offers.length]);
  if (!offers.length) return null;
  const shown = [0, 1, 2].map((k) => offers[(i + k) % offers.length]);
  return (
    <div className="relative h-[250px] w-full max-w-[380px]">
      {shown.map((o, k) => (
        <div
          key={`${i}-${k}`}
          className="absolute inset-x-0 animate-[club-fade-up_0.6s_cubic-bezier(.2,.8,.2,1)_both]"
          style={{
            top: k * 78,
            opacity: 1 - k * 0.28,
            transform: `scale(${1 - k * 0.04})`,
            zIndex: 3 - k,
          }}
        >
          <div className="flex items-center gap-3 rounded-2xl bg-white/95 p-3 text-slate-900 shadow-2xl ring-1 ring-white/50">
            <span className="relative">
              {o.photo ? (
                <img src={o.photo} alt="" className="h-12 w-12 rounded-full object-cover" />
              ) : (
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-200 font-bold">
                  {o.name[0]}
                </span>
              )}
              <CompanyLogo
                name={o.company}
                website={o.website}
                size={24}
                className="absolute -bottom-1 -right-1 !rounded-lg ring-2 ring-white"
              />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold">{o.name}</p>
              <p className="truncate text-[11px] text-slate-500">{o.program}</p>
              <p className="truncate text-xs font-semibold text-[#05286e]">
                {o.company} · {o.role}
              </p>
            </div>
            <span
              className={cn(
                'rounded-full px-2.5 py-1 text-xs font-extrabold tabular-nums',
                o.ctc >= 800000
                  ? 'bg-gradient-to-r from-amber-300 to-yellow-200 text-amber-950'
                  : 'bg-[#0abfff]/15 text-[#05286e]'
              )}
            >
              {lpa(o.ctc)}
            </span>
          </div>
        </div>
      ))}
      <p className="absolute -top-8 left-0 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/70">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
        </span>
        Live offers
      </p>
    </div>
  );
}

function LogoMarquee({
  recruiters,
  reverse,
}: {
  recruiters: CareerHub['recruiters'];
  reverse?: boolean;
}) {
  const loop = [...recruiters, ...recruiters];
  return (
    <div className="overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_8%,black_92%,transparent)]">
      <div
        className="flex w-max gap-4 animate-[club-marquee_45s_linear_infinite]"
        style={reverse ? { animationDirection: 'reverse' } : undefined}
      >
        {loop.map((r, i) => (
          <div
            key={i}
            className="group flex items-center gap-3 rounded-2xl border bg-card px-4 py-2.5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <CompanyLogo
              name={r.name}
              website={r.website}
              size={36}
              className="grayscale transition group-hover:grayscale-0"
            />
            <div>
              <p className="text-sm font-bold leading-tight">{r.name}</p>
              <p className="text-[11px] text-muted-foreground">
                {r.accepted ? `${r.accepted} hired` : r.industry}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Funnel({ steps }: { steps: CareerHub['funnel'] }) {
  const max = Math.max(1, ...steps.map((s) => s.count));
  const [on, setOn] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setOn(true), 200);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="space-y-2.5">
      {steps.map((s, i) => {
        const w = Math.max(14, (s.count / max) * 100);
        return (
          <div key={s.stage} className="flex items-center gap-3">
            <span className="w-32 shrink-0 text-right text-xs font-medium text-muted-foreground">
              {s.stage}
            </span>
            <div className="relative h-9 flex-1">
              <div
                className="absolute left-1/2 top-0 flex h-full -translate-x-1/2 items-center justify-center rounded-xl text-sm font-bold text-white shadow-md"
                style={{
                  width: on ? `${w}%` : '6%',
                  transition: `width 1.1s cubic-bezier(.2,.8,.2,1) ${i * 120}ms`,
                  background: `linear-gradient(90deg, ${NAVY}, ${i === steps.length - 1 ? GOLD : CYAN})`,
                }}
              >
                <Counter value={s.count} delay={200 + i * 120} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

const daysLeft = (d: string) => Math.ceil((+new Date(d) - Date.now()) / 86_400_000);

export default function CareerConnectHome() {
  const org =
    (useAuthStore((s) => s.user?.tenant) as { name?: string } | undefined)?.name ?? 'Your campus';
  const { hasPermission } = usePermissions();
  const q = useQuery({
    queryKey: ['career-hub'],
    queryFn: () => careerConnectApi.getHub().then((r) => r.data),
  });
  const h = q.data;
  const recruiters = useMemo(() => (h?.recruiters ?? []).filter((r) => r.website || r.offers), [h]);

  if (q.isLoading || !h) {
    return (
      <div className="flex h-72 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  const k = h.kpis;
  const ring = [...recruiters].slice(0, 10);
  const links = [
    ['Placement drives', '/career-connect/drives', GraduationCap, 'careerConnect.drives'],
    ['Companies', '/career-connect/companies', Building2, 'careerConnect.companies'],
    ['Job board', '/career-connect/job-board', FileText, 'careerConnect.jobBoard'],
    [
      'Student profiles',
      '/career-connect/student-profile',
      UserCheck,
      'careerConnect.studentProfiles',
    ],
    [
      'Virtual Placement Office',
      '/career-connect/virtual-placement-office',
      Bot,
      'careerConnect.drives',
    ],
    ['Alumni network', '/career-connect/alumni/directory', Handshake, 'careerConnect.alumni'],
    ['Reports', '/career-connect/reports', BarChart3, 'careerConnect.reports'],
  ] as const;

  return (
    <div className="space-y-7">
      {/* Hero */}
      <Stage glow={[CYAN, '#f5b301']} className="animate-[club-fade-up_0.6s_both]">
        <div className="pointer-events-none absolute -right-24 top-1/2 hidden h-[520px] w-[520px] -translate-y-1/2 lg:block">
          <div className="absolute inset-0 rounded-full border border-white/10 animate-[club-spin_70s_linear_infinite]">
            {ring.map((r, i) => {
              const a = (i / ring.length) * Math.PI * 2;
              return (
                <span
                  key={r.name}
                  className="absolute left-1/2 top-1/2"
                  style={{
                    transform: `translate(calc(${Math.cos(a) * 260}px - 50%), calc(${Math.sin(a) * 260}px - 50%))`,
                  }}
                >
                  <span className="block animate-[club-spin-rev_70s_linear_infinite]">
                    <CompanyLogo
                      name={r.name}
                      website={r.website}
                      size={46}
                      className="opacity-90 shadow-[0_0_24px_rgba(10,191,255,0.35)]"
                    />
                  </span>
                </span>
              );
            })}
          </div>
        </div>
        <div className="relative grid gap-10 px-6 py-10 sm:px-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
          <div>
            <div className="flex flex-wrap items-center gap-2 animate-[club-fade-up_0.5s_both]">
              <PremiumBadge label="Career Connect" />
              <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/60">
                Placement season 2026–27 · {org}
              </span>
            </div>
            <h1 className="mt-5 font-display text-5xl font-extrabold leading-[1.02] tracking-tight sm:text-6xl">
              <span className="club-gradient-text">
                <Counter value={k.placed} duration={1600} />
              </span>{' '}
              {'students placed.'.split(' ').map((w, i) => (
                <span
                  key={i}
                  className="mr-[0.22em] inline-block animate-[club-letter_0.8s_cubic-bezier(.2,.8,.2,1)_both]"
                  style={{ animationDelay: `${300 + i * 110}ms` }}
                >
                  {w}
                </span>
              ))}
            </h1>
            <p className="mt-4 max-w-xl text-lg text-white/80 animate-[club-fade-up_0.6s_0.5s_both]">
              {k.offers} offers from {k.companies} recruiters — a highest package of{' '}
              <b className="text-amber-300">{lpa(k.highestCtc)}</b> and an average of{' '}
              <b className="text-white">{lpa(k.averageCtc)}</b>.
            </p>
            <div className="mt-7 grid max-w-xl grid-cols-3 gap-3 animate-[club-fade-up_0.6s_0.7s_both]">
              {[
                ['Highest', lpa(k.highestCtc), Crown],
                ['Median', lpa(k.medianCtc), IndianRupee],
                ['Placement rate', `${k.placementRate}%`, Rocket],
              ].map(([label, value, Icon]) => {
                const I = Icon as typeof Crown;
                return (
                  <div
                    key={label as string}
                    className="rounded-2xl bg-white/10 p-3 ring-1 ring-white/15 backdrop-blur"
                  >
                    <I className="h-4 w-4 text-amber-300" />
                    <p className="mt-1.5 font-display text-xl font-extrabold">{value as string}</p>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/55">
                      {label as string}
                    </p>
                  </div>
                );
              })}
            </div>
            <div className="mt-7 flex flex-wrap gap-3 animate-[club-fade-up_0.6s_0.9s_both]">
              <Link
                href="/career-connect/drives"
                className="group inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-bold text-[#05286e] shadow-[0_0_30px_rgba(10,191,255,0.4)] transition hover:scale-[1.03]"
              >
                Placement drives{' '}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link
                href="/career-connect/student-profile"
                className="inline-flex items-center gap-2 rounded-full bg-white/10 px-5 py-2.5 text-sm font-semibold ring-1 ring-white/25 backdrop-blur transition hover:bg-white/20"
              >
                Student profiles
              </Link>
            </div>
          </div>
          <div className="relative flex items-center justify-center pt-8 lg:justify-start lg:pl-6">
            <LiveOffers offers={h.recentPlacements} />
          </div>
        </div>
      </Stage>

      {/* Recruiters */}
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Recruiting from {org}
        </p>
        <LogoMarquee recruiters={recruiters} />
        <LogoMarquee recruiters={[...recruiters].reverse()} reverse />
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Reveal>
          <div className="flex items-center gap-4 rounded-[22px] border bg-card p-5">
            <Ring value={k.placementRate} size={86} stroke={9} color={CYAN}>
              <span className="font-display text-lg font-extrabold">{k.placementRate}%</span>
            </Ring>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Students placed
              </p>
              <p className="font-display text-3xl font-extrabold tabular-nums">
                <Counter value={k.placed} />
              </p>
              <p className="text-xs text-muted-foreground">of {k.registered} who registered</p>
            </div>
          </div>
        </Reveal>
        {[
          [
            'Highest package',
            lpa(k.highestCtc),
            Crown,
            'from-amber-400 to-yellow-300',
            k.highestCtc,
          ],
          [
            'Average package',
            lpa(k.averageCtc),
            IndianRupee,
            'from-[#05286e] to-[#0abfff]',
            k.averageCtc,
          ],
          ['Offers made', `${k.offers}`, Trophy, 'from-violet-600 to-fuchsia-500', k.offers],
        ].map(([label, value, Icon, grad], i) => {
          const I = Icon as typeof Crown;
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

      {/* Season + funnel */}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Reveal>
          <SectionCard
            title="The season so far"
            subtitle="Offers made and accepted, week by week"
          >
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={h.timeline} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="cc-offers" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={CYAN} stopOpacity={0.45} />
                      <stop offset="100%" stopColor={CYAN} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="cc-acc" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={NAVY} stopOpacity={0.5} />
                      <stop offset="100%" stopColor={NAVY} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 6"
                    vertical={false}
                    stroke="hsl(var(--border))"
                  />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={12} />
                  <YAxis tickLine={false} axisLine={false} fontSize={12} allowDecimals={false} />
                  <Tooltip content={<ChartTip />} />
                  <Area
                    type="monotone"
                    dataKey="offers"
                    name="Offers"
                    stroke={CYAN}
                    strokeWidth={3}
                    fill="url(#cc-offers)"
                    animationDuration={1600}
                  />
                  <Area
                    type="monotone"
                    dataKey="accepted"
                    name="Accepted"
                    stroke={NAVY}
                    strokeWidth={3}
                    fill="url(#cc-acc)"
                    animationDuration={1900}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </SectionCard>
        </Reveal>
        <Reveal delay={100}>
          <SectionCard title="Selection funnel" subtitle="Every round, across all drives">
            <Funnel steps={h.funnel} />
          </SectionCard>
        </Reveal>
      </div>

      {/* Departments + bands */}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Reveal>
          <SectionCard
            title="Department-wise placements"
            subtitle="Placed vs registered — with placement rate"
          >
            <div style={{ height: Math.max(220, Math.min(10, h.departments.length) * 44) }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={h.departments.slice(0, 10)}
                  layout="vertical"
                  margin={{ top: 0, right: 48, left: 10, bottom: 0 }}
                  barGap={-18}
                >
                  <XAxis type="number" hide />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={190}
                    tickLine={false}
                    axisLine={false}
                    fontSize={12}
                  />
                  <Tooltip content={<ChartTip />} cursor={{ fill: 'hsl(var(--muted))' }} />
                  <Bar
                    dataKey="registered"
                    name="Registered"
                    fill="hsl(var(--muted))"
                    radius={10}
                    barSize={18}
                    animationDuration={1200}
                  />
                  <Bar
                    dataKey="placed"
                    name="Placed"
                    radius={10}
                    barSize={18}
                    animationDuration={1600}
                  >
                    {h.departments.slice(0, 10).map((d, i) => (
                      <Cell key={i} fill={d.rate >= 30 ? CYAN : NAVY} />
                    ))}
                    <LabelList
                      dataKey="rate"
                      position="right"
                      formatter={(v: number) => `${v}%`}
                      className="fill-foreground text-xs font-bold"
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </SectionCard>
        </Reveal>
        <Reveal delay={100}>
          <SectionCard title="Package bands" subtitle="Accepted offers by CTC">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={h.ctcBands} margin={{ top: 20, right: 0, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="cc-band" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={CYAN} />
                      <stop offset="100%" stopColor={NAVY} />
                    </linearGradient>
                    <linearGradient id="cc-gold" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#fde047" />
                      <stop offset="100%" stopColor="#d97706" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 6"
                    vertical={false}
                    stroke="hsl(var(--border))"
                  />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} />
                  <YAxis tickLine={false} axisLine={false} fontSize={12} allowDecimals={false} />
                  <Tooltip content={<ChartTip />} cursor={{ fill: 'hsl(var(--muted))' }} />
                  <Bar
                    dataKey="count"
                    name="Students"
                    radius={[10, 10, 4, 4]}
                    animationDuration={1500}
                  >
                    {h.ctcBands.map((b, i) => (
                      <Cell key={i} fill={i >= 3 ? 'url(#cc-gold)' : 'url(#cc-band)'} />
                    ))}
                    <LabelList
                      dataKey="count"
                      position="top"
                      className="fill-foreground text-xs font-bold"
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </SectionCard>
        </Reveal>
      </div>

      {/* Wall of fame */}
      <Reveal>
        <SectionCard
          title="Wall of fame"
          subtitle="The season’s best offers"
          action={<Sparkles className="h-5 w-5 text-amber-400" />}
        >
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {h.recentPlacements.slice(0, 8).map((p, i) => (
              <Reveal key={`${p.name}${i}`} delay={i * 60}>
                <Tilt className="group rounded-[20px]">
                  <div className="relative overflow-hidden rounded-[20px] border bg-gradient-to-br from-card to-muted/40 p-4">
                    <div className="flex items-center gap-3">
                      <span className="relative">
                        {p.photo ? (
                          <img
                            src={p.photo}
                            alt=""
                            className="h-16 w-16 rounded-2xl object-cover shadow-md"
                          />
                        ) : (
                          <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted font-bold">
                            {p.name[0]}
                          </span>
                        )}
                        <CompanyLogo
                          name={p.company}
                          website={p.website}
                          size={30}
                          className="absolute -bottom-2 -right-2 !rounded-xl ring-2 ring-card"
                        />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-bold">{p.name}</p>
                        <p className="truncate text-xs text-muted-foreground">{p.program}</p>
                      </div>
                    </div>
                    <div className="mt-4 flex items-end justify-between">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{p.company}</p>
                        <p className="truncate text-xs text-muted-foreground">{p.role}</p>
                      </div>
                      <span
                        className={cn(
                          'shrink-0 rounded-full px-3 py-1 text-sm font-extrabold',
                          p.ctc >= 800000
                            ? 'bg-gradient-to-r from-amber-300 to-yellow-200 text-amber-950 shadow-[0_0_18px_rgba(251,191,36,0.5)]'
                            : 'bg-primary text-primary-foreground'
                        )}
                      >
                        {lpa(p.ctc)}
                      </span>
                    </div>
                    <span className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-white/50 to-transparent opacity-0 group-hover:animate-[club-shine_1.1s_ease-out] group-hover:opacity-100" />
                  </div>
                </Tilt>
              </Reveal>
            ))}
          </div>
        </SectionCard>
      </Reveal>

      {/* Leaderboard + upcoming */}
      <div className="grid gap-5 lg:grid-cols-2">
        <Reveal>
          <SectionCard title="Top recruiters" subtitle="By students hired this season">
            <ol className="space-y-2">
              {recruiters
                .filter((r) => r.accepted)
                .slice(0, 8)
                .map((r, i) => (
                  <li
                    key={r.name}
                    className="flex items-center gap-3 rounded-2xl p-2 transition hover:bg-muted/60"
                  >
                    <span
                      className={cn(
                        'flex h-8 w-8 items-center justify-center rounded-full text-sm font-extrabold',
                        i === 0
                          ? 'bg-gradient-to-br from-amber-300 to-yellow-500 text-amber-950'
                          : i === 1
                            ? 'bg-gradient-to-br from-slate-200 to-slate-400 text-slate-800'
                            : i === 2
                              ? 'bg-gradient-to-br from-orange-300 to-amber-700 text-white'
                              : 'bg-muted text-muted-foreground'
                      )}
                    >
                      {i < 3 ? <Medal className="h-4 w-4" /> : i + 1}
                    </span>
                    <CompanyLogo name={r.name} website={r.website} size={38} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{r.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{r.industry}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-display text-lg font-extrabold tabular-nums">
                        {r.accepted}
                      </p>
                      <p className="text-[11px] text-muted-foreground">up to {lpa(r.topCtc)}</p>
                    </div>
                  </li>
                ))}
            </ol>
          </SectionCard>
        </Reveal>
        <Reveal delay={100}>
          <SectionCard title="Drives in motion" subtitle="Open for registration or mid-interviews">
            <div className="space-y-3">
              {h.upcoming.map((d) => {
                const left = daysLeft(d.deadline);
                return (
                  <Link
                    key={d._id}
                    href={`/career-connect/drives/${d._id}`}
                    className="group flex items-center gap-4 rounded-2xl border p-3 transition hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <CompanyLogo name={d.company} website={d.website} size={48} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">
                        {d.company} · {d.role}
                      </p>
                      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <CalendarClock className="h-3.5 w-3.5" />
                        {d.status === 'in_progress'
                          ? 'Interviews in progress'
                          : left > 0
                            ? `Registration closes in ${left} day${left === 1 ? '' : 's'}`
                            : 'Registration closing'}
                      </p>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-[#05286e] to-[#0abfff]"
                          style={{ width: `${Math.min(100, d.registered)}%` }}
                        />
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-display font-extrabold">{lpa(d.ctc)}</p>
                      <p className="flex items-center justify-end gap-1 text-[11px] text-muted-foreground">
                        <Users className="h-3 w-3" /> {d.registered}
                      </p>
                    </div>
                  </Link>
                );
              })}
              {!h.upcoming.length && (
                <p className="text-sm text-muted-foreground">No open drives right now.</p>
              )}
            </div>
          </SectionCard>
        </Reveal>
      </div>

      {/* Alumni */}
      {h.alumni.length > 0 && (
        <Reveal>
          <SectionCard
            title="Alumni spotlight"
            subtitle="Where Marian graduates are building careers"
          >
            <div className="flex gap-4 overflow-x-auto pb-2">
              {h.alumni.map((a, i) => (
                <div
                  key={i}
                  className="w-48 shrink-0 rounded-2xl border bg-gradient-to-b from-muted/40 to-card p-4 text-center"
                >
                  {a.photo ? (
                    <img
                      src={a.photo}
                      alt=""
                      className="mx-auto h-16 w-16 rounded-full object-cover ring-4 ring-[#0abfff]/20"
                    />
                  ) : (
                    <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-muted font-bold">
                      {a.name[0]}
                    </span>
                  )}
                  <p className="mt-2 truncate font-semibold">{a.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{a.role}</p>
                  <p className="mt-1 truncate text-xs font-bold text-primary">{a.company}</p>
                  {a.mentor && (
                    <span className="mt-2 inline-block rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
                      Mentors students
                    </span>
                  )}
                </div>
              ))}
            </div>
          </SectionCard>
        </Reveal>
      )}

      {/* Explore */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {links
          .filter(([, , , perm]) => hasPermission(perm, 'view'))
          .map(([label, href, Icon], i) => (
            <Reveal key={href} delay={i * 50}>
              <Link
                href={href}
                className="group flex items-center gap-3 rounded-2xl border bg-card p-4 transition hover:-translate-y-0.5 hover:border-[#0abfff]/40 hover:shadow-md"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#05286e] to-[#0abfff] text-white transition-transform group-hover:rotate-6">
                  <Icon className="h-5 w-5" />
                </span>
                <span className="flex-1 font-semibold">{label}</span>
                <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </Link>
            </Reveal>
          ))}
      </div>
      <p className="pb-2 text-center text-[11px] text-muted-foreground">
        <Briefcase className="mr-1 inline h-3 w-3" />
        Company logos are shown from each recruiter’s public website.
      </p>
    </div>
  );
}
