'use client';

import { useQuery } from '@tanstack/react-query';
import { dashboardApi, teachingApi } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ClipboardList,
  FileQuestion,
  CheckCircle2,
  Clock,
  ExternalLink,
  Hourglass,
  Award,
} from 'lucide-react';
import Link from 'next/link';

export default function StudentAssignmentsPage() {
  const { data: dashData } = useQuery({
    queryKey: ['student-dashboard'],
    queryFn: () => dashboardApi.getStudentDashboard(),
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const student = dashData?.data?.student as Record<string, any> | undefined;
  const sectionId = student?.sectionId as string | undefined;
  const studentId = student?._id as string | undefined;

  // Fetch assignments for the section
  const { data: assignmentsData, isLoading: assignmentsLoading } = useQuery({
    queryKey: ['student-assignments', sectionId],
    queryFn: () => teachingApi.getAssignments({ sectionId, limit: 50 }),
    enabled: !!sectionId,
  });

  // Fetch questionnaires for the section
  const { data: questionnairesData, isLoading: questionnairesLoading } = useQuery({
    queryKey: ['student-questionnaires', sectionId],
    queryFn: () => teachingApi.getQuestionnaires({ sectionId, limit: 50 }),
    enabled: !!sectionId,
  });

  // Fetch student's grades to know what's been reviewed
  const { data: gradesData } = useQuery({
    queryKey: ['student-grades', studentId],
    queryFn: () => teachingApi.getStudentGrades(studentId!),
    enabled: !!studentId,
  });

  const isLoading = assignmentsLoading || questionnairesLoading || !student;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const assignments = (assignmentsData?.data || []) as Record<string, any>[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const questionnaires = (questionnairesData?.data || []) as Record<string, any>[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const grades = (gradesData?.data || []) as Record<string, any>[];

  // Build a map of graded items: assignmentId -> grade
  const gradeMap = new Map(grades.map((g) => [g.assignmentId as string, g]));

  // Get submitted item IDs from dashboard data
  const submittedAssignmentIds = new Set(
    (dashData?.data?.submittedIds?.assignments || []) as string[]
  );
  const submittedQuestionnaireIds = new Set(
    (dashData?.data?.submittedIds?.questionnaires || []) as string[]
  );

  // Combine and sort
  const allItems = [
    ...assignments
      .filter((a) => a.status === 'published')
      .map((a) => ({
        _id: a._id as string,
        title: a.title as string,
        kind: 'assignment' as const,
        subjectName: a.subjectName as string,
        dueDate: a.dueDate as string | undefined,
        totalMarks: a.totalMarks as number,
        hasQuestions: (a.hasQuestions as boolean) || false,
        status: a.status as string,
        createdAt: a.createdAt as string,
      })),
    ...questionnaires
      .filter((q) => q.status === 'published')
      .map((q) => ({
        _id: q._id as string,
        title: q.title as string,
        kind: 'questionnaire' as const,
        subjectName: q.subjectName as string,
        dueDate: q.dueDate as string | undefined,
        totalMarks: q.totalMarks as number,
        hasQuestions: true,
        status: q.status as string,
        createdAt: q.createdAt as string,
      })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Assignments & Quizzes</h1>
        <p className="text-muted-foreground">
          {student.className} - {student.sectionName} · {allItems.length} items
        </p>
      </div>

      {allItems.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-green-500/50" />
            <h3 className="mt-4 text-lg font-medium">No assignments yet</h3>
            <p className="text-muted-foreground">
              Your teachers haven&apos;t published any assignments.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {allItems.map((item) => {
            const isDue = item.dueDate && new Date(item.dueDate) < new Date();
            const grade = gradeMap.get(item._id);
            const isGraded = !!grade;
            const isSubmitted =
              item.kind === 'assignment'
                ? submittedAssignmentIds.has(item._id)
                : submittedQuestionnaireIds.has(item._id);
            const href =
              item.kind === 'questionnaire'
                ? `/teaching/questionnaires/${item._id}`
                : item.hasQuestions
                  ? `/teaching/assignments/${item._id}/submit`
                  : `/teaching/assignments/${item._id}`;

            return (
              <Card key={`${item.kind}-${item._id}`} className="hover:shadow-md transition-shadow">
                <CardContent className="py-4">
                  <div className="flex items-center gap-4">
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                        item.kind === 'questionnaire'
                          ? 'bg-purple-100 text-purple-600'
                          : 'bg-blue-100 text-blue-600'
                      }`}
                    >
                      {item.kind === 'questionnaire' ? (
                        <FileQuestion className="h-5 w-5" />
                      ) : (
                        <ClipboardList className="h-5 w-5" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium truncate">{item.title}</p>
                        <Badge
                          variant="secondary"
                          className={`text-[10px] shrink-0 ${
                            item.kind === 'questionnaire' ? 'bg-purple-100 text-purple-700' : ''
                          }`}
                        >
                          {item.kind === 'questionnaire' ? 'Quiz' : 'Assignment'}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span>{item.subjectName}</span>
                        <span>{item.totalMarks} marks</span>
                        {item.dueDate && (
                          <span
                            className={`flex items-center gap-1 ${isDue ? 'text-red-500' : ''}`}
                          >
                            <Clock className="h-3 w-3" />
                            {isDue
                              ? 'Overdue'
                              : `Due ${new Date(item.dueDate).toLocaleDateString()}`}
                          </span>
                        )}
                      </div>
                    </div>
                    {/* Graded — show score */}
                    {isGraded && (
                      <Badge variant="default" className="bg-green-600 gap-1 shrink-0">
                        <Award className="h-3 w-3" />
                        {grade.marksObtained}/{grade.totalMarks}
                      </Badge>
                    )}
                    {/* Submitted but not yet graded */}
                    {!isGraded && isSubmitted && (
                      <Badge variant="secondary" className="gap-1 shrink-0">
                        <Hourglass className="h-3 w-3" />
                        Pending Review
                      </Badge>
                    )}
                    {/* Not submitted, has questions — show Answer */}
                    {!isGraded && !isSubmitted && item.hasQuestions && (
                      <Button size="sm" variant="outline" asChild>
                        <Link href={href}>
                          Answer <ExternalLink className="ml-1 h-3 w-3" />
                        </Link>
                      </Button>
                    )}
                    {/* No questions */}
                    {!isGraded && !item.hasQuestions && (
                      <Button size="sm" variant="ghost" asChild>
                        <Link href={href}>
                          View <ExternalLink className="ml-1 h-3 w-3" />
                        </Link>
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
