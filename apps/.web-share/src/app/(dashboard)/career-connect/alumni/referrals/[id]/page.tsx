'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { careerConnectApi } from '@/lib/api';
import { usePermissions } from '@/hooks/usePermissions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { StudentPicker } from '@/components/common/StudentPicker';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
  Share2,
  Building2,
  Briefcase,
  Calendar,
  Users,
  Trash2,
  Edit,
  UserPlus,
} from 'lucide-react';
import { toast } from 'sonner';

const statusColors: Record<string, string> = {
  open: 'bg-green-100 text-green-800',
  in_progress: 'bg-blue-100 text-blue-800',
  closed: 'bg-gray-100 text-gray-800',
};

const jobTypeLabels: Record<string, string> = {
  job: 'Full-time Job',
  internship: 'Internship',
};

interface ReferredStudent {
  studentId: string;
  studentName: string;
  status: string;
  referredAt: string;
}

interface ReferralDetail {
  _id: string;
  companyName: string;
  roleTitle: string;
  jobType?: string;
  description?: string;
  applicationDeadline?: string;
  status: string;
  alumniId: string;
  studentsReferred: ReferredStudent[];
  createdAt: string;
  updatedAt?: string;
}

export default function ReferralDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const id = params.id as string;

  const canEdit = hasPermission('careerConnect.alumni', 'edit');
  const canDelete = hasPermission('careerConnect.alumni', 'delete');

  const [referOpen, setReferOpen] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [referStudentId, setReferStudentId] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['alumni-referral', id],
    queryFn: () => careerConnectApi.getReferral(id),
  });

  const updateMutation = useMutation({
    mutationFn: (updateData: Record<string, unknown>) =>
      careerConnectApi.updateReferral(id, updateData),
    onSuccess: () => {
      toast.success('Referral updated successfully');
      queryClient.invalidateQueries({ queryKey: ['alumni-referral', id] });
      queryClient.invalidateQueries({ queryKey: ['alumni-referrals'] });
    },
    onError: (error: Error & { response?: { data?: { error?: { message?: string } } } }) => {
      toast.error(error.response?.data?.error?.message || 'Failed to update referral');
    },
  });

  const referStudentMutation = useMutation({
    mutationFn: (studentData: Record<string, unknown>) =>
      careerConnectApi.referStudent(id, studentData),
    onSuccess: () => {
      toast.success('Student referred successfully');
      queryClient.invalidateQueries({ queryKey: ['alumni-referral', id] });
      setReferOpen(false);
      setReferStudentId('');
    },
    onError: (error: Error & { response?: { data?: { error?: { message?: string } } } }) => {
      toast.error(error.response?.data?.error?.message || 'Failed to refer student');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => careerConnectApi.deleteReferral(id),
    onSuccess: () => {
      toast.success('Referral deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['alumni-referrals'] });
      router.push('/career-connect/alumni/referrals');
    },
    onError: (error: Error & { response?: { data?: { error?: { message?: string } } } }) => {
      toast.error(error.response?.data?.error?.message || 'Failed to delete referral');
    },
  });

  const handleReferStudent = () => {
    if (!referStudentId) {
      toast.error('Student ID is required');
      return;
    }
    referStudentMutation.mutate({
      studentId: referStudentId,
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const referral: ReferralDetail | undefined = data?.data;

  if (!referral) {
    return (
      <div className="text-center py-12">
        <Share2 className="mx-auto h-12 w-12 text-muted-foreground/50" />
        <h3 className="mt-4 text-lg font-medium">Referral not found</h3>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => router.push('/career-connect/alumni/referrals')}
        >
          Back to Referrals
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight">
                {referral.roleTitle} at {referral.companyName}
              </h1>
              <Badge variant="secondary" className={statusColors[referral.status] || ''}>
                {referral.status === 'in_progress' ? 'In Progress' : referral.status}
              </Badge>
            </div>
            <p className="text-muted-foreground">Referral Opportunity</p>
          </div>
        </div>
        <div className="flex gap-2">
          {canEdit && referral.status !== 'closed' && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  updateMutation.mutate({
                    status: referral.status === 'open' ? 'in_progress' : 'closed',
                  })
                }
                disabled={updateMutation.isPending}
              >
                <Edit className="mr-2 h-4 w-4" />
                {referral.status === 'open' ? 'Mark In Progress' : 'Close'}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setReferOpen(true)}>
                <UserPlus className="mr-2 h-4 w-4" />
                Refer Student
              </Button>
            </>
          )}
          {canDelete && (
            <Button variant="outline" size="sm" onClick={() => setShowDeleteDialog(true)}>
              <Trash2 className="mr-2 h-4 w-4 text-destructive" />
              Delete
            </Button>
          )}
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Company</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-sm">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{referral.companyName}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Job Type</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-sm">
              <Briefcase className="h-4 w-4 text-muted-foreground" />
              <span>{jobTypeLabels[referral.jobType || ''] || referral.jobType || '-'}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Deadline</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span>
                {referral.applicationDeadline
                  ? new Date(referral.applicationDeadline).toLocaleDateString('en-IN', {
                      day: '2-digit',
                      month: 'long',
                      year: 'numeric',
                    })
                  : 'No deadline'}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Description */}
      {referral.description && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Description</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{referral.description}</p>
          </CardContent>
        </Card>
      )}

      {/* Referred Students */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4" />
            Referred Students ({referral.studentsReferred?.length || 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!referral.studentsReferred || referral.studentsReferred.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No students have been referred yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student Name</TableHead>
                  <TableHead>Student ID</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Referred At</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {referral.studentsReferred.map((student, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{student.studentName || '-'}</TableCell>
                    <TableCell className="font-mono text-sm">{student.studentId}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-xs">
                        {student.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {new Date(student.referredAt).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Separator />

      <div className="text-xs text-muted-foreground">
        Created: {new Date(referral.createdAt).toLocaleString('en-IN')}
        {referral.updatedAt && (
          <> | Updated: {new Date(referral.updatedAt).toLocaleString('en-IN')}</>
        )}
      </div>

      {/* Refer Student Dialog */}
      <Dialog open={referOpen} onOpenChange={setReferOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Refer Student</DialogTitle>
            <DialogDescription>
              Refer a student for this opportunity at {referral.companyName}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Student *</Label>
              <StudentPicker
                value={referStudentId}
                onChange={(id) => setReferStudentId(id || '')}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReferOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleReferStudent} disabled={referStudentMutation.isPending}>
              {referStudentMutation.isPending ? 'Referring...' : 'Refer Student'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Referral</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this referral? This action cannot be undone.
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
