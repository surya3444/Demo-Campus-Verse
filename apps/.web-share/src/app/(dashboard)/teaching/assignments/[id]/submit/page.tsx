'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { teachingApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ClipboardList,
  CheckCircle2,
  Loader2,
  CircleDot,
  ToggleLeft,
  Type,
  Trophy,
  ArrowLeft,
} from 'lucide-react';
import { toast } from 'sonner';

interface Answer {
  questionId: string;
  answer: string;
}

export default function AssignmentSubmitPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const id = params.id as string;
  const [answers, setAnswers] = useState<Map<string, string>>(new Map());
  const [submitted, setSubmitted] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [result, setResult] = useState<Record<string, any> | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['assignment', id],
    queryFn: () => teachingApi.getAssignment(id),
  });

  const submitMutation = useMutation({
    mutationFn: (submitData: { answers: Answer[] }) => teachingApi.submitAssignment(id, submitData),
    onSuccess: (res) => {
      setSubmitted(true);
      setResult(res.data);
      queryClient.invalidateQueries({ queryKey: ['student-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['student-assignments'] });
      toast.success('Assignment submitted successfully!');
    },
    onError: (err: { response?: { data?: { error?: { message?: string } } } }) => {
      toast.error(err.response?.data?.error?.message || 'Failed to submit');
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const assignment = data?.data as Record<string, any> | undefined;

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
      </div>
    );
  }

  if (!assignment) {
    return (
      <div className="max-w-3xl mx-auto text-center py-16">
        <ClipboardList className="mx-auto h-12 w-12 text-muted-foreground/30" />
        <h3 className="mt-4 text-lg font-medium">Assignment not found</h3>
        <Button variant="outline" className="mt-4" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
      </div>
    );
  }

  if (!assignment.hasQuestions || !assignment.questions?.length) {
    return (
      <div className="max-w-3xl mx-auto text-center py-16">
        <ClipboardList className="mx-auto h-12 w-12 text-muted-foreground/30" />
        <h3 className="mt-4 text-lg font-medium">This assignment has no questions to answer</h3>
        <Button variant="outline" className="mt-4" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
      </div>
    );
  }

  if (assignment.status !== 'published') {
    return (
      <div className="max-w-3xl mx-auto text-center py-16">
        <ClipboardList className="mx-auto h-12 w-12 text-muted-foreground/30" />
        <h3 className="mt-4 text-lg font-medium">This assignment is not open for submissions</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Please wait for your teacher to publish it.
        </p>
      </div>
    );
  }

  const handleSetAnswer = (questionId: string, answer: string) => {
    setAnswers((prev) => {
      const updated = new Map(prev);
      updated.set(questionId, answer);
      return updated;
    });
  };

  const handleSubmit = () => {
    const answerList: Answer[] = [];
    for (const q of assignment.questions || []) {
      const answer = answers.get(q._id) || '';
      if (!answer.trim()) {
        toast.error('Please answer all questions');
        return;
      }
      answerList.push({ questionId: q._id, answer });
    }
    submitMutation.mutate({ answers: answerList });
  };

  // ============ Result View ============
  if (submitted && result) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <Button variant="ghost" size="sm" className="gap-1" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>

        <Card>
          <CardContent className="pt-8 text-center space-y-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
              <Trophy className="h-8 w-8 text-green-600" />
            </div>
            <h2 className="text-xl font-bold">Submitted!</h2>
            <p className="text-muted-foreground">
              Your answers have been recorded. Your teacher will review and grade them.
            </p>
            <Button className="mt-4" onClick={() => router.push('/student/assignments')}>
              Back to Assignments
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ============ Answering View ============
  const questions = assignment.questions || [];
  const typeIcon = (type: string) => {
    switch (type) {
      case 'mcq':
        return <CircleDot className="h-4 w-4 text-blue-500" />;
      case 'true_false':
        return <ToggleLeft className="h-4 w-4 text-amber-500" />;
      default:
        return <Type className="h-4 w-4 text-emerald-500" />;
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Button variant="ghost" size="sm" className="gap-1" onClick={() => router.back()}>
        <ArrowLeft className="h-4 w-4" /> Back
      </Button>

      <div>
        <h1 className="text-2xl font-bold">{assignment.title}</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {assignment.sectionName} · {assignment.subjectName} · {questions.length} questions ·{' '}
          {assignment.totalMarks} marks
        </p>
        {assignment.description && (
          <p className="text-sm mt-3 text-muted-foreground">{assignment.description}</p>
        )}
        {assignment.instructions && (
          <div className="mt-2 p-3 bg-muted/50 rounded-lg text-sm">{assignment.instructions}</div>
        )}
      </div>

      <div className="space-y-4">
        {questions.map(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (q: any, idx: number) => {
            const currentAnswer = answers.get(q._id) || '';

            return (
              <Card key={q._id}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <span className="shrink-0 w-7 h-7 rounded-full bg-primary/10 text-primary text-sm font-bold flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <span className="flex-1">{q.question}</span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {typeIcon(q.type)}
                      <Badge variant="outline" className="text-[10px]">
                        {q.marks} mk{q.marks !== 1 ? 's' : ''}
                      </Badge>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {q.type === 'mcq' && q.options && (
                    <div className="space-y-2">
                      {q.options.map((opt: string, oIdx: number) => (
                        <button
                          key={oIdx}
                          onClick={() => handleSetAnswer(q._id, opt)}
                          className={`w-full text-left px-4 py-2.5 rounded-lg border text-sm transition-all ${
                            currentAnswer === opt
                              ? 'border-primary bg-primary/5 font-medium'
                              : 'border-border hover:border-primary/40 hover:bg-muted/50'
                          }`}
                        >
                          <span className="inline-flex items-center gap-2">
                            <span
                              className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                                currentAnswer === opt
                                  ? 'border-primary bg-primary'
                                  : 'border-muted-foreground/30'
                              }`}
                            >
                              {currentAnswer === opt && (
                                <CheckCircle2 className="h-3 w-3 text-white" />
                              )}
                            </span>
                            {opt}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}

                  {q.type === 'true_false' && (
                    <div className="flex gap-3">
                      {['True', 'False'].map((val) => (
                        <Button
                          key={val}
                          variant={
                            currentAnswer.toLowerCase() === val.toLowerCase()
                              ? 'default'
                              : 'outline'
                          }
                          className="flex-1"
                          onClick={() => handleSetAnswer(q._id, val.toLowerCase())}
                        >
                          {val}
                        </Button>
                      ))}
                    </div>
                  )}

                  {q.type === 'short_answer' && (
                    <Input
                      value={currentAnswer}
                      onChange={(e) => handleSetAnswer(q._id, e.target.value)}
                      placeholder="Type your answer..."
                    />
                  )}
                </CardContent>
              </Card>
            );
          }
        )}
      </div>

      <div className="flex items-center justify-between py-4">
        <p className="text-sm text-muted-foreground">
          {answers.size} of {questions.length} answered
        </p>
        <Button
          size="lg"
          className="gap-2"
          onClick={handleSubmit}
          disabled={submitMutation.isPending || answers.size < questions.length}
        >
          {submitMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <CheckCircle2 className="h-4 w-4" />
          )}
          Submit Answers
        </Button>
      </div>
    </div>
  );
}
