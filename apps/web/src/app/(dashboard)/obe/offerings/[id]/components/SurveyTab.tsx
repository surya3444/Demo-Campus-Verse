'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Lock, MessageSquare, Play } from 'lucide-react';
import { toast } from 'sonner';
import { obeApi } from '@/lib/api';
import { usePermissions } from '@/hooks/usePermissions';
import { cn, getErrorMessage } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
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
import {
  formatAttainment,
  type ObeSurveyStatus,
  type OfferingDetail,
  type SurveyResults,
} from '@/components/obe/types';

const STATE_COPY: Record<ObeSurveyStatus, { label: string; tone: string; blurb: string }> = {
  not_started: {
    label: 'Not started',
    tone: 'border-slate-300 text-slate-600 dark:border-slate-700 dark:text-slate-300',
    blurb: 'Nobody has been invited yet. Open the survey once the course is taught out.',
  },
  open: {
    label: 'Open',
    tone: 'border-emerald-300 text-emerald-700 dark:border-emerald-800 dark:text-emerald-300',
    blurb: 'The cohort can submit right now — responses land as they come in.',
  },
  closed: {
    label: 'Closed',
    tone: 'border-amber-300 text-amber-700 dark:border-amber-800 dark:text-amber-300',
    blurb: 'No further responses are accepted. What is below is the final indirect input.',
  },
};

/** Rating 0..3, coldest to warmest. */
const RATING_TONES = ['bg-rose-400', 'bg-amber-400', 'bg-sky-400', 'bg-emerald-500'];

function formatStamp(iso?: string) {
  return iso ? new Date(iso).toLocaleString('en-IN') : null;
}

export function SurveyTab({ offering }: { offering: OfferingDetail }) {
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const canManage = hasPermission('obe.surveys', 'manage');
  const [confirm, setConfirm] = useState<'open' | 'close' | null>(null);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['obe-survey', offering._id],
    queryFn: () => obeApi.getSurveyResults(offering._id),
    enabled: !!offering._id,
  });

  const results: SurveyResults | undefined = data?.data;

  const stateMutation = useMutation({
    mutationFn: (next: 'open' | 'close') =>
      next === 'open' ? obeApi.openSurvey(offering._id) : obeApi.closeSurvey(offering._id),
    onSuccess: (_res, next) => {
      toast.success(next === 'open' ? 'Survey opened' : 'Survey closed');
      queryClient.invalidateQueries({ queryKey: ['obe-offering', offering._id] });
      queryClient.invalidateQueries({ queryKey: ['obe-survey', offering._id] });
      setConfirm(null);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const state = STATE_COPY[offering.survey.status] ?? STATE_COPY.not_started;
  const openedAt = formatStamp(offering.survey.openedAt);
  const closedAt = formatStamp(offering.survey.closedAt);

  const cohortSize = results?.cohortSize ?? offering.cohortSize ?? 0;
  const respondents = results?.respondents ?? 0;
  const responseRate = cohortSize > 0 ? (respondents / cohortSize) * 100 : 0;
  const perCo = results?.perCo ?? [];

  return (
    <>
      <SectionPanel
        eyebrow="Exit survey"
        title="Survey state"
        description="The exit survey is the indirect half of CO attainment — students self-rate how well the course delivered each CO on a 0–3 scale, and that average is weighted against the marks-based direct attainment."
        action={
          canManage ? (
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="gap-1"
                disabled={offering.survey.status === 'open' || stateMutation.isPending}
                onClick={() => setConfirm('open')}
              >
                <Play className="h-3 w-3" />
                {offering.survey.status === 'closed' ? 'Reopen' : 'Open survey'}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="gap-1"
                disabled={offering.survey.status !== 'open' || stateMutation.isPending}
                onClick={() => setConfirm('close')}
              >
                <Lock className="h-3 w-3" />
                Close survey
              </Button>
            </div>
          ) : null
        }
      >
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <Badge variant="outline" className={cn('h-7 px-3 text-sm', state.tone)}>
            {state.label}
          </Badge>
          <p className="text-sm text-muted-foreground">{state.blurb}</p>
        </div>

        <dl className="mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Opened
            </dt>
            <dd className="mt-1 text-sm tabular-nums">{openedAt ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Closed
            </dt>
            <dd className="mt-1 text-sm tabular-nums">{closedAt ?? '—'}</dd>
          </div>
        </dl>
      </SectionPanel>

      <SectionPanel
        eyebrow="Responses"
        title="What the cohort said"
        description="Per-CO rating spread and the indirect attainment it produces. Ratings are averaged, not thresholded — a CO everyone rates 2 lands at 2.00."
      >
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-10" />
            <Skeleton className="h-40" />
          </div>
        ) : isError ? (
          <p className="text-sm text-muted-foreground">{getErrorMessage(error)}</p>
        ) : (
          <div className="space-y-6">
            <div className="max-w-md">
              <div className="flex items-baseline justify-between">
                <p className="text-sm text-muted-foreground">Respondents</p>
                <p className="text-sm font-medium tabular-nums">
                  {respondents} / {cohortSize}
                  <span className="ml-2 text-muted-foreground">{responseRate.toFixed(0)}%</span>
                </p>
              </div>
              <Progress value={Math.min(responseRate, 100)} className="mt-2" />
            </div>

            {perCo.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <MessageSquare className="mb-4 h-10 w-10 text-muted-foreground opacity-40" />
                <p className="text-sm font-medium">No responses yet</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {offering.survey.status === 'open'
                    ? 'Students see the survey under Course Surveys until you close it.'
                    : 'Open the survey to collect the indirect input.'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border">
                <table className="w-max min-w-full border-separate border-spacing-0 text-sm">
                  <thead>
                    <tr className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      <th className="border-b bg-muted/40 px-3 py-2 text-left">CO</th>
                      <th className="border-b bg-muted/40 px-3 py-2 text-left">Statement</th>
                      <th className="border-b bg-muted/40 px-3 py-2 text-left">Rating spread</th>
                      <th className="border-b bg-muted/40 px-3 py-2 text-right">Responses</th>
                      <th className="border-b bg-muted/40 px-3 py-2 text-right">Indirect</th>
                    </tr>
                  </thead>
                  <tbody>
                    {perCo.map((co) => (
                      <tr key={co.coId} className="align-top">
                        <td className="border-b px-3 py-3">
                          <Badge variant="outline" className="font-mono text-[11px]">
                            {co.code}
                          </Badge>
                        </td>
                        <td className="max-w-[340px] border-b px-3 py-3">
                          <span className="block truncate" title={co.statement}>
                            {co.statement}
                          </span>
                        </td>
                        <td className="border-b px-3 py-3">
                          <div className="flex gap-2">
                            {co.distribution.map((count, rating) => (
                              <div key={rating} className="w-14">
                                <div className="flex items-baseline justify-between text-[10px] text-muted-foreground">
                                  <span className="font-mono">{rating}</span>
                                  <span className="tabular-nums">{count}</span>
                                </div>
                                <div className="mt-1 h-1.5 rounded-full bg-muted">
                                  <div
                                    className={cn('h-1.5 rounded-full', RATING_TONES[rating])}
                                    style={{
                                      width: `${co.respondents > 0 ? (count / co.respondents) * 100 : 0}%`,
                                    }}
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        </td>
                        <td className="border-b px-3 py-3 text-right tabular-nums">
                          {co.respondents}
                        </td>
                        <td className="border-b px-3 py-3 text-right font-medium tabular-nums">
                          {formatAttainment(co.indirectAttainment)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </SectionPanel>

      <AlertDialog
        open={!!confirm}
        onOpenChange={(open) => {
          if (!open) setConfirm(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm === 'close'
                ? 'Close the exit survey?'
                : `Open the exit survey for ${offering.subjectCode}?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm === 'close'
                ? 'Students lose access immediately and no further responses are recorded. You can reopen it later if the offering is not finalized.'
                : `Every student in the cohort (${cohortSize}) is invited to rate each CO. They see it under Course Surveys until you close it.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (confirm) stateMutation.mutate(confirm);
              }}
            >
              {stateMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : confirm === 'close' ? (
                'Close survey'
              ) : (
                'Open survey'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
