'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Bus, MapPin, Clock, ChevronRight, IndianRupee } from 'lucide-react';
import { transportApi } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';

interface MyTransportResponse {
  enrollment: {
    _id: string;
    busNumber?: string;
    busName?: string;
    stopName?: string;
    pickupTime?: string;
    dropTime?: string;
    priceSnapshot: number;
    pricingModeSnapshot: 'flat' | 'per_stop';
    frequencySnapshot: 'monthly' | 'quarterly' | 'yearly';
    currencySnapshot: string;
    status: 'active' | 'withdrawn' | 'transferred';
  };
  bus: {
    busNumber: string;
    name: string;
  } | null;
}

export function MyTransportCard() {
  const { data, isLoading } = useQuery({
    queryKey: ['transport-my-enrollment'],
    queryFn: async () => {
      const res = await transportApi.getMyEnrollment();
      return (res?.data ?? null) as MyTransportResponse | null;
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  if (isLoading) {
    return <Skeleton className="h-24 w-full rounded-xl" />;
  }

  // Not enrolled: render nothing (keeps the dashboard clean for non-transport students)
  if (!data || !data.enrollment) return null;

  const { enrollment } = data;
  const busLabel =
    enrollment.busNumber && enrollment.busName
      ? `${enrollment.busNumber} · ${enrollment.busName}`
      : enrollment.busNumber || enrollment.busName || 'Bus';

  return (
    <Card className="border-blue-200 bg-gradient-to-r from-blue-50/60 to-transparent dark:from-blue-950/30 dark:border-blue-900">
      <CardContent className="py-4">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
            <Bus className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <p className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
                My Transport
              </p>
              <Badge variant="outline" className="h-5 text-[10px]">
                Active
              </Badge>
            </div>
            <p className="font-semibold truncate">{busLabel}</p>
            {enrollment.stopName && (
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                <MapPin className="h-3 w-3" />
                {enrollment.stopName}
              </p>
            )}
          </div>

          <div className="flex items-center gap-4 flex-wrap">
            {enrollment.pickupTime && (
              <div className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Pickup
                  </p>
                  <p className="text-sm font-semibold tabular-nums">{enrollment.pickupTime}</p>
                </div>
              </div>
            )}
            {enrollment.dropTime && (
              <div className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Drop</p>
                  <p className="text-sm font-semibold tabular-nums">{enrollment.dropTime}</p>
                </div>
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <IndianRupee className="h-3.5 w-3.5 text-muted-foreground" />
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Monthly
                </p>
                <p className="text-sm font-semibold">
                  {formatCurrency(enrollment.priceSnapshot || 0)}
                </p>
              </div>
            </div>
          </div>

          <Button asChild size="sm" variant="outline" className="shrink-0">
            <Link href="/student/transport">
              Details
              <ChevronRight className="h-3.5 w-3.5 ml-1" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
