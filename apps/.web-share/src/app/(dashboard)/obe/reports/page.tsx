'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileText, Download, Loader2, AlertCircle, CheckCircle2, Landmark } from 'lucide-react';
import { toast } from 'sonner';
import { obeApi, academicApi } from '@/lib/api';
import { usePermissions } from '@/hooks/usePermissions';
import { getErrorMessage } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { EditorialHeader } from '@/components/exams/EditorialHeader';
import { SectionPanel } from '@/components/exams/SectionPanel';

/**
 * Accreditation reports — NBA SAR Criterion 3, NAAC SSR 2.6, NIRF data points.
 *
 * The preview mirrors the printable file section by section, so what an
 * assessor reads is what the coordinator checked here. Every figure comes from
 * computed attainment; nothing on this page is hand-entered.
 */

interface ProgramRow {
  _id: string;
  name: string;
  departmentCode: string;
  curriculumProgramName?: string;
}

interface BatchOption {
  _id: string;
  name: string;
  isCurrent?: boolean;
}

interface NbaReport {
  meta: {
    institution: { name: string; code: string } | null;
    branchName: string | null;
    program: { name: string; departmentCode: string; curriculumProgramName: string | null };
    academicBatch: string;
    courseCount: number;
    provisionalCourses: string[];
  };
  methodology: {
    targetAttainmentLevel: number;
    maxAttainmentLevel: number;
    internalThresholdPercent: number;
    directWeights: { internal: number; external: number };
    overallWeights: { direct: number; indirect: number };
  };
  section3_1_3: {
    poCodes: string[];
    psoCodes: string[];
    courses: Array<{
      subjectCode: string;
      subjectName: string;
      cells: Array<number | null>;
      psoCells: Array<number | null>;
    }>;
  };
  section3_3_2: {
    pos: Array<{ code: string; title: string }>;
    psos: Array<{ code: string; statement: string }>;
    poAggregate: Array<{
      code: string;
      attainment: number | null;
      contributingCourses: number;
      target: number;
      targetMet: boolean;
    }>;
    psoAggregate: Array<{
      code: string;
      attainment: number | null;
      contributingCourses: number;
      target: number;
      targetMet: boolean;
    }>;
  };
  section3_4: {
    outcomeGaps: Array<{
      kind: string;
      code: string;
      attainment: number | null;
      target: number;
      gap: number | null;
      actionTaken?: string;
    }>;
    courseGaps: Array<{
      subjectCode: string;
      coCode: string;
      attainment: number | null;
      actionTaken?: string;
    }>;
  };
}

interface NaacReport {
  metric2_6_1: {
    posDefined: number;
    psosDefined: number;
    coursesWithCos: number;
    totalCourses: number;
    cosDefined: number;
  };
  metric2_6_2: {
    cosEvaluated: number;
    cosAttained: number;
    attainmentRate: number | null;
    coursesWithIndirectEvidence: number;
    coursesEvaluated: number;
    targetLevel: number;
    maxLevel: number;
  };
  metric2_6_3: {
    appeared: number;
    passed: number;
    passPercentage: number | null;
    note?: string;
  };
}

interface NirfReport {
  sourced: {
    totalStudents: number;
    femaleStudents: number;
    femaleShare: number | null;
    totalStaff: number;
    teachingStaff: number;
    permanentStaff: number;
    facultyStudentRatio: string | null;
    programsOffered: number;
    meanPoAttainment: number | null;
  };
  notTracked: string[];
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function num(value: number | null | undefined): string {
  return value === null || value === undefined ? '—' : value.toFixed(2);
}

export default function AccreditationReportsPage() {
  const { hasPermission } = usePermissions();
  const canView = hasPermission('obe.reports', 'view');
  const [programId, setProgramId] = useState('');
  const [academicBatchId, setAcademicBatchId] = useState('');
  const [downloading, setDownloading] = useState<string | null>(null);

  const { data: programsData } = useQuery({
    queryKey: ['obe-programs'],
    queryFn: () => obeApi.getPrograms(),
  });
  const { data: batchesData } = useQuery({
    queryKey: ['academic-batches'],
    queryFn: () => academicApi.getAcademicBatches(),
  });

  const programs: ProgramRow[] = programsData?.data || [];
  const batches: BatchOption[] = batchesData?.data || [];

  useEffect(() => {
    if (!programId && programs.length > 0) setProgramId(programs[0]._id);
  }, [programs, programId]);
  useEffect(() => {
    if (academicBatchId || batches.length === 0) return;
    setAcademicBatchId((batches.find((b) => b.isCurrent) ?? batches[0])._id);
  }, [batches, academicBatchId]);

  const filters = useMemo(
    () => (academicBatchId ? { academicBatchId } : undefined),
    [academicBatchId]
  );

  const nba = useQuery({
    queryKey: ['obe-nba', programId, academicBatchId],
    queryFn: () => obeApi.getNbaCriterion3(programId, filters),
    enabled: !!programId,
    retry: false,
  });
  const naac = useQuery({
    queryKey: ['obe-naac', programId, academicBatchId],
    queryFn: () => obeApi.getNaacMetrics(programId, filters),
    enabled: !!programId,
    retry: false,
  });
  const nirf = useQuery({
    queryKey: ['obe-nirf', academicBatchId],
    queryFn: () => obeApi.getNirfDataPoints(filters),
  });

  const nbaReport: NbaReport | undefined = nba.data?.data;
  const naacReport: NaacReport | undefined = naac.data?.data;
  const nirfReport: NirfReport | undefined = nirf.data?.data;

  const handleDownload = async (kind: 'nba' | 'naac') => {
    setDownloading(kind);
    try {
      const blob =
        kind === 'nba'
          ? await obeApi.downloadNbaCriterion3(programId, filters)
          : await obeApi.downloadNaacMetrics(programId, filters);
      const program = programs.find((p) => p._id === programId);
      const name = (program?.curriculumProgramName ?? program?.name ?? 'program')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-');
      download(blob, `${kind === 'nba' ? 'nba-criterion-3' : 'naac-2-6'}-${name}.pdf`);
    } catch (err) {
      toast.error(getErrorMessage(err) || 'Failed to generate the report');
    } finally {
      setDownloading(null);
    }
  };

  if (!canView) {
    return (
      <SectionPanel>
        <p className="py-12 text-center text-sm text-muted-foreground">
          You don&apos;t have permission to view accreditation reports.
        </p>
      </SectionPanel>
    );
  }

  const noData = nba.isError;

  return (
    <div className="space-y-8 pb-12">
      <EditorialHeader
        eyebrow="OBE · Accreditation"
        meta="/obe/reports"
        icon={FileText}
        title="Accreditation reports"
        description="NBA Self Assessment Report Criterion 3, NAAC SSR Key Indicator 2.6 and the NIRF data points this system can evidence — generated from computed attainment, not typed in."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              className="gap-2"
              disabled={!programId || noData || downloading !== null}
              onClick={() => handleDownload('nba')}
            >
              {downloading === 'nba' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              NBA Criterion 3 (PDF)
            </Button>
            <Button
              variant="outline"
              className="gap-2"
              disabled={!programId || noData || downloading !== null}
              onClick={() => handleDownload('naac')}
            >
              {downloading === 'naac' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              NAAC 2.6 (PDF)
            </Button>
          </div>
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[240px] space-y-1.5">
          <label className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Program
          </label>
          <Select value={programId} onValueChange={setProgramId}>
            <SelectTrigger>
              <SelectValue placeholder="Select a program" />
            </SelectTrigger>
            <SelectContent>
              {programs.map((p) => (
                <SelectItem key={p._id} value={p._id}>
                  {p.curriculumProgramName ?? p.name} · {p.departmentCode}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-[200px] space-y-1.5">
          <label className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Academic batch
          </label>
          <Select value={academicBatchId} onValueChange={setAcademicBatchId}>
            <SelectTrigger>
              <SelectValue placeholder="All batches" />
            </SelectTrigger>
            <SelectContent>
              {batches.map((b) => (
                <SelectItem key={b._id} value={b._id}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {noData ? (
        <SectionPanel>
          <div className="flex flex-col items-center justify-center py-14 text-center">
            <AlertCircle className="mb-3 h-10 w-10 text-amber-500" />
            <p className="text-lg font-medium">No computed attainment yet</p>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              {getErrorMessage(nba.error) ||
                'Compute attainment for at least one course offering in this program before generating an accreditation file.'}
            </p>
          </div>
        </SectionPanel>
      ) : (
        <>
          {/* NBA preview */}
          <SectionPanel
            eyebrow="NBA · SAR"
            title="Criterion 3 — Course Outcomes and Program Outcomes"
            description={
              nbaReport
                ? `${nbaReport.meta.courseCount} course(s) · ${nbaReport.meta.academicBatch} · target level ${nbaReport.methodology.targetAttainmentLevel} of ${nbaReport.methodology.maxAttainmentLevel}`
                : undefined
            }
          >
            {nba.isLoading || !nbaReport ? (
              <Skeleton className="h-64 rounded-xl" />
            ) : (
              <div className="space-y-8">
                {nbaReport.meta.provisionalCourses.length > 0 && (
                  <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>
                      {nbaReport.meta.provisionalCourses.length} course(s) are computed but not
                      finalized ({nbaReport.meta.provisionalCourses.join(', ')}). Their figures are
                      provisional — the PDF says so too.
                    </span>
                  </div>
                )}

                {/* 3.3.2 — PO/PSO attainment */}
                <div className="space-y-3">
                  <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                    3.3.2 · PO / PSO attainment
                  </p>
                  <div className="overflow-x-auto rounded-xl border">
                    <table className="w-full text-sm">
                      <thead className="border-b bg-muted/30 text-left">
                        <tr>
                          <th className="px-3 py-2 font-medium text-muted-foreground">Outcome</th>
                          <th className="px-3 py-2 font-medium text-muted-foreground">
                            Description
                          </th>
                          <th className="px-3 py-2 font-medium text-muted-foreground">Courses</th>
                          <th className="px-3 py-2 font-medium text-muted-foreground">Attained</th>
                          <th className="px-3 py-2 font-medium text-muted-foreground">Target</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          ...nbaReport.section3_3_2.poAggregate.map((row) => ({
                            ...row,
                            label:
                              nbaReport.section3_3_2.pos.find((p) => p.code === row.code)?.title ??
                              '',
                          })),
                          ...nbaReport.section3_3_2.psoAggregate.map((row) => ({
                            ...row,
                            label:
                              nbaReport.section3_3_2.psos.find((p) => p.code === row.code)
                                ?.statement ?? '',
                          })),
                        ].map((row) => (
                          <tr key={row.code} className="border-b last:border-0">
                            <td className="px-3 py-2 font-mono text-xs font-semibold">
                              {row.code}
                            </td>
                            <td className="max-w-[420px] truncate px-3 py-2 text-muted-foreground">
                              {row.label || '—'}
                            </td>
                            <td className="px-3 py-2 tabular-nums">{row.contributingCourses}</td>
                            <td className="px-3 py-2 tabular-nums font-semibold">
                              {num(row.attainment)}
                            </td>
                            <td className="px-3 py-2">
                              <Badge
                                variant={row.targetMet ? 'default' : 'destructive'}
                                className="gap-1"
                              >
                                {row.targetMet ? (
                                  <CheckCircle2 className="h-3 w-3" />
                                ) : (
                                  <AlertCircle className="h-3 w-3" />
                                )}
                                {row.target.toFixed(2)}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 3.1.3 — program articulation matrix */}
                <div className="space-y-3">
                  <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                    3.1.3 · Program articulation matrix
                  </p>
                  <div className="overflow-x-auto rounded-xl border">
                    <table className="w-full text-xs">
                      <thead className="border-b bg-muted/30">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                            Course
                          </th>
                          {[
                            ...nbaReport.section3_1_3.poCodes,
                            ...nbaReport.section3_1_3.psoCodes,
                          ].map((code) => (
                            <th
                              key={code}
                              className="px-2 py-2 text-center font-mono font-medium text-muted-foreground"
                            >
                              {code}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {nbaReport.section3_1_3.courses.map((course) => (
                          <tr key={course.subjectCode} className="border-b last:border-0">
                            <td className="whitespace-nowrap px-3 py-2 font-medium">
                              {course.subjectCode}
                            </td>
                            {[...course.cells, ...course.psoCells].map((cell, i) => (
                              <td
                                key={i}
                                className="px-2 py-2 text-center tabular-nums text-muted-foreground"
                              >
                                {cell === null ? '' : cell.toFixed(1)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 3.4 — gap analysis */}
                <div className="space-y-3">
                  <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                    3.4 · Gap analysis and action taken
                  </p>
                  {nbaReport.section3_4.outcomeGaps.length === 0 &&
                  nbaReport.section3_4.courseGaps.length === 0 ? (
                    <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                      Every outcome met its target in this window — no corrective action required.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {nbaReport.section3_4.outcomeGaps.map((gap) => (
                        <div
                          key={`${gap.kind}-${gap.code}`}
                          className="rounded-xl border p-3 text-sm"
                        >
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="font-mono text-[10px]">
                              {gap.code}
                            </Badge>
                            <span className="text-muted-foreground">
                              attained {num(gap.attainment)} against a target of{' '}
                              {gap.target.toFixed(2)}
                            </span>
                          </div>
                          <p className="mt-1.5 text-xs text-muted-foreground">
                            {gap.actionTaken || 'No corrective action recorded yet.'}
                          </p>
                        </div>
                      ))}
                      {nbaReport.section3_4.courseGaps.length > 0 && (
                        <p className="text-xs text-muted-foreground">
                          {nbaReport.section3_4.courseGaps.length} Course Outcome(s) below target —
                          listed in full in the PDF.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </SectionPanel>

          {/* NAAC preview */}
          <SectionPanel
            eyebrow="NAAC · SSR"
            title="Key Indicator 2.6 — Student Performance and Learning Outcomes"
          >
            {naac.isLoading || !naacReport ? (
              <Skeleton className="h-40 rounded-xl" />
            ) : (
              <div className="grid gap-4 sm:grid-cols-3">
                <MetricCard
                  code="2.6.1"
                  title="Outcomes stated"
                  primary={`${naacReport.metric2_6_1.cosDefined} COs`}
                  lines={[
                    `${naacReport.metric2_6_1.posDefined} POs · ${naacReport.metric2_6_1.psosDefined} PSOs`,
                    `${naacReport.metric2_6_1.coursesWithCos} of ${naacReport.metric2_6_1.totalCourses} courses defined`,
                  ]}
                />
                <MetricCard
                  code="2.6.2"
                  title="Attainment evaluated"
                  primary={
                    naacReport.metric2_6_2.attainmentRate === null
                      ? '—'
                      : `${naacReport.metric2_6_2.attainmentRate}%`
                  }
                  lines={[
                    `${naacReport.metric2_6_2.cosAttained} of ${naacReport.metric2_6_2.cosEvaluated} COs at target`,
                    `${naacReport.metric2_6_2.coursesWithIndirectEvidence} of ${naacReport.metric2_6_2.coursesEvaluated} courses with survey evidence`,
                  ]}
                />
                <MetricCard
                  code="2.6.3"
                  title="Pass percentage"
                  primary={
                    naacReport.metric2_6_3.passPercentage === null
                      ? '—'
                      : `${naacReport.metric2_6_3.passPercentage.toFixed(2)}%`
                  }
                  lines={[
                    naacReport.metric2_6_3.note ??
                      `${naacReport.metric2_6_3.passed} passed of ${naacReport.metric2_6_3.appeared} appeared`,
                  ]}
                />
              </div>
            )}
          </SectionPanel>

          {/* NIRF */}
          <SectionPanel
            eyebrow="NIRF"
            title="Data points this system can evidence"
            description="NIRF draws largely on research, placement and perception data this ERP does not hold. Only sourced figures are shown; the rest is listed so nothing reads as a zero it isn't."
          >
            {nirf.isLoading || !nirfReport ? (
              <Skeleton className="h-40 rounded-xl" />
            ) : (
              <div className="space-y-5">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <MetricCard
                    code="SS"
                    title="Student strength"
                    primary={String(nirfReport.sourced.totalStudents)}
                    lines={[
                      nirfReport.sourced.femaleShare === null
                        ? '—'
                        : `${nirfReport.sourced.femaleShare}% women`,
                    ]}
                  />
                  <MetricCard
                    code="FSR"
                    title="Faculty-student ratio"
                    primary={nirfReport.sourced.facultyStudentRatio ?? '—'}
                    lines={[`${nirfReport.sourced.teachingStaff} teaching faculty`]}
                  />
                  <MetricCard
                    code="FQE"
                    title="Permanent faculty"
                    primary={String(nirfReport.sourced.permanentStaff)}
                    lines={[`of ${nirfReport.sourced.totalStaff} staff`]}
                  />
                  <MetricCard
                    code="OBE"
                    title="Mean PO attainment"
                    primary={num(nirfReport.sourced.meanPoAttainment)}
                    lines={[`${nirfReport.sourced.programsOffered} programs offered`]}
                  />
                </div>
                <div className="rounded-xl border border-dashed p-4">
                  <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <Landmark className="h-3.5 w-3.5" />
                    Not tracked in this system
                  </p>
                  <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                    {nirfReport.notTracked.map((item) => (
                      <li key={item}>· {item}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </SectionPanel>
        </>
      )}
    </div>
  );
}

function MetricCard({
  code,
  title,
  primary,
  lines,
}: {
  code: string;
  title: string;
  primary: string;
  lines: string[];
}) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="font-mono text-[10px]">
          {code}
        </Badge>
        <p className="text-xs font-medium text-muted-foreground">{title}</p>
      </div>
      <p className="mt-2 font-display text-2xl font-bold tabular-nums">{primary}</p>
      {lines.map((line) => (
        <p key={line} className="mt-0.5 text-xs text-muted-foreground">
          {line}
        </p>
      ))}
    </div>
  );
}
