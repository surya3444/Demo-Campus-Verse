'use client';

import { useQuery } from '@tanstack/react-query';
import { careerConnectApi } from '@/lib/api';
import { usePermissions } from '@/hooks/usePermissions';
import { formatCurrency } from '@/lib/utils';
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
import { GraduationCap, ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface DepartmentReport {
  department: string;
  totalStudents: number;
  placedCount: number;
  placementPercentage: number;
  avgCTC: number;
}

function getPlacementBadgeColor(percentage: number): string {
  if (percentage >= 80) return 'bg-green-100 text-green-800';
  if (percentage >= 60) return 'bg-blue-100 text-blue-800';
  if (percentage >= 40) return 'bg-yellow-100 text-yellow-800';
  return 'bg-red-100 text-red-800';
}

export default function DepartmentWiseReportPage() {
  const router = useRouter();
  const { hasPermission } = usePermissions();
  const canView = hasPermission('careerConnect.reports', 'view');

  const { data, isLoading } = useQuery({
    queryKey: ['career-connect-report', 'department-wise'],
    queryFn: () => careerConnectApi.getDepartmentWiseReport(),
    enabled: canView,
  });

  const departments: DepartmentReport[] = data?.data ?? [];

  if (!canView) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <GraduationCap className="mx-auto h-12 w-12 text-muted-foreground/50" />
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
          <h1 className="text-2xl font-bold tracking-tight">Department-Wise Report</h1>
          <p className="text-muted-foreground">Placement rates and CTC across departments</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Departments ({departments.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : departments.length === 0 ? (
            <div className="text-center py-12">
              <GraduationCap className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-medium">No data available</h3>
              <p className="text-muted-foreground">
                Department-wise data will appear here once student profiles and placements exist.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Department</TableHead>
                  <TableHead className="text-right">Total Students</TableHead>
                  <TableHead className="text-right">Placed</TableHead>
                  <TableHead className="text-right">Placement %</TableHead>
                  <TableHead className="text-right">Avg CTC</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {departments.map((dept) => (
                  <TableRow key={dept.department}>
                    <TableCell className="font-medium">{dept.department}</TableCell>
                    <TableCell className="text-right">{dept.totalStudents}</TableCell>
                    <TableCell className="text-right">{dept.placedCount}</TableCell>
                    <TableCell className="text-right">
                      <Badge
                        variant="secondary"
                        className={getPlacementBadgeColor(dept.placementPercentage)}
                      >
                        {dept.placementPercentage}%
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(dept.avgCTC)}</TableCell>
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
