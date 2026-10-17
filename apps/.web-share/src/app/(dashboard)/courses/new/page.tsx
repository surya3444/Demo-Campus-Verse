'use client';

import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { useMutation } from '@tanstack/react-query';
import { coursesApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

interface NewCourseForm {
  title: string;
  description: string;
  category: string;
  level: string;
}

export default function NewCoursePage() {
  const router = useRouter();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<NewCourseForm>({
    defaultValues: {
      title: '',
      description: '',
      category: 'general',
      level: 'beginner',
    },
  });

  const createMut = useMutation({
    mutationFn: (data: NewCourseForm) =>
      coursesApi.createCourse({
        ...data,
        status: 'draft',
        modules: [],
        tags: [],
      } as unknown as Record<string, unknown>),
    onSuccess: (res) => {
      toast.success('Course created — start building your curriculum');
      router.push(`/courses/${res.data._id}/edit`);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error?.message || 'Failed to create course');
    },
  });

  return (
    <div className="max-w-xl mx-auto py-8">
      <div className="flex items-center gap-3 mb-8">
        <Link href="/courses">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-bold tracking-tight">Create a new course</h1>
          <p className="text-sm text-muted-foreground">
            Set up the basics, then build your curriculum
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit((data) => createMut.mutate(data))}>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Course Information</CardTitle>
            <CardDescription>
              You can always edit these details later from the course builder.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Course Title *</Label>
              <Input
                id="title"
                {...register('title', { required: 'Title is required' })}
                placeholder="e.g. Introduction to Web Development"
                autoFocus
              />
              {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description *</Label>
              <Textarea
                id="description"
                {...register('description', { required: 'Description is required' })}
                placeholder="Brief overview of what students will learn"
                rows={3}
              />
              {errors.description && (
                <p className="text-xs text-destructive">{errors.description.message}</p>
              )}
            </div>

            <div className="grid gap-4 grid-cols-2">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={watch('category')} onValueChange={(v) => setValue('category', v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="technical">Technical</SelectItem>
                    <SelectItem value="soft_skills">Soft Skills</SelectItem>
                    <SelectItem value="aptitude">Aptitude</SelectItem>
                    <SelectItem value="language">Language</SelectItem>
                    <SelectItem value="domain_specific">Domain Specific</SelectItem>
                    <SelectItem value="certification_prep">Certification Prep</SelectItem>
                    <SelectItem value="career_readiness">Career Readiness</SelectItem>
                    <SelectItem value="general">General</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Level</Label>
                <Select value={watch('level')} onValueChange={(v) => setValue('level', v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="beginner">Beginner</SelectItem>
                    <SelectItem value="intermediate">Intermediate</SelectItem>
                    <SelectItem value="advanced">Advanced</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center justify-end gap-3 mt-6">
          <Link href="/courses">
            <Button variant="outline" type="button">
              Cancel
            </Button>
          </Link>
          <Button type="submit" disabled={createMut.isPending} className="gap-2">
            {createMut.isPending ? 'Creating...' : 'Create & Build Curriculum'}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </form>
    </div>
  );
}
