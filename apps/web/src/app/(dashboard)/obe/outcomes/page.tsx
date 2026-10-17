'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, ChevronsUpDown, Loader2, Plus, Save, Target, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { BLOOM_LEVELS, type ObeProgramPreset } from '@campus-verse/shared/constants';
import {
  academicApi,
  obeApi,
  type ObeCoPayload,
  type ObePoMappingPayload,
  type ObePsoMappingPayload,
} from '@/lib/api';
import { usePermissions } from '@/hooks/usePermissions';
import { cn, getErrorMessage } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { EditorialHeader } from '@/components/exams/EditorialHeader';
import { SectionPanel } from '@/components/exams/SectionPanel';
import { Field } from '@/components/exams/Field';
import { MappingMatrix, mappingCellKey, type MappingCell } from '@/components/obe/MappingMatrix';

const MAX_COS = 20;

interface ProgramOption {
  _id: string;
  departmentCode: string;
  name: string;
  preset: ObeProgramPreset;
  pos: Array<{ _id: string; code: string; title: string }>;
  psos: Array<{ _id: string; code: string; statement: string }>;
}

interface SubjectOption {
  _id: string;
  name: string;
  code: string;
}

interface OutcomeDoc {
  _id: string | null;
  cos: Array<{ _id: string; code: string; statement: string; bloomLevel: number; order: number }>;
  poMapping: Array<{ coId: string; poId: string; strength: number; justification?: string }>;
  psoMapping: Array<{ coId: string; psoId: string; strength: number; justification?: string }>;
}

interface CoRow {
  /** Stable across edits — the CO _id when saved, a local key while new. */
  key: string;
  _id?: string;
  statement: string;
  bloomLevel: number;
}

interface EditorState {
  cos: CoRow[];
  poCells: Record<string, MappingCell>;
  psoCells: Record<string, MappingCell>;
}

const EMPTY_STATE: EditorState = { cos: [], poCells: {}, psoCells: {} };

function toEditorState(doc: OutcomeDoc): EditorState {
  const poCells: Record<string, MappingCell> = {};
  for (const cell of doc.poMapping) {
    poCells[mappingCellKey(cell.coId, cell.poId)] = {
      strength: cell.strength,
      justification: cell.justification || undefined,
    };
  }
  const psoCells: Record<string, MappingCell> = {};
  for (const cell of doc.psoMapping) {
    psoCells[mappingCellKey(cell.coId, cell.psoId)] = {
      strength: cell.strength,
      justification: cell.justification || undefined,
    };
  }
  return {
    cos: doc.cos.map((co) => ({
      key: co._id,
      _id: co._id,
      statement: co.statement,
      bloomLevel: co.bloomLevel,
    })),
    poCells,
    psoCells,
  };
}

export default function ObeOutcomesPage() {
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const canEdit = hasPermission('obe.outcomes', 'edit');

  const [programId, setProgramId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [subjectOpen, setSubjectOpen] = useState(false);
  const [state, setState] = useState<EditorState>(EMPTY_STATE);
  const [baseline, setBaseline] = useState('');

  const { data: programsData, isLoading: programsLoading } = useQuery({
    queryKey: ['obe-programs'],
    queryFn: () => obeApi.getPrograms(),
  });

  const { data: subjectsData } = useQuery({
    queryKey: ['obe-subjects'],
    queryFn: () => academicApi.getSubjects(),
  });

  const {
    data: outcomesData,
    isLoading: outcomesLoading,
    isFetching: outcomesFetching,
  } = useQuery({
    queryKey: ['obe-outcomes', subjectId, programId],
    queryFn: () => obeApi.getOutcomes(subjectId, programId),
    enabled: !!subjectId && !!programId,
  });

  const programs: ProgramOption[] = programsData?.data || [];
  const subjects: SubjectOption[] = subjectsData?.data?.data || subjectsData?.data || [];
  const program = programs.find((p) => p._id === programId);
  const subject = subjects.find((s) => s._id === subjectId);
  const doc: OutcomeDoc | undefined = outcomesData?.data;

  // `doc` is a fresh object per subject × program, so this also resets the
  // editor when the scope changes — and clears it while the new doc loads.
  useEffect(() => {
    if (!doc) {
      setState(EMPTY_STATE);
      setBaseline('');
      return;
    }
    const next = toEditorState(doc);
    setState(next);
    setBaseline(JSON.stringify(next));
  }, [doc]);

  const buildPayload = () => {
    const cos: ObeCoPayload[] = state.cos.map((co, i) => ({
      ...(co._id ? { _id: co._id } : {}),
      code: `CO${i + 1}`,
      statement: co.statement.trim(),
      bloomLevel: co.bloomLevel,
      order: i,
    }));

    const poMapping: ObePoMappingPayload[] = [];
    const psoMapping: ObePsoMappingPayload[] = [];
    for (const [index, co] of state.cos.entries()) {
      for (const po of program?.pos ?? []) {
        const cell = state.poCells[mappingCellKey(co.key, po._id)];
        if (cell?.strength) {
          poMapping.push({
            coIndex: index,
            poId: po._id,
            strength: cell.strength,
            justification: cell.justification?.trim() || undefined,
          });
        }
      }
      for (const pso of program?.psos ?? []) {
        const cell = state.psoCells[mappingCellKey(co.key, pso._id)];
        if (cell?.strength) {
          psoMapping.push({
            coIndex: index,
            psoId: pso._id,
            strength: cell.strength,
            justification: cell.justification?.trim() || undefined,
          });
        }
      }
    }
    return { subjectId, programId, cos, poMapping, psoMapping };
  };

  const saveMutation = useMutation({
    mutationFn: () => obeApi.upsertOutcomes(buildPayload()),
    onSuccess: () => {
      toast.success('Course outcomes saved');
      queryClient.invalidateQueries({ queryKey: ['obe-outcomes', subjectId, programId] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const isDirty = useMemo(
    () => !!baseline && JSON.stringify(state) !== baseline,
    [state, baseline]
  );
  const hasBlankStatement = state.cos.some((co) => !co.statement.trim());
  const bothPicked = !!programId && !!subjectId;

  const addCo = () =>
    setState((prev) => ({
      ...prev,
      cos: [
        ...prev.cos,
        { key: `new-${Date.now()}-${prev.cos.length}`, statement: '', bloomLevel: 2 },
      ],
    }));

  const updateCo = (key: string, patch: Partial<CoRow>) =>
    setState((prev) => ({
      ...prev,
      cos: prev.cos.map((co) => (co.key === key ? { ...co, ...patch } : co)),
    }));

  const removeCo = (key: string) =>
    setState((prev) => {
      const poCells = { ...prev.poCells };
      const psoCells = { ...prev.psoCells };
      for (const cellKey of Object.keys(poCells)) {
        if (cellKey.startsWith(`${key}:`)) delete poCells[cellKey];
      }
      for (const cellKey of Object.keys(psoCells)) {
        if (cellKey.startsWith(`${key}:`)) delete psoCells[cellKey];
      }
      return { cos: prev.cos.filter((co) => co.key !== key), poCells, psoCells };
    });

  const matrixCos = state.cos.map((co, i) => ({
    key: co.key,
    code: `CO${i + 1}`,
    statement: co.statement,
  }));

  return (
    <div className="space-y-8 pb-12">
      <EditorialHeader
        eyebrow="OBE · Course outcomes"
        meta="/obe/outcomes"
        icon={Target}
        title="Course outcomes"
        description="Write the COs for a subject, tag each with a Bloom level, then map them onto the program's POs and PSOs. The mapping matrix is what accreditation reviewers ask for first."
        actions={
          canEdit && bothPicked ? (
            <Button
              className="gap-2"
              disabled={
                !isDirty ||
                state.cos.length === 0 ||
                hasBlankStatement ||
                saveMutation.isPending ||
                outcomesFetching
              }
              onClick={() => saveMutation.mutate()}
            >
              {saveMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save outcomes
            </Button>
          ) : null
        }
      />

      <SectionPanel
        eyebrow="Scope"
        title="Pick a program and subject"
        description="Course outcomes live per subject × program, so a shared subject can carry different mappings for each program that teaches it."
      >
        <div className="grid gap-5 md:grid-cols-2">
          <Field label="Program" required>
            {programsLoading ? (
              <Skeleton className="h-10" />
            ) : (
              <Select value={programId} onValueChange={setProgramId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a program" />
                </SelectTrigger>
                <SelectContent>
                  {programs.map((p) => (
                    <SelectItem key={p._id} value={p._id}>
                      {p.departmentCode} · {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </Field>

          <Field label="Subject" required>
            <Popover open={subjectOpen} onOpenChange={setSubjectOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={subjectOpen}
                  className="w-full justify-between font-normal"
                >
                  {subject ? (
                    <span className="truncate">
                      <span className="font-mono text-xs text-muted-foreground">
                        {subject.code}
                      </span>{' '}
                      {subject.name}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">Select a subject</span>
                  )}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search subjects…" />
                  <CommandList>
                    <CommandEmpty>No subject found.</CommandEmpty>
                    <CommandGroup>
                      {subjects.map((s) => (
                        <CommandItem
                          key={s._id}
                          value={`${s.code} ${s.name}`}
                          onSelect={() => {
                            setSubjectId(s._id);
                            setSubjectOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              'mr-2 h-4 w-4',
                              s._id === subjectId ? 'opacity-100' : 'opacity-0'
                            )}
                          />
                          <span className="font-mono text-xs text-muted-foreground">{s.code}</span>
                          <span className="ml-2 truncate">{s.name}</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </Field>
        </div>
      </SectionPanel>

      {!bothPicked ? (
        <SectionPanel>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Target className="mb-4 h-12 w-12 text-muted-foreground opacity-40" />
            <p className="text-lg font-medium">Pick a program and a subject</p>
            <p className="mt-1 text-sm text-muted-foreground">
              The CO editor and mapping matrices load once both are chosen.
            </p>
          </div>
        </SectionPanel>
      ) : outcomesLoading ? (
        <>
          <Skeleton className="h-64 rounded-2xl" />
          <Skeleton className="h-64 rounded-2xl" />
        </>
      ) : (
        <>
          <SectionPanel
            eyebrow="Course outcomes"
            title={subject ? `COs for ${subject.name}` : 'COs'}
            description="Codes are positional — reordering or removing a CO renumbers the ones after it."
            action={
              canEdit ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1"
                  onClick={addCo}
                  disabled={state.cos.length >= MAX_COS}
                >
                  <Plus className="h-3 w-3" />
                  Add CO
                </Button>
              ) : null
            }
          >
            <div className="space-y-3">
              {state.cos.map((co, i) => (
                <div
                  key={co.key}
                  className="grid gap-3 rounded-xl border bg-muted/20 p-3 md:grid-cols-[64px_1fr_190px_40px] md:items-start"
                >
                  <Badge variant="outline" className="h-9 justify-center font-mono">
                    CO{i + 1}
                  </Badge>
                  <Textarea
                    rows={2}
                    className="text-sm"
                    placeholder="Analyse the time and space complexity of standard sorting algorithms."
                    value={co.statement}
                    disabled={!canEdit}
                    onChange={(e) => updateCo(co.key, { statement: e.target.value })}
                  />
                  <Select
                    value={String(co.bloomLevel)}
                    disabled={!canEdit}
                    onValueChange={(v) => updateCo(co.key, { bloomLevel: Number(v) })}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {BLOOM_LEVELS.map((b) => (
                        <SelectItem key={b.level} value={String(b.level)}>
                          {b.code} · {b.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-9 w-9"
                    aria-label={`Remove CO${i + 1}`}
                    disabled={!canEdit}
                    onClick={() => removeCo(co.key)}
                  >
                    <Trash2 className="h-4 w-4 text-rose-500" />
                  </Button>
                </div>
              ))}

              {state.cos.length === 0 && (
                <p className="text-sm italic text-muted-foreground">
                  No course outcomes yet. Most subjects declare four to six.
                </p>
              )}

              <p className="text-[11px] text-muted-foreground">
                Removing a CO also drops its mapping cells. Up to {MAX_COS} COs per subject.
              </p>
            </div>
          </SectionPanel>

          <SectionPanel
            eyebrow="CO → PO mapping"
            title="Program outcome matrix"
            description="Rate how strongly each CO contributes to each PO. Leave a cell blank when there is no meaningful contribution — inflated matrices are the most common audit finding."
          >
            <MappingMatrix
              cos={matrixCos}
              targets={(program?.pos ?? []).map((po) => ({
                id: po._id,
                code: po.code,
                title: po.title,
              }))}
              cells={state.poCells}
              disabled={!canEdit}
              onChange={(poCells) => setState((prev) => ({ ...prev, poCells }))}
              emptyMessage="Add course outcomes above to start mapping."
            />
          </SectionPanel>

          <SectionPanel
            eyebrow="CO → PSO mapping"
            title="Program specific outcome matrix"
            description="Same scale, against this program's discipline-specific outcomes."
          >
            <MappingMatrix
              cos={matrixCos}
              targets={(program?.psos ?? []).map((pso) => ({
                id: pso._id,
                code: pso.code,
                title: pso.statement,
              }))}
              cells={state.psoCells}
              disabled={!canEdit}
              onChange={(psoCells) => setState((prev) => ({ ...prev, psoCells }))}
              emptyMessage="This program has no PSOs defined yet."
            />
          </SectionPanel>
        </>
      )}
    </div>
  );
}
