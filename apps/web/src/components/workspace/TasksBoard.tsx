'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  AlarmClock,
  ArrowRight,
  Check,
  CheckCircle2,
  CircleDot,
  ClipboardList,
  ListChecks,
  Loader2,
  Plus,
  RotateCcw,
  Search,
  Send,
  Sparkles,
  X,
} from 'lucide-react';
import { workspaceApi, type TaskPriority, type TaskStatus, type WorkPerson, type WorkTask } from '@/lib/api';
import { usePermissions } from '@/hooks/usePermissions';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Avatar, Chip, PersonLine, PRIORITY, PriorityChip, Stat, TASK_STATUS, Timeline, dueLabel } from './kit';

type Scope = 'mine' | 'assigned' | 'team';
const COLUMNS: TaskStatus[] = ['todo', 'in_progress', 'in_review', 'done'];
const errMsg = (e: unknown) =>
  (e as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ?? 'Something went wrong';

export function TasksBoard() {
  const { hasPermission } = usePermissions();
  const canAssign = hasPermission('workspace.tasks', 'assign');
  const [scope, setScope] = useState<Scope>('mine');
  const [search, setSearch] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [onlyOverdue, setOnlyOverdue] = useState(false);

  // Deep links from the bell: /work?view=assigned, /work?task=<id>
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const v = p.get('view') as Scope | null;
    if (v && ['mine', 'assigned', 'team'].includes(v)) setScope(v);
    if (p.get('task')) setOpenId(p.get('task'));
  }, []);

  const q = useQuery({ queryKey: ['workspace', 'tasks', scope], queryFn: () => workspaceApi.tasks(scope) });
  const all = useMemo(() => q.data ?? [], [q.data]);
  const needle = search.trim().toLowerCase();
  const shown = all.filter(
    (t) =>
      (!onlyOverdue || t.overdue) &&
      (!needle || `${t.number} ${t.title} ${t.assignee.name} ${t.assignedBy.name}`.toLowerCase().includes(needle))
  );
  const by = (s: TaskStatus) => shown.filter((t) => t.status === s);
  const weekAgo = Date.now() - 7 * 864e5;
  const stats = {
    open: all.filter((t) => t.status === 'todo' || t.status === 'in_progress').length,
    review: all.filter((t) => t.status === 'in_review').length,
    overdue: all.filter((t) => t.overdue).length,
    done: all.filter((t) => t.status === 'done' && t.completedAt && new Date(t.completedAt).getTime() > weekAgo).length,
  };

  const tabs: Array<{ key: Scope; label: string }> = [
    { key: 'mine', label: 'Assigned to me' },
    ...(canAssign
      ? ([
          { key: 'assigned', label: 'I assigned' },
          { key: 'team', label: 'My team' },
        ] as const)
      : []),
  ];

  return (
    <div className="space-y-6">
      <header className="relative overflow-hidden rounded-3xl border bg-card p-6 md:p-8 animate-fade-in">
        <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-[hsl(var(--brand-cyan))]/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-28 left-1/3 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative flex flex-wrap items-end justify-between gap-5">
          <div className="space-y-2">
            <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              <ClipboardList className="h-3.5 w-3.5 text-[hsl(var(--brand-cyan))]" />
              My Workspace · Tasks
            </p>
            <h1 className="font-display text-3xl font-bold leading-tight tracking-tight md:text-4xl">
              {scope === 'mine' ? 'Your work' : scope === 'assigned' ? 'Work you handed out' : 'Your team’s work'}
            </h1>
            <p className="max-w-xl text-muted-foreground">
              {canAssign
                ? 'Hand work down to the people you lead, follow it as it moves, and sign it off when it’s done.'
                : 'Everything your leads have asked of you, in one place. Update it as you go — they see it live.'}
            </p>
          </div>
          {canAssign && (
            <button
              onClick={() => setCreating(true)}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:-translate-y-px hover:shadow-lg"
            >
              <Plus className="h-4 w-4" />
              Assign work
            </button>
          )}
        </div>
        <div className="relative mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat icon={CircleDot} label="Open" value={stats.open} tone="bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300" />
          <Stat icon={RotateCcw} label={scope === 'mine' ? 'Waiting on review' : 'Need your review'} value={stats.review} tone="bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300" />
          <Stat
            icon={AlarmClock}
            label="Overdue"
            value={stats.overdue}
            tone="bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300"
            onClick={() => setOnlyOverdue((v) => !v)}
            active={onlyOverdue}
          />
          <Stat icon={CheckCircle2} label="Done this week" value={stats.done} tone="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" />
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        {tabs.length > 1 && (
          <div className="inline-flex rounded-full border bg-card p-1">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setScope(t.key)}
                className={cn(
                  'rounded-full px-4 py-1.5 text-sm font-medium transition',
                  scope === t.key ? 'bg-primary text-primary-foreground shadow' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}
        <label className="relative ml-auto w-full max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tasks or people"
            className="h-10 w-full rounded-full border bg-card pl-9 pr-3 text-sm outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/15"
          />
        </label>
      </div>

      {q.isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {COLUMNS.map((c) => (
            <div key={c} className="h-64 animate-pulse rounded-2xl bg-muted/50" />
          ))}
        </div>
      ) : all.length === 0 ? (
        <Empty canAssign={canAssign && scope !== 'mine'} onAssign={() => setCreating(true)} mine={scope === 'mine'} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {COLUMNS.map((col) => {
            const m = TASK_STATUS[col];
            const items = by(col);
            return (
              <section key={col} className="flex min-h-[200px] flex-col rounded-2xl bg-muted/40 p-2.5">
                <h2 className="flex items-center gap-2 px-2 pb-2.5 pt-1 text-sm font-semibold">
                  <m.icon className={cn('h-4 w-4', m.tone)} />
                  {m.label}
                  <span className="ml-auto rounded-full bg-background px-2 text-xs tabular-nums text-muted-foreground">{items.length}</span>
                </h2>
                <div className="space-y-2.5">
                  {items.map((t, i) => (
                    <TaskCard key={t._id} t={t} scope={scope} index={i} onOpen={() => setOpenId(t._id)} />
                  ))}
                  {!items.length && <p className="px-2 py-6 text-center text-xs text-muted-foreground">Nothing here</p>}
                </div>
              </section>
            );
          })}
        </div>
      )}

      <TaskSheet id={openId} onClose={() => setOpenId(null)} />
      {canAssign && <NewTaskDialog open={creating} onClose={() => setCreating(false)} onCreated={() => setScope('assigned')} />}
    </div>
  );
}

function Empty({ canAssign, onAssign, mine }: { canAssign: boolean; onAssign: () => void; mine: boolean }) {
  return (
    <div className="flex flex-col items-center rounded-3xl border border-dashed bg-card/50 px-6 py-16 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-[hsl(var(--brand-cyan))] text-white shadow-lg">
        <Sparkles className="h-7 w-7" />
      </span>
      <h3 className="mt-5 font-display text-xl font-bold">{mine ? 'Nothing on your plate' : 'No tasks yet'}</h3>
      <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
        {mine ? 'When someone above you assigns work, it lands here with its due date and checklist.' : 'Assign something to your team and track it here as it moves.'}
      </p>
      {canAssign && (
        <button onClick={onAssign} className="mt-5 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground">
          <Plus className="h-4 w-4" /> Assign work
        </button>
      )}
    </div>
  );
}

function TaskCard({ t, scope, index, onOpen }: { t: WorkTask; scope: Scope; index: number; onOpen: () => void }) {
  const due = dueLabel(t.dueDate, t.status === 'done');
  const other = scope === 'mine' ? t.assignedBy : t.assignee;
  const doneItems = t.checklist.filter((c) => c.done).length;
  return (
    <button
      onClick={onOpen}
      style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
      className={cn(
        'group relative block w-full overflow-hidden rounded-xl border bg-card p-3.5 text-left shadow-sm transition animate-fade-in hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md',
        t.overdue && 'border-rose-200 dark:border-rose-900'
      )}
    >
      <span className={cn('absolute inset-y-0 left-0 w-1', PRIORITY[t.priority].dot)} />
      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
        <span className="font-mono">{t.number}</span>
        <PriorityChip p={t.priority} />
        {t.can.review && <Chip className="bg-violet-600 text-white">Review</Chip>}
      </div>
      <p className="mt-2 line-clamp-2 text-sm font-semibold leading-snug">{t.title}</p>
      {t.status !== 'todo' && t.status !== 'done' && (
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-gradient-to-r from-primary to-[hsl(var(--brand-cyan))] transition-all" style={{ width: `${t.progress}%` }} />
        </div>
      )}
      <div className="mt-3 flex items-center gap-2 text-xs">
        <Avatar person={other} size={22} />
        <span className="truncate text-muted-foreground">{scope === 'mine' ? `from ${other.name.split(' ')[0]}` : other.name}</span>
        <span className="ml-auto flex shrink-0 items-center gap-2">
          {t.checklist.length > 0 && (
            <span className="inline-flex items-center gap-0.5 text-muted-foreground">
              <ListChecks className="h-3.5 w-3.5" />
              {doneItems}/{t.checklist.length}
            </span>
          )}
          {due && (
            <span className={cn('font-medium', due.late ? 'text-rose-600' : due.soon ? 'text-amber-600' : 'text-muted-foreground')}>{due.text}</span>
          )}
        </span>
      </div>
    </button>
  );
}

/* Detail ------------------------------------------------------------------ */

function TaskSheet({ id, onClose }: { id: string | null; onClose: () => void }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['workspace', 'task', id], queryFn: () => workspaceApi.task(id!), enabled: !!id });
  const [comment, setComment] = useState('');
  const [progress, setProgress] = useState<number | null>(null);
  const act = useMutation({
    mutationFn: (a: Record<string, unknown>) => workspaceApi.taskAction(id!, a),
    onSuccess: (t, a) => {
      qc.setQueryData(['workspace', 'task', id], t);
      qc.invalidateQueries({ queryKey: ['workspace', 'tasks'] });
      qc.invalidateQueries({ queryKey: ['workspace', 'summary'] });
      if (a.type === 'comment') setComment('');
      if (a.type === 'status') toast.success(`Moved to ${TASK_STATUS[t.status].label.toLowerCase()}`);
    },
    onError: (e) => toast.error(errMsg(e)),
  });
  useEffect(() => setProgress(null), [id, q.data?.progress]);
  const t = q.data;
  const due = t && dueLabel(t.dueDate, t.status === 'done');
  const S = t ? TASK_STATUS[t.status] : null;

  return (
    <Sheet open={!!id} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto p-0 sm:max-w-xl">
        <SheetTitle className="sr-only">{t?.title ?? 'Task'}</SheetTitle>
        {!t ? (
          <div className="flex h-60 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div>
            <div className="relative overflow-hidden border-b bg-gradient-to-br from-primary/[0.07] to-[hsl(var(--brand-cyan))]/[0.08] px-6 pb-5 pt-7">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="font-mono text-muted-foreground">{t.number}</span>
                {S && (
                  <Chip className="bg-background">
                    <S.icon className={cn('h-3 w-3', S.tone)} />
                    {S.label}
                  </Chip>
                )}
                <PriorityChip p={t.priority} />
                {due && <Chip className={due.late ? 'bg-rose-600 text-white' : 'bg-background'}>{due.text}</Chip>}
              </div>
              <h2 className="mt-3 font-display text-2xl font-bold leading-tight">{t.title}</h2>
              <div className="mt-4 flex items-center gap-3 rounded-2xl bg-background/80 p-3 backdrop-blur">
                <PersonLine person={t.assignedBy} hint={`Assigned by · ${t.assignedBy.roleName}`} />
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                <PersonLine person={t.assignee} hint={`Doing it · ${t.assignee.roleName}`} />
              </div>
            </div>

            <div className="space-y-6 px-6 py-6">
              {t.description && <p className="whitespace-pre-wrap text-sm leading-relaxed">{t.description}</p>}

              {(t.can.work || t.progress > 0) && t.status !== 'done' && (
                <div>
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span className="font-semibold">Progress</span>
                    <span className="font-display text-lg font-bold tabular-nums">{progress ?? t.progress}%</span>
                  </div>
                  {t.can.work && !t.checklist.length ? (
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={5}
                      value={progress ?? t.progress}
                      onChange={(e) => setProgress(+e.target.value)}
                      onPointerUp={() => progress !== null && act.mutate({ type: 'progress', progress })}
                      onKeyUp={() => progress !== null && act.mutate({ type: 'progress', progress })}
                      className="w-full accent-[hsl(var(--primary))]"
                      aria-label="Progress"
                    />
                  ) : (
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-gradient-to-r from-primary to-[hsl(var(--brand-cyan))] transition-all" style={{ width: `${t.progress}%` }} />
                    </div>
                  )}
                </div>
              )}

              {t.checklist.length > 0 && (
                <div>
                  <p className="mb-2 text-sm font-semibold">Checklist</p>
                  <ul className="space-y-1.5">
                    {t.checklist.map((c) => {
                      const can = (t.can.work || t.can.manage) && !act.isPending;
                      return (
                        <li key={c.id}>
                          <button
                            disabled={!can}
                            onClick={() => act.mutate({ type: 'checklist', itemId: c.id, done: !c.done })}
                            className="flex w-full items-center gap-3 rounded-xl border bg-card px-3 py-2.5 text-left text-sm transition enabled:hover:border-primary/40 disabled:cursor-default"
                          >
                            <span className={cn('flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition', c.done ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-muted-foreground/40')}>
                              {c.done && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                            </span>
                            <span className={cn(c.done && 'text-muted-foreground line-through')}>{c.text}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              <TaskActions t={t} busy={act.isPending} onAct={(a) => act.mutate(a)} />

              <div>
                <p className="mb-3 text-sm font-semibold">Activity</p>
                <form
                  className="mb-5 flex items-end gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (comment.trim()) act.mutate({ type: 'comment', text: comment });
                  }}
                >
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    rows={2}
                    placeholder="Add an update or ask a question…"
                    className="min-h-[44px] flex-1 resize-none rounded-xl border bg-card px-3 py-2.5 text-sm outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/15"
                  />
                  <button disabled={!comment.trim() || act.isPending} className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground disabled:opacity-40" aria-label="Send">
                    <Send className="h-4 w-4" />
                  </button>
                </form>
                <Timeline updates={t.updates} />
              </div>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function TaskActions({ t, busy, onAct }: { t: WorkTask; busy: boolean; onAct: (a: Record<string, unknown>) => void }) {
  const btn = 'inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition disabled:opacity-50';
  const primary = cn(btn, 'bg-primary text-primary-foreground shadow-sm hover:shadow-md');
  const ghost = cn(btn, 'border bg-card hover:bg-muted');
  const status = (s: TaskStatus) => onAct({ type: 'status', status: s });
  const items: React.ReactNode[] = [];
  if (t.can.work && t.status === 'todo')
    items.push(<button key="start" disabled={busy} className={ghost} onClick={() => status('in_progress')}><CircleDot className="h-4 w-4" />Start</button>);
  if (t.can.work && (t.status === 'todo' || t.status === 'in_progress'))
    items.push(
      <button key="done" disabled={busy} className={primary} onClick={() => status('done')}>
        <CheckCircle2 className="h-4 w-4" />
        {t.requireReview ? 'Submit for review' : 'Mark done'}
      </button>
    );
  if (t.can.review) {
    items.push(<button key="ok" disabled={busy} className={cn(btn, 'bg-emerald-600 text-white hover:bg-emerald-700')} onClick={() => status('done')}><Check className="h-4 w-4" />Approve</button>);
    items.push(<button key="back" disabled={busy} className={ghost} onClick={() => status('in_progress')}><RotateCcw className="h-4 w-4" />Send back</button>);
  }
  if (t.can.reopen) items.push(<button key="reopen" disabled={busy} className={ghost} onClick={() => status('in_progress')}><RotateCcw className="h-4 w-4" />Reopen</button>);
  if (t.can.manage)
    items.push(
      <button key="cancel" disabled={busy} className={cn(ghost, 'ml-auto text-rose-600')} onClick={() => confirm('Cancel this task?') && status('cancelled')}>
        <X className="h-4 w-4" />
        Cancel task
      </button>
    );
  if (t.status === 'in_review' && !t.can.review && t.can.work === false && items.length === 0)
    return <p className="rounded-xl bg-violet-50 px-4 py-3 text-sm text-violet-800 dark:bg-violet-950 dark:text-violet-200">Waiting for {t.assignedBy.name} to review.</p>;
  if (!items.length) return null;
  return <div className="flex flex-wrap gap-2">{items}</div>;
}

/* Create ------------------------------------------------------------------ */

function NewTaskDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const qc = useQueryClient();
  const people = useQuery({ queryKey: ['workspace', 'assignable'], queryFn: workspaceApi.assignable, enabled: open });
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [dueDate, setDueDate] = useState('');
  const [requireReview, setRequireReview] = useState(true);
  const [checklist, setChecklist] = useState<string[]>([]);
  const [item, setItem] = useState('');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [find, setFind] = useState('');
  const reset = () => {
    setTitle(''); setDescription(''); setPriority('medium'); setDueDate(''); setRequireReview(true); setChecklist([]); setItem(''); setPicked(new Set()); setFind('');
  };
  const create = useMutation({
    mutationFn: () =>
      workspaceApi.createTask({
        title,
        description: description || undefined,
        priority,
        dueDate: dueDate || undefined,
        requireReview,
        checklist: item.trim() ? [...checklist, item.trim()] : checklist,
        assigneeIds: [...picked],
      }),
    onSuccess: (tasks) => {
      toast.success(tasks.length > 1 ? `Assigned to ${tasks.length} people` : `Assigned to ${tasks[0]?.assignee.name}`);
      qc.invalidateQueries({ queryKey: ['workspace'] });
      reset();
      onCreated();
      onClose();
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  const needle = find.trim().toLowerCase();
  const groups = useMemo(() => {
    const m = new Map<string, WorkPerson[]>();
    for (const p of people.data ?? []) {
      if (needle && !`${p.name} ${p.roleName} ${p.departmentName ?? ''}`.toLowerCase().includes(needle)) continue;
      m.set(p.roleName, [...(m.get(p.roleName) ?? []), p]);
    }
    return [...m.entries()];
  }, [people.data, needle]);
  const toggle = (ids: string[], on: boolean) =>
    setPicked((s) => {
      const n = new Set(s);
      ids.forEach((i) => (on ? n.add(i) : n.delete(i)));
      return n;
    });
  const chosen = (people.data ?? []).filter((p) => picked.has(p.userId));
  const ready = title.trim().length >= 3 && picked.size > 0;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-hidden p-0">
        <div className="grid max-h-[92vh] md:grid-cols-[1.1fr_1fr]">
          <div className="space-y-5 overflow-y-auto p-6">
            <div>
              <DialogTitle className="font-display text-2xl font-bold">Assign work</DialogTitle>
              <p className="mt-1 text-sm text-muted-foreground">It lands on their board right away. You’ll see every update.</p>
            </div>
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What needs doing?"
              className="w-full border-0 border-b-2 bg-transparent pb-2 font-display text-xl font-semibold outline-none placeholder:text-muted-foreground/50 focus:border-primary focus-visible:outline-none focus-visible:ring-0"
            />
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Details, links, what “done” looks like…"
              className="w-full resize-none rounded-xl border bg-card px-3 py-2.5 text-sm outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/15"
            />
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Priority</p>
              <div className="grid grid-cols-4 gap-2">
                {(Object.keys(PRIORITY) as TaskPriority[]).map((p) => {
                  const m = PRIORITY[p];
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPriority(p)}
                      className={cn('flex flex-col items-center gap-1 rounded-xl border py-2.5 text-xs font-semibold transition', priority === p ? cn(m.cls, 'border-transparent ring-2 ring-primary/40') : 'bg-card hover:bg-muted')}
                    >
                      <m.icon className="h-4 w-4" />
                      {m.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Due date</span>
                <input type="date" value={dueDate} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setDueDate(e.target.value)} className="h-10 w-full rounded-xl border bg-card px-3 text-sm" />
              </label>
              <label className="flex items-end justify-between gap-3 rounded-xl border bg-card px-3 py-2">
                <span>
                  <span className="block text-sm font-medium">Review before done</span>
                  <span className="block text-xs text-muted-foreground">You sign it off</span>
                </span>
                <Switch checked={requireReview} onCheckedChange={setRequireReview} />
              </label>
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Checklist</p>
              <ul className="space-y-1.5">
                {checklist.map((c, i) => (
                  <li key={i} className="flex items-center gap-2 rounded-lg bg-muted/60 px-3 py-1.5 text-sm">
                    <ListChecks className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="flex-1">{c}</span>
                    <button type="button" onClick={() => setChecklist((l) => l.filter((_, j) => j !== i))} aria-label="Remove">
                      <X className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                  </li>
                ))}
              </ul>
              <input
                value={item}
                onChange={(e) => setItem(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && item.trim()) {
                    e.preventDefault();
                    setChecklist((l) => [...l, item.trim()]);
                    setItem('');
                  }
                }}
                placeholder="Add a step and press Enter"
                className="mt-1.5 h-9 w-full rounded-lg border border-dashed bg-transparent px-3 text-sm outline-none focus:border-primary/50"
              />
            </div>
          </div>

          <div className="flex min-h-0 flex-col border-t bg-muted/30 md:border-l md:border-t-0">
            <div className="p-5 pb-3">
              <p className="text-sm font-semibold">Who should do it?</p>
              <p className="text-xs text-muted-foreground">People you lead. Pick several to give each their own copy.</p>
              <label className="relative mt-3 block">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input value={find} onChange={(e) => setFind(e.target.value)} placeholder="Search by name, role or department" className="h-10 w-full rounded-xl border bg-card pl-9 pr-3 text-sm outline-none focus:border-primary/50" />
              </label>
              {chosen.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {chosen.slice(0, 8).map((p) => (
                    <button key={p.userId} type="button" onClick={() => toggle([p.userId], false)} className="inline-flex items-center gap-1.5 rounded-full bg-primary py-0.5 pl-0.5 pr-2 text-xs font-medium text-primary-foreground">
                      <Avatar person={p} size={20} />
                      {p.name.split(' ')[0]}
                      <X className="h-3 w-3" />
                    </button>
                  ))}
                  {chosen.length > 8 && <span className="px-1 text-xs text-muted-foreground">+{chosen.length - 8} more</span>}
                </div>
              )}
            </div>
            <div className="min-h-[220px] flex-1 overflow-y-auto px-3 pb-3">
              {people.isLoading && <Loader2 className="mx-auto mt-10 h-5 w-5 animate-spin text-muted-foreground" />}
              {!people.isLoading && !groups.length && <p className="mt-10 text-center text-sm text-muted-foreground">No one matches.</p>}
              {groups.map(([role, list]) => {
                const allOn = list.every((p) => picked.has(p.userId));
                return (
                  <div key={role} className="mb-3">
                    <div className="sticky top-0 z-10 flex items-center justify-between bg-muted/80 px-2 py-1.5 backdrop-blur">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {role} · {list.length}
                      </span>
                      {list.length > 1 && (
                        <button type="button" onClick={() => toggle(list.map((p) => p.userId), !allOn)} className="text-xs font-medium text-primary">
                          {allOn ? 'Clear' : 'Select all'}
                        </button>
                      )}
                    </div>
                    {list.map((p) => {
                      const on = picked.has(p.userId);
                      return (
                        <button
                          key={p.userId}
                          type="button"
                          onClick={() => toggle([p.userId], !on)}
                          className={cn('flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left transition', on ? 'bg-primary/10' : 'hover:bg-card')}
                        >
                          <PersonLine person={p} />
                          <span className={cn('ml-auto flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition', on ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/30')}>
                            {on && <Check className="h-3 w-3" strokeWidth={3} />}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
            <div className="flex items-center gap-3 border-t bg-card p-4">
              <span className="text-sm text-muted-foreground">{picked.size ? `${picked.size} selected` : 'No one selected'}</span>
              <button
                disabled={!ready || create.isPending}
                onClick={() => create.mutate()}
                className="ml-auto inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition enabled:hover:shadow-md disabled:opacity-40"
              >
                {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Assign
              </button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
