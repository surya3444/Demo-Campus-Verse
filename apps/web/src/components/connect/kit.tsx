'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { HeartPulse, Search, Sparkles, type LucideIcon } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useCountUp } from '@/hooks/useCountUp';

/*
 * Connect kit — the shared, quiet visual language for Career Connect and
 * Health Connect: generous whitespace, one accent per module, real people
 * front and centre. No glows or theatrics; motion is a soft fade and count.
 */

export type Accent = 'career' | 'health';
export const ACCENT: Record<
  Accent,
  { hex: string; soft: string; text: string; ring: string; bg: string; label: string }
> = {
  // Theme tokens, so both modules share the app's palette (and dark mode)
  career: {
    hex: 'hsl(var(--primary))',
    soft: 'bg-primary/10',
    text: 'text-primary',
    ring: 'ring-primary/15',
    bg: 'bg-primary',
    label: 'Career Connect',
  },
  health: {
    hex: 'hsl(var(--success))',
    soft: 'bg-success/10',
    text: 'text-success',
    ring: 'ring-success/15',
    bg: 'bg-success',
    label: 'Health Connect',
  },
};

// Eyebrow sections: path prefix → [label, list page]
const SECTIONS: Array<[string, string]> = [
  ['/career-connect/companies', 'Companies'],
  ['/career-connect/drives', 'Placement drives'],
  ['/career-connect/job-board', 'Job board'],
  ['/career-connect/student-profile', 'Student profiles'],
  ['/career-connect/virtual-placement-office', 'Placement office'],
  ['/career-connect/alumni', 'Alumni'],
  ['/career-connect/counseling', 'Counseling'],
  ['/career-connect/reports', 'Reports'],
  ['/career-connect', 'Placements'],
  ['/health/records', 'Health records'],
  ['/health/visits', 'Sick room'],
  ['/health/checkups', 'Check-ups'],
  ['/health/vaccinations', 'Vaccinations'],
  ['/health/reports', 'Reports'],
  ['/health/settings', 'Settings'],
  ['/health', 'Overview'],
];

/**
 * Page header shared by Career and Health Connect, in the Clubs style: a small
 * "Module · Section" eyebrow over a bold display title. On deeper pages the
 * section links back to its list.
 */
export function PageTitle({
  title,
  description,
  actions,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  /** Kept for call sites; the eyebrow now carries the way back. */
  crumbs?: Array<{ label: string; href?: string }>;
}) {
  const pathname = usePathname() ?? '';
  const health = pathname.startsWith('/health');
  const section = SECTIONS.find(([p]) => pathname === p || pathname.startsWith(`${p}/`));
  const deeper = section && pathname !== section[0];
  return (
    <header className="mb-7 flex flex-wrap items-end justify-between gap-4 animate-fade-in">
      <div className="min-w-0 space-y-2">
        <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          {health ? (
            <HeartPulse className="h-3.5 w-3.5 text-[hsl(var(--brand-cyan))]" />
          ) : (
            <Sparkles className="h-3.5 w-3.5 text-[hsl(var(--brand-cyan))]" />
          )}
          {health ? 'Health Connect' : 'Career Connect'}
          {section && (
            <>
              <span aria-hidden>·</span>
              {deeper ? (
                <Link href={section[0]} className="transition-colors hover:text-foreground">
                  {section[1]}
                </Link>
              ) : (
                <span>{section[1]}</span>
              )}
            </>
          )}
        </p>
        <h1 className="font-display text-3xl font-bold leading-tight tracking-tight text-foreground md:text-4xl">
          {title}
        </h1>
        {description && <p className="max-w-2xl text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

/* ── Surfaces ────────────────────────────────────────────────────────────── */

export function Panel({
  title,
  description,
  action,
  children,
  className,
  bodyClassName,
}: {
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn('rounded-xl border bg-card shadow-xs', className)}>
      {(title || action) && (
        <div className="flex items-start justify-between gap-3 px-5 pb-1 pt-5">
          <div>
            {title && (
              <h2 className="font-display text-base font-semibold tracking-tight text-foreground">
                {title}
              </h2>
            )}
            {description && (
              <p className="mt-0.5 text-[13px] text-muted-foreground">{description}</p>
            )}
          </div>
          {action}
        </div>
      )}
      <div className={cn('p-5', title && 'pt-4', bodyClassName)}>{children}</div>
    </section>
  );
}

function useInView<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => e.isIntersecting && (setSeen(true), io.disconnect()),
      { threshold: 0.2 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return [ref, seen] as const;
}

/** Numbers count up once when they scroll into view. */
export function Num({ value, format }: { value: number; format?: (n: number) => string }) {
  const [ref, seen] = useInView<HTMLSpanElement>();
  const v = useCountUp(seen ? value : 0, 900);
  return <span ref={ref}>{format ? format(v) : Math.round(v).toLocaleString('en-IN')}</span>;
}

export function Stat({
  label,
  value,
  format,
  hint,
  icon: Icon,
  accent = 'career',
  trend,
}: {
  label: string;
  value: number;
  format?: (n: number) => string;
  hint?: ReactNode;
  icon?: LucideIcon;
  accent?: Accent;
  trend?: number[];
}) {
  const a = ACCENT[accent];
  return (
    <div className="rounded-xl border bg-card p-5 shadow-xs">
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-medium text-muted-foreground">{label}</p>
        {Icon && (
          <span className={cn('flex h-7 w-7 items-center justify-center rounded-lg', a.soft)}>
            <Icon className={cn('h-4 w-4', a.text)} />
          </span>
        )}
      </div>
      <p className="mt-2 text-2xl font-bold leading-none tracking-tight tabular-nums text-foreground">
        <Num value={value} format={format} />
      </p>
      <div className="mt-2 flex items-end justify-between gap-3">
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        {trend && trend.length > 1 && <Spark data={trend} color={a.hex} />}
      </div>
    </div>
  );
}

export function Spark({
  data,
  color,
  width = 84,
  height = 26,
}: {
  data: number[];
  color: string;
  width?: number;
  height?: number;
}) {
  const max = Math.max(1, ...data);
  const step = width / (data.length - 1);
  const pts = data.map((d, i) => [i * step, height - 2 - (d / max) * (height - 4)]);
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  return (
    <svg width={width} height={height} className="shrink-0 overflow-visible">
      <path d={`${line} L${width} ${height} L0 ${height} Z`} fill={color} opacity={0.08} />
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** A thin, honest progress bar. */
export function Meter({
  value,
  color,
  className,
}: {
  value: number;
  color?: string;
  className?: string;
}) {
  const [ref, seen] = useInView<HTMLDivElement>();
  return (
    <div ref={ref} className={cn('h-1.5 overflow-hidden rounded-full bg-muted', className)}>
      <div
        className="h-full rounded-full transition-[width] duration-700 ease-out"
        style={{
          width: `${seen ? Math.max(0, Math.min(100, value)) : 0}%`,
          background: color ?? 'hsl(var(--primary))',
        }}
      />
    </div>
  );
}

/* ── People ──────────────────────────────────────────────────────────────── */

export interface Person {
  id?: string;
  name: string;
  photo?: string | null;
  program?: string | null;
  section?: string | null;
  cgpa?: number | null;
  designation?: string | null;
}

export function Avatar({
  person,
  size = 36,
  className,
}: {
  person: Pick<Person, 'name' | 'photo'>;
  size?: number;
  className?: string;
}) {
  const initials = person.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
  return person.photo ? (
    <img
      src={person.photo}
      alt=""
      className={cn('shrink-0 rounded-full object-cover ring-1 ring-black/5', className)}
      style={{ width: size, height: size }}
    />
  ) : (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full bg-muted font-semibold text-muted-foreground',
        className
      )}
      style={{ width: size, height: size, fontSize: size * 0.36 }}
    >
      {initials || '?'}
    </span>
  );
}

export function PersonCell({
  person,
  href,
  sub,
  size = 36,
}: {
  person: Person;
  href?: string;
  sub?: ReactNode;
  size?: number;
}) {
  const body = (
    <span className="flex min-w-0 items-center gap-3">
      <Avatar person={person} size={size} />
      {/* Capped so long programme names truncate inside table cells */}
      <span className="min-w-0 max-w-[15rem]">
        <span className="block truncate text-sm font-medium text-foreground">{person.name}</span>
        <span className="block truncate text-xs text-muted-foreground">
          {sub ??
            ([person.program, person.section && `Sec ${person.section}`]
              .filter(Boolean)
              .join(' · ') ||
              person.designation)}
        </span>
      </span>
    </span>
  );
  return href ? (
    <Link href={href} className="min-w-0 hover:opacity-80">
      {body}
    </Link>
  ) : (
    body
  );
}

export function Faces({
  people,
  max = 5,
  size = 26,
}: {
  people: Array<Pick<Person, 'name' | 'photo'>>;
  max?: number;
  size?: number;
}) {
  return (
    <span className="flex -space-x-2">
      {people.slice(0, max).map((p, i) => (
        <Avatar key={i} person={p} size={size} className="ring-2 ring-card" />
      ))}
    </span>
  );
}

/* ── Status pill ─────────────────────────────────────────────────────────── */

const TONE = {
  green:
    'bg-emerald-50 text-emerald-700 ring-emerald-600/15 dark:bg-emerald-500/10 dark:text-emerald-300',
  blue: 'bg-blue-50 text-blue-700 ring-blue-600/15 dark:bg-blue-500/10 dark:text-blue-300',
  amber: 'bg-amber-50 text-amber-800 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-300',
  red: 'bg-rose-50 text-rose-700 ring-rose-600/15 dark:bg-rose-500/10 dark:text-rose-300',
  violet:
    'bg-violet-50 text-violet-700 ring-violet-600/15 dark:bg-violet-500/10 dark:text-violet-300',
  gray: 'bg-muted text-muted-foreground ring-border',
  teal: 'bg-success/10 text-success ring-success/15',
} as const;
export type Tone = keyof typeof TONE;

export function Pill({
  tone = 'gray',
  children,
  dot = true,
  className,
}: {
  tone?: Tone;
  children: ReactNode;
  dot?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
        TONE[tone],
        className
      )}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />}
      {children}
    </span>
  );
}

/** Map any status string to a tone and a readable label. */
export function statusTone(s?: string | null): { tone: Tone; label: string } {
  const v = (s ?? '').toLowerCase();
  const label = v.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase()) || '—';
  if (
    /^(placed|accepted|completed|active|verified|returned to class|administered|published|open|registration open|hired|selected|approved|cleared)/.test(
      v
    )
  )
    return { tone: 'green', label };
  if (
    /(in progress|in_progress|scheduled|offered|interview|shortlisted|registration closed|pending|applied|due)/.test(
      v
    )
  )
    return { tone: 'blue', label };
  if (
    /(draft|not placed|not_placed|under observation|under_observation|sent home|sent_home|on hold)/.test(
      v
    )
  )
    return { tone: 'amber', label };
  if (/(overdue|declined|rejected|cancelled|missed|hospitalized|failed|closed|expired)/.test(v))
    return { tone: 'red', label };
  if (/(referred|exempt|premium|exclusive)/.test(v)) return { tone: 'violet', label };
  return { tone: 'gray', label };
}

export function StatusPill({ status }: { status?: string | null }) {
  const { tone, label } = statusTone(status);
  return <Pill tone={tone}>{label}</Pill>;
}

/* ── Toolbar, table, empty ───────────────────────────────────────────────── */

export function SearchBox({
  value,
  onChange,
  placeholder = 'Search',
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="relative w-full sm:w-72">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-9 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-sm outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/20"
      />
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: Array<{ value: T; label: string; count?: number }>;
}) {
  return (
    <div className="inline-flex rounded-lg bg-muted/70 p-0.5 text-sm">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition',
            value === o.value
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {o.label}
          {o.count !== undefined && (
            <span className="text-xs tabular-nums text-muted-foreground">{o.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}

export function Table({
  head,
  children,
  className,
}: {
  head: ReactNode[];
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('overflow-x-auto', className)}>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border/70 text-left text-xs font-medium text-muted-foreground">
            {head.map((h, i) => (
              <th
                key={i}
                className={cn(
                  'whitespace-nowrap px-5 py-2.5 font-medium',
                  i === head.length - 1 && 'text-right'
                )}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border/60">{children}</tbody>
      </table>
    </div>
  );
}

export function Row({
  children,
  href,
  onClick,
}: {
  children: ReactNode;
  href?: string;
  onClick?: () => void;
}) {
  return (
    <tr
      onClick={onClick ?? (href ? () => (window.location.href = href) : undefined)}
      className={cn('transition-colors', (href || onClick) && 'cursor-pointer hover:bg-muted/40')}
    >
      {children}
    </tr>
  );
}

export function Cell({
  children,
  className,
  last,
}: {
  children: ReactNode;
  className?: string;
  last?: boolean;
}) {
  return (
    <td className={cn('px-5 py-3 align-middle', last && 'text-right', className)}>{children}</td>
  );
}

export function Empty({
  icon: Icon,
  title,
  text,
  action,
}: {
  icon: LucideIcon;
  title: string;
  text?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-muted">
        <Icon className="h-5 w-5 text-muted-foreground" />
      </span>
      <p className="mt-3 text-sm font-semibold">{title}</p>
      {text && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Skeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-3 p-5">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3">
          <span className="h-9 w-9 animate-pulse rounded-full bg-muted" />
          <span
            className="h-3 flex-1 animate-pulse rounded bg-muted"
            style={{ maxWidth: `${60 + ((i * 13) % 35)}%` }}
          />
        </div>
      ))}
    </div>
  );
}

export function KeyValue({
  items,
  cols = 2,
}: {
  items: Array<[string, ReactNode]>;
  cols?: 1 | 2 | 3;
}) {
  return (
    <dl
      className={cn(
        'grid gap-x-6 gap-y-4',
        cols === 3 ? 'sm:grid-cols-3' : cols === 2 ? 'sm:grid-cols-2' : ''
      )}
    >
      {items.map(([k, v]) => (
        <div key={k} className="min-w-0">
          <dt className="text-xs font-medium text-muted-foreground">{k}</dt>
          <dd className="mt-0.5 truncate text-sm text-foreground">{v ?? '—'}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Quiet chart tooltip. */
export function ChartTip({
  active,
  payload,
  label,
  fmt,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
  fmt?: (v: number) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-md">
      {label && <p className="mb-1 font-medium text-foreground">{label}</p>}
      {payload.map((p) => (
        <p key={p.name} className="flex items-center gap-2 text-muted-foreground">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          {p.name}
          <span className="ml-auto pl-3 font-medium tabular-nums text-foreground">
            {fmt ? fmt(p.value) : p.value.toLocaleString('en-IN')}
          </span>
        </p>
      ))}
    </div>
  );
}

export const lpa = (n: number) => (n ? `₹${(n / 1e5).toFixed(n % 1e5 ? 1 : 0)} LPA` : '—');
export const fmtDate = (
  d?: string | Date | null,
  opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }
) => (d ? new Date(d).toLocaleDateString('en-IN', opts) : '—');
export const fmtTime = (d?: string | Date | null) =>
  d ? new Date(d).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }) : '—';

/* ── Company logo ────────────────────────────────────────────────────────── */

const MONO = ['hsl(var(--primary))', '#0e7490', '#6d28d9', '#be123c', '#b45309', '#047857'];

/** Company logo from its website's icon; a quiet monogram when none exists. */
export function CompanyLogo({
  name,
  website,
  logo,
  size = 36,
  className,
}: {
  name: string;
  website?: string | null;
  /** A direct logo image, used before the website's icon. */
  logo?: string | null;
  size?: number;
  className?: string;
}) {
  const host = (() => {
    try {
      return website
        ? new URL(website.startsWith('http') ? website : `https://${website}`).hostname
        : '';
    } catch {
      return '';
    }
  })();
  const src = logo || (host ? `https://www.google.com/s2/favicons?domain=${host}&sz=128` : '');
  const [failed, setFailed] = useState(!src);
  useEffect(() => setFailed(!src), [src]);
  const initials = name
    .replace(/&/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-white',
        className
      )}
      style={{ width: size, height: size }}
      title={name}
    >
      {failed ? (
        <span
          className="flex h-full w-full items-center justify-center font-semibold text-white"
          style={{ background: MONO[name.length % MONO.length], fontSize: size * 0.36 }}
        >
          {initials}
        </span>
      ) : (
        <img
          src={src}
          alt=""
          className={logo ? 'h-full w-full object-cover' : 'h-[66%] w-[66%] object-contain'}
          onLoad={(e) => e.currentTarget.naturalWidth < 32 && setFailed(true)}
          onError={() => setFailed(true)}
        />
      )}
    </span>
  );
}

/* ── Pager ───────────────────────────────────────────────────────────────── */

export function Pager({
  page,
  total,
  limit,
  onPage,
}: {
  page: number;
  total: number;
  limit: number;
  onPage: (p: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / limit));
  if (total === 0) return null;
  const from = (page - 1) * limit + 1;
  const to = Math.min(total, page * limit);
  return (
    <div className="flex items-center justify-between border-t border-border/70 px-5 py-3 text-sm text-muted-foreground">
      <span>
        <span className="tabular-nums text-foreground">{from.toLocaleString('en-IN')}</span>–
        <span className="tabular-nums text-foreground">{to.toLocaleString('en-IN')}</span> of{' '}
        <span className="tabular-nums text-foreground">{total.toLocaleString('en-IN')}</span>
      </span>
      <span className="flex gap-1.5">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
          className="rounded-md border px-3 py-1 font-medium text-foreground transition hover:bg-muted disabled:pointer-events-none disabled:opacity-40"
        >
          Previous
        </button>
        <button
          type="button"
          disabled={page >= pages}
          onClick={() => onPage(page + 1)}
          className="rounded-md border px-3 py-1 font-medium text-foreground transition hover:bg-muted disabled:pointer-events-none disabled:opacity-40"
        >
          Next
        </button>
      </span>
    </div>
  );
}

/** Debounced value for search boxes. */
export function useDebounced<T>(value: T, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export function SkillTag({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium text-foreground/80">
      {children}
    </span>
  );
}

/* ── Job helpers ────────────────────────────────────────────────────────── */

export const jobPay = (j: {
  type?: string;
  salary?: { min?: number; max?: number };
  stipend?: { amount?: number };
}) => {
  if (j.type === 'internship' && j.stipend?.amount)
    return `₹${(j.stipend.amount / 1000).toFixed(0)}k / month`;
  const { min, max } = j.salary ?? {};
  if (!min && !max) return null;
  const l = (n: number) => (n / 1e5).toFixed(n % 1e5 ? 1 : 0);
  return min && max && min !== max ? `₹${l(min)}–${l(max)} LPA` : `₹${l(max || min || 0)} LPA`;
};

export const daysLeft = (d?: string | null) =>
  d ? Math.ceil((new Date(d).getTime() - Date.now()) / 86_400_000) : 0;

/* ── Feature cards (overview headline numbers) ─────────────────────────── */

/** A progress ring that fills when it scrolls into view. */
export function Ring({
  value,
  size = 72,
  stroke = 7,
  color,
  track = 'hsl(var(--muted))',
  children,
}: {
  value: number;
  size?: number;
  stroke?: number;
  color: string;
  track?: string;
  children?: ReactNode;
}) {
  const [ref, seen] = useInView<HTMLDivElement>();
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div ref={ref} className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={seen ? c * (1 - pct / 100) : c}
          style={{ transition: 'stroke-dashoffset 1.1s cubic-bezier(.2,.7,.2,1)' }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  );
}

/** Tiny bar chart; bars grow in when visible. */
export function MiniBars({
  data,
  color,
  height = 40,
  className,
}: {
  data: number[];
  color: string;
  height?: number;
  className?: string;
}) {
  const [ref, seen] = useInView<HTMLDivElement>();
  const max = Math.max(1, ...data);
  return (
    <div ref={ref} className={cn('flex items-end gap-[3px]', className)} style={{ height }}>
      {data.map((d, i) => (
        <span
          key={i}
          className="flex-1 rounded-t-[3px]"
          style={{
            height: seen ? `${Math.max(6, (d / max) * 100)}%` : '6%',
            background: color,
            opacity: 0.35 + 0.65 * (d / max),
            transition: `height .7s cubic-bezier(.2,.7,.2,1) ${i * 18}ms`,
          }}
        />
      ))}
    </div>
  );
}

/**
 * Headline card for overview pages: a soft accent glow, lift on hover, and a
 * `solid` variant (accent gradient, white text) for the one number that leads.
 */
export function FeatureCard({
  accent = 'career',
  solid,
  label,
  icon: Icon,
  children,
  className,
}: {
  accent?: Accent;
  solid?: boolean;
  label: string;
  icon?: LucideIcon;
  children: ReactNode;
  className?: string;
}) {
  const a = ACCENT[accent];
  const gradient =
    accent === 'health'
      ? 'linear-gradient(135deg,#0f766e 0%,#0d9488 45%,#14b8a6 100%)'
      : 'linear-gradient(135deg,#0b2a7a 0%,hsl(var(--primary)) 55%,#3b82f6 100%)';
  return (
    <div
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-xl p-5 transition duration-300 hover:-translate-y-0.5',
        solid ? 'text-white shadow-soft' : 'border bg-card shadow-xs hover:shadow-soft',
        className
      )}
      style={solid ? { background: gradient } : undefined}
    >
      {solid ? (
        <>
          <span className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full bg-white/15 blur-2xl" />
          <span
            className="pointer-events-none absolute inset-0 opacity-[0.12]"
            style={{
              backgroundImage:
                'radial-gradient(circle at 1px 1px, rgba(255,255,255,.9) 1px, transparent 0)',
              backgroundSize: '16px 16px',
              maskImage: 'linear-gradient(135deg, transparent 40%, #000)',
            }}
          />
        </>
      ) : (
        <span
          className="pointer-events-none absolute -right-12 -top-14 h-36 w-36 rounded-full opacity-[0.10] blur-2xl transition-opacity duration-300 group-hover:opacity-[0.18]"
          style={{ background: a.hex }}
        />
      )}
      <div className="relative flex items-center justify-between">
        <p
          className={cn(
            'text-[13px] font-medium',
            solid ? 'text-white/80' : 'text-muted-foreground'
          )}
        >
          {label}
        </p>
        {Icon && (
          <span
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-xl',
              solid ? 'bg-white/15 text-white' : cn(a.soft, a.text)
            )}
          >
            <Icon className="h-4 w-4" />
          </span>
        )}
      </div>
      <div className="relative mt-3 flex flex-1 flex-col">{children}</div>
    </div>
  );
}

/** The big number inside a FeatureCard. */
export function FeatureNumber({
  value,
  format,
  suffix,
}: {
  value: number;
  format?: (n: number) => string;
  suffix?: ReactNode;
}) {
  return (
    <p className="text-3xl font-bold leading-none tracking-tight tabular-nums">
      <Num value={value} format={format} />
      {suffix && <span className="ml-1.5 text-sm font-medium opacity-70">{suffix}</span>}
    </p>
  );
}
