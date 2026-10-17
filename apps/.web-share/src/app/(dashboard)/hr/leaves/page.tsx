'use client';

import { useState, useEffect, useCallback } from 'react';
import { PageHeader, AddButton, ExportButton } from '@/components/ui/page-header';
import { DatePicker } from '@/components/ui/date-picker';
import { DataTable, Column, DataTableAction } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { StatCard } from '@/components/ui/stat-card';
import {
  Calendar,
  CalendarOff,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  Check,
  X,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  };
  leaveType: 'casual' | 'sick' | 'earned' | 'maternity' | 'lop';
  fromDate: string;
  toDate: string;
  days: number;
  isHalfDay?: boolean;
  halfDayType?: 'first-half' | 'second-half';
  reason: string;
  appliedAt: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  approverId?: string;
  approverRemarks?: string;
  approvedAt?: string;
}

const leaveTypeColors: Record<string, string> = {
  casual: 'bg-info/10 text-info border-info/20',
  sick: 'bg-destructive/10 text-destructive border-destructive/20',
  earned: 'bg-success/10 text-success border-success/20',
  maternity: 'bg-accent/10 text-accent border-accent/20',
  lop: 'bg-muted text-muted-foreground',
};

export default function LeavesPage() {
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedLeave, setSelectedLeave] = useState<LeaveRequest | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<'view' | 'add'>('view');
  const [actionLoading, setActionLoading] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await hrApi.getLeaves({ limit: 100 });
      setLeaves(res.data || []);
    } catch (err) {
      console.error('Failed to fetch leaves:', err);
      setError('Failed to load leave requests');
      toast.error('Failed to load leave requests');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleApprove = async (leave: LeaveRequest) => {
    try {
      setActionLoading(true);
      await hrApi.approveLeave(leave._id, 'Approved');
      toast.success(`Leave approved for ${leave.staff?.displayName || 'staff'}`);
      fetchData();
    } catch (err) {
      console.error('Failed to approve leave:', err);
      toast.error('Failed to approve leave');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (leave: LeaveRequest) => {
    try {
      setActionLoading(true);
      await hrApi.rejectLeave(leave._id, 'Rejected');
      toast.success(`Leave rejected for ${leave.staff?.displayName || 'staff'}`);
      fetchData();
    } catch (err) {
      console.error('Failed to reject leave:', err);
      toast.error('Failed to reject leave');
    } finally {
      setActionLoading(false);
    }
  };

  const pendingLeaves = leaves.filter((l) => l.status === 'pending').length;
  const approvedLeaves = leaves.filter((l) => l.status === 'approved').length;
  const rejectedLeaves = leaves.filter((l) => l.status === 'rejected').length;
  const totalDays = leaves.reduce((acc, l) => acc + l.days, 0);

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
            <p className="text-xs text-muted-foreground">{row.staff?.employeeId || row.staffId}</p>
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
          className={`capitalize ${leaveTypeColors[row.leaveType] || leaveTypeColors.lop}`}
        >
          {row.leaveType === 'lop' ? 'LOP' : row.leaveType}
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
            </p>
            {row.fromDate !== row.toDate && (
              <p className="text-muted-foreground">
                to{' '}
                {new Date(row.toDate).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                })}
              </p>
            )}
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
      key: 'status',
      header: 'Status',
      cell: (row) => (
        <Badge
          variant="secondary"
          className={`capitalize ${
            row.status === 'approved'
              ? 'bg-success/10 text-success border-success/20'
              : row.status === 'rejected'
                ? 'bg-destructive/10 text-destructive border-destructive/20'
                : row.status === 'cancelled'
                  ? 'bg-muted text-muted-foreground'
                  : 'bg-warning/10 text-warning border-warning/20'
          }`}
        >
          {row.status === 'pending' && <Clock className="h-3 w-3 mr-1" />}
          {row.status === 'approved' && <CheckCircle className="h-3 w-3 mr-1" />}
          {row.status === 'rejected' && <XCircle className="h-3 w-3 mr-1" />}
          {row.status}
        </Badge>
      ),
    },
  ];

  const actions: DataTableAction<LeaveRequest>[] = [
    {
      label: 'View Details',
      icon: <Eye className="mr-2 h-4 w-4" />,
      onClick: (row) => {
        setSelectedLeave(row);
        setDialogMode('view');
        setDialogOpen(true);
      },
    },
    {
      label: 'Approve',
      icon: <Check className="mr-2 h-4 w-4" />,
      onClick: (row) => handleApprove(row),
      disabled: (row) => row.status !== 'pending' || actionLoading,
    },
    {
      label: 'Reject',
      icon: <X className="mr-2 h-4 w-4" />,
      onClick: (row) => handleReject(row),
      variant: 'destructive',
      disabled: (row) => row.status !== 'pending' || actionLoading,
    },
  ];

  const handleAddNew = () => {
    setSelectedLeave(null);
    setDialogMode('add');
    setDialogOpen(true);
  };

  if (loading && leaves.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading leave requests...</p>
        </div>
      </div>
    );
  }

  if (error && leaves.length === 0) {
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
      <PageHeader title="Leave Management" description="Manage staff leave requests and approvals">
        <ExportButton />
        <AddButton onClick={handleAddNew} label="Apply Leave" />
      </PageHeader>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4 stagger-animation">
        <StatCard title="Pending Requests" value={pendingLeaves} icon={Clock} variant="primary" />
        <StatCard title="Approved" value={approvedLeaves} icon={CheckCircle} variant="success" />
        <StatCard title="Rejected" value={rejectedLeaves} icon={XCircle} />
        <StatCard title="Total Leave Days" value={totalDays} icon={CalendarOff} />
      </div>

      {/* Table */}
      <DataTable
        data={leaves}
        columns={columns}
        actions={actions}
        searchable
        searchPlaceholder="Search by staff name, department..."
      />

      {/* Leave Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {dialogMode === 'view' ? 'Leave Request Details' : 'Apply for Leave'}
            </DialogTitle>
            <DialogDescription>
              {dialogMode === 'view'
                ? `Leave request from ${selectedLeave?.staff?.displayName || 'staff member'}`
                : 'Fill in the leave application details'}
            </DialogDescription>
          </DialogHeader>

          {dialogMode === 'view' && selectedLeave ? (
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
                  </div>
                </div>
                <Badge
                  className={
                    selectedLeave.status === 'approved'
                      ? 'bg-success/10 text-success'
                      : selectedLeave.status === 'rejected'
                        ? 'bg-destructive/10 text-destructive'
                        : selectedLeave.status === 'cancelled'
                          ? 'bg-muted text-muted-foreground'
                          : 'bg-warning/10 text-warning'
                  }
                >
                  {selectedLeave.status}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-lg border">
                  <p className="text-sm text-muted-foreground">Leave Type</p>
                  <Badge
                    variant="secondary"
                    className={`capitalize mt-1 ${leaveTypeColors[selectedLeave.leaveType] || leaveTypeColors.lop}`}
                  >
                    {selectedLeave.leaveType === 'lop' ? 'LOP' : selectedLeave.leaveType}
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

              {selectedLeave.approverRemarks && (
                <div
                  className={`p-4 rounded-lg border ${
                    selectedLeave.status === 'approved'
                      ? 'bg-success/5 border-success/20'
                      : selectedLeave.status === 'rejected'
                        ? 'bg-destructive/5 border-destructive/20'
                        : ''
                  }`}
                >
                  <p className="text-sm text-muted-foreground">Remarks</p>
                  <p className="font-medium">{selectedLeave.approverRemarks}</p>
                </div>
              )}

              {selectedLeave.status === 'pending' && (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1 gap-2"
                    onClick={() => {
                      handleReject(selectedLeave);
                      setDialogOpen(false);
                    }}
                    disabled={actionLoading}
                  >
                    <X className="h-4 w-4" />
                    Reject
                  </Button>
                  <Button
                    className="flex-1 gap-2"
                    onClick={() => {
                      handleApprove(selectedLeave);
                      setDialogOpen(false);
                    }}
                    disabled={actionLoading}
                  >
                    <Check className="h-4 w-4" />
                    Approve
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <form className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="staff">Staff Member</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Select staff" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="emp1">Priya Sharma - Science</SelectItem>
                    <SelectItem value="emp2">Rajesh Kumar - Mathematics</SelectItem>
                    <SelectItem value="emp3">Anita Verma - English</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="type">Leave Type</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="casual">Casual Leave</SelectItem>
                    <SelectItem value="sick">Sick Leave</SelectItem>
                    <SelectItem value="earned">Earned Leave</SelectItem>
                    <SelectItem value="maternity">Maternity Leave</SelectItem>
                    <SelectItem value="unpaid">Unpaid Leave</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="from">From Date</Label>
                  <DatePicker id="from" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="to">To Date</Label>
                  <DatePicker id="to" />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="reason">Reason</Label>
                <Textarea id="reason" placeholder="Enter reason for leave..." rows={3} />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">Apply Leave</Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
