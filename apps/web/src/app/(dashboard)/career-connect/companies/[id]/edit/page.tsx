'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { updateCompanySchema } from '@campus-verse/shared/schemas';
import { careerConnectApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type { z } from 'zod';

type FormData = z.infer<typeof updateCompanySchema>;

export default function EditCompanyPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const id = params.id as string;
  const [locationInput, setLocationInput] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['company', id],
    queryFn: () => careerConnectApi.getCompany(id),
  });

  const company = data?.data;

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(updateCompanySchema),
    values: company
      ? {
          name: company.name,
          industry: company.industry,
          sector: company.sector || '',
          website: company.website || '',
          size: company.size,
          locations: company.locations || [],
          description: company.description || '',
          partnership: company.partnership || { type: 'regular' },
          notes: company.notes || '',
        }
      : undefined,
  });

  const locations = watch('locations') || [];

  const updateMutation = useMutation({
    mutationFn: (formData: FormData) =>
      careerConnectApi.updateCompany(id, formData as unknown as Record<string, unknown>),
    onSuccess: () => {
      toast.success('Company updated successfully');
      queryClient.invalidateQueries({ queryKey: ['company', id] });
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      router.push(`/career-connect/companies/${id}`);
    },
    onError: () => {
      toast.error('Failed to update company');
    },
  });

  const addLocation = () => {
    if (locationInput.trim()) {
      setValue('locations', [...locations, locationInput.trim()]);
      setLocationInput('');
    }
  };

  const removeLocation = (index: number) => {
    setValue(
      'locations',
      locations.filter((_, i) => i !== index)
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Edit Company</h1>
          <p className="text-muted-foreground">Update company details</p>
        </div>
      </div>

      <form onSubmit={handleSubmit((data) => updateMutation.mutate(data))} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Company Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Company Name</Label>
                <Input id="name" {...register('name')} />
                {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="industry">Industry</Label>
                <Input id="industry" {...register('industry')} />
                {errors.industry && (
                  <p className="text-sm text-destructive">{errors.industry.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="sector">Sector</Label>
                <Input id="sector" {...register('sector')} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="size">Company Size</Label>
                <Select
                  value={watch('size') || ''}
                  onValueChange={(val) => setValue('size', val as FormData['size'])}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select size" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="startup">Startup</SelectItem>
                    <SelectItem value="small">Small</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="large">Large</SelectItem>
                    <SelectItem value="enterprise">Enterprise</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="website">Website</Label>
                <Input id="website" {...register('website')} />
              </div>
              <div className="space-y-2">
                <Label>Partnership Type</Label>
                <Select
                  value={watch('partnership.type') || 'regular'}
                  onValueChange={(val) =>
                    setValue('partnership.type', val as 'regular' | 'premium' | 'exclusive')
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="regular">Regular</SelectItem>
                    <SelectItem value="premium">Premium</SelectItem>
                    <SelectItem value="exclusive">Exclusive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Locations</Label>
              <div className="flex gap-2">
                <Input
                  value={locationInput}
                  onChange={(e) => setLocationInput(e.target.value)}
                  placeholder="Add a location"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addLocation();
                    }
                  }}
                />
                <Button type="button" variant="outline" onClick={addLocation}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {locations.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {locations.map((loc, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-1 text-sm"
                    >
                      {loc}
                      <button
                        type="button"
                        onClick={() => removeLocation(i)}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" {...register('description')} rows={3} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" {...register('notes')} rows={2} />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting || updateMutation.isPending}>
            {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </div>
  );
}
