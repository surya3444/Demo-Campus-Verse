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
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { DatePicker } from '@/components/ui/date-picker';
import { ArrowLeft, Loader2, Syringe } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

export default function AdministerVaccinationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    administeredDate: new Date().toISOString().split('T')[0],
    administeredBy: '',
    batchNumber: '',
    manufacturer: '',
    site: '',
    notes: '',
    nextDueDate: '',
  });

  const { data, isLoading } = useQuery({
    queryKey: ['vaccination', id],
    queryFn: () => healthApi.getVaccination(id),
  });

  const administerMutation = useMutation({
    mutationFn: (data: Parameters<typeof healthApi.administerVaccination>[1]) =>
      healthApi.administerVaccination(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vaccination', id] });
      queryClient.invalidateQueries({ queryKey: ['vaccinations'] });
      toast.success('Vaccination administered successfully');
      router.push('/health/vaccinations');
    },
    onError: (error: Error & { response?: { data?: { error?: { message?: string } } } }) => {
      toast.error(error.response?.data?.error?.message || 'Failed to administer vaccination');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.administeredDate) {
      toast.error('Please enter the administered date');
      return;
    }

    administerMutation.mutate({
      administeredDate: formData.administeredDate,
      administeredBy: formData.administeredBy || undefined,
      batchNumber: formData.batchNumber || undefined,
      manufacturer: formData.manufacturer || undefined,
      site: formData.site || undefined,
      notes: formData.notes || undefined,
      nextDueDate: formData.nextDueDate || undefined,
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

  const vaccination = data?.data;

  if (!vaccination) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold">Vaccination record not found</h2>
        <Button asChild className="mt-4">
          <Link href="/health/vaccinations">Back to Vaccinations</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/health/vaccinations">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Administer Vaccination</h1>
          <p className="text-muted-foreground">Record vaccination administration details</p>
        </div>
      </div>

      {/* Vaccination Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Syringe className="h-5 w-5 text-amber-500" />
            Vaccination Details
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-sm text-muted-foreground">Person</p>
              <p className="font-medium">{vaccination.personName}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Type</p>
              <Badge variant="outline" className="capitalize">
                {vaccination.personType}
              </Badge>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Vaccine</p>
              <p className="font-medium">{vaccination.vaccineName}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Dose</p>
              <p className="font-medium">Dose {vaccination.doseNumber || 1}</p>
            </div>
            {vaccination.scheduledDate && (
              <div>
                <p className="text-sm text-muted-foreground">Scheduled Date</p>
                <p className="font-medium">
                  {new Date(vaccination.scheduledDate).toLocaleDateString()}
                </p>
              </div>
            )}
            <div>
              <p className="text-sm text-muted-foreground">Current Status</p>
              <Badge
                variant={vaccination.status === 'overdue' ? 'destructive' : 'secondary'}
                className="capitalize"
              >
                {vaccination.status}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Administration Details */}
        <Card>
          <CardHeader>
            <CardTitle>Administration Details</CardTitle>
            <CardDescription>Enter the details of the vaccination administration</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Administered Date *</Label>
                <DatePicker
                  value={formData.administeredDate}
                  onChange={(iso) => setFormData((prev) => ({ ...prev, administeredDate: iso }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Administered By</Label>
                <Input
                  placeholder="Name of doctor/nurse"
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
                  placeholder="e.g., Serum Institute"
                  value={formData.manufacturer}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, manufacturer: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Injection Site</Label>
                <Input
                  placeholder="e.g., Left deltoid"
                  value={formData.site}
                  onChange={(e) => setFormData((prev) => ({ ...prev, site: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Next Dose Due Date</Label>
                <DatePicker
                  value={formData.nextDueDate}
                  onChange={(iso) => setFormData((prev) => ({ ...prev, nextDueDate: iso }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                placeholder="Any additional notes or observations..."
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
            <Link href="/health/vaccinations">Cancel</Link>
          </Button>
          <Button type="submit" disabled={administerMutation.isPending}>
            {administerMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Mark as Administered
          </Button>
        </div>
      </form>
    </div>
  );
}
