'use client';

import { useQuery } from '@tanstack/react-query';
import { hostelApi } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import Link from 'next/link';
import {
  Hotel,
  BedDouble,
  Users,
  Activity,
  ArrowRight,
  Plus,
  BarChart3,
  Settings,
} from 'lucide-react';

export default function HostelDashboardPage() {
  const { data: statsData, isLoading } = useQuery({
    queryKey: ['hostel-stats'],
    queryFn: () => hostelApi.getHostelStats(),
  });

  const { data: allocationStats } = useQuery({
    queryKey: ['hostel-allocation-stats'],
    queryFn: () => hostelApi.getAllocationStats(),
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  const stats = statsData?.data || {
    totalHostels: 0,
    totalRooms: 0,
    totalBeds: 0,
    occupiedBeds: 0,
    availableBeds: 0,
    occupancyRate: 0,
  };

  const allocStats = allocationStats?.data || {
    totalAllocations: 0,
    activeAllocations: 0,
    pendingTransfers: 0,
    recentVacations: 0,
  };

  const occupancyPercent =
    stats.totalBeds > 0 ? Math.round((stats.occupiedBeds / stats.totalBeds) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Hostel Dashboard</h1>
          <p className="text-muted-foreground">
            Overview of hostel management, rooms, and allocations
          </p>
        </div>
        <Button asChild>
          <Link href="/hostel/hostels">
            View All Hostels <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Hostels</CardTitle>
            <Hotel className="h-4 w-4 text-indigo-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalHostels}</div>
            <p className="text-xs text-muted-foreground">Registered hostels</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Rooms</CardTitle>
            <BedDouble className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalRooms}</div>
            <p className="text-xs text-muted-foreground">{stats.totalBeds} total beds</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Occupied Beds</CardTitle>
            <Users className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.occupiedBeds}</div>
            <p className="text-xs text-muted-foreground">{stats.availableBeds} beds available</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Occupancy Rate</CardTitle>
            <Activity className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{occupancyPercent}%</div>
            <Progress value={occupancyPercent} className="mt-2" />
          </CardContent>
        </Card>
      </div>

      {/* Allocation Overview */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Allocation Overview</CardTitle>
                <CardDescription>Current hostel allocation summary</CardDescription>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link href="/hostel/allocations">View All</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b pb-3">
                <div className="space-y-1">
                  <p className="text-sm font-medium">Active Allocations</p>
                  <p className="text-xs text-muted-foreground">Currently assigned beds</p>
                </div>
                <span className="text-2xl font-bold text-green-600">
                  {allocStats.activeAllocations}
                </span>
              </div>
              <div className="flex items-center justify-between border-b pb-3">
                <div className="space-y-1">
                  <p className="text-sm font-medium">Pending Transfers</p>
                  <p className="text-xs text-muted-foreground">Awaiting completion</p>
                </div>
                <span className="text-2xl font-bold text-amber-600">
                  {allocStats.pendingTransfers}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium">Recent Vacations</p>
                  <p className="text-xs text-muted-foreground">Last 30 days</p>
                </div>
                <span className="text-2xl font-bold text-blue-600">
                  {allocStats.recentVacations}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Occupancy by Hostel */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Occupancy by Hostel</CardTitle>
                <CardDescription>Bed utilization per hostel</CardDescription>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link href="/hostel/reports">Reports</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {stats.hostelBreakdown?.length > 0 ? (
              <div className="space-y-4">
                {stats.hostelBreakdown
                  .slice(0, 5)
                  .map(
                    (hostel: {
                      _id: string;
                      name: string;
                      totalBeds: number;
                      occupiedBeds: number;
                    }) => {
                      const pct =
                        hostel.totalBeds > 0
                          ? Math.round((hostel.occupiedBeds / hostel.totalBeds) * 100)
                          : 0;
                      return (
                        <div key={hostel._id} className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-medium">{hostel.name}</span>
                            <span className="text-muted-foreground">
                              {hostel.occupiedBeds}/{hostel.totalBeds} beds ({pct}%)
                            </span>
                          </div>
                          <Progress value={pct} />
                        </div>
                      );
                    }
                  )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                No hostel data available
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Common hostel management tasks</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <Button variant="outline" className="h-auto flex-col py-4" asChild>
              <Link href="/hostel/allocations/new">
                <Plus className="h-6 w-6 mb-2 text-green-500" />
                <span>New Allocation</span>
              </Link>
            </Button>
            <Button variant="outline" className="h-auto flex-col py-4" asChild>
              <Link href="/hostel/hostels">
                <Hotel className="h-6 w-6 mb-2 text-indigo-500" />
                <span>Manage Hostels</span>
              </Link>
            </Button>
            <Button variant="outline" className="h-auto flex-col py-4" asChild>
              <Link href="/hostel/reports">
                <BarChart3 className="h-6 w-6 mb-2 text-blue-500" />
                <span>View Reports</span>
              </Link>
            </Button>
            <Button variant="outline" className="h-auto flex-col py-4" asChild>
              <Link href="/hostel/settings">
                <Settings className="h-6 w-6 mb-2 text-gray-500" />
                <span>Hostel Settings</span>
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
