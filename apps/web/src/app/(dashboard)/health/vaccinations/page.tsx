'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Syringe,
  Search,
  Plus,
  MoreHorizontal,
  Eye,
  Edit,
  CheckCircle,
  AlertTriangle,
  Clock,
  RefreshCw,
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

export default function VaccinationsPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('all');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string>('all');
  const [page, setPage] = useState(1);
  const limit = 20;

  const { data, isLoading } = useQuery({
    queryKey: ['vaccinations', search, status, page],
    queryFn: () =>
      healthApi.getVaccinations({
        search: search || undefined,
        status: status !== 'all' ? status : undefined,
        page,
        limit,
      }),
  });

  const { data: dueData, isLoading: dueLoading } = useQuery({
    queryKey: ['vaccinations-due'],
    queryFn: () => healthApi.getDueVaccinations(30),
    enabled: activeTab === 'due',
  });

  const { data: stats } = useQuery({
    queryKey: ['vaccinations-stats'],
    queryFn: () => healthApi.getVaccinationStats(),
  });

  const markOverdueMutation = useMutation({
    mutationFn: () => healthApi.markOverdueVaccinations(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vaccinations'] });
      queryClient.invalidateQueries({ queryKey: ['vaccinations-stats'] });
      toast.success('Overdue vaccinations marked successfully');
    },
    onError: () => {
      toast.error('Failed to mark overdue vaccinations');
    },
  });

  const vaccinations = data?.data || [];
  const dueVaccinations = dueData?.data || [];
  const meta = data?.meta || { total: 0, page: 1, limit: 20, totalPages: 1 };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
      completed: 'default',
      scheduled: 'secondary',
      overdue: 'destructive',
      missed: 'destructive',
      exempt: 'outline',
    };
    return (
      <Badge variant={variants[status] || 'outline'} className="capitalize">
        {status}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Vaccinations</h1>
          <p className="text-muted-foreground">Track and manage vaccination records</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => markOverdueMutation.mutate()}
            disabled={markOverdueMutation.isPending}
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${markOverdueMutation.isPending ? 'animate-spin' : ''}`}
            />
            Mark Overdue
          </Button>
          <Button asChild>
            <Link href="/health/vaccinations/new">
              <Plus className="mr-2 h-4 w-4" /> Record Vaccination
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Records</CardTitle>
            <Syringe className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.data?.totalVaccinations || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.data?.completed || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Scheduled</CardTitle>
            <Clock className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.data?.scheduled || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overdue</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.data?.overdue || 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all">All Vaccinations</TabsTrigger>
          <TabsTrigger value="due">Due/Overdue</TabsTrigger>
        </TabsList>

        {/* Filters */}
        <Card className="mt-4">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or vaccine..."
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
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                  <SelectItem value="missed">Missed</SelectItem>
                  <SelectItem value="exempt">Exempt</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <TabsContent value="all">
          <Card>
            <CardContent className="pt-6">
              {isLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-12" />
                  ))}
                </div>
              ) : vaccinations.length === 0 ? (
                <div className="text-center py-8">
                  <Syringe className="mx-auto h-12 w-12 text-muted-foreground/50" />
                  <h3 className="mt-4 text-lg font-medium">No vaccination records found</h3>
                  <p className="text-muted-foreground">Record a new vaccination to get started</p>
                  <Button asChild className="mt-4">
                    <Link href="/health/vaccinations/new">
                      <Plus className="mr-2 h-4 w-4" /> Record Vaccination
                    </Link>
                  </Button>
                </div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Person</TableHead>
                        <TableHead>Vaccine</TableHead>
                        <TableHead>Dose</TableHead>
                        <TableHead>Scheduled Date</TableHead>
                        <TableHead>Administered</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {vaccinations.map(
                        (vac: {
                          _id: string;
                          personName: string;
                          personType: string;
                          vaccineName: string;
                          doseNumber?: number;
                          scheduledDate?: string;
                          administeredDate?: string;
                          status: string;
                        }) => (
                          <TableRow key={vac._id}>
                            <TableCell>
                              <div>
                                <p className="font-medium">{vac.personName}</p>
                                <p className="text-xs text-muted-foreground capitalize">
                                  {vac.personType}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell>{vac.vaccineName}</TableCell>
                            <TableCell>{vac.doseNumber ? `Dose ${vac.doseNumber}` : '-'}</TableCell>
                            <TableCell>
                              {vac.scheduledDate
                                ? new Date(vac.scheduledDate).toLocaleDateString()
                                : '-'}
                            </TableCell>
                            <TableCell>
                              {vac.administeredDate
                                ? new Date(vac.administeredDate).toLocaleDateString()
                                : '-'}
                            </TableCell>
                            <TableCell>{getStatusBadge(vac.status)}</TableCell>
                            <TableCell className="text-right">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" className="h-8 w-8 p-0">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem asChild>
                                    <Link href={`/health/vaccinations/${vac._id}`}>
                                      <Eye className="mr-2 h-4 w-4" />
                                      View Details
                                    </Link>
                                  </DropdownMenuItem>
                                  {vac.status === 'scheduled' && (
                                    <DropdownMenuItem asChild>
                                      <Link href={`/health/vaccinations/${vac._id}/administer`}>
                                        <CheckCircle className="mr-2 h-4 w-4" />
                                        Mark Administered
                                      </Link>
                                    </DropdownMenuItem>
                                  )}
                                  <DropdownMenuItem asChild>
                                    <Link href={`/health/vaccinations/${vac._id}/edit`}>
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

                  {/* Pagination */}
                  {meta.totalPages > 1 && (
                    <div className="flex items-center justify-between mt-4">
                      <p className="text-sm text-muted-foreground">
                        Showing {(meta.page - 1) * meta.limit + 1} to{' '}
                        {Math.min(meta.page * meta.limit, meta.total)} of {meta.total} records
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
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="due">
          <Card>
            <CardHeader>
              <CardTitle>Due Vaccinations</CardTitle>
              <CardDescription>
                Vaccinations scheduled or overdue in the next 30 days
              </CardDescription>
            </CardHeader>
            <CardContent>
              {dueLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-12" />
                  ))}
                </div>
              ) : dueVaccinations.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle className="mx-auto h-12 w-12 text-green-500/50" />
                  <h3 className="mt-4 text-lg font-medium">All caught up!</h3>
                  <p className="text-muted-foreground">
                    No vaccinations are due in the next 30 days
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Person</TableHead>
                      <TableHead>Vaccine</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dueVaccinations.map(
                      (vac: {
                        _id: string;
                        personName: string;
                        personType: string;
                        vaccineName: string;
                        scheduledDate: string;
                        status: string;
                      }) => (
                        <TableRow key={vac._id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{vac.personName}</p>
                              <p className="text-xs text-muted-foreground capitalize">
                                {vac.personType}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>{vac.vaccineName}</TableCell>
                          <TableCell>{new Date(vac.scheduledDate).toLocaleDateString()}</TableCell>
                          <TableCell>{getStatusBadge(vac.status)}</TableCell>
                          <TableCell className="text-right">
                            <Button variant="outline" size="sm" asChild>
                              <Link href={`/health/vaccinations/${vac._id}/administer`}>
                                Administer
                              </Link>
                            </Button>
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
