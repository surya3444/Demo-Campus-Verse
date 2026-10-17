'use client';

import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { transportApi } from '@/lib/api';
import { getErrorMessage } from '@/lib/utils';
import { toast } from 'sonner';
import { BusWizard, BusWizardValues } from '@/components/transport/BusWizard';
import { useTransportSettings } from '@/components/transport/useGoogleMaps';

export default function NewBusPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: settings } = useTransportSettings();

  const createMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => transportApi.createBus(payload),
    onSuccess: (result) => {
      toast.success('Bus added successfully');
      queryClient.invalidateQueries({ queryKey: ['transport-buses'] });
      queryClient.invalidateQueries({ queryKey: ['transport-stats'] });
      router.push(`/transport/buses/${result.data._id}`);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const handleSubmit = (values: BusWizardValues) => {
    if (!values.startLocation) {
      toast.error('Please set a start location');
      return;
    }
    createMutation.mutate({
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

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/transport">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Add Bus</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure a new school bus, its route, and pricing
          </p>
        </div>
      </div>

      <BusWizard
        apiKey={settings?.googleMapsApiKey}
        onSubmit={handleSubmit}
        submitting={createMutation.isPending}
        submitLabel="Add Bus"
        onCancel={() => router.push('/transport')}
      />
    </div>
  );
}
