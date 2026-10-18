'use client';

import { useState } from 'react';
import { PageTitle } from '@/components/connect/kit';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { careerConnectApi } from '@/lib/api';
import { usePermissions } from '@/hooks/usePermissions';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { ClipboardList, Plus, Search, MoreHorizontal, Eye, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

const typeColors: Record<string, string> = {
  aptitude: 'bg-blue-100 text-blue-800',
  interest: 'bg-purple-100 text-purple-800',
  personality: 'bg-teal-100 text-teal-800',
  skill: 'bg-orange-100 text-orange-800',
};

interface Assessment {
  _id: string;
  studentId: { _id: string; firstName: string; lastName: string; rollNumber?: string } | string;
  assessmentType: string;
  assessmentDate: string;
  results?: {
    scores?: Record<string, number>;
    strengths?: string[];
    areasOfImprovement?: string[];
  };
  recommendedCareerPaths?: Array<{
    field: string;
    matchPercentage: number;
    description?: string;
  }>;
  notes?: string;
  createdAt: string;
}

function getStudentName(assessment: Assessment): string {
  if (typeof assessment.studentId === 'object' && 'firstName' in assessment.studentId) {
    return `${assessment.studentId.firstName} ${assessment.studentId.lastName}`;
  }
  return '-';
}

function getScoresSummary(scores?: Record<string, number>): string {
  if (!scores || Object.keys(scores).length === 0) return '-';
  const entries = Object.entries(scores).slice(0, 3);
  const parts = entries.map(([key, val]) => `${key}: ${val}`);
  const remaining = Object.keys(scores).length - 3;
  if (remaining > 0) parts.push(`+${remaining} more`);
  return parts.join(', ');
}

function getTopCareerMatch(paths?: Assessment['recommendedCareerPaths']): string {
  if (!paths || paths.length === 0) return '-';
  const sorted = [...paths].sort((a, b) => b.matchPercentage - a.matchPercentage);
  return `${sorted[0].field} (${sorted[0].matchPercentage}%)`;
}

export default function AssessmentsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const [studentFilter, setStudentFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [page, setPage] = useState(1);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['assessments', { studentId: studentFilter, assessmentType: typeFilter, page }],
    queryFn: () =>
      careerConnectApi.getAssessments({
        studentId: studentFilter || undefined,
        assessmentType: typeFilter || undefined,
        page,
        limit: 20,
      }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => careerConnectApi.deleteAssessment(id),
    onSuccess: () => {
      toast.success('Assessment deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['assessments'] });
      setDeleteId(null);
    },
    onError: (error: Error & { response?: { data?: { error?: { message?: string } } } }) => {
      toast.error(error.response?.data?.error?.message || 'Failed to delete assessment');
      setDeleteId(null);
    },
  });

  const assessments: Assessment[] = data?.data || [];
  const meta = data?.meta;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <PageTitle
        crumbs={[{ label: "Counseling", href: "/career-connect/counseling" }, { label: "Assessments" }]}
        title="Assessments"
        description="Career aptitude and skill assessments"
      />
        {hasPermission('careerConnect.counseling', 'create') && (
          <Button onClick={() => router.push('/career-connect/counseling/assessments/new')}>
            <Plus className="mr-2 h-4 w-4" />
            New Assessment
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Filter by student ID..."
                value={studentFilter}
                onChange={(e) => {
                  setStudentFilter(e.target.value);
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
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="aptitude">Aptitude</SelectItem>
                <SelectItem value="interest">Interest</SelectItem>
                <SelectItem value="personality">Personality</SelectItem>
                <SelectItem value="skill">Skill</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : assessments.length === 0 ? (
            <div className="text-center py-12">
              <ClipboardList className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-medium">No assessments found</h3>
              <p className="text-muted-foreground">
                {studentFilter || typeFilter
                  ? 'Try adjusting your filters'
                  : 'Create your first student assessment'}
              </p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Scores Summary</TableHead>
                    <TableHead>Top Career Match</TableHead>
                    <TableHead className="w-[60px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assessments.map((assessment) => (
                    <TableRow key={assessment._id}>
                      <TableCell className="font-medium">{getStudentName(assessment)}</TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={typeColors[assessment.assessmentType] || ''}
                        >
                          {assessment.assessmentType}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {new Date(assessment.assessmentDate).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                        {getScoresSummary(assessment.results?.scores)}
                      </TableCell>
                      <TableCell className="text-sm">
                        {getTopCareerMatch(assessment.recommendedCareerPaths)}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() =>
                                router.push(
                                  `/career-connect/counseling/assessments/${assessment._id}`
                                )
                              }
                            >
                              <Eye className="mr-2 h-4 w-4" />
                              View
                            </DropdownMenuItem>
                            {hasPermission('careerConnect.counseling', 'delete') && (
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => setDeleteId(assessment._id)}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {meta && meta.totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">
                    Showing {(page - 1) * 20 + 1}-{Math.min(page * 20, meta.total)} of {meta.total}
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
            <AlertDialogTitle>Delete Assessment</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this assessment? This action cannot be undone.
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
