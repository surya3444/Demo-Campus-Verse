'use client';

import { useQuery } from '@tanstack/react-query';
import { dashboardApi, teachingApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Award, TrendingUp, TrendingDown, BarChart3, ChevronRight } from 'lucide-react';
import Link from 'next/link';

export default function StudentGradebookPage() {
  const { data: dashData } = useQuery({
    queryKey: ['student-dashboard'],
    queryFn: () => dashboardApi.getStudentDashboard(),
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const student = dashData?.data?.student as Record<string, any> | undefined;
  const studentId = student?._id as string | undefined;

  const { data: gradesData, isLoading } = useQuery({
    queryKey: ['student-grades', studentId],
    queryFn: () => teachingApi.getStudentGrades(studentId!),
    enabled: !!studentId,
  });

  if (!student || isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const grades = (gradesData?.data || []) as Record<string, any>[];

  const totalGraded = grades.length;
  const avgPercentage =
    totalGraded > 0
      ? Math.round(grades.reduce((sum, g) => sum + (g.percentage || 0), 0) / totalGraded)
      : 0;
  const bestScore = totalGraded > 0 ? Math.max(...grades.map((g) => g.percentage || 0)) : 0;
  const lowestScore = totalGraded > 0 ? Math.min(...grades.map((g) => g.percentage || 0)) : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Gradebook</h1>
        <p className="text-muted-foreground">
          {student.className} - {student.sectionName} · Your grades and results
        </p>
      </div>

      {/* Summary */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-muted-foreground">Total Graded</p>
              <Award className="h-4 w-4 text-primary" />
            </div>
            <p className="text-2xl font-bold">{totalGraded}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-muted-foreground">Average</p>
              <BarChart3 className="h-4 w-4 text-blue-500" />
            </div>
            <p className="text-2xl font-bold">{avgPercentage}%</p>
            <Progress value={avgPercentage} className="mt-2 h-1.5" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-muted-foreground">Best</p>
              <TrendingUp className="h-4 w-4 text-green-500" />
            </div>
            <p className="text-2xl font-bold text-green-600">{bestScore}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-muted-foreground">Lowest</p>
              <TrendingDown className="h-4 w-4 text-amber-500" />
            </div>
            <p className="text-2xl font-bold text-amber-600">{lowestScore}%</p>
          </CardContent>
        </Card>
      </div>

      {/* Grades List */}
      {grades.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Award className="mx-auto h-12 w-12 text-muted-foreground/30" />
            <h3 className="mt-4 text-lg font-medium">No grades yet</h3>
            <p className="text-muted-foreground">
              Your teachers haven&apos;t graded any of your submissions yet.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">All Results</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {grades.map((grade) => {
                const pct = grade.percentage || 0;
                const assignmentId = grade.assignmentId as string;

                return (
                  <Link
                    key={grade._id}
                    href={`/student/grades/${assignmentId}`}
                    className="flex items-center gap-4 p-3 rounded-xl border hover:bg-muted/50 transition-colors"
                  >
                    <div
                      className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-sm ${
                        pct >= 75
                          ? 'bg-green-100 text-green-700'
                          : pct >= 50
                            ? 'bg-blue-100 text-blue-700'
                            : pct >= 30
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {pct}%
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">
                        {grade.assignment?.title || 'Assignment'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {grade.assignment?.subjectName || ''} ·{' '}
                        {grade.gradedAt ? new Date(grade.gradedAt).toLocaleDateString() : ''}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-semibold">
                        {grade.marksObtained}/{grade.totalMarks}
                      </p>
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${
                          pct >= 50
                            ? 'text-green-600 border-green-200'
                            : 'text-red-600 border-red-200'
                        }`}
                      >
                        {pct >= 75 ? 'Excellent' : pct >= 50 ? 'Pass' : 'Needs Improvement'}
                      </Badge>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </Link>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
