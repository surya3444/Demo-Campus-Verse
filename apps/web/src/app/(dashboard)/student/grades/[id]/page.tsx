'use client';

import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { dashboardApi, teachingApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, CheckCircle, XCircle, Award, CircleDot, ToggleLeft, Type } from 'lucide-react';

export default function StudentGradeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string; // This is the assignmentId/questionnaireId

  const { data: dashData } = useQuery({
    queryKey: ['student-dashboard'],
    queryFn: () => dashboardApi.getStudentDashboard(),
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const student = dashData?.data?.student as Record<string, any> | undefined;
  const studentId = student?._id as string | undefined;

  // Fetch the student's grade for this item
  const { data: gradesData } = useQuery({
    queryKey: ['student-grades', studentId],
    queryFn: () => teachingApi.getStudentGrades(studentId!),
    enabled: !!studentId,
  });

  // Try fetching assignment submission first, then questionnaire
  const { data: assignmentSubData, isLoading: aLoading } = useQuery({
    queryKey: ['my-assignment-submission', id],
    queryFn: () => teachingApi.getMyAssignmentSubmission(id),
    enabled: !!studentId,
    retry: false,
  });

  const { data: questionnaireSubData, isLoading: qLoading } = useQuery({
    queryKey: ['my-questionnaire-submission', id],
    queryFn: () => teachingApi.getMyQuestionnaireSubmission(id),
    enabled: !!studentId && !assignmentSubData?.data,
    retry: false,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const submission = (assignmentSubData?.data || questionnaireSubData?.data) as
    | Record<string, any>
    | undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const grades = (gradesData?.data || []) as Record<string, any>[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const grade = grades.find((g: any) => g.assignmentId === id);

  const isLoading = aLoading || qLoading;

  if (isLoading || !student) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!submission || !submission.reviewed) {
    return (
      <div className="max-w-3xl mx-auto text-center py-16">
        <Award className="mx-auto h-12 w-12 text-muted-foreground/30" />
        <h3 className="mt-4 text-lg font-medium">Result not available yet</h3>
        <p className="text-muted-foreground">
          Your teacher hasn&apos;t reviewed this submission yet.
        </p>
        <Button variant="outline" className="mt-4" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
      </div>
    );
  }

  const questions = (submission.questions || []) as {
    _id: string;
    question: string;
    type: string;
    correctAnswer: string;
    options?: string[];
    marks: number;
  }[];
  const answers = (submission.answers || []) as { questionId: string; answer: string }[];
  const questionResults = (submission.questionResults || []) as {
    questionId: string;
    isCorrect: boolean;
  }[];

  const resultMap = new Map(questionResults.map((r) => [r.questionId, r.isCorrect]));
  const answerMap = new Map(answers.map((a) => [a.questionId, a.answer]));

  const pct = grade?.percentage || 0;

  const typeIcon = (type: string) => {
    switch (type) {
      case 'mcq':
        return <CircleDot className="h-3.5 w-3.5" />;
      case 'true_false':
        return <ToggleLeft className="h-3.5 w-3.5" />;
      default:
        return <Type className="h-3.5 w-3.5" />;
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Button
        variant="ghost"
        size="sm"
        className="gap-1"
        onClick={() => router.push('/student/grades')}
      >
        <ArrowLeft className="h-4 w-4" /> Back to Gradebook
      </Button>

      {/* Score Header */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-6">
            <div
              className={`w-20 h-20 rounded-2xl flex flex-col items-center justify-center ${
                pct >= 75
                  ? 'bg-green-100 text-green-700'
                  : pct >= 50
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-red-100 text-red-700'
              }`}
            >
              <span className="text-2xl font-bold">{pct}%</span>
            </div>
            <div className="flex-1">
              <h1 className="text-xl font-bold">{grade?.assignment?.title || 'Result'}</h1>
              <p className="text-sm text-muted-foreground mt-1">
                {grade?.assignment?.subjectName || ''} · {grade?.assignment?.sectionName || ''}
              </p>
              <div className="flex items-center gap-3 mt-2">
                <Badge variant="outline" className="gap-1">
                  <Award className="h-3 w-3" />
                  {submission.reviewedScore}/{submission.totalMarks} marks
                </Badge>
                <Badge
                  variant={pct >= 50 ? 'default' : 'destructive'}
                  className={pct >= 50 ? 'bg-green-600' : ''}
                >
                  {pct >= 75 ? 'Excellent' : pct >= 50 ? 'Pass' : 'Needs Improvement'}
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Question-by-Question Results */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Question-wise Results</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {questions.map((q, idx) => {
              const isCorrect = resultMap.get(q._id) ?? false;
              const studentAnswer = answerMap.get(q._id) || 'No answer';

              return (
                <div
                  key={q._id}
                  className={`rounded-xl border p-4 ${
                    isCorrect ? 'border-green-200 bg-green-50/50' : 'border-red-200 bg-red-50/50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-start gap-2 flex-1">
                      <span className="shrink-0 w-7 h-7 rounded-full bg-background border flex items-center justify-center text-xs font-bold mt-0.5">
                        {idx + 1}
                      </span>
                      <div>
                        <p className="text-sm font-medium">{q.question}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-[10px] gap-0.5">
                            {typeIcon(q.type)}
                            {q.type === 'mcq' ? 'MCQ' : q.type === 'true_false' ? 'T/F' : 'Short'}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground">{q.marks} marks</span>
                        </div>
                      </div>
                    </div>
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
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg p-3 bg-green-100/50 border border-green-200">
                      <p className="text-[10px] font-semibold text-green-700 uppercase tracking-wider mb-1">
                        Correct Answer
                      </p>
                      <p className="text-sm font-medium">{q.correctAnswer}</p>
                    </div>
                    <div
                      className={`rounded-lg p-3 border ${
                        isCorrect
                          ? 'bg-green-100/50 border-green-200'
                          : 'bg-red-100/50 border-red-200'
                      }`}
                    >
                      <p
                        className={`text-[10px] font-semibold uppercase tracking-wider mb-1 ${
                          isCorrect ? 'text-green-700' : 'text-red-700'
                        }`}
                      >
                        Your Answer
                      </p>
                      <p className="text-sm font-medium">{studentAnswer}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
