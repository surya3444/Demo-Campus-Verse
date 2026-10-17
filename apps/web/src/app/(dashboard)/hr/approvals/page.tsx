'use client';

import { useState, useEffect, useCallback } from 'react';
import { PageHeader } from '@/components/ui/page-header';
import { DataTable, Column, DataTableAction } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { StatCard } from '@/components/ui/stat-card';
import {
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  Eye,
  Check,
  X,
  Loader2,
  AlertCircle,
  Users,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { toast } from 'sonner';
import { hrApi } from '@/lib/api';

interface LeaveRequest {
  _id: string;
  staffId: string;
  staff?: {
    _id: string;
    employeeId: string;
    displayName: string;
    department?: { name: string };
  };
  leaveType: string;
  leaveTypeName?: string;
  fromDate: string;
  toDate: string;
  days: number;
  isHalfDay?: boolean;
  halfDayType?: 'first-half' | 'second-half';
  reason: string;
  appliedAt: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
}

interface ApprovalStats {
  pending: number;
  approvedThisMonth: number;
  rejectedThisMonth: number;
  totalPendingDays: number;
}

const leaveTypeColors: Record<string, string> = {
  casual: 'bg-info/10 text-info border-info/20',
  sick: 'bg-destructive/10 text-destructive border-destructive/20',
  earned: 'bg-success/10 text-success border-success/20',
  maternity: 'bg-accent/10 text-accent border-accent/20',
  lop: 'bg-muted text-muted-foreground',
  // Codes from HR settings
  CL: 'bg-info/10 text-info border-info/20',
  SL: 'bg-destructive/10 text-destructive border-destructive/20',
  EL: 'bg-success/10 text-success border-success/20',
  LWP: 'bg-muted text-muted-foreground',
};

export default function HRApprovalsPage() {
  const [pendingLeaves, setPendingLeaves] = useState<LeaveRequest[]>([]);
  const [stats, setStats] = useState<ApprovalStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedLeave, setSelectedLeave] = useState<LeaveRequest | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectRemarks, setRejectRemarks] = useState('');

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [approvalsRes, statsRes] = await Promise.all([
        hrApi.getPendingApprovals({ limit: 100 }),
        hrApi.getApprovalStats(),
      ]);
      setPendingLeaves(approvalsRes.data || []);
      setStats(statsRes.data || null);
    } catch (err) {
      console.error('Failed to fetch approvals:', err);
      setError('Failed to load pending approvals');
      toast.error('Failed to load pending approvals');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleApprove = async (leave: LeaveRequest, remarks?: string) => {
    try {
      setActionLoading(true);
      await hrApi.approveLeave(leave._id, remarks || 'Approved');
      toast.success(`Leave approved for ${leave.staff?.displayName || 'staff'}`);
      setDialogOpen(false);
      fetchData();
    } catch (err) {
      console.error('Failed to approve leave:', err);
      toast.error('Failed to approve leave');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (leave: LeaveRequest) => {
    if (!rejectRemarks.trim()) {
      toast.error('Please provide rejection remarks');
      return;
    }
    try {
      setActionLoading(true);
      await hrApi.rejectLeave(leave._id, rejectRemarks);
      toast.success(`Leave rejected for ${leave.staff?.displayName || 'staff'}`);
      setRejectDialogOpen(false);
      setRejectRemarks('');
      setDialogOpen(false);
      fetchData();
    } catch (err) {
      console.error('Failed to reject leave:', err);
      toast.error('Failed to reject leave');
    } finally {
      setActionLoading(false);
    }
  };

  const getInitials = (name: string) =>
    name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase();

  const columns: Column<LeaveRequest>[] = [
    {
      key: 'staffName',
      header: 'Staff Member',
      sortable: true,
      cell: (row) => (
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10">
            <AvatarFallback className="bg-primary/10 text-primary text-sm">
              {row.staff?.displayName ? getInitials(row.staff.displayName) : '??'}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium">{row.staff?.displayName || 'Unknown'}</p>
            <p className="text-xs text-muted-foreground">
              {row.staff?.employeeId || row.staffId}
              {row.staff?.department?.name && ` • ${row.staff.department.name}`}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: 'leaveType',
      header: 'Type',
      cell: (row) => (
        <Badge
          variant="secondary"
          className={leaveTypeColors[row.leaveType] || leaveTypeColors.lop}
        >
          {row.leaveTypeName ?? row.leaveType}
        </Badge>
      ),
    },
    {
      key: 'fromDate',
      header: 'Duration',
      cell: (row) => (
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <div className="text-sm">
            <p>
              {new Date(row.fromDate).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
              })}
              {row.fromDate !== row.toDate && (
                <span className="text-muted-foreground">
                  {' - '}
                  {new Date(row.toDate).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                  })}
                </span>
              )}
            </p>
            {row.isHalfDay && (
              <p className="text-xs text-muted-foreground capitalize">
                ({row.halfDayType?.replace('-', ' ')})
              </p>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'days',
      header: 'Days',
      sortable: true,
      cell: (row) => (
        <Badge variant="outline">
          {row.days} {row.days === 1 ? 'day' : 'days'}
        </Badge>
      ),
    },
    {
      key: 'appliedAt',
      header: 'Applied On',
      sortable: true,
      cell: (row) => (
        <span className="text-sm text-muted-foreground">
          {new Date(row.appliedAt).toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          })}
        </span>
      ),
    },
    {
      key: 'waitingTime',
      header: 'Waiting',
      cell: (row) => {
        const appliedDate = new Date(row.appliedAt);
        const now = new Date();
        const diffDays = Math.floor(
          (now.getTime() - appliedDate.getTime()) / (1000 * 60 * 60 * 24)
        );
        return (
          <Badge
            variant="secondary"
            className={
              diffDays > 3
                ? 'bg-destructive/10 text-destructive'
                : diffDays > 1
                  ? 'bg-warning/10 text-warning'
                  : 'bg-muted text-muted-foreground'
            }
          >
            {diffDays === 0 ? 'Today' : `${diffDays} day${diffDays !== 1 ? 's' : ''}`}
          </Badge>
        );
      },
    },
  ];

  const actions: DataTableAction<LeaveRequest>[] = [
    {
      label: 'View Details',
      icon: <Eye className="mr-2 h-4 w-4" />,
      onClick: (row) => {
        setSelectedLeave(row);
        setDialogOpen(true);
      },
    },
    {
      label: 'Approve',
      icon: <Check className="mr-2 h-4 w-4" />,
      onClick: (row) => handleApprove(row),
      disabled: () => actionLoading,
    },
    {
      label: 'Reject',
      icon: <X className="mr-2 h-4 w-4" />,
      onClick: (row) => {
        setSelectedLeave(row);
        setRejectDialogOpen(true);
      },
      variant: 'destructive',
      disabled: () => actionLoading,
    },
  ];

  if (loading && pendingLeaves.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading pending approvals...</p>
        </div>
      </div>
    );
  }

  if (error && pendingLeaves.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <AlertCircle className="h-12 w-12 text-destructive" />
          <p className="text-lg font-medium">{error}</p>
          <Button onClick={fetchData} variant="outline">
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Leave Approvals" description="Review and manage pending leave requests" />

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4 stagger-animation">
        <StatCard
          title="Pending Requests"
          value={stats?.pending || 0}
          icon={Clock}
          variant="primary"
        />
        <StatCard
          title="Approved This Month"
          value={stats?.approvedThisMonth || 0}
          icon={CheckCircle}
          variant="success"
        />
        <StatCard
          title="Rejected This Month"
          value={stats?.rejectedThisMonth || 0}
          icon={XCircle}
        />
        <StatCard title="Pending Days Total" value={stats?.totalPendingDays || 0} icon={Users} />
      </div>

      {/* Pending Approvals Table */}
      {pendingLeaves.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 border rounded-lg bg-muted/20">
          <CheckCircle className="h-12 w-12 text-success mb-4" />
          <p className="text-lg font-medium">All caught up!</p>
          <p className="text-muted-foreground">No pending leave requests to approve.</p>
        </div>
      ) : (
        <DataTable
          data={pendingLeaves}
          columns={columns}
          actions={actions}
          searchable
          searchPlaceholder="Search by staff name, department..."
        />
      )}

      {/* View Details Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Leave Request Details</DialogTitle>
            <DialogDescription>
              Leave request from {selectedLeave?.staff?.displayName || 'staff member'}
            </DialogDescription>
          </DialogHeader>

          {selectedLeave && (
            <div className="space-y-6">
              <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                <div className="flex items-center gap-4">
                  <Avatar className="h-12 w-12">
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {selectedLeave.staff?.displayName
                        ? getInitials(selectedLeave.staff.displayName)
                        : '??'}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">{selectedLeave.staff?.displayName || 'Unknown'}</p>
                    <p className="text-sm text-muted-foreground">
                      {selectedLeave.staff?.employeeId || selectedLeave.staffId}
                    </p>
                    {selectedLeave.staff?.department?.name && (
                      <p className="text-xs text-muted-foreground">
                        {selectedLeave.staff.department.name}
                      </p>
                    )}
                  </div>
                </div>
                <Badge className="bg-warning/10 text-warning">Pending</Badge>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-lg border">
                  <p className="text-sm text-muted-foreground">Leave Type</p>
                  <Badge
                    variant="secondary"
                    className={`mt-1 ${leaveTypeColors[selectedLeave.leaveType] || leaveTypeColors.lop}`}
                  >
                    {selectedLeave.leaveTypeName ?? selectedLeave.leaveType}
                  </Badge>
                </div>
                <div className="p-4 rounded-lg border">
                  <p className="text-sm text-muted-foreground">Duration</p>
                  <p className="font-medium mt-1">
                    {selectedLeave.days} day(s)
                    {selectedLeave.isHalfDay && (
                      <span className="text-muted-foreground text-sm">
                        {' '}
                        ({selectedLeave.halfDayType?.replace('-', ' ')})
                      </span>
                    )}
                  </p>
                </div>
                <div className="p-4 rounded-lg border">
                  <p className="text-sm text-muted-foreground">From</p>
                  <p className="font-medium">
                    {new Date(selectedLeave.fromDate).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </p>
                </div>
                <div className="p-4 rounded-lg border">
                  <p className="text-sm text-muted-foreground">To</p>
                  <p className="font-medium">
                    {new Date(selectedLeave.toDate).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-lg border">
                <p className="text-sm text-muted-foreground mb-1">Reason</p>
                <p>{selectedLeave.reason}</p>
              </div>

              <div className="p-4 rounded-lg border bg-muted/30">
                <p className="text-sm text-muted-foreground mb-1">Applied On</p>
                <p className="font-medium">
                  {new Date(selectedLeave.appliedAt).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}{' '}
                  at{' '}
                  {new Date(selectedLeave.appliedAt).toLocaleTimeString('en-IN', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1 gap-2"
                  onClick={() => {
                    setRejectDialogOpen(true);
                  }}
                  disabled={actionLoading}
                >
                  <X className="h-4 w-4" />
                  Reject
                </Button>
                <Button
                  className="flex-1 gap-2"
                  onClick={() => handleApprove(selectedLeave)}
                  disabled={actionLoading}
                >
                  {actionLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                  Approve
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Reject Dialog with Remarks */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reject Leave Request</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting this leave request.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="remarks">Rejection Remarks *</Label>
              <Textarea
                id="remarks"
                placeholder="Enter reason for rejection..."
                value={rejectRemarks}
                onChange={(e) => setRejectRemarks(e.target.value)}
                rows={3}
              />
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setRejectDialogOpen(false);
                  setRejectRemarks('');
                }}
                disabled={actionLoading}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                className="flex-1 gap-2"
                onClick={() => selectedLeave && handleReject(selectedLeave)}
                disabled={actionLoading || !rejectRemarks.trim()}
              >
                {actionLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <X className="h-4 w-4" />
                )}
                Reject
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
