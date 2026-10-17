'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { careerConnectApi } from '@/lib/api';
import { usePermissions } from '@/hooks/usePermissions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  ArrowLeft,
  BookOpen,
  FileText,
  Video,
  File,
  ExternalLink,
  Presentation,
  Trash2,
  Eye,
  EyeOff,
  Calendar,
  Tag,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';

const typeIcons: Record<string, React.ElementType> = {
  article: FileText,
  video: Video,
  document: File,
  link: ExternalLink,
  presentation: Presentation,
};

const typeColors: Record<string, string> = {
  article: 'bg-blue-100 text-blue-800',
  video: 'bg-red-100 text-red-800',
  document: 'bg-gray-100 text-gray-800',
  link: 'bg-indigo-100 text-indigo-800',
  presentation: 'bg-amber-100 text-amber-800',
};

const categoryColors: Record<string, string> = {
  career_exploration: 'bg-blue-100 text-blue-800',
  skill_development: 'bg-green-100 text-green-800',
  higher_education: 'bg-purple-100 text-purple-800',
  entrance_exams: 'bg-orange-100 text-orange-800',
  general: 'bg-gray-100 text-gray-800',
};

const categoryLabels: Record<string, string> = {
  career_exploration: 'Career Exploration',
  skill_development: 'Skill Development',
  higher_education: 'Higher Education',
  entrance_exams: 'Entrance Exams',
  general: 'General',
};

interface ResourceDetail {
  _id: string;
  title: string;
  type: string;
  category: string;
  description?: string;
  content?: string;
  url?: string;
  fileUrl?: string;
  tags?: string[];
  targetAudience?: string[];
  isPublished: boolean;
  createdAt: string;
  updatedAt?: string;
  createdBy?: { _id: string; firstName: string; lastName: string } | string;
}

export default function ResourceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const id = params.id as string;
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['resource', id],
    queryFn: () => careerConnectApi.getResource(id),
  });

  const updateMutation = useMutation({
    mutationFn: (updateData: Record<string, unknown>) =>
      careerConnectApi.updateResource(id, updateData),
    onSuccess: () => {
      toast.success('Resource updated successfully');
      queryClient.invalidateQueries({ queryKey: ['resource', id] });
      queryClient.invalidateQueries({ queryKey: ['resources'] });
    },
    onError: () => {
      toast.error('Failed to update resource');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => careerConnectApi.deleteResource(id),
    onSuccess: () => {
      toast.success('Resource deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['resources'] });
      router.push('/career-connect/counseling/resources');
    },
    onError: () => {
      toast.error('Failed to delete resource');
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const resource: ResourceDetail | undefined = data?.data;

  if (!resource) {
    return (
      <div className="text-center py-12">
        <BookOpen className="mx-auto h-12 w-12 text-muted-foreground/50" />
        <h3 className="mt-4 text-lg font-medium">Resource not found</h3>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => router.push('/career-connect/counseling/resources')}
        >
          Back to Resources
        </Button>
      </div>
    );
  }

  const TypeIcon = typeIcons[resource.type] || FileText;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight">{resource.title}</h1>
              <Badge
                variant={resource.isPublished ? 'default' : 'outline'}
                className={resource.isPublished ? 'bg-green-100 text-green-800' : ''}
              >
                {resource.isPublished ? 'Published' : 'Draft'}
              </Badge>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="secondary" className={typeColors[resource.type] || ''}>
                <TypeIcon className="mr-1 h-3 w-3" />
                {resource.type}
              </Badge>
              <Badge variant="secondary" className={categoryColors[resource.category] || ''}>
                {categoryLabels[resource.category] || resource.category}
              </Badge>
            </div>
          </div>
        </div>
        {hasPermission('careerConnect.counseling', 'edit') && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => updateMutation.mutate({ isPublished: !resource.isPublished })}
              disabled={updateMutation.isPending}
            >
              {resource.isPublished ? (
                <>
                  <EyeOff className="mr-2 h-4 w-4" />
                  Unpublish
                </>
              ) : (
                <>
                  <Eye className="mr-2 h-4 w-4" />
                  Publish
                </>
              )}
            </Button>
            {hasPermission('careerConnect.counseling', 'delete') && (
              <Button variant="outline" size="sm" onClick={() => setShowDeleteDialog(true)}>
                <Trash2 className="mr-2 h-4 w-4 text-destructive" />
                Delete
              </Button>
            )}
          </div>
        )}
      </div>

      {resource.description && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">{resource.description}</p>
          </CardContent>
        </Card>
      )}

      {resource.content && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Content</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm max-w-none">
              <p className="whitespace-pre-wrap text-sm">{resource.content}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {resource.url && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ExternalLink className="h-4 w-4" />
              External Link
            </CardTitle>
          </CardHeader>
          <CardContent>
            <a
              href={resource.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary hover:underline break-all"
            >
              {resource.url}
            </a>
          </CardContent>
        </Card>
      )}

      {resource.fileUrl && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <File className="h-4 w-4" />
              Attached File
            </CardTitle>
          </CardHeader>
          <CardContent>
            <a
              href={resource.fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary hover:underline break-all"
            >
              {resource.fileUrl}
            </a>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {resource.tags && resource.tags.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Tag className="h-4 w-4" />
                Tags
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {resource.tags.map((tag, index) => (
                  <Badge key={index} variant="secondary">
                    {tag}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {resource.targetAudience && resource.targetAudience.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="h-4 w-4" />
                Target Audience
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {resource.targetAudience.map((audience, index) => (
                  <Badge key={index} variant="outline">
                    {audience}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <Separator />

      <div className="text-xs text-muted-foreground flex items-center gap-4">
        <div className="flex items-center gap-1">
          <Calendar className="h-3 w-3" />
          Created: {new Date(resource.createdAt).toLocaleString('en-IN')}
        </div>
        {resource.updatedAt && (
          <div className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            Updated: {new Date(resource.updatedAt).toLocaleString('en-IN')}
          </div>
        )}
      </div>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Resource</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this resource? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteMutation.mutate()}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
