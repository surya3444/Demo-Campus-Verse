'use client';

import { yearTermRanges } from '@campus-verse/shared';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  Plus,
  Trash2,
  Users,
  GraduationCap,
  School,
  BookOpen,
  Calendar,
  Check,
  AlertCircle,
  ChevronRight,
  Layers,
  Sparkles,
  CircleDot,
  ArrowUpRight,
  UserSquare2,
  Hash,
  CalendarRange,
  FlaskConical,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { DatePicker } from '@/components/ui/date-picker';
import { academicApi, organizationApi, hrApi } from '@/lib/api';
import { useBranchStore } from '@/store/branchStore';
import { getErrorMessage } from '@/lib/utils';
import {
  SemestersDialog,
  termPositionLabel,
  type BatchTerm,
} from '@/components/academic/SemestersDialog';
import { LabBatchesDialog, type LabBatch } from '@/components/academic/LabBatchesDialog';
import { usePermissions } from '@/hooks/usePermissions';
import { isDepartmentLevelKey } from '@campus-verse/shared/utils';

// ──────────────────────────── Types ────────────────────────────

interface Batch {
  _id: string;
  name: string;
  code: string;
  startDate: string;
  endDate: string;
  isCurrent?: boolean;
  status: string;
  /** Semester terms — managed inline from the year hero (SemestersDialog). */
  terms?: BatchTerm[];
}

interface SectionSubject {
  subjectId: string;
  teacherId?: string | null;
  /** Set when the subject came from a published curriculum (universities). */
  semesterNumber?: number;
  subject: { _id: string; name: string; code: string } | null;
  teacher?: { _id: string; name: string } | null;
}

interface Section {
  _id: string;
  name: string;
  code?: string;
  capacity?: number;
  studentCount?: number;
  classTeacher?: { _id: string; name: string };
  sectionTeacherId?: string;
  subjects?: SectionSubject[];
  /** Lab batches — subdivisions for practical scheduling. */
  batches?: LabBatch[];
}

interface ClassPathEntry {
  levelKey: string;
  name: string;
  code: string;
  order?: number;
}

interface Cls {
  _id: string;
  displayName: string;
  path?: ClassPathEntry[];
  capacity?: number;
  studentCount?: number;
  sections?: Section[];
  /** FK → programs. Set explicitly on create; drives curriculum + OBE lookups. */
  programId?: string;
}

interface ProgramOption {
  _id: string;
  name: string;
  code: string;
  departmentId: string;
  degreeType: 'ug' | 'pg' | 'diploma' | 'phd' | 'certificate';
  /** How many years the program runs — drives the Year picker on a class. */
  durationYears: number;
  termPattern?: string;
  yearPatterns?: Array<'annual' | 'semester' | 'trimester'>;
  department?: { _id: string; name: string; code: string } | null;
}

interface HierarchyLevel {
  key: string;
  label: string;
  labelPlural: string;
  isLeaf: boolean;
  order: number;
}

interface Subject {
  _id: string;
  name: string;
  code: string;
  type: 'theory' | 'practical' | 'both';
  description?: string;
  credits?: number;
  applicableTo?: { departments?: string[] };
  ownerDepartment?: { _id: string; name: string; code: string } | null;
}

interface DeptOption {
  _id: string;
  name: string;
  code: string;
}

interface Teacher {
  _id: string;
  name: string;
  firstName?: string;
  lastName?: string;
  employeeId?: string;
}

// ──────────────────────────── Helpers ────────────────────────────

const slug = (s: string) =>
  s
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '_')
    .replace(/[^A-Z0-9_]/g, '');
const teacherName = (t: Teacher) =>
  t.name ?? `${t.firstName ?? ''} ${t.lastName ?? ''}`.trim() ?? 'Teacher';

/** Select sentinel — Radix Select rejects an empty-string item value. */
const NO_PROGRAM = '__none__';

/**
 * Optional degree-program link for a class. Renders nothing when the branch
 * has no programs, which is every school and any college that hasn't defined
 * one — the picker is a university-tier affordance, not a new required field.
 */
/** "Year 2", "2nd Year", "II Year" → 2; null when there is no number to read. */
function yearNumber(name: string): number | null {
  const digits = String(name ?? '').match(/\d+/);
  return digits ? Number(digits[0]) : null;
}

/**
 * Apply a program's shape to a half-filled class path: its department fills the
 * department level, and a year the program can't have (Year 5 of a 4-year
 * B.Tech) is cleared rather than left to fail server-side.
 */
function applyProgramToPath(
  values: string[],
  nonLeaf: HierarchyLevel[],
  program: ProgramOption | null
): string[] {
  if (!program) return values;
  const next = [...values];
  const deptIdx = nonLeaf.findIndex((l) => isDepartmentLevelKey(l.key));
  if (deptIdx >= 0 && program.department) next[deptIdx] = program.department.name;
  // Hierarchies that put the program itself on the path (department → program →
  // year) get that entry filled too, so the label and the FK never disagree.
  const programIdx = nonLeaf.findIndex((l) => l.key === 'program');
  if (programIdx >= 0) next[programIdx] = program.name;
  const yearIdx = nonLeaf.findIndex((l) => l.key === 'year');
  if (yearIdx >= 0) {
    const year = yearNumber(next[yearIdx] ?? '');
    if (year !== null && program.durationYears > 0 && year > program.durationYears) {
      next[yearIdx] = '';
    }
  }
  return next;
}

/**
 * The one field that changes shape with the program: with a program picked, a
 * year is a choice out of that program's duration, not free text.
 */
function ClassLevelField({
  level,
  value,
  program,
  onChange,
  autoFocus,
  onEnter,
}: {
  level: HierarchyLevel;
  value: string;
  program: ProgramOption | null;
  onChange: (value: string) => void;
  autoFocus?: boolean;
  onEnter?: () => void;
}) {
  const isYear = level.key === 'year';
  const isDepartment = isDepartmentLevelKey(level.key);
  const fieldId = `field-${level.key}-name`;

  if (isYear && program && program.durationYears > 0) {
    return (
      <div className="space-y-1.5">
        <Label htmlFor={fieldId}>{level.label}</Label>
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger id={fieldId}>
            <SelectValue placeholder={`Pick a ${level.label.toLowerCase()}`} />
          </SelectTrigger>
          <SelectContent>
            {yearTermRanges(program).map((r) => (
              <SelectItem key={r.year} value={`Year ${r.year}`}>
                Year {r.year} ·{' '}
                {r.pattern === 'annual'
                  ? 'Annual'
                  : r.pattern === 'trimester'
                    ? 'Trimesters'
                    : 'Semesters'}{' '}
                ({r.first === r.last ? `term ${r.first}` : `terms ${r.first}–${r.last}`})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-[11px] text-muted-foreground">
          {program.name} runs for {program.durationYears} year
          {program.durationYears === 1 ? '' : 's'}.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <Label htmlFor={fieldId}>{level.label} name</Label>
      <Input
        id={fieldId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && onEnter) onEnter();
        }}
        placeholder={
          level.key === 'grade'
            ? 'Grade 5'
            : level.key === 'stream'
              ? 'Computer Science'
              : level.key === 'year'
                ? 'Year 2'
                : level.key === 'department'
                  ? 'Mechanical Engineering'
                  : level.label
        }
        autoFocus={autoFocus}
      />
      {isDepartment && program?.department && (
        <p className="text-[11px] text-muted-foreground">
          Set from {program.name}, which {program.department.name} offers.
        </p>
      )}
    </div>
  );
}

function ProgramPicker({
  programs,
  value,
  onChange,
}: {
  programs: ProgramOption[];
  value: string;
  onChange: (value: string) => void;
}) {
  if (programs.length === 0) return null;
  return (
    <div className="space-y-1.5">
      <Label htmlFor="field-program">
        Program <span className="text-muted-foreground">(optional)</span>
      </Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id="field-program">
          <SelectValue placeholder="No program" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NO_PROGRAM}>No program</SelectItem>
          {programs.map((p) => (
            <SelectItem key={p._id} value={p._id}>
              {p.name}
              {p.department ? ` · ${p.department.code}` : ''}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-[11px] text-muted-foreground">
        Links this cohort to a degree program, so course registration picks the right curriculum and
        OBE attainment rolls up per program.
      </p>
    </div>
  );
}

// ──────────────────────────── Page ────────────────────────────

export default function AcademicStructurePage() {
  const branch = useBranchStore((s) => s.getSelectedBranch());

  const { hasPermission } = usePermissions();
  const canEditSettings =
    hasPermission('organization.settings', 'edit') ||
    hasPermission('organization.academics', 'edit');
  const [loading, setLoading] = useState(true);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [activeBatchId, setActiveBatchId] = useState<string | null>(null);
  const [classes, setClasses] = useState<Cls[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [hierarchy, setHierarchy] = useState<HierarchyLevel[]>([]);
  // Degree programs of this branch. Empty for schools — every program-aware
  // control below hides itself when the list is empty, so nothing changes for
  // tenants that never defined one.
  const [programs, setPrograms] = useState<ProgramOption[]>([]);

  const [showNewYear, setShowNewYear] = useState(false);
  const [showNewClass, setShowNewClass] = useState(false);
  const [showSubjectLibrary, setShowSubjectLibrary] = useState(false);
  const [showClassLibrary, setShowClassLibrary] = useState(false);
  const [showSemesters, setShowSemesters] = useState(false);
  const [addSubjectFor, setAddSubjectFor] = useState<{ cls: Cls; section: Section } | null>(null);
  const [addSectionFor, setAddSectionFor] = useState<Cls | null>(null);
  const [labBatchesFor, setLabBatchesFor] = useState<{ cls: Cls; section: Section } | null>(null);

  // Single confirm dialog reused across every destructive action on the page.
  const [confirmState, setConfirmState] = useState<{
    title: string;
    description: string;
    confirmLabel?: string;
    onConfirm: () => Promise<void> | void;
  } | null>(null);
  const [confirmRunning, setConfirmRunning] = useState(false);

  const requestConfirm = useCallback(
    (opts: {
      title: string;
      description: string;
      confirmLabel?: string;
      onConfirm: () => Promise<void> | void;
    }) => setConfirmState(opts),
    []
  );

  // Initial load
  const loadCore = useCallback(async () => {
    setLoading(true);
    try {
      const [batchRes, subjRes, teachRes, hierRes, programRes] = await Promise.all([
        academicApi.getAcademicBatches(),
        academicApi.getSubjects(),
        academicApi.getAvailableTeachers(),
        organizationApi.getAcademicHierarchy(branch?._id),
        // Programs are a university-tier concept; a branch without any (or a
        // caller without the permission) simply gets none.
        organizationApi.getPrograms({ status: 'active' }).catch(() => ({ data: [] })),
      ]);
      const b: Batch[] = batchRes.data?.batches ?? batchRes.data ?? [];
      setBatches(b);
      const current = b.find((x) => x.isCurrent) ?? b[0];
      setActiveBatchId(current?._id ?? null);
      setSubjects(subjRes.data?.subjects ?? subjRes.data ?? []);
      setTeachers(teachRes.data?.teachers ?? teachRes.data ?? []);
      setHierarchy(hierRes.data?.levels ?? []);
      setPrograms((programRes.data ?? []) as ProgramOption[]);
    } catch (err) {
      toast.error(getErrorMessage(err) || 'Failed to load academic data');
    } finally {
      setLoading(false);
    }
  }, [branch?._id]);

  useEffect(() => {
    loadCore();
  }, [loadCore]);

  // Load classes (with sections, each section hydrated with its subjects) for active batch.
  // Errors from any nested fetch propagate up to the outer try/catch — silently
  // returning empty arrays here used to mask real failures (the "I saved a section
  // but it doesn't appear" bug) by replacing failed reads with empty lists.
  const loadClasses = useCallback(async (batchId: string) => {
    try {
      // Single aggregated request — the backend composes classes → sections →
      // subjects. Previously this fanned out into 1 + N + N×M parallel XHRs,
      // which tripped the API gateway rate limit and surfaced as 503/CORS.
      const res = await academicApi.getClassTree(batchId);
      const hydrated: Cls[] = res.data?.classes ?? [];
      setClasses(
        [...hydrated].sort((a, b) => {
          const aOrder = a.path?.[0]?.order ?? 0;
          const bOrder = b.path?.[0]?.order ?? 0;
          if (aOrder !== bOrder) return aOrder - bOrder;
          return (a.displayName || '').localeCompare(b.displayName || '');
        })
      );
    } catch (err) {
      toast.error(getErrorMessage(err) || 'Failed to load classes');
    }
  }, []);

  useEffect(() => {
    if (activeBatchId) loadClasses(activeBatchId);
    else setClasses([]);
  }, [activeBatchId, loadClasses]);

  // ───────── Surgical state helpers ─────────
  // We previously refetched the entire class tree (1 + N + N×M requests) after
  // every mutation, which is both slow and the source of the "I added it but
  // nothing appears" bug whenever any of those follow-up fetches transiently
  // fails. These mutate just the affected node in local state from the response
  // payload, so the UI updates instantly and survives a flaky network.

  const updateSectionLocal = useCallback(
    (classId: string, sectionId: string, mutate: (s: Section) => Section) => {
      setClasses((prev) =>
        prev.map((c) =>
          c._id === classId
            ? {
                ...c,
                sections: (c.sections ?? []).map((s) => (s._id === sectionId ? mutate(s) : s)),
              }
            : c
        )
      );
    },
    []
  );

  const addSectionLocal = useCallback((classId: string, section: Section) => {
    setClasses((prev) =>
      prev.map((c) =>
        c._id === classId
          ? {
              ...c,
              sections: [...(c.sections ?? []), { ...section, subjects: section.subjects ?? [] }],
            }
          : c
      )
    );
  }, []);

  const removeSectionLocal = useCallback((classId: string, sectionId: string) => {
    setClasses((prev) =>
      prev.map((c) =>
        c._id === classId
          ? { ...c, sections: (c.sections ?? []).filter((s) => s._id !== sectionId) }
          : c
      )
    );
  }, []);

  const removeClassLocal = useCallback((classId: string) => {
    setClasses((prev) => prev.filter((c) => c._id !== classId));
  }, []);

  const addClassLocal = useCallback((cls: Cls) => {
    setClasses((prev) =>
      [...prev, { ...cls, sections: cls.sections ?? [] }].sort((a, b) => {
        const aOrder = a.path?.[0]?.order ?? 0;
        const bOrder = b.path?.[0]?.order ?? 0;
        if (aOrder !== bOrder) return aOrder - bOrder;
        return (a.displayName || '').localeCompare(b.displayName || '');
      })
    );
  }, []);

  const activeBatch = batches.find((b) => b._id === activeBatchId);

  // ───────────────── Loading state ─────────────────

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  // ───────────────── Empty state: no academic year yet ─────────────────

  if (batches.length === 0) {
    return (
      <>
        <PageHeading hierarchy={hierarchy} />
        <div className="relative mt-8 overflow-hidden rounded-3xl border bg-gradient-to-br from-primary/[0.04] via-background to-[hsl(var(--brand-cyan)/0.04)] p-12 text-center sm:p-20">
          <DotGrid />
          <div className="relative mx-auto max-w-md space-y-6">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
              <Calendar className="h-7 w-7" />
            </div>
            <div className="space-y-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary/60">
                Chapter 01
              </p>
              <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
                Begin with an
                <span className="italic font-display"> academic year.</span>
              </h2>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Everything else lives inside it — your full academic structure, subjects, teachers,
                and students. Pick the dates of your current session and we&apos;ll handle the rest.
              </p>
            </div>
            <Button size="lg" onClick={() => setShowNewYear(true)} className="shadow-sm">
              <Plus className="mr-1.5 h-4 w-4" /> Create academic year
            </Button>
          </div>
        </div>
        <NewYearDialog
          open={showNewYear}
          onClose={() => setShowNewYear(false)}
          onCreated={async () => {
            setShowNewYear(false);
            await loadCore();
          }}
        />
      </>
    );
  }

  // ───────────────── Main content ─────────────────

  const totalSections = classes.reduce((s, c) => s + (c.sections?.length ?? 0), 0);
  const totalStudents = classes.reduce((s, c) => s + (c.studentCount ?? 0), 0);

  // Universities/colleges have a two-level hierarchy (department → year,
  // stream → batch): each class is one top-level×sub-level pair. Group and
  // sort the flat list by its TOP level so a department appears once with its
  // years nested — instead of every department-year pair reading as its own
  // "department" (and inflating the department count).
  // Plain computation, deliberately NOT a hook: this sits below the loading /
  // empty-state early returns, where hooks are illegal (rules of hooks).
  const isGroupedHierarchy = hierarchy.filter((l) => !l.isLeaf).length >= 2;
  const orderedClasses = !isGroupedHierarchy
    ? classes
    : [...classes].sort((a, b) => {
        const aTop = a.path?.[0]?.name ?? a.displayName;
        const bTop = b.path?.[0]?.name ?? b.displayName;
        if (aTop !== bTop) return aTop.localeCompare(bTop);
        const aSub = a.path?.[1];
        const bSub = b.path?.[1];
        if (aSub?.order !== undefined && bSub?.order !== undefined && aSub.order !== bSub.order) {
          return aSub.order - bSub.order;
        }
        return (aSub?.name ?? '').localeCompare(bSub?.name ?? '', undefined, { numeric: true });
      });
  const topLevelCount = isGroupedHierarchy
    ? new Set(classes.map((c) => c.path?.[0]?.name ?? c.displayName)).size
    : classes.length;

  return (
    <div className="space-y-10 pb-16">
      <PageHeading hierarchy={hierarchy} />

      {/* ───────── Year hero strip ───────── */}
      <YearHero
        batches={batches}
        activeBatch={activeBatch}
        activeBatchId={activeBatchId}
        setActiveBatchId={setActiveBatchId}
        hierarchy={hierarchy}
        classCount={topLevelCount}
        totalSections={totalSections}
        totalStudents={totalStudents}
        subjectCount={subjects.length}
        onSetCurrent={async () => {
          if (!activeBatch) return;
          await academicApi.setCurrentBatch(activeBatch._id);
          toast.success('Set as active year');
          await loadCore();
        }}
        onNewYear={() => setShowNewYear(true)}
        onNewClass={() => setShowNewClass(true)}
        onManageSubjects={() => setShowSubjectLibrary(true)}
        onManageClasses={() => setShowClassLibrary(true)}
        onManageSemesters={() => setShowSemesters(true)}
      />

      {activeBatch && (
        <SemestersDialog
          open={showSemesters}
          onClose={() => setShowSemesters(false)}
          batchId={activeBatch._id}
          batchName={activeBatch.name}
          terms={activeBatch.terms ?? []}
          canManage={canEditSettings}
          onChanged={loadCore}
        />
      )}

      {/* ───────── Layout: navigator + class panels ───────── */}
      {classes.length === 0 ? (
        <ClassesEmptyState
          activeBatchName={activeBatch?.name}
          hierarchy={hierarchy}
          onAdd={() => setShowNewClass(true)}
        />
      ) : (
        <div className="grid grid-cols-1 gap-8 xl:grid-cols-[260px_1fr]">
          {/* Sticky class navigator */}
          <aside className="hidden self-start sticky top-6 xl:block">
            <ClassNavigator classes={orderedClasses} hierarchy={hierarchy} />
          </aside>

          {/* Class detail stream */}
          <div className="space-y-6">
            {orderedClasses.map((cls) => (
              <ClassPanel
                key={cls._id}
                cls={cls}
                teachers={teachers}
                hierarchy={hierarchy}
                onAddSection={() => setAddSectionFor(cls)}
                onAddSubject={(section) => setAddSubjectFor({ cls, section })}
                onManageBatches={(section) => setLabBatchesFor({ cls, section })}
                onClassTeacher={async (sectionId, teacherId) => {
                  try {
                    const res = await academicApi.assignTeacher(sectionId, teacherId);
                    const updated = res.data as Partial<Section>;
                    updateSectionLocal(cls._id, sectionId, (s) => ({
                      ...s,
                      // Server may have auto-created a staff record and returned its
                      // new id — adopt that so future picks match teachers list.
                      sectionTeacherId: updated.sectionTeacherId ?? undefined,
                      classTeacher: updated.classTeacher ?? undefined,
                    }));
                    toast.success('Section teacher updated');
                  } catch (err) {
                    toast.error(getErrorMessage(err) || 'Failed to assign teacher');
                  }
                }}
                onSubjectTeacher={async (sectionId, subjectId, teacherId) => {
                  try {
                    const res = await academicApi.updateSectionSubject(sectionId, subjectId, {
                      teacherId: teacherId ?? null,
                    });
                    const subjects = (res.data ?? []) as SectionSubject[];
                    updateSectionLocal(cls._id, sectionId, (s) => ({ ...s, subjects }));
                    toast.success('Subject teacher updated');
                  } catch (err) {
                    toast.error(getErrorMessage(err) || 'Failed to assign subject teacher');
                  }
                }}
                onRemoveSubject={(sectionId, subjectId) =>
                  requestConfirm({
                    title: 'Remove subject from section?',
                    description:
                      'The subject will be unassigned from this section. The subject itself stays in your library.',
                    confirmLabel: 'Remove',
                    onConfirm: async () => {
                      try {
                        await academicApi.removeSubjectFromSection(sectionId, subjectId);
                        updateSectionLocal(cls._id, sectionId, (s) => ({
                          ...s,
                          subjects: (s.subjects ?? []).filter((x) => x.subjectId !== subjectId),
                        }));
                        toast.success('Subject removed');
                      } catch (err) {
                        toast.error(getErrorMessage(err) || 'Failed to remove subject');
                      }
                    },
                  })
                }
                onDeleteSection={(sectionId) =>
                  requestConfirm({
                    title: 'Delete this section?',
                    description:
                      'Students enrolled in this section will be unassigned. This cannot be undone.',
                    onConfirm: async () => {
                      try {
                        await academicApi.deleteSection(sectionId);
                        removeSectionLocal(cls._id, sectionId);
                        toast.success('Section deleted');
                      } catch (err) {
                        toast.error(getErrorMessage(err) || 'Failed to delete section');
                      }
                    },
                  })
                }
                onDeleteClass={() =>
                  requestConfirm({
                    title: `Delete ${cls.displayName}?`,
                    description:
                      'All sections under this class will also be deleted. Students will be unassigned. This cannot be undone.',
                    onConfirm: async () => {
                      try {
                        await academicApi.deleteClass(cls._id);
                        removeClassLocal(cls._id);
                        toast.success('Class deleted');
                      } catch (err) {
                        toast.error(getErrorMessage(err) || 'Failed to delete class');
                      }
                    },
                  })
                }
              />
            ))}
            <button
              onClick={() => setShowNewClass(true)}
              className="group flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border py-6 text-sm font-medium text-muted-foreground transition-all hover:border-primary/40 hover:bg-primary/[0.02] hover:text-primary"
            >
              <Plus className="h-4 w-4 transition-transform group-hover:rotate-90" />
              Add another {(hierarchy.find((l) => !l.isLeaf)?.label ?? 'class').toLowerCase()}
            </button>
          </div>
        </div>
      )}

      {/* Dialogs */}
      <NewYearDialog
        open={showNewYear}
        onClose={() => setShowNewYear(false)}
        onCreated={async () => {
          setShowNewYear(false);
          await loadCore();
        }}
      />
      <NewClassDialog
        open={showNewClass}
        hierarchy={hierarchy}
        existingClasses={classes}
        programs={programs}
        onClose={() => setShowNewClass(false)}
        onCreated={(cls) => {
          setShowNewClass(false);
          addClassLocal(cls);
        }}
        academicBatchId={activeBatchId ?? ''}
      />
      <AddSectionDialog
        cls={addSectionFor}
        hierarchy={hierarchy}
        onClose={() => setAddSectionFor(null)}
        onCreated={(parentCls, section) => {
          setAddSectionFor(null);
          addSectionLocal(parentCls._id, section);
        }}
      />
      <AddSubjectToSectionDialog
        target={addSubjectFor}
        subjects={subjects}
        teachers={teachers}
        onClose={() => setAddSubjectFor(null)}
        onCreated={(parentCls, section, nextSubjects) => {
          setAddSubjectFor(null);
          updateSectionLocal(parentCls._id, section._id, (s) => ({
            ...s,
            subjects: nextSubjects,
          }));
        }}
      />
      <LabBatchesDialog
        target={
          labBatchesFor
            ? {
                sectionId: labBatchesFor.section._id,
                sectionName: labBatchesFor.section.name,
                className: labBatchesFor.cls.displayName,
                batches: labBatchesFor.section.batches ?? [],
              }
            : null
        }
        canManage={canEditSettings}
        onClose={() => setLabBatchesFor(null)}
        onSaved={(sectionId, nextBatches) => {
          if (labBatchesFor) {
            updateSectionLocal(labBatchesFor.cls._id, sectionId, (s) => ({
              ...s,
              batches: nextBatches,
            }));
          }
        }}
      />
      <SubjectLibraryDialog
        open={showSubjectLibrary}
        subjects={subjects}
        onClose={() => setShowSubjectLibrary(false)}
        onChanged={loadCore}
        requestConfirm={requestConfirm}
      />
      <ClassLibraryDialog
        open={showClassLibrary}
        classes={classes}
        hierarchy={hierarchy}
        programs={programs}
        academicBatchId={activeBatchId ?? ''}
        onClose={() => setShowClassLibrary(false)}
        onChanged={async () => {
          if (activeBatchId) await loadClasses(activeBatchId);
        }}
        requestConfirm={requestConfirm}
      />

      {/* Single shared confirm dialog for every destructive action on the page. */}
      <AlertDialog
        open={!!confirmState}
        onOpenChange={(o) => {
          if (!o && !confirmRunning) setConfirmState(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmState?.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirmState?.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={confirmRunning}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={confirmRunning}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 focus:ring-destructive"
              onClick={async (e) => {
                e.preventDefault();
                if (!confirmState) return;
                setConfirmRunning(true);
                try {
                  await confirmState.onConfirm();
                } finally {
                  setConfirmRunning(false);
                  setConfirmState(null);
                }
              }}
            >
              {confirmRunning ? 'Deleting…' : (confirmState?.confirmLabel ?? 'Delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ──────────────────────────── Page heading ────────────────────────────

function PageHeading({ hierarchy }: { hierarchy: HierarchyLevel[] }) {
  const ordered = [...hierarchy].sort((a, b) => a.order - b.order);
  return (
    <header className="relative flex flex-col gap-6 overflow-hidden rounded-3xl border bg-gradient-to-br from-primary/[0.05] via-background to-[hsl(var(--brand-cyan)/0.04)] p-8 sm:flex-row sm:items-end sm:justify-between sm:p-10">
      <DotGrid />
      <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[hsl(var(--brand-cyan)/0.06)] blur-3xl" />
      <div className="relative space-y-4 max-w-2xl">
        <div className="flex items-center gap-2">
          <Layers className="h-3.5 w-3.5 text-primary/70" />
          <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary/70">
            Academic Structure
          </span>
        </div>
        <h1 className="font-display text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl">
          Build your year.
          <br />
          <span className="italic font-light text-primary/80">Assign every teacher.</span>
        </h1>
        <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
          Define your structure once, then live in one screen — classes, the leaf level where
          students enroll, and the teachers who run them.
        </p>
      </div>

      {/* Hierarchy flow on the right */}
      {ordered.length > 0 && (
        <div className="relative flex flex-col items-end gap-3">
          <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
            Your hierarchy
          </span>
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            {ordered.map((level, idx) => (
              <span key={level.key} className="flex items-center gap-1.5">
                {idx > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground/40" />}
                <span
                  className={cn(
                    'inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[11px] font-medium backdrop-blur-sm',
                    level.isLeaf
                      ? 'border-[hsl(var(--brand-cyan))] bg-[hsl(var(--brand-cyan)/0.1)] text-primary shadow-sm shadow-[hsl(var(--brand-cyan)/0.15)]'
                      : 'border-primary/20 bg-background/60 text-primary'
                  )}
                >
                  {level.isLeaf && <Users className="h-2.5 w-2.5" />}
                  {level.label}
                </span>
              </span>
            ))}
          </div>
        </div>
      )}
    </header>
  );
}

/** A subtle dot grid used as decoration on hero / empty state cards. */
function DotGrid() {
  return (
    <div
      className="pointer-events-none absolute inset-0 opacity-[0.4] [mask-image:radial-gradient(ellipse_at_top_right,black_0%,transparent_70%)]"
      style={{
        backgroundImage: 'radial-gradient(hsl(var(--primary) / 0.18) 1px, transparent 1px)',
        backgroundSize: '20px 20px',
      }}
      aria-hidden
    />
  );
}

interface YearHeroProps {
  batches: Batch[];
  activeBatch?: Batch;
  activeBatchId: string | null;
  setActiveBatchId: (id: string) => void;
  hierarchy: HierarchyLevel[];
  classCount: number;
  totalSections: number;
  totalStudents: number;
  subjectCount: number;
  onSetCurrent: () => void | Promise<void>;
  onNewYear: () => void;
  onNewClass: () => void;
  onManageSubjects: () => void;
  onManageClasses: () => void;
  onManageSemesters: () => void;
}

function YearHero({
  batches,
  activeBatch,
  activeBatchId,
  setActiveBatchId,
  hierarchy,
  classCount,
  totalSections,
  totalStudents,
  subjectCount,
  onSetCurrent,
  onNewYear,
  onNewClass,
  onManageSubjects,
  onManageClasses,
  onManageSemesters,
}: YearHeroProps) {
  const ordered = [...hierarchy].sort((a, b) => a.order - b.order);
  const containerLabel = ordered.find((l) => !l.isLeaf)?.labelPlural ?? 'Classes';
  const firstNonLeafLabel = ordered.find((l) => !l.isLeaf)?.label ?? 'Class';
  const leafLabel = ordered.find((l) => l.isLeaf)?.labelPlural ?? 'Sections';
  // Semester strip: always for two-level hierarchies (Dept → Year — i.e.
  // universities/colleges); for schools only when terms were actually set up.
  const showTerms =
    ordered.filter((l) => !l.isLeaf).length >= 2 || (activeBatch?.terms?.length ?? 0) > 0;
  return (
    <div className="relative overflow-hidden rounded-3xl border bg-card shadow-sm">
      {/* Cyan accent spine */}
      <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-primary via-primary/60 to-[hsl(var(--brand-cyan))]" />

      <div className="grid grid-cols-1 gap-0 lg:grid-cols-[1.4fr_1fr]">
        {/* Year selector — large and editorial */}
        <div className="border-b p-7 lg:border-b-0 lg:border-r">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                  Currently editing
                </span>
                {activeBatch?.isCurrent && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-success/12 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-success">
                    <CircleDot className="h-2.5 w-2.5" /> Active
                  </span>
                )}
              </div>
              <Select value={activeBatchId ?? ''} onValueChange={setActiveBatchId}>
                <SelectTrigger className="-ml-1 h-auto w-auto max-w-full gap-2 border-0 bg-transparent px-1 py-0 text-left font-display text-3xl font-bold tracking-tight shadow-none hover:bg-muted/50 focus:ring-0 sm:text-4xl">
                  {/* Explicit children: render ONLY the name in the trigger —
                      otherwise Radix mirrors the item's content (name + Active
                      chip), duplicating the status pill and wrapping the title. */}
                  <SelectValue>
                    <span className="whitespace-nowrap">{activeBatch?.name ?? 'Select year'}</span>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {batches.map((b) => (
                    <SelectItem key={b._id} value={b._id}>
                      <div className="flex items-center gap-2">
                        <span>{b.name}</span>
                        {b.isCurrent && (
                          <span className="text-[10px] font-medium uppercase tracking-wider text-success">
                            Active
                          </span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {activeBatch && (
                <p className="font-mono text-xs text-muted-foreground">
                  {new Date(activeBatch.startDate).toLocaleDateString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  })}{' '}
                  →{' '}
                  {new Date(activeBatch.endDate).toLocaleDateString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  })}
                </p>
              )}
            </div>
          </div>

          {/* Semester terms — the session's time dimension (Dept → Year is the
              structure; semesters live on the session itself). */}
          {activeBatch && showTerms && (
            <div className="mt-4 rounded-xl border bg-muted/20 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                  <CalendarRange className="h-3 w-3" /> Semesters
                </span>
                <button
                  type="button"
                  onClick={onManageSemesters}
                  className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.18em] text-primary hover:underline"
                >
                  Manage <ArrowUpRight className="h-3 w-3" />
                </button>
              </div>
              {(activeBatch.terms ?? []).length === 0 ? (
                <button
                  type="button"
                  onClick={onManageSemesters}
                  className="text-left text-xs text-muted-foreground hover:text-foreground"
                >
                  No semesters yet — add the two halves of this year so course registration, exams,
                  and fees can be scoped per semester.
                </button>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {(activeBatch.terms ?? []).map((term) => {
                    const now = Date.now();
                    const w = term.registrationWindow;
                    const regOpen =
                      !!w &&
                      now >= new Date(w.opensAt).getTime() &&
                      now <= new Date(w.closesAt).getTime();
                    return (
                      <span
                        key={term._id}
                        className="inline-flex items-center gap-2 rounded-lg border bg-background px-2.5 py-1.5 text-xs"
                      >
                        <span className="font-medium">{term.name}</span>
                        <span className="font-mono text-[10px] text-muted-foreground">
                          {new Date(term.startDate).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                          })}
                          –
                          {new Date(term.endDate).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                          })}
                        </span>
                        {termPositionLabel(term) && (
                          <span className="rounded-full bg-muted px-1.5 py-0.5 font-mono text-[9px] tracking-wider text-muted-foreground">
                            {termPositionLabel(term)}
                          </span>
                        )}
                        {regOpen && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-success/12 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-success">
                            <CircleDot className="h-2 w-2" /> Reg. open
                          </span>
                        )}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          )}
          <div className="mt-5 flex flex-wrap items-center gap-2">
            {activeBatch && !activeBatch.isCurrent && (
              <Button variant="outline" size="sm" onClick={onSetCurrent}>
                <Check className="mr-1.5 h-3.5 w-3.5" /> Mark active
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={onNewYear}>
              <Plus className="mr-1.5 h-3.5 w-3.5" /> New year
            </Button>
            <Button size="sm" onClick={onNewClass}>
              <Sparkles className="mr-1.5 h-3.5 w-3.5" /> Add {firstNonLeafLabel.toLowerCase()}
            </Button>
          </div>
        </div>

        {/* Stat strip — editorial number layout */}
        <div className="grid grid-cols-2 border-t [&>*:nth-child(2n)]:border-l [&>*:nth-child(n+3)]:border-t lg:border-t-0">
          <BigStat
            icon={<School className="h-3.5 w-3.5" />}
            label={containerLabel}
            value={classCount}
            onClick={onManageClasses}
            actionLabel="Manage"
          />
          <BigStat
            icon={<Hash className="h-3.5 w-3.5" />}
            label={leafLabel}
            value={totalSections}
          />
          <BigStat
            icon={<GraduationCap className="h-3.5 w-3.5" />}
            label="Students"
            value={totalStudents}
          />
          <BigStat
            icon={<BookOpen className="h-3.5 w-3.5" />}
            label="Subjects"
            value={subjectCount}
            onClick={onManageSubjects}
            actionLabel="Manage"
          />
        </div>
      </div>
    </div>
  );
}

function BigStat({
  icon,
  label,
  value,
  onClick,
  actionLabel,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  onClick?: () => void;
  actionLabel?: string;
}) {
  const content = (
    <>
      <div className="flex items-center gap-1.5 text-muted-foreground">
        {icon}
        <span className="font-mono text-[10px] uppercase tracking-[0.22em]">{label}</span>
      </div>
      <p className="font-display text-3xl font-bold tabular-nums leading-none">{value}</p>
      {onClick && actionLabel && (
        <span className="absolute right-4 top-4 inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.18em] text-primary opacity-0 transition-opacity group-hover:opacity-100">
          {actionLabel}
          <ArrowUpRight className="h-3 w-3" />
        </span>
      )}
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="group relative flex w-full flex-col justify-center gap-1 px-6 py-5 text-left transition-colors hover:bg-muted/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        {content}
      </button>
    );
  }

  return (
    <div className="group relative flex flex-col justify-center gap-1 px-6 py-5 transition-colors hover:bg-muted/40">
      {content}
    </div>
  );
}

interface ClassesEmptyStateProps {
  activeBatchName?: string;
  hierarchy: HierarchyLevel[];
  onAdd: () => void;
}

function ClassesEmptyState({ activeBatchName, hierarchy, onAdd }: ClassesEmptyStateProps) {
  const ordered = [...hierarchy].filter((l) => !l.isLeaf).sort((a, b) => a.order - b.order);
  const path = ordered.map((l) => l.label).join(' › ') || 'Class';
  const firstLabel = ordered[0]?.label ?? 'Class';
  const containerPlural = ordered[0]?.labelPlural?.toLowerCase() ?? 'classes';

  return (
    <div className="relative overflow-hidden rounded-3xl border-2 border-dashed bg-muted/10 p-10 text-center sm:p-16">
      <DotGrid />
      <div className="relative mx-auto max-w-md space-y-5">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/8 text-primary">
          <School className="h-7 w-7" />
        </div>
        <div className="space-y-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary/60">
            Empty year
          </p>
          <h3 className="font-display text-2xl font-semibold">
            <span className="italic font-light">No {containerPlural}</span> in{' '}
            {activeBatchName ?? 'this year'} yet.
          </h3>
          <p className="text-sm text-muted-foreground">
            Each entry follows the path you configured:{' '}
            <span className="font-mono text-foreground">{path}</span>.
          </p>
        </div>
        <Button onClick={onAdd} size="lg" className="shadow-sm">
          <Plus className="mr-1.5 h-4 w-4" /> Add the first {firstLabel.toLowerCase()}
        </Button>
      </div>
    </div>
  );
}

function ClassNavigator({ classes, hierarchy }: { classes: Cls[]; hierarchy: HierarchyLevel[] }) {
  const ordered = [...hierarchy].sort((a, b) => a.order - b.order);
  const nonLeaf = ordered.filter((l) => !l.isLeaf);
  const containerLabel = nonLeaf[0]?.labelPlural ?? 'Classes';
  const leafSingular = (ordered.find((l) => l.isLeaf)?.label ?? 'Section').toLowerCase();
  const leafPlural = (ordered.find((l) => l.isLeaf)?.labelPlural ?? 'Sections').toLowerCase();

  // Two-level hierarchies (department → year, stream → batch) group entries
  // under their top level so each department/stream appears once.
  const grouped = nonLeaf.length >= 2;
  const groups = grouped
    ? [
        ...classes
          .reduce((map, cls) => {
            const top = cls.path?.[0]?.name ?? cls.displayName;
            map.set(top, [...(map.get(top) ?? []), cls]);
            return map;
          }, new Map<string, Cls[]>())
          .entries(),
      ]
    : null;

  const sectionCountLabel = (cls: Cls) => {
    const sectionCount = cls.sections?.length ?? 0;
    return `${sectionCount} ${sectionCount === 1 ? leafSingular : leafPlural}`;
  };

  return (
    <nav className="max-h-[calc(100vh-3rem)] overflow-y-auto rounded-2xl border bg-card p-3">
      <div className="flex items-center justify-between px-2 pb-3 pt-1">
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          {containerLabel} · {groups ? groups.length : classes.length}
        </span>
      </div>
      {groups ? (
        <ul className="space-y-2">
          {groups.map(([topName, groupClasses], groupIdx) => (
            <li key={topName}>
              <div className="flex items-center gap-2 px-2 pb-1 pt-1.5">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-muted font-mono text-[10px] font-semibold text-muted-foreground">
                  {String(groupIdx + 1).padStart(2, '0')}
                </span>
                <p className="truncate text-sm font-semibold leading-tight">{topName}</p>
              </div>
              <ul className="ml-4 space-y-0.5 border-l pl-2">
                {groupClasses.map((cls) => (
                  <li key={cls._id}>
                    <a
                      href={`#class-${cls._id}`}
                      className="group flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-muted/60"
                    >
                      <span className="truncate font-medium leading-tight">
                        {cls.path?.[1]?.name ?? cls.displayName}
                      </span>
                      <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                        {sectionCountLabel(cls)}
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      ) : (
        <ul className="space-y-0.5">
          {classes.map((cls, idx) => (
            <li key={cls._id}>
              <a
                href={`#class-${cls._id}`}
                className="group flex items-center gap-3 rounded-lg px-2 py-2 text-sm transition-colors hover:bg-muted/60"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted font-mono text-[10px] font-semibold text-muted-foreground group-hover:bg-primary group-hover:text-primary-foreground">
                  {String(idx + 1).padStart(2, '0')}
                </span>
                <div className="flex-1 truncate">
                  <p className="truncate font-medium leading-tight">{cls.displayName}</p>
                  <p className="font-mono text-[10px] text-muted-foreground">
                    {sectionCountLabel(cls)}
                  </p>
                </div>
              </a>
            </li>
          ))}
        </ul>
      )}
    </nav>
  );
}

// ──────────────────────────── Class row ────────────────────────────

interface ClassRowProps {
  cls: Cls;
  teachers: Teacher[];
  hierarchy: HierarchyLevel[];
  onAddSection: () => void;
  onAddSubject: (section: Section) => void;
  onManageBatches: (section: Section) => void;
  onClassTeacher: (sectionId: string, teacherId: string | null) => Promise<void>;
  onSubjectTeacher: (
    sectionId: string,
    subjectId: string,
    teacherId: string | null
  ) => Promise<void>;
  onRemoveSubject: (sectionId: string, subjectId: string) => void;
  onDeleteSection: (sectionId: string) => void;
  onDeleteClass: () => void;
}

function ClassPanel({
  cls,
  teachers,
  hierarchy,
  onAddSection,
  onAddSubject,
  onManageBatches,
  onClassTeacher,
  onSubjectTeacher,
  onRemoveSubject,
  onDeleteSection,
  onDeleteClass,
}: ClassRowProps) {
  const sections = cls.sections ?? [];
  const path = cls.path ?? [];
  const totalSubjects = sections.reduce((acc, s) => acc + (s.subjects?.length ?? 0), 0);
  const leafLabel = hierarchy.find((l) => l.isLeaf)?.labelPlural ?? 'Sections';
  // Distinct semesters across this year's subjects (empty for schools).
  const coveredSemesters = [
    ...new Set(
      sections
        .flatMap((s) => s.subjects ?? [])
        .map((cs) => cs.semesterNumber)
        .filter((n): n is number => typeof n === 'number')
    ),
  ].sort((a, b) => a - b);

  return (
    <article
      id={`class-${cls._id}`}
      className="group/panel relative overflow-hidden rounded-2xl border bg-card shadow-sm scroll-mt-6 transition-shadow hover:shadow-md"
    >
      {/* Left accent spine — primary navy */}
      <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-primary to-primary/40" />

      {/* Header: path breadcrumbs + display name + delete */}
      <header className="relative border-b bg-gradient-to-br from-muted/30 via-card to-card px-7 py-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1 space-y-2">
            {/* Path breadcrumbs */}
            {path.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                {path.map((p, idx) => (
                  <span key={`${p.levelKey}-${idx}`} className="flex items-center gap-1.5">
                    {idx > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground/40" />}
                    <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                      {p.levelKey}
                    </span>
                    <span className="rounded bg-primary/8 px-1.5 py-0.5 font-mono text-[10px] font-medium text-primary">
                      {p.code}
                    </span>
                  </span>
                ))}
              </div>
            )}
            {/* Display name */}
            <h2 className="font-display text-2xl font-bold tracking-tight sm:text-[26px]">
              {cls.displayName}
            </h2>
            {/* Inline metric chips */}
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <Hash className="h-3 w-3" />
                <span className="tabular-nums font-medium text-foreground">{sections.length}</span>
                {sections.length === 1
                  ? leafLabel.replace(/s$/, '').toLowerCase()
                  : leafLabel.toLowerCase()}
              </span>
              <span className="text-muted-foreground/30">•</span>
              <span className="inline-flex items-center gap-1.5">
                <BookOpen className="h-3 w-3" />
                <span className="tabular-nums font-medium text-foreground">{totalSubjects}</span>
                subject{totalSubjects === 1 ? '' : 's'}
              </span>
              {cls.studentCount != null && cls.studentCount > 0 && (
                <>
                  <span className="text-muted-foreground/30">•</span>
                  <span className="inline-flex items-center gap-1.5">
                    <GraduationCap className="h-3 w-3" />
                    <span className="tabular-nums font-medium text-foreground">
                      {cls.studentCount}
                    </span>
                    student{cls.studentCount === 1 ? '' : 's'}
                  </span>
                </>
              )}
              {/* Which semesters this year covers — from the published
                  curriculum, not a hierarchy level. */}
              {coveredSemesters.length > 0 && (
                <>
                  <span className="text-muted-foreground/30">•</span>
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarRange className="h-3 w-3" />
                    semester{coveredSemesters.length === 1 ? '' : 's'}{' '}
                    <span className="tabular-nums font-medium text-foreground">
                      {coveredSemesters.join(' & ')}
                    </span>
                  </span>
                </>
              )}
            </div>
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={onDeleteClass}
            aria-label="Delete"
            className="shrink-0 text-muted-foreground/40 opacity-0 transition-all group-hover/panel:opacity-100 hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <section className="space-y-4 p-7">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded bg-[hsl(var(--brand-cyan)/0.12)] text-[hsl(var(--brand-cyan))]">
              <Users className="h-3 w-3" />
            </span>
            <h3 className="font-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-foreground">
              {leafLabel}
            </h3>
            <span className="font-mono text-[10px] text-muted-foreground">· {sections.length}</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 px-2 text-[11px]"
            onClick={onAddSection}
          >
            <Plus className="h-3 w-3" /> Add
          </Button>
        </div>

        {sections.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed bg-muted/20 py-8 text-center">
            <CircleDot className="h-5 w-5 text-muted-foreground/40" />
            <p className="text-xs text-muted-foreground">
              Add a {leafLabel.replace(/s$/, '').toLowerCase()} to start enrolling students.
            </p>
            <Button variant="outline" size="sm" onClick={onAddSection}>
              <Plus className="mr-1 h-3 w-3" /> First {leafLabel.replace(/s$/, '').toLowerCase()}
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {sections.map((section) => (
              <SectionCard
                key={section._id}
                section={section}
                teachers={teachers}
                onAddSubject={() => onAddSubject(section)}
                onManageBatches={() => onManageBatches(section)}
                onClassTeacher={(teacherId) => onClassTeacher(section._id, teacherId)}
                onSubjectTeacher={(subjectId, teacherId) =>
                  onSubjectTeacher(section._id, subjectId, teacherId)
                }
                onRemoveSubject={(subjectId) => onRemoveSubject(section._id, subjectId)}
                onDeleteSection={() => onDeleteSection(section._id)}
              />
            ))}
          </div>
        )}
      </section>
    </article>
  );
}

// ──────────────────────────── Section card ────────────────────────────

interface SectionCardProps {
  section: Section;
  teachers: Teacher[];
  onAddSubject: () => void;
  onManageBatches: () => void;
  onClassTeacher: (teacherId: string | null) => void;
  onSubjectTeacher: (subjectId: string, teacherId: string | null) => void;
  onRemoveSubject: (subjectId: string) => void;
  onDeleteSection: () => void;
}

function SectionCard({
  section,
  teachers,
  onAddSubject,
  onManageBatches,
  onClassTeacher,
  onSubjectTeacher,
  onRemoveSubject,
  onDeleteSection,
}: SectionCardProps) {
  const teacherId = section.classTeacher?._id ?? section.sectionTeacherId ?? null;
  const teacher = teachers.find((t) => t._id === teacherId);
  const tName = teacher ? teacherName(teacher) : null;
  const subjects = section.subjects ?? [];

  return (
    <div className="group/section relative overflow-hidden rounded-xl border bg-card transition-all hover:border-primary/30 hover:shadow-sm">
      <div className="absolute inset-y-0 left-0 w-1 bg-[hsl(var(--brand-cyan)/0.6)]" />
      <div className="space-y-3 p-3 pl-4">
        {/* Header: identity + section teacher */}
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-sm font-semibold leading-tight">{section.name}</p>
              <button
                onClick={onDeleteSection}
                aria-label="Delete"
                className="shrink-0 text-muted-foreground/30 opacity-0 transition-all group-hover/section:opacity-100 hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
            {section.studentCount != null && (
              <p className="font-mono text-[10px] text-muted-foreground">
                {section.studentCount} student{section.studentCount === 1 ? '' : 's'}
              </p>
            )}
            <div className="flex items-center gap-1.5 pt-1">
              <UserSquare2 className="h-3 w-3 shrink-0 text-muted-foreground/60" />
              <TeacherSelect
                placeholder="Section teacher"
                value={teacherId}
                teachers={teachers}
                onChange={onClassTeacher}
                compact
                displayName={tName}
              />
            </div>
          </div>
        </div>

        {/* Subjects sub-block */}
        <div className="rounded-lg border border-border/60 bg-muted/20 p-2.5">
          <div className="flex items-center justify-between gap-2 pb-1.5">
            <div className="flex items-center gap-1.5">
              <BookOpen className="h-3 w-3 text-primary" />
              <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-foreground">
                Subjects
              </span>
              <span className="font-mono text-[10px] text-muted-foreground">
                · {subjects.length}
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 gap-1 px-1.5 text-[10px]"
              onClick={onAddSubject}
            >
              <Plus className="h-3 w-3" /> Add
            </Button>
          </div>

          {subjects.length === 0 ? (
            <p className="py-1.5 text-center text-[11px] text-muted-foreground">
              No subjects yet — add one and assign its teacher.
            </p>
          ) : (
            (() => {
              // A Year-N section spans two semesters (2N-1 and 2N). When the
              // subjects carry a semester tag (published curriculum), group
              // them so the two halves read separately instead of as one long
              // mixed list. Untagged subjects fall back to a flat list.
              const renderRow = (cs: SectionSubject) => {
                const subjectTeacherId = cs.teacherId ?? cs.teacher?._id ?? null;
                const stTeacher = teachers.find((t) => t._id === subjectTeacherId);
                const stName = stTeacher ? teacherName(stTeacher) : null;
                return (
                  <li
                    key={cs.subjectId}
                    className="group/subject grid grid-cols-[1fr_auto_auto] items-center gap-2 rounded-md border bg-card p-1.5 transition-colors hover:border-primary/30"
                  >
                    <div className="flex min-w-0 items-center gap-1.5">
                      {cs.subject?.code && (
                        <span className="rounded bg-primary/8 px-1 py-0.5 font-mono text-[9px] font-medium text-primary">
                          {cs.subject.code}
                        </span>
                      )}
                      <p className="truncate text-xs font-medium">
                        {cs.subject?.name ?? 'Unknown subject'}
                      </p>
                    </div>
                    <TeacherSelect
                      placeholder="Teacher"
                      value={subjectTeacherId}
                      teachers={teachers}
                      onChange={(id) => onSubjectTeacher(cs.subjectId, id)}
                      compact
                      displayName={stName}
                    />
                    <button
                      onClick={() => onRemoveSubject(cs.subjectId)}
                      aria-label="Remove subject"
                      className="text-muted-foreground/30 opacity-0 transition-all group-hover/subject:opacity-100 hover:text-destructive"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </li>
                );
              };

              const semesters = [
                ...new Set(
                  subjects
                    .map((s) => s.semesterNumber)
                    .filter((n): n is number => typeof n === 'number')
                ),
              ].sort((a, b) => a - b);

              if (semesters.length === 0) {
                return <ul className="space-y-1">{subjects.map(renderRow)}</ul>;
              }

              const untagged = subjects.filter((s) => typeof s.semesterNumber !== 'number');
              return (
                <div className="space-y-2">
                  {semesters.map((sem) => (
                    <div key={sem}>
                      <p className="pb-1 font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
                        Semester {sem}
                      </p>
                      <ul className="space-y-1">
                        {subjects.filter((s) => s.semesterNumber === sem).map(renderRow)}
                      </ul>
                    </div>
                  ))}
                  {untagged.length > 0 && (
                    <div>
                      <p className="pb-1 font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
                        Other
                      </p>
                      <ul className="space-y-1">{untagged.map(renderRow)}</ul>
                    </div>
                  )}
                </div>
              );
            })()
          )}
        </div>

        {/* Lab batches sub-block — subdivisions for practical scheduling */}
        <div className="rounded-lg border border-border/60 bg-muted/20 p-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <FlaskConical className="h-3 w-3 text-primary" />
              <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-foreground">
                Lab Batches
              </span>
              <span className="font-mono text-[10px] text-muted-foreground">
                · {(section.batches ?? []).length}
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 gap-1 px-1.5 text-[10px]"
              onClick={onManageBatches}
            >
              Manage
            </Button>
          </div>
          {(section.batches ?? []).length > 0 && (
            <div className="flex flex-wrap gap-1 pt-1.5">
              {(section.batches ?? []).map((b) => (
                <span
                  key={b._id}
                  className="rounded bg-primary/8 px-1.5 py-0.5 font-mono text-[9px] font-medium text-primary"
                >
                  {b.name}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────── Teacher select ────────────────────────────

function TeacherSelect({
  value,
  teachers,
  onChange,
  placeholder,
  compact,
  displayName,
}: {
  value: string | null;
  teachers: Teacher[];
  onChange: (id: string | null) => void;
  placeholder: string;
  compact?: boolean;
  displayName?: string | null;
}) {
  const isAssigned = !!value && value !== '__none__';
  return (
    <Select
      value={value ?? '__none__'}
      onValueChange={(v) => onChange(v === '__none__' ? null : v)}
    >
      <SelectTrigger
        className={cn(
          'truncate text-xs',
          compact
            ? cn(
                'h-7 min-w-0 rounded-md border-0 bg-transparent px-1.5 py-0 shadow-none focus:ring-1 focus:ring-primary/20',
                isAssigned ? 'text-foreground' : 'text-muted-foreground/70 hover:bg-muted'
              )
            : 'h-8 min-w-[180px]'
        )}
      >
        {compact ? (
          <span className="truncate">{isAssigned ? (displayName ?? 'Assigned') : placeholder}</span>
        ) : (
          <SelectValue placeholder={placeholder} />
        )}
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__none__" className="text-muted-foreground">
          — Unassigned —
        </SelectItem>
        {teachers.map((t) => (
          <SelectItem key={t._id} value={t._id}>
            {teacherName(t)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// ──────────────────────────── New Year dialog ────────────────────────────

function NewYearDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void | Promise<void>;
}) {
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isCurrent, setIsCurrent] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      const y = new Date().getFullYear();
      setName(`Academic Year ${y}-${String((y + 1) % 100).padStart(2, '0')}`);
      setStartDate(`${y}-04-01`);
      setEndDate(`${y + 1}-03-31`);
      setIsCurrent(true);
    }
  }, [open]);

  const submit = async () => {
    if (!name.trim() || !startDate || !endDate) {
      toast.error('Fill in all fields');
      return;
    }
    setSaving(true);
    try {
      await academicApi.createAcademicBatch({
        name: name.trim(),
        code: slug(name).slice(0, 16),
        startDate,
        endDate,
        isCurrent,
      });
      toast.success('Academic year created');
      await onCreated();
    } catch (e: unknown) {
      toast.error(getErrorMessage(e) || 'Failed to create year');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New academic year</DialogTitle>
          <DialogDescription>
            One academic year holds all your classes, students, and fees. You can have multiple, but
            only one is &quot;active&quot; at a time.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="year-name">Name</Label>
            <Input
              id="year-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Academic Year 2025-26"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="year-start">Starts on</Label>
              <DatePicker id="year-start" value={startDate} onChange={(iso) => setStartDate(iso)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="year-end">Ends on</Label>
              <DatePicker id="year-end" value={endDate} onChange={(iso) => setEndDate(iso)} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isCurrent}
              onChange={(e) => setIsCurrent(e.target.checked)}
            />
            Make this the active year
          </label>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? 'Creating…' : 'Create year'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ──────────────────────────── New Class dialog ────────────────────────────

function NewClassDialog({
  open,
  hierarchy,
  existingClasses,
  programs,
  academicBatchId,
  onClose,
  onCreated,
}: {
  open: boolean;
  hierarchy: HierarchyLevel[];
  existingClasses: Cls[];
  programs: ProgramOption[];
  academicBatchId: string;
  onClose: () => void;
  onCreated: (cls: Cls) => void;
}) {
  const nonLeaf = [...hierarchy].sort((a, b) => a.order - b.order).filter((l) => !l.isLeaf);
  const leafLevel = [...hierarchy].sort((a, b) => a.order - b.order).find((l) => l.isLeaf);
  const firstLabel = nonLeaf[0]?.label ?? 'Class';
  const firstLower = firstLabel.toLowerCase();

  const [values, setValues] = useState<string[]>([]);
  const [programId, setProgramId] = useState<string>(NO_PROGRAM);
  const [saving, setSaving] = useState(false);

  const hierarchyKey = hierarchy.map((l) => l.key).join(',');
  const nonLeafCount = nonLeaf.length;
  useEffect(() => {
    if (open) {
      setValues(Array.from({ length: nonLeafCount }, () => ''));
      setProgramId(NO_PROGRAM);
    }
  }, [open, hierarchyKey, nonLeafCount]);

  const updateName = (idx: number, value: string) => {
    setValues((curr) => {
      const next = [...curr];
      next[idx] = value;
      return next;
    });
  };

  const selectedProgram = programs.find((p) => p._id === programId) ?? null;

  const changeProgram = (value: string) => {
    setProgramId(value);
    const program = programs.find((p) => p._id === value) ?? null;
    setValues((curr) => applyProgramToPath(curr, nonLeaf, program));
  };

  const submit = async () => {
    if (!academicBatchId) {
      toast.error('Pick an academic year first');
      return;
    }
    if (nonLeaf.length === 0) {
      toast.error('Configure at least one non-leaf level in Settings → Academic Structure');
      return;
    }
    for (let i = 0; i < nonLeaf.length; i++) {
      if (!values[i]?.trim()) {
        toast.error(`Enter ${nonLeaf[i].label} name`);
        return;
      }
    }
    setSaving(true);
    try {
      const order = existingClasses.length + 1;
      const path = nonLeaf.map((level, i) => {
        const name = values[i].trim();
        return {
          levelKey: level.key,
          name,
          code: slug(name).slice(0, 16) || `L${i + 1}`,
          order: i === 0 ? order : undefined,
        };
      });
      const res = await academicApi.createClass({
        academicBatchId,
        path,
        ...(programId !== NO_PROGRAM && { programId }),
      });
      const newCls = (res.data ?? res) as Cls;
      toast.success(`${path.map((p) => p.name).join(' · ')} added`);
      onCreated(newCls);
    } catch (e: unknown) {
      toast.error(getErrorMessage(e) || `Failed to add ${firstLower}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New {firstLower}</DialogTitle>
          {leafLevel && (
            <DialogDescription>
              You&apos;ll add {leafLevel.labelPlural.toLowerCase()} next.
            </DialogDescription>
          )}
        </DialogHeader>

        {nonLeaf.length === 0 ? (
          <div className="rounded-xl border border-dashed bg-muted/30 p-6 text-center text-sm text-muted-foreground">
            <AlertCircle className="mx-auto mb-2 h-5 w-5 text-amber-500" />
            Your hierarchy only has a leaf level. Add a container level in Settings → Academic
            Structure first.
          </div>
        ) : (
          <div className="space-y-3">
            {/* Program first — it decides what the department and year fields
                below can say. */}
            <ProgramPicker programs={programs} value={programId} onChange={changeProgram} />
            {nonLeaf.map((level, idx) => (
              <ClassLevelField
                key={level.key}
                level={level}
                value={values[idx] ?? ''}
                program={selectedProgram}
                onChange={(v) => updateName(idx, v)}
                autoFocus={idx === 0}
              />
            ))}
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving || nonLeaf.length === 0}>
            {saving ? 'Adding…' : `Add ${firstLower}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ──────────────────────────── Add Section dialog ────────────────────────────

function AddSectionDialog({
  cls,
  hierarchy,
  onClose,
  onCreated,
}: {
  cls: Cls | null;
  hierarchy: HierarchyLevel[];
  onClose: () => void;
  onCreated: (cls: Cls, section: Section) => void;
}) {
  // `?? 'Section'` doesn't cover an empty-string label (`""` is not nullish), so
  // we also fall back when the trimmed label is blank.
  const rawLeafLabel = hierarchy.find((l) => l.isLeaf)?.label;
  const leafLabel = rawLeafLabel && rawLeafLabel.trim() ? rawLeafLabel : 'Section';
  const leafLower = leafLabel.toLowerCase();
  const [identifier, setIdentifier] = useState('');
  const [saving, setSaving] = useState(false);

  // Clear the identifier on every reopen so each new section is named from scratch.
  useEffect(() => {
    if (cls) setIdentifier('');
  }, [cls]);

  if (!cls) return null;

  // The user types just the suffix (e.g. "A", "10A", "Boys"). The dialog enforces
  // a uniform "{leafLabel} {identifier}" save format so every section stored has
  // the same shape — no more "A" vs "Section A" inconsistency between rows.
  const trimmedId = identifier.trim();
  const finalName = trimmedId ? `${leafLabel} ${trimmedId}` : '';

  const submit = async () => {
    if (!trimmedId) {
      toast.error(`Enter a ${leafLower} identifier`);
      return;
    }
    setSaving(true);
    try {
      const code = slug(finalName).slice(0, 12);
      const res = await academicApi.createSection(cls._id, {
        name: finalName,
        code,
      });
      const newSection = (res.data ?? res) as Section;
      toast.success(`${finalName} added`);
      onCreated(cls, { ...newSection, subjects: newSection.subjects ?? [] });
    } catch (e: unknown) {
      toast.error(getErrorMessage(e) || `Failed to add ${leafLower}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!cls} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            Add {leafLower} to {cls.displayName}
          </DialogTitle>
          <DialogDescription>
            Just the identifier — we&apos;ll prefix every {leafLower} with{' '}
            <span className="font-medium text-foreground">{leafLabel}</span> so they all read the
            same way.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="sec-name">{leafLabel} identifier</Label>
            <div className="flex items-stretch overflow-hidden rounded-md border border-input bg-background transition-colors focus-within:border-primary">
              <span className="grid place-items-center border-r bg-muted/60 px-3 text-sm font-medium text-muted-foreground">
                {leafLabel}
              </span>
              <Input
                id="sec-name"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && trimmedId && !saving) void submit();
                }}
                placeholder="A"
                className="border-0 shadow-none focus-visible:ring-0"
                maxLength={20 - leafLabel.length - 1}
                autoFocus
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {trimmedId ? (
                <>
                  Saved as <span className="font-medium text-foreground">{finalName}</span>
                </>
              ) : (
                <>e.g. A, B, 10A, Morning</>
              )}
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving || !trimmedId}>
            {saving ? 'Adding…' : `Add ${leafLower}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ──────────────────────────── Add Subject to Class dialog ────────────────────────────

function AddSubjectToSectionDialog({
  target,
  subjects,
  teachers,
  onClose,
  onCreated,
}: {
  target: { cls: Cls; section: Section } | null;
  subjects: Subject[];
  teachers: Teacher[];
  onClose: () => void;
  onCreated: (cls: Cls, section: Section, subjects: SectionSubject[]) => void;
}) {
  const [subjectId, setSubjectId] = useState<string>('');
  const [teacherId, setTeacherId] = useState<string>('__none__');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (target) {
      setSubjectId('');
      setTeacherId('__none__');
    }
  }, [target]);

  if (!target) return null;
  const { cls, section } = target;

  const alreadyAdded = new Set((section.subjects ?? []).map((s) => s.subjectId));
  const available = subjects.filter((s) => !alreadyAdded.has(s._id));

  const submit = async () => {
    if (!subjectId) {
      toast.error('Pick a subject');
      return;
    }
    setSaving(true);
    try {
      const res = await academicApi.assignSubjectToSection(section._id, {
        subjectId,
        teacherId: teacherId === '__none__' ? undefined : teacherId,
      });
      // The server returns the section's full subjects array post-assignment.
      const nextSubjects = (res.data ?? []) as SectionSubject[];
      toast.success('Subject added');
      onCreated(cls, section, nextSubjects);
    } catch (e: unknown) {
      toast.error(getErrorMessage(e) || 'Failed to add subject');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            Add subject to {cls.displayName} · {section.name}
          </DialogTitle>
          <DialogDescription>
            Subjects are assigned per section so each section can have its own teacher. Need a new
            subject? Add it from <span className="font-medium">Manage subjects</span> at the bottom
            of the page.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {available.length === 0 ? (
            <div className="rounded-md border border-dashed border-border bg-muted/30 p-4 text-center text-sm text-muted-foreground">
              <AlertCircle className="mx-auto mb-2 h-5 w-5 text-muted-foreground/60" />
              All subjects in your library are already assigned to this section.
            </div>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label>Subject</Label>
                <Select value={subjectId} onValueChange={setSubjectId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pick a subject" />
                  </SelectTrigger>
                  <SelectContent>
                    {available.map((s) => (
                      <SelectItem key={s._id} value={s._id}>
                        {s.name}{' '}
                        <span className="ml-2 text-xs text-muted-foreground">{s.code}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Teacher (optional)</Label>
                <Select value={teacherId} onValueChange={setTeacherId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Unassigned" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__" className="text-muted-foreground">
                      — Unassigned —
                    </SelectItem>
                    {teachers.map((t) => (
                      <SelectItem key={t._id} value={t._id}>
                        {teacherName(t)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving || !subjectId || available.length === 0}>
            {saving ? 'Adding…' : 'Add subject'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ──────────────────────────── Subject Library dialog ────────────────────────────

function SubjectLibraryDialog({
  open,
  subjects,
  onClose,
  onChanged,
  requestConfirm,
}: {
  open: boolean;
  subjects: Subject[];
  onClose: () => void;
  onChanged: () => void | Promise<void>;
  requestConfirm: (opts: {
    title: string;
    description: string;
    confirmLabel?: string;
    onConfirm: () => Promise<void> | void;
  }) => void;
}) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [codeTouched, setCodeTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  // Catalogue metadata (universities/colleges with a department registry)
  const [departments, setDepartments] = useState<DeptOption[]>([]);
  const [credits, setCredits] = useState('');
  const [ownerDeptId, setOwnerDeptId] = useState('');
  const [offeredTo, setOfferedTo] = useState<string[]>([]);
  const [description, setDescription] = useState('');

  // The rich catalogue (owner / offered-to / min designation) only makes sense
  // when the tenant maintains a department registry.
  const hasDepartments = departments.length > 0;

  useEffect(() => {
    if (open) {
      setName('');
      setCode('');
      setCodeTouched(false);
      setSearch('');
      setCredits('');
      setOwnerDeptId('');
      setOfferedTo([]);
      setDescription('');
      hrApi
        .getDepartments()
        .then((res) => setDepartments(res.data || []))
        .catch(() => setDepartments([]));
    }
  }, [open]);

  const handleNameChange = (value: string) => {
    setName(value);
    if (!codeTouched) {
      setCode(slug(value).slice(0, 8));
    }
  };

  const create = async () => {
    if (!name.trim()) {
      toast.error('Enter a subject name');
      return;
    }
    setSaving(true);
    try {
      await academicApi.createSubject({
        name: name.trim(),
        code: code.trim() || slug(name).slice(0, 8),
        type: 'both',
        description: description.trim() || undefined,
        credits: credits ? Number(credits) : undefined,
        // The access rule the curriculum and timetable enforce: owner only,
        // owner + the departments ticked under "Offered to", or (no owner)
        // every department.
        ownerDepartmentId: ownerDeptId || undefined,
        ...(() => {
          const ids = departments
            .filter((d) => offeredTo.includes(d.code) && d._id !== ownerDeptId)
            .map((d) => d._id);
          return {
            sharing: !ownerDeptId ? 'global' : ids.length ? 'shared' : 'core',
            offeredToDepartmentIds: ownerDeptId ? ids : [],
          };
        })(),
      });
      toast.success(`${name.trim()} added`);
      setName('');
      setCode('');
      setCodeTouched(false);
      setCredits('');
      setOwnerDeptId('');
      setOfferedTo([]);
      setDescription('');
      await onChanged();
    } catch (e: unknown) {
      toast.error(getErrorMessage(e) || 'Failed to add subject');
    } finally {
      setSaving(false);
    }
  };

  /** Kind column: shared across ≥2 departments = Global, exactly 1 = Departmental. */
  const kindOf = (s: Subject): 'global' | 'departmental' | null => {
    const count = s.applicableTo?.departments?.length ?? 0;
    if (count === 0) return null;
    return count === 1 ? 'departmental' : 'global';
  };

  const remove = (subject: Subject) => {
    requestConfirm({
      title: `Delete ${subject.name}?`,
      description:
        'This subject will be removed from your library and from every section it is currently assigned to. This cannot be undone.',
      onConfirm: async () => {
        try {
          await academicApi.deleteSubject(subject._id);
          toast.success('Subject deleted');
          await onChanged();
        } catch (err) {
          toast.error(getErrorMessage(err) || 'Failed to delete subject');
        }
      },
    });
  };

  const filtered = search.trim()
    ? subjects.filter((s) => {
        const q = search.trim().toLowerCase();
        return s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q);
      })
    : subjects;

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="right"
        className={cn(
          'flex w-full flex-col gap-0 p-0',
          hasDepartments ? 'sm:max-w-3xl' : 'sm:max-w-md'
        )}
      >
        {/* Header */}
        <SheetHeader className="border-b bg-gradient-to-br from-[hsl(var(--brand-cyan)/0.08)] via-card to-card px-6 py-5 text-left">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[hsl(var(--brand-cyan)/0.12)] text-primary">
              <BookOpen className="h-4 w-4" />
            </div>
            <div className="space-y-0.5">
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                {hasDepartments ? 'Catalogue' : 'Shared library'}
              </p>
              <SheetTitle className="font-display text-xl">Subjects</SheetTitle>
            </div>
          </div>
          <SheetDescription className="mt-3 text-xs">
            Define every subject once. Pull them into any section and assign a teacher there.
          </SheetDescription>
        </SheetHeader>

        {/* Add form */}
        <div className="border-b bg-muted/20 p-5">
          <p className="mb-2.5 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            New subject
          </p>
          <div className="space-y-2.5">
            <Input
              placeholder="Mathematics"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void create();
              }}
              autoFocus
            />
            <div className="flex items-center gap-2">
              <Input
                className="font-mono uppercase"
                placeholder="MATH"
                value={code}
                onChange={(e) => {
                  setCodeTouched(true);
                  setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ''));
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void create();
                }}
              />
              <Button onClick={create} disabled={saving || !name.trim()} className="shrink-0">
                <Plus className="mr-1 h-3.5 w-3.5" />
                Add
              </Button>
            </div>
            {hasDepartments && (
              <>
                <Input
                  placeholder="Short description (optional)"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="text-xs"
                />
                <div className="grid grid-cols-3 gap-2">
                  <Select
                    value={ownerDeptId || '__none__'}
                    onValueChange={(v) => setOwnerDeptId(v === '__none__' ? '' : v)}
                  >
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue placeholder="Owner dept" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">No owner</SelectItem>
                      {departments.map((d) => (
                        <SelectItem key={d._id} value={d._id}>
                          {d.code} — {d.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    min={0}
                    max={20}
                    placeholder="Credits"
                    value={credits}
                    onChange={(e) => setCredits(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    Offered to
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {departments.map((d) => {
                      const selected = offeredTo.includes(d.code);
                      return (
                        <button
                          key={d._id}
                          type="button"
                          onClick={() =>
                            setOfferedTo((prev) =>
                              selected ? prev.filter((c) => c !== d.code) : [...prev, d.code]
                            )
                          }
                          className={cn(
                            'rounded-full border px-2.5 py-1 font-mono text-[10px] font-semibold transition-colors',
                            selected
                              ? 'border-primary/30 bg-primary/10 text-primary'
                              : 'border-border bg-background text-muted-foreground hover:bg-muted'
                          )}
                        >
                          {d.code}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
            <p className="text-[11px] text-muted-foreground">
              Code auto-generates from the name. No owner means every department can use it; with an
              owner, only it and the departments it&apos;s offered to can.
            </p>
          </div>
        </div>

        {/* Search + list */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="border-b px-5 py-3">
            <Input
              placeholder={`Search ${subjects.length} subject${subjects.length === 1 ? '' : 's'}…`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 text-xs"
            />
          </div>
          <div className="flex-1 overflow-y-auto">
            {subjects.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 p-10 text-center">
                <BookOpen className="h-6 w-6 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">Your subject library is empty.</p>
                <p className="text-[11px] text-muted-foreground/70">
                  Add your first subject above.
                </p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-10 text-center text-sm text-muted-foreground">
                No subjects match &ldquo;{search}&rdquo;.
              </div>
            ) : hasDepartments ? (
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-card">
                  <tr className="border-b text-left font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                    <th className="px-4 py-2.5 font-medium">Code</th>
                    <th className="px-2 py-2.5 font-medium">Subject</th>
                    <th className="px-2 py-2.5 font-medium">Kind</th>
                    <th className="px-2 py-2.5 font-medium">Owner</th>
                    <th className="px-2 py-2.5 font-medium">Offered to</th>
                    <th className="px-2 py-2.5 text-right font-medium">Cr</th>
                    <th className="w-10 px-2 py-2.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map((s) => {
                    const kind = kindOf(s);
                    return (
                      <tr key={s._id} className="group transition-colors hover:bg-muted/30">
                        <td className="px-4 py-3 align-top font-mono text-xs text-primary">
                          {s.code}
                        </td>
                        <td className="px-2 py-3 align-top">
                          <p className="font-medium leading-tight">{s.name}</p>
                          {s.description && (
                            <p className="mt-0.5 max-w-[220px] text-xs leading-snug text-muted-foreground">
                              {s.description}
                            </p>
                          )}
                        </td>
                        <td className="px-2 py-3 align-top">
                          {kind && (
                            <Badge
                              variant="secondary"
                              className={cn(
                                'text-[10px]',
                                kind === 'global'
                                  ? 'bg-violet-100 text-violet-700 hover:bg-violet-100'
                                  : 'bg-sky-100 text-sky-700 hover:bg-sky-100'
                              )}
                            >
                              {kind === 'global' ? 'Global' : 'Departmental'}
                            </Badge>
                          )}
                        </td>
                        <td className="px-2 py-3 align-top text-xs font-semibold">
                          {s.ownerDepartment?.code ?? '—'}
                        </td>
                        <td className="px-2 py-3 align-top">
                          <div className="flex max-w-[190px] flex-wrap gap-1">
                            {(s.applicableTo?.departments ?? []).map((code) => (
                              <span
                                key={code}
                                className="rounded-full border px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
                              >
                                {code}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-2 py-3 text-right align-top text-xs font-semibold">
                          {s.credits ?? '—'}
                        </td>
                        <td className="px-2 py-3 text-right align-top">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground/40 opacity-0 transition-all group-hover:opacity-100 hover:text-destructive"
                            onClick={() => remove(s)}
                            aria-label={`Delete ${s.name}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <ul className="divide-y divide-border">
                {filtered.map((s) => (
                  <li
                    key={s._id}
                    className="group flex items-center gap-3 px-5 py-3 transition-colors hover:bg-muted/30"
                  >
                    <Badge
                      variant="outline"
                      className="shrink-0 bg-primary/5 font-mono text-[10px] text-primary"
                    >
                      {s.code}
                    </Badge>
                    <span className="flex-1 truncate text-sm font-medium">{s.name}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground/40 opacity-0 transition-all group-hover:opacity-100 hover:text-destructive"
                      onClick={() => remove(s)}
                      aria-label={`Delete ${s.name}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ──────────────────────────── Class Library dialog ────────────────────────────

function ClassLibraryDialog({
  open,
  classes,
  hierarchy,
  programs,
  academicBatchId,
  onClose,
  onChanged,
  requestConfirm,
}: {
  open: boolean;
  classes: Cls[];
  hierarchy: HierarchyLevel[];
  programs: ProgramOption[];
  academicBatchId: string;
  onClose: () => void;
  onChanged: () => void | Promise<void>;
  requestConfirm: (opts: {
    title: string;
    description: string;
    confirmLabel?: string;
    onConfirm: () => Promise<void> | void;
  }) => void;
}) {
  const ordered = [...hierarchy].sort((a, b) => a.order - b.order);
  const nonLeaf = ordered.filter((l) => !l.isLeaf);
  const containerLabel = nonLeaf[0]?.label ?? 'Class';
  const containerPlural = nonLeaf[0]?.labelPlural ?? 'Classes';
  const containerLower = containerLabel.toLowerCase();

  const [values, setValues] = useState<string[]>([]);
  const [programId, setProgramId] = useState<string>(NO_PROGRAM);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  const hierarchyKey = nonLeaf.map((l) => l.key).join(',');
  useEffect(() => {
    if (open) {
      setValues(Array.from({ length: nonLeaf.length }, () => ''));
      setProgramId(NO_PROGRAM);
      setSearch('');
    }
  }, [open, hierarchyKey, nonLeaf.length]);

  const updateName = (idx: number, value: string) => {
    setValues((curr) => {
      const next = [...curr];
      next[idx] = value;
      return next;
    });
  };

  const selectedProgram = programs.find((p) => p._id === programId) ?? null;

  const changeProgram = (value: string) => {
    setProgramId(value);
    const program = programs.find((p) => p._id === value) ?? null;
    setValues((curr) => applyProgramToPath(curr, nonLeaf, program));
  };

  const create = async () => {
    if (!academicBatchId) {
      toast.error('Pick an academic year first');
      return;
    }
    if (nonLeaf.length === 0) {
      toast.error('Configure at least one non-leaf level in Settings → Academic Structure');
      return;
    }
    for (let i = 0; i < nonLeaf.length; i++) {
      if (!values[i]?.trim()) {
        toast.error(`Enter ${nonLeaf[i].label} name`);
        return;
      }
    }
    setSaving(true);
    try {
      const order = classes.length + 1;
      const path = nonLeaf.map((level, i) => {
        const name = values[i].trim();
        return {
          levelKey: level.key,
          name,
          code: slug(name).slice(0, 16) || `L${i + 1}`,
          order: i === 0 ? order : undefined,
        };
      });
      await academicApi.createClass({
        academicBatchId,
        path,
        ...(programId !== NO_PROGRAM && { programId }),
      });
      toast.success(`${path.map((p) => p.name).join(' · ')} added`);
      setValues(Array.from({ length: nonLeaf.length }, () => ''));
      await onChanged();
    } catch (e: unknown) {
      toast.error(getErrorMessage(e) || `Failed to add ${containerLower}`);
    } finally {
      setSaving(false);
    }
  };

  const remove = (cls: Cls) => {
    requestConfirm({
      title: `Delete ${cls.displayName}?`,
      description:
        'All sections under this entry will also be deleted. Students will be unassigned. This cannot be undone.',
      onConfirm: async () => {
        try {
          await academicApi.deleteClass(cls._id);
          toast.success(`${cls.displayName} deleted`);
          await onChanged();
        } catch (err) {
          toast.error(getErrorMessage(err) || `Failed to delete ${containerLower}`);
        }
      },
    });
  };

  const filtered = search.trim()
    ? classes.filter((c) => {
        const q = search.trim().toLowerCase();
        return (
          c.displayName.toLowerCase().includes(q) ||
          (c.path ?? []).some(
            (p) => p.name.toLowerCase().includes(q) || (p.code ?? '').toLowerCase().includes(q)
          )
        );
      })
    : classes;

  const canAdd = nonLeaf.length > 0 && values.every((v) => v?.trim().length);

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        {/* Header */}
        <SheetHeader className="border-b bg-gradient-to-br from-primary/[0.06] via-card to-card px-6 py-5 text-left">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <School className="h-4 w-4" />
            </div>
            <div className="space-y-0.5">
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                Academic structure
              </p>
              <SheetTitle className="font-display text-xl">{containerPlural}</SheetTitle>
            </div>
          </div>
          <SheetDescription className="mt-3 text-xs">
            Add or remove {containerPlural.toLowerCase()} for this academic year. Sections and
            subjects are managed inside each one.
          </SheetDescription>
        </SheetHeader>

        {/* Add form */}
        <div className="border-b bg-muted/20 p-5">
          <p className="mb-2.5 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            New {containerLower}
          </p>
          {nonLeaf.length === 0 ? (
            <div className="rounded-md border border-dashed bg-muted/30 p-3 text-center text-xs text-muted-foreground">
              <AlertCircle className="mx-auto mb-1 h-4 w-4 text-amber-500" />
              Your hierarchy only has a leaf level. Add a container level in Settings → Academic
              Structure.
            </div>
          ) : (
            <div className="space-y-2.5">
              {/* Program first — it decides what the department and year fields
                  below can say. */}
              <ProgramPicker programs={programs} value={programId} onChange={changeProgram} />
              {nonLeaf.map((level, idx) => (
                <ClassLevelField
                  key={level.key}
                  level={level}
                  value={values[idx] ?? ''}
                  program={selectedProgram}
                  onChange={(v) => updateName(idx, v)}
                  onEnter={() => {
                    if (canAdd) void create();
                  }}
                  autoFocus={idx === 0}
                />
              ))}
              <Button onClick={create} disabled={saving || !canAdd} className="w-full">
                <Plus className="mr-1 h-3.5 w-3.5" />
                {saving ? 'Adding…' : `Add ${containerLower}`}
              </Button>
            </div>
          )}
        </div>

        {/* Search + list */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="border-b px-5 py-3">
            <Input
              placeholder={`Search ${classes.length} ${classes.length === 1 ? containerLower : containerPlural.toLowerCase()}…`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 text-xs"
            />
          </div>
          <div className="flex-1 overflow-y-auto">
            {classes.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 p-10 text-center">
                <School className="h-6 w-6 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">
                  No {containerPlural.toLowerCase()} yet.
                </p>
                <p className="text-[11px] text-muted-foreground/70">
                  Add your first {containerLower} above.
                </p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-10 text-center text-sm text-muted-foreground">
                No {containerPlural.toLowerCase()} match &ldquo;{search}&rdquo;.
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {filtered.map((cls) => {
                  const sectionCount = cls.sections?.length ?? 0;
                  const subjectCount = (cls.sections ?? []).reduce(
                    (acc, s) => acc + (s.subjects?.length ?? 0),
                    0
                  );
                  return (
                    <li
                      key={cls._id}
                      className="group flex items-center gap-3 px-5 py-3 transition-colors hover:bg-muted/30"
                    >
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <p className="truncate text-sm font-medium">{cls.displayName}</p>
                        <p className="font-mono text-[10px] text-muted-foreground">
                          {sectionCount} section{sectionCount === 1 ? '' : 's'} · {subjectCount}{' '}
                          subject{subjectCount === 1 ? '' : 's'}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground/40 opacity-0 transition-all group-hover:opacity-100 hover:text-destructive"
                        onClick={() => remove(cls)}
                        aria-label={`Delete ${cls.displayName}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
