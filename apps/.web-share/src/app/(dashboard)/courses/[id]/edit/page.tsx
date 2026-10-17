'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { coursesApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import {
  ArrowLeft,
  Eye,
  Settings,
  BookOpen,
  Layout,
  MoreHorizontal,
  Trash2,
  Globe,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import Link from 'next/link';
import { toast } from 'sonner';
import { CurriculumBuilder } from '@/components/courses/curriculum/CurriculumBuilder';
import { CourseDetailsTab } from '@/components/courses/tabs/CourseDetailsTab';
import { CourseSettingsTab } from '@/components/courses/tabs/CourseSettingsTab';

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-amber-50 text-amber-700 border-amber-200',
  published: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  archived: 'bg-slate-50 text-slate-600 border-slate-200',
};

export default function EditCoursePage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const courseId = params.id as string;
  const [activeTab, setActiveTab] = useState('curriculum');
  const [showDelete, setShowDelete] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['course', courseId],
    queryFn: () => coursesApi.getCourse(courseId),
  });

  const publishMut = useMutation({
    mutationFn: (status: string) =>
      coursesApi.updateCourse(courseId, { status } as Record<string, unknown>),
    onSuccess: () => {
      toast.success('Course status updated');
      queryClient.invalidateQueries({ queryKey: ['course', courseId] });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error?.message || 'Failed to update status');
    },
  });

  const deleteMut = useMutation({
    mutationFn: () => coursesApi.deleteCourse(courseId),
    onSuccess: () => {
      toast.success('Course deleted');
      router.push('/courses');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error?.message || 'Failed to delete course');
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <Skeleton className="h-8 w-8 rounded" />
          <Skeleton className="h-7 w-64" />
        </div>
        <Skeleton className="h-10 w-96" />
        <Skeleton className="h-[600px] w-full rounded-xl" />
      </div>
    );
  }

  const course = data?.data;
  if (!course) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <BookOpen className="h-12 w-12 text-muted-foreground/50 mb-4" />
        <p className="text-lg font-semibold">Course not found</p>
        <p className="text-sm text-muted-foreground mt-1 mb-6">
          This course may have been deleted or you don&apos;t have access.
        </p>
        <Link href="/courses">
          <Button variant="outline">Back to courses</Button>
        </Link>
      </div>
    );
  }

  const isDraft = course.status === 'draft';

  return (
    <div className="space-y-0">
      {/* ──── Top Bar ──── */}
      <div className="flex items-center justify-between pb-4">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/courses">
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <h1 className="text-lg font-bold tracking-tight truncate">{course.title}</h1>
              <Badge
                variant="outline"
                className={`text-[10px] uppercase tracking-wider font-semibold px-2 shrink-0 ${STATUS_STYLES[course.status] || ''}`}
              >
                {course.status}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {course.category && (
                <span className="capitalize">{course.category.replace(/_/g, ' ')}</span>
              )}
              {course.level && (
                <>
                  {' '}
                  &middot; <span className="capitalize">{course.level}</span>
                </>
              )}
              {course.instructor && <> &middot; {course.instructor}</>}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Link href={`/courses/${courseId}`}>
            <Button variant="outline" size="sm" className="gap-2 text-xs">
              <Eye className="h-3.5 w-3.5" />
              Preview
            </Button>
          </Link>

          {isDraft ? (
            <Button
              size="sm"
              className="gap-2 text-xs"
              onClick={() => publishMut.mutate('published')}
              disabled={publishMut.isPending}
            >
              <Globe className="h-3.5 w-3.5" />
              Publish
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="gap-2 text-xs"
              onClick={() => publishMut.mutate('draft')}
              disabled={publishMut.isPending}
            >
              Unpublish
            </Button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem asChild>
                <Link href={`/courses/${courseId}`}>
                  <Eye className="h-3.5 w-3.5 mr-2" />
                  View details
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => setShowDelete(true)}
              >
                <Trash2 className="h-3.5 w-3.5 mr-2" />
                Delete course
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* ──── Tab Navigation ──── */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-0">
        <div className="border-b -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8">
          <TabsList className="h-11 bg-transparent p-0 gap-6">
            <TabsTrigger
              value="curriculum"
              className="px-0 pb-3 pt-2 text-sm data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none font-medium"
            >
              <Layout className="h-4 w-4 mr-2" />
              Curriculum
            </TabsTrigger>
            <TabsTrigger
              value="details"
              className="px-0 pb-3 pt-2 text-sm data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none font-medium"
            >
              <BookOpen className="h-4 w-4 mr-2" />
              Course Details
            </TabsTrigger>
            <TabsTrigger
              value="settings"
              className="px-0 pb-3 pt-2 text-sm data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none font-medium"
            >
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ──── Curriculum Tab ──── */}
        <TabsContent value="curriculum" className="mt-0">
          <CurriculumBuilder courseId={courseId} />
        </TabsContent>

        {/* ──── Course Details Tab ──── */}
        <TabsContent value="details" className="mt-0 pt-6">
          <CourseDetailsTab courseId={courseId} course={course} />
        </TabsContent>

        {/* ──── Settings Tab ──── */}
        <TabsContent value="settings" className="mt-0 pt-6">
          <CourseSettingsTab courseId={courseId} course={course} />
        </TabsContent>
      </Tabs>

      {/* ──── Delete Confirmation ──── */}
      <AlertDialog open={showDelete} onOpenChange={setShowDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete course?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete &ldquo;{course.title}&rdquo; and all its modules,
              lessons, quizzes, and enrollment data. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteMut.mutate()}
            >
              {deleteMut.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
