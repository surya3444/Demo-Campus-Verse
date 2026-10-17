'use client';

import { useState, useEffect, useCallback } from 'react';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { StatCard } from '@/components/ui/stat-card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { DatePicker } from '@/components/ui/date-picker';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  AlertCircle,
  Download,
  Filter,
  BarChart3,
} from 'lucide-react';
import { toast } from 'sonner';
import { certificatesApi } from '@/lib/api';

interface CertificateRequest {
  _id: string;
  certificateNumber: string;
  certificateTypeName?: string;
  category: 'student' | 'staff';
  status: string;
  createdAt: string;
  issuedAt?: string;
}

interface Stats {
  summary: {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
    issued: number;
  };
  byCategory: Record<string, number>;
  byType: Array<{ typeId: string; typeName: string; count: number }>;
  recentIssued: CertificateRequest[];
}

interface ReportData {
  requests: CertificateRequest[];
  dailyTrend: Array<{ date: string; count: number }>;
}

const statusColors: Record<string, string> = {
  pending: 'bg-warning/10 text-warning',
  approved: 'bg-info/10 text-info',
  rejected: 'bg-destructive/10 text-destructive',
  issued: 'bg-success/10 text-success',
};

export default function CertificateReportsPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [category, setCategory] = useState<string>('all');
  const [status, setStatus] = useState<string>('all');

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [statsRes, reportRes] = await Promise.all([
        certificatesApi.getStats(),
        certificatesApi.getReport({
          fromDate: fromDate || undefined,
          toDate: toDate || undefined,
          category: category === 'all' ? undefined : category,
          status: status === 'all' ? undefined : status,
        }),
      ]);
      setStats(statsRes.data || null);
      setReport(reportRes.data || null);
    } catch (err) {
      console.error('Failed to fetch report:', err);
      setError('Failed to load report');
      toast.error('Failed to load report');
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate, category, status]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleFilter = () => {
    fetchData();
  };

  const handleClearFilters = () => {
    setFromDate('');
    setToDate('');
    setCategory('all');
    setStatus('all');
  };

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading report...</p>
        </div>
      </div>
    );
  }

  if (error && !stats) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <AlertCircle className="h-12 w-12 text-destructive" />
          <p className="text-lg font-medium">{error}</p>
          <Button onClick={fetchData} variant="outline">
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Certificate Reports"
        description="View certificate statistics and reports"
        actions={[
          {
            label: 'Back to Certificates',
            icon: FileText,
            variant: 'outline',
            href: '/certificates',
          },
        ]}
      />

      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-5 stagger-animation">
        <StatCard title="Total" value={stats?.summary.total || 0} icon={FileText} />
        <StatCard
          title="Pending"
          value={stats?.summary.pending || 0}
          icon={Clock}
          variant="warning"
        />
        <StatCard
          title="Approved"
          value={stats?.summary.approved || 0}
          icon={CheckCircle}
          variant="primary"
        />
        <StatCard
          title="Rejected"
          value={stats?.summary.rejected || 0}
          icon={XCircle}
          variant="destructive"
        />
        <StatCard
          title="Issued"
          value={stats?.summary.issued || 0}
          icon={Download}
          variant="success"
        />
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-5">
            <div className="space-y-2">
              <Label>From Date</Label>
              <DatePicker value={fromDate} onChange={(iso) => setFromDate(iso)} />
            </div>
            <div className="space-y-2">
              <Label>To Date</Label>
              <DatePicker value={toDate} onChange={(iso) => setToDate(iso)} />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="student">Student</SelectItem>
                  <SelectItem value="staff">Staff</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                  <SelectItem value="issued">Issued</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end gap-2">
              <Button onClick={handleFilter} className="flex-1">
                Apply
              </Button>
              <Button variant="outline" onClick={handleClearFilters}>
                Clear
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        {/* By Type */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              By Certificate Type
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats?.byType && stats.byType.length > 0 ? (
              <div className="space-y-3">
                {stats.byType.map((item) => (
                  <div
                    key={item.typeId}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                  >
                    <span className="font-medium">{item.typeName}</span>
                    <Badge variant="secondary">{item.count}</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-4">No data available</p>
            )}
          </CardContent>
        </Card>

        {/* By Category */}
        <Card>
          <CardHeader>
            <CardTitle>By Category</CardTitle>
          </CardHeader>
          <CardContent>
            {stats?.byCategory && Object.keys(stats.byCategory).length > 0 ? (
              <div className="space-y-3">
                {Object.entries(stats.byCategory).map(([cat, count]) => (
                  <div
                    key={cat}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                  >
                    <span className="font-medium capitalize">{cat}</span>
                    <Badge variant="secondary">{count}</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-4">No data available</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Issued */}
      <Card>
        <CardHeader>
          <CardTitle>Recently Issued</CardTitle>
        </CardHeader>
        <CardContent>
          {stats?.recentIssued && stats.recentIssued.length > 0 ? (
            <div className="space-y-2">
              {stats.recentIssued.map((req) => (
                <div
                  key={req._id}
                  className="flex items-center justify-between p-3 rounded-lg border"
                >
                  <div>
                    <p className="font-medium">{req.certificateNumber}</p>
                    <p className="text-sm text-muted-foreground">
                      {req.certificateTypeName} - {req.category}
                    </p>
                  </div>
                  <div className="text-right">
                    <Badge variant="secondary" className={statusColors[req.status]}>
                      {req.status}
                    </Badge>
                    <p className="text-xs text-muted-foreground mt-1">
                      {req.issuedAt
                        ? new Date(req.issuedAt).toLocaleDateString('en-IN')
                        : new Date(req.createdAt).toLocaleDateString('en-IN')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-4">
              No recently issued certificates
            </p>
          )}
        </CardContent>
      </Card>

      {/* Daily Trend */}
      {report?.dailyTrend && report.dailyTrend.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Daily Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-1 items-end h-32">
              {report.dailyTrend.slice(-30).map((day) => {
                const maxCount = Math.max(...report.dailyTrend.map((d) => d.count));
                const height = maxCount > 0 ? (day.count / maxCount) * 100 : 0;
                return (
                  <div
                    key={day.date}
                    className="flex-1 bg-primary/20 hover:bg-primary/40 rounded-t transition-colors"
                    style={{ height: `${Math.max(height, 4)}%` }}
                    title={`${day.date}: ${day.count}`}
                  />
                );
              })}
            </div>
            <div className="flex justify-between mt-2 text-xs text-muted-foreground">
              <span>{report.dailyTrend[0]?.date}</span>
              <span>{report.dailyTrend[report.dailyTrend.length - 1]?.date}</span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
