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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from '@/components/ui/dropdown-menu';
import {
  Package,
  Plus,
  Search,
  MoreHorizontal,
  Eye,
  Edit,
  Trash2,
  Loader2,
  CheckCircle,
  Wrench,
  ArrowRightLeft,
  Ban,
  AlertTriangle,
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

interface AssetFormData {
  name: string;
  description: string;
  categoryId: string;
  location: string;
  serialNumber: string;
  modelNumber: string;
  manufacturer: string;
  purchaseDate: string;
  purchasePrice: number;
  currentValue: number;
  warrantyExpiry: string;
  condition: string;
  quantity: number;
  unit: string;
  tags: string;
}

const STATUS_OPTIONS = [
  { value: 'available', label: 'Available', color: 'bg-success/10 text-success border-success/20' },
  { value: 'issued', label: 'Issued', color: 'bg-info/10 text-info border-info/20' },
  {
    value: 'maintenance',
    label: 'Maintenance',
    color: 'bg-warning/10 text-warning border-warning/20',
  },
  { value: 'disposed', label: 'Disposed', color: 'bg-muted text-muted-foreground border-muted' },
  {
    value: 'lost',
    label: 'Lost',
    color: 'bg-destructive/10 text-destructive border-destructive/20',
  },
];

const CONDITION_OPTIONS = [
  { value: 'new', label: 'New' },
  { value: 'good', label: 'Good' },
  { value: 'fair', label: 'Fair' },
  { value: 'poor', label: 'Poor' },
  { value: 'damaged', label: 'Damaged' },
];

function getStatusBadge(status: string) {
  const opt = STATUS_OPTIONS.find((s) => s.value === status);
  return (
    <Badge variant="outline" className={opt?.color || ''}>
      {opt?.label || status}
    </Badge>
  );
}

export default function InventoryPage() {
  const { hasPermission } = usePermissions();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [conditionFilter, setConditionFilter] = useState('');
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Record<string, unknown> | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { register, handleSubmit, reset, setValue, watch, control } = useForm<AssetFormData>({
    defaultValues: {
      condition: 'new',
      quantity: 1,
      unit: 'piece',
    },
  });

  const { data: statsData } = useQuery({
    queryKey: ['inventory-stats'],
    queryFn: () => inventoryApi.getAssetStats(),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['inventory-assets', search, statusFilter, conditionFilter, page],
    queryFn: () =>
      inventoryApi.getAssets({
        search: search || undefined,
        status: statusFilter || undefined,
        condition: conditionFilter || undefined,
        page,
        limit: 20,
      }),
  });

  const { data: categoriesData } = useQuery({
    queryKey: ['inventory-categories-all'],
    queryFn: () => inventoryApi.getCategories({ limit: 200 }),
  });

  const createMutation = useMutation({
    mutationFn: (formData: AssetFormData) => {
      const payload: Record<string, unknown> = {
        ...formData,
        purchasePrice: Number(formData.purchasePrice) || 0,
        currentValue: Number(formData.currentValue) || 0,
        quantity: Number(formData.quantity) || 1,
        tags: formData.tags
          ? formData.tags
              .split(',')
              .map((t) => t.trim())
              .filter(Boolean)
          : [],
        purchaseDate: formData.purchaseDate || undefined,
        warrantyExpiry: formData.warrantyExpiry || undefined,
        categoryId: formData.categoryId || undefined,
      };
      return editingAsset
        ? inventoryApi.updateAsset(editingAsset._id as string, payload)
        : inventoryApi.createAsset(payload);
    },
    onSuccess: () => {
      toast.success(editingAsset ? 'Asset updated successfully' : 'Asset created successfully');
      queryClient.invalidateQueries({ queryKey: ['inventory-assets'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-stats'] });
      closeDialog();
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => inventoryApi.deleteAsset(id),
    onSuccess: () => {
      toast.success('Asset deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['inventory-assets'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-stats'] });
      setDeleteId(null);
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      inventoryApi.updateAsset(id, { status }),
    onSuccess: () => {
      toast.success('Asset status updated');
      queryClient.invalidateQueries({ queryKey: ['inventory-assets'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-stats'] });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingAsset(null);
    reset({
      name: '',
      description: '',
      categoryId: '',
      location: '',
      serialNumber: '',
      modelNumber: '',
      manufacturer: '',
      purchaseDate: '',
      purchasePrice: 0,
      currentValue: 0,
      warrantyExpiry: '',
      condition: 'new',
      quantity: 1,
      unit: 'piece',
      tags: '',
    });
  };

  const openEdit = (asset: Record<string, unknown>) => {
    setEditingAsset(asset);
    reset({
      name: (asset.name as string) || '',
      description: (asset.description as string) || '',
      categoryId: (asset.categoryId as string) || '',
      location: (asset.location as string) || '',
      serialNumber: (asset.serialNumber as string) || '',
      modelNumber: (asset.modelNumber as string) || '',
      manufacturer: (asset.manufacturer as string) || '',
      purchaseDate: asset.purchaseDate
        ? new Date(asset.purchaseDate as string).toISOString().split('T')[0]
        : '',
      purchasePrice: (asset.purchasePrice as number) || 0,
      currentValue: (asset.currentValue as number) || 0,
      warrantyExpiry: asset.warrantyExpiry
        ? new Date(asset.warrantyExpiry as string).toISOString().split('T')[0]
        : '',
      condition: (asset.condition as string) || 'new',
      quantity: (asset.quantity as number) || 1,
      unit: (asset.unit as string) || 'piece',
      tags: ((asset.tags as string[]) || []).join(', '),
    });
    setDialogOpen(true);
  };

  const stats = statsData?.data;
  const assets = data?.data || [];
  const meta = data?.meta;
  const categories = categoriesData?.data || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Inventory Assets</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track and manage all institutional assets
          </p>
        </div>
        {hasPermission('inventory.assets', 'create') && (
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Asset
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
                  <Package className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Assets</p>
                  <p className="text-2xl font-bold">{stats.total}</p>
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
                  <p className="text-sm text-muted-foreground">Available</p>
                  <p className="text-2xl font-bold">{stats.available}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-info/10">
                  <Eye className="h-5 w-5 text-info" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Issued</p>
                  <p className="text-2xl font-bold">{stats.issued}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-warning/10">
                  <Wrench className="h-5 w-5 text-warning" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Maintenance</p>
                  <p className="text-2xl font-bold">{stats.maintenance}</p>
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
                placeholder="Search assets by name, code, serial number..."
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
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={conditionFilter}
              onValueChange={(v) => {
                setConditionFilter(v === 'all' ? '' : v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Condition" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Conditions</SelectItem>
                {CONDITION_OPTIONS.map((c) => (
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
          ) : assets.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Package className="h-12 w-12 mb-4 opacity-40" />
              <p className="text-lg font-medium">No assets found</p>
              <p className="text-sm">Add your first asset to get started</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground px-4 py-3">
                      Code
                    </th>
                    <th className="text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground px-4 py-3">
                      Name
                    </th>
                    <th className="text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground px-4 py-3">
                      Category
                    </th>
                    <th className="text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground px-4 py-3">
                      Status
                    </th>
                    <th className="text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground px-4 py-3">
                      Condition
                    </th>
                    <th className="text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground px-4 py-3">
                      Location
                    </th>
                    <th className="text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground px-4 py-3">
                      Assigned To
                    </th>
                    <th className="text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground px-4 py-3">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {assets.map((asset: Record<string, unknown>) => (
                    <tr key={asset._id as string} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3">
                        <span className="font-mono text-sm text-primary">
                          {asset.assetCode as string}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/inventory/assets/${asset._id}`}
                          className="font-medium text-foreground hover:text-primary transition-colors"
                        >
                          {asset.name as string}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {(asset.categoryName as string) || '—'}
                      </td>
                      <td className="px-4 py-3">{getStatusBadge(asset.status as string)}</td>
                      <td className="px-4 py-3">
                        <span className="text-sm capitalize">{asset.condition as string}</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {(asset.location as string) || '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {((asset.assignedTo as Record<string, unknown>)?.userName as string) || '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem asChild>
                              <Link href={`/inventory/assets/${asset._id}`}>
                                <Eye className="h-4 w-4 mr-2" /> View
                              </Link>
                            </DropdownMenuItem>
                            {hasPermission('inventory.assets', 'edit') && (
                              <DropdownMenuItem onClick={() => openEdit(asset)}>
                                <Edit className="h-4 w-4 mr-2" /> Edit
                              </DropdownMenuItem>
                            )}
                            {hasPermission('inventory.assets', 'edit') && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuSub>
                                  <DropdownMenuSubTrigger>
                                    <ArrowRightLeft className="h-4 w-4 mr-2" /> Change Status
                                  </DropdownMenuSubTrigger>
                                  <DropdownMenuSubContent>
                                    {asset.status !== 'available' && (
                                      <DropdownMenuItem
                                        onClick={() =>
                                          statusMutation.mutate({
                                            id: asset._id as string,
                                            status: 'available',
                                          })
                                        }
                                      >
                                        <CheckCircle className="h-4 w-4 mr-2 text-green-600" />{' '}
                                        Available
                                      </DropdownMenuItem>
                                    )}
                                    {asset.status !== 'maintenance' && (
                                      <DropdownMenuItem
                                        onClick={() =>
                                          statusMutation.mutate({
                                            id: asset._id as string,
                                            status: 'maintenance',
                                          })
                                        }
                                      >
                                        <Wrench className="h-4 w-4 mr-2 text-yellow-600" />{' '}
                                        Maintenance
                                      </DropdownMenuItem>
                                    )}
                                    {asset.status !== 'disposed' && (
                                      <DropdownMenuItem
                                        onClick={() =>
                                          statusMutation.mutate({
                                            id: asset._id as string,
                                            status: 'disposed',
                                          })
                                        }
                                      >
                                        <Ban className="h-4 w-4 mr-2 text-gray-500" /> Disposed
                                      </DropdownMenuItem>
                                    )}
                                    {asset.status !== 'lost' && (
                                      <DropdownMenuItem
                                        onClick={() =>
                                          statusMutation.mutate({
                                            id: asset._id as string,
                                            status: 'lost',
                                          })
                                        }
                                      >
                                        <AlertTriangle className="h-4 w-4 mr-2 text-red-600" /> Lost
                                      </DropdownMenuItem>
                                    )}
                                  </DropdownMenuSubContent>
                                </DropdownMenuSub>
                              </>
                            )}
                            {hasPermission('inventory.assets', 'delete') && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onClick={() => setDeleteId(asset._id as string)}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" /> Delete
                                </DropdownMenuItem>
                              </>
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

          {/* Pagination */}
          {meta && meta.totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-4 border-t">
              <p className="text-sm text-muted-foreground">
                Showing <span className="font-medium">{assets.length}</span> of{' '}
                <span className="font-medium">{meta.total}</span> assets
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                >
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {page} of {meta.totalPages}
                </span>
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

      {/* Create/Edit Dialog */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open) closeDialog();
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingAsset ? 'Edit Asset' : 'Add New Asset'}</DialogTitle>
            <DialogDescription>
              {editingAsset
                ? 'Update asset details'
                : 'Fill in the details to register a new asset'}
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={handleSubmit((data) => createMutation.mutate(data))}
            className="space-y-6"
          >
            {/* Basic Info */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-muted-foreground">Basic Information</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Asset Name *</Label>
                  <Input
                    id="name"
                    {...register('name', { required: true })}
                    placeholder="e.g. Dell Laptop"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="categoryId">Category</Label>
                  <Select
                    value={watch('categoryId')}
                    onValueChange={(v) => setValue('categoryId', v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat: Record<string, unknown>) => (
                        <SelectItem key={cat._id as string} value={cat._id as string}>
                          {cat.name as string}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  {...register('description')}
                  placeholder="Optional description"
                  rows={2}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="location">Location</Label>
                  <Input
                    id="location"
                    {...register('location')}
                    placeholder="e.g. Room 201, Block A"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="condition">Condition</Label>
                  <Select
                    value={watch('condition')}
                    onValueChange={(v) => setValue('condition', v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CONDITION_OPTIONS.map((c) => (
                        <SelectItem key={c.value} value={c.value}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="serialNumber">Serial Number</Label>
                  <Input id="serialNumber" {...register('serialNumber')} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="modelNumber">Model Number</Label>
                  <Input id="modelNumber" {...register('modelNumber')} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="manufacturer">Manufacturer</Label>
                  <Input id="manufacturer" {...register('manufacturer')} />
                </div>
              </div>
            </div>

            {/* Purchase Info */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-muted-foreground">Purchase Information</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="purchaseDate">Purchase Date</Label>
                  <Controller
                    name="purchaseDate"
                    control={control}
                    render={({ field }) => (
                      <DatePicker
                        id="purchaseDate"
                        value={field.value ?? ''}
                        onChange={field.onChange}
                      />
                    )}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="warrantyExpiry">Warranty Expiry</Label>
                  <Controller
                    name="warrantyExpiry"
                    control={control}
                    render={({ field }) => (
                      <DatePicker
                        id="warrantyExpiry"
                        value={field.value ?? ''}
                        onChange={field.onChange}
                        disablePast
                      />
                    )}
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="purchasePrice">Purchase Price (₹)</Label>
                  <Input id="purchasePrice" type="number" {...register('purchasePrice')} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="currentValue">Current Value (₹)</Label>
                  <Input id="currentValue" type="number" {...register('currentValue')} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="quantity">Quantity</Label>
                  <Input id="quantity" type="number" min={1} {...register('quantity')} />
                </div>
              </div>
            </div>

            {/* Tags */}
            <div className="space-y-2">
              <Label htmlFor="tags">Tags</Label>
              <Input
                id="tags"
                {...register('tags')}
                placeholder="Comma-separated, e.g. electronics, laptop, IT"
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editingAsset ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deleteId}
        onOpenChange={(open) => {
          if (!open) setDeleteId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Asset</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this asset? This action cannot be undone.
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
