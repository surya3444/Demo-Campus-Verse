'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Megaphone, Pin, ArrowUpRight } from 'lucide-react';
import { communicationsApi } from '@/lib/api';
import { usePermissions } from '@/hooks/usePermissions';
import Link from 'next/link';

interface Announcement {
  _id: string;
  title: string;
  content: string;
  type: 'general' | 'urgent' | 'event' | 'holiday';
  priority: 'low' | 'medium' | 'high';
  isPinned: boolean;
  publishAt?: string;
  createdAt: string;
}

const TYPE_RAIL: Record<Announcement['type'], string> = {
  urgent: 'bg-destructive',
  event: 'bg-info',
  holiday: 'bg-success',
  general: 'bg-primary/50',
};

const TYPE_LABEL: Record<Announcement['type'], string> = {
  urgent: 'Urgent',
  event: 'Event',
  holiday: 'Holiday',
  general: 'Notice',
};

function noticeDate(a: Announcement) {
  return new Date(a.publishAt || a.createdAt).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
  });
}

/**
 * Published announcements for the current branch — pinned first.
 * Hides itself when the user can't view announcements (request fails).
 */
export function NoticeboardCard({ viewAllHref }: { viewAllHref?: string }) {
  const [reading, setReading] = useState<Announcement | null>(null);
  const { hasPermission } = usePermissions();
  const canView = hasPermission('communications.announcements', 'view');

  const { data, isLoading, error } = useQuery<{ success: boolean; data: Announcement[] }>({
    queryKey: ['dashboard-noticeboard'],
    queryFn: () => communicationsApi.getAnnouncements({ status: 'published', limit: 6 }),
    staleTime: 2 * 60 * 1000,
    retry: false,
    enabled: canView,
  });

  if (!canView || error) return null;

  const notices = [...(data?.data || [])].sort((a, b) => Number(b.isPinned) - Number(a.isPinned));

  return (
    <section className="rounded-2xl border bg-card shadow-xs">
      <header className="flex items-center justify-between border-b px-6 py-4">
        <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
          <Megaphone className="h-3.5 w-3.5 text-primary" />
          Noticeboard
        </div>
        {viewAllHref && (
          <Link
            href={viewAllHref}
            className="flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            View all <ArrowUpRight className="h-3 w-3" />
          </Link>
        )}
      </header>

      <div className="px-3 py-2">
        {isLoading ? (
          <div className="space-y-2 p-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : notices.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Nothing on the board right now.
          </p>
        ) : (
          <ul className="divide-y divide-border/60">
            {notices.map((notice) => (
              <li key={notice._id}>
                <button
                  type="button"
                  onClick={() => setReading(notice)}
                  className="group flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition-colors hover:bg-muted/40"
                >
                  <span className={`h-9 w-1 shrink-0 rounded-full ${TYPE_RAIL[notice.type]}`} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      {notice.isPinned && <Pin className="h-3 w-3 shrink-0 text-warning" />}
                      <span className="truncate text-sm font-medium group-hover:text-primary">
                        {notice.title}
                      </span>
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                      {notice.content}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block font-mono text-[11px] text-muted-foreground">
                      {noticeDate(notice)}
                    </span>
                    {(notice.type === 'urgent' || notice.priority === 'high') && (
                      <Badge variant="destructive" className="mt-1 h-4 px-1.5 text-[10px]">
                        {notice.type === 'urgent' ? 'Urgent' : 'High'}
                      </Badge>
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Dialog open={!!reading} onOpenChange={(open) => !open && setReading(null)}>
        <DialogContent className="max-w-lg">
          {reading && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
                    {TYPE_LABEL[reading.type]}
                  </Badge>
                  <span className="font-mono text-xs text-muted-foreground">
                    {noticeDate(reading)}
                  </span>
                </div>
                <DialogTitle className="text-left">{reading.title}</DialogTitle>
                <DialogDescription className="sr-only">Announcement details</DialogDescription>
              </DialogHeader>
              <p className="max-h-[50vh] overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
                {reading.content}
              </p>
            </>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
