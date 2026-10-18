'use client';

import { useState } from 'react';
import { PageTitle } from '@/components/connect/kit';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createCompanySchema } from '@campus-verse/shared/schemas';
import { careerConnectApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type { z } from 'zod';

type FormData = z.infer<typeof createCompanySchema>;

const INDUSTRIES = [
  'IT Services',
  'Software Product',
  'Consulting',
  'BFSI',
  'Manufacturing',
  'Healthcare',
  'Pharmaceuticals',
  'Automobile',
  'Telecom',
  'E-Commerce',
  'EdTech',
  'FinTech',
  'FMCG',
  'Energy & Utilities',
  'Media & Entertainment',
  'Logistics & Supply Chain',
  'Real Estate & Construction',
  'Retail',
  'Aerospace & Defence',
  'Agriculture & AgriTech',
  'Other',
];

const SECTORS = [
  'Technology',
  'Finance',
  'Healthcare',
  'Education',
  'Government',
  'Private',
  'Public',
  'Non-Profit',
  'Research & Development',
  'Other',
];

export default function NewCompanyPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [locationInput, setLocationInput] = useState('');

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(createCompanySchema),
    defaultValues: {
      name: '',
      industry: '',
      sector: '',
      website: '',
      locations: [],
      description: '',
      partnership: { type: 'regular' },
      notes: '',
    },
  });

  const locations = watch('locations') || [];

  const createMutation = useMutation({
    mutationFn: (data: FormData) =>
      careerConnectApi.createCompany(data as unknown as Record<string, unknown>),
    onSuccess: () => {
      toast.success('Company created successfully');
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      router.push('/career-connect/companies');
    },
    onError: () => {
      toast.error('Failed to create company');
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

  const onSubmit = (data: FormData) => {
    createMutation.mutate(data);
  };

  return (
    <div className="space-y-6">
      <PageTitle
        crumbs={[{ label: "Companies", href: "/career-connect/companies" }, { label: "Add company" }]}
        title="Add company"
        description="Register a new placement partner company"
      />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Company Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Company Name *</Label>
                <Input id="name" {...register('name')} placeholder="e.g. Infosys" />
                {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
              </div>
              <div className="space-y-2">
                <Label>Industry *</Label>
                <Select onValueChange={(val) => setValue('industry', val)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select industry" />
                  </SelectTrigger>
                  <SelectContent>
                    {INDUSTRIES.map((ind) => (
                      <SelectItem key={ind} value={ind}>
                        {ind}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.industry && (
                  <p className="text-sm text-destructive">{errors.industry.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Sector</Label>
                <Select onValueChange={(val) => setValue('sector', val)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select sector" />
                  </SelectTrigger>
                  <SelectContent>
                    {SECTORS.map((sec) => (
                      <SelectItem key={sec} value={sec}>
                        {sec}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="size">Company Size</Label>
                <Select onValueChange={(val) => setValue('size', val as FormData['size'])}>
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
                <Input id="website" {...register('website')} placeholder="https://example.com" />
                {errors.website && (
                  <p className="text-sm text-destructive">{errors.website.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Partnership Type</Label>
                <Select
                  defaultValue="regular"
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
              <Textarea
                id="description"
                {...register('description')}
                placeholder="Brief description of the company"
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                {...register('notes')}
                placeholder="Internal notes about this company"
                rows={2}
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting || createMutation.isPending}>
            {createMutation.isPending ? 'Creating...' : 'Create Company'}
          </Button>
        </div>
      </form>
    </div>
  );
}
