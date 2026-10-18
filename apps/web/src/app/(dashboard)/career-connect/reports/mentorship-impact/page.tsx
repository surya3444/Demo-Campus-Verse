'use client';

import { useQuery } from '@tanstack/react-query';
import { PageTitle } from '@/components/connect/kit';
import { careerConnectApi } from '@/lib/api';
import { usePermissions } from '@/hooks/usePermissions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Handshake, Users, Calendar, Target } from 'lucide-react';

interface GuidanceArea {
  area: string;
  count: number;
}

interface MentorshipImpact {
  programsByStatus: Record<string, number>;
  totalSessions: number;
  averageSessionsPerProgram: number;
  topGuidanceAreas: GuidanceArea[];
  activeMentorsCount: number;
  activeMenteesCount: number;
}

const statusLabels: Record<string, string> = {
  active: 'Active',
  completed: 'Completed',
  paused: 'Paused',
  cancelled: 'Cancelled',
};

const statusColors: Record<string, string> = {
  active: 'bg-green-100 text-green-800',
  completed: 'bg-blue-100 text-blue-800',
  paused: 'bg-yellow-100 text-yellow-800',
  cancelled: 'bg-red-100 text-red-800',
};

export default function MentorshipImpactPage() {
  const { hasPermission } = usePermissions();
  const canView = hasPermission('careerConnect.reports', 'view');

  const { data, isLoading } = useQuery({
    queryKey: ['career-connect-report', 'mentorship-impact'],
    queryFn: () => careerConnectApi.getMentorshipImpactReport(),
    enabled: canView,
  });

  const report: MentorshipImpact | null = data?.data ?? null;

  if (!canView) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <Handshake className="mx-auto h-12 w-12 text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-medium">Access Denied</h3>
          <p className="text-muted-foreground">You do not have permission to view this report.</p>
        </div>
      </div>
    );
  }

  const totalPrograms = report
    ? Object.values(report.programsByStatus).reduce((sum, count) => sum + count, 0)
    : 0;

  return (
    <div className="space-y-6">
      <PageTitle
        crumbs={[{ label: "Reports", href: "/career-connect/reports" }, { label: "Mentorship impact" }]}
        title="Mentorship impact"
        description="Program statistics, session counts, and guidance areas"
      />

      {isLoading ? (
        <div className="space-y-4">
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
        </div>
      ) : !report ? (
        <div className="text-center py-12">
          <Handshake className="mx-auto h-12 w-12 text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-medium">No data available</h3>
          <p className="text-muted-foreground">
            Mentorship data will appear here once programs are created.
          </p>
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Programs
                </CardTitle>
                <Target className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalPrograms}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Sessions
                </CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{report.totalSessions}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Avg {report.averageSessionsPerProgram} per program
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Active Mentors
                </CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{report.activeMentorsCount}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Active Mentees
                </CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{report.activeMenteesCount}</div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Programs by Status</CardTitle>
              </CardHeader>
              <CardContent>
                {Object.keys(report.programsByStatus).length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No program data</p>
                ) : (
                  <div className="space-y-3">
                    {Object.entries(report.programsByStatus).map(([status, count]) => {
                      const maxCount = Math.max(...Object.values(report.programsByStatus), 1);
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
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Top Areas of Guidance</CardTitle>
              </CardHeader>
              <CardContent>
                {report.topGuidanceAreas.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No guidance area data
                  </p>
                ) : (
                  <div className="space-y-2">
                    {report.topGuidanceAreas.map((area, idx) => {
                      const maxCount = Math.max(...report.topGuidanceAreas.map((a) => a.count), 1);
                      const widthPercent = (area.count / maxCount) * 100;
                      return (
                        <div key={area.area} className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground w-5">{idx + 1}.</span>
                              <span className="font-medium">{area.area}</span>
                            </div>
                            <span className="text-muted-foreground">
                              {area.count} program{area.count !== 1 ? 's' : ''}
                            </span>
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
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
