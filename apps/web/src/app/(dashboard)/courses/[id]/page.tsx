'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { coursesApi, uploadApi } from '@/lib/api';
import { usePermissions } from '@/hooks/usePermissions';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  ArrowLeft,
  Edit,
  ChevronDown,
  Video,
  FileText,
  Radio,
  ClipboardList,
  Clock,
  Circle,
  CheckCircle2,
  PlayCircle,
  BookOpen,
  ArrowRight,
  ArrowLeftFromLine,
  Sparkles,
  Lock,
  GraduationCap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// ──────────────────────────── Types & Constants ────────────────────────────

type LessonType = 'video' | 'document' | 'live';

interface Lesson {
  _id: string;
  title: string;
  description?: string;
  type: LessonType;
  contentUrl?: string;
  contentHtml?: string;
  duration?: number;
  difficulty?: string;
  moduleId?: string;
  order?: number;
  isPreview?: boolean;
  isFree?: boolean;
}

interface Quiz {
  _id: string;
  title: string;
  moduleId?: string;
  questions?: Array<unknown>;
}

interface Module {
  _id: string;
  title: string;
  description?: string;
  order?: number;
}

interface Course {
  _id: string;
  title: string;
  description?: string;
  instructor?: string;
  level?: string;
  duration?: number;
  modules?: Module[];
}

const TYPE_ICON: Record<LessonType, React.ElementType> = {
  video: Video,
  document: FileText,
  live: Radio,
};

const TYPE_HUE: Record<LessonType, string> = {
  video: 'text-primary',
  document: 'text-amber-600',
  live: 'text-rose-500',
};

const TYPE_LABEL: Record<LessonType, string> = {
  video: 'Video',
  document: 'Document',
  live: 'Live',
};

// ──────────────────────────── Helpers ────────────────────────────

const formatDuration = (mins?: number) => {
  if (!mins || mins <= 0) return '';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${hours}h` : `${hours}h ${m}m`;
};

const isEmbeddable = (url: string): boolean =>
  /youtube\.com|youtu\.be|vimeo\.com|wistia\.com/.test(url);

const toEmbedUrl = (url: string): string => {
  const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]+)/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}?rel=0&modestbranding=1`;
  const vimeo = url.match(/vimeo\.com\/(\d+)/);
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}?dnt=1`;
  return url;
};

const isHttpUrl = (s: string) => /^https?:\/\//.test(s);

// ──────────────────────────── Progress (localStorage) ────────────────────────────

const progressKey = (courseId: string) => `course-progress:${courseId}`;

function readProgress(courseId: string): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(progressKey(courseId));
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as { completed?: string[] };
    return new Set(parsed.completed ?? []);
  } catch {
    return new Set();
  }
}

function writeProgress(courseId: string, completed: Set<string>) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(
      progressKey(courseId),
      JSON.stringify({ completed: Array.from(completed) })
    );
  } catch {
    /* ignore quota */
  }
}

// ──────────────────────────── Page ────────────────────────────

export default function CourseViewPage() {
  const params = useParams();
  const courseId = params.id as string;
  const { hasPermission } = usePermissions();
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [completed, setCompleted] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (courseId) setCompleted(readProgress(courseId));
  }, [courseId]);

  const { data: courseData, isLoading: courseLoading } = useQuery({
    queryKey: ['course', courseId],
    queryFn: () => coursesApi.getCourse(courseId),
  });

  const { data: lessonsData, isLoading: lessonsLoading } = useQuery({
    queryKey: ['lessons', courseId],
    queryFn: () => coursesApi.getLessons(courseId, { limit: 100 }),
  });

  const { data: quizzesData } = useQuery({
    queryKey: ['quizzes', courseId],
    queryFn: () => coursesApi.getQuizzes(courseId, { limit: 100 }),
  });

  const course = (courseData?.data ?? null) as Course | null;
  const allLessons = (lessonsData?.data ?? []) as Lesson[];
  const allQuizzes = (quizzesData?.data ?? []) as Quiz[];
  const modules = course?.modules ?? [];

  const orderedLessons = useMemo<Lesson[]>(() => {
    if (modules.length === 0) {
      return [...allLessons].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    }
    const sortedMods = [...modules].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const flat: Lesson[] = [];
    sortedMods.forEach((mod) => {
      const inMod = allLessons
        .filter((l) => l.moduleId === mod._id)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      flat.push(...inMod);
    });
    const moduleIds = new Set(sortedMods.map((m) => m._id));
    const orphans = allLessons.filter((l) => !l.moduleId || !moduleIds.has(l.moduleId));
    flat.push(...orphans);
    return flat;
  }, [modules, allLessons]);

  useEffect(() => {
    if (!selectedLessonId && orderedLessons.length > 0) {
      const first = orderedLessons[0];
      if (first) setSelectedLessonId(first._id);
    }
  }, [orderedLessons, selectedLessonId]);

  const currentIndex = orderedLessons.findIndex((l) => l._id === selectedLessonId);
  const currentLesson = currentIndex >= 0 ? orderedLessons[currentIndex] : null;
  const prevLesson = currentIndex > 0 ? orderedLessons[currentIndex - 1] : null;
  const nextLesson =
    currentIndex >= 0 && currentIndex < orderedLessons.length - 1
      ? orderedLessons[currentIndex + 1]
      : null;

  const totalLessons = orderedLessons.length;
  const completedCount = orderedLessons.filter((l) => completed.has(l._id)).length;
  const completionPct = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;
  const totalMinutes = orderedLessons.reduce((s, l) => s + (l.duration ?? 0), 0);

  const toggleSection = (id: string) =>
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const setLessonComplete = useCallback(
    (lessonId: string, value: boolean) => {
      setCompleted((prev) => {
        const next = new Set(prev);
        if (value) next.add(lessonId);
        else next.delete(lessonId);
        writeProgress(courseId, next);
        return next;
      });
    },
    [courseId]
  );

  const handleMarkComplete = useCallback(() => {
    if (!currentLesson) return;
    const wasComplete = completed.has(currentLesson._id);
    setLessonComplete(currentLesson._id, !wasComplete);
    toast.success(wasComplete ? 'Marked as not complete' : 'Chapter complete');
  }, [currentLesson, completed, setLessonComplete]);

  const handleNext = useCallback(
    (autoComplete = false) => {
      if (!currentLesson || !nextLesson) return;
      if (autoComplete && !completed.has(currentLesson._id)) {
        setLessonComplete(currentLesson._id, true);
      }
      setSelectedLessonId(nextLesson._id);
      const playerEl = document.getElementById('lesson-content');
      if (playerEl) playerEl.scrollTop = 0;
    },
    [currentLesson, nextLesson, completed, setLessonComplete]
  );

  if (courseLoading || lessonsLoading) {
    return (
      <div className="flex h-[calc(100vh-64px)] items-center justify-center bg-muted/20">
        <Skeleton className="h-32 w-64" />
      </div>
    );
  }

  if (!course) {
    return (
      <div className="flex h-[calc(100vh-64px)] flex-col items-center justify-center gap-4 px-6 text-center">
        <BookOpen className="h-12 w-12 text-muted-foreground/50" />
        <p className="text-lg font-semibold">Course not found</p>
        <Link href="/courses">
          <Button variant="outline">Back to courses</Button>
        </Link>
      </div>
    );
  }

  return (
    <div
      className="relative flex h-[calc(100vh-64px)] flex-col bg-background"
      style={
        {
          // Atmospheric backdrop — soft warm wash that anchors the layout edges.
          background:
            'radial-gradient(ellipse 80% 50% at 0% 0%, hsl(var(--primary) / 0.04), transparent 60%), radial-gradient(ellipse 60% 60% at 100% 100%, hsl(var(--accent) / 0.04), transparent 60%), hsl(var(--background))',
        } as React.CSSProperties
      }
    >
      {/* ─── Header — height matches the sidebar org switcher (80px) ─── */}
      <header className="relative z-10 flex h-20 shrink-0 items-center gap-4 border-b bg-card/60 px-5 backdrop-blur-sm lg:px-8">
        <Link href="/courses">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0 rounded-full"
            aria-label="Back to courses"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            <Sparkles className="h-3 w-3 text-accent" />
            <span>Course</span>
            {course.level && (
              <>
                <span className="h-px w-6 bg-border" />
                <span className="capitalize">{course.level}</span>
              </>
            )}
            <span className="h-px w-6 bg-border" />
            <span className="tabular-nums">
              {totalLessons} lesson{totalLessons === 1 ? '' : 's'}
            </span>
            {totalMinutes > 0 && (
              <>
                <span className="h-px w-6 bg-border" />
                <span className="tabular-nums">{formatDuration(totalMinutes)}</span>
              </>
            )}
          </div>
          <h1 className="font-display text-xl font-bold leading-tight tracking-tight md:text-[22px] truncate">
            {course.title}
          </h1>
          {course.instructor && (
            <p className="text-xs text-muted-foreground">
              Taught by <span className="font-medium text-foreground">{course.instructor}</span>
            </p>
          )}
        </div>

        {/* Right: progress badge + edit */}
        <div className="hidden items-center gap-3 md:flex">
          <div className="flex items-center gap-2 rounded-full border bg-card/80 px-3 py-1.5 shadow-soft">
            <GraduationCap className="h-3.5 w-3.5 text-primary" />
            <span className="text-[11px] font-medium text-muted-foreground">
              <span className="font-display font-semibold tabular-nums text-foreground">
                {completedCount}
              </span>
              {' / '}
              <span className="tabular-nums">{totalLessons}</span> done
            </span>
            <span className="h-3 w-px bg-border" />
            <span className="font-display text-xs font-bold tabular-nums text-primary">
              {completionPct}%
            </span>
          </div>
          {hasPermission('courses.courses', 'edit') && (
            <Link href={`/courses/${courseId}/edit`}>
              <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                <Edit className="h-3.5 w-3.5" />
                Edit
              </Button>
            </Link>
          )}
        </div>
      </header>

      {/* ─── Body ─── */}
      <div className="flex min-h-0 flex-1">
        {/* ─── Sidebar ─── */}
        <aside className="hidden w-[360px] shrink-0 flex-col border-r bg-card/40 backdrop-blur-sm lg:flex">
          {/* Progress header — tinted gradient so it reads as a distinct status panel
              instead of melting into the surrounding sidebar surface. */}
          <div
            className="border-b border-primary/10 px-5 py-5"
            style={{
              background:
                'linear-gradient(135deg, hsl(var(--primary) / 0.10) 0%, hsl(var(--primary) / 0.04) 45%, hsl(var(--accent) / 0.06) 100%)',
            }}
          >
            <div className="mb-3 flex items-baseline justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-primary/80">
                Your progress
              </p>
              <span className="font-display text-2xl font-bold tabular-nums text-primary">
                {completionPct}%
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-foreground/10 ring-1 ring-inset ring-foreground/5">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-500 shadow-[0_0_8px_-2px_currentColor]',
                  completionPct === 100
                    ? 'bg-gradient-to-r from-success via-success to-emerald-400 text-success'
                    : 'bg-gradient-to-r from-primary via-primary to-accent text-primary'
                )}
                style={{ width: `${completionPct}%` }}
              />
            </div>
            <div className="mt-3 flex items-center justify-between text-xs">
              <span className="text-foreground/70">
                <span className="font-display font-semibold tabular-nums text-foreground">
                  {completedCount}
                </span>{' '}
                of <span className="tabular-nums">{totalLessons}</span> chapters
              </span>
              {totalMinutes > 0 && (
                <span className="tabular-nums text-foreground/60">
                  {formatDuration(totalMinutes)} total
                </span>
              )}
            </div>
          </div>

          {/* Curriculum */}
          <ScrollArea className="flex-1">
            <div className="py-3">
              {modules.length === 0 && allLessons.length === 0 ? (
                <div className="px-5 py-12 text-center">
                  <BookOpen className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">No content yet</p>
                </div>
              ) : (
                modules
                  .slice()
                  .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
                  .map((mod, modIdx) => {
                    const isOpen = !collapsedSections.has(mod._id);
                    const sectionLessons = allLessons
                      .filter((l) => l.moduleId === mod._id)
                      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
                    const sectionQuizzes = allQuizzes.filter((q) => q.moduleId === mod._id);
                    const sectionDoneCount = sectionLessons.filter((l) =>
                      completed.has(l._id)
                    ).length;
                    const sectionTotalMin = sectionLessons.reduce(
                      (s, l) => s + (l.duration ?? 0),
                      0
                    );
                    const sectionPct =
                      sectionLessons.length > 0
                        ? Math.round((sectionDoneCount / sectionLessons.length) * 100)
                        : 0;

                    return (
                      <div key={mod._id} className="mb-1">
                        <button
                          type="button"
                          onClick={() => toggleSection(mod._id)}
                          className="group flex w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-muted/40"
                        >
                          <ChevronDown
                            className={cn(
                              'h-4 w-4 shrink-0 text-muted-foreground transition-transform',
                              !isOpen && '-rotate-90'
                            )}
                          />
                          <span className="font-mono text-[10px] font-semibold tabular-nums text-muted-foreground/70">
                            {String(modIdx + 1).padStart(2, '0')}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold">{mod.title}</p>
                            <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                              <span className="tabular-nums">
                                {sectionDoneCount}/{sectionLessons.length}
                              </span>
                              {sectionTotalMin > 0 && (
                                <>
                                  <span className="text-muted-foreground/40">·</span>
                                  <span className="tabular-nums">
                                    {formatDuration(sectionTotalMin)}
                                  </span>
                                </>
                              )}
                              {sectionPct === 100 && (
                                <CheckCircle2 className="h-3 w-3 text-success" />
                              )}
                            </div>
                          </div>
                        </button>

                        {isOpen && (
                          <div className="pb-1">
                            {sectionLessons.map((lesson, lessonIdx) => {
                              const Icon = TYPE_ICON[lesson.type] ?? FileText;
                              const isActive = selectedLessonId === lesson._id;
                              const isDone = completed.has(lesson._id);

                              return (
                                <button
                                  key={lesson._id}
                                  type="button"
                                  onClick={() => setSelectedLessonId(lesson._id)}
                                  className={cn(
                                    'group relative flex w-full items-start gap-3 px-5 py-2.5 pl-12 text-left transition-all',
                                    isActive
                                      ? 'bg-gradient-to-r from-primary/[0.08] to-transparent'
                                      : 'hover:bg-muted/30'
                                  )}
                                >
                                  {isActive && (
                                    <span
                                      aria-hidden
                                      className="absolute inset-y-1 left-0 w-[3px] rounded-r-full bg-primary"
                                    />
                                  )}
                                  <div className="mt-0.5 shrink-0">
                                    {isDone ? (
                                      <CheckCircle2 className="h-4 w-4 text-success" />
                                    ) : (
                                      <Circle
                                        className={cn(
                                          'h-4 w-4',
                                          isActive
                                            ? 'text-primary'
                                            : 'text-muted-foreground/30 group-hover:text-muted-foreground/60'
                                        )}
                                      />
                                    )}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-baseline gap-2">
                                      <span className="font-mono text-[10px] tabular-nums text-muted-foreground/60">
                                        {String(modIdx + 1).padStart(2, '0')}.
                                        {String(lessonIdx + 1).padStart(2, '0')}
                                      </span>
                                      <span
                                        className={cn(
                                          'truncate text-sm leading-snug',
                                          isActive
                                            ? 'font-semibold text-foreground'
                                            : isDone
                                              ? 'text-muted-foreground line-through decoration-muted-foreground/40'
                                              : 'text-foreground'
                                        )}
                                      >
                                        {lesson.title}
                                      </span>
                                    </div>
                                    <div className="mt-1 flex items-center gap-2">
                                      <Icon className={cn('h-3 w-3', TYPE_HUE[lesson.type])} />
                                      <span className="text-[11px] text-muted-foreground">
                                        {TYPE_LABEL[lesson.type]}
                                      </span>
                                      {lesson.duration ? (
                                        <>
                                          <span className="text-[11px] text-muted-foreground/40">
                                            ·
                                          </span>
                                          <span className="text-[11px] tabular-nums text-muted-foreground">
                                            {formatDuration(lesson.duration)}
                                          </span>
                                        </>
                                      ) : null}
                                      {lesson.isPreview && (
                                        <Badge
                                          variant="outline"
                                          className="ml-auto h-4 border-primary/30 bg-primary/5 px-1 text-[9px] uppercase tracking-wider text-primary"
                                        >
                                          Preview
                                        </Badge>
                                      )}
                                    </div>
                                  </div>
                                </button>
                              );
                            })}

                            {sectionQuizzes.map((quiz) => (
                              <div
                                key={quiz._id}
                                className="flex items-start gap-3 px-5 py-2.5 pl-12"
                              >
                                <Lock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/40" />
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-sm text-muted-foreground">
                                    {quiz.title}
                                  </p>
                                  <div className="mt-0.5 flex items-center gap-2">
                                    <ClipboardList className="h-3 w-3 text-purple-500" />
                                    <span className="text-[11px] text-muted-foreground">
                                      Quiz · {quiz.questions?.length ?? 0} question
                                      {(quiz.questions?.length ?? 0) === 1 ? '' : 's'}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })
              )}
            </div>
          </ScrollArea>
        </aside>

        {/* ─── Player ─── */}
        <main className="relative flex min-w-0 flex-1 flex-col">
          {currentLesson ? (
            <LessonView
              key={currentLesson._id}
              lesson={currentLesson}
              isComplete={completed.has(currentLesson._id)}
              onMarkComplete={handleMarkComplete}
              onPrev={() => prevLesson && setSelectedLessonId(prevLesson._id)}
              onNext={() => handleNext(false)}
              onCompleteAndNext={() => handleNext(true)}
              hasPrev={!!prevLesson}
              hasNext={!!nextLesson}
              position={currentIndex + 1}
              total={orderedLessons.length}
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center px-6 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
                <PlayCircle className="h-7 w-7 text-muted-foreground" />
              </div>
              <h3 className="mb-1 text-base font-semibold">No lessons yet</h3>
              <p className="max-w-sm text-sm text-muted-foreground">
                Add lessons from the editor to see them here.
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

// ──────────────────────────── Lesson view ────────────────────────────

function LessonView({
  lesson,
  isComplete,
  onMarkComplete,
  onPrev,
  onNext,
  onCompleteAndNext,
  hasPrev,
  hasNext,
  position,
  total,
}: {
  lesson: Lesson;
  isComplete: boolean;
  onMarkComplete: () => void;
  onPrev: () => void;
  onNext: () => void;
  onCompleteAndNext: () => void;
  hasPrev: boolean;
  hasNext: boolean;
  position: number;
  total: number;
}) {
  const Icon = TYPE_ICON[lesson.type] ?? FileText;

  return (
    <div className="flex h-full flex-col">
      <ScrollArea className="flex-1" id="lesson-content">
        <div className="mx-auto w-full max-w-[920px] px-6 py-10 lg:px-12 lg:py-14">
          {/* Eyebrow */}
          <div className="mb-4 flex flex-wrap items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Icon className={cn('h-3 w-3', TYPE_HUE[lesson.type])} />
              {lesson.type === 'live' ? 'Live session' : `${TYPE_LABEL[lesson.type]} lesson`}
            </span>
            <span className="h-px w-8 bg-border" />
            <span className="tabular-nums">
              Chapter {String(position).padStart(2, '0')} / {String(total).padStart(2, '0')}
            </span>
            {lesson.duration ? (
              <>
                <span className="h-px w-8 bg-border" />
                <span className="inline-flex items-center gap-1 tabular-nums">
                  <Clock className="h-3 w-3" />
                  {formatDuration(lesson.duration)}
                </span>
              </>
            ) : null}
            {lesson.difficulty && (
              <Badge
                variant="outline"
                className="border-foreground/15 bg-card text-[10px] capitalize"
              >
                {lesson.difficulty}
              </Badge>
            )}
            {isComplete && (
              <Badge
                variant="outline"
                className="border-success/40 bg-success/10 text-[10px] uppercase tracking-wider text-success"
              >
                <CheckCircle2 className="mr-1 h-3 w-3" /> Completed
              </Badge>
            )}
          </div>

          {/* Title + description */}
          <h1 className="font-display text-3xl font-bold leading-[1.1] tracking-tight md:text-[44px]">
            {lesson.title}
          </h1>
          {lesson.description && (
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground">
              {lesson.description}
            </p>
          )}

          {/* Content */}
          <div className="mt-10">
            {lesson.type === 'video' && (
              <VideoBlock contentUrl={lesson.contentUrl} title={lesson.title} />
            )}
            {lesson.type === 'document' && (
              <DocumentBlock contentHtml={lesson.contentHtml} contentUrl={lesson.contentUrl} />
            )}
            {lesson.type === 'live' && <LiveBlock contentUrl={lesson.contentUrl} />}
          </div>

          <div className="h-8" />
        </div>
      </ScrollArea>

      {/* ─── Sticky action bar ─── */}
      <div className="border-t bg-card/85 backdrop-blur-md supports-[backdrop-filter]:bg-card/70">
        <div className="mx-auto flex w-full max-w-[920px] flex-wrap items-center gap-3 px-6 py-4 lg:px-12">
          <Button
            variant="ghost"
            size="sm"
            disabled={!hasPrev}
            onClick={onPrev}
            className="gap-1.5"
          >
            <ArrowLeftFromLine className="h-3.5 w-3.5" />
            Previous chapter
          </Button>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Button
              variant={isComplete ? 'outline' : 'outline'}
              size="sm"
              onClick={onMarkComplete}
              className={cn(
                'gap-1.5',
                isComplete &&
                  'border-success/40 bg-success/10 text-success hover:bg-success/15 hover:text-success'
              )}
            >
              {isComplete ? (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Completed
                </>
              ) : (
                <>
                  <Circle className="h-3.5 w-3.5" />
                  Mark as completed
                </>
              )}
            </Button>

            {hasNext ? (
              isComplete ? (
                <Button size="sm" onClick={onNext} className="gap-1.5">
                  Next chapter
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              ) : (
                <Button size="sm" onClick={onCompleteAndNext} className="gap-1.5">
                  <Sparkles className="h-3.5 w-3.5" />
                  Complete &amp; next
                </Button>
              )
            ) : isComplete ? (
              <Button
                size="sm"
                disabled
                className="gap-1.5 bg-success text-success-foreground hover:bg-success/90"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Course complete
              </Button>
            ) : (
              <Button size="sm" disabled className="gap-1.5">
                Last chapter
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────── Content blocks ────────────────────────────

function VideoBlock({ contentUrl, title }: { contentUrl?: string; title: string }) {
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);

  useEffect(() => {
    if (!contentUrl) {
      setResolvedUrl(null);
      return;
    }
    if (isHttpUrl(contentUrl)) {
      setResolvedUrl(contentUrl);
      return;
    }
    let cancelled = false;
    setResolving(true);
    uploadApi
      .getSignedDownloadUrl(contentUrl)
      .then((res) => {
        if (cancelled) return;
        const url =
          (res as { data?: { url?: string }; url?: string })?.data?.url ??
          (res as { url?: string })?.url ??
          null;
        setResolvedUrl(typeof url === 'string' ? url : null);
      })
      .catch(() => {
        if (!cancelled) setResolvedUrl(null);
      })
      .finally(() => {
        if (!cancelled) setResolving(false);
      });
    return () => {
      cancelled = true;
    };
  }, [contentUrl]);

  if (!contentUrl) {
    return (
      <div className="flex aspect-video items-center justify-center rounded-3xl border-2 border-dashed bg-muted/20">
        <div className="text-center">
          <Video className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">No video uploaded yet</p>
        </div>
      </div>
    );
  }

  if (resolving || !resolvedUrl) {
    return (
      <div className="aspect-video overflow-hidden rounded-3xl border bg-black/95 shadow-soft-xl">
        <Skeleton className="h-full w-full" />
      </div>
    );
  }

  if (isEmbeddable(resolvedUrl)) {
    return (
      <div className="relative aspect-video w-full overflow-hidden rounded-3xl border border-black/30 bg-black shadow-soft-xl ring-1 ring-black/5">
        <iframe
          src={toEmbedUrl(resolvedUrl)}
          className="absolute inset-0 h-full w-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          title={title}
        />
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-black/30 bg-black shadow-soft-xl ring-1 ring-black/5">
      <video
        controls
        controlsList="nodownload"
        playsInline
        className="aspect-video w-full"
        src={resolvedUrl}
      >
        Your browser does not support the video element.
      </video>
    </div>
  );
}

function DocumentBlock({ contentHtml, contentUrl }: { contentHtml?: string; contentUrl?: string }) {
  if (contentHtml) {
    return (
      <article
        className={cn(
          'prose prose-slate max-w-none rounded-3xl border bg-card p-8 shadow-soft md:p-12',
          'prose-headings:font-display prose-headings:tracking-tight',
          'prose-h2:mt-0 prose-h2:text-2xl',
          'prose-h3:text-lg prose-h3:mb-2',
          'prose-p:leading-relaxed',
          'prose-a:text-primary prose-a:font-medium prose-a:no-underline hover:prose-a:underline',
          'prose-strong:text-foreground prose-strong:font-semibold',
          'prose-code:text-foreground prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:font-mono prose-code:text-[0.9em] prose-code:before:content-none prose-code:after:content-none',
          'prose-pre:bg-foreground/95 prose-pre:text-background prose-pre:rounded-2xl prose-pre:p-5',
          'prose-ul:my-4 prose-ol:my-4',
          'prose-li:my-1 prose-li:leading-relaxed'
        )}
        dangerouslySetInnerHTML={{ __html: contentHtml }}
      />
    );
  }
  if (contentUrl) {
    return (
      <div className="rounded-3xl border bg-card p-12 text-center shadow-soft">
        <FileText className="mx-auto mb-4 h-12 w-12 text-amber-500/60" />
        <p className="mb-3 font-display text-lg font-semibold">External document</p>
        <a
          href={contentUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline"
        >
          Open in a new tab
          <ArrowRight className="h-4 w-4" />
        </a>
      </div>
    );
  }
  return (
    <div className="rounded-3xl border-2 border-dashed bg-muted/20 p-16 text-center">
      <FileText className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
      <p className="text-sm text-muted-foreground">No content written yet</p>
    </div>
  );
}

function LiveBlock({ contentUrl }: { contentUrl?: string }) {
  return (
    <div
      className="overflow-hidden rounded-3xl border shadow-soft"
      style={{
        background:
          'linear-gradient(135deg, hsl(var(--card)) 0%, hsl(var(--card)) 60%, hsl(346, 92%, 90%) 100%)',
      }}
    >
      <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
        <div className="relative mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-100">
          <Radio className="h-7 w-7 text-rose-500" />
          <span className="absolute -right-1 -top-1 inline-flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-rose-500" />
          </span>
        </div>
        <h3 className="font-display text-2xl font-semibold tracking-tight">Live session</h3>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
          {contentUrl
            ? 'Join the session at the scheduled time using the link below. Make sure your camera and microphone work before joining.'
            : 'The meeting link will be shared shortly before the session starts. Keep an eye on your announcements.'}
        </p>
        {contentUrl && (
          <Button asChild size="lg" className="mt-6 gap-2 shadow-soft-md">
            <a href={contentUrl} target="_blank" rel="noopener noreferrer">
              <Radio className="h-4 w-4" />
              Join meeting
              <ArrowRight className="h-4 w-4" />
            </a>
          </Button>
        )}
      </div>
    </div>
  );
}
