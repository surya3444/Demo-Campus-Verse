'use client';

import { useQuery } from '@tanstack/react-query';
import { dashboardApi, examsApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { GraduationCap, AlertTriangle, Printer, Award } from 'lucide-react';

interface TranscriptSubject {
  subjectId: string;
  subjectName: string;
  credits?: number;
  marksObtained: number;
  totalMarks: number;
  percentage: number;
  grade?: string;
  gradePoints?: number;
  passed: boolean;
  absent: boolean;
  examName: string;
}

interface TranscriptSemester {
  termId?: string;
  termName: string;
  semesterNumber?: number;
  sgpa: number | null;
  totalCredits: number;
  earnedCredits: number;
  subjects: TranscriptSubject[];
}

interface Transcript {
  student: {
    displayName: string;
    admissionNumber?: string;
    rollNumber?: string;
    abcId?: string;
    className?: string;
  };
  cgpa: number | null;
  totalCredits: number;
  earnedCredits: number;
  semesters: TranscriptSemester[];
  backlogs: Array<{
    subjectId: string;
    subjectName: string;
    termName: string;
    attempts: number;
  }>;
}

export default function StudentTranscriptPage() {
  const { data: dashData } = useQuery({
    queryKey: ['student-dashboard'],
    queryFn: () => dashboardApi.getStudentDashboard(),
  });
  const studentId = (dashData?.data?.student as { _id?: string } | undefined)?._id;

  const { data, isLoading } = useQuery({
    queryKey: ['student-transcript', studentId],
    queryFn: () => examsApi.getTranscript(studentId!),
    enabled: !!studentId,
  });

  if (isLoading || !studentId) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-28" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  const transcript = data?.data as Transcript | undefined;
  const semesters = transcript?.semesters ?? [];

  if (!transcript || semesters.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold tracking-tight">Transcript</h1>
        <EmptyState
          icon={GraduationCap}
          title="No published results yet"
          description="Your transcript appears here once your results are published."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Transcript</h1>
          <p className="text-sm text-muted-foreground">
            {transcript.student.displayName}
            {transcript.student.className ? ` · ${transcript.student.className}` : ''}
            {transcript.student.admissionNumber ? ` · ${transcript.student.admissionNumber}` : ''}
          </p>
        </div>
        <Button variant="outline" onClick={() => window.print()}>
          <Printer className="mr-1.5 h-4 w-4" /> Print
        </Button>
      </div>

      {/* Cumulative summary */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 p-5">
            <Award className="h-8 w-8 text-primary" />
            <div>
              <p className="text-2xl font-bold tabular-nums">
                {transcript.cgpa !== null ? transcript.cgpa.toFixed(2) : '—'}
              </p>
              <p className="text-xs text-muted-foreground">CGPA</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-5">
            <GraduationCap className="h-8 w-8 text-emerald-600" />
            <div>
              <p className="text-2xl font-bold tabular-nums">
                {transcript.earnedCredits}
                <span className="text-sm font-normal text-muted-foreground">
                  {' '}
                  / {transcript.totalCredits}
                </span>
              </p>
              <p className="text-xs text-muted-foreground">Credits earned</p>
            </div>
          </CardContent>
        </Card>
        <Card className={transcript.backlogs.length > 0 ? 'border-destructive/40' : undefined}>
          <CardContent className="flex items-center gap-3 p-5">
            <AlertTriangle
              className={`h-8 w-8 ${transcript.backlogs.length > 0 ? 'text-destructive' : 'text-muted-foreground'}`}
            />
            <div>
              <p className="text-2xl font-bold tabular-nums">{transcript.backlogs.length}</p>
              <p className="text-xs text-muted-foreground">
                {transcript.backlogs.length === 1 ? 'Backlog' : 'Backlogs'}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Backlog detail */}
      {transcript.backlogs.length > 0 && (
        <Card className="border-destructive/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Pending backlogs</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {transcript.backlogs.map((b) => (
              <span
                key={`${b.termName}-${b.subjectId}`}
                className="inline-flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-2.5 py-1.5 text-xs"
              >
                <span className="font-medium">{b.subjectName}</span>
                <span className="text-muted-foreground">{b.termName}</span>
                {b.attempts > 1 && (
                  <Badge variant="outline" className="text-[10px]">
                    {b.attempts} attempts
                  </Badge>
                )}
              </span>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Per-semester detail */}
      {semesters.map((sem) => (
        <Card key={sem.termId ?? sem.termName}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-base">
              {sem.semesterNumber ? `Semester ${sem.semesterNumber}` : sem.termName}
              {sem.semesterNumber && (
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  {sem.termName}
                </span>
              )}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="outline">
                {sem.earnedCredits}/{sem.totalCredits} credits
              </Badge>
              {sem.sgpa !== null && <Badge>SGPA {sem.sgpa.toFixed(2)}</Badge>}
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="p-2">Subject</th>
                    <th className="p-2 text-right">Credits</th>
                    <th className="p-2 text-right">Marks</th>
                    <th className="p-2">Grade</th>
                    <th className="p-2 text-right">Points</th>
                    <th className="p-2">Result</th>
                  </tr>
                </thead>
                <tbody>
                  {sem.subjects.map((s) => (
                    <tr key={`${s.subjectId}-${s.examName}`} className="border-b last:border-0">
                      <td className="p-2 font-medium">{s.subjectName}</td>
                      <td className="p-2 text-right tabular-nums">{s.credits ?? '—'}</td>
                      <td className="p-2 text-right tabular-nums">
                        {s.absent ? 'AB' : `${s.marksObtained}/${s.totalMarks}`}
                      </td>
                      <td className="p-2">{s.grade ?? '—'}</td>
                      <td className="p-2 text-right tabular-nums">{s.gradePoints ?? '—'}</td>
                      <td className="p-2">
                        <Badge variant={s.passed ? 'secondary' : 'destructive'}>
                          {s.passed ? 'Pass' : s.absent ? 'Absent' : 'Fail'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
