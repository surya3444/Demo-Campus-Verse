'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DatePicker } from '@/components/ui/date-picker';
import { PageHero } from '@/components/ui/page-hero';

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
  BarChart3,
  Users,
  GraduationCap,
  Layers,
  PieChart,
  UserPlus,
  School,
  Loader2,
  Filter,
  ArrowRight,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { studentApi } from '@/lib/api';

type Accent = 'primary' | 'accent' | 'success' | 'warning' | 'info' | 'muted';

interface ReportConfig {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  accent: Accent;
  filters?: {
    academicBatch?: boolean;
    class?: boolean;
    dateRange?: boolean;
    search?: boolean;
  };
}

interface ReportResult {
  title: string;
  data: Record<string, unknown>[];
  columns: { key: string; label: string }[];
  summary?: Record<string, string | number>;
}

const ACCENT_CHIP: Record<Accent, string> = {
  primary: 'bg-primary/10 text-primary',
  accent: 'bg-accent/10 text-accent',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  info: 'bg-info/10 text-info',
  muted: 'bg-muted text-muted-foreground',
};

const REPORTS: ReportConfig[] = [
  {
    id: 'class-wise',
    name: 'Class-wise Distribution',
    description: 'Student count and distribution grouped by class',
    icon: Layers,
    accent: 'primary',
    filters: { academicBatch: true },
  },
  {
    id: 'section-wise',
    name: 'Section-wise Distribution',
    description: 'Student count grouped by section within each class',
    icon: PieChart,
    accent: 'accent',
    filters: { academicBatch: true, class: true },
  },
  {
    id: 'active-students',
    name: 'Active Students Report',
    description: 'List of all currently active and enrolled students',
    icon: Users,
    accent: 'success',
    filters: { academicBatch: true, class: true },
  },
  {
    id: 'category-wise',
    name: 'Category-wise Report',
    description: 'Student distribution by categories (General, OBC, SC, ST)',
    icon: BarChart3,
    accent: 'warning',
    filters: { academicBatch: true },
  },
  {
    id: 'new-admissions',
    name: 'New Admissions Report',
    description: 'Students admitted during a specific date range',
    icon: UserPlus,
    accent: 'info',
    filters: { academicBatch: true, dateRange: true },
  },
  {
    id: 'alumni',
    name: 'Alumni Report',
    description: 'Passed-out students with search and date filters',
    icon: School,
    accent: 'muted',
    filters: { dateRange: true, search: true },
  },
];

export default function StudentReportsPage() {
  const [selectedReport, setSelectedReport] = useState<ReportConfig | null>(null);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<ReportResult | null>(null);
  const [filters, setFilters] = useState({
    academicBatchId: '',
    classId: '',
    startDate: '',
    endDate: '',
    search: '',
  });

  const handleGenerateReport = useCallback(async () => {
    if (!selectedReport) return;

    setGenerating(true);
    setResult(null);
    try {
      let response;
      switch (selectedReport.id) {
        case 'class-wise': {
          const params: Record<string, string> = {};
          if (filters.academicBatchId) params.academicBatchId = filters.academicBatchId;
          response = await studentApi.getClassWiseReport(params);
          if (response.success) {
            setResult({
              title: 'Class-wise Distribution',
              data: response.data || [],
              columns: [
                { key: 'className', label: 'Class' },
                { key: 'totalStudents', label: 'Total Students' },
                { key: 'maleCount', label: 'Male' },
                { key: 'femaleCount', label: 'Female' },
              ],
              summary: {
                total: (response.data || []).reduce(
                  (s: number, r: { totalStudents?: number }) => s + (r.totalStudents || 0),
                  0
                ),
              },
            });
          }
          break;
        }
        case 'section-wise': {
          const params: Record<string, string> = {};
          if (filters.academicBatchId) params.academicBatchId = filters.academicBatchId;
          if (filters.classId) params.classId = filters.classId;
          response = await studentApi.getSectionWiseReport(params);
          if (response.success) {
            setResult({
              title: 'Section-wise Distribution',
              data: response.data || [],
              columns: [
                { key: 'className', label: 'Class' },
                { key: 'sectionName', label: 'Section' },
                { key: 'totalStudents', label: 'Total Students' },
              ],
            });
          }
          break;
        }
        case 'active-students': {
          const params: Record<string, string> = {};
          if (filters.academicBatchId) params.academicBatchId = filters.academicBatchId;
          if (filters.classId) params.classId = filters.classId;
          response = await studentApi.getActiveStudentReport(params);
          if (response.success) {
            setResult({
              title: 'Active Students — Section Utilization',
              data: response.data?.sections || [],
              columns: [
                { key: 'className', label: 'Class' },
                { key: 'sectionName', label: 'Section' },
                { key: 'enrolled', label: 'Enrolled' },
              ],
              summary: response.data?.totals,
            });
          }
          break;
        }
        case 'category-wise': {
          const params: Record<string, string> = {};
          if (filters.academicBatchId) params.academicBatchId = filters.academicBatchId;
          response = await studentApi.getCategoryWiseReport(params);
          if (response.success) {
            setResult({
              title: 'Category-wise Distribution',
              data: response.data || [],
              columns: [
                { key: 'category', label: 'Category' },
                { key: 'count', label: 'Student Count' },
                { key: 'percentage', label: 'Percentage' },
              ],
            });
          }
          break;
        }
        case 'new-admissions': {
          const params: Record<string, string> = {};
          if (filters.academicBatchId) params.academicBatchId = filters.academicBatchId;
          if (filters.startDate) params.fromDate = filters.startDate;
          if (filters.endDate) params.toDate = filters.endDate;
          response = await studentApi.getNewAdmissionsReport(params);
          if (response.success) {
            setResult({
              title: 'New Admissions',
              data: response.data?.byClass || [],
              columns: [
                { key: 'className', label: 'Class' },
                { key: 'total', label: 'Total' },
                { key: 'male', label: 'Male' },
                { key: 'female', label: 'Female' },
              ],
              summary: response.data?.summary,
            });
          }
          break;
        }
        case 'alumni': {
          const params: Record<string, string | number> = { limit: 100 };
          if (filters.startDate) params.fromDate = filters.startDate;
          if (filters.endDate) params.toDate = filters.endDate;
          if (filters.search) params.search = filters.search;
          response = await studentApi.getAlumniList(params);
          if (response.success) {
            const alumniData = (response.data || []).map((s: Record<string, unknown>) => ({
              admissionNumber: s.admissionNumber,
              displayName: s.displayName,
              className: (s.currentEnrollment as Record<string, string>)?.className || '-',
              status: s.status,
            }));
            setResult({
              title: 'Alumni List',
              data: alumniData,
              columns: [
                { key: 'admissionNumber', label: 'Admission No.' },
                { key: 'displayName', label: 'Name' },
                { key: 'className', label: 'Last Class' },
                { key: 'status', label: 'Status' },
              ],
            });
          }
          break;
        }
      }

      if (response && response.success === false) {
        toast.error('Failed to generate report');
      }
    } catch {
      toast.error('Failed to generate report');
    } finally {
      setGenerating(false);
    }
  }, [selectedReport, filters]);

  const openReportDialog = (report: ReportConfig) => {
    setSelectedReport(report);
    setResult(null);
    setFilters({
      academicBatchId: '',
      classId: '',
      startDate: '',
      endDate: '',
      search: '',
    });
  };

  const filterTags = (r: ReportConfig) =>
    [
      r.filters?.academicBatch && 'Batch',
      r.filters?.class && 'Class',
      r.filters?.dateRange && 'Date',
      r.filters?.search && 'Search',
    ].filter(Boolean) as string[];

  return (
    <div className="space-y-6">
      <PageHero
        icon={BarChart3}
        eyebrow="Students"
        title="Student Reports"
        description="Generate distribution breakdowns, rosters and admission analytics on demand."
      />

      {/* Reports grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {REPORTS.map((report, i) => {
          const Icon = report.icon;
          return (
            <button
              key={report.id}
              type="button"
              onClick={() => openReportDialog(report)}
              className={cn(
                'group relative flex flex-col rounded-2xl border bg-card p-6 text-left shadow-xs',
                'transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/20 hover:shadow-soft',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
              )}
            >
              <span className="pointer-events-none absolute right-5 top-4 font-mono text-[10px] text-muted-foreground/40">
                {String(i + 1).padStart(2, '0')}
              </span>

              <div
                className={cn(
                  'flex h-12 w-12 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-105',
                  ACCENT_CHIP[report.accent]
                )}
              >
                <Icon className="h-6 w-6" />
              </div>

              <h3 className="mt-4 font-display text-base font-semibold tracking-tight transition-colors group-hover:text-primary">
                {report.name}
              </h3>
              <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                {report.description}
              </p>

              <div className="mt-5 flex items-center justify-between border-t pt-4">
                <div className="flex flex-wrap items-center gap-1.5">
                  {filterTags(report).map((tag) => (
                    <span
                      key={tag}
                      className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                <span className="flex items-center gap-1 text-xs font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
                  Generate
                  <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Report Dialog */}
      <Dialog
        open={!!selectedReport}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedReport(null);
            setResult(null);
          }
        }}
      >
        <DialogContent className={result ? 'sm:max-w-3xl' : 'sm:max-w-md'}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              {selectedReport && (
                <>
                  <span
                    className={cn(
                      'flex h-9 w-9 items-center justify-center rounded-lg',
                      ACCENT_CHIP[selectedReport.accent]
                    )}
                  >
                    <selectedReport.icon className="h-5 w-5" />
                  </span>
                  {selectedReport.name}
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {result
                ? `Showing ${result.data.length} ${result.data.length === 1 ? 'record' : 'records'}`
                : 'Configure filters and generate the report'}
            </DialogDescription>
          </DialogHeader>

          {!result ? (
            <>
              <div className="space-y-4 py-4">
                {selectedReport?.filters?.academicBatch && (
                  <div className="space-y-2">
                    <Label>Academic Batch</Label>
                    <Select
                      value={filters.academicBatchId || 'all'}
                      onValueChange={(v) =>
                        setFilters({ ...filters, academicBatchId: v === 'all' ? '' : v })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="All batches" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Batches</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {selectedReport?.filters?.class && (
                  <div className="space-y-2">
                    <Label>Class</Label>
                    <Select
                      value={filters.classId || 'all'}
                      onValueChange={(v) =>
                        setFilters({ ...filters, classId: v === 'all' ? '' : v })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="All classes" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Classes</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

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

                {selectedReport?.filters?.search && (
                  <div className="space-y-2">
                    <Label>Search</Label>
                    <Input
                      placeholder="Search by name or ID..."
                      value={filters.search}
                      onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                    />
                  </div>
                )}

                {!selectedReport?.filters && (
                  <p className="text-sm text-muted-foreground">
                    This report needs no filters — generate it directly.
                  </p>
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
                    <BarChart3 className="h-4 w-4" />
                  )}
                  {generating ? 'Generating…' : 'Generate Report'}
                </Button>
              </DialogFooter>
            </>
          ) : (
            <div className="space-y-4">
              {/* Summary */}
              {result.summary && (
                <div className="flex flex-wrap gap-3">
                  {Object.entries(result.summary).map(([key, value]) => (
                    <div
                      key={key}
                      className="flex items-center gap-2 rounded-xl border bg-muted/30 px-4 py-2.5"
                    >
                      <GraduationCap className="h-4 w-4 text-primary" />
                      <span className="text-xs uppercase tracking-wider text-muted-foreground">
                        {key}
                      </span>
                      <span className="font-display text-lg font-bold tabular-nums leading-none">
                        {typeof value === 'number' ? value.toLocaleString() : value}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Results Table */}
              {result.data.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
                    <AlertCircle className="h-7 w-7 text-muted-foreground" />
                  </div>
                  <p className="text-base font-medium">No data found</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Try adjusting the filters and generate again
                  </p>
                </div>
              ) : (
                <div className="max-h-[400px] overflow-auto rounded-xl border">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 z-10 bg-muted/70 backdrop-blur">
                      <tr>
                        {result.columns.map((col) => (
                          <th
                            key={col.key}
                            className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground"
                          >
                            {col.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {result.data.map((row, i) => (
                        <tr key={i} className="transition-colors hover:bg-muted/30">
                          {result.columns.map((col, ci) => (
                            <td
                              key={col.key}
                              className={cn(
                                'px-4 py-3',
                                ci === 0 ? 'font-medium' : 'tabular-nums text-muted-foreground'
                              )}
                            >
                              {String(row[col.key] ?? '—')}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <DialogFooter>
                <Button variant="outline" onClick={() => setResult(null)} className="gap-2">
                  <Filter className="h-4 w-4" />
                  Change Filters
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setSelectedReport(null);
                    setResult(null);
                  }}
                >
                  Close
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
