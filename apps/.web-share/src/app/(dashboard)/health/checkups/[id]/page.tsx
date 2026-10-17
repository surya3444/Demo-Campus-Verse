'use client';

import { use } from 'react';
import { useQuery } from '@tanstack/react-query';
import { healthApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, CheckCircle, Stethoscope, Eye, Ear, Heart } from 'lucide-react';
import Link from 'next/link';

export default function CheckupDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const { data, isLoading } = useQuery({
    queryKey: ['checkup', id],
    queryFn: () => healthApi.getCheckup(id),
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  const checkup = data?.data;

  if (!checkup) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold">Checkup not found</h2>
        <Button asChild className="mt-4">
          <Link href="/health/checkups">Back to Checkups</Link>
        </Button>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
      completed: 'default',
      in_progress: 'secondary',
      scheduled: 'outline',
      cancelled: 'destructive',
    };
    return (
      <Badge variant={variants[status] || 'outline'} className="capitalize">
        {status.replace('_', ' ')}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/health/checkups">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Health Checkup Details</h1>
            <p className="text-muted-foreground">{checkup.personName}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {checkup.status !== 'completed' && (
            <Button asChild>
              <Link href={`/health/checkups/${id}/complete`}>
                <CheckCircle className="mr-2 h-4 w-4" /> Complete Checkup
              </Link>
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Basic Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Stethoscope className="h-5 w-5 text-blue-500" />
              Checkup Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Person</p>
                <p className="font-medium">{checkup.personName}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Type</p>
                <Badge variant="outline" className="capitalize">
                  {checkup.personType}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Checkup Type</p>
                <p className="font-medium capitalize">{checkup.checkupType?.replace('-', ' ')}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Status</p>
                {getStatusBadge(checkup.status)}
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Scheduled Date</p>
                <p className="font-medium">{new Date(checkup.checkupDate).toLocaleDateString()}</p>
              </div>
              {checkup.examinerName && (
                <div>
                  <p className="text-sm text-muted-foreground">Examiner</p>
                  <p className="font-medium">{checkup.examinerName}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Measurements */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Heart className="h-5 w-5 text-rose-500" />
              Measurements
            </CardTitle>
          </CardHeader>
          <CardContent>
            {checkup.measurements ? (
              <div className="grid grid-cols-2 gap-4">
                {checkup.measurements.height && (
                  <div>
                    <p className="text-sm text-muted-foreground">Height</p>
                    <p className="font-medium">{checkup.measurements.height} cm</p>
                  </div>
                )}
                {checkup.measurements.weight && (
                  <div>
                    <p className="text-sm text-muted-foreground">Weight</p>
                    <p className="font-medium">{checkup.measurements.weight} kg</p>
                  </div>
                )}
                {checkup.measurements.bmi && (
                  <div>
                    <p className="text-sm text-muted-foreground">BMI</p>
                    <p className="font-medium">{checkup.measurements.bmi.toFixed(1)}</p>
                  </div>
                )}
                {checkup.measurements.bloodPressure && (
                  <div>
                    <p className="text-sm text-muted-foreground">Blood Pressure</p>
                    <p className="font-medium">
                      {checkup.measurements.bloodPressure.systolic}/
                      {checkup.measurements.bloodPressure.diastolic} mmHg
                    </p>
                  </div>
                )}
                {checkup.measurements.pulse && (
                  <div>
                    <p className="text-sm text-muted-foreground">Pulse</p>
                    <p className="font-medium">{checkup.measurements.pulse} bpm</p>
                  </div>
                )}
                {checkup.measurements.temperature && (
                  <div>
                    <p className="text-sm text-muted-foreground">Temperature</p>
                    <p className="font-medium">{checkup.measurements.temperature}°C</p>
                  </div>
                )}
                {checkup.measurements.spo2 && (
                  <div>
                    <p className="text-sm text-muted-foreground">SpO2</p>
                    <p className="font-medium">{checkup.measurements.spo2}%</p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-muted-foreground">No measurements recorded</p>
            )}
          </CardContent>
        </Card>

        {/* Examinations */}
        {checkup.examinations && (
          <>
            {checkup.examinations.vision && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Eye className="h-5 w-5 text-purple-500" />
                    Vision Test
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    {checkup.examinations.vision.leftEye && (
                      <div>
                        <p className="text-sm text-muted-foreground">Left Eye</p>
                        <p className="font-medium">{checkup.examinations.vision.leftEye}</p>
                      </div>
                    )}
                    {checkup.examinations.vision.rightEye && (
                      <div>
                        <p className="text-sm text-muted-foreground">Right Eye</p>
                        <p className="font-medium">{checkup.examinations.vision.rightEye}</p>
                      </div>
                    )}
                    {checkup.examinations.vision.colorBlindness !== undefined && (
                      <div>
                        <p className="text-sm text-muted-foreground">Color Blindness</p>
                        <p className="font-medium">
                          {checkup.examinations.vision.colorBlindness ? 'Yes' : 'No'}
                        </p>
                      </div>
                    )}
                    {checkup.examinations.vision.remarks && (
                      <div className="col-span-2">
                        <p className="text-sm text-muted-foreground">Remarks</p>
                        <p className="font-medium">{checkup.examinations.vision.remarks}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {checkup.examinations.hearing && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Ear className="h-5 w-5 text-amber-500" />
                    Hearing Test
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    {checkup.examinations.hearing.leftEar && (
                      <div>
                        <p className="text-sm text-muted-foreground">Left Ear</p>
                        <p className="font-medium">{checkup.examinations.hearing.leftEar}</p>
                      </div>
                    )}
                    {checkup.examinations.hearing.rightEar && (
                      <div>
                        <p className="text-sm text-muted-foreground">Right Ear</p>
                        <p className="font-medium">{checkup.examinations.hearing.rightEar}</p>
                      </div>
                    )}
                    {checkup.examinations.hearing.remarks && (
                      <div className="col-span-2">
                        <p className="text-sm text-muted-foreground">Remarks</p>
                        <p className="font-medium">{checkup.examinations.hearing.remarks}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* Findings & Recommendations */}
        {(checkup.findings || checkup.recommendations) && (
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Findings & Recommendations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {checkup.findings && (
                <div>
                  <p className="text-sm text-muted-foreground">Findings</p>
                  <p className="font-medium">{checkup.findings}</p>
                </div>
              )}
              {checkup.recommendations && (
                <div>
                  <p className="text-sm text-muted-foreground">Recommendations</p>
                  <p className="font-medium">{checkup.recommendations}</p>
                </div>
              )}
              {checkup.followUpRequired && (
                <div>
                  <Badge variant="secondary">Follow-up Required</Badge>
                  {checkup.followUpDate && (
                    <p className="text-sm text-muted-foreground mt-1">
                      Follow-up Date: {new Date(checkup.followUpDate).toLocaleDateString()}
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
