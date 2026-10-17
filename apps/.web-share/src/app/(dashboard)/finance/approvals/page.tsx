'use client';

import { useState, useEffect, useCallback } from 'react';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  CheckCircle,
  Clock,
  Eye,
  GraduationCap,
  IndianRupee,
  Loader2,
  RotateCcw,
  ThumbsDown,
  ThumbsUp,
  Undo2,
} from 'lucide-react';
import { financeApi } from '@/lib/api';
import { toast } from 'sonner';

interface ApprovalRequest {
  _id: string;
  type: 'cancellation' | 'refund';
  receiptNumber: string;
  amount: number;
  refundAmount?: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  student: {
    _id: string;
    admissionNumber: string;
    displayName: string;
  } | null;
  requestedByUser: {
    _id: string;
    displayName: string;
  } | null;
  requestedAt: string;
  reviewedByUser?: {
    _id: string;
    displayName: string;
  } | null;
  reviewedAt?: string;
  reviewRemarks?: string;
}

interface ApprovalStats {
  cancellation: { pending: number; approved: number; rejected: number };
  refund: { pending: number; approved: number; rejected: number };
  totalPending: number;
  totalPendingAmount: number;
}

export default function FinanceApprovalsPage() {
  const [requests, setRequests] = useState<ApprovalRequest[]>([]);
  const [stats, setStats] = useState<ApprovalStats>({
    cancellation: { pending: 0, approved: 0, rejected: 0 },
    refund: { pending: 0, approved: 0, rejected: 0 },
    totalPending: 0,
    totalPendingAmount: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'pending' | 'approved' | 'rejected' | 'all'>(
    'pending'
  );
  const [typeFilter, setTypeFilter] = useState<'all' | 'cancellation' | 'refund'>('all');

  const [selectedRequest, setSelectedRequest] = useState<ApprovalRequest | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [approvalRemarks, setApprovalRemarks] = useState('');
  const [rejectionRemarks, setRejectionRemarks] = useState('');

  const fetchRequests = useCallback(async () => {
    setIsLoading(true);
    try {
      const params: {
        status?: 'pending' | 'approved' | 'rejected';
        type?: 'cancellation' | 'refund';
      } = {};
      if (statusFilter !== 'all') params.status = statusFilter;
      if (typeFilter !== 'all') params.type = typeFilter;
      const response = await financeApi.getApprovalRequests(params);
      if (response.success && response.data) {
        setRequests(Array.isArray(response.data) ? response.data : response.data.requests || []);
      }
    } catch (error) {
      console.error('Failed to fetch approval requests:', error);
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, typeFilter]);

  const fetchStats = useCallback(async () => {
    try {
      const response = await financeApi.getApprovalStats();
      if (response.success && response.data) {
        setStats(response.data);
      }
    } catch (error) {
      console.error('Failed to fetch approval stats:', error);
    }
  }, []);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const handleApprove = async () => {
    if (!selectedRequest) return;
    setIsProcessing(true);
    try {
      const response = await financeApi.approveRequest(selectedRequest._id, approvalRemarks);
      if (response.success) {
        toast.success('Request approved');
        setApproveDialogOpen(false);
        setApprovalRemarks('');
        fetchRequests();
        fetchStats();
      } else {
        toast.error(response.error?.message || 'Failed to approve request');
      }
    } catch {
      toast.error('Failed to approve request');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!selectedRequest || !rejectionRemarks) {
      toast.error('Please provide rejection remarks');
      return;
    }
    setIsProcessing(true);
    try {
      const response = await financeApi.rejectRequest(selectedRequest._id, rejectionRemarks);
      if (response.success) {
        toast.success('Request rejected');
        setRejectDialogOpen(false);
        setRejectionRemarks('');
        fetchRequests();
        fetchStats();
      } else {
        toast.error(response.error?.message || 'Failed to reject request');
      }
    } catch {
      toast.error('Failed to reject request');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Finance Approvals"
        description="Review and process cancellation and refund requests"
      />

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-amber-500/10 flex items-center justify-center">
                <Clock className="h-6 w-6 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pending</p>
                <p className="text-2xl font-bold">{stats.totalPending}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <IndianRupee className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pending Amount</p>
                <p className="text-2xl font-bold">
                  ₹{(stats.totalPendingAmount / 1000).toFixed(0)}K
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-orange-500/10 flex items-center justify-center">
                <RotateCcw className="h-6 w-6 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Cancellations</p>
                <p className="text-2xl font-bold">{stats.cancellation.pending}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-purple-500/10 flex items-center justify-center">
                <Undo2 className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Refunds</p>
                <p className="text-2xl font-bold">{stats.refund.pending}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Requests List */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle>Approval Requests</CardTitle>
              <CardDescription>
                Review and approve cancellation and refund requests submitted by collection staff
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Select
                value={statusFilter}
                onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}
              >
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                  <SelectItem value="all">All</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={typeFilter}
                onValueChange={(v) => setTypeFilter(v as typeof typeFilter)}
              >
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  <SelectItem value="cancellation">Cancellation</SelectItem>
                  <SelectItem value="refund">Refund</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">Loading requests...</span>
            </div>
          ) : requests.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <CheckCircle className="h-12 w-12 mx-auto mb-4 text-emerald-500/50" />
              <p className="font-medium">No requests found</p>
              <p className="text-sm">
                {statusFilter === 'pending'
                  ? 'All approval requests have been processed'
                  : 'Try a different filter'}
              </p>
            </div>
          ) : (
            <ScrollArea className="h-[600px]">
              <div className="space-y-3">
                {requests.map((request) => (
                  <div
                    key={request._id}
                    className="p-4 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-4 min-w-0">
                        <div
                          className={`h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                            request.type === 'cancellation'
                              ? 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400'
                              : 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400'
                          }`}
                        >
                          {request.type === 'cancellation' ? (
                            <RotateCcw className="h-5 w-5" />
                          ) : (
                            <Undo2 className="h-5 w-5" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge
                              className={
                                request.type === 'cancellation'
                                  ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                                  : 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                              }
                            >
                              {request.type === 'cancellation' ? 'Cancellation' : 'Refund'}
                            </Badge>
                            <Badge
                              variant="outline"
                              className={
                                request.status === 'pending'
                                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                                  : request.status === 'approved'
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : 'bg-destructive/10 text-destructive border-destructive/20'
                              }
                            >
                              {request.status}
                            </Badge>
                            <span className="font-mono text-sm text-muted-foreground">
                              {request.receiptNumber}
                            </span>
                          </div>
                          {request.student && (
                            <div className="flex items-center gap-2 mt-1">
                              <GraduationCap className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium text-sm">
                                {request.student.displayName}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                ({request.student.admissionNumber})
                              </span>
                            </div>
                          )}
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-1">
                            {request.reason}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 flex-shrink-0">
                        <div className="text-right">
                          <p className="font-bold">₹{request.amount.toLocaleString()}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(request.requestedAt).toLocaleDateString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                            })}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => {
                              setSelectedRequest(request);
                              setViewDialogOpen(true);
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {request.status === 'pending' && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                                onClick={() => {
                                  setSelectedRequest(request);
                                  setApproveDialogOpen(true);
                                }}
                              >
                                <ThumbsUp className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => {
                                  setSelectedRequest(request);
                                  setRejectDialogOpen(true);
                                }}
                              >
                                <ThumbsDown className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* View Request Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Request Details</DialogTitle>
            <DialogDescription>View complete request information</DialogDescription>
          </DialogHeader>
          {selectedRequest && (
            <div className="space-y-4">
              <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/50">
                <div
                  className={`h-12 w-12 rounded-xl flex items-center justify-center ${
                    selectedRequest.type === 'cancellation'
                      ? 'bg-orange-100 text-orange-600'
                      : 'bg-purple-100 text-purple-600'
                  }`}
                >
                  {selectedRequest.type === 'cancellation' ? (
                    <RotateCcw className="h-6 w-6" />
                  ) : (
                    <Undo2 className="h-6 w-6" />
                  )}
                </div>
                <div>
                  <h3 className="font-semibold capitalize">{selectedRequest.type} Request</h3>
                  <p className="text-sm text-muted-foreground font-mono">
                    {selectedRequest.receiptNumber}
                  </p>
                </div>
              </div>
              {selectedRequest.student && (
                <div className="p-3 rounded-lg border">
                  <p className="text-sm text-muted-foreground">Student</p>
                  <div className="flex items-center gap-2 mt-1">
                    <GraduationCap className="h-4 w-4 text-primary" />
                    <span className="font-medium">{selectedRequest.student.displayName}</span>
                    <Badge variant="outline" className="ml-auto">
                      {selectedRequest.student.admissionNumber}
                    </Badge>
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 rounded-lg border">
                  <p className="text-sm text-muted-foreground">Transaction Amount</p>
                  <p className="text-xl font-bold mt-1">
                    ₹{selectedRequest.amount.toLocaleString()}
                  </p>
                </div>
                {selectedRequest.type === 'refund' && selectedRequest.refundAmount && (
                  <div className="p-3 rounded-lg border">
                    <p className="text-sm text-muted-foreground">Refund Amount</p>
                    <p className="text-xl font-bold text-purple-600 mt-1">
                      ₹{selectedRequest.refundAmount.toLocaleString()}
                    </p>
                  </div>
                )}
              </div>
              <div className="p-3 rounded-lg border">
                <p className="text-sm text-muted-foreground">Reason</p>
                <p className="mt-1">{selectedRequest.reason}</p>
              </div>
              <div className="text-sm text-muted-foreground">
                Requested by: {selectedRequest.requestedByUser?.displayName || 'Unknown'} on{' '}
                {new Date(selectedRequest.requestedAt).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Approve Dialog */}
      <Dialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ThumbsUp className="h-5 w-5 text-emerald-600" />
              Approve Request
            </DialogTitle>
            <DialogDescription>
              Approve {selectedRequest?.type} request for {selectedRequest?.student?.displayName}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-muted/50">
              <div className="flex justify-between">
                <span>Amount</span>
                <span className="font-bold">
                  ₹
                  {(selectedRequest?.type === 'refund' && selectedRequest?.refundAmount
                    ? selectedRequest.refundAmount
                    : selectedRequest?.amount || 0
                  ).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between mt-2 text-sm text-muted-foreground">
                <span>Reason</span>
                <span>{selectedRequest?.reason}</span>
              </div>
            </div>
            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-sm">
              <p className="font-medium text-amber-700 dark:text-amber-400">
                {selectedRequest?.type === 'cancellation'
                  ? 'This will cancel the transaction and reverse the payment.'
                  : 'This will process the refund and update the student balance.'}
              </p>
            </div>
            <div className="space-y-2">
              <Label>Approval Remarks (Optional)</Label>
              <Textarea
                placeholder="Add any remarks..."
                value={approvalRemarks}
                onChange={(e) => setApprovalRemarks(e.target.value)}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setApproveDialogOpen(false)}
              disabled={isProcessing}
            >
              Cancel
            </Button>
            <Button
              onClick={handleApprove}
              disabled={isProcessing}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Approving...
                </>
              ) : (
                'Approve'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ThumbsDown className="h-5 w-5 text-destructive" />
              Reject Request
            </DialogTitle>
            <DialogDescription>
              Reject {selectedRequest?.type} request for {selectedRequest?.student?.displayName}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-muted/50">
              <div className="flex justify-between">
                <span>Amount</span>
                <span className="font-bold">₹{selectedRequest?.amount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between mt-2 text-sm text-muted-foreground">
                <span>Reason</span>
                <span>{selectedRequest?.reason}</span>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Rejection Remarks *</Label>
              <Textarea
                placeholder="Please provide a reason for rejection..."
                value={rejectionRemarks}
                onChange={(e) => setRejectionRemarks(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRejectDialogOpen(false)}
              disabled={isProcessing}
            >
              Cancel
            </Button>
            <Button
              onClick={handleReject}
              disabled={isProcessing || !rejectionRemarks}
              variant="destructive"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Rejecting...
                </>
              ) : (
                'Reject'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
