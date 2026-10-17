'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { careerConnectApi } from '@/lib/api';
import { usePermissions } from '@/hooks/usePermissions';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  BookOpen,
  Plus,
  Search,
  FileText,
  Video,
  File,
  ExternalLink,
  Presentation,
  ArrowLeft,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
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

interface Resource {
  _id: string;
  title: string;
  type: string;
  category: string;
  description?: string;
  isPublished: boolean;
  tags?: string[];
  createdAt: string;
}

export default function ResourcesPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [publishedFilter, setPublishedFilter] = useState<string>('');
  const [page, setPage] = useState(1);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: [
      'resources',
      { search, type: typeFilter, category: categoryFilter, isPublished: publishedFilter, page },
    ],
    queryFn: () =>
      careerConnectApi.getResources({
        search: search || undefined,
        type: typeFilter || undefined,
        category: categoryFilter || undefined,
        isPublished:
          publishedFilter === 'true' ? true : publishedFilter === 'false' ? false : undefined,
        page,
        limit: 12,
      }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => careerConnectApi.deleteResource(id),
    onSuccess: () => {
      toast.success('Resource deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['resources'] });
      setDeleteId(null);
    },
    onError: (error: Error & { response?: { data?: { error?: { message?: string } } } }) => {
      toast.error(error.response?.data?.error?.message || 'Failed to delete resource');
      setDeleteId(null);
    },
  });

  const resources: Resource[] = data?.data || [];
  const meta = data?.meta;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/career-connect/counseling')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Resources</h1>
            <p className="text-muted-foreground">Career guidance materials and resources</p>
          </div>
        </div>
        {hasPermission('careerConnect.counseling', 'create') && (
          <Button onClick={() => router.push('/career-connect/counseling/resources/new')}>
            <Plus className="mr-2 h-4 w-4" />
            New Resource
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search resources..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="pl-9"
              />
            </div>
            <Select
              value={typeFilter}
              onValueChange={(val) => {
                setTypeFilter(val === 'all' ? '' : val);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="article">Article</SelectItem>
                <SelectItem value="video">Video</SelectItem>
                <SelectItem value="document">Document</SelectItem>
                <SelectItem value="link">Link</SelectItem>
                <SelectItem value="presentation">Presentation</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={categoryFilter}
              onValueChange={(val) => {
                setCategoryFilter(val === 'all' ? '' : val);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[170px]">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="career_exploration">Career Exploration</SelectItem>
                <SelectItem value="skill_development">Skill Development</SelectItem>
                <SelectItem value="higher_education">Higher Education</SelectItem>
                <SelectItem value="entrance_exams">Entrance Exams</SelectItem>
                <SelectItem value="general">General</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={publishedFilter}
              onValueChange={(val) => {
                setPublishedFilter(val === 'all' ? '' : val);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="true">Published</SelectItem>
                <SelectItem value="false">Draft</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Skeleton key={i} className="h-48 w-full" />
              ))}
            </div>
          ) : resources.length === 0 ? (
            <div className="text-center py-12">
              <BookOpen className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-medium">No resources found</h3>
              <p className="text-muted-foreground">
                {search || typeFilter || categoryFilter || publishedFilter
                  ? 'Try adjusting your filters'
                  : 'Add your first career resource'}
              </p>
            </div>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {resources.map((resource) => {
                  const TypeIcon = typeIcons[resource.type] || FileText;

                  return (
                    <Card
                      key={resource._id}
                      className="cursor-pointer hover:shadow-md transition-shadow"
                      onClick={() =>
                        router.push(`/career-connect/counseling/resources/${resource._id}`)
                      }
                    >
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <div className="rounded-md bg-muted p-1.5">
                              <TypeIcon className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <CardTitle className="text-base line-clamp-1">
                              {resource.title}
                            </CardTitle>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          <Badge variant="secondary" className={typeColors[resource.type] || ''}>
                            {resource.type}
                          </Badge>
                          <Badge
                            variant="secondary"
                            className={categoryColors[resource.category] || ''}
                          >
                            {categoryLabels[resource.category] || resource.category}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="pb-3">
                        {resource.description ? (
                          <CardDescription className="line-clamp-2">
                            {resource.description}
                          </CardDescription>
                        ) : (
                          <CardDescription className="italic">No description</CardDescription>
                        )}
                      </CardContent>
                      <CardFooter className="pt-0 flex items-center justify-between text-xs text-muted-foreground">
                        <Badge
                          variant={resource.isPublished ? 'default' : 'outline'}
                          className={resource.isPublished ? 'bg-green-100 text-green-800' : ''}
                        >
                          {resource.isPublished ? 'Published' : 'Draft'}
                        </Badge>
                        <span>
                          {new Date(resource.createdAt).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </span>
                      </CardFooter>
                    </Card>
                  );
                })}
              </div>

              {meta && meta.totalPages > 1 && (
                <div className="flex items-center justify-between mt-6">
                  <p className="text-sm text-muted-foreground">
                    Showing {(page - 1) * 12 + 1}-{Math.min(page * 12, meta.total)} of {meta.total}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page <= 1}
                      onClick={() => setPage(page - 1)}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!meta.hasMore}
                      onClick={() => setPage(page + 1)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
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
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
