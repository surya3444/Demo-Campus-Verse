'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight, Building2, Settings, type LucideIcon } from 'lucide-react';
import { PageHero } from '@/components/ui/page-hero';
import { Skeleton } from '@/components/ui/skeleton';
import { organizationApi } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { useVisibleNav } from '@/components/layout/useVisibleNav';

interface Overview {
  institutions: number;
  campuses: number;
  departments: number;
  programs: number;
  users: { total: number; active: number };
  roles: number;
  customFields: number;
  scheduledJobs: number;
  infrastructure: { buildings: number; rooms: number };
  pendingApprovals: number;
}

/** What each tile says about its page: a headline number and a one-liner. */
const TILE_COPY: Record<
  string,
  { blurb: string; count?: (o: Overview) => number; note?: (o: Overview) => string }
> = {
  '/organization/institutions': {
    blurb: 'Colleges and schools that make up the organization',
    count: (o) => o.institutions,
  },
  '/organization/branches': {
    blurb: 'Physical locations and their settings',
    count: (o) => o.campuses,
  },
  '/organization/departments': {
    blurb: 'Teaching and service departments',
    count: (o) => o.departments,
  },
  '/organization/programs': {
    blurb: 'Degree programs, years and terms',
    count: (o) => o.programs,
  },
  '/organization/infrastructure': {
    blurb: 'Buildings, rooms and labs',
    count: (o) => o.infrastructure.rooms,
    note: (o) => `${o.infrastructure.buildings} buildings`,
  },
  '/organization/users': {
    blurb: 'Staff and admin accounts',
    count: (o) => o.users.total,
    note: (o) => `${o.users.active} active`,
  },
  '/organization/roles': {
    blurb: 'What each role can see and do',
    count: (o) => o.roles,
  },
  '/organization/approvals': {
    blurb: 'Concessions and certificates awaiting sign-off',
    count: (o) => o.pendingApprovals,
    note: (o) => (o.pendingApprovals ? 'waiting for you' : 'all clear'),
  },
  '/organization/custom-fields': {
    blurb: 'Extra fields on students, staff and forms',
    count: (o) => o.customFields,
  },
  '/organization/schedule-jobs': {
    blurb: 'Reports and reminders that run on their own',
    count: (o) => o.scheduledJobs,
  },
};

interface Tile {
  href: string;
  name: string;
  icon: LucideIcon;
  group: string;
}

export default function OrganizationOverviewPage() {
  const { user } = useAuthStore();
  const isUniversity = Boolean(user?.tenant?.institutionTypes?.includes('university'));
  const org = useVisibleNav()
    .flatMap((s) => s.modules)
    .find((m) => m.id === 'organization');

  const { data, isLoading } = useQuery({
    queryKey: ['organization-overview'],
    queryFn: () => organizationApi.getOverview(),
  });
  const overview = data?.data as Overview | undefined;

  // Same items, gates and order as the sidebar, so the two never disagree.
  const tiles: Tile[] = (org?.children ?? [])
    .filter((c) => c.href !== '/organization')
    .map((c) => ({
      href: c.href,
      name: isUniversity && c.universityLabel ? c.universityLabel : c.name,
      icon: c.icon,
      group: c.group ?? 'More',
    }));
  if (org?.settingsHref) {
    tiles.push({ href: org.settingsHref, name: 'Settings', icon: Settings, group: 'System' });
  }
  const groups = [...new Set(tiles.map((t) => t.group))];

  let index = 0;
  return (
    <div className="space-y-10 pb-12">
      <PageHero
        icon={Building2}
        eyebrow="Organization"
        title="Your organization"
        description="Everything that defines how your organization runs — its structure, who has access, and the system settings behind it."
      />

      {groups.map((group) => (
        <section key={group} className="space-y-4">
          <header className="flex items-center gap-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              {group}
            </p>
            <span className="h-px flex-1 bg-border" />
          </header>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {tiles
              .filter((t) => t.group === group)
              .map((t) => (
                <OrgTile
                  key={t.href}
                  tile={t}
                  overview={overview}
                  loading={isLoading}
                  delay={index++ * 45}
                />
              ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function OrgTile({
  tile,
  overview,
  loading,
  delay,
}: {
  tile: Tile;
  overview?: Overview;
  loading: boolean;
  delay: number;
}) {
  const copy = TILE_COPY[tile.href];
  const count = overview && copy?.count ? copy.count(overview) : undefined;
  const note = overview && copy?.note ? copy.note(overview) : undefined;
  const Icon = tile.icon;

  return (
    <Link
      href={tile.href}
      className="cv-rise group relative flex flex-col gap-4 overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-soft transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
      style={{ animationDelay: `${delay}ms` }}
    >
      {/* Soft glow that follows the card on hover */}
      <span
        aria-hidden
        className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-primary/10 opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100"
      />
      <div className="relative flex items-start justify-between">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110">
          <Icon className="h-5 w-5" />
        </span>
        <ArrowUpRight className="h-4 w-4 text-muted-foreground/50 transition-all duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary" />
      </div>
      <div className="relative space-y-1">
        <div className="flex items-baseline gap-2">
          <h3 className="font-display text-lg font-semibold">{tile.name}</h3>
          {copy?.count &&
            (loading ? (
              <Skeleton className="h-5 w-8" />
            ) : count !== undefined ? (
              <span className="font-display text-lg font-semibold tabular-nums text-primary">
                <CountUp value={count} />
              </span>
            ) : null)}
        </div>
        <p className="text-sm text-muted-foreground">
          {copy?.blurb ?? 'Organization-wide settings'}
        </p>
        {note && <p className="text-xs text-muted-foreground/80">{note}</p>}
      </div>
    </Link>
  );
}

/** Counts up from 0 on first render; jumps straight to the value for reduced motion. */
function CountUp({ value }: { value: number }) {
  const [shown, setShown] = useState(0);
  const frame = useRef<number>();
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || value === 0) {
      setShown(value);
      return;
    }
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 700);
      setShown(Math.round(value * (1 - Math.pow(1 - t, 3))));
      if (t < 1) frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current!);
  }, [value]);
  return <>{shown}</>;
}
