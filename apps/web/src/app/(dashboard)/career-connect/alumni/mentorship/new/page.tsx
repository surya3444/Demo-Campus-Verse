'use client';

import { useState } from 'react';
import { PageTitle } from '@/components/connect/kit';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createMentorshipSchema } from '@campus-verse/shared/schemas';
import { careerConnectApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import type { z } from 'zod';

type FormData = z.infer<typeof createMentorshipSchema>;

export default function NewMentorshipProgramPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [goalInput, setGoalInput] = useState('');

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(createMentorshipSchema),
    defaultValues: {
      mentorAlumniId: '',
      areaOfGuidance: '',
      programType: 'one_on_one',
      goals: [],
    },
  });

  const goals = watch('goals') || [];

  const addGoal = () => {
    if (goalInput.trim()) {
      setValue('goals', [...goals, goalInput.trim()]);
      setGoalInput('');
    }
  };

  const removeGoal = (index: number) => {
    setValue(
      'goals',
      goals.filter((_, i) => i !== index)
    );
  };

  const createMutation = useMutation({
    mutationFn: (data: FormData) => {
      return careerConnectApi.createMentorshipProgram(data as unknown as Record<string, unknown>);
    },
    onSuccess: () => {
      toast.success('Mentorship program created successfully');
      queryClient.invalidateQueries({ queryKey: ['mentorship-programs'] });
      router.push('/career-connect/alumni/mentorship');
    },
    onError: (error: Error & { response?: { data?: { error?: { message?: string } } } }) => {
      toast.error(error.response?.data?.error?.message || 'Failed to create mentorship program');
    },
  });

  const onSubmit = (data: FormData) => {
    createMutation.mutate(data);
  };

  return (
    <div className="space-y-6">
      <PageTitle
        crumbs={[{ label: "Mentorship", href: "/career-connect/alumni/mentorship" }, { label: "New mentorship program" }]}
        title="New mentorship program"
        description="Request a new mentorship program with an alumni mentor"
      />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Program Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="mentorAlumniId">Mentor Alumni ID *</Label>
                <Input
                  id="mentorAlumniId"
                  {...register('mentorAlumniId')}
                  placeholder="Enter the alumni profile ID"
                />
                {errors.mentorAlumniId && (
                  <p className="text-sm text-destructive">{errors.mentorAlumniId.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Program Type *</Label>
                <Select
                  defaultValue="one_on_one"
                  onValueChange={(val) => setValue('programType', val as FormData['programType'])}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="one_on_one">One on One</SelectItem>
                    <SelectItem value="group">Group</SelectItem>
                    <SelectItem value="project_based">Project Based</SelectItem>
                  </SelectContent>
                </Select>
                {errors.programType && (
                  <p className="text-sm text-destructive">{errors.programType.message}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="areaOfGuidance">Area of Guidance *</Label>
              <Input
                id="areaOfGuidance"
                {...register('areaOfGuidance')}
                placeholder="e.g. Full-stack web development, Machine Learning, Career planning"
              />
              {errors.areaOfGuidance && (
                <p className="text-sm text-destructive">{errors.areaOfGuidance.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Goals</Label>
              <div className="flex gap-2">
                <Input
                  value={goalInput}
                  onChange={(e) => setGoalInput(e.target.value)}
                  placeholder="Add a goal for this program"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addGoal();
                    }
                  }}
                />
                <Button type="button" variant="outline" onClick={addGoal}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {goals.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {goals.map((goal, i) => (
                    <Badge key={i} variant="secondary" className="px-3 py-1.5 text-sm gap-2">
                      <span>{goal}</span>
                      <button
                        type="button"
                        onClick={() => removeGoal(i)}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting || createMutation.isPending}>
            {createMutation.isPending ? 'Creating...' : 'Create Program'}
          </Button>
        </div>
      </form>
    </div>
  );
}
