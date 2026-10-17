'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createResourceSchema } from '@campus-verse/shared/schemas';
import { careerConnectApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import type { z } from 'zod';

type FormData = z.infer<typeof createResourceSchema>;

export default function NewResourcePage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isPublished, setIsPublished] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(createResourceSchema),
    defaultValues: {
      title: '',
      type: 'article',
      category: 'general',
      description: '',
      content: '',
      url: '',
      fileUrl: '',
      tags: [],
      targetAudience: [],
      isPublished: false,
    },
  });

  const resourceType = watch('type');

  const createMutation = useMutation({
    mutationFn: (data: FormData) => {
      const payload: Record<string, unknown> = { ...data };
      payload.isPublished = isPublished;

      // Convert comma-separated tags and targetAudience to arrays
      if (typeof payload.tags === 'string') {
        payload.tags = (payload.tags as string)
          .split(',')
          .map((s: string) => s.trim())
          .filter(Boolean);
      }
      if (typeof payload.targetAudience === 'string') {
        payload.targetAudience = (payload.targetAudience as string)
          .split(',')
          .map((s: string) => s.trim())
          .filter(Boolean);
      }

      return careerConnectApi.createResource(payload);
    },
    onSuccess: () => {
      toast.success('Resource created successfully');
      queryClient.invalidateQueries({ queryKey: ['resources'] });
      router.push('/career-connect/counseling/resources');
    },
    onError: () => {
      toast.error('Failed to create resource');
    },
  });

  const onSubmit = (data: FormData) => {
    createMutation.mutate(data);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">New Resource</h1>
          <p className="text-muted-foreground">Add a new career guidance resource</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Resource Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                {...register('title')}
                placeholder="e.g. Guide to Choosing the Right Career Path"
              />
              {errors.title && <p className="text-sm text-destructive">{errors.title.message}</p>}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Type *</Label>
                <Select
                  defaultValue="article"
                  onValueChange={(val) => setValue('type', val as FormData['type'])}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="article">Article</SelectItem>
                    <SelectItem value="video">Video</SelectItem>
                    <SelectItem value="document">Document</SelectItem>
                    <SelectItem value="link">Link</SelectItem>
                    <SelectItem value="presentation">Presentation</SelectItem>
                  </SelectContent>
                </Select>
                {errors.type && <p className="text-sm text-destructive">{errors.type.message}</p>}
              </div>

              <div className="space-y-2">
                <Label>Category</Label>
                <Select
                  defaultValue="general"
                  onValueChange={(val) => setValue('category', val as FormData['category'])}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="career_exploration">Career Exploration</SelectItem>
                    <SelectItem value="skill_development">Skill Development</SelectItem>
                    <SelectItem value="higher_education">Higher Education</SelectItem>
                    <SelectItem value="entrance_exams">Entrance Exams</SelectItem>
                    <SelectItem value="general">General</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                {...register('description')}
                placeholder="Brief description of this resource..."
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Content</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {resourceType === 'article' && (
              <div className="space-y-2">
                <Label htmlFor="content">Article Content</Label>
                <Textarea
                  id="content"
                  {...register('content')}
                  placeholder="Write the article content here..."
                  rows={10}
                />
              </div>
            )}

            {(resourceType === 'video' || resourceType === 'link') && (
              <div className="space-y-2">
                <Label htmlFor="url">URL *</Label>
                <Input id="url" {...register('url')} placeholder="https://..." />
                {errors.url && <p className="text-sm text-destructive">{errors.url.message}</p>}
              </div>
            )}

            {(resourceType === 'document' || resourceType === 'presentation') && (
              <div className="space-y-2">
                <Label htmlFor="fileUrl">File URL</Label>
                <Input
                  id="fileUrl"
                  {...register('fileUrl')}
                  placeholder="URL to the uploaded file"
                />
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tags & Audience</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="tags">Tags (comma-separated)</Label>
              <Input
                id="tags"
                {...register('tags' as 'title')}
                placeholder="e.g. engineering, career guidance, STEM"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="targetAudience">Target Audience (comma-separated)</Label>
              <Input
                id="targetAudience"
                {...register('targetAudience' as 'title')}
                placeholder="e.g. Class 10, Class 12, Science Stream"
              />
            </div>

            <div className="flex items-center gap-3">
              <Switch checked={isPublished} onCheckedChange={setIsPublished} />
              <Label>Publish immediately</Label>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting || createMutation.isPending}>
            {createMutation.isPending ? 'Creating...' : 'Create Resource'}
          </Button>
        </div>
      </form>
    </div>
  );
}
