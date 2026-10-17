'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { careerConnectApi } from '@/lib/api';
import { usePermissions } from '@/hooks/usePermissions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
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
  Users,
  Calendar,
  CheckCircle2,
  XCircle,
  Play,
  Plus,
  Trash2,
  Clock,
  Target,
  MessageSquare,
} from 'lucide-react';
import { toast } from 'sonner';

const statusColors: Record<string, string> = {
  requested: 'bg-yellow-100 text-yellow-800',
  active: 'bg-green-100 text-green-800',
  completed: 'bg-blue-100 text-blue-800',
  cancelled: 'bg-red-100 text-red-800',
};

const programTypeLabels: Record<string, string> = {
  one_on_one: 'One on One',
  group: 'Group',
  project_based: 'Project Based',
};

interface MentorshipSession {
  _id: string;
  date?: string;
  duration?: number;
  notes?: string;
  conductedBy: string;
  conductedAt: string;
}

interface MentorshipDetail {
  _id: string;
  mentorAlumniId: string;
  menteeStudentId: string;
  areaOfGuidance: string;
  programType: string;
  status: string;
  goals: string[];
  sessions: MentorshipSession[];
  startDate?: string;
  endDate?: string;
  feedback?: {
    mentorRating?: number;
    menteeRating?: number;
    comments?: string;
  };
  createdAt: string;
  updatedAt?: string;
}

function formatDateTime(dateStr?: string): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function MentorshipProgramDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const id = params.id as string;

  const canEdit = hasPermission('careerConnect.alumni', 'edit');
  const canDelete = hasPermission('careerConnect.alumni', 'delete');

  const [addSessionOpen, setAddSessionOpen] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [sessionDate, setSessionDate] = useState('');
  const [sessionDuration, setSessionDuration] = useState('');
  const [sessionNotes, setSessionNotes] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['mentorship-program', id],
    queryFn: () => careerConnectApi.getMentorshipProgram(id),
  });

  const updateMutation = useMutation({
    mutationFn: (updateData: Record<string, unknown>) =>
      careerConnectApi.updateMentorshipProgram(id, updateData),
    onSuccess: () => {
      toast.success('Program updated successfully');
      queryClient.invalidateQueries({ queryKey: ['mentorship-program', id] });
      queryClient.invalidateQueries({ queryKey: ['mentorship-programs'] });
    },
    onError: (error: Error & { response?: { data?: { error?: { message?: string } } } }) => {
      toast.error(error.response?.data?.error?.message || 'Failed to update program');
    },
  });

  const addSessionMutation = useMutation({
    mutationFn: (sessionData: Record<string, unknown>) =>
      careerConnectApi.addMentorshipSession(id, sessionData),
    onSuccess: () => {
      toast.success('Session added successfully');
      queryClient.invalidateQueries({ queryKey: ['mentorship-program', id] });
      setAddSessionOpen(false);
      setSessionDate('');
      setSessionDuration('');
      setSessionNotes('');
    },
    onError: (error: Error & { response?: { data?: { error?: { message?: string } } } }) => {
      toast.error(error.response?.data?.error?.message || 'Failed to add session');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => careerConnectApi.deleteMentorshipProgram(id),
    onSuccess: () => {
      toast.success('Program deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['mentorship-programs'] });
      router.push('/career-connect/alumni/mentorship');
    },
    onError: (error: Error & { response?: { data?: { error?: { message?: string } } } }) => {
      toast.error(error.response?.data?.error?.message || 'Failed to delete program');
    },
  });

  const handleAddSession = () => {
    if (!sessionDate) {
      toast.error('Session date is required');
      return;
    }
    addSessionMutation.mutate({
      date: sessionDate,
      duration: sessionDuration ? Number(sessionDuration) : undefined,
      notes: sessionNotes || undefined,
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

  const program: MentorshipDetail | undefined = data?.data;

  if (!program) {
    return (
      <div className="text-center py-12">
        <Users className="mx-auto h-12 w-12 text-muted-foreground/50" />
        <h3 className="mt-4 text-lg font-medium">Program not found</h3>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => router.push('/career-connect/alumni/mentorship')}
        >
          Back to Programs
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
              <h1 className="text-2xl font-bold tracking-tight">{program.areaOfGuidance}</h1>
              <Badge variant="secondary" className={statusColors[program.status] || ''}>
                {program.status}
              </Badge>
              <Badge variant="outline" className="text-xs">
                {programTypeLabels[program.programType] || program.programType}
              </Badge>
            </div>
            <p className="text-muted-foreground">Mentorship Program</p>
          </div>
        </div>
        {canEdit && (
          <div className="flex gap-2">
            {program.status === 'requested' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => updateMutation.mutate({ status: 'active' })}
                disabled={updateMutation.isPending}
              >
                <Play className="mr-2 h-4 w-4" />
                Activate
              </Button>
            )}
            {program.status === 'active' && (
              <>
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
              </>
            )}
            {canDelete && program.status === 'requested' && (
              <Button variant="outline" size="sm" onClick={() => setShowDeleteDialog(true)}>
                <Trash2 className="mr-2 h-4 w-4 text-destructive" />
                Delete
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Overview Cards */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Mentor</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm font-mono">{program.mentorAlumniId}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Duration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span>
                Start: {program.startDate ? formatDateTime(program.startDate) : 'Not started'}
              </span>
            </div>
            {program.endDate && (
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span>End: {formatDateTime(program.endDate)}</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Sessions</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{program.sessions?.length || 0}</p>
            <p className="text-xs text-muted-foreground">total sessions conducted</p>
          </CardContent>
        </Card>
      </div>

      {/* Goals */}
      {program.goals && program.goals.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Target className="h-4 w-4" />
              Goals
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {program.goals.map((goal, index) => (
                <li key={index} className="flex items-start gap-2 text-sm">
                  <div className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary flex-shrink-0" />
                  <span>{goal}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Sessions */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageSquare className="h-4 w-4" />
            Sessions
          </CardTitle>
          {canEdit && program.status === 'active' && (
            <Button size="sm" onClick={() => setAddSessionOpen(true)}>
              <Plus className="mr-1 h-4 w-4" />
              Add Session
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {!program.sessions || program.sessions.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No sessions conducted yet.
            </p>
          ) : (
            <div className="space-y-4">
              {program.sessions.map((session, index) => (
                <div key={session._id || index} className="border rounded-lg p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        Session {index + 1}
                      </Badge>
                      {session.duration && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {session.duration} min
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {session.date
                        ? formatDateTime(session.date)
                        : formatDateTime(session.conductedAt)}
                    </span>
                  </div>
                  {session.notes && (
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {session.notes}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Feedback */}
      {program.feedback && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Feedback</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {program.feedback.mentorRating && (
              <p className="text-sm">
                <span className="font-medium">Mentor Rating:</span> {program.feedback.mentorRating}
                /5
              </p>
            )}
            {program.feedback.menteeRating && (
              <p className="text-sm">
                <span className="font-medium">Mentee Rating:</span> {program.feedback.menteeRating}
                /5
              </p>
            )}
            {program.feedback.comments && (
              <p className="text-sm whitespace-pre-wrap">{program.feedback.comments}</p>
            )}
          </CardContent>
        </Card>
      )}

      <Separator />

      <div className="text-xs text-muted-foreground">
        Created: {new Date(program.createdAt).toLocaleString('en-IN')}
        {program.updatedAt && (
          <> | Updated: {new Date(program.updatedAt).toLocaleString('en-IN')}</>
        )}
      </div>

      {/* Add Session Dialog */}
      <Dialog open={addSessionOpen} onOpenChange={setAddSessionOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Session</DialogTitle>
            <DialogDescription>Record a new mentorship session.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Session Date *</Label>
              <Input
                type="datetime-local"
                value={sessionDate}
                onChange={(e) => setSessionDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Duration (minutes)</Label>
              <Input
                type="number"
                value={sessionDuration}
                onChange={(e) => setSessionDuration(e.target.value)}
                placeholder="e.g. 60"
              />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={sessionNotes}
                onChange={(e) => setSessionNotes(e.target.value)}
                placeholder="Session notes and discussion points..."
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddSessionOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddSession} disabled={addSessionMutation.isPending}>
              {addSessionMutation.isPending ? 'Adding...' : 'Add Session'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Mentorship Program</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this mentorship program? This action cannot be undone.
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
