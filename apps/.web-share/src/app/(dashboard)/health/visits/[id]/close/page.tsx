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
import { ArrowLeft, Loader2, Activity, Plus, X } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

const OUTCOMES = [
  { value: 'returned_to_class', label: 'Returned to Class' },
  { value: 'sent_home', label: 'Sent Home' },
  { value: 'referred', label: 'Referred to Hospital/Clinic' },
  { value: 'hospitalized', label: 'Hospitalized' },
  { value: 'under_observation', label: 'Under Observation' },
];

export default function CloseVisitPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    diagnosis: '',
    treatment: '',
    medicationsGiven: [] as Array<{ name: string; dosage: string; quantity: string }>,
    outcome: '',
    followUpRequired: false,
    followUpDate: '',
    parentNotified: false,
    notes: '',
  });

  const [newMedication, setNewMedication] = useState({ name: '', dosage: '', quantity: '' });

  const { data, isLoading } = useQuery({
    queryKey: ['medical-visit', id],
    queryFn: () => healthApi.getVisit(id),
  });

  const closeMutation = useMutation({
    mutationFn: (data: Parameters<typeof healthApi.closeVisit>[1]) =>
      healthApi.closeVisit(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['medical-visit', id] });
      queryClient.invalidateQueries({ queryKey: ['medical-visits'] });
      toast.success('Visit closed successfully');
      router.push('/health/visits');
    },
    onError: (error: Error & { response?: { data?: { error?: { message?: string } } } }) => {
      toast.error(error.response?.data?.error?.message || 'Failed to close visit');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.outcome) {
      toast.error('Please select an outcome');
      return;
    }

    closeMutation.mutate({
      diagnosis: formData.diagnosis || undefined,
      treatment: formData.treatment || undefined,
      medicationsGiven:
        formData.medicationsGiven.length > 0
          ? formData.medicationsGiven.map((m) => ({
              name: m.name,
              dosage: m.dosage,
              quantity: m.quantity ? parseInt(m.quantity) : undefined,
            }))
          : undefined,
      outcome: formData.outcome as
        | 'returned_to_class'
        | 'sent_home'
        | 'referred'
        | 'hospitalized'
        | 'under_observation',
      followUpRequired: formData.followUpRequired,
      followUpDate: formData.followUpDate || undefined,
      parentNotified: formData.parentNotified,
      notes: formData.notes || undefined,
    });
  };

  const addMedication = () => {
    if (newMedication.name) {
      setFormData((prev) => ({
        ...prev,
        medicationsGiven: [...prev.medicationsGiven, { ...newMedication }],
      }));
      setNewMedication({ name: '', dosage: '', quantity: '' });
    }
  };

  const removeMedication = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      medicationsGiven: prev.medicationsGiven.filter((_, i) => i !== index),
    }));
  };

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

  if (visit.status === 'completed') {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold">This visit has already been closed</h2>
        <Button asChild className="mt-4">
          <Link href={`/health/visits/${id}`}>View Details</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/health/visits">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Close Medical Visit</h1>
          <p className="text-muted-foreground">Record the outcome and close this visit</p>
        </div>
      </div>

      {/* Visit Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-green-500" />
            Visit Details
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-sm text-muted-foreground">Person</p>
              <p className="font-medium">{visit.personName}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Type</p>
              <Badge variant="outline" className="capitalize">
                {visit.personType}
              </Badge>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Visit Type</p>
              <Badge variant="secondary" className="capitalize">
                {visit.visitType}
              </Badge>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Arrival Time</p>
              <p className="font-medium">{new Date(visit.arrivalTime).toLocaleString()}</p>
            </div>
            <div className="md:col-span-2">
              <p className="text-sm text-muted-foreground">Chief Complaint</p>
              <p className="font-medium">{visit.chiefComplaint}</p>
            </div>
            {visit.symptoms?.length > 0 && (
              <div className="md:col-span-2">
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
          </div>
        </CardContent>
      </Card>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Diagnosis & Treatment */}
        <Card>
          <CardHeader>
            <CardTitle>Diagnosis & Treatment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Diagnosis</Label>
              <Textarea
                placeholder="Enter diagnosis..."
                value={formData.diagnosis}
                onChange={(e) => setFormData((prev) => ({ ...prev, diagnosis: e.target.value }))}
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label>Treatment Given</Label>
              <Textarea
                placeholder="Describe treatment provided..."
                value={formData.treatment}
                onChange={(e) => setFormData((prev) => ({ ...prev, treatment: e.target.value }))}
                rows={2}
              />
            </div>
          </CardContent>
        </Card>

        {/* Medications */}
        <Card>
          <CardHeader>
            <CardTitle>Medications Given</CardTitle>
            <CardDescription>Record any medications administered</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Existing Medications */}
            {formData.medicationsGiven.length > 0 && (
              <div className="space-y-2">
                {formData.medicationsGiven.map((med, index) => (
                  <div key={index} className="flex items-center gap-2 p-2 bg-muted rounded-lg">
                    <div className="flex-1">
                      <span className="font-medium">{med.name}</span>
                      <span className="text-sm text-muted-foreground ml-2">
                        {med.dosage} {med.quantity && `(Qty: ${med.quantity})`}
                      </span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeMedication(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {/* Add New Medication */}
            <div className="grid gap-4 md:grid-cols-4">
              <Input
                placeholder="Medication name"
                value={newMedication.name}
                onChange={(e) => setNewMedication((prev) => ({ ...prev, name: e.target.value }))}
              />
              <Input
                placeholder="Dosage (e.g., 500mg)"
                value={newMedication.dosage}
                onChange={(e) => setNewMedication((prev) => ({ ...prev, dosage: e.target.value }))}
              />
              <Input
                placeholder="Quantity"
                type="number"
                value={newMedication.quantity}
                onChange={(e) =>
                  setNewMedication((prev) => ({ ...prev, quantity: e.target.value }))
                }
              />
              <Button type="button" variant="outline" onClick={addMedication}>
                <Plus className="h-4 w-4 mr-2" /> Add
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Outcome */}
        <Card>
          <CardHeader>
            <CardTitle>Outcome *</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Visit Outcome</Label>
              <Select
                value={formData.outcome}
                onValueChange={(value) => setFormData((prev) => ({ ...prev, outcome: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select outcome" />
                </SelectTrigger>
                <SelectContent>
                  {OUTCOMES.map((outcome) => (
                    <SelectItem key={outcome.value} value={outcome.value}>
                      {outcome.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <Label>Parent/Guardian Notified</Label>
                <Switch
                  checked={formData.parentNotified}
                  onCheckedChange={(checked) =>
                    setFormData((prev) => ({ ...prev, parentNotified: checked }))
                  }
                />
              </div>
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

            <div className="space-y-2">
              <Label>Additional Notes</Label>
              <Textarea
                placeholder="Any additional notes..."
                value={formData.notes}
                onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        {/* Submit */}
        <div className="flex justify-end gap-4">
          <Button type="button" variant="outline" asChild>
            <Link href="/health/visits">Cancel</Link>
          </Button>
          <Button type="submit" disabled={closeMutation.isPending}>
            {closeMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Close Visit
          </Button>
        </div>
      </form>
    </div>
  );
}
