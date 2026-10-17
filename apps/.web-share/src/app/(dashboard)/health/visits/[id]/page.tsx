'use client';

import { use } from 'react';
import { useQuery } from '@tanstack/react-query';
import { healthApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Activity, Clock, User, Pill, CheckCircle, AlertTriangle } from 'lucide-react';
import Link from 'next/link';

export default function VisitDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const { data, isLoading } = useQuery({
    queryKey: ['medical-visit', id],
    queryFn: () => healthApi.getVisit(id),
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  const visit = data?.data;

  if (!visit) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold">Visit not found</h2>
        <Button asChild className="mt-4">
          <Link href="/health/visits">Back to Visits</Link>
        </Button>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
      completed: 'default',
      in_progress: 'secondary',
      waiting: 'outline',
    };
    return (
      <Badge variant={variants[status] || 'outline'} className="capitalize">
        {status.replace('_', ' ')}
      </Badge>
    );
  };

  const getOutcomeBadge = (outcome: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
      returned_to_class: 'default',
      sent_home: 'secondary',
      referred: 'destructive',
      hospitalized: 'destructive',
      under_observation: 'outline',
    };
    return (
      <Badge variant={variants[outcome] || 'outline'} className="capitalize">
        {outcome.replace(/_/g, ' ')}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/health/visits">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Medical Visit Details</h1>
            <p className="text-muted-foreground">{visit.personName}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {visit.status !== 'completed' && (
            <Button asChild>
              <Link href={`/health/visits/${id}/close`}>
                <CheckCircle className="mr-2 h-4 w-4" /> Close Visit
              </Link>
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Visit Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-green-500" />
              Visit Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Visit Type</p>
                <Badge variant="secondary" className="capitalize">
                  {visit.visitType}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Status</p>
                {getStatusBadge(visit.status)}
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Arrival Time</p>
                <p className="font-medium">{new Date(visit.arrivalTime).toLocaleString()}</p>
              </div>
              {visit.departureTime && (
                <div>
                  <p className="text-sm text-muted-foreground">Departure Time</p>
                  <p className="font-medium">{new Date(visit.departureTime).toLocaleString()}</p>
                </div>
              )}
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Chief Complaint</p>
              <p className="font-medium">{visit.chiefComplaint}</p>
            </div>
            {visit.symptoms?.length > 0 && (
              <div>
                <p className="text-sm text-muted-foreground mb-2">Symptoms</p>
                <div className="flex flex-wrap gap-1">
                  {visit.symptoms.map((symptom: string, index: number) => (
                    <Badge key={index} variant="outline">
                      {symptom}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
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
                <p className="font-medium">{visit.personName}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Type</p>
                <Badge variant="outline" className="capitalize">
                  {visit.personType}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Vitals */}
        {visit.vitals && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-rose-500" />
                Vitals at Arrival
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                {visit.vitals.temperature && (
                  <div>
                    <p className="text-sm text-muted-foreground">Temperature</p>
                    <p className="font-medium">{visit.vitals.temperature}°C</p>
                  </div>
                )}
                {visit.vitals.bloodPressure && (
                  <div>
                    <p className="text-sm text-muted-foreground">Blood Pressure</p>
                    <p className="font-medium">
                      {visit.vitals.bloodPressure.systolic}/{visit.vitals.bloodPressure.diastolic}{' '}
                      mmHg
                    </p>
                  </div>
                )}
                {visit.vitals.pulse && (
                  <div>
                    <p className="text-sm text-muted-foreground">Pulse</p>
                    <p className="font-medium">{visit.vitals.pulse} bpm</p>
                  </div>
                )}
                {visit.vitals.spo2 && (
                  <div>
                    <p className="text-sm text-muted-foreground">SpO2</p>
                    <p className="font-medium">{visit.vitals.spo2}%</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Incident Details */}
        {visit.visitType === 'injury' && visit.incidentDetails && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                Incident Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {visit.incidentDetails.location && (
                <div>
                  <p className="text-sm text-muted-foreground">Location</p>
                  <p className="font-medium">{visit.incidentDetails.location}</p>
                </div>
              )}
              {visit.incidentDetails.time && (
                <div>
                  <p className="text-sm text-muted-foreground">Time of Incident</p>
                  <p className="font-medium">
                    {new Date(visit.incidentDetails.time).toLocaleString()}
                  </p>
                </div>
              )}
              {visit.incidentDetails.description && (
                <div>
                  <p className="text-sm text-muted-foreground">Description</p>
                  <p className="font-medium">{visit.incidentDetails.description}</p>
                </div>
              )}
              {visit.incidentDetails.witnesses?.length > 0 && (
                <div>
                  <p className="text-sm text-muted-foreground">Witnesses</p>
                  <p className="font-medium">{visit.incidentDetails.witnesses.join(', ')}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Diagnosis & Treatment (if completed) */}
        {visit.status === 'completed' && (
          <>
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>Diagnosis & Treatment</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  {visit.diagnosis && (
                    <div>
                      <p className="text-sm text-muted-foreground">Diagnosis</p>
                      <p className="font-medium">{visit.diagnosis}</p>
                    </div>
                  )}
                  {visit.treatment && (
                    <div>
                      <p className="text-sm text-muted-foreground">Treatment Given</p>
                      <p className="font-medium">{visit.treatment}</p>
                    </div>
                  )}
                </div>
                {visit.outcome && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Outcome</p>
                    {getOutcomeBadge(visit.outcome)}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Medications Given */}
            {visit.medicationsGiven?.length > 0 && (
              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Pill className="h-5 w-5 text-purple-500" />
                    Medications Given
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {visit.medicationsGiven.map(
                      (
                        med: { name: string; dosage?: string; quantity?: number },
                        index: number
                      ) => (
                        <div
                          key={index}
                          className="flex items-center gap-2 p-2 bg-muted rounded-lg"
                        >
                          <span className="font-medium">{med.name}</span>
                          {med.dosage && (
                            <span className="text-sm text-muted-foreground">{med.dosage}</span>
                          )}
                          {med.quantity && <Badge variant="outline">Qty: {med.quantity}</Badge>}
                        </div>
                      )
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Follow-up */}
            {visit.followUpRequired && (
              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle>Follow-up Required</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2">
                    {visit.followUpDate && (
                      <div>
                        <p className="text-sm text-muted-foreground">Follow-up Date</p>
                        <p className="font-medium">
                          {new Date(visit.followUpDate).toLocaleDateString()}
                        </p>
                      </div>
                    )}
                    <div>
                      <p className="text-sm text-muted-foreground">Parent/Guardian Notified</p>
                      <p className="font-medium">{visit.parentNotified ? 'Yes' : 'No'}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* Notes */}
        {visit.notes && (
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Additional Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <p>{visit.notes}</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
