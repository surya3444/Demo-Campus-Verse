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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { DatePicker } from '@/components/ui/date-picker';
import { Share2, Plus, Search, MoreHorizontal, Eye, Trash2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

const statusColors: Record<string, string> = {
  open: 'bg-green-100 text-green-800',
  in_progress: 'bg-blue-100 text-blue-800',
  closed: 'bg-gray-100 text-gray-800',
};

const jobTypeLabels: Record<string, string> = {
  job: 'Full-time Job',
  internship: 'Internship',
};

interface Referral {
  _id: string;
  companyName: string;
  roleTitle: string;
  jobType?: string;
  description?: string;
  applicationDeadline?: string;
  status: string;
  alumniId: string;
  studentsReferred: Array<{
    studentId: string;
    studentName: string;
    status: string;
    referredAt: string;
  }>;
  createdAt: string;
}

export default function ReferralsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [page, setPage] = useState(1);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  // Create form state
  const [newCompanyName, setNewCompanyName] = useState('');
  const [newRoleTitle, setNewRoleTitle] = useState('');
  const [newJobType, setNewJobType] = useState<string>('job');
  const [newDescription, setNewDescription] = useState('');
  const [newDeadline, setNewDeadline] = useState('');

  const canCreate = hasPermission('careerConnect.alumni', 'create');
  const canDelete = hasPermission('careerConnect.alumni', 'delete');

  const { data, isLoading } = useQuery({
    queryKey: ['alumni-referrals', { search, status: statusFilter, page }],
    queryFn: () =>
      careerConnectApi.getReferrals({
        search: search || undefined,
        status: statusFilter || undefined,
        page,
        limit: 20,
      }),
  });

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => careerConnectApi.createReferral(data),
    onSuccess: () => {
      toast.success('Referral created successfully');
      queryClient.invalidateQueries({ queryKey: ['alumni-referrals'] });
      setCreateOpen(false);
      setNewCompanyName('');
      setNewRoleTitle('');
      setNewJobType('job');
      setNewDescription('');
      setNewDeadline('');
    },
    onError: (error: Error & { response?: { data?: { error?: { message?: string } } } }) => {
      toast.error(error.response?.data?.error?.message || 'Failed to create referral');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => careerConnectApi.deleteReferral(id),
    onSuccess: () => {
      toast.success('Referral deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['alumni-referrals'] });
      setDeleteId(null);
    },
    onError: (error: Error & { response?: { data?: { error?: { message?: string } } } }) => {
      toast.error(error.response?.data?.error?.message || 'Failed to delete referral');
      setDeleteId(null);
    },
  });

  const handleCreateReferral = () => {
    if (!newCompanyName || !newRoleTitle) {
      toast.error('Company name and role title are required');
      return;
    }
    createMutation.mutate({
      companyName: newCompanyName,
      roleTitle: newRoleTitle,
      jobType: newJobType || undefined,
      description: newDescription || undefined,
      applicationDeadline: newDeadline || undefined,
    });
  };

  const referrals: Referral[] = data?.data || [];
  const meta = data?.meta;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/career-connect')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Alumni Referrals</h1>
            <p className="text-muted-foreground">Job referrals from alumni network</p>
          </div>
        </div>
        {canCreate && (
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Referral
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by company or role..."
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
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
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
          ) : referrals.length === 0 ? (
            <div className="text-center py-12">
              <Share2 className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-medium">No referrals found</h3>
              <p className="text-muted-foreground">
                {search || statusFilter
                  ? 'Try adjusting your filters'
                  : 'No referral opportunities available yet'}
              </p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Company</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Job Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Students Referred</TableHead>
                    <TableHead>Deadline</TableHead>
                    <TableHead className="w-[60px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {referrals.map((referral) => (
                    <TableRow key={referral._id}>
                      <TableCell>
                        <Link
                          href={`/career-connect/alumni/referrals/${referral._id}`}
                          className="font-medium hover:underline"
                        >
                          {referral.companyName}
                        </Link>
                      </TableCell>
                      <TableCell>{referral.roleTitle}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {jobTypeLabels[referral.jobType || ''] || referral.jobType || '-'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={statusColors[referral.status] || ''}>
                          {referral.status === 'in_progress' ? 'In Progress' : referral.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{referral.studentsReferred?.length || 0}</TableCell>
                      <TableCell>
                        {referral.applicationDeadline
                          ? new Date(referral.applicationDeadline).toLocaleDateString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })
                          : '-'}
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
                                router.push(`/career-connect/alumni/referrals/${referral._id}`)
                              }
                            >
                              <Eye className="mr-2 h-4 w-4" />
                              View
                            </DropdownMenuItem>
                            {canDelete && (
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => setDeleteId(referral._id)}
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

      {/* Create Referral Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Referral</DialogTitle>
            <DialogDescription>Create a new job referral opportunity.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-4 grid-cols-2">
              <div className="space-y-2">
                <Label>Company Name *</Label>
                <Input
                  value={newCompanyName}
                  onChange={(e) => setNewCompanyName(e.target.value)}
                  placeholder="e.g. Google"
                />
              </div>
              <div className="space-y-2">
                <Label>Role Title *</Label>
                <Input
                  value={newRoleTitle}
                  onChange={(e) => setNewRoleTitle(e.target.value)}
                  placeholder="e.g. Software Engineer"
                />
              </div>
            </div>
            <div className="grid gap-4 grid-cols-2">
              <div className="space-y-2">
                <Label>Job Type</Label>
                <Select value={newJobType} onValueChange={setNewJobType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="job">Full-time Job</SelectItem>
                    <SelectItem value="internship">Internship</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Application Deadline</Label>
                <DatePicker
                  value={newDeadline}
                  onChange={(iso) => setNewDeadline(iso)}
                  disablePast
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Describe the role and requirements..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateReferral} disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Creating...' : 'Create Referral'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Referral</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this referral? This action cannot be undone.
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
