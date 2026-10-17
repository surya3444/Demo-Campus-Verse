'use client';

import { use } from 'react';
import { useQuery } from '@tanstack/react-query';
import { healthApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Syringe, CheckCircle, Calendar, User } from 'lucide-react';
import Link from 'next/link';

export default function VaccinationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const { data, isLoading } = useQuery({
    queryKey: ['vaccination', id],
    queryFn: () => healthApi.getVaccination(id),
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  const vaccination = data?.data;

  if (!vaccination) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold">Vaccination record not found</h2>
        <Button asChild className="mt-4">
          <Link href="/health/vaccinations">Back to Vaccinations</Link>
        </Button>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
      completed: 'default',
      scheduled: 'secondary',
      overdue: 'destructive',
      missed: 'destructive',
      exempt: 'outline',
    };
    return (
      <Badge variant={variants[status] || 'outline'} className="capitalize">
        {status}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/health/vaccinations">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Vaccination Details</h1>
            <p className="text-muted-foreground">{vaccination.vaccineName}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {vaccination.status !== 'completed' && vaccination.status !== 'exempt' && (
            <Button asChild>
              <Link href={`/health/vaccinations/${id}/administer`}>
                <CheckCircle className="mr-2 h-4 w-4" /> Mark as Administered
              </Link>
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Vaccination Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Syringe className="h-5 w-5 text-amber-500" />
              Vaccination Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Vaccine Name</p>
                <p className="font-medium">{vaccination.vaccineName}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Dose Number</p>
                <p className="font-medium">Dose {vaccination.doseNumber || 1}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Status</p>
                {getStatusBadge(vaccination.status)}
              </div>
              {vaccination.scheduledDate && (
                <div>
                  <p className="text-sm text-muted-foreground">Scheduled Date</p>
                  <p className="font-medium">{new Date(vaccination.scheduledDate).toLocaleDateString()}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Person Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-blue-500" />
              Person Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Name</p>
                <p className="font-medium">{vaccination.personName}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Type</p>
                <Badge variant="outline" className="capitalize">{vaccination.personType}</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Administration Details (if completed) */}
        {vaccination.status === 'completed' && vaccination.administeredDate && (
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-green-500" />
                Administration Details
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <p className="text-sm text-muted-foreground">Administered Date</p>
                  <p className="font-medium">{new Date(vaccination.administeredDate).toLocaleDateString()}</p>
                </div>
                {vaccination.administeredBy && (
                  <div>
                    <p className="text-sm text-muted-foreground">Administered By</p>
                    <p className="font-medium">{vaccination.administeredBy}</p>
                  </div>
                )}
                {vaccination.batchNumber && (
                  <div>
                    <p className="text-sm text-muted-foreground">Batch Number</p>
                    <p className="font-medium">{vaccination.batchNumber}</p>
                  </div>
                )}
                {vaccination.manufacturer && (
                  <div>
                    <p className="text-sm text-muted-foreground">Manufacturer</p>
                    <p className="font-medium">{vaccination.manufacturer}</p>
                  </div>
                )}
                {vaccination.site && (
                  <div>
                    <p className="text-sm text-muted-foreground">Injection Site</p>
                    <p className="font-medium">{vaccination.site}</p>
                  </div>
                )}
                {vaccination.nextDueDate && (
                  <div>
                    <p className="text-sm text-muted-foreground">Next Dose Due</p>
                    <p className="font-medium">{new Date(vaccination.nextDueDate).toLocaleDateString()}</p>
                  </div>
                )}
              </div>
              {vaccination.notes && (
                <div className="mt-4">
                  <p className="text-sm text-muted-foreground">Notes</p>
                  <p className="font-medium">{vaccination.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Exemption Details */}
        {vaccination.status === 'exempt' && vaccination.exemptionReason && (
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Exemption Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div>
                <p className="text-sm text-muted-foreground">Reason for Exemption</p>
                <p className="font-medium">{vaccination.exemptionReason}</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
