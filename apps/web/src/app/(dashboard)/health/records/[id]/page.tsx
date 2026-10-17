'use client';

import { use } from 'react';
import { useQuery } from '@tanstack/react-query';
import { healthApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ArrowLeft,
  Edit,
  Heart,
  AlertTriangle,
  Syringe,
  Stethoscope,
  Activity,
  Phone,
  Shield,
} from 'lucide-react';
import Link from 'next/link';

export default function HealthRecordDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const { data, isLoading } = useQuery({
    queryKey: ['health-record', id],
    queryFn: () => healthApi.getRecord(id),
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  const record = data?.data;

  if (!record) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold">Record not found</h2>
        <Button asChild className="mt-4">
          <Link href="/health/records">Back to Records</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/health/records">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{record.personName}</h1>
            <p className="text-muted-foreground capitalize">{record.personType} Health Record</p>
          </div>
        </div>
        <Button asChild>
          <Link href={`/health/records/${id}/edit`}>
            <Edit className="mr-2 h-4 w-4" /> Edit Record
          </Link>
        </Button>
      </div>

      {/* Alerts */}
      {(record.alerts?.hasOverdueVaccinations || record.alerts?.hasOverdueCheckup) && (
        <Card className="border-amber-500 bg-amber-50 dark:bg-amber-950/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
              <AlertTriangle className="h-5 w-5" />
              <span className="font-medium">Health Alerts</span>
            </div>
            <ul className="mt-2 space-y-1 text-sm text-amber-600 dark:text-amber-500">
              {record.alerts.hasOverdueVaccinations && <li>Has overdue vaccinations</li>}
              {record.alerts.hasOverdueCheckup && <li>Health checkup is overdue</li>}
            </ul>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {/* Basic Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Heart className="h-5 w-5 text-rose-500" />
              Basic Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Blood Group</p>
                <p className="font-medium">{record.bloodGroup || 'Not recorded'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Height</p>
                <p className="font-medium">
                  {record.height ? `${record.height} cm` : 'Not recorded'}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Weight</p>
                <p className="font-medium">
                  {record.weight ? `${record.weight} kg` : 'Not recorded'}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">BMI</p>
                <p className="font-medium">
                  {record.bmi ? record.bmi.toFixed(1) : 'Not calculated'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Emergency Contact */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Phone className="h-5 w-5 text-green-500" />
              Emergency Contact
            </CardTitle>
          </CardHeader>
          <CardContent>
            {record.emergencyContact?.name ? (
              <div className="space-y-2">
                <div>
                  <p className="text-sm text-muted-foreground">Name</p>
                  <p className="font-medium">{record.emergencyContact.name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Relationship</p>
                  <p className="font-medium">{record.emergencyContact.relationship}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Phone</p>
                  <p className="font-medium">{record.emergencyContact.phone}</p>
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground">No emergency contact recorded</p>
            )}
          </CardContent>
        </Card>

        {/* Allergies */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Allergies
            </CardTitle>
          </CardHeader>
          <CardContent>
            {record.allergies?.length > 0 ? (
              <div className="space-y-2">
                {record.allergies.map(
                  (
                    allergy: { allergen: string; severity: string; reaction?: string },
                    index: number
                  ) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-2 bg-muted rounded-lg"
                    >
                      <span className="font-medium">{allergy.allergen}</span>
                      <Badge variant={allergy.severity === 'severe' ? 'destructive' : 'secondary'}>
                        {allergy.severity}
                      </Badge>
                    </div>
                  )
                )}
              </div>
            ) : (
              <p className="text-muted-foreground">No allergies recorded</p>
            )}
          </CardContent>
        </Card>

        {/* Medical Conditions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-blue-500" />
              Medical Conditions
            </CardTitle>
          </CardHeader>
          <CardContent>
            {record.medicalConditions?.length > 0 ? (
              <div className="space-y-2">
                {record.medicalConditions.map(
                  (
                    condition: { condition: string; status: string; diagnosedDate?: string },
                    index: number
                  ) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-2 bg-muted rounded-lg"
                    >
                      <span className="font-medium">{condition.condition}</span>
                      <Badge variant="secondary" className="capitalize">
                        {condition.status}
                      </Badge>
                    </div>
                  )
                )}
              </div>
            ) : (
              <p className="text-muted-foreground">No medical conditions recorded</p>
            )}
          </CardContent>
        </Card>

        {/* Current Medications */}
        <Card>
          <CardHeader>
            <CardTitle>Current Medications</CardTitle>
          </CardHeader>
          <CardContent>
            {record.medications?.length > 0 ? (
              <div className="space-y-2">
                {record.medications.map(
                  (med: { name: string; dosage: string; frequency: string }, index: number) => (
                    <div key={index} className="p-2 bg-muted rounded-lg">
                      <p className="font-medium">{med.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {med.dosage} - {med.frequency}
                      </p>
                    </div>
                  )
                )}
              </div>
            ) : (
              <p className="text-muted-foreground">No current medications</p>
            )}
          </CardContent>
        </Card>

        {/* Insurance */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-purple-500" />
              Health Insurance
            </CardTitle>
          </CardHeader>
          <CardContent>
            {record.insuranceInfo?.provider ? (
              <div className="space-y-2">
                <div>
                  <p className="text-sm text-muted-foreground">Provider</p>
                  <p className="font-medium">{record.insuranceInfo.provider}</p>
                </div>
                {record.insuranceInfo.policyNumber && (
                  <div>
                    <p className="text-sm text-muted-foreground">Policy Number</p>
                    <p className="font-medium">{record.insuranceInfo.policyNumber}</p>
                  </div>
                )}
                {record.insuranceInfo.validUntil && (
                  <div>
                    <p className="text-sm text-muted-foreground">Valid Until</p>
                    <p className="font-medium">
                      {new Date(record.insuranceInfo.validUntil).toLocaleDateString()}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-muted-foreground">No insurance information recorded</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" asChild>
              <Link
                href={`/health/checkups/new?personId=${record.personId}&personType=${record.personType}&healthRecordId=${id}`}
              >
                <Stethoscope className="mr-2 h-4 w-4" /> Schedule Checkup
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link
                href={`/health/vaccinations/new?personId=${record.personId}&personType=${record.personType}&healthRecordId=${id}`}
              >
                <Syringe className="mr-2 h-4 w-4" /> Add Vaccination
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link
                href={`/health/visits/new?personId=${record.personId}&personType=${record.personType}&healthRecordId=${id}`}
              >
                <Activity className="mr-2 h-4 w-4" /> Log Visit
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
