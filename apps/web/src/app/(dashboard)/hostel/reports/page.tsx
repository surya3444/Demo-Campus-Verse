'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { hostelApi } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { BarChart3, BedDouble, Users, Hotel } from 'lucide-react';

export default function HostelReportsPage() {
  const [activeTab, setActiveTab] = useState('occupancy');
  const [hostelFilter, setHostelFilter] = useState<string>('');

  // Fetch hostels for filter
  const { data: hostelsData } = useQuery({
    queryKey: ['hostels-list'],
    queryFn: () => hostelApi.getHostels({ limit: 100 }),
  });

  // Occupancy Report
  const { data: occupancyData, isLoading: occupancyLoading } = useQuery({
    queryKey: ['report-occupancy', hostelFilter],
    queryFn: () =>
      hostelApi.getOccupancyReport({
        hostelId: hostelFilter || undefined,
      }),
    enabled: activeTab === 'occupancy',
  });

  // Vacancy Report
  const { data: vacancyData, isLoading: vacancyLoading } = useQuery({
    queryKey: ['report-vacancy', hostelFilter],
    queryFn: () =>
      hostelApi.getVacancyReport({
        hostelId: hostelFilter || undefined,
      }),
    enabled: activeTab === 'vacancy',
  });

  // Class-wise Report
  const { data: classWiseData, isLoading: classWiseLoading } = useQuery({
    queryKey: ['report-class-wise', hostelFilter],
    queryFn: () =>
      hostelApi.getClassWiseReport({
        hostelId: hostelFilter || undefined,
      }),
    enabled: activeTab === 'class-wise',
  });

  const hostels = hostelsData?.data || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Hostel Reports</h1>
          <p className="text-muted-foreground">
            View detailed hostel occupancy and allocation reports
          </p>
        </div>
        <Select
          value={hostelFilter || 'all'}
          onValueChange={(val) => setHostelFilter(val === 'all' ? '' : val)}
        >
          <SelectTrigger className="w-[200px]">
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
      </div>

      {/* Reports Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="occupancy">
            <BarChart3 className="mr-2 h-4 w-4" />
            Occupancy
          </TabsTrigger>
          <TabsTrigger value="vacancy">
            <BedDouble className="mr-2 h-4 w-4" />
            Vacancy
          </TabsTrigger>
          <TabsTrigger value="class-wise">
            <Users className="mr-2 h-4 w-4" />
            Class-wise
          </TabsTrigger>
        </TabsList>

        {/* Occupancy Report */}
        <TabsContent value="occupancy" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Occupancy Report</CardTitle>
              <CardDescription>Hostel-wise bed occupancy overview</CardDescription>
            </CardHeader>
            <CardContent>
              {occupancyLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-16" />
                  ))}
                </div>
              ) : !occupancyData?.data?.length ? (
                <div className="text-center py-8">
                  <BarChart3 className="mx-auto h-10 w-10 text-muted-foreground/50" />
                  <p className="mt-2 text-sm text-muted-foreground">No occupancy data available</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Visual bars */}
                  <div className="space-y-4">
                    {occupancyData.data.map(
                      (item: {
                        _id: string;
                        hostelName: string;
                        hostelType: string;
                        totalBeds: number;
                        occupiedBeds: number;
                        availableBeds: number;
                        occupancyRate: number;
                      }) => (
                        <div key={item._id} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Hotel className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">{item.hostelName}</span>
                              <Badge variant="outline" className="capitalize text-xs">
                                {item.hostelType}
                              </Badge>
                            </div>
                            <div className="text-sm text-muted-foreground">
                              <span className="font-medium text-foreground">
                                {item.occupiedBeds}
                              </span>
                              /{item.totalBeds} beds ({item.occupancyRate}%)
                            </div>
                          </div>
                          <Progress value={item.occupancyRate} />
                          <div className="flex gap-4 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <div className="w-2 h-2 rounded-full bg-primary" />
                              Occupied: {item.occupiedBeds}
                            </span>
                            <span className="flex items-center gap-1">
                              <div className="w-2 h-2 rounded-full bg-gray-300" />
                              Available: {item.availableBeds}
                            </span>
                          </div>
                        </div>
                      )
                    )}
                  </div>

                  {/* Summary table */}
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Hostel</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead className="text-right">Total Beds</TableHead>
                        <TableHead className="text-right">Occupied</TableHead>
                        <TableHead className="text-right">Available</TableHead>
                        <TableHead className="text-right">Occupancy %</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {occupancyData.data.map(
                        (item: {
                          _id: string;
                          hostelName: string;
                          hostelType: string;
                          totalBeds: number;
                          occupiedBeds: number;
                          availableBeds: number;
                          occupancyRate: number;
                        }) => (
                          <TableRow key={item._id}>
                            <TableCell className="font-medium">{item.hostelName}</TableCell>
                            <TableCell className="capitalize">{item.hostelType}</TableCell>
                            <TableCell className="text-right">{item.totalBeds}</TableCell>
                            <TableCell className="text-right">{item.occupiedBeds}</TableCell>
                            <TableCell className="text-right">{item.availableBeds}</TableCell>
                            <TableCell className="text-right">
                              <Badge
                                variant={
                                  item.occupancyRate >= 90
                                    ? 'destructive'
                                    : item.occupancyRate >= 70
                                      ? 'secondary'
                                      : 'default'
                                }
                              >
                                {item.occupancyRate}%
                              </Badge>
                            </TableCell>
                          </TableRow>
                        )
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Vacancy Report */}
        <TabsContent value="vacancy" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Vacancy Report</CardTitle>
              <CardDescription>Rooms with available beds across hostels</CardDescription>
            </CardHeader>
            <CardContent>
              {vacancyLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-12" />
                  ))}
                </div>
              ) : !vacancyData?.data?.length ? (
                <div className="text-center py-8">
                  <BedDouble className="mx-auto h-10 w-10 text-muted-foreground/50" />
                  <p className="mt-2 text-sm text-muted-foreground">
                    No vacant rooms found. All rooms are fully occupied.
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Hostel</TableHead>
                      <TableHead>Room Number</TableHead>
                      <TableHead>Floor</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Capacity</TableHead>
                      <TableHead className="text-right">Occupied</TableHead>
                      <TableHead className="text-right">Available</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {vacancyData.data.map(
                      (room: {
                        _id: string;
                        hostelName: string;
                        roomNumber: string;
                        floor: number;
                        type: string;
                        capacity: number;
                        occupiedBeds: number;
                        availableBeds: number;
                        status: string;
                      }) => (
                        <TableRow key={room._id}>
                          <TableCell>{room.hostelName}</TableCell>
                          <TableCell className="font-medium">{room.roomNumber}</TableCell>
                          <TableCell>Floor {room.floor}</TableCell>
                          <TableCell className="capitalize">{room.type}</TableCell>
                          <TableCell className="text-right">{room.capacity}</TableCell>
                          <TableCell className="text-right">{room.occupiedBeds}</TableCell>
                          <TableCell className="text-right font-medium text-green-600">
                            {room.availableBeds}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                room.status === 'available'
                                  ? 'default'
                                  : room.status === 'partially_occupied'
                                    ? 'secondary'
                                    : 'outline'
                              }
                            >
                              {room.status === 'partially_occupied' ? 'Partial' : room.status}
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
        </TabsContent>

        {/* Class-wise Report */}
        <TabsContent value="class-wise" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Class-wise Report</CardTitle>
              <CardDescription>Student distribution by class across hostels</CardDescription>
            </CardHeader>
            <CardContent>
              {classWiseLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-12" />
                  ))}
                </div>
              ) : !classWiseData?.data?.length ? (
                <div className="text-center py-8">
                  <Users className="mx-auto h-10 w-10 text-muted-foreground/50" />
                  <p className="mt-2 text-sm text-muted-foreground">No class-wise data available</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Class</TableHead>
                      <TableHead>Hostel</TableHead>
                      <TableHead className="text-right">Students</TableHead>
                      <TableHead className="text-right">Percentage</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {classWiseData.data.map(
                      (
                        item: {
                          className: string;
                          hostelName: string;
                          studentCount: number;
                          percentage: number;
                        },
                        index: number
                      ) => (
                        <TableRow key={`${item.className}-${item.hostelName}-${index}`}>
                          <TableCell className="font-medium">{item.className}</TableCell>
                          <TableCell>{item.hostelName}</TableCell>
                          <TableCell className="text-right">{item.studentCount}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-16">
                                <Progress value={item.percentage} className="h-2" />
                              </div>
                              <span className="text-sm">{item.percentage}%</span>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
