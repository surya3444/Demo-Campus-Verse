'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { coursesApi } from '@/lib/api';
import { usePermissions } from '@/hooks/usePermissions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import { ArrowLeft, Plus, Video, FileText, Radio, Trash2, GripVertical } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

const TYPE_ICONS: Record<string, any> = {
  video: Video,
  document: FileText,
  live: Radio,
};

const TYPE_LABELS: Record<string, string> = {
  video: 'Video',
  document: 'Document',
  live: 'Live Session',
};

export default function LessonsPage() {
  const params = useParams();
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const courseId = params.id as string;
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: courseData } = useQuery({
    queryKey: ['course', courseId],
    queryFn: () => coursesApi.getCourse(courseId),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['lessons', courseId],
    queryFn: () => coursesApi.getLessons(courseId, { limit: 100 }),
  });

  const deleteMutation = useMutation({
    mutationFn: (lessonId: string) => coursesApi.deleteLesson(courseId, lessonId),
    onSuccess: () => {
      toast.success('Lesson deleted');
      queryClient.invalidateQueries({ queryKey: ['lessons', courseId] });
      setDeleteId(null);
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error?.message || 'Failed to delete lesson');
    },
  });

  const lessons = data?.data || [];
  const course = courseData?.data;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href={`/courses/${courseId}`}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Lessons</h1>
            <p className="text-muted-foreground">
              {course?.title || 'Course'} - Content management
            </p>
          </div>
        </div>
        {hasPermission('courses.lessons', 'create') && (
          <Link href={`/courses/${courseId}/lessons/new`}>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Lesson
            </Button>
          </Link>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Course Lessons ({lessons.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : lessons.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-lg font-medium">No lessons yet</p>
              <p className="text-sm text-muted-foreground">
                Add video, document, or live session content to this course
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {lessons.map((lesson: any, index: number) => {
                const TypeIcon = TYPE_ICONS[lesson.type] || FileText;
                return (
                  <div
                    key={lesson._id}
                    className="flex items-center gap-3 rounded-lg border p-3 hover:bg-muted/50"
                  >
                    <GripVertical className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground w-6">{index + 1}.</span>
                    <TypeIcon className="h-4 w-4 text-muted-foreground" />
                    <div className="flex-1">
                      <p className="font-medium text-sm">{lesson.title}</p>
                      {lesson.description && (
                        <p className="text-xs text-muted-foreground line-clamp-1">
                          {lesson.description}
                        </p>
                      )}
                    </div>
                    <Badge variant="outline">{TYPE_LABELS[lesson.type]}</Badge>
                    {lesson.duration && (
                      <span className="text-xs text-muted-foreground">{lesson.duration} min</span>
                    )}
                    {lesson.isPreview && <Badge variant="secondary">Preview</Badge>}
                    {hasPermission('courses.lessons', 'delete') && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setDeleteId(lesson._id)}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Lesson</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure? This will permanently remove this lesson and any associated progress
              data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
