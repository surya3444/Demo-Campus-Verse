'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { teachingApi } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  Plus,
  Clock,
  MapPin,
  CalendarDays,
  Filter,
} from 'lucide-react';
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addMonths,
  subMonths,
  format,
  isSameMonth,
  isToday,
  eachDayOfInterval,
  setMonth,
} from 'date-fns';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LessonPlan = Record<string, any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TimetableEntry = Record<string, any>;

const SUBJECT_COLORS = [
  { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', dot: 'bg-blue-500' },
  {
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    text: 'text-emerald-700',
    dot: 'bg-emerald-500',
  },
  {
    bg: 'bg-violet-50',
    border: 'border-violet-200',
    text: 'text-violet-700',
    dot: 'bg-violet-500',
  },
  { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', dot: 'bg-amber-500' },
  { bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-700', dot: 'bg-rose-500' },
  { bg: 'bg-cyan-50', border: 'border-cyan-200', text: 'text-cyan-700', dot: 'bg-cyan-500' },
  {
    bg: 'bg-orange-50',
    border: 'border-orange-200',
    text: 'text-orange-700',
    dot: 'bg-orange-500',
  },
  {
    bg: 'bg-indigo-50',
    border: 'border-indigo-200',
    text: 'text-indigo-700',
    dot: 'bg-indigo-500',
  },
];

interface CalendarViewProps {
  onLessonClick: (lesson: LessonPlan) => void;
  onCreateLesson?: (date: string, sectionId?: string, subjectId?: string, slotId?: string) => void;
  staffId?: string | null;
}

type ViewMode = 'month' | 'semester';

export function CalendarView({ onLessonClick, onCreateLesson, staffId }: CalendarViewProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [subjectFilter, setSubjectFilter] = useState<string>('all');
  const [sectionFilter, setSectionFilter] = useState<string>('all');

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  // Semester range: Apr-Sep or Oct-Mar (Indian academic semesters)
  const currentSemesterMonth = currentMonth.getMonth();
  const semesterStartMonth = currentSemesterMonth >= 3 && currentSemesterMonth <= 8 ? 3 : 9; // Apr or Oct
  const semesterStartDate = startOfMonth(setMonth(currentMonth, semesterStartMonth));
  const semesterEndDate = endOfMonth(addMonths(semesterStartDate, 5));

  // Compute query date range based on view mode
  const queryFromDate = viewMode === 'semester' ? semesterStartDate : calendarStart;
  const queryToDate = viewMode === 'semester' ? semesterEndDate : calendarEnd;

  // Fetch lessons
  const { data: lessonsData, isLoading: lessonsLoading } = useQuery({
    queryKey: [
      'lesson-plans-calendar',
      format(queryFromDate, 'yyyy-MM-dd'),
      format(queryToDate, 'yyyy-MM-dd'),
      subjectFilter,
      sectionFilter,
      staffId,
    ],
    queryFn: () =>
      teachingApi.getLessonPlans({
        fromDate: format(queryFromDate, 'yyyy-MM-dd'),
        toDate: format(queryToDate, 'yyyy-MM-dd'),
        subjectId: subjectFilter !== 'all' ? subjectFilter : undefined,
        sectionId: sectionFilter !== 'all' ? sectionFilter : undefined,
        staffId: staffId || undefined,
        limit: 500,
      }),
    enabled: !staffId || staffId.length > 0,
  });

  // Fetch classes/sections for filter dropdowns
  const { data: classesData } = useQuery({
    queryKey: ['my-classes', staffId],
    queryFn: () => teachingApi.getMyClasses(staffId || undefined),
    enabled: !staffId || staffId.length > 0,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const myClasses: any[] = classesData?.data || [];

  // Fetch timetable for day view
  const { data: timetableData } = useQuery({
    queryKey: ['my-timetable', staffId],
    queryFn: () => teachingApi.getMyTimetable(staffId || undefined),
    enabled: !staffId || staffId.length > 0,
  });

  const lessons: LessonPlan[] = lessonsData?.data || [];
  const timetableEntries: TimetableEntry[] = timetableData?.data || [];

  // Derive unique subjects and sections for filter dropdowns
  const uniqueSubjects = useMemo(() => {
    const map = new Map<string, string>();
    for (const cls of myClasses) {
      if (cls.subjectIds && cls.subjectNames) {
        for (let i = 0; i < cls.subjectIds.length; i++) {
          map.set(cls.subjectIds[i], cls.subjectNames[i] || cls.subjectIds[i]);
        }
      }
    }
    return [...map.entries()].map(([id, name]) => ({ id, name }));
  }, [myClasses]);

  const uniqueSections = useMemo(() => {
    return myClasses.map((cls: { sectionId: string; sectionName: string; className: string }) => ({
      id: cls.sectionId,
      name: `${cls.className} — ${cls.sectionName}`,
    }));
  }, [myClasses]);

  // Build subject color map
  const subjectColorMap = useMemo(() => {
    const map = new Map<string, (typeof SUBJECT_COLORS)[0]>();
    const uniqueIds = [...new Set(lessons.map((l) => l.subjectId))];
    uniqueIds.forEach((id, i) => {
      map.set(id, SUBJECT_COLORS[i % SUBJECT_COLORS.length]);
    });
    return map;
  }, [lessons]);

  // Group lessons by date
  const lessonsByDate = useMemo(() => {
    const map = new Map<string, LessonPlan[]>();
    for (const lesson of lessons) {
      const dateKey = lesson.date ? format(new Date(lesson.date), 'yyyy-MM-dd') : '';
      if (!dateKey) continue;
      const existing = map.get(dateKey) || [];
      existing.push(lesson);
      map.set(dateKey, existing);
    }
    return map;
  }, [lessons]);

  // Derive timetable slots for day view
  const timetableSlots = useMemo(() => {
    const slotMap = new Map<
      string,
      { _id: string; name: string; startTime: string; endTime: string; order: number; type: string }
    >();
    for (const e of timetableEntries) {
      if (!slotMap.has(e.slotId)) {
        slotMap.set(e.slotId, {
          _id: e.slotId,
          name: e.slotName || '',
          startTime: e.startTime || '',
          endTime: e.endTime || '',
          order: e.slotOrder || 0,
          type: e.slotType || 'period',
        });
      }
    }
    return [...slotMap.values()].sort((a, b) => a.order - b.order);
  }, [timetableEntries]);

  // ============ Month View ============

  const renderMonthView = () => {
    if (lessonsLoading) {
      return (
        <div className="space-y-4">
          <Skeleton className="h-8 w-64" />
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: 35 }).map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {/* Month Navigation */}
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">{format(currentMonth, 'MMMM yyyy')}</h2>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => setCurrentMonth((m) => subMonths(m, 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 px-3"
              onClick={() => setCurrentMonth(new Date())}
            >
              Today
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => setCurrentMonth((m) => addMonths(m, 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Weekday Headers */}
        <div className="grid grid-cols-7 gap-1">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
            <div
              key={d}
              className="text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider py-2"
            >
              {d}
            </div>
          ))}
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-1">
          {calendarDays.map((day) => {
            const dateKey = format(day, 'yyyy-MM-dd');
            const dayLessons = lessonsByDate.get(dateKey) || [];
            const inMonth = isSameMonth(day, currentMonth);
            const today = isToday(day);

            return (
              <button
                key={dateKey}
                onClick={() => setSelectedDate(day)}
                className={`relative min-h-[100px] p-1.5 rounded-lg border text-left transition-all hover:shadow-sm ${
                  today
                    ? 'border-primary/40 bg-primary/[0.03]'
                    : inMonth
                      ? 'border-border/40 bg-card hover:border-border'
                      : 'border-transparent bg-muted/30'
                } ${!inMonth ? 'opacity-40' : ''}`}
              >
                {/* Date Number */}
                <span
                  className={`text-sm font-medium ${
                    today
                      ? 'bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-xs'
                      : ''
                  }`}
                >
                  {format(day, 'd')}
                </span>

                {/* Lesson Pills */}
                <div className="mt-1 space-y-0.5">
                  {dayLessons.slice(0, 3).map((lesson) => {
                    const colors = subjectColorMap.get(lesson.subjectId) || SUBJECT_COLORS[0];
                    return (
                      <div
                        key={lesson._id}
                        className={`${colors.bg} ${colors.text} text-[10px] font-medium px-1.5 py-0.5 rounded truncate leading-tight`}
                      >
                        {lesson.subjectName || lesson.title}
                      </div>
                    );
                  })}
                  {dayLessons.length > 3 && (
                    <p className="text-[10px] text-muted-foreground pl-1">
                      +{dayLessons.length - 3} more
                    </p>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Legend */}
        {lessons.length > 0 && (
          <div className="flex flex-wrap gap-3 pt-1">
            {[...subjectColorMap.entries()].map(([subjectId, colors]) => {
              const lesson = lessons.find((l) => l.subjectId === subjectId);
              return (
                <div key={subjectId} className="flex items-center gap-1.5">
                  <div className={`${colors.dot} w-2.5 h-2.5 rounded-full`} />
                  <span className="text-xs text-muted-foreground">
                    {lesson?.subjectName || 'Unknown'}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  // ============ Day View ============

  const renderDayView = () => {
    if (!selectedDate) return null;

    const dateKey = format(selectedDate, 'yyyy-MM-dd');
    const dayLessons = lessonsByDate.get(dateKey) || [];
    const dayOfWeek = selectedDate.getDay() === 0 ? 7 : selectedDate.getDay(); // 1=Mon, 7=Sun

    // Get timetable entries for this day
    const dayTimetable = timetableEntries.filter((e) => e.dayOfWeek === dayOfWeek);

    // Sort slots and map lessons to them
    const periodSlots = timetableSlots.filter((s) => s.type === 'period');

    return (
      <div className="space-y-4">
        {/* Day Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              className="gap-1"
              onClick={() => setSelectedDate(null)}
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <div>
              <h2 className="text-xl font-bold">{format(selectedDate, 'EEEE, MMMM d, yyyy')}</h2>
              <p className="text-sm text-muted-foreground">
                {dayLessons.length} lesson{dayLessons.length !== 1 ? 's' : ''} planned ·{' '}
                {periodSlots.length} periods
              </p>
            </div>
          </div>
          {isToday(selectedDate) && (
            <Badge variant="default" className="text-xs">
              Today
            </Badge>
          )}
        </div>

        {/* Timeline */}
        <div className="space-y-2">
          {periodSlots.length === 0 ? (
            <div className="text-center py-16">
              <CalendarDays className="mx-auto h-12 w-12 text-muted-foreground/30" />
              <h3 className="mt-4 text-lg font-medium">No timetable data</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Your timetable has not been configured yet.
              </p>
            </div>
          ) : (
            periodSlots.map((slot) => {
              // Find timetable entries for this slot
              const slotTimetable = dayTimetable.filter((e) => e.slotId === slot._id);

              // Find lessons matching this slot's subject+section
              const slotLessons = slotTimetable
                .map((entry) => {
                  const matchingLesson = dayLessons.find(
                    (l) => l.subjectId === entry.subjectId && l.sectionId === entry.sectionId
                  );
                  return { entry, lesson: matchingLesson };
                })
                .filter((item) => item.entry);

              return (
                <div key={slot._id} className="flex gap-4">
                  {/* Time Column */}
                  <div className="w-20 shrink-0 pt-3 text-right">
                    <p className="text-sm font-medium">{slot.startTime}</p>
                    <p className="text-[11px] text-muted-foreground">{slot.endTime}</p>
                  </div>

                  {/* Period Card */}
                  <div className="flex-1">
                    {slotLessons.length === 0 ? (
                      // No timetable entry for this slot
                      <div className="border border-dashed border-muted-foreground/20 rounded-xl p-4 text-center">
                        <p className="text-xs text-muted-foreground">{slot.name} — Free period</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {slotLessons.map(({ entry, lesson }) => {
                          const colors = subjectColorMap.get(entry.subjectId) || SUBJECT_COLORS[0];

                          if (lesson) {
                            // Period with a lesson plan
                            return (
                              <button
                                key={entry._id}
                                onClick={() => onLessonClick(lesson)}
                                className={`w-full text-left ${colors.bg} ${colors.border} border rounded-xl p-4 transition-all hover:shadow-md`}
                              >
                                <div className="flex items-start justify-between">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <div
                                        className={`${colors.dot} w-2 h-2 rounded-full shrink-0`}
                                      />
                                      <span
                                        className={`text-sm font-semibold ${colors.text} truncate`}
                                      >
                                        {entry.subjectName}
                                      </span>
                                      <Badge
                                        variant="secondary"
                                        className="text-[9px] px-1.5 py-0 h-4 shrink-0"
                                      >
                                        {entry.sectionName}
                                        {entry.className ? ` · ${entry.className}` : ''}
                                      </Badge>
                                    </div>
                                    <p className="text-sm font-medium mt-1.5">{lesson.title}</p>
                                    {lesson.objectives && lesson.objectives.length > 0 && (
                                      <p className="text-xs text-muted-foreground mt-1 truncate">
                                        {lesson.objectives[0]}
                                        {lesson.objectives.length > 1
                                          ? ` (+${lesson.objectives.length - 1} more)`
                                          : ''}
                                      </p>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0 ml-2">
                                    <Badge
                                      variant={
                                        lesson.status === 'published' ? 'default' : 'secondary'
                                      }
                                      className="text-[10px]"
                                    >
                                      {lesson.status}
                                    </Badge>
                                  </div>
                                </div>
                                {entry.roomNumber && (
                                  <div className="flex items-center gap-1 mt-2 text-[11px] text-muted-foreground">
                                    <MapPin className="h-3 w-3" />
                                    Rm {entry.roomNumber}
                                  </div>
                                )}
                                <div className="flex items-center gap-1 mt-1 text-[11px] text-muted-foreground">
                                  <Clock className="h-3 w-3" />
                                  {slot.startTime} – {slot.endTime} · {slot.name}
                                </div>
                              </button>
                            );
                          }

                          // Period without a lesson plan
                          return (
                            <div
                              key={entry._id}
                              className="border border-border/50 rounded-xl p-4 bg-card"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <div
                                    className={`${colors.dot} w-2 h-2 rounded-full opacity-40`}
                                  />
                                  <span className="text-sm font-medium text-muted-foreground">
                                    {entry.subjectName}
                                  </span>
                                  <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4">
                                    {entry.sectionName}
                                    {entry.className ? ` · ${entry.className}` : ''}
                                  </Badge>
                                </div>
                                {onCreateLesson && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 text-xs gap-1"
                                    onClick={() =>
                                      onCreateLesson(
                                        dateKey,
                                        entry.sectionId,
                                        entry.subjectId,
                                        slot._id
                                      )
                                    }
                                  >
                                    <Plus className="h-3 w-3" />
                                    Add Lesson
                                  </Button>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground mt-1.5">
                                No lesson planned for this period
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}

          {/* Lessons not matching any timetable slot */}
          {dayLessons.filter(
            (l) =>
              !periodSlots.some((slot) =>
                dayTimetable.some(
                  (e) =>
                    e.slotId === slot._id &&
                    e.subjectId === l.subjectId &&
                    e.sectionId === l.sectionId
                )
              )
          ).length > 0 && (
            <div className="mt-6">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Other Lessons
              </p>
              <div className="space-y-2">
                {dayLessons
                  .filter(
                    (l) =>
                      !periodSlots.some((slot) =>
                        dayTimetable.some(
                          (e) =>
                            e.slotId === slot._id &&
                            e.subjectId === l.subjectId &&
                            e.sectionId === l.sectionId
                        )
                      )
                  )
                  .map((lesson) => {
                    const colors = subjectColorMap.get(lesson.subjectId) || SUBJECT_COLORS[0];
                    return (
                      <button
                        key={lesson._id}
                        onClick={() => onLessonClick(lesson)}
                        className={`w-full text-left ${colors.bg} ${colors.border} border rounded-xl p-4 transition-all hover:shadow-md ml-24`}
                      >
                        <div className="flex items-center gap-2">
                          <div className={`${colors.dot} w-2 h-2 rounded-full`} />
                          <span className={`text-sm font-semibold ${colors.text}`}>
                            {lesson.title}
                          </span>
                          <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4">
                            {lesson.subjectName}
                          </Badge>
                        </div>
                      </button>
                    );
                  })}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  // ============ Semester View ============

  const renderSemesterView = () => {
    if (lessonsLoading) {
      return (
        <div className="grid grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      );
    }

    const semesterMonths: Date[] = [];
    for (let i = 0; i < 6; i++) {
      semesterMonths.push(addMonths(semesterStartDate, i));
    }

    const semesterLabel =
      semesterStartMonth === 3
        ? `Apr – Sep ${format(semesterStartDate, 'yyyy')}`
        : `Oct ${format(semesterStartDate, 'yyyy')} – Mar ${format(semesterEndDate, 'yyyy')}`;

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">{semesterLabel}</h2>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              className="h-8 px-3"
              onClick={() => setCurrentMonth((m) => addMonths(m, -6))}
            >
              <ChevronLeft className="h-4 w-4 mr-1" /> Prev
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 px-3"
              onClick={() => setCurrentMonth((m) => addMonths(m, 6))}
            >
              Next <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {semesterMonths.map((month) => {
            const mStart = startOfMonth(month);
            const mEnd = endOfMonth(month);
            const mCalStart = startOfWeek(mStart, { weekStartsOn: 1 });
            const mCalEnd = endOfWeek(mEnd, { weekStartsOn: 1 });
            const mDays = eachDayOfInterval({ start: mCalStart, end: mCalEnd });

            // Count lessons this month
            const monthLessons = lessons.filter((l) => {
              const d = new Date(l.date);
              return d >= mStart && d <= mEnd;
            });

            return (
              <div
                key={format(month, 'yyyy-MM')}
                className="border rounded-xl p-3 hover:shadow-sm transition-all cursor-pointer"
                onClick={() => {
                  setCurrentMonth(month);
                  setViewMode('month');
                }}
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold">{format(month, 'MMMM')}</h3>
                  {monthLessons.length > 0 && (
                    <Badge variant="secondary" className="text-[10px]">
                      {monthLessons.length}
                    </Badge>
                  )}
                </div>

                {/* Mini calendar grid */}
                <div className="grid grid-cols-7 gap-px">
                  {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
                    <div
                      key={i}
                      className="text-[8px] text-muted-foreground text-center font-medium"
                    >
                      {d}
                    </div>
                  ))}
                  {mDays.map((day) => {
                    const dateKey = format(day, 'yyyy-MM-dd');
                    const dayLessons = lessonsByDate.get(dateKey) || [];
                    const inMonth = isSameMonth(day, month);
                    const today = isToday(day);

                    return (
                      <div
                        key={dateKey}
                        className={`text-[9px] text-center py-0.5 rounded-sm ${
                          !inMonth
                            ? 'text-transparent'
                            : today
                              ? 'bg-primary text-primary-foreground font-bold'
                              : dayLessons.length > 0
                                ? 'bg-primary/15 text-primary font-medium'
                                : 'text-muted-foreground'
                        }`}
                      >
                        {format(day, 'd')}
                      </div>
                    );
                  })}
                </div>

                {/* Subject dots for this month */}
                {monthLessons.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {[...new Set(monthLessons.map((l) => l.subjectId))].map((subId) => {
                      const colors = subjectColorMap.get(subId) || SUBJECT_COLORS[0];
                      const count = monthLessons.filter((l) => l.subjectId === subId).length;
                      return (
                        <div key={subId} className="flex items-center gap-0.5">
                          <div className={`${colors.dot} w-1.5 h-1.5 rounded-full`} />
                          <span className="text-[9px] text-muted-foreground">{count}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // ============ Filter Bar ============

  const renderFilterBar = () => (
    <div className="flex flex-wrap items-center gap-3">
      {/* View Mode Toggle */}
      <div className="flex items-center border rounded-lg p-0.5">
        <Button
          variant={viewMode === 'month' ? 'default' : 'ghost'}
          size="sm"
          className="h-7 text-xs px-3"
          onClick={() => setViewMode('month')}
        >
          Month
        </Button>
        <Button
          variant={viewMode === 'semester' ? 'default' : 'ghost'}
          size="sm"
          className="h-7 text-xs px-3"
          onClick={() => setViewMode('semester')}
        >
          Semester
        </Button>
      </div>

      <div className="h-5 w-px bg-border" />

      {/* Subject Filter */}
      <div className="flex items-center gap-1.5">
        <Filter className="h-3.5 w-3.5 text-muted-foreground" />
        <Select value={subjectFilter} onValueChange={setSubjectFilter}>
          <SelectTrigger className="h-8 w-[160px] text-xs">
            <SelectValue placeholder="All Subjects" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Subjects</SelectItem>
            {uniqueSubjects.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Section Filter */}
      <Select value={sectionFilter} onValueChange={setSectionFilter}>
        <SelectTrigger className="h-8 w-[180px] text-xs">
          <SelectValue placeholder="All Sections" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Sections</SelectItem>
          {uniqueSections.map((s) => (
            <SelectItem key={s.id} value={s.id}>
              {s.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Clear Filters */}
      {(subjectFilter !== 'all' || sectionFilter !== 'all') && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 text-xs text-muted-foreground"
          onClick={() => {
            setSubjectFilter('all');
            setSectionFilter('all');
          }}
        >
          Clear filters
        </Button>
      )}
    </div>
  );

  // ============ Main Render ============

  if (selectedDate) {
    return renderDayView();
  }

  return (
    <div className="space-y-4">
      {renderFilterBar()}
      {viewMode === 'month' ? renderMonthView() : renderSemesterView()}
    </div>
  );
}
