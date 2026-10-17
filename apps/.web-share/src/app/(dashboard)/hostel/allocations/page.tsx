'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { hostelApi } from '@/lib/api';
import { usePermissions } from '@/hooks/usePermissions';
import { getErrorMessage } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Users, Plus, Search, MoreHorizontal, LogOut, ArrowRightLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

export default function AllocationsPage() {
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const searchParams = useSearchParams();
  const hostelIdParam = searchParams.get('hostelId') || '';

  const [search, setSearch] = useState('');
  const [hostelFilter, setHostelFilter] = useState<string>(hostelIdParam);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [page, setPage] = useState(1);
  const limit = 20;

  // Vacate dialog state
  const [vacateDialogOpen, setVacateDialogOpen] = useState(false);
  const [vacateId, setVacateId] = useState<string | null>(null);
  const [vacateReason, setVacateReason] = useState('');

  // Transfer dialog state
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [transferId, setTransferId] = useState<string | null>(null);
  const [transferHostelId, setTransferHostelId] = useState('');
  const [transferRoomId, setTransferRoomId] = useState('');
  const [transferBedNumber, setTransferBedNumber] = useState('');
  const [transferReason, setTransferReason] = useState('');

  // Fetch hostels
  const { data: hostelsData } = useQuery({
    queryKey: ['hostels-list'],
    queryFn: () => hostelApi.getHostels({ limit: 100 }),
  });

  // Fetch rooms for transfer (filtered by selected hostel)
  const { data: transferRoomsData } = useQuery({
    queryKey: ['transfer-rooms', transferHostelId],
    queryFn: () =>
      hostelApi.getRooms({
        hostelId: transferHostelId,
        status: 'available,partially_occupied',
        limit: 100,
      }),
    enabled: !!transferHostelId,
  });

  // Fetch allocations
  const { data, isLoading } = useQuery({
    queryKey: ['allocations', search, hostelFilter, statusFilter, page],
    queryFn: () =>
      hostelApi.getAllocations({
        search: search || undefined,
        hostelId: hostelFilter || undefined,
        status: statusFilter || undefined,
        page,
        limit,
      }),
  });

  const vacateMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      hostelApi.vacateBed(id, { reason }),
    onSuccess: () => {
      toast.success('Bed vacated successfully');
      queryClient.invalidateQueries({ queryKey: ['allocations'] });
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      queryClient.invalidateQueries({ queryKey: ['hostel-stats'] });
      setVacateDialogOpen(false);
      setVacateId(null);
      setVacateReason('');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const transferMutation = useMutation({
    mutationFn: ({
      id,
      targetHostelId,
      targetRoomId,
      targetBedNumber,
      reason,
    }: {
      id: string;
      targetHostelId: string;
      targetRoomId: string;
      targetBedNumber: string;
      reason: string;
    }) =>
      hostelApi.transferBed(id, {
        targetHostelId,
        targetRoomId,
        targetBedNumber: Number(targetBedNumber),
        reason,
      }),
    onSuccess: () => {
      toast.success('Transfer completed successfully');
      queryClient.invalidateQueries({ queryKey: ['allocations'] });
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      queryClient.invalidateQueries({ queryKey: ['hostel-stats'] });
      setTransferDialogOpen(false);
      setTransferId(null);
      setTransferHostelId('');
      setTransferRoomId('');
      setTransferBedNumber('');
      setTransferReason('');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const handleVacate = (id: string) => {
    setVacateId(id);
    setVacateReason('');
    setVacateDialogOpen(true);
  };

  const handleTransfer = (id: string) => {
    setTransferId(id);
    setTransferHostelId('');
    setTransferRoomId('');
    setTransferBedNumber('');
    setTransferReason('');
    setTransferDialogOpen(true);
  };

  const allocations = data?.data || [];
  const meta = data?.meta || { total: 0, page: 1, limit: 20, totalPages: 1 };
  const hostels = hostelsData?.data || [];
  const transferRooms = transferRoomsData?.data || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Allocations</h1>
          <p className="text-muted-foreground">Manage hostel bed allocations for students</p>
        </div>
        {hasPermission('hostel.allocations', 'create') && (
          <Button asChild>
            <Link href="/hostel/allocations/new">
              <Plus className="mr-2 h-4 w-4" />
              New Allocation
            </Link>
          </Button>
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by student name..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="pl-10"
              />
            </div>
            <Select
              value={hostelFilter || 'all'}
              onValueChange={(val) => {
                setHostelFilter(val === 'all' ? '' : val);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Hostels" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Hostels</SelectItem>
                {hostels.map((h: { _id: string; name: string }) => (
                  <SelectItem key={h._id} value={h._id}>
                    {h.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={statusFilter || 'all'}
              onValueChange={(val) => {
                setStatusFilter(val === 'all' ? '' : val);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="vacated">Vacated</SelectItem>
                <SelectItem value="transferred">Transferred</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Allocations Table */}
      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : allocations.length === 0 ? (
            <div className="text-center py-12">
              <Users className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-medium">No allocations found</h3>
              <p className="text-muted-foreground">
                {search || hostelFilter || statusFilter
                  ? 'Try adjusting your filters'
                  : 'Create a new allocation to get started'}
              </p>
              {!search && hasPermission('hostel.allocations', 'create') && (
                <Button className="mt-4" asChild>
                  <Link href="/hostel/allocations/new">
                    <Plus className="mr-2 h-4 w-4" /> New Allocation
                  </Link>
                </Button>
              )}
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Hostel</TableHead>
                    <TableHead>Room</TableHead>
                    <TableHead>Bed</TableHead>
                    <TableHead>Allocated Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allocations.map(
                    (alloc: {
                      _id: string;
                      studentName: string;
                      studentId: string;
                      hostelName: string;
                      hostelId: string;
                      roomNumber: string;
                      roomId: string;
                      bedNumber: string | number;
                      allocatedDate: string;
                      vacatedDate?: string;
                      status: string;
                    }) => (
                      <TableRow key={alloc._id}>
                        <TableCell className="font-medium">{alloc.studentName}</TableCell>
                        <TableCell>{alloc.hostelName}</TableCell>
                        <TableCell>{alloc.roomNumber}</TableCell>
                        <TableCell>Bed {alloc.bedNumber}</TableCell>
                        <TableCell>{new Date(alloc.allocatedDate).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              alloc.status === 'active'
                                ? 'default'
                                : alloc.status === 'vacated'
                                  ? 'secondary'
                                  : 'outline'
                            }
                          >
                            {alloc.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {alloc.status === 'active' && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-8 w-8 p-0">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {hasPermission('hostel.allocations', 'edit') && (
                                  <DropdownMenuItem onClick={() => handleVacate(alloc._id)}>
                                    <LogOut className="mr-2 h-4 w-4" />
                                    Vacate Bed
                                  </DropdownMenuItem>
                                )}
                                {hasPermission('hostel.allocations', 'edit') && (
                                  <DropdownMenuItem onClick={() => handleTransfer(alloc._id)}>
                                    <ArrowRightLeft className="mr-2 h-4 w-4" />
                                    Transfer
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
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
                    {Math.min(meta.page * meta.limit, meta.total)} of {meta.total} allocations
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

      {/* Vacate Dialog */}
      <Dialog open={vacateDialogOpen} onOpenChange={setVacateDialogOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Vacate Bed</DialogTitle>
            <DialogDescription>
              Please provide a reason for vacating this bed assignment.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="vacate-reason">Reason *</Label>
              <Textarea
                id="vacate-reason"
                value={vacateReason}
                onChange={(e) => setVacateReason(e.target.value)}
                placeholder="e.g., Semester ended, Student request, Disciplinary action"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVacateDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() =>
                vacateId && vacateMutation.mutate({ id: vacateId, reason: vacateReason })
              }
              disabled={!vacateReason.trim() || vacateMutation.isPending}
              variant="destructive"
            >
              {vacateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Vacate Bed
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transfer Dialog */}
      <Dialog open={transferDialogOpen} onOpenChange={setTransferDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Transfer Student</DialogTitle>
            <DialogDescription>
              Select the target hostel, room, and bed to transfer this student.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Target Hostel *</Label>
              <Select
                value={transferHostelId}
                onValueChange={(val) => {
                  setTransferHostelId(val);
                  setTransferRoomId('');
                  setTransferBedNumber('');
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select hostel" />
                </SelectTrigger>
                <SelectContent>
                  {hostels.map((h: { _id: string; name: string }) => (
                    <SelectItem key={h._id} value={h._id}>
                      {h.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Target Room *</Label>
              <Select
                value={transferRoomId}
                onValueChange={(val) => {
                  setTransferRoomId(val);
                  setTransferBedNumber('');
                }}
                disabled={!transferHostelId}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={transferHostelId ? 'Select room' : 'Select hostel first'}
                  />
                </SelectTrigger>
                <SelectContent>
                  {transferRooms.map(
                    (r: {
                      _id: string;
                      roomNumber: string;
                      capacity: number;
                      occupiedBeds: number;
                    }) => (
                      <SelectItem key={r._id} value={r._id}>
                        Room {r.roomNumber} ({r.occupiedBeds || 0}/{r.capacity} occupied)
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="transfer-bed">Bed Number *</Label>
              <Input
                id="transfer-bed"
                type="number"
                min={1}
                value={transferBedNumber}
                onChange={(e) => setTransferBedNumber(e.target.value)}
                placeholder="Enter bed number"
                disabled={!transferRoomId}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="transfer-reason">Reason</Label>
              <Textarea
                id="transfer-reason"
                value={transferReason}
                onChange={(e) => setTransferReason(e.target.value)}
                placeholder="Reason for transfer"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTransferDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() =>
                transferId &&
                transferMutation.mutate({
                  id: transferId,
                  targetHostelId: transferHostelId,
                  targetRoomId: transferRoomId,
                  targetBedNumber: transferBedNumber,
                  reason: transferReason,
                })
              }
              disabled={
                !transferHostelId ||
                !transferRoomId ||
                !transferBedNumber ||
                transferMutation.isPending
              }
            >
              {transferMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Transfer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
