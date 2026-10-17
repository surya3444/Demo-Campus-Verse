'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { coursesApi } from '@/lib/api';
import { usePermissions } from '@/hooks/usePermissions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Plus, Search, BookOpen, Users, FileText, ClipboardList } from 'lucide-react';
import Link from 'next/link';

const STATUS_VARIANT: Record<string, 'default' | 'outline' | 'secondary' | 'destructive'> = {
  draft: 'outline',
  published: 'default',
  archived: 'secondary',
};

const CATEGORY_LABELS: Record<string, string> = {
  technical: 'Technical',
  soft_skills: 'Soft Skills',
  aptitude: 'Aptitude',
  language: 'Language',
  domain_specific: 'Domain Specific',
  certification_prep: 'Certification Prep',
  career_readiness: 'Career Readiness',
  general: 'General',
};

export default function MyCoursesPage() {
  const { hasPermission } = usePermissions();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string>('all');

  const { data, isLoading } = useQuery({
    queryKey: ['courses', { search, status: status === 'all' ? undefined : status }],
    queryFn: () =>
      coursesApi.getCourses({
        search: search || undefined,
        status: status === 'all' ? undefined : status,
        limit: 50,
      }),
  });

  const courses = data?.data || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My Courses</h1>
          <p className="text-muted-foreground">
            Manage your online courses, lessons, and assessments
          </p>
        </div>
        {hasPermission('courses.courses', 'create') && (
          <Link href="/courses/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create Course
            </Button>
          </Link>
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search courses..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="published">Published</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Courses Table */}
      <Card>
        <CardHeader>
          <CardTitle>Courses ({courses.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : courses.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <BookOpen className="h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-lg font-medium">No courses found</p>
              <p className="text-sm text-muted-foreground">
                Create your first course to get started with online teaching
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Course</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Modules</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {courses.map((course: any) => (
                  <TableRow key={course._id}>
                    <TableCell>
                      <div>
                        <Link
                          href={`/courses/${course._id}`}
                          className="font-medium hover:underline"
                        >
                          {course.title}
                        </Link>
                        <p className="text-xs text-muted-foreground">{course.courseNumber}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {CATEGORY_LABELS[course.category] || course.category}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[course.status] || 'outline'}>
                        {course.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{course.modules?.length || 0}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Link href={`/courses/${course._id}/edit`}>
                          <Button variant="ghost" size="sm">
                            Edit
                          </Button>
                        </Link>
                        <Link href={`/courses/${course._id}/lessons`}>
                          <Button variant="ghost" size="icon" className="h-8 w-8" title="Lessons">
                            <FileText className="h-3.5 w-3.5" />
                          </Button>
                        </Link>
                        <Link href={`/courses/${course._id}/quizzes`}>
                          <Button variant="ghost" size="icon" className="h-8 w-8" title="Quizzes">
                            <ClipboardList className="h-3.5 w-3.5" />
                          </Button>
                        </Link>
                        <Link href={`/courses/${course._id}/enrollments`}>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            title="Enrollments"
                          >
                            <Users className="h-3.5 w-3.5" />
                          </Button>
                        </Link>
                      </div>
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
