'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { careerConnectApi } from '@/lib/api';
import { usePermissions } from '@/hooks/usePermissions';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Briefcase,
  Plus,
  Search,
  MoreHorizontal,
  Eye,
  Edit,
  Trash2,
  LayoutGrid,
  TableIcon,
  Users,
  IndianRupee,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

const statusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-800',
  registration_open: 'bg-blue-100 text-blue-800',
  registration_closed: 'bg-yellow-100 text-yellow-800',
  in_progress: 'bg-orange-100 text-orange-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
};

const statusLabels: Record<string, string> = {
  draft: 'Draft',
  registration_open: 'Registration Open',
  registration_closed: 'Registration Closed',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const typeLabels: Record<string, string> = {
  on_campus: 'On Campus',
  off_campus: 'Off Campus',
  pool_campus: 'Pool Campus',
};

interface Drive {
  _id: string;
  driveNumber: string;
  title: string;
  companyName: string;
  companyId: string;
  type: string;
  status: string;
  jobProfile: {
    role: string;
    ctc?: number;
    location?: string;
  };
  registrationCount?: number;
  registrationDeadline: string;
}

const kanbanStatuses = [
  'draft',
  'registration_open',
  'registration_closed',
  'in_progress',
  'completed',
];

function formatCTC(ctc?: number): string {
  if (!ctc) return '-';
  if (ctc >= 10000000) return `${(ctc / 10000000).toFixed(1)} Cr`;
  if (ctc >= 100000) return `${(ctc / 100000).toFixed(1)} LPA`;
  if (ctc >= 1000) return `${(ctc / 1000).toFixed(0)}K`;
  return String(ctc);
}

export default function DrivesPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [page, setPage] = useState(1);
  const [viewMode, setViewMode] = useState<'table' | 'kanban'>('table');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['drives', { search, status: statusFilter, type: typeFilter, page }],
    queryFn: () =>
      careerConnectApi.getDrives({
        search: search || undefined,
        status: statusFilter || undefined,
        type: typeFilter || undefined,
        page,
        limit: 20,
      }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => careerConnectApi.deleteDrive(id),
    onSuccess: () => {
      toast.success('Drive deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['drives'] });
      setDeleteId(null);
    },
    onError: (error: Error & { response?: { data?: { error?: { message?: string } } } }) => {
      toast.error(error.response?.data?.error?.message || 'Failed to delete drive');
      setDeleteId(null);
    },
  });

  const drives: Drive[] = data?.data || [];
  const meta = data?.meta;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Placement Drives</h1>
          <p className="text-muted-foreground">Manage campus placement drives</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-md border">
            <Button
              variant={viewMode === 'table' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('table')}
              className="rounded-r-none"
            >
              <TableIcon className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'kanban' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('kanban')}
              className="rounded-l-none"
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
          </div>
          {hasPermission('careerConnect.drives', 'create') && (
            <Button onClick={() => router.push('/career-connect/drives/new')}>
              <Plus className="mr-2 h-4 w-4" />
              New Drive
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search drives..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="pl-9"
              />
            </div>
            <Select
              value={statusFilter}
              onValueChange={(val) => {
                setStatusFilter(val === 'all' ? '' : val);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="registration_open">Registration Open</SelectItem>
                <SelectItem value="registration_closed">Registration Closed</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={typeFilter}
              onValueChange={(val) => {
                setTypeFilter(val === 'all' ? '' : val);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="on_campus">On Campus</SelectItem>
                <SelectItem value="off_campus">Off Campus</SelectItem>
                <SelectItem value="pool_campus">Pool Campus</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : drives.length === 0 ? (
            <div className="text-center py-12">
              <Briefcase className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-medium">No drives found</h3>
              <p className="text-muted-foreground">
                {search || statusFilter || typeFilter
                  ? 'Try adjusting your filters'
                  : 'Create your first placement drive'}
              </p>
            </div>
          ) : viewMode === 'table' ? (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Drive #</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>CTC</TableHead>
                    <TableHead>Registrations</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[60px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {drives.map((drive) => (
                    <TableRow key={drive._id}>
                      <TableCell className="font-mono text-sm">{drive.driveNumber}</TableCell>
                      <TableCell>
                        <Link
                          href={`/career-connect/drives/${drive._id}`}
                          className="font-medium hover:underline"
                        >
                          {drive.title}
                        </Link>
                      </TableCell>
                      <TableCell>{drive.companyName}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{typeLabels[drive.type] || drive.type}</Badge>
                      </TableCell>
                      <TableCell>{drive.jobProfile?.role || '-'}</TableCell>
                      <TableCell>
                        {drive.jobProfile?.ctc ? (
                          <span className="flex items-center gap-0.5">
                            <IndianRupee className="h-3 w-3" />
                            {formatCTC(drive.jobProfile.ctc)}
                          </span>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3 text-muted-foreground" />
                          {drive.registrationCount ?? 0}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={statusColors[drive.status] || ''}>
                          {statusLabels[drive.status] || drive.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => router.push(`/career-connect/drives/${drive._id}`)}
                            >
                              <Eye className="mr-2 h-4 w-4" />
                              View
                            </DropdownMenuItem>
                            {hasPermission('careerConnect.drives', 'edit') && (
                              <DropdownMenuItem
                                onClick={() => router.push(`/career-connect/drives/${drive._id}`)}
                              >
                                <Edit className="mr-2 h-4 w-4" />
                                Edit
                              </DropdownMenuItem>
                            )}
                            {hasPermission('careerConnect.drives', 'delete') && (
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => setDeleteId(drive._id)}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {meta && meta.totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">
                    Showing {(page - 1) * 20 + 1}-{Math.min(page * 20, meta.total)} of {meta.total}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page <= 1}
                      onClick={() => setPage(page - 1)}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!meta.hasMore}
                      onClick={() => setPage(page + 1)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-5">
              {kanbanStatuses.map((status) => {
                const columnDrives = drives.filter((d) => d.status === status);
                return (
                  <div key={status} className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold">{statusLabels[status]}</h3>
                      <Badge variant="secondary" className="text-xs">
                        {columnDrives.length}
                      </Badge>
                    </div>
                    <div className="space-y-2">
                      {columnDrives.length === 0 ? (
                        <div className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
                          No drives
                        </div>
                      ) : (
                        columnDrives.map((drive) => (
                          <Card
                            key={drive._id}
                            className="cursor-pointer hover:shadow-md transition-shadow"
                            onClick={() => router.push(`/career-connect/drives/${drive._id}`)}
                          >
                            <CardContent className="p-3 space-y-2">
                              <p className="text-xs font-mono text-muted-foreground">
                                {drive.driveNumber}
                              </p>
                              <p className="text-sm font-medium leading-tight">{drive.title}</p>
                              <p className="text-xs text-muted-foreground">{drive.companyName}</p>
                              <div className="flex items-center justify-between text-xs">
                                <span>{drive.jobProfile?.role}</span>
                                {drive.jobProfile?.ctc && (
                                  <span className="flex items-center gap-0.5 font-medium">
                                    <IndianRupee className="h-3 w-3" />
                                    {formatCTC(drive.jobProfile.ctc)}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Users className="h-3 w-3" />
                                {drive.registrationCount ?? 0} registered
                              </div>
                            </CardContent>
                          </Card>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Drive</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this placement drive? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
