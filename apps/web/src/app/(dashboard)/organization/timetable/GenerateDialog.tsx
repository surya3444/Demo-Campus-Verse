'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  CalendarCheck2,
  Check,
  FlaskConical,
  Loader2,
  RefreshCw,
  Sparkles,
  Users,
  Wand2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { hrApi, teachingApi, type GeneratedTimetable } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useCountUp } from '@/hooks/useCountUp';
import { TimetableCell } from '@/components/timetable/TimetableCell';
import { BREAK_ROW, subjectColors } from '@/components/timetable/subjectColors';
import { errorMessage } from '../explorer/parts';

interface ClassRow {
  _id: string;
  displayName: string;
  programId?: string | null;
  departmentId?: string | null;
}
type Scope = 'program' | 'department';
type Stage = 'setup' | 'working' | 'result';

const DAYS = [
  { n: 1, label: 'Mon' },
  { n: 2, label: 'Tue' },
  { n: 3, label: 'Wed' },
  { n: 4, label: 'Thu' },
  { n: 5, label: 'Fri' },
  { n: 6, label: 'Sat' },
];
const STEPS = [
  'Reading curriculum & weekly hours',
  'Matching teachers to sections',
  'Splitting lab batches into blocks',
  'Placing labs on consecutive periods',
  'Placing theory, avoiding clashes',
  'Balancing teacher workloads',
];
const MIN_WORK_MS = 2600; // let the build animation play even when the solver is quick
const yearOf = (name: string) => name.split(' · ').slice(-1)[0];

export function GenerateDialog({
  open,
  onClose,
  classes,
  programs,
  defaultProgramId,
  onApplied,
}: {
  open: boolean;
  onClose: () => void;
  classes: ClassRow[];
  programs: Array<{ _id: string; name: string; code: string }>;
  defaultProgramId?: string;
  onApplied: () => void;
}) {
  const [stage, setStage] = useState<Stage>('setup');
  const [scope, setScope] = useState<Scope>('program');
  const [programId, setProgramId] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [departments, setDepartments] = useState<Array<{ _id: string; name: string }>>([]);
  const [years, setYears] = useState<Set<string>>(new Set());
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5, 6]);
  const [maxPerDay, setMaxPerDay] = useState(5);
  const [mode, setMode] = useState<'fill' | 'fresh'>('fill');
  const [seed, setSeed] = useState(1);
  const [result, setResult] = useState<GeneratedTimetable | null>(null);
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    if (!open) return;
    setStage('setup');
    setResult(null);
    setProgramId(
      defaultProgramId ||
        programs.find((p) => classes.some((c) => c.programId === p._id))?._id ||
        ''
    );
    hrApi
      .getDepartments()
      .then((r) =>
        setDepartments(
          ((r.data ?? []) as Array<{ _id: string; name: string }>).filter((d) =>
            classes.some((c) => c.departmentId === d._id)
          )
        )
      )
      .catch(() => setDepartments([]));
  }, [open, defaultProgramId, programs, classes]);

  const scopedClasses = useMemo(
    () =>
      classes.filter((c) =>
        scope === 'program' ? c.programId === programId : c.departmentId === departmentId
      ),
    [classes, scope, programId, departmentId]
  );
  useEffect(() => setYears(new Set(scopedClasses.map((c) => c._id))), [scopedClasses]);

  const params = (s: number, apply: boolean) => ({
    ...(scope === 'program' ? { programId } : { departmentId }),
    ...(years.size !== scopedClasses.length && { classIds: [...years] }),
    days,
    maxPerDay,
    mode,
    seed: s,
    apply,
  });

  const run = async (s: number) => {
    setSeed(s);
    setStage('working');
    const started = Date.now();
    try {
      const r = await teachingApi.generateTimetable(params(s, false));
      await new Promise((ok) => setTimeout(ok, Math.max(0, MIN_WORK_MS - (Date.now() - started))));
      setResult(r.data);
      setStage('result');
    } catch (err) {
      toast.error(errorMessage(err, 'Could not generate the timetable'));
      setStage('setup');
    }
  };

  const apply = async () => {
    setApplying(true);
    try {
      const r = await teachingApi.generateTimetable(params(seed, true));
      toast.success(
        `Timetable applied — ${r.data.written} periods across ${r.data.stats.sections} sections`,
        { icon: <CalendarCheck2 className="h-4 w-4 text-emerald-600" /> }
      );
      onApplied();
      onClose();
    } catch (err) {
      toast.error(errorMessage(err, 'Could not apply the timetable'));
    } finally {
      setApplying(false);
    }
  };

  const ready =
    (scope === 'program' ? programId : departmentId) && years.size > 0 && days.length > 0;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !applying && stage !== 'working' && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-6xl overflow-y-auto p-0 [&>button:last-child]:text-primary-foreground [&>button:last-child]:opacity-80">
        <div className="relative overflow-hidden bg-primary px-6 py-5 text-primary-foreground">
          <div className="pointer-events-none absolute -bottom-20 right-10 h-40 w-72 rounded-full bg-[hsl(var(--brand-cyan,199_89%_48%))] opacity-20 blur-3xl" />
          <div className="pointer-events-none absolute -right-10 -top-16 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/30">
              <Wand2 className="h-5 w-5" />
            </span>
            <div>
              <DialogTitle className="text-lg font-semibold text-white">
                Timetable generator
              </DialogTitle>
              <DialogDescription className="text-sm text-white/80">
                Builds a whole program&apos;s or department&apos;s week — no teacher, section or lab
                batch is ever double-booked.
              </DialogDescription>
            </div>
          </div>
        </div>

        <div className="p-6">
          {stage === 'setup' && (
            <Setup
              {...{ scope, setScope, programId, setProgramId, departmentId, setDepartmentId }}
              {...{ departments, programs, classes, scopedClasses, years, setYears }}
              {...{ days, setDays, maxPerDay, setMaxPerDay, mode, setMode }}
            />
          )}
          {stage === 'working' && <Working />}
          {stage === 'result' && result && (
            <Result result={result} maxPerDay={maxPerDay} days={days} />
          )}
        </div>

        <div className="sticky bottom-0 flex flex-wrap items-center gap-2 border-t bg-background/95 px-6 py-3 backdrop-blur">
          {stage === 'setup' && (
            <>
              <Button variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button className="ml-auto gap-2" disabled={!ready} onClick={() => run(seed)}>
                <Sparkles className="h-4 w-4" />
                Generate timetable
              </Button>
            </>
          )}
          {stage === 'working' && (
            <p className="text-sm text-muted-foreground">Trying thousands of arrangements…</p>
          )}
          {stage === 'result' && result && (
            <>
              <Button
                variant="ghost"
                className="gap-1.5"
                onClick={() => setStage('setup')}
                disabled={applying}
              >
                <ArrowLeft className="h-4 w-4" />
                Settings
              </Button>
              <Button
                variant="outline"
                className="gap-1.5"
                onClick={() => run(seed + 1)}
                disabled={applying}
              >
                <RefreshCw className="h-4 w-4" />
                Try another arrangement
              </Button>
              <span className="ml-auto hidden text-xs text-muted-foreground md:inline">
                {mode === 'fresh'
                  ? 'Replaces these sections’ regular classes; electives & combined classes stay.'
                  : 'Keeps everything already scheduled and only fills the gaps.'}
              </span>
              <Button
                className="gap-2"
                onClick={apply}
                disabled={applying || result.stats.placed === 0}
              >
                {applying ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                Apply to {result.stats.sections} section{result.stats.sections === 1 ? '' : 's'}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Chip({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-full border px-3 py-1 text-sm font-medium transition-all',
        on
          ? 'border-primary bg-primary text-primary-foreground shadow-sm'
          : 'bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground'
      )}
    >
      {children}
    </button>
  );
}

function Setup(p: {
  scope: Scope;
  setScope: (s: Scope) => void;
  programId: string;
  setProgramId: (v: string) => void;
  departmentId: string;
  setDepartmentId: (v: string) => void;
  departments: Array<{ _id: string; name: string }>;
  programs: Array<{ _id: string; name: string; code: string }>;
  classes: ClassRow[];
  scopedClasses: ClassRow[];
  years: Set<string>;
  setYears: (s: Set<string>) => void;
  days: number[];
  setDays: (d: number[]) => void;
  maxPerDay: number;
  setMaxPerDay: (n: number) => void;
  mode: 'fill' | 'fresh';
  setMode: (m: 'fill' | 'fresh') => void;
}) {
  const programOptions = p.programs.filter((x) => p.classes.some((c) => c.programId === x._id));
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className="space-y-5">
        <div className="space-y-2">
          <Label>Generate for</Label>
          <div className="inline-flex rounded-lg border bg-muted/40 p-1 text-sm">
            {(['program', 'department'] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => p.setScope(s)}
                className={cn(
                  'rounded-md px-3 py-1.5 font-medium transition-colors',
                  p.scope === s
                    ? 'bg-background shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {s === 'program' ? 'A whole program' : 'A whole department'}
              </button>
            ))}
          </div>
        </div>
        {p.scope === 'program' ? (
          <div className="space-y-1.5">
            <Label>Program</Label>
            <Select value={p.programId} onValueChange={p.setProgramId}>
              <SelectTrigger>
                <SelectValue placeholder="Pick a program" />
              </SelectTrigger>
              <SelectContent>
                {programOptions.map((x) => (
                  <SelectItem key={x._id} value={x._id}>
                    {x.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <div className="space-y-1.5">
            <Label>Department</Label>
            <Select value={p.departmentId} onValueChange={p.setDepartmentId}>
              <SelectTrigger>
                <SelectValue placeholder="Pick a department" />
              </SelectTrigger>
              <SelectContent>
                {p.departments.map((x) => (
                  <SelectItem key={x._id} value={x._id}>
                    {x.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="space-y-2">
          <Label>Years</Label>
          <div className="flex flex-wrap gap-2">
            {p.scopedClasses.length === 0 && (
              <span className="text-sm text-muted-foreground">
                Pick a program or department first.
              </span>
            )}
            {p.scopedClasses.map((c) => (
              <Chip
                key={c._id}
                on={p.years.has(c._id)}
                onClick={() => {
                  const next = new Set(p.years);
                  if (next.has(c._id)) next.delete(c._id);
                  else next.add(c._id);
                  p.setYears(next);
                }}
              >
                {p.scope === 'program'
                  ? yearOf(c.displayName)
                  : c.displayName.split(' · ').slice(-2).join(' · ')}
              </Chip>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <Label>Working days</Label>
          <div className="flex flex-wrap gap-2">
            {DAYS.map((d) => (
              <Chip
                key={d.n}
                on={p.days.includes(d.n)}
                onClick={() =>
                  p.setDays(
                    p.days.includes(d.n) ? p.days.filter((x) => x !== d.n) : [...p.days, d.n].sort()
                  )
                }
              >
                {d.label}
              </Chip>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-5">
        <div className="space-y-2">
          <Label>Most periods a teacher takes in a day</Label>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="icon"
              onClick={() => p.setMaxPerDay(Math.max(1, p.maxPerDay - 1))}
            >
              −
            </Button>
            <span className="w-8 text-center text-2xl font-semibold tabular-nums">
              {p.maxPerDay}
            </span>
            <Button
              variant="outline"
              size="icon"
              onClick={() => p.setMaxPerDay(Math.min(10, p.maxPerDay + 1))}
            >
              +
            </Button>
            <span className="text-sm text-muted-foreground">
              a soft limit — exceeded only if unavoidable
            </span>
          </div>
        </div>
        <div className="space-y-2">
          <Label>Existing timetable</Label>
          {(
            [
              [
                'fresh',
                'Rebuild from scratch',
                'Replaces the regular classes of these sections. Electives and combined classes are kept.',
              ],
              [
                'fill',
                'Fill the gaps',
                'Keeps everything already scheduled and only adds what is missing.',
              ],
            ] as const
          ).map(([value, title, text]) => (
            <button
              key={value}
              type="button"
              onClick={() => p.setMode(value)}
              className={cn(
                'block w-full rounded-xl border p-3 text-left transition-all',
                p.mode === value
                  ? 'border-primary bg-primary/[0.06] ring-1 ring-primary'
                  : 'hover:border-primary/40'
              )}
            >
              <span className="block text-sm font-semibold">{title}</span>
              <span className="block text-xs text-muted-foreground">{text}</span>
            </button>
          ))}
        </div>
        <div className="rounded-xl bg-muted/50 p-3 text-xs leading-relaxed text-muted-foreground">
          Weekly hours come from each subject&apos;s L-T-P (or the section&apos;s periods per week),
          teachers from Teaching Assignments, labs run as double periods per lab batch, and every
          teacher&apos;s classes in other programs are respected.
        </div>
      </div>
    </div>
  );
}

const TILE_COLORS = [
  'bg-sky-400',
  'bg-violet-400',
  'bg-emerald-400',
  'bg-amber-400',
  'bg-rose-400',
  'bg-teal-400',
  'bg-indigo-400',
  'bg-orange-400',
];

/** The "building" animation while the solver runs. */
function Working() {
  const [step, setStep] = useState(0);
  const [lit, setLit] = useState<Set<number>>(new Set());
  useEffect(() => {
    const a = setInterval(() => setStep((s) => Math.min(STEPS.length - 1, s + 1)), 420);
    const b = setInterval(
      () =>
        setLit((prev) => {
          if (prev.size >= 42) return new Set();
          const next = new Set(prev);
          let i = Math.floor(Math.random() * 42);
          while (next.has(i)) i = (i + 1) % 42;
          next.add(i);
          return next;
        }),
      55
    );
    return () => {
      clearInterval(a);
      clearInterval(b);
    };
  }, []);
  return (
    <div className="grid items-center gap-8 py-6 md:grid-cols-2">
      <div className="mx-auto grid w-full max-w-sm grid-cols-6 gap-1.5 rounded-2xl border bg-card p-3 shadow-inner">
        {Array.from({ length: 42 }, (_, i) => (
          <span
            key={i}
            className={cn(
              'h-7 rounded-md transition-all duration-300',
              lit.has(i)
                ? `${TILE_COLORS[i % TILE_COLORS.length]} scale-100 opacity-90`
                : 'scale-90 bg-muted'
            )}
          />
        ))}
      </div>
      <ul className="space-y-2.5">
        {STEPS.map((s, i) => (
          <li
            key={s}
            className={cn(
              'flex items-center gap-2.5 text-sm transition-opacity duration-300',
              i > step && 'opacity-30'
            )}
          >
            <span
              className={cn(
                'flex h-6 w-6 items-center justify-center rounded-full border',
                i < step && 'border-emerald-500 bg-emerald-500 text-white',
                i === step && 'border-primary'
              )}
            >
              {i < step ? (
                <Check className="h-3.5 w-3.5" />
              ) : i === step ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
              ) : null}
            </span>
            {s}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  suffix,
  tone,
}: {
  icon: typeof Users;
  label: string;
  value: number;
  suffix?: string;
  tone: string;
}) {
  const v = useCountUp(value, 900);
  return (
    <div className="rounded-xl border bg-card p-3 motion-safe:animate-fade-up [animation-fill-mode:both]">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <span
          className={cn('flex h-6 w-6 items-center justify-center rounded-md text-white', tone)}
        >
          <Icon className="h-3.5 w-3.5" />
        </span>
        {label}
      </div>
      <p className="mt-1.5 text-2xl font-semibold tabular-nums">
        {Math.round(v)}
        {suffix && <span className="text-base font-normal text-muted-foreground">{suffix}</span>}
      </p>
    </div>
  );
}

function Result({
  result,
  maxPerDay,
  days,
}: {
  result: GeneratedTimetable;
  maxPerDay: number;
  days: number[];
}) {
  const [active, setActive] = useState(result.sections[0]?.sectionId ?? '');
  const section = result.sections.find((s) => s.sectionId === active) ?? result.sections[0];
  const pct = result.stats.demand
    ? Math.round((result.stats.placed / result.stats.demand) * 100)
    : 100;
  const shownDays = DAYS.filter((d) => days.includes(d.n));
  const color = useMemo(
    () => subjectColors(section?.cells.map((c) => c.subjectId) ?? []),
    [section]
  );
  const topLoad = Math.max(1, ...result.teachers.map((t) => t.periods));

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat icon={CalendarCheck2} label="Placed" value={pct} suffix="%" tone="bg-emerald-500" />
        <Stat
          icon={Sparkles}
          label="Periods"
          value={result.stats.placed}
          suffix={` / ${result.stats.demand}`}
          tone="bg-primary"
        />
        <Stat
          icon={FlaskConical}
          label="Lab blocks"
          value={result.stats.labBlocks}
          tone="bg-violet-500"
        />
        <Stat icon={Users} label="Teachers" value={result.stats.teachers} tone="bg-amber-500" />
        <Stat icon={Wand2} label="Sections" value={result.stats.sections} tone="bg-rose-500" />
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {result.sections.map((s) => (
          <button
            key={s.sectionId}
            onClick={() => setActive(s.sectionId)}
            className={cn(
              'shrink-0 rounded-full border px-3 py-1 text-sm font-medium transition-colors',
              s.sectionId === section?.sectionId
                ? 'border-transparent bg-gradient-to-r from-primary to-violet-600 text-white shadow'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {s.label.split(' · ').slice(-2).join(' · ')}
          </button>
        ))}
      </div>

      {section && (
        <div key={section.sectionId} className="overflow-x-auto rounded-xl border bg-card">
          {section.slots.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">
              This year has no periods yet — set up Periods &amp; timings first.
            </p>
          ) : (
            <table className="w-full min-w-[820px] table-fixed text-sm">
              <thead>
                <tr className="bg-gradient-to-r from-primary/10 via-violet-500/10 to-fuchsia-500/10 text-xs uppercase tracking-wider">
                  <th className="w-24 px-3 py-2 text-left text-muted-foreground">Period</th>
                  {shownDays.map((d) => (
                    <th key={d.n} className="px-2 py-2 text-left font-semibold text-foreground/80">
                      {d.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {section.slots.map((slot, row) =>
                  slot.type !== 'period' ? (
                    <tr key={slot._id} className={BREAK_ROW}>
                      <td className="px-3 py-1 text-[11px] text-muted-foreground">
                        {slot.startTime}–{slot.endTime}
                      </td>
                      <td
                        colSpan={shownDays.length}
                        className="px-2 py-1 text-[11px] font-medium capitalize text-muted-foreground"
                      >
                        {slot.name || slot.type}
                      </td>
                    </tr>
                  ) : (
                    <tr key={slot._id} className="border-t">
                      <td className="px-3 py-1.5 align-top">
                        <p className="text-xs font-semibold">{slot.name}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {slot.startTime}–{slot.endTime}
                        </p>
                      </td>
                      {shownDays.map((d, col) => {
                        const here = section.cells.filter(
                          (c) => c.slotId === slot._id && c.day === d.n
                        );
                        return (
                          <td key={d.n} className="space-y-1 p-1 align-top">
                            {here.map((c, i) => (
                              <TimetableCell
                                key={`${c.subjectId}${c.batchName}${i}`}
                                subjectName={c.subjectName}
                                teacherName={c.teacherName}
                                batchName={c.batchName}
                                lab={c.kind === 'lab'}
                                color={color(c.subjectId)}
                                isNew={c.isNew}
                                muted={!c.isNew}
                                delay={col * 70 + row * 45 + i * 30}
                              />
                            ))}
                          </td>
                        );
                      })}
                    </tr>
                  )
                )}
              </tbody>
            </table>
          )}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border bg-card p-4">
          <p className="mb-3 text-sm font-semibold">Teacher workload (periods / week)</p>
          <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
            {result.teachers.map((t, i) => (
              <div key={t.teacherId} className="text-xs">
                <div className="flex justify-between">
                  <span className="truncate font-medium">{t.name}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {t.periods} · max {t.busiestDay}/day
                  </span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn(
                      'h-full rounded-full motion-safe:animate-fade-in',
                      t.busiestDay > maxPerDay
                        ? 'bg-rose-500'
                        : t.busiestDay === maxPerDay
                          ? 'bg-amber-500'
                          : 'bg-emerald-500'
                    )}
                    style={{
                      width: `${(t.periods / topLoad) * 100}%`,
                      animationDelay: `${i * 40}ms`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-xl border bg-card p-4">
          {result.unplaced.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 py-6 text-center">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600">
                <Check className="h-6 w-6" />
              </span>
              <p className="text-sm font-semibold">Every class found a slot</p>
              <p className="text-xs text-muted-foreground">
                No clashes for any teacher, section or lab batch.
              </p>
            </div>
          ) : (
            <>
              <p className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-amber-700 dark:text-amber-400">
                <AlertTriangle className="h-4 w-4" />
                {result.unplaced.reduce((n, u) => n + u.periods, 0)} periods need attention
              </p>
              <ul className="max-h-56 space-y-2 overflow-y-auto pr-1 text-xs">
                {result.unplaced.map((u, i) => (
                  <li key={i} className="rounded-lg bg-amber-500/10 px-2.5 py-1.5">
                    <span className="font-medium">
                      {u.subjectName}
                      {u.batchName ? ` (${u.batchName})` : ''}
                    </span>{' '}
                    · {u.section.split(' · ').slice(-2).join(' · ')} · {u.periods} period
                    {u.periods === 1 ? '' : 's'}
                    <span className="block text-muted-foreground">{u.reason}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
