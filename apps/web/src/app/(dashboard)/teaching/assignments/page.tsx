'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { teachingApi } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
  ClipboardList,
  Plus,
  MoreHorizontal,
  Eye,
  Edit,
  Trash2,
  Loader2,
  FileQuestion,
  Send,
  Users,
  ImagePlus,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  QuestionEditor,
  emptyQuestion,
  type Question,
} from '@/components/teaching/question-editor';
import { Switch } from '@/components/ui/switch';
import { DatePicker } from '@/components/ui/date-picker';

// --- Types ---

interface AssignmentForm {
  title: string;
  description: string;
  sectionId: string;
  subjectId: string;
  dueDate: string;
  totalMarks: number;
  hasQuestions: boolean;
  questions: Question[];
  attachments: string[];
}

interface UnifiedItem {
  _id: string;
  kind: 'assignment' | 'questionnaire';
  title: string;
  sectionName: string;
  subjectName: string;
  dueDate: string | null;
  totalMarks: number;
  status: string;
  createdAt: string;
  // assignment-specific
  sectionId?: string;
  subjectId?: string;
  description?: string;
  hasQuestions?: boolean;
  // questionnaire-specific
  lessonPlanId?: string;
  lessonTitle?: string;
  questionCount?: number;
}

const defaultForm: AssignmentForm = {
  title: '',
  description: '',
  sectionId: '',
  subjectId: '',
  dueDate: '',
  totalMarks: 100,
  hasQuestions: false,
  questions: [],
  attachments: [],
};

// --- Component ---

export default function AssignmentsPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sectionFilter, setSectionFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const limit = 20;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<string | null>(null);
  const [form, setForm] = useState<AssignmentForm>(defaultForm);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Map status filter for questionnaires (closed = completed)
  const assignmentStatus = statusFilter !== 'all' ? statusFilter : undefined;
  const questionnaireStatus = useMemo(() => {
    if (statusFilter === 'all') return undefined;
    if (statusFilter === 'completed') return 'closed';
    if (statusFilter === 'grading') return '__skip__'; // questionnaires auto-grade
    return statusFilter; // draft, published map directly
  }, [statusFilter]);

  // --- Queries ---

  const { data: assignmentsData, isLoading: assignmentsLoading } = useQuery({
    queryKey: ['assignments', assignmentStatus, sectionFilter, page],
    queryFn: () =>
      teachingApi.getAssignments({
        status: assignmentStatus,
        sectionId: sectionFilter !== 'all' ? sectionFilter : undefined,
        page,
        limit,
      }),
    enabled: typeFilter !== 'quizzes',
  });

  const { data: questionnairesData, isLoading: questionnairesLoading } = useQuery({
    queryKey: ['questionnaires', questionnaireStatus, sectionFilter, page],
    queryFn: () =>
      teachingApi.getQuestionnaires({
        status: questionnaireStatus !== '__skip__' ? questionnaireStatus : undefined,
        sectionId: sectionFilter !== 'all' ? sectionFilter : undefined,
        page,
        limit,
      }),
    enabled: typeFilter !== 'assignments' && questionnaireStatus !== '__skip__',
  });

  const { data: classesData } = useQuery({
    queryKey: ['my-classes'],
    queryFn: () => teachingApi.getMyClasses(),
  });

  // --- Mutations ---

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => teachingApi.createAssignment(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assignments'] });
      toast.success('Assignment created successfully');
      setDialogOpen(false);
      setForm(defaultForm);
    },
    onError: () => {
      toast.error('Failed to create assignment');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      teachingApi.updateAssignment(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assignments'] });
      toast.success('Assignment updated successfully');
      setDialogOpen(false);
      setEditingAssignment(null);
      setForm(defaultForm);
    },
    onError: () => {
      toast.error('Failed to update assignment');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => teachingApi.deleteAssignment(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assignments'] });
      toast.success('Assignment deleted successfully');
      setDeleteConfirmId(null);
    },
    onError: () => {
      toast.error('Failed to delete assignment');
    },
  });

  const publishMutation = useMutation({
    mutationFn: (id: string) => teachingApi.publishAssignment(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assignments'] });
      toast.success('Assignment published successfully');
    },
    onError: () => {
      toast.error('Failed to publish assignment');
    },
  });

  // --- Derived data ---

  const classes = classesData?.data || [];
  const assignmentsMeta = assignmentsData?.meta || { total: 0 };
  const questionnairesMeta = questionnairesData?.meta || { total: 0 };
  const totalItems = assignmentsMeta.total + questionnairesMeta.total;

  const isLoading = assignmentsLoading || questionnairesLoading;

  // Normalize and merge both sources
  const unifiedItems: UnifiedItem[] = useMemo(() => {
    const items: UnifiedItem[] = [];

    if (typeFilter !== 'quizzes') {
      const assignments = assignmentsData?.data || [];
      for (const a of assignments) {
        items.push({
          _id: a._id,
          kind: 'assignment',
          title: a.title,
          sectionName: a.sectionName || '-',
          subjectName: a.subjectName || '-',
          dueDate: a.dueDate || null,
          totalMarks: a.totalMarks,
          status: a.status,
          createdAt: a.createdAt,
          sectionId: a.sectionId,
          subjectId: a.subjectId,
          description: a.description,
          hasQuestions: a.hasQuestions,
        });
      }
    }

    if (typeFilter !== 'assignments' && questionnaireStatus !== '__skip__') {
      const questionnaires = questionnairesData?.data || [];
      for (const q of questionnaires) {
        items.push({
          _id: q._id,
          kind: 'questionnaire',
          title: q.title,
          sectionName: q.sectionName || '-',
          subjectName: q.subjectName || '-',
          dueDate: q.dueDate || null,
          totalMarks: q.totalMarks,
          status: q.status === 'closed' ? 'completed' : q.status,
          createdAt: q.createdAt,
          lessonPlanId: q.lessonPlanId,
          lessonTitle: q.lessonTitle,
          questionCount: q.questions?.length,
        });
      }
    }

    // Sort by createdAt descending
    items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return items;
  }, [assignmentsData, questionnairesData, typeFilter, questionnaireStatus]);

  // --- Helpers ---

  const getSubjectsForSection = (sectionId: string) => {
    const cls = classes.find((c: { sectionId: string }) => c.sectionId === sectionId);
    if (!cls) return [];
    // Handle both formats: object array (subjects) and parallel arrays (subjectIds/subjectNames)
    if (cls.subjectIds && cls.subjectNames) {
      return cls.subjectIds.map((id: string, i: number) => ({
        subjectId: id,
        subjectName: cls.subjectNames[i] || id,
      }));
    }
    return cls?.subjects || [];
  };

  const getStatusBadge = (status: string) => {
    const config: Record<
      string,
      {
        variant: 'default' | 'secondary' | 'outline' | 'destructive';
        label: string;
        className?: string;
      }
    > = {
      draft: { variant: 'outline', label: 'Draft' },
      published: { variant: 'default', label: 'Published', className: 'bg-blue-600' },
      grading: { variant: 'secondary', label: 'Grading', className: 'bg-amber-500 text-white' },
      completed: { variant: 'default', label: 'Completed', className: 'bg-green-600' },
      closed: { variant: 'default', label: 'Completed', className: 'bg-green-600' },
    };
    const c = config[status] || { variant: 'outline' as const, label: status };
    return (
      <Badge variant={c.variant} className={c.className}>
        {c.label}
      </Badge>
    );
  };

  const getTypeBadge = (kind: 'assignment' | 'questionnaire') => {
    if (kind === 'questionnaire') {
      return (
        <Badge
          variant="secondary"
          className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 gap-1"
        >
          <FileQuestion className="h-3 w-3" />
          Quiz
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="gap-1">
        <ClipboardList className="h-3 w-3" />
        Assignment
      </Badge>
    );
  };

  const handleOpenDialog = (assignment?: {
    _id: string;
    title: string;
    description: string;
    sectionId: string;
    subjectId: string;
    dueDate: string;
    totalMarks: number;
    hasQuestions?: boolean;
    questions?: Question[];
    attachments?: string[];
  }) => {
    if (assignment) {
      setEditingAssignment(assignment._id);
      setForm({
        title: assignment.title,
        description: assignment.description || '',
        sectionId: assignment.sectionId,
        subjectId: assignment.subjectId,
        dueDate: assignment.dueDate ? assignment.dueDate.split('T')[0] : '',
        totalMarks: assignment.totalMarks,
        hasQuestions: assignment.hasQuestions || false,
        questions: assignment.questions || [],
        attachments: assignment.attachments || [],
      });
    } else {
      setEditingAssignment(null);
      setForm(defaultForm);
    }
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!form.title || !form.sectionId || !form.subjectId || !form.dueDate) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (form.hasQuestions) {
      if (form.questions.length === 0) {
        toast.error('Please add at least one question');
        return;
      }
      for (let i = 0; i < form.questions.length; i++) {
        const q = form.questions[i];
        if (!q.question.trim()) {
          toast.error(`Question ${i + 1} is empty`);
          return;
        }
        if (!q.correctAnswer.trim()) {
          toast.error(`Question ${i + 1} needs a correct answer`);
          return;
        }
        if (q.type === 'mcq' && q.options.filter((o) => o.trim()).length < 2) {
          toast.error(`Question ${i + 1} needs at least 2 options`);
          return;
        }
      }
    }

    const payload: Record<string, unknown> = {
      title: form.title,
      description: form.description,
      sectionId: form.sectionId,
      subjectId: form.subjectId,
      dueDate: form.dueDate,
      attachments: form.attachments.filter((u) => u.trim()),
    };

    if (form.hasQuestions) {
      payload.questions = form.questions.map((q) => ({
        type: q.type,
        question: q.question,
        options: q.type === 'mcq' ? q.options.filter((o) => o.trim()) : undefined,
        correctAnswer: q.correctAnswer,
        marks: q.marks,
      }));
    } else {
      payload.totalMarks = form.totalMarks;
    }

    if (editingAssignment) {
      updateMutation.mutate({ id: editingAssignment, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  // --- Render ---

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Assignments & Quizzes</h1>
          <p className="text-muted-foreground">
            Manage assignments and view quizzes from lesson plans
          </p>
        </div>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="mr-2 h-4 w-4" /> Create Assignment
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <Select
              value={typeFilter}
              onValueChange={(value) => {
                setTypeFilter(value);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="assignments">Assignments Only</SelectItem>
                <SelectItem value="quizzes">Quizzes Only</SelectItem>
              </SelectContent>
            </Select>
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
                <SelectItem value="grading">Grading</SelectItem>
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

      {/* Unified Table */}
      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : unifiedItems.length === 0 ? (
            <div className="text-center py-8">
              <ClipboardList className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-medium">No assignments or quizzes found</h3>
              <p className="text-muted-foreground">
                Create an assignment or add a questionnaire from a lesson plan
              </p>
              <Button className="mt-4" onClick={() => handleOpenDialog()}>
                <Plus className="mr-2 h-4 w-4" /> Create Assignment
              </Button>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Section</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Total Marks</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {unifiedItems.map((item) => (
                    <TableRow key={`${item.kind}-${item._id}`}>
                      <TableCell>
                        <div>
                          <span className="font-medium">
                            {item.title}
                            {item.kind === 'assignment' && item.hasQuestions && (
                              <Badge variant="secondary" className="ml-2 text-[10px] px-1.5 py-0">
                                <FileQuestion className="h-2.5 w-2.5 mr-0.5" />Q
                              </Badge>
                            )}
                          </span>
                          {item.kind === 'questionnaire' && item.lessonTitle && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              From: {item.lessonTitle}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{getTypeBadge(item.kind)}</TableCell>
                      <TableCell>{item.sectionName}</TableCell>
                      <TableCell>{item.subjectName}</TableCell>
                      <TableCell>
                        {item.dueDate ? new Date(item.dueDate).toLocaleDateString() : '-'}
                      </TableCell>
                      <TableCell>{item.totalMarks}</TableCell>
                      <TableCell>{getStatusBadge(item.status)}</TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {item.kind === 'assignment' ? (
                              <>
                                <DropdownMenuItem asChild>
                                  <Link href={`/teaching/assignments/${item._id}`}>
                                    <Eye className="mr-2 h-4 w-4" />
                                    View
                                  </Link>
                                </DropdownMenuItem>
                                {item.status !== 'draft' && item.hasQuestions && (
                                  <DropdownMenuItem asChild>
                                    <Link href={`/teaching/assignments/${item._id}/submissions`}>
                                      <Users className="mr-2 h-4 w-4" />
                                      View Submissions
                                    </Link>
                                  </DropdownMenuItem>
                                )}
                                {item.status === 'draft' && (
                                  <>
                                    <DropdownMenuItem
                                      onClick={() => publishMutation.mutate(item._id)}
                                      disabled={publishMutation.isPending}
                                    >
                                      <Send className="mr-2 h-4 w-4" />
                                      Publish
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() =>
                                        handleOpenDialog({
                                          _id: item._id,
                                          title: item.title,
                                          description: item.description || '',
                                          sectionId: item.sectionId!,
                                          subjectId: item.subjectId!,
                                          dueDate: item.dueDate || '',
                                          totalMarks: item.totalMarks,
                                        })
                                      }
                                    >
                                      <Edit className="mr-2 h-4 w-4" />
                                      Edit
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      className="text-destructive"
                                      onClick={() => setDeleteConfirmId(item._id)}
                                    >
                                      <Trash2 className="mr-2 h-4 w-4" />
                                      Delete
                                    </DropdownMenuItem>
                                  </>
                                )}
                              </>
                            ) : (
                              <>
                                <DropdownMenuItem asChild>
                                  <Link href={`/teaching/questionnaires/${item._id}?view=teacher`}>
                                    <Eye className="mr-2 h-4 w-4" />
                                    View
                                  </Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild>
                                  <Link href={`/teaching/questionnaires/${item._id}/submissions`}>
                                    <Users className="mr-2 h-4 w-4" />
                                    View Submissions
                                  </Link>
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              {totalItems > limit && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">
                    Showing page {page} ({totalItems} total items)
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
                      disabled={unifiedItems.length < limit}
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

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent
          className={form.hasQuestions ? 'max-w-2xl max-h-[90vh] overflow-y-auto' : 'max-w-lg'}
        >
          <DialogHeader>
            <DialogTitle>{editingAssignment ? 'Edit Assignment' : 'Create Assignment'}</DialogTitle>
            <DialogDescription>
              {editingAssignment
                ? 'Update the assignment details.'
                : 'Fill in the details for your new assignment.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="assign-title">Title *</Label>
              <Input
                id="assign-title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Assignment title"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="assign-desc">Description</Label>
              <Textarea
                id="assign-desc"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Assignment description and instructions"
                rows={3}
              />
            </div>

            {/* Photos / Attachments */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <ImagePlus className="h-4 w-4" />
                Photos & Attachments
              </Label>
              <p className="text-xs text-muted-foreground">
                Paste image or document URLs (one per line). Useful for attaching reference photos,
                diagrams, or PDFs hosted on Drive/Imgur/etc.
              </p>
              <Textarea
                value={form.attachments.join('\n')}
                onChange={(e) => setForm({ ...form, attachments: e.target.value.split('\n') })}
                placeholder={'https://example.com/diagram.png\nhttps://example.com/handout.pdf'}
                rows={3}
              />
              {form.attachments.filter((u) => u.trim()).length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {form.attachments
                    .filter((u) => u.trim())
                    .map((url, i) => {
                      const isImage = /\.(png|jpe?g|gif|webp|svg)(\?|$)/i.test(url);
                      return (
                        <div
                          key={`${url}-${i}`}
                          className="relative group rounded-lg border bg-muted/30 overflow-hidden"
                        >
                          {isImage ? (
                            <img
                              src={url}
                              alt={`Attachment ${i + 1}`}
                              className="h-16 w-16 object-cover"
                            />
                          ) : (
                            <div className="h-16 w-16 flex items-center justify-center text-[10px] text-muted-foreground p-1 text-center break-all">
                              {url.split('/').pop()?.slice(0, 18) || 'file'}
                            </div>
                          )}
                          <button
                            type="button"
                            onClick={() =>
                              setForm({
                                ...form,
                                attachments: form.attachments.filter((_, idx) => idx !== i),
                              })
                            }
                            className="absolute top-0.5 right-0.5 h-4 w-4 rounded-full bg-destructive/90 text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            aria-label="Remove attachment"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="assign-section">Section *</Label>
                <Select
                  value={form.sectionId}
                  onValueChange={(value) => setForm({ ...form, sectionId: value, subjectId: '' })}
                >
                  <SelectTrigger id="assign-section">
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
                <Label htmlFor="assign-subject">Subject *</Label>
                <Select
                  value={form.subjectId}
                  onValueChange={(value) => setForm({ ...form, subjectId: value })}
                >
                  <SelectTrigger id="assign-subject">
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
                <Label htmlFor="assign-due">Due Date *</Label>
                <DatePicker
                  id="assign-due"
                  value={form.dueDate}
                  onChange={(iso) => setForm({ ...form, dueDate: iso })}
                  disablePast
                />
              </div>
              {!form.hasQuestions && (
                <div className="space-y-2">
                  <Label htmlFor="assign-marks">Total Marks</Label>
                  <Input
                    id="assign-marks"
                    type="number"
                    min={1}
                    value={form.totalMarks}
                    onChange={(e) =>
                      setForm({ ...form, totalMarks: parseInt(e.target.value) || 100 })
                    }
                  />
                </div>
              )}
            </div>

            {/* Questions Toggle */}
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label className="text-sm font-medium">Include Questions</Label>
                <p className="text-xs text-muted-foreground">
                  Add questions for students to answer with auto-grading
                </p>
              </div>
              <Switch
                checked={form.hasQuestions}
                onCheckedChange={(checked) =>
                  setForm({
                    ...form,
                    hasQuestions: checked,
                    questions:
                      checked && form.questions.length === 0 ? [emptyQuestion()] : form.questions,
                  })
                }
              />
            </div>

            {/* Question Editor */}
            {form.hasQuestions && (
              <QuestionEditor
                questions={form.questions}
                onChange={(questions) => setForm({ ...form, questions })}
              />
            )}
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
              {editingAssignment ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Assignment</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this assignment? This action cannot be undone.
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
