'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';
import { expenseApi } from '@/lib/api';
import { usePermissions } from '@/hooks/usePermissions';
import { getErrorMessage } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { DatePicker } from '@/components/ui/date-picker';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Wallet, Plus, MoreHorizontal, Edit, Trash2, Loader2, Eye } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

interface BudgetFormData {
  name: string;
  description: string;
  category: string;
  department: string;
  allocated: number;
  startDate: string;
  endDate: string;
}

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-success/10 text-success border-success/20',
  exhausted: 'bg-destructive/10 text-destructive border-destructive/20',
  closed: 'bg-muted text-muted-foreground',
};

export default function BudgetsPage() {
  const { hasPermission } = usePermissions();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Record<string, unknown> | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { register, handleSubmit, reset, control } = useForm<BudgetFormData>();

  const { data, isLoading } = useQuery({
    queryKey: ['budgets'],
    queryFn: () => expenseApi.getBudgets({ limit: 100 }),
  });

  const saveMutation = useMutation({
    mutationFn: (formData: BudgetFormData) => {
      const payload = {
        name: formData.name,
        description: formData.description || undefined,
        category: formData.category || undefined,
        department: formData.department || undefined,
        allocated: Number(formData.allocated),
        period: { startDate: formData.startDate, endDate: formData.endDate },
      };
      return editingBudget
        ? expenseApi.updateBudget(editingBudget._id as string, payload)
        : expenseApi.createBudget(payload);
    },
    onSuccess: () => {
      toast.success(editingBudget ? 'Budget updated' : 'Budget created');
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      closeDialog();
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => expenseApi.deleteBudget(id),
    onSuccess: () => {
      toast.success('Budget deleted');
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      setDeleteId(null);
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingBudget(null);
    reset({
      name: '',
      description: '',
      category: '',
      department: '',
      allocated: 0,
      startDate: '',
      endDate: '',
    });
  };

  const openEdit = (budget: Record<string, unknown>) => {
    setEditingBudget(budget);
    const period = budget.period as Record<string, unknown> | undefined;
    reset({
      name: budget.name as string,
      description: (budget.description as string) || '',
      category: (budget.category as string) || '',
      department: (budget.department as string) || '',
      allocated: budget.allocated as number,
      startDate: period?.startDate
        ? new Date(period.startDate as string).toISOString().split('T')[0]
        : '',
      endDate: period?.endDate
        ? new Date(period.endDate as string).toISOString().split('T')[0]
        : '',
    });
    setDialogOpen(true);
  };

  const budgets = data?.data || [];

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(n);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Budgets</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage expense budgets and track utilization
          </p>
        </div>
        {hasPermission('expense.budgets', 'create') && (
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" /> Create Budget
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      ) : budgets.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-16 text-muted-foreground">
            <Wallet className="h-12 w-12 mb-4 opacity-40" />
            <p className="text-lg font-medium">No budgets created</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {budgets.map((budget: Record<string, unknown>) => {
            const allocated = budget.allocated as number;
            const spent = budget.spent as number;
            const remaining = budget.remaining as number;
            const percentage = allocated > 0 ? Math.round((spent / allocated) * 100) : 0;

            return (
              <Card key={budget._id as string} className="hover:shadow-md transition-shadow">
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <p className="font-semibold">{budget.name as string}</p>
                      {budget.department ? (
                        <p className="text-xs text-muted-foreground">{String(budget.department)}</p>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className={`capitalize ${STATUS_COLORS[budget.status as string] || ''}`}
                      >
                        {budget.status as string}
                      </Badge>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`/expenses/budgets/${budget._id}`}>
                              <Eye className="h-4 w-4 mr-2" /> View
                            </Link>
                          </DropdownMenuItem>
                          {hasPermission('expense.budgets', 'edit') && (
                            <DropdownMenuItem onClick={() => openEdit(budget)}>
                              <Edit className="h-4 w-4 mr-2" /> Edit
                            </DropdownMenuItem>
                          )}
                          {hasPermission('expense.budgets', 'delete') && (
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => setDeleteId(budget._id as string)}
                            >
                              <Trash2 className="h-4 w-4 mr-2" /> Delete
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Spent</span>
                      <span className="font-medium">
                        {formatCurrency(spent)} / {formatCurrency(allocated)}
                      </span>
                    </div>
                    <Progress value={percentage} className="h-2" />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{percentage}% used</span>
                      <span>{formatCurrency(remaining)} remaining</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open) closeDialog();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingBudget ? 'Edit Budget' : 'Create Budget'}</DialogTitle>
            <DialogDescription>Set up a budget to track expense spending</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit((data) => saveMutation.mutate(data))} className="space-y-4">
            <div className="space-y-2">
              <Label>Budget Name *</Label>
              <Input
                {...register('name', { required: true })}
                placeholder="e.g. IT Department Q1 Budget"
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea {...register('description')} rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Category</Label>
                <Input {...register('category')} placeholder="e.g. IT" />
              </div>
              <div className="space-y-2">
                <Label>Department</Label>
                <Input {...register('department')} placeholder="e.g. Computer Science" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Allocated Amount (₹) *</Label>
              <Input type="number" min={1} {...register('allocated', { required: true })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Date *</Label>
                <Controller
                  name="startDate"
                  control={control}
                  render={({ field }) => (
                    <DatePicker value={field.value ?? ''} onChange={field.onChange} />
                  )}
                />
              </div>
              <div className="space-y-2">
                <Label>End Date *</Label>
                <Controller
                  name="endDate"
                  control={control}
                  render={({ field }) => (
                    <DatePicker value={field.value ?? ''} onChange={field.onChange} />
                  )}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>
                Cancel
              </Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editingBudget ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!deleteId}
        onOpenChange={(open) => {
          if (!open) setDeleteId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Budget</AlertDialogTitle>
            <AlertDialogDescription>
              This will fail if expenses are linked to this budget.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
            >
              {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
