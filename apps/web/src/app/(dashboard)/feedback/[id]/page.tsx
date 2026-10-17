'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { feedbackApi } from '@/lib/api';
import { usePermissions } from '@/hooks/usePermissions';
import { getErrorMessage } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, Loader2, Send, Star, UserCircle, AlertTriangle, Lock } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

const STATUS_STYLES: Record<string, string> = {
  open: 'bg-info/10 text-info border-info/20',
  in_progress: 'bg-warning/10 text-warning border-warning/20',
  escalated: 'bg-destructive/10 text-destructive border-destructive/20',
  resolved: 'bg-success/10 text-success border-success/20',
  reopened: 'bg-warning/10 text-warning border-warning/20',
  closed: 'bg-muted text-muted-foreground border-muted',
};

const STATUS_LABELS: Record<string, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  escalated: 'Escalated',
  resolved: 'Resolved',
  reopened: 'Reopened',
  closed: 'Closed',
};

const PRIORITY_COLORS: Record<string, string> = {
  low: 'bg-muted text-muted-foreground',
  medium: 'bg-info/10 text-info',
  high: 'bg-warning/10 text-warning',
  urgent: 'bg-destructive/10 text-destructive',
};

function formatDateTime(date: string | null) {
  if (!date) return '—';
  return new Date(date).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

export default function FeedbackDetailPage() {
  const params = useParams();
  const { hasPermission } = usePermissions();
  const queryClient = useQueryClient();
  const id = params.id as string;

  const [newStatus, setNewStatus] = useState('');
  const [resolutionNote, setResolutionNote] = useState('');
  const [responseMsg, setResponseMsg] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [assignTo, setAssignTo] = useState('');
  const [assignToName, setAssignToName] = useState('');
  const [rating, setRating] = useState(0);
  const [satisfactionComment, setSatisfactionComment] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['feedback-ticket', id],
    queryFn: () => feedbackApi.getTicket(id),
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['feedback-ticket', id] });
    queryClient.invalidateQueries({ queryKey: ['feedback-tickets'] });
    queryClient.invalidateQueries({ queryKey: ['feedback-stats'] });
  };

  const statusMutation = useMutation({
    mutationFn: () =>
      feedbackApi.updateStatus(id, {
        status: newStatus,
        resolutionNote: resolutionNote || undefined,
      }),
    onSuccess: () => {
      toast.success('Status updated');
      setNewStatus('');
      setResolutionNote('');
      invalidateAll();
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const escalateMutation = useMutation({
    mutationFn: () => feedbackApi.escalateTicket(id),
    onSuccess: () => {
      toast.success('Ticket escalated');
      invalidateAll();
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const responseMutation = useMutation({
    mutationFn: () => feedbackApi.addResponse(id, { message: responseMsg, isInternal }),
    onSuccess: () => {
      toast.success('Response added');
      setResponseMsg('');
      setIsInternal(false);
      invalidateAll();
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const assignMutation = useMutation({
    mutationFn: () =>
      feedbackApi.assignTicket(id, { assignedTo: assignTo, assignedToName: assignToName }),
    onSuccess: () => {
      toast.success('Ticket assigned');
      setAssignTo('');
      setAssignToName('');
      invalidateAll();
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const satisfactionMutation = useMutation({
    mutationFn: () =>
      feedbackApi.submitSatisfaction(id, { rating, comment: satisfactionComment || undefined }),
    onSuccess: () => {
      toast.success('Thank you for your feedback!');
      invalidateAll();
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="h-96 lg:col-span-2" />
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  const ticket = data?.data;
  if (!ticket) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <p className="text-lg">Ticket not found</p>
        <Button variant="outline" className="mt-4" asChild>
          <Link href="/feedback">Back to Tickets</Link>
        </Button>
      </div>
    );
  }

  const canManage = hasPermission('feedback.tickets', 'assign');
  const responses = (ticket.responses || []) as Record<string, unknown>[];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/feedback">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-foreground">{ticket.subject}</h1>
              <Badge variant="outline" className={STATUS_STYLES[ticket.status as string] || ''}>
                {STATUS_LABELS[ticket.status as string] || ticket.status}
              </Badge>
              <Badge variant="outline" className={PRIORITY_COLORS[ticket.priority as string] || ''}>
                {(ticket.priority as string)?.charAt(0).toUpperCase() +
                  (ticket.priority as string)?.slice(1)}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              <span className="font-mono">{ticket.ticketNumber}</span> &middot;{' '}
              {ticket.submitterName as string}
              {ticket.isAnonymous && (
                <span className="ml-1 text-xs">(anonymous)</span>
              )} &middot;{' '}
              <span className="capitalize">{(ticket.category as string)?.replace(/_/g, ' ')}</span>
            </p>
          </div>
        </div>

        {/* Admin quick actions */}
        {canManage && ticket.status !== 'closed' && (
          <div className="flex items-center gap-2">
            {['open', 'in_progress', 'reopened'].includes(ticket.status as string) && (
              <Button
                variant="outline"
                size="sm"
                className="text-destructive border-destructive/30"
                onClick={() => escalateMutation.mutate()}
                disabled={escalateMutation.isPending}
              >
                <AlertTriangle className="h-4 w-4 mr-1" />
                Escalate
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Description */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Description</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-wrap">{ticket.description as string}</p>
            </CardContent>
          </Card>

          {/* Conversation Thread */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Conversation ({responses.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {responses.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No responses yet</p>
              ) : (
                responses.map((r) => (
                  <div
                    key={r._id as string}
                    className={`p-4 rounded-lg border ${
                      r.isInternal ? 'bg-warning/5 border-warning/20' : 'bg-muted/30'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <UserCircle className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">{r.respondedByName as string}</span>
                      {(r.isInternal as boolean) && (
                        <Badge
                          variant="outline"
                          className="text-xs bg-warning/10 text-warning border-warning/20"
                        >
                          <Lock className="h-3 w-3 mr-1" /> Internal Note
                        </Badge>
                      )}
                      <span className="text-xs text-muted-foreground ml-auto">
                        {formatDateTime(r.createdAt as string)}
                      </span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{r.message as string}</p>
                  </div>
                ))
              )}

              {/* Add Response */}
              {ticket.status !== 'closed' && (
                <>
                  <Separator />
                  <div className="space-y-3">
                    <Textarea
                      placeholder="Type your response..."
                      value={responseMsg}
                      onChange={(e) => setResponseMsg(e.target.value)}
                      rows={3}
                    />
                    <div className="flex items-center justify-between">
                      {canManage && (
                        <div className="flex items-center gap-2">
                          <Switch checked={isInternal} onCheckedChange={setIsInternal} />
                          <Label className="text-sm text-muted-foreground">Internal note</Label>
                        </div>
                      )}
                      <Button
                        size="sm"
                        disabled={!responseMsg.trim() || responseMutation.isPending}
                        onClick={() => responseMutation.mutate()}
                        className="ml-auto"
                      >
                        {responseMutation.isPending ? (
                          <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                        ) : (
                          <Send className="h-4 w-4 mr-1" />
                        )}
                        Send
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Satisfaction Survey */}
          {ticket.status === 'resolved' && !ticket.satisfaction && (
            <Card className="border-success/30 bg-success/5">
              <CardHeader>
                <CardTitle className="text-base">Rate Your Experience</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      className="p-1"
                    >
                      <Star
                        className={`h-8 w-8 transition-colors ${
                          star <= rating
                            ? 'fill-yellow-400 text-yellow-400'
                            : 'text-muted-foreground/30'
                        }`}
                      />
                    </button>
                  ))}
                </div>
                <Textarea
                  placeholder="Optional comment..."
                  value={satisfactionComment}
                  onChange={(e) => setSatisfactionComment(e.target.value)}
                  rows={2}
                />
                <Button
                  size="sm"
                  disabled={rating === 0 || satisfactionMutation.isPending}
                  onClick={() => satisfactionMutation.mutate()}
                >
                  {satisfactionMutation.isPending && (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  )}
                  Submit Rating
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Show existing satisfaction */}
          {ticket.satisfaction && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Satisfaction Rating</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-1 mb-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={`h-5 w-5 ${
                        star <= Number((ticket.satisfaction as Record<string, unknown>).rating)
                          ? 'fill-yellow-400 text-yellow-400'
                          : 'text-muted-foreground/30'
                      }`}
                    />
                  ))}
                  <span className="text-sm text-muted-foreground ml-2">
                    {(ticket.satisfaction as Record<string, unknown>).rating as number}/5
                  </span>
                </div>
                {Boolean((ticket.satisfaction as Record<string, unknown>).comment) && (
                  <p className="text-sm text-muted-foreground">
                    &quot;{(ticket.satisfaction as Record<string, unknown>).comment as string}&quot;
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Status Management */}
          {canManage && ticket.status !== 'closed' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Update Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Select value={newStatus} onValueChange={setNewStatus}>
                  <SelectTrigger>
                    <SelectValue placeholder="Change status" />
                  </SelectTrigger>
                  <SelectContent>
                    {ticket.status === 'open' && (
                      <SelectItem value="in_progress">In Progress</SelectItem>
                    )}
                    {['in_progress', 'escalated'].includes(ticket.status as string) && (
                      <SelectItem value="resolved">Resolved</SelectItem>
                    )}
                    {ticket.status === 'resolved' && <SelectItem value="closed">Close</SelectItem>}
                    {ticket.status === 'resolved' && (
                      <SelectItem value="reopened">Reopen</SelectItem>
                    )}
                    {ticket.status !== 'resolved' && <SelectItem value="closed">Close</SelectItem>}
                  </SelectContent>
                </Select>
                {newStatus === 'resolved' && (
                  <Textarea
                    placeholder="Resolution note..."
                    value={resolutionNote}
                    onChange={(e) => setResolutionNote(e.target.value)}
                    rows={3}
                  />
                )}
                <Button
                  size="sm"
                  className="w-full"
                  disabled={!newStatus || statusMutation.isPending}
                  onClick={() => statusMutation.mutate()}
                >
                  {statusMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                  Update Status
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Assignment */}
          {canManage && ticket.status !== 'closed' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Assignment</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {ticket.assignedToName && (
                  <p className="text-sm">
                    <span className="text-muted-foreground">Currently assigned to:</span>{' '}
                    <span className="font-medium">{ticket.assignedToName as string}</span>
                  </p>
                )}
                <Input
                  placeholder="Staff name"
                  value={assignToName}
                  onChange={(e) => setAssignToName(e.target.value)}
                />
                <Input
                  placeholder="Staff user ID"
                  value={assignTo}
                  onChange={(e) => setAssignTo(e.target.value)}
                />
                <Button
                  size="sm"
                  className="w-full"
                  variant="outline"
                  disabled={!assignTo || !assignToName || assignMutation.isPending}
                  onClick={() => assignMutation.mutate()}
                >
                  {assignMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                  Assign
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Ticket</span>
                <span className="font-mono">{ticket.ticketNumber as string}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Submitted</span>
                <span>{formatDateTime(ticket.createdAt as string)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Type</span>
                <span className="capitalize">{ticket.submitterType as string}</span>
              </div>
              {ticket.resolvedAt && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Resolved</span>
                  <span>{formatDateTime(ticket.resolvedAt as string)}</span>
                </div>
              )}
              {ticket.resolutionNote && (
                <div>
                  <span className="text-muted-foreground">Resolution Note</span>
                  <p className="mt-1">{ticket.resolutionNote as string}</p>
                </div>
              )}
              {ticket.closedAt && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Closed</span>
                  <span>{formatDateTime(ticket.closedAt as string)}</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
