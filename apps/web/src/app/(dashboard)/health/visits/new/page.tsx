'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { healthApi, studentApi, hrApi } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Loader2, Search, X, Plus } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

const VISIT_TYPES = [
  { value: 'routine', label: 'Routine' },
  { value: 'illness', label: 'Illness' },
  { value: 'injury', label: 'Injury' },
  { value: 'emergency', label: 'Emergency' },
  { value: 'follow-up', label: 'Follow-up' },
  { value: 'other', label: 'Other' },
];

const COMMON_SYMPTOMS = [
  'Headache',
  'Fever',
  'Nausea',
  'Vomiting',
  'Dizziness',
  'Fatigue',
  'Stomach ache',
  'Body pain',
  'Cough',
  'Cold',
  'Sore throat',
  'Difficulty breathing',
];

export default function NewMedicalVisitPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const preselectedPersonId = searchParams.get('personId');
  const preselectedPersonType = searchParams.get('personType') as 'student' | 'staff' | null;
  const preselectedHealthRecordId = searchParams.get('healthRecordId');

  const [personType, setPersonType] = useState<'student' | 'staff'>(preselectedPersonType || 'student');
  const [personSearch, setPersonSearch] = useState('');
  const [selectedPerson, setSelectedPerson] = useState<{
    id: string;
    name: string;
    details: string;
    healthRecordId?: string;
  } | null>(null);

  const [formData, setFormData] = useState({
    visitType: 'illness',
    chiefComplaint: '',
    symptoms: [] as string[],
    customSymptom: '',
    healthRecordId: preselectedHealthRecordId || '',
    vitals: {
      temperature: '',
      bloodPressureSystolic: '',
      bloodPressureDiastolic: '',
      pulse: '',
      spo2: '',
    },
    isIncident: false,
    incidentDetails: {
      location: '',
      description: '',
      witnesses: '',
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
      setFormData(prev => ({ ...prev, healthRecordId: record._id }));
    }
  }, [preselectedRecordData]);

  const createMutation = useMutation({
    mutationFn: (data: Parameters<typeof healthApi.createVisit>[0]) => healthApi.createVisit(data),
    onSuccess: () => {
      toast.success('Medical visit logged successfully');
      router.push('/health/visits');
    },
    onError: (error: Error & { response?: { data?: { error?: { message?: string } } } }) => {
      toast.error(error.response?.data?.error?.message || 'Failed to log visit');
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

    if (!formData.chiefComplaint) {
      toast.error('Please enter the chief complaint');
      return;
    }

    const data: Parameters<typeof healthApi.createVisit>[0] = {
      personType,
      personId: selectedPerson.id,
      healthRecordId: formData.healthRecordId,
      visitType: formData.visitType as 'routine' | 'illness' | 'injury' | 'emergency' | 'follow-up' | 'other',
      chiefComplaint: formData.chiefComplaint,
      symptoms: formData.symptoms.length > 0 ? formData.symptoms : undefined,
      vitals: {
        temperature: formData.vitals.temperature ? parseFloat(formData.vitals.temperature) : undefined,
        bloodPressure: formData.vitals.bloodPressureSystolic && formData.vitals.bloodPressureDiastolic
          ? {
              systolic: parseInt(formData.vitals.bloodPressureSystolic),
              diastolic: parseInt(formData.vitals.bloodPressureDiastolic),
            }
          : undefined,
        pulse: formData.vitals.pulse ? parseInt(formData.vitals.pulse) : undefined,
        spo2: formData.vitals.spo2 ? parseInt(formData.vitals.spo2) : undefined,
      },
      isIncident: formData.isIncident,
      incidentDetails: formData.isIncident
        ? {
            location: formData.incidentDetails.location || undefined,
            description: formData.incidentDetails.description || undefined,
            witnesses: formData.incidentDetails.witnesses
              ? formData.incidentDetails.witnesses.split(',').map(w => w.trim())
              : undefined,
          }
        : undefined,
    };

    createMutation.mutate(data);
  };

  const toggleSymptom = (symptom: string) => {
    setFormData(prev => ({
      ...prev,
      symptoms: prev.symptoms.includes(symptom)
        ? prev.symptoms.filter(s => s !== symptom)
        : [...prev.symptoms, symptom],
    }));
  };

  const addCustomSymptom = () => {
    if (formData.customSymptom && !formData.symptoms.includes(formData.customSymptom)) {
      setFormData(prev => ({
        ...prev,
        symptoms: [...prev.symptoms, prev.customSymptom],
        customSymptom: '',
      }));
    }
  };

  const persons = personType === 'student'
    ? (studentsData?.data || []).map((s: { _id: string; firstName: string; lastName: string; className?: string; sectionName?: string }) => ({
        id: s._id,
        name: `${s.firstName} ${s.lastName}`,
        details: `${s.className || ''} ${s.sectionName || ''}`.trim(),
      }))
    : (staffData?.data || []).map((s: { _id: string; firstName: string; lastName: string; designationName?: string }) => ({
        id: s._id,
        name: `${s.firstName} ${s.lastName}`,
        details: s.designationName || '',
      }));

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
          <h1 className="text-2xl font-bold tracking-tight">Log Medical Visit</h1>
          <p className="text-muted-foreground">Record a new infirmary/medical room visit</p>
        </div>
      </div>

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
                  {(studentsLoading || staffLoading) ? (
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
                            const recordRes = await healthApi.getRecordByPerson(personType, person.id);
                            setSelectedPerson({
                              ...person,
                              healthRecordId: recordRes.data?._id,
                            });
                            setFormData(prev => ({ ...prev, healthRecordId: recordRes.data?._id || '' }));
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
                  <Button type="button" variant="ghost" size="icon" onClick={() => setSelectedPerson(null)}>
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

        {/* Visit Details */}
        <Card>
          <CardHeader>
            <CardTitle>Visit Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Visit Type</Label>
                <Select
                  value={formData.visitType}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, visitType: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {VISIT_TYPES.map(type => (
                      <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-4 pt-6">
                <Switch
                  checked={formData.isIncident}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isIncident: checked }))}
                />
                <Label>This is an incident/injury report</Label>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Chief Complaint *</Label>
              <Textarea
                placeholder="Describe the main reason for the visit..."
                value={formData.chiefComplaint}
                onChange={(e) => setFormData(prev => ({ ...prev, chiefComplaint: e.target.value }))}
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        {/* Symptoms */}
        <Card>
          <CardHeader>
            <CardTitle>Symptoms</CardTitle>
            <CardDescription>Select or add symptoms</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {COMMON_SYMPTOMS.map(symptom => (
                <Badge
                  key={symptom}
                  variant={formData.symptoms.includes(symptom) ? 'default' : 'outline'}
                  className="cursor-pointer"
                  onClick={() => toggleSymptom(symptom)}
                >
                  {symptom}
                </Badge>
              ))}
            </div>

            {/* Custom symptoms */}
            {formData.symptoms.filter(s => !COMMON_SYMPTOMS.includes(s)).length > 0 && (
              <div className="flex flex-wrap gap-2">
                {formData.symptoms.filter(s => !COMMON_SYMPTOMS.includes(s)).map(symptom => (
                  <Badge key={symptom} variant="default" className="cursor-pointer" onClick={() => toggleSymptom(symptom)}>
                    {symptom} <X className="ml-1 h-3 w-3" />
                  </Badge>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <Input
                placeholder="Add custom symptom"
                value={formData.customSymptom}
                onChange={(e) => setFormData(prev => ({ ...prev, customSymptom: e.target.value }))}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCustomSymptom())}
              />
              <Button type="button" variant="outline" onClick={addCustomSymptom}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Vitals */}
        <Card>
          <CardHeader>
            <CardTitle>Vitals (Optional)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Temperature (°C)</Label>
                <Input
                  type="number"
                  step="0.1"
                  placeholder="e.g., 98.6"
                  value={formData.vitals.temperature}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    vitals: { ...prev.vitals, temperature: e.target.value }
                  }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Blood Pressure (Systolic)</Label>
                <Input
                  type="number"
                  placeholder="e.g., 120"
                  value={formData.vitals.bloodPressureSystolic}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    vitals: { ...prev.vitals, bloodPressureSystolic: e.target.value }
                  }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Blood Pressure (Diastolic)</Label>
                <Input
                  type="number"
                  placeholder="e.g., 80"
                  value={formData.vitals.bloodPressureDiastolic}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    vitals: { ...prev.vitals, bloodPressureDiastolic: e.target.value }
                  }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Pulse (bpm)</Label>
                <Input
                  type="number"
                  placeholder="e.g., 72"
                  value={formData.vitals.pulse}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    vitals: { ...prev.vitals, pulse: e.target.value }
                  }))}
                />
              </div>
              <div className="space-y-2">
                <Label>SpO2 (%)</Label>
                <Input
                  type="number"
                  placeholder="e.g., 98"
                  value={formData.vitals.spo2}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    vitals: { ...prev.vitals, spo2: e.target.value }
                  }))}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Incident Details */}
        {formData.isIncident && (
          <Card>
            <CardHeader>
              <CardTitle>Incident Details</CardTitle>
              <CardDescription>Additional details about the incident</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Location of Incident</Label>
                  <Input
                    placeholder="e.g., Playground, Classroom 5A"
                    value={formData.incidentDetails.location}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      incidentDetails: { ...prev.incidentDetails, location: e.target.value }
                    }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Witnesses (comma-separated)</Label>
                  <Input
                    placeholder="e.g., John Doe, Jane Smith"
                    value={formData.incidentDetails.witnesses}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      incidentDetails: { ...prev.incidentDetails, witnesses: e.target.value }
                    }))}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Incident Description</Label>
                <Textarea
                  placeholder="Describe how the incident occurred..."
                  value={formData.incidentDetails.description}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    incidentDetails: { ...prev.incidentDetails, description: e.target.value }
                  }))}
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Submit */}
        <div className="flex justify-end gap-4">
          <Button type="button" variant="outline" asChild>
            <Link href="/health/visits">Cancel</Link>
          </Button>
          <Button type="submit" disabled={createMutation.isPending || !selectedPerson}>
            {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Log Visit
          </Button>
        </div>
      </form>
    </div>
  );
}
