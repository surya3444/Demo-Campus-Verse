'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { CalendarClock, Loader2, MapPin, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { PageHero } from '@/components/ui/page-hero';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { academicApi, hrApi, organizationApi, teachingApi } from '@/lib/api';
import { usePermissions } from '@/hooks/usePermissions';
import { useBranchStore } from '@/store/branchStore';
import { errorMessage } from '../explorer/parts';
import { TeacherWeek } from './TeacherWeek';
import { PeriodsDialog } from './PeriodsDialog';
import {
  PeriodDialog,
  type Entry,
  type SectionSubject,
  type Slot,
  type Subject,
} from './PeriodDialog';
import { LabBatchesDialog, type LabBatch } from './LabBatchesDialog';
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

interface ClassRow {
  _id: string;
  displayName: string;
  programId?: string | null;
  departmentId?: string | null;
  path: Array<{ levelKey: string; name: string; order?: number }>;
  sections?: Array<{ _id: string; name: string }>;
}
interface Program {
  _id: string;
  name: string;
  code: string;
}
interface Teacher {
  _id: string;
  name: string;
  employeeId?: string;
}

const DAYS = [
  { n: 1, label: 'Mon' },
  { n: 2, label: 'Tue' },
  { n: 3, label: 'Wed' },
  { n: 4, label: 'Thu' },
  { n: 5, label: 'Fri' },
  { n: 6, label: 'Sat' },
];
/** A common college day: seven 50-minute periods, a short break and lunch. */
const STANDARD_PERIODS: Array<Omit<Slot, '_id' | 'order' | 'sectionId'>> = [
  { name: 'P1', startTime: '09:00', endTime: '09:50', type: 'period' },
  { name: 'P2', startTime: '09:50', endTime: '10:40', type: 'period' },
  { name: 'Break', startTime: '10:40', endTime: '11:00', type: 'break' },
  { name: 'P3', startTime: '11:00', endTime: '11:50', type: 'period' },
  { name: 'P4', startTime: '11:50', endTime: '12:40', type: 'period' },
  { name: 'Lunch', startTime: '12:40', endTime: '13:30', type: 'lunch' },
  { name: 'P5', startTime: '13:30', endTime: '14:20', type: 'period' },
  { name: 'P6', startTime: '14:20', endTime: '15:10', type: 'period' },
  { name: 'P7', startTime: '15:10', endTime: '16:00', type: 'period' },
];
const NONE = '__none__';
const shortClass = (name: string) => name.split(' · ').slice(-2).join(' · ');
const nameOf = (t: { displayName?: string; firstName?: string; lastName?: string }) =>
  t.displayName || [t.firstName, t.lastName].filter(Boolean).join(' ');

export default function TimetablePage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <Timetable />
    </Suspense>
  );
}

function Timetable() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const branchId = useBranchStore((s) => s.selectedBranchId);
  const campus = useBranchStore.getState().getSelectedBranch()?.name ?? 'This campus';
  const { hasPermission } = usePermissions();
  const canEdit = hasPermission('teaching.timetable', 'create');
  const canClear = hasPermission('teaching.timetable', 'delete');
  const view = params.get('view') === 'teacher' ? 'teacher' : 'section';
  const [periodsOpen, setPeriodsOpen] = useState(false);
  const [batchesOpen, setBatchesOpen] = useState(false);
  const [batches, setBatches] = useState<LabBatch[]>([]);
  const [clearOpen, setClearOpen] = useState(false);

  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [year, setYear] = useState<string | null>(null);
  const [programId, setProgramId] = useState<string>('');
  const sectionId = params.get('section') ?? '';
  const cls = classes.find((c) => c.sections?.some((s) => s._id === sectionId));
  const [classId, setClassId] = useState('');

  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [sectionSubjects, setSectionSubjects] = useState<SectionSubject[]>([]);
  const [subjects, setSubjects] = useState<Map<string, Subject>>(new Map());
  const [editing, setEditing] = useState<{ slot: Slot; day: number } | null>(null);
  const [busySetup, setBusySetup] = useState(false);
  const [copyFrom, setCopyFrom] = useState('');

  const setQuery = (patch: Record<string, string | null>) => {
    const q = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) q.set(k, v);
      else q.delete(k);
    }
    router.replace(`${pathname}?${q}`);
  };
  const pickSection = (id: string) => setQuery({ section: id || null });

  const clearWeek = async () => {
    try {
      const r = await teachingApi.clearSectionTimetable(sectionId);
      toast.success(
        `Cleared ${r.data.deleted} periods — the week is empty; periods & timings stay`
      );
      setClearOpen(false);
      await load();
    } catch (err) {
      toast.error(errorMessage(err, 'Could not clear the timetable'));
    }
  };

  // Current year's classes and the programs they belong to.
  useEffect(() => {
    (async () => {
      const [b, p, s] = await Promise.all([
        academicApi.getAcademicBatches().catch(() => ({ data: [] })),
        organizationApi.getPrograms({ status: 'active' }).catch(() => ({ data: [] })),
        academicApi.getSubjects({ status: 'active', limit: 1000 }).catch(() => ({ data: [] })),
      ]);
      const list = (b.data ?? []) as Array<{ _id: string; name: string; isCurrent?: boolean }>;
      const current = list.find((x) => x.isCurrent) ?? list[0];
      setYear(current?.name ?? null);
      setPrograms((p.data ?? []) as Program[]);
      setSubjects(new Map(((s.data ?? []) as Subject[]).map((x) => [x._id, x])));
      if (!current) return setClasses([]);
      const c = await academicApi
        .getClasses({ academicBatchId: current._id, limit: 500 })
        .catch(() => ({ data: [] }));
      setClasses(
        ((c.data ?? []) as ClassRow[]).sort((a, b) => a.displayName.localeCompare(b.displayName))
      );
    })();
  }, [branchId]);

  // Follow the section in the URL.
  useEffect(() => {
    if (cls) {
      setClassId(cls._id);
      setProgramId(cls.programId ?? '');
    }
  }, [cls]);

  const load = useCallback(async () => {
    if (!sectionId || !cls) return;
    setSlots(null);
    const [sl, tt, sec] = await Promise.all([
      teachingApi.getSlots(cls._id).catch(() => ({ data: [] })),
      teachingApi.getSectionTimetable(sectionId).catch(() => ({ data: [] })),
      academicApi.getSection(sectionId).catch(() => ({ data: null })),
    ]);
    setSlots(
      ((sl.data ?? []) as Slot[])
        .filter((x) => !x.sectionId || x.sectionId === sectionId)
        .sort((a, b) => a.order - b.order || a.startTime.localeCompare(b.startTime))
    );
    setEntries((tt.data ?? []) as Entry[]);
    setBatches(
      ((sec.data?.batches ?? []) as LabBatch[]).sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { numeric: true })
      )
    );
    setSectionSubjects(
      ((sec.data?.subjects ?? []) as SectionSubject[]).map((x) => ({
        subjectId: String(x.subjectId),
        teacherId: x.teacherId ? String(x.teacherId) : null,
      }))
    );
  }, [sectionId, cls]);
  useEffect(() => {
    load();
  }, [load]);

  const hasPrograms = classes.some((c) => c.programId);
  const programOptions = programs.filter((p) => classes.some((c) => c.programId === p._id));
  const yearOptions = classes.filter(
    (c) => !hasPrograms || !programId || c.programId === programId
  );
  const sectionOptions = classes.find((c) => c._id === classId)?.sections ?? [];

  const cellEntries = (slotId: string, day: number) =>
    entries.filter((e) => e.slotId === slotId && e.dayOfWeek === day);
  /** The slot straight after this one, if it's a class period (for double labs). */
  const nextPeriod = (slot: Slot) => {
    const list = slots ?? [];
    const next = list[list.findIndex((x) => x._id === slot._id) + 1];
    return next && next.type === 'period' && next.startTime >= slot.endTime ? next : undefined;
  };

  const createStandardPeriods = async () => {
    if (!cls) return;
    setBusySetup(true);
    try {
      for (const [i, p] of STANDARD_PERIODS.entries()) {
        await teachingApi.createSlot({ classId: cls._id, ...p, order: i });
      }
      toast.success(
        `Periods created for ${shortClass(cls.displayName)} — every section of this year shares them`
      );
      await load();
    } catch (err) {
      toast.error(errorMessage(err, 'Could not create the periods'));
    } finally {
      setBusySetup(false);
    }
  };
  const copyPeriods = async () => {
    if (!cls || !copyFrom) return;
    setBusySetup(true);
    try {
      await teachingApi.copySlots(copyFrom, cls._id);
      toast.success('Periods copied');
      await load();
    } catch (err) {
      toast.error(errorMessage(err, 'Could not copy the periods'));
    } finally {
      setBusySetup(false);
    }
  };

  const section = cls?.sections?.find((s) => s._id === sectionId);
  // Periods, not rows: a lab period with two batches is still one period.
  const filled = new Set(
    entries.filter((e) => !e.isLinked).map((e) => `${e.slotId}:${e.dayOfWeek}`)
  ).size;
  const teachingPeriods = (slots ?? []).filter((s) => s.type === 'period').length * DAYS.length;

  return (
    <div className="space-y-6">
      <PageHero
        icon={CalendarClock}
        eyebrow="Academic Structure"
        title="Timetable"
        description="One place to build and read timetables: by section to plan a class's week, by teacher to see anyone's load."
      />

      <div className="inline-flex rounded-lg border bg-muted/40 p-1 text-sm">
        {(['section', 'teacher'] as const).map((v) => (
          <button
            key={v}
            onClick={() => setQuery({ view: v === 'teacher' ? 'teacher' : null })}
            className={`rounded-md px-3 py-1.5 font-medium transition-colors ${view === v ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
          >
            {v === 'section' ? 'By section' : 'By teacher'}
          </button>
        ))}
      </div>

      {view === 'teacher' && (
        <TeacherView
          initialStaffId={params.get('teacher') ?? ''}
          onPickStaff={(id) => setQuery({ teacher: id || null })}
          onOpenSection={(id) => setQuery({ view: null, teacher: null, section: id })}
        />
      )}

      {view === 'section' && (
        <>
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-primary/25 bg-primary/[0.04] px-4 py-2.5 text-sm">
            <MapPin className="h-4 w-4 text-primary" />
            <span className="font-semibold">{campus}</span>
            {cls && <span>› {shortClass(cls.displayName)}</span>}
            {section && <span className="font-semibold">› Section {section.name}</span>}
            <span className="text-muted-foreground">
              {year ? `· ${year}` : ''} · switch campus at the top right
            </span>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            {hasPrograms && (
              <div className="space-y-1.5">
                <Label>Program</Label>
                <Select
                  value={programId || NONE}
                  onValueChange={(v) => {
                    setProgramId(v === NONE ? '' : v);
                    setClassId('');
                    pickSection('');
                  }}
                >
                  <SelectTrigger className="w-72">
                    <SelectValue placeholder="Pick a program" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>All programs</SelectItem>
                    {programOptions.map((p) => (
                      <SelectItem key={p._id} value={p._id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Year</Label>
              <Select
                value={classId || NONE}
                onValueChange={(v) => {
                  setClassId(v === NONE ? '' : v);
                  const only = classes.find((c) => c._id === v)?.sections;
                  pickSection(only?.length === 1 ? only[0]._id : '');
                }}
              >
                <SelectTrigger className="w-72">
                  <SelectValue placeholder="Pick a year" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE} disabled>
                    Pick a year
                  </SelectItem>
                  {yearOptions.map((c) => (
                    <SelectItem key={c._id} value={c._id}>
                      {programId
                        ? shortClass(c.displayName).split(' · ').pop()
                        : shortClass(c.displayName)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Section</Label>
              <Select
                value={sectionId || NONE}
                onValueChange={(v) => pickSection(v === NONE ? '' : v)}
              >
                <SelectTrigger className="w-40" disabled={!classId}>
                  <SelectValue placeholder="Section" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE} disabled>
                    Section
                  </SelectItem>
                  {sectionOptions.map((s) => (
                    <SelectItem key={s._id} value={s._id}>
                      Section {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="ml-auto flex flex-wrap gap-2">
              {cls && canEdit && slots && slots.length > 0 && (
                <Button variant="outline" size="sm" onClick={() => setPeriodsOpen(true)}>
                  Periods &amp; timings
                </Button>
              )}
              {sectionId && canEdit && (
                <Button variant="outline" size="sm" onClick={() => setBatchesOpen(true)}>
                  Lab batches{batches.length ? ` (${batches.map((b) => b.name).join(', ')})` : ''}
                </Button>
              )}
              {sectionId && canClear && entries.some((e) => !e.isLinked) && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive"
                  onClick={() => setClearOpen(true)}
                >
                  <Trash2 className="mr-1.5 h-4 w-4" />
                  Clear week
                </Button>
              )}
              <Button variant="outline" size="sm" asChild>
                <Link href={`/hr/timetable${sectionId ? `?sectionId=${sectionId}` : ''}`}>
                  Electives &amp; combined classes
                </Link>
              </Button>
            </div>
          </div>

          {!sectionId || !cls ? (
            <p className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
              Pick a program, year and section to see and build its week.
            </p>
          ) : slots === null ? (
            <div className="flex h-40 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : slots.length === 0 ? (
            <div className="space-y-4 rounded-xl border border-dashed p-6">
              <div>
                <p className="font-medium">{shortClass(cls.displayName)} has no periods yet</p>
                <p className="text-sm text-muted-foreground">
                  Periods are the day&apos;s time blocks (P1 09:00–09:50…). Every section of this
                  year shares them.
                </p>
              </div>
              {canEdit && (
                <div className="flex flex-wrap items-center gap-3">
                  <Button onClick={createStandardPeriods} disabled={busySetup}>
                    {busySetup && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                    Create standard periods (7 + break + lunch)
                  </Button>
                  <span className="text-sm text-muted-foreground">or copy from</span>
                  <Select
                    value={copyFrom || NONE}
                    onValueChange={(v) => setCopyFrom(v === NONE ? '' : v)}
                  >
                    <SelectTrigger className="w-72">
                      <SelectValue placeholder="Another year" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE} disabled>
                        Another year
                      </SelectItem>
                      {classes
                        .filter((c) => c._id !== cls._id)
                        .map((c) => (
                          <SelectItem key={c._id} value={c._id}>
                            {shortClass(c.displayName)}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <Button variant="outline" onClick={copyPeriods} disabled={!copyFrom || busySetup}>
                    Copy
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                {filled} of {teachingPeriods} periods filled · {sectionSubjects.length} subjects in
                this section
                {sectionSubjects.length === 0 && ' — add them in the program’s Curriculum first'}
              </p>
              <div className="overflow-x-auto rounded-xl border bg-card">
                <table className="w-full min-w-[860px] table-fixed text-sm">
                  <thead className="border-b bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="w-28 px-3 py-2.5 text-left">Period</th>
                      {DAYS.map((d) => (
                        <th key={d.n} className="px-2 py-2.5 text-left">
                          {d.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {slots.map((slot) =>
                      slot.type !== 'period' ? (
                        <tr key={slot._id} className="bg-muted/30">
                          <td className="px-3 py-1.5 text-xs text-muted-foreground">
                            {slot.startTime}–{slot.endTime}
                          </td>
                          <td
                            colSpan={DAYS.length}
                            className="px-2 py-1.5 text-xs font-medium capitalize text-muted-foreground"
                          >
                            {slot.name}
                          </td>
                        </tr>
                      ) : (
                        <tr key={slot._id}>
                          <td className="px-3 py-2 align-top">
                            <p className="font-medium">{slot.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {slot.startTime}–{slot.endTime}
                            </p>
                          </td>
                          {DAYS.map((d) => {
                            const here = cellEntries(slot._id, d.n);
                            return (
                              <td key={d.n} className="p-1 align-top">
                                <button
                                  disabled={!canEdit}
                                  onClick={() => setEditing({ slot, day: d.n })}
                                  className="h-full min-h-14 w-full rounded-lg border border-transparent p-1.5 text-left transition-colors hover:border-primary/40 hover:bg-primary/[0.04] disabled:cursor-default"
                                >
                                  {here.length === 0 ? (
                                    <span className="text-xs text-muted-foreground/60">
                                      {canEdit ? '+ Add' : ''}
                                    </span>
                                  ) : (
                                    here.map((e) => (
                                      <span key={e._id} className="block">
                                        <span className="block truncate text-xs font-semibold">
                                          {e.batchName && (
                                            <span className="mr-1 rounded bg-primary/10 px-1 text-[10px] font-semibold text-primary">
                                              {e.batchName}
                                            </span>
                                          )}
                                          {e.subjectName}
                                        </span>
                                        <span className="block truncate text-[11px] text-muted-foreground">
                                          {e.teacherName}
                                          {e.roomNumber ? ` · ${e.roomNumber}` : ''}
                                        </span>
                                      </span>
                                    ))
                                  )}
                                </button>
                              </td>
                            );
                          })}
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}

      {cls && (
        <PeriodsDialog
          open={periodsOpen}
          classId={cls._id}
          yearLabel={shortClass(cls.displayName)}
          slots={slots ?? []}
          onClose={() => setPeriodsOpen(false)}
          onChanged={load}
        />
      )}

      <AlertDialog open={clearOpen} onOpenChange={setClearOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Clear {section ? `Section ${section.name}'s` : 'this'} whole week?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Removes all {filled} periods from this section&apos;s timetable. Periods &amp;
              timings, other sections and teachers&apos; other classes are not touched. This
              can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                clearWeek();
              }}
            >
              Clear week
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {editing && cls && (
        <PeriodDialog
          sectionId={sectionId}
          departmentId={cls.departmentId ?? null}
          slot={editing.slot}
          nextSlot={nextPeriod(editing.slot)}
          nextSlotTaken={
            !!nextPeriod(editing.slot) &&
            cellEntries(nextPeriod(editing.slot)!._id, editing.day).length > 0
          }
          day={editing.day}
          existing={cellEntries(editing.slot._id, editing.day)}
          batches={batches}
          sectionSubjects={sectionSubjects}
          subjects={subjects}
          onClose={() => setEditing(null)}
          onSaved={load}
          onManageBatches={() => setBatchesOpen(true)}
        />
      )}

      {sectionId && section && (
        <LabBatchesDialog
          open={batchesOpen}
          sectionId={sectionId}
          sectionName={section.name}
          onClose={() => setBatchesOpen(false)}
          onChanged={load}
        />
      )}
    </div>
  );
}

/** Pick a department, then a teacher, and see their week. */
function TeacherView({
  initialStaffId,
  onPickStaff,
  onOpenSection,
}: {
  initialStaffId: string;
  onPickStaff: (id: string) => void;
  onOpenSection: (sectionId: string) => void;
}) {
  const [departments, setDepartments] = useState<Array<{ _id: string; name: string }>>([]);
  const [dept, setDept] = useState('');
  const [staff, setStaff] = useState<Teacher[]>([]);
  const staffId = initialStaffId;

  useEffect(() => {
    hrApi
      .getDepartments()
      .then((r) => setDepartments((r.data ?? []) as Array<{ _id: string; name: string }>))
      .catch(() => setDepartments([]));
  }, []);
  useEffect(() => {
    hrApi
      .getStaff({
        ...(dept && { departmentId: dept }),
        isTeaching: true,
        status: 'active',
        limit: 300,
      })
      .then((r) =>
        setStaff(
          (
            (r.data ?? []) as Array<{
              _id: string;
              employeeId?: string;
              displayName?: string;
              firstName?: string;
              lastName?: string;
            }>
          )
            .map((t) => ({ _id: t._id, name: nameOf(t), employeeId: t.employeeId }))
            .sort((a, b) => a.name.localeCompare(b.name))
        )
      )
      .catch(() => setStaff([]));
  }, [dept]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label>Department</Label>
          <Select value={dept || NONE} onValueChange={(v) => setDept(v === NONE ? '' : v)}>
            <SelectTrigger className="w-72">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>All departments</SelectItem>
              {departments.map((d) => (
                <SelectItem key={d._id} value={d._id}>
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Teacher</Label>
          <Select value={staffId || NONE} onValueChange={(v) => onPickStaff(v === NONE ? '' : v)}>
            <SelectTrigger className="w-80">
              <SelectValue placeholder="Pick a teacher" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE} disabled>
                Pick a teacher
              </SelectItem>
              {staff.map((t) => (
                <SelectItem key={t._id} value={t._id}>
                  {t.name}
                  {t.employeeId ? ` · ${t.employeeId}` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      {staffId ? (
        <TeacherWeek staffId={staffId} onOpenSection={onOpenSection} />
      ) : (
        <p className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          Pick a teacher to see their week. Click any class to open that section&apos;s timetable.
        </p>
      )}
    </div>
  );
}
