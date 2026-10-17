'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
import { Download, Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { DEFAULT_OBE_SETTINGS, type ObeSettingsValues } from '@campus-verse/shared/constants';
import { academicApi, obeApi } from '@/lib/api';
import { usePermissions } from '@/hooks/usePermissions';
import { getErrorMessage } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SectionPanel } from '@/components/exams/SectionPanel';
import { Field } from '@/components/exams/Field';
import {
  downloadBlob,
  formatAttainment,
  type ProgramAttainmentReport,
} from '@/components/obe/types';

interface BatchOption {
  _id: string;
  name: string;
  code?: string;
  isCurrent?: boolean;
  terms?: Array<{ _id: string; name: string }>;
}

/** Radix Select cannot hold an empty value — use a sentinel for "no term filter". */
const ALL_TERMS = 'all';

export function ProgramAttainmentTab({ programId }: { programId: string }) {
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const canEditActions = hasPermission('obe.attainment', 'edit');
  const canExport = hasPermission('obe.reports', 'export');

  const [academicBatchId, setAcademicBatchId] = useState('');
  const [termId, setTermId] = useState(ALL_TERMS);
  const [actions, setActions] = useState<Record<string, string>>({});
  const [exporting, setExporting] = useState(false);

  const { data: batchesData } = useQuery({
    queryKey: ['academic-batches'],
    queryFn: () => academicApi.getAcademicBatches(),
  });

  const { data: settingsData } = useQuery({
    queryKey: ['obe-settings'],
    queryFn: () => obeApi.getSettings(),
  });

  const {
    data: reportData,
    isLoading: reportLoading,
    isFetching: reportFetching,
  } = useQuery({
    queryKey: ['obe-program-attainment', programId, academicBatchId, termId],
    queryFn: () =>
      obeApi.getProgramAttainment(programId, {
        academicBatchId,
        ...(termId === ALL_TERMS ? {} : { termId }),
      }),
    enabled: !!programId && !!academicBatchId,
  });

  const batches: BatchOption[] = batchesData?.data || [];
  const settings: ObeSettingsValues = { ...DEFAULT_OBE_SETTINGS, ...(settingsData?.data || {}) };
  const report: ProgramAttainmentReport | undefined = reportData?.data;

  const batch = batches.find((b) => b._id === academicBatchId);
  const terms = batch?.terms ?? [];

  useEffect(() => {
    if (academicBatchId || batches.length === 0) return;
    const current = batches.find((b) => b.isCurrent);
    if (current) setAcademicBatchId(current._id);
  }, [batches, academicBatchId]);

  useEffect(() => {
    const next: Record<string, string> = {};
    for (const a of report?.poCorrectiveActions ?? []) next[a.poId] = a.text;
    setActions(next);
  }, [report]);

  const actionsDirty = useMemo(() => {
    if (!report) return false;
    const saved = new Map(report.poCorrectiveActions.map((a) => [a.poId, a.text]));
    return report.program.pos.some((po) => (actions[po._id] ?? '') !== (saved.get(po._id) ?? ''));
  }, [report, actions]);

  const saveMutation = useMutation({
    mutationFn: () =>
      obeApi.updateProgramCorrectiveActions(programId, {
        academicBatchId,
        actions: (report?.program.pos ?? []).map((po) => ({
          poId: po._id,
          text: (actions[po._id] ?? '').trim(),
        })),
      }),
    onSuccess: () => {
      toast.success('Corrective actions saved');
      queryClient.invalidateQueries({ queryKey: ['obe-program-attainment', programId] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const handleExport = async () => {
    if (!report) return;
    setExporting(true);
    try {
      const blob = await obeApi.exportProgramAttainment(programId, academicBatchId);
      const scope = (batch?.code || batch?.name || 'batch').replace(/\s+/g, '-');
      downloadBlob(blob, `${report.program.departmentCode}-attainment-${scope}.csv`);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setExporting(false);
    }
  };

  const poTitle = (outcomeId: string) =>
    report?.program.pos.find((po) => po._id === outcomeId)?.title ?? '';

  const chartData = (report?.poAggregate ?? []).map((row) => ({
    code: row.code,
    attainment: row.attainment,
  }));

  return (
    <div className="space-y-8">
      <div className="rounded-2xl border bg-card px-5 py-4 shadow-soft">
        <div className="flex flex-wrap items-end gap-4">
          <div className="w-56">
            <Field label="Academic batch" required>
              <Select
                value={academicBatchId}
                onValueChange={(v) => {
                  setAcademicBatchId(v);
                  setTermId(ALL_TERMS);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pick a batch" />
                </SelectTrigger>
                <SelectContent>
                  {batches.map((b) => (
                    <SelectItem key={b._id} value={b._id}>
                      {b.name}
                      {b.isCurrent ? ' · current' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <div className="w-56">
            <Field label="Term" hint="Leave on all terms for the full-year view.">
              <Select value={termId} onValueChange={setTermId} disabled={!academicBatchId}>
                <SelectTrigger>
                  <SelectValue placeholder="All terms" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_TERMS}>All terms</SelectItem>
                  {terms.map((t) => (
                    <SelectItem key={t._id} value={t._id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {reportFetching && !reportLoading && (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            )}
            {canExport && (
              <Button
                variant="outline"
                className="gap-2"
                disabled={!report || exporting}
                onClick={handleExport}
              >
                {exporting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                Export CSV
              </Button>
            )}
          </div>
        </div>
      </div>

      {!academicBatchId ? (
        <SectionPanel>
          <p className="py-8 text-center text-sm italic text-muted-foreground">
            Pick an academic batch to see how this program&apos;s POs and PSOs are being attained.
          </p>
        </SectionPanel>
      ) : reportLoading || !report ? (
        <div className="space-y-8">
          <Skeleton className="h-72 rounded-2xl" />
          <Skeleton className="h-80 rounded-2xl" />
        </div>
      ) : report.courses.length === 0 ? (
        <SectionPanel>
          <p className="py-8 text-center text-sm italic text-muted-foreground">
            No finalized offerings for this batch yet.
          </p>
        </SectionPanel>
      ) : (
        <>
          <SectionPanel
            eyebrow="Program aggregate"
            title="PO & PSO attainment"
            description={`Each figure is the mean over every course that maps the outcome. Target is level ${settings.targetAttainmentLevel} of ${settings.maxAttainmentLevel}.`}
            action={
              canEditActions ? (
                <Button
                  size="sm"
                  className="gap-2"
                  disabled={!actionsDirty || saveMutation.isPending}
                  onClick={() => saveMutation.mutate()}
                >
                  {saveMutation.isPending ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Save className="h-3 w-3" />
                  )}
                  Save actions
                </Button>
              ) : null
            }
          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    <th className="px-3 py-2 text-left">Outcome</th>
                    <th className="px-3 py-2 text-right">Attainment</th>
                    <th className="px-3 py-2 text-right">Courses</th>
                    <th className="px-3 py-2 text-left">Corrective action</th>
                  </tr>
                </thead>
                <tbody>
                  {report.poAggregate.map((row) => {
                    const met =
                      row.attainment != null && row.attainment >= settings.targetAttainmentLevel;
                    return (
                      <tr key={row.outcomeId} className="border-b last:border-b-0">
                        <td className="px-3 py-2 align-top">
                          <span className="font-mono font-medium" title={poTitle(row.outcomeId)}>
                            {row.code}
                          </span>
                        </td>
                        <td
                          className={`px-3 py-2 text-right align-top tabular-nums ${
                            row.attainment == null
                              ? 'text-muted-foreground'
                              : met
                                ? 'text-success'
                                : 'text-amber-600'
                          }`}
                        >
                          {formatAttainment(row.attainment)}
                        </td>
                        <td className="px-3 py-2 text-right align-top tabular-nums text-muted-foreground">
                          {row.contributingCourses}
                        </td>
                        <td className="px-3 py-2 align-top">
                          <Textarea
                            rows={2}
                            className="min-w-[260px] text-sm"
                            placeholder="What will be changed next cycle to lift this outcome?"
                            disabled={!canEditActions}
                            value={actions[row.outcomeId] ?? ''}
                            onChange={(e) =>
                              setActions((prev) => ({ ...prev, [row.outcomeId]: e.target.value }))
                            }
                          />
                        </td>
                      </tr>
                    );
                  })}

                  {report.psoAggregate.length > 0 && (
                    <tr className="border-b bg-muted/30">
                      <td
                        colSpan={4}
                        className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground"
                      >
                        Program specific outcomes
                      </td>
                    </tr>
                  )}
                  {report.psoAggregate.map((row) => {
                    const met =
                      row.attainment != null && row.attainment >= settings.targetAttainmentLevel;
                    return (
                      <tr key={row.outcomeId} className="border-b last:border-b-0">
                        <td className="px-3 py-2 align-top font-mono font-medium">{row.code}</td>
                        <td
                          className={`px-3 py-2 text-right align-top tabular-nums ${
                            row.attainment == null
                              ? 'text-muted-foreground'
                              : met
                                ? 'text-success'
                                : 'text-amber-600'
                          }`}
                        >
                          {formatAttainment(row.attainment)}
                        </td>
                        <td className="px-3 py-2 text-right align-top tabular-nums text-muted-foreground">
                          {row.contributingCourses}
                        </td>
                        <td className="px-3 py-2 align-top text-xs italic text-muted-foreground">
                          Corrective actions are recorded against POs only.
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </SectionPanel>

          <SectionPanel
            eyebrow="Attainment chart"
            title="PO attainment against target"
            description="Bars below the dashed line are the outcomes to argue about in the next review meeting."
          >
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData} barCategoryGap="24%">
                <defs>
                  <linearGradient id="poAttainmentGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.95} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.55} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="2 4" stroke="hsl(var(--border))" vertical={false} />
                <XAxis
                  dataKey="code"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                />
                <YAxis
                  domain={[0, settings.maxAttainmentLevel]}
                  allowDecimals
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                  width={32}
                />
                <Tooltip
                  cursor={{ fill: 'hsl(var(--muted) / 0.4)' }}
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '10px',
                    fontSize: 12,
                  }}
                />
                <ReferenceLine
                  y={settings.targetAttainmentLevel}
                  stroke="hsl(var(--warning))"
                  strokeDasharray="4 4"
                  label={{
                    value: `Target ${settings.targetAttainmentLevel}`,
                    position: 'right',
                    fill: 'hsl(var(--muted-foreground))',
                    fontSize: 10,
                  }}
                />
                <Bar
                  dataKey="attainment"
                  name="Attainment"
                  fill="url(#poAttainmentGrad)"
                  radius={[6, 6, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </SectionPanel>

          <SectionPanel
            eyebrow="Contribution"
            title="Per-course matrix"
            description="Every computed offering in scope and what it contributed to each outcome."
            flush
          >
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    <th className="sticky left-0 z-10 bg-card px-4 py-3 text-left">Course</th>
                    <th className="px-3 py-3 text-right">Avg CO</th>
                    {report.program.pos.map((po) => (
                      <th key={po._id} className="px-3 py-3 text-right" title={po.title}>
                        {po.code}
                      </th>
                    ))}
                    {report.program.psos.map((pso) => (
                      <th key={pso._id} className="px-3 py-3 text-right">
                        {pso.code}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {report.courses.map((course) => {
                    const po = new Map(course.poAttainment.map((r) => [r.outcomeId, r.attainment]));
                    const pso = new Map(
                      course.psoAttainment.map((r) => [r.outcomeId, r.attainment])
                    );
                    return (
                      <tr key={course.offeringId} className="border-b last:border-b-0">
                        <td className="sticky left-0 z-10 bg-card px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-medium">{course.subjectCode}</span>
                            {course.isFinal && (
                              <Badge variant="outline" className="text-[10px]">
                                Final
                              </Badge>
                            )}
                          </div>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {course.subjectName ?? ''}
                            {course.semesterNumber != null &&
                              `${course.subjectName ? ' · ' : ''}Sem ${course.semesterNumber}`}
                          </p>
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums">
                          {formatAttainment(course.courseAverageCoAttainment)}
                        </td>
                        {report.program.pos.map((o) => (
                          <td key={o._id} className="px-3 py-3 text-right tabular-nums">
                            {formatAttainment(po.get(o._id))}
                          </td>
                        ))}
                        {report.program.psos.map((o) => (
                          <td key={o._id} className="px-3 py-3 text-right tabular-nums">
                            {formatAttainment(pso.get(o._id))}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </SectionPanel>
        </>
      )}
    </div>
  );
}
