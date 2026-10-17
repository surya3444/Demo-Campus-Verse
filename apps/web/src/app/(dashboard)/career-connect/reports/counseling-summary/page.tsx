'use client';

import { useQuery } from '@tanstack/react-query';
import { careerConnectApi } from '@/lib/api';
import { usePermissions } from '@/hooks/usePermissions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Heart, ArrowLeft, Users, CheckCircle2, XCircle, Calendar } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface SessionMonth {
  month: string;
  count: number;
  completed: number;
}

interface CounselingSummary {
  totalSessions: number;
  byStatus: Record<string, number>;
  byType: Record<string, number>;
  sessionsPerMonth: SessionMonth[];
  totalUniqueStudents: number;
}

const statusLabels: Record<string, string> = {
  scheduled: 'Scheduled',
  completed: 'Completed',
  cancelled: 'Cancelled',
  no_show: 'No Show',
};

const statusColors: Record<string, string> = {
  scheduled: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
  no_show: 'bg-yellow-100 text-yellow-800',
};

const typeLabels: Record<string, string> = {
  individual: 'Individual',
  group: 'Group',
  workshop: 'Workshop',
};

function formatMonth(monthStr: string): string {
  const [year, month] = monthStr.split('-');
  const date = new Date(parseInt(year), parseInt(month) - 1);
  return date.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
}

export default function CounselingSummaryPage() {
  const router = useRouter();
  const { hasPermission } = usePermissions();
  const canView = hasPermission('careerConnect.reports', 'view');

  const { data, isLoading } = useQuery({
    queryKey: ['career-connect-report', 'counseling-summary'],
    queryFn: () => careerConnectApi.getCounselingSummaryReport(),
    enabled: canView,
  });

  const report: CounselingSummary | null = data?.data ?? null;

  if (!canView) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <Heart className="mx-auto h-12 w-12 text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-medium">Access Denied</h3>
          <p className="text-muted-foreground">You do not have permission to view this report.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push('/career-connect/reports')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Counseling Summary</h1>
          <p className="text-muted-foreground">Session statistics, types, and monthly trends</p>
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-20" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : !report ? (
        <div className="text-center py-12">
          <Heart className="mx-auto h-12 w-12 text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-medium">No data available</h3>
          <p className="text-muted-foreground">
            Counseling data will appear here once sessions are created.
          </p>
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Sessions
                </CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{report.totalSessions}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Completed
                </CardTitle>
                <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{report.byStatus.completed || 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Cancelled / No Show
                </CardTitle>
                <XCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {(report.byStatus.cancelled || 0) + (report.byStatus.no_show || 0)}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Unique Students
                </CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{report.totalUniqueStudents}</div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Sessions by Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(report.byStatus).map(([status, count]) => {
                    const maxCount = Math.max(...Object.values(report.byStatus), 1);
                    const widthPercent = (count / maxCount) * 100;
                    return (
                      <div key={status} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <Badge variant="secondary" className={statusColors[status] || ''}>
                            {statusLabels[status] || status}
                          </Badge>
                          <span className="font-medium">{count}</span>
                        </div>
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full bg-primary transition-all"
                            style={{ width: `${widthPercent}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Sessions by Type</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(report.byType).map(([type, count]) => {
                    const maxCount = Math.max(...Object.values(report.byType), 1);
                    const widthPercent = (count / maxCount) * 100;
                    return (
                      <div key={type} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium">{typeLabels[type] || type}</span>
                          <span className="text-muted-foreground">{count}</span>
                        </div>
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full bg-primary transition-all"
                            style={{ width: `${widthPercent}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Monthly Trends</CardTitle>
            </CardHeader>
            <CardContent>
              {report.sessionsPerMonth.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No monthly data available
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Month</TableHead>
                      <TableHead className="text-right">Total Sessions</TableHead>
                      <TableHead className="text-right">Completed</TableHead>
                      <TableHead className="text-right">Completion Rate</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.sessionsPerMonth.map((m) => {
                      const completionRate =
                        m.count > 0 ? Math.round((m.completed / m.count) * 100) : 0;
                      return (
                        <TableRow key={m.month}>
                          <TableCell className="font-medium">{formatMonth(m.month)}</TableCell>
                          <TableCell className="text-right">{m.count}</TableCell>
                          <TableCell className="text-right">{m.completed}</TableCell>
                          <TableCell className="text-right">{completionRate}%</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
