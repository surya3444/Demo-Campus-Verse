'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { GraduationCap, Loader2, Plus, Target, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  OBE_PO_PRESETS,
  type ObeProgramPreset,
  type PoPresetItem,
} from '@campus-verse/shared/constants';
import { obeApi, organizationApi } from '@/lib/api';
import { usePermissions } from '@/hooks/usePermissions';
import { getErrorMessage } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { EditorialHeader } from '@/components/exams/EditorialHeader';
import { SectionPanel } from '@/components/exams/SectionPanel';
import { Field } from '@/components/exams/Field';

interface ProgramRow {
  _id: string;
  departmentCode: string;
  /** FK → the curriculum program this PO/PSO set belongs to, when linked. */
  curriculumProgramId?: string;
  curriculumProgramName?: string;
  name: string;
  preset: ObeProgramPreset;
  pos: Array<{ _id: string; code: string; isCustom: boolean }>;
  psos: Array<{ _id: string; code: string }>;
}

interface CurriculumProgramOption {
  _id: string;
  name: string;
  code: string;
  department?: { _id: string; name: string; code: string } | null;
}

const PRESET_KEYS = Object.keys(OBE_PO_PRESETS) as ObeProgramPreset[];

/** Select sentinel — Radix Select rejects an empty-string item value. */
const DEPARTMENT_WIDE = '__department__';

export default function ObeProgramsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ProgramRow | null>(null);
  const [form, setForm] = useState({
    departmentCode: '',
    curriculumProgramId: DEPARTMENT_WIDE,
    name: '',
    preset: 'nba_ug_engineering' as ObeProgramPreset,
  });

  // Curriculum programs of this branch. PSOs are program-specific, so a
  // department running CSE, CSE (AI & ML) and CSE (Data Science) keeps three
  // separate PO/PSO sets — one per program.
  const { data: curriculumData } = useQuery({
    queryKey: ['curriculum-programs'],
    queryFn: () => organizationApi.getPrograms({ status: 'active' }),
  });
  const curriculumPrograms: CurriculumProgramOption[] = curriculumData?.data || [];

  const { data, isLoading } = useQuery({
    queryKey: ['obe-programs'],
    queryFn: () => obeApi.getPrograms(),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      obeApi.createProgram({
        departmentCode: form.departmentCode.trim().toUpperCase(),
        ...(form.curriculumProgramId !== DEPARTMENT_WIDE && {
          curriculumProgramId: form.curriculumProgramId,
        }),
        name: form.name.trim(),
        preset: form.preset,
      }),
    onSuccess: (res) => {
      toast.success('Program created');
      queryClient.invalidateQueries({ queryKey: ['obe-programs'] });
      setDialogOpen(false);
      setForm({
        departmentCode: '',
        curriculumProgramId: DEPARTMENT_WIDE,
        name: '',
        preset: 'nba_ug_engineering',
      });
      const id = res?.data?._id;
      if (id) router.push(`/obe/programs/${id}`);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => obeApi.deleteProgram(id),
    onSuccess: () => {
      toast.success('Program deleted');
      queryClient.invalidateQueries({ queryKey: ['obe-programs'] });
      setDeleteTarget(null);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const programs: ProgramRow[] = data?.data || [];
  const canCreate = hasPermission('obe.programs', 'create');
  const canDelete = hasPermission('obe.programs', 'delete');
  const presetPos: readonly PoPresetItem[] = OBE_PO_PRESETS[form.preset].pos;
  const canSubmit = !!form.departmentCode.trim() && !!form.name.trim();

  return (
    <div className="space-y-8 pb-12">
      <EditorialHeader
        eyebrow="OBE · Programs"
        meta="/obe/programs"
        icon={Target}
        title="Programs"
        description="Each program owns the Program Outcomes (POs) and Program Specific Outcomes (PSOs) that course outcomes are mapped against for accreditation."
        actions={
          canCreate ? (
            <Button className="gap-2" onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4" />
              New program
            </Button>
          ) : null
        }
      />

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-2xl" />
          ))}
        </div>
      ) : programs.length === 0 ? (
        <SectionPanel>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <GraduationCap className="mb-4 h-12 w-12 text-muted-foreground opacity-40" />
            <p className="text-lg font-medium">No programs yet</p>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              Create one program per department — B.Tech CSE, M.Tech VLSI, MBA. Picking a preset
              seeds the standard NBA graduate attributes so you only edit what differs.
            </p>
            {canCreate && (
              <Button className="mt-5 gap-2" onClick={() => setDialogOpen(true)}>
                <Plus className="h-4 w-4" />
                New program
              </Button>
            )}
          </div>
        </SectionPanel>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {programs.map((program) => {
            const customCount = program.pos.filter((po) => po.isCustom).length;
            return (
              <div
                key={program._id}
                className="group relative flex flex-col rounded-2xl border bg-card p-5 shadow-soft transition-colors hover:border-foreground/20"
              >
                <div className="flex items-start justify-between gap-3">
                  <Badge variant="outline" className="font-mono text-[11px]">
                    {program.departmentCode}
                  </Badge>
                  {canDelete && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                      aria-label={`Delete ${program.name}`}
                      onClick={() => setDeleteTarget(program)}
                    >
                      <Trash2 className="h-4 w-4 text-rose-500" />
                    </Button>
                  )}
                </div>

                <Link href={`/obe/programs/${program._id}`} className="mt-3 block">
                  <h3 className="font-display text-lg font-bold leading-tight tracking-tight">
                    {program.name}
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {OBE_PO_PRESETS[program.preset]?.name ?? program.preset}
                  </p>
                  {program.curriculumProgramName && (
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Curriculum · {program.curriculumProgramName}
                    </p>
                  )}
                </Link>

                <div className="mt-4 flex items-center gap-4 border-t pt-4 text-xs text-muted-foreground">
                  <span>
                    <span className="font-semibold tabular-nums text-foreground">
                      {program.pos.length}
                    </span>{' '}
                    POs
                  </span>
                  <span>
                    <span className="font-semibold tabular-nums text-foreground">
                      {program.psos.length}
                    </span>{' '}
                    PSOs
                  </span>
                  {customCount > 0 && <span>{customCount} custom</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New program</DialogTitle>
            <DialogDescription>
              The preset seeds this program&apos;s Program Outcomes. You can edit statements and add
              up to 3 custom POs afterwards.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            <div className="grid gap-5 sm:grid-cols-[160px_1fr]">
              <Field label="Department code" required hint="Matches your academic structure.">
                <Input
                  placeholder="CSE"
                  className="font-mono uppercase"
                  value={form.departmentCode}
                  onChange={(e) =>
                    setForm({ ...form, departmentCode: e.target.value.toUpperCase() })
                  }
                />
              </Field>
              <Field label="Program name" required>
                <Input
                  placeholder="B.Tech Computer Science & Engineering"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </Field>
            </div>

            {curriculumPrograms.length > 0 && (
              <Field
                label="Curriculum program"
                hint="Links this outcome set to a degree program so attainment rolls up per program. Leave department-wide if the department runs a single program."
              >
                <Select
                  value={form.curriculumProgramId}
                  onValueChange={(value) => {
                    const picked = curriculumPrograms.find((p) => p._id === value);
                    setForm((f) => ({
                      ...f,
                      curriculumProgramId: value,
                      // Prefill the identity fields from the program — still editable.
                      name: picked && !f.name.trim() ? picked.name : f.name,
                      departmentCode:
                        picked?.department?.code && !f.departmentCode.trim()
                          ? picked.department.code.toUpperCase()
                          : f.departmentCode,
                    }));
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Department-wide" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={DEPARTMENT_WIDE}>Department-wide</SelectItem>
                    {curriculumPrograms.map((p) => (
                      <SelectItem key={p._id} value={p._id}>
                        {p.name}
                        {p.department ? ` · ${p.department.code}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}

            <div className="space-y-2">
              <Label className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Outcome preset
              </Label>
              <RadioGroup
                value={form.preset}
                onValueChange={(v) => setForm({ ...form, preset: v as ObeProgramPreset })}
                className="grid gap-2 sm:grid-cols-2"
              >
                {PRESET_KEYS.map((key) => {
                  const preset = OBE_PO_PRESETS[key];
                  return (
                    <label
                      key={key}
                      htmlFor={`preset-${key}`}
                      className="flex cursor-pointer items-start gap-3 rounded-xl border bg-muted/20 p-3 transition-colors hover:bg-muted/40"
                    >
                      <RadioGroupItem value={key} id={`preset-${key}`} className="mt-0.5" />
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold leading-snug">
                          {preset.name}
                        </span>
                        <span className="mt-0.5 block text-[11px] text-muted-foreground">
                          {preset.pos.length === 0
                            ? 'Start empty and write your own POs'
                            : `${preset.pos.length} program outcomes seeded`}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </RadioGroup>
            </div>

            {presetPos.length > 0 && (
              <div className="rounded-xl border bg-muted/20">
                <p className="border-b px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Preview
                </p>
                <ul className="max-h-56 divide-y overflow-y-auto">
                  {presetPos.map((po) => (
                    <li key={po.code} className="px-4 py-2">
                      <p className="text-xs font-semibold">
                        <span className="font-mono text-primary">{po.code}</span> · {po.title}
                      </p>
                      <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                        {po.statement}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={!canSubmit || createMutation.isPending}
              className="gap-2"
            >
              {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Create program
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Its POs and PSOs go with it. Programs already referenced by course outcomes or
              offerings can&apos;t be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                if (deleteTarget) deleteMutation.mutate(deleteTarget._id);
              }}
            >
              {deleteMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Delete program'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
