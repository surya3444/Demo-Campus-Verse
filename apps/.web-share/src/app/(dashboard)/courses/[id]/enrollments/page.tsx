'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { coursesApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ArrowLeft, Users } from 'lucide-react';
import Link from 'next/link';

const STATUS_VARIANTS: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  enrolled: 'outline',
  in_progress: 'secondary',
  completed: 'default',
  dropped: 'destructive',
};

export default function CourseEnrollmentsPage() {
  const params = useParams();
  const courseId = params.id as string;

  const { data: courseData } = useQuery({
    queryKey: ['course', courseId],
    queryFn: () => coursesApi.getCourse(courseId),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['enrollments', { courseId }],
    queryFn: () => coursesApi.getEnrollments({ courseId, limit: 50 }),
  });

  const enrollments = data?.data || [];
  const course = courseData?.data;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href={`/courses/${courseId}`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Enrollments</h1>
          <p className="text-muted-foreground">{course?.title || 'Course'} - Enrolled students</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Enrolled Students ({enrollments.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : enrollments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Users className="h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-lg font-medium">No enrollments yet</p>
              <p className="text-sm text-muted-foreground">
                Students will appear here once enrolled in this course
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Enrolled</TableHead>
                  <TableHead>Completed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {enrollments.map((enrollment: any) => (
                  <TableRow key={enrollment._id}>
                    <TableCell className="font-medium">{enrollment.studentId}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANTS[enrollment.status] || 'outline'}>
                        {enrollment.status.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-24 rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{ width: `${enrollment.completionPercentage || 0}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {enrollment.completionPercentage || 0}%
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {new Date(enrollment.enrolledAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-sm">
                      {enrollment.completedAt
                        ? new Date(enrollment.completedAt).toLocaleDateString()
                        : '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
