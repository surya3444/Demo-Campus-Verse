'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ArrowLeft,
  Bus,
  MapPin,
  Clock,
  Navigation2,
  Phone,
  IndianRupee,
  User,
  CalendarDays,
} from 'lucide-react';
import { transportApi } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';

interface MyEnrollmentResponse {
  enrollment: {
    _id: string;
    busId: string;
    busNumber?: string;
    busName?: string;
    stopId: string;
    stopName?: string;
    pickupTime?: string;
    dropTime?: string;
    pickupEnabled: boolean;
    dropEnabled: boolean;
    priceSnapshot: number;
    pricingModeSnapshot: 'flat' | 'per_stop';
    frequencySnapshot: 'monthly' | 'quarterly' | 'yearly';
    currencySnapshot: string;
    startDate: string;
    status: 'active' | 'withdrawn' | 'transferred';
  };
  bus: {
    _id: string;
    busNumber: string;
    name: string;
    type: string;
    capacity: number;
    driverName?: string;
    driverPhone?: string;
    conductorName?: string;
    conductorPhone?: string;
    vehicleRegistration?: string;
    startLocation?: { name: string; address?: string };
    stops: Array<{
      _id: string;
      name: string;
      address?: string;
      sequence: number;
      pickupTime?: string;
      dropTime?: string;
      fare?: number;
    }>;
    pricing: {
      mode: 'flat' | 'per_stop';
      flatPrice?: number;
      frequency: string;
      currency: string;
    };
    totalDistanceMeters?: number;
    totalDurationSeconds?: number;
  } | null;
}

function formatDistance(m?: number) {
  if (!m) return '—';
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${m} m`;
}

function formatDuration(s?: number) {
  if (!s) return '—';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m} min`;
}

export default function StudentTransportPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['transport-my-enrollment', 'detail'],
    queryFn: async () => {
      const res = await transportApi.getMyEnrollment();
      return (res?.data ?? null) as MyEnrollmentResponse | null;
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!data || !data.enrollment) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My Transport</h1>
        </div>
        <Card>
          <CardContent className="py-12 text-center">
            <Bus className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-medium">No transport enrollment</h3>
            <p className="text-muted-foreground">
              You are not currently availing the school transport service.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { enrollment, bus } = data;
  const myStopId = enrollment.stopId;

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">My Transport</h1>
          <p className="text-muted-foreground">
            {enrollment.busNumber} · {enrollment.busName}
          </p>
        </div>
        <Badge variant="outline" className="capitalize">
          {enrollment.status}
        </Badge>
      </div>

      {/* Key stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-muted-foreground">Pickup</p>
              <Clock className="h-4 w-4 text-green-500" />
            </div>
            <p className="text-2xl font-bold tabular-nums">
              {enrollment.pickupEnabled && enrollment.pickupTime ? enrollment.pickupTime : '—'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {enrollment.pickupEnabled
                ? 'from ' + (enrollment.stopName || 'your stop')
                : 'Not availing pickup'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-muted-foreground">Drop</p>
              <Clock className="h-4 w-4 text-amber-500" />
            </div>
            <p className="text-2xl font-bold tabular-nums">
              {enrollment.dropEnabled && enrollment.dropTime ? enrollment.dropTime : '—'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {enrollment.dropEnabled
                ? 'at ' + (enrollment.stopName || 'your stop')
                : 'Not availing drop'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-muted-foreground">Monthly Fare</p>
              <IndianRupee className="h-4 w-4 text-blue-500" />
            </div>
            <p className="text-2xl font-bold">{formatCurrency(enrollment.priceSnapshot || 0)}</p>
            <p className="text-xs text-muted-foreground mt-1 capitalize">
              {enrollment.pricingModeSnapshot === 'per_stop' ? 'Per-stop pricing' : 'Flat pricing'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-muted-foreground">Since</p>
              <CalendarDays className="h-4 w-4 text-purple-500" />
            </div>
            <p className="text-lg font-bold">
              {new Date(enrollment.startDate).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Enrolled</p>
          </CardContent>
        </Card>
      </div>

      {/* Bus + crew */}
      {bus && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Bus className="h-4 w-4 text-blue-500" />
              Bus &amp; Crew
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Vehicle</p>
              <p className="font-medium">
                {bus.busNumber}
                {bus.vehicleRegistration && (
                  <span className="text-muted-foreground font-mono text-xs ml-2">
                    {bus.vehicleRegistration}
                  </span>
                )}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Type / Capacity</p>
              <p className="font-medium capitalize">
                {bus.type} · {bus.capacity} seats
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <User className="h-3 w-3" />
                Driver
              </p>
              <p className="font-medium">{bus.driverName || '—'}</p>
              {bus.driverPhone && (
                <a
                  href={`tel:${bus.driverPhone}`}
                  className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1 mt-0.5"
                >
                  <Phone className="h-3 w-3" />
                  {bus.driverPhone}
                </a>
              )}
            </div>
            {(bus.conductorName || bus.conductorPhone) && (
              <div>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <User className="h-3 w-3" />
                  Conductor
                </p>
                <p className="font-medium">{bus.conductorName || '—'}</p>
                {bus.conductorPhone && (
                  <a
                    href={`tel:${bus.conductorPhone}`}
                    className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1 mt-0.5"
                  >
                    <Phone className="h-3 w-3" />
                    {bus.conductorPhone}
                  </a>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Route */}
      {bus && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Navigation2 className="h-4 w-4 text-blue-500" />
              Route
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              {formatDistance(bus.totalDistanceMeters)} · {formatDuration(bus.totalDurationSeconds)}{' '}
              travel time
            </p>
          </CardHeader>
          <CardContent>
            <ol className="space-y-2">
              {bus.startLocation && (
                <li className="flex items-start gap-3 p-2.5 rounded-md bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900">
                  <div className="flex items-center justify-center h-6 w-6 rounded-full bg-emerald-600 text-white text-xs font-bold shrink-0 mt-0.5">
                    A
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {bus.startLocation.name} · School
                    </p>
                    {bus.startLocation.address && (
                      <p className="text-xs text-muted-foreground truncate">
                        {bus.startLocation.address}
                      </p>
                    )}
                  </div>
                </li>
              )}
              {bus.stops.map((stop, idx) => {
                const isMine = stop._id === myStopId;
                return (
                  <li
                    key={stop._id}
                    className={`flex items-start gap-3 p-2.5 rounded-md border ${
                      isMine ? 'border-primary bg-primary/5' : 'border-border'
                    }`}
                  >
                    <div
                      className={`flex items-center justify-center h-6 w-6 rounded-full text-xs font-bold shrink-0 mt-0.5 ${
                        isMine
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium truncate">{stop.name}</p>
                        {isMine && (
                          <Badge variant="default" className="text-[10px] h-4">
                            Your stop
                          </Badge>
                        )}
                      </div>
                      {stop.address && (
                        <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {stop.address}
                        </p>
                      )}
                    </div>
                    <div className="text-right text-xs shrink-0">
                      {stop.pickupTime && (
                        <p>
                          <span className="text-muted-foreground">Pickup </span>
                          <span className="font-medium tabular-nums">{stop.pickupTime}</span>
                        </p>
                      )}
                      {stop.dropTime && (
                        <p>
                          <span className="text-muted-foreground">Drop </span>
                          <span className="font-medium tabular-nums">{stop.dropTime}</span>
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
