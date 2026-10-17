'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { hostelApi } from '@/lib/api';
import { usePermissions } from '@/hooks/usePermissions';
import { getErrorMessage } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Hotel,
  ArrowLeft,
  Edit,
  Users,
  BedDouble,
  MapPin,
  Phone,
  Wifi,
  Loader2,
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

const roomStatusColors: Record<string, string> = {
  available: 'bg-green-500',
  partially_occupied: 'bg-yellow-500',
  occupied: 'bg-red-500',
  maintenance: 'bg-gray-400',
};

const roomStatusLabels: Record<string, string> = {
  available: 'Available',
  partially_occupied: 'Partially Occupied',
  occupied: 'Occupied',
  maintenance: 'Under Maintenance',
};

export default function HostelDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const hostelId = params.id as string;
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  const { data: hostelData, isLoading } = useQuery({
    queryKey: ['hostel', hostelId],
    queryFn: () => hostelApi.getHostel(hostelId),
    enabled: !!hostelId,
  });

  const { data: roomsData } = useQuery({
    queryKey: ['hostel-rooms', hostelId],
    queryFn: () => hostelApi.getRooms({ hostelId, limit: 200 }),
    enabled: !!hostelId,
  });

  const { data: allocationsData } = useQuery({
    queryKey: ['hostel-allocations', hostelId],
    queryFn: () => hostelApi.getAllocations({ hostelId, status: 'active', limit: 200 }),
    enabled: !!hostelId,
  });

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<HostelFormData>();

  const updateMutation = useMutation({
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
      return hostelApi.updateHostel(hostelId, payload as unknown as Record<string, unknown>);
    },
    onSuccess: () => {
      toast.success('Hostel updated successfully');
      queryClient.invalidateQueries({ queryKey: ['hostel', hostelId] });
      queryClient.invalidateQueries({ queryKey: ['hostels'] });
      setEditDialogOpen(false);
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const handleOpenEdit = () => {
    const h = hostel;
    if (!h) return;
    reset({
      name: h.name,
      code: h.code,
      type: h.type,
      gender: h.gender || 'male',
      totalFloors: h.totalFloors || 1,
      wardenName: h.wardenName || '',
      wardenContact: h.wardenContact || '',
      address: h.address || '',
      amenities: h.amenities?.join(', ') || '',
      description: h.description || '',
    });
    setEditDialogOpen(true);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64" />
        <Skeleton className="h-48" />
      </div>
    );
  }

  const hostel = hostelData?.data;
  const rooms = Array.isArray(roomsData?.data) ? roomsData.data : [];
  const allocations = Array.isArray(allocationsData?.data) ? allocationsData.data : [];

  if (!hostel) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <Card>
          <CardContent className="py-12 text-center">
            <Hotel className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-medium">Hostel not found</h3>
            <p className="text-muted-foreground">
              The hostel you are looking for does not exist or has been removed.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Group rooms by floor. Skip rooms with no floor so we don't end up with
  // an 'undefined' key that explodes downstream when Number('undefined')
  // becomes NaN and the lookup returns undefined.
  const roomsByFloor: Record<number, typeof rooms> = {};
  rooms.forEach((room: { floor?: number | null }) => {
    const f = typeof room.floor === 'number' && Number.isFinite(room.floor) ? room.floor : null;
    if (f === null) return;
    if (!roomsByFloor[f]) {
      roomsByFloor[f] = [];
    }
    roomsByFloor[f].push(room);
  });
  const floorNumbers = Object.keys(roomsByFloor)
    .map(Number)
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => a - b);

  const occupied = hostel.occupiedBeds || 0;
  const total = hostel.totalBeds || 0;
  const pct = total > 0 ? Math.round((occupied / total) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/hostel/hostels">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight">{hostel.name}</h1>
              <Badge className={typeColors[hostel.type] || 'bg-gray-100 text-gray-800'}>
                {hostel.type}
              </Badge>
            </div>
            <p className="text-muted-foreground">Code: {hostel.code}</p>
          </div>
        </div>
        {hasPermission('hostel.hostels', 'edit') && (
          <Button variant="outline" onClick={handleOpenEdit}>
            <Edit className="mr-2 h-4 w-4" /> Edit Hostel
          </Button>
        )}
      </div>

      {/* Info Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Capacity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Occupancy</span>
                <span className="font-medium">
                  {occupied}/{total} beds ({pct}%)
                </span>
              </div>
              <Progress value={pct} />
              <div className="grid grid-cols-2 gap-2 text-sm pt-2">
                <div>
                  <span className="text-muted-foreground">Floors: </span>
                  <span className="font-medium">{hostel.totalFloors}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Rooms: </span>
                  <span className="font-medium">{hostel.totalRooms || rooms.length}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Warden Details</CardTitle>
          </CardHeader>
          <CardContent>
            {hostel.wardenName ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{hostel.wardenName}</span>
                </div>
                {hostel.wardenContact && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Phone className="h-4 w-4" />
                    <span>{hostel.wardenContact}</span>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No warden assigned</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {hostel.address && (
                <div className="flex items-start gap-2 text-sm">
                  <MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                  <span className="text-muted-foreground">{hostel.address}</span>
                </div>
              )}
              {hostel.amenities?.length > 0 && (
                <div className="flex items-start gap-2 text-sm">
                  <Wifi className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                  <div className="flex flex-wrap gap-1">
                    {hostel.amenities.map((a: string) => (
                      <Badge key={a} variant="outline" className="text-xs">
                        {a}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Room Grid by Floor */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Room Layout</CardTitle>
              <CardDescription>Floor-by-floor room overview with occupancy status</CardDescription>
            </div>
            <div className="flex items-center gap-3 text-xs">
              {Object.entries(roomStatusLabels).map(([status, label]) => (
                <div key={status} className="flex items-center gap-1.5">
                  <div className={`w-3 h-3 rounded ${roomStatusColors[status]}`} />
                  <span className="text-muted-foreground">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {floorNumbers.length === 0 ? (
            <div className="text-center py-8">
              <BedDouble className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-medium">No rooms added yet</h3>
              <p className="text-muted-foreground">
                Add rooms to this hostel to see the floor layout.
              </p>
              {hasPermission('hostel.rooms', 'create') && (
                <Button className="mt-4" asChild>
                  <Link href="/hostel/rooms">Manage Rooms</Link>
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              {floorNumbers.map((floor) => {
                const floorRooms = roomsByFloor[floor] || [];
                return (
                  <div key={floor}>
                    <h4 className="text-sm font-semibold mb-3">
                      Floor {floor}
                      <span className="text-muted-foreground font-normal ml-2">
                        ({floorRooms.length} rooms)
                      </span>
                    </h4>
                    <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2">
                      {floorRooms.map(
                        (room: {
                          _id: string;
                          roomNumber: string;
                          status: string;
                          capacity: number;
                          occupiedBeds: number;
                          type: string;
                        }) => (
                          <Link
                            key={room._id}
                            href={`/hostel/rooms?highlight=${room._id}`}
                            className="group relative"
                          >
                            <div
                              className={`p-2 rounded-lg border text-center transition-all hover:shadow-md cursor-pointer ${
                                room.status === 'available'
                                  ? 'border-green-200 bg-green-50 hover:bg-green-100'
                                  : room.status === 'partially_occupied'
                                    ? 'border-yellow-200 bg-yellow-50 hover:bg-yellow-100'
                                    : room.status === 'occupied'
                                      ? 'border-red-200 bg-red-50 hover:bg-red-100'
                                      : 'border-gray-200 bg-gray-50 hover:bg-gray-100'
                              }`}
                            >
                              <p className="text-xs font-semibold">{room.roomNumber}</p>
                              <p className="text-[10px] text-muted-foreground">
                                {room.occupiedBeds || 0}/{room.capacity}
                              </p>
                            </div>
                          </Link>
                        )
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Allocated Students Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Allocated Students</CardTitle>
              <CardDescription>Students currently residing in this hostel</CardDescription>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/hostel/allocations?hostelId=${hostelId}`}>View All</Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {allocations.length === 0 ? (
            <div className="text-center py-8">
              <Users className="mx-auto h-10 w-10 text-muted-foreground/50" />
              <p className="mt-2 text-sm text-muted-foreground">No students allocated yet</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student Name</TableHead>
                  <TableHead>Room</TableHead>
                  <TableHead>Bed</TableHead>
                  <TableHead>Allocated Date</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allocations
                  .slice(0, 20)
                  .map(
                    (alloc: {
                      _id: string;
                      studentName: string;
                      roomNumber: string;
                      bedNumber: string | number;
                      allocatedDate: string;
                      status: string;
                    }) => (
                      <TableRow key={alloc._id}>
                        <TableCell className="font-medium">{alloc.studentName}</TableCell>
                        <TableCell>{alloc.roomNumber}</TableCell>
                        <TableCell>Bed {alloc.bedNumber}</TableCell>
                        <TableCell>{new Date(alloc.allocatedDate).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <Badge variant={alloc.status === 'active' ? 'default' : 'secondary'}>
                            {alloc.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    )
                  )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Hostel</DialogTitle>
            <DialogDescription>Update the hostel details below.</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={handleSubmit((data) => updateMutation.mutate(data))}
            className="space-y-4"
          >
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Hostel Name *</Label>
                <Input id="edit-name" {...register('name', { required: 'Name is required' })} />
                {errors.name && <p className="text-sm text-red-500">{errors.name.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-code">Hostel Code *</Label>
                <Input id="edit-code" {...register('code', { required: 'Code is required' })} />
                {errors.code && <p className="text-sm text-red-500">{errors.code.message}</p>}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Hostel Type</Label>
                <Select value={watch('type')} onValueChange={(val) => setValue('type', val)}>
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
                <Label htmlFor="edit-floors">Total Floors</Label>
                <Input
                  id="edit-floors"
                  type="number"
                  min={1}
                  {...register('totalFloors', { min: 1 })}
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="edit-warden">Warden Name</Label>
                <Input id="edit-warden" {...register('wardenName')} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-warden-contact">Warden Contact</Label>
                <Input id="edit-warden-contact" {...register('wardenContact')} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-address">Address</Label>
              <Input id="edit-address" {...register('address')} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-amenities">Amenities (comma-separated)</Label>
              <Input id="edit-amenities" {...register('amenities')} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea id="edit-description" {...register('description')} rows={3} />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
