'use client';

import { use } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { healthApi } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  ArrowLeft,
  Calendar,
  Users,
  Play,
  CheckCircle,
  Clock,
  Eye,
  Ear,
  Stethoscope,
  Loader2,
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

export default function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['campaign', id],
    queryFn: () => healthApi.getCampaign(id),
  });

  const { data: checkupsData } = useQuery({
    queryKey: ['campaign-checkups', id],
    queryFn: () => healthApi.getCampaignCheckups(id),
    enabled: !!data?.data,
  });

  const startMutation = useMutation({
    mutationFn: () => healthApi.startCampaign(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaign', id] });
      toast.success('Campaign started successfully');
    },
    onError: (error: Error & { response?: { data?: { error?: { message?: string } } } }) => {
      toast.error(error.response?.data?.error?.message || 'Failed to start campaign');
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  const campaign = data?.data;

  if (!campaign) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold">Campaign not found</h2>
        <Button asChild className="mt-4">
          <Link href="/health/checkups?tab=campaigns">Back to Campaigns</Link>
        </Button>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
      completed: 'default',
      in_progress: 'secondary',
      scheduled: 'outline',
      cancelled: 'destructive',
    };
    return (
      <Badge variant={variants[status] || 'outline'} className="capitalize">
        {status.replace('_', ' ')}
      </Badge>
    );
  };

  const completedCount =
    checkupsData?.data?.filter((c: { status: string }) => c.status === 'completed').length || 0;
  const totalCount = checkupsData?.data?.length || 0;
  const progressPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/health/checkups?tab=campaigns">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{campaign.name}</h1>
            <p className="text-muted-foreground">{campaign.checkupType} campaign</p>
          </div>
        </div>
        <div className="flex gap-2">
          {campaign.status === 'scheduled' && (
            <Button onClick={() => startMutation.mutate()} disabled={startMutation.isPending}>
              {startMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Play className="mr-2 h-4 w-4" />
              )}
              Start Campaign
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Campaign Info */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-blue-500" />
              Campaign Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-sm text-muted-foreground">Status</p>
                {getStatusBadge(campaign.status)}
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Checkup Type</p>
                <p className="font-medium capitalize">{campaign.checkupType}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Start Date</p>
                <p className="font-medium">{new Date(campaign.startDate).toLocaleDateString()}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">End Date</p>
                <p className="font-medium">{new Date(campaign.endDate).toLocaleDateString()}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Target Group</p>
                <p className="font-medium capitalize">{campaign.targetGroup?.replace('_', ' ')}</p>
              </div>
            </div>
            {campaign.description && (
              <div>
                <p className="text-sm text-muted-foreground">Description</p>
                <p className="font-medium">{campaign.description}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Progress Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              Progress
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center">
              <p className="text-4xl font-bold">
                {completedCount}/{totalCount}
              </p>
              <p className="text-sm text-muted-foreground">Checkups Completed</p>
            </div>
            <Progress value={progressPercent} className="h-2" />
            <p className="text-center text-sm text-muted-foreground">
              {progressPercent.toFixed(0)}% complete
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Examinations Included */}
      {campaign.examinations && (
        <Card>
          <CardHeader>
            <CardTitle>Examinations Included</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              {campaign.examinations.includeVision && (
                <div className="flex items-center gap-2 px-3 py-2 bg-purple-100 dark:bg-purple-900/20 rounded-lg">
                  <Eye className="h-4 w-4 text-purple-500" />
                  <span>Vision Screening</span>
                </div>
              )}
              {campaign.examinations.includeHearing && (
                <div className="flex items-center gap-2 px-3 py-2 bg-amber-100 dark:bg-amber-900/20 rounded-lg">
                  <Ear className="h-4 w-4 text-amber-500" />
                  <span>Hearing Test</span>
                </div>
              )}
              {campaign.examinations.includeDental && (
                <div className="flex items-center gap-2 px-3 py-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
                  <Stethoscope className="h-4 w-4 text-blue-500" />
                  <span>Dental Checkup</span>
                </div>
              )}
              {campaign.examinations.includeGeneral && (
                <div className="flex items-center gap-2 px-3 py-2 bg-green-100 dark:bg-green-900/20 rounded-lg">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>General Physical</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Checkups List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-blue-500" />
            Scheduled Checkups
          </CardTitle>
          <CardDescription>{totalCount} checkups scheduled for this campaign</CardDescription>
        </CardHeader>
        <CardContent>
          {checkupsData?.data?.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Person</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {checkupsData.data
                    .slice(0, 10)
                    .map(
                      (checkup: {
                        _id: string;
                        personName: string;
                        personType: string;
                        status: string;
                        checkupDate: string;
                      }) => (
                        <TableRow key={checkup._id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{checkup.personName}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="capitalize">
                              {checkup.personType}
                            </Badge>
                          </TableCell>
                          <TableCell>{getStatusBadge(checkup.status)}</TableCell>
                          <TableCell>
                            {new Date(checkup.checkupDate).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              {checkup.status === 'scheduled' ||
                              checkup.status === 'in_progress' ? (
                                <Button variant="outline" size="sm" asChild>
                                  <Link href={`/health/checkups/${checkup._id}/complete`}>
                                    Complete
                                  </Link>
                                </Button>
                              ) : (
                                <Button variant="outline" size="sm" asChild>
                                  <Link href={`/health/checkups/${checkup._id}`}>View</Link>
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    )}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No checkups scheduled yet</p>
              {campaign.status === 'scheduled' && (
                <p className="text-sm mt-2">Start the campaign to generate checkup schedules</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Notes */}
      {campaign.notes && (
        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p>{campaign.notes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
