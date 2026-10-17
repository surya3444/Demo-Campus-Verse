'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { teachingApi } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  Users,
  Loader2,
  Save,
  ChevronDown,
  ChevronUp,
  Award,
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

export default function AssignmentSubmissionsPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const id = params.id as string;

  const [expandedSub, setExpandedSub] = useState<string | null>(null);
  const [reviewState, setReviewState] = useState<Record<string, Record<string, boolean>>>({});

  const { data: assignmentData, isLoading: assignmentLoading } = useQuery({
    queryKey: ['assignment', id],
    queryFn: () => teachingApi.getAssignment(id),
  });

  const { data: submissionsData, isLoading: submissionsLoading } = useQuery({
    queryKey: ['assignment-submissions', id],
    queryFn: () => teachingApi.getAssignmentSubmissions(id),
    enabled: !!assignmentData?.data,
  });

  const reviewMutation = useMutation({
    mutationFn: ({
      submissionId,
      questionResults,
    }: {
      submissionId: string;
      questionResults: { questionId: string; isCorrect: boolean }[];
    }) => teachingApi.reviewAssignmentSubmission(id, submissionId, { questionResults }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assignment-submissions', id] });
      queryClient.invalidateQueries({ queryKey: ['assignment-grades', id] });
      setExpandedSub(null);
      toast.success('Submission reviewed and graded');
    },
    onError: (err: { response?: { data?: { error?: { message?: string } } } }) => {
      toast.error(err.response?.data?.error?.message || 'Failed to review submission');
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const assignment = assignmentData?.data as Record<string, any> | undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const submissions = (submissionsData?.data || []) as Record<string, any>[];
  const questions = (assignment?.questions || []) as {
    _id: string;
    question: string;
    type: string;
    correctAnswer: string;
    options?: string[];
    marks: number;
  }[];

  const reviewedCount = submissions.filter((s) => s.reviewed).length;

  const getIsCorrect = (subId: string, qId: string) => {
    if (reviewState[subId]?.[qId] !== undefined) return reviewState[subId][qId];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sub = submissions.find((s: any) => s._id === subId);
    const q = questions.find((q) => q._id === qId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const answer = sub?.answers?.find((a: any) => a.questionId === qId);
    if (q && answer) {
      return q.correctAnswer.trim().toLowerCase() === answer.answer.trim().toLowerCase();
    }
    return false;
  };

  const getReviewScore = (subId: string) =>
    questions.reduce((sum, q) => sum + (getIsCorrect(subId, q._id) ? q.marks : 0), 0);

  if (assignmentLoading || submissionsLoading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!assignment) {
    return (
      <div className="max-w-4xl mx-auto text-center py-16">
        <h3 className="text-lg font-medium">Assignment not found</h3>
        <Button variant="outline" className="mt-4" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/teaching/assignments/${id}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">{assignment.title}</h1>
          <p className="text-muted-foreground text-sm">
            {assignment.sectionName} · {assignment.subjectName} · {assignment.totalMarks} marks
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-5 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
              <Users className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{submissions.length}</p>
              <p className="text-xs text-muted-foreground">Submissions</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{reviewedCount}</p>
              <p className="text-xs text-muted-foreground">Reviewed</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
              <Award className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{submissions.length - reviewedCount}</p>
              <p className="text-xs text-muted-foreground">Pending</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Submissions */}
      {submissions.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="mx-auto h-12 w-12 text-muted-foreground/30" />
            <h3 className="mt-4 text-lg font-medium">No submissions yet</h3>
            <p className="text-muted-foreground">
              Students haven&apos;t submitted any answers yet.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {submissions.map((sub) => {
            const subId = sub._id as string;
            const isReviewed = sub.reviewed as boolean;
            const isExpanded = expandedSub === subId;
            const score = isReviewed ? sub.reviewedScore : getReviewScore(subId);

            return (
              <Card key={subId} className={isExpanded ? 'ring-2 ring-primary/20' : ''}>
                {/* Student Header — always visible */}
                <button
                  type="button"
                  className="w-full text-left"
                  onClick={() => setExpandedSub(isExpanded ? null : subId)}
                >
                  <CardContent className="py-4">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center font-bold text-primary text-sm">
                        {(sub.studentName as string)?.charAt(0) || 'S'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium">{sub.studentName || 'Student'}</p>
                        <p className="text-xs text-muted-foreground">
                          {sub.admissionNumber} · {new Date(sub.submittedAt).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        {isReviewed ? (
                          <Badge variant="default" className="bg-green-600 gap-1">
                            <CheckCircle className="h-3 w-3" />
                            {sub.reviewedScore}/{assignment.totalMarks}
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="gap-1">
                            Pending · {score}/{assignment.totalMarks}
                          </Badge>
                        )}
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                    </div>
                  </CardContent>
                </button>

                {/* Expanded Review */}
                {isExpanded && (
                  <div className="border-t px-6 py-5 space-y-4 bg-muted/5">
                    {questions.map((q, qIdx) => {
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      const studentAnswer = sub.answers?.find((a: any) => a.questionId === q._id);
                      const isCorrect = isReviewed
                        ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          sub.questionResults?.find((r: any) => r.questionId === q._id)?.isCorrect
                        : getIsCorrect(subId, q._id);

                      return (
                        <div key={q._id} className="rounded-xl border bg-background p-4 space-y-3">
                          {/* Question Header */}
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-2 flex-1">
                              <span className="shrink-0 w-7 h-7 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center mt-0.5">
                                {qIdx + 1}
                              </span>
                              <div>
                                <p className="text-sm font-medium leading-relaxed">{q.question}</p>
                                <div className="flex items-center gap-2 mt-1">
                                  <Badge variant="outline" className="text-[10px]">
                                    {q.type === 'mcq'
                                      ? 'MCQ'
                                      : q.type === 'true_false'
                                        ? 'True/False'
                                        : 'Short Answer'}
                                  </Badge>
                                  <span className="text-[10px] text-muted-foreground">
                                    {q.marks} marks
                                  </span>
                                </div>
                              </div>
                            </div>
                            {/* Toggle Button */}
                            {!isReviewed ? (
                              <div className="shrink-0 flex items-center gap-1.5">
                                <button
                                  type="button"
                                  className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                                    isCorrect
                                      ? 'bg-green-600 text-white shadow-sm'
                                      : 'bg-green-50 text-green-700 border border-green-200 hover:bg-green-100'
                                  }`}
                                  onClick={() =>
                                    setReviewState((prev) => ({
                                      ...prev,
                                      [subId]: { ...prev[subId], [q._id]: true },
                                    }))
                                  }
                                >
                                  <CheckCircle className="h-3.5 w-3.5" /> Correct
                                </button>
                                <button
                                  type="button"
                                  className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                                    !isCorrect
                                      ? 'bg-red-600 text-white shadow-sm'
                                      : 'bg-red-50 text-red-700 border border-red-200 hover:bg-red-100'
                                  }`}
                                  onClick={() =>
                                    setReviewState((prev) => ({
                                      ...prev,
                                      [subId]: { ...prev[subId], [q._id]: false },
                                    }))
                                  }
                                >
                                  <XCircle className="h-3.5 w-3.5" /> Wrong
                                </button>
                              </div>
                            ) : (
                              <Badge
                                className={`shrink-0 gap-1 ${isCorrect ? 'bg-green-600' : 'bg-red-600'}`}
                              >
                                {isCorrect ? (
                                  <>
                                    <CheckCircle className="h-3 w-3" /> Correct
                                  </>
                                ) : (
                                  <>
                                    <XCircle className="h-3 w-3" /> Wrong
                                  </>
                                )}
                              </Badge>
                            )}
                          </div>

                          {/* Answer Comparison */}
                          <div className="grid grid-cols-2 gap-3">
                            <div className="rounded-lg p-3 bg-green-50 border border-green-100">
                              <p className="text-[10px] font-semibold text-green-600 uppercase tracking-wider mb-1">
                                Correct Answer
                              </p>
                              <p className="text-sm">{q.correctAnswer}</p>
                            </div>
                            <div
                              className={`rounded-lg p-3 border ${
                                isCorrect
                                  ? 'bg-green-50 border-green-100'
                                  : 'bg-red-50 border-red-100'
                              }`}
                            >
                              <p
                                className={`text-[10px] font-semibold uppercase tracking-wider mb-1 ${
                                  isCorrect ? 'text-green-600' : 'text-red-600'
                                }`}
                              >
                                Student&apos;s Answer
                              </p>
                              <p className="text-sm">{studentAnswer?.answer || 'No answer'}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {/* Save Button */}
                    {!isReviewed && (
                      <div className="flex items-center justify-between pt-2">
                        <p className="text-sm text-muted-foreground">
                          Score:{' '}
                          <span className="font-semibold text-foreground">
                            {getReviewScore(subId)}
                          </span>{' '}
                          / {assignment.totalMarks}
                        </p>
                        <Button
                          onClick={() => {
                            const questionResults = questions.map((q) => ({
                              questionId: q._id,
                              isCorrect: getIsCorrect(subId, q._id),
                            }));
                            reviewMutation.mutate({ submissionId: subId, questionResults });
                          }}
                          disabled={reviewMutation.isPending}
                          className="gap-2"
                        >
                          {reviewMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Save className="h-4 w-4" />
                          )}
                          Save & Grade
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
