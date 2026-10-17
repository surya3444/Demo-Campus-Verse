'use client';

import { useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { teachingApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  FileQuestion,
  CheckCircle,
  CheckCircle2,
  Loader2,
  CircleDot,
  ToggleLeft,
  Type,
  Trophy,
  ArrowLeft,
  Send,
  Trash2,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

interface Answer {
  questionId: string;
  answer: string;
}

export default function QuestionnaireAnswerPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const id = params.id as string;
  const isTeacherView = searchParams.get('view') === 'teacher';

  const [answers, setAnswers] = useState<Map<string, string>>(new Map());
  const [submitted, setSubmitted] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [result, setResult] = useState<Record<string, any> | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['questionnaire', id],
    queryFn: () => teachingApi.getQuestionnaire(id),
  });

  const { data: submissionsData } = useQuery({
    queryKey: ['questionnaire-submissions', id],
    queryFn: () => teachingApi.getQuestionnaireSubmissions(id),
    enabled: isTeacherView,
  });

  const submitMutation = useMutation({
    mutationFn: (submitData: { answers: Answer[] }) =>
      teachingApi.submitQuestionnaire(id, submitData),
    onSuccess: (res) => {
      setSubmitted(true);
      setResult(res.data);
      queryClient.invalidateQueries({ queryKey: ['student-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['student-questionnaires'] });
      toast.success('Questionnaire submitted successfully!');
    },
    onError: (err: { response?: { data?: { error?: { message?: string } } } }) => {
      toast.error(err.response?.data?.error?.message || 'Failed to submit');
    },
  });

  const publishMutation = useMutation({
    mutationFn: () => teachingApi.publishQuestionnaire(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['questionnaire', id] });
      queryClient.invalidateQueries({ queryKey: ['questionnaires'] });
      toast.success('Questionnaire published and sent to students');
    },
    onError: () => toast.error('Failed to publish questionnaire'),
  });

  const deleteMutation = useMutation({
    mutationFn: () => teachingApi.deleteQuestionnaire(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['questionnaires'] });
      toast.success('Questionnaire deleted');
      router.push('/teaching/assignments');
    },
    onError: () => toast.error('Failed to delete questionnaire'),
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const questionnaire = data?.data as Record<string, any> | undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const submissions = (submissionsData?.data as Record<string, any>[]) || [];

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

  const typeLabel = (type: string) => {
    switch (type) {
      case 'mcq':
        return 'MCQ';
      case 'true_false':
        return 'True/False';
      default:
        return 'Short Answer';
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
      </div>
    );
  }

  if (!questionnaire) {
    return (
      <div className="max-w-3xl mx-auto text-center py-16">
        <FileQuestion className="mx-auto h-12 w-12 text-muted-foreground/30" />
        <h3 className="mt-4 text-lg font-medium">Questionnaire not found</h3>
        <Button variant="outline" className="mt-4" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
      </div>
    );
  }

  // ============ Teacher View ============
  if (isTeacherView) {
    const questions = questionnaire.questions || [];

    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <Button variant="ghost" size="sm" className="gap-1" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{questionnaire.title}</h1>
            <p className="text-muted-foreground text-sm mt-1">
              {questionnaire.sectionName} · {questionnaire.subjectName}
              {questionnaire.lessonTitle && ` · ${questionnaire.lessonTitle}`}
            </p>
          </div>
          <Badge
            variant={questionnaire.status === 'published' ? 'default' : 'secondary'}
            className={questionnaire.status === 'published' ? 'bg-purple-600' : ''}
          >
            {questionnaire.status === 'published' ? 'Published' : 'Draft'}
          </Badge>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-4 text-center">
              <p className="text-2xl font-bold">{questions.length}</p>
              <p className="text-xs text-muted-foreground">Questions</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <p className="text-2xl font-bold">{questionnaire.totalMarks}</p>
              <p className="text-xs text-muted-foreground">Total Marks</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <p className="text-2xl font-bold">{submissions.length}</p>
              <p className="text-xs text-muted-foreground">Submissions</p>
            </CardContent>
          </Card>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          {questionnaire.status === 'draft' && (
            <Button
              className="gap-1.5 bg-purple-600 hover:bg-purple-700"
              onClick={() => publishMutation.mutate()}
              disabled={publishMutation.isPending}
            >
              {publishMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Publish & Send to Students
            </Button>
          )}
          <Button
            variant="outline"
            className="gap-1.5 text-destructive"
            onClick={() => deleteMutation.mutate()}
            disabled={deleteMutation.isPending}
          >
            {deleteMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            Delete
          </Button>
        </div>

        {/* Questions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileQuestion className="h-5 w-5 text-purple-500" />
              Questions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {questions.map(
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (q: any, idx: number) => (
                  <div key={q._id} className="border rounded-lg p-3 bg-muted/10">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-[10px] px-1.5">
                          Q{idx + 1}
                        </Badge>
                        <Badge variant="outline" className="text-[10px] gap-1">
                          {typeIcon(q.type)}
                          {typeLabel(q.type)}
                        </Badge>
                      </div>
                      <Badge variant="outline" className="text-[10px]">
                        {q.marks} mark{q.marks !== 1 ? 's' : ''}
                      </Badge>
                    </div>
                    <p className="text-sm font-medium">{q.question}</p>
                    {q.type === 'mcq' && q.options && (
                      <div className="mt-2 space-y-1 pl-2">
                        {q.options.map((opt: string, oIdx: number) => (
                          <div
                            key={oIdx}
                            className={`text-xs flex items-center gap-1.5 ${
                              q.correctAnswer === opt
                                ? 'text-green-600 font-medium'
                                : 'text-muted-foreground'
                            }`}
                          >
                            <span className="w-4">{String.fromCharCode(65 + oIdx)}.</span>
                            {opt}
                            {q.correctAnswer === opt && (
                              <CheckCircle className="h-3 w-3 text-green-500" />
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    {q.type === 'true_false' && q.correctAnswer && (
                      <p className="text-xs text-green-600 mt-1 pl-2">Answer: {q.correctAnswer}</p>
                    )}
                    {q.type === 'short_answer' && q.correctAnswer && (
                      <p className="text-xs text-green-600 mt-1 pl-2">Answer: {q.correctAnswer}</p>
                    )}
                  </div>
                )
              )}
            </div>
          </CardContent>
        </Card>

        {/* Submissions Link */}
        {submissions.length > 0 && (
          <Button variant="outline" className="w-full gap-2" asChild>
            <Link href={`/teaching/questionnaires/${id}/submissions`}>
              <Users className="h-4 w-4" />
              View Submissions ({submissions.length})
              {(() => {
                const reviewed = submissions.filter(
                  (s: { reviewed?: boolean }) => s.reviewed
                ).length;
                return reviewed > 0 ? (
                  <Badge variant="default" className="ml-2 bg-green-600 text-[10px]">
                    {reviewed} graded
                  </Badge>
                ) : null;
              })()}
            </Link>
          </Button>
        )}
      </div>
    );
  }

  // ============ Student Views ============

  if (questionnaire.status !== 'published') {
    return (
      <div className="max-w-3xl mx-auto text-center py-16">
        <FileQuestion className="mx-auto h-12 w-12 text-muted-foreground/30" />
        <h3 className="mt-4 text-lg font-medium">This questionnaire is not open yet</h3>
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
    for (const q of questionnaire.questions || []) {
      const answer = answers.get(q._id) || '';
      if (!answer.trim()) {
        toast.error(`Please answer all questions`);
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
  const questions = questionnaire.questions || [];

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Button variant="ghost" size="sm" className="gap-1" onClick={() => router.back()}>
        <ArrowLeft className="h-4 w-4" /> Back
      </Button>

      <div>
        <h1 className="text-2xl font-bold">{questionnaire.title}</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {questionnaire.lessonTitle} · {questions.length} questions · {questionnaire.totalMarks}{' '}
          marks
        </p>
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
