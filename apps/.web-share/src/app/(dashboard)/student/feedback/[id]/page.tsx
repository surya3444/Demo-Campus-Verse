'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { feedbackApi } from '@/lib/api';
import { getErrorMessage } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Loader2, Send, Star, UserCircle } from 'lucide-react';
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

function formatDateTime(date: string | null) {
  if (!date) return '—';
  return new Date(date).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

export default function StudentFeedbackDetailPage() {
  const params = useParams();
  const queryClient = useQueryClient();
  const id = params.id as string;

  const [responseMsg, setResponseMsg] = useState('');
  const [rating, setRating] = useState(0);
  const [satisfactionComment, setSatisfactionComment] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['student-feedback-ticket', id],
    queryFn: () => feedbackApi.getTicket(id),
  });

  const responseMutation = useMutation({
    mutationFn: () => feedbackApi.addResponse(id, { message: responseMsg, isInternal: false }),
    onSuccess: () => {
      toast.success('Response sent');
      setResponseMsg('');
      queryClient.invalidateQueries({ queryKey: ['student-feedback-ticket', id] });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const satisfactionMutation = useMutation({
    mutationFn: () =>
      feedbackApi.submitSatisfaction(id, { rating, comment: satisfactionComment || undefined }),
    onSuccess: () => {
      toast.success('Thank you for your feedback!');
      queryClient.invalidateQueries({ queryKey: ['student-feedback-ticket', id] });
      queryClient.invalidateQueries({ queryKey: ['student-feedback-tickets'] });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const reopenMutation = useMutation({
    mutationFn: () => feedbackApi.updateStatus(id, { status: 'reopened' }),
    onSuccess: () => {
      toast.success('Ticket reopened');
      queryClient.invalidateQueries({ queryKey: ['student-feedback-ticket', id] });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-3xl">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  const ticket = data?.data;
  if (!ticket) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <p>Ticket not found</p>
        <Button variant="outline" className="mt-4" asChild>
          <Link href="/student/feedback">Back</Link>
        </Button>
      </div>
    );
  }

  const responses = (ticket.responses || []) as Record<string, unknown>[];

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/student/feedback">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-foreground">{ticket.subject as string}</h1>
            <Badge variant="outline" className={STATUS_STYLES[ticket.status as string] || ''}>
              {STATUS_LABELS[ticket.status as string] || ticket.status}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            <span className="font-mono">{ticket.ticketNumber as string}</span> &middot;{' '}
            <span className="capitalize">{(ticket.category as string)?.replace(/_/g, ' ')}</span>{' '}
            &middot; {formatDateTime(ticket.createdAt as string)}
          </p>
        </div>
      </div>

      {/* Description */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your Concern</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm whitespace-pre-wrap">{ticket.description as string}</p>
        </CardContent>
      </Card>

      {/* Resolution note */}
      {ticket.resolutionNote && (
        <Card className="border-success/30 bg-success/5">
          <CardHeader>
            <CardTitle className="text-base text-success">Resolution</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{ticket.resolutionNote as string}</p>
            <p className="text-xs text-muted-foreground mt-2">
              Resolved on {formatDateTime(ticket.resolvedAt as string)}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Satisfaction Survey */}
      {ticket.status === 'resolved' && !ticket.satisfaction && (
        <Card className="border-yellow-200 bg-yellow-50/50">
          <CardHeader>
            <CardTitle className="text-base">How was your experience?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button key={star} type="button" onClick={() => setRating(star)} className="p-1">
                  <Star
                    className={`h-8 w-8 transition-colors ${star <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/30'}`}
                  />
                </button>
              ))}
            </div>
            <Textarea
              placeholder="Any comments? (optional)"
              value={satisfactionComment}
              onChange={(e) => setSatisfactionComment(e.target.value)}
              rows={2}
            />
            <div className="flex items-center gap-2">
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
              <Button
                size="sm"
                variant="outline"
                onClick={() => reopenMutation.mutate()}
                disabled={reopenMutation.isPending}
              >
                Not satisfied? Reopen
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Show existing satisfaction */}
      {ticket.satisfaction && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Your Rating</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-1 mb-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  className={`h-5 w-5 ${star <= Number((ticket.satisfaction as Record<string, unknown>).rating) ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/30'}`}
                />
              ))}
            </div>
            {Boolean((ticket.satisfaction as Record<string, unknown>).comment) && (
              <p className="text-sm text-muted-foreground">
                &quot;{(ticket.satisfaction as Record<string, unknown>).comment as string}&quot;
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Conversation */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Conversation ({responses.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {responses.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No responses yet. We&apos;ll get back to you soon.
            </p>
          ) : (
            responses.map((r) => (
              <div key={r._id as string} className="p-4 rounded-lg border bg-muted/30">
                <div className="flex items-center gap-2 mb-2">
                  <UserCircle className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{r.respondedByName as string}</span>
                  <span className="text-xs text-muted-foreground ml-auto">
                    {formatDateTime(r.createdAt as string)}
                  </span>
                </div>
                <p className="text-sm whitespace-pre-wrap">{r.message as string}</p>
              </div>
            ))
          )}

          {ticket.status !== 'closed' && (
            <>
              <Separator />
              <div className="space-y-3">
                <Textarea
                  placeholder="Type your reply..."
                  value={responseMsg}
                  onChange={(e) => setResponseMsg(e.target.value)}
                  rows={3}
                />
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    disabled={!responseMsg.trim() || responseMutation.isPending}
                    onClick={() => responseMutation.mutate()}
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
    </div>
  );
}
