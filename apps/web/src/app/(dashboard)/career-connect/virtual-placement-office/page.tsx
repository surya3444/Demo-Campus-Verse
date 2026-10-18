'use client';

import { useMemo, useState } from 'react';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ArrowUpRight,
  Building2,
  Check,
  Globe2,
  GraduationCap,
  MapPin,
  Radio,
  Search,
  Send,
  Sparkles,
  X,
  Zap,
} from 'lucide-react';
import { careerConnectApi, type VpoFeed, type VpoJob } from '@/lib/api';
import { usePermissions } from '@/hooks/usePermissions';
import { cn } from '@/lib/utils';
import { CompanyLogo, Num, useDebounced } from '@/components/connect/kit';

type Mode = '' | 'onsite' | 'remote';
const LIMIT = 24;

const ago = (d?: string | null) => {
  if (!d) return '';
  const m = Math.max(1, Math.round((Date.now() - new Date(d).getTime()) / 60000));
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.round(h / 24);
  return days < 30 ? `${days}d ago` : new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};
const isNew = (d?: string | null) => !!d && Date.now() - new Date(d).getTime() < 48 * 3600_000;

const CATEGORY_TINT: Record<string, string> = {
  Engineering: '#1e4fd8',
  'Data & AI': '#7c3aed',
  Product: '#0891b2',
  Design: '#db2777',
  'Sales & Marketing': '#ea580c',
  'Business & Ops': '#0d9488',
  'Customer Success': '#65a30d',
  Internships: '#ca8a04',
  Other: '#64748b',
};

export default function VirtualPlacementOffice() {
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const canShare = hasPermission('careerConnect.jobBoard', 'create');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [city, setCity] = useState('');
  const [mode, setMode] = useState<Mode>('');
  const [fresher, setFresher] = useState(false);
  const q = useDebounced(search, 350);

  const filters = { search: q || undefined, category: category || undefined, city: city || undefined, fresher: fresher || undefined, remote: mode === '' ? undefined : mode === 'remote' };
  const feed = useInfiniteQuery({
    queryKey: ['vpo-jobs', filters],
    queryFn: ({ pageParam }) =>
      careerConnectApi.getVpoJobs({ ...filters, page: pageParam, limit: LIMIT }).then((r) => r.data),
    initialPageParam: 1,
    getNextPageParam: (last: VpoFeed) => (last.page * last.limit < last.total ? last.page + 1 : undefined),
    placeholderData: (prev) => prev,
    staleTime: 5 * 60_000,
  });
  const first = feed.data?.pages[0];
  const jobs = useMemo(() => feed.data?.pages.flatMap((p) => p.jobs) ?? [], [feed.data]);

  const share = useMutation({
    mutationFn: (id: string) => careerConnectApi.shareVpoJob(id).then((r) => r.data),
    onSuccess: (r) => {
      queryClient.invalidateQueries({ queryKey: ['vpo-jobs'] });
      queryClient.invalidateQueries({ queryKey: ['job-postings'] });
      toast.success(r.alreadyShared ? 'Already on the campus job board' : 'Posted to the campus job board', {
        action: { label: 'View', onClick: () => (window.location.href = `/career-connect/job-board/${r._id}`) },
      });
    },
    onError: () => toast.error('Could not share this opening'),
  });

  const activeFilters = [
    category && { label: category, clear: () => setCategory('') },
    city && { label: city, clear: () => setCity('') },
    mode && { label: mode === 'remote' ? 'Remote' : 'On-site', clear: () => setMode('') },
    fresher && { label: 'Fresher-friendly', clear: () => setFresher(false) },
    q && { label: `“${q}”`, clear: () => setSearch('') },
  ].filter(Boolean) as Array<{ label: string; clear: () => void }>;

  return (
    <div className="space-y-6">
      <style>{CSS}</style>

      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden rounded-3xl bg-[#06163f] text-white shadow-[0_30px_80px_-30px_rgba(6,22,63,0.7)]">
        <div className="vpo-grid pointer-events-none absolute inset-0 opacity-[0.18]" />
        <div className="pointer-events-none absolute -left-32 -top-40 h-[28rem] w-[28rem] rounded-full bg-primary opacity-50 blur-[120px]" />
        <div className="pointer-events-none absolute -bottom-40 right-0 h-[26rem] w-[26rem] rounded-full bg-cyan-400 opacity-25 blur-[120px]" />
        <div className="vpo-scan pointer-events-none absolute inset-x-0 h-24 bg-gradient-to-b from-transparent via-cyan-300/10 to-transparent" />

        <div className="relative grid gap-8 p-6 sm:p-10 lg:grid-cols-[1.15fr_0.85fr]">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-200 backdrop-blur">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              </span>
              Live · {first ? `synced ${ago(first.updatedAt)}` : 'connecting'}
            </span>
            <h1 className="mt-5 font-display text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl">
              India is hiring.
              <br />
              <span className="vpo-gradient-text">
                {first ? <Num value={first.stats.total} /> : '—'} openings, live.
              </span>
            </h1>
            <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-blue-100/80">
              The Virtual Placement Office watches the career pages of {first?.stats.companies ?? 'hundreds of'} companies and
              India-friendly job boards, round the clock — and puts every opening in front of your students.
            </p>

            <div className="mt-7 flex items-center gap-3 rounded-xl border border-white/15 bg-white/10 p-1.5 pl-4 backdrop-blur-md focus-within:border-cyan-300/60 focus-within:bg-white/[0.14]">
              <Search className="h-5 w-5 shrink-0 text-blue-200" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search roles, companies or cities — try “data analyst”, “intern”, “Zscaler”"
                className="h-11 min-w-0 flex-1 bg-transparent text-[15px] text-white placeholder:text-blue-200/60 focus:outline-none"
              />
              {search && (
                <button onClick={() => setSearch('')} className="rounded-lg p-2 text-blue-200 hover:bg-white/10" aria-label="Clear search">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {[
                { label: 'Fresher-friendly', icon: GraduationCap, on: fresher, act: () => setFresher(!fresher) },
                { label: 'Internships', icon: Sparkles, on: category === 'Internships', act: () => setCategory(category === 'Internships' ? '' : 'Internships') },
                { label: 'Bengaluru', icon: MapPin, on: city === 'Bengaluru', act: () => setCity(city === 'Bengaluru' ? '' : 'Bengaluru') },
                { label: 'Remote', icon: Globe2, on: mode === 'remote', act: () => setMode(mode === 'remote' ? '' : 'remote') },
              ].map((c) => (
                <button
                  key={c.label}
                  onClick={c.act}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition',
                    c.on
                      ? 'border-cyan-300 bg-cyan-300 text-[#06163f]'
                      : 'border-white/15 bg-white/5 text-blue-100 hover:border-white/30 hover:bg-white/10'
                  )}
                >
                  <c.icon className="h-3.5 w-3.5" />
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Live wire */}
          <div className="relative hidden h-[22rem] overflow-hidden rounded-xl border border-white/10 bg-white/[0.06] backdrop-blur-md lg:block">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-blue-100">
                <Radio className="h-3.5 w-3.5 text-emerald-300" />
                Just in
              </span>
              <span className="text-[11px] text-blue-200/70">{first?.stats.newToday ?? 0} in the last 24h</span>
            </div>
            <div className="vpo-fade relative h-[calc(100%-45px)] overflow-hidden">
              {first ? (
                <div className="vpo-wire">
                  {[...first.jobs.slice(0, 12), ...first.jobs.slice(0, 12)].map((j, i) => (
                    <a
                      key={`${j.id}-${i}`}
                      href={j.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-3 px-4 py-2.5 transition hover:bg-white/5"
                    >
                      <CompanyLogo name={j.company} website={j.website} logo={j.logo} size={34} className="border-white/20" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-white">{j.title}</span>
                        <span className="block truncate text-xs text-blue-200/70">
                          {j.company} · {j.city ?? (j.remote ? 'Remote' : j.location)}
                        </span>
                      </span>
                      <span className="shrink-0 text-[11px] tabular-nums text-cyan-200/80">{ago(j.postedAt)}</span>
                    </a>
                  ))}
                </div>
              ) : (
                <Radar />
              )}
            </div>
          </div>
        </div>

        {/* Pulse numbers */}
        <div className="relative grid grid-cols-2 gap-px border-t border-white/10 bg-white/10 sm:grid-cols-5">
          {[
            { label: 'New in 24 hours', value: first?.stats.newToday, icon: Zap },
            { label: 'Fresher-friendly', value: first?.stats.fresher, icon: GraduationCap },
            { label: 'In Indian cities', value: first?.stats.inCities, icon: MapPin },
            { label: 'Remote, open to India', value: first?.stats.remote, icon: Globe2 },
            { label: 'Companies hiring', value: first?.stats.companies, icon: Building2 },
          ].map((s) => (
            <div key={s.label} className="bg-[#06163f]/90 px-5 py-4">
              <s.icon className="h-4 w-4 text-cyan-300" />
              <p className="mt-2 font-display text-2xl font-semibold tabular-nums">
                {s.value === undefined ? '—' : <Num value={s.value} />}
              </p>
              <p className="text-xs text-blue-200/70">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Company marquee */}
        {first && first.topCompanies.length > 0 && (
          <div className="vpo-fade-x relative overflow-hidden border-t border-white/10 py-4">
            <div className="vpo-marquee flex w-max gap-3">
              {[...first.topCompanies, ...first.topCompanies].map((c, i) => (
                <button
                  key={`${c.name}-${i}`}
                  onClick={() => setSearch(c.name)}
                  className="flex items-center gap-2.5 rounded-full border border-white/10 bg-white/5 py-1.5 pl-1.5 pr-3.5 text-sm text-blue-50 transition hover:border-cyan-300/50 hover:bg-white/10"
                >
                  <CompanyLogo name={c.name} website={c.website} logo={c.logo} size={26} className="rounded-full border-white/20" />
                  <span className="whitespace-nowrap font-medium">{c.name}</span>
                  <span className="rounded-full bg-cyan-300/15 px-1.5 text-[11px] tabular-nums text-cyan-200">{c.count}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* ── Feed ─────────────────────────────────────────────────────── */}
      <div className="grid gap-6 xl:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="space-y-5 xl:sticky xl:top-20 xl:self-start">
          <FilterBlock title="Role">
            {(first?.categories ?? []).map((c) => (
              <FacetRow
                key={c.name}
                label={c.name}
                count={c.count}
                max={first?.categories[0]?.count ?? 1}
                color={CATEGORY_TINT[c.name] ?? '#64748b'}
                on={category === c.name}
                onClick={() => setCategory(category === c.name ? '' : c.name)}
              />
            ))}
          </FilterBlock>
          <FilterBlock title="City">
            <div className="flex flex-wrap gap-1.5">
              {(first?.cities ?? []).map((c) => (
                <button
                  key={c.name}
                  onClick={() => setCity(city === c.name ? '' : c.name)}
                  className={cn(
                    'rounded-full border px-2.5 py-1 text-xs transition',
                    city === c.name
                      ? 'border-primary bg-primary text-white'
                      : 'border-border bg-card text-foreground hover:border-primary/40'
                  )}
                >
                  {c.name} <span className="tabular-nums opacity-60">{c.count}</span>
                </button>
              ))}
            </div>
          </FilterBlock>
          <FilterBlock title="Work mode">
            <div className="grid grid-cols-3 gap-1 rounded-lg bg-muted/60 p-0.5 text-xs">
              {([['', 'All'], ['onsite', 'On-site'], ['remote', 'Remote']] as const).map(([v, l]) => (
                <button
                  key={v}
                  onClick={() => setMode(v)}
                  className={cn('rounded-md py-1.5 font-medium text-muted-foreground', mode === v && 'bg-card text-foreground shadow-sm')}
                >
                  {l}
                </button>
              ))}
            </div>
            <label className="mt-3 flex cursor-pointer items-center justify-between rounded-lg border bg-card px-3 py-2.5 text-sm">
              <span className="flex items-center gap-2">
                <GraduationCap className="h-4 w-4 text-emerald-600" />
                Fresher-friendly only
              </span>
              <input type="checkbox" checked={fresher} onChange={(e) => setFresher(e.target.checked)} className="h-4 w-4 accent-primary" />
            </label>
          </FilterBlock>
          {first && (
            <FilterBlock title="Sources">
              <ul className="space-y-1.5 text-xs text-muted-foreground">
                {first.sources
                  .filter((s) => s.count > 0)
                  .sort((a, b) => b.count - a.count)
                  .slice(0, 10)
                  .map((s) => (
                    <li key={s.name} className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <span className={cn('h-1.5 w-1.5 rounded-full', s.ok ? 'bg-emerald-500' : 'bg-rose-500')} />
                        {s.name}
                      </span>
                      <span className="tabular-nums">{s.count}</span>
                    </li>
                  ))}
              </ul>
              <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground/80">
                Remote roles via{' '}
                <a className="underline" href="https://himalayas.app" target="_blank" rel="noreferrer">Himalayas</a>,{' '}
                <a className="underline" href="https://jobicy.com" target="_blank" rel="noreferrer">Jobicy</a> and{' '}
                <a className="underline" href="https://remotive.com" target="_blank" rel="noreferrer">Remotive</a>; on-site roles from
                company career pages. Applications go to the employer.
              </p>
            </FilterBlock>
          )}
        </aside>

        <div className="min-w-0">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <p className="mr-2 text-sm text-muted-foreground">
              {first ? (
                <>
                  <span className="font-semibold tabular-nums text-foreground">{first.total.toLocaleString('en-IN')}</span> openings
                </>
              ) : (
                'Scanning career pages…'
              )}
            </p>
            {activeFilters.map((f) => (
              <button
                key={f.label}
                onClick={f.clear}
                className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/15"
              >
                {f.label}
                <X className="h-3 w-3" />
              </button>
            ))}
            {activeFilters.length > 1 && (
              <button
                onClick={() => (setCategory(''), setCity(''), setMode(''), setFresher(false), setSearch(''))}
                className="text-xs text-muted-foreground underline-offset-2 hover:underline"
              >
                Clear all
              </button>
            )}
          </div>

          {!first ? (
            <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
              {Array.from({ length: 6 }, (_, i) => (
                <div key={i} className="h-48 animate-pulse rounded-xl border border-border/60 bg-muted/40" />
              ))}
            </div>
          ) : jobs.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-card px-6 py-16 text-center">
              <Search className="mx-auto h-8 w-8 text-muted-foreground/50" />
              <p className="mt-3 font-medium">No openings match</p>
              <p className="mt-1 text-sm text-muted-foreground">Loosen a filter — new roles land here every few minutes.</p>
            </div>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                {jobs.map((j, i) => (
                  <JobCard
                    key={j.id}
                    job={j}
                    index={i % LIMIT}
                    canShare={canShare}
                    sharing={share.isPending && share.variables === j.id}
                    onShare={() => share.mutate(j.id)}
                  />
                ))}
              </div>
              {feed.hasNextPage && (
                <div className="mt-6 flex justify-center">
                  <button
                    onClick={() => feed.fetchNextPage()}
                    disabled={feed.isFetchingNextPage}
                    className="rounded-full border border-border bg-card px-5 py-2.5 text-sm font-medium shadow-sm transition hover:border-primary/40 hover:shadow-md disabled:opacity-60"
                  >
                    {feed.isFetchingNextPage ? 'Loading…' : `Show more · ${(first.total - jobs.length).toLocaleString('en-IN')} left`}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function JobCard({
  job: j,
  index,
  canShare,
  sharing,
  onShare,
}: {
  job: VpoJob;
  index: number;
  canShare: boolean;
  sharing: boolean;
  onShare: () => void;
}) {
  const tint = CATEGORY_TINT[j.category] ?? '#64748b';
  return (
    <article
      className="vpo-card group relative flex flex-col overflow-hidden rounded-xl border bg-card p-5 shadow-xs transition duration-300 hover:-translate-y-1 hover:border-transparent hover:shadow-[0_18px_40px_-18px_rgba(30,79,216,0.45)]"
      style={{ animationDelay: `${index * 35}ms`, ['--tint' as string]: tint }}
    >
      <span className="absolute inset-x-0 top-0 h-[3px] origin-left scale-x-0 bg-[var(--tint)] transition-transform duration-500 group-hover:scale-x-100" />
      <div className="flex items-start gap-3">
        <CompanyLogo name={j.company} website={j.website} logo={j.logo} size={44} className="rounded-xl" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium text-muted-foreground">{j.company}</p>
          <p className="text-[11px] text-muted-foreground/80">{ago(j.postedAt)}</p>
        </div>
        {isNew(j.postedAt) && (
          <span className="vpo-new rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">New</span>
        )}
      </div>

      <h3 className="mt-3 line-clamp-2 text-[15px] font-semibold leading-snug">{j.title}</h3>

      <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[11px] font-medium">
        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
          {j.remote ? <Globe2 className="h-3 w-3" /> : <MapPin className="h-3 w-3" />}
          {j.city ?? (j.remote ? 'Remote' : j.location)}
        </span>
        <span className="rounded-full px-2 py-0.5" style={{ background: `${tint}14`, color: tint }}>
          {j.category}
        </span>
        {j.type !== 'Full-time' && (
          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">{j.type}</span>
        )}
        {j.fresher && (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
            <GraduationCap className="h-3 w-3" />
            Freshers
          </span>
        )}
      </div>
      {j.salary && <p className="mt-2.5 text-sm font-semibold tabular-nums">{j.salary}</p>}

      <div className="mt-auto flex items-center justify-between gap-2 border-t border-border/60 pt-3.5 [margin-top:1.1rem]">
        <a href={j.sourceUrl} target="_blank" rel="noreferrer" className="truncate text-[11px] text-muted-foreground hover:underline">
          via {j.source}
        </a>
        <div className="flex shrink-0 items-center gap-1.5">
          {canShare &&
            (j.shared ? (
              <span className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-emerald-700">
                <Check className="h-3.5 w-3.5" />
                Shared
              </span>
            ) : (
              <button
                onClick={onShare}
                disabled={sharing}
                className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium transition hover:border-primary/40 hover:text-primary disabled:opacity-60"
                title="Post this opening on the campus job board"
              >
                <Send className="h-3.5 w-3.5" />
                {sharing ? 'Sharing…' : 'Share'}
              </button>
            ))}
          <a
            href={j.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-primary/90"
          >
            Apply
            <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </a>
        </div>
      </div>
    </article>
  );
}

function FilterBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-xs">
      <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{title}</p>
      {children}
    </div>
  );
}

function FacetRow({
  label,
  count,
  max,
  color,
  on,
  onClick,
}: {
  label: string;
  count: number;
  max: number;
  color: string;
  on: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn('relative mb-1 block w-full overflow-hidden rounded-lg px-2.5 py-1.5 text-left text-sm transition', on ? 'text-white' : 'hover:bg-muted/60')}
      style={on ? { background: color } : undefined}
    >
      {!on && (
        <span className="absolute inset-y-0 left-0 opacity-[0.09]" style={{ width: `${(count / max) * 100}%`, background: color }} />
      )}
      <span className="relative flex items-center justify-between">
        <span className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: on ? '#fff' : color }} />
          {label}
        </span>
        <span className={cn('text-xs tabular-nums', on ? 'text-white/80' : 'text-muted-foreground')}>{count}</span>
      </span>
    </button>
  );
}

function Radar() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-5">
      <div className="relative h-32 w-32">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="vpo-ring absolute inset-0 rounded-full border border-cyan-300/60"
            style={{ animationDelay: `${i * 0.8}s` }}
          />
        ))}
        <span className="vpo-sweep absolute inset-0 rounded-full" />
        <span className="absolute left-1/2 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-300 shadow-[0_0_18px_4px_rgba(103,232,249,0.6)]" />
      </div>
      <p className="text-sm text-blue-100/80">Scanning company career pages…</p>
    </div>
  );
}

const CSS = `
.vpo-grid{background-image:linear-gradient(rgba(255,255,255,.35) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.35) 1px,transparent 1px);background-size:44px 44px;mask-image:radial-gradient(ellipse at 30% 20%,#000 20%,transparent 70%)}
.vpo-gradient-text{background:linear-gradient(90deg,#67e8f9,#93c5fd 40%,#c4b5fd 70%,#67e8f9);background-size:200% auto;-webkit-background-clip:text;background-clip:text;color:transparent;animation:vpoShine 6s linear infinite}
@keyframes vpoShine{to{background-position:200% center}}
.vpo-scan{top:-6rem;animation:vpoScan 7s ease-in-out infinite}
@keyframes vpoScan{0%{transform:translateY(0)}100%{transform:translateY(46rem)}}
.vpo-wire{animation:vpoWire 38s linear infinite}
.vpo-wire:hover{animation-play-state:paused}
@keyframes vpoWire{to{transform:translateY(-50%)}}
.vpo-fade{mask-image:linear-gradient(to bottom,transparent,#000 12%,#000 88%,transparent)}
.vpo-fade-x{mask-image:linear-gradient(to right,transparent,#000 6%,#000 94%,transparent)}
.vpo-marquee{animation:vpoMarquee 60s linear infinite;padding-left:1rem}
.vpo-marquee:hover{animation-play-state:paused}
@keyframes vpoMarquee{to{transform:translateX(-50%)}}
.vpo-card{animation:vpoIn .5s cubic-bezier(.2,.7,.2,1) both}
@keyframes vpoIn{from{opacity:0;transform:translateY(14px) scale(.98)}to{opacity:1;transform:none}}
.vpo-new{background:linear-gradient(90deg,#f43f5e,#f59e0b,#f43f5e);background-size:200% auto;animation:vpoShine 2.5s linear infinite;box-shadow:0 0 12px rgba(244,63,94,.45)}
.vpo-ring{animation:vpoRing 2.4s ease-out infinite;opacity:0}
@keyframes vpoRing{0%{transform:scale(.2);opacity:.9}100%{transform:scale(1);opacity:0}}
.vpo-sweep{background:conic-gradient(from 0deg,rgba(103,232,249,.35),transparent 30%);animation:vpoSpin 2s linear infinite}
@keyframes vpoSpin{to{transform:rotate(360deg)}}
@media (prefers-reduced-motion:reduce){.vpo-wire,.vpo-marquee,.vpo-scan,.vpo-gradient-text,.vpo-new,.vpo-card,.vpo-ring,.vpo-sweep{animation:none}}
`;
