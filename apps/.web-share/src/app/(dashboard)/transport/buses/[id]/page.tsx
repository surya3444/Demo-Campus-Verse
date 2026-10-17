'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import {
  ArrowLeft,
  Bus,
  Edit,
  IndianRupee,
  Loader2,
  MapPin,
  Phone,
  Users,
  Navigation2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { transportApi } from '@/lib/api';
import { usePermissions } from '@/hooks/usePermissions';
import { RouteMapViewer } from '@/components/transport/RouteMapViewer';
import { useTransportSettings } from '@/components/transport/useGoogleMaps';
import { EnrollmentsPanel } from '@/components/transport/EnrollmentsPanel';

function formatCurrency(amount: number, currency = 'INR') {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDistance(m?: number) {
  if (!m) return '—';
  return `${(m / 1000).toFixed(1)} km`;
}

function formatDuration(s?: number) {
  if (!s) return '—';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function BusDetailPage() {
  const params = useParams();
  const busId = params.id as string;
  const { hasPermission } = usePermissions();
  const { data: settings } = useTransportSettings();

  const { data: busRes, isLoading } = useQuery({
    queryKey: ['transport-bus', busId],
    queryFn: () => transportApi.getBus(busId),
  });

  if (isLoading || !busRes?.data) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const bus = busRes.data;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/transport">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                <Bus className="h-6 w-6 text-primary" /> {bus.busNumber}
              </h1>
              <Badge
                variant="outline"
                className={
                  bus.status === 'active'
                    ? 'bg-success/10 text-success border-success/20'
                    : 'bg-muted'
                }
              >
                {bus.status}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1">{bus.name}</p>
          </div>
        </div>
        {hasPermission('transport.buses', 'edit') && (
          <Button asChild>
            <Link href={`/transport/buses/${busId}/edit`}>
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Link>
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Occupancy</p>
            <p className="text-xl font-bold">
              {bus.enrolledCount}
              <span className="text-muted-foreground font-normal"> / {bus.capacity}</span>
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Stops</p>
            <p className="text-xl font-bold">{bus.stops?.length || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Distance</p>
            <p className="text-xl font-bold">{formatDistance(bus.totalDistanceMeters)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Est. Travel Time</p>
            <p className="text-xl font-bold">{formatDuration(bus.totalDurationSeconds)}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <MapPin className="h-4 w-4" /> Route
              </CardTitle>
            </CardHeader>
            <CardContent>
              <RouteMapViewer
                apiKey={settings?.googleMapsApiKey}
                startLocation={bus.startLocation}
                stops={bus.stops}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Navigation2 className="h-4 w-4" /> Stops ({bus.stops?.length || 0})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-2">
                <li className="flex items-center gap-3 p-3 rounded-md border bg-primary/5">
                  <div className="flex items-center justify-center h-7 w-7 rounded-full bg-primary text-primary-foreground text-xs font-bold">
                    S
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{bus.startLocation.name}</p>
                    {bus.startLocation.address && (
                      <p className="text-xs text-muted-foreground truncate">
                        {bus.startLocation.address}
                      </p>
                    )}
                  </div>
                </li>
                {bus.stops?.map(
                  (
                    stop: {
                      _id: string;
                      name: string;
                      address?: string;
                      pickupTime?: string;
                      dropTime?: string;
                      fare?: number;
                      enrolledStudents?: number;
                    },
                    idx: number
                  ) => (
                    <li
                      key={stop._id}
                      className="flex items-center gap-3 p-3 rounded-md border bg-muted/30"
                    >
                      <div className="flex items-center justify-center h-7 w-7 rounded-full bg-primary text-primary-foreground text-xs font-bold">
                        {idx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{stop.name}</p>
                        {stop.address && (
                          <p className="text-xs text-muted-foreground truncate">{stop.address}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        {stop.pickupTime && (
                          <span>
                            <strong className="text-foreground">Pickup:</strong> {stop.pickupTime}
                          </span>
                        )}
                        {stop.dropTime && (
                          <span>
                            <strong className="text-foreground">Drop:</strong> {stop.dropTime}
                          </span>
                        )}
                        {typeof stop.fare === 'number' && bus.pricing.mode === 'per_stop' && (
                          <span className="flex items-center gap-0.5 text-foreground font-medium">
                            <IndianRupee className="h-3 w-3" />
                            {stop.fare}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {stop.enrolledStudents || 0}
                        </span>
                      </div>
                    </li>
                  )
                )}
              </ol>
            </CardContent>
          </Card>

          <EnrollmentsPanel busId={busId} bus={bus} />
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <IndianRupee className="h-4 w-4" /> Pricing
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Mode</span>
                <span className="font-medium capitalize">
                  {bus.pricing.mode === 'per_stop' ? 'Per-stop' : 'Flat'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Billing</span>
                <span className="font-medium capitalize">{bus.pricing.frequency}</span>
              </div>
              {bus.pricing.mode === 'flat' && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Flat Price</span>
                  <span className="font-semibold">
                    {formatCurrency(bus.pricing.flatPrice || 0, bus.pricing.currency)}
                  </span>
                </div>
              )}
              {bus.pricing.mode === 'per_stop' && (
                <div className="space-y-1 pt-2 border-t">
                  {bus.stops?.map((s: { _id: string; name: string; fare?: number }) => (
                    <div key={s._id} className="flex justify-between text-xs">
                      <span className="text-muted-foreground truncate pr-2">{s.name}</span>
                      <span className="font-medium">
                        {typeof s.fare === 'number'
                          ? formatCurrency(s.fare, bus.pricing.currency)
                          : '—'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Bus Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Type</span>
                <span className="font-medium capitalize">{bus.type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Capacity</span>
                <span className="font-medium">{bus.capacity}</span>
              </div>
              {bus.vehicleRegistration && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Registration</span>
                  <span className="font-mono text-xs">{bus.vehicleRegistration}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {(bus.driverName || bus.conductorName) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Crew</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {bus.driverName && (
                  <div>
                    <p className="text-xs text-muted-foreground">Driver</p>
                    <p className="font-medium">{bus.driverName}</p>
                    {bus.driverPhone && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Phone className="h-3 w-3" /> {bus.driverPhone}
                      </p>
                    )}
                  </div>
                )}
                {bus.conductorName && (
                  <div>
                    <p className="text-xs text-muted-foreground">Conductor</p>
                    <p className="font-medium">{bus.conductorName}</p>
                    {bus.conductorPhone && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Phone className="h-3 w-3" /> {bus.conductorPhone}
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {bus.notes && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">{bus.notes}</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
