'use client';

import { useState } from 'react';
import { PageTitle } from '@/components/connect/kit';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { careerConnectApi } from '@/lib/api';
import { usePermissions } from '@/hooks/usePermissions';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Heart, Plus, Search, MoreHorizontal, Eye, Edit, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

const statusColors: Record<string, string> = {
  scheduled: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
  no_show: 'bg-orange-100 text-orange-800',
};

const audienceTypeColors: Record<string, string> = {
  individual: 'bg-blue-100 text-blue-800',
  group: 'bg-purple-100 text-purple-800',
  section: 'bg-success/20 text-success',
  class: 'bg-amber-100 text-amber-800',
  workshop: 'bg-green-100 text-green-800',
};

// Fallback for sessions without audienceType
const typeColors: Record<string, string> = {
  individual: 'bg-blue-100 text-blue-800',
  group: 'bg-purple-100 text-purple-800',
  workshop: 'bg-green-100 text-green-800',
};

interface CounselingSession {
  _id: string;
  sessionNumber?: string;
  sessionType: string;
  audienceType?: string;
  topic: string;
  scheduledDate: string;
  status: string;
  studentId?: { _id: string; firstName: string; lastName: string } | string;
  studentIds?: string[];
  className?: string;
  sectionName?: string;
  counselorId?: { _id: string; firstName: string; lastName: string } | string;
  createdAt: string;
}

function getAudienceDisplay(session: CounselingSession): string {
  const audience = session.audienceType || session.sessionType;

  switch (audience) {
    case 'individual':
      if (
        session.studentId &&
        typeof session.studentId === 'object' &&
        'firstName' in session.studentId
      ) {
        return `${session.studentId.firstName} ${session.studentId.lastName}`;
      }
      return '-';
    case 'group':
      if (session.studentIds && session.studentIds.length > 0) {
        return `${session.studentIds.length} students`;
      }
      return 'Group';
    case 'section':
      if (session.className && session.sectionName) {
        return `${session.className} - ${session.sectionName}`;
      }
      return 'Section';
    case 'class':
      return session.className || 'Class';
    case 'workshop':
      return 'Open Workshop';
    default:
      return '-';
  }
}

function getTypeBadge(session: CounselingSession) {
  const audience = session.audienceType || session.sessionType;
  const label =
    audience === 'section'
      ? 'Section'
      : audience === 'class'
        ? 'Class'
        : audience.charAt(0).toUpperCase() + audience.slice(1);
  const colors = session.audienceType
    ? audienceTypeColors[session.audienceType] || ''
    : typeColors[session.sessionType] || '';
  return { label, colors };
}

export default function CounselingSessionsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [page, setPage] = useState(1);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: [
      'counseling-sessions',
      { search, status: statusFilter, sessionType: typeFilter, page },
    ],
    queryFn: () =>
      careerConnectApi.getCounselingSessions({
        search: search || undefined,
        status: statusFilter || undefined,
        sessionType: typeFilter || undefined,
        page,
        limit: 20,
      }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => careerConnectApi.deleteCounselingSession(id),
    onSuccess: () => {
      toast.success('Session deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['counseling-sessions'] });
      setDeleteId(null);
    },
    onError: (error: Error & { response?: { data?: { error?: { message?: string } } } }) => {
      toast.error(error.response?.data?.error?.message || 'Failed to delete session');
      setDeleteId(null);
    },
  });

  const sessions: CounselingSession[] = data?.data || [];
  const meta = data?.meta;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <PageTitle
        crumbs={[{ label: "Counseling", href: "/career-connect/counseling" }, { label: "Counseling sessions" }]}
        title="Counseling sessions"
        description="Manage career counseling sessions"
      />
        {hasPermission('careerConnect.counseling', 'create') && (
          <Button onClick={() => router.push('/career-connect/counseling/sessions/new')}>
            <Plus className="mr-2 h-4 w-4" />
            New Session
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by topic..."
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
                <SelectItem value="scheduled">Scheduled</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
                <SelectItem value="no_show">No Show</SelectItem>
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
                <SelectItem value="individual">Individual</SelectItem>
                <SelectItem value="group">Group</SelectItem>
                <SelectItem value="workshop">Workshop</SelectItem>
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
          ) : sessions.length === 0 ? (
            <div className="text-center py-12">
              <Heart className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-medium">No sessions found</h3>
              <p className="text-muted-foreground">
                {search || statusFilter || typeFilter
                  ? 'Try adjusting your filters'
                  : 'Schedule your first counseling session'}
              </p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Session #</TableHead>
                    <TableHead>Topic</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Audience</TableHead>
                    <TableHead>Scheduled Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[60px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sessions.map((session) => {
                    const badge = getTypeBadge(session);
                    return (
                      <TableRow key={session._id}>
                        <TableCell className="font-mono text-sm">
                          {session.sessionNumber || session._id.slice(-6).toUpperCase()}
                        </TableCell>
                        <TableCell>
                          <Link
                            href={`/career-connect/counseling/sessions/${session._id}`}
                            className="font-medium hover:underline"
                          >
                            {session.topic}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className={badge.colors}>
                            {badge.label}
                          </Badge>
                        </TableCell>
                        <TableCell>{getAudienceDisplay(session)}</TableCell>
                        <TableCell>
                          {new Date(session.scheduledDate).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className={statusColors[session.status] || ''}>
                            {session.status === 'no_show' ? 'No Show' : session.status}
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
                                onClick={() =>
                                  router.push(`/career-connect/counseling/sessions/${session._id}`)
                                }
                              >
                                <Eye className="mr-2 h-4 w-4" />
                                View
                              </DropdownMenuItem>
                              {hasPermission('careerConnect.counseling', 'edit') &&
                                session.status === 'scheduled' && (
                                  <DropdownMenuItem
                                    onClick={() =>
                                      router.push(
                                        `/career-connect/counseling/sessions/${session._id}`
                                      )
                                    }
                                  >
                                    <Edit className="mr-2 h-4 w-4" />
                                    Edit
                                  </DropdownMenuItem>
                                )}
                              {hasPermission('careerConnect.counseling', 'delete') &&
                                session.status === 'scheduled' && (
                                  <DropdownMenuItem
                                    className="text-destructive"
                                    onClick={() => setDeleteId(session._id)}
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Delete
                                  </DropdownMenuItem>
                                )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
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
            <AlertDialogTitle>Delete Session</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this counseling session? This action cannot be undone.
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
