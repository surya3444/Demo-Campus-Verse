'use client';

import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Save, Scale, Sliders, Target, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import { DEFAULT_OBE_SETTINGS, type ObeSettingsValues } from '@campus-verse/shared/constants';
import { obeApi } from '@/lib/api';
import { usePermissions } from '@/hooks/usePermissions';
import { getErrorMessage } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { EditorialHeader } from '@/components/exams/EditorialHeader';
import { SectionPanel } from '@/components/exams/SectionPanel';
import { Field } from '@/components/exams/Field';

type BandKey = 'internalLevelBands' | 'externalLevelBands';

const weightsSumToOne = (a: number, b: number) => Math.abs(a + b - 1) < 1e-9;

export default function ObeSettingsPage() {
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const canEdit = hasPermission('obe.settings', 'edit');
  const [state, setState] = useState<ObeSettingsValues | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['obe-settings'],
    queryFn: () => obeApi.getSettings(),
  });

  useEffect(() => {
    if (data?.data) setState({ ...DEFAULT_OBE_SETTINGS, ...data.data });
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: () => obeApi.updateSettings(state as unknown as Record<string, unknown>),
    onSuccess: () => {
      toast.success('OBE settings saved');
      queryClient.invalidateQueries({ queryKey: ['obe-settings'] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  if (isLoading || !state) {
    return (
      <div className="space-y-8 pb-12">
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  const updateBand = (key: BandKey, index: number, minPercent: number) =>
    setState({
      ...state,
      [key]: state[key].map((band, i) => (i === index ? { ...band, minPercent } : band)),
    });

  const directOk = weightsSumToOne(state.directWeights.internal, state.directWeights.external);
  const overallOk = weightsSumToOne(state.overallWeights.direct, state.overallWeights.indirect);
  const bandsAscending = (key: BandKey) =>
    state[key].every((band, i) => i === 0 || band.minPercent > state[key][i - 1].minPercent);
  const bandsOk = bandsAscending('internalLevelBands') && bandsAscending('externalLevelBands');
  const canSave = canEdit && directOk && overallOk && bandsOk;

  return (
    <div className="space-y-8 pb-12">
      <EditorialHeader
        eyebrow="OBE · Settings"
        meta="/obe/settings"
        icon={Sliders}
        title="Attainment settings"
        description="These numbers drive every attainment calculation in the module: when a student is counted as having cleared a component, how the cleared-percentage becomes a level, and how internal, external and survey results are weighed."
        actions={
          canEdit ? (
            <Button
              className="gap-2"
              disabled={!canSave || saveMutation.isPending}
              onClick={() => saveMutation.mutate()}
            >
              {saveMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save changes
            </Button>
          ) : null
        }
      />

      {!canEdit && (
        <p className="rounded-xl border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          You can view these settings but not change them.
        </p>
      )}

      <SectionPanel
        eyebrow="Internal assessment"
        title="Threshold and level bands"
        description="A student clears an internal question or component when they score more than the threshold percentage of its maximum marks. The share of attempting students who clear it then maps to an attainment level."
        action={<Scale className="h-5 w-5 text-muted-foreground" />}
      >
        <div className="grid gap-6 md:grid-cols-[220px_1fr]">
          <Field
            label="Clearing threshold %"
            hint="Applies to every internal component unless an instrument overrides it."
          >
            <Input
              type="number"
              min={0}
              max={100}
              className="tabular-nums"
              disabled={!canEdit}
              value={state.internalThresholdPercent}
              onChange={(e) =>
                setState({ ...state, internalThresholdPercent: Number(e.target.value) || 0 })
              }
            />
          </Field>
          <BandRows
            bands={state.internalLevelBands}
            disabled={!canEdit}
            ascending={bandsAscending('internalLevelBands')}
            hint="% of attempting students who cleared the threshold"
            onChange={(i, v) => updateBand('internalLevelBands', i, v)}
          />
        </div>
      </SectionPanel>

      <SectionPanel
        eyebrow="External assessment"
        title="Level bands"
        description="For the end-semester exam, the level comes from the share of students who scored at or above the paper's pass marks."
        action={<TrendingUp className="h-5 w-5 text-muted-foreground" />}
      >
        <BandRows
          bands={state.externalLevelBands}
          disabled={!canEdit}
          ascending={bandsAscending('externalLevelBands')}
          hint="% of students at or above pass marks"
          onChange={(i, v) => updateBand('externalLevelBands', i, v)}
        />
      </SectionPanel>

      <SectionPanel
        eyebrow="Weights"
        title="How the pieces combine"
        description="Direct attainment blends internal and external results; overall attainment blends that direct figure with the indirect (survey) one. Each pair must sum to 1."
      >
        <div className="grid gap-8 md:grid-cols-2">
          <WeightPair
            label="Direct attainment"
            hint="Internal × w + external × w"
            aLabel="Internal"
            bLabel="External"
            a={state.directWeights.internal}
            b={state.directWeights.external}
            ok={directOk}
            disabled={!canEdit}
            onChange={(internal, external) =>
              setState({ ...state, directWeights: { internal, external } })
            }
          />
          <WeightPair
            label="Overall attainment"
            hint="Direct × w + indirect (survey) × w"
            aLabel="Direct"
            bLabel="Indirect"
            a={state.overallWeights.direct}
            b={state.overallWeights.indirect}
            ok={overallOk}
            disabled={!canEdit}
            onChange={(direct, indirect) =>
              setState({ ...state, overallWeights: { direct, indirect } })
            }
          />
        </div>
      </SectionPanel>

      <SectionPanel
        eyebrow="Targets"
        title="What counts as attained"
        description="The target is the bar a CO must reach to be considered attained; the maximum is the top of the scale — it divides the PO formula and caps survey ratings."
        action={<Target className="h-5 w-5 text-muted-foreground" />}
      >
        <div className="grid gap-5 md:grid-cols-2">
          <Field label="Target attainment level" hint="Commonly 2 on a 3-point scale.">
            <Input
              type="number"
              min={0}
              max={10}
              step={0.1}
              className="tabular-nums"
              disabled={!canEdit}
              value={state.targetAttainmentLevel}
              onChange={(e) =>
                setState({ ...state, targetAttainmentLevel: Number(e.target.value) || 0 })
              }
            />
          </Field>
          <Field label="Maximum attainment level" hint="Scale maximum — 3 for the NBA convention.">
            <Input
              type="number"
              min={1}
              max={10}
              className="tabular-nums"
              disabled={!canEdit}
              value={state.maxAttainmentLevel}
              onChange={(e) =>
                setState({ ...state, maxAttainmentLevel: Number(e.target.value) || 1 })
              }
            />
          </Field>
        </div>
      </SectionPanel>
    </div>
  );
}

function BandRows({
  bands,
  hint,
  ascending,
  disabled,
  onChange,
}: {
  bands: ObeSettingsValues['internalLevelBands'];
  hint: string;
  ascending: boolean;
  disabled: boolean;
  onChange: (index: number, minPercent: number) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-[80px_1fr] gap-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        <div>Level</div>
        <div>Min %</div>
      </div>
      {bands.map((band, i) => (
        <div key={band.level} className="grid grid-cols-[80px_1fr] items-center gap-3">
          <span className="rounded-lg border bg-muted/30 py-2 text-center font-mono text-sm font-semibold tabular-nums">
            {band.level}
          </span>
          <Input
            type="number"
            min={0}
            max={100}
            className="h-9 tabular-nums"
            disabled={disabled}
            value={band.minPercent}
            onChange={(e) => onChange(i, Number(e.target.value) || 0)}
          />
        </div>
      ))}
      <p className="text-[11px] text-muted-foreground">{hint}</p>
      {!ascending && (
        <p className="text-[11px] text-destructive">
          Each band must have a higher minimum than the one before it.
        </p>
      )}
    </div>
  );
}

function WeightPair({
  label,
  hint,
  aLabel,
  bLabel,
  a,
  b,
  ok,
  disabled,
  onChange,
}: {
  label: string;
  hint: string;
  aLabel: string;
  bLabel: string;
  a: number;
  b: number;
  ok: boolean;
  disabled: boolean;
  onChange: (a: number, b: number) => void;
}) {
  return (
    <div className="space-y-3 rounded-xl border bg-muted/20 p-4">
      <div>
        <p className="text-sm font-semibold">{label}</p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label={aLabel}>
          <Input
            type="number"
            min={0}
            max={1}
            step={0.05}
            className="h-9 tabular-nums"
            disabled={disabled}
            value={a}
            onChange={(e) => onChange(Number(e.target.value) || 0, b)}
          />
        </Field>
        <Field label={bLabel}>
          <Input
            type="number"
            min={0}
            max={1}
            step={0.05}
            className="h-9 tabular-nums"
            disabled={disabled}
            value={b}
            onChange={(e) => onChange(a, Number(e.target.value) || 0)}
          />
        </Field>
      </div>
      <p className={ok ? 'text-[11px] text-muted-foreground' : 'text-[11px] text-destructive'}>
        {ok ? 'Sums to 1.00' : `Must sum to 1 — currently ${(a + b).toFixed(2)}`}
      </p>
    </div>
  );
}
