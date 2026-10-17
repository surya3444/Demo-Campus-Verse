'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  Plus,
  Briefcase,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  MapPin,
  AlertCircle,
  Lock,
} from 'lucide-react';
import { vacanciesApi, type Vacancy, type VacancyStatus } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

type Filter = 'all' | VacancyStatus;

const EMPLOYMENT_LABEL: Record<string, string> = {
  full_time: 'Full-time',
  part_time: 'Part-time',
  contract: 'Contract',
  internship: 'Internship',
};

const WORK_MODE_LABEL: Record<string, string> = {
  onsite: 'Onsite',
  remote: 'Remote',
  hybrid: 'Hybrid',
};

function formatDate(input?: string) {
  if (!input) return '—';
  return new Date(input).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function VacanciesPage() {
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [busyId, setBusyId] = useState<string | null>(null);

  const fetchVacancies = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await vacanciesApi.list();
      if (res.success) setVacancies(res.data);
    } catch (err) {
      console.error(err);
      setError('Failed to load vacancies');
      toast.error('Failed to load vacancies');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchVacancies();
  }, [fetchVacancies]);

  const cycleStatus = async (v: Vacancy) => {
    const next: VacancyStatus =
      v.status === 'draft' ? 'published' : v.status === 'published' ? 'closed' : 'draft';
    setBusyId(v.id);
    try {
      await vacanciesApi.setStatus(v.id, next);
      setVacancies((prev) => prev.map((p) => (p.id === v.id ? { ...p, status: next } : p)));
      toast.success(`Vacancy ${next}`);
    } catch {
      toast.error('Failed to update status');
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (v: Vacancy) => {
    if (!confirm(`Delete "${v.title}"? This cannot be undone.`)) return;
    setBusyId(v.id);
    try {
      await vacanciesApi.remove(v.id);
      setVacancies((prev) => prev.filter((p) => p.id !== v.id));
      toast.success('Vacancy deleted');
    } catch {
      toast.error('Failed to delete vacancy');
    } finally {
      setBusyId(null);
    }
  };

  const counts = {
    all: vacancies.length,
    draft: vacancies.filter((v) => v.status === 'draft').length,
    published: vacancies.filter((v) => v.status === 'published').length,
    closed: vacancies.filter((v) => v.status === 'closed').length,
  };
  const visible = filter === 'all' ? vacancies : vacancies.filter((v) => v.status === filter);

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
        <div className="relative flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="space-y-2 min-w-0">
            <div className="flex items-center gap-2.5 text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
              <Briefcase className="h-3 w-3 shrink-0 text-[hsl(var(--brand-cyan))]" />
              <span>Careers · Vacancies</span>
            </div>
            <h1 className="font-display text-4xl font-bold leading-[1.15] tracking-tight text-foreground md:text-5xl">
              Open{' '}
              <span className="bg-gradient-to-r from-primary via-primary to-[hsl(var(--brand-cyan))] bg-clip-text text-transparent">
                roles.
              </span>
            </h1>
            <p className="max-w-xl text-sm text-muted-foreground">
              Author the job descriptions that appear on the public careers page.
            </p>
          </div>
          <Button asChild className="shrink-0">
            <Link href="/careers/vacancies/new">
              <Plus className="h-4 w-4" />
              New vacancy
            </Link>
          </Button>
        </div>
      </header>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        {(['all', 'published', 'draft', 'closed'] as Filter[]).map((f) => (
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
            {f}
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

      {error && (
        <div className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
          <AlertCircle className="h-4 w-4 text-destructive" />
          <p className="flex-1 text-sm text-destructive">{error}</p>
          <Button variant="outline" size="sm" onClick={fetchVacancies}>
            Retry
          </Button>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-2xl" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-border py-20">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-secondary">
            <Briefcase className="h-7 w-7 text-muted-foreground" />
          </div>
          <div className="text-center">
            <p className="font-medium text-foreground">
              {filter === 'all' ? 'No vacancies yet' : `No ${filter} vacancies`}
            </p>
            <p className="text-sm text-muted-foreground">
              Publish your first vacancy to make it visible on the careers page.
            </p>
          </div>
          <Button asChild>
            <Link href="/careers/vacancies/new">
              <Plus className="h-4 w-4" /> New vacancy
            </Link>
          </Button>
        </div>
      ) : (
        <ul className="space-y-3">
          {visible.map((v) => (
            <li
              key={v.id}
              className="group flex items-center gap-4 rounded-2xl border border-border bg-card p-4 shadow-soft transition-colors hover:border-foreground/15"
            >
              <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-xl bg-gradient-to-br from-[hsl(var(--brand-cyan))]/15 to-transparent text-muted-foreground">
                <Briefcase className="h-5 w-5" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/careers/vacancies/${v.id}`}
                    className="truncate font-display text-base font-semibold text-foreground hover:text-primary"
                  >
                    {v.title}
                  </Link>
                  <Badge
                    variant={
                      v.status === 'published'
                        ? 'success'
                        : v.status === 'closed'
                          ? 'secondary'
                          : 'secondary'
                    }
                    className="capitalize"
                  >
                    {v.status}
                  </Badge>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground/70">{v.department}</span>
                  <span>·</span>
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {v.location}
                  </span>
                  <span>·</span>
                  <span>{EMPLOYMENT_LABEL[v.employmentType] ?? v.employmentType}</span>
                  <span>·</span>
                  <span>{WORK_MODE_LABEL[v.workMode] ?? v.workMode}</span>
                  <span>·</span>
                  <span>
                    {v.status === 'published'
                      ? `Published ${formatDate(v.publishedAt)}`
                      : `Updated ${formatDate(v.updatedAt)}`}
                  </span>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => cycleStatus(v)}
                  disabled={busyId === v.id}
                  title={
                    v.status === 'draft'
                      ? 'Publish'
                      : v.status === 'published'
                        ? 'Close vacancy'
                        : 'Re-open as draft'
                  }
                >
                  {v.status === 'draft' ? (
                    <Eye className="h-4 w-4" />
                  ) : v.status === 'published' ? (
                    <Lock className="h-4 w-4" />
                  ) : (
                    <EyeOff className="h-4 w-4" />
                  )}
                  <span className="hidden md:inline">
                    {v.status === 'draft'
                      ? 'Publish'
                      : v.status === 'published'
                        ? 'Close'
                        : 'Reopen'}
                  </span>
                </Button>
                <Button variant="ghost" size="icon-sm" asChild title="Edit">
                  <Link href={`/careers/vacancies/${v.id}`}>
                    <Pencil className="h-4 w-4" />
                  </Link>
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => remove(v)}
                  disabled={busyId === v.id}
                  title="Delete"
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
