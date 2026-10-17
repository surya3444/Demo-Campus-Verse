'use client';

import { useQuery } from '@tanstack/react-query';
import { dashboardApi, hostelApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Hotel, BedDouble, Calendar, MapPin } from 'lucide-react';

export default function StudentHostelPage() {
  const { data: dashData } = useQuery({
    queryKey: ['student-dashboard'],
    queryFn: () => dashboardApi.getStudentDashboard(),
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const student = dashData?.data?.student as Record<string, any> | undefined;
  const studentId = student?._id as string | undefined;

  const { data: allocationData, isLoading } = useQuery({
    queryKey: ['student-hostel-allocation', studentId],
    queryFn: () => hostelApi.getStudentAllocation(studentId!),
    enabled: !!studentId,
  });

  if (!student || isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allocations = (allocationData?.data || []) as Record<string, any>[];
  const activeAllocation = allocations.find((a) => a.status === 'active');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Hostel Details</h1>
        <p className="text-muted-foreground">
          {student.className} - {student.sectionName}
        </p>
      </div>

      {!activeAllocation ? (
        <Card>
          <CardContent className="py-12 text-center">
            <BedDouble className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-medium">No hostel allocation</h3>
            <p className="text-muted-foreground">
              You are not currently allocated to any hostel room.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {/* Current Allocation */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Hotel className="h-4 w-4 text-purple-500" />
                Current Allocation
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Hostel</p>
                  <p className="font-medium">{activeAllocation.hostelName}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Room</p>
                  <p className="font-medium flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" />
                    Room {activeAllocation.roomNumber}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Bed</p>
                  <p className="font-medium flex items-center gap-1">
                    <BedDouble className="h-3.5 w-3.5" />
                    Bed {activeAllocation.bedNumber}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <Badge variant="default" className="bg-green-600">
                    Active
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Allocated On</p>
                  <p className="font-medium flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    {new Date(activeAllocation.allocationDate).toLocaleDateString()}
                  </p>
                </div>
                {activeAllocation.expectedVacatingDate && (
                  <div>
                    <p className="text-sm text-muted-foreground">Expected Vacating</p>
                    <p className="font-medium">
                      {new Date(activeAllocation.expectedVacatingDate).toLocaleDateString()}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Allocation History */}
          {allocations.length > 1 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Allocation History</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {allocations
                    .filter((a) => a.status !== 'active')
                    .map((alloc) => (
                      <div
                        key={alloc._id}
                        className="flex items-center justify-between p-2.5 rounded-lg border"
                      >
                        <div>
                          <p className="text-sm font-medium">
                            {alloc.hostelName} - Room {alloc.roomNumber}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(alloc.allocationDate).toLocaleDateString()}
                            {alloc.actualVacatingDate &&
                              ` to ${new Date(alloc.actualVacatingDate).toLocaleDateString()}`}
                          </p>
                        </div>
                        <Badge
                          variant={alloc.status === 'vacated' ? 'secondary' : 'outline'}
                          className="text-xs capitalize"
                        >
                          {alloc.status}
                        </Badge>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
