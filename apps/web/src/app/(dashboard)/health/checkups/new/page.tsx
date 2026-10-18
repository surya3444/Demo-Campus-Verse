'use client';

import { useState, useEffect } from 'react';
import { PageTitle } from '@/components/connect/kit';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { healthApi, studentApi, hrApi } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { DatePicker } from '@/components/ui/date-picker';
import { Loader2, Search, X } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

const CHECKUP_TYPES = [
  { value: 'routine', label: 'Routine' },
  { value: 'annual', label: 'Annual' },
  { value: 'sports', label: 'Sports' },
  { value: 'pre-admission', label: 'Pre-Admission' },
  { value: 'follow-up', label: 'Follow-up' },
  { value: 'other', label: 'Other' },
];

export default function NewCheckupPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const preselectedPersonId = searchParams.get('personId');
  const preselectedPersonType = searchParams.get('personType') as 'student' | 'staff' | null;
  const preselectedHealthRecordId = searchParams.get('healthRecordId');

  const [personType, setPersonType] = useState<'student' | 'staff'>(
    preselectedPersonType || 'student'
  );
  const [personSearch, setPersonSearch] = useState('');
  const [selectedPerson, setSelectedPerson] = useState<{
    id: string;
    name: string;
    details: string;
    healthRecordId?: string;
  } | null>(null);

  const [formData, setFormData] = useState({
    checkupType: 'routine',
    checkupDate: new Date().toISOString().split('T')[0],
    healthRecordId: preselectedHealthRecordId || '',
    measurements: {
      height: '',
      weight: '',
      bloodPressureSystolic: '',
      bloodPressureDiastolic: '',
      pulse: '',
      temperature: '',
      spo2: '',
    },
    examinations: {
      includeVision: true,
      includeHearing: true,
      includeDental: true,
      includeGeneral: true,
    },
  });

  // Search for students
  const { data: studentsData, isLoading: studentsLoading } = useQuery({
    queryKey: ['students-search', personSearch],
    queryFn: () => studentApi.getStudents({ search: personSearch, limit: 10 }),
    enabled: personType === 'student' && personSearch.length >= 2 && !preselectedPersonId,
  });

  // Search for staff
  const { data: staffData, isLoading: staffLoading } = useQuery({
    queryKey: ['staff-search', personSearch],
    queryFn: () => hrApi.getStaff({ search: personSearch, limit: 10 }),
    enabled: personType === 'staff' && personSearch.length >= 2 && !preselectedPersonId,
  });

  // Get preselected person's health record
  const { data: preselectedRecordData } = useQuery({
    queryKey: ['health-record-by-person', preselectedPersonType, preselectedPersonId],
    queryFn: () => healthApi.getRecordByPerson(preselectedPersonType!, preselectedPersonId!),
    enabled: !!preselectedPersonId && !!preselectedPersonType,
  });

  useEffect(() => {
    if (preselectedRecordData?.data) {
      const record = preselectedRecordData.data;
      setSelectedPerson({
        id: record.personId,
        name: record.personName,
        details: record.personType,
        healthRecordId: record._id,
      });
      setFormData((prev) => ({ ...prev, healthRecordId: record._id }));
    }
  }, [preselectedRecordData]);

  const createMutation = useMutation({
    mutationFn: (data: Parameters<typeof healthApi.createCheckup>[0]) =>
      healthApi.createCheckup(data),
    onSuccess: () => {
      toast.success('Health checkup scheduled successfully');
      router.push('/health/checkups');
    },
    onError: (error: Error & { response?: { data?: { error?: { message?: string } } } }) => {
      toast.error(error.response?.data?.error?.message || 'Failed to create checkup');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedPerson) {
      toast.error('Please select a person');
      return;
    }

    if (!formData.healthRecordId) {
      toast.error('Health record not found. Please create a health record first.');
      return;
    }

    const data: Parameters<typeof healthApi.createCheckup>[0] = {
      personType,
      personId: selectedPerson.id,
      healthRecordId: formData.healthRecordId,
      checkupType: formData.checkupType as
        | 'routine'
        | 'annual'
        | 'sports'
        | 'pre-admission'
        | 'follow-up'
        | 'other',
      checkupDate: formData.checkupDate,
      measurements: {
        height: formData.measurements.height ? parseFloat(formData.measurements.height) : undefined,
        weight: formData.measurements.weight ? parseFloat(formData.measurements.weight) : undefined,
        bloodPressure:
          formData.measurements.bloodPressureSystolic &&
          formData.measurements.bloodPressureDiastolic
            ? {
                systolic: parseInt(formData.measurements.bloodPressureSystolic),
                diastolic: parseInt(formData.measurements.bloodPressureDiastolic),
              }
            : undefined,
        pulse: formData.measurements.pulse ? parseInt(formData.measurements.pulse) : undefined,
        temperature: formData.measurements.temperature
          ? parseFloat(formData.measurements.temperature)
          : undefined,
        spo2: formData.measurements.spo2 ? parseInt(formData.measurements.spo2) : undefined,
      },
    };

    createMutation.mutate(data);
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
          (s: { _id: string; firstName: string; lastName: string; designationName?: string }) => ({
            id: s._id,
            name: `${s.firstName} ${s.lastName}`,
            details: s.designationName || '',
          })
        );

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageTitle
        crumbs={[{ label: "Check-ups", href: "/health/checkups" }, { label: "Schedule health checkup" }]}
        title="Schedule health checkup"
        description="Schedule a new health screening"
      />

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Person Selection */}
        {!preselectedPersonId && (
          <Card>
            <CardHeader>
              <CardTitle>Select Person</CardTitle>
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
                  <Label>Search</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by name..."
                      value={personSearch}
                      onChange={(e) => setPersonSearch(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
              </div>

              {personSearch.length >= 2 && (
                <div className="border rounded-lg max-h-48 overflow-y-auto">
                  {studentsLoading || staffLoading ? (
                    <div className="p-4 text-center">
                      <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                    </div>
                  ) : persons.length === 0 ? (
                    <div className="p-4 text-center text-muted-foreground">No results found</div>
                  ) : (
                    persons.map((person: { id: string; name: string; details: string }) => (
                      <button
                        key={person.id}
                        type="button"
                        className="w-full p-3 text-left hover:bg-muted border-b last:border-0"
                        onClick={async () => {
                          try {
                            const recordRes = await healthApi.getRecordByPerson(
                              personType,
                              person.id
                            );
                            setSelectedPerson({
                              ...person,
                              healthRecordId: recordRes.data?._id,
                            });
                            setFormData((prev) => ({
                              ...prev,
                              healthRecordId: recordRes.data?._id || '',
                            }));
                          } catch {
                            setSelectedPerson(person);
                            toast.error('No health record found. Please create one first.');
                          }
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
        )}

        {/* Selected Person (when preselected) */}
        {preselectedPersonId && selectedPerson && (
          <Card>
            <CardHeader>
              <CardTitle>Person</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="p-3 bg-muted rounded-lg">
                <p className="font-medium">{selectedPerson.name}</p>
                <p className="text-sm text-muted-foreground capitalize">{selectedPerson.details}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Checkup Details */}
        <Card>
          <CardHeader>
            <CardTitle>Checkup Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Checkup Type</Label>
                <Select
                  value={formData.checkupType}
                  onValueChange={(value) =>
                    setFormData((prev) => ({ ...prev, checkupType: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CHECKUP_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Checkup Date</Label>
                <DatePicker
                  value={formData.checkupDate}
                  onChange={(iso) => setFormData((prev) => ({ ...prev, checkupDate: iso }))}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Measurements */}
        <Card>
          <CardHeader>
            <CardTitle>Measurements</CardTitle>
            <CardDescription>
              Record vital signs and measurements (optional - can be filled later)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Height (cm)</Label>
                <Input
                  type="number"
                  step="0.1"
                  placeholder="e.g., 165"
                  value={formData.measurements.height}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      measurements: { ...prev.measurements, height: e.target.value },
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Weight (kg)</Label>
                <Input
                  type="number"
                  step="0.1"
                  placeholder="e.g., 55"
                  value={formData.measurements.weight}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      measurements: { ...prev.measurements, weight: e.target.value },
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Temperature (°C)</Label>
                <Input
                  type="number"
                  step="0.1"
                  placeholder="e.g., 98.6"
                  value={formData.measurements.temperature}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      measurements: { ...prev.measurements, temperature: e.target.value },
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Blood Pressure (Systolic)</Label>
                <Input
                  type="number"
                  placeholder="e.g., 120"
                  value={formData.measurements.bloodPressureSystolic}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      measurements: { ...prev.measurements, bloodPressureSystolic: e.target.value },
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Blood Pressure (Diastolic)</Label>
                <Input
                  type="number"
                  placeholder="e.g., 80"
                  value={formData.measurements.bloodPressureDiastolic}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      measurements: {
                        ...prev.measurements,
                        bloodPressureDiastolic: e.target.value,
                      },
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Pulse (bpm)</Label>
                <Input
                  type="number"
                  placeholder="e.g., 72"
                  value={formData.measurements.pulse}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      measurements: { ...prev.measurements, pulse: e.target.value },
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>SpO2 (%)</Label>
                <Input
                  type="number"
                  placeholder="e.g., 98"
                  value={formData.measurements.spo2}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      measurements: { ...prev.measurements, spo2: e.target.value },
                    }))
                  }
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Examinations */}
        <Card>
          <CardHeader>
            <CardTitle>Examinations to Include</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex items-center justify-between">
                <Label>Vision Test</Label>
                <Switch
                  checked={formData.examinations.includeVision}
                  onCheckedChange={(checked) =>
                    setFormData((prev) => ({
                      ...prev,
                      examinations: { ...prev.examinations, includeVision: checked },
                    }))
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <Label>Hearing Test</Label>
                <Switch
                  checked={formData.examinations.includeHearing}
                  onCheckedChange={(checked) =>
                    setFormData((prev) => ({
                      ...prev,
                      examinations: { ...prev.examinations, includeHearing: checked },
                    }))
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <Label>Dental Checkup</Label>
                <Switch
                  checked={formData.examinations.includeDental}
                  onCheckedChange={(checked) =>
                    setFormData((prev) => ({
                      ...prev,
                      examinations: { ...prev.examinations, includeDental: checked },
                    }))
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <Label>General Examination</Label>
                <Switch
                  checked={formData.examinations.includeGeneral}
                  onCheckedChange={(checked) =>
                    setFormData((prev) => ({
                      ...prev,
                      examinations: { ...prev.examinations, includeGeneral: checked },
                    }))
                  }
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Submit */}
        <div className="flex justify-end gap-4">
          <Button type="button" variant="outline" asChild>
            <Link href="/health/checkups">Cancel</Link>
          </Button>
          <Button type="submit" disabled={createMutation.isPending || !selectedPerson}>
            {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Schedule Checkup
          </Button>
        </div>
      </form>
    </div>
  );
}
