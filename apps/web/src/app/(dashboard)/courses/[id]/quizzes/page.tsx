'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { coursesApi } from '@/lib/api';
import { usePermissions } from '@/hooks/usePermissions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Plus, ClipboardList } from 'lucide-react';
import Link from 'next/link';

export default function QuizzesPage() {
  const params = useParams();
  const { hasPermission } = usePermissions();
  const courseId = params.id as string;

  const { data: courseData } = useQuery({
    queryKey: ['course', courseId],
    queryFn: () => coursesApi.getCourse(courseId),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['quizzes', courseId],
    queryFn: () => coursesApi.getQuizzes(courseId, { limit: 100 }),
  });

  const quizzes = data?.data || [];
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
            <h1 className="text-2xl font-bold tracking-tight">Quizzes</h1>
            <p className="text-muted-foreground">{course?.title || 'Course'} - Assessments</p>
          </div>
        </div>
        {hasPermission('courses.quizzes', 'create') && (
          <Link href={`/courses/${courseId}/quizzes/new`}>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create Quiz
            </Button>
          </Link>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Course Quizzes ({quizzes.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : quizzes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <ClipboardList className="h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-lg font-medium">No quizzes yet</p>
              <p className="text-sm text-muted-foreground">
                Create quizzes to assess student understanding
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {quizzes.map((quiz: any) => (
                <div
                  key={quiz._id}
                  className="flex items-center justify-between rounded-lg border p-4 hover:bg-muted/50"
                >
                  <div>
                    <p className="font-medium">{quiz.title}</p>
                    {quiz.description && (
                      <p className="text-sm text-muted-foreground line-clamp-1">
                        {quiz.description}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="outline">{quiz.questions?.length || 0} questions</Badge>
                    <Badge variant="secondary">Pass: {quiz.passingScore}%</Badge>
                    {quiz.timeLimitMinutes && (
                      <span className="text-xs text-muted-foreground">
                        {quiz.timeLimitMinutes} min
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
