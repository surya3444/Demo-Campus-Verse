'use client';

import { useState, useEffect, useCallback } from 'react';
import { PageHeader } from '@/components/ui/page-header';
import { DataTable, Column } from '@/components/ui/data-table';
import { StatCard } from '@/components/ui/stat-card';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { DatePicker } from '@/components/ui/date-picker';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  IndianRupee,
  GraduationCap,
  Building2,
  TrendingUp,
  FileText,
  Download,
  Calendar,
  Users,
  School,
  Percent,
  Gift,
  Search,
  UsersRound,
  CalendarDays,
  Receipt,
} from 'lucide-react';
import { financeApi } from '@/lib/api';
import { useBranchStore } from '@/store/branchStore';

interface DueSummary {
  branchId: string;
  branchName: string;
  totalStudents: number;
  totalFee: number;
  totalPaid: number;
  totalDue: number;
  collectionPercentage: number;
}

interface ClassWiseDue {
  classId: string;
  className: string;
  totalStudents: number;
  totalFee: number;
  totalPaid: number;
  totalDue: number;
  collectionPercentage: number;
}

interface StudentDue {
  _id: string;
  admissionNumber: string;
  displayName: string;
  className: string;
  totalFee: number;
  totalPaid: number;
  totalDue: number;
}

interface FeeTypeCollection {
  componentCode: string;
  componentName: string;
  transactionCount: number;
  totalAmount: number;
}

interface SiblingDue {
  familyId: string;
  parentName: string;
  studentCount: number;
  students: string[];
  totalFee: number;
  totalPaid: number;
  totalDue: number;
  phone: string;
}

interface InstallmentDue {
  installmentName: string;
  dueDate: string;
  totalStudents: number;
  totalAmount: number;
  collectedAmount: number;
  pendingAmount: number;
  collectionPercentage: number;
}

interface DaySheetEntry {
  receiptNumber: string;
  time: string;
  studentName: string;
  admissionNumber: string;
  className: string;
  amount: number;
  paymentMode: string;
  collectedBy: string;
}

interface StudentTransaction {
  date: string;
  type: 'fee' | 'payment' | 'concession';
  description: string;
  debit: number;
  credit: number;
  balance: number;
  receiptNumber?: string;
}

interface ConcessionReport {
  classId: string;
  className: string;
  totalStudents: number;
  studentsWithConcession: number;
  totalConcessionAmount: number;
  averageConcession: number;
}

export default function FinanceReportsPage() {
  const [activeTab, setActiveTab] = useState('summary');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedClass, setSelectedClass] = useState('all');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [studentSearch, setStudentSearch] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<StudentDue | null>(null);
  const [_isLoading, setIsLoading] = useState(true);

  // Report data state
  const [branchSummary, setBranchSummary] = useState<DueSummary[]>([]);
  const selectedBranchId = useBranchStore((st) => st.selectedBranchId);
  const [classWiseDues, _setClassWiseDues] = useState<ClassWiseDue[]>([]);
  const [studentDues, _setStudentDues] = useState<StudentDue[]>([]);
  const [feeTypeCollections, _setFeeTypeCollections] = useState<FeeTypeCollection[]>([]);
  const [siblingDues, setSiblingDues] = useState<SiblingDue[]>([]);
  const [installmentDues, setInstallmentDues] = useState<InstallmentDue[]>([]);
  const [daySheet, setDaySheet] = useState<DaySheetEntry[]>([]);
  const [studentStatement, setStudentStatement] = useState<StudentTransaction[]>([]);
  const [concessionReports, setConcessionReports] = useState<ConcessionReport[]>([]);

  // Summary stats
  const [summaryStats, setSummaryStats] = useState({
    totalFee: 0,
    totalPaid: 0,
    totalDue: 0,
    overallCollection: 0,
  });

  // Fetch summary data
  const fetchSummaryData = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await financeApi.getAssignmentStats({});
      if (response.success && response.data) {
        const data = response.data;
        setBranchSummary(data.branches || []);
        setSummaryStats({
          totalFee: data.totalFee || 0,
          totalPaid: data.totalPaid || 0,
          totalDue: data.totalBalance || 0,
          overallCollection:
            data.totalFee > 0 ? Math.round((data.totalPaid / data.totalFee) * 100) : 0,
        });
      }
    } catch (error) {
      console.error('Failed to fetch summary data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [selectedBranchId]);

  // Fetch sibling dues
  const fetchSiblingDues = useCallback(async () => {
    try {
      const response = await financeApi.getSiblingDues({});
      if (response.success && response.data) {
        const data = response.data.siblingDues || response.data;
        setSiblingDues(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error('Failed to fetch sibling dues:', error);
    }
  }, []);

  // Fetch installment dues
  const fetchInstallmentDues = useCallback(async () => {
    try {
      const response = await financeApi.getInstallmentWiseDues({});
      if (response.success && response.data) {
        const data = response.data.installmentDues || response.data;
        setInstallmentDues(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error('Failed to fetch installment dues:', error);
    }
  }, []);

  // Fetch day sheet
  const fetchDaySheet = useCallback(async () => {
    try {
      const response = await financeApi.getDaySheet(selectedDate);
      if (response.success && response.data) {
        const data = response.data.entries || response.data;
        setDaySheet(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error('Failed to fetch day sheet:', error);
    }
  }, [selectedDate]);

  // Fetch student statement
  const fetchStudentStatement = useCallback(async (studentId: string) => {
    try {
      const response = await financeApi.getStudentStatement(studentId, {});
      if (response.success && response.data) {
        const data = response.data.transactions || response.data;
        setStudentStatement(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error('Failed to fetch student statement:', error);
    }
  }, []);

  // Fetch concession reports
  const fetchConcessionReports = useCallback(async () => {
    try {
      const response = await financeApi.getClassWiseConcessionReport({});
      if (response.success && response.data) {
        const data = response.data.reports || response.data;
        setConcessionReports(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error('Failed to fetch concession reports:', error);
    }
  }, []);

  // Fetch data on mount
  useEffect(() => {
    fetchSummaryData();
  }, [fetchSummaryData]);

  // Fetch tab-specific data when tab changes
  useEffect(() => {
    if (activeTab === 'sibling-dues') {
      fetchSiblingDues();
    } else if (activeTab === 'installment-dues') {
      fetchInstallmentDues();
    } else if (activeTab === 'day-sheet') {
      fetchDaySheet();
    } else if (activeTab === 'concession-reports') {
      fetchConcessionReports();
    }
  }, [activeTab, fetchSiblingDues, fetchInstallmentDues, fetchDaySheet, fetchConcessionReports]);

  // Fetch student statement when student is selected
  useEffect(() => {
    if (selectedStudent) {
      fetchStudentStatement(selectedStudent._id);
    }
  }, [selectedStudent, fetchStudentStatement]);

  const totalFee = summaryStats.totalFee || branchSummary.reduce((acc, b) => acc + b.totalFee, 0);
  const totalPaid =
    summaryStats.totalPaid || branchSummary.reduce((acc, b) => acc + b.totalPaid, 0);
  const totalDue = summaryStats.totalDue || branchSummary.reduce((acc, b) => acc + b.totalDue, 0);
  const overallCollection =
    summaryStats.overallCollection || (totalFee > 0 ? Math.round((totalPaid / totalFee) * 100) : 0);

  const branchColumns: Column<DueSummary>[] = [
    { key: 'branchName', header: 'Branch', sortable: true },
    {
      key: 'totalStudents',
      header: 'Students',
      cell: (row) => (
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          {row.totalStudents}
        </div>
      ),
    },
    {
      key: 'totalFee',
      header: 'Total Fee',
      sortable: true,
      cell: (row) => <span className="font-medium">₹{(row.totalFee / 100000).toFixed(1)}L</span>,
    },
    {
      key: 'totalPaid',
      header: 'Collected',
      sortable: true,
      cell: (row) => (
        <span className="text-success font-medium">₹{(row.totalPaid / 100000).toFixed(1)}L</span>
      ),
    },
    {
      key: 'totalDue',
      header: 'Due',
      sortable: true,
      cell: (row) => (
        <span className="text-destructive font-medium">₹{(row.totalDue / 100000).toFixed(1)}L</span>
      ),
    },
    {
      key: 'collectionPercentage',
      header: 'Collection %',
      sortable: true,
      cell: (row) => (
        <Badge
          variant={
            row.collectionPercentage >= 80
              ? 'success'
              : row.collectionPercentage >= 60
                ? 'warning'
                : 'destructive'
          }
        >
          {row.collectionPercentage}%
        </Badge>
      ),
    },
  ];

  const classColumns: Column<ClassWiseDue>[] = [
    {
      key: 'className',
      header: 'Class',
      sortable: true,
      cell: (row) => (
        <div className="flex items-center gap-2">
          <School className="h-4 w-4 text-muted-foreground" />
          {row.className}
        </div>
      ),
    },
    { key: 'totalStudents', header: 'Students', sortable: true },
    {
      key: 'totalFee',
      header: 'Total Fee',
      sortable: true,
      cell: (row) => <span className="font-medium">₹{row.totalFee.toLocaleString()}</span>,
    },
    {
      key: 'totalPaid',
      header: 'Collected',
      sortable: true,
      cell: (row) => <span className="text-success">₹{row.totalPaid.toLocaleString()}</span>,
    },
    {
      key: 'totalDue',
      header: 'Due',
      sortable: true,
      cell: (row) => <span className="text-destructive">₹{row.totalDue.toLocaleString()}</span>,
    },
    {
      key: 'collectionPercentage',
      header: 'Collection %',
      sortable: true,
      cell: (row) => (
        <div className="flex items-center gap-2">
          <div className="w-20 h-2 bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${
                row.collectionPercentage >= 80
                  ? 'bg-success'
                  : row.collectionPercentage >= 60
                    ? 'bg-warning'
                    : 'bg-destructive'
              }`}
              style={{ width: `${row.collectionPercentage}%` }}
            />
          </div>
          <span className="text-sm">{row.collectionPercentage}%</span>
        </div>
      ),
    },
  ];

  const studentColumns: Column<StudentDue>[] = [
    {
      key: 'admissionNumber',
      header: 'Adm. No.',
      cell: (row) => <Badge variant="outline">{row.admissionNumber}</Badge>,
    },
    { key: 'displayName', header: 'Student Name', sortable: true },
    { key: 'className', header: 'Class' },
    {
      key: 'totalFee',
      header: 'Total Fee',
      sortable: true,
      cell: (row) => <span>₹{row.totalFee.toLocaleString()}</span>,
    },
    {
      key: 'totalPaid',
      header: 'Paid',
      sortable: true,
      cell: (row) => <span className="text-success">₹{row.totalPaid.toLocaleString()}</span>,
    },
    {
      key: 'totalDue',
      header: 'Due',
      sortable: true,
      cell: (row) => (
        <span className="text-destructive font-semibold">₹{row.totalDue.toLocaleString()}</span>
      ),
    },
  ];

  const feeTypeColumns: Column<FeeTypeCollection>[] = [
    { key: 'componentCode', header: 'Code' },
    { key: 'componentName', header: 'Fee Type', sortable: true },
    { key: 'transactionCount', header: 'Transactions', sortable: true },
    {
      key: 'totalAmount',
      header: 'Total Collected',
      sortable: true,
      cell: (row) => <span className="font-semibold">₹{row.totalAmount.toLocaleString()}</span>,
    },
  ];

  const siblingColumns: Column<SiblingDue>[] = [
    { key: 'parentName', header: 'Parent Name', sortable: true },
    {
      key: 'studentCount',
      header: 'Students',
      cell: (row) => (
        <div>
          <Badge variant="outline">{row.studentCount} children</Badge>
          <p className="text-xs text-muted-foreground mt-1">{row.students.join(', ')}</p>
        </div>
      ),
    },
    { key: 'phone', header: 'Phone' },
    {
      key: 'totalFee',
      header: 'Total Fee',
      sortable: true,
      cell: (row) => <span className="font-medium">₹{row.totalFee.toLocaleString()}</span>,
    },
    {
      key: 'totalPaid',
      header: 'Paid',
      sortable: true,
      cell: (row) => <span className="text-success">₹{row.totalPaid.toLocaleString()}</span>,
    },
    {
      key: 'totalDue',
      header: 'Combined Due',
      sortable: true,
      cell: (row) => (
        <span className="text-destructive font-semibold">₹{row.totalDue.toLocaleString()}</span>
      ),
    },
  ];

  const installmentColumns: Column<InstallmentDue>[] = [
    { key: 'installmentName', header: 'Installment', sortable: true },
    {
      key: 'dueDate',
      header: 'Due Date',
      cell: (row) => (
        <span className="text-sm">
          {new Date(row.dueDate).toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          })}
        </span>
      ),
    },
    { key: 'totalStudents', header: 'Students' },
    {
      key: 'totalAmount',
      header: 'Total',
      sortable: true,
      cell: (row) => <span className="font-medium">₹{(row.totalAmount / 100000).toFixed(1)}L</span>,
    },
    {
      key: 'collectedAmount',
      header: 'Collected',
      sortable: true,
      cell: (row) => (
        <span className="text-success">₹{(row.collectedAmount / 100000).toFixed(1)}L</span>
      ),
    },
    {
      key: 'pendingAmount',
      header: 'Pending',
      sortable: true,
      cell: (row) => (
        <span className="text-destructive">₹{(row.pendingAmount / 100000).toFixed(1)}L</span>
      ),
    },
    {
      key: 'collectionPercentage',
      header: 'Collection %',
      cell: (row) => (
        <Badge
          variant={
            row.collectionPercentage >= 80
              ? 'success'
              : row.collectionPercentage >= 60
                ? 'warning'
                : 'destructive'
          }
        >
          {row.collectionPercentage}%
        </Badge>
      ),
    },
  ];

  const daySheetColumns: Column<DaySheetEntry>[] = [
    {
      key: 'receiptNumber',
      header: 'Receipt #',
      cell: (row) => (
        <Badge variant="outline" className="font-mono">
          {row.receiptNumber}
        </Badge>
      ),
    },
    { key: 'time', header: 'Time' },
    { key: 'studentName', header: 'Student', sortable: true },
    { key: 'admissionNumber', header: 'Adm. No.' },
    { key: 'className', header: 'Class' },
    {
      key: 'amount',
      header: 'Amount',
      sortable: true,
      cell: (row) => (
        <span className="font-semibold text-success">₹{row.amount.toLocaleString()}</span>
      ),
    },
    {
      key: 'paymentMode',
      header: 'Mode',
      cell: (row) => <Badge variant="secondary">{row.paymentMode}</Badge>,
    },
    { key: 'collectedBy', header: 'Collected By' },
  ];

  const statementColumns: Column<StudentTransaction>[] = [
    {
      key: 'date',
      header: 'Date',
      cell: (row) =>
        new Date(row.date).toLocaleDateString('en-IN', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        }),
    },
    {
      key: 'type',
      header: 'Type',
      cell: (row) => (
        <Badge
          className={
            row.type === 'fee'
              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
              : row.type === 'payment'
                ? 'bg-success/10 text-success'
                : 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
          }
        >
          {row.type}
        </Badge>
      ),
    },
    { key: 'description', header: 'Description' },
    {
      key: 'receiptNumber',
      header: 'Receipt #',
      cell: (row) =>
        row.receiptNumber ? (
          <Badge variant="outline" className="font-mono">
            {row.receiptNumber}
          </Badge>
        ) : (
          '-'
        ),
    },
    {
      key: 'debit',
      header: 'Debit',
      cell: (row) =>
        row.debit > 0 ? (
          <span className="text-destructive">₹{row.debit.toLocaleString()}</span>
        ) : (
          '-'
        ),
    },
    {
      key: 'credit',
      header: 'Credit',
      cell: (row) =>
        row.credit > 0 ? <span className="text-success">₹{row.credit.toLocaleString()}</span> : '-',
    },
    {
      key: 'balance',
      header: 'Balance',
      cell: (row) => <span className="font-semibold">₹{row.balance.toLocaleString()}</span>,
    },
  ];

  const concessionReportColumns: Column<ConcessionReport>[] = [
    {
      key: 'className',
      header: 'Class',
      sortable: true,
      cell: (row) => (
        <div className="flex items-center gap-2">
          <School className="h-4 w-4 text-muted-foreground" />
          {row.className}
        </div>
      ),
    },
    { key: 'totalStudents', header: 'Total Students', sortable: true },
    {
      key: 'studentsWithConcession',
      header: 'With Concession',
      sortable: true,
      cell: (row) => (
        <div className="flex items-center gap-2">
          <Gift className="h-4 w-4 text-purple-600" />
          {row.studentsWithConcession}
        </div>
      ),
    },
    {
      key: 'totalConcessionAmount',
      header: 'Total Amount',
      sortable: true,
      cell: (row) => (
        <span className="font-semibold text-purple-600">
          ₹{row.totalConcessionAmount.toLocaleString()}
        </span>
      ),
    },
    {
      key: 'averageConcession',
      header: 'Avg. Concession',
      sortable: true,
      cell: (row) => <span>₹{row.averageConcession.toLocaleString()}</span>,
    },
  ];

  const daySheetTotal = daySheet.reduce((acc, entry) => acc + entry.amount, 0);

  const handleViewStatement = (student: StudentDue) => {
    setSelectedStudent(student);
    setActiveTab('statement');
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Finance Reports" description="View and analyze fee collection reports">
        <Button variant="outline" className="gap-2">
          <Download className="h-4 w-4" />
          Export Report
        </Button>
      </PageHeader>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4 stagger-animation">
        <StatCard
          title="Total Fee"
          value={`₹${(totalFee / 100000).toFixed(1)}L`}
          icon={IndianRupee}
          variant="primary"
        />
        <StatCard
          title="Collected"
          value={`₹${(totalPaid / 100000).toFixed(1)}L`}
          icon={TrendingUp}
        />
        <StatCard
          title="Due Amount"
          value={`₹${(totalDue / 100000).toFixed(1)}L`}
          icon={FileText}
        />
        <StatCard title="Collection Rate" value={`${overallCollection}%`} icon={Percent} />
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <Label className="text-sm">From:</Label>
              <DatePicker value={dateFrom} onChange={(iso) => setDateFrom(iso)} className="w-40" />
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-sm">To:</Label>
              <DatePicker value={dateTo} onChange={(iso) => setDateTo(iso)} className="w-40" />
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-sm">Class:</Label>
              <Select value={selectedClass} onValueChange={setSelectedClass}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Select class" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Classes</SelectItem>
                  <SelectItem value="12">Class 12</SelectItem>
                  <SelectItem value="11">Class 11</SelectItem>
                  <SelectItem value="10">Class 10</SelectItem>
                  <SelectItem value="9">Class 9</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button>Apply Filters</Button>
          </div>
        </CardContent>
      </Card>

      {/* Reports Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex flex-wrap h-auto gap-1 p-1">
          <TabsTrigger value="summary" className="gap-2">
            <Building2 className="h-4 w-4" />
            Summary
          </TabsTrigger>
          <TabsTrigger value="class" className="gap-2">
            <School className="h-4 w-4" />
            Class-wise
          </TabsTrigger>
          <TabsTrigger value="student" className="gap-2">
            <GraduationCap className="h-4 w-4" />
            Student-wise
          </TabsTrigger>
          <TabsTrigger value="feetype" className="gap-2">
            <FileText className="h-4 w-4" />
            Fee Type
          </TabsTrigger>
          <TabsTrigger value="sibling" className="gap-2">
            <UsersRound className="h-4 w-4" />
            Sibling Dues
          </TabsTrigger>
          <TabsTrigger value="installment" className="gap-2">
            <Calendar className="h-4 w-4" />
            Installment
          </TabsTrigger>
          <TabsTrigger value="daysheet" className="gap-2">
            <CalendarDays className="h-4 w-4" />
            Day Sheet
          </TabsTrigger>
          <TabsTrigger value="statement" className="gap-2">
            <Receipt className="h-4 w-4" />
            Statement
          </TabsTrigger>
          <TabsTrigger value="concession" className="gap-2">
            <Gift className="h-4 w-4" />
            Concessions
          </TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Collection Summary</CardTitle>
              <CardDescription>Overall fee collection status across all branches</CardDescription>
            </CardHeader>
            <CardContent>
              <DataTable data={branchSummary} columns={branchColumns} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="class" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Class-wise Dues</CardTitle>
              <CardDescription>Fee collection breakdown by class</CardDescription>
            </CardHeader>
            <CardContent>
              <DataTable data={classWiseDues} columns={classColumns} searchable />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="student" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Student-wise Dues</CardTitle>
              <CardDescription>Individual student fee dues</CardDescription>
            </CardHeader>
            <CardContent>
              <DataTable
                data={studentDues}
                columns={studentColumns}
                searchable
                searchPlaceholder="Search by name or admission number..."
                actions={[
                  {
                    label: 'View Statement',
                    icon: <Receipt className="mr-2 h-4 w-4" />,
                    onClick: handleViewStatement,
                  },
                ]}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="feetype" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Fee Type Collection Report</CardTitle>
              <CardDescription>Collections grouped by fee component type</CardDescription>
            </CardHeader>
            <CardContent>
              <DataTable data={feeTypeCollections} columns={feeTypeColumns} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sibling" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Sibling Dues Report</CardTitle>
              <CardDescription>Combined dues for families with multiple students</CardDescription>
            </CardHeader>
            <CardContent>
              <DataTable
                data={siblingDues}
                columns={siblingColumns}
                searchable
                searchPlaceholder="Search by parent name or phone..."
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="installment" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Installment-wise Dues</CardTitle>
              <CardDescription>Collection status by installment</CardDescription>
            </CardHeader>
            <CardContent>
              <DataTable data={installmentDues} columns={installmentColumns} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="daysheet" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Fee Day Sheet</CardTitle>
                <CardDescription>Daily collection report</CardDescription>
              </div>
              <div className="flex items-center gap-4">
                <DatePicker
                  value={selectedDate}
                  onChange={(iso) => setSelectedDate(iso)}
                  className="w-44"
                />
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Total Collection</p>
                  <p className="text-2xl font-bold text-success">
                    ₹{daySheetTotal.toLocaleString()}
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <DataTable data={daySheet} columns={daySheetColumns} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="statement" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Student Statement</CardTitle>
              <CardDescription>
                {selectedStudent
                  ? `Fee ledger for ${selectedStudent.displayName} (${selectedStudent.admissionNumber})`
                  : 'Search for a student to view their fee statement'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!selectedStudent ? (
                <div className="space-y-4">
                  <div className="flex gap-2 max-w-md">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search by name or admission number..."
                        value={studentSearch}
                        onChange={(e) => setStudentSearch(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                    <Button>Search</Button>
                  </div>

                  {studentSearch && (
                    <div className="border rounded-lg divide-y max-w-md">
                      {studentDues
                        .filter(
                          (s) =>
                            s.displayName.toLowerCase().includes(studentSearch.toLowerCase()) ||
                            s.admissionNumber.toLowerCase().includes(studentSearch.toLowerCase())
                        )
                        .map((student) => (
                          <div
                            key={student._id}
                            className="p-3 hover:bg-muted/50 cursor-pointer flex items-center justify-between"
                            onClick={() => setSelectedStudent(student)}
                          >
                            <div>
                              <p className="font-medium">{student.displayName}</p>
                              <p className="text-xs text-muted-foreground">
                                {student.admissionNumber} | {student.className}
                              </p>
                            </div>
                            <Badge variant="outline">
                              ₹{student.totalDue.toLocaleString()} due
                            </Badge>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                        <GraduationCap className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold">{selectedStudent.displayName}</h3>
                        <p className="text-sm text-muted-foreground">
                          {selectedStudent.admissionNumber} | {selectedStudent.className}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">Total Fee</p>
                        <p className="font-semibold">
                          ₹{selectedStudent.totalFee.toLocaleString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">Paid</p>
                        <p className="font-semibold text-success">
                          ₹{selectedStudent.totalPaid.toLocaleString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">Balance</p>
                        <p className="font-semibold text-destructive">
                          ₹{selectedStudent.totalDue.toLocaleString()}
                        </p>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => setSelectedStudent(null)}>
                        Change Student
                      </Button>
                    </div>
                  </div>

                  <DataTable data={studentStatement} columns={statementColumns} />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="concession" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Concession Report</CardTitle>
              <CardDescription>Class-wise concession summary</CardDescription>
            </CardHeader>
            <CardContent>
              <DataTable data={concessionReports} columns={concessionReportColumns} searchable />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
