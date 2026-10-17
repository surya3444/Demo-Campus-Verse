'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ClipboardList, Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { examsApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { EditorialHeader } from '@/components/exams/EditorialHeader';
import { SectionPanel } from '@/components/exams/SectionPanel';

interface MarksRow {
  _id: string | null;
  studentId: string;
  admissionNumber?: string;
  rollNumber?: string;
  studentName: string;
  marksObtained: number | null;
  absent: boolean;
  percentage?: number | null;
  grade?: string | null;
  passed?: boolean | null;
  remarks?: string;
}

interface ScheduleInfo {
  _id: string;
  examId: string;
  paperId: string;
  sectionId: string;
  subjectName: string;
  sectionName: string;
  className: string;
  date: string;
  totalMarks: number;
  passMarks: number;
}

export default function MarksEntryPage() {
  const params = useParams();
  const examId = params.id as string;
  const scheduleId = params.scheduleId as string;
  const queryClient = useQueryClient();

  const examQuery = useQuery({
    queryKey: ['exam', examId],
    queryFn: () => examsApi.getExam(examId),
  });

  const schedulesQuery = useQuery({
    queryKey: ['exam-schedules', examId],
    queryFn: () => examsApi.listSchedules({ examId }),
  });

  const schedule = ((schedulesQuery.data?.data as ScheduleInfo[]) || []).find(
    (s) => s._id === scheduleId
  );

  const marksQuery = useQuery({
    queryKey: ['marks', examId, schedule?.paperId, schedule?.sectionId],
    queryFn: () =>
      examsApi.listMarksForPaperSection({
        examId,
        paperId: schedule!.paperId,
        sectionId: schedule!.sectionId,
      }),
    enabled: !!schedule,
  });

  const [rows, setRows] = useState<MarksRow[]>([]);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (marksQuery.data?.data) {
      setRows(marksQuery.data.data as MarksRow[]);
      setDirty(false);
    }
  }, [marksQuery.data]);

  const updateRow = (idx: number, patch: Partial<MarksRow>) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
    setDirty(true);
  };

  const saveMutation = useMutation({
    mutationFn: () => {
      if (!schedule) throw new Error('No schedule');
      const marks = rows
        .filter((r) => r.absent || r.marksObtained != null)
        .map((r) => ({
          studentId: r.studentId,
          marksObtained: r.absent ? 0 : Number(r.marksObtained),
          absent: r.absent,
          remarks: r.remarks,
        }));
      return examsApi.bulkUpsertMarks({
        examId,
        paperId: schedule.paperId,
        scheduleId,
        marks,
      });
    },
    onSuccess: (res) => {
      const data = res.data as { total: number };
      toast.success(`Saved ${data.total} mark(s)`);
      setDirty(false);
      queryClient.invalidateQueries({ queryKey: ['marks', examId] });
    },
    onError: (err: Error & { response?: { data?: { error?: { message?: string } } } }) => {
      toast.error(err.response?.data?.error?.message || 'Failed to save marks');
    },
  });

  const stats = useMemo(() => {
    const entered = rows.filter((r) => r.absent || r.marksObtained != null).length;
    const absent = rows.filter((r) => r.absent).length;
    return { entered, absent, total: rows.length };
  }, [rows]);

  if (examQuery.isLoading || schedulesQuery.isLoading || !schedule) {
    return (
      <div className="space-y-8 pb-12">
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    );
  }

  const exam = examQuery.data?.data as { name: string; termName: string };

  return (
    <div className="space-y-8 pb-12">
      <EditorialHeader
        eyebrow={`${exam.name} · ${exam.termName}`}
        meta={`${schedule.className} · ${schedule.sectionName}`}
        icon={ClipboardList}
        title={`${schedule.subjectName} marks`}
        description={`Total ${schedule.totalMarks} marks · pass ${schedule.passMarks} · ${new Date(schedule.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}. Press Enter to jump to the next row.`}
        actions={
          <>
            <Link href={`/exams/${examId}`}>
              <Button variant="outline" size="sm" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back to exam
              </Button>
            </Link>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={!dirty || saveMutation.isPending}
              className="gap-2"
            >
              {saveMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save marks
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-3 gap-4">
        <Stat label="Roster" value={stats.total} hint="Active students in section" />
        <Stat
          label="Entered"
          value={stats.entered}
          hint={`${stats.total ? Math.round((stats.entered / stats.total) * 100) : 0}% covered`}
          tone={stats.entered === stats.total ? 'positive' : 'neutral'}
        />
        <Stat label="Absent" value={stats.absent} hint="Marked absent" tone="warning" />
      </div>

      <SectionPanel
        eyebrow="Roster"
        title="Marks entry"
        description="Each row is one student. Click the absent box if a student didn't sit the paper — grade and percentage clear automatically."
        flush
      >
        {marksQuery.isLoading ? (
          <div className="p-7 space-y-3">
            <Skeleton className="h-12 w-full rounded-xl" />
            <Skeleton className="h-12 w-full rounded-xl" />
          </div>
        ) : rows.length === 0 ? (
          <p className="p-12 text-center text-muted-foreground italic">
            No students in this section.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[80px]">Roll</TableHead>
                <TableHead>Student</TableHead>
                <TableHead className="w-[120px]">Admission</TableHead>
                <TableHead className="w-[120px] text-right">Marks</TableHead>
                <TableHead className="w-[80px] text-center">Absent</TableHead>
                <TableHead className="w-[80px] text-right">%</TableHead>
                <TableHead className="w-[80px]">Grade</TableHead>
                <TableHead>Remarks</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r, i) => (
                <TableRow key={r.studentId}>
                  <TableCell className="text-sm tabular-nums text-muted-foreground">
                    {r.rollNumber || '—'}
                  </TableCell>
                  <TableCell className="font-medium">{r.studentName}</TableCell>
                  <TableCell className="text-xs font-mono text-muted-foreground">
                    {r.admissionNumber || '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    <Input
                      type="number"
                      min={0}
                      max={schedule.totalMarks}
                      className={cn('text-right tabular-nums h-9', r.absent && 'opacity-50')}
                      disabled={r.absent}
                      value={r.marksObtained ?? ''}
                      onChange={(e) =>
                        updateRow(i, {
                          marksObtained: e.target.value === '' ? null : Number(e.target.value),
                        })
                      }
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          const next = document.querySelector<HTMLInputElement>(
                            `input[data-row-idx="${i + 1}"]`
                          );
                          next?.focus();
                          next?.select();
                        }
                      }}
                      data-row-idx={i}
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <Checkbox
                      checked={r.absent}
                      onCheckedChange={(c) =>
                        updateRow(i, {
                          absent: Boolean(c),
                          marksObtained: c ? null : r.marksObtained,
                        })
                      }
                    />
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums text-muted-foreground">
                    {r.percentage != null ? `${r.percentage}%` : '—'}
                  </TableCell>
                  <TableCell className="text-sm font-mono">
                    {r.grade || <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell>
                    <Input
                      placeholder="Optional"
                      value={r.remarks || ''}
                      onChange={(e) => updateRow(i, { remarks: e.target.value })}
                      className="h-9 text-sm"
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </SectionPanel>

      {dirty && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 rounded-xl border bg-card shadow-soft-lg px-4 py-2.5">
          <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
          <span className="text-sm">Unsaved changes</span>
          <Button
            size="sm"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="gap-2"
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

function Stat({
  label,
  value,
  hint,
  tone = 'neutral',
}: {
  label: string;
  value: number;
  hint?: string;
  tone?: 'neutral' | 'positive' | 'warning';
}) {
  const toneClass =
    tone === 'positive'
      ? 'text-emerald-600'
      : tone === 'warning'
        ? 'text-amber-600'
        : 'text-foreground';
  return (
    <div className="rounded-2xl border bg-card shadow-soft p-5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
        {label}
      </p>
      <p
        className={cn('font-display text-3xl font-bold tabular-nums leading-none mt-2', toneClass)}
      >
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
