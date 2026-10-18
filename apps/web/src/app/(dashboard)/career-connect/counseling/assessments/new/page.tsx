'use client';

import { useState } from 'react';
import { PageTitle } from '@/components/connect/kit';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createAssessmentSchema } from '@campus-verse/shared/schemas';
import { careerConnectApi } from '@/lib/api';
import { StudentPicker } from '@/components/common/StudentPicker';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { DatePicker } from '@/components/ui/date-picker';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type { z } from 'zod';

type FormData = z.infer<typeof createAssessmentSchema>;

interface ScoreEntry {
  key: string;
  value: number;
}

interface CareerPathEntry {
  field: string;
  matchPercentage: number;
  description: string;
}

export default function NewAssessmentPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [scores, setScores] = useState<ScoreEntry[]>([{ key: '', value: 0 }]);
  const [careerPaths, setCareerPaths] = useState<CareerPathEntry[]>([
    { field: '', matchPercentage: 0, description: '' },
  ]);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    control,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(createAssessmentSchema),
    defaultValues: {
      assessmentType: 'aptitude',
      results: {
        scores: {},
        strengths: [],
        areasOfImprovement: [],
      },
      recommendedCareerPaths: [],
      notes: '',
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: FormData) => {
      const payload: Record<string, unknown> = { ...data };

      // Build scores from dynamic entries
      const scoresObj: Record<string, number> = {};
      scores.forEach((s) => {
        if (s.key.trim()) scoresObj[s.key.trim()] = s.value;
      });
      (payload as { results: Record<string, unknown> }).results = {
        scores: scoresObj,
        strengths:
          typeof data.results?.strengths === 'string'
            ? (data.results.strengths as unknown as string)
                .split('\n')
                .map((s: string) => s.trim())
                .filter(Boolean)
            : data.results?.strengths || [],
        areasOfImprovement:
          typeof data.results?.areasOfImprovement === 'string'
            ? (data.results.areasOfImprovement as unknown as string)
                .split('\n')
                .map((s: string) => s.trim())
                .filter(Boolean)
            : data.results?.areasOfImprovement || [],
      };

      // Build career paths from dynamic entries
      payload.recommendedCareerPaths = careerPaths
        .filter((cp) => cp.field.trim())
        .map((cp) => ({
          field: cp.field.trim(),
          matchPercentage: cp.matchPercentage,
          description: cp.description.trim() || undefined,
        }));

      return careerConnectApi.createAssessment(payload);
    },
    onSuccess: () => {
      toast.success('Assessment created successfully');
      queryClient.invalidateQueries({ queryKey: ['assessments'] });
      router.push('/career-connect/counseling/assessments');
    },
    onError: () => {
      toast.error('Failed to create assessment');
    },
  });

  const onSubmit = (data: FormData) => {
    createMutation.mutate(data);
  };

  const addScore = () => {
    setScores([...scores, { key: '', value: 0 }]);
  };

  const removeScore = (index: number) => {
    setScores(scores.filter((_, i) => i !== index));
  };

  const updateScore = (index: number, field: 'key' | 'value', val: string | number) => {
    const updated = [...scores];
    if (field === 'key') {
      updated[index].key = val as string;
    } else {
      updated[index].value = Number(val);
    }
    setScores(updated);
  };

  const addCareerPath = () => {
    setCareerPaths([...careerPaths, { field: '', matchPercentage: 0, description: '' }]);
  };

  const removeCareerPath = (index: number) => {
    setCareerPaths(careerPaths.filter((_, i) => i !== index));
  };

  const updateCareerPath = (index: number, field: keyof CareerPathEntry, val: string | number) => {
    const updated = [...careerPaths];
    if (field === 'matchPercentage') {
      updated[index][field] = Number(val);
    } else {
      updated[index][field] = val as string;
    }
    setCareerPaths(updated);
  };

  return (
    <div className="space-y-6">
      <PageTitle
        crumbs={[{ label: "Assessments", href: "/career-connect/counseling/assessments" }, { label: "New assessment" }]}
        title="New assessment"
        description="Create a new career assessment for a student"
      />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Assessment Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Student *</Label>
                <StudentPicker
                  value={watch('studentId')}
                  onChange={(id) => setValue('studentId', id || '')}
                />
                {errors.studentId && (
                  <p className="text-sm text-destructive">{errors.studentId.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Assessment Type *</Label>
                <Select
                  defaultValue="aptitude"
                  onValueChange={(val) =>
                    setValue('assessmentType', val as FormData['assessmentType'])
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="aptitude">Aptitude</SelectItem>
                    <SelectItem value="interest">Interest</SelectItem>
                    <SelectItem value="personality">Personality</SelectItem>
                    <SelectItem value="skill">Skill</SelectItem>
                  </SelectContent>
                </Select>
                {errors.assessmentType && (
                  <p className="text-sm text-destructive">{errors.assessmentType.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="assessmentDate">Assessment Date *</Label>
                <Controller
                  name="assessmentDate"
                  control={control}
                  render={({ field }) => (
                    <DatePicker
                      id="assessmentDate"
                      value={
                        field.value instanceof Date
                          ? field.value.toISOString().slice(0, 10)
                          : (field.value ?? '')
                      }
                      onChange={(iso) => field.onChange(iso ? new Date(iso) : undefined)}
                    />
                  )}
                />
                {errors.assessmentDate && (
                  <p className="text-sm text-destructive">{errors.assessmentDate.message}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Scores</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {scores.map((score, index) => (
              <div key={index} className="flex gap-3 items-end">
                <div className="flex-1 space-y-1">
                  {index === 0 && <Label>Category</Label>}
                  <Input
                    value={score.key}
                    onChange={(e) => updateScore(index, 'key', e.target.value)}
                    placeholder="e.g. Logical Reasoning"
                  />
                </div>
                <div className="w-24 space-y-1">
                  {index === 0 && <Label>Score</Label>}
                  <Input
                    type="number"
                    value={score.value}
                    onChange={(e) => updateScore(index, 'value', e.target.value)}
                    placeholder="0"
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeScore(index)}
                  disabled={scores.length <= 1}
                >
                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                </Button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={addScore}>
              <Plus className="mr-2 h-4 w-4" />
              Add Score
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Strengths & Areas of Improvement</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="strengths">Strengths (one per line)</Label>
              <Textarea
                id="strengths"
                {...register('results.strengths' as 'notes')}
                placeholder="Analytical thinking&#10;Problem solving&#10;Communication skills"
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="areasOfImprovement">Areas of Improvement (one per line)</Label>
              <Textarea
                id="areasOfImprovement"
                {...register('results.areasOfImprovement' as 'notes')}
                placeholder="Time management&#10;Spatial reasoning&#10;Creative thinking"
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recommended Career Paths</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {careerPaths.map((cp, index) => (
              <div key={index} className="flex gap-3 items-end">
                <div className="flex-1 space-y-1">
                  {index === 0 && <Label>Field</Label>}
                  <Input
                    value={cp.field}
                    onChange={(e) => updateCareerPath(index, 'field', e.target.value)}
                    placeholder="e.g. Software Engineering"
                  />
                </div>
                <div className="w-28 space-y-1">
                  {index === 0 && <Label>Match %</Label>}
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={cp.matchPercentage}
                    onChange={(e) => updateCareerPath(index, 'matchPercentage', e.target.value)}
                  />
                </div>
                <div className="flex-1 space-y-1">
                  {index === 0 && <Label>Description</Label>}
                  <Input
                    value={cp.description}
                    onChange={(e) => updateCareerPath(index, 'description', e.target.value)}
                    placeholder="Brief description"
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeCareerPath(index)}
                  disabled={careerPaths.length <= 1}
                >
                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                </Button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={addCareerPath}>
              <Plus className="mr-2 h-4 w-4" />
              Add Career Path
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Additional Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              {...register('notes')}
              placeholder="Any additional observations or notes about this assessment..."
              rows={3}
            />
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting || createMutation.isPending}>
            {createMutation.isPending ? 'Creating...' : 'Create Assessment'}
          </Button>
        </div>
      </form>
    </div>
  );
}
