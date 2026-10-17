'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Loader2, Pencil, Plus, Save, Target, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  MAX_CUSTOM_POS,
  OBE_PO_PRESETS,
  type ObeProgramPreset,
} from '@campus-verse/shared/constants';
import { obeApi, type ObePoPayload, type ObePsoPayload } from '@/lib/api';
import { usePermissions } from '@/hooks/usePermissions';
import { getErrorMessage } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EditorialHeader } from '@/components/exams/EditorialHeader';
import { SectionPanel } from '@/components/exams/SectionPanel';
import { Field } from '@/components/exams/Field';
import { ProgramAttainmentTab } from './components/ProgramAttainmentTab';

interface ProgramDetail {
  _id: string;
  departmentCode: string;
  name: string;
  preset: ObeProgramPreset;
  pos: ObePoPayload[];
  psos: ObePsoPayload[];
}

interface EditState {
  name: string;
  pos: ObePoPayload[];
  psos: ObePsoPayload[];
}

const toEditState = (program: ProgramDetail): EditState => ({
  name: program.name,
  pos: program.pos.map((po) => ({ ...po })),
  psos: program.psos.map((pso) => ({ ...pso })),
});

/** PSO codes and order are positional — recompute them after every add/remove. */
const renumberPsos = (psos: ObePsoPayload[]): ObePsoPayload[] =>
  psos.map((pso, i) => ({ ...pso, code: `PSO${i + 1}`, order: i }));

export default function ObeProgramDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const canEdit = hasPermission('obe.programs', 'edit');

  const [state, setState] = useState<EditState | null>(null);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameDraft, setRenameDraft] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['obe-program', id],
    queryFn: () => obeApi.getProgram(id),
    enabled: !!id,
  });

  const program: ProgramDetail | undefined = data?.data;

  useEffect(() => {
    if (program) setState(toEditState(program));
  }, [program]);

  const saveMutation = useMutation({
    mutationFn: (payload: EditState) =>
      obeApi.updateProgram(id, {
        name: payload.name.trim(),
        pos: payload.pos,
        psos: payload.psos,
      }),
    onSuccess: () => {
      toast.success('Program saved');
      queryClient.invalidateQueries({ queryKey: ['obe-program', id] });
      queryClient.invalidateQueries({ queryKey: ['obe-programs'] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const isDirty = useMemo(() => {
    if (!program || !state) return false;
    return JSON.stringify(toEditState(program)) !== JSON.stringify(state);
  }, [program, state]);

  const customCount = state?.pos.filter((po) => po.isCustom).length ?? 0;

  if (isLoading || !state || !program) {
    return (
      <div className="space-y-8 pb-12">
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-[420px] rounded-2xl" />
      </div>
    );
  }

  const updatePo = (index: number, patch: Partial<ObePoPayload>) =>
    setState({
      ...state,
      pos: state.pos.map((po, i) => (i === index ? { ...po, ...patch } : po)),
    });

  const addCustomPo = () =>
    setState({
      ...state,
      pos: [
        ...state.pos,
        {
          code: `PO${state.pos.length + 1}`,
          title: '',
          statement: '',
          isCustom: true,
          order: state.pos.length,
        },
      ],
    });

  const removePo = (index: number) =>
    setState({
      ...state,
      pos: state.pos.filter((_, i) => i !== index).map((po, i) => ({ ...po, order: i })),
    });

  const updatePso = (index: number, statement: string) =>
    setState({
      ...state,
      psos: state.psos.map((pso, i) => (i === index ? { ...pso, statement } : pso)),
    });

  const addPso = () =>
    setState({
      ...state,
      psos: renumberPsos([...state.psos, { code: '', statement: '', order: state.psos.length }]),
    });

  const removePso = (index: number) =>
    setState({ ...state, psos: renumberPsos(state.psos.filter((_, i) => i !== index)) });

  const hasBlankRow =
    state.pos.some((po) => !po.code.trim() || !po.title.trim() || !po.statement.trim()) ||
    state.psos.some((pso) => !pso.statement.trim());

  return (
    <div className="space-y-8 pb-12">
      <EditorialHeader
        eyebrow="OBE · Program"
        meta={program.departmentCode}
        icon={Target}
        title={state.name}
        description="Program Outcomes describe what every graduate of this program can do. Course outcomes are mapped against them to prove attainment."
        actions={
          <>
            <Link href="/obe/programs">
              <Button variant="outline" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                All programs
              </Button>
            </Link>
            {canEdit && (
              <>
                <Button
                  variant="outline"
                  className="gap-2"
                  onClick={() => {
                    setRenameDraft(state.name);
                    setRenameOpen(true);
                  }}
                >
                  <Pencil className="h-4 w-4" />
                  Rename
                </Button>
                <Button
                  className="gap-2"
                  disabled={!isDirty || hasBlankRow || saveMutation.isPending}
                  onClick={() => saveMutation.mutate(state)}
                >
                  {saveMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Save changes
                </Button>
              </>
            )}
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="font-mono">
          {program.departmentCode}
        </Badge>
        <Badge variant="outline">{OBE_PO_PRESETS[program.preset]?.name ?? program.preset}</Badge>
        <Badge variant="outline">{state.pos.length} POs</Badge>
        <Badge variant="outline">{state.psos.length} PSOs</Badge>
        {hasBlankRow && (
          <span className="text-xs text-amber-600">
            Every PO needs a code, title and statement; every PSO needs a statement.
          </span>
        )}
      </div>

      <Tabs defaultValue="definitions" className="space-y-6">
        <TabsList>
          <TabsTrigger value="definitions">Definitions</TabsTrigger>
          <TabsTrigger value="attainment">Attainment</TabsTrigger>
        </TabsList>

        <TabsContent value="definitions" className="space-y-8">
          <SectionPanel
            eyebrow="Program outcomes"
            title="POs"
            description={`Preset outcomes keep their code and title — edit the statement to match your program's wording. You may add up to ${MAX_CUSTOM_POS} custom POs on top.`}
            action={
              canEdit ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1"
                  onClick={addCustomPo}
                  disabled={customCount >= MAX_CUSTOM_POS}
                >
                  <Plus className="h-3 w-3" />
                  Add custom PO
                </Button>
              ) : null
            }
          >
            <div className="space-y-3">
              {state.pos.map((po, i) => (
                <div key={po._id ?? `new-${i}`} className="rounded-xl border bg-muted/20 p-3">
                  <div className="flex items-start gap-3">
                    <div className="grid flex-1 gap-3 sm:grid-cols-[120px_1fr]">
                      <Input
                        className="h-9 font-mono text-sm uppercase"
                        value={po.code}
                        disabled={!canEdit || !po.isCustom}
                        onChange={(e) => updatePo(i, { code: e.target.value.toUpperCase() })}
                      />
                      <Input
                        className="h-9"
                        placeholder="Short title, e.g. Problem Analysis"
                        value={po.title}
                        disabled={!canEdit || !po.isCustom}
                        onChange={(e) => updatePo(i, { title: e.target.value })}
                      />
                    </div>
                    {po.isCustom ? (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-9 w-9 shrink-0"
                        aria-label={`Remove ${po.code}`}
                        disabled={!canEdit}
                        onClick={() => removePo(i)}
                      >
                        <Trash2 className="h-4 w-4 text-rose-500" />
                      </Button>
                    ) : (
                      <span className="w-9 shrink-0" />
                    )}
                  </div>
                  <Textarea
                    rows={2}
                    className="mt-3 text-sm"
                    placeholder="What a graduate is able to do."
                    value={po.statement}
                    disabled={!canEdit}
                    onChange={(e) => updatePo(i, { statement: e.target.value })}
                  />
                  {po.isCustom && (
                    <Badge variant="outline" className="mt-2 text-[10px]">
                      Custom
                    </Badge>
                  )}
                </div>
              ))}
              {state.pos.length === 0 && (
                <p className="text-sm italic text-muted-foreground">
                  This program has no POs yet. Add custom ones to get started.
                </p>
              )}
            </div>
          </SectionPanel>

          <SectionPanel
            eyebrow="Program specific outcomes"
            title="PSOs"
            description="Two or three statements specific to this discipline. Codes are assigned by position."
            action={
              canEdit ? (
                <Button size="sm" variant="outline" className="gap-1" onClick={addPso}>
                  <Plus className="h-3 w-3" />
                  Add PSO
                </Button>
              ) : null
            }
          >
            <div className="space-y-3">
              {state.psos.map((pso, i) => (
                <div key={pso._id ?? `new-${i}`} className="flex items-start gap-3">
                  <Badge variant="outline" className="mt-2 shrink-0 font-mono">
                    {pso.code || `PSO${i + 1}`}
                  </Badge>
                  <Textarea
                    rows={2}
                    className="flex-1 text-sm"
                    placeholder="Apply data-science techniques to build and evaluate predictive models."
                    value={pso.statement}
                    disabled={!canEdit}
                    onChange={(e) => updatePso(i, e.target.value)}
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    className="mt-1 h-9 w-9 shrink-0"
                    aria-label={`Remove ${pso.code || `PSO${i + 1}`}`}
                    disabled={!canEdit}
                    onClick={() => removePso(i)}
                  >
                    <Trash2 className="h-4 w-4 text-rose-500" />
                  </Button>
                </div>
              ))}
              {state.psos.length === 0 && (
                <p className="text-sm italic text-muted-foreground">
                  No PSOs defined. PG programs often skip these.
                </p>
              )}
            </div>
          </SectionPanel>
        </TabsContent>

        <TabsContent value="attainment">
          <ProgramAttainmentTab programId={id} />
        </TabsContent>
      </Tabs>

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Rename program</DialogTitle>
            <DialogDescription>
              The department code stays fixed — it links this program to your academic structure.
            </DialogDescription>
          </DialogHeader>
          <Field label="Program name" required>
            <Input value={renameDraft} onChange={(e) => setRenameDraft(e.target.value)} />
          </Field>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!renameDraft.trim()}
              onClick={() => {
                setState({ ...state, name: renameDraft.trim() });
                setRenameOpen(false);
              }}
            >
              Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
