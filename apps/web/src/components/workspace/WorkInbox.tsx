'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { AlarmClock, ChevronRight, ClipboardList, Inbox, RotateCcw, Sparkles, type LucideIcon } from 'lucide-react';
import { workspaceApi } from '@/lib/api';
import { usePermissions } from '@/hooks/usePermissions';

/** What's waiting on the signed-in person — drives the top-bar bell. */
export function useWorkSummary() {
  const { hasPermission } = usePermissions();
  const on = hasPermission('workspace.tasks', 'view') || hasPermission('workspace.issues', 'view');
  const q = useQuery({
    queryKey: ['workspace', 'summary'],
    queryFn: workspaceApi.summary,
    enabled: on,
    refetchInterval: 60_000,
  });
  const s = q.data;
  const items: Array<{ icon: LucideIcon; tone: string; title: string; hint: string; href: string; n: number }> = s
    ? [
        { icon: AlarmClock, tone: 'bg-rose-100 text-rose-700', title: 'Issues past their response time', hint: 'They’ll move up the chain soon', href: '/issues?view=assigned', n: s.issues.breached },
        { icon: Inbox, tone: 'bg-amber-100 text-amber-700', title: 'Issues waiting on you', hint: 'Raised to you by your team', href: '/issues?view=assigned', n: s.issues.assigned - s.issues.breached },
        { icon: RotateCcw, tone: 'bg-violet-100 text-violet-700', title: 'Tasks to review', hint: 'Finished work waiting for your sign-off', href: '/work?view=assigned', n: s.tasks.toReview },
        { icon: AlarmClock, tone: 'bg-rose-100 text-rose-700', title: 'Your overdue tasks', hint: 'Past their due date', href: '/work', n: s.tasks.overdue },
        { icon: ClipboardList, tone: 'bg-sky-100 text-sky-700', title: 'Open tasks for you', hint: 'Assigned by your leads', href: '/work', n: s.tasks.mine - s.tasks.overdue },
      ].filter((i) => i.n > 0)
    : [];
  return { items, count: items.reduce((n, i) => n + i.n, 0) };
}

export function WorkInbox({ items, onNavigate }: { items: ReturnType<typeof useWorkSummary>['items']; onNavigate: () => void }) {
  if (!items.length)
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted/50">
          <Sparkles className="h-5 w-5 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium text-foreground">All caught up!</p>
        <p className="mt-1 text-xs text-muted-foreground">Nothing waiting on you</p>
      </div>
    );
  return (
    <ul className="space-y-1">
      {items.map((i) => (
        <li key={i.title}>
          <Link href={i.href} onClick={onNavigate} className="group flex items-center gap-3 rounded-lg p-2.5 transition-colors hover:bg-muted/60">
            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${i.tone}`}>
              <i.icon className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-foreground">{i.title}</span>
              <span className="block truncate text-xs text-muted-foreground">{i.hint}</span>
            </span>
            <span className="rounded-full bg-foreground px-2 py-0.5 text-xs font-bold tabular-nums text-background">{i.n}</span>
            <ChevronRight className="h-4 w-4 text-muted-foreground transition group-hover:translate-x-0.5" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
