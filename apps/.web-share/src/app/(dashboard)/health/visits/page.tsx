'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { healthApi } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Activity,
  Search,
  Plus,
  MoreHorizontal,
  Eye,
  Edit,
  CheckCircle,
  AlertTriangle,
  Clock,
  Phone,
} from 'lucide-react';
import Link from 'next/link';

export default function MedicalVisitsPage() {
  const [activeTab, setActiveTab] = useState('all');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string>('all');
  const [visitType, setVisitType] = useState<string>('all');
  const [page, setPage] = useState(1);
  const limit = 20;

  const { data, isLoading } = useQuery({
    queryKey: ['medical-visits', search, status, visitType, page],
    queryFn: () =>
      healthApi.getVisits({
        search: search || undefined,
        status: status !== 'all' ? status : undefined,
        visitType: visitType !== 'all' ? visitType : undefined,
        page,
        limit,
      }),
    enabled: activeTab === 'all',
  });

  const { data: todayData, isLoading: todayLoading } = useQuery({
    queryKey: ['medical-visits-today'],
    queryFn: () => healthApi.getTodayVisits(),
    enabled: activeTab === 'today',
  });

  const { data: stats } = useQuery({
    queryKey: ['medical-visits-stats'],
    queryFn: () => healthApi.getVisitStats(),
  });

  const visits = data?.data || [];
  const todayVisits = todayData?.data || [];
  const meta = data?.meta || { total: 0, page: 1, limit: 20, totalPages: 1 };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
      completed: 'default',
      in_progress: 'secondary',
      follow_up_required: 'outline',
    };
    return (
      <Badge variant={variants[status] || 'outline'} className="capitalize">
        {status.replace(/_/g, ' ')}
      </Badge>
    );
  };

  const getOutcomeBadge = (outcome: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
      returned_to_class: 'default',
      sent_home: 'secondary',
      referred: 'outline',
      hospitalized: 'destructive',
      under_observation: 'secondary',
    };
    return (
      <Badge variant={variants[outcome] || 'outline'} className="capitalize">
        {outcome.replace(/_/g, ' ')}
      </Badge>
    );
  };

  const VisitTable = ({ visitList, loading }: { visitList: typeof visits; loading: boolean }) => {
    if (loading) {
      return (
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-12" />
          ))}
        </div>
      );
    }

    if (visitList.length === 0) {
      return (
        <div className="text-center py-8">
          <Activity className="mx-auto h-12 w-12 text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-medium">No medical visits found</h3>
          <p className="text-muted-foreground">Log a new medical visit to get started</p>
          <Button asChild className="mt-4">
            <Link href="/health/visits/new">
              <Plus className="mr-2 h-4 w-4" /> Log Visit
            </Link>
          </Button>
        </div>
      );
    }

    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Person</TableHead>
            <TableHead>Visit Type</TableHead>
            <TableHead>Chief Complaint</TableHead>
            <TableHead>Arrival</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Outcome</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {visitList.map(
            (visit: {
              _id: string;
              personName: string;
              personType: string;
              visitType: string;
              chiefComplaint: string;
              arrivalTime: string;
              status: string;
              outcome?: string;
              isIncident?: boolean;
            }) => (
              <TableRow key={visit._id}>
                <TableCell>
                  <div>
                    <p className="font-medium">{visit.personName}</p>
                    <p className="text-xs text-muted-foreground capitalize">{visit.personType}</p>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span className="capitalize">{visit.visitType}</span>
                    {visit.isIncident && (
                      <Badge variant="destructive" className="text-xs">
                        Incident
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className="max-w-[200px] truncate">{visit.chiefComplaint}</TableCell>
                <TableCell>
                  {new Date(visit.arrivalTime).toLocaleString([], {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </TableCell>
                <TableCell>{getStatusBadge(visit.status)}</TableCell>
                <TableCell>{visit.outcome ? getOutcomeBadge(visit.outcome) : '-'}</TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-8 w-8 p-0">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem asChild>
                        <Link href={`/health/visits/${visit._id}`}>
                          <Eye className="mr-2 h-4 w-4" />
                          View Details
                        </Link>
                      </DropdownMenuItem>
                      {visit.status === 'in_progress' && (
                        <>
                          <DropdownMenuItem asChild>
                            <Link href={`/health/visits/${visit._id}/close`}>
                              <CheckCircle className="mr-2 h-4 w-4" />
                              Close Visit
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem asChild>
                            <Link href={`/health/visits/${visit._id}/notify`}>
                              <Phone className="mr-2 h-4 w-4" />
                              Notify Parent
                            </Link>
                          </DropdownMenuItem>
                        </>
                      )}
                      <DropdownMenuItem asChild>
                        <Link href={`/health/visits/${visit._id}/edit`}>
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
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Medical Visits</h1>
          <p className="text-muted-foreground">Track infirmary visits and medical incidents</p>
        </div>
        <Button asChild>
          <Link href="/health/visits/new">
            <Plus className="mr-2 h-4 w-4" /> Log New Visit
          </Link>
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today&apos;s Visits</CardTitle>
            <Activity className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.data?.todayVisits || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Progress</CardTitle>
            <Clock className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.data?.inProgress || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">This Week</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.data?.thisWeek || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Incidents</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.data?.incidents || 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="today">Today&apos;s Visits</TabsTrigger>
          <TabsTrigger value="all">All Visits</TabsTrigger>
        </TabsList>

        <TabsContent value="today">
          <Card>
            <CardHeader>
              <CardTitle>Today&apos;s Medical Visits</CardTitle>
              <CardDescription>All visits to the medical room today</CardDescription>
            </CardHeader>
            <CardContent>
              <VisitTable visitList={todayVisits} loading={todayLoading} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="all">
          {/* Filters */}
          <Card className="mb-4">
            <CardContent className="pt-6">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name or complaint..."
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setPage(1);
                    }}
                    className="pl-10"
                  />
                </div>
                <Select
                  value={visitType}
                  onValueChange={(value) => {
                    setVisitType(value);
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Visit Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="routine">Routine</SelectItem>
                    <SelectItem value="illness">Illness</SelectItem>
                    <SelectItem value="injury">Injury</SelectItem>
                    <SelectItem value="emergency">Emergency</SelectItem>
                    <SelectItem value="follow-up">Follow-up</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
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
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="follow_up_required">Follow-up Required</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <VisitTable visitList={visits} loading={isLoading} />

              {/* Pagination */}
              {meta.totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">
                    Showing {(meta.page - 1) * meta.limit + 1} to{' '}
                    {Math.min(meta.page * meta.limit, meta.total)} of {meta.total} visits
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(page - 1)}
                      disabled={page === 1}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(page + 1)}
                      disabled={page >= meta.totalPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
