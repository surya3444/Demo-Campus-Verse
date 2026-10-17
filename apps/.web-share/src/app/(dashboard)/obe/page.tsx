'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BadgeCheck,
  Calculator,
  ClipboardEdit,
  Loader2,
  Plus,
  Search,
  Target,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { academicApi, obeApi } from '@/lib/api';
import { usePermissions } from '@/hooks/usePermissions';
import { cn, getErrorMessage } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { EditorialHeader } from '@/components/exams/EditorialHeader';
import { KpiStrip } from '@/components/exams/KpiStrip';
import { SectionPanel } from '@/components/exams/SectionPanel';
import { StatusBadge } from '@/components/exams/StatusBadge';
import type { OfferingSummary } from '@/components/obe/types';

interface BatchOption {
  _id: string;
  name: string;
  isCurrent?: boolean;
  terms?: Array<{ _id: string; name: string }>;
}

interface ProgramOption {
  _id: string;
  name: string;
  departmentCode: string;
}

interface SubjectOption {
  _id: string;
  name: string;
  code: string;
}

interface TreeSection {
  _id: string;
  name: string;
  subjects?: Array<{ subjectId: string }>;
}

interface TreeClass {
  _id: string;
  displayName?: string;
  sections?: TreeSection[];
}

const SURVEY_LABELS: Record<string, string> = {
  not_started: '—',
  open: 'Open',
  closed: 'Closed',
};

const ALL = 'all';

export default function ObeOfferingsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const canCreate = hasPermission('obe.offerings', 'create');

  // Filters
  const [batchId, setBatchId] = useState<string>(ALL);
  const [termId, setTermId] = useState<string>(ALL);
  const [programId, setProgramId] = useState<string>(ALL);
  const [status, setStatus] = useState<string>(ALL);
  const [mine, setMine] = useState(false);
  const [search, setSearch] = useState('');

  const { data: batchesData } = useQuery({
    queryKey: ['academic-batches'],
    queryFn: () => academicApi.getAcademicBatches(),
  });
  const batches: BatchOption[] = batchesData?.data ?? [];
  const selectedBatch = batches.find((b) => b._id === batchId);

  const { data: programsData } = useQuery({
    queryKey: ['obe-programs'],
    queryFn: () => obeApi.getPrograms(),
  });
  const programs: ProgramOption[] = programsData?.data ?? [];

  const filters = {
    ...(batchId !== ALL ? { academicBatchId: batchId } : {}),
    ...(termId !== ALL ? { termId } : {}),
    ...(programId !== ALL ? { programId } : {}),
    ...(status !== ALL ? { status } : {}),
    ...(mine ? { mine: true } : {}),
    ...(search.trim() ? { search: search.trim() } : {}),
    limit: 100,
  };
  const { data: offeringsData, isLoading } = useQuery({
    queryKey: ['obe-offerings', filters],
    queryFn: () => obeApi.getOfferings(filters),
  });
  const offerings: OfferingSummary[] = offeringsData?.data ?? [];
  const total: number = offeringsData?.meta?.total ?? offerings.length;

  const kpis = useMemo(() => {
    const byStatus = (s: string) => offerings.filter((o) => o.status === s).length;
    return [
      { label: 'Offerings', value: total, icon: Target, accent: true },
      { label: 'In data entry', value: byStatus('data_entry'), icon: ClipboardEdit },
      { label: 'Computed', value: byStatus('computed'), icon: Calculator },
      { label: 'Finalized', value: byStatus('finalized'), icon: BadgeCheck },
    ];
  }, [offerings, total]);

  return (
    <div className="space-y-8 pb-12">
      <EditorialHeader
        eyebrow="OBE Attainment"
        icon={Target}
        title="Course Offerings"
        description="Each offering is one course run — its assessment instruments, question-wise marks, and the CO/PO attainment they produce."
        actions={
          canCreate ? (
            <NewOfferingDialog
              batches={batches}
              programs={programs}
              onCreated={(id) => {
                queryClient.invalidateQueries({ queryKey: ['obe-offerings'] });
                router.push(`/obe/offerings/${id}`);
              }}
            />
          ) : undefined
        }
      />

      <KpiStrip loading={isLoading} items={kpis} ariaLabel="Offering stats" />

      <SectionPanel>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search subject…"
              className="w-48 pl-8"
            />
          </div>
          <Select
            value={batchId}
            onValueChange={(v) => {
              setBatchId(v);
              setTermId(ALL);
            }}
          >
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Session" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All sessions</SelectItem>
              {batches.map((b) => (
                <SelectItem key={b._id} value={b._id}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={termId} onValueChange={setTermId} disabled={batchId === ALL}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Term" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All terms</SelectItem>
              {(selectedBatch?.terms ?? []).map((t) => (
                <SelectItem key={t._id} value={t._id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={programId} onValueChange={setProgramId}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Program" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All programs</SelectItem>
              {programs.map((p) => (
                <SelectItem key={p._id} value={p._id}>
                  {p.departmentCode} · {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All statuses</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="data_entry">Data entry</SelectItem>
              <SelectItem value="computed">Computed</SelectItem>
              <SelectItem value="finalized">Finalized</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2">
            <Switch id="mine" checked={mine} onCheckedChange={setMine} />
            <Label htmlFor="mine" className="text-sm text-muted-foreground">
              My courses
            </Label>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 rounded-lg" />
            ))}
          </div>
        ) : offerings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 text-center">
            <Target className="mb-4 h-12 w-12 text-muted-foreground opacity-40" />
            <p className="text-lg font-medium">No offerings yet</p>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              Create one per course run to start capturing question-wise marks and computing CO/PO
              attainment.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Course</TableHead>
                  <TableHead>Term</TableHead>
                  <TableHead className="text-center">Semester</TableHead>
                  <TableHead className="text-center">Sections</TableHead>
                  <TableHead className="text-center">Cohort</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Survey</TableHead>
                  <TableHead>Computed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {offerings.map((offering) => (
                  <TableRow
                    key={offering._id}
                    className="cursor-pointer"
                    onClick={() => router.push(`/obe/offerings/${offering._id}`)}
                  >
                    <TableCell>
                      <div className="font-medium">{offering.subjectCode}</div>
                      <div className="max-w-56 truncate text-xs text-muted-foreground">
                        {offering.subjectName}
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{offering.termName}</TableCell>
                    <TableCell className="text-center">{offering.semesterNumber ?? '—'}</TableCell>
                    <TableCell className="text-center">{offering.sectionIds.length}</TableCell>
                    <TableCell className="text-center">
                      <span className="inline-flex items-center gap-1">
                        <Users className="h-3.5 w-3.5 text-muted-foreground" />
                        {offering.studentCount ?? '—'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={offering.status} />
                    </TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          'text-sm',
                          offering.survey.status === 'open'
                            ? 'font-medium text-emerald-600'
                            : 'text-muted-foreground'
                        )}
                      >
                        {SURVEY_LABELS[offering.survey.status] ?? offering.survey.status}
                      </span>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                      {offering.computedAt
                        ? new Date(offering.computedAt).toLocaleDateString()
                        : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </SectionPanel>
    </div>
  );
}

function NewOfferingDialog({
  batches,
  programs,
  onCreated,
}: {
  batches: BatchOption[];
  programs: ProgramOption[];
  onCreated: (offeringId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [programId, setProgramId] = useState('');
  const [batchId, setBatchId] = useState('');
  const [termId, setTermId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [subjectSearch, setSubjectSearch] = useState('');
  const [sectionIds, setSectionIds] = useState<string[]>([]);
  const [targetLevel, setTargetLevel] = useState('');
  const [touchedSections, setTouchedSections] = useState(false);

  const selectedBatch = batches.find((b) => b._id === batchId);

  const { data: subjectsData } = useQuery({
    queryKey: ['obe-subjects'],
    queryFn: () => academicApi.getSubjects({ status: 'active' }),
    enabled: open,
  });
  const subjects: SubjectOption[] = subjectsData?.data ?? [];
  const filteredSubjects = useMemo(() => {
    const q = subjectSearch.trim().toLowerCase();
    if (!q) return subjects;
    return subjects.filter(
      (s) => s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q)
    );
  }, [subjects, subjectSearch]);
  const selectedSubject = subjects.find((s) => s._id === subjectId);

  const { data: treeData, isLoading: treeLoading } = useQuery({
    queryKey: ['obe-class-tree', batchId],
    queryFn: () => academicApi.getClassTree(batchId),
    enabled: open && !!batchId,
  });
  // The tree endpoint wraps its payload: { data: { classes: [...] } }.
  const classes: TreeClass[] = treeData?.data?.classes ?? [];

  // Sections that already teach the chosen subject, for preselection.
  const taughtSectionIds = useMemo(() => {
    if (!subjectId) return new Set<string>();
    const ids = new Set<string>();
    for (const cls of classes) {
      for (const section of cls.sections ?? []) {
        if ((section.subjects ?? []).some((s) => s.subjectId === subjectId)) {
          ids.add(section._id);
        }
      }
    }
    return ids;
  }, [classes, subjectId]);

  // Until the user touches the pick list, follow the subject's own sections.
  const effectiveSectionIds = touchedSections ? sectionIds : Array.from(taughtSectionIds);

  const createMutation = useMutation({
    mutationFn: () =>
      obeApi.createOffering({
        programId,
        subjectId,
        academicBatchId: batchId,
        termId,
        sectionIds: effectiveSectionIds,
        ...(targetLevel.trim() ? { targetLevel: Number(targetLevel) } : {}),
      }),
    onSuccess: (response) => {
      toast.success('Offering created');
      setOpen(false);
      onCreated(response.data._id as string);
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const reset = () => {
    setProgramId('');
    setBatchId('');
    setTermId('');
    setSubjectId('');
    setSubjectSearch('');
    setSectionIds([]);
    setTargetLevel('');
    setTouchedSections(false);
  };

  const canSubmit = programId && batchId && termId && subjectId && effectiveSectionIds.length > 0;

  return (
    <>
      <Button className="gap-2" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" />
        New offering
      </Button>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) reset();
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>New course offering</DialogTitle>
            <DialogDescription>
              One offering per course run — pick the program, the course, and the term it runs in.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Program</Label>
                <Select value={programId} onValueChange={setProgramId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select program" />
                  </SelectTrigger>
                  <SelectContent>
                    {programs.map((p) => (
                      <SelectItem key={p._id} value={p._id}>
                        {p.departmentCode} · {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Target level (optional)</Label>
                <Input
                  type="number"
                  min={0}
                  max={3}
                  step={0.5}
                  value={targetLevel}
                  onChange={(e) => setTargetLevel(e.target.value)}
                  placeholder="Branch default"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Academic session</Label>
                <Select
                  value={batchId}
                  onValueChange={(v) => {
                    setBatchId(v);
                    setTermId('');
                    setSectionIds([]);
                    setTouchedSections(false);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select session" />
                  </SelectTrigger>
                  <SelectContent>
                    {batches.map((b) => (
                      <SelectItem key={b._id} value={b._id}>
                        {b.name}
                        {b.isCurrent ? ' (current)' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Term / semester</Label>
                <Select value={termId} onValueChange={setTermId} disabled={!selectedBatch}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select term" />
                  </SelectTrigger>
                  <SelectContent>
                    {(selectedBatch?.terms ?? []).map((t) => (
                      <SelectItem key={t._id} value={t._id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Course (subject)</Label>
              {selectedSubject ? (
                <div className="flex items-center justify-between rounded-lg border px-3 py-2">
                  <div className="text-sm">
                    <span className="font-medium">{selectedSubject.code}</span>{' '}
                    <span className="text-muted-foreground">{selectedSubject.name}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSubjectId('');
                      setTouchedSections(false);
                      setSectionIds([]);
                    }}
                  >
                    Change
                  </Button>
                </div>
              ) : (
                <div className="rounded-lg border">
                  <div className="border-b p-2">
                    <Input
                      value={subjectSearch}
                      onChange={(e) => setSubjectSearch(e.target.value)}
                      placeholder="Search by code or name…"
                      className="h-8"
                    />
                  </div>
                  <div className="max-h-44 overflow-y-auto p-1">
                    {filteredSubjects.length === 0 ? (
                      <p className="px-2 py-3 text-sm text-muted-foreground">No subjects match</p>
                    ) : (
                      filteredSubjects.slice(0, 50).map((s) => (
                        <button
                          key={s._id}
                          type="button"
                          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
                          onClick={() => setSubjectId(s._id)}
                        >
                          <span className="font-medium">{s.code}</span>
                          <span className="truncate text-muted-foreground">{s.name}</span>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {batchId && subjectId && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label>Sections in this cohort</Label>
                  {taughtSectionIds.size > 0 && !touchedSections && (
                    <Badge variant="outline" className="text-xs">
                      Preselected from subject assignments
                    </Badge>
                  )}
                </div>
                {treeLoading ? (
                  <Skeleton className="h-24 rounded-lg" />
                ) : classes.length === 0 ? (
                  <p className="rounded-lg border px-3 py-2 text-sm text-muted-foreground">
                    No classes found for this session.
                  </p>
                ) : (
                  <div className="max-h-52 space-y-2 overflow-y-auto rounded-lg border p-3">
                    {classes.map((cls) => (
                      <div key={cls._id}>
                        <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          {cls.displayName ?? 'Class'}
                        </p>
                        <div className="flex flex-wrap gap-x-5 gap-y-1.5">
                          {(cls.sections ?? []).map((section) => {
                            const checked = effectiveSectionIds.includes(section._id);
                            return (
                              <label
                                key={section._id}
                                className="flex cursor-pointer items-center gap-2 text-sm"
                              >
                                <Checkbox
                                  checked={checked}
                                  onCheckedChange={(next) => {
                                    const base = touchedSections
                                      ? sectionIds
                                      : Array.from(taughtSectionIds);
                                    setTouchedSections(true);
                                    setSectionIds(
                                      next
                                        ? [...base, section._id]
                                        : base.filter((id) => id !== section._id)
                                    );
                                  }}
                                />
                                {section.name}
                                {taughtSectionIds.has(section._id) && (
                                  <span className="text-xs text-muted-foreground">· teaches</span>
                                )}
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!canSubmit || createMutation.isPending}
              onClick={() => createMutation.mutate()}
              className="gap-2"
            >
              {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Create offering
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
