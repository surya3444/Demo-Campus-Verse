'use client';

import { useQuery } from '@tanstack/react-query';
import { healthApi } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import {} from '@/components/ui/table';
import {
  Heart,
  Stethoscope,
  Syringe,
  Activity,
  AlertTriangle,
  CheckCircle,
  Download,
  FileText,
} from 'lucide-react';
import Link from 'next/link';

export default function HealthReportsPage() {
  const { data: dashboard, isLoading: dashboardLoading } = useQuery({
    queryKey: ['health-reports-dashboard'],
    queryFn: () => healthApi.getDashboard(),
  });

  const { data: compliance, isLoading: complianceLoading } = useQuery({
    queryKey: ['health-reports-compliance'],
    queryFn: () => healthApi.getComplianceReport(),
  });

  const { data: checkupStats } = useQuery({
    queryKey: ['health-checkup-stats'],
    queryFn: () => healthApi.getCheckupStats(),
  });

  const { data: vaccinationStats } = useQuery({
    queryKey: ['health-vaccination-stats'],
    queryFn: () => healthApi.getVaccinationStats(),
  });

  const { data: visitStats } = useQuery({
    queryKey: ['health-visit-stats'],
    queryFn: () => healthApi.getVisitStats(),
  });

  if (dashboardLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  const stats = dashboard?.data || {};
  // API shape: checkupCompliance {totalRecords, withRecentCheckup, complianceRate}, vaccinationCompliance [{total, completed, overdue}]
  const raw = compliance?.data || {};
  const vacc: Array<{ total: number; completed: number; overdue: number }> = Array.isArray(
    raw.vaccinationCompliance
  )
    ? raw.vaccinationCompliance
    : [];
  const vaccTotal = vacc.reduce((n, v) => n + (v.total || 0), 0);
  const vaccDone = vacc.reduce((n, v) => n + (v.completed || 0), 0);
  const checkupTotal = raw.checkupCompliance?.totalRecords || 0;
  const checkupDone = raw.checkupCompliance?.withRecentCheckup || 0;
  const complianceData = {
    checkupCompliance: raw.checkupCompliance?.complianceRate || 0,
    checkupCompletedCount: checkupDone,
    checkupTotalCount: checkupTotal,
    overdueCheckups: checkupTotal - checkupDone,
    vaccinationCompliance: vaccTotal > 0 ? (vaccDone / vaccTotal) * 100 : 0,
    vaccinationCompletedCount: vaccDone,
    vaccinationTotalCount: vaccTotal,
    overdueVaccinations: vacc.reduce((n, v) => n + (v.overdue || 0), 0),
  };
  const allClear = complianceData.overdueVaccinations === 0 && complianceData.overdueCheckups === 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Health Reports</h1>
          <p className="text-muted-foreground">
            Analytics and compliance reports for health module
          </p>
        </div>
        <Button variant="outline">
          <Download className="mr-2 h-4 w-4" />
          Export Report
        </Button>
      </div>

      {/* Overview Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Health Records</CardTitle>
            <Heart className="h-4 w-4 text-rose-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalRecords || 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats.studentRecords || 0} students, {stats.staffRecords || 0} staff
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Checkups Completed</CardTitle>
            <Stethoscope className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{checkupStats?.data?.completed || 0}</div>
            <p className="text-xs text-muted-foreground">This academic year</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vaccination Rate</CardTitle>
            <Syringe className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {vaccinationStats?.data?.complianceRate
                ? `${Math.round(vaccinationStats.data.complianceRate)}%`
                : '-'}
            </div>
            <p className="text-xs text-muted-foreground">Overall compliance</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monthly Visits</CardTitle>
            <Activity className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{visitStats?.data?.thisMonth || 0}</div>
            <p className="text-xs text-muted-foreground">Medical room visits</p>
          </CardContent>
        </Card>
      </div>

      {/* Compliance Report */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Compliance Overview</CardTitle>
              <CardDescription>Health checkup and vaccination compliance rates</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {complianceLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : (
            <div className="space-y-6">
              {/* Checkup Compliance */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Stethoscope className="h-4 w-4 text-blue-500" />
                    <span className="font-medium">Annual Checkup Compliance</span>
                  </div>
                  <span className="text-sm font-medium">
                    {`${Math.round(complianceData.checkupCompliance)}%`}
                  </span>
                </div>
                <Progress value={complianceData.checkupCompliance} className="h-2" />
                <p className="text-xs text-muted-foreground">
                  {complianceData.checkupCompletedCount || 0} of{' '}
                  {complianceData.checkupTotalCount || 0} students/staff have completed annual
                  checkups
                </p>
              </div>

              {/* Vaccination Compliance */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Syringe className="h-4 w-4 text-amber-500" />
                    <span className="font-medium">Vaccination Compliance</span>
                  </div>
                  <span className="text-sm font-medium">
                    {`${Math.round(complianceData.vaccinationCompliance)}%`}
                  </span>
                </div>
                <Progress value={complianceData.vaccinationCompliance} className="h-2" />
                <p className="text-xs text-muted-foreground">
                  {complianceData.vaccinationCompletedCount || 0} of{' '}
                  {complianceData.vaccinationTotalCount || 0} required vaccinations completed
                </p>
              </div>

              {/* Alerts */}
              {allClear ? (
                <div className="mt-6 p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800 flex items-center gap-2 text-green-700 dark:text-green-400">
                  <CheckCircle className="h-5 w-5" />
                  <span className="font-medium">
                    All health compliance requirements are up to date
                  </span>
                </div>
              ) : (
                <div className="mt-6 p-4 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800">
                  <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                    <AlertTriangle className="h-5 w-5" />
                    <span className="font-medium">Attention Required</span>
                  </div>
                  <ul className="mt-2 space-y-1 text-sm text-amber-600 dark:text-amber-500">
                    {complianceData.overdueVaccinations > 0 && (
                      <li>
                        {complianceData.overdueVaccinations} overdue vaccinations need attention
                      </li>
                    )}
                    {complianceData.overdueCheckups > 0 && (
                      <li>
                        {complianceData.overdueCheckups} students/staff are due for health checkups
                      </li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Reports */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Visit Summary */}
        <Card>
          <CardHeader>
            <CardTitle>Medical Visit Summary</CardTitle>
            <CardDescription>Breakdown by visit type this month</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                {
                  type: 'Illness',
                  count: visitStats?.data?.byType?.illness || 0,
                  color: 'bg-blue-500',
                },
                {
                  type: 'Injury',
                  count: visitStats?.data?.byType?.injury || 0,
                  color: 'bg-amber-500',
                },
                {
                  type: 'Emergency',
                  count: visitStats?.data?.byType?.emergency || 0,
                  color: 'bg-red-500',
                },
                {
                  type: 'Routine',
                  count: visitStats?.data?.byType?.routine || 0,
                  color: 'bg-green-500',
                },
                {
                  type: 'Other',
                  count: visitStats?.data?.byType?.other || 0,
                  color: 'bg-gray-500',
                },
              ].map((item) => (
                <div key={item.type} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${item.color}`} />
                    <span className="text-sm">{item.type}</span>
                  </div>
                  <span className="font-medium">{item.count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Visit Outcomes */}
        <Card>
          <CardHeader>
            <CardTitle>Visit Outcomes</CardTitle>
            <CardDescription>How visits were resolved this month</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                {
                  outcome: 'Returned to Class',
                  count: visitStats?.data?.byOutcome?.returned_to_class || 0,
                  icon: CheckCircle,
                  color: 'text-green-500',
                },
                {
                  outcome: 'Sent Home',
                  count: visitStats?.data?.byOutcome?.sent_home || 0,
                  icon: Activity,
                  color: 'text-amber-500',
                },
                {
                  outcome: 'Referred',
                  count: visitStats?.data?.byOutcome?.referred || 0,
                  icon: FileText,
                  color: 'text-blue-500',
                },
                {
                  outcome: 'Under Observation',
                  count: visitStats?.data?.byOutcome?.under_observation || 0,
                  icon: AlertTriangle,
                  color: 'text-purple-500',
                },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.outcome} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Icon className={`h-4 w-4 ${item.color}`} />
                      <span className="text-sm">{item.outcome}</span>
                    </div>
                    <span className="font-medium">{item.count}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Report Links */}
      <Card>
        <CardHeader>
          <CardTitle>Available Reports</CardTitle>
          <CardDescription>Generate detailed reports</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <Button variant="outline" className="h-auto flex-col py-4" asChild>
              <Link href="/health/reports/checkups">
                <Stethoscope className="h-6 w-6 mb-2 text-blue-500" />
                <span className="font-medium">Checkup Report</span>
                <span className="text-xs text-muted-foreground mt-1">
                  Detailed health screening data
                </span>
              </Link>
            </Button>
            <Button variant="outline" className="h-auto flex-col py-4" asChild>
              <Link href="/health/reports/vaccinations">
                <Syringe className="h-6 w-6 mb-2 text-amber-500" />
                <span className="font-medium">Vaccination Report</span>
                <span className="text-xs text-muted-foreground mt-1">
                  Immunization compliance data
                </span>
              </Link>
            </Button>
            <Button variant="outline" className="h-auto flex-col py-4" asChild>
              <Link href="/health/reports/visits">
                <Activity className="h-6 w-6 mb-2 text-green-500" />
                <span className="font-medium">Visit Report</span>
                <span className="text-xs text-muted-foreground mt-1">Medical visit analytics</span>
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
