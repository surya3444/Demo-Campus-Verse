'use client';

import { Suspense, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  Building2,
  CalendarClock,
  ChevronRight,
  ClipboardCheck,
  FolderOpen,
  GraduationCap,
  Layers,
  Loader2,
  Plus,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { academicApi, hrApi, organizationApi, studentApi } from '@/lib/api';
import { usePermissions } from '@/hooks/usePermissions';
import { useHierarchyLabels } from '@/hooks/useHierarchyLabels';
import { useBranchStore } from '@/store/branchStore';
import { SetupGuide, type GuideBatch } from './SetupGuide';
import { ContextBar, ItemActions } from './parts';
import { AcademicYearCard, type YearBatch } from './AcademicYearCard';
import { SubjectsPanel } from './SubjectsPanel';
import { CurriculumPanel } from './CurriculumPanel';
import { SectionSubjects } from './SectionSubjects';

// ── Data shapes (only the fields this page reads) ───────────────────────────

interface Institution {
  _id: string;
  name: string;
  code: string;
}
interface Department {
  _id: string;
  name: string;
  code: string;
  institutionId?: string | null;
  shared?: boolean;
  hodName?: string;
}
interface Program {
  _id: string;
  name: string;
  code: string;
  degreeType: string;
  durationYears: number;
  totalSemesters?: number;
  termPattern?: string;
  yearPatterns?: Pattern[];
  departmentId?: string | null;
  institutionId?: string | null;
}
interface ClassRow {
  _id: string;
  displayName: string;
  departmentId?: string | null;
  programId?: string | null;
  path: Array<{ levelKey: string; name: string; code: string; order?: number }>;
  studentCount?: number;
  sections?: Array<{ _id: string; name: string }>;
}
interface StudentRow {
  _id: string;
  displayName: string;
  admissionNumber?: string;
  rollNumber?: string;
}

type Pattern = 'annual' | 'semester' | 'trimester';
type Level = 'campus' | 'institution' | 'shared' | 'department' | 'program' | 'class' | 'section';

/** Where we are in the tree; mirrored to the URL so any level can be linked. */
interface Crumbs {
  inst?: string;
  shared?: boolean;
  dept?: string;
  prog?: string;
  cls?: string;
  sec?: string;
}

const yearOf = (c: ClassRow) =>
  c.path.find((p) => p.levelKey === 'year')?.order ??
  Number(c.path.find((p) => p.levelKey === 'year')?.name.match(/\d+/)?.[0] ?? 0);

// ── Page ────────────────────────────────────────────────────────────────────

export default function ExplorerPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <Explorer />
    </Suspense>
  );
}

function Spinner() {
  return (
    <div className="flex h-64 items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}

function Explorer() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const branchId = useBranchStore((s) => s.selectedBranchId);
  const { hasPermission } = usePermissions();

  const [loading, setLoading] = useState(true);
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [batchId, setBatchId] = useState<string>('');
  const [batches, setBatches] = useState<Array<GuideBatch & YearBatch>>([]);
  const [dialog, setDialog] = useState<Level | null>(null);

  const crumbs: Crumbs = {
    inst: params.get('inst') ?? undefined,
    shared: params.get('shared') === '1',
    dept: params.get('dept') ?? undefined,
    prog: params.get('prog') ?? undefined,
    cls: params.get('cls') ?? undefined,
    sec: params.get('sec') ?? undefined,
  };
  const go = useCallback(
    (next: Crumbs, replace = false) => {
      const q = new URLSearchParams();
      if (next.inst) q.set('inst', next.inst);
      if (next.shared) q.set('shared', '1');
      if (next.dept) q.set('dept', next.dept);
      if (next.prog) q.set('prog', next.prog);
      if (next.cls) q.set('cls', next.cls);
      if (next.sec) q.set('sec', next.sec);
      const url = `${pathname}${q.toString() ? `?${q}` : ''}`;
      if (replace) router.replace(url);
      else router.push(url);
    },
    [pathname, router]
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // The API narrows every list to the caller's scope, so an institution
      // admin or an HOD only ever receives their own part of the tree.
      const [instRes, deptRes, progRes, batchRes] = await Promise.all([
        organizationApi.getInstitutions({ status: 'active' }).catch(() => ({ data: [] })),
        hrApi.getDepartments().catch(() => ({ data: [] })),
        organizationApi.getPrograms({ status: 'active' }).catch(() => ({ data: [] })),
        academicApi.getAcademicBatches().catch(() => ({ data: [] })),
      ]);
      const batches = (batchRes.data ?? []) as Array<GuideBatch & YearBatch>;
      setBatches(batches);
      const current = batches.find((b) => b.isCurrent) ?? batches[0];
      setBatchId(current?._id ?? '');
      const clsRes = current
        ? await academicApi
            .getClasses({ academicBatchId: current._id, limit: 200 })
            .catch(() => ({ data: [] }))
        : { data: [] };
      setInstitutions(instRes.data ?? []);
      setDepartments(deptRes.data ?? []);
      setPrograms(progRes.data ?? []);
      setClasses(clsRes.data ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, branchId]);

  // ── Derived tree ──────────────────────────────────────────────────────────
  const tree = useMemo(() => {
    const deptsOf = (instId: string) => departments.filter((d) => d.institutionId === instId);
    const shared = departments.filter((d) => d.shared);
    const progsOfDept = (deptId: string) => programs.filter((p) => p.departmentId === deptId);
    const progsOfInst = (instId: string) =>
      programs.filter((p) => !p.departmentId && p.institutionId === instId);
    const classesOfProg = (progId: string) =>
      classes.filter((c) => c.programId === progId).sort((a, b) => yearOf(a) - yearOf(b));
    const studentsIn = (cls: ClassRow[]) => cls.reduce((n, c) => n + (c.studentCount ?? 0), 0);
    const classesOfDept = (deptId: string) => classes.filter((c) => c.departmentId === deptId);
    const classesOfInst = (instId: string) => {
      const deptIds = new Set(deptsOf(instId).map((d) => d._id));
      const progIds = new Set(progsOfInst(instId).map((p) => p._id));
      return classes.filter(
        (c) =>
          (c.departmentId && deptIds.has(c.departmentId)) ||
          (c.programId && progIds.has(c.programId))
      );
    };
    return {
      deptsOf,
      shared,
      progsOfDept,
      progsOfInst,
      classesOfProg,
      classesOfDept,
      classesOfInst,
      studentsIn,
    };
  }, [departments, programs, classes]);

  const inst = institutions.find((i) => i._id === crumbs.inst);
  const dept = departments.find((d) => d._id === crumbs.dept);
  const prog = programs.find((p) => p._id === crumbs.prog);
  const cls = classes.find((c) => c._id === crumbs.cls);
  const sec = cls?.sections?.find((s) => s._id === crumbs.sec);

  const level: Level = sec
    ? 'section'
    : cls
      ? 'class'
      : prog
        ? 'program'
        : dept
          ? 'department'
          : crumbs.shared
            ? 'shared'
            : inst
              ? 'institution'
              : 'campus';

  // A scoped user opens at their own level: while a level has exactly one
  // child (an institution admin's one institution, an HOD's one department),
  // step into it.
  useEffect(() => {
    if (loading) return;
    if (level === 'campus' && institutions.length === 1 && tree.shared.length === 0) {
      go({ inst: institutions[0]._id }, true);
    } else if (level === 'institution' && inst) {
      const ds = tree.deptsOf(inst._id);
      if (ds.length === 1 && tree.progsOfInst(inst._id).length === 0) {
        go({ inst: inst._id, dept: ds[0]._id }, true);
      }
    }
  }, [loading, level, institutions, inst, tree, go]);

  if (loading) return <Spinner />;

  const can = {
    institution:
      hasPermission('organization.branches', 'create') ||
      hasPermission('organization.academics', 'create'),
    department: hasPermission('hr.staff', 'create'),
    structure:
      hasPermission('organization.settings', 'edit') ||
      hasPermission('organization.academics', 'create'),
  };

  const campusName = useBranchStore.getState().getSelectedBranch()?.name ?? 'This campus';
  const thenLoad = (p: Promise<unknown>) => p.then(load);

  // ── Breadcrumbs ───────────────────────────────────────────────────────────
  const trail: Array<{ label: string; to: Crumbs }> = [{ label: 'Campus', to: {} }];
  if (inst) trail.push({ label: inst.name, to: { inst: inst._id } });
  if (crumbs.shared) trail.push({ label: 'Shared departments', to: { shared: true } });
  if (dept)
    trail.push({ label: dept.name, to: { ...pick(crumbs, 'inst', 'shared'), dept: dept._id } });
  if (prog)
    trail.push({
      label: prog.name,
      to: { ...pick(crumbs, 'inst', 'shared', 'dept'), prog: prog._id },
    });
  if (cls)
    trail.push({
      label: `Year ${yearOf(cls) || ''}`.trim(),
      to: { ...pick(crumbs, 'inst', 'shared', 'dept', 'prog'), cls: cls._id },
    });
  if (sec) trail.push({ label: `Section ${sec.name}`, to: crumbs });

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Academic Explorer</h1>
          <p className="text-sm text-muted-foreground">
            Everything about how your campus teaches, in one place: open a level to see what sits
            inside it, add to it, rename or remove it.{' '}
            <Link href="/organization/academic-structure" className="text-primary hover:underline">
              More tools (lab batches, bulk add)
            </Link>
          </p>
        </div>
        <ContextBar
          campus={campusName}
          academicYear={batches.find((b) => b.isCurrent)?.name}
          trail={trail.map((t) => ({ label: t.label, onClick: () => go(t.to) }))}
        />
      </header>

      {level === 'campus' && (
        <AcademicYearCard batches={batches} canEdit={can.structure} onChanged={load} />
      )}

      {level === 'campus' && (
        <SetupGuide
          batches={batches}
          departments={departments.length}
          programs={programs.length}
          years={classes.length}
          sections={classes.reduce((n, c) => n + (c.sections?.length ?? 0), 0)}
          students={tree.studentsIn(classes)}
          canEdit={can.structure}
          onChanged={load}
        />
      )}

      {level === 'campus' && (
        <Level
          title="Institutions"
          empty="No institutions yet. A university campus starts by adding its institutions (engineering college, medical college…)."
          action={
            can.institution
              ? { label: 'Add institution', onClick: () => setDialog('campus') }
              : undefined
          }
        >
          {institutions.map((i) => {
            const cs = tree.classesOfInst(i._id);
            return (
              <Tile
                key={i._id}
                icon={Building2}
                title={i.name}
                badge={i.code}
                stats={[
                  `${tree.deptsOf(i._id).length} departments`,
                  `${tree.studentsIn(cs)} students`,
                ]}
                onOpen={() => go({ inst: i._id })}
                actions={
                  can.institution && (
                    <ItemActions
                      what="institution"
                      name={i.name}
                      code={i.code}
                      onRename={(v) => thenLoad(organizationApi.updateInstitution(i._id, v))}
                      onDelete={() => thenLoad(organizationApi.deleteInstitution(i._id))}
                    />
                  )
                }
              />
            );
          })}
          {tree.shared.length > 0 && (
            <Tile
              icon={Layers}
              title="Shared departments"
              badge="All institutions"
              stats={[`${tree.shared.length} departments`]}
              onOpen={() => go({ shared: true })}
            />
          )}
        </Level>
      )}

      {(level === 'institution' || level === 'shared') && (
        <>
          <Level
            title={level === 'shared' ? 'Shared departments' : 'Departments'}
            empty="No departments yet."
            action={
              can.department
                ? { label: 'Add department', onClick: () => setDialog(level) }
                : undefined
            }
          >
            {(level === 'shared' ? tree.shared : tree.deptsOf(inst!._id)).map((d) => (
              <Tile
                key={d._id}
                icon={FolderOpen}
                title={d.name}
                badge={d.code}
                stats={[
                  `${tree.progsOfDept(d._id).length} programs`,
                  `${tree.studentsIn(tree.classesOfDept(d._id))} students`,
                  ...(d.hodName ? [`HOD ${d.hodName}`] : []),
                ]}
                onOpen={() => go({ ...pick(crumbs, 'inst', 'shared'), dept: d._id })}
                actions={
                  can.department && (
                    <ItemActions
                      what="department"
                      name={d.name}
                      code={d.code}
                      onRename={(v) => thenLoad(hrApi.updateDepartment(d._id, v))}
                      onDelete={() => thenLoad(hrApi.deleteDepartment(d._id))}
                    />
                  )
                }
              />
            ))}
          </Level>
          {level === 'institution' && tree.progsOfInst(inst!._id).length > 0 && (
            <Level title="Programs run by the whole institution">
              {tree.progsOfInst(inst!._id).map((p) => (
                <ProgramTile
                  key={p._id}
                  p={p}
                  classes={tree.classesOfProg(p._id)}
                  onOpen={() => go({ inst: inst!._id, prog: p._id })}
                  actions={
                    can.structure && (
                      <ItemActions
                        what="program"
                        name={p.name}
                        code={p.code}
                        onRename={(v) => thenLoad(organizationApi.updateProgram(p._id, v))}
                        onDelete={() => thenLoad(organizationApi.deleteProgram(p._id))}
                      />
                    )
                  }
                />
              ))}
            </Level>
          )}
        </>
      )}

      {level === 'department' && (
        <>
          <Level
            title="Programs"
            empty="No programs in this department yet."
            action={
              can.structure
                ? { label: 'Add program', onClick: () => setDialog('department') }
                : undefined
            }
          >
            {tree.progsOfDept(dept!._id).map((p) => (
              <ProgramTile
                key={p._id}
                p={p}
                classes={tree.classesOfProg(p._id)}
                onOpen={() =>
                  go({ ...pick(crumbs, 'inst', 'shared'), dept: dept!._id, prog: p._id })
                }
                actions={
                  can.structure && (
                    <ItemActions
                      what="program"
                      name={p.name}
                      code={p.code}
                      onRename={(v) => thenLoad(organizationApi.updateProgram(p._id, v))}
                      onDelete={() => thenLoad(organizationApi.deleteProgram(p._id))}
                    />
                  )
                }
              />
            ))}
          </Level>
          <SubjectsPanel dept={dept!} canEdit={can.structure} />
        </>
      )}

      {level === 'program' && (
        <>
          <Level
            title="Years"
            empty="No years for this program in the current academic year yet — add Year 1."
            action={
              can.structure ? { label: 'Add year', onClick: () => setDialog('program') } : undefined
            }
          >
            {tree.classesOfProg(prog!._id).map((c) => (
              <Tile
                key={c._id}
                icon={GraduationCap}
                title={`Year ${yearOf(c) || '?'}`}
                subtitle={c.displayName}
                stats={[`${c.sections?.length ?? 0} sections`, `${c.studentCount ?? 0} students`]}
                onOpen={() => go({ ...pick(crumbs, 'inst', 'shared', 'dept', 'prog'), cls: c._id })}
                actions={
                  can.structure && (
                    <ItemActions
                      what="year"
                      name={`Year ${yearOf(c) || '?'}`}
                      onDelete={() => thenLoad(academicApi.deleteClass(c._id))}
                    />
                  )
                }
              />
            ))}
          </Level>
          {(() => {
            const owner = departments.find((d) => d._id === prog!.departmentId);
            return owner ? (
              <CurriculumPanel prog={prog!} dept={owner} canEdit={can.structure} />
            ) : (
              <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                This program isn&apos;t under a department, so it has no curriculum here. Move it
                into a department to give it subjects.
              </p>
            );
          })()}
        </>
      )}

      {level === 'class' && (
        <Level
          title="Sections"
          empty="No sections yet."
          action={
            can.structure ? { label: 'Add section', onClick: () => setDialog('class') } : undefined
          }
        >
          {(cls!.sections ?? []).map((s) => (
            <Tile
              key={s._id}
              icon={Users}
              title={`Section ${s.name}`}
              onOpen={() => go({ ...crumbs, sec: s._id })}
              actions={
                can.structure && (
                  <ItemActions
                    what="section"
                    name={`Section ${s.name}`}
                    onRename={(v) =>
                      thenLoad(
                        academicApi.updateSection(s._id, {
                          name: v.name.replace(/^Section\s+/i, ''),
                          code: v.name.replace(/^Section\s+/i, '').toUpperCase(),
                        })
                      )
                    }
                    onDelete={() => thenLoad(academicApi.deleteSection(s._id))}
                  />
                )
              }
            />
          ))}
        </Level>
      )}

      {level === 'section' && (
        <>
          <SectionSubjects
            sectionId={sec!._id}
            departmentId={cls?.departmentId ?? prog?.departmentId}
            canEdit={can.structure}
          />
          <SectionView sectionId={sec!._id} classId={cls?._id} />
        </>
      )}

      <CreateDialog
        level={dialog}
        onClose={() => setDialog(null)}
        onDone={async () => {
          setDialog(null);
          await load();
        }}
        context={{ inst, dept, prog, cls, batchId }}
      />
    </div>
  );
}

function pick(c: Crumbs, ...keys: Array<keyof Crumbs>): Crumbs {
  return Object.fromEntries(keys.filter((k) => c[k]).map((k) => [k, c[k]])) as Crumbs;
}

// ── Building blocks ─────────────────────────────────────────────────────────

function Level({
  title,
  empty,
  action,
  extra,
  children,
}: {
  title: string;
  empty?: string;
  action?: { label: string; onClick: () => void };
  extra?: ReactNode;
  children: ReactNode;
}) {
  const items = Array.isArray(children)
    ? children.flat().filter(Boolean)
    : children
      ? [children]
      : [];
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </h2>
        <div className="flex gap-2">
          {extra}
          {action && (
            <Button size="sm" onClick={action.onClick}>
              <Plus className="mr-1.5 h-4 w-4" />
              {action.label}
            </Button>
          )}
        </div>
      </div>
      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          {empty}
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{children}</div>
      )}
    </section>
  );
}

function Tile({
  icon: Icon,
  title,
  subtitle,
  badge,
  stats = [],
  onOpen,
  actions,
}: {
  icon: typeof Building2;
  title: string;
  subtitle?: string;
  badge?: string;
  stats?: string[];
  onOpen: () => void;
  /** Rename/delete menu, kept outside the open button. */
  actions?: ReactNode;
}) {
  return (
    <div className="group relative flex rounded-xl border bg-card transition-colors hover:border-primary/40 hover:bg-primary/[0.03]">
      <button onClick={onOpen} className="flex min-w-0 flex-1 items-start gap-3 p-4 text-left">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-semibold">{title}</span>
            {badge && (
              <Badge variant="secondary" className="shrink-0 font-mono text-[10px]">
                {badge}
              </Badge>
            )}
          </div>
          {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
          {stats.length > 0 && (
            <p className="mt-1 text-xs text-muted-foreground">{stats.join(' · ')}</p>
          )}
        </div>
        <ChevronRight className="mt-2 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      </button>
      {actions && <div className="py-3 pr-2">{actions}</div>}
    </div>
  );
}

function ProgramTile({
  p,
  classes,
  onOpen,
  actions,
}: {
  p: Program;
  classes: ClassRow[];
  onOpen: () => void;
  actions?: ReactNode;
}) {
  return (
    <Tile
      icon={GraduationCap}
      title={p.name}
      badge={p.code}
      stats={[
        `${p.degreeType.toUpperCase()} · ${p.durationYears} yrs · ${p.totalSemesters ?? '?'} terms (${p.termPattern ?? 'semester'})`,
        `${classes.reduce((n, c) => n + (c.studentCount ?? 0), 0)} students`,
      ]}
      onOpen={onOpen}
      actions={actions}
    />
  );
}

function SectionView({ sectionId, classId }: { sectionId: string; classId?: string }) {
  const [students, setStudents] = useState<StudentRow[] | null>(null);
  useEffect(() => {
    studentApi
      .getStudents({ sectionId, limit: 100 })
      .then((r) => setStudents(r.data ?? []))
      .catch(() => setStudents([]));
  }, [sectionId]);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" asChild>
          <Link href={`/attendance/mark?sectionId=${sectionId}`}>
            <ClipboardCheck className="mr-1.5 h-4 w-4" />
            Attendance
          </Link>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link href={`/organization/timetable?section=${sectionId}`}>
            <CalendarClock className="mr-1.5 h-4 w-4" />
            Timetable
          </Link>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link href={`/students?sectionId=${sectionId}`}>
            <Users className="mr-1.5 h-4 w-4" />
            Manage students
          </Link>
        </Button>
        {classId && (
          <Button size="sm" asChild>
            <Link href={`/students?classId=${classId}&sectionId=${sectionId}&add=1`}>
              <Plus className="mr-1.5 h-4 w-4" />
              Add student to this section
            </Link>
          </Button>
        )}
      </div>
      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Students {students ? `(${students.length})` : ''}
        </h2>
        {students === null ? (
          <Spinner />
        ) : students.length === 0 ? (
          <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
            No students you can see in this section.
          </p>
        ) : (
          <div className="divide-y rounded-xl border">
            {students.map((s) => (
              <Link
                key={s._id}
                href={`/students/${s._id}`}
                className="flex items-center justify-between px-4 py-2.5 text-sm hover:bg-muted/50"
              >
                <span className="font-medium">{s.displayName}</span>
                <span className="font-mono text-xs text-muted-foreground">
                  {[s.rollNumber, s.admissionNumber].filter(Boolean).join(' · ')}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

// ── One dialog for every "add" at every level ───────────────────────────────

function CreateDialog({
  level,
  onClose,
  onDone,
  context,
}: {
  level: Level | null;
  onClose: () => void;
  onDone: () => void;
  context: {
    inst?: Institution;
    dept?: Department;
    prog?: Program;
    cls?: ClassRow;
    batchId: string;
  };
}) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [degree, setDegree] = useState<'ug' | 'pg' | 'diploma' | 'phd' | 'certificate'>('ug');
  const [years, setYears] = useState(4);
  const [patterns, setPatterns] = useState<Pattern[]>([
    'semester',
    'semester',
    'semester',
    'semester',
  ]);
  const [year, setYear] = useState(1);
  const [saving, setSaving] = useState(false);
  const { levels: hierarchyLevels } = useHierarchyLabels();

  useEffect(() => {
    setName('');
    setCode('');
    setYear(1);
  }, [level]);
  useEffect(() => {
    setPatterns((prev) =>
      Array.from({ length: years }, (_, i) => prev[i] ?? prev[prev.length - 1] ?? 'semester')
    );
  }, [years]);

  const what = {
    campus: 'institution',
    institution: 'department',
    shared: 'shared department',
    department: 'program',
    program: 'year',
    class: 'section',
    section: '',
  }[level ?? 'section'];

  const submit = async () => {
    setSaving(true);
    try {
      const { inst, dept, prog, cls, batchId } = context;
      if (level === 'campus') {
        await organizationApi.createInstitution({ name, code: code.toUpperCase() });
      } else if (level === 'institution' || level === 'shared') {
        await hrApi.createDepartment({
          name,
          code: code.toUpperCase(),
          type: 'academic',
          ...(level === 'shared' ? { shared: true } : { institutionId: inst!._id }),
        });
      } else if (level === 'department') {
        await organizationApi.createProgram({
          departmentId: dept!._id,
          name,
          code: code.toUpperCase(),
          degreeType: degree,
          durationYears: years,
          yearPatterns: patterns,
        });
      } else if (level === 'program') {
        // One entry per non-leaf level of this campus's hierarchy
        // (department · year by default, department · program · year when configured).
        const yearEntry = { name: `Year ${year}`, code: `Y${year}`, order: year };
        const keys = hierarchyLevels.length
          ? hierarchyLevels.map((l) => l.key)
          : ['department', 'year'];
        const path = keys.map((levelKey, i) => {
          if (i === keys.length - 1) return { levelKey, ...yearEntry };
          if (levelKey === 'program') return { levelKey, name: prog!.name, code: prog!.code };
          const top = dept ?? prog!;
          return { levelKey, name: top.name, code: top.code };
        });
        await academicApi.createClass({ academicBatchId: batchId, programId: prog!._id, path });
      } else if (level === 'class') {
        await academicApi.createSection(cls!._id, {
          name: name.toUpperCase(),
          code: name.toUpperCase(),
        });
      }
      toast.success(`${what[0].toUpperCase()}${what.slice(1)} added`);
      onDone();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: { message?: string } } } };
      toast.error(e.response?.data?.error?.message || `Could not add the ${what}`);
    } finally {
      setSaving(false);
    }
  };

  const needsCode =
    level === 'campus' || level === 'institution' || level === 'shared' || level === 'department';
  return (
    <Dialog open={!!level} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add {what}</DialogTitle>
          <DialogDescription>
            {level === 'shared'
              ? 'A shared department (e.g. Basic Sciences) serves every institution on the campus.'
              : level === 'program'
                ? `A class for one year of ${context.prog?.name ?? 'this program'} in the current academic year.`
                : `Added under ${context.dept?.name ?? context.inst?.name ?? 'this campus'}.`}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {level === 'program' ? (
            <div className="space-y-2">
              <Label>Year</Label>
              <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: context.prog?.durationYears ?? 4 }, (_, i) => (
                    <SelectItem key={i} value={String(i + 1)}>
                      Year {i + 1}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="ex-name">{level === 'class' ? 'Section name' : 'Name'}</Label>
              <Input
                id="ex-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={level === 'class' ? 'A' : ''}
              />
            </div>
          )}
          {needsCode && (
            <div className="space-y-2">
              <Label htmlFor="ex-code">Code</Label>
              <Input
                id="ex-code"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
              />
            </div>
          )}
          {level === 'department' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Degree</Label>
                  <Select value={degree} onValueChange={(v) => setDegree(v as typeof degree)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {['ug', 'pg', 'diploma', 'phd', 'certificate'].map((d) => (
                        <SelectItem key={d} value={d}>
                          {d.toUpperCase()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Years</Label>
                  <Input
                    type="number"
                    min={1}
                    max={10}
                    value={years}
                    onChange={(e) =>
                      setYears(Math.max(1, Math.min(10, Number(e.target.value) || 1)))
                    }
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Each year runs as</Label>
                <div className="grid grid-cols-2 gap-2">
                  {patterns.map((p, i) => (
                    <Select
                      key={i}
                      value={p}
                      onValueChange={(v) =>
                        setPatterns((ps) => ps.map((x, j) => (j === i ? (v as Pattern) : x)))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue>{`Year ${i + 1}: ${p}`}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {(['annual', 'semester', 'trimester'] as const).map((x) => (
                          <SelectItem key={x} value={x}>
                            {x}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={
              saving || (level !== 'program' && !name.trim()) || (needsCode && !code.trim())
            }
          >
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Add
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
