'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { transportApi } from '@/lib/api';
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
  Bus,
  Plus,
  Search,
  MoreHorizontal,
  Eye,
  Edit,
  Trash2,
  Loader2,
  Users,
  MapPin,
  IndianRupee,
  TrendingUp,
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

interface BusListItem {
  _id: string;
  busNumber: string;
  name: string;
  type: string;
  capacity: number;
  enrolledCount: number;
  stops: Array<{ _id: string; name: string }>;
  pricing: { mode: 'flat' | 'per_stop'; flatPrice?: number; currency: string; frequency: string };
  status: string;
  vehicleRegistration?: string;
  driverName?: string;
}

function formatPrice(mode: 'flat' | 'per_stop', amount?: number, currency = 'INR') {
  if (mode === 'per_stop') return 'Per-stop';
  if (typeof amount !== 'number') return '—';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function TransportPage() {
  const { hasPermission } = usePermissions();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: statsData } = useQuery({
    queryKey: ['transport-stats'],
    queryFn: () => transportApi.getBusStats(),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['transport-buses', search, statusFilter, page],
    queryFn: () =>
      transportApi.getBuses({
        search: search || undefined,
        status: statusFilter || undefined,
        page,
        limit: 20,
      }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => transportApi.deleteBus(id),
    onSuccess: () => {
      toast.success('Bus deactivated');
      queryClient.invalidateQueries({ queryKey: ['transport-buses'] });
      queryClient.invalidateQueries({ queryKey: ['transport-stats'] });
      setDeleteId(null);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const stats = statsData?.data;
  const buses: BusListItem[] = data?.data || [];
  const meta = data?.meta;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Transport</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage the school bus fleet, routes, stops, and enrollments
          </p>
        </div>
        {hasPermission('transport.buses', 'create') && (
          <Button asChild>
            <Link href="/transport/buses/new">
              <Plus className="h-4 w-4 mr-2" />
              Add Bus
            </Link>
          </Button>
        )}
      </div>

      {stats ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Bus className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Active Buses</p>
                  <p className="text-2xl font-bold">{stats.activeBuses}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-success/10">
                  <Users className="h-5 w-5 text-success" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Enrolled Students</p>
                  <p className="text-2xl font-bold">{stats.totalEnrolled}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-info/10">
                  <TrendingUp className="h-5 w-5 text-info" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Occupancy</p>
                  <p className="text-2xl font-bold">{stats.occupancyRate}%</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-muted">
                  <MapPin className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Stops</p>
                  <p className="text-2xl font-bold">{stats.totalStops}</p>
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

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by bus number, route name…"
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
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : buses.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Bus className="h-12 w-12 mb-4 opacity-40" />
              <p className="text-lg font-medium">No buses yet</p>
              <p className="text-sm">Add your first bus and map its route</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground px-4 py-3">
                      Bus
                    </th>
                    <th className="text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground px-4 py-3">
                      Route
                    </th>
                    <th className="text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground px-4 py-3">
                      Stops
                    </th>
                    <th className="text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground px-4 py-3">
                      Occupancy
                    </th>
                    <th className="text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground px-4 py-3">
                      Pricing
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
                  {buses.map((bus) => (
                    <tr key={bus._id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3">
                        <Link href={`/transport/buses/${bus._id}`} className="block">
                          <span className="font-mono text-sm text-primary font-medium">
                            {bus.busNumber}
                          </span>
                          {bus.vehicleRegistration && (
                            <p className="text-xs text-muted-foreground">
                              {bus.vehicleRegistration}
                            </p>
                          )}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-sm">{bus.name}</p>
                        {bus.driverName && (
                          <p className="text-xs text-muted-foreground">Driver: {bus.driverName}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm">{bus.stops?.length || 0}</td>
                      <td className="px-4 py-3 text-sm">
                        <span className="font-medium">{bus.enrolledCount}</span>
                        <span className="text-muted-foreground"> / {bus.capacity}</span>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <div className="flex items-center gap-1">
                          <IndianRupee className="h-3 w-3 text-muted-foreground" />
                          <span>
                            {formatPrice(
                              bus.pricing.mode,
                              bus.pricing.flatPrice,
                              bus.pricing.currency
                            )}
                          </span>
                          <span className="text-muted-foreground text-xs">
                            /{bus.pricing.frequency.slice(0, 3)}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant="outline"
                          className={
                            bus.status === 'active'
                              ? 'bg-success/10 text-success border-success/20'
                              : 'bg-muted'
                          }
                        >
                          {bus.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <Link href={`/transport/buses/${bus._id}`}>
                                <Eye className="h-4 w-4 mr-2" /> View
                              </Link>
                            </DropdownMenuItem>
                            {hasPermission('transport.buses', 'edit') && (
                              <DropdownMenuItem asChild>
                                <Link href={`/transport/buses/${bus._id}/edit`}>
                                  <Edit className="h-4 w-4 mr-2" /> Edit
                                </Link>
                              </DropdownMenuItem>
                            )}
                            {hasPermission('transport.buses', 'delete') && (
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => setDeleteId(bus._id)}
                              >
                                <Trash2 className="h-4 w-4 mr-2" /> Deactivate
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

          {meta && meta.totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-4 border-t">
              <p className="text-sm text-muted-foreground">
                Showing <span className="font-medium">{buses.length}</span> of{' '}
                <span className="font-medium">{meta.total}</span> buses
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

      <AlertDialog
        open={!!deleteId}
        onOpenChange={(open) => {
          if (!open) setDeleteId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate Bus</AlertDialogTitle>
            <AlertDialogDescription>
              This will mark the bus as inactive. Active enrollments must be withdrawn first.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
            >
              {deleteMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Deactivate'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
