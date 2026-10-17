'use client';

import { use, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { healthApi } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { DatePicker } from '@/components/ui/date-picker';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, Loader2, Stethoscope, Eye, Ear, Heart } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

const VISION_OPTIONS = ['6/6', '6/9', '6/12', '6/18', '6/24', '6/36', '6/60'];
const HEARING_OPTIONS = ['Normal', 'Mild Loss', 'Moderate Loss', 'Severe Loss'];
const DENTAL_OPTIONS = ['Healthy', 'Cavities Present', 'Needs Cleaning', 'Needs Treatment'];

export default function CompleteCheckupPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    // Measurements
    height: '',
    weight: '',
    bloodPressureSystolic: '',
    bloodPressureDiastolic: '',
    pulse: '',
    temperature: '',
    spo2: '',
    // Vision
    visionLeftEye: '',
    visionRightEye: '',
    colorBlindness: false,
    visionRemarks: '',
    // Hearing
    hearingLeftEar: '',
    hearingRightEar: '',
    hearingRemarks: '',
    // Dental
    dentalStatus: '',
    dentalRemarks: '',
    // General
    findings: '',
    recommendations: '',
    followUpRequired: false,
    followUpDate: '',
  });

  const { data, isLoading } = useQuery({
    queryKey: ['checkup', id],
    queryFn: () => healthApi.getCheckup(id),
  });

  const completeMutation = useMutation({
    mutationFn: (data: Parameters<typeof healthApi.completeCheckup>[1]) =>
      healthApi.completeCheckup(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['checkup', id] });
      queryClient.invalidateQueries({ queryKey: ['checkups'] });
      toast.success('Checkup completed successfully');
      router.push('/health/checkups');
    },
    onError: (error: Error & { response?: { data?: { error?: { message?: string } } } }) => {
      toast.error(error.response?.data?.error?.message || 'Failed to complete checkup');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const height = parseFloat(formData.height);
    const weight = parseFloat(formData.weight);
    const bmi = height && weight ? weight / (height / 100) ** 2 : undefined;

    completeMutation.mutate({
      measurements: {
        height: height || undefined,
        weight: weight || undefined,
        bmi,
        bloodPressure:
          formData.bloodPressureSystolic && formData.bloodPressureDiastolic
            ? {
                systolic: parseInt(formData.bloodPressureSystolic),
                diastolic: parseInt(formData.bloodPressureDiastolic),
              }
            : undefined,
        pulse: formData.pulse ? parseInt(formData.pulse) : undefined,
        temperature: formData.temperature ? parseFloat(formData.temperature) : undefined,
        spo2: formData.spo2 ? parseInt(formData.spo2) : undefined,
      },
      examinations: {
        vision:
          formData.visionLeftEye || formData.visionRightEye
            ? {
                leftEye: formData.visionLeftEye || undefined,
                rightEye: formData.visionRightEye || undefined,
                colorBlindness: formData.colorBlindness,
                remarks: formData.visionRemarks || undefined,
              }
            : undefined,
        hearing:
          formData.hearingLeftEar || formData.hearingRightEar
            ? {
                leftEar: formData.hearingLeftEar || undefined,
                rightEar: formData.hearingRightEar || undefined,
                remarks: formData.hearingRemarks || undefined,
              }
            : undefined,
        dental: formData.dentalStatus
          ? {
              status: formData.dentalStatus,
              remarks: formData.dentalRemarks || undefined,
            }
          : undefined,
      },
      findings: formData.findings || undefined,
      recommendations: formData.recommendations || undefined,
      followUpRequired: formData.followUpRequired,
      followUpDate: formData.followUpDate || undefined,
    });
  };

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

  if (checkup.status === 'completed') {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold">This checkup has already been completed</h2>
        <Button asChild className="mt-4">
          <Link href={`/health/checkups/${id}`}>View Details</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/health/checkups">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Complete Health Checkup</h1>
          <p className="text-muted-foreground">
            Record examination results for {checkup.personName}
          </p>
        </div>
      </div>

      {/* Checkup Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Stethoscope className="h-5 w-5 text-blue-500" />
            Checkup Details
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
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
              <Badge variant="secondary" className="capitalize">
                {checkup.checkupType?.replace('-', ' ')}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Measurements */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Heart className="h-5 w-5 text-rose-500" />
              Measurements
            </CardTitle>
            <CardDescription>Record vital signs and body measurements</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Height (cm)</Label>
                <Input
                  type="number"
                  step="0.1"
                  placeholder="e.g., 165"
                  value={formData.height}
                  onChange={(e) => setFormData((prev) => ({ ...prev, height: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Weight (kg)</Label>
                <Input
                  type="number"
                  step="0.1"
                  placeholder="e.g., 55"
                  value={formData.weight}
                  onChange={(e) => setFormData((prev) => ({ ...prev, weight: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>BMI (calculated)</Label>
                <Input
                  type="text"
                  readOnly
                  value={
                    formData.height && formData.weight
                      ? (
                          parseFloat(formData.weight) /
                          (parseFloat(formData.height) / 100) ** 2
                        ).toFixed(1)
                      : '-'
                  }
                  className="bg-muted"
                />
              </div>
              <div className="space-y-2">
                <Label>Blood Pressure (mmHg)</Label>
                <div className="flex gap-2 items-center">
                  <Input
                    type="number"
                    placeholder="Systolic"
                    value={formData.bloodPressureSystolic}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, bloodPressureSystolic: e.target.value }))
                    }
                  />
                  <span>/</span>
                  <Input
                    type="number"
                    placeholder="Diastolic"
                    value={formData.bloodPressureDiastolic}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, bloodPressureDiastolic: e.target.value }))
                    }
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Pulse (bpm)</Label>
                <Input
                  type="number"
                  placeholder="e.g., 72"
                  value={formData.pulse}
                  onChange={(e) => setFormData((prev) => ({ ...prev, pulse: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Temperature (°C)</Label>
                <Input
                  type="number"
                  step="0.1"
                  placeholder="e.g., 36.5"
                  value={formData.temperature}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, temperature: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>SpO2 (%)</Label>
                <Input
                  type="number"
                  placeholder="e.g., 98"
                  value={formData.spo2}
                  onChange={(e) => setFormData((prev) => ({ ...prev, spo2: e.target.value }))}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Vision Test */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-purple-500" />
              Vision Test
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Left Eye</Label>
                <Select
                  value={formData.visionLeftEye}
                  onValueChange={(value) =>
                    setFormData((prev) => ({ ...prev, visionLeftEye: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select vision" />
                  </SelectTrigger>
                  <SelectContent>
                    {VISION_OPTIONS.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Right Eye</Label>
                <Select
                  value={formData.visionRightEye}
                  onValueChange={(value) =>
                    setFormData((prev) => ({ ...prev, visionRightEye: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select vision" />
                  </SelectTrigger>
                  <SelectContent>
                    {VISION_OPTIONS.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <Label>Color Blindness</Label>
                <Switch
                  checked={formData.colorBlindness}
                  onCheckedChange={(checked) =>
                    setFormData((prev) => ({ ...prev, colorBlindness: checked }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Remarks</Label>
                <Input
                  placeholder="Any vision-related notes"
                  value={formData.visionRemarks}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, visionRemarks: e.target.value }))
                  }
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Hearing Test */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Ear className="h-5 w-5 text-amber-500" />
              Hearing Test
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Left Ear</Label>
                <Select
                  value={formData.hearingLeftEar}
                  onValueChange={(value) =>
                    setFormData((prev) => ({ ...prev, hearingLeftEar: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select hearing" />
                  </SelectTrigger>
                  <SelectContent>
                    {HEARING_OPTIONS.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Right Ear</Label>
                <Select
                  value={formData.hearingRightEar}
                  onValueChange={(value) =>
                    setFormData((prev) => ({ ...prev, hearingRightEar: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select hearing" />
                  </SelectTrigger>
                  <SelectContent>
                    {HEARING_OPTIONS.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Remarks</Label>
                <Input
                  placeholder="Any hearing-related notes"
                  value={formData.hearingRemarks}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, hearingRemarks: e.target.value }))
                  }
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Dental Examination */}
        <Card>
          <CardHeader>
            <CardTitle>Dental Examination</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Dental Status</Label>
                <Select
                  value={formData.dentalStatus}
                  onValueChange={(value) =>
                    setFormData((prev) => ({ ...prev, dentalStatus: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    {DENTAL_OPTIONS.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Remarks</Label>
                <Input
                  placeholder="Any dental notes"
                  value={formData.dentalRemarks}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, dentalRemarks: e.target.value }))
                  }
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Findings & Recommendations */}
        <Card>
          <CardHeader>
            <CardTitle>Findings & Recommendations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Findings</Label>
              <Textarea
                placeholder="Overall findings from the checkup..."
                value={formData.findings}
                onChange={(e) => setFormData((prev) => ({ ...prev, findings: e.target.value }))}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Recommendations</Label>
              <Textarea
                placeholder="Recommendations for follow-up care..."
                value={formData.recommendations}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, recommendations: e.target.value }))
                }
                rows={3}
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <Label>Follow-up Required</Label>
                <Switch
                  checked={formData.followUpRequired}
                  onCheckedChange={(checked) =>
                    setFormData((prev) => ({ ...prev, followUpRequired: checked }))
                  }
                />
              </div>
              {formData.followUpRequired && (
                <div className="space-y-2">
                  <Label>Follow-up Date</Label>
                  <DatePicker
                    value={formData.followUpDate}
                    onChange={(iso) => setFormData((prev) => ({ ...prev, followUpDate: iso }))}
                  />
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Submit */}
        <div className="flex justify-end gap-4">
          <Button type="button" variant="outline" asChild>
            <Link href="/health/checkups">Cancel</Link>
          </Button>
          <Button type="submit" disabled={completeMutation.isPending}>
            {completeMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Complete Checkup
          </Button>
        </div>
      </form>
    </div>
  );
}
