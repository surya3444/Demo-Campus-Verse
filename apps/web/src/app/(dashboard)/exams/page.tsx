'use client';

import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import {
  ArrowRightLeft,
  Calendar,
  CheckCircle2,
  ClipboardList,
  Clock,
  Filter,
  Loader2,
  Plus,
  ScrollText,
  Send,
  Settings,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { examsApi, academicApi } from '@/lib/api';
import { usePermissions } from '@/hooks/usePermissions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { DatePicker } from '@/components/ui/date-picker';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { EXAM_TYPES, EXAM_TYPE_LABELS, type ExamType } from '@campus-verse/shared/constants';
import { EditorialHeader } from '@/components/exams/EditorialHeader';
import { SectionPanel } from '@/components/exams/SectionPanel';
import { KpiStrip, type KpiItem } from '@/components/exams/KpiStrip';
import { Field } from '@/components/exams/Field';
import { StatusBadge } from '@/components/exams/StatusBadge';

interface PaperInput {
  subjectId: string;
  totalMarks: number;
  passMarks: number;
}

interface ExamFormState {
  academicBatchId: string;
  /** Semester on the selected academic session; falls back to free text when
   *  the session has no semesters configured (schools). */
  termId: string;
  termName: string;
  name: string;
  type: ExamType;
  classIds: string[];
  papers: PaperInput[];
  startDate: string;
  endDate: string;
  instructions: string;
}

interface Exam {
  _id: string;
  name: string;
  termName: string;
  type: ExamType;
  classIds: string[];
  papers: Array<{ _id: string }>;
  status: string;
  startDate?: string;
  endDate?: string;
}

const blankForm: ExamFormState = {
  academicBatchId: '',
  termId: '',
  termName: 'Term 1',
  name: '',
  type: 'mid_term',
  classIds: [],
  papers: [],
  startDate: '',
  endDate: '',
  instructions: '',
};

export default function ExamsListPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const { hasPermission } = usePermissions();
  const canCreate = hasPermission('exams.exams', 'create');
  const canDelete = hasPermission('exams.exams', 'delete');
  const [form, setForm] = useState<ExamFormState>(blankForm);

  const examsQuery = useQuery({
    queryKey: ['exams', { status: statusFilter }],
    queryFn: () => examsApi.listExams(statusFilter === 'all' ? {} : { status: statusFilter }),
  });

  const batchesQuery = useQuery({
    queryKey: ['academic-batches'],
    queryFn: () => academicApi.getAcademicBatches(),
  });

  const classesQuery = useQuery({
    queryKey: ['classes', form.academicBatchId],
    queryFn: () =>
      form.academicBatchId
        ? academicApi.getClasses({ academicBatchId: form.academicBatchId })
        : Promise.resolve({ data: [] }),
    enabled: !!form.academicBatchId,
  });

  const subjectsQuery = useQuery({
    queryKey: ['subjects'],
    queryFn: () => academicApi.getSubjects(),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      examsApi.createExam({
        academicBatchId: form.academicBatchId,
        ...(form.termId ? { termId: form.termId } : { termName: form.termName }),
        name: form.name,
        type: form.type,
        classIds: form.classIds,
        papers: form.papers,
        startDate: form.startDate || undefined,
        endDate: form.endDate || undefined,
        instructions: form.instructions || undefined,
      }),
    onSuccess: () => {
      toast.success('Exam created');
      queryClient.invalidateQueries({ queryKey: ['exams'] });
      setShowCreate(false);
      setForm(blankForm);
    },
    onError: (err: Error & { response?: { data?: { error?: { message?: string } } } }) => {
      toast.error(err.response?.data?.error?.message || 'Failed to create exam');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => examsApi.deleteExam(id),
    onSuccess: () => {
      toast.success('Exam deleted');
      queryClient.invalidateQueries({ queryKey: ['exams'] });
    },
    onError: (err: Error & { response?: { data?: { error?: { message?: string } } } }) => {
      toast.error(err.response?.data?.error?.message || 'Failed to delete');
    },
  });

  const exams = (examsQuery.data?.data as Exam[]) || [];
  const batches = (batchesQuery.data?.data as Array<Record<string, unknown>>) || [];
  const classes = (classesQuery.data?.data as Array<Record<string, unknown>>) || [];
  const subjects = (subjectsQuery.data?.data as Array<Record<string, unknown>>) || [];

  // Semesters of the session picked in the form — drives the term selector.
  const selectedBatchTerms =
    (batches.find((b) => String(b._id) === form.academicBatchId)?.terms as
      | Array<{ _id: string; name: string }>
      | undefined) ?? [];

  const filteredExams = useMemo(() => {
    if (!search.trim()) return exams;
    const q = search.toLowerCase();
    return exams.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        e.termName.toLowerCase().includes(q) ||
        e.type.toLowerCase().includes(q)
    );
  }, [exams, search]);

  const kpis = useMemo<KpiItem[]>(() => {
    const total = exams.length;
    const drafts = exams.filter((e) => e.status === 'draft').length;
    const live = exams.filter((e) => e.status === 'scheduled' || e.status === 'ongoing').length;
    const published = exams.filter((e) => e.status === 'results_published').length;
    return [
      {
        label: 'Total exams',
        value: total.toLocaleString(),
        icon: ScrollText,
        footnote: <span className="text-muted-foreground">All time</span>,
      },
      {
        label: 'Drafts',
        value: drafts.toLocaleString(),
        icon: ClipboardList,
        footnote: <span className="text-muted-foreground">Not scheduled yet</span>,
      },
      {
        label: 'In progress',
        value: live.toLocaleString(),
        icon: Clock,
        accent: live > 0,
        footnote: <span className="text-muted-foreground">Scheduled or ongoing</span>,
      },
      {
        label: 'Results published',
        value: published.toLocaleString(),
        icon: CheckCircle2,
        footnote: <span className="text-muted-foreground">Closed cycles</span>,
      },
    ];
  }, [exams]);

  const addPaper = () =>
    setForm((f) => ({
      ...f,
      papers: [...f.papers, { subjectId: '', totalMarks: 100, passMarks: 33 }],
    }));

  const updatePaper = (idx: number, patch: Partial<PaperInput>) =>
    setForm((f) => ({
      ...f,
      papers: f.papers.map((p, i) => (i === idx ? { ...p, ...patch } : p)),
    }));

  const removePaper = (idx: number) =>
    setForm((f) => ({ ...f, papers: f.papers.filter((_, i) => i !== idx) }));

  const toggleClass = (classId: string) =>
    setForm((f) => ({
      ...f,
      classIds: f.classIds.includes(classId)
        ? f.classIds.filter((c) => c !== classId)
        : [...f.classIds, classId],
    }));

  const canSubmit =
    form.academicBatchId &&
    (form.termId || form.termName) &&
    form.name &&
    form.classIds.length > 0 &&
    form.papers.length > 0 &&
    form.papers.every((p) => p.subjectId && p.totalMarks > 0);

  return (
    <div className="space-y-8 pb-12">
      <EditorialHeader
        eyebrow="Examinations"
        meta="/exams"
        icon={ScrollText}
        title="Exam pipeline"
        description="Build term-scoped exams, schedule papers per section, enter marks, and publish results — all from one place."
        actions={
          <>
            {hasPermission('exams.promotion', 'view') && (
              <Link href="/exams/promotion">
                <Button variant="outline" className="gap-2">
                  <ArrowRightLeft className="h-4 w-4" />
                  Promotion
                </Button>
              </Link>
            )}
            {hasPermission('exams.config', 'view') && (
              <Link href="/exams/settings">
                <Button variant="outline" className="gap-2">
                  <Settings className="h-4 w-4" />
                  Settings
                </Button>
              </Link>
            )}
            {canCreate && (
              <Button className="gap-2" onClick={() => setShowCreate(true)}>
                <Plus className="h-4 w-4" />
                New exam
              </Button>
            )}
          </>
        }
      />

      <KpiStrip ariaLabel="Exam stats" items={kpis} loading={examsQuery.isLoading} />

      <SectionPanel
        eyebrow="All exams"
        title={
          <span className="flex items-baseline gap-3">
            <span>{filteredExams.length} on file</span>
            {search && (
              <span className="text-sm font-normal text-muted-foreground">matching “{search}”</span>
            )}
          </span>
        }
        description="Click an exam to schedule papers, enter marks, generate report cards, and publish results."
        action={
          <div className="flex items-center gap-2">
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, term, type"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 h-9 w-[240px]"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px] h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="scheduled">Scheduled</SelectItem>
                <SelectItem value="ongoing">Ongoing</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="results_published">Results published</SelectItem>
              </SelectContent>
            </Select>
          </div>
        }
        flush
      >
        {examsQuery.isLoading ? (
          <div className="p-7 space-y-3">
            <Skeleton className="h-14 w-full rounded-xl" />
            <Skeleton className="h-14 w-full rounded-xl" />
            <Skeleton className="h-14 w-full rounded-xl" />
          </div>
        ) : filteredExams.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="h-12 w-12 rounded-full bg-gradient-to-br from-primary/15 to-primary/5 flex items-center justify-center mb-3">
              <ScrollText className="h-6 w-6 text-primary" />
            </div>
            <h3 className="font-display text-lg font-semibold">
              {search ? 'No exams match' : 'No exams yet'}
            </h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm">
              {search
                ? 'Try a different keyword or clear the filter.'
                : 'Create your first exam to start scheduling papers and recording marks.'}
            </p>
            {!search && (
              <Button className="mt-5 gap-2" onClick={() => setShowCreate(true)}>
                <Plus className="h-4 w-4" />
                Create exam
              </Button>
            )}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Exam</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-center">Papers</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Window</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredExams.map((exam) => (
                <TableRow key={exam._id} className="group">
                  <TableCell>
                    <Link
                      href={`/exams/${exam._id}`}
                      className="font-medium hover:text-primary transition-colors"
                    >
                      {exam.name}
                    </Link>
                    <p className="text-xs text-muted-foreground mt-0.5">{exam.termName}</p>
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1.5 rounded-md border bg-muted/40 px-2 py-0.5 text-xs">
                      <Sparkles className="h-3 w-3 text-muted-foreground" />
                      {EXAM_TYPE_LABELS[exam.type] || exam.type}
                    </span>
                  </TableCell>
                  <TableCell className="text-center tabular-nums">{exam.papers.length}</TableCell>
                  <TableCell>
                    <StatusBadge status={exam.status} />
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {exam.startDate
                      ? new Date(exam.startDate).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                        })
                      : '—'}
                    {exam.endDate && (
                      <>
                        {' → '}
                        {new Date(exam.endDate).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                        })}
                      </>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Link href={`/exams/${exam._id}`}>
                        <Button variant="ghost" size="sm" className="gap-1">
                          <Calendar className="h-3.5 w-3.5" /> Open
                        </Button>
                      </Link>
                      {canDelete && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => {
                            if (confirm(`Delete "${exam.name}"?`)) {
                              deleteMutation.mutate(exam._id);
                            }
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-rose-500" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </SectionPanel>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl font-bold tracking-tight">
              Create new exam
            </DialogTitle>
            <DialogDescription>
              Pick the term, classes covered, and papers (one per subject) to get started.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
            <Field label="Academic batch" required>
              <Select
                value={form.academicBatchId}
                onValueChange={(v) => setForm((f) => ({ ...f, academicBatchId: v, classIds: [] }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select academic year" />
                </SelectTrigger>
                <SelectContent>
                  {batches.map((b) => (
                    <SelectItem key={b._id as string} value={b._id as string}>
                      {b.name as string}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            {/* Semester picker when the session has semesters; free text
                otherwise (schools that only use named terms). */}
            {selectedBatchTerms.length > 0 ? (
              <Field label="Semester" required>
                <Select
                  value={form.termId}
                  onValueChange={(v) => setForm((f) => ({ ...f, termId: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select semester" />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedBatchTerms.map((t) => (
                      <SelectItem key={t._id} value={t._id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            ) : (
              <Field label="Term name" required>
                <Input
                  placeholder="Term 1"
                  value={form.termName}
                  onChange={(e) => setForm((f) => ({ ...f, termName: e.target.value }))}
                />
              </Field>
            )}

            <div className="md:col-span-2">
              <Field label="Exam name" required>
                <Input
                  placeholder="e.g. Mid-Term Examination"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                />
              </Field>
            </div>

            <Field label="Type" required>
              <Select
                value={form.type}
                onValueChange={(v) => setForm((f) => ({ ...f, type: v as ExamType }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXAM_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {EXAM_TYPE_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Start date">
                <DatePicker
                  value={form.startDate}
                  onChange={(iso) => setForm((f) => ({ ...f, startDate: iso }))}
                />
              </Field>
              <Field label="End date">
                <DatePicker
                  value={form.endDate}
                  onChange={(iso) => setForm((f) => ({ ...f, endDate: iso }))}
                />
              </Field>
            </div>
          </div>

          <div className="space-y-2 pt-4 border-t mt-4">
            <Field
              label="Classes"
              hint="Choose every class this exam covers. You'll schedule papers per section later."
              required
            >
              {form.academicBatchId ? (
                classes.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">No classes in this batch.</p>
                ) : (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {classes.map((c) => {
                      const active = form.classIds.includes(c._id as string);
                      return (
                        <button
                          key={c._id as string}
                          type="button"
                          onClick={() => toggleClass(c._id as string)}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                            active
                              ? 'bg-primary text-primary-foreground border-primary shadow-soft'
                              : 'bg-background hover:border-primary/40 hover:text-primary'
                          }`}
                        >
                          {(c.displayName as string) || (c.name as string)}
                        </button>
                      );
                    })}
                  </div>
                )
              ) : (
                <p className="text-sm text-muted-foreground italic">Pick a batch first.</p>
              )}
            </Field>
          </div>

          <div className="space-y-2 pt-4 border-t mt-4">
            <div className="flex items-center justify-between">
              <Field label="Papers" required>
                <span className="sr-only">Papers list</span>
              </Field>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={addPaper}
                className="gap-1"
              >
                <Plus className="h-3 w-3" />
                Add paper
              </Button>
            </div>
            {form.papers.length === 0 ? (
              <p className="text-xs text-muted-foreground italic px-3 py-4 border border-dashed rounded-xl text-center">
                Add at least one paper (subject + marks).
              </p>
            ) : (
              <div className="space-y-2">
                {form.papers.map((p, i) => (
                  <div
                    key={i}
                    className="grid grid-cols-12 gap-2 items-end p-3 rounded-xl border bg-muted/30"
                  >
                    <div className="col-span-6">
                      <Field label="Subject">
                        <Select
                          value={p.subjectId}
                          onValueChange={(v) => updatePaper(i, { subjectId: v })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select subject" />
                          </SelectTrigger>
                          <SelectContent>
                            {subjects.map((s) => (
                              <SelectItem key={s._id as string} value={s._id as string}>
                                {s.name as string}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Field>
                    </div>
                    <div className="col-span-2">
                      <Field label="Total">
                        <Input
                          type="number"
                          value={p.totalMarks}
                          onChange={(e) =>
                            updatePaper(i, { totalMarks: parseInt(e.target.value) || 0 })
                          }
                        />
                      </Field>
                    </div>
                    <div className="col-span-2">
                      <Field label="Pass">
                        <Input
                          type="number"
                          value={p.passMarks}
                          onChange={(e) =>
                            updatePaper(i, { passMarks: parseInt(e.target.value) || 0 })
                          }
                        />
                      </Field>
                    </div>
                    <div className="col-span-2 flex justify-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removePaper(i)}
                      >
                        <Trash2 className="h-4 w-4 text-rose-500" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter className="border-t pt-4 mt-4">
            <Button variant="outline" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={!canSubmit || createMutation.isPending}
              className="gap-2"
            >
              {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              <Send className="h-4 w-4" />
              Create exam
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
