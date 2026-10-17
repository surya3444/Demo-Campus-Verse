'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { expenseApi } from '@/lib/api';
import { usePermissions } from '@/hooks/usePermissions';
import { getErrorMessage } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ArrowLeftRight, MoreHorizontal, CheckCircle, CreditCard } from 'lucide-react';
import { toast } from 'sonner';

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-warning/10 text-warning border-warning/20',
  approved: 'bg-info/10 text-info border-info/20',
  processed: 'bg-success/10 text-success border-success/20',
  rejected: 'bg-destructive/10 text-destructive border-destructive/20',
};

export default function ReimbursementsPage() {
  const { hasPermission } = usePermissions();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['reimbursements', statusFilter, page],
    queryFn: () =>
      expenseApi.getReimbursements({
        status: statusFilter || undefined,
        page,
        limit: 20,
      }),
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => expenseApi.approveReimbursement(id),
    onSuccess: () => {
      toast.success('Reimbursement approved');
      queryClient.invalidateQueries({ queryKey: ['reimbursements'] });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const processMutation = useMutation({
    mutationFn: (id: string) => expenseApi.processReimbursement(id),
    onSuccess: () => {
      toast.success('Reimbursement processed');
      queryClient.invalidateQueries({ queryKey: ['reimbursements'] });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const reimbursements = data?.data || [];
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
          <h1 className="text-2xl font-bold text-foreground">Reimbursements</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Process expense reimbursement requests
          </p>
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

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : reimbursements.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-muted-foreground">
              <ArrowLeftRight className="h-12 w-12 mb-4 opacity-40" />
              <p className="text-lg font-medium">No reimbursements</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground px-4 py-3">
                      RMB #
                    </th>
                    <th className="text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground px-4 py-3">
                      Requested By
                    </th>
                    <th className="text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground px-4 py-3">
                      Amount
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
                  {reimbursements.map((rmb: Record<string, unknown>) => (
                    <tr key={rmb._id as string} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 font-mono text-sm text-primary">
                        {rmb.reimbursementNumber as string}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {String((rmb.requestedBy as Record<string, unknown>)?.userName || '')}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-right">
                        {formatCurrency(rmb.amount as number)}
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant="outline"
                          className={`capitalize ${STATUS_COLORS[rmb.status as string] || ''}`}
                        >
                          {rmb.status as string}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {formatDate(rmb.createdAt as string)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {hasPermission('expense.reimbursements', 'process') && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {rmb.status === 'pending' && (
                                <DropdownMenuItem
                                  onClick={() => approveMutation.mutate(rmb._id as string)}
                                >
                                  <CheckCircle className="h-4 w-4 mr-2" /> Approve
                                </DropdownMenuItem>
                              )}
                              {rmb.status === 'approved' && (
                                <DropdownMenuItem
                                  onClick={() => processMutation.mutate(rmb._id as string)}
                                >
                                  <CreditCard className="h-4 w-4 mr-2" /> Process
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
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
    </div>
  );
}
