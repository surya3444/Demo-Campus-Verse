'use client';

import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { coursesApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { CurriculumTree, type SelectedItem } from './CurriculumTree';
import { ContentEditor } from './ContentEditor';

/* ---------- types ---------- */

interface CurriculumBuilderProps {
  courseId: string;
}

/* ---------- component ---------- */

export function CurriculumBuilder({ courseId }: CurriculumBuilderProps) {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<SelectedItem>(null);

  /* ---- Add Lesson dialog state ---- */
  const [addLessonTo, setAddLessonTo] = useState<string | null>(null);
  const [newLessonTitle, setNewLessonTitle] = useState('');
  const [newLessonType, setNewLessonType] = useState<'video' | 'document' | 'live'>('video');

  /* ---- Add Quiz dialog state ---- */
  const [addQuizTo, setAddQuizTo] = useState<string | null>(null);
  const [newQuizTitle, setNewQuizTitle] = useState('');

  /* ---- queries ---- */
  const { data: courseData, isLoading: courseLoading } = useQuery({
    queryKey: ['course', courseId],
    queryFn: () => coursesApi.getCourse(courseId),
  });

  const { data: lessonsData, isLoading: lessonsLoading } = useQuery({
    queryKey: ['lessons', courseId],
    queryFn: () => coursesApi.getLessons(courseId, { limit: 100 }),
  });

  const { data: quizzesData, isLoading: quizzesLoading } = useQuery({
    queryKey: ['quizzes', courseId],
    queryFn: () => coursesApi.getQuizzes(courseId, { limit: 100 }),
  });

  const modules = courseData?.data?.modules || [];
  const lessons = lessonsData?.data || [];
  const quizzes = quizzesData?.data || [];

  /* ---- mutations ---- */

  // Add section (module)
  const addSectionMut = useMutation({
    mutationFn: () => {
      const updatedModules = [
        ...modules,
        {
          title: `Section ${modules.length + 1}`,
          description: '',
          order: modules.length,
          resources: [],
        },
      ];
      return coursesApi.updateCourse(courseId, { modules: updatedModules } as unknown as Record<
        string,
        unknown
      >);
    },
    onSuccess: () => {
      toast.success('Section added');
      queryClient.invalidateQueries({ queryKey: ['course', courseId] });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error?.message || 'Failed to add section');
    },
  });

  // Delete section
  const deleteSectionMut = useMutation({
    mutationFn: (sectionId: string) => {
      const updatedModules = modules
        .filter((m: any) => m._id !== sectionId)
        .map((m: any, i: number) => ({ ...m, order: i }));
      return coursesApi.updateCourse(courseId, { modules: updatedModules } as unknown as Record<
        string,
        unknown
      >);
    },
    onSuccess: () => {
      toast.success('Section deleted');
      queryClient.invalidateQueries({ queryKey: ['course', courseId] });
      if (selected?.kind === 'section') setSelected(null);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error?.message || 'Failed to delete section');
    },
  });

  // Rename section
  const renameSectionMut = useMutation({
    mutationFn: ({ sectionId, title }: { sectionId: string; title: string }) => {
      const updatedModules = modules.map((m: any) => (m._id === sectionId ? { ...m, title } : m));
      return coursesApi.updateCourse(courseId, { modules: updatedModules } as unknown as Record<
        string,
        unknown
      >);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['course', courseId] });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error?.message || 'Failed to rename section');
    },
  });

  // Save section (full update from editor)
  const saveSectionMut = useMutation({
    mutationFn: ({ sectionId, data }: { sectionId: string; data: Record<string, unknown> }) => {
      const updatedModules = modules.map((m: any) => (m._id === sectionId ? { ...m, ...data } : m));
      return coursesApi.updateCourse(courseId, { modules: updatedModules } as unknown as Record<
        string,
        unknown
      >);
    },
    onSuccess: () => {
      toast.success('Section saved');
      queryClient.invalidateQueries({ queryKey: ['course', courseId] });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error?.message || 'Failed to save section');
    },
  });

  // Create lesson
  const createLessonMut = useMutation({
    mutationFn: ({ moduleId, title, type }: { moduleId: string; title: string; type: string }) => {
      const moduleLessons = lessons.filter((l: any) => l.moduleId === moduleId);
      return coursesApi.createLesson(courseId, {
        courseId,
        moduleId,
        title,
        type,
        order: moduleLessons.length,
        isPreview: false,
        isFree: false,
        learningObjectives: [],
        attachments: [],
        tags: [],
      });
    },
    onSuccess: (res) => {
      toast.success('Lesson added');
      queryClient.invalidateQueries({ queryKey: ['lessons', courseId] });
      setAddLessonTo(null);
      setNewLessonTitle('');
      setNewLessonType('video');
      // Select the new lesson
      if (res?.data?._id) {
        setSelected({ kind: 'lesson', id: res.data._id, sectionId: addLessonTo! });
      }
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error?.message || 'Failed to add lesson');
    },
  });

  // Save lesson
  const saveLessonMut = useMutation({
    mutationFn: ({ lessonId, data }: { lessonId: string; data: Record<string, unknown> }) =>
      coursesApi.updateLesson(courseId, lessonId, data),
    onSuccess: () => {
      toast.success('Lesson saved');
      queryClient.invalidateQueries({ queryKey: ['lessons', courseId] });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error?.message || 'Failed to save lesson');
    },
  });

  // Delete lesson
  const deleteLessonMut = useMutation({
    mutationFn: (lessonId: string) => coursesApi.deleteLesson(courseId, lessonId),
    onSuccess: () => {
      toast.success('Lesson deleted');
      queryClient.invalidateQueries({ queryKey: ['lessons', courseId] });
      if (selected?.kind === 'lesson') setSelected(null);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error?.message || 'Failed to delete lesson');
    },
  });

  // Create quiz
  const createQuizMut = useMutation({
    mutationFn: ({ moduleId, title }: { moduleId: string; title: string }) =>
      coursesApi.createQuiz(courseId, {
        courseId,
        moduleId,
        title,
        questions: [
          {
            questionText: 'Untitled question',
            type: 'mcq',
            options: ['Option A', 'Option B', 'Option C', 'Option D'],
            correctAnswer: 'Option A',
            points: 1,
          },
        ],
        passingScore: 60,
        maxAttempts: 3,
      }),
    onSuccess: (res) => {
      toast.success('Quiz added');
      queryClient.invalidateQueries({ queryKey: ['quizzes', courseId] });
      setAddQuizTo(null);
      setNewQuizTitle('');
      if (res?.data?._id) {
        setSelected({ kind: 'quiz', id: res.data._id, sectionId: addQuizTo! });
      }
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error?.message || 'Failed to add quiz');
    },
  });

  // Save quiz
  const saveQuizMut = useMutation({
    mutationFn: ({ quizId, data }: { quizId: string; data: Record<string, unknown> }) =>
      coursesApi.updateQuiz(courseId, quizId, data),
    onSuccess: () => {
      toast.success('Quiz saved');
      queryClient.invalidateQueries({ queryKey: ['quizzes', courseId] });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error?.message || 'Failed to save quiz');
    },
  });

  // Delete quiz
  const deleteQuizMut = useMutation({
    mutationFn: (quizId: string) => coursesApi.deleteQuiz(courseId, quizId),
    onSuccess: () => {
      toast.success('Quiz deleted');
      queryClient.invalidateQueries({ queryKey: ['quizzes', courseId] });
      if (selected?.kind === 'quiz') setSelected(null);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error?.message || 'Failed to delete quiz');
    },
  });

  /* ---- handlers ---- */

  const handleAddLesson = useCallback((sectionId: string) => {
    setAddLessonTo(sectionId);
    setNewLessonTitle('');
    setNewLessonType('video');
  }, []);

  const handleAddQuiz = useCallback((sectionId: string) => {
    setAddQuizTo(sectionId);
    setNewQuizTitle('');
  }, []);

  /* ---- loading ---- */

  if (courseLoading || lessonsLoading || quizzesLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-[500px] w-full" />
      </div>
    );
  }

  return (
    <div className="-mx-4 sm:-mx-6">
      {/* Split panel */}
      <div
        className="bg-background overflow-hidden"
        style={{ height: 'calc(100vh - 180px)', minHeight: '500px' }}
      >
        <div className="flex h-full">
          {/* Left — Curriculum Tree */}
          <div className="w-[380px] shrink-0">
            <CurriculumTree
              sections={modules}
              lessons={lessons}
              quizzes={quizzes}
              selected={selected}
              onSelect={setSelected}
              onAddSection={() => addSectionMut.mutate()}
              onAddLesson={handleAddLesson}
              onAddQuiz={handleAddQuiz}
              onDeleteSection={(id) => deleteSectionMut.mutate(id)}
              onDeleteLesson={(id) => deleteLessonMut.mutate(id)}
              onDeleteQuiz={(id) => deleteQuizMut.mutate(id)}
              onRenameSection={(id, title) => renameSectionMut.mutate({ sectionId: id, title })}
            />
          </div>

          {/* Right — Content Editor */}
          <div className="flex-1 min-w-0 overflow-hidden">
            <ContentEditor
              selected={selected}
              sections={modules}
              lessons={lessons}
              quizzes={quizzes}
              onSaveSection={(id, data) => saveSectionMut.mutate({ sectionId: id, data })}
              onSaveLesson={(id, data) => saveLessonMut.mutate({ lessonId: id, data })}
              onSaveQuiz={(id, data) => saveQuizMut.mutate({ quizId: id, data })}
              savingSection={saveSectionMut.isPending}
              savingLesson={saveLessonMut.isPending}
              savingQuiz={saveQuizMut.isPending}
            />
          </div>
        </div>
      </div>

      {/* Add Lesson Dialog */}
      <Dialog open={!!addLessonTo} onOpenChange={() => setAddLessonTo(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Lesson</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Title *</Label>
              <Input
                value={newLessonTitle}
                onChange={(e) => setNewLessonTitle(e.target.value)}
                placeholder="e.g. Introduction to Algebra"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newLessonTitle.trim()) {
                    createLessonMut.mutate({
                      moduleId: addLessonTo!,
                      title: newLessonTitle.trim(),
                      type: newLessonType,
                    });
                  }
                }}
              />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={newLessonType} onValueChange={(v) => setNewLessonType(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="video">Video</SelectItem>
                  <SelectItem value="document">Document</SelectItem>
                  <SelectItem value="live">Live Session</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddLessonTo(null)}>
              Cancel
            </Button>
            <Button
              disabled={!newLessonTitle.trim() || createLessonMut.isPending}
              onClick={() =>
                createLessonMut.mutate({
                  moduleId: addLessonTo!,
                  title: newLessonTitle.trim(),
                  type: newLessonType,
                })
              }
            >
              {createLessonMut.isPending ? 'Adding...' : 'Add'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Quiz Dialog */}
      <Dialog open={!!addQuizTo} onOpenChange={() => setAddQuizTo(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Quiz</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Title *</Label>
              <Input
                value={newQuizTitle}
                onChange={(e) => setNewQuizTitle(e.target.value)}
                placeholder="e.g. Module 1 Assessment"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newQuizTitle.trim()) {
                    createQuizMut.mutate({
                      moduleId: addQuizTo!,
                      title: newQuizTitle.trim(),
                    });
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddQuizTo(null)}>
              Cancel
            </Button>
            <Button
              disabled={!newQuizTitle.trim() || createQuizMut.isPending}
              onClick={() =>
                createQuizMut.mutate({
                  moduleId: addQuizTo!,
                  title: newQuizTitle.trim(),
                })
              }
            >
              {createQuizMut.isPending ? 'Adding...' : 'Add'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
