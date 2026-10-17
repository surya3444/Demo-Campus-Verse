'use client';

import { useCallback, useEffect, useState } from 'react';
import { organizationApi, hrApi } from '@/lib/api';
import { usePermissions } from '@/hooks/usePermissions';
import { useBranchStore } from '@/store/branchStore';
import { PageHero } from '@/components/ui/page-hero';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
  Building2,
  Plus,
  Pencil,
  Trash2,
  Users,
  GraduationCap,
  Hash,
  Landmark,
} from 'lucide-react';
import { toast } from 'sonner';
import { DepartmentDetail } from './DepartmentDetail';

const ALL_INSTITUTIONS = '__all__';

interface DepartmentOverview {
  _id: string;
  name: string;
  code: string;
  type: 'academic' | 'administrative' | 'support';
  description?: string;
  institution: { _id: string; name: string; code: string; isDefault: boolean } | null;
  headOfDepartment: { _id: string; displayName: string } | null;
  students: number;
  faculty: number;
  sections: number;
  attendancePct: number | null;
}

interface StaffOption {
  _id: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;
}

interface InstitutionOption {
  _id: string;
  name: string;
  code: string;
  isDefault: boolean;
  status: 'active' | 'archived';
}

const NONE_HOD = '__none__';

const TYPE_LABELS: Record<DepartmentOverview['type'], string> = {
  academic: 'Teaching department',
  administrative: 'Service department',
  support: 'Service department',
};

function staffName(s: StaffOption) {
  return s.displayName || `${s.firstName ?? ''} ${s.lastName ?? ''}`.trim() || 'Staff';
}

function slugCode(name: string) {
  return name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '')
    .slice(0, 6);
}

export default function DepartmentsPage() {
  const { hasPermission } = usePermissions();
  const canManage = hasPermission('hr.staff', 'create');

  const [departments, setDepartments] = useState<DepartmentOverview[]>([]);
  const [instFilter, setInstFilter] = useState(ALL_INSTITUTIONS);
  const [selected, setSelected] = useState<DepartmentOverview | null>(null);
  const [institutions, setInstitutions] = useState<InstitutionOption[]>([]);
  const [staff, setStaff] = useState<StaffOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<DepartmentOverview | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formName, setFormName] = useState('');
  const [formCode, setFormCode] = useState('');
  const [codeTouched, setCodeTouched] = useState(false);
  const [formType, setFormType] = useState<DepartmentOverview['type']>('academic');
  const [formDescription, setFormDescription] = useState('');
  const [formHod, setFormHod] = useState<string>(NONE_HOD);
  const [formInstitution, setFormInstitution] = useState<string>('');

  // Departments are campus-scoped; manual fetch (no react-query), so the
  // branch dependency is what triggers the refetch on campus switch.
  const selectedBranchId = useBranchStore((s) => s.selectedBranchId);

  const load = useCallback(async () => {
    try {
      const [overview, insts] = await Promise.all([
        organizationApi.getDepartmentsOverview(),
        // The picker is optional: a tenant without the institution tier still
        // manages departments, it just never sees the field.
        organizationApi
          .getInstitutions({ status: 'active' })
          .catch(() => ({ data: [] as InstitutionOption[] })),
      ]);
      setDepartments(overview.data || []);
      setInstitutions(insts.data || []);
    } catch {
      toast.error('Failed to load departments');
    } finally {
      setLoading(false);
    }
  }, [selectedBranchId]);

  useEffect(() => {
    void load();
    // HOD picker options — over-fetch so it doesn't paginate.
    hrApi
      .getStaff({ status: 'active', limit: 200 })
      .then((res) => setStaff(res.data || []))
      .catch(() => {
        /* picker is optional */
      });
  }, [load]);

  // A campus with a single (default) institution is a school or college — the
  // tier exists but adds nothing to look at, so the picker and the grouping
  // stay hidden until there is a real choice to make.
  const defaultInstitutionId = institutions.find((i) => i.isDefault)?._id ?? '';
  const multiInstitution = institutions.length > 1;

  // Institution order follows the institutions list (default first, per the
  // API's sort); anything unresolved trails in its own bucket.
  const visible =
    instFilter === ALL_INSTITUTIONS
      ? departments
      : departments.filter((d) => d.institution?._id === instFilter);
  const groupedByInstitution: Array<[string, DepartmentOverview[]]> = (() => {
    const buckets = new Map<string, DepartmentOverview[]>();
    for (const inst of institutions) buckets.set(inst._id, []);
    const unassigned: DepartmentOverview[] = [];
    for (const dept of visible) {
      const bucket = dept.institution ? buckets.get(dept.institution._id) : undefined;
      if (bucket) bucket.push(dept);
      else unassigned.push(dept);
    }
    const rows: Array<[string, DepartmentOverview[]]> = institutions
      .map((i): [string, DepartmentOverview[]] => [i.name, buckets.get(i._id) ?? []])
      .filter(([, depts]) => depts.length > 0);
    if (unassigned.length) rows.push(['Unassigned', unassigned]);
    return rows;
  })();

  const openAdd = () => {
    setEditing(null);
    setFormName('');
    setFormCode('');
    setCodeTouched(false);
    setFormType('academic');
    setFormDescription('');
    setFormHod(NONE_HOD);
    setFormInstitution(defaultInstitutionId);
    setDialogOpen(true);
  };

  const openEdit = (dept: DepartmentOverview) => {
    setEditing(dept);
    setFormName(dept.name);
    setFormCode(dept.code);
    setCodeTouched(true);
    setFormType(dept.type);
    setFormDescription(dept.description || '');
    setFormHod(dept.headOfDepartment?._id ?? NONE_HOD);
    setFormInstitution(dept.institution?._id ?? defaultInstitutionId);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formName.trim() || !formCode.trim()) {
      toast.error('Name and code are required');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: formName.trim(),
        code: formCode.trim().toUpperCase(),
        type: formType,
        description: formDescription.trim() || undefined,
        headOfDepartment: formHod === NONE_HOD ? null : formHod,
        ...(formInstitution && { institutionId: formInstitution }),
      };
      if (editing) {
        await hrApi.updateDepartment(editing._id, payload);
        toast.success('Department updated');
      } else {
        await hrApi.createDepartment(payload);
        toast.success('Department created');
      }
      setDialogOpen(false);
      await load();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: { message?: string } } } };
      toast.error(error.response?.data?.error?.message || 'Failed to save department');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      await hrApi.deleteDepartment(editing._id);
      toast.success('Department deleted');
      setDialogOpen(false);
      await load();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: { message?: string } } } };
      toast.error(error.response?.data?.error?.message || 'Failed to delete department');
    } finally {
      setSaving(false);
    }
  };

  const renderCard = (dept: DepartmentOverview) => (
    <Card
      key={dept._id}
      role="button"
      tabIndex={0}
      onClick={() => setSelected(dept)}
      onKeyDown={(e) => e.key === 'Enter' && setSelected(dept)}
      className="group relative cursor-pointer overflow-hidden rounded-2xl transition-shadow hover:shadow-md"
    >
      <CardContent className="space-y-4 p-6">
        {/* Identity */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary font-mono text-xs font-bold text-primary-foreground">
              {dept.code.slice(0, 4)}
            </div>
            <div className="min-w-0">
              <p className="truncate text-base font-semibold leading-tight">{dept.code}</p>
              <p className="truncate text-sm text-muted-foreground">{dept.name}</p>
            </div>
          </div>
          {canManage && (
            <Button
              variant="ghost"
              size="icon"
              className="opacity-0 transition-opacity group-hover:opacity-100"
              aria-label={`Edit ${dept.name}`}
              onClick={(e) => {
                e.stopPropagation();
                openEdit(dept);
              }}
            >
              <Pencil className="h-4 w-4" />
            </Button>
          )}
        </div>

        <Badge
          variant="secondary"
          className={
            dept.type === 'academic'
              ? 'bg-sky-100 text-sky-700 hover:bg-sky-100'
              : 'bg-violet-100 text-violet-700 hover:bg-violet-100'
          }
        >
          {TYPE_LABELS[dept.type]}
        </Badge>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 border-y py-3">
          <div>
            <p className="text-xl font-bold">{dept.students}</p>
            <p className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              <GraduationCap className="h-3 w-3" /> Students
            </p>
          </div>
          <div>
            <p className="text-xl font-bold">{dept.faculty}</p>
            <p className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              <Users className="h-3 w-3" /> Faculty
            </p>
          </div>
          <div>
            <p className="text-xl font-bold">{dept.sections}</p>
            <p className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              <Hash className="h-3 w-3" /> Sections
            </p>
          </div>
        </div>

        {/* HOD + attendance */}
        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground">Head of department</p>
          <p className="text-sm font-semibold">
            {dept.headOfDepartment?.displayName ?? 'Not assigned'}
          </p>
          {dept.attendancePct !== null && (
            <Badge
              variant="secondary"
              className={
                dept.attendancePct >= 85
                  ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100'
                  : 'bg-amber-100 text-amber-700 hover:bg-amber-100'
              }
            >
              {dept.attendancePct}% attendance
            </Badge>
          )}
        </div>
        <p className="text-xs font-medium text-primary">See staff, students &amp; logins →</p>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <PageHero
        icon={Building2}
        eyebrow="Organization"
        title="Departments"
        description="Teaching departments enrol students; service departments supply shared subjects and enrol none."
        actions={
          canManage && (
            <Button onClick={openAdd}>
              <Plus className="mr-2 h-4 w-4" /> Add Department
            </Button>
          )
        }
      />

      {multiInstitution && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">Institution</span>
          <Select value={instFilter} onValueChange={setInstFilter}>
            <SelectTrigger className="w-72">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_INSTITUTIONS}>All institutions</SelectItem>
              {institutions.map((i) => (
                <SelectItem key={i._id} value={i._id}>
                  {i.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-sm text-muted-foreground">
            · click a department to see its staff, students and who can log in
          </span>
        </div>
      )}

      {loading ? (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-64 rounded-2xl" />
          ))}
        </div>
      ) : departments.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No departments yet"
          description={
            canManage
              ? 'Create your first department — then link staff and academic structure to it.'
              : 'Departments will appear here once created.'
          }
        />
      ) : multiInstitution ? (
        <div className="space-y-8">
          {groupedByInstitution.map(([label, depts]) => (
            <section key={label} className="space-y-3">
              <div className="flex items-center gap-2">
                <Landmark className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold">{label}</h2>
                <span className="font-mono text-[11px] text-muted-foreground">
                  {depts.length} department{depts.length === 1 ? '' : 's'}
                </span>
              </div>
              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {depts.map((dept) => renderCard(dept))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((dept) => renderCard(dept))}
        </div>
      )}

      {/* Add / edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={(o) => !o && setDialogOpen(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit department' : 'Add department'}</DialogTitle>
            <DialogDescription>
              Departments are shared across HR and the academic structure — staff, subjects, and
              classes all reference them.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-[1fr_120px] gap-3">
              <div className="space-y-2">
                <Label htmlFor="dept-name">Name *</Label>
                <Input
                  id="dept-name"
                  value={formName}
                  placeholder="Computer Science & Engineering"
                  onChange={(e) => {
                    setFormName(e.target.value);
                    if (!codeTouched) setFormCode(slugCode(e.target.value));
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dept-code">Code *</Label>
                <Input
                  id="dept-code"
                  value={formCode}
                  placeholder="CSE"
                  onChange={(e) => {
                    setCodeTouched(true);
                    setFormCode(e.target.value.toUpperCase());
                  }}
                />
              </div>
            </div>
            {multiInstitution && (
              <div className="space-y-2">
                <Label>Institution *</Label>
                <Select value={formInstitution} onValueChange={setFormInstitution}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pick an institution" />
                  </SelectTrigger>
                  <SelectContent>
                    {institutions.map((i) => (
                      <SelectItem key={i._id} value={i._id}>
                        {i.name}
                        {i.isDefault ? ' · default' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">
                  Which constituent institution on this campus runs the department. Moving it here
                  moves its programs, staff, and classes with it.
                </p>
              </div>
            )}
            <div className="space-y-2">
              <Label>Kind</Label>
              <Select
                value={formType}
                onValueChange={(v) => setFormType(v as DepartmentOverview['type'])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="academic">Teaching — enrols students</SelectItem>
                  <SelectItem value="administrative">
                    Service — supplies subjects, enrols none
                  </SelectItem>
                  <SelectItem value="support">Support — operations only</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Head of department</Label>
              <Select value={formHod} onValueChange={setFormHod}>
                <SelectTrigger>
                  <SelectValue placeholder="Pick a staff member" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_HOD}>Not assigned</SelectItem>
                  {staff.map((s) => (
                    <SelectItem key={s._id} value={s._id}>
                      {staffName(s)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="dept-desc">Description</Label>
              <Textarea
                id="dept-desc"
                rows={2}
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="What this department covers"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:justify-between">
            {editing ? (
              <Button variant="destructive" onClick={handleDelete} disabled={saving}>
                <Trash2 className="mr-1.5 h-4 w-4" /> Delete
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : editing ? 'Save changes' : 'Create department'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <DepartmentDetail
        departmentId={selected?._id ?? null}
        institutionName={selected?.institution?.name}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}
