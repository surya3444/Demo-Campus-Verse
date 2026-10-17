'use client';

import { useQuery } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui/skeleton';
import { CalendarDays, ArrowUpRight, Hourglass } from 'lucide-react';
import { communicationsApi, hrApi } from '@/lib/api';
import { usePermissions } from '@/hooks/usePermissions';
import Link from 'next/link';

interface UpcomingEvent {
  _id: string;
  title: string;
  type?: string;
  startDate: string;
  isAllDay?: boolean;
  startTime?: string;
  location?: string;
}

/**
 * Upcoming events + (for approvers) pending leave approvals.
 * The "what's next" panel for management staff.
 */
export function UpcomingEventsCard({ calendarHref }: { calendarHref?: string }) {
  const { hasPermission } = usePermissions();
  const canApproveLeaves = hasPermission('hr.leaves', 'approve');
  const canViewCalendar = hasPermission('communications.calendar', 'view');

  const { data, isLoading, error } = useQuery<{ success: boolean; data: UpcomingEvent[] }>({
    queryKey: ['dashboard-upcoming-events'],
    queryFn: () => communicationsApi.getUpcomingEvents(),
    staleTime: 5 * 60 * 1000,
    retry: false,
    enabled: canViewCalendar,
  });

  const { data: approvalsData } = useQuery<{
    success: boolean;
    data: unknown[];
    meta?: { total?: number };
  }>({
    queryKey: ['dashboard-pending-leave-approvals'],
    queryFn: () => hrApi.getPendingApprovals({ limit: 1 }),
    staleTime: 2 * 60 * 1000,
    retry: false,
    enabled: canApproveLeaves,
  });

  const events = (data?.data || []).slice(0, 5);
  const pendingApprovals = approvalsData?.meta?.total ?? 0;

  // Nothing to show and nothing to act on → stay out of the way
  if (error || (!canViewCalendar && pendingApprovals === 0)) return null;

  return (
    <section className="rounded-2xl border bg-card shadow-xs">
      <header className="flex items-center justify-between border-b px-6 py-4">
        <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
          <CalendarDays className="h-3.5 w-3.5 text-info" />
          Coming up
        </div>
        {calendarHref && (
          <Link
            href={calendarHref}
            className="flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Calendar <ArrowUpRight className="h-3 w-3" />
          </Link>
        )}
      </header>

      <div className="px-6 py-3">
        {canApproveLeaves && pendingApprovals > 0 && (
          <Link
            href="/hr/approvals"
            className="mb-2 flex items-center gap-2.5 rounded-lg border border-warning/25 bg-warning/10 px-3 py-2.5 text-sm transition-colors hover:bg-warning/15"
          >
            <Hourglass className="h-4 w-4 shrink-0 text-warning" />
            <span className="flex-1 font-medium">
              {pendingApprovals} leave request{pendingApprovals > 1 ? 's' : ''} awaiting your
              approval
            </span>
            <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground" />
          </Link>
        )}

        {isLoading ? (
          <div className="space-y-2 py-1">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : events.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No upcoming events on the calendar.
          </p>
        ) : (
          <ul className="divide-y divide-border/60">
            {events.map((event) => {
              const date = new Date(event.startDate);
              return (
                <li key={event._id} className="flex items-center gap-3 py-2.5">
                  <div className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-lg border bg-muted/40">
                    <span className="font-mono text-sm font-bold leading-none tabular-nums">
                      {date.getDate()}
                    </span>
                    <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {date.toLocaleDateString('en-IN', { month: 'short' })}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{event.title}</p>
                    <p className="text-xs capitalize text-muted-foreground">
                      {event.type || 'event'}
                      {!event.isAllDay && event.startTime ? ` · ${event.startTime}` : ''}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
