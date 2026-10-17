'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
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
import { InstructorPicker } from '@/components/courses/InstructorPicker';
import { toast } from 'sonner';
import { Save, X } from 'lucide-react';

interface CourseDetailsTabProps {
  courseId: string;
  course: Record<string, any>;
}

export function CourseDetailsTab({ courseId, course }: CourseDetailsTabProps) {
  const queryClient = useQueryClient();
  const [tagInput, setTagInput] = useState('');

  const { register, handleSubmit, setValue, watch } = useForm({
    defaultValues: {
      title: course.title || '',
      description: course.description || '',
      category: course.category || 'general',
      level: course.level || 'beginner',
      duration: course.duration || undefined,
      instructor: course.instructor || '',
      instructorId: course.instructorId || '',
      instructorName: course.instructorName || '',
      tags: course.tags || [],
      thumbnailUrl: course.thumbnailUrl || '',
      introVideoUrl: course.introVideoUrl || '',
    },
  });

  const updateMut = useMutation({
    mutationFn: (data: Record<string, any>) =>
      coursesApi.updateCourse(courseId, data as Record<string, unknown>),
    onSuccess: () => {
      toast.success('Course details saved');
      queryClient.invalidateQueries({ queryKey: ['course', courseId] });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error?.message || 'Failed to save');
    },
  });

  const tags = watch('tags') || [];

  const addTag = () => {
    const trimmed = tagInput.trim();
    if (trimmed && !tags.includes(trimmed)) {
      setValue('tags', [...tags, trimmed], { shouldDirty: true });
      setTagInput('');
    }
  };

  const removeTag = (index: number) => {
    setValue(
      'tags',
      tags.filter((_: string, i: number) => i !== index),
      { shouldDirty: true }
    );
  };

  const onSubmit = (data: Record<string, any>) => {
    updateMut.mutate(data);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <div className="max-w-3xl space-y-6">
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Basic Information</CardTitle>
            <CardDescription>Course title, description, and classification</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input id="title" {...register('title')} placeholder="Course title" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description *</Label>
              <Textarea
                id="description"
                {...register('description')}
                placeholder="What students will learn in this course"
                rows={4}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select
                  value={watch('category') || 'general'}
                  onValueChange={(v) => setValue('category', v, { shouldDirty: true })}
                >
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
                <Select
                  value={watch('level') || 'beginner'}
                  onValueChange={(v) => setValue('level', v, { shouldDirty: true })}
                >
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

              <div className="space-y-2">
                <Label htmlFor="duration">Duration (hours)</Label>
                <Input
                  id="duration"
                  type="number"
                  {...register('duration', { valueAsNumber: true })}
                  placeholder="e.g. 40"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Instructor */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Instructor</CardTitle>
            <CardDescription>Assign a teaching staff member to this course</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-w-sm">
              <InstructorPicker
                value={watch('instructorId')}
                onChange={(id, name) => {
                  setValue('instructorId', id || '', { shouldDirty: true });
                  setValue('instructorName', name || '', { shouldDirty: true });
                  setValue('instructor', name || '', { shouldDirty: true });
                }}
              />
            </div>
          </CardContent>
        </Card>

        {/* Media */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Media</CardTitle>
            <CardDescription>Thumbnail and intro video for the course landing page</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="thumbnailUrl">Thumbnail Image URL</Label>
              <Input
                id="thumbnailUrl"
                {...register('thumbnailUrl')}
                placeholder="https://example.com/course-cover.jpg"
              />
              {watch('thumbnailUrl') && (
                <img
                  src={watch('thumbnailUrl')}
                  alt="Course thumbnail preview"
                  className="mt-2 h-32 rounded-lg border object-cover"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = 'none';
                  }}
                />
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="introVideoUrl">Intro / Promo Video URL</Label>
              <Input
                id="introVideoUrl"
                {...register('introVideoUrl')}
                placeholder="https://youtube.com/watch?v=..."
              />
              <p className="text-xs text-muted-foreground">
                YouTube, Vimeo, or direct MP4 URL for the course landing page.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Tags */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tags</CardTitle>
            <CardDescription>Help students discover this course</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 max-w-md">
              <Input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                placeholder="Add a tag"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addTag();
                  }
                }}
              />
              <Button type="button" variant="outline" onClick={addTag}>
                Add
              </Button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-3">
                {tags.map((tag: string, i: number) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 rounded-md bg-secondary px-2.5 py-1 text-xs font-medium"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => removeTag(i)}
                      className="hover:text-destructive transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Save bar */}
        <div className="flex items-center justify-end gap-3 pb-6">
          <Button type="submit" disabled={updateMut.isPending} className="gap-2">
            <Save className="h-4 w-4" />
            {updateMut.isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>
    </form>
  );
}
