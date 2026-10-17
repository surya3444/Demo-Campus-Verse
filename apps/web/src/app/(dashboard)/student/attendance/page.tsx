'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { dashboardApi, attendanceApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Label } from '@/components/ui/label';
import { DatePicker } from '@/components/ui/date-picker';
import { CheckCircle2, XCircle, Clock, CalendarDays } from 'lucide-react';

export default function StudentAttendancePage() {
  const now = new Date();
  const [fromDate, setFromDate] = useState(
    new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
  );
  const [toDate, setToDate] = useState(now.toISOString().split('T')[0]);

  const { data: dashData } = useQuery({
    queryKey: ['student-dashboard'],
    queryFn: () => dashboardApi.getStudentDashboard(),
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const student = dashData?.data?.student as Record<string, any> | undefined;
  const studentId = student?._id as string | undefined;

  const { data: historyData, isLoading } = useQuery({
    queryKey: ['student-attendance-history', studentId, fromDate, toDate],
    queryFn: () => attendanceApi.getStudentHistory(studentId!, { fromDate, toDate }),
    enabled: !!studentId,
  });

  if (!student) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const records = (historyData?.data || []) as Record<string, any>[];

  let present = 0;
  let absent = 0;
  let late = 0;

  for (const r of records) {
    const status = r.status as string;
    if (status === 'present') present++;
    else if (status === 'absent') absent++;
    else if (status === 'late') {
      late++;
      present++;
    }
  }

  const total = present + absent;
  const percentage = total > 0 ? Math.round((present / total) * 100) : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">My Attendance</h1>
        <p className="text-muted-foreground">
          {student.className} - {student.sectionName}
        </p>
      </div>

      {/* Date Range Filter */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4 items-end">
            <div className="space-y-2">
              <Label>From</Label>
              <DatePicker value={fromDate} onChange={(iso) => setFromDate(iso)} />
            </div>
            <div className="space-y-2">
              <Label>To</Label>
              <DatePicker value={toDate} onChange={(iso) => setToDate(iso)} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-5 text-center">
            <p className="text-3xl font-bold text-primary">{percentage}%</p>
            <p className="text-xs text-muted-foreground mt-1">Overall</p>
            <Progress value={percentage} className="mt-2 h-1.5" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 text-center">
            <p className="text-3xl font-bold text-green-600">{present}</p>
            <p className="text-xs text-muted-foreground mt-1">Present</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 text-center">
            <p className="text-3xl font-bold text-red-600">{absent}</p>
            <p className="text-xs text-muted-foreground mt-1">Absent</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 text-center">
            <p className="text-3xl font-bold text-amber-600">{late}</p>
            <p className="text-xs text-muted-foreground mt-1">Late</p>
          </CardContent>
        </Card>
      </div>

      {/* Daily Records */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarDays className="h-4 w-4" />
            Daily Records
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-10" />
              ))}
            </div>
          ) : records.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No attendance records found for this period.
            </p>
          ) : (
            <div className="space-y-1">
              {records
                .sort(
                  (a, b) =>
                    new Date(b.date as string).getTime() - new Date(a.date as string).getTime()
                )
                .map((record, idx) => {
                  const status = record.status as string;
                  const date = new Date(record.date as string);

                  return (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2.5 rounded-lg hover:bg-muted/50"
                    >
                      <div className="flex items-center gap-3">
                        {status === 'present' ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        ) : status === 'late' ? (
                          <Clock className="h-4 w-4 text-amber-500" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-500" />
                        )}
                        <span className="text-sm">
                          {date.toLocaleDateString('en-IN', {
                            weekday: 'short',
                            day: 'numeric',
                            month: 'short',
                          })}
                        </span>
                      </div>
                      <Badge
                        variant={
                          status === 'present'
                            ? 'default'
                            : status === 'late'
                              ? 'secondary'
                              : 'destructive'
                        }
                        className={`text-xs ${
                          status === 'present'
                            ? 'bg-green-100 text-green-700'
                            : status === 'late'
                              ? 'bg-amber-100 text-amber-700'
                              : ''
                        }`}
                      >
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                      </Badge>
                    </div>
                  );
                })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
