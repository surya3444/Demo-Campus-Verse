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
import { ClipboardList, ArrowLeft, Users } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface AssessmentByType {
  assessmentType: string;
  count: number;
}

interface CareerPath {
  careerPath: string;
  count: number;
}

interface ScoreByType {
  assessmentType: string;
  avgScore: number;
  minScore: number;
  maxScore: number;
  count: number;
}

interface AssessmentAnalytics {
  totalAssessmentsByType: AssessmentByType[];
  topRecommendedCareers: CareerPath[];
  averageScoresByType: ScoreByType[];
  studentsAssessedCount: number;
}

const typeLabels: Record<string, string> = {
  aptitude: 'Aptitude',
  interest: 'Interest',
  personality: 'Personality',
  skill: 'Skill',
};

export default function AssessmentAnalyticsPage() {
  const router = useRouter();
  const { hasPermission } = usePermissions();
  const canView = hasPermission('careerConnect.reports', 'view');

  const { data, isLoading } = useQuery({
    queryKey: ['career-connect-report', 'assessment-analytics'],
    queryFn: () => careerConnectApi.getAssessmentAnalyticsReport(),
    enabled: canView,
  });

  const report: AssessmentAnalytics | null = data?.data ?? null;

  if (!canView) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <ClipboardList className="mx-auto h-12 w-12 text-muted-foreground/50" />
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
          <h1 className="text-2xl font-bold tracking-tight">Assessment Analytics</h1>
          <p className="text-muted-foreground">
            Assessment counts, scores, and recommended career paths
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
          <ClipboardList className="mx-auto h-12 w-12 text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-medium">No data available</h3>
          <p className="text-muted-foreground">
            Assessment data will appear here once assessments are created.
          </p>
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Students Assessed
                </CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{report.studentsAssessedCount}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Assessments
                </CardTitle>
                <ClipboardList className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {report.totalAssessmentsByType.reduce((sum, t) => sum + t.count, 0)}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Assessments by Type</CardTitle>
              </CardHeader>
              <CardContent>
                {report.totalAssessmentsByType.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No assessment data
                  </p>
                ) : (
                  <div className="space-y-3">
                    {report.totalAssessmentsByType.map((item) => {
                      const maxCount = Math.max(
                        ...report.totalAssessmentsByType.map((t) => t.count),
                        1
                      );
                      const widthPercent = (item.count / maxCount) * 100;
                      return (
                        <div key={item.assessmentType} className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-medium">
                              {typeLabels[item.assessmentType] || item.assessmentType}
                            </span>
                            <span className="text-muted-foreground">{item.count}</span>
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
                <CardTitle className="text-base">Top Recommended Careers</CardTitle>
              </CardHeader>
              <CardContent>
                {report.topRecommendedCareers.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No career recommendations yet
                  </p>
                ) : (
                  <div className="space-y-2">
                    {report.topRecommendedCareers.map((career, idx) => {
                      const total = report.topRecommendedCareers.reduce(
                        (sum, c) => sum + c.count,
                        0
                      );
                      const matchPercent = total > 0 ? Math.round((career.count / total) * 100) : 0;
                      return (
                        <div
                          key={career.careerPath}
                          className="flex items-center justify-between py-1.5 border-b last:border-b-0"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground w-5">{idx + 1}.</span>
                            <span className="text-sm font-medium">{career.careerPath}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="text-xs">
                              {matchPercent}%
                            </Badge>
                            <span className="text-xs text-muted-foreground">({career.count})</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Score Statistics by Type</CardTitle>
            </CardHeader>
            <CardContent>
              {report.averageScoresByType.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No score data available
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Assessment Type</TableHead>
                      <TableHead className="text-right">Count</TableHead>
                      <TableHead className="text-right">Avg Score</TableHead>
                      <TableHead className="text-right">Min Score</TableHead>
                      <TableHead className="text-right">Max Score</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.averageScoresByType.map((score) => (
                      <TableRow key={score.assessmentType}>
                        <TableCell className="font-medium">
                          {typeLabels[score.assessmentType] || score.assessmentType}
                        </TableCell>
                        <TableCell className="text-right">{score.count}</TableCell>
                        <TableCell className="text-right">{score.avgScore}</TableCell>
                        <TableCell className="text-right">{score.minScore}</TableCell>
                        <TableCell className="text-right">{score.maxScore}</TableCell>
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
