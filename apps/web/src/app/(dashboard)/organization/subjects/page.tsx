'use client';

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import {
  BookMarked,
  ChevronDown,
  ChevronRight,
  Loader2,
  MapPin,
  Plus,
  Search,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { PageHero } from '@/components/ui/page-hero';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { academicApi, hrApi, organizationApi } from '@/lib/api';
import { usePermissions } from '@/hooks/usePermissions';
import { useBranchStore } from '@/store/branchStore';
import { SubjectDialog, type SubjectInput } from '../explorer/SubjectDialog';
import { ItemActions, errorMessage } from '../explorer/parts';

interface SectionUse {
  sectionId: string;
  sectionName: string;
  classId: string;
  className: string;
  teacherId: string | null;
  teacherName: string | null;
}
interface SubjectUsage {
  _id: string;
  name: string;
  code: string;
  credits?: number;
  type?: string;
  department: { _id: string; name: string; code: string } | null;
  sharing: 'global' | 'core' | 'shared' | null;
  offeredTo: Array<{ _id: string; name: string; code: string }>;
  curriculum: Array<{
    programId: string | null;
    programName: string;
    semesterNumber: number;
    elective: boolean;
    status: string;
  }>;
  sections: SectionUse[];
}
interface Dept {
  _id: string;
  name: string;
  code: string;
}
interface Teacher {
  _id: string;
  name: string;
  employeeId?: string;
}
interface SectionOption {
  _id: string;
  label: string;
}

const ALL = '__all__';
const NONE = '__none__';
/** "CSE · B.Tech CSE · Year 2" → "B.Tech CSE · Year 2". */
const shortClass = (name: string) => name.split(' · ').slice(-2).join(' · ');

export default function SubjectsPage() {
  const { hasPermission } = usePermissions();
  const canEdit =
    hasPermission('organization.settings', 'edit') ||
    hasPermission('organization.academics', 'edit');
  const branchId = useBranchStore((s) => s.selectedBranchId);
  const campus = useBranchStore.getState().getSelectedBranch()?.name ?? 'This campus';

  const [rows, setRows] = useState<SubjectUsage[] | null>(null);
  const [year, setYear] = useState<string | null>(null);
  const [departments, setDepartments] = useState<Dept[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [sectionOptions, setSectionOptions] = useState<SectionOption[]>([]);
  const [query, setQuery] = useState('');
  const [dept, setDept] = useState(ALL);
  const [show, setShow] = useState<'all' | 'unassigned' | 'unused'>('all');
  const [open, setOpen] = useState<Set<string>>(new Set());
  /** null = closed, {} = adding, a subject = editing. */
  const [form, setForm] = useState<{ subject?: SubjectInput } | null>(null);

  const load = useCallback(async () => {
    const r = await organizationApi.getSubjectUsage().catch((err) => {
      toast.error(errorMessage(err, 'Could not load subjects'));
      return { data: { subjects: [], academicYear: null } };
    });
    setRows(r.data.subjects);
    setYear(r.data.academicYear);
  }, []);

  useEffect(() => {
    setRows(null);
    load();
    hrApi
      .getDepartments()
      .then((r) => setDepartments((r.data ?? []) as Dept[]))
      .catch(() => setDepartments([]));
    academicApi
      .getAvailableTeachers()
      .then((r) => setTeachers((r.data ?? []) as Teacher[]))
      .catch(() => setTeachers([]));
    academicApi
      .getAcademicBatches()
      .then(async (b) => {
        const list = (b.data ?? []) as Array<{ _id: string; isCurrent?: boolean }>;
        const current = list.find((x) => x.isCurrent) ?? list[0];
        if (!current) return;
        const cls = await academicApi.getClasses({ academicBatchId: current._id, limit: 500 });
        setSectionOptions(
          (
            (cls.data ?? []) as Array<{
              displayName: string;
              sections?: Array<{ _id: string; name: string }>;
            }>
          )
            .flatMap((c) =>
              (c.sections ?? []).map((s) => ({
                _id: s._id,
                label: `${shortClass(c.displayName)} · Section ${s.name}`,
              }))
            )
            .sort((a, b) => a.label.localeCompare(b.label))
        );
      })
      .catch(() => setSectionOptions([]));
  }, [load, branchId]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (rows ?? []).filter(
      (s) =>
        (dept === ALL || s.department?._id === dept) &&
        (!q || `${s.name} ${s.code}`.toLowerCase().includes(q)) &&
        (show === 'all' ||
          (show === 'unassigned' && s.sections.some((x) => !x.teacherId)) ||
          (show === 'unused' && !s.curriculum.length && !s.sections.length))
    );
  }, [rows, query, dept, show]);

  const act = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn();
      toast.success(ok);
      await load();
    } catch (err) {
      toast.error(errorMessage(err, 'Could not save'));
    }
  };
  const toggle = (id: string) =>
    setOpen((o) => {
      const n = new Set(o);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const unassigned = (rows ?? []).reduce(
    (n, s) => n + s.sections.filter((x) => !x.teacherId).length,
    0
  );

  return (
    <div className="space-y-6">
      <PageHero
        icon={BookMarked}
        eyebrow="Academic Structure"
        title="Subjects"
        description="Every subject on the campus — which department owns it, which semesters it's in, and who teaches it in each section."
        actions={
          canEdit && (
            <Button onClick={() => setForm({})}>
              <Plus className="mr-1.5 h-4 w-4" />
              Add subject
            </Button>
          )
        }
      />

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-primary/25 bg-primary/[0.04] px-4 py-2.5 text-sm">
        <MapPin className="h-4 w-4 text-primary" />
        <span className="font-semibold">{campus}</span>
        <span className="text-muted-foreground">
          {year ? `· sections for ${year}` : ''} · switch campus at the top right
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Search by name or code"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <Select value={dept} onValueChange={setDept}>
          <SelectTrigger className="w-64">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All departments</SelectItem>
            {departments.map((d) => (
              <SelectItem key={d._id} value={d._id}>
                {d.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={show} onValueChange={(v) => setShow(v as typeof show)}>
          <SelectTrigger className="w-64">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All subjects</SelectItem>
            <SelectItem value="unassigned">Sections without a teacher ({unassigned})</SelectItem>
            <SelectItem value="unused">Not used anywhere yet</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {rows === null ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : shown.length === 0 ? (
        <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          No subjects match. {canEdit && 'Use “Add subject to…” to create one.'}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="w-8 px-3 py-2.5" />
                <th className="px-3 py-2.5">Subject</th>
                <th className="px-3 py-2.5">Department · who can use it</th>
                <th className="px-3 py-2.5">In curriculum</th>
                <th className="px-3 py-2.5">Taught in</th>
                <th className="w-10 px-3 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {shown.map((s) => {
                const isOpen = open.has(s._id);
                const missing = s.sections.filter((x) => !x.teacherId).length;
                const here = new Set(s.sections.map((x) => x.sectionId));
                return (
                  <Fragment key={s._id}>
                    <tr className="cursor-pointer hover:bg-muted/30" onClick={() => toggle(s._id)}>
                      <td className="px-3 py-2.5 text-muted-foreground">
                        {isOpen ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <p className="font-medium">{s.name}</p>
                        <p className="font-mono text-xs text-muted-foreground">
                          {s.code}
                          {s.credits ? ` · ${s.credits} cr` : ''}
                        </p>
                      </td>
                      <td className="px-3 py-2.5">
                        {s.department?.name ?? (
                          <span className="text-muted-foreground">No home department</span>
                        )}
                        <p className="text-xs text-muted-foreground">
                          {s.sharing === 'global' || !s.department
                            ? 'Every department'
                            : s.sharing === 'shared'
                              ? `Also ${s.offeredTo.map((d) => d.code).join(', ')}`
                              : 'This department only'}
                        </p>
                      </td>
                      <td className="px-3 py-2.5">
                        {s.curriculum.length === 0 ? (
                          <span className="text-muted-foreground">Not in any semester</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {s.curriculum.map((c, i) => (
                              <Badge key={i} variant="secondary" className="font-normal">
                                {c.programName} · Sem {c.semesterNumber}
                                {c.elective ? ' (elective)' : ''}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        {s.sections.length} section{s.sections.length === 1 ? '' : 's'}
                        {missing > 0 && (
                          <Badge variant="outline" className="ml-2 border-amber-300 text-amber-700">
                            {missing} without teacher
                          </Badge>
                        )}
                      </td>
                      <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                        {canEdit && (
                          <ItemActions
                            what="subject"
                            name={s.name}
                            onEdit={() =>
                              setForm({
                                subject: {
                                  _id: s._id,
                                  name: s.name,
                                  code: s.code,
                                  credits: s.credits,
                                  type: s.type as SubjectInput['type'],
                                  ownerDepartmentId: s.department?._id ?? null,
                                  sharing: s.sharing,
                                  offeredToDepartmentIds: s.offeredTo.map((d) => d._id),
                                },
                              })
                            }
                            onDelete={() => academicApi.deleteSubject(s._id).then(load)}
                          />
                        )}
                      </td>
                    </tr>
                    {isOpen && (
                      <tr className="bg-muted/20">
                        <td />
                        <td colSpan={5} className="px-3 py-3">
                          <div className="space-y-2">
                            {s.sections.length === 0 && (
                              <p className="text-sm text-muted-foreground">
                                No section teaches this subject this year. Add it to a semester in
                                the program&apos;s Curriculum, or to one section below.
                              </p>
                            )}
                            {s.sections.map((x) => (
                              <div key={x.sectionId} className="flex flex-wrap items-center gap-3">
                                <span className="min-w-64 flex-1">
                                  {shortClass(x.className)} ·{' '}
                                  <span className="font-medium">Section {x.sectionName}</span>
                                </span>
                                <Select
                                  value={x.teacherId ?? NONE}
                                  disabled={!canEdit}
                                  onValueChange={(v) =>
                                    act(
                                      () =>
                                        academicApi.updateSectionSubject(x.sectionId, s._id, {
                                          teacherId: v === NONE ? null : v,
                                        }),
                                      'Teacher updated'
                                    )
                                  }
                                >
                                  <SelectTrigger className="h-8 w-64">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value={NONE}>Not assigned</SelectItem>
                                    {teachers.map((t) => (
                                      <SelectItem key={t._id} value={t._id}>
                                        {t.name}
                                        {t.employeeId ? ` · ${t.employeeId}` : ''}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                {canEdit && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    aria-label={`Remove from Section ${x.sectionName}`}
                                    onClick={() =>
                                      act(
                                        () =>
                                          academicApi.removeSubjectFromSection(x.sectionId, s._id),
                                        'Removed from section'
                                      )
                                    }
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                            ))}
                            {canEdit && (
                              <div className="flex flex-wrap items-center gap-3 pt-1">
                                <span className="min-w-64 flex-1 text-muted-foreground">
                                  Also teach in another section
                                </span>
                                <Select
                                  value={NONE}
                                  onValueChange={(v) =>
                                    v !== NONE &&
                                    act(
                                      () =>
                                        academicApi.assignSubjectToSection(v, { subjectId: s._id }),
                                      'Added to section'
                                    )
                                  }
                                >
                                  <SelectTrigger className="h-8 w-64">
                                    <SelectValue placeholder="Pick a section" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value={NONE} disabled>
                                      Pick a section
                                    </SelectItem>
                                    {sectionOptions
                                      .filter((o) => !here.has(o._id))
                                      .map((o) => (
                                        <SelectItem key={o._id} value={o._id}>
                                          {o.label}
                                        </SelectItem>
                                      ))}
                                  </SelectContent>
                                </Select>
                                <span className="w-8" />
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <SubjectDialog
        open={!!form}
        subject={form?.subject}
        onClose={() => setForm(null)}
        onSaved={() => load()}
      />
    </div>
  );
}
