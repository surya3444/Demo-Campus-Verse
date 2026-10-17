'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';
import { inventoryApi } from '@/lib/api';
import { usePermissions } from '@/hooks/usePermissions';
import { getErrorMessage } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { DatePicker } from '@/components/ui/date-picker';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ArrowLeftRight, Plus, Search, RotateCcw, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const STATUS_COLORS: Record<string, string> = {
  issued: 'bg-info/10 text-info border-info/20',
  returned: 'bg-success/10 text-success border-success/20',
  overdue: 'bg-warning/10 text-warning border-warning/20',
  lost: 'bg-destructive/10 text-destructive border-destructive/20',
};

const CONDITION_OPTIONS = ['new', 'good', 'fair', 'poor', 'damaged'];

export default function IssuesPage() {
  const { hasPermission } = usePermissions();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [issueDialogOpen, setIssueDialogOpen] = useState(false);
  const [returnDialogOpen, setReturnDialogOpen] = useState(false);
  const [returnIssueId, setReturnIssueId] = useState<string | null>(null);

  const issueForm = useForm({
    defaultValues: {
      assetId: '',
      userName: '',
      userId: '',
      department: '',
      issueDate: new Date().toISOString().split('T')[0],
      expectedReturnDate: '',
      conditionAtIssue: 'good',
      remarks: '',
    },
  });
  const returnForm = useForm({
    defaultValues: { conditionAtReturn: 'good', returnRemarks: '' },
  });

  const { data, isLoading } = useQuery({
    queryKey: ['inventory-issues', search, statusFilter, page],
    queryFn: () =>
      inventoryApi.getIssues({
        search: search || undefined,
        status: statusFilter || undefined,
        page,
        limit: 20,
      }),
  });

  const issueMutation = useMutation({
    mutationFn: (formData: Record<string, unknown>) => {
      const payload = {
        assetId: formData.assetId,
        issuedTo: {
          userId: formData.userId,
          userName: formData.userName,
          department: formData.department,
        },
        issueDate: formData.issueDate,
        expectedReturnDate: formData.expectedReturnDate || undefined,
        conditionAtIssue: formData.conditionAtIssue,
        remarks: formData.remarks || undefined,
      };
      return inventoryApi.issueAsset(payload);
    },
    onSuccess: () => {
      toast.success('Asset issued successfully');
      queryClient.invalidateQueries({ queryKey: ['inventory-issues'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-assets'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-stats'] });
      setIssueDialogOpen(false);
      issueForm.reset();
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const returnMutation = useMutation({
    mutationFn: (formData: Record<string, unknown>) =>
      inventoryApi.returnAsset(returnIssueId!, formData),
    onSuccess: () => {
      toast.success('Asset returned successfully');
      queryClient.invalidateQueries({ queryKey: ['inventory-issues'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-assets'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-stats'] });
      setReturnDialogOpen(false);
      setReturnIssueId(null);
      returnForm.reset();
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const issues = data?.data || [];
  const meta = data?.meta;

  const formatDate = (d: string) =>
    d
      ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
      : '—';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Issue / Return</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage asset assignments to staff</p>
        </div>
        {hasPermission('inventory.issue', 'create') && (
          <Button onClick={() => setIssueDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" /> Issue Asset
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by asset name, code, or person..."
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
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                {Object.keys(STATUS_COLORS).map((s) => (
                  <SelectItem key={s} value={s} className="capitalize">
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : issues.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-muted-foreground">
              <ArrowLeftRight className="h-12 w-12 mb-4 opacity-40" />
              <p className="text-lg font-medium">No issue records</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground px-4 py-3">
                      Asset
                    </th>
                    <th className="text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground px-4 py-3">
                      Issued To
                    </th>
                    <th className="text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground px-4 py-3">
                      Issue Date
                    </th>
                    <th className="text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground px-4 py-3">
                      Expected Return
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
                  {issues.map((issue: Record<string, unknown>) => (
                    <tr key={issue._id as string} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium text-sm">{issue.assetName as string}</p>
                        <p className="text-xs text-muted-foreground font-mono">
                          {issue.assetCode as string}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm">
                          {(issue.issuedTo as Record<string, unknown>)?.userName as string}
                        </p>
                        {(issue.issuedTo as Record<string, unknown>)?.department ? (
                          <p className="text-xs text-muted-foreground">
                            {String((issue.issuedTo as Record<string, unknown>)?.department)}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-sm">{formatDate(issue.issueDate as string)}</td>
                      <td className="px-4 py-3 text-sm">
                        {issue.expectedReturnDate
                          ? formatDate(issue.expectedReturnDate as string)
                          : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant="outline"
                          className={`capitalize ${STATUS_COLORS[issue.status as string] || ''}`}
                        >
                          {issue.status as string}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {(issue.status === 'issued' || issue.status === 'overdue') &&
                          hasPermission('inventory.issue', 'return') && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setReturnIssueId(issue._id as string);
                                setReturnDialogOpen(true);
                              }}
                            >
                              <RotateCcw className="h-3 w-3 mr-1" /> Return
                            </Button>
                          )}
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
                Page {page} of {meta.totalPages}
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
        </CardContent>
      </Card>

      {/* Issue Dialog */}
      <Dialog open={issueDialogOpen} onOpenChange={setIssueDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Issue Asset</DialogTitle>
            <DialogDescription>Assign an available asset to a staff member</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={issueForm.handleSubmit((data) => issueMutation.mutate(data))}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label>Asset ID *</Label>
              <Input
                {...issueForm.register('assetId', { required: true })}
                placeholder="Paste asset ID (from assets list)"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Staff User ID *</Label>
                <Input
                  {...issueForm.register('userId', { required: true })}
                  placeholder="User ID"
                />
              </div>
              <div className="space-y-2">
                <Label>Staff Name *</Label>
                <Input
                  {...issueForm.register('userName', { required: true })}
                  placeholder="Full name"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Department</Label>
                <Input {...issueForm.register('department')} />
              </div>
              <div className="space-y-2">
                <Label>Condition at Issue</Label>
                <Select
                  value={issueForm.watch('conditionAtIssue')}
                  onValueChange={(v) => issueForm.setValue('conditionAtIssue', v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CONDITION_OPTIONS.map((c) => (
                      <SelectItem key={c} value={c} className="capitalize">
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Issue Date</Label>
                <Controller
                  name="issueDate"
                  control={issueForm.control}
                  render={({ field }) => (
                    <DatePicker value={field.value ?? ''} onChange={field.onChange} />
                  )}
                />
              </div>
              <div className="space-y-2">
                <Label>Expected Return</Label>
                <Controller
                  name="expectedReturnDate"
                  control={issueForm.control}
                  render={({ field }) => (
                    <DatePicker value={field.value ?? ''} onChange={field.onChange} />
                  )}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Remarks</Label>
              <Textarea {...issueForm.register('remarks')} rows={2} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIssueDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={issueMutation.isPending}>
                {issueMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Issue
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Return Dialog */}
      <Dialog
        open={returnDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setReturnDialogOpen(false);
            setReturnIssueId(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Return Asset</DialogTitle>
            <DialogDescription>Record the asset return and condition</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={returnForm.handleSubmit((data) => returnMutation.mutate(data))}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label>Condition at Return *</Label>
              <Select
                value={returnForm.watch('conditionAtReturn')}
                onValueChange={(v) => returnForm.setValue('conditionAtReturn', v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONDITION_OPTIONS.map((c) => (
                    <SelectItem key={c} value={c} className="capitalize">
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Remarks</Label>
              <Textarea
                {...returnForm.register('returnRemarks')}
                rows={2}
                placeholder="Any notes about the return condition"
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setReturnDialogOpen(false);
                  setReturnIssueId(null);
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={returnMutation.isPending}>
                {returnMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}{' '}
                Confirm Return
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
