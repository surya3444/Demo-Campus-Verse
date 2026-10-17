'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  ArrowRight,
  ArrowRightLeft,
  CheckCircle2,
  Clock,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { examsApi, academicApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { EditorialHeader } from '@/components/exams/EditorialHeader';
import { SectionPanel } from '@/components/exams/SectionPanel';
import { KpiStrip, type KpiItem } from '@/components/exams/KpiStrip';
import { Field } from '@/components/exams/Field';
import { StatusBadge } from '@/components/exams/StatusBadge';

interface PromotionRunSummary {
  _id: string;
  fromBatchName: string;
  toBatchName: string;
  status: 'draft' | 'committed';
  decisions: Array<{ outcome: 'promote' | 'graduate' | 'hold' | 'transfer_out' }>;
  createdAt: string;
  committedAt?: string;
}

export default function PromotionListPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [fromBatchId, setFromBatchId] = useState('');
  const [toBatchId, setToBatchId] = useState('');
  const [passMarkPercent, setPassMarkPercent] = useState<number | ''>('');
  const [passSubjects, setPassSubjects] = useState<'all' | number>('all');

  const batchesQuery = useQuery({
    queryKey: ['academic-batches'],
    queryFn: () => academicApi.getAcademicBatches(),
  });
  const batches = (batchesQuery.data?.data as Array<Record<string, unknown>>) || [];

  const runsQuery = useQuery({
    queryKey: ['promotion-runs'],
    queryFn: () => examsApi.listPromotionRuns(),
  });
  const runs = (runsQuery.data?.data as PromotionRunSummary[]) || [];

  const createMutation = useMutation({
    mutationFn: () =>
      examsApi.createPromotionRun({
        fromBatchId,
        toBatchId,
        passMarkPercentOverride: passMarkPercent === '' ? undefined : Number(passMarkPercent),
        passSubjectsRequiredOverride: passSubjects,
      }),
    onSuccess: (res) => {
      const run = res.data as { _id: string };
      toast.success('Draft run created');
      queryClient.invalidateQueries({ queryKey: ['promotion-runs'] });
      router.push(`/exams/promotion/${run._id}`);
    },
    onError: (err: Error & { response?: { data?: { error?: { message?: string } } } }) => {
      toast.error(err.response?.data?.error?.message || 'Failed to create run');
    },
  });

  const kpis: KpiItem[] = useMemo(() => {
    const total = runs.length;
    const drafts = runs.filter((r) => r.status === 'draft').length;
    const committed = runs.filter((r) => r.status === 'committed').length;
    const promotedAcrossRuns = runs.reduce(
      (sum, r) => sum + r.decisions.filter((d) => d.outcome === 'promote').length,
      0
    );
    return [
      {
        label: 'Total runs',
        value: total.toLocaleString(),
        icon: ArrowRightLeft,
        footnote: <span className="text-muted-foreground">All time</span>,
      },
      {
        label: 'Drafts',
        value: drafts.toLocaleString(),
        icon: Clock,
        accent: drafts > 0,
        footnote: <span className="text-muted-foreground">Awaiting commit</span>,
      },
      {
        label: 'Committed',
        value: committed.toLocaleString(),
        icon: CheckCircle2,
        footnote: <span className="text-muted-foreground">Year transitions</span>,
      },
      {
        label: 'Promoted',
        value: promotedAcrossRuns.toLocaleString(),
        icon: ArrowRight,
        footnote: <span className="text-muted-foreground">Students moved</span>,
      },
    ];
  }, [runs]);

  return (
    <div className="space-y-8 pb-12">
      <EditorialHeader
        eyebrow="Examinations · Promotion"
        meta="/exams/promotion"
        icon={ArrowRightLeft}
        title="Year-end promotion"
        description="Move students into the next academic year based on their published results. Create a draft run, review per-student decisions, then commit when ready."
        actions={
          <Link href="/exams">
            <Button variant="outline" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to exams
            </Button>
          </Link>
        }
      />

      <KpiStrip ariaLabel="Promotion stats" items={kpis} loading={runsQuery.isLoading} />

      <SectionPanel
        eyebrow="New run"
        title="Plan a year transition"
        description="Pick the source year (closing) and target year (next), then optionally override the pass-mark and required-subjects from your exam settings."
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Field label="Source academic year" required>
            <Select value={fromBatchId} onValueChange={setFromBatchId}>
              <SelectTrigger>
                <SelectValue placeholder="Pick the year that's ending" />
              </SelectTrigger>
              <SelectContent>
                {batches.map((b) => (
                  <SelectItem key={b._id as string} value={b._id as string}>
                    {b.name as string}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Target academic year" required>
            <Select value={toBatchId} onValueChange={setToBatchId}>
              <SelectTrigger>
                <SelectValue placeholder="Pick the new year students move into" />
              </SelectTrigger>
              <SelectContent>
                {batches
                  .filter((b) => (b._id as string) !== fromBatchId)
                  .map((b) => (
                    <SelectItem key={b._id as string} value={b._id as string}>
                      {b.name as string}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </Field>
          <Field
            label="Pass mark % (override)"
            hint="Leave blank to use the value set on the Settings page."
          >
            <Input
              type="number"
              placeholder="Default"
              value={passMarkPercent}
              onChange={(e) =>
                setPassMarkPercent(e.target.value === '' ? '' : Number(e.target.value))
              }
            />
          </Field>
          <Field
            label="Subjects required to pass"
            hint="How many subjects must a student pass to qualify for promotion."
          >
            <Select
              value={passSubjects === 'all' ? 'all' : String(passSubjects)}
              onValueChange={(v) => setPassSubjects(v === 'all' ? 'all' : (parseInt(v) as number))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All subjects</SelectItem>
                {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    At least {n} subject{n === 1 ? '' : 's'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
        <p className="mt-5 text-xs text-muted-foreground">
          We&apos;ll compute pass/fail decisions for every student using their published report
          cards in the source year. Nothing is changed until you commit the run.
        </p>
        <div className="mt-5 flex justify-end pt-4 border-t">
          <Button
            onClick={() => createMutation.mutate()}
            disabled={!fromBatchId || !toBatchId || createMutation.isPending}
            className="gap-2"
          >
            {createMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            Create draft run
          </Button>
        </div>
      </SectionPanel>

      <SectionPanel
        eyebrow="History"
        title={`${runs.length} past run${runs.length === 1 ? '' : 's'}`}
        description="Drafts can be edited or deleted. Committed runs are immutable and write back to student enrollment."
        flush
      >
        {runsQuery.isLoading ? (
          <div className="p-7 space-y-3">
            <Skeleton className="h-12 w-full rounded-xl" />
            <Skeleton className="h-12 w-full rounded-xl" />
          </div>
        ) : runs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="h-12 w-12 rounded-full bg-gradient-to-br from-primary/15 to-primary/5 flex items-center justify-center mb-3">
              <ArrowRightLeft className="h-6 w-6 text-primary" />
            </div>
            <h3 className="font-display text-lg font-semibold">No runs yet</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm">
              Create your first draft run above to preview promotion decisions before committing.
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>From</TableHead>
                <TableHead></TableHead>
                <TableHead>To</TableHead>
                <TableHead>Decisions</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {runs.map((r) => {
                const promote = r.decisions.filter((d) => d.outcome === 'promote').length;
                const hold = r.decisions.filter((d) => d.outcome === 'hold').length;
                return (
                  <TableRow key={r._id} className="group">
                    <TableCell className="font-medium">{r.fromBatchName}</TableCell>
                    <TableCell>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </TableCell>
                    <TableCell className="font-medium">{r.toBatchName}</TableCell>
                    <TableCell className="text-sm">
                      <span className="text-emerald-600 tabular-nums">{promote}</span>
                      <span className="text-muted-foreground"> promote · </span>
                      <span className="text-amber-600 tabular-nums">{hold}</span>
                      <span className="text-muted-foreground"> hold</span>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={r.status} />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground tabular-nums">
                      {new Date(r.committedAt || r.createdAt).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link href={`/exams/promotion/${r._id}`}>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="opacity-0 group-hover:opacity-100 transition-opacity gap-1"
                        >
                          {r.status === 'draft' ? 'Review' : 'View'}
                          <ArrowRight className="h-3 w-3" />
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </SectionPanel>
    </div>
  );
}
