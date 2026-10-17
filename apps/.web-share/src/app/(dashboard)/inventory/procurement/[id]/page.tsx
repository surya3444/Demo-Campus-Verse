'use client';

import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { inventoryApi } from '@/lib/api';
import { usePermissions } from '@/hooks/usePermissions';
import { getErrorMessage } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, CheckCircle, PackageCheck, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  submitted: 'bg-info/10 text-info border-info/20',
  approved: 'bg-success/10 text-success border-success/20',
  ordered: 'bg-primary/10 text-primary border-primary/20',
  received: 'bg-success/10 text-success border-success/20',
  cancelled: 'bg-destructive/10 text-destructive border-destructive/20',
};

export default function ProcurementDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const id = params.id as string;

  const { data, isLoading } = useQuery({
    queryKey: ['procurement', id],
    queryFn: () => inventoryApi.getProcurement(id),
    enabled: !!id,
  });

  const approveMutation = useMutation({
    mutationFn: () => inventoryApi.approveProcurement(id),
    onSuccess: () => {
      toast.success('Procurement approved');
      queryClient.invalidateQueries({ queryKey: ['procurement', id] });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const receiveMutation = useMutation({
    mutationFn: () => inventoryApi.receiveProcurement(id),
    onSuccess: (data) => {
      toast.success(data.message || 'Received — assets created');
      queryClient.invalidateQueries({ queryKey: ['procurement', id] });
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

  const po = data?.data;
  if (!po)
    return <div className="text-center py-20 text-muted-foreground">Procurement not found</div>;

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(n);
  const formatDate = (d: string | null) =>
    d
      ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
      : '—';

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push('/inventory/procurement')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{po.title}</h1>
            <Badge variant="outline" className={`capitalize ${STATUS_COLORS[po.status] || ''}`}>
              {po.status}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground font-mono mt-1">{po.procurementNumber}</p>
        </div>
        <div className="flex gap-2">
          {po.status === 'submitted' && hasPermission('inventory.procurement', 'approve') && (
            <Button onClick={() => approveMutation.mutate()} disabled={approveMutation.isPending}>
              {approveMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle className="h-4 w-4 mr-2" />
              )}
              Approve
            </Button>
          )}
          {['approved', 'ordered'].includes(po.status) &&
            hasPermission('inventory.procurement', 'edit') && (
              <Button onClick={() => receiveMutation.mutate()} disabled={receiveMutation.isPending}>
                {receiveMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <PackageCheck className="h-4 w-4 mr-2" />
                )}
                Mark Received
              </Button>
            )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Vendor</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p className="font-medium">{po.vendor?.name}</p>
            {po.vendor?.contact && <p className="text-muted-foreground">{po.vendor.contact}</p>}
            {po.vendor?.email && <p className="text-muted-foreground">{po.vendor.email}</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Timeline</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Created</span>
              <span>{formatDate(po.createdAt)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Expected</span>
              <span>{formatDate(po.expectedDate)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Received</span>
              <span>{formatDate(po.receivedDate)}</span>
            </div>
            {po.approvedByName && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Approved by</span>
                <span>{po.approvedByName}</span>
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Total Amount</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-primary">{formatCurrency(po.totalAmount)}</p>
            <p className="text-sm text-muted-foreground mt-1">{po.items?.length || 0} line items</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Line Items</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="text-left text-xs font-semibold uppercase text-muted-foreground px-4 py-3">
                  #
                </th>
                <th className="text-left text-xs font-semibold uppercase text-muted-foreground px-4 py-3">
                  Item
                </th>
                <th className="text-right text-xs font-semibold uppercase text-muted-foreground px-4 py-3">
                  Qty
                </th>
                <th className="text-right text-xs font-semibold uppercase text-muted-foreground px-4 py-3">
                  Unit Price
                </th>
                <th className="text-right text-xs font-semibold uppercase text-muted-foreground px-4 py-3">
                  Total
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {(po.items || []).map((item: Record<string, unknown>, i: number) => (
                <tr key={i} className="hover:bg-muted/20">
                  <td className="px-4 py-3 text-sm text-muted-foreground">{i + 1}</td>
                  <td className="px-4 py-3 text-sm font-medium">{item.name as string}</td>
                  <td className="px-4 py-3 text-sm text-right">{item.quantity as number}</td>
                  <td className="px-4 py-3 text-sm text-right">
                    {formatCurrency(item.unitPrice as number)}
                  </td>
                  <td className="px-4 py-3 text-sm text-right font-medium">
                    {formatCurrency(item.totalPrice as number)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t bg-muted/30">
                <td colSpan={4} className="px-4 py-3 text-sm font-semibold text-right">
                  Total
                </td>
                <td className="px-4 py-3 text-sm font-bold text-right">
                  {formatCurrency(po.totalAmount)}
                </td>
              </tr>
            </tfoot>
          </table>
        </CardContent>
      </Card>

      {po.remarks && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Remarks</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{po.remarks}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
