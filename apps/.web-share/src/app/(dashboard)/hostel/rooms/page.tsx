'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { hostelApi } from '@/lib/api';
import { usePermissions } from '@/hooks/usePermissions';
import { getErrorMessage } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
  BedDouble,
  Plus,
  Search,
  MoreHorizontal,
  Edit,
  Trash2,
  Loader2,
  Wrench,
} from 'lucide-react';
import { toast } from 'sonner';

interface RoomFormData {
  hostelId: string;
  roomNumber: string;
  floor: number;
  type: string;
  capacity: number;
  amenities: string;
  monthlyRent: number;
}

const ROOM_TYPES = [
  { value: 'single', label: 'Single' },
  { value: 'double', label: 'Double' },
  { value: 'triple', label: 'Triple' },
  { value: 'dormitory', label: 'Dormitory' },
];

const statusBadgeVariant: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  available: 'default',
  partially_occupied: 'secondary',
  occupied: 'destructive',
  maintenance: 'outline',
};

const statusLabels: Record<string, string> = {
  available: 'Available',
  partially_occupied: 'Partial',
  occupied: 'Occupied',
  maintenance: 'Maintenance',
};

export default function RoomsPage() {
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const [search, setSearch] = useState('');
  const [hostelFilter, setHostelFilter] = useState<string>('');
  const [floorFilter] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const limit = 20;

  // Fetch hostels for dropdown
  const { data: hostelsData } = useQuery({
    queryKey: ['hostels-list'],
    queryFn: () => hostelApi.getHostels({ limit: 100 }),
  });

  // Fetch rooms
  const { data, isLoading } = useQuery({
    queryKey: ['rooms', search, hostelFilter, floorFilter, typeFilter, statusFilter, page],
    queryFn: () =>
      hostelApi.getRooms({
        search: search || undefined,
        hostelId: hostelFilter || undefined,
        floor: floorFilter || undefined,
        type: typeFilter || undefined,
        status: statusFilter || undefined,
        page,
        limit,
      }),
  });

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<RoomFormData>({
    defaultValues: {
      hostelId: '',
      roomNumber: '',
      floor: 1,
      type: 'double',
      capacity: 2,
      amenities: '',
      monthlyRent: 0,
    },
  });

  const createMutation = useMutation({
    mutationFn: (formData: RoomFormData) => {
      const payload = {
        ...formData,
        floor: Number(formData.floor),
        capacity: Number(formData.capacity),
        monthlyRent: Number(formData.monthlyRent) || 0,
        amenities: formData.amenities
          ? formData.amenities
              .split(',')
              .map((a) => a.trim())
              .filter(Boolean)
          : [],
      };
      return hostelApi.createRoom(payload as unknown as Record<string, unknown>);
    },
    onSuccess: () => {
      toast.success('Room created successfully');
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      queryClient.invalidateQueries({ queryKey: ['hostel-stats'] });
      setDialogOpen(false);
      reset();
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data: formData }: { id: string; data: RoomFormData }) => {
      const payload = {
        ...formData,
        floor: Number(formData.floor),
        capacity: Number(formData.capacity),
        monthlyRent: Number(formData.monthlyRent) || 0,
        amenities: formData.amenities
          ? formData.amenities
              .split(',')
              .map((a) => a.trim())
              .filter(Boolean)
          : [],
      };
      return hostelApi.updateRoom(id, payload as unknown as Record<string, unknown>);
    },
    onSuccess: () => {
      toast.success('Room updated successfully');
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      setDialogOpen(false);
      setEditingRoom(null);
      reset();
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => hostelApi.deleteRoom(id),
    onSuccess: () => {
      toast.success('Room deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      queryClient.invalidateQueries({ queryKey: ['hostel-stats'] });
      setDeleteId(null);
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
      setDeleteId(null);
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      hostelApi.updateRoomStatus(id, { status }),
    onSuccess: () => {
      toast.success('Room status updated');
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const handleOpenCreate = () => {
    reset({
      hostelId: hostelFilter || '',
      roomNumber: '',
      floor: 1,
      type: 'double',
      capacity: 2,
      amenities: '',
      monthlyRent: 0,
    });
    setEditingRoom(null);
    setDialogOpen(true);
  };

  const handleOpenEdit = (room: {
    _id: string;
    hostelId: string;
    roomNumber: string;
    floor: number;
    type: string;
    capacity: number;
    amenities?: string[];
    monthlyRent?: number;
  }) => {
    reset({
      hostelId: room.hostelId,
      roomNumber: room.roomNumber,
      floor: room.floor,
      type: room.type,
      capacity: room.capacity,
      amenities: room.amenities?.join(', ') || '',
      monthlyRent: room.monthlyRent || 0,
    });
    setEditingRoom(room._id);
    setDialogOpen(true);
  };

  const onSubmit = (formData: RoomFormData) => {
    if (editingRoom) {
      updateMutation.mutate({ id: editingRoom, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const rooms = data?.data || [];
  const meta = data?.meta || { total: 0, page: 1, limit: 20, totalPages: 1 };
  const hostels = hostelsData?.data || [];
  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Rooms</h1>
          <p className="text-muted-foreground">Manage hostel rooms and their status</p>
        </div>
        {hasPermission('hostel.rooms', 'create') && (
          <Button onClick={handleOpenCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Add Room
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
                placeholder="Search by room number..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="pl-10"
              />
            </div>
            <Select
              value={hostelFilter || 'all'}
              onValueChange={(val) => {
                setHostelFilter(val === 'all' ? '' : val);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Hostels" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Hostels</SelectItem>
                {hostels.map((h: { _id: string; name: string }) => (
                  <SelectItem key={h._id} value={h._id}>
                    {h.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={typeFilter || 'all'}
              onValueChange={(val) => {
                setTypeFilter(val === 'all' ? '' : val);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {ROOM_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={statusFilter || 'all'}
              onValueChange={(val) => {
                setStatusFilter(val === 'all' ? '' : val);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="available">Available</SelectItem>
                <SelectItem value="partially_occupied">Partially Occupied</SelectItem>
                <SelectItem value="occupied">Occupied</SelectItem>
                <SelectItem value="maintenance">Maintenance</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Rooms Table */}
      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : rooms.length === 0 ? (
            <div className="text-center py-12">
              <BedDouble className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-medium">No rooms found</h3>
              <p className="text-muted-foreground">
                {search || hostelFilter || typeFilter || statusFilter
                  ? 'Try adjusting your filters'
                  : 'Add rooms to your hostels to get started'}
              </p>
              {!search && hasPermission('hostel.rooms', 'create') && (
                <Button className="mt-4" onClick={handleOpenCreate}>
                  <Plus className="mr-2 h-4 w-4" /> Add Room
                </Button>
              )}
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Room Number</TableHead>
                    <TableHead>Hostel</TableHead>
                    <TableHead>Floor</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Capacity</TableHead>
                    <TableHead>Occupied</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rooms.map(
                    (room: {
                      _id: string;
                      roomNumber: string;
                      hostelId: string;
                      hostelName: string;
                      floor: number;
                      type: string;
                      capacity: number;
                      occupiedBeds: number;
                      status: string;
                      amenities?: string[];
                      monthlyRent?: number;
                    }) => (
                      <TableRow key={room._id}>
                        <TableCell className="font-medium">{room.roomNumber}</TableCell>
                        <TableCell>{room.hostelName}</TableCell>
                        <TableCell>Floor {room.floor}</TableCell>
                        <TableCell className="capitalize">{room.type}</TableCell>
                        <TableCell>{room.capacity}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span>
                              {room.occupiedBeds || 0}/{room.capacity}
                            </span>
                            {/* Bed indicators */}
                            <div className="flex gap-0.5">
                              {Array.from({ length: room.capacity }).map((_, i) => (
                                <div
                                  key={i}
                                  className={`w-2 h-2 rounded-full ${
                                    i < (room.occupiedBeds || 0) ? 'bg-red-500' : 'bg-green-500'
                                  }`}
                                />
                              ))}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusBadgeVariant[room.status] || 'outline'}>
                            {statusLabels[room.status] || room.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-8 w-8 p-0">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {hasPermission('hostel.rooms', 'edit') && (
                                <DropdownMenuItem onClick={() => handleOpenEdit(room)}>
                                  <Edit className="mr-2 h-4 w-4" />
                                  Edit Room
                                </DropdownMenuItem>
                              )}
                              {hasPermission('hostel.rooms', 'edit') &&
                                room.status !== 'maintenance' && (
                                  <DropdownMenuItem
                                    onClick={() =>
                                      statusMutation.mutate({
                                        id: room._id,
                                        status: 'maintenance',
                                      })
                                    }
                                  >
                                    <Wrench className="mr-2 h-4 w-4" />
                                    Set Maintenance
                                  </DropdownMenuItem>
                                )}
                              {hasPermission('hostel.rooms', 'edit') &&
                                room.status === 'maintenance' && (
                                  <DropdownMenuItem
                                    onClick={() =>
                                      statusMutation.mutate({
                                        id: room._id,
                                        status: 'available',
                                      })
                                    }
                                  >
                                    <BedDouble className="mr-2 h-4 w-4" />
                                    Set Available
                                  </DropdownMenuItem>
                                )}
                              {hasPermission('hostel.rooms', 'delete') && (
                                <DropdownMenuItem
                                  className="text-red-600"
                                  onClick={() => setDeleteId(room._id)}
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Delete
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    )
                  )}
                </TableBody>
              </Table>

              {/* Pagination */}
              {meta.totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">
                    Showing {(meta.page - 1) * meta.limit + 1} to{' '}
                    {Math.min(meta.page * meta.limit, meta.total)} of {meta.total} rooms
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(page - 1)}
                      disabled={page === 1}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(page + 1)}
                      disabled={page >= meta.totalPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editingRoom ? 'Edit Room' : 'Add New Room'}</DialogTitle>
            <DialogDescription>
              {editingRoom
                ? 'Update room details below.'
                : 'Fill in the details to add a new room.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label>Hostel *</Label>
              <Select value={watch('hostelId')} onValueChange={(val) => setValue('hostelId', val)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select hostel" />
                </SelectTrigger>
                <SelectContent>
                  {hostels.map((h: { _id: string; name: string }) => (
                    <SelectItem key={h._id} value={h._id}>
                      {h.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="roomNumber">Room Number *</Label>
                <Input
                  id="roomNumber"
                  {...register('roomNumber', { required: 'Required' })}
                  placeholder="e.g., 101"
                />
                {errors.roomNumber && (
                  <p className="text-sm text-red-500">{errors.roomNumber.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="floor">Floor *</Label>
                <Input
                  id="floor"
                  type="number"
                  min={0}
                  {...register('floor', { required: 'Required', min: 0 })}
                />
                {errors.floor && <p className="text-sm text-red-500">{errors.floor.message}</p>}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Room Type</Label>
                <Select value={watch('type')} onValueChange={(val) => setValue('type', val)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROOM_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="capacity">Capacity (beds) *</Label>
                <Input
                  id="capacity"
                  type="number"
                  min={1}
                  {...register('capacity', {
                    required: 'Required',
                    min: { value: 1, message: 'Minimum 1' },
                  })}
                />
                {errors.capacity && (
                  <p className="text-sm text-red-500">{errors.capacity.message}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="monthlyRent">Monthly Rent</Label>
              <Input
                id="monthlyRent"
                type="number"
                min={0}
                {...register('monthlyRent')}
                placeholder="0"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="room-amenities">Amenities (comma-separated)</Label>
              <Input
                id="room-amenities"
                {...register('amenities')}
                placeholder="AC, Attached Bathroom, Study Table"
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingRoom ? 'Update Room' : 'Create Room'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Room</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this room? Any active allocations in this room must be
              vacated first.
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
