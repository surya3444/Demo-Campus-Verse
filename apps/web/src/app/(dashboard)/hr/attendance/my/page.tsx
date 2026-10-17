'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  CalendarDays,
  Clock,
  ChevronLeft,
  Loader2,
  TrendingUp,
  Calendar,
  Timer,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { staffAttendanceApi } from '@/lib/api';
import Link from 'next/link';

interface AttendanceRecord {
  date: Date;
  status: string;
  checkIn?: string;
  checkOut?: string;
  workingHours?: number;
  remarks?: string;
}

interface AttendanceSummary {
  total: number;
  present: number;
  absent: number;
  late: number;
  halfDay: number;
  onLeave: number;
  totalWorkingHours: number;
}

export default function MyAttendancePage() {
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return (now.getMonth() + 1).toString();
  });
  const [selectedYear, setSelectedYear] = useState(() => {
    const now = new Date();
    return now.getFullYear().toString();
  });

  // Fetch my attendance
  const { data: attendanceData, isLoading } = useQuery({
    queryKey: ['my-attendance', selectedMonth, selectedYear],
    queryFn: () =>
      staffAttendanceApi.getMyAttendance({
        month: parseInt(selectedMonth),
        year: parseInt(selectedYear),
      }),
  });

  const records: AttendanceRecord[] = attendanceData?.data?.records || [];
  const summary: AttendanceSummary = attendanceData?.data?.summary || {
    total: 0,
    present: 0,
    absent: 0,
    late: 0,
    halfDay: 0,
    onLeave: 0,
    totalWorkingHours: 0,
  };

  const attendancePercentage =
    summary.total > 0
      ? Math.round(((summary.present + summary.late + summary.halfDay * 0.5) / summary.total) * 100)
      : 0;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'present':
        return <Badge className="bg-success/10 text-success border-success/20">Present</Badge>;
      case 'absent':
        return (
          <Badge className="bg-destructive/10 text-destructive border-destructive/20">Absent</Badge>
        );
      case 'late':
        return <Badge className="bg-warning/10 text-warning border-warning/20">Late</Badge>;
      case 'half_day':
        return <Badge className="bg-info/10 text-info border-info/20">Half Day</Badge>;
      case 'on_leave':
        return <Badge className="bg-purple-100 text-purple-700 border-purple-200">On Leave</Badge>;
      case 'holiday':
        return <Badge variant="outline">Holiday</Badge>;
      default:
        return <Badge variant="outline">-</Badge>;
    }
  };

  const months = [
    { value: '1', label: 'January' },
    { value: '2', label: 'February' },
    { value: '3', label: 'March' },
    { value: '4', label: 'April' },
    { value: '5', label: 'May' },
    { value: '6', label: 'June' },
    { value: '7', label: 'July' },
    { value: '8', label: 'August' },
    { value: '9', label: 'September' },
    { value: '10', label: 'October' },
    { value: '11', label: 'November' },
    { value: '12', label: 'December' },
  ];

  const years = Array.from({ length: 5 }, (_, i) => {
    const year = new Date().getFullYear() - i;
    return { value: year.toString(), label: year.toString() };
  });

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatTime = (time?: string) => {
    if (!time) return '-';
    // Handle both Date object and time string formats
    if (typeof time === 'string' && time.includes('T')) {
      return new Date(time).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      });
    }
    return time;
  };

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-primary/95 to-navy-800 p-8 text-white">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-0 w-64 h-64 bg-accent rounded-full blur-3xl" />
        </div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-accent" />
              <span className="text-white/70 text-sm font-medium">
                {months.find((m) => m.value === selectedMonth)?.label} {selectedYear}
              </span>
            </div>
            <h1 className="text-3xl md:text-4xl font-semibold">My Attendance</h1>
            <p className="text-white/70">View your attendance history and statistics</p>
          </div>
          <Link href="/hr/attendance">
            <Button
              variant="outline"
              className="bg-white/10 border-white/20 text-white hover:bg-white/20 gap-2"
            >
              <ChevronLeft className="h-4 w-4" />
              Back
            </Button>
          </Link>
        </div>
      </div>

      {/* Month/Year Filter */}
      <Card className="border-0 shadow-elegant-md">
        <CardContent className="py-5">
          <div className="flex items-end gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Month</Label>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="w-40 h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {months.map((month) => (
                    <SelectItem key={month.value} value={month.value}>
                      {month.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Year</Label>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="w-32 h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map((year) => (
                    <SelectItem key={year.value} value={year.value}>
                      {year.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Stats */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {/* Attendance Percentage Card */}
        <Card className="border-0 shadow-elegant-md col-span-full lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Attendance Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-6">
              <div className="relative w-32 h-32">
                <svg className="w-32 h-32 transform -rotate-90">
                  <circle
                    cx="64"
                    cy="64"
                    r="56"
                    stroke="currentColor"
                    strokeWidth="12"
                    fill="none"
                    className="text-muted/20"
                  />
                  <circle
                    cx="64"
                    cy="64"
                    r="56"
                    stroke="currentColor"
                    strokeWidth="12"
                    fill="none"
                    strokeDasharray={`${attendancePercentage * 3.52} 352`}
                    className={cn(
                      attendancePercentage >= 75
                        ? 'text-success'
                        : attendancePercentage >= 50
                          ? 'text-warning'
                          : 'text-destructive'
                    )}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-3xl font-bold">{attendancePercentage}%</span>
                </div>
              </div>
              <div className="flex-1 space-y-3">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-muted-foreground">Present Days</span>
                    <span className="font-medium">
                      {summary.present} / {summary.total}
                    </span>
                  </div>
                  <Progress
                    value={(summary.present / Math.max(summary.total, 1)) * 100}
                    className="h-2"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-muted-foreground">Total Working Hours</span>
                    <span className="font-medium">{summary.totalWorkingHours.toFixed(1)} hrs</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Stats */}
        <Card className="border-0 shadow-elegant-md">
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-success" />
                  <span className="text-sm text-muted-foreground">Present</span>
                </div>
                <span className="font-bold text-success">{summary.present}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-destructive" />
                  <span className="text-sm text-muted-foreground">Absent</span>
                </div>
                <span className="font-bold text-destructive">{summary.absent}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-warning" />
                  <span className="text-sm text-muted-foreground">Late</span>
                </div>
                <span className="font-bold text-warning">{summary.late}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-elegant-md">
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-info" />
                  <span className="text-sm text-muted-foreground">Half Days</span>
                </div>
                <span className="font-bold text-info">{summary.halfDay}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-purple-500" />
                  <span className="text-sm text-muted-foreground">On Leave</span>
                </div>
                <span className="font-bold text-purple-600">{summary.onLeave}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Timer className="w-3 h-3 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Avg. Hours/Day</span>
                </div>
                <span className="font-bold">
                  {summary.present > 0
                    ? (summary.totalWorkingHours / summary.present).toFixed(1)
                    : '0'}{' '}
                  hrs
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Attendance Records Table */}
      <Card className="border-0 shadow-elegant-md">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Daily Records
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : records.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <CalendarDays className="h-12 w-12 mb-4 opacity-50" />
              <p>No attendance records for this month</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Check In</TableHead>
                  <TableHead>Check Out</TableHead>
                  <TableHead>Working Hours</TableHead>
                  <TableHead>Remarks</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((record, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{formatDate(record.date)}</TableCell>
                    <TableCell>{getStatusBadge(record.status)}</TableCell>
                    <TableCell>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3 text-muted-foreground" />
                        {formatTime(record.checkIn)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3 text-muted-foreground" />
                        {formatTime(record.checkOut)}
                      </span>
                    </TableCell>
                    <TableCell>
                      {record.workingHours !== undefined
                        ? `${record.workingHours.toFixed(1)} hrs`
                        : '-'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{record.remarks || '-'}</TableCell>
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
