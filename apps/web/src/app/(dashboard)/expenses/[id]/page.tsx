'use client';

import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { expenseApi } from '@/lib/api';
import { usePermissions } from '@/hooks/usePermissions';
import { getErrorMessage } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, CheckCircle, XCircle, Send, Loader2, CreditCard } from 'lucide-react';
import { toast } from 'sonner';
import { useState } from 'react';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  submitted: 'bg-info/10 text-info border-info/20',
  under_review: 'bg-warning/10 text-warning border-warning/20',
  approved: 'bg-success/10 text-success border-success/20',
  rejected: 'bg-destructive/10 text-destructive border-destructive/20',
  paid: 'bg-success/10 text-success border-success/20',
  cancelled: 'bg-muted text-muted-foreground',
};

const ACTION_ICONS: Record<string, string> = {
  submitted: '📤',
  approved: '✅',
  rejected: '❌',
  paid: '💰',
};

export default function ExpenseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const id = params.id as string;
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectRemarks, setRejectRemarks] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['expense', id],
    queryFn: () => expenseApi.getExpense(id),
    enabled: !!id,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['expense', id] });
    queryClient.invalidateQueries({ queryKey: ['expenses'] });
    queryClient.invalidateQueries({ queryKey: ['expense-stats'] });
  };

  const submitMutation = useMutation({
    mutationFn: () => expenseApi.submitExpense(id),
    onSuccess: () => {
      toast.success('Submitted for approval');
      invalidate();
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const approveMutation = useMutation({
    mutationFn: () => expenseApi.approveExpense(id),
    onSuccess: () => {
      toast.success('Expense approved');
      invalidate();
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const rejectMutation = useMutation({
    mutationFn: () => expenseApi.rejectExpense(id, rejectRemarks),
    onSuccess: () => {
      toast.success('Expense rejected');
      invalidate();
      setRejectOpen(false);
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const markPaidMutation = useMutation({
    mutationFn: () => expenseApi.markExpensePaid(id, {}),
    onSuccess: () => {
      toast.success('Marked as paid');
      invalidate();
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  if (isLoading)
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64" />
      </div>
    );

  const expense = data?.data;
  if (!expense)
    return <div className="text-center py-20 text-muted-foreground">Expense not found</div>;

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(n);
  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  const formatTime = (d: string) =>
    new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push('/expenses')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{expense.title}</h1>
            <Badge
              variant="outline"
              className={`capitalize ${STATUS_COLORS[expense.status] || ''}`}
            >
              {expense.status.replace('_', ' ')}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground font-mono mt-1">{expense.expenseNumber}</p>
        </div>
        <div className="flex gap-2">
          {expense.status === 'draft' && (
            <Button onClick={() => submitMutation.mutate()} disabled={submitMutation.isPending}>
              {submitMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Submit
            </Button>
          )}
          {['submitted', 'under_review'].includes(expense.status) &&
            hasPermission('expense.approvals', 'approve') && (
              <>
                <Button
                  onClick={() => approveMutation.mutate()}
                  disabled={approveMutation.isPending}
                >
                  {approveMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <CheckCircle className="h-4 w-4 mr-2" />
                  )}
                  Approve
                </Button>
                <Button variant="destructive" onClick={() => setRejectOpen(true)}>
                  <XCircle className="h-4 w-4 mr-2" /> Reject
                </Button>
              </>
            )}
          {expense.status === 'approved' && hasPermission('expense.approvals', 'approve') && (
            <Button onClick={() => markPaidMutation.mutate()} disabled={markPaidMutation.isPending}>
              {markPaidMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <CreditCard className="h-4 w-4 mr-2" />
              )}
              Mark Paid
            </Button>
          )}
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Amount</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-primary">{formatCurrency(expense.amount)}</p>
            <Badge variant="secondary" className="mt-2 capitalize">
              {expense.category}
            </Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Requested By</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p className="font-medium">{expense.requestedBy?.userName}</p>
            <p className="text-muted-foreground">Created: {formatDate(expense.createdAt)}</p>
            {expense.paidAt && (
              <p className="text-muted-foreground">Paid: {formatDate(expense.paidAt)}</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Payment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p>
              <span className="text-muted-foreground">Mode:</span> {expense.paymentMode || '—'}
            </p>
            <p>
              <span className="text-muted-foreground">Reference:</span> {expense.paymentRef || '—'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Description */}
      {expense.description && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Description</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{expense.description}</p>
          </CardContent>
        </Card>
      )}

      {/* Approval Trail */}
      <Card>
        <CardHeader>
          <CardTitle>Approval Trail</CardTitle>
        </CardHeader>
        <CardContent>
          {!expense.approvalChain || expense.approvalChain.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No activity yet</p>
          ) : (
            <div className="space-y-4">
              {expense.approvalChain.map((entry: Record<string, unknown>, i: number) => (
                <div key={i} className="flex items-start gap-4 p-3 rounded-lg border bg-muted/20">
                  <span className="text-lg mt-0.5">
                    {ACTION_ICONS[entry.action as string] || '📋'}
                  </span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium capitalize">{String(entry.action)}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(entry.timestamp as string)} at{' '}
                        {formatTime(entry.timestamp as string)}
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      by {String(entry.userName)}
                    </p>
                    {entry.remarks ? (
                      <p className="text-sm mt-1 text-muted-foreground italic">
                        &ldquo;{String(entry.remarks)}&rdquo;
                      </p>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reject Dialog */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Expense</DialogTitle>
          </DialogHeader>
          <Textarea
            value={rejectRemarks}
            onChange={(e) => setRejectRemarks(e.target.value)}
            placeholder="Reason for rejection..."
            rows={3}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={!rejectRemarks || rejectMutation.isPending}
              onClick={() => rejectMutation.mutate()}
            >
              {rejectMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
