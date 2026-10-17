'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { feedbackApi } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { MessageCircleWarning, Plus, Eye, Star } from 'lucide-react';
import Link from 'next/link';

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

function formatDate(date: string) {
  return new Date(date).toLocaleDateString('en-IN', { dateStyle: 'medium' });
}

export default function StudentFeedbackPage() {
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['student-feedback-tickets', page],
    queryFn: () => feedbackApi.getTickets({ page, limit: 20 }),
  });

  const tickets = data?.data || [];
  const meta = data?.meta;

  // Check if any ticket needs satisfaction rating
  const needsRating = tickets.some(
    (t: Record<string, unknown>) => t.status === 'resolved' && !t.satisfaction
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">My Concerns</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track your submitted concerns and feedback
          </p>
        </div>
        <Button asChild>
          <Link href="/student/feedback/new">
            <Plus className="h-4 w-4 mr-2" />
            Submit Concern
          </Link>
        </Button>
      </div>

      {/* Rating reminder banner */}
      {needsRating && (
        <Card className="border-success/30 bg-success/5">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Star className="h-5 w-5 text-yellow-500" />
              <div>
                <p className="font-medium text-sm">
                  You have resolved tickets awaiting your feedback
                </p>
                <p className="text-xs text-muted-foreground">
                  Please rate your experience to help us improve
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tickets List */}
      {isLoading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : tickets.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <MessageCircleWarning className="h-12 w-12 mb-4 opacity-40" />
            <p className="text-lg font-medium">No concerns submitted yet</p>
            <p className="text-sm mb-4">Have a concern? Let us know.</p>
            <Button asChild>
              <Link href="/student/feedback/new">
                <Plus className="h-4 w-4 mr-2" />
                Submit Concern
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {tickets.map((ticket: Record<string, unknown>) => (
            <Card key={ticket._id as string} className="hover:shadow-sm transition-shadow">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-xs text-primary">
                        {ticket.ticketNumber as string}
                      </span>
                      <Badge
                        variant="outline"
                        className={STATUS_STYLES[ticket.status as string] || ''}
                      >
                        {STATUS_LABELS[ticket.status as string] || (ticket.status as string)}
                      </Badge>
                      {ticket.status === 'resolved' && !ticket.satisfaction && (
                        <Badge
                          variant="outline"
                          className="bg-yellow-50 text-yellow-700 border-yellow-200"
                        >
                          <Star className="h-3 w-3 mr-1" /> Rate
                        </Badge>
                      )}
                    </div>
                    <Link
                      href={`/student/feedback/${ticket._id}`}
                      className="font-medium text-foreground hover:text-primary transition-colors"
                    >
                      {ticket.subject as string}
                    </Link>
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-1">
                      {ticket.description as string}
                    </p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                      <span className="capitalize">
                        {(ticket.category as string)?.replace(/_/g, ' ')}
                      </span>
                      <span>&middot;</span>
                      <span>{formatDate(ticket.createdAt as string)}</span>
                      {(ticket.responses as unknown[])?.length > 0 && (
                        <>
                          <span>&middot;</span>
                          <span>{(ticket.responses as unknown[]).length} response(s)</span>
                        </>
                      )}
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" asChild>
                    <Link href={`/student/feedback/${ticket._id}`}>
                      <Eye className="h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}

          {meta && meta.totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {page} of {meta.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={!meta.hasMore}
                onClick={() => setPage(page + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
