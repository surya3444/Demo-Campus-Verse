'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { visitorApi } from '@/lib/api';
import { usePermissions } from '@/hooks/usePermissions';
import { getErrorMessage } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  UserCheck,
  Plus,
  Search,
  MoreHorizontal,
  Eye,
  Trash2,
  Loader2,
  LogIn,
  LogOut,
  Users,
  Clock,
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

const STATUS_OPTIONS = [
  {
    value: 'pre_registered',
    label: 'Pre-Registered',
    color: 'bg-info/10 text-info border-info/20',
  },
  {
    value: 'checked_in',
    label: 'Checked In',
    color: 'bg-success/10 text-success border-success/20',
  },
  {
    value: 'checked_out',
    label: 'Checked Out',
    color: 'bg-muted text-muted-foreground border-muted',
  },
  {
    value: 'cancelled',
    label: 'Cancelled',
    color: 'bg-destructive/10 text-destructive border-destructive/20',
  },
  { value: 'no_show', label: 'No Show', color: 'bg-warning/10 text-warning border-warning/20' },
];

function getStatusBadge(status: string) {
  const opt = STATUS_OPTIONS.find((s) => s.value === status);
  return (
    <Badge variant="outline" className={opt?.color || ''}>
      {opt?.label || status}
    </Badge>
  );
}

function formatTime(date: string | null) {
  if (!date) return '—';
  return new Date(date).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function VisitorsPage() {
  const { hasPermission } = usePermissions();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: statsData } = useQuery({
    queryKey: ['visitor-stats'],
    queryFn: () => visitorApi.getVisitorStats(),
  });

  const today = new Date().toISOString().split('T')[0];
  const { data, isLoading } = useQuery({
    queryKey: ['visitors', search, statusFilter, page],
    queryFn: () =>
      visitorApi.getVisitors({
        search: search || undefined,
        status: statusFilter || undefined,
        date: today,
        page,
        limit: 20,
      }),
  });

  const checkInMutation = useMutation({
    mutationFn: (id: string) => visitorApi.checkInVisitor(id),
    onSuccess: () => {
      toast.success('Visitor checked in successfully');
      queryClient.invalidateQueries({ queryKey: ['visitors'] });
      queryClient.invalidateQueries({ queryKey: ['visitor-stats'] });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const checkOutMutation = useMutation({
    mutationFn: (id: string) => visitorApi.checkOutVisitor(id),
    onSuccess: () => {
      toast.success('Visitor checked out successfully');
      queryClient.invalidateQueries({ queryKey: ['visitors'] });
      queryClient.invalidateQueries({ queryKey: ['visitor-stats'] });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => visitorApi.deleteVisitor(id),
    onSuccess: () => {
      toast.success('Visitor deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['visitors'] });
      queryClient.invalidateQueries({ queryKey: ['visitor-stats'] });
      setDeleteId(null);
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const stats = statsData?.data;
  const visitors = data?.data || [];
  const meta = data?.meta;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Visitor Management</h1>
          <p className="text-sm text-muted-foreground mt-1">Track and manage campus visitors</p>
        </div>
        {hasPermission('visitor.visitors', 'create') && (
          <Button asChild>
            <Link href="/visitors/register">
              <Plus className="h-4 w-4 mr-2" />
              Register Visitor
            </Link>
          </Button>
        )}
      </div>

      {/* Stats */}
      {stats ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Today&apos;s Visitors</p>
                  <p className="text-2xl font-bold">{stats.todayTotal}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-success/10">
                  <LogIn className="h-5 w-5 text-success" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Currently Inside</p>
                  <p className="text-2xl font-bold">{stats.checkedIn}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-info/10">
                  <Clock className="h-5 w-5 text-info" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Pre-Registered</p>
                  <p className="text-2xl font-bold">{stats.preRegistered}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-muted">
                  <LogOut className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Checked Out</p>
                  <p className="text-2xl font-bold">{stats.checkedOut}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, phone, host, company..."
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
              onValueChange={(v) => {
                setStatusFilter(v === 'all' ? '' : v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : visitors.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <UserCheck className="h-12 w-12 mb-4 opacity-40" />
              <p className="text-lg font-medium">No visitors today</p>
              <p className="text-sm">Register a visitor to get started</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground px-4 py-3">
                      Code
                    </th>
                    <th className="text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground px-4 py-3">
                      Visitor
                    </th>
                    <th className="text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground px-4 py-3">
                      Purpose
                    </th>
                    <th className="text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground px-4 py-3">
                      Host
                    </th>
                    <th className="text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground px-4 py-3">
                      Check In
                    </th>
                    <th className="text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground px-4 py-3">
                      Check Out
                    </th>
                    <th className="text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground px-4 py-3">
                      Status
                    </th>
                    <th className="text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground px-4 py-3">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {visitors.map((visitor: Record<string, unknown>) => (
                    <tr key={visitor._id as string} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3">
                        <span className="font-mono text-sm text-primary">
                          {visitor.visitorCode as string}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/visitors/${visitor._id}`}
                          className="font-medium text-foreground hover:text-primary transition-colors"
                        >
                          {visitor.name as string}
                        </Link>
                        <p className="text-xs text-muted-foreground">{visitor.phone as string}</p>
                      </td>
                      <td className="px-4 py-3 text-sm capitalize">
                        {(visitor.purpose as string)?.replace(/_/g, ' ')}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {visitor.hostName as string}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {formatTime(visitor.checkInTime as string | null)}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {formatTime(visitor.checkOutTime as string | null)}
                      </td>
                      <td className="px-4 py-3">{getStatusBadge(visitor.status as string)}</td>
                      <td className="px-4 py-3 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <Link href={`/visitors/${visitor._id}`}>
                                <Eye className="h-4 w-4 mr-2" /> View Details
                              </Link>
                            </DropdownMenuItem>
                            {visitor.status === 'pre_registered' &&
                              hasPermission('visitor.visitors', 'create') && (
                                <DropdownMenuItem
                                  onClick={() => checkInMutation.mutate(visitor._id as string)}
                                  disabled={checkInMutation.isPending}
                                >
                                  <LogIn className="h-4 w-4 mr-2" /> Check In
                                </DropdownMenuItem>
                              )}
                            {visitor.status === 'checked_in' &&
                              hasPermission('visitor.visitors', 'create') && (
                                <DropdownMenuItem
                                  onClick={() => checkOutMutation.mutate(visitor._id as string)}
                                  disabled={checkOutMutation.isPending}
                                >
                                  <LogOut className="h-4 w-4 mr-2" /> Check Out
                                </DropdownMenuItem>
                              )}
                            {hasPermission('visitor.visitors', 'delete') && (
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => setDeleteId(visitor._id as string)}
                              >
                                <Trash2 className="h-4 w-4 mr-2" /> Delete
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {meta && meta.totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-4 border-t">
              <p className="text-sm text-muted-foreground">
                Showing <span className="font-medium">{visitors.length}</span> of{' '}
                <span className="font-medium">{meta.total}</span> visitors
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                >
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {page} of {meta.totalPages}
                </span>
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
        </CardContent>
      </Card>

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deleteId}
        onOpenChange={(open) => {
          if (!open) setDeleteId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Visitor</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this visitor record? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
            >
              {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
