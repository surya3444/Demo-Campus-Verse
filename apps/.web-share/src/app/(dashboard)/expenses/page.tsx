'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { expenseApi } from '@/lib/api';
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
import {
  Receipt,
  Plus,
  Search,
  MoreHorizontal,
  Eye,
  CheckCircle,
  XCircle,
  Send,
  Loader2,
  IndianRupee,
  Clock,
  Trash2,
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

interface ExpenseFormData {
  title: string;
  description: string;
  category: string;
  amount: number;
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  submitted: 'bg-info/10 text-info border-info/20',
  under_review: 'bg-warning/10 text-warning border-warning/20',
  approved: 'bg-success/10 text-success border-success/20',
  rejected: 'bg-destructive/10 text-destructive border-destructive/20',
  paid: 'bg-success/10 text-success border-success/20',
  cancelled: 'bg-muted text-muted-foreground',
};

const CATEGORIES = [
  { value: 'travel', label: 'Travel' },
  { value: 'supplies', label: 'Supplies' },
  { value: 'equipment', label: 'Equipment' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'events', label: 'Events' },
  { value: 'utilities', label: 'Utilities' },
  { value: 'other', label: 'Other' },
];

const CATEGORY_COLORS: Record<string, string> = {
  travel: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  supplies: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  equipment: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  maintenance: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  events: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400',
  utilities: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
  other: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400',
};

export default function ExpensesPage() {
  const { hasPermission } = usePermissions();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectRemarks, setRejectRemarks] = useState('');

  const { register, handleSubmit, reset, setValue, watch } = useForm<ExpenseFormData>({
    defaultValues: { category: 'other', amount: 0 },
  });

  const { data: statsData } = useQuery({
    queryKey: ['expense-stats'],
    queryFn: () => expenseApi.getExpenseStats(),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['expenses', search, statusFilter, categoryFilter, page],
    queryFn: () =>
      expenseApi.getExpenses({
        search: search || undefined,
        status: statusFilter || undefined,
        category: categoryFilter || undefined,
        page,
        limit: 20,
      }),
  });

  const createMutation = useMutation({
    mutationFn: (formData: ExpenseFormData) =>
      expenseApi.createExpense({
        ...formData,
        amount: Number(formData.amount),
      }),
    onSuccess: () => {
      toast.success('Expense created');
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['expense-stats'] });
      setDialogOpen(false);
      reset({ title: '', description: '', category: 'other', amount: 0 });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const submitMutation = useMutation({
    mutationFn: (id: string) => expenseApi.submitExpense(id),
    onSuccess: () => {
      toast.success('Expense submitted for approval');
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['expense-stats'] });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => expenseApi.approveExpense(id),
    onSuccess: () => {
      toast.success('Expense approved');
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['expense-stats'] });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const rejectMutation = useMutation({
    mutationFn: () => expenseApi.rejectExpense(rejectId!, rejectRemarks),
    onSuccess: () => {
      toast.success('Expense rejected');
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['expense-stats'] });
      setRejectId(null);
      setRejectRemarks('');
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => expenseApi.deleteExpense(id),
    onSuccess: () => {
      toast.success('Expense deleted');
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['expense-stats'] });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const stats = statsData?.data;
  const expenses = data?.data || [];
  const meta = data?.meta;

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(n);
  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Expenses</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage expense requests and approvals
          </p>
        </div>
        {hasPermission('expense.requests', 'create') && (
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" /> New Expense
          </Button>
        )}
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Receipt className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Requests</p>
                  <p className="text-2xl font-bold">{stats.total}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-warning/10">
                  <Clock className="h-5 w-5 text-warning" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Pending</p>
                  <p className="text-2xl font-bold">{stats.pending}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-success/10">
                  <CheckCircle className="h-5 w-5 text-success" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Approved</p>
                  <p className="text-2xl font-bold">{stats.approved}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-info/10">
                  <IndianRupee className="h-5 w-5 text-info" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Amount</p>
                  <p className="text-2xl font-bold">{formatCurrency(stats.totalAmount)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by title, number, requester..."
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
                    {s.replace('_', ' ')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={categoryFilter}
              onValueChange={(v) => {
                setCategoryFilter(v === 'all' ? '' : v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : expenses.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-muted-foreground">
              <Receipt className="h-12 w-12 mb-4 opacity-40" />
              <p className="text-lg font-medium">No expenses found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground px-4 py-3">
                      Expense #
                    </th>
                    <th className="text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground px-4 py-3">
                      Title
                    </th>
                    <th className="text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground px-4 py-3">
                      Category
                    </th>
                    <th className="text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground px-4 py-3">
                      Amount
                    </th>
                    <th className="text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground px-4 py-3">
                      Requested By
                    </th>
                    <th className="text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground px-4 py-3">
                      Status
                    </th>
                    <th className="text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground px-4 py-3">
                      Date
                    </th>
                    <th className="text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground px-4 py-3">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {expenses.map((exp: Record<string, unknown>) => (
                    <tr key={exp._id as string} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 font-mono text-sm text-primary">
                        {exp.expenseNumber as string}
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/expenses/${exp._id}`}
                          className="font-medium hover:text-primary transition-colors"
                        >
                          {exp.title as string}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant="secondary"
                          className={`capitalize ${CATEGORY_COLORS[exp.category as string] || ''}`}
                        >
                          {exp.category as string}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-right">
                        {formatCurrency(exp.amount as number)}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {String((exp.requestedBy as Record<string, unknown>)?.userName || '')}
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant="outline"
                          className={`capitalize ${STATUS_COLORS[exp.status as string] || ''}`}
                        >
                          {(exp.status as string).replace('_', ' ')}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {formatDate(exp.createdAt as string)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <Link href={`/expenses/${exp._id}`}>
                                <Eye className="h-4 w-4 mr-2" /> View
                              </Link>
                            </DropdownMenuItem>
                            {exp.status === 'draft' && (
                              <DropdownMenuItem
                                onClick={() => submitMutation.mutate(exp._id as string)}
                              >
                                <Send className="h-4 w-4 mr-2" /> Submit
                              </DropdownMenuItem>
                            )}
                            {['submitted', 'under_review'].includes(exp.status as string) &&
                              hasPermission('expense.approvals', 'approve') && (
                                <DropdownMenuItem
                                  onClick={() => approveMutation.mutate(exp._id as string)}
                                >
                                  <CheckCircle className="h-4 w-4 mr-2" /> Approve
                                </DropdownMenuItem>
                              )}
                            {['submitted', 'under_review'].includes(exp.status as string) &&
                              hasPermission('expense.approvals', 'reject') && (
                                <DropdownMenuItem onClick={() => setRejectId(exp._id as string)}>
                                  <XCircle className="h-4 w-4 mr-2" /> Reject
                                </DropdownMenuItem>
                              )}
                            {exp.status === 'draft' && (
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => deleteMutation.mutate(exp._id as string)}
                              >
                                <Trash2 className="h-4 w-4 mr-2" /> Delete
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
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
                Showing {expenses.length} of {meta.total}
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

      {/* Create Dialog */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setDialogOpen(false);
            reset();
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Expense Request</DialogTitle>
            <DialogDescription>
              Create an expense request. It will be saved as a draft.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={handleSubmit((data) => createMutation.mutate(data))}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label>Title *</Label>
              <Input
                {...register('title', { required: true })}
                placeholder="e.g. Conference Travel Expenses"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Category *</Label>
                <Select value={watch('category')} onValueChange={(v) => setValue('category', v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Amount (₹) *</Label>
                <Input type="number" min={1} {...register('amount', { required: true })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                {...register('description')}
                rows={3}
                placeholder="Describe the expense..."
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setDialogOpen(false);
                  reset();
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}{' '}
                Create
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog
        open={!!rejectId}
        onOpenChange={(open) => {
          if (!open) {
            setRejectId(null);
            setRejectRemarks('');
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Expense</DialogTitle>
            <DialogDescription>Provide a reason for rejecting this expense</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              value={rejectRemarks}
              onChange={(e) => setRejectRemarks(e.target.value)}
              placeholder="Reason for rejection..."
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRejectId(null);
                setRejectRemarks('');
              }}
            >
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
