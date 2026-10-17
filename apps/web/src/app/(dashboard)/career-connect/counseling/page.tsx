'use client';

import { useQuery } from '@tanstack/react-query';
import { careerConnectApi } from '@/lib/api';
import { usePermissions } from '@/hooks/usePermissions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Heart, ClipboardList, BookOpen, ArrowLeft, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function CounselingDashboardPage() {
  const router = useRouter();
  const { hasPermission } = usePermissions();

  const { data: sessionsData, isLoading: sessionsLoading } = useQuery({
    queryKey: ['counseling-sessions', { page: 1, limit: 1 }],
    queryFn: () => careerConnectApi.getCounselingSessions({ page: 1, limit: 1 }),
    enabled: hasPermission('careerConnect.counseling', 'view'),
  });

  const { data: assessmentsData, isLoading: assessmentsLoading } = useQuery({
    queryKey: ['assessments', { page: 1, limit: 1 }],
    queryFn: () => careerConnectApi.getAssessments({ page: 1, limit: 1 }),
    enabled: hasPermission('careerConnect.counseling', 'view'),
  });

  const { data: resourcesData, isLoading: resourcesLoading } = useQuery({
    queryKey: ['resources', { page: 1, limit: 1 }],
    queryFn: () => careerConnectApi.getResources({ page: 1, limit: 1 }),
    enabled: hasPermission('careerConnect.counseling', 'view'),
  });

  const sessionsCount = sessionsData?.meta?.total ?? 0;
  const assessmentsCount = assessmentsData?.meta?.total ?? 0;
  const resourcesCount = resourcesData?.meta?.total ?? 0;

  const sections = [
    {
      title: 'Counseling Sessions',
      description:
        'Schedule and manage individual, group, and workshop counseling sessions with students',
      href: '/career-connect/counseling/sessions',
      icon: Heart,
      count: sessionsCount,
      loading: sessionsLoading,
      color: 'text-rose-600',
      bgColor: 'bg-rose-50',
    },
    {
      title: 'Assessments',
      description:
        'Conduct aptitude, interest, personality, and skill assessments for career guidance',
      href: '/career-connect/counseling/assessments',
      icon: ClipboardList,
      count: assessmentsCount,
      loading: assessmentsLoading,
      color: 'text-violet-600',
      bgColor: 'bg-violet-50',
    },
    {
      title: 'Resources',
      description: 'Manage career guidance articles, videos, documents, and reference materials',
      href: '/career-connect/counseling/resources',
      icon: BookOpen,
      count: resourcesCount,
      loading: resourcesLoading,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push('/career-connect')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Career Counseling</h1>
          <p className="text-muted-foreground">
            Manage counseling sessions, assessments, and career resources for students
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {sections.map((section) => (
          <Link key={section.href} href={section.href}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`rounded-lg ${section.bgColor} p-2.5`}>
                      <section.icon className={`h-5 w-5 ${section.color}`} />
                    </div>
                    <CardTitle className="text-base">{section.title}</CardTitle>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">{section.description}</p>
                <div className="pt-2 border-t">
                  {section.loading ? (
                    <Skeleton className="h-5 w-20" />
                  ) : (
                    <p className="text-sm font-medium">
                      {section.count} {section.count === 1 ? 'record' : 'records'}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
