'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  ArrowRight,
  ArrowRightLeft,
  CheckCircle2,
  Clock,
  Loader2,
  Send,
  Trash2,
  XCircle,
  GraduationCap,
} from 'lucide-react';
import { toast } from 'sonner';
import { examsApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
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
import { cn } from '@/lib/utils';
import { EditorialHeader } from '@/components/exams/EditorialHeader';
import { SectionPanel } from '@/components/exams/SectionPanel';
import { KpiStrip, type KpiItem } from '@/components/exams/KpiStrip';
import { StatusBadge } from '@/components/exams/StatusBadge';

interface Decision {
  studentId: string;
  studentName: string;
  admissionNumber?: string;
  fromClassName: string;
  fromSectionName: string;
  toClassName?: string;
  toSectionName?: string;
  outcome: 'promote' | 'graduate' | 'hold' | 'transfer_out';
  reason?: string;
  manualOverride?: boolean;
}

interface PromotionRun {
  _id: string;
  fromBatchName: string;
  toBatchName: string;
  status: 'draft' | 'committed';
  decisions: Decision[];
  rules: { passMarkPercent: number; passSubjectsRequired: 'all' | number };
  committedAt?: string;
  createdAt: string;
}

const OUTCOME_LABEL: Record<Decision['outcome'], string> = {
  promote: 'Promote',
  graduate: 'Graduate',
  hold: 'Hold back',
  transfer_out: 'Transfer out',
};

export default function PromotionRunPage() {
  const params = useParams();
  const router = useRouter();
  const runId = params.id as string;
  const queryClient = useQueryClient();

  const runQuery = useQuery({
    queryKey: ['promotion-run', runId],
    queryFn: () => examsApi.getPromotionRun(runId),
  });
  const run = runQuery.data?.data as PromotionRun | undefined;

  const overrideMutation = useMutation({
    mutationFn: ({ studentId, outcome }: { studentId: string; outcome: Decision['outcome'] }) =>
      examsApi.overridePromotionDecision(runId, studentId, { outcome }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['promotion-run', runId] });
    },
    onError: () => toast.error('Failed to update'),
  });

  const commitMutation = useMutation({
    mutationFn: () => examsApi.commitPromotionRun(runId),
    onSuccess: (res) => {
      const data = res.data as {
        promoted: number;
        graduated?: number;
        held: number;
        transferred: number;
      };
      toast.success(
        `Committed: ${data.promoted} promoted · ${data.graduated ?? 0} graduated · ${data.held} held · ${data.transferred} transferred`
      );
      queryClient.invalidateQueries({ queryKey: ['promotion-run', runId] });
      queryClient.invalidateQueries({ queryKey: ['promotion-runs'] });
    },
    onError: (err: Error & { response?: { data?: { error?: { message?: string } } } }) => {
      toast.error(err.response?.data?.error?.message || 'Commit failed');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => examsApi.deletePromotionRun(runId),
    onSuccess: () => {
      toast.success('Draft deleted');
      router.push('/exams/promotion');
    },
    onError: () => toast.error('Failed to delete'),
  });

  const counts = useMemo(() => {
    if (!run) return null;
    return {
      promote: run.decisions.filter((d) => d.outcome === 'promote').length,
      graduate: run.decisions.filter((d) => d.outcome === 'graduate').length,
      hold: run.decisions.filter((d) => d.outcome === 'hold').length,
      transfer_out: run.decisions.filter((d) => d.outcome === 'transfer_out').length,
    };
  }, [run]);

  const kpis: KpiItem[] = useMemo(() => {
    if (!run || !counts) return [];
    const total = run.decisions.length;
    return [
      {
        label: 'Total students',
        value: total.toLocaleString(),
        icon: ArrowRightLeft,
        footnote: <span className="text-muted-foreground">In source batch</span>,
      },
      {
        label: 'To promote',
        value: counts.promote.toLocaleString(),
        icon: CheckCircle2,
        accent: true,
        footnote: <span className="text-muted-foreground">Eligible to advance</span>,
      },
      {
        label: 'Graduating',
        value: counts.graduate.toLocaleString(),
        icon: GraduationCap,
        footnote: <span className="text-muted-foreground">Finished the final year</span>,
      },
      {
        label: 'Hold back',
        value: counts.hold.toLocaleString(),
        icon: Clock,
        footnote: <span className="text-muted-foreground">Stay in current class</span>,
      },
      {
        label: 'Transfer out',
        value: counts.transfer_out.toLocaleString(),
        icon: XCircle,
        destructive: counts.transfer_out > 0,
        footnote: <span className="text-muted-foreground">Marked inactive</span>,
      },
    ];
  }, [run, counts]);

  if (runQuery.isLoading || !run) {
    return (
      <div className="space-y-8 pb-12">
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-32 rounded-2xl" />
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      <EditorialHeader
        eyebrow={`Promotion · ${run.status}`}
        meta={`pass ≥ ${run.rules.passMarkPercent}% · ${run.rules.passSubjectsRequired === 'all' ? 'all subjects' : `${run.rules.passSubjectsRequired} subjects`}`}
        icon={ArrowRightLeft}
        title={`${run.fromBatchName} → ${run.toBatchName}`}
        description={
          run.status === 'committed'
            ? `Committed on ${new Date(run.committedAt!).toLocaleString('en-IN')}. Enrollment changes have been applied to the students collection.`
            : 'Review the auto-computed decisions below. Override any individual outcome before committing — committing is irreversible.'
        }
        actions={
          <>
            <Link href="/exams/promotion">
              <Button variant="outline" size="sm" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back to runs
              </Button>
            </Link>
            <StatusBadge status={run.status} />
            {run.status === 'draft' && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (confirm('Delete this draft run? Decisions will be lost.')) {
                      deleteMutation.mutate();
                    }
                  }}
                  disabled={deleteMutation.isPending}
                  className="gap-2"
                >
                  <Trash2 className="h-4 w-4 text-rose-500" />
                  Delete draft
                </Button>
                <Button
                  size="sm"
                  className="gap-2"
                  onClick={() => {
                    if (
                      counts &&
                      confirm(
                        `Commit this run? ${counts.promote} student(s) will move to ${run.toBatchName}, ${counts.graduate} will graduate as alumni, ${counts.hold} will stay, and ${counts.transfer_out} will be marked inactive. This cannot be undone.`
                      )
                    ) {
                      commitMutation.mutate();
                    }
                  }}
                  disabled={commitMutation.isPending}
                >
                  {commitMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  Commit run
                </Button>
              </>
            )}
          </>
        }
      />

      <KpiStrip ariaLabel="Promotion decisions" items={kpis} />

      <SectionPanel
        eyebrow="Decisions"
        title="Per-student outcomes"
        description="Drafts let you override individual decisions before committing. Committed runs are read-only."
        flush
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Student</TableHead>
              <TableHead>From</TableHead>
              <TableHead></TableHead>
              <TableHead>To</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Decision</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {run.decisions.map((d) => (
              <TableRow key={d.studentId} className="group">
                <TableCell>
                  <div className="font-medium">{d.studentName}</div>
                  <div className="text-xs text-muted-foreground font-mono">
                    {d.admissionNumber || ''}
                  </div>
                </TableCell>
                <TableCell className="text-sm">
                  {d.fromClassName} · {d.fromSectionName}
                </TableCell>
                <TableCell>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </TableCell>
                <TableCell className="text-sm">
                  {d.outcome === 'promote' && d.toClassName ? (
                    <span>
                      {d.toClassName}
                      {d.toSectionName ? ` · ${d.toSectionName}` : ''}
                    </span>
                  ) : (
                    <span className="text-muted-foreground italic">—</span>
                  )}
                </TableCell>
                <TableCell
                  className={cn(
                    'text-xs max-w-xs',
                    d.outcome === 'promote' ? 'text-emerald-700' : 'text-muted-foreground'
                  )}
                >
                  {d.reason}
                  {d.manualOverride && (
                    <span className="ml-2 inline-block px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 text-[10px] uppercase tracking-wider font-semibold">
                      Manual
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  {run.status === 'draft' ? (
                    <Select
                      value={d.outcome}
                      onValueChange={(v) =>
                        overrideMutation.mutate({
                          studentId: d.studentId,
                          outcome: v as Decision['outcome'],
                        })
                      }
                    >
                      <SelectTrigger className="w-[150px] h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(['promote', 'graduate', 'hold', 'transfer_out'] as const).map((o) => (
                          <SelectItem key={o} value={o}>
                            {OUTCOME_LABEL[o]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <StatusBadge status={d.outcome} />
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </SectionPanel>
    </div>
  );
}
