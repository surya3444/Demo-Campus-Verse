'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { teachingApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  ArrowLeft,
  ClipboardList,
  Calendar,
  Award,
  Users,
  CheckCircle,
  Send,
  PlayCircle,
  Save,
  Loader2,
  FileQuestion,
  CircleDot,
  ToggleLeft,
  Type,
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

interface GradeEntry {
  studentId: string;
  studentName: string;
  admissionNumber: string;
  marksObtained: number | '';
  remarks: string;
}

export default function AssignmentDetailPage() {
  const params = useParams();
  const queryClient = useQueryClient();
  const id = params.id as string;

  const [activeTab, setActiveTab] = useState('details');
  const [grades, setGrades] = useState<GradeEntry[]>([]);
  const [gradesDirty, setGradesDirty] = useState(false);
  const [reviewState, setReviewState] = useState<Record<string, Record<string, boolean>>>({});

  const { data: assignmentData, isLoading: assignmentLoading } = useQuery({
    queryKey: ['assignment', id],
    queryFn: () => teachingApi.getAssignment(id),
  });

  const { data: gradesData, isLoading: gradesLoading } = useQuery({
    queryKey: ['assignment-grades', id],
    queryFn: () => teachingApi.getAssignmentGrades(id),
    enabled:
      !!assignmentData?.data && ['grading', 'completed'].includes(assignmentData.data.status),
  });

  const { data: submissionsData } = useQuery({
    queryKey: ['assignment-submissions', id],
    queryFn: () => teachingApi.getAssignmentSubmissions(id),
    enabled: !!assignmentData?.data?.hasQuestions && assignmentData.data.status !== 'draft',
  });

  const reviewMutation = useMutation({
    mutationFn: ({
      submissionId,
      questionResults,
    }: {
      submissionId: string;
      questionResults: { questionId: string; isCorrect: boolean }[];
    }) => teachingApi.reviewAssignmentSubmission(id, submissionId, { questionResults }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assignment-submissions', id] });
      queryClient.invalidateQueries({ queryKey: ['assignment-grades', id] });
      toast.success('Submission reviewed and graded');
    },
    onError: () => {
      toast.error('Failed to review submission');
    },
  });

  const publishMutation = useMutation({
    mutationFn: () => teachingApi.publishAssignment(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assignment', id] });
      queryClient.invalidateQueries({ queryKey: ['assignments'] });
      toast.success('Assignment published successfully');
    },
    onError: () => {
      toast.error('Failed to publish assignment');
    },
  });

  const startGradingMutation = useMutation({
    mutationFn: () => teachingApi.startGrading(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assignment', id] });
      queryClient.invalidateQueries({ queryKey: ['assignments'] });
      toast.success('Grading started');
    },
    onError: () => {
      toast.error('Failed to start grading');
    },
  });

  const completeMutation = useMutation({
    mutationFn: () => teachingApi.completeAssignment(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assignment', id] });
      queryClient.invalidateQueries({ queryKey: ['assignments'] });
      toast.success('Assignment completed');
    },
    onError: () => {
      toast.error('Failed to complete assignment');
    },
  });

  const bulkGradeMutation = useMutation({
    mutationFn: (gradeData: {
      assignmentId: string;
      grades: Array<{ studentId: string; marksObtained: number; remarks?: string }>;
    }) => teachingApi.bulkGrade(gradeData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assignment-grades', id] });
      toast.success('Grades saved successfully');
      setGradesDirty(false);
    },
    onError: () => {
      toast.error('Failed to save grades');
    },
  });

  const assignment = assignmentData?.data;

  useEffect(() => {
    if (gradesData?.data) {
      setGrades(
        gradesData.data.map(
          (g: {
            studentId: string;
            studentName: string;
            admissionNumber: string;
            marksObtained?: number;
            remarks?: string;
          }) => ({
            studentId: g.studentId,
            studentName: g.studentName,
            admissionNumber: g.admissionNumber,
            marksObtained: g.marksObtained ?? '',
            remarks: g.remarks || '',
          })
        )
      );
    }
  }, [gradesData]);

  const handleGradeChange = (
    studentId: string,
    field: 'marksObtained' | 'remarks',
    value: string | number
  ) => {
    setGrades((prev) =>
      prev.map((g) => (g.studentId === studentId ? { ...g, [field]: value } : g))
    );
    setGradesDirty(true);
  };

  const handleSaveGrades = () => {
    const validGrades = grades
      .filter((g) => g.marksObtained !== '' && g.marksObtained !== undefined)
      .map((g) => ({
        studentId: g.studentId,
        marksObtained: Number(g.marksObtained),
        remarks: g.remarks || undefined,
      }));

    if (validGrades.length === 0) {
      toast.error('Please enter marks for at least one student');
      return;
    }

    bulkGradeMutation.mutate({
      assignmentId: id,
      grades: validGrades,
    });
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
    };
    const c = config[status] || { variant: 'outline' as const, label: status };
    return (
      <Badge variant={c.variant} className={c.className}>
        {c.label}
      </Badge>
    );
  };

  const averageMarks =
    grades.length > 0
      ? grades
          .filter((g) => g.marksObtained !== '' && g.marksObtained !== undefined)
          .reduce((sum, g) => sum + Number(g.marksObtained), 0) /
        (grades.filter((g) => g.marksObtained !== '' && g.marksObtained !== undefined).length || 1)
      : 0;

  const gradedCount = grades.filter(
    (g) => g.marksObtained !== '' && g.marksObtained !== undefined
  ).length;

  if (assignmentLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!assignment) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold">Assignment not found</h2>
        <Button asChild className="mt-4">
          <Link href="/teaching/assignments">Back to Assignments</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/teaching/assignments">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{assignment.title}</h1>
            <p className="text-muted-foreground">Assignment Details</p>
          </div>
        </div>
        <div className="flex gap-2">
          {assignment.status === 'draft' && (
            <Button onClick={() => publishMutation.mutate()} disabled={publishMutation.isPending}>
              {publishMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              Publish
            </Button>
          )}
          {assignment.status === 'published' && (
            <Button
              onClick={() => startGradingMutation.mutate()}
              disabled={startGradingMutation.isPending}
            >
              {startGradingMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <PlayCircle className="mr-2 h-4 w-4" />
              )}
              Start Grading
            </Button>
          )}
          {assignment.status === 'grading' && (
            <Button onClick={() => completeMutation.mutate()} disabled={completeMutation.isPending}>
              {completeMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle className="mr-2 h-4 w-4" />
              )}
              Complete
            </Button>
          )}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          {assignment.hasQuestions && assignment.status !== 'draft' && (
            <TabsTrigger value="submissions">Submissions</TabsTrigger>
          )}
          {['grading', 'completed'].includes(assignment.status) && (
            <TabsTrigger value="grades">Grades</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="details">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Assignment Info */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ClipboardList className="h-5 w-5 text-blue-500" />
                  Assignment Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Section</p>
                    <p className="font-medium">{assignment.sectionName || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Subject</p>
                    <p className="font-medium">{assignment.subjectName || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Due Date</p>
                    <p className="font-medium flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      {assignment.dueDate ? new Date(assignment.dueDate).toLocaleDateString() : '-'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Marks</p>
                    <p className="font-medium flex items-center gap-1">
                      <Award className="h-3.5 w-3.5" />
                      {assignment.totalMarks}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Status</p>
                    {getStatusBadge(assignment.status)}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Description */}
            <Card>
              <CardHeader>
                <CardTitle>Description</CardTitle>
              </CardHeader>
              <CardContent>
                {assignment.description ? (
                  <div className="prose prose-sm max-w-none whitespace-pre-wrap">
                    {assignment.description}
                  </div>
                ) : (
                  <p className="text-muted-foreground">No description provided</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Questions Section */}
          {assignment.hasQuestions && assignment.questions?.length > 0 && (
            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileQuestion className="h-5 w-5 text-purple-500" />
                  Questions ({assignment.questions.length})
                  <Badge variant="secondary" className="ml-auto">
                    {assignment.totalMarks} marks total
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {assignment.questions.map(
                    (
                      q: {
                        _id: string;
                        type: string;
                        question: string;
                        options?: string[];
                        correctAnswer?: string;
                        marks: number;
                      },
                      idx: number
                    ) => {
                      const typeIcon =
                        q.type === 'mcq' ? (
                          <CircleDot className="h-3.5 w-3.5" />
                        ) : q.type === 'true_false' ? (
                          <ToggleLeft className="h-3.5 w-3.5" />
                        ) : (
                          <Type className="h-3.5 w-3.5" />
                        );
                      const typeLabel =
                        q.type === 'mcq'
                          ? 'MCQ'
                          : q.type === 'true_false'
                            ? 'True/False'
                            : 'Short Answer';

                      return (
                        <div key={q._id} className="border rounded-lg p-3 bg-muted/10">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary" className="text-[10px] px-1.5">
                                Q{idx + 1}
                              </Badge>
                              <Badge variant="outline" className="text-[10px] gap-1">
                                {typeIcon}
                                {typeLabel}
                              </Badge>
                            </div>
                            <Badge variant="outline" className="text-[10px]">
                              {q.marks} mark{q.marks !== 1 ? 's' : ''}
                            </Badge>
                          </div>
                          <p className="text-sm font-medium">{q.question}</p>
                          {q.type === 'mcq' && q.options && (
                            <div className="mt-2 space-y-1 pl-2">
                              {q.options.map((opt: string, oIdx: number) => (
                                <div
                                  key={oIdx}
                                  className={`text-xs flex items-center gap-1.5 ${
                                    q.correctAnswer === opt
                                      ? 'text-green-600 font-medium'
                                      : 'text-muted-foreground'
                                  }`}
                                >
                                  <span className="w-4">{String.fromCharCode(65 + oIdx)}.</span>
                                  {opt}
                                  {q.correctAnswer === opt && (
                                    <CheckCircle className="h-3 w-3 text-green-500" />
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                          {q.type === 'true_false' && q.correctAnswer && (
                            <p className="text-xs text-green-600 mt-1 pl-2">
                              Answer: {q.correctAnswer}
                            </p>
                          )}
                          {q.type === 'short_answer' && q.correctAnswer && (
                            <p className="text-xs text-green-600 mt-1 pl-2">
                              Answer: {q.correctAnswer}
                            </p>
                          )}
                        </div>
                      );
                    }
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Submissions Review Tab */}
        {assignment.hasQuestions && assignment.status !== 'draft' && (
          <TabsContent value="submissions">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Users className="h-5 w-5" />
                  Student Submissions ({(submissionsData?.data || []).length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {(submissionsData?.data || []).length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No submissions yet.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {(submissionsData?.data || []).map((sub: any) => {
                      const subId = sub._id as string;
                      const isReviewed = sub.reviewed as boolean;
                      const currentReview = reviewState[subId] || {};

                      // Initialize review state from auto-grade if not set
                      const getIsCorrect = (qId: string) => {
                        if (currentReview[qId] !== undefined) return currentReview[qId];
                        // Auto-compare as default
                        const q = assignment.questions?.find(
                          (question: { _id: string }) => question._id === qId
                        );
                        const studentAnswer = sub.answers?.find(
                          (a: { questionId: string }) => a.questionId === qId
                        );
                        if (q && studentAnswer) {
                          return (
                            q.correctAnswer?.trim().toLowerCase() ===
                            studentAnswer.answer?.trim().toLowerCase()
                          );
                        }
                        return false;
                      };

                      const reviewedTotal =
                        assignment.questions?.reduce(
                          (sum: number, q: { _id: string; marks: number }) =>
                            sum + (getIsCorrect(q._id) ? q.marks : 0),
                          0
                        ) || 0;

                      return (
                        <div key={subId} className="border rounded-lg">
                          <div className="flex items-center justify-between p-4 border-b">
                            <div>
                              <p className="font-medium">{sub.studentName}</p>
                              <p className="text-xs text-muted-foreground">
                                {sub.admissionNumber} · Submitted{' '}
                                {new Date(sub.submittedAt).toLocaleString()}
                              </p>
                            </div>
                            <div className="flex items-center gap-3">
                              <Badge
                                variant={isReviewed ? 'default' : 'secondary'}
                                className={isReviewed ? 'bg-green-600' : ''}
                              >
                                {isReviewed
                                  ? `Reviewed: ${sub.reviewedScore}/${assignment.totalMarks}`
                                  : 'Pending Review'}
                              </Badge>
                              {!isReviewed && (
                                <Button
                                  size="sm"
                                  onClick={() => {
                                    const questionResults = (assignment.questions || []).map(
                                      (q: { _id: string }) => ({
                                        questionId: q._id,
                                        isCorrect: getIsCorrect(q._id),
                                      })
                                    );
                                    reviewMutation.mutate({ submissionId: subId, questionResults });
                                  }}
                                  disabled={reviewMutation.isPending}
                                >
                                  {reviewMutation.isPending ? (
                                    <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                                  ) : (
                                    <Save className="mr-2 h-3 w-3" />
                                  )}
                                  Save Review ({reviewedTotal}/{assignment.totalMarks})
                                </Button>
                              )}
                            </div>
                          </div>
                          {/* Question-by-question review */}
                          <div className="p-4 space-y-3">
                            {(assignment.questions || []).map(
                              (
                                q: {
                                  _id: string;
                                  question: string;
                                  type: string;
                                  correctAnswer: string;
                                  options?: string[];
                                  marks: number;
                                },
                                qIdx: number
                              ) => {
                                const studentAnswer = sub.answers?.find(
                                  (a: { questionId: string }) => a.questionId === q._id
                                );
                                const isCorrect = getIsCorrect(q._id);

                                return (
                                  <div key={q._id} className="border rounded-lg p-3 bg-muted/10">
                                    <div className="flex items-center justify-between mb-2">
                                      <div className="flex items-center gap-2">
                                        <Badge variant="secondary" className="text-[10px]">
                                          Q{qIdx + 1}
                                        </Badge>
                                        <span className="text-sm font-medium">{q.question}</span>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs text-muted-foreground">
                                          {q.marks} marks
                                        </span>
                                        {!isReviewed && (
                                          <button
                                            type="button"
                                            className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                                              isCorrect
                                                ? 'bg-green-100 text-green-700 border border-green-300'
                                                : 'bg-red-100 text-red-700 border border-red-300'
                                            }`}
                                            onClick={() =>
                                              setReviewState((prev) => ({
                                                ...prev,
                                                [subId]: {
                                                  ...prev[subId],
                                                  [q._id]: !isCorrect,
                                                },
                                              }))
                                            }
                                          >
                                            {isCorrect ? 'Correct' : 'Wrong'}
                                          </button>
                                        )}
                                        {isReviewed && (
                                          <Badge
                                            variant={
                                              sub.questionResults?.find(
                                                (r: { questionId: string }) =>
                                                  r.questionId === q._id
                                              )?.isCorrect
                                                ? 'default'
                                                : 'destructive'
                                            }
                                            className={
                                              sub.questionResults?.find(
                                                (r: { questionId: string }) =>
                                                  r.questionId === q._id
                                              )?.isCorrect
                                                ? 'bg-green-600'
                                                : ''
                                            }
                                          >
                                            {sub.questionResults?.find(
                                              (r: { questionId: string }) => r.questionId === q._id
                                            )?.isCorrect
                                              ? 'Correct'
                                              : 'Wrong'}
                                          </Badge>
                                        )}
                                      </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3 text-sm">
                                      <div className="p-2 rounded bg-green-50 border border-green-200">
                                        <p className="text-[10px] text-green-600 font-medium mb-0.5">
                                          Correct Answer
                                        </p>
                                        <p>{q.correctAnswer}</p>
                                      </div>
                                      <div
                                        className={`p-2 rounded border ${
                                          isCorrect
                                            ? 'bg-green-50 border-green-200'
                                            : 'bg-red-50 border-red-200'
                                        }`}
                                      >
                                        <p
                                          className={`text-[10px] font-medium mb-0.5 ${
                                            isCorrect ? 'text-green-600' : 'text-red-600'
                                          }`}
                                        >
                                          Student Answer
                                        </p>
                                        <p>{studentAnswer?.answer || 'No answer'}</p>
                                      </div>
                                    </div>
                                  </div>
                                );
                              }
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {['grading', 'completed'].includes(assignment.status) && (
          <TabsContent value="grades">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Student Grades
                  </CardTitle>
                  <div className="flex gap-4 mt-2 text-sm text-muted-foreground">
                    <span>
                      Graded: {gradedCount} / {grades.length}
                    </span>
                    <span>
                      Average: {averageMarks.toFixed(1)} / {assignment.totalMarks}
                    </span>
                  </div>
                </div>
                {assignment.status === 'grading' && (
                  <Button
                    onClick={handleSaveGrades}
                    disabled={bulkGradeMutation.isPending || !gradesDirty}
                  >
                    {bulkGradeMutation.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="mr-2 h-4 w-4" />
                    )}
                    Save All
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                {gradesLoading ? (
                  <div className="space-y-4">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Skeleton key={i} className="h-12" />
                    ))}
                  </div>
                ) : grades.length === 0 ? (
                  <div className="text-center py-8">
                    <Users className="mx-auto h-12 w-12 text-muted-foreground/50" />
                    <h3 className="mt-4 text-lg font-medium">No students to grade</h3>
                    <p className="text-muted-foreground">No students found for this assignment</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Admission No.</TableHead>
                        <TableHead className="w-[140px]">
                          Marks (out of {assignment.totalMarks})
                        </TableHead>
                        <TableHead className="w-[200px]">Remarks</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {grades.map((grade: GradeEntry) => (
                        <TableRow key={grade.studentId}>
                          <TableCell className="font-medium">{grade.studentName}</TableCell>
                          <TableCell>{grade.admissionNumber}</TableCell>
                          <TableCell>
                            {assignment.status === 'grading' ? (
                              <Input
                                type="number"
                                min={0}
                                max={assignment.totalMarks}
                                value={grade.marksObtained}
                                onChange={(e) =>
                                  handleGradeChange(
                                    grade.studentId,
                                    'marksObtained',
                                    e.target.value === '' ? '' : Number(e.target.value)
                                  )
                                }
                                className="w-[100px]"
                              />
                            ) : (
                              <span>{grade.marksObtained !== '' ? grade.marksObtained : '-'}</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {assignment.status === 'grading' ? (
                              <Input
                                value={grade.remarks}
                                onChange={(e) =>
                                  handleGradeChange(grade.studentId, 'remarks', e.target.value)
                                }
                                placeholder="Optional remarks"
                              />
                            ) : (
                              <span>{grade.remarks || '-'}</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
