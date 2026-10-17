'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { academicApi, obeApi, type ObeInstrumentPayload } from '@/lib/api';
import { usePermissions } from '@/hooks/usePermissions';
import { cn, getErrorMessage } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
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
import { SectionPanel } from '@/components/exams/SectionPanel';
import { Field } from '@/components/exams/Field';
import { InstructorPicker } from '@/components/courses/InstructorPicker';
import type {
  ExamLinkCandidate,
  Instrument,
  InstrumentSet,
  OfferingDetail,
  OutcomeDocCo,
} from '@/components/obe/types';

interface SectionOption {
  _id: string;
  name: string;
  code?: string;
  classId: string;
  studentCount?: number;
}

interface ClassOption {
  _id: string;
  displayName?: string;
  name?: string;
}

interface OfferingDraft {
  sectionIds: string[];
  coordinatorStaffId?: string;
  targetLevel: string;
}

interface ItemDraft {
  key: string;
  /** Present for saved items — dropping it detaches the marks already captured. */
  _id?: string;
  label: string;
  coIds: string[];
  maxMarks: string;
}

interface SetDraft {
  key: string;
  _id?: string;
  label: string;
  items: ItemDraft[];
}

interface InstrumentDraft {
  instrumentId?: string;
  kind: 'internal' | 'external';
  name: string;
  order: string;
  bestOfCount: string;
  sets: SetDraft[];
  examId?: string;
  paperId?: string;
}

const newKey = () => `new-${Math.random().toString(36).slice(2, 9)}`;

const setMarks = (set: InstrumentSet) => set.items.reduce((sum, item) => sum + item.maxMarks, 0);

const draftSetMarks = (set: SetDraft) =>
  set.items.reduce((sum, item) => sum + (Number(item.maxMarks) || 0), 0);

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

function toInstrumentDraft(instrument: Instrument | null, nextOrder: number): InstrumentDraft {
  if (!instrument) {
    return { kind: 'internal', name: '', order: String(nextOrder), bestOfCount: '', sets: [] };
  }
  return {
    instrumentId: instrument._id,
    kind: instrument.kind,
    name: instrument.name,
    order: String(instrument.order),
    bestOfCount: instrument.bestOfCount != null ? String(instrument.bestOfCount) : '',
    sets: (instrument.sets ?? []).map((set) => ({
      key: set._id,
      _id: set._id,
      label: set.label,
      items: set.items.map((item) => ({
        key: item._id,
        _id: item._id,
        label: item.label,
        coIds: [...item.coIds],
        maxMarks: String(item.maxMarks),
      })),
    })),
    examId: instrument.examId,
    paperId: instrument.paperId,
  };
}

function toInstrumentPayload(draft: InstrumentDraft): ObeInstrumentPayload {
  const base: ObeInstrumentPayload = {
    name: draft.name.trim(),
    kind: draft.kind,
    order: Number(draft.order) || 0,
  };
  if (draft.kind === 'external') {
    return { ...base, examId: draft.examId, paperId: draft.paperId };
  }
  return {
    ...base,
    bestOfCount: draft.bestOfCount.trim() ? Number(draft.bestOfCount) : null,
    sets: draft.sets.map((set) => ({
      ...(set._id ? { _id: set._id } : {}),
      label: set.label.trim(),
      items: set.items.map((item) => ({
        ...(item._id ? { _id: item._id } : {}),
        label: item.label.trim(),
        coIds: item.coIds,
        maxMarks: Number(item.maxMarks),
      })),
    })),
  };
}

function isDraftValid(draft: InstrumentDraft) {
  if (!draft.name.trim()) return false;
  if (draft.kind === 'external') return !!draft.examId && !!draft.paperId;
  if (draft.sets.length === 0) return false;
  return draft.sets.every(
    (set) =>
      set.label.trim() &&
      set.items.length > 0 &&
      set.items.every(
        (item) => item.label.trim() && item.coIds.length > 0 && Number(item.maxMarks) > 0
      )
  );
}

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </p>
      <div className="mt-1 text-sm font-medium">{value}</div>
    </div>
  );
}

export function OverviewTab({ offering }: { offering: OfferingDetail }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const canEdit = hasPermission('obe.offerings', 'edit');
  const canDelete = hasPermission('obe.offerings', 'delete');

  const [offeringDraft, setOfferingDraft] = useState<OfferingDraft | null>(null);
  const [instrumentDraft, setInstrumentDraft] = useState<InstrumentDraft | null>(null);
  const [instrumentToDelete, setInstrumentToDelete] = useState<Instrument | null>(null);
  const [deleteOfferingOpen, setDeleteOfferingOpen] = useState(false);

  const invalidateOffering = () =>
    queryClient.invalidateQueries({ queryKey: ['obe-offering', offering._id] });

  const { data: sectionsData } = useQuery({
    queryKey: ['sections'],
    queryFn: () => academicApi.getSections(),
  });

  const { data: classesData } = useQuery({
    queryKey: ['classes'],
    queryFn: () => academicApi.getClasses(),
  });

  const { data: outcomesData, isLoading: outcomesLoading } = useQuery({
    queryKey: ['obe-outcomes', offering.subjectId, offering.programId],
    queryFn: () => obeApi.getOutcomes(offering.subjectId, offering.programId),
  });

  const { data: examLinksData, isLoading: examLinksLoading } = useQuery({
    queryKey: ['obe-exam-links', offering.subjectId, offering.academicBatchId, offering.termId],
    queryFn: () =>
      obeApi.getExamLinks({
        subjectId: offering.subjectId,
        academicBatchId: offering.academicBatchId,
        termId: offering.termId,
      }),
    enabled: instrumentDraft?.kind === 'external',
  });

  const sections: SectionOption[] = sectionsData?.data || [];
  const classes: ClassOption[] = classesData?.data || [];
  const cos: OutcomeDocCo[] = outcomesData?.data?.cos || [];
  const examCandidates: ExamLinkCandidate[] = examLinksData?.data || [];

  const classNames = useMemo(() => {
    const map: Record<string, string> = {};
    for (const cls of classes) map[cls._id] = cls.displayName || cls.name || 'Class';
    return map;
  }, [classes]);

  const selectedSections = sections.filter((s) => offering.sectionIds.includes(s._id));
  const instruments = useMemo(
    () => [...offering.instruments].sort((a, b) => a.order - b.order),
    [offering.instruments]
  );

  const saveOffering = useMutation({
    mutationFn: (draft: OfferingDraft) =>
      obeApi.updateOffering(offering._id, {
        sectionIds: draft.sectionIds,
        coordinatorStaffId: draft.coordinatorStaffId ?? null,
        targetLevel: draft.targetLevel.trim() ? Number(draft.targetLevel) : null,
      }),
    onSuccess: () => {
      toast.success('Offering updated');
      setOfferingDraft(null);
      invalidateOffering();
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const statusMutation = useMutation({
    mutationFn: (status: 'draft' | 'data_entry') => obeApi.setOfferingStatus(offering._id, status),
    onSuccess: () => {
      toast.success('Status updated');
      invalidateOffering();
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const deleteOffering = useMutation({
    mutationFn: () => obeApi.deleteOffering(offering._id),
    onSuccess: () => {
      toast.success('Offering deleted');
      queryClient.invalidateQueries({ queryKey: ['obe-offerings'] });
      router.push('/obe');
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const saveInstrument = useMutation({
    mutationFn: (draft: InstrumentDraft) =>
      draft.instrumentId
        ? obeApi.updateInstrument(offering._id, draft.instrumentId, toInstrumentPayload(draft))
        : obeApi.addInstrument(offering._id, toInstrumentPayload(draft)),
    onSuccess: () => {
      toast.success('Instrument saved');
      setInstrumentDraft(null);
      invalidateOffering();
    },
    // The dialog stays open on failure (INSTRUMENT_HAS_MARKS et al) so edits survive.
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const deleteInstrument = useMutation({
    mutationFn: (instrumentId: string) => obeApi.deleteInstrument(offering._id, instrumentId),
    onSuccess: () => {
      toast.success('Instrument deleted');
      setInstrumentToDelete(null);
      invalidateOffering();
    },
    onError: (err) => {
      toast.error(getErrorMessage(err));
      setInstrumentToDelete(null);
    },
  });

  const patchDraft = (patch: Partial<InstrumentDraft>) =>
    setInstrumentDraft((prev) => (prev ? { ...prev, ...patch } : prev));

  const patchSet = (setKey: string, patch: Partial<SetDraft>) =>
    setInstrumentDraft((prev) =>
      prev
        ? { ...prev, sets: prev.sets.map((s) => (s.key === setKey ? { ...s, ...patch } : s)) }
        : prev
    );

  const patchItem = (setKey: string, itemKey: string, patch: Partial<ItemDraft>) =>
    setInstrumentDraft((prev) =>
      prev
        ? {
            ...prev,
            sets: prev.sets.map((s) =>
              s.key === setKey
                ? { ...s, items: s.items.map((i) => (i.key === itemKey ? { ...i, ...patch } : i)) }
                : s
            ),
          }
        : prev
    );

  const addSet = () =>
    setInstrumentDraft((prev) =>
      prev
        ? {
            ...prev,
            sets: [
              ...prev.sets,
              { key: newKey(), label: `SET-${prev.sets.length + 1}`, items: [] },
            ],
          }
        : prev
    );

  const removeSet = (setKey: string) =>
    setInstrumentDraft((prev) =>
      prev ? { ...prev, sets: prev.sets.filter((s) => s.key !== setKey) } : prev
    );

  const addItem = (setKey: string) =>
    setInstrumentDraft((prev) =>
      prev
        ? {
            ...prev,
            sets: prev.sets.map((s) =>
              s.key === setKey
                ? {
                    ...s,
                    items: [
                      ...s.items,
                      { key: newKey(), label: `Q${s.items.length + 1}`, coIds: [], maxMarks: '' },
                    ],
                  }
                : s
            ),
          }
        : prev
    );

  const removeItem = (setKey: string, itemKey: string) =>
    setInstrumentDraft((prev) =>
      prev
        ? {
            ...prev,
            sets: prev.sets.map((s) =>
              s.key === setKey ? { ...s, items: s.items.filter((i) => i.key !== itemKey) } : s
            ),
          }
        : prev
    );

  const toggleCo = (setKey: string, item: ItemDraft, coId: string) =>
    patchItem(setKey, item.key, {
      coIds: item.coIds.includes(coId)
        ? item.coIds.filter((id) => id !== coId)
        : [...item.coIds, coId],
    });

  const statusToggleable = offering.status === 'draft' || offering.status === 'data_entry';
  const noCos = !outcomesLoading && cos.length === 0;
  const draftValid = instrumentDraft ? isDraftValid(instrumentDraft) : false;

  return (
    <div className="space-y-6">
      <SectionPanel
        eyebrow="Offering"
        title="Course run"
        description="Who owns this offering, which sections make up the cohort, and the attainment level it is measured against."
        action={
          <div className="flex flex-wrap items-center gap-2">
            {canEdit && (
              <Button
                size="sm"
                variant="outline"
                className="gap-1"
                onClick={() =>
                  setOfferingDraft({
                    sectionIds: [...offering.sectionIds],
                    coordinatorStaffId: offering.coordinatorStaffId,
                    targetLevel: offering.targetLevel != null ? String(offering.targetLevel) : '',
                  })
                }
              >
                <Pencil className="h-3 w-3" />
                Edit
              </Button>
            )}
            {canDelete && offering.status === 'draft' && (
              <Button
                size="sm"
                variant="outline"
                className="gap-1 text-rose-600 hover:text-rose-600"
                onClick={() => setDeleteOfferingOpen(true)}
              >
                <Trash2 className="h-3 w-3" />
                Delete
              </Button>
            )}
          </div>
        }
      >
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <Fact label="Term" value={offering.termName} />
          <Fact
            label="Coordinator"
            value={
              offering.coordinatorName || <span className="text-muted-foreground">Unassigned</span>
            }
          />
          <Fact label="Cohort size" value={`${offering.cohortSize} students`} />
          <Fact
            label="Sections"
            value={
              <div className="flex flex-wrap items-center gap-1.5">
                <span>{plural(offering.sectionIds.length, 'section')}</span>
                {selectedSections.map((s) => (
                  <Badge key={s._id} variant="outline" className="text-[10px] font-normal">
                    {classNames[s.classId] ? `${classNames[s.classId]} · ` : ''}
                    {s.name}
                  </Badge>
                ))}
              </div>
            }
          />
          <Fact
            label="Target level"
            value={
              offering.targetLevel != null ? (
                offering.targetLevel
              ) : (
                <span className="text-muted-foreground">Uses the OBE default</span>
              )
            }
          />
        </div>

        {statusToggleable && (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-muted/20 p-4">
            <div className="min-w-0">
              <p className="text-sm font-medium">Data entry</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Marks can only be captured while the offering is in data entry — a draft is still
                being set up.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {statusMutation.isPending && (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              )}
              <Switch
                checked={offering.status === 'data_entry'}
                disabled={!canEdit || statusMutation.isPending}
                aria-label="Open data entry"
                onCheckedChange={(next) => statusMutation.mutate(next ? 'data_entry' : 'draft')}
              />
            </div>
          </div>
        )}
      </SectionPanel>

      <SectionPanel
        eyebrow="Assessment"
        title="Instruments"
        description="Internal instruments carry question sets tagged to COs; external instruments take their result straight from a linked exam paper."
        action={
          canEdit ? (
            <Button
              size="sm"
              variant="outline"
              className="gap-1"
              disabled={noCos}
              onClick={() => setInstrumentDraft(toInstrumentDraft(null, instruments.length))}
            >
              <Plus className="h-3 w-3" />
              Add instrument
            </Button>
          ) : null
        }
      >
        {noCos && (
          <div className="mb-5 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p className="text-sm">
              This course has no course outcomes yet. Every question is tagged to COs, so
              instruments cannot be built until they exist —{' '}
              <Link href="/obe/outcomes" className="font-medium underline underline-offset-2">
                author the COs
              </Link>{' '}
              first.
            </p>
          </div>
        )}

        <div className="space-y-3">
          {instruments.map((instrument) => (
            <div key={instrument._id} className="rounded-xl border bg-muted/20 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{instrument.name}</p>
                    <Badge variant="outline" className="text-[10px] capitalize">
                      {instrument.kind}
                    </Badge>
                    {instrument.kind === 'internal' && instrument.bestOfCount != null && (
                      <Badge variant="outline" className="text-[10px]">
                        best {instrument.bestOfCount} of {instrument.sets?.length ?? 0}
                      </Badge>
                    )}
                  </div>
                  {instrument.kind === 'internal' ? (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {(instrument.sets ?? []).map((set) => (
                        <span
                          key={set._id}
                          className="rounded-full border bg-background px-2.5 py-0.5 text-[11px] text-muted-foreground"
                        >
                          <span className="font-mono text-foreground">{set.label}</span> ·{' '}
                          {plural(set.items.length, 'question')} · {setMarks(set)} marks
                        </span>
                      ))}
                      {(instrument.sets ?? []).length === 0 && (
                        <span className="text-xs italic text-muted-foreground">
                          No question sets yet.
                        </span>
                      )}
                    </div>
                  ) : (
                    <p className="mt-2 text-xs text-muted-foreground">
                      {instrument.examName || 'Linked exam'} · {instrument.totalMarks ?? '—'} marks
                      · pass {instrument.passMarks ?? '—'}
                    </p>
                  )}
                </div>
                {canEdit && (
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      aria-label={`Edit ${instrument.name}`}
                      onClick={() => setInstrumentDraft(toInstrumentDraft(instrument, 0))}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      aria-label={`Delete ${instrument.name}`}
                      onClick={() => setInstrumentToDelete(instrument)}
                    >
                      <Trash2 className="h-4 w-4 text-rose-500" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}

          {instruments.length === 0 && !noCos && (
            <p className="text-sm italic text-muted-foreground">
              No instruments yet. Most courses declare two or three internals plus the end-semester
              exam.
            </p>
          )}
        </div>
      </SectionPanel>

      <Dialog open={!!offeringDraft} onOpenChange={(open) => !open && setOfferingDraft(null)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit offering</DialogTitle>
            <DialogDescription>
              Sections define the cohort whose marks and attainment this offering reports on.
            </DialogDescription>
          </DialogHeader>

          {offeringDraft && (
            <div className="space-y-5">
              <Field
                label="Sections"
                required
                hint="At least one section. The trailing number is current enrolment."
              >
                {sections.length === 0 ? (
                  <Skeleton className="h-24 rounded-xl" />
                ) : (
                  <div className="max-h-64 space-y-1 overflow-y-auto rounded-xl border p-2">
                    {sections.map((section) => (
                      <div
                        key={section._id}
                        className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-muted/50"
                      >
                        <Checkbox
                          id={`section-${section._id}`}
                          checked={offeringDraft.sectionIds.includes(section._id)}
                          onCheckedChange={() =>
                            setOfferingDraft({
                              ...offeringDraft,
                              sectionIds: offeringDraft.sectionIds.includes(section._id)
                                ? offeringDraft.sectionIds.filter((id) => id !== section._id)
                                : [...offeringDraft.sectionIds, section._id],
                            })
                          }
                        />
                        <Label
                          htmlFor={`section-${section._id}`}
                          className="flex-1 cursor-pointer truncate text-sm font-normal"
                        >
                          <span className="text-muted-foreground">
                            {classNames[section.classId] ?? 'Class'}
                          </span>{' '}
                          · {section.name}
                        </Label>
                        {section.studentCount != null && (
                          <span className="text-xs text-muted-foreground">
                            {section.studentCount}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </Field>

              <Field label="Coordinator" hint="Leave empty to keep the offering unassigned.">
                <InstructorPicker
                  value={offeringDraft.coordinatorStaffId}
                  placeholder="Select coordinator..."
                  onChange={(staffId) =>
                    setOfferingDraft({ ...offeringDraft, coordinatorStaffId: staffId })
                  }
                />
              </Field>

              <Field label="Target level" hint="Blank falls back to the target in OBE settings.">
                <Input
                  type="number"
                  min={0}
                  max={10}
                  step="0.1"
                  value={offeringDraft.targetLevel}
                  onChange={(e) =>
                    setOfferingDraft({ ...offeringDraft, targetLevel: e.target.value })
                  }
                />
              </Field>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setOfferingDraft(null)}>
              Cancel
            </Button>
            <Button
              className="gap-2"
              disabled={
                !offeringDraft || offeringDraft.sectionIds.length === 0 || saveOffering.isPending
              }
              onClick={() => offeringDraft && saveOffering.mutate(offeringDraft)}
            >
              {saveOffering.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!instrumentDraft} onOpenChange={(open) => !open && setInstrumentDraft(null)}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {instrumentDraft?.instrumentId ? 'Edit instrument' : 'Add instrument'}
            </DialogTitle>
            <DialogDescription>
              Every question carries the COs it assesses — that tagging is what attainment is
              computed from.
            </DialogDescription>
          </DialogHeader>

          {instrumentDraft && (
            <div className="space-y-5">
              <Field label="Kind" required>
                <RadioGroup
                  className="flex gap-6"
                  value={instrumentDraft.kind}
                  disabled={!!instrumentDraft.instrumentId}
                  onValueChange={(value) => patchDraft({ kind: value as 'internal' | 'external' })}
                >
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="internal" id="kind-internal" />
                    <Label htmlFor="kind-internal" className="font-normal">
                      Internal
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="external" id="kind-external" />
                    <Label htmlFor="kind-external" className="font-normal">
                      External
                    </Label>
                  </div>
                </RadioGroup>
                {!!instrumentDraft.instrumentId && (
                  <p className="text-[11px] text-muted-foreground">
                    Kind is fixed once saved — delete and recreate to change it.
                  </p>
                )}
              </Field>

              <div className="grid gap-5 sm:grid-cols-[1fr_120px]">
                <Field label="Name" required>
                  <Input
                    placeholder="Internal Assessment 1"
                    value={instrumentDraft.name}
                    onChange={(e) => patchDraft({ name: e.target.value })}
                  />
                </Field>
                <Field label="Order">
                  <Input
                    type="number"
                    min={0}
                    value={instrumentDraft.order}
                    onChange={(e) => patchDraft({ order: e.target.value })}
                  />
                </Field>
              </div>

              {instrumentDraft.kind === 'internal' ? (
                <>
                  <Field
                    label="Best of"
                    hint="Blank counts every set. Set 2 for a best-2-of-3 internal."
                  >
                    <Input
                      type="number"
                      min={1}
                      className="max-w-[160px]"
                      placeholder="All sets"
                      value={instrumentDraft.bestOfCount}
                      onChange={(e) => patchDraft({ bestOfCount: e.target.value })}
                    />
                  </Field>

                  <div className="space-y-3">
                    {instrumentDraft.sets.map((set) => (
                      <div key={set.key} className="space-y-3 rounded-xl border bg-muted/20 p-3">
                        <div className="flex items-center gap-2">
                          <Input
                            className="h-9 w-40 font-mono text-sm"
                            value={set.label}
                            onChange={(e) => patchSet(set.key, { label: e.target.value })}
                          />
                          <span className="text-xs text-muted-foreground">
                            {plural(set.items.length, 'question')} · {draftSetMarks(set)} marks
                          </span>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="ml-auto h-9 w-9"
                            aria-label={`Remove ${set.label}`}
                            onClick={() => removeSet(set.key)}
                          >
                            <Trash2 className="h-4 w-4 text-rose-500" />
                          </Button>
                        </div>

                        {set.items.map((item) => (
                          <div
                            key={item.key}
                            className="space-y-2 rounded-lg border bg-background p-3"
                          >
                            <div className="flex items-center gap-2">
                              <Input
                                className="h-8 w-24 font-mono text-sm"
                                value={item.label}
                                onChange={(e) =>
                                  patchItem(set.key, item.key, { label: e.target.value })
                                }
                              />
                              <Input
                                type="number"
                                min={0}
                                step="0.5"
                                className="h-8 w-28"
                                placeholder="Max marks"
                                value={item.maxMarks}
                                onChange={(e) =>
                                  patchItem(set.key, item.key, { maxMarks: e.target.value })
                                }
                              />
                              <Button
                                size="icon"
                                variant="ghost"
                                className="ml-auto h-8 w-8"
                                aria-label={`Remove ${item.label}`}
                                onClick={() => removeItem(set.key, item.key)}
                              >
                                <Trash2 className="h-4 w-4 text-rose-500" />
                              </Button>
                            </div>
                            <div className="flex flex-wrap items-center gap-1.5">
                              {cos.map((co) => {
                                const active = item.coIds.includes(co._id);
                                return (
                                  <button
                                    key={co._id}
                                    type="button"
                                    title={co.statement}
                                    aria-pressed={active}
                                    className={cn(
                                      'rounded-full border px-2.5 py-0.5 font-mono text-[11px] transition-colors',
                                      active
                                        ? 'border-primary bg-primary/10 text-primary'
                                        : 'text-muted-foreground hover:bg-muted'
                                    )}
                                    onClick={() => toggleCo(set.key, item, co._id)}
                                  >
                                    {co.code}
                                  </button>
                                );
                              })}
                              {item.coIds.length === 0 && (
                                <span className="text-[11px] text-amber-600">
                                  Tag at least one CO
                                </span>
                              )}
                            </div>
                          </div>
                        ))}

                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1"
                          onClick={() => addItem(set.key)}
                        >
                          <Plus className="h-3 w-3" />
                          Add question
                        </Button>
                      </div>
                    ))}

                    <Button size="sm" variant="outline" className="gap-1" onClick={addSet}>
                      <Plus className="h-3 w-3" />
                      Add set
                    </Button>
                  </div>
                </>
              ) : (
                <Field label="Linked exam paper" required>
                  {examLinksLoading ? (
                    <Skeleton className="h-24 rounded-xl" />
                  ) : examCandidates.length === 0 ? (
                    <p className="text-sm italic text-muted-foreground">
                      No exam paper for this subject in this term yet. Schedule the exam first.
                    </p>
                  ) : (
                    <RadioGroup
                      className="max-h-64 space-y-1 overflow-y-auto rounded-xl border p-2"
                      value={
                        instrumentDraft.examId && instrumentDraft.paperId
                          ? `${instrumentDraft.examId}:${instrumentDraft.paperId}`
                          : ''
                      }
                      onValueChange={(value) => {
                        const [examId, paperId] = value.split(':');
                        patchDraft({ examId, paperId });
                      }}
                    >
                      {examCandidates.map((candidate) => {
                        const value = `${candidate.examId}:${candidate.paperId}`;
                        return (
                          <div
                            key={value}
                            className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-muted/50"
                          >
                            <RadioGroupItem value={value} id={`exam-${value}`} />
                            <Label
                              htmlFor={`exam-${value}`}
                              className="flex-1 cursor-pointer text-sm font-normal"
                            >
                              {candidate.examName}
                              <span className="ml-2 text-xs text-muted-foreground">
                                {candidate.termName} · {candidate.totalMarks} marks · pass{' '}
                                {candidate.passMarks}
                              </span>
                            </Label>
                          </div>
                        );
                      })}
                    </RadioGroup>
                  )}
                </Field>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setInstrumentDraft(null)}>
              Cancel
            </Button>
            <Button
              className="gap-2"
              disabled={!draftValid || saveInstrument.isPending}
              onClick={() => instrumentDraft && saveInstrument.mutate(instrumentDraft)}
            >
              {saveInstrument.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Save instrument
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!instrumentToDelete}
        onOpenChange={(open) => !open && setInstrumentToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {instrumentToDelete?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              The instrument and its question structure go away. Marks already captured against it
              must be cleared first.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-600 hover:bg-rose-700"
              onClick={() => instrumentToDelete && deleteInstrument.mutate(instrumentToDelete._id)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteOfferingOpen} onOpenChange={setDeleteOfferingOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this offering?</AlertDialogTitle>
            <AlertDialogDescription>
              {offering.subjectCode} · {offering.termName} and its instruments are removed. Only a
              draft offering can be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-600 hover:bg-rose-700"
              onClick={() => deleteOffering.mutate()}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
