'use client';

import { useQuery } from '@tanstack/react-query';
import { teachingApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { BookOpen, Users, GraduationCap, Clock } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { TeacherSelector } from '@/components/teaching/TeacherSelector';
import { usePermissions } from '@/hooks/usePermissions';
import { useTeacherViewStore } from '@/store/teacherViewStore';

export default function MyClassesPage() {
  const router = useRouter();
  const { isGroupOwner, isOrgAdmin, isBranchAdmin } = usePermissions();
  const isAdminRole = isGroupOwner || isOrgAdmin || isBranchAdmin;
  const { selectedStaffId } = useTeacherViewStore();
  const isViewingAsAdmin = isAdminRole;

  const { data, isLoading } = useQuery({
    queryKey: ['my-classes', isViewingAsAdmin ? selectedStaffId : undefined],
    queryFn: () =>
      teachingApi.getMyClasses(isViewingAsAdmin && selectedStaffId ? selectedStaffId : undefined),
    enabled: !isViewingAsAdmin || !!selectedStaffId,
  });

  const rawClasses = data?.data || [];

  // Normalize: handle both parallel arrays and object array formats
  const classes = rawClasses.map(
    (cls: {
      sectionId: string;
      classId?: string;
      className: string;
      sectionName: string;
      subjects?: Array<{ subjectId: string; subjectName: string }>;
      subjectIds?: string[];
      subjectNames?: string[];
      studentCount: number;
      isClassTeacher: boolean;
      averageAttendance: number | null;
      source: string;
    }) => ({
      ...cls,
      subjects:
        cls.subjects && cls.subjects.length > 0
          ? cls.subjects
          : cls.subjectIds && cls.subjectNames
            ? cls.subjectIds.map((id: string, i: number) => ({
                subjectId: id,
                subjectName: cls.subjectNames![i] || id,
              }))
            : [],
    })
  );

  type ClassItem = (typeof classes)[number];

  // Group by className
  const grouped: Record<string, ClassItem[]> = {};
  for (const cls of classes) {
    const key = cls.className || 'Uncategorized';
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(cls);
  }
  const groupedEntries: [string, ClassItem[]][] = Object.entries(grouped);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">My Classes</h1>
        <p className="text-muted-foreground">Your assigned classes and sections</p>
      </div>

      {isViewingAsAdmin && <TeacherSelector />}

      {/* Class Cards */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      ) : classes.length === 0 ? (
        <div className="text-center py-12">
          <BookOpen className="mx-auto h-12 w-12 text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-medium">No classes assigned</h3>
          <p className="text-muted-foreground">
            You have not been assigned to any classes or sections yet.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {groupedEntries.map(([className, sections]) => (
            <div key={className}>
              <div className="flex items-center gap-3 mb-4">
                <h2 className="text-lg font-semibold">{className}</h2>
                <Badge variant="secondary" className="text-xs">
                  {sections.length} {sections.length === 1 ? 'Section' : 'Sections'}
                </Badge>
              </div>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {sections.map((cls) => (
                  <Link key={cls.sectionId} href={`/teaching/my-classes/${cls.sectionId}`}>
                    <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-lg">{cls.sectionName}</CardTitle>
                          <div className="flex gap-1">
                            {cls.isClassTeacher && <Badge variant="default">Class Teacher</Badge>}
                            {cls.source === 'timetable' && (
                              <Badge variant="outline" className="gap-1 text-xs">
                                <Clock className="h-3 w-3" />
                                Timetable
                              </Badge>
                            )}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Users className="h-4 w-4" />
                          <span>{cls.studentCount} Students</span>
                        </div>
                        {cls.averageAttendance !== null && (
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">Attendance (30d)</span>
                              <span className="font-medium">{cls.averageAttendance}%</span>
                            </div>
                            <Progress value={cls.averageAttendance} className="h-1.5" />
                          </div>
                        )}
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <GraduationCap className="h-4 w-4" />
                          <span>
                            {cls.subjects?.length
                              ? `${cls.subjects.length} Subject${cls.subjects.length > 1 ? 's' : ''}`
                              : 'No subjects'}
                          </span>
                        </div>
                        {cls.subjects?.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {cls.subjects.map((sub: { subjectId: string; subjectName: string }) => (
                              <Badge
                                key={sub.subjectId}
                                variant="outline"
                                className="cursor-pointer text-xs hover:bg-primary/10"
                                title={`View the ${sub.subjectName} roster`}
                                onClick={(e) => {
                                  // Card is one big <Link>; intercept so the badge
                                  // opens the subject-scoped roster instead.
                                  e.preventDefault();
                                  e.stopPropagation();
                                  router.push(
                                    `/teaching/my-classes/${cls.sectionId}?subject=${sub.subjectId}`
                                  );
                                }}
                              >
                                {sub.subjectName}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
