'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { teachingApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { BarChart3, Users, ChevronRight, Award, ArrowLeft, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { usePermissions } from '@/hooks/usePermissions';
import { useTeacherViewStore } from '@/store/teacherViewStore';
import { TeacherSelector } from '@/components/teaching/TeacherSelector';

export default function GradebookPage() {
  const [selectedSection, setSelectedSection] = useState<string>('');
  const [selectedStudent, setSelectedStudent] = useState<string | null>(null);

  const { isGroupOwner, isOrgAdmin, isBranchAdmin } = usePermissions();
  const isAdminRole = isGroupOwner || isOrgAdmin || isBranchAdmin;
  const { selectedStaffId } = useTeacherViewStore();
  // Admins land here without a teacher record of their own. They have to
  // pick a teacher from the View-As-Teacher selector before any data loads.
  const isViewingAsAdmin = isAdminRole;

  const { data: classesData, isLoading: classesLoading } = useQuery({
    queryKey: ['my-classes', isViewingAsAdmin ? selectedStaffId : undefined],
    queryFn: () =>
      teachingApi.getMyClasses(isViewingAsAdmin && selectedStaffId ? selectedStaffId : undefined),
    enabled: !isViewingAsAdmin || !!selectedStaffId,
  });

  // Get all grades grouped by student for the section
  const { data: gradesData, isLoading: gradesLoading } = useQuery({
    queryKey: ['section-student-grades', selectedSection],
    queryFn: () => teachingApi.getSectionStudentGrades(selectedSection),
    enabled: !!selectedSection,
  });

  // Get individual student's detailed grades when selected
  const { data: studentGradesData, isLoading: studentGradesLoading } = useQuery({
    queryKey: ['student-grades-detail', selectedStudent],
    queryFn: () => teachingApi.getStudentGrades(selectedStudent!),
    enabled: !!selectedStudent,
  });

  const classes = classesData?.data || [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allGrades = (gradesData?.data || []) as Record<string, any>[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const studentGrades = (studentGradesData?.data || []) as Record<string, any>[];

  // Build per-student summary from grades
  const studentSummaryMap = new Map<
    string,
    { name: string; admissionNumber: string; totalGraded: number; avgPercentage: number }
  >();
  for (const g of allGrades) {
    const sid = g.studentId as string;
    if (!studentSummaryMap.has(sid)) {
      studentSummaryMap.set(sid, {
        name: g.studentName || 'Student',
        admissionNumber: g.admissionNumber || '',
        totalGraded: 0,
        avgPercentage: 0,
      });
    }
    const entry = studentSummaryMap.get(sid)!;
    entry.totalGraded += 1;
    entry.avgPercentage += g.percentage || 0;
  }
  // Calculate averages
  const students = Array.from(studentSummaryMap.entries())
    .map(([id, data]) => ({
      studentId: id,
      ...data,
      avgPercentage: data.totalGraded > 0 ? Math.round(data.avgPercentage / data.totalGraded) : 0,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  // If viewing a specific student's grades
  if (selectedStudent) {
    const studentInfo = students.find((s) => s.studentId === selectedStudent);

    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => setSelectedStudent(null)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{studentInfo?.name || 'Student'}</h1>
            <p className="text-muted-foreground">
              {studentInfo?.admissionNumber} · {studentInfo?.totalGraded} graded assignments
            </p>
          </div>
        </div>

        {studentGradesLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
        ) : studentGrades.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Award className="mx-auto h-12 w-12 text-muted-foreground/30" />
              <h3 className="mt-4 text-lg font-medium">No graded work</h3>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {studentGrades.map((grade) => {
              const pct = grade.percentage || 0;
              const kind = grade.assignment?.kind || 'assignment';
              const itemId = grade.assignmentId;
              const href =
                kind === 'questionnaire'
                  ? `/teaching/questionnaires/${itemId}/submissions`
                  : `/teaching/assignments/${itemId}/submissions`;

              return (
                <Link key={grade._id} href={href} className="block">
                  <Card className="hover:shadow-md transition-shadow cursor-pointer">
                    <CardContent className="py-4">
                      <div className="flex items-center gap-4">
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
                            {pct >= 75 ? 'Excellent' : pct >= 50 ? 'Pass' : 'Needs Work'}
                          </Badge>
                        </div>
                        <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Gradebook</h1>
        <p className="text-muted-foreground">View graded students by section</p>
      </div>

      {/* View-as-teacher selector for group owners / org admins / branch admins */}
      {isViewingAsAdmin && <TeacherSelector />}

      {/* Section Selector */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium">Select Section</label>
            {classesLoading ? (
              <Skeleton className="h-10 w-[280px]" />
            ) : classes.length === 0 ? (
              <p className="text-sm text-muted-foreground">No sections available</p>
            ) : (
              <Select value={selectedSection} onValueChange={setSelectedSection}>
                <SelectTrigger className="w-[280px]">
                  <SelectValue placeholder="Choose a section" />
                </SelectTrigger>
                <SelectContent>
                  {classes.map(
                    (cls: { sectionId: string; className: string; sectionName: string }) => (
                      <SelectItem key={cls.sectionId} value={cls.sectionId}>
                        {cls.className} - {cls.sectionName}
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
            )}
          </div>
        </CardContent>
      </Card>

      {isViewingAsAdmin && !selectedStaffId ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="mx-auto h-12 w-12 text-muted-foreground/30" />
            <h3 className="mt-4 text-lg font-medium">Pick a teacher to view their gradebook</h3>
            <p className="text-muted-foreground max-w-md mx-auto mt-1">
              Use the View as Teacher selector above to choose a teacher. Their assigned sections
              will appear in the dropdown.
            </p>
          </CardContent>
        </Card>
      ) : !classesLoading && classes.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <BarChart3 className="mx-auto h-12 w-12 text-muted-foreground/30" />
            <h3 className="mt-4 text-lg font-medium">
              {isViewingAsAdmin
                ? 'No classes assigned to this teacher'
                : 'No classes assigned to you'}
            </h3>
            <p className="text-muted-foreground max-w-md mx-auto mt-1">
              {isViewingAsAdmin
                ? 'This teacher is not currently assigned as the class teacher or subject teacher of any section.'
                : 'The gradebook shows graded students for sections you teach. You don’t appear to have any sections assigned yet — ask an admin to assign you as the class teacher or subject teacher of a section.'}
            </p>
          </CardContent>
        </Card>
      ) : !selectedSection ? (
        <div className="text-center py-12">
          <BarChart3 className="mx-auto h-12 w-12 text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-medium">Select a section to view grades</h3>
          <p className="text-muted-foreground">
            Choose a section from the dropdown above to see graded students
          </p>
        </div>
      ) : gradesLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      ) : students.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="mx-auto h-12 w-12 text-muted-foreground/30" />
            <h3 className="mt-4 text-lg font-medium">No graded students</h3>
            <p className="text-muted-foreground">
              No assignments have been graded for this section yet.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-5 w-5" />
              Students ({students.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {students.map((student) => (
                <button
                  key={student.studentId}
                  type="button"
                  className="w-full flex items-center gap-4 p-3 rounded-xl border hover:bg-muted/50 transition-colors text-left"
                  onClick={() => setSelectedStudent(student.studentId)}
                >
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center font-bold text-primary text-sm">
                    {student.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">{student.name}</p>
                    <p className="text-xs text-muted-foreground">{student.admissionNumber}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <p className="text-sm font-semibold">{student.avgPercentage}% avg</p>
                      <p className="text-xs text-muted-foreground">{student.totalGraded} graded</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
