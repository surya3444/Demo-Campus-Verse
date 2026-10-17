'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { teachingApi } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { DatePicker } from '@/components/ui/date-picker';
// Table imports kept for potential future use
// import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  BookOpen,
  Plus,
  MoreHorizontal,
  Eye,
  Edit,
  Trash2,
  Loader2,
  List,
  CalendarDays,
  Clock,
  ArrowRight,
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { TeachingStatusBadge } from '@/components/teaching/TeachingStatusBadge';
import { TeacherSelector } from '@/components/teaching/TeacherSelector';
import { usePermissions } from '@/hooks/usePermissions';
import { useTeacherViewStore } from '@/store/teacherViewStore';
import { CalendarView } from './calendar-view';
import { LessonDrawer } from './lesson-drawer';

interface LessonPlanForm {
  title: string;
  sectionId: string;
  subjectId: string;
  slotId: string;
  date: string;
  duration: string;
  objectives: string;
  description: string;
  resources: string;
  status: string;
}

const defaultForm: LessonPlanForm = {
  title: '',
  sectionId: '',
  subjectId: '',
  slotId: '',
  date: '',
  duration: '',
  objectives: '',
  description: '',
  resources: '',
  status: 'draft',
};

export default function LessonPlansPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { isGroupOwner, isOrgAdmin, isBranchAdmin } = usePermissions();
  const isAdminRole = isGroupOwner || isOrgAdmin || isBranchAdmin;
  const { selectedStaffId } = useTeacherViewStore();
  const isViewingAsAdmin = isAdminRole;

  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [teachingStatusFilter, setTeachingStatusFilter] = useState<string>('all');
  const [sectionFilter, setSectionFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const limit = 20;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<string | null>(null);
  const [form, setForm] = useState<LessonPlanForm>(defaultForm);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<'list' | 'calendar'>('list');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [drawerLesson, setDrawerLesson] = useState<Record<string, any> | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: [
      'lesson-plans',
      statusFilter,
      teachingStatusFilter,
      sectionFilter,
      page,
      isViewingAsAdmin ? selectedStaffId : undefined,
    ],
    queryFn: () =>
      teachingApi.getLessonPlans({
        status: statusFilter !== 'all' ? statusFilter : undefined,
        teachingStatus: teachingStatusFilter !== 'all' ? teachingStatusFilter : undefined,
        sectionId: sectionFilter !== 'all' ? sectionFilter : undefined,
        staffId: isViewingAsAdmin && selectedStaffId ? selectedStaffId : undefined,
        page,
        limit,
      }),
    enabled: !isViewingAsAdmin || !!selectedStaffId,
  });

  const { data: classesData } = useQuery({
    queryKey: ['my-classes', isViewingAsAdmin ? selectedStaffId : undefined],
    queryFn: () =>
      teachingApi.getMyClasses(isViewingAsAdmin && selectedStaffId ? selectedStaffId : undefined),
    enabled: !isViewingAsAdmin || !!selectedStaffId,
  });

  // Fetch timetable for slot picker in create dialog
  const { data: timetableData } = useQuery({
    queryKey: ['my-timetable'],
    queryFn: () => teachingApi.getMyTimetable(),
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const timetableEntries: any[] = timetableData?.data || [];

  // Derive unique slots from timetable
  const timetableSlots = (() => {
    const slotMap = new Map<
      string,
      { _id: string; name: string; startTime: string; endTime: string }
    >();
    for (const e of timetableEntries) {
      if (e.slotType === 'period' && !slotMap.has(e.slotId)) {
        slotMap.set(e.slotId, {
          _id: e.slotId,
          name: e.slotName || '',
          startTime: e.startTime || '',
          endTime: e.endTime || '',
        });
      }
    }
    return [...slotMap.values()];
  })();

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => teachingApi.createLessonPlan(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lesson-plans'] });
      toast.success('Lesson plan created successfully');
      setDialogOpen(false);
      setForm(defaultForm);
    },
    onError: () => {
      toast.error('Failed to create lesson plan');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      teachingApi.updateLessonPlan(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lesson-plans'] });
      toast.success('Lesson plan updated successfully');
      setDialogOpen(false);
      setEditingPlan(null);
      setForm(defaultForm);
    },
    onError: () => {
      toast.error('Failed to update lesson plan');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => teachingApi.deleteLessonPlan(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lesson-plans'] });
      toast.success('Lesson plan deleted successfully');
      setDeleteConfirmId(null);
    },
    onError: () => {
      toast.error('Failed to delete lesson plan');
    },
  });

  const plans = data?.data || [];
  const meta = data?.meta || { total: 0, page: 1, limit: 20, totalPages: 1 };
  const classes = classesData?.data || [];

  const getSubjectsForSection = (sid: string) => {
    const cls = classes.find((c: { sectionId: string }) => c.sectionId === sid);
    if (!cls) return [];
    if (cls.subjectIds && cls.subjectNames) {
      return cls.subjectIds.map((id: string, i: number) => ({
        subjectId: id,
        subjectName: cls.subjectNames[i] || id,
      }));
    }
    return cls?.subjects || [];
  };

  // handleOpenDialog removed — edit now uses /teaching/lesson-plans/new?editId=...

  const handleSave = () => {
    if (!form.title || !form.sectionId || !form.subjectId || !form.date) {
      toast.error('Please fill in all required fields');
      return;
    }

    const payload: Record<string, unknown> = {
      title: form.title,
      sectionId: form.sectionId,
      subjectId: form.subjectId,
      date: form.date,
      objectives: form.objectives.split('\n').filter((o) => o.trim()),
      description: form.description,
      resources: form.resources.split('\n').filter((r) => r.trim()),
      status: form.status,
    };

    if (form.slotId) payload.slotId = form.slotId;
    if (form.duration) payload.duration = parseInt(form.duration);

    if (editingPlan) {
      updateMutation.mutate({ id: editingPlan, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const getStatusBadge = (status: string) => {
    if (status === 'published') {
      return (
        <Badge variant="default" className="bg-green-600">
          Published
        </Badge>
      );
    }
    return <Badge variant="outline">Draft</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Lesson Plans</h1>
          <p className="text-muted-foreground">Create and manage your lesson plans</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center border rounded-lg p-0.5">
            <Button
              variant={activeView === 'list' ? 'default' : 'ghost'}
              size="sm"
              className="gap-1.5 h-8"
              onClick={() => setActiveView('list')}
            >
              <List className="h-4 w-4" />
              List
            </Button>
            <Button
              variant={activeView === 'calendar' ? 'default' : 'ghost'}
              size="sm"
              className="gap-1.5 h-8"
              onClick={() => setActiveView('calendar')}
            >
              <CalendarDays className="h-4 w-4" />
              Calendar
            </Button>
          </div>
          {activeView === 'list' && !isViewingAsAdmin && (
            <Button onClick={() => router.push('/teaching/lesson-plans/new')}>
              <Plus className="mr-2 h-4 w-4" /> Create Plan
            </Button>
          )}
        </div>
      </div>

      {isViewingAsAdmin && <TeacherSelector />}

      {/* Calendar View */}
      {activeView === 'calendar' && (
        <Card>
          <CardContent className="pt-6">
            <CalendarView
              staffId={isViewingAsAdmin ? selectedStaffId : undefined}
              onLessonClick={(lesson) => setDrawerLesson(lesson)}
              onCreateLesson={
                isViewingAsAdmin
                  ? undefined
                  : (date, sectionId, subjectId, slotId) => {
                      const params = new URLSearchParams();
                      if (date) params.set('date', date);
                      if (sectionId) params.set('sectionId', sectionId);
                      if (subjectId) params.set('subjectId', subjectId);
                      if (slotId) params.set('slotId', slotId);
                      router.push(`/teaching/lesson-plans/new?${params.toString()}`);
                    }
              }
            />
          </CardContent>
        </Card>
      )}

      {/* Lesson Drawer */}
      <LessonDrawer
        lesson={drawerLesson}
        open={!!drawerLesson}
        onOpenChange={(open) => !open && setDrawerLesson(null)}
        readOnly={isViewingAsAdmin}
      />

      {/* List View */}
      {activeView !== 'list' ? null : (
        <>
          {/* Filters */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col md:flex-row gap-4">
                <Select
                  value={statusFilter}
                  onValueChange={(value) => {
                    setStatusFilter(value);
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="published">Published</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={teachingStatusFilter}
                  onValueChange={(value) => {
                    setTeachingStatusFilter(value);
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Teaching Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Teaching Status</SelectItem>
                    <SelectItem value="not_started">Not Started</SelectItem>
                    <SelectItem value="ongoing">In Progress</SelectItem>
                    <SelectItem value="delivered">Delivered</SelectItem>
                    <SelectItem value="questionnaire_sent">Questionnaire Sent</SelectItem>
                    <SelectItem value="all_submitted">All Submitted</SelectItem>
                    <SelectItem value="completed_with_assignment">Done + Assignment</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={sectionFilter}
                  onValueChange={(value) => {
                    setSectionFilter(value);
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="w-[220px]">
                    <SelectValue placeholder="Section" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Sections</SelectItem>
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
            </CardContent>
          </Card>

          {/* Plans List */}
          <div>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-28 rounded-xl" />
                ))}
              </div>
            ) : plans.length === 0 ? (
              <div className="text-center py-16">
                <BookOpen className="mx-auto h-14 w-14 text-muted-foreground/30" />
                <h3 className="mt-4 text-lg font-medium">No lesson plans found</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Create your first lesson plan to get started
                </p>
                <Button className="mt-4" onClick={() => router.push('/teaching/lesson-plans/new')}>
                  <Plus className="mr-2 h-4 w-4" /> Create Plan
                </Button>
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  {plans.map(
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    (plan: any) => (
                      <div
                        key={plan._id}
                        className="group border rounded-xl p-4 hover:shadow-md transition-all bg-card flex gap-4 items-start"
                      >
                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="text-base font-semibold">{plan.title}</h3>
                                {plan.sectionName && (
                                  <Badge
                                    variant="outline"
                                    className="text-[10px] px-2 py-0 shrink-0"
                                  >
                                    {plan.sectionName}
                                  </Badge>
                                )}
                                {plan.subjectName && (
                                  <Badge
                                    variant="secondary"
                                    className="text-[10px] px-2 py-0 shrink-0"
                                  >
                                    {plan.subjectName}
                                  </Badge>
                                )}
                              </div>
                              {plan.description && (
                                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                                  {plan.description}
                                </p>
                              )}
                            </div>
                            {/* Actions */}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                                >
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem asChild>
                                  <Link href={`/teaching/lesson-plans/${plan._id}`}>
                                    <Eye className="mr-2 h-4 w-4" />
                                    View
                                  </Link>
                                </DropdownMenuItem>
                                {!isViewingAsAdmin && (
                                  <DropdownMenuItem asChild>
                                    <Link href={`/teaching/lesson-plans/new?editId=${plan._id}`}>
                                      <Edit className="mr-2 h-4 w-4" />
                                      Edit
                                    </Link>
                                  </DropdownMenuItem>
                                )}
                                {!isViewingAsAdmin && (
                                  <DropdownMenuItem
                                    className="text-destructive"
                                    onClick={() => setDeleteConfirmId(plan._id)}
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Delete
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>

                          {/* Bottom row: meta + preview link */}
                          <div className="flex items-center justify-between mt-3">
                            <div className="flex items-center gap-3 flex-wrap">
                              {plan.duration && (
                                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <Clock className="h-3 w-3" />
                                  {plan.duration} Min
                                </span>
                              )}
                              {plan.date && (
                                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <CalendarDays className="h-3 w-3" />
                                  {new Date(plan.date).toLocaleDateString('en-IN', {
                                    day: 'numeric',
                                    month: 'short',
                                  })}
                                </span>
                              )}
                              {plan.objectives?.length > 0 && (
                                <span className="text-xs text-muted-foreground">
                                  {plan.objectives.length} steps
                                </span>
                              )}
                              {getStatusBadge(plan.status)}
                              <TeachingStatusBadge status={plan.teachingStatus || 'not_started'} />
                            </div>
                            <button
                              className="flex items-center gap-1 text-xs font-medium text-primary hover:underline shrink-0"
                              onClick={() => setDrawerLesson(plan)}
                            >
                              Preview Details <ArrowRight className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  )}
                </div>

                {/* Pagination */}
                {meta.totalPages > 1 && (
                  <div className="flex items-center justify-between mt-4">
                    <p className="text-sm text-muted-foreground">
                      Showing {(meta.page - 1) * meta.limit + 1} to{' '}
                      {Math.min(meta.page * meta.limit, meta.total)} of {meta.total} plans
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(page - 1)}
                        disabled={page === 1}
                      >
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(page + 1)}
                        disabled={page >= meta.totalPages}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingPlan ? 'Edit Lesson Plan' : 'Create Lesson Plan'}</DialogTitle>
            <DialogDescription>
              {editingPlan
                ? 'Update the lesson plan details.'
                : 'Fill in the details for your new lesson plan.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="plan-title">Title *</Label>
              <Input
                id="plan-title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Lesson plan title"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="plan-section">Section *</Label>
                <Select
                  value={form.sectionId}
                  onValueChange={(value) => setForm({ ...form, sectionId: value, subjectId: '' })}
                >
                  <SelectTrigger id="plan-section">
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
                <Label htmlFor="plan-subject">Subject *</Label>
                <Select
                  value={form.subjectId}
                  onValueChange={(value) => setForm({ ...form, subjectId: value })}
                >
                  <SelectTrigger id="plan-subject">
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
                <Label htmlFor="plan-date">Date *</Label>
                <DatePicker
                  id="plan-date"
                  value={form.date}
                  onChange={(iso) => setForm({ ...form, date: iso })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="plan-status">Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(value) => setForm({ ...form, status: value })}
                >
                  <SelectTrigger id="plan-status">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="published">Published</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="plan-slot">Period / Slot</Label>
                <Select
                  value={form.slotId || 'none'}
                  onValueChange={(value) =>
                    setForm({ ...form, slotId: value === 'none' ? '' : value })
                  }
                >
                  <SelectTrigger id="plan-slot">
                    <SelectValue placeholder="Select period (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {timetableSlots.map((slot) => (
                      <SelectItem key={slot._id} value={slot._id}>
                        {slot.name} ({slot.startTime} – {slot.endTime})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="plan-duration">Duration (minutes)</Label>
                <Input
                  id="plan-duration"
                  type="number"
                  min={1}
                  value={form.duration}
                  onChange={(e) => setForm({ ...form, duration: e.target.value })}
                  placeholder="e.g. 45"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="plan-objectives">Step-by-Step Procedure (one per line)</Label>
              <Textarea
                id="plan-objectives"
                value={form.objectives}
                onChange={(e) => setForm({ ...form, objectives: e.target.value })}
                placeholder="Enter each objective on a new line"
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="plan-description">Description</Label>
              <Textarea
                id="plan-description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Lesson description and teaching notes"
                rows={5}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="plan-resources">Resources (one per line)</Label>
              <Textarea
                id="plan-resources"
                value={form.resources}
                onChange={(e) => setForm({ ...form, resources: e.target.value })}
                placeholder="Enter each resource on a new line"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {(createMutation.isPending || updateMutation.isPending) && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {editingPlan ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Lesson Plan</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this lesson plan? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirmId && deleteMutation.mutate(deleteConfirmId)}
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
