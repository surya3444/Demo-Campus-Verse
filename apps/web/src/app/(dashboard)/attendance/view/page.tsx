'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PageHeader, ExportButton } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { StatCard } from '@/components/ui/stat-card';
import { Input } from '@/components/ui/input';
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
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { DatePicker } from '@/components/ui/date-picker';
import {
  Calendar,
  Users,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  Search,
  GraduationCap,
  UserCheck,
  UserX,
  School,
  AlertTriangle,
  TrendingUp,
  ClipboardList,
  PieChart,
} from 'lucide-react';
import { attendanceApi, academicApi } from '@/lib/api';
import { useHierarchyLabels } from '@/hooks/useHierarchyLabels';
import { format } from 'date-fns';

// --- Types ---

interface AttendanceRecord {
  studentId: string;
  admissionNumber?: string;
  displayName?: string;
  rollNumber?: number;
  status: 'present' | 'absent' | 'late' | 'half-day' | 'leave' | null;
  inTime?: string;
  outTime?: string;
  remarks?: string;
}

interface ClassAttendance {
  classId: string;
  sectionId: string;
  className: string;
  sectionName: string;
  summary: {
    total: number;
    present: number;
    absent: number;
    late: number;
    halfDay: number;
    leave: number;
  };
  isLocked: boolean;
}

interface StudentReport {
  studentId: string;
  admissionNumber: string;
  displayName: string;
  rollNumber: number;
  totalDays: number;
  present: number;
  absent: number;
  late: number;
  halfDay: number;
  leave: number;
  attendancePercent: number;
}

interface MonthlyData {
  day: number;
  totalClasses: number;
  totalStudents: number;
  present: number;
  absent: number;
  attendancePercent: number;
}

// --- Constants ---

const STATUS_CONFIG = {
  present: {
    label: 'Present',
    color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    icon: CheckCircle2,
  },
  absent: {
    label: 'Absent',
    color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    icon: XCircle,
  },
  late: {
    label: 'Late',
    color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    icon: Clock,
  },
  'half-day': {
    label: 'Half Day',
    color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    icon: AlertCircle,
  },
  leave: {
    label: 'On Leave',
    color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    icon: Calendar,
  },
};

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

// --- Component ---

export default function AttendanceViewPage() {
  const labels = useHierarchyLabels();
  const [activeTab, setActiveTab] = useState('daily-records');

  // Shared filter state
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedSectionId, setSelectedSectionId] = useState('');
  const [selectedDate, setSelectedDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());
  const [searchQuery, setSearchQuery] = useState('');

  // Date range for monthly reports
  const dateRange = useMemo(() => {
    const fromDate = new Date(selectedYear, selectedMonth - 1, 1).toISOString().split('T')[0];
    const toDate = new Date(selectedYear, selectedMonth, 0).toISOString().split('T')[0];
    return { fromDate, toDate };
  }, [selectedMonth, selectedYear]);

  // --- Queries ---

  const { data: classesData } = useQuery({
    queryKey: ['classes'],
    queryFn: () => academicApi.getClasses({ status: 'active' }),
  });

  const { data: sectionsData } = useQuery({
    queryKey: ['sections', selectedClassId],
    queryFn: () => academicApi.getSectionsByClass(selectedClassId),
    enabled: !!selectedClassId,
  });

  // Tab 1: Daily Records
  const { data: attendanceData, isLoading: attendanceLoading } = useQuery({
    queryKey: ['attendance', selectedClassId, selectedSectionId, selectedDate],
    queryFn: () =>
      attendanceApi.getAttendance({
        classId: selectedClassId,
        sectionId: selectedSectionId,
        date: selectedDate,
      }),
    enabled:
      activeTab === 'daily-records' && !!selectedClassId && !!selectedSectionId && !!selectedDate,
  });

  // Tab 2: Daily Overview
  const { data: dailyReportData, isLoading: dailyLoading } = useQuery({
    queryKey: ['dailyReport', selectedDate],
    queryFn: () => attendanceApi.getDailyReport(selectedDate),
    enabled: activeTab === 'daily-overview',
  });

  // Tab 3: Class Report
  const { data: classWiseData, isLoading: classWiseLoading } = useQuery({
    queryKey: ['classWiseReport', selectedClassId, dateRange.fromDate, dateRange.toDate],
    queryFn: () =>
      attendanceApi.getClassWiseReport({
        classId: selectedClassId,
        fromDate: dateRange.fromDate,
        toDate: dateRange.toDate,
      }),
    enabled: activeTab === 'class-report' && !!selectedClassId,
  });

  // Tab 4: Student Report
  const { data: studentWiseData, isLoading: studentWiseLoading } = useQuery({
    queryKey: [
      'studentWiseReport',
      selectedClassId,
      selectedSectionId,
      dateRange.fromDate,
      dateRange.toDate,
    ],
    queryFn: () =>
      attendanceApi.getStudentWiseReport({
        classId: selectedClassId,
        sectionId: selectedSectionId,
        fromDate: dateRange.fromDate,
        toDate: dateRange.toDate,
      }),
    enabled: activeTab === 'student-report' && !!selectedClassId && !!selectedSectionId,
  });

  // Tab 5: Monthly Trend
  const { data: monthlyData, isLoading: monthlyLoading } = useQuery({
    queryKey: ['monthlyReport', selectedYear, selectedMonth],
    queryFn: () => attendanceApi.getMonthlyReport({ year: selectedYear, month: selectedMonth }),
    enabled: activeTab === 'monthly-trend',
  });

  // --- Derived data ---

  const classes = classesData?.data || [];
  const sections = sectionsData?.data || [];

  const records: AttendanceRecord[] = attendanceData?.data?.records || [];
  const summary = attendanceData?.data?.summary;

  const dailyReport = dailyReportData?.data;
  const dailyTotals = dailyReport?.totals || { total: 0, present: 0, absent: 0, late: 0 };
  const overallPercentage = dailyTotals.total
    ? Math.round((dailyTotals.present / dailyTotals.total) * 100 * 10) / 10
    : 0;

  const classWiseReport = classWiseData?.data || [];
  const studentWiseReport: StudentReport[] = studentWiseData?.data || [];
  const lowAttendanceStudents = studentWiseReport.filter((s) => s.attendancePercent < 75);
  const monthlyReport = monthlyData?.data;

  const filteredRecords = records.filter((r) =>
    searchQuery
      ? r.displayName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.admissionNumber?.toLowerCase().includes(searchQuery.toLowerCase())
      : true
  );

  const getInitials = (name?: string) =>
    name
      ? name
          .split(' ')
          .map((n) => n[0])
          .join('')
          .toUpperCase()
          .slice(0, 2)
      : '?';

  const handleClassChange = (classId: string) => {
    setSelectedClassId(classId);
    setSelectedSectionId('');
  };

  // --- Shared filter components ---

  const ClassFilter = () => (
    <div className="flex items-center gap-2">
      <Label className="text-sm">Class:</Label>
      <Select value={selectedClassId} onValueChange={handleClassChange}>
        <SelectTrigger className="w-40">
          <SelectValue placeholder="Select class" />
        </SelectTrigger>
        <SelectContent>
          {classes.map((cls: { _id: string; displayName?: string; name?: string }) => (
            <SelectItem key={cls._id} value={cls._id}>
              {cls.displayName || cls.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  const SectionFilter = () => (
    <div className="flex items-center gap-2">
      <Label className="text-sm">Section:</Label>
      <Select
        value={selectedSectionId}
        onValueChange={setSelectedSectionId}
        disabled={!selectedClassId}
      >
        <SelectTrigger className="w-36">
          <SelectValue placeholder="Select" />
        </SelectTrigger>
        <SelectContent>
          {sections.map((s: { _id: string; name: string }) => (
            <SelectItem key={s._id} value={s._id}>
              {s.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  const MonthYearFilter = () => (
    <>
      <div className="flex items-center gap-2">
        <Label className="text-sm">Month:</Label>
        <Select
          value={selectedMonth.toString()}
          onValueChange={(v) => setSelectedMonth(parseInt(v))}
        >
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MONTHS.map((month, index) => (
              <SelectItem key={month} value={(index + 1).toString()}>
                {month}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center gap-2">
        <Label className="text-sm">Year:</Label>
        <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
          <SelectTrigger className="w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[2024, 2025, 2026].map((year) => (
              <SelectItem key={year} value={year.toString()}>
                {year}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </>
  );

  // --- Render ---

  return (
    <div className="space-y-6">
      <PageHeader title="View Attendance" description="View records and attendance analytics">
        <ExportButton />
      </PageHeader>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex w-fit flex-wrap h-auto items-center justify-start gap-1 p-1">
          <TabsTrigger value="daily-records" className="gap-1.5">
            <ClipboardList className="h-4 w-4" />
            Daily Records
          </TabsTrigger>
          <TabsTrigger value="daily-overview" className="gap-1.5">
            <PieChart className="h-4 w-4" />
            Daily Overview
          </TabsTrigger>
          <TabsTrigger value="class-report" className="gap-1.5">
            <School className="h-4 w-4" />
            Class Report
          </TabsTrigger>
          <TabsTrigger value="student-report" className="gap-1.5">
            <Users className="h-4 w-4" />
            Student Report
          </TabsTrigger>
          <TabsTrigger value="monthly-trend" className="gap-1.5">
            <TrendingUp className="h-4 w-4" />
            Monthly Trend
          </TabsTrigger>
        </TabsList>

        {/* ============ Tab 1: Daily Records ============ */}
        <TabsContent value="daily-records" className="space-y-6">
          <Card className="border-0 shadow-elegant-md">
            <CardContent className="pt-6">
              <div className="grid md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>{labels.container}</Label>
                  <Select value={selectedClassId} onValueChange={handleClassChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select class" />
                    </SelectTrigger>
                    <SelectContent>
                      {classes.map((cls: { _id: string; displayName?: string; name?: string }) => (
                        <SelectItem key={cls._id} value={cls._id}>
                          {cls.displayName || cls.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{labels.leaf}</Label>
                  <Select
                    value={selectedSectionId}
                    onValueChange={setSelectedSectionId}
                    disabled={!selectedClassId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select section" />
                    </SelectTrigger>
                    <SelectContent>
                      {sections.map((s: { _id: string; name: string }) => (
                        <SelectItem key={s._id} value={s._id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Date</Label>
                  <DatePicker
                    value={selectedDate}
                    onChange={(iso) => setSelectedDate(iso)}
                    max={new Date().toISOString().split('T')[0]}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Search</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by name or admission no"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {summary && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <Card className="border-0 shadow-elegant-sm">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                      <Users className="h-5 w-5 text-slate-600 dark:text-slate-400" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{summary.total}</p>
                      <p className="text-xs text-muted-foreground">Total</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-elegant-sm">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                      <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-green-600">{summary.present}</p>
                      <p className="text-xs text-muted-foreground">Present</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-elegant-sm">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                      <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-red-600">{summary.absent}</p>
                      <p className="text-xs text-muted-foreground">Absent</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-elegant-sm">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                      <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-amber-600">{summary.late}</p>
                      <p className="text-xs text-muted-foreground">Late</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-elegant-sm">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                      <Calendar className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-purple-600">{summary.leave}</p>
                      <p className="text-xs text-muted-foreground">On Leave</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          <Card className="border-0 shadow-elegant-md">
            <CardHeader>
              <CardTitle className="text-lg">Attendance Records</CardTitle>
              <CardDescription>
                {selectedDate && format(new Date(selectedDate + 'T00:00:00'), 'EEEE, MMMM d, yyyy')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {attendanceLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : !selectedClassId || !selectedSectionId ? (
                <div className="text-center py-12 text-muted-foreground">
                  <GraduationCap className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Select a class and section to view attendance</p>
                </div>
              ) : filteredRecords.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No attendance records found</p>
                  <p className="text-sm mt-1">Attendance may not have been marked for this date</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student</TableHead>
                      <TableHead>Admission No</TableHead>
                      <TableHead>Roll No</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Check In</TableHead>
                      <TableHead>Check Out</TableHead>
                      <TableHead>Remarks</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRecords.map((record) => {
                      if (!record.status) return null;
                      const statusConfig = STATUS_CONFIG[record.status];
                      const StatusIcon = statusConfig.icon;
                      return (
                        <TableRow key={record.studentId}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar className="h-8 w-8">
                                <AvatarFallback className="text-xs">
                                  {getInitials(record.displayName)}
                                </AvatarFallback>
                              </Avatar>
                              <span className="font-medium">{record.displayName || 'Unknown'}</span>
                            </div>
                          </TableCell>
                          <TableCell>{record.admissionNumber || '-'}</TableCell>
                          <TableCell>{record.rollNumber || '-'}</TableCell>
                          <TableCell>
                            <Badge className={`${statusConfig.color} gap-1`}>
                              <StatusIcon className="h-3 w-3" />
                              {statusConfig.label}
                            </Badge>
                          </TableCell>
                          <TableCell>{record.inTime || '-'}</TableCell>
                          <TableCell>{record.outTime || '-'}</TableCell>
                          <TableCell className="max-w-[200px] truncate">
                            {record.remarks || '-'}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============ Tab 2: Daily Overview ============ */}
        <TabsContent value="daily-overview" className="space-y-6">
          <Card>
            <CardContent className="py-4">
              <div className="flex flex-wrap gap-4">
                <div className="flex items-center gap-2">
                  <Label className="text-sm">Date:</Label>
                  <DatePicker
                    value={selectedDate}
                    onChange={(iso) => setSelectedDate(iso)}
                    className="w-40"
                    max={new Date().toISOString().split('T')[0]}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {dailyReport && (
            <div className="grid gap-4 md:grid-cols-4 stagger-animation">
              <StatCard
                title="Today's Attendance"
                value={`${overallPercentage}%`}
                icon={UserCheck}
                variant="success"
              />
              <StatCard
                title="Present Today"
                value={dailyTotals.present}
                icon={Users}
                variant="primary"
              />
              <StatCard title="Absent Today" value={dailyTotals.absent} icon={UserX} />
              <StatCard title="Late Today" value={dailyTotals.late} icon={AlertTriangle} />
            </div>
          )}

          {dailyLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <School className="h-5 w-5" />
                  Class-wise Attendance for{' '}
                  {new Date(selectedDate + 'T00:00:00').toLocaleDateString()}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!dailyReport || dailyReport.byClass.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <Calendar className="h-12 w-12 mb-4 opacity-50" />
                    <p>No attendance data for this date</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[500px] overflow-y-auto">
                    {dailyReport.byClass.map((item: ClassAttendance, index: number) => {
                      const percentage = item.summary.total
                        ? Math.round((item.summary.present / item.summary.total) * 100 * 10) / 10
                        : 0;
                      return (
                        <div
                          key={index}
                          className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                                percentage >= 90
                                  ? 'bg-success/10'
                                  : percentage >= 80
                                    ? 'bg-warning/10'
                                    : 'bg-destructive/10'
                              }`}
                            >
                              <School
                                className={`h-5 w-5 ${
                                  percentage >= 90
                                    ? 'text-success'
                                    : percentage >= 80
                                      ? 'text-warning'
                                      : 'text-destructive'
                                }`}
                              />
                            </div>
                            <div>
                              <p className="font-medium">
                                {item.className} - {item.sectionName}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {item.summary.total} students
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <p className="text-sm text-success">{item.summary.present} present</p>
                              <p className="text-sm text-destructive">
                                {item.summary.absent} absent
                              </p>
                            </div>
                            <div
                              className={`text-lg font-bold ${
                                percentage >= 90
                                  ? 'text-success'
                                  : percentage >= 80
                                    ? 'text-warning'
                                    : 'text-destructive'
                              }`}
                            >
                              {percentage}%
                            </div>
                            {item.isLocked && (
                              <Badge variant="secondary" className="text-xs">
                                Locked
                              </Badge>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ============ Tab 3: Class Report ============ */}
        <TabsContent value="class-report" className="space-y-6">
          <Card>
            <CardContent className="py-4">
              <div className="flex flex-wrap gap-4">
                <ClassFilter />
                <MonthYearFilter />
              </div>
            </CardContent>
          </Card>

          {classWiseLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : selectedClassId ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <School className="h-5 w-5" />
                  Section-wise Report for {MONTHS[selectedMonth - 1]} {selectedYear}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {classWiseReport.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <Calendar className="h-12 w-12 mb-4 opacity-50" />
                    <p>No attendance data for this period</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {classWiseReport.map(
                      (
                        item: {
                          sectionId: string;
                          sectionName: string;
                          totalDays: number;
                          totalStudents: number;
                          avgPresent: number;
                          avgAbsent: number;
                          avgAttendancePercent: number;
                        },
                        index: number
                      ) => (
                        <div
                          key={index}
                          className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                                item.avgAttendancePercent >= 90
                                  ? 'bg-success/10'
                                  : item.avgAttendancePercent >= 80
                                    ? 'bg-warning/10'
                                    : 'bg-destructive/10'
                              }`}
                            >
                              <School
                                className={`h-5 w-5 ${
                                  item.avgAttendancePercent >= 90
                                    ? 'text-success'
                                    : item.avgAttendancePercent >= 80
                                      ? 'text-warning'
                                      : 'text-destructive'
                                }`}
                              />
                            </div>
                            <div>
                              <p className="font-medium">{item.sectionName}</p>
                              <p className="text-sm text-muted-foreground">
                                {item.totalStudents} students | {item.totalDays} days
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <p className="text-sm text-success">Avg {item.avgPresent} present</p>
                              <p className="text-sm text-destructive">
                                Avg {item.avgAbsent} absent
                              </p>
                            </div>
                            <div
                              className={`text-lg font-bold ${
                                item.avgAttendancePercent >= 90
                                  ? 'text-success'
                                  : item.avgAttendancePercent >= 80
                                    ? 'text-warning'
                                    : 'text-destructive'
                              }`}
                            >
                              {item.avgAttendancePercent}%
                            </div>
                          </div>
                        </div>
                      )
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <School className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Select a class to view the report</p>
            </div>
          )}
        </TabsContent>

        {/* ============ Tab 4: Student Report ============ */}
        <TabsContent value="student-report" className="space-y-6">
          <Card>
            <CardContent className="py-4">
              <div className="flex flex-wrap gap-4">
                <ClassFilter />
                <SectionFilter />
                <MonthYearFilter />
              </div>
            </CardContent>
          </Card>

          {studentWiseLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : selectedClassId && selectedSectionId ? (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Student Attendance for {MONTHS[selectedMonth - 1]} {selectedYear}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {studentWiseReport.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                      <Calendar className="h-12 w-12 mb-4 opacity-50" />
                      <p>No attendance data for this period</p>
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-[500px] overflow-y-auto">
                      {studentWiseReport.map((student, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                                student.attendancePercent >= 90
                                  ? 'bg-success/10'
                                  : student.attendancePercent >= 75
                                    ? 'bg-warning/10'
                                    : 'bg-destructive/10'
                              }`}
                            >
                              <UserCheck
                                className={`h-5 w-5 ${
                                  student.attendancePercent >= 90
                                    ? 'text-success'
                                    : student.attendancePercent >= 75
                                      ? 'text-warning'
                                      : 'text-destructive'
                                }`}
                              />
                            </div>
                            <div>
                              <p className="font-medium">{student.displayName}</p>
                              <p className="text-sm text-muted-foreground">
                                {student.admissionNumber} | Roll: {student.rollNumber}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-6">
                            <div className="text-sm grid grid-cols-3 gap-4 text-center">
                              <div>
                                <span className="text-success font-medium">{student.present}</span>
                                <p className="text-xs text-muted-foreground">Present</p>
                              </div>
                              <div>
                                <span className="text-destructive font-medium">
                                  {student.absent}
                                </span>
                                <p className="text-xs text-muted-foreground">Absent</p>
                              </div>
                              <div>
                                <span className="text-warning font-medium">{student.late}</span>
                                <p className="text-xs text-muted-foreground">Late</p>
                              </div>
                            </div>
                            <Badge
                              variant="secondary"
                              className={
                                student.attendancePercent >= 90
                                  ? 'bg-success/10 text-success border-success/20'
                                  : student.attendancePercent >= 75
                                    ? 'bg-warning/10 text-warning border-warning/20'
                                    : 'bg-destructive/10 text-destructive border-destructive/20'
                              }
                            >
                              {student.attendancePercent}%
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {lowAttendanceStudents.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2 text-warning">
                      <AlertTriangle className="h-5 w-5" />
                      Low Attendance Students (&lt;75%)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {lowAttendanceStudents.map((student, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between p-3 rounded-lg border border-destructive/20 bg-destructive/5"
                        >
                          <div>
                            <p className="font-medium">{student.displayName}</p>
                            <p className="text-sm text-muted-foreground">
                              {student.admissionNumber}
                            </p>
                          </div>
                          <Badge
                            variant="secondary"
                            className="bg-destructive/10 text-destructive border-destructive/20"
                          >
                            {student.attendancePercent}%
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Select a class and section to view the report</p>
            </div>
          )}
        </TabsContent>

        {/* ============ Tab 5: Monthly Trend ============ */}
        <TabsContent value="monthly-trend" className="space-y-6">
          <Card>
            <CardContent className="py-4">
              <div className="flex flex-wrap gap-4">
                <MonthYearFilter />
              </div>
            </CardContent>
          </Card>

          {monthlyLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Daily Attendance for {MONTHS[selectedMonth - 1]} {selectedYear}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!monthlyReport || monthlyReport.daily.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <Calendar className="h-12 w-12 mb-4 opacity-50" />
                    <p>No attendance data for this month</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {monthlyReport.daily.map((day: MonthlyData) => (
                      <div key={day.day} className="flex items-center gap-4">
                        <span className="w-8 text-sm font-medium text-muted-foreground">
                          {day.day}
                        </span>
                        <div className="flex-1 h-4 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              day.attendancePercent >= 93
                                ? 'bg-success'
                                : day.attendancePercent >= 90
                                  ? 'bg-warning'
                                  : 'bg-destructive'
                            }`}
                            style={{ width: `${day.attendancePercent}%` }}
                          />
                        </div>
                        <span
                          className={`w-14 text-sm font-medium text-right ${
                            day.attendancePercent >= 93
                              ? 'text-success'
                              : day.attendancePercent >= 90
                                ? 'text-warning'
                                : 'text-destructive'
                          }`}
                        >
                          {day.attendancePercent}%
                        </span>
                        <span className="w-24 text-xs text-muted-foreground">
                          {day.present}/{day.totalStudents}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
