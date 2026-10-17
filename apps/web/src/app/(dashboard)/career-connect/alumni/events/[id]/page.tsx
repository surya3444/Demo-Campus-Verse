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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
  CalendarDays,
  MapPin,
  Users,
  Clock,
  CheckCircle2,
  XCircle,
  Send,
  Trash2,
  Mic,
  ExternalLink,
  Globe,
} from 'lucide-react';
import { toast } from 'sonner';

const statusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-800',
  published: 'bg-green-100 text-green-800',
  completed: 'bg-blue-100 text-blue-800',
  cancelled: 'bg-red-100 text-red-800',
};

const typeLabels: Record<string, string> = {
  reunion: 'Reunion',
  workshop: 'Workshop',
  guest_lecture: 'Guest Lecture',
  networking: 'Networking',
  career_fair: 'Career Fair',
};

const typeColors: Record<string, string> = {
  reunion: 'bg-purple-100 text-purple-800',
  workshop: 'bg-blue-100 text-blue-800',
  guest_lecture: 'bg-teal-100 text-teal-800',
  networking: 'bg-orange-100 text-orange-800',
  career_fair: 'bg-indigo-100 text-indigo-800',
};

interface Registration {
  userId: string;
  userName: string;
  registeredAt: string;
}

interface Speaker {
  name: string;
  designation?: string;
  company?: string;
}

interface AlumniEventDetail {
  _id: string;
  eventNumber?: string;
  title: string;
  type: string;
  description?: string;
  eventDate: string;
  endDate?: string;
  venue?: string;
  isVirtual?: boolean;
  virtualLink?: string;
  status: string;
  speakers: Speaker[];
  registrations: Registration[];
  maxCapacity?: number;
  createdBy: string;
  createdAt: string;
  updatedAt?: string;
}

export default function AlumniEventDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const id = params.id as string;

  const canEdit = hasPermission('careerConnect.alumni', 'edit');
  const canDelete = hasPermission('careerConnect.alumni', 'delete');

  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['alumni-event', id],
    queryFn: () => careerConnectApi.getAlumniEvent(id),
  });

  const statusMutation = useMutation({
    mutationFn: (status: string) => careerConnectApi.updateAlumniEventStatus(id, { status }),
    onSuccess: () => {
      toast.success('Event status updated successfully');
      queryClient.invalidateQueries({ queryKey: ['alumni-event', id] });
      queryClient.invalidateQueries({ queryKey: ['alumni-events'] });
    },
    onError: (error: Error & { response?: { data?: { error?: { message?: string } } } }) => {
      toast.error(error.response?.data?.error?.message || 'Failed to update event status');
    },
  });

  const registerMutation = useMutation({
    mutationFn: () => careerConnectApi.registerForAlumniEvent(id),
    onSuccess: () => {
      toast.success('Registered successfully');
      queryClient.invalidateQueries({ queryKey: ['alumni-event', id] });
    },
    onError: (error: Error & { response?: { data?: { error?: { message?: string } } } }) => {
      toast.error(error.response?.data?.error?.message || 'Failed to register');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => careerConnectApi.deleteAlumniEvent(id),
    onSuccess: () => {
      toast.success('Event deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['alumni-events'] });
      router.push('/career-connect/alumni/events');
    },
    onError: (error: Error & { response?: { data?: { error?: { message?: string } } } }) => {
      toast.error(error.response?.data?.error?.message || 'Failed to delete event');
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

  const event: AlumniEventDetail | undefined = data?.data;

  if (!event) {
    return (
      <div className="text-center py-12">
        <CalendarDays className="mx-auto h-12 w-12 text-muted-foreground/50" />
        <h3 className="mt-4 text-lg font-medium">Event not found</h3>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => router.push('/career-connect/alumni/events')}
        >
          Back to Events
        </Button>
      </div>
    );
  }

  const isFull = event.maxCapacity
    ? (event.registrations?.length || 0) >= event.maxCapacity
    : false;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight">{event.title}</h1>
              <Badge variant="secondary" className={statusColors[event.status] || ''}>
                {event.status}
              </Badge>
              <Badge variant="secondary" className={typeColors[event.type] || ''}>
                {typeLabels[event.type] || event.type}
              </Badge>
            </div>
            <p className="text-muted-foreground">
              {event.eventNumber || `Event ${event._id.slice(-6).toUpperCase()}`}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {event.status === 'published' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => registerMutation.mutate()}
              disabled={registerMutation.isPending || isFull}
            >
              <Send className="mr-2 h-4 w-4" />
              {isFull ? 'Event Full' : registerMutation.isPending ? 'Registering...' : 'Register'}
            </Button>
          )}
          {canEdit && event.status === 'draft' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => statusMutation.mutate('published')}
              disabled={statusMutation.isPending}
            >
              <Send className="mr-2 h-4 w-4" />
              Publish
            </Button>
          )}
          {canEdit && event.status === 'published' && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => statusMutation.mutate('completed')}
                disabled={statusMutation.isPending}
              >
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Complete
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => statusMutation.mutate('cancelled')}
                disabled={statusMutation.isPending}
              >
                <XCircle className="mr-2 h-4 w-4" />
                Cancel
              </Button>
            </>
          )}
          {canDelete && event.status === 'draft' && (
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
            <CardTitle className="text-sm font-medium text-muted-foreground">Date & Time</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
              <span>
                {new Date(event.eventDate).toLocaleDateString('en-IN', {
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
                {new Date(event.eventDate).toLocaleTimeString('en-IN', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
                {event.endDate && (
                  <>
                    {' - '}
                    {new Date(event.endDate).toLocaleTimeString('en-IN', {
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
            <CardTitle className="text-sm font-medium text-muted-foreground">Venue</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {event.isVirtual ? (
              <>
                <div className="flex items-center gap-2 text-sm">
                  <Globe className="h-4 w-4 text-muted-foreground" />
                  <span>Virtual Event</span>
                </div>
                {event.virtualLink && (
                  <a
                    href={event.virtualLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-sm text-blue-600 hover:underline"
                  >
                    Join Meeting <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </>
            ) : (
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span>{event.venue || 'To be announced'}</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Registrations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-2xl font-bold">{event.registrations?.length || 0}</span>
              {event.maxCapacity && (
                <span className="text-sm text-muted-foreground">/ {event.maxCapacity}</span>
              )}
            </div>
            {isFull && <p className="text-xs text-orange-600 mt-1">Event is at full capacity</p>}
          </CardContent>
        </Card>
      </div>

      {/* Description */}
      {event.description && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Description</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{event.description}</p>
          </CardContent>
        </Card>
      )}

      {/* Speakers */}
      {event.speakers && event.speakers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Mic className="h-4 w-4" />
              Speakers ({event.speakers.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {event.speakers.map((speaker, index) => (
                <div key={index} className="border rounded-lg p-4 space-y-1">
                  <h4 className="font-medium">{speaker.name}</h4>
                  {speaker.designation && (
                    <p className="text-sm text-muted-foreground">{speaker.designation}</p>
                  )}
                  {speaker.company && (
                    <p className="text-xs text-muted-foreground">{speaker.company}</p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Registrations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4" />
            Registrations ({event.registrations?.length || 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!event.registrations || event.registrations.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No registrations yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Registered At</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {event.registrations.map((reg, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{reg.userName || '-'}</TableCell>
                    <TableCell>
                      {new Date(reg.registeredAt).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
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
        Created: {new Date(event.createdAt).toLocaleString('en-IN')}
        {event.updatedAt && <> | Updated: {new Date(event.updatedAt).toLocaleString('en-IN')}</>}
      </div>

      {/* Delete Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Event</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this event? This action cannot be undone.
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
