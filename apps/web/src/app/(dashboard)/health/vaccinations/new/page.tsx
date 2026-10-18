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
import { DatePicker } from '@/components/ui/date-picker';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Search, X } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

const COMMON_VACCINES = [
  'BCG',
  'Hepatitis B',
  'DPT (Diphtheria, Pertussis, Tetanus)',
  'Polio (OPV/IPV)',
  'Hib (Haemophilus influenzae)',
  'Rotavirus',
  'PCV (Pneumococcal)',
  'Measles',
  'MMR (Measles, Mumps, Rubella)',
  'Typhoid',
  'Hepatitis A',
  'Varicella (Chickenpox)',
  'HPV',
  'Influenza',
  'COVID-19',
  'Tdap (Tetanus booster)',
  'Other',
];

const VACCINATION_STATUS = [
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'completed', label: 'Completed' },
  { value: 'missed', label: 'Missed' },
  { value: 'exempt', label: 'Exempt' },
];

export default function NewVaccinationPage() {
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
    vaccineName: '',
    customVaccineName: '',
    doseNumber: '1',
    scheduledDate: '',
    status: 'scheduled',
    healthRecordId: preselectedHealthRecordId || '',
    // For completed vaccinations
    administeredDate: '',
    administeredBy: '',
    batchNumber: '',
    manufacturer: '',
    site: '',
    notes: '',
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
    mutationFn: (data: Parameters<typeof healthApi.createVaccination>[0]) =>
      healthApi.createVaccination(data),
    onSuccess: () => {
      toast.success('Vaccination record created successfully');
      router.push('/health/vaccinations');
    },
    onError: (error: Error & { response?: { data?: { error?: { message?: string } } } }) => {
      toast.error(error.response?.data?.error?.message || 'Failed to create vaccination record');
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

    const vaccineName =
      formData.vaccineName === 'Other' ? formData.customVaccineName : formData.vaccineName;
    if (!vaccineName) {
      toast.error('Please select or enter a vaccine name');
      return;
    }

    const data: Parameters<typeof healthApi.createVaccination>[0] = {
      personType,
      personId: selectedPerson.id,
      healthRecordId: formData.healthRecordId,
      vaccineName,
      doseNumber: parseInt(formData.doseNumber) || undefined,
      scheduledDate: formData.scheduledDate || undefined,
      status: formData.status as 'scheduled' | 'completed' | 'missed' | 'overdue' | 'exempt',
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
        crumbs={[{ label: "Vaccinations", href: "/health/vaccinations" }, { label: "Record vaccination" }]}
        title="Record vaccination"
        description="Add a new vaccination record"
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

        {/* Vaccination Details */}
        <Card>
          <CardHeader>
            <CardTitle>Vaccination Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Vaccine Name</Label>
                <Select
                  value={formData.vaccineName}
                  onValueChange={(value) =>
                    setFormData((prev) => ({ ...prev, vaccineName: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select vaccine" />
                  </SelectTrigger>
                  <SelectContent>
                    {COMMON_VACCINES.map((vaccine) => (
                      <SelectItem key={vaccine} value={vaccine}>
                        {vaccine}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {formData.vaccineName === 'Other' && (
                <div className="space-y-2">
                  <Label>Custom Vaccine Name</Label>
                  <Input
                    placeholder="Enter vaccine name"
                    value={formData.customVaccineName}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, customVaccineName: e.target.value }))
                    }
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label>Dose Number</Label>
                <Select
                  value={formData.doseNumber}
                  onValueChange={(value) => setFormData((prev) => ({ ...prev, doseNumber: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5].map((num) => (
                      <SelectItem key={num} value={String(num)}>
                        Dose {num}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => setFormData((prev) => ({ ...prev, status: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {VACCINATION_STATUS.map((status) => (
                      <SelectItem key={status.value} value={status.value}>
                        {status.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Scheduled/Due Date</Label>
                <DatePicker
                  value={formData.scheduledDate}
                  onChange={(iso) => setFormData((prev) => ({ ...prev, scheduledDate: iso }))}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Administration Details (if completed) */}
        {formData.status === 'completed' && (
          <Card>
            <CardHeader>
              <CardTitle>Administration Details</CardTitle>
              <CardDescription>
                Details of when and how the vaccine was administered
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Administered Date</Label>
                  <DatePicker
                    value={formData.administeredDate}
                    onChange={(iso) => setFormData((prev) => ({ ...prev, administeredDate: iso }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Administered By</Label>
                  <Input
                    placeholder="Name of administrator"
                    value={formData.administeredBy}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, administeredBy: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Batch Number</Label>
                  <Input
                    placeholder="Vaccine batch number"
                    value={formData.batchNumber}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, batchNumber: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Manufacturer</Label>
                  <Input
                    placeholder="Vaccine manufacturer"
                    value={formData.manufacturer}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, manufacturer: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Injection Site</Label>
                  <Input
                    placeholder="e.g., Left arm"
                    value={formData.site}
                    onChange={(e) => setFormData((prev) => ({ ...prev, site: e.target.value }))}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Submit */}
        <div className="flex justify-end gap-4">
          <Button type="button" variant="outline" asChild>
            <Link href="/health/vaccinations">Cancel</Link>
          </Button>
          <Button type="submit" disabled={createMutation.isPending || !selectedPerson}>
            {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Vaccination Record
          </Button>
        </div>
      </form>
    </div>
  );
}
