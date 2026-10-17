'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { healthApi, studentApi, hrApi } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { DatePicker } from '@/components/ui/date-picker';
import { ArrowLeft, Plus, X, Loader2, Search } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const ALLERGY_SEVERITIES = ['mild', 'moderate', 'severe'];
const CONDITION_STATUSES = ['active', 'managed', 'resolved'];

export default function NewHealthRecordPage() {
  const router = useRouter();
  const [personType, setPersonType] = useState<'student' | 'staff'>('student');
  const [personSearch, setPersonSearch] = useState('');
  const [selectedPerson, setSelectedPerson] = useState<{
    id: string;
    name: string;
    details: string;
  } | null>(null);

  const [formData, setFormData] = useState({
    bloodGroup: '',
    height: '',
    weight: '',
    allergies: [] as Array<{ allergen: string; severity: string; reaction: string }>,
    medicalConditions: [] as Array<{
      condition: string;
      diagnosedDate: string;
      status: string;
      notes: string;
    }>,
    medications: [] as Array<{
      name: string;
      dosage: string;
      frequency: string;
      prescribedFor: string;
    }>,
    emergencyContact: {
      name: '',
      relationship: '',
      phone: '',
      alternatePhone: '',
    },
    insuranceInfo: {
      provider: '',
      policyNumber: '',
      validUntil: '',
    },
  });

  // New allergy/condition/medication being added
  const [newAllergy, setNewAllergy] = useState({ allergen: '', severity: 'mild', reaction: '' });
  const [newCondition, setNewCondition] = useState({
    condition: '',
    diagnosedDate: '',
    status: 'active',
    notes: '',
  });
  const [newMedication, setNewMedication] = useState({
    name: '',
    dosage: '',
    frequency: '',
    prescribedFor: '',
  });

  // Search for students
  const { data: studentsData, isLoading: studentsLoading } = useQuery({
    queryKey: ['students-search', personSearch],
    queryFn: () => studentApi.getStudents({ search: personSearch, limit: 10 }),
    enabled: personType === 'student' && personSearch.length >= 2,
  });

  // Search for staff
  const { data: staffData, isLoading: staffLoading } = useQuery({
    queryKey: ['staff-search', personSearch],
    queryFn: () => hrApi.getStaff({ search: personSearch, limit: 10 }),
    enabled: personType === 'staff' && personSearch.length >= 2,
  });

  const createMutation = useMutation({
    mutationFn: (data: Parameters<typeof healthApi.createRecord>[0]) =>
      healthApi.createRecord(data),
    onSuccess: () => {
      toast.success('Health record created successfully');
      router.push('/health/records');
    },
    onError: (error: Error & { response?: { data?: { error?: { message?: string } } } }) => {
      toast.error(error.response?.data?.error?.message || 'Failed to create health record');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedPerson) {
      toast.error('Please select a person');
      return;
    }

    const data: Parameters<typeof healthApi.createRecord>[0] = {
      personType,
      personId: selectedPerson.id,
      bloodGroup: formData.bloodGroup || undefined,
      height: formData.height ? parseFloat(formData.height) : undefined,
      weight: formData.weight ? parseFloat(formData.weight) : undefined,
      allergies: formData.allergies.length > 0 ? formData.allergies : undefined,
      medicalConditions:
        formData.medicalConditions.length > 0
          ? formData.medicalConditions.map((c) => ({
              condition: c.condition,
              diagnosedDate: c.diagnosedDate || undefined,
              status: c.status,
            }))
          : undefined,
      medications:
        formData.medications.length > 0
          ? formData.medications.map((m) => ({
              name: m.name,
              dosage: m.dosage,
              frequency: m.frequency,
            }))
          : undefined,
      emergencyContact: formData.emergencyContact.name
        ? {
            name: formData.emergencyContact.name,
            relationship: formData.emergencyContact.relationship,
            phone: formData.emergencyContact.phone,
          }
        : undefined,
      insuranceInfo: formData.insuranceInfo.provider
        ? {
            provider: formData.insuranceInfo.provider,
            policyNumber: formData.insuranceInfo.policyNumber || undefined,
            validUntil: formData.insuranceInfo.validUntil || undefined,
          }
        : undefined,
    };

    createMutation.mutate(data);
  };

  const addAllergy = () => {
    if (newAllergy.allergen) {
      setFormData((prev) => ({
        ...prev,
        allergies: [...prev.allergies, { ...newAllergy }],
      }));
      setNewAllergy({ allergen: '', severity: 'mild', reaction: '' });
    }
  };

  const removeAllergy = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      allergies: prev.allergies.filter((_, i) => i !== index),
    }));
  };

  const addCondition = () => {
    if (newCondition.condition) {
      setFormData((prev) => ({
        ...prev,
        medicalConditions: [...prev.medicalConditions, { ...newCondition }],
      }));
      setNewCondition({ condition: '', diagnosedDate: '', status: 'active', notes: '' });
    }
  };

  const removeCondition = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      medicalConditions: prev.medicalConditions.filter((_, i) => i !== index),
    }));
  };

  const addMedication = () => {
    if (newMedication.name) {
      setFormData((prev) => ({
        ...prev,
        medications: [...prev.medications, { ...newMedication }],
      }));
      setNewMedication({ name: '', dosage: '', frequency: '', prescribedFor: '' });
    }
  };

  const removeMedication = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      medications: prev.medications.filter((_, i) => i !== index),
    }));
  };

  const persons =
    personType === 'student'
      ? (studentsData?.data || []).map(
          (s: {
            _id: string;
            firstName: string;
            lastName: string;
            className?: string;
            sectionName?: string;
          }) => ({
            id: s._id,
            name: `${s.firstName} ${s.lastName}`,
            details: `${s.className || ''} ${s.sectionName || ''}`.trim(),
          })
        )
      : (staffData?.data || []).map(
          (s: {
            _id: string;
            firstName: string;
            lastName: string;
            designationName?: string;
            departmentName?: string;
          }) => ({
            id: s._id,
            name: `${s.firstName} ${s.lastName}`,
            details: `${s.designationName || ''} - ${s.departmentName || ''}`.trim(),
          })
        );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/health/records">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Create Health Record</h1>
          <p className="text-muted-foreground">
            Create a new health profile for a student or staff member
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Person Selection */}
        <Card>
          <CardHeader>
            <CardTitle>Select Person</CardTitle>
            <CardDescription>
              Choose the student or staff member for this health record
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4">
              <div className="space-y-2">
                <Label>Person Type</Label>
                <Select
                  value={personType}
                  onValueChange={(value: 'student' | 'staff') => {
                    setPersonType(value);
                    setSelectedPerson(null);
                    setPersonSearch('');
                  }}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="student">Student</SelectItem>
                    <SelectItem value="staff">Staff</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex-1 space-y-2">
                <Label>Search {personType === 'student' ? 'Student' : 'Staff'}</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder={`Search by name...`}
                    value={personSearch}
                    onChange={(e) => setPersonSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
            </div>

            {/* Search Results */}
            {personSearch.length >= 2 && (
              <div className="border rounded-lg max-h-48 overflow-y-auto">
                {studentsLoading || staffLoading ? (
                  <div className="p-4 text-center text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                  </div>
                ) : persons.length === 0 ? (
                  <div className="p-4 text-center text-muted-foreground">
                    No {personType}s found
                  </div>
                ) : (
                  persons.map((person: { id: string; name: string; details: string }) => (
                    <button
                      key={person.id}
                      type="button"
                      className={`w-full p-3 text-left hover:bg-muted border-b last:border-0 ${
                        selectedPerson?.id === person.id ? 'bg-muted' : ''
                      }`}
                      onClick={() => {
                        setSelectedPerson(person);
                        setPersonSearch('');
                      }}
                    >
                      <p className="font-medium">{person.name}</p>
                      <p className="text-sm text-muted-foreground">{person.details}</p>
                    </button>
                  ))
                )}
              </div>
            )}

            {/* Selected Person */}
            {selectedPerson && (
              <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                <div className="flex-1">
                  <p className="font-medium">{selectedPerson.name}</p>
                  <p className="text-sm text-muted-foreground">{selectedPerson.details}</p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setSelectedPerson(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Basic Health Info */}
        <Card>
          <CardHeader>
            <CardTitle>Basic Health Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="bloodGroup">Blood Group</Label>
                <Select
                  value={formData.bloodGroup}
                  onValueChange={(value) => setFormData((prev) => ({ ...prev, bloodGroup: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select blood group" />
                  </SelectTrigger>
                  <SelectContent>
                    {BLOOD_GROUPS.map((bg) => (
                      <SelectItem key={bg} value={bg}>
                        {bg}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="height">Height (cm)</Label>
                <Input
                  id="height"
                  type="number"
                  step="0.1"
                  placeholder="e.g., 165"
                  value={formData.height}
                  onChange={(e) => setFormData((prev) => ({ ...prev, height: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="weight">Weight (kg)</Label>
                <Input
                  id="weight"
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
            <CardTitle>Allergies</CardTitle>
            <CardDescription>Record any known allergies</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Existing Allergies */}
            {formData.allergies.length > 0 && (
              <div className="space-y-2">
                {formData.allergies.map((allergy, index) => (
                  <div key={index} className="flex items-center gap-2 p-2 bg-muted rounded-lg">
                    <div className="flex-1">
                      <span className="font-medium">{allergy.allergen}</span>
                      <Badge
                        variant={allergy.severity === 'severe' ? 'destructive' : 'secondary'}
                        className="ml-2"
                      >
                        {allergy.severity}
                      </Badge>
                      {allergy.reaction && (
                        <span className="text-sm text-muted-foreground ml-2">
                          - {allergy.reaction}
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

            {/* Add New Allergy */}
            <div className="grid gap-4 md:grid-cols-4">
              <Input
                placeholder="Allergen (e.g., Peanuts)"
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
                  {ALLERGY_SEVERITIES.map((s) => (
                    <SelectItem key={s} value={s} className="capitalize">
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                placeholder="Reaction (optional)"
                value={newAllergy.reaction}
                onChange={(e) => setNewAllergy((prev) => ({ ...prev, reaction: e.target.value }))}
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
            <CardDescription>Record any medical conditions</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Existing Conditions */}
            {formData.medicalConditions.length > 0 && (
              <div className="space-y-2">
                {formData.medicalConditions.map((condition, index) => (
                  <div key={index} className="flex items-center gap-2 p-2 bg-muted rounded-lg">
                    <div className="flex-1">
                      <span className="font-medium">{condition.condition}</span>
                      <Badge variant="secondary" className="ml-2 capitalize">
                        {condition.status}
                      </Badge>
                      {condition.diagnosedDate && (
                        <span className="text-sm text-muted-foreground ml-2">
                          Diagnosed: {new Date(condition.diagnosedDate).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeCondition(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {/* Add New Condition */}
            <div className="grid gap-4 md:grid-cols-4">
              <Input
                placeholder="Condition (e.g., Asthma)"
                value={newCondition.condition}
                onChange={(e) =>
                  setNewCondition((prev) => ({ ...prev, condition: e.target.value }))
                }
              />
              <Select
                value={newCondition.status}
                onValueChange={(value) => setNewCondition((prev) => ({ ...prev, status: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONDITION_STATUSES.map((s) => (
                    <SelectItem key={s} value={s} className="capitalize">
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <DatePicker
                value={newCondition.diagnosedDate}
                onChange={(iso) => setNewCondition((prev) => ({ ...prev, diagnosedDate: iso }))}
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
            <CardDescription>Record any medications currently being taken</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Existing Medications */}
            {formData.medications.length > 0 && (
              <div className="space-y-2">
                {formData.medications.map((med, index) => (
                  <div key={index} className="flex items-center gap-2 p-2 bg-muted rounded-lg">
                    <div className="flex-1">
                      <span className="font-medium">{med.name}</span>
                      <span className="text-sm text-muted-foreground ml-2">
                        {med.dosage} - {med.frequency}
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
                placeholder="Dosage (e.g., 10mg)"
                value={newMedication.dosage}
                onChange={(e) => setNewMedication((prev) => ({ ...prev, dosage: e.target.value }))}
              />
              <Input
                placeholder="Frequency (e.g., Twice daily)"
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
            <CardTitle>Emergency Contact</CardTitle>
            <CardDescription>Primary emergency contact for health-related matters</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="emergencyName">Contact Name</Label>
                <Input
                  id="emergencyName"
                  placeholder="Full name"
                  value={formData.emergencyContact.name}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      emergencyContact: { ...prev.emergencyContact, name: e.target.value },
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="emergencyRelation">Relationship</Label>
                <Input
                  id="emergencyRelation"
                  placeholder="e.g., Father, Mother, Guardian"
                  value={formData.emergencyContact.relationship}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      emergencyContact: { ...prev.emergencyContact, relationship: e.target.value },
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="emergencyPhone">Phone Number</Label>
                <Input
                  id="emergencyPhone"
                  placeholder="+91 98765 43210"
                  value={formData.emergencyContact.phone}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      emergencyContact: { ...prev.emergencyContact, phone: e.target.value },
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="emergencyAltPhone">Alternate Phone (Optional)</Label>
                <Input
                  id="emergencyAltPhone"
                  placeholder="+91 98765 43211"
                  value={formData.emergencyContact.alternatePhone}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      emergencyContact: {
                        ...prev.emergencyContact,
                        alternatePhone: e.target.value,
                      },
                    }))
                  }
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Insurance Info */}
        <Card>
          <CardHeader>
            <CardTitle>Health Insurance (Optional)</CardTitle>
            <CardDescription>Health insurance details if available</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="insuranceProvider">Insurance Provider</Label>
                <Input
                  id="insuranceProvider"
                  placeholder="e.g., Star Health"
                  value={formData.insuranceInfo.provider}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      insuranceInfo: { ...prev.insuranceInfo, provider: e.target.value },
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="policyNumber">Policy Number</Label>
                <Input
                  id="policyNumber"
                  placeholder="Policy number"
                  value={formData.insuranceInfo.policyNumber}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      insuranceInfo: { ...prev.insuranceInfo, policyNumber: e.target.value },
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="validUntil">Valid Until</Label>
                <DatePicker
                  id="validUntil"
                  value={formData.insuranceInfo.validUntil}
                  onChange={(iso) =>
                    setFormData((prev) => ({
                      ...prev,
                      insuranceInfo: { ...prev.insuranceInfo, validUntil: iso },
                    }))
                  }
                  disablePast
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Submit */}
        <div className="flex justify-end gap-4">
          <Button type="button" variant="outline" asChild>
            <Link href="/health/records">Cancel</Link>
          </Button>
          <Button type="submit" disabled={createMutation.isPending || !selectedPerson}>
            {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create Health Record
          </Button>
        </div>
      </form>
    </div>
  );
}
