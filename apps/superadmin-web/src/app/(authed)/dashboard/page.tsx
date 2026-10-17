'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Building2,
  Clock,
  Users,
  Trophy,
  ArrowUpRight,
  CheckCircle2,
  XCircle,
  Mail,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Sparkles,
  Inbox,
  KanbanSquare,
  Settings,
  GraduationCap,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  adminDashboardApi,
  leadsApi,
  pipelineApi,
  type MarketingLead,
  type PipelineStage,
} from '@/lib/api';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { EditorialHeader } from '@/components/dashboard/EditorialHeader';
import { KpiStrip, type KpiItem } from '@/components/dashboard/KpiStrip';
import { SectionCard } from '@/components/dashboard/SectionCard';
import { STAGE_COLOR_MAP } from '@/components/leads/stage-colors';

interface AdminStats {
  pendingApprovals: number;
  totalOrganizations: number;
  approvedThisMonth: number;
  rejectedThisMonth: number;
  recentSignups: Array<{
    id: string;
    organizationName: string;
    institutionType: string;
    admin: { email: string };
    status: string;
    createdAt: string;
  }>;
}

function timeAgo(input: string | Date): string {
  const date = new Date(input);
  const diff = Date.now() - date.getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 45) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  const wk = Math.floor(day / 7);
  if (wk < 4) return `${wk}w ago`;
  const mo = Math.floor(day / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.floor(day / 365)}y ago`;
}

function initialsFor(label: string): string {
  return (
    label
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((s) => s[0]?.toUpperCase() || '')
      .join('') || '?'
  );
}

export default function SuperAdminDashboardPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [pipeline, setPipeline] = useState<PipelineStage[]>([]);
  const [leads, setLeads] = useState<MarketingLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adminUser, setAdminUser] = useState<{ profile?: { displayName?: string } } | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [statsRes, pipelineRes, leadsRes] = await Promise.all([
        adminDashboardApi.getStats(),
        pipelineApi.get(),
        leadsApi.list(),
      ]);
      if (statsRes.success) setStats(statsRes.data);
      if (pipelineRes.success) setPipeline(pipelineRes.data);
      if (leadsRes.success) setLeads(leadsRes.data);
    } catch (err) {
      console.error('Failed to load dashboard', err);
      setError('Failed to load dashboard data');
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    if (typeof window !== 'undefined') {
      const raw = localStorage.getItem('adminUser');
      if (raw) {
        try {
          setAdminUser(JSON.parse(raw));
        } catch {
          // ignore
        }
      }
    }
  }, [fetchAll]);

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  }, []);

  const dateLabel = useMemo(
    () =>
      new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      }),
    []
  );

  const userName = adminUser?.profile?.displayName?.split(' ')[0] || 'Admin';

  /* ─── KPI calculations ─── */
  const kpis = useMemo(() => {
    const now = Date.now();
    const week = 7 * 24 * 60 * 60 * 1000;
    const thisWeek = leads.filter((l) => now - new Date(l.createdAt).getTime() < week).length;
    const lastWeek = leads.filter((l) => {
      const t = now - new Date(l.createdAt).getTime();
      return t >= week && t < 2 * week;
    }).length;
    const won = leads.filter((l) => l.stage === 'won').length;
    const lost = leads.filter((l) => l.stage === 'lost').length;
    const closed = won + lost;
    const winRate = closed > 0 ? Math.round((won / closed) * 100) : null;
    return {
      thisWeek,
      thisWeekDelta: thisWeek - lastWeek,
      winRate,
      won,
      closed,
    };
  }, [leads]);

  const kpiItems: KpiItem[] = [
    {
      label: 'Active Organizations',
      value: (stats?.totalOrganizations ?? 0).toLocaleString(),
      footnote:
        stats && stats.approvedThisMonth > 0 ? (
          <span className="text-success">+{stats.approvedThisMonth} approved this month</span>
        ) : (
          <span className="text-muted-foreground">Tenants on the platform</span>
        ),
      icon: Building2,
    },
    {
      label: 'Awaiting approval',
      value: (stats?.pendingApprovals ?? 0).toLocaleString(),
      footnote:
        (stats?.pendingApprovals ?? 0) > 0 ? (
          <Link
            href="/organizations"
            className="text-primary hover:underline inline-flex items-center gap-1"
          >
            Review now <ArrowUpRight className="h-3 w-3" />
          </Link>
        ) : (
          <span className="text-muted-foreground">Inbox is clear</span>
        ),
      icon: Clock,
      accent: (stats?.pendingApprovals ?? 0) > 0,
    },
    {
      label: 'Leads this week',
      value: kpis.thisWeek.toLocaleString(),
      footnote:
        kpis.thisWeek === 0 && kpis.thisWeekDelta === 0 ? (
          <span className="text-muted-foreground">No leads yet</span>
        ) : kpis.thisWeekDelta > 0 ? (
          <span className="text-success inline-flex items-center gap-1">
            <TrendingUp className="h-3 w-3" /> +{kpis.thisWeekDelta} vs last week
          </span>
        ) : kpis.thisWeekDelta < 0 ? (
          <span className="text-destructive inline-flex items-center gap-1">
            <TrendingDown className="h-3 w-3" /> {kpis.thisWeekDelta} vs last week
          </span>
        ) : (
          <span className="text-muted-foreground">Same as last week</span>
        ),
      icon: Sparkles,
    },
    {
      label: 'Win rate',
      value: kpis.winRate === null ? '—' : `${kpis.winRate}%`,
      footnote:
        kpis.closed === 0 ? (
          <span className="text-muted-foreground">No closed deals yet</span>
        ) : (
          <span className="text-muted-foreground">
            {kpis.won} won of {kpis.closed} closed
          </span>
        ),
      icon: Trophy,
    },
  ];

  /* ─── Pipeline distribution rows ─── */
  const pipelineWithCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const l of leads) counts[l.stage] = (counts[l.stage] || 0) + 1;
    const total = leads.length;
    return pipeline.map((s) => ({
      ...s,
      count: counts[s.key] || 0,
      pct: total > 0 ? ((counts[s.key] || 0) / total) * 100 : 0,
    }));
  }, [pipeline, leads]);

  const pendingSignups = stats?.recentSignups.filter((s) => s.status === 'pending_approval') ?? [];
  const approvedSignups =
    stats?.recentSignups.filter((s) => s.status === 'approved' || s.status === 'rejected') ?? [];
  const recentLeads = leads.slice(0, 5);

  return (
    <div className="space-y-10 pb-12 max-w-[1600px]">
      <EditorialHeader
        eyebrow="Super Admin Console"
        date={dateLabel}
        greeting={greeting}
        userName={userName}
      />

      {error && (
        <div className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
          <AlertCircle className="h-4 w-4 text-destructive" />
          <p className="flex-1 text-sm text-destructive">{error}</p>
          <Button variant="outline" size="sm" onClick={fetchAll}>
            Retry
          </Button>
        </div>
      )}

      <KpiStrip ariaLabel="Super admin KPIs" loading={loading} items={kpiItems} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <PendingApprovalsPanel
          loading={loading}
          signups={pendingSignups}
          totalPending={stats?.pendingApprovals ?? 0}
        />
        <PipelineHealthPanel loading={loading} stages={pipelineWithCounts} total={leads.length} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <RecentSignupsPanel loading={loading} signups={approvedSignups} />
        <RecentLeadsPanel loading={loading} leads={recentLeads} pipeline={pipeline} />
      </div>

      <ActionsRow />
    </div>
  );
}

/* ─────────────────────── Pending Approvals ─────────────────────── */

function PendingApprovalsPanel({
  loading,
  signups,
  totalPending,
}: {
  loading: boolean;
  signups: AdminStats['recentSignups'];
  totalPending: number;
}) {
  return (
    <SectionCard
      eyebrow="Pending approval"
      title={
        loading ? (
          <Skeleton className="h-5 w-48" />
        ) : totalPending === 0 ? (
          'Inbox is clear'
        ) : (
          `${totalPending} ${totalPending === 1 ? 'organization' : 'organizations'} awaiting review`
        )
      }
      action={{ href: '/organizations', label: 'Review all' }}
      className="lg:col-span-2"
    >
      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : signups.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-10">
          <div className="h-12 w-12 rounded-full bg-emerald-50 flex items-center justify-center">
            <CheckCircle2 className="h-6 w-6 text-emerald-500" />
          </div>
          <p className="text-sm text-muted-foreground">No organizations waiting on you.</p>
          <p className="text-xs text-muted-foreground/70">
            New signups will appear here for approval.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {signups.slice(0, 5).map((s) => (
            <li key={s.id} className="group flex items-center gap-4 py-4 first:pt-0 last:pb-0">
              <div className="h-10 w-10 shrink-0 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 text-primary flex items-center justify-center font-display text-sm font-semibold">
                {initialsFor(s.organizationName)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium text-sm truncate">{s.organizationName}</p>
                  <Badge variant="outline" className="capitalize text-2xs">
                    {s.institutionType}
                  </Badge>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                  <span className="flex items-center gap-1 truncate">
                    <Mail className="h-3 w-3 shrink-0" />
                    <span className="truncate">{s.admin.email}</span>
                  </span>
                  <span className="hidden sm:inline">·</span>
                  <span className="hidden sm:inline tabular-nums shrink-0">
                    {timeAgo(s.createdAt)}
                  </span>
                </div>
              </div>
              <Link
                href="/organizations"
                className="inline-flex items-center gap-1 text-xs font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity"
              >
                Review <ArrowUpRight className="h-3 w-3" />
              </Link>
            </li>
          ))}
          {totalPending > 5 && (
            <li className="pt-4">
              <Link
                href="/organizations"
                className="inline-flex w-full items-center justify-center gap-1 rounded-lg border border-dashed border-border py-2 text-xs text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors"
              >
                +{totalPending - 5} more awaiting review
                <ArrowUpRight className="h-3 w-3" />
              </Link>
            </li>
          )}
        </ul>
      )}
    </SectionCard>
  );
}

/* ─────────────────────── Pipeline Health ─────────────────────── */

function PipelineHealthPanel({
  loading,
  stages,
  total,
}: {
  loading: boolean;
  stages: Array<PipelineStage & { count: number; pct: number }>;
  total: number;
}) {
  return (
    <SectionCard
      eyebrow="Pipeline health"
      title={loading ? <Skeleton className="h-5 w-24" /> : `${total} leads`}
      action={{ href: '/leads', label: 'Open board' }}
    >
      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-5/6" />
          <Skeleton className="h-3 w-2/3" />
        </div>
      ) : stages.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-8">
          <KanbanSquare className="h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">No pipeline configured</p>
          <Link
            href="/leads"
            className="text-xs text-primary hover:underline inline-flex items-center gap-1"
          >
            Set up stages <ArrowUpRight className="h-3 w-3" />
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {stages.map((s) => {
            const tone = STAGE_COLOR_MAP[s.color];
            return (
              <li key={s.key} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 min-w-0">
                    <span className={cn('h-2 w-2 rounded-full shrink-0', tone.dot)} />
                    <span className="truncate font-medium text-foreground">{s.label}</span>
                  </span>
                  <span className="tabular-nums text-muted-foreground shrink-0">
                    {s.count}
                    <span className="text-muted-foreground/50 ml-1.5">{Math.round(s.pct)}%</span>
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-muted/60 overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all', tone.accent)}
                    style={{ width: `${Math.max(s.pct, total === 0 ? 0 : 2)}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </SectionCard>
  );
}

/* ─────────────────────── Recent Signups ─────────────────────── */

function RecentSignupsPanel({
  loading,
  signups,
}: {
  loading: boolean;
  signups: AdminStats['recentSignups'];
}) {
  return (
    <SectionCard
      eyebrow="Recent decisions"
      title="Approvals this month"
      action={{ href: '/organizations', label: 'View all' }}
      className="lg:col-span-2"
    >
      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : signups.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-8">
          <Building2 className="h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">No decisions made this month yet.</p>
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {signups.slice(0, 5).map((s) => {
            const isApproved = s.status === 'approved';
            return (
              <li key={s.id} className="flex items-center gap-4 py-3 first:pt-0 last:pb-0">
                <div
                  className={cn(
                    'h-9 w-9 shrink-0 rounded-full flex items-center justify-center',
                    isApproved ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                  )}
                >
                  {isApproved ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <XCircle className="h-4 w-4" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm truncate">{s.organizationName}</p>
                  </div>
                  <p className="text-xs text-muted-foreground capitalize truncate">
                    {s.institutionType} · {s.admin.email}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <Badge
                    variant={isApproved ? 'success' : 'destructive'}
                    className="text-2xs capitalize"
                  >
                    {isApproved ? 'Approved' : 'Rejected'}
                  </Badge>
                  <p className="text-2xs text-muted-foreground mt-0.5 tabular-nums">
                    {timeAgo(s.createdAt)}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </SectionCard>
  );
}

/* ─────────────────────── Recent Leads ─────────────────────── */

function RecentLeadsPanel({
  loading,
  leads,
  pipeline,
}: {
  loading: boolean;
  leads: MarketingLead[];
  pipeline: PipelineStage[];
}) {
  const stageByKey = useMemo(() => {
    const m: Record<string, PipelineStage> = {};
    for (const s of pipeline) m[s.key] = s;
    return m;
  }, [pipeline]);

  return (
    <SectionCard eyebrow="Latest demo requests" action={{ href: '/leads', label: 'Open board' }}>
      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : leads.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-8">
          <Inbox className="h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">No leads yet</p>
          <p className="text-xs text-muted-foreground/70 max-w-[220px] text-center">
            Demo requests from the marketing site will land here.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {leads.map((lead) => {
            const stage = stageByKey[lead.stage];
            const tone = stage ? STAGE_COLOR_MAP[stage.color] : null;
            return (
              <li key={lead.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                <div
                  className={cn(
                    'h-9 w-9 shrink-0 rounded-full flex items-center justify-center font-display text-xs font-semibold',
                    tone?.avatarBg || 'bg-muted',
                    tone?.avatarText || 'text-muted-foreground'
                  )}
                >
                  {initialsFor(`${lead.firstName} ${lead.lastName || ''}`)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm truncate">
                    {lead.firstName} {lead.lastName || ''}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">{lead.institution}</p>
                </div>
                <div className="text-right shrink-0">
                  {stage && tone && (
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 text-2xs font-medium px-1.5 py-0.5 rounded-full',
                        tone.chip
                      )}
                    >
                      <span className={cn('h-1.5 w-1.5 rounded-full', tone.dot)} />
                      {stage.label}
                    </span>
                  )}
                  <p className="text-2xs text-muted-foreground mt-0.5 tabular-nums">
                    {timeAgo(lead.createdAt)}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </SectionCard>
  );
}

/* ─────────────────────── Quick Actions ─────────────────────── */

function ActionsRow() {
  const actions = [
    { label: 'Review approvals', href: '/organizations', icon: Building2 },
    { label: 'Open lead board', href: '/leads', icon: KanbanSquare },
    { label: 'Manage stages', href: '/leads', icon: Settings },
    { label: 'View admissions', href: '/organizations', icon: GraduationCap },
    { label: 'Account', href: '/dashboard', icon: Users },
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
              key={a.label}
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
