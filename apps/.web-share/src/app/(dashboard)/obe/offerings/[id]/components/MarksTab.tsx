'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  ClipboardList,
  FileUp,
  Loader2,
  Lock,
  Save,
} from 'lucide-react';
import { toast } from 'sonner';
import { obeApi, type ObeMarkRowPayload } from '@/lib/api';
import { usePermissions } from '@/hooks/usePermissions';
import { cn, getErrorMessage } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { SectionPanel } from '@/components/exams/SectionPanel';
import type {
  Instrument,
  InstrumentSet,
  MarksGrid,
  MarksGridRow,
  MarksImportReport,
  OfferingDetail,
  OutcomeDocCo,
} from '@/components/obe/types';

/**
 * One editable row. `marks` holds raw input strings so a blank cell ("not
 * attempted") stays distinguishable from a typed "0" ("attempted, scored 0").
 */
interface EditRow {
  studentId: string;
  name: string;
  admissionNumber?: string;
  rollNumber?: string;
  setId: string | null;
  absent: boolean;
  marks: Record<string, string>;
}

function toEditRow(row: MarksGridRow): EditRow {
  return {
    studentId: row.studentId,
    name: row.name,
    admissionNumber: row.admissionNumber,
    rollNumber: row.rollNumber,
    setId: row.setId,
    absent: row.absent,
    marks: Object.fromEntries(Object.entries(row.marks).map(([id, v]) => [id, String(v)])),
  };
}

/** A cell counts only when it holds a parseable number — "" stays untouched. */
function enteredValues(row: EditRow, items: InstrumentSet['items']): number[] {
  const values: number[] = [];
  for (const item of items) {
    const raw = row.marks[item._id];
    if (raw == null || raw.trim() === '') continue;
    const value = Number(raw);
    if (Number.isFinite(value)) values.push(value);
  }
  return values;
}

function rowTotal(values: number[], bestOfCount?: number | null): number {
  const sorted = [...values].sort((a, b) => b - a);
  const counted =
    typeof bestOfCount === 'number' && bestOfCount > 0 ? sorted.slice(0, bestOfCount) : sorted;
  return counted.reduce((sum, v) => sum + v, 0);
}

export function MarksTab({ offering }: { offering: OfferingDetail }) {
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const finalized = offering.status === 'finalized';
  const canEdit = hasPermission('obe.marks', 'edit') && !finalized;
  const canImport = hasPermission('obe.marks', 'import') && !finalized;

  const instruments = offering.instruments;
  const [instrumentId, setInstrumentId] = useState(
    () => instruments.find((i) => i.kind === 'internal')?._id ?? instruments[0]?._id ?? ''
  );

  // Sibling tabs can add or remove instruments underneath us.
  useEffect(() => {
    if (instruments.some((i) => i._id === instrumentId)) return;
    setInstrumentId(
      instruments.find((i) => i.kind === 'internal')?._id ?? instruments[0]?._id ?? ''
    );
  }, [instruments, instrumentId]);

  const instrument: Instrument | undefined = instruments.find((i) => i._id === instrumentId);
  const isInternal = instrument?.kind === 'internal';

  const marksKey = ['obe-marks', offering._id, instrumentId];
  const marksQuery = useQuery({
    queryKey: marksKey,
    queryFn: () => obeApi.getMarksGrid(offering._id, instrumentId),
    enabled: !!instrumentId && isInternal,
  });

  const outcomesQuery = useQuery({
    queryKey: ['obe-outcomes', offering.subjectId, offering.programId],
    queryFn: () => obeApi.getOutcomes(offering.subjectId, offering.programId),
  });

  const coCodeById = useMemo(() => {
    const cos: OutcomeDocCo[] = outcomesQuery.data?.data?.cos ?? [];
    return new Map(cos.map((co) => [co._id, co.code]));
  }, [outcomesQuery.data]);

  const grid = marksQuery.data?.data as MarksGrid | undefined;
  const sets = useMemo<InstrumentSet[]>(() => grid?.instrument.sets ?? [], [grid]);
  const setById = useMemo(() => new Map(sets.map((s) => [s._id, s])), [sets]);
  const multiSet = sets.length > 1;
  const bestOfCount = grid?.instrument.bestOfCount;

  /** Columns are sized to the widest set; short sets get inert cells. */
  const columns = useMemo(
    () =>
      sets.reduce<InstrumentSet['items']>(
        (widest, s) => (s.items.length > widest.length ? s.items : widest),
        []
      ),
    [sets]
  );

  const [rows, setRows] = useState<EditRow[]>([]);
  const [baseline, setBaseline] = useState('');
  /** Students who already have a saved row — they must be re-sent even when cleared. */
  const [savedStudents, setSavedStudents] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!grid) {
      setRows([]);
      setBaseline('');
      setSavedStudents(new Set());
      return;
    }
    const next = grid.rows.map(toEditRow);
    setRows(next);
    setBaseline(JSON.stringify(next));
    setSavedStudents(
      new Set(
        grid.rows
          .filter((r) => r.absent || r.setId != null || Object.keys(r.marks).length > 0)
          .map((r) => r.studentId)
      )
    );
  }, [grid]);

  const dirty = !!baseline && JSON.stringify(rows) !== baseline;

  const updateRow = (idx: number, patch: Partial<EditRow>) =>
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));

  const setMark = (idx: number, itemId: string, value: string) =>
    setRows((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, marks: { ...r.marks, [itemId]: value } } : r))
    );

  const itemsForRow = (row: EditRow) => {
    const id = row.setId ?? (sets.length === 1 ? sets[0]._id : null);
    return id ? (setById.get(id)?.items ?? []) : [];
  };

  const buildPayload = (): ObeMarkRowPayload[] => {
    const payload: ObeMarkRowPayload[] = [];
    for (const row of rows) {
      const setId = row.setId ?? (sets.length === 1 ? sets[0]._id : undefined);
      const items = setId ? (setById.get(setId)?.items ?? []) : [];
      const marks = row.absent
        ? []
        : items.flatMap((item) => {
            const raw = row.marks[item._id];
            // Blank = not attempted, so it never reaches the payload. "0" does.
            if (raw == null || raw.trim() === '') return [];
            const value = Number(raw);
            return Number.isFinite(value) ? [{ itemId: item._id, marksObtained: value }] : [];
          });
      const meaningful = row.absent || marks.length > 0;
      if (!meaningful && !savedStudents.has(row.studentId)) continue;
      if (!setId) continue; // multi-set row with nothing chosen yet
      payload.push({ studentId: row.studentId, setId, absent: row.absent, marks });
    }
    return payload;
  };

  const saveMutation = useMutation({
    mutationFn: () => obeApi.saveMarks(offering._id, instrumentId, buildPayload()),
    onSuccess: (res) => {
      const saved = (res?.data as { saved?: number } | undefined)?.saved ?? 0;
      toast.success(`Saved ${saved} row(s)`);
      setBaseline(JSON.stringify(rows));
      queryClient.invalidateQueries({ queryKey: marksKey });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const stats = {
    total: rows.length,
    entered: rows.filter((r) => r.absent || enteredValues(r, itemsForRow(r)).length > 0).length,
    absent: rows.filter((r) => r.absent).length,
  };

  // ---------------------------------------------------------------- rendering

  if (instruments.length === 0) {
    return (
      <SectionPanel>
        <div className="flex flex-col items-center justify-center py-14 text-center">
          <ClipboardList className="mb-4 h-12 w-12 text-muted-foreground opacity-40" />
          <p className="text-lg font-medium">No assessment instruments yet</p>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            Add internal instruments (with their question sets) or link an exam paper from the
            Overview tab — marks entry opens as soon as one exists.
          </p>
        </div>
      </SectionPanel>
    );
  }

  return (
    <div className="space-y-6">
      <SectionPanel
        eyebrow="Instrument"
        title="Pick what you're entering"
        description="Internal instruments are marked here question by question. External instruments read their marks straight from the exams module."
      >
        <div className="flex flex-wrap gap-2">
          {instruments.map((inst) => {
            const active = inst._id === instrumentId;
            return (
              <button
                key={inst._id}
                type="button"
                onClick={() => setInstrumentId(inst._id)}
                className={cn(
                  'flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm transition-colors',
                  active ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-muted/60'
                )}
              >
                {inst.name}
                <span
                  className={cn(
                    'text-[10px] font-semibold uppercase tracking-[0.18em]',
                    active ? 'opacity-75' : 'text-muted-foreground'
                  )}
                >
                  {inst.kind}
                </span>
              </button>
            );
          })}
        </div>
      </SectionPanel>

      {instrument && !isInternal ? (
        <ExternalInstrumentCard instrument={instrument} />
      ) : (
        <SectionPanel
          eyebrow={instrument?.name ?? 'Marks'}
          title="Marks entry"
          description={
            <>
              One row per student. Leave a cell <strong>blank</strong> when the question was not
              attempted — a typed <strong>0</strong> records an attempt that scored nothing, and
              blanks are never saved as zero. Press Enter to drop to the next student in the same
              column.
            </>
          }
          action={
            <div className="flex items-center gap-2">
              {canImport && (
                <ImportDialog
                  offeringId={offering._id}
                  instrumentId={instrumentId}
                  columns={columns}
                  multiSet={multiSet}
                  onImported={() => queryClient.invalidateQueries({ queryKey: marksKey })}
                />
              )}
              {canEdit && (
                <Button
                  size="sm"
                  className="gap-2"
                  disabled={!dirty || saveMutation.isPending}
                  onClick={() => saveMutation.mutate()}
                >
                  {saveMutation.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Save className="h-3.5 w-3.5" />
                  )}
                  Save
                </Button>
              )}
            </div>
          }
          flush
        >
          <div className="flex flex-wrap items-center gap-2 border-b px-7 py-3 text-xs text-muted-foreground">
            <Badge variant="outline" className="font-normal">
              Roster {stats.total}
            </Badge>
            <Badge variant="outline" className="font-normal">
              Entered {stats.entered}
            </Badge>
            <Badge variant="outline" className="font-normal">
              Absent {stats.absent}
            </Badge>
            {typeof bestOfCount === 'number' && bestOfCount > 0 && (
              <Badge variant="outline" className="font-normal">
                Best of {bestOfCount}
              </Badge>
            )}
            {finalized && (
              <span className="flex items-center gap-1.5 text-amber-600">
                <Lock className="h-3.5 w-3.5" />
                Finalized — reopen the offering to edit marks
              </span>
            )}
            {!finalized && !canEdit && (
              <span>Read-only — you can view marks but not change them.</span>
            )}
          </div>

          {marksQuery.isLoading ? (
            <div className="space-y-3 p-7">
              <Skeleton className="h-12 w-full rounded-xl" />
              <Skeleton className="h-12 w-full rounded-xl" />
              <Skeleton className="h-12 w-full rounded-xl" />
            </div>
          ) : marksQuery.isError ? (
            <p className="p-12 text-center text-sm text-muted-foreground">
              {getErrorMessage(marksQuery.error)}
            </p>
          ) : columns.length === 0 ? (
            <p className="p-12 text-center italic text-muted-foreground">
              This instrument has no question items yet. Add a set with questions on the Overview
              tab.
            </p>
          ) : rows.length === 0 ? (
            <p className="p-12 text-center italic text-muted-foreground">
              No students in this offering&apos;s cohort.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 z-10 min-w-[220px] bg-card">
                      Student
                    </TableHead>
                    {multiSet && <TableHead className="w-[130px]">Set</TableHead>}
                    {columns.map((item) => {
                      const codes = item.coIds
                        .map((id) => coCodeById.get(id))
                        .filter(Boolean)
                        .join(',');
                      return (
                        <TableHead key={item._id} className="w-[110px] text-center">
                          <span className="font-semibold text-foreground">{item.label}</span>
                          {codes && (
                            <span className="ml-1 text-[10px] text-muted-foreground">
                              · {codes}
                            </span>
                          )}
                          <span className="ml-1 text-[10px] tabular-nums text-muted-foreground">
                            · /{item.maxMarks}
                          </span>
                        </TableHead>
                      );
                    })}
                    <TableHead className="w-[80px] text-center">Absent</TableHead>
                    <TableHead className="w-[90px] text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row, i) => {
                    const items = itemsForRow(row);
                    const values = enteredValues(row, items);
                    const total = values.length ? rowTotal(values, bestOfCount) : null;
                    return (
                      <TableRow key={row.studentId}>
                        <TableCell className="sticky left-0 z-10 bg-card">
                          <p className="font-medium leading-tight">{row.name}</p>
                          <p className="font-mono text-[11px] text-muted-foreground">
                            {row.admissionNumber || row.rollNumber || '—'}
                          </p>
                        </TableCell>

                        {multiSet && (
                          <TableCell className="py-2">
                            <Select
                              value={row.setId ?? ''}
                              disabled={!canEdit}
                              // A different set means different items — old marks can't carry over.
                              onValueChange={(v) => updateRow(i, { setId: v, marks: {} })}
                            >
                              <SelectTrigger className="h-9">
                                <SelectValue placeholder="Set" />
                              </SelectTrigger>
                              <SelectContent>
                                {sets.map((s) => (
                                  <SelectItem key={s._id} value={s._id}>
                                    {s.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                        )}

                        {columns.map((column, c) => {
                          const item = items[c];
                          if (!item) {
                            return (
                              <TableCell key={column._id} className="py-2">
                                <div
                                  aria-hidden
                                  className="h-9 rounded-md bg-muted/50"
                                  title="This set has no question here"
                                />
                              </TableCell>
                            );
                          }
                          return (
                            <TableCell key={item._id} className="py-2">
                              <Input
                                type="number"
                                min={0}
                                max={item.maxMarks}
                                step="any"
                                inputMode="decimal"
                                aria-label={`${row.name} · ${item.label}`}
                                className={cn(
                                  'h-9 text-center tabular-nums',
                                  row.absent && 'opacity-40'
                                )}
                                disabled={!canEdit || row.absent}
                                value={row.marks[item._id] ?? ''}
                                onChange={(e) => setMark(i, item._id, e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key !== 'Enter') return;
                                  e.preventDefault();
                                  const next = document.querySelector<HTMLInputElement>(
                                    `input[data-row-idx="${i + 1}"][data-col-idx="${c}"]`
                                  );
                                  next?.focus();
                                  next?.select();
                                }}
                                data-row-idx={i}
                                data-col-idx={c}
                              />
                            </TableCell>
                          );
                        })}

                        <TableCell className="text-center">
                          <Checkbox
                            aria-label={`${row.name} absent`}
                            checked={row.absent}
                            disabled={!canEdit}
                            onCheckedChange={(checked) =>
                              updateRow(i, { absent: Boolean(checked) })
                            }
                          />
                        </TableCell>

                        <TableCell className="text-right text-sm font-medium tabular-nums">
                          {row.absent ? (
                            <span className="text-muted-foreground">AB</span>
                          ) : total == null ? (
                            <span className="text-muted-foreground">—</span>
                          ) : (
                            total
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </SectionPanel>
      )}

      {canEdit && dirty && (
        <div className="fixed bottom-6 left-1/2 z-30 flex -translate-x-1/2 items-center gap-3 rounded-xl border bg-card px-4 py-2.5 shadow-soft-lg">
          <span className="h-2 w-2 animate-pulse rounded-full bg-amber-500" />
          <span className="text-sm">Unsaved changes</span>
          <Button
            size="sm"
            className="gap-2"
            disabled={saveMutation.isPending}
            onClick={() => saveMutation.mutate()}
          >
            {saveMutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            Save
          </Button>
        </div>
      )}
    </div>
  );
}

function ExternalInstrumentCard({ instrument }: { instrument: Instrument }) {
  return (
    <SectionPanel eyebrow={instrument.name} title="Marks come from the Exams module">
      <div className="space-y-4">
        <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
          This is an external instrument — its marks are entered against the linked exam paper and
          pulled in when attainment is computed. There is no OBE grid to fill here.
        </p>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Badge variant="outline" className="font-normal">
            {instrument.examName || 'Linked exam'}
          </Badge>
          {typeof instrument.totalMarks === 'number' && (
            <Badge variant="outline" className="font-normal tabular-nums">
              Total {instrument.totalMarks}
            </Badge>
          )}
          {typeof instrument.passMarks === 'number' && (
            <Badge variant="outline" className="font-normal tabular-nums">
              Pass {instrument.passMarks}
            </Badge>
          )}
        </div>
        {instrument.examId && (
          <Link href={`/exams/${instrument.examId}`}>
            <Button variant="outline" size="sm" className="gap-2">
              Open the exam
              <ArrowUpRight className="h-4 w-4" />
            </Button>
          </Link>
        )}
      </div>
    </SectionPanel>
  );
}

function ImportDialog({
  offeringId,
  instrumentId,
  columns,
  multiSet,
  onImported,
}: {
  offeringId: string;
  instrumentId: string;
  columns: InstrumentSet['items'];
  multiSet: boolean;
  onImported: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [csv, setCsv] = useState('');
  const [report, setReport] = useState<MarksImportReport | null>(null);

  const reset = () => {
    setCsv('');
    setReport(null);
  };

  const validateMutation = useMutation({
    mutationFn: () => obeApi.importMarks(offeringId, instrumentId, csv),
    onSuccess: (res) => setReport(res.data as MarksImportReport),
    onError: (err) => {
      setReport(null);
      toast.error(getErrorMessage(err));
    },
  });

  const commitMutation = useMutation({
    mutationFn: () => obeApi.importMarks(offeringId, instrumentId, csv, true),
    onSuccess: (res) => {
      const saved = (res?.data as { saved?: number } | undefined)?.saved ?? 0;
      toast.success(`Imported ${saved} row(s)`);
      onImported();
      setOpen(false);
      reset();
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const headerHint = ['admissionNumber', multiSet ? 'set' : null, 'absent']
    .filter(Boolean)
    .concat(columns.map((c) => c.label))
    .join(', ');

  const clean = !!report && report.errors.length === 0 && report.valid > 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <FileUp className="h-3.5 w-3.5" />
          Import CSV
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import marks from CSV</DialogTitle>
          <DialogDescription>
            Validate first, fix anything flagged, then commit. Nothing is written until you commit.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-xl border bg-muted/30 p-4 text-xs leading-relaxed text-muted-foreground">
            <p className="font-medium text-foreground">Expected columns</p>
            <p className="mt-1 font-mono break-words">{headerHint}</p>
            <p className="mt-2">
              <code>admissionNumber</code> is required.{' '}
              {multiSet ? (
                <>
                  <code>set</code> is required for this instrument (accepts the full label or a bare
                  number).
                </>
              ) : (
                <>
                  <code>set</code> may be omitted — this instrument has a single set.
                </>
              )}{' '}
              <code>absent</code> accepts yes/true/1/y/ab. A blank question cell means the question
              was not attempted; <code>0</code> means attempted and scored nothing.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="obe-marks-csv-file">Upload a file</Label>
            <Input
              id="obe-marks-csv-file"
              type="file"
              accept=".csv"
              className="cursor-pointer"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (!file) return;
                setCsv(await file.text());
                setReport(null);
              }}
            />
          </div>

          <Separator />

          <div className="space-y-2">
            <Label htmlFor="obe-marks-csv">…or paste the CSV</Label>
            <Textarea
              id="obe-marks-csv"
              rows={8}
              className="font-mono text-xs"
              placeholder={`${headerHint}\n2024CS001${multiSet ? ',SET-1' : ''},no,5,,3`}
              value={csv}
              onChange={(e) => {
                setCsv(e.target.value);
                setReport(null);
              }}
            />
          </div>

          {report && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                {clean ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                )}
                <span>
                  <strong className="tabular-nums">{report.valid}</strong> of{' '}
                  <span className="tabular-nums">{report.totalDataRows}</span> row(s) ready
                </span>
                {report.errors.length > 0 && (
                  <Badge variant="outline" className="font-normal text-rose-600">
                    {report.errors.length} error(s)
                  </Badge>
                )}
              </div>

              {report.errors.length > 0 && (
                <div className="max-h-56 overflow-y-auto rounded-xl border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[70px]">Line</TableHead>
                        <TableHead>Problem</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {report.errors.map((err, i) => (
                        <TableRow key={`${err.line}-${i}`}>
                          <TableCell className="py-2 tabular-nums">{err.line}</TableCell>
                          <TableCell className="py-2 text-sm">{err.message}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            disabled={!csv.trim() || validateMutation.isPending}
            onClick={() => validateMutation.mutate()}
            className="gap-2"
          >
            {validateMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Validate
          </Button>
          <Button
            disabled={!clean || commitMutation.isPending}
            onClick={() => commitMutation.mutate()}
            className="gap-2"
          >
            {commitMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Commit import
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
