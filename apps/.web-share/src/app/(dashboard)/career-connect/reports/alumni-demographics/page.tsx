'use client';

import { useQuery } from '@tanstack/react-query';
import { careerConnectApi } from '@/lib/api';
import { usePermissions } from '@/hooks/usePermissions';
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
import { Users, ArrowLeft, CheckCircle2, Handshake } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface CompanyEntry {
  company: string;
  count: number;
}

interface RoleEntry {
  role: string;
  count: number;
}

interface LocationEntry {
  location: string;
  count: number;
}

interface GradYearEntry {
  year: number;
  count: number;
}

interface AlumniDemographics {
  totalAlumni: number;
  verifiedCount: number;
  topCompanies: CompanyEntry[];
  topRoles: RoleEntry[];
  locationDistribution: LocationEntry[];
  graduationYearDistribution: GradYearEntry[];
  mentorsAvailable: number;
}

export default function AlumniDemographicsPage() {
  const router = useRouter();
  const { hasPermission } = usePermissions();
  const canView = hasPermission('careerConnect.reports', 'view');

  const { data, isLoading } = useQuery({
    queryKey: ['career-connect-report', 'alumni-demographics'],
    queryFn: () => careerConnectApi.getAlumniDemographicsReport(),
    enabled: canView,
  });

  const report: AlumniDemographics | null = data?.data ?? null;

  if (!canView) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <Users className="mx-auto h-12 w-12 text-muted-foreground/50" />
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
          <h1 className="text-2xl font-bold tracking-tight">Alumni Demographics</h1>
          <p className="text-muted-foreground">
            Alumni distribution by company, role, location, and graduation year
          </p>
        </div>
      </div>

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
          <div className="grid gap-6 lg:grid-cols-2">
            {[1, 2].map((i) => (
              <Card key={i}>
                <CardContent className="pt-6">
                  <Skeleton className="h-40 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ) : !report ? (
        <div className="text-center py-12">
          <Users className="mx-auto h-12 w-12 text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-medium">No data available</h3>
          <p className="text-muted-foreground">
            Alumni data will appear here once alumni profiles are created.
          </p>
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Alumni
                </CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{report.totalAlumni}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Verified Alumni
                </CardTitle>
                <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{report.verifiedCount}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {report.totalAlumni > 0
                    ? Math.round((report.verifiedCount / report.totalAlumni) * 100)
                    : 0}
                  % verified
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Mentors Available
                </CardTitle>
                <Handshake className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{report.mentorsAvailable}</div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Top Companies</CardTitle>
              </CardHeader>
              <CardContent>
                {report.topCompanies.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No data</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>#</TableHead>
                        <TableHead>Company</TableHead>
                        <TableHead className="text-right">Alumni</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {report.topCompanies.map((company, idx) => (
                        <TableRow key={company.company}>
                          <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                          <TableCell className="font-medium">{company.company}</TableCell>
                          <TableCell className="text-right">{company.count}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Top Roles</CardTitle>
              </CardHeader>
              <CardContent>
                {report.topRoles.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No data</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>#</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead className="text-right">Alumni</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {report.topRoles.map((role, idx) => (
                        <TableRow key={role.role}>
                          <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                          <TableCell className="font-medium">{role.role}</TableCell>
                          <TableCell className="text-right">{role.count}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Top Locations</CardTitle>
              </CardHeader>
              <CardContent>
                {report.locationDistribution.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No data</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>#</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead className="text-right">Alumni</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {report.locationDistribution.map((loc, idx) => (
                        <TableRow key={loc.location}>
                          <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                          <TableCell className="font-medium">{loc.location}</TableCell>
                          <TableCell className="text-right">{loc.count}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Graduation Year Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                {report.graduationYearDistribution.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No data</p>
                ) : (
                  <div className="space-y-2">
                    {report.graduationYearDistribution.map((entry) => {
                      const maxCount = Math.max(
                        ...report.graduationYearDistribution.map((e) => e.count),
                        1
                      );
                      const widthPercent = (entry.count / maxCount) * 100;
                      return (
                        <div key={entry.year} className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-medium">{entry.year}</span>
                            <span className="text-muted-foreground">{entry.count} alumni</span>
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
