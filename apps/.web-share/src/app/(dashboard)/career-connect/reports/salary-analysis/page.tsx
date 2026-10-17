'use client';

import { useQuery } from '@tanstack/react-query';
import { careerConnectApi } from '@/lib/api';
import { usePermissions } from '@/hooks/usePermissions';
import { formatCurrency } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { IndianRupee, ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface SalaryDistribution {
  range: string;
  count: number;
  avgCTC: number;
}

interface YearOverYear {
  year: number;
  count: number;
  avgCTC: number;
  highestCTC: number;
  medianCTC: number;
}

interface SalaryAnalysis {
  salaryDistribution: SalaryDistribution[];
  percentiles: {
    p25: number;
    p50: number;
    p75: number;
    p90: number;
  };
  yearOverYear: YearOverYear[];
}

export default function SalaryAnalysisPage() {
  const router = useRouter();
  const { hasPermission } = usePermissions();
  const canView = hasPermission('careerConnect.reports', 'view');

  const { data, isLoading } = useQuery({
    queryKey: ['career-connect-report', 'salary-analysis'],
    queryFn: () => careerConnectApi.getSalaryAnalysisReport(),
    enabled: canView,
  });

  const report: SalaryAnalysis | null = data?.data ?? null;

  if (!canView) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <IndianRupee className="mx-auto h-12 w-12 text-muted-foreground/50" />
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
          <h1 className="text-2xl font-bold tracking-tight">Salary Analysis</h1>
          <p className="text-muted-foreground">
            CTC distribution, percentiles, and year-over-year comparison
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-6 lg:grid-cols-2">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-5 w-32" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-40 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : !report ? (
        <div className="text-center py-12">
          <IndianRupee className="mx-auto h-12 w-12 text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-medium">No data available</h3>
          <p className="text-muted-foreground">
            Salary data will appear here once accepted offers exist.
          </p>
        </div>
      ) : (
        <>
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Salary Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                {report.salaryDistribution.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No distribution data
                  </p>
                ) : (
                  <div className="space-y-3">
                    {report.salaryDistribution.map((bucket) => {
                      const maxCount = Math.max(
                        ...report.salaryDistribution.map((b) => b.count),
                        1
                      );
                      const widthPercent = (bucket.count / maxCount) * 100;
                      return (
                        <div key={bucket.range} className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-medium">{bucket.range}</span>
                            <span className="text-muted-foreground">
                              {bucket.count} offer{bucket.count !== 1 ? 's' : ''}
                            </span>
                          </div>
                          <div className="h-2 rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full rounded-full bg-primary transition-all"
                              style={{ width: `${widthPercent}%` }}
                            />
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Avg: {formatCurrency(bucket.avgCTC)}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">CTC Percentiles</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[
                    {
                      label: '25th Percentile',
                      value: report.percentiles.p25,
                      color: 'bg-blue-100 text-blue-800',
                    },
                    {
                      label: '50th Percentile (Median)',
                      value: report.percentiles.p50,
                      color: 'bg-green-100 text-green-800',
                    },
                    {
                      label: '75th Percentile',
                      value: report.percentiles.p75,
                      color: 'bg-amber-100 text-amber-800',
                    },
                    {
                      label: '90th Percentile',
                      value: report.percentiles.p90,
                      color: 'bg-purple-100 text-purple-800',
                    },
                  ].map((p) => (
                    <div
                      key={p.label}
                      className="flex items-center justify-between p-3 rounded-lg border"
                    >
                      <span className="text-sm font-medium">{p.label}</span>
                      <span
                        className={`text-sm font-semibold px-2.5 py-0.5 rounded-full ${p.color}`}
                      >
                        {formatCurrency(p.value)}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Year-over-Year Comparison</CardTitle>
            </CardHeader>
            <CardContent>
              {report.yearOverYear.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No year-over-year data available
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Year</TableHead>
                      <TableHead className="text-right">Placements</TableHead>
                      <TableHead className="text-right">Avg CTC</TableHead>
                      <TableHead className="text-right">Median CTC</TableHead>
                      <TableHead className="text-right">Highest CTC</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.yearOverYear.map((year) => (
                      <TableRow key={year.year}>
                        <TableCell className="font-medium">{year.year}</TableCell>
                        <TableCell className="text-right">{year.count}</TableCell>
                        <TableCell className="text-right">{formatCurrency(year.avgCTC)}</TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(year.medianCTC)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(year.highestCTC)}
                        </TableCell>
                      </TableRow>
                    ))}
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
