'use client';

import { termLabelFor, yearTermRanges, type YearTermPattern } from '@campus-verse/shared';
import { useEffect, useMemo, useState } from 'react';
import { registrationApi, academicApi, organizationApi, SchemeSlotPayload } from '@/lib/api';
import { usePermissions } from '@/hooks/usePermissions';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
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
import { BookOpenCheck, Plus, Trash2, Pencil, Copy, Send, Lock, Layers, X } from 'lucide-react';
import { toast } from 'sonner';

// ─── Types ──────────────────────────────────────────────────────────────────

interface SubjectOption {
  _id: string;
  name: string;
  code: string;
  category?: string;
  credits?: number;
}

interface SchemeRow {
  _id: string;
  departmentCode: string;
  departmentName: string;
  /** Set when this curriculum belongs to one degree program rather than the department. */
  programId?: string;
  programName?: string;
  semesterNumber: number;
  slots: Array<{
    slotId: string;
    kind: 'core' | 'basket';
    category?: string;
    subjectId?: string;
    credits?: number;
    label?: string;
    chooseCount?: number;
    options?: Array<{ subjectId: string; credits: number; seatCap?: number; seatsTaken: number }>;
  }>;
  minCredits: number;
  maxCredits: number;
  status: 'draft' | 'published' | 'archived';
}

interface DeptOption {
  code: string;
  name: string;
}

interface ProgramOption {
  _id: string;
  name: string;
  code: string;
  department?: { _id: string; name: string; code: string } | null;
  durationYears?: number;
  termPattern?: string;
  yearPatterns?: YearTermPattern[];
}

/**
 * Term choices for a curriculum. A program's terms follow its year plan (an
 * annual year is one term), so its list is exactly its terms; a
 * department-wide scheme keeps the plain 1-12 list.
 */
function termOptions(program?: ProgramOption): Array<{ value: string; label: string }> {
  if (!program?.durationYears) {
    return Array.from({ length: 12 }, (_, i) => ({
      value: String(i + 1),
      label: `Semester ${i + 1}`,
    }));
  }
  const plan = { ...program, durationYears: program.durationYears };
  const last = yearTermRanges(plan).at(-1)?.last ?? 0;
  return Array.from({ length: last }, (_, i) => ({
    value: String(i + 1),
    label: termLabelFor(plan, i + 1),
  }));
}

/** Select sentinel — Radix Select rejects an empty-string item value. */
const DEPARTMENT_WIDE = '__department__';

const CATEGORIES = ['DSC', 'DSE', 'GE', 'AECC', 'SEC', 'VAC'] as const;

// Editable slot (builder state)
interface DraftCoreSlot {
  kind: 'core';
  category?: string;
  subjectId: string;
  credits: number;
}
interface DraftBasketSlot {
  kind: 'basket';
  label: string;
  category?: string;
  chooseCount: number;
  options: Array<{ subjectId: string; credits: number; seatCap?: number }>;
}
type DraftSlot = DraftCoreSlot | DraftBasketSlot;

function getErrorMessage(err: unknown): string | undefined {
  return (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
    ?.message;
}

export function CurriculumTab() {
  const { hasPermission } = usePermissions();
  const canCreate = hasPermission('registration.schemes', 'create');
  const canEdit = hasPermission('registration.schemes', 'edit');
  const canPublish = hasPermission('registration.schemes', 'publish');
  const canDelete = hasPermission('registration.schemes', 'delete');

  const [schemes, setSchemes] = useState<SchemeRow[]>([]);
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const [departments, setDepartments] = useState<DeptOption[]>([]);
  const [programs, setPrograms] = useState<ProgramOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Builder dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingScheme, setEditingScheme] = useState<SchemeRow | null>(null);
  const [formDept, setFormDept] = useState('');
  const [formProgram, setFormProgram] = useState(DEPARTMENT_WIDE);
  const [formSemester, setFormSemester] = useState('1');
  const [formMinCredits, setFormMinCredits] = useState('16');
  const [formMaxCredits, setFormMaxCredits] = useState('28');
  const [formSlots, setFormSlots] = useState<DraftSlot[]>([]);

  // Clone dialog
  const [cloneSource, setCloneSource] = useState<SchemeRow | null>(null);
  const [cloneDept, setCloneDept] = useState('');
  const [cloneSemester, setCloneSemester] = useState('');

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<SchemeRow | null>(null);

  const subjectById = useMemo(() => new Map(subjects.map((s) => [s._id, s])), [subjects]);

  // Departments in this tab are class-path codes ("CSE"), while programs carry
  // a department FK with its own code. Match case-insensitively; when nothing
  // matches (codes drifted), offer every program rather than an empty list.
  const programsForDept = useMemo(() => {
    if (!formDept) return programs;
    const matches = programs.filter(
      (p) => (p.department?.code ?? '').toLowerCase() === formDept.toLowerCase()
    );
    return matches.length > 0 ? matches : programs;
  }, [programs, formDept]);

  const load = async () => {
    try {
      setLoading(true);
      const [schemesRes, subjectsRes, classesRes, programsRes] = await Promise.all([
        registrationApi.getSchemes(),
        academicApi.getSubjects(),
        academicApi.getClasses(),
        // University tier only — a branch with no programs keeps authoring
        // department-wide curricula exactly as before.
        organizationApi.getPrograms({ status: 'active' }).catch(() => ({ data: [] })),
      ]);
      setSchemes(schemesRes.data || []);
      setPrograms((programsRes.data ?? []) as ProgramOption[]);
      const subjectRows = subjectsRes.data?.data || subjectsRes.data || [];
      setSubjects(subjectRows);
      // Departments = distinct top path entries across classes.
      const classes = classesRes.data?.data || classesRes.data || [];
      const deptMap = new Map<string, string>();
      for (const c of classes as Array<{
        path?: Array<{ name?: string; code?: string }>;
      }>) {
        const top = c.path?.[0];
        const code = (top?.code || top?.name || '').trim();
        if (code && !deptMap.has(code)) deptMap.set(code, (top?.name || code).trim());
      }
      setDepartments(
        [...deptMap.entries()]
          .map(([code, name]) => ({ code, name }))
          .sort((a, b) => a.name.localeCompare(b.name))
      );
    } catch {
      toast.error('Failed to load curriculum');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  // ─── Builder helpers ──────────────────────────────────────────────────────

  const openCreate = () => {
    setEditingScheme(null);
    setFormDept(departments[0]?.code ?? '');
    setFormProgram(DEPARTMENT_WIDE);
    setFormSemester('1');
    setFormMinCredits('16');
    setFormMaxCredits('28');
    setFormSlots([]);
    setDialogOpen(true);
  };

  const openEdit = (scheme: SchemeRow) => {
    setEditingScheme(scheme);
    setFormDept(scheme.departmentCode);
    setFormProgram(scheme.programId ?? DEPARTMENT_WIDE);
    setFormSemester(String(scheme.semesterNumber));
    setFormMinCredits(String(scheme.minCredits));
    setFormMaxCredits(String(scheme.maxCredits));
    setFormSlots(
      scheme.slots.map((slot) =>
        slot.kind === 'core'
          ? {
              kind: 'core',
              category: slot.category,
              subjectId: slot.subjectId!,
              credits: slot.credits ?? 0,
            }
          : {
              kind: 'basket',
              label: slot.label ?? 'Elective',
              category: slot.category,
              chooseCount: slot.chooseCount ?? 1,
              options: (slot.options ?? []).map((o) => ({
                subjectId: o.subjectId,
                credits: o.credits,
                seatCap: o.seatCap,
              })),
            }
      )
    );
    setDialogOpen(true);
  };

  const addCoreSlot = () =>
    setFormSlots((s) => [...s, { kind: 'core', subjectId: '', credits: 0 }]);
  const addBasketSlot = () =>
    setFormSlots((s) => [
      ...s,
      {
        kind: 'basket',
        label: `Elective ${s.filter((x) => x.kind === 'basket').length + 1}`,
        chooseCount: 1,
        options: [],
      },
    ]);
  const removeSlot = (idx: number) => setFormSlots((s) => s.filter((_, i) => i !== idx));
  const patchSlot = (idx: number, patch: Partial<DraftSlot>) =>
    setFormSlots((s) =>
      s.map((slot, i) => (i === idx ? ({ ...slot, ...patch } as DraftSlot) : slot))
    );

  const formTotalCoreCredits = formSlots
    .filter((s): s is DraftCoreSlot => s.kind === 'core')
    .reduce((sum, s) => sum + (s.credits || 0), 0);

  const handleSave = async () => {
    const dept = departments.find((d) => d.code === formDept);
    if (!dept) {
      toast.error('Pick a department');
      return;
    }
    if (formSlots.length === 0) {
      toast.error('Add at least one course slot');
      return;
    }
    for (const slot of formSlots) {
      if (slot.kind === 'core' && !slot.subjectId) {
        toast.error('Every core slot needs a subject');
        return;
      }
      if (slot.kind === 'basket') {
        if (!slot.label.trim()) {
          toast.error('Every basket needs a label');
          return;
        }
        if (slot.options.length === 0 || slot.options.some((o) => !o.subjectId)) {
          toast.error(`"${slot.label}" needs at least one subject option`);
          return;
        }
        if (slot.chooseCount > slot.options.length) {
          toast.error(`"${slot.label}": choose-count exceeds its options`);
          return;
        }
      }
    }

    const slots: SchemeSlotPayload[] = formSlots.map((slot) =>
      slot.kind === 'core'
        ? {
            kind: 'core',
            category: slot.category || undefined,
            subjectId: slot.subjectId,
            credits: slot.credits,
          }
        : {
            kind: 'basket',
            label: slot.label,
            category: slot.category || undefined,
            chooseCount: slot.chooseCount,
            options: slot.options.map((o) => ({
              subjectId: o.subjectId,
              credits: o.credits,
              seatCap: o.seatCap || undefined,
            })),
          }
    );

    setSaving(true);
    try {
      if (editingScheme) {
        await registrationApi.updateScheme(editingScheme._id, {
          departmentName: dept.name,
          programId: formProgram === DEPARTMENT_WIDE ? null : formProgram,
          slots,
          minCredits: Number(formMinCredits),
          maxCredits: Number(formMaxCredits),
        });
        toast.success('Curriculum updated');
      } else {
        await registrationApi.createScheme({
          departmentCode: dept.code,
          departmentName: dept.name,
          ...(formProgram !== DEPARTMENT_WIDE && { programId: formProgram }),
          semesterNumber: Number(formSemester),
          slots,
          minCredits: Number(formMinCredits),
          maxCredits: Number(formMaxCredits),
        });
        toast.success('Curriculum created');
      }
      setDialogOpen(false);
      await load();
    } catch (err) {
      toast.error(getErrorMessage(err) || 'Failed to save curriculum');
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async (scheme: SchemeRow) => {
    try {
      await registrationApi.publishScheme(scheme._id);
      toast.success(`${scheme.departmentCode} Sem ${scheme.semesterNumber} published`);
      await load();
    } catch (err) {
      toast.error(getErrorMessage(err) || 'Failed to publish');
    }
  };

  const handleClone = async () => {
    if (!cloneSource) return;
    const dept = departments.find((d) => d.code === cloneDept);
    setSaving(true);
    try {
      await registrationApi.cloneScheme(cloneSource._id, {
        targetSemesterNumber: cloneSemester ? Number(cloneSemester) : undefined,
        targetDepartmentCode: cloneDept || undefined,
        targetDepartmentName: dept?.name,
      });
      toast.success('Copied as draft');
      setCloneSource(null);
      await load();
    } catch (err) {
      toast.error(getErrorMessage(err) || 'Failed to clone');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await registrationApi.deleteScheme(deleteTarget._id);
      toast.success('Curriculum deleted');
      setDeleteTarget(null);
      await load();
    } catch (err) {
      toast.error(getErrorMessage(err) || 'Failed to delete');
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-72" />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-44" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          What each department studies per semester — core courses plus elective groups with seat
          limits. Publish a semester to open it for registration.
        </p>
        {canCreate && schemes.length > 0 && (
          <Button onClick={openCreate}>
            <Plus className="mr-1.5 h-4 w-4" /> New curriculum
          </Button>
        )}
      </div>

      {schemes.length === 0 ? (
        <EmptyState
          icon={BookOpenCheck}
          title="No curriculum yet"
          description="Set out what a department studies in a given semester, then publish it so students can register."
          action={canCreate ? { label: 'Create first curriculum', onClick: openCreate } : undefined}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {schemes.map((scheme) => {
            const cores = scheme.slots.filter((s) => s.kind === 'core');
            const baskets = scheme.slots.filter((s) => s.kind === 'basket');
            return (
              <Card key={scheme._id}>
                <CardContent className="space-y-3 p-5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">
                        {scheme.programName ?? scheme.departmentName}
                        <span className="ml-2 text-muted-foreground">
                          {(() => {
                            const program = programs.find((p) => p._id === scheme.programId);
                            return program?.durationYears
                              ? termLabelFor(
                                  { ...program, durationYears: program.durationYears },
                                  scheme.semesterNumber
                                )
                              : `Sem ${scheme.semesterNumber}`;
                          })()}
                        </span>
                      </p>
                      {scheme.programName && (
                        <p className="text-[11px] text-muted-foreground">{scheme.departmentName}</p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {cores.length} core · {baskets.length}{' '}
                        {baskets.length === 1 ? 'basket' : 'baskets'} · {scheme.minCredits}–
                        {scheme.maxCredits} credits
                      </p>
                    </div>
                    <Badge
                      variant={
                        scheme.status === 'published'
                          ? 'default'
                          : scheme.status === 'draft'
                            ? 'outline'
                            : 'secondary'
                      }
                    >
                      {scheme.status}
                    </Badge>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {scheme.slots.slice(0, 6).map((slot) => (
                      <span
                        key={slot.slotId}
                        className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-[11px]"
                      >
                        {slot.kind === 'core' ? (
                          <Lock className="h-3 w-3" />
                        ) : (
                          <Layers className="h-3 w-3" />
                        )}
                        {slot.kind === 'core'
                          ? (subjectById.get(slot.subjectId ?? '')?.code ?? 'Core')
                          : slot.label}
                      </span>
                    ))}
                    {scheme.slots.length > 6 && (
                      <span className="text-[11px] text-muted-foreground">
                        +{scheme.slots.length - 6} more
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-1.5 border-t pt-3">
                    {canEdit && (
                      <Button size="sm" variant="outline" onClick={() => openEdit(scheme)}>
                        <Pencil className="mr-1 h-3.5 w-3.5" /> Edit
                      </Button>
                    )}
                    {canPublish && scheme.status === 'draft' && (
                      <Button size="sm" onClick={() => handlePublish(scheme)}>
                        <Send className="mr-1 h-3.5 w-3.5" /> Publish
                      </Button>
                    )}
                    {canCreate && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setCloneSource(scheme);
                          setCloneDept(scheme.departmentCode);
                          setCloneSemester(String(scheme.semesterNumber + 1));
                        }}
                      >
                        <Copy className="mr-1 h-3.5 w-3.5" /> Clone
                      </Button>
                    )}
                    {canDelete && scheme.status !== 'published' && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-destructive"
                        onClick={() => setDeleteTarget(scheme)}
                      >
                        <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* ─── Builder dialog ─────────────────────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingScheme ? 'Edit curriculum' : 'New curriculum'}</DialogTitle>
            <DialogDescription>
              Core courses are registered automatically; baskets let students choose. Credits on
              each course come from your subject library but can be overridden here.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-4">
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Department</Label>
                <Select value={formDept} onValueChange={setFormDept} disabled={!!editingScheme}>
                  <SelectTrigger>
                    <SelectValue placeholder="Department" />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map((d) => (
                      <SelectItem key={d.code} value={d.code}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {programs.length > 0 && (
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Program</Label>
                  <Select value={formProgram} onValueChange={setFormProgram}>
                    <SelectTrigger>
                      <SelectValue placeholder="Whole department" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={DEPARTMENT_WIDE}>Whole department</SelectItem>
                      {programsForDept.map((p) => (
                        <SelectItem key={p._id} value={p._id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-muted-foreground">
                    A program curriculum applies only to students in that program and takes
                    precedence over the department-wide one.
                  </p>
                </div>
              )}
              <div className="space-y-1.5">
                <Label>Semester</Label>
                <Select
                  value={formSemester}
                  onValueChange={setFormSemester}
                  disabled={!!editingScheme}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {termOptions(programs.find((p) => p._id === formProgram)).map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Credits (min–max)</Label>
                <div className="flex items-center gap-1">
                  <Input
                    type="number"
                    value={formMinCredits}
                    onChange={(e) => setFormMinCredits(e.target.value)}
                    className="w-16"
                  />
                  <span className="text-muted-foreground">–</span>
                  <Input
                    type="number"
                    value={formMaxCredits}
                    onChange={(e) => setFormMaxCredits(e.target.value)}
                    className="w-16"
                  />
                </div>
              </div>
            </div>

            {/* Slots */}
            <div className="space-y-3">
              {formSlots.map((slot, idx) => (
                <div key={idx} className="rounded-lg border p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <Badge variant={slot.kind === 'core' ? 'secondary' : 'outline'}>
                      {slot.kind === 'core' ? 'Core course' : 'Elective basket'}
                    </Badge>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                      onClick={() => removeSlot(idx)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>

                  {slot.kind === 'core' ? (
                    <div className="grid gap-2 sm:grid-cols-4">
                      <div className="sm:col-span-2">
                        <Select
                          value={slot.subjectId}
                          onValueChange={(v) => {
                            const subject = subjectById.get(v);
                            patchSlot(idx, {
                              subjectId: v,
                              credits: slot.credits || subject?.credits || 0,
                              category: slot.category || subject?.category,
                            });
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Subject" />
                          </SelectTrigger>
                          <SelectContent>
                            {subjects.map((s) => (
                              <SelectItem key={s._id} value={s._id}>
                                {s.name} ({s.code})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Input
                        type="number"
                        placeholder="Credits"
                        value={slot.credits || ''}
                        onChange={(e) => patchSlot(idx, { credits: Number(e.target.value) })}
                      />
                      <Select
                        value={slot.category ?? ''}
                        onValueChange={(v) => patchSlot(idx, { category: v })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Category" />
                        </SelectTrigger>
                        <SelectContent>
                          {CATEGORIES.map((c) => (
                            <SelectItem key={c} value={c}>
                              {c}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="grid gap-2 sm:grid-cols-4">
                        <Input
                          className="sm:col-span-2"
                          placeholder="Basket label (e.g. Professional Elective I)"
                          value={slot.label}
                          onChange={(e) => patchSlot(idx, { label: e.target.value })}
                        />
                        <div className="flex items-center gap-2">
                          <Label className="whitespace-nowrap text-xs">Choose</Label>
                          <Input
                            type="number"
                            min={1}
                            value={slot.chooseCount}
                            onChange={(e) =>
                              patchSlot(idx, { chooseCount: Math.max(1, Number(e.target.value)) })
                            }
                            className="w-16"
                          />
                        </div>
                        <Select
                          value={slot.category ?? ''}
                          onValueChange={(v) => patchSlot(idx, { category: v })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Category" />
                          </SelectTrigger>
                          <SelectContent>
                            {CATEGORIES.map((c) => (
                              <SelectItem key={c} value={c}>
                                {c}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {slot.options.map((option, oIdx) => (
                        <div key={oIdx} className="ml-4 grid gap-2 sm:grid-cols-5">
                          <div className="sm:col-span-2">
                            <Select
                              value={option.subjectId}
                              onValueChange={(v) => {
                                const subject = subjectById.get(v);
                                const options = slot.options.map((o, i) =>
                                  i === oIdx
                                    ? {
                                        ...o,
                                        subjectId: v,
                                        credits: o.credits || subject?.credits || 0,
                                      }
                                    : o
                                );
                                patchSlot(idx, { options });
                              }}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Subject" />
                              </SelectTrigger>
                              <SelectContent>
                                {subjects.map((s) => (
                                  <SelectItem key={s._id} value={s._id}>
                                    {s.name} ({s.code})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <Input
                            type="number"
                            placeholder="Credits"
                            value={option.credits || ''}
                            onChange={(e) => {
                              const options = slot.options.map((o, i) =>
                                i === oIdx ? { ...o, credits: Number(e.target.value) } : o
                              );
                              patchSlot(idx, { options });
                            }}
                          />
                          <Input
                            type="number"
                            placeholder="Seat cap"
                            value={option.seatCap ?? ''}
                            onChange={(e) => {
                              const options = slot.options.map((o, i) =>
                                i === oIdx
                                  ? {
                                      ...o,
                                      seatCap: e.target.value ? Number(e.target.value) : undefined,
                                    }
                                  : o
                              );
                              patchSlot(idx, { options });
                            }}
                          />
                          <Button
                            size="sm"
                            variant="ghost"
                            className="justify-self-start text-muted-foreground hover:text-destructive"
                            onClick={() =>
                              patchSlot(idx, {
                                options: slot.options.filter((_, i) => i !== oIdx),
                              })
                            }
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                      <Button
                        size="sm"
                        variant="outline"
                        className="ml-4"
                        onClick={() =>
                          patchSlot(idx, {
                            options: [...slot.options, { subjectId: '', credits: 0 }],
                          })
                        }
                      >
                        <Plus className="mr-1 h-3.5 w-3.5" /> Add option
                      </Button>
                    </div>
                  )}
                </div>
              ))}

              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={addCoreSlot}>
                  <Lock className="mr-1.5 h-3.5 w-3.5" /> Add core course
                </Button>
                <Button variant="outline" size="sm" onClick={addBasketSlot}>
                  <Layers className="mr-1.5 h-3.5 w-3.5" /> Add elective basket
                </Button>
                <span className="ml-auto self-center text-xs text-muted-foreground">
                  Core credits: {formTotalCoreCredits}
                </span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : editingScheme ? 'Save changes' : 'Create draft'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Clone dialog ───────────────────────────────────────────────── */}
      <Dialog open={!!cloneSource} onOpenChange={(open) => !open && setCloneSource(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Copy to another semester</DialogTitle>
            <DialogDescription>
              Copy {cloneSource?.departmentCode} Sem {cloneSource?.semesterNumber} to another
              department or semester as a fresh draft.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Department</Label>
              <Select value={cloneDept} onValueChange={setCloneDept}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((d) => (
                    <SelectItem key={d.code} value={d.code}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Semester</Label>
              <Select value={cloneSemester} onValueChange={setCloneSemester}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {termOptions(programs.find((p) => p._id === cloneSource?.programId)).map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCloneSource(null)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleClone} disabled={saving}>
              {saving ? 'Cloning…' : 'Clone'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Delete confirmation ────────────────────────────────────────── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {deleteTarget?.departmentCode} Sem {deleteTarget?.semesterNumber}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This scheme will be permanently removed. Schemes with registrations cannot be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
