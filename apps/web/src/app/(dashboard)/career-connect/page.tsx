'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ArrowRight,
  Award,
  Briefcase,
  Building2,
  CalendarClock,
  GraduationCap,
  IndianRupee,
  Plus,
  TrendingUp,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { careerConnectApi } from '@/lib/api';
import { usePermissions } from '@/hooks/usePermissions';
import {
  ACCENT,
  ChartTip,
  CompanyLogo,
  Empty,
  Meter,
  PageTitle,
  Panel,
  PersonCell,
  Skeleton,
  Avatar,
  Faces,
  FeatureCard,
  FeatureNumber,
  MiniBars,
  Ring,
  Spark,
  StatusPill,
  fmtDate,
  lpa,
} from '@/components/connect/kit';

const BLUE = ACCENT.career.hex;
const daysLeft = (d: string) => Math.ceil((+new Date(d) - Date.now()) / 86_400_000);

export default function CareerConnectOverview() {
  const { hasPermission } = usePermissions();
  const q = useQuery({
    queryKey: ['career-hub'],
    queryFn: () => careerConnectApi.getHub().then((r) => r.data),
  });
  const h = q.data;

  if (!h) {
    return (
      <>
        <PageTitle title="Placements" description="Placement season at a glance." />
        <Panel>
          <Skeleton rows={8} />
        </Panel>
      </>
    );
  }
  const k = h.kpis;
  const funnel = h.funnel;
  const recruiters = h.recruiters.filter((r) => r.accepted).slice(0, 7);
  const maxHired = Math.max(1, ...recruiters.map((r) => r.accepted));

  return (
    <div className="space-y-6">
      <PageTitle
        title="Placement season 2026–27"
        description={`${k.placed} students placed with ${h.recruiters.filter((r) => r.accepted).length} recruiters so far. ${k.openDrives} drive${k.openDrives === 1 ? '' : 's'} still in progress.`}
        actions={
          <>
            <Button variant="outline" size="sm" asChild>
              <Link href="/career-connect/reports">Reports</Link>
            </Button>
            {hasPermission('careerConnect.drives', 'create') && (
              <Button size="sm" asChild>
                <Link href="/career-connect/drives/new">
                  <Plus className="mr-1.5 h-4 w-4" />
                  New drive
                </Link>
              </Button>
            )}
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <FeatureCard solid label="Students placed" icon={Users}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <FeatureNumber value={k.placed} />
              <p className="mt-1.5 text-xs text-white/75">of {k.registered} who registered</p>
            </div>
            <Ring value={k.placementRate} size={68} stroke={6} color="#fff" track="rgba(255,255,255,.2)">
              <span className="text-sm font-semibold tabular-nums">{k.placementRate}%</span>
            </Ring>
          </div>
          {h.recentPlacements.length > 0 && (
            <Link
              href={`/career-connect/student-profile/${h.recentPlacements[0].studentId}`}
              className="mt-auto flex items-center gap-2.5 rounded-xl bg-white/10 px-2.5 py-2 text-xs backdrop-blur transition hover:bg-white/15 [margin-top:1rem]"
            >
              <Faces people={h.recentPlacements.slice(0, 4)} max={4} size={24} />
              <span className="min-w-0 truncate text-white/85">
                Latest: <span className="font-semibold text-white">{h.recentPlacements[0].name.split(' ')[0]}</span> →{' '}
                {h.recentPlacements[0].company}
              </span>
            </Link>
          )}
        </FeatureCard>

        <FeatureCard label="Highest package" icon={TrendingUp}>
          <div className="flex items-start justify-between gap-3">
            <FeatureNumber value={k.highestCtc} format={lpa} />
            {h.topOffers[0] && (
              <CompanyLogo name={h.topOffers[0].company} website={h.topOffers[0].website} size={42} className="rounded-xl" />
            )}
          </div>
          {h.topOffers[0] && (
            <Link
              href={`/career-connect/student-profile/${h.topOffers[0].studentId}`}
              className="mt-auto flex items-center gap-2.5 rounded-xl bg-amber-50 px-2.5 py-2 transition hover:bg-amber-100/70 dark:bg-amber-500/10 [margin-top:1rem]"
            >
              <Avatar person={h.topOffers[0]} size={28} />
              <span className="min-w-0 text-xs leading-tight">
                <span className="block truncate font-semibold">{h.topOffers[0].name}</span>
                <span className="block truncate text-muted-foreground">
                  {h.topOffers[0].role} · {h.topOffers[0].company}
                </span>
              </span>
              <Award className="ml-auto h-4 w-4 shrink-0 text-amber-500" />
            </Link>
          )}
        </FeatureCard>

        <FeatureCard label="Offers made" icon={Award}>
          <div className="flex items-end justify-between gap-3">
            <FeatureNumber value={k.offers} />
            <Spark data={h.timeline.map((t) => t.offers)} color={BLUE} width={96} height={34} />
          </div>
          <div className="mt-auto [margin-top:1rem]">
            <div className="flex h-2 overflow-hidden rounded-full bg-muted">
              <span className="h-full bg-primary" style={{ width: `${k.offers ? (k.placed / k.offers) * 100 : 0}%` }} />
              <span className="h-full bg-primary/25" style={{ width: `${k.offers ? ((k.offers - k.placed) / k.offers) * 100 : 0}%` }} />
            </div>
            <p className="mt-2 flex justify-between text-xs text-muted-foreground">
              <span>
                <span className="font-semibold text-foreground">{k.placed}</span> accepted
              </span>
              <span>{k.offers - k.placed} pending or declined</span>
            </p>
          </div>
        </FeatureCard>

        <FeatureCard label="Average package" icon={IndianRupee}>
          <FeatureNumber value={k.averageCtc} format={lpa} />
          <p className="mt-1.5 text-xs text-muted-foreground">Median {lpa(k.medianCtc)}</p>
          <div className="mt-auto [margin-top:1rem]">
            <MiniBars data={h.ctcBands.map((b) => b.count)} color={BLUE} height={36} />
            <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
              <span>{h.ctcBands[0]?.label}</span>
              <span>{h.ctcBands[h.ctcBands.length - 1]?.label}</span>
            </div>
          </div>
        </FeatureCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Panel title="Offers through the season" description="Accepted offers each week">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={h.timeline} margin={{ top: 8, right: 4, left: -24, bottom: 0 }}>
                <defs>
                  <linearGradient id="cc-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={BLUE} stopOpacity={0.16} />
                    <stop offset="100%" stopColor={BLUE} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="2 4" />
                <XAxis
                  dataKey="month"
                  tickLine={false}
                  axisLine={false}
                  fontSize={11}
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  fontSize={11}
                  allowDecimals={false}
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                />
                <Tooltip content={<ChartTip />} cursor={{ stroke: 'hsl(var(--border))' }} />
                <Area
                  type="monotone"
                  dataKey="offers"
                  name="Offers"
                  stroke="hsl(var(--muted-foreground))"
                  strokeOpacity={0.35}
                  strokeWidth={1.5}
                  fill="none"
                  strokeDasharray="4 4"
                />
                <Area
                  type="monotone"
                  dataKey="accepted"
                  name="Accepted"
                  stroke={BLUE}
                  strokeWidth={2}
                  fill="url(#cc-fill)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel
          title="Recently placed"
          action={
            <Link
              href="/career-connect/student-profile"
              className="text-sm font-medium text-primary hover:underline"
            >
              All students
            </Link>
          }
          bodyClassName="px-0 pb-2"
        >
          <ul className="divide-y divide-border/60">
            {h.recentPlacements.slice(0, 6).map((o, i) => (
              <li key={i} className="flex items-center gap-3 px-5 py-2.5">
                <div className="min-w-0 flex-1">
                  <PersonCell
                    person={o}
                    href={`/career-connect/student-profile/${o.studentId}`}
                    sub={o.program}
                  />
                </div>
                <CompanyLogo name={o.company} website={o.website} size={28} />
                <span className="w-20 text-right text-sm font-semibold tabular-nums">
                  {lpa(o.ctc)}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Panel
          title="Placements by department"
          description="Students placed against those who registered"
          bodyClassName="px-0 pb-2"
        >
          <div className="divide-y divide-border/60">
            {h.departments.slice(0, 9).map((d) => (
              <div
                key={d.name}
                className="grid grid-cols-[minmax(0,1fr)_120px_70px_80px] items-center gap-4 px-5 py-2.5 text-sm"
              >
                <span className="truncate font-medium">{d.name}</span>
                <Meter value={d.rate} color={BLUE} />
                <span className="text-right tabular-nums text-muted-foreground">
                  {d.placed}/{d.registered}
                </span>
                <span className="text-right tabular-nums">
                  {d.averageCtc ? lpa(d.averageCtc) : '—'}
                </span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel
          title="Top recruiters"
          action={
            <Link
              href="/career-connect/companies"
              className="text-sm font-medium text-primary hover:underline"
            >
              All companies
            </Link>
          }
        >
          <ul className="space-y-3.5">
            {recruiters.map((r) => (
              <li key={r.name} className="flex items-center gap-3">
                <CompanyLogo name={r.name} website={r.website} size={32} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-sm font-medium">{r.name}</span>
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {r.accepted} hired
                    </span>
                  </div>
                  <Meter value={(r.accepted / maxHired) * 100} color={BLUE} className="mt-1.5" />
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Panel title="Selection funnel" description="Across all drives this season">
          <div className="grid grid-cols-5 gap-2">
            {funnel.map((f, i) => {
              const prev = funnel[i - 1]?.count;
              return (
                <div key={f.stage} className="rounded-xl bg-muted/50 p-3">
                  <p className="text-[11px] font-medium text-muted-foreground">{f.stage}</p>
                  <p className="mt-1 font-display text-xl font-semibold tabular-nums">
                    {f.count.toLocaleString('en-IN')}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {prev ? `${Math.round((f.count / prev) * 100)}% of previous` : 'Starting pool'}
                  </p>
                </div>
              );
            })}
          </div>
        </Panel>

        <Panel
          title="Drives in progress"
          action={
            <Link
              href="/career-connect/drives"
              className="text-sm font-medium text-primary hover:underline"
            >
              All drives
            </Link>
          }
          bodyClassName="px-0 pb-2"
        >
          {h.upcoming.length ? (
            <ul className="divide-y divide-border/60">
              {h.upcoming.map((d) => {
                const left = daysLeft(d.deadline);
                return (
                  <li key={d._id}>
                    <Link
                      href={`/career-connect/drives/${d._id}`}
                      className="flex items-center gap-3 px-5 py-3 hover:bg-muted/40"
                    >
                      <CompanyLogo name={d.company} website={d.website} size={36} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {d.company} · {d.role}
                        </p>
                        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <CalendarClock className="h-3.5 w-3.5" />
                          {d.status === 'in_progress'
                            ? 'Interviews under way'
                            : left > 0
                              ? `Registration closes in ${left} days`
                              : `Closed ${fmtDate(d.deadline)}`}
                          <span>· {d.registered} registered</span>
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold tabular-nums">{lpa(d.ctc)}</p>
                        <StatusPill status={d.status} />
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <Empty icon={Briefcase} title="No drives in progress" />
          )}
        </Panel>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Panel title="Highest offers" bodyClassName="px-0 pb-2">
          <ul className="divide-y divide-border/60">
            {h.topOffers.slice(0, 6).map((o, i) => (
              <li key={i} className="flex items-center gap-3 px-5 py-2.5">
                <span className="w-5 text-xs tabular-nums text-muted-foreground">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <PersonCell
                    person={o}
                    href={`/career-connect/student-profile/${o.studentId}`}
                    sub={`${o.company} · ${o.role}`}
                  />
                </div>
                <span className="text-sm font-semibold tabular-nums">{lpa(o.ctc)}</span>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel
          title="Alumni at work"
          action={
            <Link
              href="/career-connect/alumni/directory"
              className="text-sm font-medium text-primary hover:underline"
            >
              Alumni directory
            </Link>
          }
          bodyClassName="px-0 pb-2"
        >
          <ul className="divide-y divide-border/60">
            {h.alumni.slice(0, 6).map((a, i) => (
              <li key={i} className="flex items-center gap-3 px-5 py-2.5">
                <div className="min-w-0 flex-1">
                  <PersonCell person={a} sub={`${a.role} · ${a.company}`} />
                </div>
                <span className="text-xs text-muted-foreground">Class of {a.year}</span>
                {a.mentor && (
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                    Mentor
                  </span>
                )}
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          [
            'Placement drives',
            'Rounds, registrations and offers',
            '/career-connect/drives',
            GraduationCap,
          ],
          [
            'Companies',
            `${k.companies} recruiting partners`,
            '/career-connect/companies',
            Building2,
          ],
          [
            'Student profiles',
            'Skills, projects and readiness',
            '/career-connect/student-profile',
            Users,
          ],
        ].map(([title, text, href, Icon]) => {
          const I = Icon as typeof Users;
          return (
            <Link
              key={href as string}
              href={href as string}
              className="group flex items-center gap-3 rounded-xl border bg-card p-4 transition hover:border-border hover:shadow-sm"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">
                <I className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">{title as string}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {text as string}
                </span>
              </span>
              <ArrowRight className="h-4 w-4 text-muted-foreground transition group-hover:translate-x-0.5" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
