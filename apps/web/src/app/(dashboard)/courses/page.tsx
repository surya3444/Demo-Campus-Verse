'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { coursesApi } from '@/lib/api';
import { usePermissions } from '@/hooks/usePermissions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Plus,
  Search,
  MoreHorizontal,
  Eye,
  Edit,
  Trash2,
  Globe,
  BookOpen,
  PlayCircle,
  ArrowUpRight,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const CATEGORY_LABELS: Record<string, string> = {
  technical: 'Technical',
  soft_skills: 'Soft Skills',
  aptitude: 'Aptitude',
  language: 'Language',
  domain_specific: 'Domain Specific',
  certification_prep: 'Certification Prep',
  career_readiness: 'Career Readiness',
  general: 'General',
};

const LEVEL_LABELS: Record<string, string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
};

// Distinctive cover art per course — pick a deterministic gradient based on
// the course id so the grid feels alive without thumbnails.
const COVER_GRADIENTS = [
  'from-indigo-500 via-blue-500 to-cyan-400',
  'from-rose-500 via-pink-500 to-orange-400',
  'from-emerald-500 via-teal-500 to-cyan-400',
  'from-violet-500 via-purple-500 to-fuchsia-400',
  'from-amber-500 via-orange-500 to-rose-400',
  'from-sky-500 via-indigo-500 to-violet-400',
  'from-lime-500 via-emerald-500 to-teal-400',
  'from-fuchsia-500 via-pink-500 to-rose-400',
];

function pickCover(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % COVER_GRADIENTS.length;
  return COVER_GRADIENTS[h] ?? COVER_GRADIENTS[0] ?? '';
}

interface Course {
  _id: string;
  courseNumber?: string;
  title: string;
  description?: string;
  category: string;
  level: string;
  status: 'draft' | 'published' | 'archived';
  visibility: 'branch' | 'all' | 'selected_branches';
  modules?: Array<{ _id: string }>;
  duration?: number;
  instructor?: string;
}

export default function CoursesPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string>('');
  const [category, setCategory] = useState<string>('');
  const [level, setLevel] = useState<string>('');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['courses', { page, search, status, category, level }],
    queryFn: () =>
      coursesApi.getCourses({
        page,
        limit: 24,
        ...(search && { search }),
        ...(status && { status }),
        ...(category && { category }),
        ...(level && { level }),
      }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => coursesApi.deleteCourse(id),
    onSuccess: () => {
      toast.success('Course deleted');
      queryClient.invalidateQueries({ queryKey: ['courses'] });
      setDeleteId(null);
    },
    onError: (error: unknown) => {
      const msg =
        (error as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
          ?.message ?? 'Failed to delete course';
      toast.error(msg);
    },
  });

  const courses = (data?.data ?? []) as Course[];
  const meta = data?.meta as { total: number; hasMore: boolean } | undefined;
  const filtersActive = !!(search || status || category || level);

  // Quick aggregate stats
  const publishedCount = courses.filter((c) => c.status === 'published').length;
  const draftCount = courses.filter((c) => c.status === 'draft').length;

  return (
    <div className="space-y-8 pb-12">
      {/* ─── Page heading ─── */}
      <header className="space-y-1.5">
        <div className="flex items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
          <Sparkles className="h-3 w-3 text-accent" />
          <span>Online Learning</span>
        </div>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight md:text-4xl">Courses</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Build, publish, and track every course your school offers — from foundations to
              advanced electives.
            </p>
          </div>
          {hasPermission('courses.courses', 'create') && (
            <Link href="/courses/new">
              <Button size="lg" className="gap-2">
                <Plus className="h-4 w-4" />
                New course
              </Button>
            </Link>
          )}
        </div>
      </header>

      {/* ─── Stats strip ─── */}
      {!isLoading && courses.length > 0 && (
        <div className="grid grid-cols-3 divide-x divide-border overflow-hidden rounded-2xl border bg-card shadow-soft">
          <Stat label="Total courses" value={meta?.total ?? courses.length} />
          <Stat label="Published" value={publishedCount} accent="success" />
          <Stat label="In draft" value={draftCount} accent="warning" />
        </div>
      )}

      {/* ─── Filters ─── */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search courses by title or instructor…"
            className="pl-10"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Select
            value={status || 'all'}
            onValueChange={(v) => {
              setStatus(v === 'all' ? '' : v);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All status</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="published">Published</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={category || 'all'}
            onValueChange={(v) => {
              setCategory(v === 'all' ? '' : v);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[170px]">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={level || 'all'}
            onValueChange={(v) => {
              setLevel(v === 'all' ? '' : v);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Level" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All levels</SelectItem>
              {Object.entries(LEVEL_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* ─── Course grid ─── */}
      {isLoading ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-[280px] rounded-2xl" />
          ))}
        </div>
      ) : courses.length === 0 ? (
        <EmptyState filtersActive={filtersActive} />
      ) : (
        <>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {courses.map((course) => (
              <CourseCard
                key={course._id}
                course={course}
                onView={() => router.push(`/courses/${course._id}`)}
                onEdit={
                  hasPermission('courses.courses', 'edit')
                    ? () => router.push(`/courses/${course._id}/edit`)
                    : undefined
                }
                onManageVisibility={
                  hasPermission('courses.courses', 'approve')
                    ? () => router.push(`/courses/${course._id}?manageVisibility=true`)
                    : undefined
                }
                onDelete={
                  hasPermission('courses.courses', 'delete')
                    ? () => setDeleteId(course._id)
                    : undefined
                }
              />
            ))}
          </div>

          {meta && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
              <p className="text-sm text-muted-foreground">
                Showing{' '}
                <span className="font-medium tabular-nums text-foreground">{courses.length}</span>{' '}
                of <span className="tabular-nums">{meta.total}</span> course
                {meta.total === 1 ? '' : 's'}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!meta.hasMore}
                  onClick={() => setPage(page + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this course?</AlertDialogTitle>
            <AlertDialogDescription>
              The course and all its lessons, quizzes, and enrollments will be removed. This cannot
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─────────────────────────── Stat ────────────────────────────

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: 'success' | 'warning';
}) {
  return (
    <div className="px-6 py-5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          'font-display text-3xl font-bold tabular-nums leading-none mt-1.5',
          accent === 'success' && 'text-success',
          accent === 'warning' && 'text-warning'
        )}
      >
        {value.toLocaleString()}
      </p>
    </div>
  );
}

// ─────────────────────────── Card ────────────────────────────

function CourseCard({
  course,
  onView,
  onEdit,
  onManageVisibility,
  onDelete,
}: {
  course: Course;
  onView: () => void;
  onEdit?: () => void;
  onManageVisibility?: () => void;
  onDelete?: () => void;
}) {
  const moduleCount = course.modules?.length ?? 0;
  const cover = pickCover(course._id);

  const STATUS_PILL: Record<Course['status'], { label: string; className: string }> = {
    draft: {
      label: 'Draft',
      className: 'border-warning/30 bg-warning/10 text-warning',
    },
    published: {
      label: 'Published',
      className: 'border-success/30 bg-success/10 text-success',
    },
    archived: {
      label: 'Archived',
      className: 'border-muted-foreground/20 bg-muted/40 text-muted-foreground',
    },
  };

  const VISIBILITY_LABEL: Record<Course['visibility'], string> = {
    branch: 'Branch only',
    all: 'Org-wide',
    selected_branches: 'Multi-branch',
  };

  const statusPill = STATUS_PILL[course.status];

  return (
    <article
      className="group relative flex flex-col overflow-hidden rounded-2xl border bg-card transition-all hover:shadow-soft-md hover:-translate-y-0.5"
      onClick={onView}
    >
      {/* Cover */}
      <button
        type="button"
        onClick={onView}
        className="relative aspect-[16/9] w-full overflow-hidden focus:outline-none"
        aria-label={`Open ${course.title}`}
      >
        <div className={cn('absolute inset-0 bg-gradient-to-br', cover)} />
        {/* Subtle texture */}
        <div
          className="absolute inset-0 opacity-30 mix-blend-overlay"
          style={{
            backgroundImage:
              'radial-gradient(circle at 30% 20%, rgba(255,255,255,0.4), transparent 50%), radial-gradient(circle at 70% 80%, rgba(0,0,0,0.2), transparent 50%)',
          }}
        />
        {/* Course number watermark */}
        {course.courseNumber && (
          <span className="absolute right-4 top-3 font-mono text-[10px] font-medium tracking-widest text-white/60">
            {course.courseNumber}
          </span>
        )}
        {/* Play badge */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/95 shadow-lg backdrop-blur-sm">
            <PlayCircle className="h-7 w-7 text-foreground" />
          </div>
        </div>
        {/* Bottom gradient */}
        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/40 to-transparent" />
        {/* Status pill */}
        <span
          className={cn(
            'absolute bottom-3 left-4 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider backdrop-blur-md',
            statusPill.className
          )}
        >
          {statusPill.label}
        </span>
      </button>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-3 p-5">
        {/* Category + level eyebrow */}
        <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          <span>{CATEGORY_LABELS[course.category] ?? course.category}</span>
          <span className="h-1 w-1 rounded-full bg-muted-foreground/40" />
          <span>{LEVEL_LABELS[course.level] ?? course.level}</span>
        </div>

        {/* Title */}
        <button type="button" onClick={onView} className="text-left focus:outline-none">
          <h3 className="font-display text-lg font-semibold leading-snug tracking-tight transition-colors group-hover:text-primary line-clamp-2">
            {course.title}
          </h3>
        </button>

        {course.description && (
          <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">
            {course.description}
          </p>
        )}

        {/* Footer */}
        <div className="mt-auto flex items-center justify-between border-t pt-3 text-xs">
          <div className="flex items-center gap-3 text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <BookOpen className="h-3.5 w-3.5" />
              <span className="tabular-nums">{moduleCount}</span> module
              {moduleCount === 1 ? '' : 's'}
            </span>
            <span className="inline-flex items-center gap-1">
              <TrendingUp className="h-3.5 w-3.5" />
              {VISIBILITY_LABEL[course.visibility]}
            </span>
          </div>
          <div onClick={(e) => e.stopPropagation()}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="More actions">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onView}>
                  <Eye className="mr-2 h-4 w-4" />
                  View
                </DropdownMenuItem>
                {onEdit && (
                  <DropdownMenuItem onClick={onEdit}>
                    <Edit className="mr-2 h-4 w-4" />
                    Edit
                  </DropdownMenuItem>
                )}
                {onManageVisibility && (
                  <DropdownMenuItem onClick={onManageVisibility}>
                    <Globe className="mr-2 h-4 w-4" />
                    Visibility
                  </DropdownMenuItem>
                )}
                {onDelete && (
                  <DropdownMenuItem className="text-destructive" onClick={onDelete}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Hover overlay arrow */}
      <span className="pointer-events-none absolute right-5 top-5 opacity-0 transition-opacity group-hover:opacity-100">
        <ArrowUpRight className="h-4 w-4 text-white drop-shadow" />
      </span>
    </article>
  );
}

// ─────────────────────────── Empty state ────────────────────────────

function EmptyState({ filtersActive }: { filtersActive: boolean }) {
  return (
    <div className="rounded-2xl border-2 border-dashed bg-card/40 p-12 text-center">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
        <BookOpen className="h-8 w-8 text-primary" />
      </div>
      {filtersActive ? (
        <>
          <h3 className="font-display text-lg font-semibold">No courses match your filters</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Try clearing a filter or two — or search by a different keyword.
          </p>
        </>
      ) : (
        <>
          <h3 className="font-display text-lg font-semibold">No courses yet</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Build your first course — add modules, lessons, and quizzes, then publish to your
            branch.
          </p>
          <Link href="/courses/new" className="mt-5 inline-block">
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Create the first course
            </Button>
          </Link>
        </>
      )}
    </div>
  );
}
