'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { teachingApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { DatePicker } from '@/components/ui/date-picker';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  ArrowLeft,
  Edit,
  Trash2,
  BookOpen,
  Calendar,
  User,
  Target,
  FileText,
  Package,
  Loader2,
  Play,
  CheckCircle2,
  Link2,
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { TeachingStatusBadge } from '@/components/teaching/TeachingStatusBadge';

interface LessonPlanForm {
  title: string;
  sectionId: string;
  subjectId: string;
  date: string;
  objectives: string;
  description: string;
  resources: string;
  status: string;
}

export default function LessonPlanDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const id = params.id as string;

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [form, setForm] = useState<LessonPlanForm>({
    title: '',
    sectionId: '',
    subjectId: '',
    date: '',
    objectives: '',
    description: '',
    resources: '',
    status: 'draft',
  });

  const { data, isLoading } = useQuery({
    queryKey: ['lesson-plan', id],
    queryFn: () => teachingApi.getLessonPlan(id),
  });

  const { data: classesData } = useQuery({
    queryKey: ['my-classes'],
    queryFn: () => teachingApi.getMyClasses(),
  });

  const updateMutation = useMutation({
    mutationFn: (updateData: Record<string, unknown>) =>
      teachingApi.updateLessonPlan(id, updateData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lesson-plan', id] });
      queryClient.invalidateQueries({ queryKey: ['lesson-plans'] });
      toast.success('Lesson plan updated successfully');
      setEditDialogOpen(false);
    },
    onError: () => {
      toast.error('Failed to update lesson plan');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => teachingApi.deleteLessonPlan(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lesson-plans'] });
      toast.success('Lesson plan deleted successfully');
      router.push('/teaching/lesson-plans');
    },
    onError: () => {
      toast.error('Failed to delete lesson plan');
    },
  });

  const teachingStatusMutation = useMutation({
    mutationFn: (data: { teachingStatus: string; linkedAssignmentId?: string }) =>
      teachingApi.updateLessonPlanTeachingStatus(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lesson-plan', id] });
      queryClient.invalidateQueries({ queryKey: ['lesson-plans'] });
      toast.success('Teaching status updated');
    },
    onError: () => {
      toast.error('Failed to update teaching status');
    },
  });

  const classes = classesData?.data || [];

  const getSubjectsForSection = (sectionId: string) => {
    const cls = classes.find((c: { sectionId: string }) => c.sectionId === sectionId);
    return cls?.subjects || [];
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  const plan = data?.data;

  if (!plan) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold">Lesson plan not found</h2>
        <Button asChild className="mt-4">
          <Link href="/teaching/lesson-plans">Back to Lesson Plans</Link>
        </Button>
      </div>
    );
  }

  const getNextTeachingAction = (status: string) => {
    const isUpdating = teachingStatusMutation.isPending;
    const actionBtn = (label: string, nextStatus: string, icon: typeof Play) => {
      const Icon = icon;
      return (
        <Button
          key={nextStatus}
          size="sm"
          variant="outline"
          className="gap-1"
          onClick={() => teachingStatusMutation.mutate({ teachingStatus: nextStatus })}
          disabled={isUpdating}
        >
          {isUpdating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Icon className="h-3 w-3" />}
          {label}
        </Button>
      );
    };

    switch (status) {
      case 'not_started':
        return actionBtn('Start Teaching', 'ongoing', Play);
      case 'ongoing':
        return (
          <div className="flex gap-2">
            {actionBtn('Mark Delivered', 'delivered', BookOpen)}
            {actionBtn('Complete', 'completed', CheckCircle2)}
          </div>
        );
      case 'delivered':
        return (
          <div className="flex gap-2">
            {actionBtn('Send Questionnaire', 'questionnaire_sent', Link2)}
            {actionBtn('Complete', 'completed', CheckCircle2)}
          </div>
        );
      case 'questionnaire_sent':
        return (
          <div className="flex gap-2">
            {actionBtn('All Submitted', 'all_submitted', CheckCircle2)}
            {actionBtn('Complete', 'completed', CheckCircle2)}
          </div>
        );
      case 'all_submitted':
        return actionBtn('Complete', 'completed', CheckCircle2);
      case 'completed_with_assignment':
        return actionBtn('Mark Complete', 'completed', CheckCircle2);
      default:
        return null;
    }
  };

  const handleSaveEdit = () => {
    if (!form.title || !form.sectionId || !form.subjectId || !form.date) {
      toast.error('Please fill in all required fields');
      return;
    }

    updateMutation.mutate({
      title: form.title,
      sectionId: form.sectionId,
      subjectId: form.subjectId,
      date: form.date,
      objectives: form.objectives.split('\n').filter((o) => o.trim()),
      description: form.description,
      resources: form.resources.split('\n').filter((r) => r.trim()),
      status: form.status,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/teaching/lesson-plans">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{plan.title}</h1>
            <p className="text-muted-foreground">Lesson Plan Details</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href={`/teaching/lesson-plans/new?editId=${id}`}>
              <Edit className="mr-2 h-4 w-4" /> Edit
            </Link>
          </Button>
          <Button variant="destructive" onClick={() => setDeleteDialogOpen(true)}>
            <Trash2 className="mr-2 h-4 w-4" /> Delete
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Basic Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-blue-500" />
              Plan Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Section</p>
                <p className="font-medium">{plan.sectionName || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Subject</p>
                <p className="font-medium">{plan.subjectName || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Date</p>
                <p className="font-medium flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  {plan.date ? new Date(plan.date).toLocaleDateString() : '-'}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Status</p>
                {plan.status === 'published' ? (
                  <Badge variant="default" className="bg-green-600">
                    Published
                  </Badge>
                ) : (
                  <Badge variant="outline">Draft</Badge>
                )}
              </div>
            </div>
            {plan.teacherName && (
              <div>
                <p className="text-sm text-muted-foreground">Teacher</p>
                <p className="font-medium flex items-center gap-1">
                  <User className="h-3.5 w-3.5" />
                  {plan.teacherName}
                </p>
              </div>
            )}
            {plan.slotName && (
              <div>
                <p className="text-sm text-muted-foreground">Period</p>
                <p className="font-medium flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  {plan.slotName}
                  {plan.slotStartTime ? ` (${plan.slotStartTime} – ${plan.slotEndTime})` : ''}
                </p>
              </div>
            )}
            {plan.status === 'published' && (
              <div className="pt-3 border-t">
                <p className="text-sm text-muted-foreground mb-2">Teaching Progress</p>
                <div className="flex items-center gap-2 flex-wrap">
                  <TeachingStatusBadge status={plan.teachingStatus || 'not_started'} />
                  {getNextTeachingAction(plan.teachingStatus || 'not_started')}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Objectives */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-green-500" />
              Objectives
            </CardTitle>
          </CardHeader>
          <CardContent>
            {plan.objectives?.length > 0 ? (
              <ul className="space-y-2">
                {plan.objectives.map((objective: string, index: number) => (
                  <li key={index} className="flex items-start gap-2">
                    <span className="text-muted-foreground text-sm mt-0.5">{index + 1}.</span>
                    <span className="text-sm">{objective}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground">No objectives specified</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Content */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-purple-500" />
            Content
          </CardTitle>
        </CardHeader>
        <CardContent>
          {plan.description ? (
            <div className="prose prose-sm max-w-none whitespace-pre-wrap">{plan.description}</div>
          ) : (
            <p className="text-muted-foreground">No description added</p>
          )}
        </CardContent>
      </Card>

      {/* Resources */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-amber-500" />
            Resources
          </CardTitle>
        </CardHeader>
        <CardContent>
          {plan.resources?.length > 0 ? (
            <ul className="space-y-2">
              {plan.resources.map((resource: string, index: number) => (
                <li key={index} className="flex items-start gap-2 p-2 bg-muted rounded-lg">
                  <span className="text-sm">{resource}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground">No resources listed</p>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Lesson Plan</DialogTitle>
            <DialogDescription>Update the lesson plan details.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-title">Title *</Label>
              <Input
                id="edit-title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Lesson plan title"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-section">Section *</Label>
                <Select
                  value={form.sectionId}
                  onValueChange={(value) => setForm({ ...form, sectionId: value, subjectId: '' })}
                >
                  <SelectTrigger id="edit-section">
                    <SelectValue placeholder="Select section" />
                  </SelectTrigger>
                  <SelectContent>
                    {classes.map(
                      (cls: { sectionId: string; className: string; sectionName: string }) => (
                        <SelectItem key={cls.sectionId} value={cls.sectionId}>
                          {cls.className} - {cls.sectionName}
                        </SelectItem>
                      )
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-subject">Subject *</Label>
                <Select
                  value={form.subjectId}
                  onValueChange={(value) => setForm({ ...form, subjectId: value })}
                >
                  <SelectTrigger id="edit-subject">
                    <SelectValue placeholder="Select subject" />
                  </SelectTrigger>
                  <SelectContent>
                    {getSubjectsForSection(form.sectionId).map(
                      (sub: { subjectId: string; subjectName: string }) => (
                        <SelectItem key={sub.subjectId} value={sub.subjectId}>
                          {sub.subjectName}
                        </SelectItem>
                      )
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-date">Date *</Label>
                <DatePicker
                  id="edit-date"
                  value={form.date}
                  onChange={(iso) => setForm({ ...form, date: iso })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-status">Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(value) => setForm({ ...form, status: value })}
                >
                  <SelectTrigger id="edit-status">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="published">Published</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-objectives">Objectives (one per line)</Label>
              <Textarea
                id="edit-objectives"
                value={form.objectives}
                onChange={(e) => setForm({ ...form, objectives: e.target.value })}
                placeholder="Enter each objective on a new line"
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Lesson description and teaching notes"
                rows={5}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-resources">Resources (one per line)</Label>
              <Textarea
                id="edit-resources"
                value={form.resources}
                onChange={(e) => setForm({ ...form, resources: e.target.value })}
                placeholder="Enter each resource on a new line"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={updateMutation.isPending}>
              {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Lesson Plan</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{plan.title}&quot;? This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
