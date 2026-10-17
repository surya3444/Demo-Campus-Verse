'use client';

import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { transportApi } from '@/lib/api';
import { getErrorMessage } from '@/lib/utils';
import { toast } from 'sonner';
import { BusWizard, BusWizardValues } from '@/components/transport/BusWizard';
import { useTransportSettings } from '@/components/transport/useGoogleMaps';

export default function EditBusPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const busId = params.id as string;
  const { data: settings } = useTransportSettings();

  const { data: busRes, isLoading } = useQuery({
    queryKey: ['transport-bus', busId],
    queryFn: () => transportApi.getBus(busId),
  });

  const updateMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => transportApi.updateBus(busId, payload),
    onSuccess: () => {
      toast.success('Bus updated successfully');
      queryClient.invalidateQueries({ queryKey: ['transport-buses'] });
      queryClient.invalidateQueries({ queryKey: ['transport-bus', busId] });
      queryClient.invalidateQueries({ queryKey: ['transport-stats'] });
      router.push(`/transport/buses/${busId}`);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const handleSubmit = (values: BusWizardValues) => {
    if (!values.startLocation) {
      toast.error('Please set a start location');
      return;
    }
    updateMutation.mutate({
      busNumber: values.busNumber,
      name: values.name,
      type: values.type,
      capacity: values.capacity,
      driverName: values.driverName || undefined,
      driverPhone: values.driverPhone || undefined,
      conductorName: values.conductorName || undefined,
      conductorPhone: values.conductorPhone || undefined,
      vehicleRegistration: values.vehicleRegistration || undefined,
      startLocation: values.startLocation,
      stops: values.stops.map((s, idx) => ({
        _id: s._id,
        name: s.name,
        address: s.address,
        placeId: s.placeId,
        location: s.location,
        sequence: idx,
        pickupTime: s.pickupTime,
        dropTime: s.dropTime,
        fare: s.fare,
      })),
      routePolyline: values.routePolyline,
      totalDistanceMeters: values.totalDistanceMeters,
      totalDurationSeconds: values.totalDurationSeconds,
      pricing: {
        mode: values.pricing.mode,
        flatPrice: values.pricing.flatPrice,
        currency: 'INR',
        frequency: 'monthly',
      },
      notes: values.notes || undefined,
    });
  };

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
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/transport/buses/${busId}`}>
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Edit Bus</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {bus.busNumber} — {bus.name}
          </p>
        </div>
      </div>

      <BusWizard
        apiKey={settings?.googleMapsApiKey}
        initialValues={{
          busNumber: bus.busNumber,
          name: bus.name,
          type: bus.type,
          capacity: bus.capacity,
          driverName: bus.driverName,
          driverPhone: bus.driverPhone,
          conductorName: bus.conductorName,
          conductorPhone: bus.conductorPhone,
          vehicleRegistration: bus.vehicleRegistration,
          startLocation: bus.startLocation,
          stops: bus.stops,
          routePolyline: bus.routePolyline,
          totalDistanceMeters: bus.totalDistanceMeters,
          totalDurationSeconds: bus.totalDurationSeconds,
          pricing: bus.pricing,
          notes: bus.notes,
        }}
        onSubmit={handleSubmit}
        submitting={updateMutation.isPending}
        submitLabel="Save Changes"
        onCancel={() => router.push(`/transport/buses/${busId}`)}
      />
    </div>
  );
}
