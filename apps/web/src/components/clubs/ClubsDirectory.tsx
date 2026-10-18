'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Clapperboard, Compass, Loader2, Plus, Search, Sparkles } from 'lucide-react';
import { clubsApi, type Club } from '@/lib/api';
import { cn } from '@/lib/utils';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuthStore } from '@/store/authStore';
import { useBranchStore } from '@/store/branchStore';
import { ClubCard } from './ClubCard';
import { ClubsIntro } from './ClubsIntro';
import { ClubsShowcase } from './ClubsShowcase';
import { CLUB_CATEGORY, ClubCrest, iconOf } from './clubVisuals';

const ALL = 'all';
const INTRO_KEY = 'cv-clubs-intro-seen';

export function ClubsDirectory({ mine = false }: { mine?: boolean }) {
  const branchId = useBranchStore((s) => s.selectedBranchId);
  const orgName =
    (useAuthStore((s) => s.user?.tenant) as { name?: string } | undefined)?.name ?? 'Campus Verse';
  const { hasPermission } = usePermissions();
  const canCreate = hasPermission('communications.calendar', 'create');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState(ALL);
  const [intro, setIntro] = useState(false);

  const q = useQuery({
    queryKey: ['clubs', branchId, mine],
    queryFn: () => clubsApi.list({ mine }).then((r) => r.data),
    enabled: !!branchId,
  });
  const [local, setLocal] = useState<Club[] | null>(null);
  useEffect(() => setLocal(q.data ?? null), [q.data]);
  const clubs = useMemo(() => local ?? [], [local]);

  // The intro plays once per visit to Clubs (not on My Clubs).
  useEffect(() => {
    if (mine || !clubs.length) return;
    try {
      if (sessionStorage.getItem(INTRO_KEY)) return;
      sessionStorage.setItem(INTRO_KEY, '1');
    } catch {
      /* storage blocked: play it */
    }
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) setIntro(true);
  }, [mine, clubs.length]);

  const featured = useMemo(
    () => [...clubs].sort((a, b) => b.memberCount - a.memberCount).slice(0, 5),
    [clubs]
  );
  const trending = new Set(featured.slice(0, 3).map((c) => c._id));
  const needle = search.trim().toLowerCase();
  const shown = clubs.filter(
    (c) =>
      (category === ALL || c.category === category) &&
      (!needle ||
        `${c.name} ${c.tagline} ${c.tags.join(' ')} ${c.institutionName ?? ''}`
          .toLowerCase()
          .includes(needle))
  );
  const counts = clubs.reduce<Record<string, number>>(
    (m, c) => ((m[c.category] = (m[c.category] ?? 0) + 1), m),
    {}
  );
  const update = (c: Club) =>
    setLocal(
      (list) =>
        (mine && !c.isMember
          ? list?.filter((x) => x._id !== c._id)
          : list?.map((x) => (x._id === c._id ? { ...x, ...c } : x))) ?? null
    );

  return (
    <div className="space-y-7">
      <header className="flex flex-wrap items-end justify-between gap-4 animate-[club-fade-up_0.6s_both]">
        <div className="space-y-2">
          <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-[hsl(var(--brand-cyan))]" />
            Campus · Clubs
          </p>
          <h1 className="font-display text-3xl font-bold leading-tight tracking-tight md:text-4xl">
            {mine ? 'My clubs' : 'Clubs'}
          </h1>
          <p className="max-w-xl text-muted-foreground">
            {mine
              ? 'The circles you belong to — when they meet, who’s in, what’s next.'
              : `${clubs.length} clubs and ${clubs.reduce((n, c) => n + c.memberCount, 0).toLocaleString('en-IN')} members across ${orgName}. Find your people.`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!mine && clubs.length > 0 && (
            <button
              onClick={() => setIntro(true)}
              className="inline-flex items-center gap-1.5 rounded-full border bg-card px-4 py-2 text-sm font-medium transition hover:-translate-y-px hover:shadow-sm"
            >
              <Clapperboard className="h-4 w-4 text-[hsl(var(--brand-cyan))]" />
              Replay intro
            </button>
          )}
          {canCreate && !mine && (
            <Link
              href="/clubs/new"
              className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition hover:-translate-y-px hover:shadow-md"
            >
              <Plus className="h-4 w-4" />
              Start a club
            </Link>
          )}
        </div>
      </header>

      {!mine && featured.length > 0 && <ClubsShowcase clubs={featured} onChange={update} />}

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-1 flex-wrap gap-2">
          {[
            [ALL, { label: 'All', icon: '' }] as const,
            ...Object.entries(CLUB_CATEGORY).filter(([k]) => counts[k]),
          ].map(([k, meta]) => {
            const Icon = k === ALL ? Compass : iconOf(meta.icon);
            const on = category === k;
            return (
              <button
                key={k}
                onClick={() => setCategory(k)}
                className={cn(
                  'group inline-flex items-center gap-2 rounded-full border py-1 pl-1 pr-3 text-sm font-medium transition-all',
                  on
                    ? 'border-primary bg-primary text-primary-foreground shadow-md'
                    : 'bg-card hover:-translate-y-px hover:border-primary/40'
                )}
              >
                <span
                  className={cn(
                    'flex h-7 w-7 items-center justify-center rounded-full transition-transform group-hover:rotate-12',
                    on
                      ? 'bg-white/15'
                      : 'bg-gradient-to-br from-primary to-[hsl(var(--brand-cyan))] text-white'
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                </span>
                {meta.label}
                <span
                  className={cn(
                    'rounded-full px-1.5 text-[11px] tabular-nums',
                    on ? 'bg-white/15' : 'bg-muted text-muted-foreground'
                  )}
                >
                  {k === ALL ? clubs.length : counts[k]}
                </span>
              </button>
            );
          })}
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search clubs or interests"
            className="h-10 w-full rounded-full border bg-card pl-10 pr-4 text-sm outline-none ring-[hsl(var(--brand-cyan))]/30 transition focus:ring-2"
          />
        </div>
      </div>

      {q.isLoading ? (
        <div className="flex h-60 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : shown.length === 0 ? (
        <div className="flex flex-col items-center rounded-[28px] border border-dashed px-6 py-14 text-center">
          <ClubCrest category="social" theme="midnight" size={84} live />
          <p className="mt-6 font-display text-xl font-bold">
            {mine ? 'Your first club is waiting' : 'No clubs match that'}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {mine ? (
              <Link
                href="/clubs"
                className="font-semibold text-primary underline-offset-4 hover:underline"
              >
                Explore clubs and join one →
              </Link>
            ) : (
              'Try another category or search.'
            )}
          </p>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {shown.map((c, i) => (
            <ClubCard
              key={c._id}
              club={c}
              onChange={update}
              delay={Math.min(i, 12) * 55}
              trending={trending.has(c._id)}
            />
          ))}
        </div>
      )}

      {intro && (
        <ClubsIntro
          clubs={featured.concat(clubs.filter((c) => !featured.includes(c)))}
          orgName={orgName}
          onDone={() => setIntro(false)}
        />
      )}
    </div>
  );
}
