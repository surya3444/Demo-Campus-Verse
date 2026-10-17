'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Building2,
  GraduationCap,
  Presentation,
  GitBranch,
  Users,
  UserCog,
  Clock,
  Sparkles,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { adminStatisticsApi, type PlatformStatistics } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { KpiStrip, type KpiItem } from '@/components/dashboard/KpiStrip';
import { StatisticsCharts } from '@/components/dashboard/StatisticsCharts';
import { cn } from '@/lib/utils';

export default function StatisticsPage() {
  const [stats, setStats] = useState<PlatformStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const res = await adminStatisticsApi.get();
      if (res.success) setStats(res.data);
    } catch (err) {
      console.error('Failed to load statistics', err);
      setError('Failed to load platform statistics');
      toast.error('Failed to load platform statistics');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const dateLabel = useMemo(
    () =>
      new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      }),
    []
  );

  const num = (n: number | undefined) => (n ?? 0).toLocaleString('en-IN');

  /* ─── Primary KPIs ─── */
  const primaryKpis: KpiItem[] = [
    {
      label: 'Organizations',
      value: num(stats?.organizations.total),
      footnote:
        stats && stats.organizations.newThisMonth > 0 ? (
          <span className="text-success">+{stats.organizations.newThisMonth} this month</span>
        ) : (
          <span className="text-muted-foreground">{num(stats?.organizations.active)} active</span>
        ),
      icon: Building2,
      accent: true,
    },
    {
      label: 'Students',
      value: num(stats?.students.total),
      footnote:
        stats && stats.students.newThisMonth > 0 ? (
          <span className="text-success">+{stats.students.newThisMonth} this month</span>
        ) : (
          <span className="text-muted-foreground">{num(stats?.students.active)} active</span>
        ),
      icon: GraduationCap,
    },
    {
      label: 'Teachers',
      value: num(stats?.staff.teachers),
      footnote: (
        <span className="text-muted-foreground">of {num(stats?.staff.total)} total staff</span>
      ),
      icon: Presentation,
    },
    {
      label: 'Branches',
      value: num(stats?.branches),
      footnote: <span className="text-muted-foreground">across all organizations</span>,
      icon: GitBranch,
    },
  ];

  /* ─── Secondary KPIs ─── */
  const secondaryKpis: KpiItem[] = [
    {
      label: 'Total staff',
      value: num(stats?.staff.total),
      footnote: <span className="text-muted-foreground">teaching + non-teaching</span>,
      icon: Users,
    },
    {
      label: 'Non-teaching staff',
      value: num(stats?.staff.nonTeaching),
      footnote: <span className="text-muted-foreground">admin & support</span>,
      icon: UserCog,
    },
    {
      label: 'Platform users',
      value: num(stats?.users),
      footnote: <span className="text-muted-foreground">all login accounts</span>,
      icon: Users,
    },
    {
      label: 'Pending approvals',
      value: num(stats?.organizations.pendingApprovals),
      footnote:
        (stats?.organizations.pendingApprovals ?? 0) > 0 ? (
          <span className="text-primary">Awaiting review</span>
        ) : (
          <span className="text-muted-foreground">Inbox is clear</span>
        ),
      icon: Clock,
      accent: (stats?.organizations.pendingApprovals ?? 0) > 0,
    },
  ];

  return (
    <div className="space-y-10 pb-12 max-w-[1600px]">
      {/* Header */}
      <header className="relative pb-2">
        <div
          aria-hidden
          className="pointer-events-none absolute -inset-y-8"
          style={{
            left: '-50vw',
            right: '-50vw',
            background:
              'radial-gradient(ellipse 35% 90% at 28% 50%, hsl(var(--primary) / 0.10), transparent 70%), radial-gradient(ellipse 30% 80% at 68% 60%, hsl(var(--brand-cyan) / 0.10), transparent 70%)',
            WebkitMaskImage:
              'radial-gradient(ellipse 70% 120% at 50% 50%, black 40%, transparent 92%)',
            maskImage: 'radial-gradient(ellipse 70% 120% at 50% 50%, black 40%, transparent 92%)',
          }}
        />
        <div className="relative flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="space-y-2 min-w-0">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
              <Sparkles className="h-3 w-3 shrink-0 text-[hsl(var(--brand-cyan))]" />
              <span>Platform Statistics</span>
              <span className="hidden h-px w-8 bg-border sm:block" />
              <span>{dateLabel}</span>
            </div>
            <h1 className="font-display text-4xl font-bold leading-[1.15] tracking-tight text-foreground md:text-5xl">
              The network{' '}
              <span className="bg-gradient-to-r from-primary via-primary to-[hsl(var(--brand-cyan))] bg-clip-text text-transparent">
                at a glance.
              </span>
            </h1>
            <p className="max-w-xl text-sm text-muted-foreground">
              Live totals aggregated across every tenant on Campus Verse — organizations, students,
              teachers and more.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => fetchStats(true)}
            disabled={loading || refreshing}
            className="shrink-0"
          >
            <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
            Refresh
          </Button>
        </div>
      </header>

      {error && (
        <div className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
          <AlertCircle className="h-4 w-4 text-destructive" />
          <p className="flex-1 text-sm text-destructive">{error}</p>
          <Button variant="outline" size="sm" onClick={() => fetchStats(true)}>
            Retry
          </Button>
        </div>
      )}

      <KpiStrip ariaLabel="Primary platform metrics" loading={loading} items={primaryKpis} />
      <KpiStrip ariaLabel="Secondary platform metrics" loading={loading} items={secondaryKpis} />

      <StatisticsCharts stats={stats} loading={loading} />
    </div>
  );
}
