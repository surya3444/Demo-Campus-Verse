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
import { Progress } from '@/components/ui/progress';
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
  User,
  Calendar,
  Trash2,
  FileText,
  TrendingUp,
  TrendingDown,
  Target,
} from 'lucide-react';
import { toast } from 'sonner';

const typeColors: Record<string, string> = {
  aptitude: 'bg-blue-100 text-blue-800',
  interest: 'bg-purple-100 text-purple-800',
  personality: 'bg-success/20 text-success',
  skill: 'bg-orange-100 text-orange-800',
};

interface AssessmentDetail {
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
  updatedAt?: string;
}

function getStudentName(assessment: AssessmentDetail): string {
  if (typeof assessment.studentId === 'object' && 'firstName' in assessment.studentId) {
    const s = assessment.studentId;
    return `${s.firstName} ${s.lastName}${s.rollNumber ? ` (${s.rollNumber})` : ''}`;
  }
  return String(assessment.studentId);
}

export default function AssessmentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const id = params.id as string;
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['assessment', id],
    queryFn: () => careerConnectApi.getAssessment(id),
  });

  const deleteMutation = useMutation({
    mutationFn: () => careerConnectApi.deleteAssessment(id),
    onSuccess: () => {
      toast.success('Assessment deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['assessments'] });
      router.push('/career-connect/counseling/assessments');
    },
    onError: () => {
      toast.error('Failed to delete assessment');
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

  const assessment: AssessmentDetail | undefined = data?.data;

  if (!assessment) {
    return (
      <div className="text-center py-12">
        <ClipboardList className="mx-auto h-12 w-12 text-muted-foreground/50" />
        <h3 className="mt-4 text-lg font-medium">Assessment not found</h3>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => router.push('/career-connect/counseling/assessments')}
        >
          Back to Assessments
        </Button>
      </div>
    );
  }

  const scores = assessment.results?.scores || {};
  const strengths = assessment.results?.strengths || [];
  const areasOfImprovement = assessment.results?.areasOfImprovement || [];
  const careerPaths = (assessment.recommendedCareerPaths || []).sort(
    (a, b) => b.matchPercentage - a.matchPercentage
  );
  const maxScore = Object.values(scores).length > 0 ? Math.max(...Object.values(scores)) : 100;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight">Assessment Details</h1>
              <Badge variant="secondary" className={typeColors[assessment.assessmentType] || ''}>
                {assessment.assessmentType}
              </Badge>
            </div>
            <p className="text-muted-foreground">{getStudentName(assessment)}</p>
          </div>
        </div>
        {hasPermission('careerConnect.counseling', 'delete') && (
          <Button variant="outline" size="sm" onClick={() => setShowDeleteDialog(true)}>
            <Trash2 className="mr-2 h-4 w-4 text-destructive" />
            Delete
          </Button>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{getStudentName(assessment)}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span>
                {new Date(assessment.assessmentDate).toLocaleDateString('en-IN', {
                  day: '2-digit',
                  month: 'long',
                  year: 'numeric',
                })}
              </span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm">
              <Target className="h-4 w-4 text-muted-foreground" />
              <span className="capitalize">{assessment.assessmentType} Assessment</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {Object.keys(scores).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Scores</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Category</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead className="w-[40%]">Progress</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.entries(scores).map(([category, score]) => (
                  <TableRow key={category}>
                    <TableCell className="font-medium">{category}</TableCell>
                    <TableCell>{score}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress value={(score / maxScore) * 100} className="h-2" />
                        <span className="text-xs text-muted-foreground w-12 text-right">
                          {Math.round((score / maxScore) * 100)}%
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {strengths.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingUp className="h-4 w-4 text-green-600" />
                Strengths
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {strengths.map((strength, index) => (
                  <Badge key={index} variant="secondary" className="bg-green-100 text-green-800">
                    {strength}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {areasOfImprovement.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingDown className="h-4 w-4 text-yellow-600" />
                Areas of Improvement
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {areasOfImprovement.map((area, index) => (
                  <Badge key={index} variant="secondary" className="bg-yellow-100 text-yellow-800">
                    {area}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {careerPaths.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Target className="h-4 w-4" />
              Recommended Career Paths
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {careerPaths.map((path, index) => (
                <Card key={index} className="border">
                  <CardContent className="pt-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium">{path.field}</h4>
                      <span className="text-sm font-semibold text-primary">
                        {path.matchPercentage}%
                      </span>
                    </div>
                    <Progress value={path.matchPercentage} className="h-2" />
                    {path.description && (
                      <p className="text-sm text-muted-foreground">{path.description}</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {assessment.notes && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4" />
              Notes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{assessment.notes}</p>
          </CardContent>
        </Card>
      )}

      <Separator />

      <div className="text-xs text-muted-foreground">
        Created: {new Date(assessment.createdAt).toLocaleString('en-IN')}
        {assessment.updatedAt && (
          <> | Updated: {new Date(assessment.updatedAt).toLocaleString('en-IN')}</>
        )}
      </div>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
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
