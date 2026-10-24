'use client';

import { formatDistanceToNowStrict, format, isToday, isTomorrow, isPast } from 'date-fns';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BookOpen,
  CheckCircle2,
  Circle,
  CircleDot,
  Flame,
  HandHelping,
  HeartPulse,
  IndianRupee,
  Laptop,
  MessageSquare,
  Minus,
  PencilLine,
  RotateCcw,
  ShieldAlert,
  Signal,
  Users,
  Wrench,
  XCircle,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import type { IssueSeverity, IssueStatus, TaskPriority, TaskStatus, WorkPerson, WorkUpdate } from '@/lib/api';
import { cn } from '@/lib/utils';

/* People ------------------------------------------------------------------ */

const HUES = [200, 262, 330, 160, 24, 45, 290, 180];
const hueOf = (s: string) => HUES[[...s].reduce((n, c) => n + c.charCodeAt(0), 0) % HUES.length];
const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');

export function Avatar({ person, size = 32, ring }: { person: Pick<WorkPerson, 'name' | 'photo'>; size?: number; ring?: boolean }) {
  const h = hueOf(person.name);
  return (
    <span
      title={person.name}
      className={cn('relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold text-white', ring && 'ring-2 ring-background')}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.38,
        background: `linear-gradient(135deg, hsl(${h} 70% 52%), hsl(${(h + 40) % 360} 75% 42%))`,
      }}
    >
      {person.photo ? <img src={person.photo} alt="" className="h-full w-full object-cover" /> : initials(person.name)}
    </span>
  );
}

export function PersonLine({ person, hint }: { person: WorkPerson; hint?: string }) {
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <Avatar person={person} size={30} />
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium leading-tight">{person.name}</span>
        <span className="block truncate text-xs text-muted-foreground">
          {hint ?? [person.roleName, person.departmentName].filter(Boolean).join(' · ')}
        </span>
      </span>
    </span>
  );
}

/* Tasks ------------------------------------------------------------------- */

export const PRIORITY: Record<TaskPriority, { label: string; icon: LucideIcon; cls: string; dot: string }> = {
  low: { label: 'Low', icon: Minus, cls: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300', dot: 'bg-slate-400' },
  medium: { label: 'Medium', icon: Signal, cls: 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300', dot: 'bg-sky-500' },
  high: { label: 'High', icon: Zap, cls: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300', dot: 'bg-amber-500' },
  urgent: { label: 'Urgent', icon: Flame, cls: 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300', dot: 'bg-rose-500' },
};

export const TASK_STATUS: Record<TaskStatus, { label: string; icon: LucideIcon; tone: string }> = {
  todo: { label: 'To do', icon: Circle, tone: 'text-slate-500' },
  in_progress: { label: 'In progress', icon: CircleDot, tone: 'text-sky-600' },
  in_review: { label: 'In review', icon: RotateCcw, tone: 'text-violet-600' },
  done: { label: 'Done', icon: CheckCircle2, tone: 'text-emerald-600' },
  cancelled: { label: 'Cancelled', icon: XCircle, tone: 'text-muted-foreground' },
};

export function Chip({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold', className)}>
      {children}
    </span>
  );
}

export function PriorityChip({ p }: { p: TaskPriority }) {
  const m = PRIORITY[p];
  return (
    <Chip className={m.cls}>
      <m.icon className="h-3 w-3" />
      {m.label}
    </Chip>
  );
}

export function dueLabel(due?: string, done?: boolean) {
  if (!due) return null;
  const d = new Date(due);
  const late = !done && isPast(d) && !isToday(d);
  const text = isToday(d) ? 'Due today' : isTomorrow(d) ? 'Due tomorrow' : late ? `${formatDistanceToNowStrict(d)} late` : `Due ${format(d, 'd MMM')}`;
  return { text, late, soon: !done && (isToday(d) || isTomorrow(d)) };
}

/* Issues ------------------------------------------------------------------ */

export const SEVERITY: Record<IssueSeverity, { label: string; sla: string; cls: string; bar: string }> = {
  low: { label: 'Low', sla: '7 days', cls: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300', bar: 'bg-slate-400' },
  medium: { label: 'Medium', sla: '3 days', cls: 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300', bar: 'bg-sky-500' },
  high: { label: 'High', sla: '24 hours', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300', bar: 'bg-amber-500' },
  critical: { label: 'Critical', sla: '4 hours', cls: 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300', bar: 'bg-rose-500' },
};

export const ISSUE_STATUS: Record<IssueStatus, { label: string; cls: string }> = {
  open: { label: 'Open', cls: 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300' },
  acknowledged: { label: 'Acknowledged', cls: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300' },
  in_progress: { label: 'In progress', cls: 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300' },
  resolved: { label: 'Resolved', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' },
  closed: { label: 'Closed', cls: 'bg-muted text-muted-foreground' },
};

export const CATEGORY: Record<string, { label: string; icon: LucideIcon; hint: string }> = {
  academic: { label: 'Academic', icon: BookOpen, hint: 'Syllabus, timetable, exams' },
  infrastructure: { label: 'Infrastructure', icon: Wrench, hint: 'Rooms, power, furniture' },
  it: { label: 'IT & systems', icon: Laptop, hint: 'Lab, Wi-Fi, software' },
  students: { label: 'Students', icon: Users, hint: 'Discipline, welfare' },
  hr: { label: 'HR & staff', icon: HandHelping, hint: 'Workload, leave, conduct' },
  finance: { label: 'Finance', icon: IndianRupee, hint: 'Budgets, purchases' },
  safety: { label: 'Safety', icon: HeartPulse, hint: 'Health, security, risk' },
  other: { label: 'Other', icon: MessageSquare, hint: 'Anything else' },
};

/** "3h 20m left" / "2h overdue", with how much of the window is used. */
export function slaClock(createdOrLast: string, dueAt: string) {
  const due = new Date(dueAt).getTime();
  const start = new Date(createdOrLast).getTime();
  const left = due - Date.now();
  const used = Math.min(1, Math.max(0, (Date.now() - start) / Math.max(1, due - start)));
  const abs = formatDistanceToNowStrict(due);
  return { text: left < 0 ? `${abs} overdue` : `${abs} left`, breached: left < 0, used };
}

/* Timeline ---------------------------------------------------------------- */

const UPDATE_ICON: Record<string, LucideIcon> = {
  created: PencilLine,
  raised: ShieldAlert,
  comment: MessageSquare,
  escalated: ArrowUpRight,
  auto_escalated: AlertTriangle,
  delegated: ArrowDownRight,
  reopened: RotateCcw,
};

function describe(u: WorkUpdate) {
  const s = (v?: string) => v?.replace(/_/g, ' ');
  switch (u.kind) {
    case 'created':
      return 'assigned this task';
    case 'raised':
      return <>raised this to <b>{u.handler?.name}</b></>;
    case 'comment':
      return 'commented';
    case 'escalated':
      return <>escalated to <b>{u.handler?.name}</b></>;
    case 'auto_escalated':
      return <>Escalated automatically to <b>{u.handler?.name}</b> — the response time ran out</>;
    case 'delegated':
      return <>handed this to <b>{u.handler?.name}</b></>;
    case 'reopened':
      return 'reopened this';
    case 'progress':
      return <>set progress to <b>{u.to}</b></>;
    case 'checklist':
      return <>marked “{u.text}” {u.to}</>;
    case 'edited':
      return 'edited the details';
    default:
      return <>moved this to <b>{s(u.to)}</b></>;
  }
}

export function Timeline({ updates }: { updates: WorkUpdate[] }) {
  return (
    <ol className="relative space-y-4 before:absolute before:bottom-2 before:left-[15px] before:top-2 before:w-px before:bg-border">
      {[...updates].reverse().map((u, i) => {
        const Icon = UPDATE_ICON[u.kind] ?? CheckCircle2;
        const showText = u.text && u.kind !== 'checklist' && u.kind !== 'created';
        return (
          <li key={i} className="relative flex gap-3 animate-fade-in">
            {u.by ? (
              <Avatar person={u.by} size={31} ring />
            ) : (
              <span className="relative flex h-[31px] w-[31px] shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700 ring-2 ring-background dark:bg-amber-950">
                <Icon className="h-4 w-4" />
              </span>
            )}
            <div className="min-w-0 flex-1 pt-0.5">
              <p className="text-sm leading-snug">
                {u.by && <b className="font-semibold">{u.by.name} </b>}
                <span className="text-muted-foreground">{describe(u)}</span>
                <span className="ml-1.5 text-xs text-muted-foreground/70">{formatDistanceToNowStrict(new Date(u.at))} ago</span>
              </p>
              {showText && (
                <p className="mt-1.5 whitespace-pre-wrap rounded-xl rounded-tl-sm bg-muted/60 px-3 py-2 text-sm">{u.text}</p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** Small numbered stat used in both page heroes. */
export function Stat({ icon: Icon, label, value, tone, onClick, active }: { icon: LucideIcon; label: string; value: number; tone: string; onClick?: () => void; active?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'group flex items-center gap-3 rounded-2xl border bg-card px-4 py-3 text-left transition hover:-translate-y-0.5 hover:shadow-md',
        active && 'border-primary/50 shadow-md'
      )}
    >
      <span className={cn('flex h-10 w-10 items-center justify-center rounded-xl transition-transform group-hover:scale-110', tone)}>
        <Icon className="h-5 w-5" />
      </span>
      <span>
        <span className="block font-display text-2xl font-bold leading-none tabular-nums">{value}</span>
        <span className="mt-1 block text-xs text-muted-foreground">{label}</span>
      </span>
    </button>
  );
}
