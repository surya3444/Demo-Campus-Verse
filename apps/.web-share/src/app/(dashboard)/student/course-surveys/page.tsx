'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Loader2, Star } from 'lucide-react';
import { toast } from 'sonner';
import { obeApi } from '@/lib/api';
import { cn, getErrorMessage } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

interface MySurvey {
  offeringId: string;
  subjectCode: string;
  subjectName: string;
  termName: string;
  submitted: boolean;
  cos: Array<{ coId: string; code: string; statement: string }>;
}

const RATINGS = [0, 1, 2, 3];

const SCALE_LEGEND = '0 = not at all · 1 = a little · 2 = well · 3 = very well';

export default function StudentCourseSurveysPage() {
  const queryClient = useQueryClient();
  /** offeringId → coId → rating, so two open cards never share state. */
  const [ratings, setRatings] = useState<Record<string, Record<string, number>>>({});

  const { data, isLoading } = useQuery({
    queryKey: ['obe-my-surveys'],
    queryFn: async () => {
      const res = await obeApi.getMySurveys();
      return (res?.data ?? []) as MySurvey[];
    },
  });

  const submitMutation = useMutation({
    mutationFn: (vars: { offeringId: string; ratings: Array<{ coId: string; rating: number }> }) =>
      obeApi.respondToSurvey(vars.offeringId, vars.ratings),
    onSuccess: () => {
      toast.success('Thanks — your feedback was recorded');
      queryClient.invalidateQueries({ queryKey: ['obe-my-surveys'] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const setRating = (offeringId: string, coId: string, rating: number) =>
    setRatings((prev) => ({ ...prev, [offeringId]: { ...prev[offeringId], [coId]: rating } }));

  const surveys = data ?? [];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Course Surveys</h1>
        <p className="text-muted-foreground">
          Rate how well each course delivered what it set out to teach. Responses are anonymous in
          the reports your department sees.
        </p>
      </div>

      {surveys.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Star className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-medium">Nothing to fill in</h3>
            <p className="text-muted-foreground">No open course surveys right now.</p>
          </CardContent>
        </Card>
      ) : (
        surveys.map((survey) => {
          const picked = ratings[survey.offeringId] ?? {};
          const complete =
            survey.cos.length > 0 && survey.cos.every((co) => picked[co.coId] != null);
          const pending =
            submitMutation.isPending && submitMutation.variables?.offeringId === survey.offeringId;

          return (
            <Card key={survey.offeringId}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <CardTitle className="text-base">
                      {survey.subjectCode} — {survey.subjectName}
                    </CardTitle>
                    <p className="mt-1 text-xs text-muted-foreground">{survey.termName}</p>
                  </div>
                  {survey.submitted ? (
                    <Badge
                      variant="outline"
                      className="shrink-0 gap-1 border-emerald-300 text-emerald-700 dark:border-emerald-800 dark:text-emerald-300"
                    >
                      <CheckCircle2 className="h-3 w-3" />
                      Submitted
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="shrink-0">
                      Pending
                    </Badge>
                  )}
                </div>
              </CardHeader>

              <CardContent>
                {survey.submitted ? (
                  <p className="text-sm text-muted-foreground">
                    Thanks — your ratings for this course are in. Nothing more to do here.
                  </p>
                ) : survey.cos.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    This course has no outcomes published yet — check back later.
                  </p>
                ) : (
                  <div className="space-y-4">
                    <p className="text-xs text-muted-foreground">
                      How well did this course help you achieve each outcome? {SCALE_LEGEND}
                    </p>

                    {survey.cos.map((co) => (
                      <div
                        key={co.coId}
                        className="flex flex-col gap-3 rounded-lg border bg-muted/20 p-3 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-mono text-muted-foreground">{co.code}</p>
                          <p className="text-sm">{co.statement}</p>
                        </div>
                        <div className="flex shrink-0 gap-1.5">
                          {RATINGS.map((rating) => {
                            const active = picked[co.coId] === rating;
                            return (
                              <button
                                key={rating}
                                type="button"
                                aria-pressed={active}
                                aria-label={`${co.code} rating ${rating}`}
                                onClick={() => setRating(survey.offeringId, co.coId, rating)}
                                className={cn(
                                  'h-9 w-9 rounded-md border text-sm font-medium transition-colors',
                                  active
                                    ? 'border-primary bg-primary text-primary-foreground'
                                    : 'border-border bg-background hover:bg-muted'
                                )}
                              >
                                {rating}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}

                    <div className="flex items-center justify-end gap-3">
                      {!complete && (
                        <p className="text-xs text-muted-foreground">
                          Rate every outcome to submit.
                        </p>
                      )}
                      <Button
                        disabled={!complete || pending}
                        onClick={() =>
                          submitMutation.mutate({
                            offeringId: survey.offeringId,
                            ratings: survey.cos.map((co) => ({
                              coId: co.coId,
                              rating: picked[co.coId] as number,
                            })),
                          })
                        }
                      >
                        {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Submit
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}
