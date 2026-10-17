'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Skeleton } from '@/components/ui/skeleton';
import {
  BookOpen,
  GraduationCap,
  TrendingUp,
  Users,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  Sparkles,
} from 'lucide-react';
import { coursesApi } from '@/lib/api';
import { cn } from '@/lib/utils';

interface Course {
  _id: string;
  title: string;
  category?: string;
  level?: string;
  status?: string;
  duration?: number;
  modules?: unknown[];
  createdAt?: string;
}

interface Enrollment {
  _id: string;
  courseId: string;
  studentId?: string;
  status?: 'enrolled' | 'in_progress' | 'completed' | 'dropped';
  progressPercentage?: number;
}

const STATUS_LABELS: Record<string, string> = {
  enrolled: 'Enrolled',
  in_progress: 'In progress',
  completed: 'Completed',
  dropped: 'Dropped',
};

const STATUS_TONE: Record<string, string> = {
  enrolled: 'from-primary to-accent',
  in_progress: 'from-amber-500 to-orange-400',
  completed: 'from-success to-emerald-400',
  dropped: 'from-muted-foreground/40 to-muted-foreground/30',
};

const formatCategory = (cat: string) =>
  cat
    .split('_')
    .map((w) => w[0]?.toUpperCase() + w.slice(1))
    .join(' ');

export default function CoursesReportsPage() {
  const { data: coursesData, isLoading: coursesLoading } = useQuery({
    queryKey: ['courses', 'reports'],
    queryFn: () => coursesApi.getCourses({ limit: 100 }),
  });

  const { data: enrollmentsData, isLoading: enrollmentsLoading } = useQuery({
    queryKey: ['enrollments', 'reports'],
    queryFn: () => coursesApi.getEnrollments({ limit: 100 }),
  });

  const courses: Course[] = useMemo(
    () => coursesData?.data?.data || coursesData?.data || [],
    [coursesData]
  );
  const enrollments: Enrollment[] = useMemo(
    () => enrollmentsData?.data?.data || enrollmentsData?.data || [],
    [enrollmentsData]
  );

  const stats = useMemo(() => {
    const byStatus: Record<string, number> = {};
    const byCategory: Record<string, number> = {};
    for (const c of courses) {
      const s = c.status || 'draft';
      byStatus[s] = (byStatus[s] || 0) + 1;
      const cat = c.category || 'general';
      byCategory[cat] = (byCategory[cat] || 0) + 1;
    }

    const enrollmentsByStatus: Record<string, number> = {};
    let avgProgress = 0;
    let progressCount = 0;
    for (const e of enrollments) {
      const s = e.status || 'enrolled';
      enrollmentsByStatus[s] = (enrollmentsByStatus[s] || 0) + 1;
      if (typeof e.progressPercentage === 'number') {
        avgProgress += e.progressPercentage;
        progressCount += 1;
      }
    }

    const enrollmentsByCourse = new Map<string, number>();
    for (const e of enrollments) {
      enrollmentsByCourse.set(e.courseId, (enrollmentsByCourse.get(e.courseId) || 0) + 1);
    }
    const topCourses = courses
      .map((c) => ({ ...c, enrollmentCount: enrollmentsByCourse.get(c._id) || 0 }))
      .sort((a, b) => b.enrollmentCount - a.enrollmentCount)
      .slice(0, 5);

    return {
      totalCourses: courses.length,
      published: byStatus.published || 0,
      drafts: byStatus.draft || 0,
      totalEnrollments: enrollments.length,
      completedEnrollments: enrollmentsByStatus.completed || 0,
      avgProgress: progressCount > 0 ? Math.round(avgProgress / progressCount) : 0,
      byCategory,
      enrollmentsByStatus,
      topCourses,
    };
  }, [courses, enrollments]);

  const isLoading = coursesLoading || enrollmentsLoading;
  const completionRate =
    stats.totalEnrollments > 0
      ? Math.round((stats.completedEnrollments / stats.totalEnrollments) * 100)
      : 0;

  return (
    <div className="space-y-8 pb-12">
      {/* ─── Header ─── */}
      <header className="space-y-1.5">
        <div className="flex items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
          <Sparkles className="h-3 w-3 text-accent" />
          <span>Course Insights</span>
        </div>
        <h1 className="font-display text-3xl font-bold tracking-tight md:text-4xl">
          Course reports
        </h1>
        <p className="text-sm text-muted-foreground">
          A quick read on what&apos;s in your catalogue, who&apos;s learning, and how far
          they&apos;ve gotten.
        </p>
      </header>

      {isLoading ? (
        <div className="space-y-6">
          <Skeleton className="h-32 rounded-2xl" />
          <div className="grid gap-6 md:grid-cols-2">
            <Skeleton className="h-72 rounded-2xl" />
            <Skeleton className="h-72 rounded-2xl" />
          </div>
        </div>
      ) : courses.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          {/* ─── Hero KPI Strip ─── */}
          <section className="relative overflow-hidden rounded-2xl border bg-card shadow-soft">
            <div className="pointer-events-none absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
            <div className="grid grid-cols-1 divide-y divide-border md:grid-cols-2 md:divide-x md:divide-y-0 lg:grid-cols-4">
              <KPI
                label="Courses"
                value={stats.totalCourses}
                footnote={
                  <>
                    <span className="font-medium tabular-nums text-success">{stats.published}</span>{' '}
                    published ·{' '}
                    <span className="font-medium tabular-nums text-warning">{stats.drafts}</span> in
                    draft
                  </>
                }
                icon={BookOpen}
                serial="01"
              />
              <KPI
                label="Enrollments"
                value={stats.totalEnrollments}
                footnote={
                  stats.totalEnrollments > 0
                    ? `Across ${stats.topCourses.filter((c) => c.enrollmentCount > 0).length} course${stats.topCourses.filter((c) => c.enrollmentCount > 0).length === 1 ? '' : 's'}`
                    : 'No enrollments yet'
                }
                icon={Users}
                serial="02"
                accent
              />
              <KPI
                label="Completed"
                value={stats.completedEnrollments}
                footnote={stats.totalEnrollments > 0 ? `${completionRate}% completion rate` : '—'}
                icon={CheckCircle2}
                serial="03"
                tone="success"
              />
              <KPI
                label="Avg progress"
                value={`${stats.avgProgress}%`}
                footnote={stats.totalEnrollments > 0 ? 'Across all enrollments' : '—'}
                icon={TrendingUp}
                serial="04"
              />
            </div>
          </section>

          {/* ─── Two-column breakdown ─── */}
          <div className="grid gap-6 lg:grid-cols-2">
            <BreakdownPanel
              title="By category"
              subtitle="Distribution of courses across your catalogue"
              total={stats.totalCourses}
              entries={Object.entries(stats.byCategory)
                .sort((a, b) => b[1] - a[1])
                .map(([k, v]) => ({
                  key: k,
                  label: formatCategory(k),
                  count: v,
                  percent: stats.totalCourses > 0 ? (v / stats.totalCourses) * 100 : 0,
                  toneClass: 'from-primary to-accent',
                }))}
            />

            <BreakdownPanel
              title="Enrollment journey"
              subtitle="Where learners are in your courses"
              total={stats.totalEnrollments}
              emptyMessage="No enrollments yet."
              entries={Object.entries(stats.enrollmentsByStatus)
                .sort((a, b) => b[1] - a[1])
                .map(([k, v]) => ({
                  key: k,
                  label: STATUS_LABELS[k] ?? k,
                  count: v,
                  percent: stats.totalEnrollments > 0 ? (v / stats.totalEnrollments) * 100 : 0,
                  toneClass: STATUS_TONE[k] ?? 'from-primary to-accent',
                }))}
            />
          </div>

          {/* ─── Top courses ─── */}
          <section className="rounded-2xl border bg-card shadow-soft">
            <header className="flex items-end justify-between border-b px-6 py-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                  Most enrolled
                </p>
                <h2 className="font-display text-lg font-semibold mt-0.5">
                  Top courses by enrollment
                </h2>
              </div>
              <Link
                href="/courses"
                className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                Open catalogue <ArrowUpRight className="h-3 w-3" />
              </Link>
            </header>
            <div className="px-6 py-4">
              {stats.topCourses.every((c) => c.enrollmentCount === 0) ? (
                <p className="py-6 text-center text-sm italic text-muted-foreground">
                  No enrollments to rank yet. Once students start enrolling, the leaderboard will
                  populate here.
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {stats.topCourses.map((c, i) => (
                    <li key={c._id}>
                      <Link
                        href={`/courses/${c._id}`}
                        className="group flex items-center gap-4 py-3 transition-colors hover:bg-muted/30 rounded-lg px-2 -mx-2"
                      >
                        <span className="font-mono text-[10px] font-bold tabular-nums text-muted-foreground/70 w-6">
                          #{i + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="truncate text-sm font-medium group-hover:text-primary transition-colors">
                            {c.title}
                          </p>
                          <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                            <span className="capitalize">
                              {(c.category || 'general').replace(/_/g, ' ')}
                            </span>
                            <span className="text-muted-foreground/40">·</span>
                            <span className="capitalize">{c.level || 'beginner'}</span>
                            {c.duration ? (
                              <>
                                <span className="text-muted-foreground/40">·</span>
                                <span className="inline-flex items-center gap-1 tabular-nums">
                                  <Clock className="h-3 w-3" />
                                  {c.duration}h
                                </span>
                              </>
                            ) : null}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 text-right shrink-0">
                          <div>
                            <p className="font-display text-lg font-bold tabular-nums leading-none">
                              {c.enrollmentCount}
                            </p>
                            <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                              enrolled
                            </p>
                          </div>
                          <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

// ──────────────────────────── Sub-components ────────────────────────────

function KPI({
  label,
  value,
  footnote,
  icon: Icon,
  serial,
  accent,
  tone,
}: {
  label: string;
  value: string | number;
  footnote: React.ReactNode;
  icon: React.ElementType;
  serial: string;
  accent?: boolean;
  tone?: 'success';
}) {
  return (
    <div
      className={cn(
        'relative flex flex-col gap-3 px-6 py-7',
        accent && 'bg-gradient-to-br from-primary/5 via-transparent to-transparent'
      )}
    >
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
          {label}
        </p>
        <Icon
          className={cn(
            'h-3.5 w-3.5',
            accent
              ? 'text-primary'
              : tone === 'success'
                ? 'text-success/70'
                : 'text-muted-foreground'
          )}
        />
      </div>
      <p
        className={cn(
          'font-display text-[44px] font-bold leading-none tracking-tight tabular-nums',
          accent ? 'text-primary' : tone === 'success' ? 'text-success' : 'text-foreground'
        )}
      >
        {value}
      </p>
      <div className="text-xs text-muted-foreground">{footnote}</div>
      <span className="absolute right-5 top-2 font-mono text-[10px] text-muted-foreground/40">
        {serial}
      </span>
    </div>
  );
}

interface BreakdownEntry {
  key: string;
  label: string;
  count: number;
  percent: number;
  toneClass: string;
}

function BreakdownPanel({
  title,
  subtitle,
  total,
  entries,
  emptyMessage,
}: {
  title: string;
  subtitle: string;
  total: number;
  entries: BreakdownEntry[];
  emptyMessage?: string;
}) {
  return (
    <section className="rounded-2xl border bg-card shadow-soft">
      <header className="flex items-baseline justify-between border-b px-6 py-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            {title}
          </p>
          <h3 className="font-display text-lg font-semibold mt-0.5">{subtitle}</h3>
        </div>
        {total > 0 && <span className="font-display text-2xl font-bold tabular-nums">{total}</span>}
      </header>
      <div className="px-6 py-5">
        {entries.length === 0 ? (
          <p className="py-6 text-center text-sm italic text-muted-foreground">
            {emptyMessage ?? 'No data yet.'}
          </p>
        ) : (
          <ul className="space-y-3.5">
            {entries.map((e) => (
              <li key={e.key} className="space-y-1.5">
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="text-foreground">{e.label}</span>
                  <span className="flex items-baseline gap-2 text-xs text-muted-foreground tabular-nums">
                    <span className="font-display text-base font-semibold text-foreground">
                      {e.count}
                    </span>
                    <span>· {Math.round(e.percent)}%</span>
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted/60">
                  <div
                    className={cn(
                      'h-full rounded-full bg-gradient-to-r transition-all duration-500',
                      e.toneClass
                    )}
                    style={{ width: `${Math.max(2, e.percent)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border-2 border-dashed bg-card/40 p-12 text-center">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
        <BookOpen className="h-8 w-8 text-primary" />
      </div>
      <h2 className="font-display text-lg font-semibold">Nothing to report yet</h2>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
        Once you create courses and enrol students, this page will surface enrollment counts,
        completion rates, and category breakdowns.
      </p>
      <Link
        href="/courses/new"
        className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
      >
        <GraduationCap className="h-4 w-4" />
        Create your first course
        <ArrowUpRight className="h-4 w-4" />
      </Link>
    </div>
  );
}
