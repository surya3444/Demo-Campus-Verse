'use client';

import { useState, useEffect } from 'react';
import { PageHeader } from '@/components/ui/page-header';
import { DataTable, Column, DataTableAction } from '@/components/ui/data-table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  CheckCircle,
  XCircle,
  Undo2,
  Clock,
  History,
  IndianRupee,
  FileText,
  Eye,
  AlertCircle,
  Loader2,
  Settings,
} from 'lucide-react';
import { toast } from 'sonner';
import { organizationApi } from '@/lib/api';

interface PendingApproval {
  _id: string;
  type: 'concession' | 'certificate' | 'leave' | 'fee_cancellation';
  studentId: string;
  studentName: string;
  className: string;
  details: string;
  amount?: number;
  requestedAt: string;
  requestedBy: string;
}

interface ApprovalHistory {
  _id: string;
  entityType: string;
  entityId: string;
  action: 'approved' | 'rejected' | 'undone';
  performerName: string;
  performedAt: string;
  reason?: string;
}

const getInitials = (name: string) =>
  name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase();

export default function ApprovalsPage() {
  const [pendingApprovals, setPendingApprovals] = useState<PendingApproval[]>([]);
  const [approvalHistory, setApprovalHistory] = useState<ApprovalHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pending');
  const [selectedApproval, setSelectedApproval] = useState<PendingApproval | null>(null);
  const [selectedHistory, setSelectedHistory] = useState<ApprovalHistory | null>(null);
  const [actionType, setActionType] = useState<'approve' | 'reject' | 'undo' | null>(null);
  const [reason, setReason] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [pendingRes, historyRes] = await Promise.all([
        organizationApi.getPendingApprovals(),
        organizationApi.getApprovalHistory({ limit: 50 }),
      ]);

      // Backend returns { concessions: { data: [...] }, certificates: { data: [...] }, summary }
      // Flatten into a single PendingApproval[] array
      const pending = pendingRes.data || {};
      const flatApprovals: PendingApproval[] = [
        ...(pending.concessions?.data || []).map((c: Record<string, unknown>) => ({
          _id: c._id as string,
          type: 'concession' as const,
          studentId: c.studentId as string,
          studentName: (c.name as string) || 'Unknown',
          className: '',
          details: `Concession: ${c.type || 'N/A'}`,
          amount: c.calculatedAmount as number | undefined,
          requestedAt: c.requestedAt as string,
          requestedBy: c.requestedBy as string,
        })),
        ...(pending.certificates?.data || []).map((c: Record<string, unknown>) => ({
          _id: c._id as string,
          type: 'certificate' as const,
          studentId: c.studentId as string,
          studentName: 'Student',
          className: '',
          details: `Certificate: ${c.certificateType || 'N/A'}`,
          requestedAt: c.requestedAt as string,
          requestedBy: '',
        })),
      ];

      setPendingApprovals(flatApprovals);
      setApprovalHistory(historyRes.data || []);
    } catch (error) {
      console.error('Failed to load approvals:', error);
      toast.error('Failed to load approvals');
    } finally {
      setLoading(false);
    }
  };

  const handleAction = (
    action: 'approve' | 'reject' | 'undo',
    approval?: PendingApproval,
    history?: ApprovalHistory
  ) => {
    if (approval) {
      setSelectedApproval(approval);
    }
    if (history) {
      setSelectedHistory(history);
    }
    setActionType(action);
    setDialogOpen(true);
  };

  const confirmAction = async () => {
    if (actionType === 'reject' && !reason) {
      toast.error('Please provide a reason for rejection');
      return;
    }

    try {
      setProcessing(true);

      if (actionType === 'undo' && selectedHistory) {
        if (selectedHistory.entityType === 'concession') {
          await organizationApi.undoConcessionApproval(selectedHistory.entityId, reason);
        } else if (selectedHistory.entityType === 'fee_cancellation') {
          await organizationApi.undoFeeCancellation(selectedHistory.entityId, reason);
        }
        toast.success('Approval undone successfully');
        await loadData();
      } else {
        toast.success(actionType === 'approve' ? 'Approved successfully' : 'Rejected successfully');
      }
    } catch (error) {
      console.error('Action failed:', error);
      toast.error('Action failed');
    } finally {
      setProcessing(false);
      setDialogOpen(false);
      setReason('');
      setSelectedApproval(null);
      setSelectedHistory(null);
      setActionType(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const pendingColumns: Column<PendingApproval>[] = [
    {
      key: 'studentName',
      header: 'Student',
      sortable: true,
      cell: (row) => (
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10">
            <AvatarFallback className="bg-primary/10 text-primary text-sm">
              {getInitials(row.studentName)}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium">{row.studentName}</p>
            <p className="text-xs text-muted-foreground">{row.studentId}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'className',
      header: 'Class',
      cell: (row) => <Badge variant="outline">{row.className}</Badge>,
    },
    {
      key: 'type',
      header: 'Type',
      cell: (row) => (
        <Badge variant={row.type === 'concession' ? 'secondary' : 'outline'} className="capitalize">
          {row.type}
        </Badge>
      ),
    },
    {
      key: 'details',
      header: 'Details',
      cell: (row) => (
        <div>
          <p className="text-sm">{row.details}</p>
          {row.amount && (
            <p className="text-xs text-success font-medium flex items-center gap-1 mt-1">
              <IndianRupee className="h-3 w-3" />
              {row.amount.toLocaleString()}
            </p>
          )}
        </div>
      ),
    },
    {
      key: 'requestedAt',
      header: 'Requested',
      cell: (row) => (
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm">
            {new Date(row.requestedAt).toLocaleDateString('en-IN', {
              day: 'numeric',
              month: 'short',
            })}
          </span>
        </div>
      ),
    },
  ];

  const pendingActions: DataTableAction<PendingApproval>[] = [
    {
      label: 'View Details',
      icon: <Eye className="mr-2 h-4 w-4" />,
      onClick: (row) => {
        setSelectedApproval(row);
      },
    },
    {
      label: 'Approve',
      icon: <CheckCircle className="mr-2 h-4 w-4" />,
      onClick: (row) => handleAction('approve', row),
    },
    {
      label: 'Reject',
      icon: <XCircle className="mr-2 h-4 w-4" />,
      variant: 'destructive',
      onClick: (row) => handleAction('reject', row),
    },
  ];

  const historyColumns: Column<ApprovalHistory>[] = [
    {
      key: 'entityType',
      header: 'Type',
      cell: (row) => (
        <Badge variant="outline" className="capitalize">
          {row.entityType}
        </Badge>
      ),
    },
    {
      key: 'action',
      header: 'Action',
      cell: (row) => (
        <div className="flex items-center gap-2">
          {row.action === 'approved' ? (
            <CheckCircle className="h-4 w-4 text-success" />
          ) : row.action === 'rejected' ? (
            <XCircle className="h-4 w-4 text-destructive" />
          ) : (
            <Undo2 className="h-4 w-4 text-warning" />
          )}
          <Badge
            variant={
              row.action === 'approved'
                ? 'success'
                : row.action === 'rejected'
                  ? 'destructive'
                  : 'warning'
            }
            className="capitalize"
          >
            {row.action}
          </Badge>
        </div>
      ),
    },
    {
      key: 'performerName',
      header: 'Performed By',
      cell: (row) => <span className="font-medium">{row.performerName}</span>,
    },
    {
      key: 'performedAt',
      header: 'Date',
      cell: (row) => (
        <span className="text-sm">
          {new Date(row.performedAt).toLocaleString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
      ),
    },
    {
      key: 'reason',
      header: 'Reason',
      cell: (row) => <span className="text-sm text-muted-foreground">{row.reason || '-'}</span>,
    },
  ];

  const historyActions: DataTableAction<ApprovalHistory>[] = [
    {
      label: 'Undo',
      icon: <Undo2 className="mr-2 h-4 w-4" />,
      onClick: (row) => handleAction('undo', undefined, row),
      show: (row) =>
        row.action === 'approved' &&
        (row.entityType === 'concession' || row.entityType === 'fee_cancellation'),
    },
  ];

  const pendingCount = pendingApprovals.length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Approvals"
        description="Manage pending approvals and approval history"
        actions={[
          {
            label: 'Settings',
            icon: Settings,
            variant: 'outline',
            href: '/organization/approvals/settings',
          },
        ]}
      />

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-warning/5 border-warning/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending Approvals</p>
                <p className="text-3xl font-bold text-warning">{pendingCount}</p>
              </div>
              <div className="p-3 rounded-full bg-warning/10">
                <AlertCircle className="h-6 w-6 text-warning" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Concession Requests</p>
                <p className="text-3xl font-bold">
                  {pendingApprovals.filter((a) => a.type === 'concession').length}
                </p>
              </div>
              <div className="p-3 rounded-full bg-primary/10">
                <IndianRupee className="h-6 w-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Certificate Requests</p>
                <p className="text-3xl font-bold">
                  {pendingApprovals.filter((a) => a.type === 'certificate').length}
                </p>
              </div>
              <div className="p-3 rounded-full bg-muted">
                <FileText className="h-6 w-6 text-muted-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="pending" className="gap-2">
            <Clock className="h-4 w-4" />
            Pending
            {pendingCount > 0 && (
              <Badge variant="destructive" className="ml-1">
                {pendingCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <History className="h-4 w-4" />
            History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending">
          <Card>
            <CardHeader>
              <CardTitle>Pending Approvals</CardTitle>
              <CardDescription>Items waiting for your approval</CardDescription>
            </CardHeader>
            <CardContent>
              {pendingApprovals.length > 0 ? (
                <DataTable
                  data={pendingApprovals}
                  columns={pendingColumns}
                  actions={pendingActions}
                  searchable
                  searchPlaceholder="Search by student name..."
                />
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <CheckCircle className="h-12 w-12 mx-auto mb-4 text-success" />
                  <p>No pending approvals!</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Approval History</CardTitle>
              <CardDescription>Past approval actions with undo capability</CardDescription>
            </CardHeader>
            <CardContent>
              <DataTable
                data={approvalHistory}
                columns={historyColumns}
                actions={historyActions}
                searchable
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Action Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionType === 'approve'
                ? 'Approve Request'
                : actionType === 'reject'
                  ? 'Reject Request'
                  : 'Undo Approval'}
            </DialogTitle>
            <DialogDescription>
              {actionType === 'approve'
                ? 'Are you sure you want to approve this request?'
                : actionType === 'reject'
                  ? 'Please provide a reason for rejection.'
                  : 'This will reverse the previous approval.'}
            </DialogDescription>
          </DialogHeader>

          {selectedApproval && actionType !== 'undo' && (
            <div className="py-4">
              <div className="p-4 rounded-lg bg-muted/50 space-y-2">
                <p>
                  <span className="text-muted-foreground">Student:</span>{' '}
                  <span className="font-medium">{selectedApproval.studentName}</span>
                </p>
                <p>
                  <span className="text-muted-foreground">Type:</span>{' '}
                  <Badge variant="outline" className="capitalize">
                    {selectedApproval.type}
                  </Badge>
                </p>
                <p>
                  <span className="text-muted-foreground">Details:</span> {selectedApproval.details}
                </p>
                {selectedApproval.amount && (
                  <p>
                    <span className="text-muted-foreground">Amount:</span>{' '}
                    <span className="text-success font-medium">
                      ₹{selectedApproval.amount.toLocaleString()}
                    </span>
                  </p>
                )}
              </div>
            </div>
          )}

          {(actionType === 'reject' || actionType === 'undo') && (
            <div className="space-y-2">
              <Label>Reason {actionType === 'reject' ? '*' : '(optional)'}</Label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Enter reason..."
                rows={3}
              />
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={processing}>
              Cancel
            </Button>
            <Button
              variant={actionType === 'reject' ? 'destructive' : 'default'}
              onClick={confirmAction}
              disabled={processing}
            >
              {processing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {actionType === 'approve' ? 'Approve' : actionType === 'reject' ? 'Reject' : 'Undo'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
