'use client';

import { use, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { healthApi } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { ArrowLeft, Loader2, Plus, X, Heart, AlertTriangle, Phone } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const ALLERGY_SEVERITIES = ['mild', 'moderate', 'severe'];

export default function EditHealthRecordPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    bloodGroup: '',
    height: '',
    weight: '',
    allergies: [] as Array<{ allergen: string; severity: string; notes: string }>,
    conditions: [] as string[],
    medications: [] as Array<{ name: string; dosage: string; frequency: string }>,
    emergencyContactName: '',
    emergencyContactPhone: '',
    emergencyContactRelation: '',
    insuranceProvider: '',
    insurancePolicyNumber: '',
    insuranceValidUntil: '',
  });

  const [newAllergy, setNewAllergy] = useState({ allergen: '', severity: 'mild', notes: '' });
  const [newCondition, setNewCondition] = useState('');
  const [newMedication, setNewMedication] = useState({ name: '', dosage: '', frequency: '' });

  const { data, isLoading } = useQuery({
    queryKey: ['health-record', id],
    queryFn: () => healthApi.getRecord(id),
  });

  useEffect(() => {
    if (data?.data) {
      const record = data.data;
      setFormData({
        bloodGroup: record.bloodGroup || '',
        height: record.height?.toString() || '',
        weight: record.weight?.toString() || '',
        allergies: record.allergies || [],
        conditions: record.medicalConditions || [],
        medications: record.currentMedications || [],
        emergencyContactName: record.emergencyContact?.name || '',
        emergencyContactPhone: record.emergencyContact?.phone || '',
        emergencyContactRelation: record.emergencyContact?.relationship || '',
        insuranceProvider: record.insurance?.provider || '',
        insurancePolicyNumber: record.insurance?.policyNumber || '',
        insuranceValidUntil: record.insurance?.validUntil
          ? new Date(record.insurance.validUntil).toISOString().split('T')[0]
          : '',
      });
    }
  }, [data]);

  const updateMutation = useMutation({
    mutationFn: (updateData: Parameters<typeof healthApi.updateRecord>[1]) =>
      healthApi.updateRecord(id, updateData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['health-record', id] });
      queryClient.invalidateQueries({ queryKey: ['health-records'] });
      toast.success('Health record updated successfully');
      router.push(`/health/records/${id}`);
    },
    onError: (error: Error & { response?: { data?: { error?: { message?: string } } } }) => {
      toast.error(error.response?.data?.error?.message || 'Failed to update health record');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    updateMutation.mutate({
      bloodGroup: formData.bloodGroup || undefined,
      height: formData.height ? parseFloat(formData.height) : undefined,
      weight: formData.weight ? parseFloat(formData.weight) : undefined,
      allergies: formData.allergies.length > 0 ? formData.allergies : undefined,
      medicalConditions: formData.conditions.length > 0 ? formData.conditions : undefined,
      currentMedications: formData.medications.length > 0 ? formData.medications : undefined,
      emergencyContact: formData.emergencyContactName
        ? {
            name: formData.emergencyContactName,
            phone: formData.emergencyContactPhone,
            relationship: formData.emergencyContactRelation,
          }
        : undefined,
      insurance: formData.insuranceProvider
        ? {
            provider: formData.insuranceProvider,
            policyNumber: formData.insurancePolicyNumber || undefined,
            validUntil: formData.insuranceValidUntil || undefined,
          }
        : undefined,
    });
  };

  const addAllergy = () => {
    if (newAllergy.allergen) {
      setFormData((prev) => ({
        ...prev,
        allergies: [...prev.allergies, { ...newAllergy }],
      }));
      setNewAllergy({ allergen: '', severity: 'mild', notes: '' });
    }
  };

  const removeAllergy = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      allergies: prev.allergies.filter((_, i) => i !== index),
    }));
  };

  const addCondition = () => {
    if (newCondition && !formData.conditions.includes(newCondition)) {
      setFormData((prev) => ({
        ...prev,
        conditions: [...prev.conditions, newCondition],
      }));
      setNewCondition('');
    }
  };

  const removeCondition = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      conditions: prev.conditions.filter((_, i) => i !== index),
    }));
  };

  const addMedication = () => {
    if (newMedication.name) {
      setFormData((prev) => ({
        ...prev,
        medications: [...prev.medications, { ...newMedication }],
      }));
      setNewMedication({ name: '', dosage: '', frequency: '' });
    }
  };

  const removeMedication = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      medications: prev.medications.filter((_, i) => i !== index),
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

  const record = data?.data;

  if (!record) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold">Health record not found</h2>
        <Button asChild className="mt-4">
          <Link href="/health/records">Back to Records</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/health/records/${id}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Edit Health Record</h1>
          <p className="text-muted-foreground">{record.personName}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Heart className="h-5 w-5 text-rose-500" />
              Basic Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Blood Group</Label>
                <Select
                  value={formData.bloodGroup}
                  onValueChange={(value) => setFormData((prev) => ({ ...prev, bloodGroup: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select blood group" />
                  </SelectTrigger>
                  <SelectContent>
                    {BLOOD_GROUPS.map((group) => (
                      <SelectItem key={group} value={group}>
                        {group}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
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
            </div>
          </CardContent>
        </Card>

        {/* Allergies */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Allergies
            </CardTitle>
            <CardDescription>Record known allergies and their severity</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {formData.allergies.length > 0 && (
              <div className="space-y-2">
                {formData.allergies.map((allergy, index) => (
                  <div key={index} className="flex items-center gap-2 p-2 bg-muted rounded-lg">
                    <div className="flex-1">
                      <span className="font-medium">{allergy.allergen}</span>
                      <Badge
                        variant={allergy.severity === 'severe' ? 'destructive' : 'secondary'}
                        className="ml-2 capitalize"
                      >
                        {allergy.severity}
                      </Badge>
                      {allergy.notes && (
                        <span className="text-sm text-muted-foreground ml-2">
                          - {allergy.notes}
                        </span>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeAllergy(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-4">
              <Input
                placeholder="Allergen name"
                value={newAllergy.allergen}
                onChange={(e) => setNewAllergy((prev) => ({ ...prev, allergen: e.target.value }))}
              />
              <Select
                value={newAllergy.severity}
                onValueChange={(value) => setNewAllergy((prev) => ({ ...prev, severity: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ALLERGY_SEVERITIES.map((severity) => (
                    <SelectItem key={severity} value={severity} className="capitalize">
                      {severity}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                placeholder="Notes (optional)"
                value={newAllergy.notes}
                onChange={(e) => setNewAllergy((prev) => ({ ...prev, notes: e.target.value }))}
              />
              <Button type="button" variant="outline" onClick={addAllergy}>
                <Plus className="h-4 w-4 mr-2" /> Add
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Medical Conditions */}
        <Card>
          <CardHeader>
            <CardTitle>Medical Conditions</CardTitle>
            <CardDescription>List any existing medical conditions</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {formData.conditions.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {formData.conditions.map((condition, index) => (
                  <Badge key={index} variant="secondary" className="flex items-center gap-1">
                    {condition}
                    <button
                      type="button"
                      onClick={() => removeCondition(index)}
                      className="ml-1 hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}

            <div className="flex gap-4">
              <Input
                placeholder="Add a medical condition"
                value={newCondition}
                onChange={(e) => setNewCondition(e.target.value)}
                className="flex-1"
              />
              <Button type="button" variant="outline" onClick={addCondition}>
                <Plus className="h-4 w-4 mr-2" /> Add
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Current Medications */}
        <Card>
          <CardHeader>
            <CardTitle>Current Medications</CardTitle>
            <CardDescription>List any medications currently being taken</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {formData.medications.length > 0 && (
              <div className="space-y-2">
                {formData.medications.map((med, index) => (
                  <div key={index} className="flex items-center gap-2 p-2 bg-muted rounded-lg">
                    <div className="flex-1">
                      <span className="font-medium">{med.name}</span>
                      {med.dosage && (
                        <span className="text-sm text-muted-foreground ml-2">{med.dosage}</span>
                      )}
                      {med.frequency && (
                        <span className="text-sm text-muted-foreground ml-2">
                          ({med.frequency})
                        </span>
                      )}
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

            <div className="grid gap-4 md:grid-cols-4">
              <Input
                placeholder="Medication name"
                value={newMedication.name}
                onChange={(e) => setNewMedication((prev) => ({ ...prev, name: e.target.value }))}
              />
              <Input
                placeholder="Dosage"
                value={newMedication.dosage}
                onChange={(e) => setNewMedication((prev) => ({ ...prev, dosage: e.target.value }))}
              />
              <Input
                placeholder="Frequency"
                value={newMedication.frequency}
                onChange={(e) =>
                  setNewMedication((prev) => ({ ...prev, frequency: e.target.value }))
                }
              />
              <Button type="button" variant="outline" onClick={addMedication}>
                <Plus className="h-4 w-4 mr-2" /> Add
              </Button>
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
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Contact Name</Label>
                <Input
                  placeholder="Full name"
                  value={formData.emergencyContactName}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, emergencyContactName: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Phone Number</Label>
                <Input
                  placeholder="Phone number"
                  value={formData.emergencyContactPhone}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, emergencyContactPhone: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Relationship</Label>
                <Input
                  placeholder="e.g., Parent, Spouse"
                  value={formData.emergencyContactRelation}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, emergencyContactRelation: e.target.value }))
                  }
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Insurance */}
        <Card>
          <CardHeader>
            <CardTitle>Insurance Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Insurance Provider</Label>
                <Input
                  placeholder="Provider name"
                  value={formData.insuranceProvider}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, insuranceProvider: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Policy Number</Label>
                <Input
                  placeholder="Policy number"
                  value={formData.insurancePolicyNumber}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, insurancePolicyNumber: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Valid Until</Label>
                <DatePicker
                  value={formData.insuranceValidUntil}
                  onChange={(iso) => setFormData((prev) => ({ ...prev, insuranceValidUntil: iso }))}
                  disablePast
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Submit */}
        <div className="flex justify-end gap-4">
          <Button type="button" variant="outline" asChild>
            <Link href={`/health/records/${id}`}>Cancel</Link>
          </Button>
          <Button type="submit" disabled={updateMutation.isPending}>
            {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </div>
      </form>
    </div>
  );
}
