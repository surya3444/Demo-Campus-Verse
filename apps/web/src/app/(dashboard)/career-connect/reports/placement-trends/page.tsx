'use client';

import { useQuery } from '@tanstack/react-query';
import { PageTitle } from '@/components/connect/kit';
import { careerConnectApi } from '@/lib/api';
import { usePermissions } from '@/hooks/usePermissions';
import { formatCurrency } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TrendingUp } from 'lucide-react';

interface MonthlyTrend {
  month: string;
  count: number;
  avgCTC: number;
  highestCTC: number;
}

function formatMonth(monthStr: string): string {
  const [year, month] = monthStr.split('-');
  const date = new Date(parseInt(year), parseInt(month) - 1);
  return date.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
}

export default function PlacementTrendsPage() {
  const { hasPermission } = usePermissions();
  const canView = hasPermission('careerConnect.reports', 'view');

  const { data, isLoading } = useQuery({
    queryKey: ['career-connect-report', 'placement-trends'],
    queryFn: () => careerConnectApi.getPlacementTrendsReport(),
    enabled: canView,
  });

  const trends: MonthlyTrend[] = data?.data ?? [];

  if (!canView) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <TrendingUp className="mx-auto h-12 w-12 text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-medium">Access Denied</h3>
          <p className="text-muted-foreground">You do not have permission to view this report.</p>
        </div>
      </div>
    );
  }

  const totalPlacements = trends.reduce((sum, t) => sum + t.count, 0);
  const overallAvgCTC =
    trends.length > 0
      ? Math.round(
          (trends.reduce((sum, t) => sum + t.avgCTC * t.count, 0) / Math.max(totalPlacements, 1)) *
            100
        ) / 100
      : 0;
  const peakMonth =
    trends.length > 0
      ? trends.reduce((max, t) => (t.count > max.count ? t : max), trends[0])
      : null;

  return (
    <div className="space-y-6">
      <PageTitle
        crumbs={[{ label: "Reports", href: "/career-connect/reports" }, { label: "Placement trends" }]}
        title="Placement trends"
        description="Monthly placement activity over the last 12 months"
      />

      {isLoading ? (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            {[1, 2, 3].map((i) => (
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
          <Card>
            <CardContent className="pt-6">
              <Skeleton className="h-60 w-full" />
            </CardContent>
          </Card>
        </div>
      ) : trends.length === 0 ? (
        <div className="text-center py-12">
          <TrendingUp className="mx-auto h-12 w-12 text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-medium">No data available</h3>
          <p className="text-muted-foreground">
            Placement trends will appear here once accepted offers exist.
          </p>
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Placements (12m)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalPlacements}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Weighted Avg CTC
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(overallAvgCTC)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Peak Month
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {peakMonth ? formatMonth(peakMonth.month) : '-'}
                </div>
                {peakMonth && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {peakMonth.count} placement{peakMonth.count !== 1 ? 's' : ''}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Monthly Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Month</TableHead>
                    <TableHead className="text-right">Placements</TableHead>
                    <TableHead className="text-right">Avg CTC</TableHead>
                    <TableHead className="text-right">Highest CTC</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {trends.map((trend) => (
                    <TableRow key={trend.month}>
                      <TableCell className="font-medium">{formatMonth(trend.month)}</TableCell>
                      <TableCell className="text-right">{trend.count}</TableCell>
                      <TableCell className="text-right">{formatCurrency(trend.avgCTC)}</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(trend.highestCTC)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
