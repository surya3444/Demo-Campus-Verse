'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  BarChart3,
  CalendarClock,
  ChevronDown,
  Download,
  Loader2,
  Lock,
  LockOpen,
  MessageSquareText,
  Save,
  Sigma,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { obeApi } from '@/lib/api';
import { usePermissions } from '@/hooks/usePermissions';
import { cn, getErrorMessage } from '@/lib/utils';
import {
  downloadBlob,
  formatAttainment,
  type AttainmentPerInstrument,
  type AttainmentReport,
  type OfferingDetail,
  type OutcomeAttainment,
} from '@/components/obe/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import { KpiStrip, type KpiItem } from '@/components/exams/KpiStrip';

/** The 409 body carries `error.details` — entries are usually strings but never trust that. */
function readGaps(error: unknown): string[] {
  const shaped = error as {
    response?: { status?: number; data?: { error?: { code?: string; details?: unknown } } };
  };
  if (shaped?.response?.data?.error?.code !== 'ATTAINMENT_DATA_GAPS') return [];
  const details = shaped.response?.data?.error?.details;
  if (!Array.isArray(details)) return [];
  return details.map((entry) => {
    if (typeof entry === 'string') return entry;
    const obj = entry as { message?: unknown; text?: unknown };
    if (typeof obj?.message === 'string') return obj.message;
    if (typeof obj?.text === 'string') return obj.text;
    return JSON.stringify(entry);
  });
}

function isNotComputed(error: unknown) {
  const shaped = error as {
    response?: { status?: number; data?: { error?: { code?: string } } };
  };
  return (
    shaped?.response?.status === 404 ||
    shaped?.response?.data?.error?.code === 'ATTAINMENT_NOT_COMPUTED'
  );
}

export function AttainmentTab({ offering }: { offering: OfferingDetail }) {
  const offeringId = offering._id;
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const canCompute = hasPermission('obe.attainment', 'compute');
  const canEditActions = hasPermission('obe.attainment', 'edit');
  const canFinalize = hasPermission('obe.offerings', 'finalize');
  const canExport = hasPermission('obe.reports', 'export');

  const [gaps, setGaps] = useState<string[]>([]);
  const [confirm, setConfirm] = useState<'finalize' | 'reopen' | null>(null);
  const [actions, setActions] = useState<Record<string, string>>({});
  const [exporting, setExporting] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['obe-attainment', offeringId],
    queryFn: () => obeApi.getAttainment(offeringId),
    retry: false,
  });

  const report: AttainmentReport | undefined = data?.data;

  useEffect(() => {
    if (!report) return;
    const next: Record<string, string> = {};
    for (const co of report.perCo) {
      next[co.coId] = report.coCorrectiveActions.find((a) => a.coId === co.coId)?.text ?? '';
    }
    setActions(next);
  }, [report]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['obe-attainment', offeringId] });
    queryClient.invalidateQueries({ queryKey: ['obe-offering', offeringId] });
  };

  const computeMutation = useMutation({
    mutationFn: (force: boolean) => obeApi.computeAttainment(offeringId, force),
    onSuccess: () => {
      setGaps([]);
      toast.success('Attainment computed');
      invalidate();
    },
    onError: (err) => {
      const found = readGaps(err);
      if (found.length > 0) {
        setGaps(found);
        return;
      }
      toast.error(getErrorMessage(err));
    },
  });

  const actionsMutation = useMutation({
    mutationFn: () =>
      obeApi.updateCoCorrectiveActions(
        offeringId,
        (report?.perCo ?? []).map((co) => ({ coId: co.coId, text: actions[co.coId] ?? '' }))
      ),
    onSuccess: () => {
      toast.success('Corrective actions saved');
      queryClient.invalidateQueries({ queryKey: ['obe-attainment', offeringId] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const statusMutation = useMutation({
    mutationFn: (next: 'finalize' | 'reopen') =>
      next === 'finalize' ? obeApi.finalizeOffering(offeringId) : obeApi.reopenOffering(offeringId),
    onSuccess: (_res, next) => {
      toast.success(next === 'finalize' ? 'Offering finalized' : 'Offering reopened');
      setConfirm(null);
      invalidate();
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const exportReport = async () => {
    setExporting(true);
    try {
      const blob = await obeApi.exportOfferingReport(offeringId);
      const slug = `${offering.subjectCode}-${offering.termName}`.replace(/\s+/g, '');
      downloadBlob(blob, `obe-${slug}.csv`);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setExporting(false);
    }
  };

  const gapDialog = (
    <AlertDialog open={gaps.length > 0} onOpenChange={(open) => !open && setGaps([])}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Some data is still missing</AlertDialogTitle>
          <AlertDialogDescription>
            Computing now treats the gaps below as no contribution. You can fill the marks in first,
            or compute anyway and recompute once the rest arrives.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <ul className="max-h-56 space-y-2 overflow-y-auto rounded-xl border bg-muted/30 p-4 text-sm">
          {gaps.map((gap, i) => (
            <li key={i} className="flex gap-2">
              <span className="font-mono text-xs text-muted-foreground">{i + 1}.</span>
              <span>{gap}</span>
            </li>
          ))}
        </ul>
        <AlertDialogFooter>
          <AlertDialogCancel>Go back</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              computeMutation.mutate(true);
            }}
          >
            Compute anyway
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32 rounded-2xl" />
        <Skeleton className="h-72 rounded-2xl" />
      </div>
    );
  }

  if (!report) {
    if (error && !isNotComputed(error)) {
      return (
        <SectionPanel>
          <p className="py-8 text-center text-sm text-destructive">{getErrorMessage(error)}</p>
        </SectionPanel>
      );
    }
    return (
      <>
        {gapDialog}
        <SectionPanel>
          <div className="flex flex-col items-center justify-center py-14 text-center">
            <BarChart3 className="mb-4 h-12 w-12 text-muted-foreground opacity-40" />
            <p className="text-lg font-medium">Attainment hasn&apos;t been computed yet</p>
            <p className="mt-2 max-w-prose text-sm text-muted-foreground">
              Computing reads the marks captured against this offering&apos;s instruments — the
              internal components and the linked end-semester paper — along with any exit survey
              responses, and turns them into CO, PO and PSO attainment levels.
            </p>
            {canCompute ? (
              <Button
                className="mt-6 gap-2"
                disabled={computeMutation.isPending}
                onClick={() => computeMutation.mutate(false)}
              >
                {computeMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sigma className="h-4 w-4" />
                )}
                Compute attainment
              </Button>
            ) : (
              <p className="mt-6 text-xs text-muted-foreground">
                You don&apos;t have permission to compute attainment.
              </p>
            )}
          </div>
        </SectionPanel>
      </>
    );
  }

  const { settingsUsed } = report;
  const isFinal = report.isFinal || report.offeringStatus === 'finalized';
  const chartData = report.perCo.map((co) => ({
    code: co.code,
    overall: co.overallAttainment ?? 0,
  }));

  const kpis: KpiItem[] = [
    {
      label: 'Computed at',
      value: (
        <span className="text-lg font-semibold leading-snug">
          {new Date(report.computedAt).toLocaleString('en-IN')}
        </span>
      ),
      footnote: isFinal ? 'Finalized — figures are frozen' : 'Recompute after any marks change',
      icon: CalendarClock,
    },
    { label: 'Cohort', value: report.cohortSize, footnote: 'students in scope', icon: Users },
    {
      label: 'Survey responses',
      value: report.surveyRespondents,
      footnote:
        report.cohortSize > 0
          ? `${Math.round((report.surveyRespondents / report.cohortSize) * 100)}% of the cohort`
          : 'no cohort yet',
      icon: MessageSquareText,
    },
    {
      label: 'Course average CO',
      value: formatAttainment(report.courseAverageCoAttainment),
      footnote: `target ${settingsUsed.targetAttainmentLevel} · max ${settingsUsed.maxAttainmentLevel}`,
      icon: Sigma,
      accent: true,
    },
  ];

  return (
    <div className="space-y-6">
      {gapDialog}

      <AlertDialog open={confirm !== null} onOpenChange={(open) => !open && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm === 'reopen' ? 'Reopen this offering?' : 'Finalize this offering?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm === 'reopen'
                ? 'Reopening unlocks the marks behind this report so they can be edited again. The figures on screen stay until someone recomputes, and program rollups will treat this course as provisional.'
                : 'Finalizing freezes these computed figures and the marks behind them. Marks entry and recomputation stay locked until the offering is reopened, and the numbers become eligible for program-level attainment rollups.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (confirm) statusMutation.mutate(confirm);
              }}
            >
              {confirm === 'reopen' ? 'Reopen' : 'Finalize'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="flex flex-wrap items-center justify-end gap-2">
        {canExport && (
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            disabled={exporting}
            onClick={exportReport}
          >
            {exporting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
            Export CSV
          </Button>
        )}
        {canCompute && !isFinal && (
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            disabled={computeMutation.isPending}
            onClick={() => computeMutation.mutate(false)}
          >
            {computeMutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sigma className="h-3.5 w-3.5" />
            )}
            Recompute
          </Button>
        )}
        {canFinalize && isFinal && (
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            disabled={statusMutation.isPending}
            onClick={() => setConfirm('reopen')}
          >
            <LockOpen className="h-3.5 w-3.5" />
            Reopen
          </Button>
        )}
        {canFinalize && !isFinal && offering.status === 'computed' && (
          <Button
            size="sm"
            className="gap-2"
            disabled={statusMutation.isPending}
            onClick={() => setConfirm('finalize')}
          >
            <Lock className="h-3.5 w-3.5" />
            Finalize
          </Button>
        )}
      </div>

      <KpiStrip items={kpis} ariaLabel="Attainment summary" />

      <SectionPanel
        eyebrow="Course outcomes"
        title="Attainment per CO"
        description="Internal and external levels combine into a direct figure; the exit survey supplies the indirect one. Overall is the weighted blend of the two."
        flush
      >
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>CO</TableHead>
                <TableHead className="text-right">Internal (IE)</TableHead>
                <TableHead className="text-right">External (EE)</TableHead>
                <TableHead className="text-right">Direct</TableHead>
                <TableHead className="text-right">Indirect</TableHead>
                <TableHead className="text-right">Overall</TableHead>
                <TableHead className="text-right">Target</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.perCo.map((co) => (
                <TableRow key={co.coId}>
                  <TableCell className="font-mono font-medium">{co.code}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatAttainment(co.internalAttainment)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatAttainment(co.externalAttainment)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatAttainment(co.directAttainment)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatAttainment(co.indirectAttainment)}
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">
                    {formatAttainment(co.overallAttainment)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge
                      variant="outline"
                      size="sm"
                      className={cn(
                        co.targetMet
                          ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                          : 'text-muted-foreground'
                      )}
                    >
                      {co.targetMet ? 'Met' : 'Below'}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              {report.perCo.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-sm text-muted-foreground">
                    This subject has no course outcomes defined.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </SectionPanel>

      <SectionPanel
        eyebrow="Chart"
        title="Overall attainment against target"
        description={`The dashed line sits at the target level of ${settingsUsed.targetAttainmentLevel} on a ${settingsUsed.maxAttainmentLevel}-point scale.`}
      >
        {chartData.length === 0 ? (
          <p className="py-8 text-center text-sm italic text-muted-foreground">
            No course outcomes to chart.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData} barCategoryGap="28%">
              <CartesianGrid strokeDasharray="2 4" stroke="hsl(var(--border))" vertical={false} />
              <XAxis
                dataKey="code"
                axisLine={false}
                tickLine={false}
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
              />
              <YAxis
                domain={[0, settingsUsed.maxAttainmentLevel]}
                axisLine={false}
                tickLine={false}
                width={32}
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
              />
              <Tooltip
                cursor={{ fill: 'hsl(var(--muted) / 0.4)' }}
                formatter={(value: number) => [value.toFixed(2), 'Overall']}
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '10px',
                  fontSize: 12,
                }}
              />
              <ReferenceLine
                y={settingsUsed.targetAttainmentLevel}
                stroke="hsl(var(--muted-foreground))"
                strokeDasharray="4 4"
                label={{
                  value: 'Target',
                  position: 'insideTopRight',
                  fill: 'hsl(var(--muted-foreground))',
                  fontSize: 10,
                }}
              />
              <Bar
                dataKey="overall"
                name="Overall"
                fill="hsl(var(--primary))"
                radius={[6, 6, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </SectionPanel>

      <SectionPanel
        eyebrow="Annexure"
        title="How each instrument scored"
        description="The working behind the CO levels — component by component, which is what an accreditation file asks for."
      >
        <div className="space-y-3">
          {report.perInstrument.length === 0 ? (
            <p className="text-sm italic text-muted-foreground">No instruments contributed.</p>
          ) : (
            report.perInstrument.map((instrument) => (
              <InstrumentBlock key={instrument.instrumentId} instrument={instrument} />
            ))
          )}
        </div>
      </SectionPanel>

      <div className="grid gap-6 xl:grid-cols-2">
        <OutcomeTable
          eyebrow="Program outcomes"
          title="PO attainment"
          description="Each CO's overall level flows into the POs it maps to, weighted by mapping strength."
          rows={report.poAttainment}
        />
        {report.psoAttainment.length > 0 && (
          <OutcomeTable
            eyebrow="Program specific outcomes"
            title="PSO attainment"
            description="The same rollup against this program's discipline-specific outcomes."
            rows={report.psoAttainment}
          />
        )}
      </div>

      <SectionPanel
        eyebrow="Closing the loop"
        title="Corrective actions"
        description="Note what will change next time a CO falls short. Reviewers read this section before they read the numbers."
        action={
          canEditActions && !isFinal ? (
            <Button
              size="sm"
              className="gap-2"
              disabled={actionsMutation.isPending}
              onClick={() => actionsMutation.mutate()}
            >
              {actionsMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              Save actions
            </Button>
          ) : null
        }
      >
        <div className="space-y-3">
          {report.perCo.map((co) => (
            <div
              key={co.coId}
              className="grid gap-3 rounded-xl border bg-muted/20 p-3 md:grid-cols-[72px_1fr] md:items-start"
            >
              <Badge variant="outline" className="h-9 justify-center font-mono">
                {co.code}
              </Badge>
              <Textarea
                rows={2}
                className="text-sm"
                placeholder={
                  co.targetMet
                    ? 'Optional — what kept this CO above target?'
                    : 'e.g. add a tutorial on recurrence relations before the second internal.'
                }
                value={actions[co.coId] ?? ''}
                disabled={!canEditActions || isFinal}
                onChange={(e) => setActions((prev) => ({ ...prev, [co.coId]: e.target.value }))}
              />
            </div>
          ))}
          {report.perCo.length === 0 && (
            <p className="text-sm italic text-muted-foreground">No course outcomes to act on.</p>
          )}
          {isFinal && (
            <p className="text-[11px] text-muted-foreground">
              This offering is finalized — reopen it to edit the corrective actions.
            </p>
          )}
        </div>
      </SectionPanel>
    </div>
  );
}

function InstrumentBlock({ instrument }: { instrument: AttainmentPerInstrument }) {
  const [open, setOpen] = useState(false);
  const items = instrument.items ?? [];
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="rounded-xl border bg-muted/20">
      <CollapsibleTrigger className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{instrument.name}</p>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {instrument.kind} ·{' '}
            {instrument.kind === 'external' ? 'end-semester paper' : `${items.length} components`}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {instrument.kind === 'external' && instrument.external && (
            <span className="font-mono text-sm tabular-nums">L{instrument.external.level}</span>
          )}
          <ChevronDown
            className={cn(
              'h-4 w-4 text-muted-foreground transition-transform',
              open && 'rotate-180'
            )}
          />
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="overflow-x-auto border-t">
          {instrument.kind === 'external' ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">Present</TableHead>
                  <TableHead className="text-right">Passed</TableHead>
                  <TableHead className="text-right">% passed</TableHead>
                  <TableHead className="text-right">Level</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {instrument.external ? (
                  <TableRow>
                    <TableCell className="text-right tabular-nums">
                      {instrument.external.present}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {instrument.external.passed}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {instrument.external.percentPassed.toFixed(1)}%
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {instrument.external.level}
                    </TableCell>
                  </TableRow>
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                      No exam results recorded.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Set</TableHead>
                  <TableHead>Component</TableHead>
                  <TableHead className="text-center">COs</TableHead>
                  <TableHead className="text-right">Max</TableHead>
                  <TableHead className="text-right">Attempted</TableHead>
                  <TableHead className="text-right">Cleared</TableHead>
                  <TableHead className="text-right">% cleared</TableHead>
                  <TableHead className="text-right">Level</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item, i) => (
                  <TableRow key={`${item.setLabel}-${item.label}-${i}`}>
                    <TableCell className="text-xs text-muted-foreground">{item.setLabel}</TableCell>
                    <TableCell className="font-medium">{item.label}</TableCell>
                    <TableCell className="text-center font-mono text-xs tabular-nums">
                      {item.coIds.length}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{item.maxMarks}</TableCell>
                    <TableCell className="text-right tabular-nums">{item.attempted}</TableCell>
                    <TableCell className="text-right tabular-nums">{item.cleared}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {item.percentCleared.toFixed(1)}%
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {item.level}
                    </TableCell>
                  </TableRow>
                ))}
                {items.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-sm text-muted-foreground">
                      No components recorded.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function OutcomeTable({
  eyebrow,
  title,
  description,
  rows,
}: {
  eyebrow: string;
  title: string;
  description: string;
  rows: OutcomeAttainment[];
}) {
  return (
    <SectionPanel eyebrow={eyebrow} title={title} description={description} flush>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead className="text-right">Weighted avg</TableHead>
              <TableHead className="text-right">Attainment</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.outcomeId}>
                <TableCell className="font-mono font-medium">{row.code}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatAttainment(row.weightedAverage)}
                </TableCell>
                <TableCell className="text-right font-semibold tabular-nums">
                  {formatAttainment(row.attainment)}
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-sm text-muted-foreground">
                  Nothing mapped yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </SectionPanel>
  );
}
