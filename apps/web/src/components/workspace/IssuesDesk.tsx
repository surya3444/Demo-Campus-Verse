'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNowStrict } from 'date-fns';
import { toast } from 'sonner';
import {
  AlarmClock,
  ArrowDownRight,
  ArrowUp,
  ArrowUpRight,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  Eye,
  Hand,
  Inbox,
  Loader2,
  Megaphone,
  RotateCcw,
  Search,
  Send,
  ShieldCheck,
  Timer,
  X,
} from 'lucide-react';
import { workspaceApi, type IssueSeverity, type WorkIssue, type WorkPerson } from '@/lib/api';
import { usePermissions } from '@/hooks/usePermissions';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Avatar, CATEGORY, Chip, ISSUE_STATUS, PersonLine, SEVERITY, Stat, Timeline, slaClock } from './kit';

type Scope = 'assigned' | 'raised' | 'team';
const errMsg = (e: unknown) =>
  (e as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ?? 'Something went wrong';
const ACTIVE = ['open', 'acknowledged', 'in_progress'];
const lastHandOff = (i: WorkIssue) => i.trail[i.trail.length - 1]?.at ?? i.createdAt;

export function IssuesDesk() {
  const { hasPermission } = usePermissions();
  const isLead = hasPermission('workspace.tasks', 'assign');
  const canRaise = hasPermission('workspace.issues', 'raise');
  const [scope, setScope] = useState<Scope>(isLead ? 'assigned' : 'raised');
  const [search, setSearch] = useState('');
  const [showClosed, setShowClosed] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [raising, setRaising] = useState(false);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const v = p.get('view') as Scope | null;
    if (v && ['assigned', 'raised', 'team'].includes(v)) setScope(v);
    if (p.get('issue')) setOpenId(p.get('issue'));
    if (p.get('new')) setRaising(true);
  }, []);

  const q = useQuery({ queryKey: ['workspace', 'issues', scope], queryFn: () => workspaceApi.issues(scope) });
  const summary = useQuery({ queryKey: ['workspace', 'summary'], queryFn: workspaceApi.summary });
  const all = useMemo(() => q.data ?? [], [q.data]);
  const needle = search.trim().toLowerCase();
  const shown = all.filter(
    (i) =>
      (showClosed || i.status !== 'closed') &&
      (!needle || `${i.number} ${i.title} ${i.raisedBy.name} ${i.handler.name}`.toLowerCase().includes(needle))
  );
  const active = shown.filter((i) => ACTIVE.includes(i.status));
  const settled = shown.filter((i) => !ACTIVE.includes(i.status));
  const s = summary.data?.issues;

  const tabs: Array<{ key: Scope; label: string; count?: number }> = [
    { key: 'assigned', label: 'For me to handle', count: s?.assigned },
    { key: 'raised', label: 'Raised by me', count: s?.raised },
    ...(isLead ? [{ key: 'team' as const, label: 'Across my team' }] : []),
  ];

  return (
    <div className="space-y-6">
      <header className="relative overflow-hidden rounded-3xl border bg-card p-6 md:p-8 animate-fade-in">
        <div className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full bg-amber-400/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-28 left-1/4 h-64 w-64 rounded-full bg-[hsl(var(--brand-cyan))]/12 blur-3xl" />
        <div className="relative flex flex-wrap items-end justify-between gap-5">
          <div className="space-y-2">
            <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              <Megaphone className="h-3.5 w-3.5 text-[hsl(var(--brand-cyan))]" />
              My Workspace · Issues
            </p>
            <h1 className="font-display text-3xl font-bold leading-tight tracking-tight md:text-4xl">Raise it. Track it. Get it fixed.</h1>
            <p className="max-w-xl text-muted-foreground">
              Issues go to the person right above you. If they don’t respond in time, they move up the chain on their own — nothing gets stuck.
            </p>
          </div>
          {canRaise && (
            <button
              onClick={() => setRaising(true)}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:-translate-y-px hover:shadow-lg"
            >
              <ArrowUp className="h-4 w-4" />
              Raise an issue
            </button>
          )}
        </div>
        <div className="relative mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat icon={Inbox} label="With you now" value={s?.assigned ?? 0} tone="bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300" onClick={() => setScope('assigned')} active={scope === 'assigned'} />
          <Stat icon={AlarmClock} label="Past response time" value={s?.breached ?? 0} tone="bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300" onClick={() => setScope('assigned')} />
          <Stat icon={Megaphone} label="You raised, still open" value={s?.raised ?? 0} tone="bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300" onClick={() => setScope('raised')} active={scope === 'raised'} />
          <Stat icon={ShieldCheck} label="Resolved here" value={all.filter((i) => i.status === 'resolved' || i.status === 'closed').length} tone="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" />
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex flex-wrap rounded-full border bg-card p-1">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setScope(t.key)}
              className={cn('inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition', scope === t.key ? 'bg-primary text-primary-foreground shadow' : 'text-muted-foreground hover:text-foreground')}
            >
              {t.label}
              {!!t.count && <span className={cn('rounded-full px-1.5 text-[11px] tabular-nums', scope === t.key ? 'bg-white/20' : 'bg-muted')}>{t.count}</span>}
            </button>
          ))}
        </div>
        <label className="ml-auto inline-flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
          <input type="checkbox" checked={showClosed} onChange={(e) => setShowClosed(e.target.checked)} className="accent-[hsl(var(--primary))]" />
          Show closed
        </label>
        <label className="relative w-full max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search issues or people" className="h-10 w-full rounded-full border bg-card pl-9 pr-3 text-sm outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/15" />
        </label>
      </div>

      {q.isLoading ? (
        <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="h-24 animate-pulse rounded-2xl bg-muted/50" />)}</div>
      ) : !shown.length ? (
        <div className="flex flex-col items-center rounded-3xl border border-dashed bg-card/50 px-6 py-16 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-[hsl(var(--brand-cyan))] text-white shadow-lg">
            <ShieldCheck className="h-7 w-7" />
          </span>
          <h3 className="mt-5 font-display text-xl font-bold">{scope === 'assigned' ? 'Nothing waiting on you' : scope === 'raised' ? 'You haven’t raised anything' : 'All quiet in your team'}</h3>
          <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
            {scope === 'raised' ? 'Something blocking your work? Raise it and it goes straight to the right person above you.' : 'Issues routed to you will show up here with their response clock.'}
          </p>
          {canRaise && scope === 'raised' && (
            <button onClick={() => setRaising(true)} className="mt-5 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground">
              <ArrowUp className="h-4 w-4" /> Raise an issue
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {active.length > 0 && <IssueGroup title="Open" items={active} onOpen={setOpenId} />}
          {settled.length > 0 && <IssueGroup title="Resolved & closed" items={settled} onOpen={setOpenId} muted />}
        </div>
      )}

      <IssueSheet id={openId} onClose={() => setOpenId(null)} />
      {canRaise && <RaiseDialog open={raising} onClose={() => setRaising(false)} onRaised={(i) => { setScope('raised'); setOpenId(i._id); }} />}
    </div>
  );
}

function IssueGroup({ title, items, onOpen, muted }: { title: string; items: WorkIssue[]; onOpen: (id: string) => void; muted?: boolean }) {
  return (
    <section>
      <h2 className="mb-2.5 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title} · {items.length}
      </h2>
      <div className={cn('space-y-2.5', muted && 'opacity-80')}>
        {items.map((i, n) => (
          <IssueRow key={i._id} i={i} index={n} onOpen={() => onOpen(i._id)} />
        ))}
      </div>
    </section>
  );
}

function IssueRow({ i, index, onOpen }: { i: WorkIssue; index: number; onOpen: () => void }) {
  const C = CATEGORY[i.category] ?? CATEGORY.other!;
  const live = ACTIVE.includes(i.status);
  const clock = slaClock(lastHandOff(i), i.slaDueAt);
  return (
    <button
      onClick={onOpen}
      style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
      className={cn(
        'group relative flex w-full items-center gap-4 overflow-hidden rounded-2xl border bg-card p-4 pl-5 text-left shadow-sm transition animate-fade-in hover:-translate-y-0.5 hover:shadow-md',
        live && i.breached && 'border-rose-200 dark:border-rose-900'
      )}
    >
      <span className={cn('absolute inset-y-0 left-0 w-1.5', SEVERITY[i.severity].bar)} />
      <span className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-muted sm:flex">
        <C.icon className="h-5 w-5 text-muted-foreground" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-1.5 text-[11px]">
          <span className="font-mono text-muted-foreground">{i.number}</span>
          <Chip className={SEVERITY[i.severity].cls}>{SEVERITY[i.severity].label}</Chip>
          <Chip className={ISSUE_STATUS[i.status].cls}>{ISSUE_STATUS[i.status].label}</Chip>
          {i.trail.length > 1 && (
            <Chip className="bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
              <ArrowUpRight className="h-3 w-3" />
              Escalated ×{i.trail.length - 1}
            </Chip>
          )}
        </span>
        <span className="mt-1 block truncate font-semibold">{i.title}</span>
        <span className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Avatar person={i.raisedBy} size={18} />
          <span className="truncate">{i.raisedBy.name}</span>
          <ChevronRight className="h-3 w-3 shrink-0" />
          <Avatar person={i.handler} size={18} />
          <span className="truncate font-medium text-foreground">{i.handler.name}</span>
        </span>
      </span>
      {live && (
        <span className="hidden w-36 shrink-0 md:block">
          <span className={cn('flex items-center justify-end gap-1 text-xs font-semibold', clock.breached ? 'text-rose-600' : clock.used > 0.75 ? 'text-amber-600' : 'text-muted-foreground')}>
            <Timer className="h-3.5 w-3.5" />
            {clock.text}
          </span>
          <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-muted">
            <span className={cn('block h-full rounded-full transition-all', clock.breached ? 'bg-rose-500' : clock.used > 0.75 ? 'bg-amber-500' : 'bg-emerald-500')} style={{ width: `${Math.max(4, clock.used * 100)}%` }} />
          </span>
        </span>
      )}
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5" />
    </button>
  );
}

/* Escalation path --------------------------------------------------------- */

const VIA: Record<string, string> = { raised: 'Raised to', escalated: 'Escalated to', delegated: 'Handed to', auto_escalated: 'Auto-escalated' };

function Path({ i }: { i: WorkIssue }) {
  const live = ACTIVE.includes(i.status);
  const steps: Array<{ p: WorkPerson; label: string; state: 'from' | 'past' | 'now' | 'next'; at?: string }> = [
    { p: i.raisedBy, label: 'Raised by', state: 'from', at: i.createdAt },
    ...i.trail.map((t, n) => ({
      p: t.who,
      label: VIA[t.via] ?? 'Handled by',
      state: (n === i.trail.length - 1 ? 'now' : 'past') as 'now' | 'past',
      at: t.at,
    })),
    ...(live ? (i.ahead ?? []).map((p) => ({ p, label: 'Next if needed', state: 'next' as const })) : []),
  ];
  return (
    <ol className="relative space-y-0">
      {steps.map((s, n) => (
        <li key={n} className="relative flex gap-3 pb-4 last:pb-0">
          {n < steps.length - 1 && (
            <span className={cn('absolute left-[17px] top-9 bottom-0 w-0.5', s.state === 'now' || s.state === 'next' ? 'border-l-2 border-dashed border-muted-foreground/25 bg-transparent' : 'bg-gradient-to-b from-primary/60 to-primary/30')} />
          )}
          <span className={cn('relative', s.state === 'next' && 'opacity-45 grayscale')}>
            <Avatar person={s.p} size={36} ring />
            {s.state === 'now' && live && <span className="absolute -inset-1 animate-ping rounded-full border-2 border-[hsl(var(--brand-cyan))]/60" />}
          </span>
          <span className={cn('min-w-0 pt-0.5', s.state === 'next' && 'opacity-60')}>
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {s.state === 'now' ? (live ? 'Handling now' : 'Handled by') : s.label}
              {s.at && <span className="ml-1.5 font-normal normal-case tracking-normal">· {formatDistanceToNowStrict(new Date(s.at))} ago</span>}
            </span>
            <span className="block truncate text-sm font-semibold">{s.p.name}</span>
            <span className="block truncate text-xs text-muted-foreground">{[s.p.roleName, s.p.departmentName].filter(Boolean).join(' · ')}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

/* Detail ------------------------------------------------------------------ */

function IssueSheet({ id, onClose }: { id: string | null; onClose: () => void }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['workspace', 'issue', id], queryFn: () => workspaceApi.issue(id!), enabled: !!id });
  const [comment, setComment] = useState('');
  const [mode, setMode] = useState<null | 'resolve' | 'escalate' | 'delegate'>(null);
  const [text, setText] = useState('');
  const [delegateTo, setDelegateTo] = useState('');
  useEffect(() => { setMode(null); setText(''); setDelegateTo(''); }, [id]);
  const act = useMutation({
    mutationFn: (a: Record<string, unknown>) => workspaceApi.issueAction(id!, a),
    onSuccess: (i, a) => {
      qc.setQueryData(['workspace', 'issue', id], i);
      qc.invalidateQueries({ queryKey: ['workspace', 'issues'] });
      qc.invalidateQueries({ queryKey: ['workspace', 'summary'] });
      const msg: Record<string, string> = {
        acknowledge: 'Acknowledged — they’ll see you’re on it',
        start: 'Marked in progress',
        resolve: 'Resolved. The raiser can close or reopen it.',
        escalate: `Escalated to ${i.handler.name}`,
        delegate: `Handed to ${i.handler.name}`,
        take_over: 'It’s yours now',
        close: 'Closed',
        reopen: 'Reopened',
      };
      if (msg[a.type as string]) toast.success(msg[a.type as string]);
      if (a.type === 'comment') setComment('');
      setMode(null);
      setText('');
    },
    onError: (e) => toast.error(errMsg(e)),
  });
  const i = q.data;
  const live = i && ACTIVE.includes(i.status);
  const clock = i && slaClock(lastHandOff(i), i.slaDueAt);
  const C = i ? CATEGORY[i.category] ?? CATEGORY.other! : null;
  const btn = 'inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition disabled:opacity-50';
  const ghost = cn(btn, 'border bg-card hover:bg-muted');

  return (
    <Sheet open={!!id} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto p-0 sm:max-w-2xl">
        <SheetTitle className="sr-only">{i?.title ?? 'Issue'}</SheetTitle>
        {!i || !C ? (
          <div className="flex h-60 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <div>
            <div className="relative overflow-hidden border-b px-6 pb-5 pt-7">
              <span className={cn('absolute inset-x-0 top-0 h-1', SEVERITY[i.severity].bar)} />
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="font-mono text-muted-foreground">{i.number}</span>
                <Chip className={ISSUE_STATUS[i.status].cls}>{ISSUE_STATUS[i.status].label}</Chip>
                <Chip className={SEVERITY[i.severity].cls}>{SEVERITY[i.severity].label} severity</Chip>
                <Chip className="bg-muted text-muted-foreground"><C.icon className="h-3 w-3" />{C.label}</Chip>
              </div>
              <h2 className="mt-3 font-display text-2xl font-bold leading-tight">{i.title}</h2>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{i.description}</p>
            </div>

            <div className="grid gap-6 px-6 py-6 md:grid-cols-[1fr_220px]">
              <div className="order-2 space-y-6 md:order-1">
                {i.resolution && (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950/40">
                    <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Resolution
                    </p>
                    <p className="mt-1.5 whitespace-pre-wrap text-sm">{i.resolution}</p>
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  {i.can.handle && i.status === 'open' && (
                    <button disabled={act.isPending} className={ghost} onClick={() => act.mutate({ type: 'acknowledge' })}><Eye className="h-4 w-4" />Acknowledge</button>
                  )}
                  {i.can.handle && i.status !== 'in_progress' && (
                    <button disabled={act.isPending} className={ghost} onClick={() => act.mutate({ type: 'start' })}><CircleDot className="h-4 w-4" />Start working</button>
                  )}
                  {i.can.handle && (
                    <button className={cn(btn, 'bg-emerald-600 text-white hover:bg-emerald-700')} onClick={() => setMode('resolve')}><CheckCircle2 className="h-4 w-4" />Resolve</button>
                  )}
                  {i.can.escalate && i.nextUp && (
                    <button className={cn(btn, 'bg-amber-500 text-white hover:bg-amber-600')} onClick={() => setMode('escalate')}>
                      <ArrowUpRight className="h-4 w-4" />Escalate to {i.nextUp.name.split(' ')[0]}
                    </button>
                  )}
                  {i.can.delegate && !!i.delegates?.length && (
                    <button className={ghost} onClick={() => setMode('delegate')}><ArrowDownRight className="h-4 w-4" />Hand down</button>
                  )}
                  {i.can.takeOver && (
                    <button disabled={act.isPending} className={ghost} onClick={() => act.mutate({ type: 'take_over' })}><Hand className="h-4 w-4" />Take over</button>
                  )}
                  {i.can.reopen && (
                    <button disabled={act.isPending} className={ghost} onClick={() => act.mutate({ type: 'reopen' })}><RotateCcw className="h-4 w-4" />Not fixed — reopen</button>
                  )}
                  {i.can.close && (
                    <button disabled={act.isPending} className={cn(i.status === 'resolved' ? cn(btn, 'bg-primary text-primary-foreground') : ghost)} onClick={() => act.mutate({ type: 'close' })}>
                      {i.status === 'resolved' ? <CheckCircle2 className="h-4 w-4" /> : <X className="h-4 w-4" />}
                      {i.status === 'resolved' ? 'Confirm & close' : 'Withdraw'}
                    </button>
                  )}
                </div>

                {mode && (
                  <form
                    className="space-y-3 rounded-2xl border bg-muted/30 p-4 animate-fade-in"
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (mode === 'resolve') act.mutate({ type: 'resolve', resolution: text });
                      if (mode === 'escalate') act.mutate({ type: 'escalate', note: text || undefined });
                      if (mode === 'delegate' && delegateTo) act.mutate({ type: 'delegate', toUserId: delegateTo, note: text || undefined });
                    }}
                  >
                    <p className="text-sm font-semibold">
                      {mode === 'resolve' ? 'How was it resolved?' : mode === 'escalate' ? `Escalate to ${i.nextUp?.name} (${i.nextUp?.roleName})` : 'Hand it to someone on your team'}
                    </p>
                    {mode === 'delegate' && (
                      <select value={delegateTo} onChange={(e) => setDelegateTo(e.target.value)} className="h-10 w-full rounded-xl border bg-card px-3 text-sm">
                        <option value="">Choose a person…</option>
                        {i.delegates?.map((p) => <option key={p.userId} value={p.userId}>{p.name} — {p.roleName}{p.departmentName ? `, ${p.departmentName}` : ''}</option>)}
                      </select>
                    )}
                    <textarea
                      autoFocus
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      rows={3}
                      placeholder={mode === 'resolve' ? 'What was done, so the raiser can confirm…' : 'Add context for them (optional)'}
                      className="w-full resize-none rounded-xl border bg-card px-3 py-2.5 text-sm outline-none focus:border-primary/50"
                    />
                    <div className="flex justify-end gap-2">
                      <button type="button" className={ghost} onClick={() => setMode(null)}>Cancel</button>
                      <button disabled={act.isPending || (mode === 'resolve' && text.trim().length < 3) || (mode === 'delegate' && !delegateTo)} className={cn(btn, 'bg-primary text-primary-foreground')}>
                        {act.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                        {mode === 'resolve' ? 'Mark resolved' : mode === 'escalate' ? 'Escalate' : 'Hand down'}
                      </button>
                    </div>
                  </form>
                )}

                <div>
                  <p className="mb-3 text-sm font-semibold">Conversation</p>
                  <form className="mb-5 flex items-end gap-2" onSubmit={(e) => { e.preventDefault(); if (comment.trim()) act.mutate({ type: 'comment', text: comment }); }}>
                    <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={2} placeholder="Reply or add detail…" className="min-h-[44px] flex-1 resize-none rounded-xl border bg-card px-3 py-2.5 text-sm outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/15" />
                    <button disabled={!comment.trim() || act.isPending} className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground disabled:opacity-40" aria-label="Send"><Send className="h-4 w-4" /></button>
                  </form>
                  <Timeline updates={i.updates} />
                </div>
              </div>

              <aside className="order-1 space-y-4 md:order-2">
                {live && clock && (
                  <div className={cn('rounded-2xl border p-4', clock.breached ? 'border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/40' : 'bg-card')}>
                    <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground"><Timer className="h-3.5 w-3.5" />Response clock</p>
                    <p className={cn('mt-1 font-display text-xl font-bold', clock.breached && 'text-rose-600')}>{clock.text}</p>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div className={cn('h-full rounded-full', clock.breached ? 'bg-rose-500' : clock.used > 0.75 ? 'bg-amber-500' : 'bg-emerald-500')} style={{ width: `${Math.max(4, clock.used * 100)}%` }} />
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {i.nextUp ? <>Moves up to <b>{i.nextUp.name}</b> automatically when it runs out.</> : 'Top of the chain.'}
                    </p>
                  </div>
                )}
                <div className="rounded-2xl border bg-card p-4">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Escalation path</p>
                  <Path i={i} />
                </div>
              </aside>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

/* Raise ------------------------------------------------------------------- */

function RaiseDialog({ open, onClose, onRaised }: { open: boolean; onClose: () => void; onRaised: (i: WorkIssue) => void }) {
  const qc = useQueryClient();
  const route = useQuery({ queryKey: ['workspace', 'route'], queryFn: workspaceApi.route, enabled: open });
  const [category, setCategory] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState<IssueSeverity>('medium');
  const [to, setTo] = useState<string | null>(null);
  const chain = route.data ?? [];
  const target = chain.find((p) => p.userId === to) ?? chain[0];
  const after = target ? chain[chain.indexOf(target) + 1] : undefined;
  const raise = useMutation({
    mutationFn: () => workspaceApi.raiseIssue({ title, description, category, severity, toUserId: target && target !== chain[0] ? target.userId : undefined }),
    onSuccess: (i) => {
      toast.success(`Raised to ${i.handler.name}`);
      qc.invalidateQueries({ queryKey: ['workspace'] });
      setCategory(''); setTitle(''); setDescription(''); setSeverity('medium'); setTo(null);
      onClose();
      onRaised(i);
    },
    onError: (e) => toast.error(errMsg(e)),
  });
  const ready = category && title.trim().length >= 3 && description.trim().length >= 5 && target;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-hidden p-0">
        <div className="grid max-h-[92vh] md:grid-cols-[1.25fr_1fr]">
          <div className="space-y-5 overflow-y-auto p-6">
            <div>
              <DialogTitle className="font-display text-2xl font-bold">Raise an issue</DialogTitle>
              <p className="mt-1 text-sm text-muted-foreground">Tell us what’s wrong. It goes to the right person above you, with a clock on it.</p>
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">What’s it about?</p>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(CATEGORY).map(([k, c]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setCategory(k)}
                    className={cn('group flex items-center gap-2.5 rounded-xl border p-2.5 text-left transition', category === k ? 'border-primary bg-primary/5 ring-2 ring-primary/30' : 'bg-card hover:-translate-y-px hover:border-primary/30')}
                  >
                    <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition group-hover:scale-105', category === k ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}>
                      <c.icon className="h-[18px] w-[18px]" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold leading-tight">{c.label}</span>
                      <span className="block truncate text-[11px] leading-tight text-muted-foreground">{c.hint}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="One line: what’s the problem?" className="w-full border-0 border-b-2 bg-transparent pb-2 font-display text-xl font-semibold outline-none placeholder:text-muted-foreground/50 focus:border-primary focus-visible:outline-none focus-visible:ring-0" />
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} placeholder="What happened, where, since when, and what you’ve tried." className="w-full resize-none rounded-xl border bg-card px-3 py-2.5 text-sm outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/15" />
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">How urgent?</p>
              <div className="grid grid-cols-4 gap-2">
                {(Object.keys(SEVERITY) as IssueSeverity[]).map((k) => (
                  <button key={k} type="button" onClick={() => setSeverity(k)} className={cn('rounded-xl border px-2 py-2.5 text-center transition', severity === k ? cn(SEVERITY[k].cls, 'border-transparent ring-2 ring-primary/40') : 'bg-card hover:bg-muted')}>
                    <span className="block text-sm font-semibold">{SEVERITY[k].label}</span>
                    <span className="block text-[11px] opacity-75">reply in {SEVERITY[k].sla}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex min-h-0 flex-col border-t bg-muted/30 md:border-l md:border-t-0">
            <div className="flex-1 overflow-y-auto p-5">
              <p className="text-sm font-semibold">It will go to</p>
              <p className="text-xs text-muted-foreground">Your nearest lead by default. Pick someone higher if it can’t wait for them.</p>
              {route.isLoading && <Loader2 className="mx-auto mt-10 h-5 w-5 animate-spin text-muted-foreground" />}
              {!route.isLoading && !chain.length && <p className="mt-6 text-sm text-muted-foreground">There’s no one above you to raise issues to.</p>}
              <ol className="mt-4">
                {chain.map((p, n) => {
                  const on = target?.userId === p.userId;
                  const skipped = target && n < chain.indexOf(target);
                  return (
                    <li key={p.userId} className="relative pb-2 last:pb-0">
                      {n < chain.length - 1 && <span className="absolute left-[26px] top-12 h-3 w-0.5 bg-border" />}
                      <button type="button" onClick={() => setTo(p.userId)} className={cn('flex w-full items-center gap-2 rounded-xl border px-3 py-2.5 text-left transition', on ? 'border-primary bg-card shadow-md ring-2 ring-primary/25' : 'border-transparent hover:bg-card', skipped && 'opacity-45')}>
                        <PersonLine person={p} />
                        {n === 0 && <span className="ml-auto shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase text-muted-foreground">Nearest</span>}
                        {on && <ArrowUp className={cn('h-4 w-4 shrink-0 text-primary', n !== 0 && 'ml-auto')} />}
                      </button>
                    </li>
                  );
                })}
              </ol>
              {target && (
                <div className="mt-4 rounded-xl bg-card p-3 text-xs leading-relaxed text-muted-foreground">
                  <Timer className="mr-1 inline h-3.5 w-3.5" />
                  {target.name.split(' ')[0]} has <b className="text-foreground">{SEVERITY[severity].sla}</b> to respond.
                  {after ? <> If not, it moves up to <b className="text-foreground">{after.name}</b> automatically.</> : ' They’re the top of the chain.'}
                </div>
              )}
            </div>
            <div className="flex items-center justify-end gap-3 border-t bg-card p-4">
              <button type="button" onClick={onClose} className="rounded-full px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground">Cancel</button>
              <button disabled={!ready || raise.isPending} onClick={() => raise.mutate()} className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition enabled:hover:shadow-md disabled:opacity-40">
                {raise.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
                Raise issue
              </button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
