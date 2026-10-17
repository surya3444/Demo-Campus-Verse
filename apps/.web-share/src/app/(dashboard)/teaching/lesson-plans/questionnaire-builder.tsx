'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { teachingApi } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Send, Trash2, CheckCircle2, FileQuestion, Trophy } from 'lucide-react';
import { toast } from 'sonner';
import {
  QuestionEditor,
  emptyQuestion,
  type Question,
} from '@/components/teaching/question-editor';

interface QuestionnaireBuilderProps {
  lessonPlanId: string;
  lessonTitle: string;
}

export function QuestionnaireBuilder({ lessonPlanId, lessonTitle }: QuestionnaireBuilderProps) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [questions, setQuestions] = useState<Question[]>([emptyQuestion()]);
  const [isCreating, setIsCreating] = useState(false);

  // Fetch existing questionnaire for this lesson
  const { data: existingData, isLoading } = useQuery({
    queryKey: ['questionnaire', lessonPlanId],
    queryFn: () => teachingApi.getQuestionnaireByLesson(lessonPlanId),
  });

  const { data: submissionsData } = useQuery({
    queryKey: ['questionnaire-submissions', existingData?.data?._id],
    queryFn: () => teachingApi.getQuestionnaireSubmissions(existingData?.data?._id),
    enabled: !!existingData?.data?._id,
  });

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => teachingApi.createQuestionnaire(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['questionnaire', lessonPlanId] });
      toast.success('Questionnaire created');
      setIsCreating(false);
    },
    onError: () => toast.error('Failed to create questionnaire'),
  });

  const publishMutation = useMutation({
    mutationFn: (id: string) => teachingApi.publishQuestionnaire(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['questionnaire', lessonPlanId] });
      queryClient.invalidateQueries({ queryKey: ['lesson-plans-calendar'] });
      toast.success('Questionnaire published and sent to students');
    },
    onError: () => toast.error('Failed to publish questionnaire'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => teachingApi.deleteQuestionnaire(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['questionnaire', lessonPlanId] });
      toast.success('Questionnaire deleted');
    },
    onError: () => toast.error('Failed to delete questionnaire'),
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const questionnaire = existingData?.data as Record<string, any> | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const submissions = (submissionsData?.data as Record<string, any>[]) || [];

  const handleSave = () => {
    if (!title.trim()) {
      toast.error('Please enter a title');
      return;
    }
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.question.trim()) {
        toast.error(`Question ${i + 1} is empty`);
        return;
      }
      if (!q.correctAnswer.trim()) {
        toast.error(`Question ${i + 1} needs a correct answer`);
        return;
      }
      if (q.type === 'mcq' && q.options.filter((o) => o.trim()).length < 2) {
        toast.error(`Question ${i + 1} needs at least 2 options`);
        return;
      }
    }

    createMutation.mutate({
      lessonPlanId,
      title,
      questions: questions.map((q) => ({
        type: q.type,
        question: q.question,
        options: q.type === 'mcq' ? q.options.filter((o) => o.trim()) : undefined,
        correctAnswer: q.correctAnswer,
        marks: q.marks,
      })),
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading questionnaire...
      </div>
    );
  }

  // ============ Existing Questionnaire View ============
  if (questionnaire && !isCreating) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileQuestion className="h-4 w-4 text-purple-500" />
            <span className="text-sm font-semibold">{questionnaire.title}</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant={questionnaire.status === 'published' ? 'default' : 'secondary'}
              className={questionnaire.status === 'published' ? 'bg-purple-600' : ''}
            >
              {questionnaire.status === 'published' ? 'Published' : 'Draft'}
            </Badge>
          </div>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-muted/50 rounded-lg p-2.5 text-center">
            <p className="text-lg font-bold">{questionnaire.questions?.length || 0}</p>
            <p className="text-[10px] text-muted-foreground">Questions</p>
          </div>
          <div className="bg-muted/50 rounded-lg p-2.5 text-center">
            <p className="text-lg font-bold">{questionnaire.totalMarks}</p>
            <p className="text-[10px] text-muted-foreground">Total Marks</p>
          </div>
          <div className="bg-muted/50 rounded-lg p-2.5 text-center">
            <p className="text-lg font-bold">{submissions.length}</p>
            <p className="text-[10px] text-muted-foreground">Submissions</p>
          </div>
        </div>

        {/* Questions List (collapsed) */}
        <div className="space-y-1.5">
          {questionnaire.questions?.map(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (q: any, i: number) => (
              <div key={q._id} className="flex items-center gap-2 text-sm">
                <span className="text-xs font-mono text-muted-foreground w-5">{i + 1}.</span>
                <span className="flex-1 truncate">{q.question}</span>
                <Badge variant="outline" className="text-[9px] shrink-0">
                  {q.marks} mk{q.marks !== 1 ? 's' : ''}
                </Badge>
              </div>
            )
          )}
        </div>

        {/* Submissions */}
        {submissions.length > 0 && (
          <>
            <Separator />
            <div>
              <p className="text-xs font-semibold mb-2 flex items-center gap-1.5">
                <Trophy className="h-3.5 w-3.5 text-amber-500" />
                Submissions
              </p>
              <ScrollArea className="h-[150px]">
                <div className="space-y-1">
                  {submissions.map(
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    (sub: any) => (
                      <div
                        key={sub._id}
                        className="flex items-center justify-between text-sm px-2 py-1.5 rounded-md bg-muted/30"
                      >
                        <span>{sub.studentName || 'Student'}</span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs">
                            {sub.score}/{sub.totalMarks}
                          </span>
                          <Badge
                            variant={sub.percentage >= 50 ? 'default' : 'destructive'}
                            className="text-[10px] px-1.5"
                          >
                            {sub.percentage}%
                          </Badge>
                        </div>
                      </div>
                    )
                  )}
                </div>
              </ScrollArea>
            </div>
          </>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          {questionnaire.status === 'draft' && (
            <Button
              size="sm"
              className="gap-1.5 flex-1 bg-purple-600 hover:bg-purple-700"
              onClick={() => publishMutation.mutate(questionnaire._id)}
              disabled={publishMutation.isPending}
            >
              {publishMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
              Publish & Send
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() => deleteMutation.mutate(questionnaire._id)}
            disabled={deleteMutation.isPending}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    );
  }

  // ============ Create Questionnaire Form ============
  if (!isCreating) {
    return (
      <Button
        variant="outline"
        size="sm"
        className="w-full gap-2"
        onClick={() => {
          setTitle(`${lessonTitle} - Quiz`);
          setQuestions([emptyQuestion()]);
          setIsCreating(true);
        }}
      >
        <FileQuestion className="h-4 w-4" />
        Add Questionnaire
      </Button>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold flex items-center gap-2">
          <FileQuestion className="h-4 w-4 text-purple-500" />
          Create Questionnaire
        </h4>
        <Button variant="ghost" size="sm" onClick={() => setIsCreating(false)}>
          Cancel
        </Button>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Title</Label>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Quiz title"
          className="h-8"
        />
      </div>

      <QuestionEditor questions={questions} onChange={setQuestions} />

      {/* Footer */}
      <div className="flex items-center justify-between pt-2">
        <Button
          size="sm"
          className="gap-1.5"
          onClick={handleSave}
          disabled={createMutation.isPending}
        >
          {createMutation.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <CheckCircle2 className="h-3.5 w-3.5" />
          )}
          Save Questionnaire
        </Button>
      </div>
    </div>
  );
}
