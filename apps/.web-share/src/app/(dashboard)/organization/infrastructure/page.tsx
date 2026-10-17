'use client';

import { useState, useEffect, useCallback } from 'react';
import { AddButton } from '@/components/ui/page-header';
import { PageHero, StatTile, StatGrid } from '@/components/ui/page-hero';
import { DataTable, Column, DataTableAction } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Landmark,
  Layers,
  DoorOpen,
  Pencil,
  Trash2,
  Loader2,
  Plus,
  X,
  Users,
  BookOpen,
  FlaskConical,
  Presentation,
  Coffee,
  Archive,
  LayoutGrid,
  Building2,
  Eye,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { organizationApi } from '@/lib/api';
import { useBranchStore } from '@/store/branchStore';
import { toast } from 'sonner';
import { usePermissions } from '@/hooks/usePermissions';
import { getErrorMessage } from '@/lib/utils';

// ============ Types ============

interface BuildingFloor {
  _id: string;
  name: string;
  number: number;
  status: string;
}

interface Building {
  _id: string;
  name: string;
  code: string;
  floors: BuildingFloor[];
  totalRooms: number;
  description?: string;
  status: string;
}

interface InfraRoom {
  _id: string;
  buildingId: string;
  buildingName?: string;
  floorId: string;
  floorName?: string;
  roomNumber: string;
  name?: string;
  type: string;
  capacity?: number;
  area?: number;
  amenities: string[];
  status: string;
}

interface InfraStats {
  totalBuildings: number;
  totalFloors: number;
  totalRooms: number;
  byType: { type: string; count: number }[];
  byStatus: { status: string; count: number }[];
}

const ROOM_TYPES = [
  { value: 'classroom', label: 'Classroom' },
  { value: 'office', label: 'Office' },
  { value: 'lab', label: 'Lab' },
  { value: 'library', label: 'Library' },
  { value: 'auditorium', label: 'Auditorium' },
  { value: 'conference_room', label: 'Conference Room' },
  { value: 'staff_room', label: 'Staff Room' },
  { value: 'store_room', label: 'Store Room' },
  { value: 'other', label: 'Other' },
];

const ROOM_STATUSES = [
  { value: 'available', label: 'Available' },
  { value: 'occupied', label: 'Occupied' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'reserved', label: 'Reserved' },
];

const getRoomTypeLabel = (type: string) => ROOM_TYPES.find((t) => t.value === type)?.label || type;

const ROOM_TYPE_CONFIG: Record<
  string,
  { color: string; bg: string; border: string; icon: typeof Landmark }
> = {
  classroom: {
    color: 'text-blue-600',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    icon: BookOpen,
  },
  office: {
    color: 'text-amber-600',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    icon: Building2,
  },
  lab: {
    color: 'text-green-600',
    bg: 'bg-green-50',
    border: 'border-green-200',
    icon: FlaskConical,
  },
  library: {
    color: 'text-purple-600',
    bg: 'bg-purple-50',
    border: 'border-purple-200',
    icon: BookOpen,
  },
  auditorium: {
    color: 'text-rose-600',
    bg: 'bg-rose-50',
    border: 'border-rose-200',
    icon: Presentation,
  },
  conference_room: {
    color: 'text-cyan-600',
    bg: 'bg-cyan-50',
    border: 'border-cyan-200',
    icon: Users,
  },
  staff_room: {
    color: 'text-orange-600',
    bg: 'bg-orange-50',
    border: 'border-orange-200',
    icon: Coffee,
  },
  store_room: {
    color: 'text-gray-600',
    bg: 'bg-gray-50',
    border: 'border-gray-200',
    icon: Archive,
  },
  other: {
    color: 'text-slate-600',
    bg: 'bg-slate-50',
    border: 'border-slate-200',
    icon: LayoutGrid,
  },
};

const getRoomTypeConfig = (type: string) => ROOM_TYPE_CONFIG[type] || ROOM_TYPE_CONFIG.other;

const ROOM_STATUS_CONFIG: Record<string, { dot: string; opacity: string; border: string }> = {
  available: { dot: 'bg-green-500', opacity: '', border: '' },
  occupied: { dot: 'bg-blue-500', opacity: 'opacity-75', border: 'border-dashed' },
  maintenance: { dot: 'bg-red-500', opacity: 'opacity-50', border: 'border-dashed' },
  reserved: { dot: 'bg-yellow-500', opacity: 'opacity-75', border: 'border-dotted' },
};

const getStatusBadge = (status: string) => {
  const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    active: 'default',
    inactive: 'secondary',
    available: 'default',
    occupied: 'secondary',
    maintenance: 'destructive',
    reserved: 'outline',
  };
  return <Badge variant={variants[status] || 'outline'}>{status}</Badge>;
};

// ============ Main Component ============

export default function InfrastructurePage() {
  const { hasPermission } = usePermissions();
  const canCreate = hasPermission('organization.infrastructure', 'create');
  const canEdit = hasPermission('organization.infrastructure', 'edit');
  const canDelete = hasPermission('organization.infrastructure', 'delete');

  const [activeTab, setActiveTab] = useState('buildings');

  // Stats
  const [stats, setStats] = useState<InfraStats | null>(null);

  // Buildings
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [buildingsLoading, setBuildingsLoading] = useState(true);
  const [buildingsMeta, setBuildingsMeta] = useState<{
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  } | null>(null);
  const [buildingDialogOpen, setBuildingDialogOpen] = useState(false);
  const [editingBuilding, setEditingBuilding] = useState<Building | null>(null);
  const [deletingBuilding, setDeletingBuilding] = useState<Building | null>(null);
  const [buildingSaving, setBuildingSaving] = useState(false);

  // Building form
  const [buildingForm, setBuildingForm] = useState({
    name: '',
    code: '',
    description: '',
    floors: [{ name: 'Ground Floor', number: 0 }] as { name: string; number: number }[],
  });

  // Rooms
  const [rooms, setRooms] = useState<InfraRoom[]>([]);
  const [roomsLoading, setRoomsLoading] = useState(true);
  const [roomsMeta, setRoomsMeta] = useState<{
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  } | null>(null);
  const [roomDialogOpen, setRoomDialogOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<InfraRoom | null>(null);
  const [deletingRoom, setDeletingRoom] = useState<InfraRoom | null>(null);
  const [roomSaving, setRoomSaving] = useState(false);

  // Room form
  const [roomForm, setRoomForm] = useState({
    buildingId: '',
    floorId: '',
    roomNumber: '',
    name: '',
    type: 'classroom',
    capacity: '',
    area: '',
    amenities: '',
    status: 'available',
  });

  // Room filters
  const [roomFilterBuilding, setRoomFilterBuilding] = useState('');
  const [roomFilterFloor, setRoomFilterFloor] = useState('');
  const [roomFilterType, setRoomFilterType] = useState('');
  const [roomFilterStatus, setRoomFilterStatus] = useState('');

  // Visual preview
  const [previewBuildingId, setPreviewBuildingId] = useState<string | null>(null);
  const [previewFloorId, setPreviewFloorId] = useState<string | null>(null);
  const [previewRooms, setPreviewRooms] = useState<InfraRoom[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);

  // ============ Data Fetching ============

  // Buildings/rooms are campus-scoped; manual fetch (no react-query), so the
  // branch dependency triggers refetch on campus switch.
  const selectedBranchId = useBranchStore((s) => s.selectedBranchId);

  const fetchStats = useCallback(async () => {
    try {
      const response = await organizationApi.getInfraStats();
      setStats(response.data);
    } catch {
      // Stats are non-critical
    }
  }, [selectedBranchId]);

  const fetchBuildings = useCallback(
    async (page = 1) => {
      setBuildingsLoading(true);
      try {
        const response = await organizationApi.getBuildings({ page, limit: 20 });
        setBuildings(response.data || []);
        setBuildingsMeta(response.meta);
      } catch (error) {
        toast.error(getErrorMessage(error));
      } finally {
        setBuildingsLoading(false);
      }
    },
    [selectedBranchId]
  );

  const fetchRooms = useCallback(
    async (page = 1) => {
      setRoomsLoading(true);
      try {
        const params: Record<string, unknown> = { page, limit: 20 };
        if (roomFilterBuilding) params.buildingId = roomFilterBuilding;
        if (roomFilterFloor) params.floorId = roomFilterFloor;
        if (roomFilterType) params.type = roomFilterType;
        if (roomFilterStatus) params.status = roomFilterStatus;

        const response = await organizationApi.getInfraRooms(params);
        setRooms(response.data || []);
        setRoomsMeta(response.meta);
      } catch (error) {
        toast.error(getErrorMessage(error));
      } finally {
        setRoomsLoading(false);
      }
    },
    [roomFilterBuilding, roomFilterFloor, roomFilterType, roomFilterStatus, selectedBranchId]
  );

  const fetchPreviewRooms = useCallback(async (buildingId: string) => {
    setPreviewLoading(true);
    try {
      const response = await organizationApi.getInfraRooms({ buildingId, limit: 100 });
      setPreviewRooms(response.data || []);
    } catch {
      setPreviewRooms([]);
    } finally {
      setPreviewLoading(false);
    }
  }, []);

  const handleSelectPreviewBuilding = useCallback(
    (buildingId: string) => {
      if (previewBuildingId === buildingId) {
        setPreviewBuildingId(null);
        setPreviewFloorId(null);
        setPreviewRooms([]);
      } else {
        setPreviewBuildingId(buildingId);
        const building = buildings.find((b) => b._id === buildingId);
        setPreviewFloorId(building?.floors[0]?._id || null);
        fetchPreviewRooms(buildingId);
      }
    },
    [previewBuildingId, buildings, fetchPreviewRooms]
  );

  useEffect(() => {
    fetchStats();
    fetchBuildings();
  }, [fetchStats, fetchBuildings]);

  useEffect(() => {
    if (activeTab === 'rooms') {
      fetchRooms();
    }
  }, [activeTab, fetchRooms]);

  // ============ Building Handlers ============

  const openBuildingDialog = (building?: Building) => {
    if (building) {
      setEditingBuilding(building);
      setBuildingForm({
        name: building.name,
        code: building.code,
        description: building.description || '',
        floors: building.floors.map((f) => ({ name: f.name, number: f.number })),
      });
    } else {
      setEditingBuilding(null);
      setBuildingForm({
        name: '',
        code: '',
        description: '',
        floors: [{ name: 'Ground Floor', number: 0 }],
      });
    }
    setBuildingDialogOpen(true);
  };

  const handleSaveBuilding = async () => {
    if (!buildingForm.name.trim() || !buildingForm.code.trim()) {
      toast.error('Name and code are required');
      return;
    }

    if (buildingForm.floors.length === 0) {
      toast.error('At least one floor is required');
      return;
    }

    setBuildingSaving(true);
    try {
      const data = {
        name: buildingForm.name.trim(),
        code: buildingForm.code.trim().toUpperCase(),
        description: buildingForm.description.trim() || undefined,
        floors: buildingForm.floors.map((f) => ({
          name: f.name.trim(),
          number: f.number,
        })),
      };

      if (editingBuilding) {
        await organizationApi.updateBuilding(editingBuilding._id, data);
        toast.success('Building updated successfully');
      } else {
        await organizationApi.createBuilding(data);
        toast.success('Building created successfully');
      }

      setBuildingDialogOpen(false);
      fetchBuildings();
      fetchStats();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setBuildingSaving(false);
    }
  };

  const handleDeleteBuilding = async () => {
    if (!deletingBuilding) return;
    try {
      await organizationApi.deleteBuilding(deletingBuilding._id);
      toast.success('Building deleted successfully');
      setDeletingBuilding(null);
      fetchBuildings();
      fetchStats();
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const addFloorRow = () => {
    setBuildingForm((prev) => ({
      ...prev,
      floors: [...prev.floors, { name: `Floor ${prev.floors.length}`, number: prev.floors.length }],
    }));
  };

  const removeFloorRow = (index: number) => {
    setBuildingForm((prev) => ({
      ...prev,
      floors: prev.floors.filter((_, i) => i !== index),
    }));
  };

  const updateFloorRow = (index: number, field: 'name' | 'number', value: string | number) => {
    setBuildingForm((prev) => ({
      ...prev,
      floors: prev.floors.map((f, i) => (i === index ? { ...f, [field]: value } : f)),
    }));
  };

  // ============ Room Handlers ============

  const openRoomDialog = (room?: InfraRoom) => {
    if (room) {
      setEditingRoom(room);
      setRoomForm({
        buildingId: room.buildingId,
        floorId: room.floorId,
        roomNumber: room.roomNumber,
        name: room.name || '',
        type: room.type,
        capacity: room.capacity?.toString() || '',
        area: room.area?.toString() || '',
        amenities: (room.amenities || []).join(', '),
        status: room.status,
      });
    } else {
      setEditingRoom(null);
      setRoomForm({
        buildingId: '',
        floorId: '',
        roomNumber: '',
        name: '',
        type: 'classroom',
        capacity: '',
        area: '',
        amenities: '',
        status: 'available',
      });
    }
    setRoomDialogOpen(true);
  };

  const handleSaveRoom = async () => {
    if (!roomForm.roomNumber.trim()) {
      toast.error('Room number is required');
      return;
    }

    if (!editingRoom && (!roomForm.buildingId || !roomForm.floorId)) {
      toast.error('Building and floor are required');
      return;
    }

    setRoomSaving(true);
    try {
      const amenities = roomForm.amenities
        .split(',')
        .map((a) => a.trim())
        .filter(Boolean);

      if (editingRoom) {
        const data: Record<string, unknown> = {
          roomNumber: roomForm.roomNumber.trim(),
          name: roomForm.name.trim() || undefined,
          type: roomForm.type,
          amenities,
          status: roomForm.status,
        };
        if (roomForm.capacity) data.capacity = parseInt(roomForm.capacity, 10);
        if (roomForm.area) data.area = parseFloat(roomForm.area);
        if (roomForm.floorId && roomForm.floorId !== editingRoom.floorId) {
          data.floorId = roomForm.floorId;
        }

        await organizationApi.updateInfraRoom(editingRoom._id, data);
        toast.success('Room updated successfully');
      } else {
        const data: Record<string, unknown> = {
          buildingId: roomForm.buildingId,
          floorId: roomForm.floorId,
          roomNumber: roomForm.roomNumber.trim(),
          name: roomForm.name.trim() || undefined,
          type: roomForm.type,
          amenities,
        };
        if (roomForm.capacity) data.capacity = parseInt(roomForm.capacity, 10);
        if (roomForm.area) data.area = parseFloat(roomForm.area);

        await organizationApi.createInfraRoom(data);
        toast.success('Room created successfully');
      }

      setRoomDialogOpen(false);
      fetchRooms();
      fetchStats();
      fetchBuildings();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setRoomSaving(false);
    }
  };

  const handleDeleteRoom = async () => {
    if (!deletingRoom) return;
    try {
      await organizationApi.deleteInfraRoom(deletingRoom._id);
      toast.success('Room deleted successfully');
      setDeletingRoom(null);
      fetchRooms();
      fetchStats();
      fetchBuildings();
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  // Get floors for a building (used in room form/filters)
  const getFloorsForBuilding = (buildingId: string): BuildingFloor[] => {
    const b = buildings.find((b) => b._id === buildingId);
    return b?.floors || [];
  };

  // ============ Table Columns ============

  const buildingColumns: Column<Building>[] = [
    { key: 'name', header: 'Name', sortable: true },
    { key: 'code', header: 'Code', sortable: true },
    {
      key: 'floors',
      header: 'Floors',
      cell: (building) => <Badge variant="secondary">{building.floors.length}</Badge>,
    },
    {
      key: 'totalRooms',
      header: 'Rooms',
      cell: (building) => <Badge variant="outline">{building.totalRooms}</Badge>,
    },
    {
      key: 'description',
      header: 'Description',
      cell: (building) => (
        <span className="text-muted-foreground text-sm truncate max-w-[200px] block">
          {building.description || '-'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (building) => getStatusBadge(building.status),
    },
  ];

  const buildingActions: DataTableAction<Building>[] = [
    ...(canEdit
      ? [
          {
            label: 'Edit',
            icon: <Pencil className="h-4 w-4" />,
            onClick: (building: Building) => openBuildingDialog(building),
          },
        ]
      : []),
    ...(canDelete
      ? [
          {
            label: 'Delete',
            icon: <Trash2 className="h-4 w-4" />,
            variant: 'destructive' as const,
            onClick: (building: Building) => setDeletingBuilding(building),
            disabled: (building: Building) => building.totalRooms > 0,
          },
        ]
      : []),
  ];

  const roomColumns: Column<InfraRoom>[] = [
    { key: 'roomNumber', header: 'Room No.', sortable: true },
    {
      key: 'name',
      header: 'Name',
      cell: (room) => room.name || '-',
    },
    {
      key: 'buildingName',
      header: 'Building',
      cell: (room) => room.buildingName || '-',
    },
    {
      key: 'floorName',
      header: 'Floor',
      cell: (room) => room.floorName || '-',
    },
    {
      key: 'type',
      header: 'Type',
      cell: (room) => <Badge variant="outline">{getRoomTypeLabel(room.type)}</Badge>,
    },
    {
      key: 'capacity',
      header: 'Capacity',
      cell: (room) => (room.capacity ? String(room.capacity) : '-'),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (room) => getStatusBadge(room.status),
    },
  ];

  const roomActions: DataTableAction<InfraRoom>[] = [
    ...(canEdit
      ? [
          {
            label: 'Edit',
            icon: <Pencil className="h-4 w-4" />,
            onClick: (room: InfraRoom) => openRoomDialog(room),
          },
        ]
      : []),
    ...(canDelete
      ? [
          {
            label: 'Delete',
            icon: <Trash2 className="h-4 w-4" />,
            variant: 'destructive' as const,
            onClick: (room: InfraRoom) => setDeletingRoom(room),
          },
        ]
      : []),
  ];

  // ============ Render ============

  return (
    <div className="space-y-6">
      <PageHero
        icon={Building2}
        eyebrow="Organization"
        title="Infrastructure"
        description="Manage buildings, floors, and rooms for your campus"
      />

      {/* Stats */}
      <StatGrid>
        <StatTile
          title="Buildings"
          value={stats?.totalBuildings ?? 0}
          icon={Landmark}
          variant="primary"
        />
        <StatTile title="Floors" value={stats?.totalFloors ?? 0} icon={Layers} variant="info" />
        <StatTile title="Rooms" value={stats?.totalRooms ?? 0} icon={DoorOpen} variant="success" />
        <StatTile
          title="Room Types"
          value={stats?.byType?.length ?? 0}
          icon={Landmark}
          subtitle={
            stats?.byType
              ?.slice(0, 3)
              .map((t) => `${getRoomTypeLabel(t.type)}: ${t.count}`)
              .join(', ') || undefined
          }
        />
      </StatGrid>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="buildings">Buildings</TabsTrigger>
          <TabsTrigger value="rooms">Rooms</TabsTrigger>
        </TabsList>

        {/* Buildings Tab */}
        <TabsContent value="buildings" className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">
              Click a building to preview its floors and rooms
            </p>
            {canCreate && <AddButton label="Add Building" onClick={() => openBuildingDialog()} />}
          </div>

          {/* Visual Building Cards */}
          {buildings.length > 0 && (
            <div className="flex gap-4 overflow-x-auto pb-3 pt-1 px-1">
              {buildings.map((building) => {
                const isSelected = previewBuildingId === building._id;

                return (
                  <button
                    key={building._id}
                    type="button"
                    onClick={() => handleSelectPreviewBuilding(building._id)}
                    className={`group relative flex-shrink-0 w-44 rounded-xl border-2 p-4 transition-all duration-300 text-left ${
                      isSelected
                        ? 'border-primary bg-primary/5 shadow-lg shadow-primary/10'
                        : 'border-border bg-card hover:border-primary/40 hover:shadow-md'
                    }`}
                  >
                    {/* Building illustration */}
                    <div className="flex flex-col items-center mb-3">
                      {/* Roof */}
                      <div
                        className={`w-24 h-1.5 rounded-t-lg mb-0.5 transition-colors ${
                          isSelected
                            ? 'bg-primary'
                            : 'bg-muted-foreground/20 group-hover:bg-primary/40'
                        }`}
                      />
                      {/* Floor stack (bottom-up) */}
                      <div className="flex flex-col-reverse w-full gap-[2px]">
                        {[...building.floors]
                          .sort((a, b) => a.number - b.number)
                          .map((floor) => (
                            <div
                              key={floor._id}
                              className={`h-5 rounded-sm flex items-center justify-center transition-all ${
                                isSelected && previewFloorId === floor._id
                                  ? 'bg-primary/20 ring-1 ring-primary/40'
                                  : isSelected
                                    ? 'bg-muted'
                                    : 'bg-muted/60 group-hover:bg-muted'
                              }`}
                            >
                              <span className="text-[9px] font-medium text-muted-foreground truncate px-1">
                                {floor.name}
                              </span>
                            </div>
                          ))}
                      </div>
                      {/* Ground line */}
                      <div className="w-28 h-px bg-muted-foreground/20 mt-1" />
                    </div>

                    {/* Building info */}
                    <div className="text-center">
                      <p className="font-semibold text-sm truncate">{building.name}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {building.code} &middot; {building.floors.length} floors &middot;{' '}
                        {building.totalRooms} rooms
                      </p>
                    </div>

                    {/* Selected indicator */}
                    {isSelected && (
                      <div className="absolute top-2 right-2 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                        <Eye className="h-3 w-3 text-primary-foreground" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Floor Plan Preview (when a building is selected) */}
          {previewBuildingId &&
            (() => {
              const building = buildings.find((b) => b._id === previewBuildingId);
              if (!building) return null;

              const sortedFloors = [...building.floors].sort((a, b) => b.number - a.number);
              const activeFloor = previewFloorId || sortedFloors[0]?._id;
              const floorRooms = previewRooms.filter((r) => r.floorId === activeFloor);

              return (
                <div className="border rounded-xl bg-gradient-to-b from-muted/30 to-background p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-5 w-5 text-primary" />
                      <h3 className="font-semibold">{building.name}</h3>
                      <Badge variant="outline" className="text-xs">
                        {building.code}
                      </Badge>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setPreviewBuildingId(null);
                        setPreviewFloorId(null);
                        setPreviewRooms([]);
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Floor tabs */}
                  <div className="flex gap-1.5 overflow-x-auto">
                    {sortedFloors.map((floor) => {
                      const floorRoomCount = previewRooms.filter(
                        (r) => r.floorId === floor._id
                      ).length;
                      const isActive = activeFloor === floor._id;

                      return (
                        <button
                          key={floor._id}
                          type="button"
                          onClick={() => setPreviewFloorId(floor._id)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                            isActive
                              ? 'bg-primary text-primary-foreground shadow-sm'
                              : 'bg-muted/60 text-muted-foreground hover:bg-muted'
                          }`}
                        >
                          <Layers className="h-3 w-3" />
                          {floor.name}
                          <span
                            className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                              isActive
                                ? 'bg-primary-foreground/20 text-primary-foreground'
                                : 'bg-background text-muted-foreground'
                            }`}
                          >
                            {floorRoomCount}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Room tiles */}
                  {previewLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : floorRooms.length === 0 ? (
                    <div className="text-center py-8 text-sm text-muted-foreground">
                      No rooms on this floor
                    </div>
                  ) : (
                    <>
                      {/* Legend */}
                      <div className="flex flex-wrap gap-3 text-[10px] text-muted-foreground">
                        {Object.entries(ROOM_TYPE_CONFIG)
                          .filter(([type]) => floorRooms.some((r) => r.type === type))
                          .map(([type, config]) => (
                            <div key={type} className="flex items-center gap-1">
                              <div
                                className={`w-2.5 h-2.5 rounded-sm ${config.bg} border ${config.border}`}
                              />
                              <span>{getRoomTypeLabel(type)}</span>
                            </div>
                          ))}
                        <span className="text-muted-foreground/40">|</span>
                        <div className="flex items-center gap-1">
                          <div className="w-2 h-2 rounded-full bg-green-500" />
                          <span>Available</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <div className="w-2 h-2 rounded-full bg-blue-500" />
                          <span>Occupied</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <div className="w-2 h-2 rounded-full bg-red-500" />
                          <span>Maintenance</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <div className="w-2 h-2 rounded-full bg-yellow-500" />
                          <span>Reserved</span>
                        </div>
                      </div>

                      {/* Room grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                        <TooltipProvider delayDuration={150}>
                          {floorRooms.map((room) => {
                            const typeConfig = getRoomTypeConfig(room.type);
                            const statusConfig =
                              ROOM_STATUS_CONFIG[room.status] || ROOM_STATUS_CONFIG.available;
                            const RoomIcon = typeConfig.icon;

                            return (
                              <Tooltip key={room._id}>
                                <TooltipTrigger asChild>
                                  <div
                                    className={`relative group rounded-xl border-2 p-3 transition-all duration-200 cursor-default hover:shadow-md hover:scale-[1.03] ${typeConfig.bg} ${typeConfig.border} ${statusConfig.opacity} ${statusConfig.border}`}
                                  >
                                    {/* Status dot */}
                                    <div
                                      className={`absolute top-2 right-2 w-2 h-2 rounded-full ${statusConfig.dot}`}
                                    />

                                    {/* Room icon */}
                                    <RoomIcon className={`h-5 w-5 ${typeConfig.color} mb-1.5`} />

                                    {/* Room number */}
                                    <p className="font-bold text-sm leading-tight">
                                      {room.roomNumber}
                                    </p>

                                    {/* Room name */}
                                    {room.name && (
                                      <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                                        {room.name}
                                      </p>
                                    )}

                                    {/* Type label */}
                                    <p
                                      className={`text-[10px] font-medium mt-1 ${typeConfig.color}`}
                                    >
                                      {getRoomTypeLabel(room.type)}
                                    </p>

                                    {/* Capacity */}
                                    {room.capacity && (
                                      <p className="text-[10px] text-muted-foreground mt-0.5">
                                        Cap: {room.capacity}
                                      </p>
                                    )}

                                    {/* Edit button on hover */}
                                    {canEdit && (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          openRoomDialog(room);
                                        }}
                                        className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md bg-background/80 hover:bg-background shadow-sm"
                                      >
                                        <Pencil className="h-3 w-3 text-muted-foreground" />
                                      </button>
                                    )}
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent side="bottom" className="text-xs">
                                  <p className="font-semibold">
                                    Room {room.roomNumber}
                                    {room.name ? ` - ${room.name}` : ''}
                                  </p>
                                  <p className="text-muted-foreground">
                                    {getRoomTypeLabel(room.type)} &middot;{' '}
                                    {room.status.charAt(0).toUpperCase() + room.status.slice(1)}
                                    {room.capacity ? ` &middot; ${room.capacity} seats` : ''}
                                    {room.area ? ` &middot; ${room.area} sq.ft` : ''}
                                  </p>
                                  {room.amenities.length > 0 && (
                                    <p className="text-muted-foreground">
                                      {room.amenities.join(', ')}
                                    </p>
                                  )}
                                </TooltipContent>
                              </Tooltip>
                            );
                          })}
                        </TooltipProvider>
                      </div>
                    </>
                  )}
                </div>
              );
            })()}

          <DataTable
            data={buildings}
            columns={buildingColumns}
            actions={buildingActions}
            searchable
            searchPlaceholder="Search buildings..."
            loading={buildingsLoading}
            emptyState="No buildings found. Create your first building to get started."
            pagination={
              buildingsMeta
                ? {
                    page: buildingsMeta.page,
                    pageSize: buildingsMeta.limit,
                    total: buildingsMeta.total,
                    onPageChange: fetchBuildings,
                  }
                : undefined
            }
          />
        </TabsContent>

        {/* Rooms Tab */}
        <TabsContent value="rooms" className="space-y-4">
          {/* Visual Room Map */}
          {buildings.length > 0 && (
            <div className="border rounded-xl bg-card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <LayoutGrid className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">Room Map</span>
                </div>
                <div className="flex flex-wrap gap-3 text-[10px] text-muted-foreground">
                  {Object.entries(ROOM_TYPE_CONFIG)
                    .slice(0, 6)
                    .map(([type, config]) => (
                      <div key={type} className="flex items-center gap-1">
                        <div
                          className={`w-2 h-2 rounded-sm ${config.bg} border ${config.border}`}
                        />
                        <span>{getRoomTypeLabel(type)}</span>
                      </div>
                    ))}
                </div>
              </div>

              {/* Building selector strip */}
              <div className="flex gap-2 overflow-x-auto pb-1">
                {buildings.map((b) => {
                  const isActive = roomFilterBuilding === b._id;
                  return (
                    <button
                      key={b._id}
                      type="button"
                      onClick={() => {
                        if (isActive) {
                          setRoomFilterBuilding('');
                          setRoomFilterFloor('');
                        } else {
                          setRoomFilterBuilding(b._id);
                          setRoomFilterFloor('');
                        }
                      }}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap border ${
                        isActive
                          ? 'border-primary bg-primary/5 text-primary'
                          : 'border-transparent bg-muted/50 text-muted-foreground hover:bg-muted'
                      }`}
                    >
                      <Landmark className="h-3.5 w-3.5" />
                      {b.name}
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                        {b.totalRooms}
                      </Badge>
                    </button>
                  );
                })}
              </div>

              {/* Floor strip + room tiles (when a building is selected) */}
              {roomFilterBuilding &&
                (() => {
                  const building = buildings.find((b) => b._id === roomFilterBuilding);
                  if (!building) return null;

                  const sortedFloors = [...building.floors].sort((a, b) => b.number - a.number);
                  const currentFloorId = roomFilterFloor || null;
                  const floorRooms = currentFloorId
                    ? rooms.filter((r) => r.floorId === currentFloorId)
                    : rooms;

                  return (
                    <div className="space-y-2.5">
                      {/* Floor pills */}
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => setRoomFilterFloor('')}
                          className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                            !currentFloorId
                              ? 'bg-primary/10 text-primary'
                              : 'text-muted-foreground hover:bg-muted'
                          }`}
                        >
                          All Floors
                        </button>
                        {sortedFloors.map((floor) => {
                          const count = rooms.filter((r) => r.floorId === floor._id).length;
                          return (
                            <button
                              key={floor._id}
                              type="button"
                              onClick={() =>
                                setRoomFilterFloor(roomFilterFloor === floor._id ? '' : floor._id)
                              }
                              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                                currentFloorId === floor._id
                                  ? 'bg-primary/10 text-primary'
                                  : 'text-muted-foreground hover:bg-muted'
                              }`}
                            >
                              {floor.name}
                              <span className="text-[9px] opacity-60">({count})</span>
                            </button>
                          );
                        })}
                      </div>

                      {/* Mini room tiles */}
                      {floorRooms.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          <TooltipProvider delayDuration={150}>
                            {floorRooms.map((room) => {
                              const typeConfig = getRoomTypeConfig(room.type);
                              const statusConfig =
                                ROOM_STATUS_CONFIG[room.status] || ROOM_STATUS_CONFIG.available;
                              const RoomIcon = typeConfig.icon;

                              return (
                                <Tooltip key={room._id}>
                                  <TooltipTrigger asChild>
                                    <div
                                      className={`relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border transition-all hover:shadow-sm cursor-default ${typeConfig.bg} ${typeConfig.border} ${statusConfig.opacity}`}
                                    >
                                      <div
                                        className={`w-1.5 h-1.5 rounded-full ${statusConfig.dot}`}
                                      />
                                      <RoomIcon className={`h-3 w-3 ${typeConfig.color}`} />
                                      <span className="text-xs font-semibold">
                                        {room.roomNumber}
                                      </span>
                                      {room.name && (
                                        <span className="text-[10px] text-muted-foreground max-w-[60px] truncate">
                                          {room.name}
                                        </span>
                                      )}
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent side="bottom" className="text-xs">
                                    <p className="font-semibold">
                                      Room {room.roomNumber}
                                      {room.name ? ` - ${room.name}` : ''}
                                    </p>
                                    <p className="text-muted-foreground">
                                      {getRoomTypeLabel(room.type)} &middot; {room.status}
                                      {room.capacity ? ` &middot; ${room.capacity} seats` : ''}
                                    </p>
                                  </TooltipContent>
                                </Tooltip>
                              );
                            })}
                          </TooltipProvider>
                        </div>
                      )}
                    </div>
                  );
                })()}
            </div>
          )}

          {/* Filters */}
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-48">
              <Label className="text-xs text-muted-foreground">Building</Label>
              <Select
                value={roomFilterBuilding}
                onValueChange={(v) => {
                  setRoomFilterBuilding(v === 'all' ? '' : v);
                  setRoomFilterFloor('');
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All buildings" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All buildings</SelectItem>
                  {buildings.map((b) => (
                    <SelectItem key={b._id} value={b._id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {roomFilterBuilding && (
              <div className="w-48">
                <Label className="text-xs text-muted-foreground">Floor</Label>
                <Select
                  value={roomFilterFloor}
                  onValueChange={(v) => setRoomFilterFloor(v === 'all' ? '' : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All floors" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All floors</SelectItem>
                    {getFloorsForBuilding(roomFilterBuilding).map((f) => (
                      <SelectItem key={f._id} value={f._id}>
                        {f.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="w-44">
              <Label className="text-xs text-muted-foreground">Type</Label>
              <Select
                value={roomFilterType}
                onValueChange={(v) => setRoomFilterType(v === 'all' ? '' : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  {ROOM_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="w-40">
              <Label className="text-xs text-muted-foreground">Status</Label>
              <Select
                value={roomFilterStatus}
                onValueChange={(v) => setRoomFilterStatus(v === 'all' ? '' : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  {ROOM_STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex-1" />
            {canCreate && <AddButton label="Add Room" onClick={() => openRoomDialog()} />}
          </div>

          <DataTable
            data={rooms}
            columns={roomColumns}
            actions={roomActions}
            searchable
            searchPlaceholder="Search rooms..."
            loading={roomsLoading}
            emptyState="No rooms found. Create buildings first, then add rooms."
            pagination={
              roomsMeta
                ? {
                    page: roomsMeta.page,
                    pageSize: roomsMeta.limit,
                    total: roomsMeta.total,
                    onPageChange: fetchRooms,
                  }
                : undefined
            }
          />
        </TabsContent>
      </Tabs>

      {/* ============ Building Dialog ============ */}
      <Dialog open={buildingDialogOpen} onOpenChange={setBuildingDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingBuilding ? 'Edit Building' : 'Add Building'}</DialogTitle>
            <DialogDescription>
              {editingBuilding
                ? 'Update the building details and floors.'
                : 'Create a new building with floors.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-4 grid-cols-2">
              <div>
                <Label>Name *</Label>
                <Input
                  value={buildingForm.name}
                  onChange={(e) => setBuildingForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g. Main Block"
                />
              </div>
              <div>
                <Label>Code *</Label>
                <Input
                  value={buildingForm.code}
                  onChange={(e) =>
                    setBuildingForm((prev) => ({
                      ...prev,
                      code: e.target.value.toUpperCase(),
                    }))
                  }
                  placeholder="e.g. MAIN"
                />
              </div>
            </div>

            <div>
              <Label>Description</Label>
              <Textarea
                value={buildingForm.description}
                onChange={(e) =>
                  setBuildingForm((prev) => ({ ...prev, description: e.target.value }))
                }
                placeholder="Optional description"
                rows={2}
              />
            </div>

            {/* Floors */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Floors *</Label>
                <Button type="button" variant="outline" size="sm" onClick={addFloorRow}>
                  <Plus className="h-3 w-3 mr-1" /> Add Floor
                </Button>
              </div>

              <div className="space-y-2 max-h-48 overflow-y-auto">
                {buildingForm.floors.map((floor, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Input
                      value={floor.name}
                      onChange={(e) => updateFloorRow(index, 'name', e.target.value)}
                      placeholder="Floor name"
                      className="flex-1"
                    />
                    <Input
                      type="number"
                      value={floor.number}
                      onChange={(e) =>
                        updateFloorRow(index, 'number', parseInt(e.target.value, 10) || 0)
                      }
                      placeholder="#"
                      className="w-20"
                    />
                    {buildingForm.floors.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeFloorRow(index)}
                        className="shrink-0"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Status (edit only) */}
            {editingBuilding && (
              <div>
                <Label>Status</Label>
                <Select
                  value={
                    (buildingForm as typeof buildingForm & { status?: string }).status ||
                    editingBuilding.status
                  }
                  onValueChange={(v) =>
                    setBuildingForm((prev) => ({ ...prev, status: v }) as typeof prev)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setBuildingDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveBuilding} disabled={buildingSaving}>
                {buildingSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editingBuilding ? 'Update' : 'Create'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ============ Room Dialog ============ */}
      <Dialog open={roomDialogOpen} onOpenChange={setRoomDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingRoom ? 'Edit Room' : 'Add Room'}</DialogTitle>
            <DialogDescription>
              {editingRoom ? 'Update the room details.' : 'Create a new room in a building.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Building & Floor (create only) */}
            {!editingRoom && (
              <div className="grid gap-4 grid-cols-2">
                <div>
                  <Label>Building *</Label>
                  <Select
                    value={roomForm.buildingId}
                    onValueChange={(v) =>
                      setRoomForm((prev) => ({ ...prev, buildingId: v, floorId: '' }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select building" />
                    </SelectTrigger>
                    <SelectContent>
                      {buildings
                        .filter((b) => b.status === 'active')
                        .map((b) => (
                          <SelectItem key={b._id} value={b._id}>
                            {b.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Floor *</Label>
                  <Select
                    value={roomForm.floorId}
                    onValueChange={(v) => setRoomForm((prev) => ({ ...prev, floorId: v }))}
                    disabled={!roomForm.buildingId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select floor" />
                    </SelectTrigger>
                    <SelectContent>
                      {getFloorsForBuilding(roomForm.buildingId).map((f) => (
                        <SelectItem key={f._id} value={f._id}>
                          {f.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* Floor change for edit */}
            {editingRoom && (
              <div>
                <Label>Floor</Label>
                <Select
                  value={roomForm.floorId}
                  onValueChange={(v) => setRoomForm((prev) => ({ ...prev, floorId: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {getFloorsForBuilding(editingRoom.buildingId).map((f) => (
                      <SelectItem key={f._id} value={f._id}>
                        {f.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid gap-4 grid-cols-2">
              <div>
                <Label>Room Number *</Label>
                <Input
                  value={roomForm.roomNumber}
                  onChange={(e) => setRoomForm((prev) => ({ ...prev, roomNumber: e.target.value }))}
                  placeholder="e.g. 101"
                />
              </div>
              <div>
                <Label>Name</Label>
                <Input
                  value={roomForm.name}
                  onChange={(e) => setRoomForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g. Physics Lab"
                />
              </div>
            </div>

            <div className="grid gap-4 grid-cols-2">
              <div>
                <Label>Type *</Label>
                <Select
                  value={roomForm.type}
                  onValueChange={(v) => setRoomForm((prev) => ({ ...prev, type: v }))}
                >
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
              <div>
                <Label>Capacity</Label>
                <Input
                  type="number"
                  value={roomForm.capacity}
                  onChange={(e) => setRoomForm((prev) => ({ ...prev, capacity: e.target.value }))}
                  placeholder="e.g. 40"
                />
              </div>
            </div>

            <div className="grid gap-4 grid-cols-2">
              <div>
                <Label>Area (sq. ft.)</Label>
                <Input
                  type="number"
                  value={roomForm.area}
                  onChange={(e) => setRoomForm((prev) => ({ ...prev, area: e.target.value }))}
                  placeholder="e.g. 500"
                />
              </div>
              {editingRoom && (
                <div>
                  <Label>Status</Label>
                  <Select
                    value={roomForm.status}
                    onValueChange={(v) => setRoomForm((prev) => ({ ...prev, status: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROOM_STATUSES.map((s) => (
                        <SelectItem key={s.value} value={s.value}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div>
              <Label>Amenities</Label>
              <Input
                value={roomForm.amenities}
                onChange={(e) => setRoomForm((prev) => ({ ...prev, amenities: e.target.value }))}
                placeholder="e.g. Projector, Whiteboard, AC (comma-separated)"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setRoomDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveRoom} disabled={roomSaving}>
                {roomSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editingRoom ? 'Update' : 'Create'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ============ Delete Building Confirmation ============ */}
      <AlertDialog
        open={!!deletingBuilding}
        onOpenChange={(open) => !open && setDeletingBuilding(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Building</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &ldquo;{deletingBuilding?.name}&rdquo;? This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteBuilding}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ============ Delete Room Confirmation ============ */}
      <AlertDialog open={!!deletingRoom} onOpenChange={(open) => !open && setDeletingRoom(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Room</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete room &ldquo;{deletingRoom?.roomNumber}&rdquo;
              {deletingRoom?.name ? ` (${deletingRoom.name})` : ''}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteRoom}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
