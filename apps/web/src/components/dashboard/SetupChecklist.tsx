'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, ChevronDown, ListChecks, X, ArrowUpRight, Circle } from 'lucide-react';
import {
  getSetupTasks,
  SETUP_TASK_CATEGORY_LABELS,
  type SetupStatusPayload,
  type SetupTaskCategory,
  type SetupTaskDefinition,
  type SetupTaskState,
} from '@campus-verse/shared';
import { dashboardApi } from '@/lib/api';
import { useBranchStore } from '@/store/branchStore';
import { cn } from '@/lib/utils';

const COLLAPSED_KEY = 'setup-checklist:collapsed';

export function SetupChecklist() {
  const [status, setStatus] = useState<SetupStatusPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const [dismissingId, setDismissingId] = useState<string | null>(null);

  // Load persisted collapsed state once on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    setCollapsed(localStorage.getItem(COLLAPSED_KEY) === '1');
  }, []);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await dashboardApi.getSetupStatus();
      if (res?.success) setStatus(res.data as SetupStatusPayload);
    } catch {
      // Silently ignore — non-admin users get a 403 here, that's fine.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchStatus();
  }, [fetchStatus]);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        localStorage.setItem(COLLAPSED_KEY, next ? '1' : '0');
      }
      return next;
    });
  };

  const handleDismiss = async (taskId: string) => {
    setDismissingId(taskId);
    try {
      await dashboardApi.dismissSetupTask(taskId);
      await fetchStatus();
    } finally {
      setDismissingId(null);
    }
  };

  // ─── Derive grouped state ────────────────────────────────────────────
  // Task copy adapts to the branch's institution type (school/college/university).
  const getSelectedBranch = useBranchStore((state) => state.getSelectedBranch);
  const institutionType = getSelectedBranch()?.institutionType;
  const tasks = useMemo(() => getSetupTasks(institutionType), [institutionType]);

  const taskStateMap = useMemo(() => {
    const map = new Map<string, SetupTaskState>();
    if (status?.tasks) for (const t of status.tasks) map.set(t.id, t);
    return map;
  }, [status]);

  const visibleTasks = useMemo(() => {
    if (!status) return tasks;
    return tasks.filter((t) => {
      const s = taskStateMap.get(t.id);
      // Show pending always; hide done; hide dismissed (until TTL expires server-side).
      return !s || s.status === 'pending';
    });
  }, [status, taskStateMap, tasks]);

  const grouped = useMemo(() => {
    const groups = new Map<SetupTaskCategory, SetupTaskDefinition[]>();
    for (const t of visibleTasks) {
      const arr = groups.get(t.category) ?? [];
      arr.push(t);
      groups.set(t.category, arr);
    }
    return groups;
  }, [visibleTasks]);

  // ─── Hide states ─────────────────────────────────────────────────────
  if (loading || !status) return null; // wait for first load
  if (status.allRequiredDone && visibleTasks.length === 0) return null;
  if (visibleTasks.length === 0) return null;

  const totalDoneCount = tasks.filter((t) => taskStateMap.get(t.id)?.status === 'done').length;
  const totalCount = tasks.length;

  return (
    <section
      aria-label={`Finish setting up your ${institutionType || 'institution'}`}
      className={cn(
        'relative overflow-hidden rounded-2xl border bg-gradient-to-br from-primary/[0.06] via-card to-accent/[0.05] shadow-soft transition-all'
      )}
    >
      <div className="pointer-events-none absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />

      {/* Header — always visible */}
      <header className="flex items-center gap-4 px-6 py-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
          <ListChecks className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            Finish setting up
          </p>
          <p className="font-display text-base font-semibold leading-tight">
            <span className="tabular-nums">{totalDoneCount}</span>
            <span className="text-muted-foreground"> of </span>
            <span className="tabular-nums">{totalCount}</span> tasks done ·{' '}
            <span className="text-primary">{visibleTasks.length} remaining</span>
          </p>
        </div>

        {/* Compact progress on the right */}
        <div className="hidden items-center gap-3 md:flex">
          <div className="h-1.5 w-32 overflow-hidden rounded-full bg-muted/60">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all"
              style={{ width: `${status.requiredPercent}%` }}
            />
          </div>
          <span className="font-display text-lg font-bold tabular-nums text-primary">
            {status.requiredPercent}%
          </span>
        </div>

        <button
          type="button"
          onClick={toggleCollapsed}
          className="ml-2 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted/60 hover:text-foreground"
          aria-label={collapsed ? 'Expand setup tasks' : 'Collapse setup tasks'}
        >
          <ChevronDown
            className={cn('h-4 w-4 transition-transform duration-200', collapsed && '-rotate-90')}
          />
        </button>
      </header>

      {/* Body — categorised task list */}
      {!collapsed && (
        <div className="border-t border-primary/10 bg-card/40 backdrop-blur-sm">
          <div className="space-y-5 px-6 py-5">
            {Array.from(grouped.entries()).map(([category, tasks]) => (
              <div key={category}>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                  {SETUP_TASK_CATEGORY_LABELS[category]}
                </p>
                <ul className="space-y-1.5">
                  {tasks.map((task) => (
                    <li key={task.id}>
                      <div className="group relative flex items-start gap-3 rounded-xl border border-transparent bg-card/60 px-4 py-3 transition-all hover:border-primary/20 hover:bg-card hover:shadow-soft">
                        <Circle
                          className={cn(
                            'mt-0.5 h-4 w-4 shrink-0 transition-colors',
                            'text-muted-foreground/40 group-hover:text-primary'
                          )}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium leading-tight">{task.title}</p>
                            {task.required && (
                              <span className="rounded-full border border-warning/30 bg-warning/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-warning">
                                Required
                              </span>
                            )}
                          </div>
                          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                            {task.description}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Link
                            href={task.href}
                            className="inline-flex items-center gap-1 rounded-lg border border-transparent px-2.5 py-1 text-[11px] font-medium text-primary transition-all hover:bg-primary/10"
                          >
                            Set up
                            <ArrowUpRight className="h-3 w-3" />
                          </Link>
                          {!task.required && (
                            <button
                              type="button"
                              onClick={() => void handleDismiss(task.id)}
                              disabled={dismissingId === task.id}
                              aria-label={`Snooze "${task.title}"`}
                              className="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground/50 hover:bg-muted/60 hover:text-muted-foreground disabled:opacity-50"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <footer className="flex items-center justify-between gap-3 border-t border-primary/10 px-6 py-3">
            <p className="text-[11px] text-muted-foreground">
              Snoozed tasks come back in 7 days. Required tasks can&apos;t be snoozed.
            </p>
            {status.allRequiredDone && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-success">
                <CheckCircle2 className="h-3.5 w-3.5" />
                All required tasks complete
              </span>
            )}
          </footer>
        </div>
      )}
    </section>
  );
}
