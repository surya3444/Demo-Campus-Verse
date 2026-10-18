'use client';

import { useQuery } from '@tanstack/react-query';
import { healthApi } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { Heart, Stethoscope, Syringe, Activity, ArrowRight } from 'lucide-react';

export default function HealthDashboardPage() {
  const { data: dashboard, isLoading } = useQuery({
    queryKey: ['health-dashboard'],
    queryFn: () => healthApi.getDashboard(),
  });

  const { data: todayVisits } = useQuery({
    queryKey: ['health-today-visits'],
    queryFn: () => healthApi.getTodayVisits(),
  });

  const { data: dueVaccinations } = useQuery({
    queryKey: ['health-due-vaccinations'],
    queryFn: () => healthApi.getDueVaccinations(30),
  });

  if (isLoading) {
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

  // The API groups its numbers by area (recordStats, checkupStats, ...) and
  // today's visits into in-progress and completed.
  const d = dashboard?.data ?? {};
  const visitsToday = [
    ...(todayVisits?.data?.inProgress ?? []),
    ...(todayVisits?.data?.completed ?? []),
  ];
  const stats = {
    totalRecords: d.recordStats?.totalRecords ?? 0,
    studentRecords: d.recordStats?.studentRecords ?? 0,
    staffRecords: d.recordStats?.staffRecords ?? 0,
    checkupsThisMonth: d.checkupStats?.totalCheckups ?? 0,
    overdueVaccinations: d.vaccinationStats?.overdueVaccinations ?? 0,
    todayVisits: visitsToday.length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Health Connect</h1>
          <p className="text-muted-foreground">
            Overview of health records, checkups, and medical visits
          </p>
        </div>
        <Button asChild>
          <Link href="/health/records">
            View All Records <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Health Records</CardTitle>
            <Heart className="h-4 w-4 text-rose-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalRecords}</div>
            <p className="text-xs text-muted-foreground">
              {stats.studentRecords} students, {stats.staffRecords} staff
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Health Checkups</CardTitle>
            <Stethoscope className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.checkupsThisMonth}</div>
            <p className="text-xs text-muted-foreground">Screenings scheduled and done</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overdue Vaccinations</CardTitle>
            <Syringe className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.overdueVaccinations}</div>
            <p className="text-xs text-muted-foreground">Requires immediate attention</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today&apos;s Visits</CardTitle>
            <Activity className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.todayVisits}</div>
            <p className="text-xs text-muted-foreground">Medical room visits today</p>
          </CardContent>
        </Card>
      </div>

      {/* Content Grid */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Today's Medical Visits */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Today&apos;s Medical Visits</CardTitle>
                <CardDescription>Recent visits to the medical room</CardDescription>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link href="/health/visits?today=true">View All</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {visitsToday.length > 0 ? (
                visitsToday
                  .slice(0, 5)
                  .map(
                    (visit: {
                      _id: string;
                      personName: string;
                      personType: string;
                      chiefComplaint: string;
                      status: string;
                      arrivalTime: string;
                    }) => (
                      <div
                        key={visit._id}
                        className="flex items-center justify-between border-b pb-3 last:border-0"
                      >
                        <div className="space-y-1">
                          <p className="text-sm font-medium">{visit.personName}</p>
                          <p className="text-xs text-muted-foreground">{visit.chiefComplaint}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={
                              visit.status === 'completed'
                                ? 'default'
                                : visit.status === 'in_progress'
                                  ? 'secondary'
                                  : 'outline'
                            }
                          >
                            {visit.status.replace('_', ' ')}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {new Date(visit.arrivalTime).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                      </div>
                    )
                  )
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No visits recorded today
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Upcoming Vaccinations */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Due Vaccinations</CardTitle>
                <CardDescription>Vaccinations due in the next 30 days</CardDescription>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link href="/health/vaccinations/due">View All</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {dueVaccinations?.data?.length > 0 ? (
                dueVaccinations.data
                  .slice(0, 5)
                  .map(
                    (vac: {
                      _id: string;
                      personName: string;
                      vaccineName: string;
                      scheduledDate: string;
                      status: string;
                    }) => (
                      <div
                        key={vac._id}
                        className="flex items-center justify-between border-b pb-3 last:border-0"
                      >
                        <div className="space-y-1">
                          <p className="text-sm font-medium">{vac.personName}</p>
                          <p className="text-xs text-muted-foreground">{vac.vaccineName}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={vac.status === 'overdue' ? 'destructive' : 'outline'}>
                            {vac.status}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {new Date(vac.scheduledDate).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    )
                  )
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No vaccinations due in the next 30 days
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Common health module tasks</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <Button variant="outline" className="h-auto flex-col py-4" asChild>
              <Link href="/health/visits?action=new">
                <Activity className="h-6 w-6 mb-2 text-green-500" />
                <span>Log Medical Visit</span>
              </Link>
            </Button>
            <Button variant="outline" className="h-auto flex-col py-4" asChild>
              <Link href="/health/checkups?action=new">
                <Stethoscope className="h-6 w-6 mb-2 text-blue-500" />
                <span>Schedule Checkup</span>
              </Link>
            </Button>
            <Button variant="outline" className="h-auto flex-col py-4" asChild>
              <Link href="/health/vaccinations?action=new">
                <Syringe className="h-6 w-6 mb-2 text-amber-500" />
                <span>Record Vaccination</span>
              </Link>
            </Button>
            <Button variant="outline" className="h-auto flex-col py-4" asChild>
              <Link href="/health/records?action=new">
                <Heart className="h-6 w-6 mb-2 text-rose-500" />
                <span>Create Health Record</span>
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
