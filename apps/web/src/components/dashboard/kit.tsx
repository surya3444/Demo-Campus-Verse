'use client';

/**
 * Shared building blocks for every role dashboard, so a student, a dean and a
 * campus admin all read as one product: an editorial greeting, a single KPI
 * strip, and quiet bordered panels.
 */

import Link from 'next/link';
import {
  ArrowUpRight,
  Sparkles,
  IndianRupee,
  AlertTriangle,
  Clock,
  Calendar as CalendarIcon,
  Bell,
  type LucideIcon,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuthStore } from '@/store/authStore';
import type { Alert } from './utils';

const ROLE_LABELS: Record<string, string> = {
  GROUP_OWNER: 'Group Owner',
  ORG_MODERATOR: 'Organisation Moderator',
  ORG_ADMIN: 'Organisation Admin',
  BRANCH_ADMIN: 'Campus Admin',
  INSTITUTION_ADMIN: 'Dean',
  HOD: 'Head of Department',
  PROGRAM_COORDINATOR: 'Program Coordinator',
  TEACHER: 'Faculty',
  STUDENT: 'Student',
};

export function roleLabel(roleCode?: string) {
  if (!roleCode) return '';
  return (
    ROLE_LABELS[roleCode] ??
    roleCode
      .toLowerCase()
      .split('_')
      .map((w) => w[0]?.toUpperCase() + w.slice(1))
      .join(' ')
  );
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

// ─────────────────────────────── Header ─────────────────────────────────────

export function DashboardHeader({
  role,
  scope,
  subtitle,
}: {
  /** Overrides the label derived from the user's role code. */
  role?: string;
  /** What this person looks after, e.g. "Computer Science & Engineering". */
  scope?: string | null;
  subtitle?: string;
}) {
  const { user } = useAuthStore();
  const firstName = user?.profile?.displayName?.split(' ')[0] ?? 'there';
  const date = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
  const maskFade = 'radial-gradient(ellipse 70% 120% at 50% 50%, black 40%, transparent 92%)';

  return (
    <header className="relative pb-2">
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-y-8"
        style={{
          left: '-50vw',
          right: '-50vw',
          background:
            'radial-gradient(ellipse 35% 90% at 30% 50%, hsl(var(--primary) / 0.10), transparent 70%), radial-gradient(ellipse 30% 80% at 70% 60%, hsl(var(--accent) / 0.08), transparent 70%)',
          WebkitMaskImage: maskFade,
          maskImage: maskFade,
        }}
      />
      <div className="relative min-w-0 space-y-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
          <Sparkles className="h-3 w-3 shrink-0 text-accent" />
          <span className="text-foreground/80">{role ?? roleLabel(user?.roleCode)}</span>
          {scope && (
            <>
              <span className="h-px w-6 bg-border" />
              <span className="min-w-0 truncate">{scope}</span>
            </>
          )}
          <span className="hidden h-px w-6 bg-border sm:block" />
          <span className="hidden sm:inline">{date}</span>
        </div>
        <h1 className="font-display text-4xl font-bold leading-[1.15] tracking-tight text-foreground md:text-5xl">
          {greeting()},{' '}
          <span className="bg-gradient-to-r from-primary via-primary to-accent bg-clip-text text-transparent">
            {firstName}.
          </span>
        </h1>
        {subtitle && <p className="text-sm text-muted-foreground md:text-base">{subtitle}</p>}
      </div>
    </header>
  );
}

// ─────────────────────────────── KPI strip ──────────────────────────────────

export interface Stat {
  label: string;
  value: React.ReactNode;
  footnote?: React.ReactNode;
  icon: LucideIcon;
  tone?: 'default' | 'accent' | 'danger' | 'success';
  href?: string;
}

const VALUE_TONE = {
  default: 'text-foreground',
  accent: 'text-primary',
  danger: 'text-destructive',
  success: 'text-success',
};

export function StatStrip({ stats, loading }: { stats: Stat[]; loading?: boolean }) {
  const cols =
    stats.length >= 4 ? 'lg:grid-cols-4' : stats.length === 3 ? 'lg:grid-cols-3' : 'lg:grid-cols-2';
  return (
    <section
      aria-label="Key figures"
      className="relative overflow-hidden rounded-2xl border border-border bg-card shadow-soft"
    >
      <div className="pointer-events-none absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
      <div
        className={`grid grid-cols-1 divide-y divide-border sm:grid-cols-2 sm:divide-y-0 sm:[&>*:nth-child(n+3)]:border-t lg:[&>*:nth-child(n+3)]:border-t-0 ${cols} sm:divide-x`}
      >
        {stats.map((s, i) => {
          const tone = s.tone ?? 'default';
          const body = (
            <div
              className={`relative flex h-full flex-col gap-3 px-6 py-6 ${tone === 'accent' ? 'bg-gradient-to-br from-primary/5 via-transparent to-transparent' : ''} ${s.href ? 'transition-colors hover:bg-muted/40' : ''}`}
            >
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                  {s.label}
                </p>
                <s.icon
                  className={`h-3.5 w-3.5 ${tone === 'accent' ? 'text-primary' : tone === 'danger' ? 'text-destructive/70' : 'text-muted-foreground'}`}
                />
              </div>
              {loading ? (
                <Skeleton className="h-10 w-28" />
              ) : (
                <p
                  className={`font-display text-4xl font-bold leading-none tracking-tight tabular-nums ${VALUE_TONE[tone]}`}
                >
                  {s.value}
                </p>
              )}
              <div className="min-h-4 text-xs text-muted-foreground">
                {loading ? <Skeleton className="h-3 w-24" /> : s.footnote}
              </div>
              <span className="absolute right-5 top-2 font-mono text-[10px] text-muted-foreground/40">
                0{i + 1}
              </span>
            </div>
          );
          return s.href ? (
            <Link key={s.label} href={s.href}>
              {body}
            </Link>
          ) : (
            <div key={s.label}>{body}</div>
          );
        })}
      </div>
    </section>
  );
}

// ─────────────────────────────── Panel ──────────────────────────────────────

export function Panel({
  eyebrow,
  title,
  action,
  children,
  className = '',
}: {
  eyebrow: string;
  title?: React.ReactNode;
  action?: { label: string; href: string };
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-2xl border border-border bg-card shadow-soft ${className}`}>
      <header className="flex items-center justify-between gap-4 border-b border-border px-6 py-4">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            {eyebrow}
          </p>
          {title && <h3 className="mt-0.5 font-display text-lg font-semibold">{title}</h3>}
        </div>
        {action && (
          <Link
            href={action.href}
            className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            {action.label} <ArrowUpRight className="h-3 w-3" />
          </Link>
        )}
      </header>
      <div className="px-6 py-5">{children}</div>
    </section>
  );
}

export function EmptyNote({
  icon: Icon,
  children,
}: {
  icon: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 py-8 text-center text-sm text-muted-foreground">
      <Icon className="h-6 w-6 text-muted-foreground/40" />
      {children}
    </div>
  );
}

/** Thin attendance/progress meter coloured by threshold. */
export function Meter({ value }: { value: number | null }) {
  if (value === null) return <span className="text-xs text-muted-foreground">No data yet</span>;
  const tone = value >= 85 ? 'bg-success' : value >= 75 ? 'bg-warning' : 'bg-destructive';
  return (
    <div className="flex items-center gap-3">
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${value}%` }} />
      </div>
      <span className="w-10 shrink-0 text-right text-xs font-medium tabular-nums">{value}%</span>
    </div>
  );
}

// ─────────────────────────────── Alerts ─────────────────────────────────────

export function AlertsRibbon({ alerts }: { alerts: Alert[] }) {
  if (alerts.length === 0) return null;
  return (
    <section className="space-y-3">
      <header className="flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
          Requires Attention · {alerts.length}
        </p>
        <span className="ml-4 h-px flex-1 bg-border" />
      </header>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {alerts.slice(0, 4).map((alert) => {
          const Icon =
            alert.type === 'fee_due'
              ? IndianRupee
              : alert.type === 'low_attendance'
                ? AlertTriangle
                : alert.type === 'pending_approvals'
                  ? Clock
                  : alert.type === 'upcoming_events'
                    ? CalendarIcon
                    : Bell;
          const tone =
            alert.severity === 'critical'
              ? 'border-destructive/30 bg-destructive/[0.03] hover:bg-destructive/[0.06] text-destructive'
              : alert.severity === 'warning'
                ? 'border-warning/30 bg-warning/[0.03] hover:bg-warning/[0.06] text-warning'
                : 'border-info/30 bg-info/[0.03] hover:bg-info/[0.06] text-info';
          return (
            <Link
              key={alert.id}
              href={alert.link}
              className={`group flex items-center gap-3 rounded-xl border px-4 py-3 transition-all ${tone}`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <div className="min-w-0 flex-1 text-foreground">
                <p className="truncate text-sm font-medium">{alert.title}</p>
                <p className="text-xs text-muted-foreground">{alert.message}</p>
              </div>
              <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </Link>
          );
        })}
      </div>
    </section>
  );
}
