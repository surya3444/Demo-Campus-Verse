'use client';

import { resolveYearPatterns, yearTermRanges, type YearTermPattern } from '@campus-verse/shared';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { PageHero } from '@/components/ui/page-hero';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
import { organizationApi } from '@/lib/api';
import { usePermissions } from '@/hooks/usePermissions';
import { useBranchStore } from '@/store/branchStore';
import { toast } from 'sonner';
import { GraduationCap, Plus, Pencil, Trash2, Archive, CalendarRange } from 'lucide-react';

interface Program {
  _id: string;
  departmentId: string;
  name: string;
  code: string;
  degreeType: 'ug' | 'pg' | 'diploma' | 'phd' | 'certificate';
  durationYears: number;
  totalSemesters: number;
  termPattern: YearTermPattern | 'mixed';
  yearPatterns?: YearTermPattern[];
  specialization?: string;
  status: 'active' | 'archived';
  department: { _id: string; name: string; code: string } | null;
}

interface DepartmentOption {
  _id: string;
  name: string;
  code: string;
}

const DEGREE_TYPES = [
  { value: 'ug', label: 'Undergraduate' },
  { value: 'pg', label: 'Postgraduate' },
  { value: 'diploma', label: 'Diploma' },
  { value: 'phd', label: 'PhD' },
  { value: 'certificate', label: 'Certificate' },
] as const;

const TERM_PATTERNS = [
  { value: 'semester', label: 'Semester' },
  { value: 'annual', label: 'Annual' },
  { value: 'trimester', label: 'Trimester' },
] as const;

const DEGREE_LABELS: Record<Program['degreeType'], string> = {
  ug: 'UG',
  pg: 'PG',
  diploma: 'Diploma',
  phd: 'PhD',
  certificate: 'Certificate',
};

/** UG first, then PG, then the long tail — the order a prospectus lists them. */
const DEGREE_ORDER: Array<Program['degreeType']> = ['ug', 'pg', 'diploma', 'phd', 'certificate'];

const EMPTY_FORM = {
  departmentId: '',
  name: '',
  code: '',
  degreeType: 'ug' as Program['degreeType'],
  durationYears: '4',
  // One pattern per year — e.g. an annual first year, then semesters.
  yearPatterns: ['semester', 'semester', 'semester', 'semester'] as YearTermPattern[],
  specialization: '',
};

const PATTERN_LABEL: Record<YearTermPattern, string> = {
  annual: 'Annual',
  semester: 'Semester',
  trimester: 'Trimester',
};

/** Resize the per-year list when the duration changes; new years copy the last. */
const resizePatterns = (patterns: YearTermPattern[], years: number): YearTermPattern[] =>
  Array.from(
    { length: years },
    (_, i) => patterns[i] ?? patterns[patterns.length - 1] ?? 'semester'
  );

/** "Annual + Semester" for a mixed program, else the single pattern. */
const describePatterns = (program: Program) => {
  const patterns = resolveYearPatterns(program);
  return [...new Set(patterns)].map((p) => PATTERN_LABEL[p]).join(' + ');
};

export default function ProgramsPage() {
  const { hasPermission } = usePermissions();
  const [programs, setPrograms] = useState<Program[]>([]);
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'active' | 'archived'>('active');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Program | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Program | null>(null);

  const canEdit = hasPermission('organization.settings', 'edit');
  const canDelete = hasPermission('organization.settings', 'delete');

  // Programs and departments are campus-scoped; manual fetch (no
  // react-query), so the branch dependency triggers refetch on campus switch.
  const selectedBranchId = useBranchStore((s) => s.selectedBranchId);

  const fetchPrograms = useCallback(async () => {
    try {
      setLoading(true);
      const response = await organizationApi.getPrograms({ status: statusFilter });
      if (response.success) {
        setPrograms(response.data);
      }
    } catch {
      toast.error('Failed to load programs');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, selectedBranchId]);

  // Department picker source. Uses the organization read model rather than
  // hrApi.getDepartments so tenants without the HR module still get the list.
  const fetchDepartments = useCallback(async () => {
    try {
      const response = await organizationApi.getDepartmentsOverview();
      if (response.success) {
        setDepartments(
          (response.data as DepartmentOption[]).map((d) => ({
            _id: d._id,
            name: d.name,
            code: d.code,
          }))
        );
      }
    } catch {
      // Non-fatal: the form warns when there are no departments to pick.
    }
  }, [selectedBranchId]);

  useEffect(() => {
    fetchPrograms();
  }, [fetchPrograms]);

  useEffect(() => {
    fetchDepartments();
  }, [fetchDepartments]);

  // Department → degree type → programs: the shape a university prospectus
  // has, so "what UG does Engineering offer?" reads at a glance.
  const grouped = useMemo(() => {
    const map = new Map<string, { name: string; items: Program[] }>();
    for (const p of programs) {
      const key = p.department?._id ?? p.departmentId;
      const name = p.department?.name ?? 'Unassigned department';
      const bucket = map.get(key) ?? { name, items: [] };
      bucket.items.push(p);
      map.set(key, bucket);
    }
    return [...map.values()]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((group) => ({
        name: group.name,
        // DEGREE_ORDER keeps UG before PG before the rest, whatever order the
        // API returned them in.
        tiers: DEGREE_ORDER.map((degreeType) => ({
          degreeType,
          items: group.items.filter((p) => p.degreeType === degreeType),
        })).filter((tier) => tier.items.length > 0),
      }));
  }, [programs]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (program: Program) => {
    setEditing(program);
    setForm({
      departmentId: program.departmentId,
      name: program.name,
      code: program.code,
      degreeType: program.degreeType,
      durationYears: String(program.durationYears),
      yearPatterns: resolveYearPatterns(program),
      specialization: program.specialization || '',
    });
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.departmentId) {
      toast.error('Pick a department');
      return;
    }
    if (!form.name.trim() || !form.code.trim()) {
      toast.error('Name and code are required');
      return;
    }
    const durationYears = Number(form.durationYears);
    if (!Number.isInteger(durationYears) || durationYears < 1 || durationYears > 10) {
      toast.error('Duration must be between 1 and 10 years');
      return;
    }
    const yearPatterns = resizePatterns(form.yearPatterns, durationYears);

    setSaving(true);
    try {
      const payload = {
        departmentId: form.departmentId,
        name: form.name.trim(),
        code: form.code.trim().toUpperCase(),
        degreeType: form.degreeType,
        durationYears,
        yearPatterns,
        specialization: form.specialization.trim() || undefined,
      };
      const response = editing
        ? await organizationApi.updateProgram(editing._id, payload)
        : await organizationApi.createProgram(payload);
      if (response.success) {
        toast.success(editing ? 'Program updated' : 'Program created');
        setDialogOpen(false);
        fetchPrograms();
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: { message?: string } } } };
      toast.error(err.response?.data?.error?.message || 'Failed to save program');
    } finally {
      setSaving(false);
    }
  };

  const handleArchiveToggle = async (program: Program) => {
    try {
      const response = await organizationApi.updateProgram(program._id, {
        status: program.status === 'active' ? 'archived' : 'active',
      });
      if (response.success) {
        toast.success(program.status === 'active' ? 'Program archived' : 'Program restored');
        fetchPrograms();
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: { message?: string } } } };
      toast.error(err.response?.data?.error?.message || 'Failed to update program');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const response = await organizationApi.deleteProgram(deleteTarget._id);
      if (response.success) {
        toast.success('Program deleted');
        setDeleteTarget(null);
        fetchPrograms();
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: { message?: string } } } };
      toast.error(err.response?.data?.error?.message || 'Failed to delete program');
      setDeleteTarget(null);
    }
  };

  const formYears = Math.min(10, Math.max(1, Number(form.durationYears) || 1));
  const formPatterns = resizePatterns(form.yearPatterns, formYears);
  const formRanges = yearTermRanges({ durationYears: formYears, yearPatterns: formPatterns });
  const formUniform = formPatterns.every((p) => p === formPatterns[0]) ? formPatterns[0] : '';

  return (
    <div className="space-y-6">
      <PageHero
        title="Programs"
        description="Degree programs offered by each department — B.Tech CSE, MBA, M.Tech and the like"
        icon={GraduationCap}
        actions={
          canEdit ? (
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Add Program
            </Button>
          ) : undefined
        }
      />

      <div className="flex items-center gap-2">
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as 'active')}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">Loading…</CardContent>
        </Card>
      ) : programs.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center space-y-2">
            <GraduationCap className="h-8 w-8 mx-auto text-muted-foreground" />
            <p className="font-medium">No {statusFilter} programs</p>
            <p className="text-sm text-muted-foreground max-w-lg mx-auto">
              A program is the degree a department awards — &quot;B.Tech Computer Science&quot; (UG,
              4 years, 8 semesters) or &quot;MBA&quot; (PG, 2 years, 4 semesters). Departments come
              first; each program belongs to one.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {grouped.map((group) => (
            <div key={group.name} className="space-y-4">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                {group.name}
              </h2>
              {group.tiers.map((tier) => (
                <div key={tier.degreeType} className="space-y-3">
                  <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                    {DEGREE_LABELS[tier.degreeType]}
                  </p>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {tier.items.map((program) => (
                      <Card
                        key={program._id}
                        className={program.status === 'archived' ? 'opacity-60' : ''}
                      >
                        <CardContent className="p-5">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                                <GraduationCap className="h-5 w-5" />
                              </div>
                              <div className="min-w-0">
                                <p className="font-semibold truncate">{program.name}</p>
                                <p className="text-xs text-muted-foreground truncate">
                                  {program.code}
                                  {program.specialization ? ` · ${program.specialization}` : ''}
                                </p>
                              </div>
                            </div>
                            <Badge variant="secondary">{DEGREE_LABELS[program.degreeType]}</Badge>
                          </div>

                          <div className="mt-4 flex items-center justify-between">
                            <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                              <CalendarRange className="h-4 w-4" />
                              {program.durationYears} yr · {program.totalSemesters} terms ·{' '}
                              {describePatterns(program)}
                            </p>
                            <div className="flex items-center gap-1">
                              {canEdit && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => openEdit(program)}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                              )}
                              {canEdit && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => handleArchiveToggle(program)}
                                  title={program.status === 'active' ? 'Archive' : 'Restore'}
                                >
                                  <Archive className="h-4 w-4" />
                                </Button>
                              )}
                              {canDelete && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive"
                                  onClick={() => setDeleteTarget(program)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Program' : 'Add Program'}</DialogTitle>
            <DialogDescription>
              {editing
                ? "Update this program's structure."
                : 'A degree awarded by a department, e.g. "B.Tech Computer Science" or "MBA".'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="prog-dept">Department *</Label>
              <Select
                value={form.departmentId}
                onValueChange={(v) => setForm({ ...form, departmentId: v })}
              >
                <SelectTrigger id="prog-dept">
                  <SelectValue placeholder="Select a department" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((d) => (
                    <SelectItem key={d._id} value={d._id}>
                      {d.name} ({d.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {departments.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  No departments yet — create one under Organization → Departments first.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="prog-name">Name *</Label>
              <Input
                id="prog-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="B.Tech Computer Science"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="prog-code">Code *</Label>
                <Input
                  id="prog-code"
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                  placeholder="BTECH-CSE"
                />
                <p className="text-xs text-muted-foreground">A-Z, 0-9 and hyphens.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="prog-degree">Degree type *</Label>
                <Select
                  value={form.degreeType}
                  onValueChange={(v) =>
                    setForm({ ...form, degreeType: v as Program['degreeType'] })
                  }
                >
                  <SelectTrigger id="prog-degree">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DEGREE_TYPES.map((d) => (
                      <SelectItem key={d.value} value={d.value}>
                        {d.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label htmlFor="prog-years">Duration (years) *</Label>
                <Input
                  id="prog-years"
                  type="number"
                  min={1}
                  max={10}
                  value={form.durationYears}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      durationYears: e.target.value,
                      yearPatterns: resizePatterns(
                        form.yearPatterns,
                        Math.min(10, Math.max(1, Number(e.target.value) || 1))
                      ),
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="prog-pattern">Term pattern</Label>
                <Select
                  value={formUniform || 'mixed'}
                  onValueChange={(v) =>
                    v !== 'mixed' &&
                    setForm({
                      ...form,
                      yearPatterns: Array(formYears).fill(v as YearTermPattern),
                    })
                  }
                >
                  <SelectTrigger id="prog-pattern">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TERM_PATTERNS.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label} (all years)
                      </SelectItem>
                    ))}
                    <SelectItem value="mixed" disabled>
                      Mixed (set per year below)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Total terms</Label>
                <div className="flex h-10 items-center rounded-md border bg-muted/40 px-3 text-sm tabular-nums">
                  {formRanges[formRanges.length - 1]?.last ?? 0}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Term pattern by year</Label>
              <div className="grid grid-cols-2 gap-2">
                {formRanges.map((range) => (
                  <div
                    key={range.year}
                    className="flex items-center justify-between gap-2 rounded-md border px-3 py-2"
                  >
                    <div className="text-sm">
                      <p className="font-medium">Year {range.year}</p>
                      <p className="text-xs text-muted-foreground">
                        {range.first === range.last
                          ? `Term ${range.first}`
                          : `Terms ${range.first}–${range.last}`}
                      </p>
                    </div>
                    <Select
                      value={range.pattern}
                      onValueChange={(v) => {
                        const next = [...formPatterns];
                        next[range.year - 1] = v as YearTermPattern;
                        setForm({ ...form, yearPatterns: next });
                      }}
                    >
                      <SelectTrigger className="h-8 w-32" aria-label={`Year ${range.year} pattern`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TERM_PATTERNS.map((t) => (
                          <SelectItem key={t.value} value={t.value}>
                            {t.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Terms are numbered across the program: an annual Year 1 is term 1, so Year 2&apos;s
                semesters are terms 2 and 3.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="prog-spec">Specialization</Label>
              <Input
                id="prog-spec"
                value={form.specialization}
                onChange={(e) => setForm({ ...form, specialization: e.target.value })}
                placeholder="Artificial Intelligence & Machine Learning"
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving…' : editing ? 'Save Changes' : 'Create Program'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete program?</DialogTitle>
            <DialogDescription>
              &quot;{deleteTarget?.name}&quot; will be permanently removed. Programs referenced by a
              class cannot be deleted — archive them instead.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
