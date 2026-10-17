'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Target, Users } from 'lucide-react';
import { obeApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EditorialHeader } from '@/components/exams/EditorialHeader';
import { SectionPanel } from '@/components/exams/SectionPanel';
import { StatusBadge } from '@/components/exams/StatusBadge';
import type { OfferingDetail } from '@/components/obe/types';
import { OverviewTab } from './components/OverviewTab';
import { MarksTab } from './components/MarksTab';
import { AttainmentTab } from './components/AttainmentTab';
import { SurveyTab } from './components/SurveyTab';

const SURVEY_LABELS: Record<string, string> = {
  not_started: 'Survey not started',
  open: 'Survey open',
  closed: 'Survey closed',
};

export default function ObeOfferingPage() {
  const params = useParams();
  const id = params.id as string;

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['obe-offering', id],
    queryFn: () => obeApi.getOffering(id),
    enabled: !!id,
  });

  const offering: OfferingDetail | undefined = data?.data;

  if (isLoading) {
    return (
      <div className="space-y-8 pb-12">
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-[420px] rounded-2xl" />
      </div>
    );
  }

  if (isError || !offering) {
    return (
      <div className="space-y-8 pb-12">
        <SectionPanel>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Target className="mb-4 h-12 w-12 text-muted-foreground opacity-40" />
            <p className="text-lg font-medium">Offering not found</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {error instanceof Error ? error.message : 'It may have been deleted.'}
            </p>
            <Link href="/obe" className="mt-5">
              <Button variant="outline" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back to offerings
              </Button>
            </Link>
          </div>
        </SectionPanel>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      <EditorialHeader
        eyebrow={`OBE · ${offering.termName}`}
        meta={offering.subjectCode}
        icon={Target}
        title={offering.subjectName}
        description="Everything for this course run: the instruments it is assessed with, the marks behind them, the attainment they produce, and the exit survey."
        actions={
          <Link href="/obe">
            <Button variant="outline" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              All offerings
            </Button>
          </Link>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={offering.status} />
        <Badge variant="outline" className="gap-1">
          <Users className="h-3 w-3" />
          {offering.cohortSize} students
        </Badge>
        {offering.semesterNumber != null && (
          <Badge variant="outline">Semester {offering.semesterNumber}</Badge>
        )}
        <Badge variant="outline">
          {SURVEY_LABELS[offering.survey.status] ?? offering.survey.status}
        </Badge>
        {offering.targetLevel != null && (
          <Badge variant="outline">Target level {offering.targetLevel}</Badge>
        )}
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="marks">Marks</TabsTrigger>
          <TabsTrigger value="attainment">Attainment</TabsTrigger>
          <TabsTrigger value="survey">Survey</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <OverviewTab offering={offering} />
        </TabsContent>
        <TabsContent value="marks" className="space-y-6">
          <MarksTab offering={offering} />
        </TabsContent>
        <TabsContent value="attainment" className="space-y-6">
          <AttainmentTab offering={offering} />
        </TabsContent>
        <TabsContent value="survey" className="space-y-6">
          <SurveyTab offering={offering} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
