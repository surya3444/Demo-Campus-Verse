'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Inbox, AlertCircle, Mail, Phone, FileText, ExternalLink, Search } from 'lucide-react';
import {
  careerApplicationsApi,
  vacanciesApi,
  type CareerApplication,
  type ApplicationStatus,
  type Vacancy,
} from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

type Filter = 'all' | ApplicationStatus;

const STATUS_LABEL: Record<ApplicationStatus, string> = {
  new: 'New',
  in_review: 'In review',
  shortlisted: 'Shortlisted',
  interviewing: 'Interviewing',
  offered: 'Offered',
  hired: 'Hired',
  rejected: 'Rejected',
};

const STATUS_VARIANT: Record<
  ApplicationStatus,
  'default' | 'success' | 'secondary' | 'destructive' | 'outline'
> = {
  new: 'default',
  in_review: 'secondary',
  shortlisted: 'secondary',
  interviewing: 'secondary',
  offered: 'success',
  hired: 'success',
  rejected: 'destructive',
};

const FILTERS: Filter[] = [
  'all',
  'new',
  'in_review',
  'shortlisted',
  'interviewing',
  'offered',
  'hired',
  'rejected',
];

function formatDate(input?: string) {
  if (!input) return '—';
  return new Date(input).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function ApplicationsPage() {
  const [apps, setApps] = useState<CareerApplication[]>([]);
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [vacancyFilter, setVacancyFilter] = useState<string>('all');
  const [search, setSearch] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [appsRes, vacanciesRes] = await Promise.all([
        careerApplicationsApi.list(),
        vacanciesApi.list(),
      ]);
      if (appsRes.success) setApps(appsRes.data);
      if (vacanciesRes.success) setVacancies(vacanciesRes.data);
    } catch (err) {
      console.error(err);
      setError('Failed to load applications');
      toast.error('Failed to load applications');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const counts = useMemo(() => {
    const acc: Record<Filter, number> = {
      all: apps.length,
      new: 0,
      in_review: 0,
      shortlisted: 0,
      interviewing: 0,
      offered: 0,
      hired: 0,
      rejected: 0,
    };
    apps.forEach((a) => {
      acc[a.status] += 1;
    });
    return acc;
  }, [apps]);

  const visible = useMemo(() => {
    return apps.filter((a) => {
      if (filter !== 'all' && a.status !== filter) return false;
      if (vacancyFilter !== 'all' && a.vacancyId !== vacancyFilter) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        return (
          a.fullName.toLowerCase().includes(q) ||
          a.email.toLowerCase().includes(q) ||
          a.phone.toLowerCase().includes(q) ||
          a.vacancyTitle.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [apps, filter, vacancyFilter, search]);

  return (
    <div className="space-y-8 pb-12">
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
        <div className="relative space-y-2">
          <div className="flex items-center gap-2.5 text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
            <Inbox className="h-3 w-3 shrink-0 text-[hsl(var(--brand-cyan))]" />
            <span>Careers · Applications</span>
          </div>
          <h1 className="font-display text-4xl font-bold leading-[1.15] tracking-tight text-foreground md:text-5xl">
            People who{' '}
            <span className="bg-gradient-to-r from-primary via-primary to-[hsl(var(--brand-cyan))] bg-clip-text text-transparent">
              applied.
            </span>
          </h1>
          <p className="max-w-xl text-sm text-muted-foreground">
            Review candidates, open their resumes, and move them through your hiring pipeline.
          </p>
        </div>
      </header>

      {/* Filters */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                'inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-medium capitalize transition-colors',
                filter === f
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-card text-muted-foreground hover:text-foreground hover:border-foreground/30'
              )}
            >
              {f === 'all' ? 'All' : STATUS_LABEL[f]}
              <span
                className={cn(
                  'rounded-full px-1.5 text-[10px] tabular-nums',
                  filter === f ? 'bg-white/20' : 'bg-muted'
                )}
              >
                {counts[f]}
              </span>
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, email, phone, role…"
              className="w-full rounded-xl border border-border bg-card py-2 pl-9 pr-3 text-sm placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none"
            />
          </div>
          <select
            value={vacancyFilter}
            onChange={(e) => setVacancyFilter(e.target.value)}
            className="cursor-pointer rounded-xl border border-border bg-card px-3 py-2 text-sm font-medium text-foreground focus:border-primary focus:outline-none"
          >
            <option value="all">All vacancies</option>
            {vacancies.map((v) => (
              <option key={v.id} value={v.id}>
                {v.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
          <AlertCircle className="h-4 w-4 text-destructive" />
          <p className="flex-1 text-sm text-destructive">{error}</p>
          <Button variant="outline" size="sm" onClick={fetchData}>
            Retry
          </Button>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-2xl" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-border py-20">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-secondary">
            <Inbox className="h-7 w-7 text-muted-foreground" />
          </div>
          <div className="text-center">
            <p className="font-medium text-foreground">No applications</p>
            <p className="text-sm text-muted-foreground">
              When candidates apply, they&apos;ll show up here.
            </p>
          </div>
        </div>
      ) : (
        <ul className="space-y-3">
          {visible.map((a) => (
            <li
              key={a.id}
              className="group flex items-center gap-4 rounded-2xl border border-border bg-card p-4 shadow-soft transition-colors hover:border-foreground/15"
            >
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-gradient-to-br from-primary/10 to-[hsl(var(--brand-cyan))]/15 font-display text-lg font-bold text-primary">
                {a.fullName.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/careers/applications/${a.id}`}
                    className="truncate font-display text-base font-semibold text-foreground hover:text-primary"
                  >
                    {a.fullName}
                  </Link>
                  <Badge variant={STATUS_VARIANT[a.status]} className="capitalize">
                    {STATUS_LABEL[a.status]}
                  </Badge>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground/70">{a.vacancyTitle}</span>
                  <span>·</span>
                  <span className="inline-flex items-center gap-1">
                    <Mail className="h-3 w-3" />
                    {a.email}
                  </span>
                  <span>·</span>
                  <span className="inline-flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    {a.phone}
                  </span>
                  <span>·</span>
                  <span>Applied {formatDate(a.createdAt)}</span>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button variant="ghost" size="sm" asChild title="Open resume">
                  <a href={a.resumeUrl} target="_blank" rel="noopener noreferrer">
                    <FileText className="h-4 w-4" />
                    <span className="hidden md:inline">Resume</span>
                    <ExternalLink className="h-3 w-3 opacity-60" />
                  </a>
                </Button>
                <Button variant="ghost" size="sm" asChild>
                  <Link href={`/careers/applications/${a.id}`}>Open</Link>
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
