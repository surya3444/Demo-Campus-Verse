'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { hostelApi } from '@/lib/api';
import { usePermissions } from '@/hooks/usePermissions';
import { getErrorMessage } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
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
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Hotel,
  Plus,
  Search,
  MoreHorizontal,
  Eye,
  Edit,
  Trash2,
  Users,
  Loader2,
  MapPin,
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

interface HostelFormData {
  name: string;
  code: string;
  type: string;
  gender: string;
  totalFloors: number;
  wardenName: string;
  wardenContact: string;
  address: string;
  amenities: string;
  description: string;
}

const HOSTEL_TYPES = [
  { value: 'boys', label: 'Boys Hostel' },
  { value: 'girls', label: 'Girls Hostel' },
  { value: 'co-ed', label: 'Co-Ed Hostel' },
  { value: 'staff', label: 'Staff Quarters' },
];

const typeColors: Record<string, string> = {
  boys: 'bg-blue-100 text-blue-800',
  girls: 'bg-pink-100 text-pink-800',
  'co-ed': 'bg-purple-100 text-purple-800',
  staff: 'bg-gray-100 text-gray-800',
};

export default function HostelsPage() {
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingHostel, setEditingHostel] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['hostels', search, typeFilter],
    queryFn: () =>
      hostelApi.getHostels({
        search: search || undefined,
        type: typeFilter || undefined,
      }),
  });

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<HostelFormData>({
    defaultValues: {
      name: '',
      code: '',
      type: 'boys',
      gender: 'male',
      totalFloors: 1,
      wardenName: '',
      wardenContact: '',
      address: '',
      amenities: '',
      description: '',
    },
  });

  const createMutation = useMutation({
    mutationFn: (formData: HostelFormData) => {
      const payload = {
        ...formData,
        totalFloors: Number(formData.totalFloors),
        amenities: formData.amenities
          ? formData.amenities
              .split(',')
              .map((a) => a.trim())
              .filter(Boolean)
          : [],
      };
      return hostelApi.createHostel(payload as unknown as Record<string, unknown>);
    },
    onSuccess: () => {
      toast.success('Hostel created successfully');
      queryClient.invalidateQueries({ queryKey: ['hostels'] });
      queryClient.invalidateQueries({ queryKey: ['hostel-stats'] });
      setDialogOpen(false);
      reset();
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data: formData }: { id: string; data: HostelFormData }) => {
      const payload = {
        ...formData,
        totalFloors: Number(formData.totalFloors),
        amenities: formData.amenities
          ? formData.amenities
              .split(',')
              .map((a) => a.trim())
              .filter(Boolean)
          : [],
      };
      return hostelApi.updateHostel(id, payload as unknown as Record<string, unknown>);
    },
    onSuccess: () => {
      toast.success('Hostel updated successfully');
      queryClient.invalidateQueries({ queryKey: ['hostels'] });
      queryClient.invalidateQueries({ queryKey: ['hostel-stats'] });
      setDialogOpen(false);
      setEditingHostel(null);
      reset();
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => hostelApi.deleteHostel(id),
    onSuccess: () => {
      toast.success('Hostel deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['hostels'] });
      queryClient.invalidateQueries({ queryKey: ['hostel-stats'] });
      setDeleteId(null);
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
      setDeleteId(null);
    },
  });

  const handleOpenCreate = () => {
    reset({
      name: '',
      code: '',
      type: 'boys',
      gender: 'male',
      totalFloors: 1,
      wardenName: '',
      wardenContact: '',
      address: '',
      amenities: '',
      description: '',
    });
    setEditingHostel(null);
    setDialogOpen(true);
  };

  const handleOpenEdit = (hostel: {
    _id: string;
    name: string;
    code: string;
    type: string;
    gender: string;
    totalFloors: number;
    wardenName?: string;
    wardenContact?: string;
    address?: string;
    amenities?: string[];
    description?: string;
  }) => {
    reset({
      name: hostel.name,
      code: hostel.code,
      type: hostel.type,
      gender: hostel.gender || 'male',
      totalFloors: hostel.totalFloors || 1,
      wardenName: hostel.wardenName || '',
      wardenContact: hostel.wardenContact || '',
      address: hostel.address || '',
      amenities: hostel.amenities?.join(', ') || '',
      description: hostel.description || '',
    });
    setEditingHostel(hostel._id);
    setDialogOpen(true);
  };

  const onSubmit = (formData: HostelFormData) => {
    if (editingHostel) {
      updateMutation.mutate({ id: editingHostel, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const hostels = data?.data || [];
  const isSubmitting = createMutation.isPending || updateMutation.isPending;
  const watchType = watch('type');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Hostels</h1>
          <p className="text-muted-foreground">Manage your institution&apos;s hostels</p>
        </div>
        {hasPermission('hostel.hostels', 'create') && (
          <Button onClick={handleOpenCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Add Hostel
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
                placeholder="Search hostels..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select
              value={typeFilter || 'all'}
              onValueChange={(val) => setTypeFilter(val === 'all' ? '' : val)}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {HOSTEL_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Hostel Cards */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      ) : hostels.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <Hotel className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-medium">No hostels found</h3>
              <p className="text-muted-foreground">
                {search || typeFilter
                  ? 'Try adjusting your search criteria'
                  : 'Add your first hostel to get started'}
              </p>
              {!search && !typeFilter && hasPermission('hostel.hostels', 'create') && (
                <Button className="mt-4" onClick={handleOpenCreate}>
                  <Plus className="mr-2 h-4 w-4" /> Add Hostel
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {hostels.map(
            (hostel: {
              _id: string;
              name: string;
              code: string;
              type: string;
              gender: string;
              totalFloors: number;
              totalRooms?: number;
              totalBeds?: number;
              occupiedBeds?: number;
              wardenName?: string;
              wardenContact?: string;
              address?: string;
              amenities?: string[];
              description?: string;
            }) => {
              const occupied = hostel.occupiedBeds || 0;
              const total = hostel.totalBeds || 0;
              const pct = total > 0 ? Math.round((occupied / total) * 100) : 0;

              return (
                <Card key={hostel._id} className="relative">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">{hostel.name}</CardTitle>
                        <p className="text-sm text-muted-foreground mt-1">Code: {hostel.code}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={typeColors[hostel.type] || 'bg-gray-100 text-gray-800'}>
                          {hostel.type}
                        </Badge>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <Link href={`/hostel/hostels/${hostel._id}`}>
                                <Eye className="mr-2 h-4 w-4" />
                                View Details
                              </Link>
                            </DropdownMenuItem>
                            {hasPermission('hostel.hostels', 'edit') && (
                              <DropdownMenuItem onClick={() => handleOpenEdit(hostel)}>
                                <Edit className="mr-2 h-4 w-4" />
                                Edit
                              </DropdownMenuItem>
                            )}
                            {hasPermission('hostel.hostels', 'delete') && (
                              <DropdownMenuItem
                                className="text-red-600"
                                onClick={() => setDeleteId(hostel._id)}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Capacity Bar */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Occupancy</span>
                        <span className="font-medium">
                          {occupied}/{total} beds ({pct}%)
                        </span>
                      </div>
                      <Progress value={pct} />
                    </div>

                    {/* Details */}
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">Floors:</span>{' '}
                        <span className="font-medium">{hostel.totalFloors}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Rooms:</span>{' '}
                        <span className="font-medium">{hostel.totalRooms || 0}</span>
                      </div>
                    </div>

                    {/* Warden */}
                    {hostel.wardenName && (
                      <div className="flex items-center gap-2 text-sm border-t pt-3">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="font-medium">{hostel.wardenName}</p>
                          {hostel.wardenContact && (
                            <p className="text-xs text-muted-foreground">{hostel.wardenContact}</p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Address */}
                    {hostel.address && (
                      <div className="flex items-start gap-2 text-sm">
                        <MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                        <span className="text-muted-foreground line-clamp-1">{hostel.address}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            }
          )}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingHostel ? 'Edit Hostel' : 'Add New Hostel'}</DialogTitle>
            <DialogDescription>
              {editingHostel
                ? 'Update the hostel details below.'
                : 'Fill in the details to create a new hostel.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Hostel Name *</Label>
                <Input
                  id="name"
                  {...register('name', { required: 'Name is required' })}
                  placeholder="e.g., Boys Hostel A"
                />
                {errors.name && <p className="text-sm text-red-500">{errors.name.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="code">Hostel Code *</Label>
                <Input
                  id="code"
                  {...register('code', { required: 'Code is required' })}
                  placeholder="e.g., BH-A"
                />
                {errors.code && <p className="text-sm text-red-500">{errors.code.message}</p>}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Hostel Type *</Label>
                <Select value={watchType} onValueChange={(val) => setValue('type', val)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {HOSTEL_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="totalFloors">Total Floors *</Label>
                <Input
                  id="totalFloors"
                  type="number"
                  min={1}
                  {...register('totalFloors', {
                    required: 'Required',
                    min: { value: 1, message: 'Minimum 1 floor' },
                  })}
                />
                {errors.totalFloors && (
                  <p className="text-sm text-red-500">{errors.totalFloors.message}</p>
                )}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="wardenName">Warden Name</Label>
                <Input id="wardenName" {...register('wardenName')} placeholder="Warden name" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="wardenContact">Warden Contact</Label>
                <Input
                  id="wardenContact"
                  {...register('wardenContact')}
                  placeholder="+91 98765 43210"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Input id="address" {...register('address')} placeholder="Hostel address" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="amenities">Amenities (comma-separated)</Label>
              <Input
                id="amenities"
                {...register('amenities')}
                placeholder="WiFi, Laundry, Mess, Gym, Library"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                {...register('description')}
                placeholder="Brief description of the hostel"
                rows={3}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingHostel ? 'Update Hostel' : 'Create Hostel'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Hostel</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this hostel? This action cannot be undone. All rooms
              and allocation data associated with this hostel will also be removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
