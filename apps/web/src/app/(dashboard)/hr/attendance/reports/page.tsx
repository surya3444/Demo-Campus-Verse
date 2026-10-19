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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DatePicker } from '@/components/ui/date-picker';
import {
  FileText,
  Calendar,
  CalendarRange,
  Download,
  Loader2,
  Users,
  Check,
  X,
  Clock,
  ChevronLeft,
  CalendarDays,
} from 'lucide-react';
import { staffAttendanceApi } from '@/lib/api';
import Link from 'next/link';

type StaffAttendanceStatus = 'present' | 'absent' | 'late' | 'half_day' | 'on_leave' | 'holiday';

interface DailyRecord {
  staffId: string;
  staffName: string;
  employeeId: string;
  status: StaffAttendanceStatus;
  checkIn?: string;
  checkOut?: string;
  workingHours?: number;
  remarks?: string;
}

interface MonthlyStaffRecord {
  staffId: string;
  staffName: string;
  employeeId: string;
  present: number;
  absent: number;
  late: number;
  halfDay: number;
  onLeave: number;
  totalWorkingHours: number;
  dailyStatus: Record<number, string>;
}

export default function StaffAttendanceReportsPage() {
  const [reportType, setReportType] = useState<'daily' | 'monthly'>('daily');

  // Daily report state
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });

  // Monthly report state
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return (now.getMonth() + 1).toString();
  });
  const [selectedYear, setSelectedYear] = useState(() => {
    const now = new Date();
    return now.getFullYear().toString();
  });

  // Daily report query
  const { data: dailyReportData, isLoading: dailyLoading } = useQuery({
    queryKey: ['staff-daily-report', selectedDate],
    queryFn: () => staffAttendanceApi.getDailyReport(selectedDate),
    enabled: reportType === 'daily',
  });

  // Monthly report query
  const { data: monthlyReportData, isLoading: monthlyLoading } = useQuery({
    queryKey: ['staff-monthly-report', selectedMonth, selectedYear],
    queryFn: () =>
      staffAttendanceApi.getMonthlyReport({
        month: parseInt(selectedMonth),
        year: parseInt(selectedYear),
      }),
    enabled: reportType === 'monthly',
  });

  const dailyRecords: DailyRecord[] = dailyReportData?.data?.records || [];
  const dailySummary = dailyReportData?.data?.summary || {
    total: 0,
    present: 0,
    absent: 0,
    late: 0,
    halfDay: 0,
    onLeave: 0,
  };

  const monthlyRecords: MonthlyStaffRecord[] = monthlyReportData?.data?.staff || [];
  const daysInMonth = monthlyReportData?.data?.daysInMonth || 30;

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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'present':
        return (
          <div className="w-6 h-6 rounded bg-success text-white flex items-center justify-center text-xs font-medium">
            P
          </div>
        );
      case 'absent':
        return (
          <div className="w-6 h-6 rounded bg-destructive text-white flex items-center justify-center text-xs font-medium">
            A
          </div>
        );
      case 'late':
        return (
          <div className="w-6 h-6 rounded bg-warning text-white flex items-center justify-center text-xs font-medium">
            L
          </div>
        );
      case 'half_day':
        return (
          <div className="w-6 h-6 rounded bg-info text-white flex items-center justify-center text-xs font-medium">
            H
          </div>
        );
      case 'on_leave':
        return (
          <div className="w-6 h-6 rounded bg-purple-500 text-white flex items-center justify-center text-xs font-medium">
            LV
          </div>
        );
      case 'holiday':
        return (
          <div className="w-6 h-6 rounded bg-gray-300 text-gray-600 flex items-center justify-center text-xs font-medium">
            -
          </div>
        );
      default:
        return (
          <div className="w-6 h-6 rounded bg-gray-100 border text-gray-400 flex items-center justify-center text-xs">
            -
          </div>
        );
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

  const formattedDate = new Date(selectedDate).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="relative animate-fade-in">
        <div className="relative flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              <FileText className="h-3.5 w-3.5 text-[hsl(var(--brand-cyan))]" />
              <span>HR · Attendance · Staff Attendance</span>
            </div>
            <h1 className="font-display text-3xl font-bold leading-tight tracking-tight md:text-4xl">Attendance Reports</h1>
            <p className="max-w-2xl text-muted-foreground">View daily and monthly staff attendance reports</p>
          </div>
          <div className="flex gap-2">
            <Link href="/hr/attendance">
              <Button
                variant="outline"
                className="gap-2"
              >
                <ChevronLeft className="h-4 w-4" />
                Mark Attendance
              </Button>
            </Link>
            <Button
              variant="outline"
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              Export
            </Button>
          </div>
        </div>
      </div>

      {/* Report Type Tabs */}
      <Tabs value={reportType} onValueChange={(v) => setReportType(v as 'daily' | 'monthly')}>
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="daily" className="gap-2">
            <Calendar className="h-4 w-4" />
            Daily Report
          </TabsTrigger>
          <TabsTrigger value="monthly" className="gap-2">
            <CalendarRange className="h-4 w-4" />
            Monthly Report
          </TabsTrigger>
        </TabsList>

        {/* Daily Report */}
        <TabsContent value="daily" className="space-y-6 mt-6">
          {/* Filters */}
          <Card className="border-0 shadow-elegant-md">
            <CardContent className="py-5">
              <div className="flex items-end gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Date</Label>
                  <DatePicker
                    value={selectedDate}
                    onChange={(iso) => setSelectedDate(iso)}
                    className="w-44 h-11"
                    max={new Date().toISOString().split('T')[0]}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Summary Cards */}
          <div className="grid gap-4 md:grid-cols-6">
            <Card className="border-0 shadow-elegant-md">
              <CardContent className="py-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                    <Users className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{dailySummary.total}</p>
                    <p className="text-xs text-muted-foreground">Total</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-elegant-md bg-success/10">
              <CardContent className="py-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-success/20 flex items-center justify-center">
                    <Check className="h-5 w-5 text-success" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-success">{dailySummary.present}</p>
                    <p className="text-xs text-success/70">Present</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-elegant-md bg-destructive/10">
              <CardContent className="py-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-destructive/20 flex items-center justify-center">
                    <X className="h-5 w-5 text-destructive" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-destructive">{dailySummary.absent}</p>
                    <p className="text-xs text-destructive/70">Absent</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-elegant-md bg-warning/10">
              <CardContent className="py-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-warning/20 flex items-center justify-center">
                    <Clock className="h-5 w-5 text-warning" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-warning">{dailySummary.late}</p>
                    <p className="text-xs text-warning/70">Late</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-elegant-md bg-info/10">
              <CardContent className="py-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-info/20 flex items-center justify-center">
                    <Clock className="h-5 w-5 text-info" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-info">{dailySummary.halfDay}</p>
                    <p className="text-xs text-info/70">Half Day</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-elegant-md bg-purple-50">
              <CardContent className="py-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-purple-100 flex items-center justify-center">
                    <CalendarDays className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-purple-600">{dailySummary.onLeave}</p>
                    <p className="text-xs text-purple-600/70">On Leave</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Daily Table */}
          <Card className="border-0 shadow-elegant-md">
            <CardHeader>
              <CardTitle className="text-lg">{formattedDate}</CardTitle>
            </CardHeader>
            <CardContent>
              {dailyLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : dailyRecords.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Users className="h-12 w-12 mb-4 opacity-50" />
                  <p>No attendance data for this date</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee ID</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Check In</TableHead>
                      <TableHead>Check Out</TableHead>
                      <TableHead>Working Hours</TableHead>
                      <TableHead>Remarks</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dailyRecords.map((record) => (
                      <TableRow key={record.staffId}>
                        <TableCell className="font-medium">{record.employeeId}</TableCell>
                        <TableCell>{record.staffName}</TableCell>
                        <TableCell>{getStatusBadge(record.status)}</TableCell>
                        <TableCell>{record.checkIn || '-'}</TableCell>
                        <TableCell>{record.checkOut || '-'}</TableCell>
                        <TableCell>
                          {record.workingHours !== undefined
                            ? `${record.workingHours.toFixed(1)} hrs`
                            : '-'}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {record.remarks || '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Monthly Report */}
        <TabsContent value="monthly" className="space-y-6 mt-6">
          {/* Filters */}
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

          {/* Legend */}
          <div className="flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-success text-white flex items-center justify-center text-xs font-medium">
                P
              </div>
              <span>Present</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-destructive text-white flex items-center justify-center text-xs font-medium">
                A
              </div>
              <span>Absent</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-warning text-white flex items-center justify-center text-xs font-medium">
                L
              </div>
              <span>Late</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-info text-white flex items-center justify-center text-xs font-medium">
                H
              </div>
              <span>Half Day</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-purple-500 text-white flex items-center justify-center text-xs font-medium">
                LV
              </div>
              <span>On Leave</span>
            </div>
          </div>

          {/* Monthly Table */}
          <Card className="border-0 shadow-elegant-md">
            <CardHeader>
              <CardTitle className="text-lg">
                {months.find((m) => m.value === selectedMonth)?.label} {selectedYear}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {monthlyLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : monthlyRecords.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Users className="h-12 w-12 mb-4 opacity-50" />
                  <p>No attendance data for this month</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="sticky left-0 bg-background z-10 min-w-[120px]">
                          Employee
                        </TableHead>
                        {Array.from({ length: daysInMonth }, (_, i) => (
                          <TableHead key={i + 1} className="text-center min-w-[40px] p-1">
                            {i + 1}
                          </TableHead>
                        ))}
                        <TableHead className="text-center min-w-[60px]">Present</TableHead>
                        <TableHead className="text-center min-w-[60px]">Absent</TableHead>
                        <TableHead className="text-center min-w-[60px]">Late</TableHead>
                        <TableHead className="text-center min-w-[60px]">Leave</TableHead>
                        <TableHead className="text-center min-w-[80px]">Hours</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {monthlyRecords.map((record) => (
                        <TableRow key={record.staffId}>
                          <TableCell className="sticky left-0 bg-background z-10">
                            <div>
                              <p className="font-medium text-sm">{record.staffName}</p>
                              <p className="text-xs text-muted-foreground">{record.employeeId}</p>
                            </div>
                          </TableCell>
                          {Array.from({ length: daysInMonth }, (_, i) => (
                            <TableCell key={i + 1} className="text-center p-1">
                              {getStatusIcon(record.dailyStatus[i + 1])}
                            </TableCell>
                          ))}
                          <TableCell className="text-center font-medium text-success">
                            {record.present}
                          </TableCell>
                          <TableCell className="text-center font-medium text-destructive">
                            {record.absent}
                          </TableCell>
                          <TableCell className="text-center font-medium text-warning">
                            {record.late}
                          </TableCell>
                          <TableCell className="text-center font-medium text-purple-600">
                            {record.onLeave}
                          </TableCell>
                          <TableCell className="text-center font-medium">
                            {record.totalWorkingHours.toFixed(1)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
