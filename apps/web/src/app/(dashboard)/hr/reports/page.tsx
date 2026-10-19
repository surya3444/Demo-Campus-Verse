'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { DatePicker } from '@/components/ui/date-picker';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  FileText,
  Download,
  UserX,
  ClipboardList,
  IdCard,
  CalendarDays,
  Filter,
  FileSpreadsheet,
  Loader2,
  Users,
  TrendingUp,
  Clock,
  Lock,
} from 'lucide-react';
import { toast } from 'sonner';
import { staffAttendanceApi, hrApi } from '@/lib/api';

interface ReportConfig {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  comingSoon?: boolean;
  filters?: {
    dateRange?: boolean;
    department?: boolean;
    status?: boolean;
    format?: boolean;
  };
}

const REPORTS: ReportConfig[] = [
  {
    id: 'staff-attendance',
    name: 'Staff Attendance Report',
    description: 'Daily, weekly, or monthly attendance summary for all staff members',
    icon: ClipboardList,
    iconBg: 'bg-blue-100 dark:bg-blue-900/30',
    iconColor: 'text-blue-600 dark:text-blue-400',
    filters: { dateRange: true, department: true, format: true },
  },
  {
    id: 'staff-details',
    name: 'Staff Details Report',
    description: 'Complete employee information including contact, department, and designation',
    icon: IdCard,
    iconBg: 'bg-green-100 dark:bg-green-900/30',
    iconColor: 'text-green-600 dark:text-green-400',
    filters: { department: true, status: true, format: true },
  },
  {
    id: 'staff-leaves',
    name: 'Staff Leaves Report',
    description: 'Leave balance, utilized, and pending leaves for all staff members',
    icon: CalendarDays,
    iconBg: 'bg-amber-100 dark:bg-amber-900/30',
    iconColor: 'text-amber-600 dark:text-amber-400',
    filters: { dateRange: true, department: true, format: true },
  },
  {
    id: 'inactive-staff',
    name: 'Inactive Staff Details',
    description: 'List of resigned, terminated, or inactive staff members',
    icon: UserX,
    iconBg: 'bg-red-100 dark:bg-red-900/30',
    iconColor: 'text-red-600 dark:text-red-400',
    filters: { dateRange: true, format: true },
  },
  {
    id: 'department-wise',
    name: 'Department-wise Staff Report',
    description: 'Staff count and details grouped by department',
    icon: Users,
    iconBg: 'bg-purple-100 dark:bg-purple-900/30',
    iconColor: 'text-purple-600 dark:text-purple-400',
    filters: { status: true, format: true },
  },
  {
    id: 'salary-summary',
    name: 'Salary Summary Report',
    description: 'Monthly salary summary with deductions and net pay',
    icon: TrendingUp,
    iconBg: 'bg-emerald-100 dark:bg-emerald-900/30',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    comingSoon: true,
    filters: { dateRange: true, department: true, format: true },
  },
  {
    id: 'overtime-report',
    name: 'Overtime Report',
    description: 'Staff overtime hours and compensation details',
    icon: Clock,
    iconBg: 'bg-orange-100 dark:bg-orange-900/30',
    iconColor: 'text-orange-600 dark:text-orange-400',
    comingSoon: true,
    filters: { dateRange: true, department: true, format: true },
  },
  {
    id: 'joining-leaving',
    name: 'Joining & Leaving Report',
    description: 'Staff who joined or left during a specific period',
    icon: FileSpreadsheet,
    iconBg: 'bg-cyan-100 dark:bg-cyan-900/30',
    iconColor: 'text-cyan-600 dark:text-cyan-400',
    filters: { dateRange: true, format: true },
  },
];

export default function HRReportsPage() {
  const [selectedReport, setSelectedReport] = useState<ReportConfig | null>(null);
  const [generating, setGenerating] = useState(false);
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    department: 'all',
    status: 'all',
    format: 'pdf',
  });

  const handleGenerateReport = async () => {
    if (!selectedReport) return;

    setGenerating(true);
    try {
      let data;
      const today = new Date().toISOString().split('T')[0];

      switch (selectedReport.id) {
        case 'staff-attendance': {
          const date = filters.startDate || today;
          if (filters.endDate) {
            // Monthly report
            const d = new Date(filters.startDate || today);
            data = await staffAttendanceApi.getMonthlyReport({
              month: d.getMonth() + 1,
              year: d.getFullYear(),
            });
          } else {
            data = await staffAttendanceApi.getDailyReport(date);
          }
          break;
        }
        case 'staff-details': {
          const params: Record<string, string | number> = { limit: 1000 };
          if (filters.department !== 'all') params.departmentId = filters.department;
          if (filters.status !== 'all') params.status = filters.status;
          data = await hrApi.getStaff(params as Parameters<typeof hrApi.getStaff>[0]);
          break;
        }
        case 'staff-leaves': {
          const leaveParams: Record<string, string | number> = { limit: 1000 };
          if (filters.startDate) leaveParams.fromDate = filters.startDate;
          if (filters.endDate) leaveParams.toDate = filters.endDate;
          data = await hrApi.getLeaves(leaveParams as Parameters<typeof hrApi.getLeaves>[0]);
          break;
        }
        case 'inactive-staff': {
          data = await hrApi.getStaff({ status: 'inactive', limit: 1000 });
          break;
        }
        case 'department-wise': {
          data = await hrApi.getDepartments();
          break;
        }
        case 'joining-leaving': {
          const jlParams: Record<string, string | number> = { limit: 1000 };
          if (filters.startDate) jlParams.fromDate = filters.startDate;
          if (filters.endDate) jlParams.toDate = filters.endDate;
          data = await hrApi.getStaff(jlParams as Parameters<typeof hrApi.getStaff>[0]);
          break;
        }
        default:
          break;
      }

      if (data?.success !== false) {
        toast.success(`${selectedReport.name} generated successfully`);
      } else {
        toast.error('Failed to generate report');
      }
      setSelectedReport(null);
    } catch {
      toast.error('Failed to generate report');
    } finally {
      setGenerating(false);
    }
  };

  const openReportDialog = (report: ReportConfig) => {
    if (report.comingSoon) {
      toast.info(`${report.name} is coming soon`);
      return;
    }
    setSelectedReport(report);
    setFilters({
      startDate: '',
      endDate: '',
      department: 'all',
      status: 'all',
      format: 'pdf',
    });
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            <FileText className="h-3.5 w-3.5 text-[hsl(var(--brand-cyan))]" />
            HR · Reports
          </p>
          <h1 className="mt-1.5 font-display text-3xl font-bold leading-tight tracking-tight md:text-4xl">Reports</h1>
        <p className="text-muted-foreground mt-1">
          Generate and download various HR reports for staff management
        </p>
      </div>

      {/* Reports Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {REPORTS.filter((r) => !r.comingSoon).map((report) => {
          const Icon = report.icon;
          return (
            <Card
              key={report.id}
              className={`border-0 shadow-elegant-sm hover:shadow-elegant-md transition-all group ${
                report.comingSoon ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'
              }`}
              onClick={() => openReportDialog(report)}
            >
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div
                    className={`h-12 w-12 rounded-xl flex items-center justify-center ${report.iconBg} ${report.iconColor} group-hover:scale-110 transition-transform`}
                  >
                    <Icon className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-base group-hover:text-primary transition-colors">
                        {report.name}
                      </h3>
                      {report.comingSoon && (
                        <Badge variant="secondary" className="text-xs gap-1">
                          <Lock className="h-3 w-3" />
                          Coming Soon
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                      {report.description}
                    </p>
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Filter className="h-3 w-3" />
                    {report.filters?.dateRange && <span>Date</span>}
                    {report.filters?.department && <span>Dept</span>}
                    {report.filters?.status && <span>Status</span>}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 h-8"
                    disabled={report.comingSoon}
                  >
                    <Download className="h-3.5 w-3.5" />
                    Generate
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Quick Stats */}
      <Card className="border-0 shadow-elegant-md">
        <CardHeader>
          <CardTitle className="text-lg">Recent Reports</CardTitle>
          <CardDescription>Recently generated reports will appear here</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No reports generated yet</p>
            <p className="text-sm mt-1">Select a report above to generate</p>
          </div>
        </CardContent>
      </Card>

      {/* Report Dialog */}
      <Dialog open={!!selectedReport} onOpenChange={(open) => !open && setSelectedReport(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedReport && (
                <>
                  <selectedReport.icon className={`h-5 w-5 ${selectedReport.iconColor}`} />
                  {selectedReport.name}
                </>
              )}
            </DialogTitle>
            <DialogDescription>Configure filters and generate the report</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {selectedReport?.filters?.dateRange && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start Date</Label>
                  <DatePicker
                    value={filters.startDate}
                    onChange={(iso) => setFilters({ ...filters, startDate: iso })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>End Date</Label>
                  <DatePicker
                    value={filters.endDate}
                    onChange={(iso) => setFilters({ ...filters, endDate: iso })}
                  />
                </div>
              </div>
            )}

            {selectedReport?.filters?.department && (
              <div className="space-y-2">
                <Label>Department</Label>
                <Select
                  value={filters.department}
                  onValueChange={(v) => setFilters({ ...filters, department: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Departments</SelectItem>
                    <SelectItem value="teaching">Teaching</SelectItem>
                    <SelectItem value="admin">Administration</SelectItem>
                    <SelectItem value="accounts">Accounts</SelectItem>
                    <SelectItem value="support">Support Staff</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {selectedReport?.filters?.status && (
              <div className="space-y-2">
                <Label>Staff Status</Label>
                <Select
                  value={filters.status}
                  onValueChange={(v) => setFilters({ ...filters, status: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="on-leave">On Leave</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {selectedReport?.filters?.format && (
              <div className="space-y-2">
                <Label>Export Format</Label>
                <Select
                  value={filters.format}
                  onValueChange={(v) => setFilters({ ...filters, format: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select format" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pdf">PDF Document</SelectItem>
                    <SelectItem value="excel">Excel Spreadsheet</SelectItem>
                    <SelectItem value="csv">CSV File</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedReport(null)}>
              Cancel
            </Button>
            <Button onClick={handleGenerateReport} disabled={generating} className="gap-2">
              {generating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              {generating ? 'Generating...' : 'Generate Report'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
