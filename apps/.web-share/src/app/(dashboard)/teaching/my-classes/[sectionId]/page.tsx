'use client';

import { useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { teachingApi } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  ArrowLeft,
  Search,
  Users,
  BookOpen,
  Play,
  CheckCircle2,
  Link2,
  Loader2,
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { TeachingStatusBadge } from '@/components/teaching/TeachingStatusBadge';

export default function SectionDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const sectionId = params.sectionId as string;
  // Subject context (?subject=<id>): for electives the roster narrows to
  // course-registered students on the server.
  const subjectId = searchParams.get('subject') ?? undefined;
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('students');
  const [studentPage, setStudentPage] = useState(1);
  const [lessonPlanPage, setLessonPlanPage] = useState(1);
  const limit = 20;

  // Students query
  const { data: studentsData, isLoading: studentsLoading } = useQuery({
    queryKey: ['section-students', sectionId, search, studentPage, subjectId],
    queryFn: () =>
      teachingApi.getSectionStudents(sectionId, {
        search: search || undefined,
        page: studentPage,
        limit,
        subjectId,
      }),
  });

  // Lesson plans query — only fetch when tab is active
  const { data: lessonPlansData, isLoading: lessonPlansLoading } = useQuery({
    queryKey: ['section-lesson-plans', sectionId, lessonPlanPage],
    queryFn: () =>
      teachingApi.getSectionLessonPlans(sectionId, {
        page: lessonPlanPage,
        limit,
      }),
    enabled: activeTab === 'lesson-plans',
  });

  // Teaching status mutation
  const teachingStatusMutation = useMutation({
    mutationFn: ({
      planId,
      data,
    }: {
      planId: string;
      data: { teachingStatus: string; linkedAssignmentId?: string };
    }) => teachingApi.updateLessonPlanTeachingStatus(planId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['section-lesson-plans', sectionId] });
      queryClient.invalidateQueries({ queryKey: ['lesson-plans'] });
      toast.success('Teaching status updated');
    },
    onError: () => {
      toast.error('Failed to update teaching status');
    },
  });

  const students = studentsData?.data || [];
  const studentMeta = studentsData?.meta || { total: 0, page: 1, limit: 20, totalPages: 1 };
  const lessonPlans = lessonPlansData?.data || [];
  const lessonPlanMeta = lessonPlansData?.meta || {
    total: 0,
    page: 1,
    limit: 20,
    totalPages: 1,
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
      active: 'default',
      inactive: 'secondary',
      suspended: 'destructive',
      graduated: 'outline',
    };
    return (
      <Badge variant={variants[status] || 'outline'} className="capitalize">
        {status}
      </Badge>
    );
  };

  const getTeachingStatusAction = (planId: string, teachingStatus: string, planStatus: string) => {
    if (planStatus !== 'published') return null;
    const isUpdating =
      teachingStatusMutation.isPending && teachingStatusMutation.variables?.planId === planId;

    switch (teachingStatus) {
      case 'not_started':
        return (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 gap-1 text-xs"
            onClick={(e) => {
              e.preventDefault();
              teachingStatusMutation.mutate({
                planId,
                data: { teachingStatus: 'ongoing' },
              });
            }}
            disabled={isUpdating}
          >
            {isUpdating ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Play className="h-3 w-3" />
            )}
            Start
          </Button>
        );
      case 'ongoing':
        return (
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 gap-1 text-xs"
              onClick={(e) => {
                e.preventDefault();
                teachingStatusMutation.mutate({
                  planId,
                  data: { teachingStatus: 'completed' },
                });
              }}
              disabled={isUpdating}
            >
              {isUpdating ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <CheckCircle2 className="h-3 w-3" />
              )}
              Done
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 gap-1 text-xs"
              onClick={(e) => {
                e.preventDefault();
                teachingStatusMutation.mutate({
                  planId,
                  data: { teachingStatus: 'completed_with_assignment' },
                });
              }}
              disabled={isUpdating}
            >
              <Link2 className="h-3 w-3" />
              +HW
            </Button>
          </div>
        );
      case 'completed_with_assignment':
        return (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 gap-1 text-xs"
            onClick={(e) => {
              e.preventDefault();
              teachingStatusMutation.mutate({
                planId,
                data: { teachingStatus: 'completed' },
              });
            }}
            disabled={isUpdating}
          >
            {isUpdating ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <CheckCircle2 className="h-3 w-3" />
            )}
            Finalize
          </Button>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/teaching/my-classes">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Section Details</h1>
          <p className="text-muted-foreground">Manage students and lesson plans</p>
        </div>
      </div>

      <Tabs defaultValue="students" onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="students" className="gap-1">
            <Users className="h-4 w-4" />
            Students
          </TabsTrigger>
          <TabsTrigger value="lesson-plans" className="gap-1">
            <BookOpen className="h-4 w-4" />
            Lesson Plans
          </TabsTrigger>
        </TabsList>

        {/* Students Tab */}
        <TabsContent value="students" className="space-y-4">
          {subjectId && (
            <div className="flex items-center justify-between rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
              <span>
                Showing the roster for this subject — electives list only the students who
                registered for it.
              </span>
              <Link
                href={`/teaching/my-classes/${sectionId}`}
                className="font-medium text-primary hover:underline"
              >
                Show whole section
              </Link>
            </div>
          )}
          <Card>
            <CardContent className="pt-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or admission number..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setStudentPage(1);
                  }}
                  className="pl-10"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              {studentsLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-12" />
                  ))}
                </div>
              ) : students.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="mx-auto h-12 w-12 text-muted-foreground/50" />
                  <h3 className="mt-4 text-lg font-medium">No students found</h3>
                  <p className="text-muted-foreground">
                    {search
                      ? 'Try adjusting your search criteria'
                      : 'No students are enrolled in this section'}
                  </p>
                </div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Admission Number</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {students.map(
                        (student: {
                          _id: string;
                          displayName: string;
                          admissionNumber: string;
                          status: string;
                        }) => (
                          <TableRow key={student._id}>
                            <TableCell className="font-medium">{student.displayName}</TableCell>
                            <TableCell>{student.admissionNumber}</TableCell>
                            <TableCell>{getStatusBadge(student.status)}</TableCell>
                          </TableRow>
                        )
                      )}
                    </TableBody>
                  </Table>

                  {studentMeta.totalPages > 1 && (
                    <div className="flex items-center justify-between mt-4">
                      <p className="text-sm text-muted-foreground">
                        Showing {(studentMeta.page - 1) * studentMeta.limit + 1} to{' '}
                        {Math.min(studentMeta.page * studentMeta.limit, studentMeta.total)} of{' '}
                        {studentMeta.total} students
                      </p>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setStudentPage(studentPage - 1)}
                          disabled={studentPage === 1}
                        >
                          Previous
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setStudentPage(studentPage + 1)}
                          disabled={studentPage >= studentMeta.totalPages}
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Lesson Plans Tab */}
        <TabsContent value="lesson-plans" className="space-y-4">
          <Card>
            <CardContent className="pt-6">
              {lessonPlansLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-12" />
                  ))}
                </div>
              ) : lessonPlans.length === 0 ? (
                <div className="text-center py-8">
                  <BookOpen className="mx-auto h-12 w-12 text-muted-foreground/50" />
                  <h3 className="mt-4 text-lg font-medium">No lesson plans</h3>
                  <p className="text-muted-foreground">
                    Create lesson plans for this section from the Lesson Plans page.
                  </p>
                  <Button asChild className="mt-4">
                    <Link href="/teaching/lesson-plans">Go to Lesson Plans</Link>
                  </Button>
                </div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Title</TableHead>
                        <TableHead>Subject</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Teaching</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lessonPlans.map(
                        (plan: {
                          _id: string;
                          title: string;
                          subjectName: string;
                          date: string;
                          status: string;
                          teachingStatus: string;
                        }) => (
                          <TableRow key={plan._id}>
                            <TableCell className="font-medium">
                              <Link
                                href={`/teaching/lesson-plans/${plan._id}`}
                                className="hover:underline text-primary"
                              >
                                {plan.title}
                              </Link>
                            </TableCell>
                            <TableCell>{plan.subjectName || '-'}</TableCell>
                            <TableCell>
                              {plan.date ? new Date(plan.date).toLocaleDateString() : '-'}
                            </TableCell>
                            <TableCell>
                              {plan.status === 'published' ? (
                                <Badge variant="default" className="bg-green-600">
                                  Published
                                </Badge>
                              ) : (
                                <Badge variant="outline">Draft</Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              <TeachingStatusBadge status={plan.teachingStatus || 'not_started'} />
                            </TableCell>
                            <TableCell className="text-right">
                              {getTeachingStatusAction(
                                plan._id,
                                plan.teachingStatus || 'not_started',
                                plan.status
                              )}
                            </TableCell>
                          </TableRow>
                        )
                      )}
                    </TableBody>
                  </Table>

                  {lessonPlanMeta.totalPages > 1 && (
                    <div className="flex items-center justify-between mt-4">
                      <p className="text-sm text-muted-foreground">
                        Showing {(lessonPlanMeta.page - 1) * lessonPlanMeta.limit + 1} to{' '}
                        {Math.min(lessonPlanMeta.page * lessonPlanMeta.limit, lessonPlanMeta.total)}{' '}
                        of {lessonPlanMeta.total} plans
                      </p>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setLessonPlanPage(lessonPlanPage - 1)}
                          disabled={lessonPlanPage === 1}
                        >
                          Previous
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setLessonPlanPage(lessonPlanPage + 1)}
                          disabled={lessonPlanPage >= lessonPlanMeta.totalPages}
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
