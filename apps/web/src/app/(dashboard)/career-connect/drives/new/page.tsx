'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createDriveSchema } from '@campus-verse/shared/schemas';
import { careerConnectApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { DatePicker } from '@/components/ui/date-picker';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import type { z } from 'zod';

type FormData = z.infer<typeof createDriveSchema>;

export default function NewDrivePage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: companiesData, isLoading: companiesLoading } = useQuery({
    queryKey: ['companies', { status: 'active', limit: 100 }],
    queryFn: () => careerConnectApi.getCompanies({ status: 'active', limit: 100 }),
  });

  const companies: { _id: string; name: string }[] = companiesData?.data || [];

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    control,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(createDriveSchema),
    defaultValues: {
      title: '',
      companyId: '',
      type: 'on_campus',
      eligibility: {},
      registrationDeadline: undefined,
      jobProfile: {
        role: '',
        description: '',
        ctc: undefined,
        location: '',
        jobType: 'job',
      },
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: FormData) =>
      careerConnectApi.createDrive(data as unknown as Record<string, unknown>),
    onSuccess: (result) => {
      toast.success('Placement drive created successfully');
      queryClient.invalidateQueries({ queryKey: ['drives'] });
      const driveId = result?.data?._id;
      if (driveId) {
        router.push(`/career-connect/drives/${driveId}`);
      } else {
        router.push('/career-connect/drives');
      }
    },
    onError: (error: Error & { response?: { data?: { error?: { message?: string } } } }) => {
      toast.error(error.response?.data?.error?.message || 'Failed to create drive');
    },
  });

  const onSubmit = (data: FormData) => {
    createMutation.mutate(data);
  };

  const selectedType = watch('type');

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Create Placement Drive</h1>
          <p className="text-muted-foreground">Set up a new campus placement drive</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Drive Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="companyId">Company *</Label>
                {companiesLoading ? (
                  <Skeleton className="h-10 w-full" />
                ) : (
                  <Select onValueChange={(val) => setValue('companyId', val)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select company" />
                    </SelectTrigger>
                    <SelectContent>
                      {companies.map((company) => (
                        <SelectItem key={company._id} value={company._id}>
                          {company.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {errors.companyId && (
                  <p className="text-sm text-destructive">{errors.companyId.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  {...register('title')}
                  placeholder="e.g. Infosys Campus Drive 2026"
                />
                {errors.title && <p className="text-sm text-destructive">{errors.title.message}</p>}
              </div>
              <div className="space-y-2">
                <Label>Type *</Label>
                <Select
                  defaultValue="on_campus"
                  value={selectedType}
                  onValueChange={(val) =>
                    setValue('type', val as 'on_campus' | 'off_campus' | 'pool_campus')
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="on_campus">On Campus</SelectItem>
                    <SelectItem value="off_campus">Off Campus</SelectItem>
                    <SelectItem value="pool_campus">Pool Campus</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="registrationDeadline">Registration Deadline *</Label>
                <Controller
                  name="registrationDeadline"
                  control={control}
                  render={({ field }) => (
                    <DatePicker
                      id="registrationDeadline"
                      value={
                        field.value instanceof Date
                          ? field.value.toISOString().slice(0, 10)
                          : (field.value ?? '')
                      }
                      onChange={(iso) => field.onChange(iso ? new Date(iso) : undefined)}
                      disablePast
                    />
                  )}
                />
                {errors.registrationDeadline && (
                  <p className="text-sm text-destructive">{errors.registrationDeadline.message}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Job Profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="jobProfile.role">Role *</Label>
                <Input
                  id="jobProfile.role"
                  {...register('jobProfile.role')}
                  placeholder="e.g. Software Engineer"
                />
                {errors.jobProfile?.role && (
                  <p className="text-sm text-destructive">{errors.jobProfile.role.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="jobProfile.ctc">CTC (Annual, in INR)</Label>
                <Input
                  id="jobProfile.ctc"
                  type="number"
                  {...register('jobProfile.ctc', { valueAsNumber: true })}
                  placeholder="e.g. 600000"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="jobProfile.location">Location</Label>
                <Input
                  id="jobProfile.location"
                  {...register('jobProfile.location')}
                  placeholder="e.g. Bangalore, Pune"
                />
              </div>
              <div className="space-y-2">
                <Label>Job Type</Label>
                <Select
                  defaultValue="job"
                  onValueChange={(val) =>
                    setValue('jobProfile.jobType', val as 'job' | 'internship')
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="job">Full-time Job</SelectItem>
                    <SelectItem value="internship">Internship</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="jobProfile.description">Job Description</Label>
              <Textarea
                id="jobProfile.description"
                {...register('jobProfile.description')}
                placeholder="Describe the role, responsibilities, and expectations"
                rows={4}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Eligibility Criteria</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="eligibility.minCGPA">Minimum CGPA (0-10)</Label>
                <Input
                  id="eligibility.minCGPA"
                  type="number"
                  step="0.1"
                  min="0"
                  max="10"
                  {...register('eligibility.minCGPA', { valueAsNumber: true })}
                  placeholder="e.g. 6.5"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="eligibility.maxBacklogs">Maximum Backlogs Allowed</Label>
                <Input
                  id="eligibility.maxBacklogs"
                  type="number"
                  min="0"
                  {...register('eligibility.maxBacklogs', { valueAsNumber: true })}
                  placeholder="e.g. 0"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" disabled={createMutation.isPending}>
            {createMutation.isPending ? 'Creating...' : 'Create Drive'}
          </Button>
        </div>
      </form>
    </div>
  );
}
