'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { healthApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Stethoscope,
  Search,
  Plus,
  MoreHorizontal,
  Eye,
  Edit,
  CheckCircle,
  Calendar,
  Users,
} from 'lucide-react';
import Link from 'next/link';

export default function HealthCheckupsPage() {
  const [activeTab, setActiveTab] = useState('checkups');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string>('all');
  const [page, setPage] = useState(1);
  const limit = 20;

  const { data: checkupsData, isLoading: checkupsLoading } = useQuery({
    queryKey: ['health-checkups', search, status, page],
    queryFn: () =>
      healthApi.getCheckups({
        search: search || undefined,
        status: status !== 'all' ? status : undefined,
        page,
        limit,
      }),
    enabled: activeTab === 'checkups',
  });

  const { data: campaignsData, isLoading: campaignsLoading } = useQuery({
    queryKey: ['health-campaigns', search, status, page],
    queryFn: () =>
      healthApi.getCampaigns({
        search: search || undefined,
        status: status !== 'all' ? status : undefined,
        page,
        limit,
      }),
    enabled: activeTab === 'campaigns',
  });

  const { data: stats } = useQuery({
    queryKey: ['health-checkups-stats'],
    queryFn: () => healthApi.getCheckupStats(),
  });

  const checkups = checkupsData?.data || [];
  const campaigns = campaignsData?.data || [];

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
      completed: 'default',
      in_progress: 'secondary',
      scheduled: 'outline',
      cancelled: 'destructive',
      draft: 'outline',
    };
    return (
      <Badge variant={variants[status] || 'outline'} className="capitalize">
        {status.replace('_', ' ')}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Health Checkups</h1>
          <p className="text-muted-foreground">
            Schedule and manage health screenings and checkup campaigns
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/health/checkups/campaigns/new">
              <Users className="mr-2 h-4 w-4" /> New Campaign
            </Link>
          </Button>
          <Button asChild>
            <Link href="/health/checkups/new">
              <Plus className="mr-2 h-4 w-4" /> New Checkup
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Checkups</CardTitle>
            <Stethoscope className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.data?.totalCheckups || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">This Month</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.data?.thisMonth || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Scheduled</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.data?.scheduled || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Campaigns</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.data?.activeCampaigns || 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="checkups">Individual Checkups</TabsTrigger>
          <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
        </TabsList>

        {/* Filters */}
        <Card className="mt-4">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  className="pl-10"
                />
              </div>
              <Select
                value={status}
                onValueChange={(value) => {
                  setStatus(value);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <TabsContent value="checkups">
          <Card>
            <CardContent className="pt-6">
              {checkupsLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-12" />
                  ))}
                </div>
              ) : checkups.length === 0 ? (
                <div className="text-center py-8">
                  <Stethoscope className="mx-auto h-12 w-12 text-muted-foreground/50" />
                  <h3 className="mt-4 text-lg font-medium">No checkups found</h3>
                  <p className="text-muted-foreground">
                    Schedule a new health checkup to get started
                  </p>
                  <Button asChild className="mt-4">
                    <Link href="/health/checkups/new">
                      <Plus className="mr-2 h-4 w-4" /> Schedule Checkup
                    </Link>
                  </Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Person</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Examiner</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {checkups.map(
                      (checkup: {
                        _id: string;
                        personName: string;
                        personType: string;
                        checkupType: string;
                        checkupDate: string;
                        status: string;
                        examinerName?: string;
                      }) => (
                        <TableRow key={checkup._id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{checkup.personName}</p>
                              <p className="text-xs text-muted-foreground capitalize">
                                {checkup.personType}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell className="capitalize">
                            {checkup.checkupType.replace('-', ' ')}
                          </TableCell>
                          <TableCell>
                            {new Date(checkup.checkupDate).toLocaleDateString()}
                          </TableCell>
                          <TableCell>{getStatusBadge(checkup.status)}</TableCell>
                          <TableCell>{checkup.examinerName || '-'}</TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-8 w-8 p-0">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem asChild>
                                  <Link href={`/health/checkups/${checkup._id}`}>
                                    <Eye className="mr-2 h-4 w-4" />
                                    View Details
                                  </Link>
                                </DropdownMenuItem>
                                {checkup.status !== 'completed' && (
                                  <DropdownMenuItem asChild>
                                    <Link href={`/health/checkups/${checkup._id}/complete`}>
                                      <CheckCircle className="mr-2 h-4 w-4" />
                                      Complete
                                    </Link>
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      )
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="campaigns">
          <Card>
            <CardContent className="pt-6">
              {campaignsLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-12" />
                  ))}
                </div>
              ) : campaigns.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="mx-auto h-12 w-12 text-muted-foreground/50" />
                  <h3 className="mt-4 text-lg font-medium">No campaigns found</h3>
                  <p className="text-muted-foreground">
                    Create a campaign for batch health checkups
                  </p>
                  <Button asChild className="mt-4">
                    <Link href="/health/checkups/campaigns/new">
                      <Plus className="mr-2 h-4 w-4" /> Create Campaign
                    </Link>
                  </Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Campaign Name</TableHead>
                      <TableHead>Target</TableHead>
                      <TableHead>Scheduled Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Progress</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {campaigns.map(
                      (campaign: {
                        _id: string;
                        name: string;
                        personType: string;
                        scheduledDate: string;
                        status: string;
                        targetCount?: number;
                        completedCount?: number;
                      }) => (
                        <TableRow key={campaign._id}>
                          <TableCell className="font-medium">{campaign.name}</TableCell>
                          <TableCell className="capitalize">{campaign.personType}s</TableCell>
                          <TableCell>
                            {new Date(campaign.scheduledDate).toLocaleDateString()}
                          </TableCell>
                          <TableCell>{getStatusBadge(campaign.status)}</TableCell>
                          <TableCell>
                            {campaign.completedCount || 0} / {campaign.targetCount || 0}
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-8 w-8 p-0">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem asChild>
                                  <Link href={`/health/checkups/campaigns/${campaign._id}`}>
                                    <Eye className="mr-2 h-4 w-4" />
                                    View Details
                                  </Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild>
                                  <Link href={`/health/checkups/campaigns/${campaign._id}/edit`}>
                                    <Edit className="mr-2 h-4 w-4" />
                                    Edit
                                  </Link>
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      )
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
