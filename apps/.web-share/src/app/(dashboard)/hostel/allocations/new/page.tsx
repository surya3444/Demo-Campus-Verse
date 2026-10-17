'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { hostelApi, api } from '@/lib/api';
import { getErrorMessage } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Search,
  Users,
  Hotel,
  BedDouble,
  Loader2,
  CheckCircle,
  Wrench,
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

const STEPS = [
  { id: 1, label: 'Select Student', icon: Users },
  { id: 2, label: 'Select Hostel', icon: Hotel },
  { id: 3, label: 'Select Room & Bed', icon: BedDouble },
  { id: 4, label: 'Confirm', icon: CheckCircle },
];

interface SelectedStudent {
  _id: string;
  firstName: string;
  lastName: string;
  admissionNumber?: string;
  className?: string;
  sectionName?: string;
}

interface SelectedHostel {
  _id: string;
  name: string;
  code: string;
  type: string;
}

interface Bed {
  bedNumber: string;
  status: string;
  studentId?: string;
}

interface SelectedRoom {
  _id: string;
  roomNumber: string;
  floor: string;
  type: string;
  capacity: number;
  occupiedBeds: number;
  beds: Bed[];
  monthlyRent?: number;
  securityDeposit?: number;
}

export default function NewAllocationPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [currentStep, setCurrentStep] = useState(1);

  // Step 1: Student search
  const [studentSearch, setStudentSearch] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<SelectedStudent | null>(null);

  // Step 2: Hostel selection
  const [selectedHostel, setSelectedHostel] = useState<SelectedHostel | null>(null);

  // Step 3: Room & Bed selection
  const [selectedRoom, setSelectedRoom] = useState<SelectedRoom | null>(null);
  const [selectedBed, setSelectedBed] = useState<string | null>(null);
  const [selectedFloor, setSelectedFloor] = useState<string | null>(null);

  // Fetch students for search
  const { data: studentsData, isLoading: studentsLoading } = useQuery({
    queryKey: ['student-search', studentSearch],
    queryFn: async () => {
      const response = await api.get('/students', {
        params: { search: studentSearch, limit: 10 },
      });
      return response.data;
    },
    enabled: studentSearch.length >= 2,
  });

  // Fetch hostels
  const { data: hostelsData } = useQuery({
    queryKey: ['hostels-for-allocation'],
    queryFn: () => hostelApi.getHostels({ limit: 100 }),
    enabled: currentStep >= 2,
  });

  // Fetch rooms for selected hostel
  const { data: roomsData, isLoading: roomsLoading } = useQuery({
    queryKey: ['rooms-for-allocation', selectedHostel?._id],
    queryFn: () =>
      hostelApi.getRooms({
        hostelId: selectedHostel?._id,
        limit: 200,
      }),
    enabled: !!selectedHostel?._id && currentStep >= 3,
  });

  // Allocate mutation
  const allocateMutation = useMutation({
    mutationFn: () =>
      hostelApi.allocateBed({
        studentId: selectedStudent?._id,
        hostelId: selectedHostel?._id,
        roomId: selectedRoom?._id,
        bedNumber: selectedBed,
      }),
    onSuccess: () => {
      toast.success('Bed allocated successfully');
      queryClient.invalidateQueries({ queryKey: ['allocations'] });
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      queryClient.invalidateQueries({ queryKey: ['hostel-stats'] });
      router.push('/hostel/allocations');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const canGoNext = () => {
    switch (currentStep) {
      case 1:
        return !!selectedStudent;
      case 2:
        return !!selectedHostel;
      case 3:
        return !!selectedRoom && !!selectedBed;
      case 4:
        return true;
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (currentStep < 4) setCurrentStep(currentStep + 1);
  };

  const handleBack = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  const handleSelectStudent = (student: SelectedStudent) => {
    setSelectedStudent(student);
  };

  const handleSelectHostel = (hostel: SelectedHostel) => {
    setSelectedHostel(hostel);
    setSelectedRoom(null);
    setSelectedBed(null);
    setSelectedFloor(null);
  };

  const handleSelectRoom = (room: SelectedRoom) => {
    setSelectedRoom(room);
    setSelectedBed(null);
  };

  const students = studentsData?.data || [];
  const hostels = hostelsData?.data || [];
  const allRooms = roomsData?.data || [];

  // Group rooms by floor for theater-style layout
  const { floors, roomsByFloor } = useMemo(() => {
    const byFloor: Record<
      string,
      Array<{
        _id: string;
        roomNumber: string;
        floor: string;
        type: string;
        capacity: number;
        occupiedBeds: number;
        beds: Bed[];
        roomStatus: string;
        monthlyRent?: number;
        securityDeposit?: number;
      }>
    > = {};

    for (const room of allRooms) {
      const floor = room.floor || 'Ground';
      if (!byFloor[floor]) byFloor[floor] = [];
      byFloor[floor].push(room);
    }

    // Sort floors naturally
    const sortedFloors = Object.keys(byFloor).sort((a, b) => {
      const numA = parseInt(a);
      const numB = parseInt(b);
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      return a.localeCompare(b);
    });

    return { floors: sortedFloors, roomsByFloor: byFloor };
  }, [allRooms]);

  // Auto-select first floor when data loads
  const activeFloor = selectedFloor || floors[0] || '';

  const getRoomColor = (room: { roomStatus: string; occupiedBeds: number; capacity: number }) => {
    if (room.roomStatus === 'maintenance') return 'bg-gray-100 border-gray-300 text-gray-400';
    if (room.roomStatus === 'occupied' || room.occupiedBeds >= room.capacity)
      return 'bg-red-50 border-red-300 text-red-600';
    if (room.occupiedBeds > 0) return 'bg-amber-50 border-amber-300 text-amber-700';
    return 'bg-green-50 border-green-300 text-green-700';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/hostel/allocations">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">New Allocation</h1>
          <p className="text-muted-foreground">Allocate a hostel bed to a student</p>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center justify-between">
        {STEPS.map((step, index) => {
          const StepIcon = step.icon;
          const isActive = currentStep === step.id;
          const isCompleted = currentStep > step.id;

          return (
            <div key={step.id} className="flex items-center flex-1">
              <div className="flex flex-col items-center flex-1">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors ${
                    isCompleted
                      ? 'bg-green-500 border-green-500 text-white'
                      : isActive
                        ? 'bg-primary border-primary text-primary-foreground'
                        : 'border-gray-300 text-gray-400'
                  }`}
                >
                  {isCompleted ? <Check className="h-5 w-5" /> : <StepIcon className="h-5 w-5" />}
                </div>
                <span
                  className={`text-xs mt-2 font-medium ${
                    isActive ? 'text-primary' : isCompleted ? 'text-green-600' : 'text-gray-400'
                  }`}
                >
                  {step.label}
                </span>
              </div>
              {index < STEPS.length - 1 && (
                <div
                  className={`h-0.5 flex-1 mx-2 mb-6 ${
                    currentStep > step.id ? 'bg-green-500' : 'bg-gray-200'
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Step Content */}
      <Card>
        <CardContent className="pt-6">
          {/* Step 1: Select Student */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold mb-1">Select Student</h3>
                <p className="text-sm text-muted-foreground">
                  Search for a student to allocate a hostel bed to.
                </p>
              </div>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by student name or admission number..."
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  className="pl-10"
                />
              </div>

              {studentSearch.length >= 2 && (
                <div className="border rounded-lg divide-y max-h-80 overflow-y-auto">
                  {studentsLoading ? (
                    <div className="p-4 text-center text-sm text-muted-foreground">
                      Searching...
                    </div>
                  ) : students.length === 0 ? (
                    <div className="p-4 text-center text-sm text-muted-foreground">
                      No students found
                    </div>
                  ) : (
                    students.map(
                      (student: {
                        _id: string;
                        firstName: string;
                        lastName: string;
                        admissionNumber?: string;
                        className?: string;
                        sectionName?: string;
                      }) => (
                        <button
                          key={student._id}
                          type="button"
                          className={`w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors text-left ${
                            selectedStudent?._id === student._id
                              ? 'bg-primary/5 border-l-2 border-l-primary'
                              : ''
                          }`}
                          onClick={() => handleSelectStudent(student)}
                        >
                          <div>
                            <p className="font-medium">
                              {student.firstName} {student.lastName}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {student.admissionNumber || 'No admission number'}
                              {student.className && ` | ${student.className}`}
                              {student.sectionName && ` - ${student.sectionName}`}
                            </p>
                          </div>
                          {selectedStudent?._id === student._id && (
                            <Check className="h-5 w-5 text-primary" />
                          )}
                        </button>
                      )
                    )
                  )}
                </div>
              )}

              {selectedStudent && (
                <Card className="bg-primary/5 border-primary/20">
                  <CardContent className="py-3">
                    <div className="flex items-center gap-3">
                      <Users className="h-5 w-5 text-primary" />
                      <div>
                        <p className="font-medium">
                          {selectedStudent.firstName} {selectedStudent.lastName}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {selectedStudent.admissionNumber}
                          {selectedStudent.className && ` | ${selectedStudent.className}`}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Step 2: Select Hostel */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold mb-1">Select Hostel</h3>
                <p className="text-sm text-muted-foreground">Choose a hostel for the student.</p>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                {hostels.map(
                  (hostel: {
                    _id: string;
                    name: string;
                    code: string;
                    type: string;
                    totalBeds?: number;
                    occupiedBeds?: number;
                  }) => {
                    const available = (hostel.totalBeds || 0) - (hostel.occupiedBeds || 0);
                    const isSelected = selectedHostel?._id === hostel._id;

                    return (
                      <button
                        key={hostel._id}
                        type="button"
                        className={`p-4 rounded-lg border text-left transition-all hover:shadow-md ${
                          isSelected
                            ? 'border-primary bg-primary/5 shadow-md'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                        onClick={() =>
                          handleSelectHostel({
                            _id: hostel._id,
                            name: hostel.name,
                            code: hostel.code,
                            type: hostel.type,
                          })
                        }
                        disabled={available <= 0}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium">{hostel.name}</span>
                          <Badge variant="outline" className="capitalize">
                            {hostel.type}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">Code: {hostel.code}</p>
                        <p className="text-sm mt-1">
                          {available > 0 ? (
                            <span className="text-green-600 font-medium">
                              {available} beds available
                            </span>
                          ) : (
                            <span className="text-red-600 font-medium">No beds available</span>
                          )}
                          <span className="text-muted-foreground">
                            {' '}
                            / {hostel.totalBeds || 0} total
                          </span>
                        </p>
                        {isSelected && (
                          <div className="flex justify-end mt-2">
                            <Check className="h-5 w-5 text-primary" />
                          </div>
                        )}
                      </button>
                    );
                  }
                )}
              </div>

              {hostels.length === 0 && (
                <div className="text-center py-8">
                  <Hotel className="mx-auto h-10 w-10 text-muted-foreground/50" />
                  <p className="mt-2 text-sm text-muted-foreground">No hostels available</p>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Select Room & Bed (Theater-style) */}
          {currentStep === 3 && (
            <div className="space-y-5">
              <div>
                <h3 className="text-lg font-semibold mb-1">Select Room & Bed</h3>
                <p className="text-sm text-muted-foreground">
                  Choose a room and bed in {selectedHostel?.name}. Click a room to see available
                  beds.
                </p>
              </div>

              {/* Legend */}
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs bg-muted/40 rounded-lg px-4 py-2.5 border">
                <span className="text-muted-foreground font-medium mr-1">Rooms:</span>
                <div className="flex items-center gap-1.5">
                  <div className="w-3.5 h-3.5 rounded border-2 border-green-400 bg-green-50" />
                  <span>Available</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3.5 h-3.5 rounded border-2 border-amber-400 bg-amber-50" />
                  <span>Partial</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3.5 h-3.5 rounded border-2 border-red-400 bg-red-50" />
                  <span>Full</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3.5 h-3.5 rounded border-2 border-gray-300 bg-gray-100" />
                  <span>Maintenance</span>
                </div>
                <span className="text-muted-foreground font-medium ml-2 mr-1">Beds:</span>
                <div className="flex items-center gap-1.5">
                  <div className="w-3.5 h-3.5 rounded-full border-2 border-green-400 bg-green-50" />
                  <span>Free</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3.5 h-3.5 rounded-full border-2 border-red-400 bg-red-100" />
                  <span>Occupied</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3.5 h-3.5 rounded-full border-2 border-yellow-400 bg-yellow-100" />
                  <span>Reserved</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3.5 h-3.5 rounded-full border-2 border-blue-500 bg-blue-100" />
                  <span>Your Pick</span>
                </div>
              </div>

              {roomsLoading ? (
                <div className="text-center py-12 text-sm text-muted-foreground">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                  Loading rooms...
                </div>
              ) : floors.length === 0 ? (
                <div className="text-center py-12">
                  <BedDouble className="mx-auto h-10 w-10 text-muted-foreground/50" />
                  <p className="mt-2 text-sm text-muted-foreground">
                    No rooms found in this hostel
                  </p>
                </div>
              ) : (
                <Tabs value={activeFloor} onValueChange={(v) => setSelectedFloor(v)}>
                  <TabsList className="w-full justify-start overflow-x-auto">
                    {floors.map((floor) => {
                      const floorRooms = roomsByFloor[floor] || [];
                      const availCount = floorRooms.reduce(
                        (sum, r) => sum + Math.max(0, r.capacity - (r.occupiedBeds || 0)),
                        0
                      );
                      return (
                        <TabsTrigger key={floor} value={floor} className="gap-1.5">
                          Floor {floor}
                          <Badge
                            variant={availCount > 0 ? 'secondary' : 'outline'}
                            className={`ml-1 text-[10px] px-1.5 py-0 ${availCount === 0 ? 'text-muted-foreground' : ''}`}
                          >
                            {availCount} {availCount === 1 ? 'bed' : 'beds'}
                          </Badge>
                        </TabsTrigger>
                      );
                    })}
                  </TabsList>

                  {floors.map((floor) => {
                    const floorRooms = roomsByFloor[floor] || [];
                    return (
                      <TabsContent key={floor} value={floor} className="mt-4 space-y-4">
                        {/* Corridor-style Room Layout */}
                        <div className="relative">
                          {/* Corridor line */}
                          {floorRooms.length > 0 && (
                            <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-px border-t-2 border-dashed border-muted-foreground/20 z-0 pointer-events-none" />
                          )}

                          {/* Rooms arranged in two rows (like rooms along a corridor) */}
                          <div className="relative z-10 space-y-3">
                            {/* Top row - even index rooms */}
                            <div className="flex flex-wrap gap-2.5 justify-center">
                              <TooltipProvider delayDuration={200}>
                                {floorRooms
                                  .filter((_, i) => i % 2 === 0)
                                  .map((room) => {
                                    const availableBedCount =
                                      room.capacity - (room.occupiedBeds || 0);
                                    const isSelected = selectedRoom?._id === room._id;
                                    const isMaintenance = room.roomStatus === 'maintenance';
                                    const isFull =
                                      room.roomStatus === 'occupied' ||
                                      room.occupiedBeds >= room.capacity;
                                    const occupancyPercent =
                                      room.capacity > 0
                                        ? ((room.occupiedBeds || 0) / room.capacity) * 100
                                        : 0;

                                    return (
                                      <Tooltip key={room._id}>
                                        <TooltipTrigger asChild>
                                          <button
                                            type="button"
                                            className={`relative w-28 h-24 rounded-xl border-2 flex flex-col items-center justify-center transition-all duration-200 ${
                                              isSelected
                                                ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-500/30 shadow-lg scale-105'
                                                : getRoomColor(room)
                                            } ${
                                              isMaintenance || isFull
                                                ? 'opacity-50 cursor-not-allowed'
                                                : 'hover:shadow-lg hover:scale-[1.03]'
                                            }`}
                                            onClick={() => {
                                              if (isMaintenance || isFull) return;
                                              handleSelectRoom({
                                                _id: room._id,
                                                roomNumber: room.roomNumber,
                                                floor: room.floor,
                                                type: room.type,
                                                capacity: room.capacity,
                                                occupiedBeds: room.occupiedBeds || 0,
                                                beds: room.beds || [],
                                                monthlyRent: room.monthlyRent,
                                                securityDeposit: room.securityDeposit,
                                              });
                                            }}
                                            disabled={isMaintenance || isFull}
                                          >
                                            <span className="font-bold text-sm leading-tight">
                                              {room.roomNumber}
                                            </span>
                                            <span className="text-[10px] capitalize opacity-75">
                                              {room.type}
                                            </span>
                                            {isMaintenance ? (
                                              <Wrench className="h-3.5 w-3.5 mt-1" />
                                            ) : (
                                              <>
                                                {/* Mini occupancy bar */}
                                                <div className="w-14 h-1.5 rounded-full bg-black/10 mt-1.5 overflow-hidden">
                                                  <div
                                                    className={`h-full rounded-full transition-all ${
                                                      isFull
                                                        ? 'bg-red-400'
                                                        : occupancyPercent > 0
                                                          ? 'bg-amber-400'
                                                          : 'bg-green-400'
                                                    }`}
                                                    style={{
                                                      width: `${occupancyPercent}%`,
                                                    }}
                                                  />
                                                </div>
                                                <span className="text-[10px] mt-0.5 font-semibold">
                                                  {availableBedCount > 0
                                                    ? `${availableBedCount}/${room.capacity} free`
                                                    : 'Full'}
                                                </span>
                                              </>
                                            )}
                                            {isSelected && (
                                              <div className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center shadow-sm">
                                                <Check className="h-3 w-3 text-white" />
                                              </div>
                                            )}
                                          </button>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          <p className="font-medium">
                                            Room {room.roomNumber} - {room.type}
                                          </p>
                                          <p className="text-xs text-muted-foreground">
                                            {room.occupiedBeds || 0}/{room.capacity} occupied
                                            {room.monthlyRent
                                              ? ` | ₹${room.monthlyRent.toLocaleString()}/mo`
                                              : ''}
                                          </p>
                                        </TooltipContent>
                                      </Tooltip>
                                    );
                                  })}
                              </TooltipProvider>
                            </div>

                            {/* Corridor label */}
                            {floorRooms.length > 0 && (
                              <div className="flex items-center justify-center py-1">
                                <span className="text-[10px] font-medium text-muted-foreground/50 tracking-widest uppercase bg-background px-3">
                                  corridor
                                </span>
                              </div>
                            )}

                            {/* Bottom row - odd index rooms */}
                            <div className="flex flex-wrap gap-2.5 justify-center">
                              <TooltipProvider delayDuration={200}>
                                {floorRooms
                                  .filter((_, i) => i % 2 === 1)
                                  .map((room) => {
                                    const availableBedCount =
                                      room.capacity - (room.occupiedBeds || 0);
                                    const isSelected = selectedRoom?._id === room._id;
                                    const isMaintenance = room.roomStatus === 'maintenance';
                                    const isFull =
                                      room.roomStatus === 'occupied' ||
                                      room.occupiedBeds >= room.capacity;
                                    const occupancyPercent =
                                      room.capacity > 0
                                        ? ((room.occupiedBeds || 0) / room.capacity) * 100
                                        : 0;

                                    return (
                                      <Tooltip key={room._id}>
                                        <TooltipTrigger asChild>
                                          <button
                                            type="button"
                                            className={`relative w-28 h-24 rounded-xl border-2 flex flex-col items-center justify-center transition-all duration-200 ${
                                              isSelected
                                                ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-500/30 shadow-lg scale-105'
                                                : getRoomColor(room)
                                            } ${
                                              isMaintenance || isFull
                                                ? 'opacity-50 cursor-not-allowed'
                                                : 'hover:shadow-lg hover:scale-[1.03]'
                                            }`}
                                            onClick={() => {
                                              if (isMaintenance || isFull) return;
                                              handleSelectRoom({
                                                _id: room._id,
                                                roomNumber: room.roomNumber,
                                                floor: room.floor,
                                                type: room.type,
                                                capacity: room.capacity,
                                                occupiedBeds: room.occupiedBeds || 0,
                                                beds: room.beds || [],
                                                monthlyRent: room.monthlyRent,
                                                securityDeposit: room.securityDeposit,
                                              });
                                            }}
                                            disabled={isMaintenance || isFull}
                                          >
                                            <span className="font-bold text-sm leading-tight">
                                              {room.roomNumber}
                                            </span>
                                            <span className="text-[10px] capitalize opacity-75">
                                              {room.type}
                                            </span>
                                            {isMaintenance ? (
                                              <Wrench className="h-3.5 w-3.5 mt-1" />
                                            ) : (
                                              <>
                                                <div className="w-14 h-1.5 rounded-full bg-black/10 mt-1.5 overflow-hidden">
                                                  <div
                                                    className={`h-full rounded-full transition-all ${
                                                      isFull
                                                        ? 'bg-red-400'
                                                        : occupancyPercent > 0
                                                          ? 'bg-amber-400'
                                                          : 'bg-green-400'
                                                    }`}
                                                    style={{
                                                      width: `${occupancyPercent}%`,
                                                    }}
                                                  />
                                                </div>
                                                <span className="text-[10px] mt-0.5 font-semibold">
                                                  {availableBedCount > 0
                                                    ? `${availableBedCount}/${room.capacity} free`
                                                    : 'Full'}
                                                </span>
                                              </>
                                            )}
                                            {isSelected && (
                                              <div className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center shadow-sm">
                                                <Check className="h-3 w-3 text-white" />
                                              </div>
                                            )}
                                          </button>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          <p className="font-medium">
                                            Room {room.roomNumber} - {room.type}
                                          </p>
                                          <p className="text-xs text-muted-foreground">
                                            {room.occupiedBeds || 0}/{room.capacity} occupied
                                            {room.monthlyRent
                                              ? ` | ₹${room.monthlyRent.toLocaleString()}/mo`
                                              : ''}
                                          </p>
                                        </TooltipContent>
                                      </Tooltip>
                                    );
                                  })}
                              </TooltipProvider>
                            </div>
                          </div>
                        </div>

                        {floorRooms.length === 0 && (
                          <p className="text-sm text-muted-foreground text-center py-8">
                            No rooms on this floor
                          </p>
                        )}
                      </TabsContent>
                    );
                  })}
                </Tabs>
              )}

              {/* Bed Selection Panel - Theater Seat Style */}
              {selectedRoom && (
                <div className="border-2 border-blue-200 rounded-xl p-5 bg-gradient-to-b from-blue-50/50 to-background space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-base">
                        Room {selectedRoom.roomNumber}
                        <Badge variant="outline" className="ml-2 text-xs capitalize">
                          {selectedRoom.type}
                        </Badge>
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Floor {selectedRoom.floor} &middot; {selectedRoom.capacity} beds total
                        &middot; {selectedRoom.capacity - selectedRoom.occupiedBeds} available
                        {selectedRoom.monthlyRent
                          ? ` &middot; ₹${selectedRoom.monthlyRent.toLocaleString()}/mo`
                          : ''}
                      </p>
                    </div>
                    {selectedBed && (
                      <Badge className="bg-blue-500 text-sm px-3 py-1">Bed {selectedBed}</Badge>
                    )}
                  </div>

                  {/* Beds arranged like theater seats */}
                  <div className="flex items-center justify-center gap-4 py-3">
                    <TooltipProvider delayDuration={200}>
                      {selectedRoom.beds.map((bed) => {
                        const isSelected = selectedBed === bed.bedNumber;
                        const isAvailable = bed.status === 'available';
                        const isOccupied = bed.status === 'occupied';
                        const isMaintBed = bed.status === 'maintenance';
                        const isReserved = bed.status === 'reserved';

                        return (
                          <Tooltip key={bed.bedNumber}>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                className={`group relative flex flex-col items-center gap-1 transition-all duration-200 ${
                                  isAvailable && !isSelected ? 'hover:scale-110 cursor-pointer' : ''
                                } ${!isAvailable && !isSelected ? 'cursor-not-allowed' : ''}`}
                                onClick={() => isAvailable && setSelectedBed(bed.bedNumber)}
                                disabled={!isAvailable}
                              >
                                {/* Seat back (rounded top) */}
                                <div
                                  className={`w-14 h-8 rounded-t-2xl border-2 border-b-0 transition-all duration-200 ${
                                    isSelected
                                      ? 'bg-blue-500 border-blue-600'
                                      : isOccupied
                                        ? 'bg-red-300 border-red-400'
                                        : isMaintBed
                                          ? 'bg-gray-300 border-gray-400'
                                          : isReserved
                                            ? 'bg-yellow-300 border-yellow-400'
                                            : 'bg-green-400 border-green-500 group-hover:bg-green-500 group-hover:border-green-600'
                                  }`}
                                />
                                {/* Seat bottom */}
                                <div
                                  className={`w-16 h-6 rounded-lg border-2 -mt-1.5 flex items-center justify-center transition-all duration-200 ${
                                    isSelected
                                      ? 'bg-blue-100 border-blue-500'
                                      : isOccupied
                                        ? 'bg-red-100 border-red-300'
                                        : isMaintBed
                                          ? 'bg-gray-100 border-gray-300'
                                          : isReserved
                                            ? 'bg-yellow-100 border-yellow-300'
                                            : 'bg-green-50 border-green-300 group-hover:bg-green-100 group-hover:border-green-400'
                                  }`}
                                >
                                  {isSelected && <Check className="h-3.5 w-3.5 text-blue-600" />}
                                  {isOccupied && (
                                    <span className="text-[9px] font-bold text-red-500">TAKEN</span>
                                  )}
                                  {isMaintBed && <Wrench className="h-3 w-3 text-gray-500" />}
                                </div>
                                {/* Bed label */}
                                <span
                                  className={`text-xs font-bold mt-0.5 ${
                                    isSelected
                                      ? 'text-blue-600'
                                      : isOccupied
                                        ? 'text-red-400'
                                        : isMaintBed
                                          ? 'text-gray-400'
                                          : isReserved
                                            ? 'text-yellow-600'
                                            : 'text-green-600'
                                  }`}
                                >
                                  {bed.bedNumber}
                                </span>
                              </button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="font-medium">
                                Bed {bed.bedNumber} &mdash;{' '}
                                {isSelected
                                  ? 'Selected'
                                  : bed.status.charAt(0).toUpperCase() + bed.status.slice(1)}
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        );
                      })}
                    </TooltipProvider>
                  </div>

                  {/* Prompt when no bed selected yet */}
                  {!selectedBed && (
                    <p className="text-center text-xs text-muted-foreground animate-pulse">
                      Click an available bed to select it
                    </p>
                  )}
                </div>
              )}

              {/* Selection Summary */}
              {selectedRoom && selectedBed && (
                <div className="flex items-center gap-2 text-sm bg-blue-50 rounded-lg px-4 py-3 border border-blue-200">
                  <CheckCircle className="h-4 w-4 text-blue-500 shrink-0" />
                  <span className="text-muted-foreground">
                    Selected:{' '}
                    <span className="font-semibold text-foreground">
                      Room {selectedRoom.roomNumber}
                    </span>{' '}
                    (Floor {selectedRoom.floor}, {selectedRoom.type}) &rarr;{' '}
                    <span className="font-semibold text-foreground">Bed {selectedBed}</span>
                    {selectedRoom.monthlyRent ? (
                      <span className="ml-2 text-muted-foreground">
                        &middot; ₹{selectedRoom.monthlyRent.toLocaleString()}/mo
                      </span>
                    ) : null}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Step 4: Confirm */}
          {currentStep === 4 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold mb-1">Confirm Allocation</h3>
                <p className="text-sm text-muted-foreground">
                  Review the allocation details and confirm.
                </p>
              </div>

              <div className="border rounded-lg divide-y">
                <div className="p-4 flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Student</span>
                  <span className="font-medium">
                    {selectedStudent?.firstName} {selectedStudent?.lastName}
                    {selectedStudent?.admissionNumber && (
                      <span className="text-muted-foreground ml-2">
                        ({selectedStudent.admissionNumber})
                      </span>
                    )}
                  </span>
                </div>
                <div className="p-4 flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Hostel</span>
                  <span className="font-medium">
                    {selectedHostel?.name}{' '}
                    <Badge variant="outline" className="ml-2 capitalize">
                      {selectedHostel?.type}
                    </Badge>
                  </span>
                </div>
                <div className="p-4 flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Room</span>
                  <span className="font-medium">
                    Room {selectedRoom?.roomNumber} (Floor {selectedRoom?.floor},{' '}
                    {selectedRoom?.type})
                  </span>
                </div>
                <div className="p-4 flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Bed</span>
                  <span className="font-medium">Bed {selectedBed}</span>
                </div>
              </div>

              {/* Fee Preview */}
              {(selectedRoom?.monthlyRent ?? 0) > 0 && (
                <div className="border rounded-lg p-4 bg-amber-50/50 border-amber-200">
                  <p className="text-sm font-medium text-amber-800 mb-3">
                    Fee Breakdown (Auto-created)
                  </p>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Monthly Rent</span>
                      <span className="font-medium">
                        ₹{selectedRoom!.monthlyRent!.toLocaleString()}/mo
                      </span>
                    </div>
                    {(selectedRoom?.securityDeposit ?? 0) > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Security Deposit</span>
                        <span className="font-medium">
                          ₹{selectedRoom!.securityDeposit!.toLocaleString()}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between pt-2 border-t border-amber-200">
                      <span className="text-muted-foreground">Estimated Annual</span>
                      <span className="font-semibold">
                        ₹
                        {(
                          selectedRoom!.monthlyRent! * 12 +
                          (selectedRoom?.securityDeposit || 0)
                        ).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={handleBack} disabled={currentStep === 1}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Previous
        </Button>

        {currentStep < 4 ? (
          <Button onClick={handleNext} disabled={!canGoNext()}>
            Next <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        ) : (
          <Button onClick={() => allocateMutation.mutate()} disabled={allocateMutation.isPending}>
            {allocateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirm Allocation
          </Button>
        )}
      </div>
    </div>
  );
}
