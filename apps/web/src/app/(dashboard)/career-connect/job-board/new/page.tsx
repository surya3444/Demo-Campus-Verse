'use client';

import { useState } from 'react';
import { PageTitle } from '@/components/connect/kit';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createJobPostingSchema } from '@campus-verse/shared/schemas';
import { careerConnectApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { DatePicker } from '@/components/ui/date-picker';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import type { z } from 'zod';

type FormData = z.infer<typeof createJobPostingSchema>;

const numericField = {
  setValueAs: (v: string | undefined) =>
    v === '' || v === undefined || v === null ? undefined : Number(v),
};

interface Company {
  _id: string;
  name: string;
}

export default function NewJobPostingPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [requirementInput, setRequirementInput] = useState('');
  const [departmentInput, setDepartmentInput] = useState('');
  const [companyMode, setCompanyMode] = useState<'select' | 'manual'>('select');

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    control,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(createJobPostingSchema),
    defaultValues: {
      title: '',
      type: 'job',
      description: '',
      requirements: [],
      salary: { min: undefined, max: undefined },
      stipend: { amount: undefined, duration: '' },
      location: '',
      workMode: undefined,
      eligibility: { minCGPA: undefined, allowedDepartments: [] },
      maxApplications: undefined,
    },
  });

  const jobType = watch('type');
  const requirements = watch('requirements') || [];
  const departments = watch('eligibility.allowedDepartments') || [];

  const { data: companiesData } = useQuery({
    queryKey: ['companies', { status: 'active', limit: 100 }],
    queryFn: () => careerConnectApi.getCompanies({ status: 'active', limit: 100 }),
  });

  const companies: Company[] = companiesData?.data || [];

  const createMutation = useMutation({
    mutationFn: (data: FormData) =>
      careerConnectApi.createJobPosting(data as unknown as Record<string, unknown>),
    onSuccess: () => {
      toast.success('Job posting created successfully');
      queryClient.invalidateQueries({ queryKey: ['job-postings'] });
      router.push('/career-connect/job-board');
    },
    onError: (error: Error & { response?: { data?: { error?: { message?: string } } } }) => {
      toast.error(error.response?.data?.error?.message || 'Failed to create job posting');
    },
  });

  const addRequirement = () => {
    if (requirementInput.trim()) {
      setValue('requirements', [...requirements, requirementInput.trim()]);
      setRequirementInput('');
    }
  };

  const removeRequirement = (index: number) => {
    setValue(
      'requirements',
      requirements.filter((_, i) => i !== index)
    );
  };

  const addDepartment = () => {
    if (departmentInput.trim() && !departments.includes(departmentInput.trim())) {
      setValue('eligibility.allowedDepartments', [...departments, departmentInput.trim()]);
      setDepartmentInput('');
    }
  };

  const removeDepartment = (index: number) => {
    setValue(
      'eligibility.allowedDepartments',
      departments.filter((_, i) => i !== index)
    );
  };

  const onSubmit = (data: FormData) => {
    // Clean up conditional compensation fields
    if (data.type === 'internship') {
      delete data.salary;
    } else {
      delete data.stipend;
    }
    createMutation.mutate(data);
  };

  return (
    <div className="space-y-6">
      <PageTitle
        crumbs={[{ label: "Job board", href: "/career-connect/job-board" }, { label: "Post a job" }]}
        title="Post a job"
        description="Create a new job or internship posting"
      />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="title">Title *</Label>
                <Input id="title" {...register('title')} placeholder="e.g. Software Engineer" />
                {errors.title && <p className="text-sm text-destructive">{errors.title.message}</p>}
              </div>
              <div className="space-y-2">
                <Label>Type *</Label>
                <Select
                  defaultValue="job"
                  onValueChange={(val) => setValue('type', val as 'job' | 'internship')}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="job">Job</SelectItem>
                    <SelectItem value="internship">Internship</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Company</Label>
              <div className="flex gap-2 mb-2">
                <Button
                  type="button"
                  variant={companyMode === 'select' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setCompanyMode('select')}
                >
                  Select Existing
                </Button>
                <Button
                  type="button"
                  variant={companyMode === 'manual' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setCompanyMode('manual')}
                >
                  Enter Manually
                </Button>
              </div>
              {companyMode === 'select' ? (
                <Select
                  onValueChange={(val) => {
                    setValue('companyId', val);
                    setValue('companyName', undefined);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a company" />
                  </SelectTrigger>
                  <SelectContent>
                    {companies.map((c) => (
                      <SelectItem key={c._id} value={c._id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  {...register('companyName')}
                  placeholder="Enter company name"
                  onChange={(e) => {
                    setValue('companyName', e.target.value);
                    setValue('companyId', undefined);
                  }}
                />
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description *</Label>
              <Textarea
                id="description"
                {...register('description')}
                placeholder="Detailed job description..."
                rows={5}
              />
              {errors.description && (
                <p className="text-sm text-destructive">{errors.description.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Requirements</Label>
              <div className="flex gap-2">
                <Input
                  value={requirementInput}
                  onChange={(e) => setRequirementInput(e.target.value)}
                  placeholder="Add a requirement"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addRequirement();
                    }
                  }}
                />
                <Button type="button" variant="outline" onClick={addRequirement}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {requirements.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {requirements.map((req, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-1 text-sm"
                    >
                      {req}
                      <button
                        type="button"
                        onClick={() => removeRequirement(i)}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Compensation & Location</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {jobType === 'job' ? (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="salaryMin">Salary Min (Annual, INR)</Label>
                  <Input
                    id="salaryMin"
                    type="number"
                    {...register('salary.min', numericField)}
                    placeholder="e.g. 500000"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="salaryMax">Salary Max (Annual, INR)</Label>
                  <Input
                    id="salaryMax"
                    type="number"
                    {...register('salary.max', numericField)}
                    placeholder="e.g. 1200000"
                  />
                </div>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="stipendAmount">Stipend Amount (Monthly, INR)</Label>
                  <Input
                    id="stipendAmount"
                    type="number"
                    {...register('stipend.amount', numericField)}
                    placeholder="e.g. 20000"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="stipendDuration">Duration</Label>
                  <Input
                    id="stipendDuration"
                    {...register('stipend.duration')}
                    placeholder="e.g. 6 months"
                  />
                </div>
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  {...register('location')}
                  placeholder="e.g. Bangalore, India"
                />
              </div>
              <div className="space-y-2">
                <Label>Work Mode</Label>
                <Select
                  onValueChange={(val) =>
                    setValue('workMode', val as 'onsite' | 'remote' | 'hybrid')
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select work mode" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="onsite">Onsite</SelectItem>
                    <SelectItem value="remote">Remote</SelectItem>
                    <SelectItem value="hybrid">Hybrid</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Eligibility & Deadline</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="minCGPA">Minimum CGPA</Label>
                <Input
                  id="minCGPA"
                  type="number"
                  step="0.1"
                  min="0"
                  max="10"
                  {...register('eligibility.minCGPA', numericField)}
                  placeholder="e.g. 7.0"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="maxApplications">Max Applications</Label>
                <Input
                  id="maxApplications"
                  type="number"
                  {...register('maxApplications', numericField)}
                  placeholder="Leave empty for unlimited"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Allowed Departments</Label>
              <div className="flex gap-2">
                <Input
                  value={departmentInput}
                  onChange={(e) => setDepartmentInput(e.target.value)}
                  placeholder="Add a department"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addDepartment();
                    }
                  }}
                />
                <Button type="button" variant="outline" onClick={addDepartment}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {departments.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {departments.map((dept, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-1 text-sm"
                    >
                      {dept}
                      <button
                        type="button"
                        onClick={() => removeDepartment(i)}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="applicationDeadline">Application Deadline *</Label>
              <Controller
                name="applicationDeadline"
                control={control}
                render={({ field }) => (
                  <DatePicker
                    id="applicationDeadline"
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
              {errors.applicationDeadline && (
                <p className="text-sm text-destructive">{errors.applicationDeadline.message}</p>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Back
          </Button>
          <Button type="submit" disabled={createMutation.isPending}>
            {createMutation.isPending ? 'Creating...' : 'Create Posting'}
          </Button>
        </div>
      </form>
    </div>
  );
}
