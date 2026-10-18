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
  Heart,
  Calendar,
  User,
  Users,
  CheckCircle2,
  XCircle,
  Trash2,
  Clock,
  ListChecks,
  Lightbulb,
  FileText,
  GraduationCap,
} from 'lucide-react';
import { toast } from 'sonner';

const statusColors: Record<string, string> = {
  scheduled: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
  no_show: 'bg-orange-100 text-orange-800',
};

const audienceTypeColors: Record<string, string> = {
  individual: 'bg-blue-100 text-blue-800',
  group: 'bg-purple-100 text-purple-800',
  section: 'bg-success/20 text-success',
  class: 'bg-amber-100 text-amber-800',
  workshop: 'bg-green-100 text-green-800',
};

const typeColors: Record<string, string> = {
  individual: 'bg-blue-100 text-blue-800',
  group: 'bg-purple-100 text-purple-800',
  workshop: 'bg-green-100 text-green-800',
};

interface SessionDetail {
  _id: string;
  sessionNumber?: string;
  sessionType: string;
  audienceType?: string;
  topic: string;
  scheduledDate: string;
  endDate?: string;
  status: string;
  studentId?: { _id: string; firstName: string; lastName: string; rollNumber?: string } | string;
  studentIds?: Array<{ _id: string; firstName: string; lastName: string }> | string[];
  classId?: string;
  className?: string;
  sectionId?: string;
  sectionName?: string;
  counselorId?: { _id: string; firstName: string; lastName: string } | string;
  notes?: string;
  actionItems?: string[];
  recommendations?: string[];
  createdAt: string;
  updatedAt?: string;
}

function getCounselorName(session: SessionDetail): string {
  if (
    session.counselorId &&
    typeof session.counselorId === 'object' &&
    'firstName' in session.counselorId
  ) {
    return `${session.counselorId.firstName} ${session.counselorId.lastName}`;
  }
  return '-';
}

function getAudienceCardContent(session: SessionDetail) {
  const audience = session.audienceType || session.sessionType;

  switch (audience) {
    case 'individual':
      if (
        session.studentId &&
        typeof session.studentId === 'object' &&
        'firstName' in session.studentId
      ) {
        const student = session.studentId;
        return {
          title: 'Student',
          icon: User,
          display: `${student.firstName} ${student.lastName}${student.rollNumber ? ` (${student.rollNumber})` : ''}`,
        };
      }
      return { title: 'Student', icon: User, display: '-' };

    case 'group':
      if (session.studentIds && session.studentIds.length > 0) {
        const names = session.studentIds.map((s) =>
          typeof s === 'object' && 'firstName' in s ? `${s.firstName} ${s.lastName}` : String(s)
        );
        return {
          title: `Group (${session.studentIds.length} students)`,
          icon: Users,
          display: names.join(', '),
        };
      }
      return { title: 'Group', icon: Users, display: 'No students specified' };

    case 'section':
      return {
        title: 'Section',
        icon: GraduationCap,
        display:
          session.className && session.sectionName
            ? `${session.className} - ${session.sectionName}`
            : 'Section not specified',
      };

    case 'class':
      return {
        title: 'Class',
        icon: GraduationCap,
        display: session.className || 'Class not specified',
      };

    case 'workshop':
      return { title: 'Workshop', icon: Users, display: 'Open to all students' };

    default:
      // Fallback for old sessions without audienceType
      if (
        session.studentId &&
        typeof session.studentId === 'object' &&
        'firstName' in session.studentId
      ) {
        const student = session.studentId;
        return {
          title: 'Student',
          icon: User,
          display: `${student.firstName} ${student.lastName}${student.rollNumber ? ` (${student.rollNumber})` : ''}`,
        };
      }
      return { title: 'Audience', icon: Users, display: '-' };
  }
}

export default function CounselingSessionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const id = params.id as string;
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['counseling-session', id],
    queryFn: () => careerConnectApi.getCounselingSession(id),
  });

  const updateMutation = useMutation({
    mutationFn: (updateData: Record<string, unknown>) =>
      careerConnectApi.updateCounselingSession(id, updateData),
    onSuccess: () => {
      toast.success('Session updated successfully');
      queryClient.invalidateQueries({ queryKey: ['counseling-session', id] });
      queryClient.invalidateQueries({ queryKey: ['counseling-sessions'] });
    },
    onError: () => {
      toast.error('Failed to update session');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => careerConnectApi.deleteCounselingSession(id),
    onSuccess: () => {
      toast.success('Session deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['counseling-sessions'] });
      router.push('/career-connect/counseling/sessions');
    },
    onError: () => {
      toast.error('Failed to delete session');
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

  const session: SessionDetail | undefined = data?.data;

  if (!session) {
    return (
      <div className="text-center py-12">
        <Heart className="mx-auto h-12 w-12 text-muted-foreground/50" />
        <h3 className="mt-4 text-lg font-medium">Session not found</h3>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => router.push('/career-connect/counseling/sessions')}
        >
          Back to Sessions
        </Button>
      </div>
    );
  }

  const isScheduled = session.status === 'scheduled';
  const audienceContent = getAudienceCardContent(session);
  const AudienceIcon = audienceContent.icon;

  // Determine type badge
  const audience = session.audienceType || session.sessionType;
  const badgeLabel =
    audience === 'section'
      ? 'Section'
      : audience === 'class'
        ? 'Class'
        : audience.charAt(0).toUpperCase() + audience.slice(1);
  const badgeColors = session.audienceType
    ? audienceTypeColors[session.audienceType] || ''
    : typeColors[session.sessionType] || '';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight">{session.topic}</h1>
              <Badge variant="secondary" className={statusColors[session.status] || ''}>
                {session.status === 'no_show' ? 'No Show' : session.status}
              </Badge>
              <Badge variant="secondary" className={badgeColors}>
                {badgeLabel}
              </Badge>
            </div>
            <p className="text-muted-foreground">
              {session.sessionNumber || `Session ${session._id.slice(-6).toUpperCase()}`}
            </p>
          </div>
        </div>
        {hasPermission('careerConnect.counseling', 'edit') && isScheduled && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => updateMutation.mutate({ status: 'completed' })}
              disabled={updateMutation.isPending}
            >
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Complete
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => updateMutation.mutate({ status: 'cancelled' })}
              disabled={updateMutation.isPending}
            >
              <XCircle className="mr-2 h-4 w-4" />
              Cancel
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

      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Schedule</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span>
                {new Date(session.scheduledDate).toLocaleDateString('en-IN', {
                  weekday: 'long',
                  day: '2-digit',
                  month: 'long',
                  year: 'numeric',
                })}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span>
                {new Date(session.scheduledDate).toLocaleTimeString('en-IN', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
                {session.endDate && (
                  <>
                    {' - '}
                    {new Date(session.endDate).toLocaleTimeString('en-IN', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </>
                )}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {audienceContent.title}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-start gap-2 text-sm">
              <AudienceIcon className="h-4 w-4 text-muted-foreground mt-0.5" />
              <span>{audienceContent.display}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Counselor</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-sm">
              <User className="h-4 w-4 text-muted-foreground" />
              <span>{getCounselorName(session)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {session.notes && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4" />
              Notes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{session.notes}</p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {session.actionItems && session.actionItems.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ListChecks className="h-4 w-4" />
                Action Items
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {session.actionItems.map((item, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm">
                    <div className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary flex-shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {session.recommendations && session.recommendations.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Lightbulb className="h-4 w-4" />
                Recommendations
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {session.recommendations.map((rec, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm">
                    <div className="mt-1.5 h-1.5 w-1.5 rounded-full bg-amber-500 flex-shrink-0" />
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>

      <Separator />

      <div className="text-xs text-muted-foreground">
        Created: {new Date(session.createdAt).toLocaleString('en-IN')}
        {session.updatedAt && (
          <> | Updated: {new Date(session.updatedAt).toLocaleString('en-IN')}</>
        )}
      </div>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Session</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this counseling session? This action cannot be undone.
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
