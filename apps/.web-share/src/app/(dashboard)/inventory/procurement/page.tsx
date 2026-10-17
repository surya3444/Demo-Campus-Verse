'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Controller, useFieldArray, useForm } from 'react-hook-form';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  ClipboardList,
  Plus,
  Search,
  MoreHorizontal,
  Eye,
  CheckCircle,
  PackageCheck,
  Loader2,
  Trash2,
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

interface ProcurementFormData {
  title: string;
  description: string;
  vendor: { name: string; contact: string; email: string };
  items: { name: string; quantity: number; unitPrice: number }[];
  expectedDate: string;
  remarks: string;
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  submitted: 'bg-info/10 text-info border-info/20',
  approved: 'bg-success/10 text-success border-success/20',
  ordered: 'bg-primary/10 text-primary border-primary/20',
  received: 'bg-success/10 text-success border-success/20',
  cancelled: 'bg-destructive/10 text-destructive border-destructive/20',
};

export default function ProcurementPage() {
  const { hasPermission } = usePermissions();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);

  const { register, handleSubmit, reset, control } = useForm<ProcurementFormData>({
    defaultValues: { items: [{ name: '', quantity: 1, unitPrice: 0 }] },
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'items' });

  const { data, isLoading } = useQuery({
    queryKey: ['procurements', search, statusFilter, page],
    queryFn: () =>
      inventoryApi.getProcurements({
        search: search || undefined,
        status: statusFilter || undefined,
        page,
        limit: 20,
      }),
  });

  const createMutation = useMutation({
    mutationFn: (formData: ProcurementFormData) => {
      const payload = {
        ...formData,
        items: formData.items.map((item) => ({
          ...item,
          quantity: Number(item.quantity),
          unitPrice: Number(item.unitPrice),
          totalPrice: Number(item.quantity) * Number(item.unitPrice),
        })),
        expectedDate: formData.expectedDate || undefined,
      };
      return inventoryApi.createProcurement(payload);
    },
    onSuccess: () => {
      toast.success('Procurement order created');
      queryClient.invalidateQueries({ queryKey: ['procurements'] });
      closeDialog();
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => inventoryApi.approveProcurement(id),
    onSuccess: () => {
      toast.success('Procurement approved');
      queryClient.invalidateQueries({ queryKey: ['procurements'] });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const receiveMutation = useMutation({
    mutationFn: (id: string) => inventoryApi.receiveProcurement(id),
    onSuccess: (data) => {
      toast.success(data.message || 'Procurement received & assets created');
      queryClient.invalidateQueries({ queryKey: ['procurements'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-assets'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-stats'] });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const closeDialog = () => {
    setDialogOpen(false);
    reset({
      title: '',
      description: '',
      vendor: { name: '', contact: '', email: '' },
      items: [{ name: '', quantity: 1, unitPrice: 0 }],
      expectedDate: '',
      remarks: '',
    });
  };

  const procurements = data?.data || [];
  const meta = data?.meta;

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
          <h1 className="text-2xl font-bold text-foreground">Procurement</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage purchase orders and receiving</p>
        </div>
        {hasPermission('inventory.procurement', 'create') && (
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" /> New Purchase Order
          </Button>
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by title, PO number, vendor..."
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

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : procurements.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-muted-foreground">
              <ClipboardList className="h-12 w-12 mb-4 opacity-40" />
              <p className="text-lg font-medium">No procurement orders</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground px-4 py-3">
                      PO #
                    </th>
                    <th className="text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground px-4 py-3">
                      Title
                    </th>
                    <th className="text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground px-4 py-3">
                      Vendor
                    </th>
                    <th className="text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground px-4 py-3">
                      Items
                    </th>
                    <th className="text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground px-4 py-3">
                      Amount
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
                  {procurements.map((po: Record<string, unknown>) => (
                    <tr key={po._id as string} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 font-mono text-sm text-primary">
                        {po.procurementNumber as string}
                      </td>
                      <td className="px-4 py-3 font-medium">{po.title as string}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {(po.vendor as Record<string, unknown>)?.name as string}
                      </td>
                      <td className="px-4 py-3 text-sm">{(po.items as unknown[])?.length || 0}</td>
                      <td className="px-4 py-3 text-sm font-medium text-right">
                        {formatCurrency(po.totalAmount as number)}
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant="outline"
                          className={`capitalize ${STATUS_COLORS[po.status as string] || ''}`}
                        >
                          {po.status as string}
                        </Badge>
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
                              <Link href={`/inventory/procurement/${po._id}`}>
                                <Eye className="h-4 w-4 mr-2" /> View
                              </Link>
                            </DropdownMenuItem>
                            {po.status === 'submitted' &&
                              hasPermission('inventory.procurement', 'approve') && (
                                <DropdownMenuItem
                                  onClick={() => approveMutation.mutate(po._id as string)}
                                >
                                  <CheckCircle className="h-4 w-4 mr-2" /> Approve
                                </DropdownMenuItem>
                              )}
                            {['approved', 'ordered'].includes(po.status as string) &&
                              hasPermission('inventory.procurement', 'edit') && (
                                <DropdownMenuItem
                                  onClick={() => receiveMutation.mutate(po._id as string)}
                                >
                                  <PackageCheck className="h-4 w-4 mr-2" /> Mark Received
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

      {/* Create Dialog */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open) closeDialog();
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Purchase Order</DialogTitle>
            <DialogDescription>Create a procurement request for new assets</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={handleSubmit((data) => createMutation.mutate(data))}
            className="space-y-6"
          >
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Title *</Label>
                <Input
                  {...register('title', { required: true })}
                  placeholder="e.g. IT Equipment Q1 2026"
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea {...register('description')} rows={2} />
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="text-sm font-medium text-muted-foreground">Vendor Details</h4>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Vendor Name *</Label>
                  <Input {...register('vendor.name', { required: true })} />
                </div>
                <div className="space-y-2">
                  <Label>Contact</Label>
                  <Input {...register('vendor.contact')} />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input type="email" {...register('vendor.email')} />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium text-muted-foreground">Line Items</h4>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => append({ name: '', quantity: 1, unitPrice: 0 })}
                >
                  <Plus className="h-3 w-3 mr-1" /> Add Item
                </Button>
              </div>
              {fields.map((field, index) => (
                <div key={field.id} className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-5 space-y-1">
                    {index === 0 && <Label className="text-xs">Item Name</Label>}
                    <Input
                      {...register(`items.${index}.name`, { required: true })}
                      placeholder="Item name"
                    />
                  </div>
                  <div className="col-span-2 space-y-1">
                    {index === 0 && <Label className="text-xs">Qty</Label>}
                    <Input type="number" min={1} {...register(`items.${index}.quantity`)} />
                  </div>
                  <div className="col-span-3 space-y-1">
                    {index === 0 && <Label className="text-xs">Unit Price (₹)</Label>}
                    <Input type="number" min={0} {...register(`items.${index}.unitPrice`)} />
                  </div>
                  <div className="col-span-2">
                    {fields.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 text-destructive"
                        onClick={() => remove(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <Label>Expected Delivery Date</Label>
              <Controller
                name="expectedDate"
                control={control}
                render={({ field }) => (
                  <DatePicker value={field.value ?? ''} onChange={field.onChange} />
                )}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Create Order
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
