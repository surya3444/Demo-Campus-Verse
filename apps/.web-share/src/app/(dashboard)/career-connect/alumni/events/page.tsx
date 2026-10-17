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
import { CalendarDays, Plus, Search, MoreHorizontal, Eye, Trash2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

const statusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-800',
  published: 'bg-green-100 text-green-800',
  completed: 'bg-blue-100 text-blue-800',
  cancelled: 'bg-red-100 text-red-800',
};

const typeLabels: Record<string, string> = {
  reunion: 'Reunion',
  workshop: 'Workshop',
  guest_lecture: 'Guest Lecture',
  networking: 'Networking',
  career_fair: 'Career Fair',
};

const typeColors: Record<string, string> = {
  reunion: 'bg-purple-100 text-purple-800',
  workshop: 'bg-blue-100 text-blue-800',
  guest_lecture: 'bg-teal-100 text-teal-800',
  networking: 'bg-orange-100 text-orange-800',
  career_fair: 'bg-indigo-100 text-indigo-800',
};

interface AlumniEvent {
  _id: string;
  eventNumber?: string;
  title: string;
  type: string;
  eventDate: string;
  endDate?: string;
  venue?: string;
  isVirtual?: boolean;
  status: string;
  registrations: Array<Record<string, unknown>>;
  maxCapacity?: number;
  speakers?: Array<{ name: string; designation?: string; company?: string }>;
  createdAt: string;
}

export default function AlumniEventsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [page, setPage] = useState(1);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const canCreate = hasPermission('careerConnect.alumni', 'create');
  const canDelete = hasPermission('careerConnect.alumni', 'delete');

  const { data, isLoading } = useQuery({
    queryKey: ['alumni-events', { search, status: statusFilter, type: typeFilter, page }],
    queryFn: () =>
      careerConnectApi.getAlumniEvents({
        search: search || undefined,
        status: statusFilter || undefined,
        type: typeFilter || undefined,
        page,
        limit: 20,
      }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => careerConnectApi.deleteAlumniEvent(id),
    onSuccess: () => {
      toast.success('Event deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['alumni-events'] });
      setDeleteId(null);
    },
    onError: (error: Error & { response?: { data?: { error?: { message?: string } } } }) => {
      toast.error(error.response?.data?.error?.message || 'Failed to delete event');
      setDeleteId(null);
    },
  });

  const events: AlumniEvent[] = data?.data || [];
  const meta = data?.meta;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/career-connect')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Alumni Events</h1>
            <p className="text-muted-foreground">Manage alumni network events</p>
          </div>
        </div>
        {canCreate && (
          <Button onClick={() => router.push('/career-connect/alumni/events/new')}>
            <Plus className="mr-2 h-4 w-4" />
            New Event
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search events..."
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
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="published">Published</SelectItem>
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
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="reunion">Reunion</SelectItem>
                <SelectItem value="workshop">Workshop</SelectItem>
                <SelectItem value="guest_lecture">Guest Lecture</SelectItem>
                <SelectItem value="networking">Networking</SelectItem>
                <SelectItem value="career_fair">Career Fair</SelectItem>
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
          ) : events.length === 0 ? (
            <div className="text-center py-12">
              <CalendarDays className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-medium">No events found</h3>
              <p className="text-muted-foreground">
                {search || statusFilter || typeFilter
                  ? 'Try adjusting your filters'
                  : 'Create your first alumni event'}
              </p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Venue</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Registrations</TableHead>
                    <TableHead className="w-[60px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {events.map((event) => (
                    <TableRow key={event._id}>
                      <TableCell>
                        <Link
                          href={`/career-connect/alumni/events/${event._id}`}
                          className="font-medium hover:underline"
                        >
                          {event.title}
                        </Link>
                        {event.eventNumber && (
                          <p className="text-xs text-muted-foreground">{event.eventNumber}</p>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={typeColors[event.type] || ''}>
                          {typeLabels[event.type] || event.type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {new Date(event.eventDate).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </TableCell>
                      <TableCell>{event.isVirtual ? 'Virtual' : event.venue || '-'}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={statusColors[event.status] || ''}>
                          {event.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {event.registrations?.length || 0}
                        {event.maxCapacity && (
                          <span className="text-muted-foreground">/{event.maxCapacity}</span>
                        )}
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
                              onClick={() =>
                                router.push(`/career-connect/alumni/events/${event._id}`)
                              }
                            >
                              <Eye className="mr-2 h-4 w-4" />
                              View
                            </DropdownMenuItem>
                            {canDelete && event.status === 'draft' && (
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => setDeleteId(event._id)}
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
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Event</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this event? This action cannot be undone.
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
