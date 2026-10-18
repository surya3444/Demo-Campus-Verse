'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronRight, Search, Star, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useVisibleNav } from '@/components/layout/useVisibleNav';
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
  career: {
    hex: '#1e4fd8',
    soft: 'bg-blue-50 dark:bg-blue-500/10',
    text: 'text-blue-700 dark:text-blue-300',
    ring: 'ring-blue-600/15',
    bg: 'bg-blue-600',
    label: 'Career Connect',
  },
  health: {
    hex: '#0d9488',
    soft: 'bg-teal-50 dark:bg-teal-500/10',
    text: 'text-teal-700 dark:text-teal-300',
    ring: 'ring-teal-600/15',
    bg: 'bg-teal-600',
    label: 'Health Connect',
  },
};

/* ── Module bar: identity + the module's pages, shown on every page ─────── */

export function ModuleBar({ moduleId, accent }: { moduleId: string; accent: Accent }) {
  const pathname = usePathname() ?? '';
  const sections = useVisibleNav();
  const mod = sections.flatMap((s) => s.modules).find((m) => m.id === moduleId);
  const tabs =
    mod?.children ?? (mod?.href ? [{ name: mod.name, href: mod.href, icon: mod.icon }] : []);
  const a = ACCENT[accent];
  // Longest match wins; a tab like /alumni/directory also owns its siblings (/alumni/*)
  const score = (h: string) => {
    if (pathname === h || pathname.startsWith(`${h}/`)) return h.length;
    const parent = h.slice(0, h.lastIndexOf('/'));
    return parent.split('/').length > 2 && pathname.startsWith(`${parent}/`) ? parent.length : -1;
  };
  const activeHref = tabs
    .map((t) => t.href)
    .filter((h) => score(h) >= 0)
    .sort((x, y) => score(y) - score(x))[0];
  return (
    <div className="-mx-1 mb-6 border-b border-border/70">
      <div className="flex items-center gap-2 px-1 pb-3 text-[13px] text-muted-foreground">
        <span
          className={cn('flex h-6 w-6 items-center justify-center rounded-md text-white', a.bg)}
        >
          {mod?.icon ? <mod.icon className="h-3.5 w-3.5" /> : null}
        </span>
        <span className="font-semibold text-foreground">{a.label}</span>
        <Star className="h-3 w-3 fill-amber-400 text-amber-400" aria-label="Premium" />
      </div>
      <nav className="-mb-px flex gap-1 overflow-x-auto px-1 [scrollbar-width:none]">
        {tabs.map((t) => {
          const on = t.href === activeHref;
          const Icon = t.icon;
          return (
            <Link
              key={t.href}
              href={t.href}
              className={cn(
                'group inline-flex shrink-0 items-center gap-1.5 border-b-2 px-3 pb-2.5 pt-1 text-sm font-medium transition-colors',
                on
                  ? 'border-current text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
              style={on ? { color: undefined, borderColor: a.hex } : undefined}
            >
              {Icon && (
                <Icon
                  className={cn('h-4 w-4', on ? a.text : 'opacity-70 group-hover:opacity-100')}
                />
              )}
              {t.name === 'Dashboard' ? 'Overview' : t.name}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

/* ── Page header ─────────────────────────────────────────────────────────── */

export function PageTitle({
  title,
  description,
  actions,
  crumbs,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  crumbs?: Array<{ label: string; href?: string }>;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4 animate-fade-in">
      <div className="min-w-0 space-y-1">
        {crumbs && crumbs.length > 0 && (
          <nav className="flex items-center gap-1 text-xs text-muted-foreground">
            {crumbs.map((c, i) => (
              <span key={i} className="flex items-center gap-1">
                {i > 0 && <ChevronRight className="h-3 w-3" />}
                {c.href ? (
                  <Link href={c.href} className="hover:text-foreground">
                    {c.label}
                  </Link>
                ) : (
                  <span>{c.label}</span>
                )}
              </span>
            ))}
          </nav>
        )}
        <h1 className="font-display text-[26px] font-semibold leading-tight tracking-tight text-foreground">
          {title}
        </h1>
        {description && <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>}
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
    <section
      className={cn(
        'rounded-2xl border border-border/70 bg-card shadow-[0_1px_2px_rgba(16,24,40,0.04)]',
        className
      )}
    >
      {(title || action) && (
        <div className="flex items-start justify-between gap-3 px-5 pb-1 pt-5">
          <div>
            {title && (
              <h2 className="text-[15px] font-semibold tracking-tight text-foreground">{title}</h2>
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
    <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-medium text-muted-foreground">{label}</p>
        {Icon && (
          <span className={cn('flex h-7 w-7 items-center justify-center rounded-lg', a.soft)}>
            <Icon className={cn('h-4 w-4', a.text)} />
          </span>
        )}
      </div>
      <p className="mt-2 font-display text-[28px] font-semibold leading-none tracking-tight tabular-nums text-foreground">
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
  teal: 'bg-teal-50 text-teal-700 ring-teal-600/15 dark:bg-teal-500/10 dark:text-teal-300',
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

const MONO = ['#1e4fd8', '#0e7490', '#6d28d9', '#be123c', '#b45309', '#047857'];

/** Company logo from its website's icon; a quiet monogram when none exists. */
export function CompanyLogo({
  name,
  website,
  size = 36,
  className,
}: {
  name: string;
  website?: string | null;
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
  const [failed, setFailed] = useState(!host);
  useEffect(() => setFailed(!host), [host]);
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
        'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border/70 bg-white',
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
          src={`https://www.google.com/s2/favicons?domain=${host}&sz=128`}
          alt=""
          className="h-[66%] w-[66%] object-contain"
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
          className="rounded-md border border-border/70 px-3 py-1 font-medium text-foreground transition hover:bg-muted disabled:pointer-events-none disabled:opacity-40"
        >
          Previous
        </button>
        <button
          type="button"
          disabled={page >= pages}
          onClick={() => onPage(page + 1)}
          className="rounded-md border border-border/70 px-3 py-1 font-medium text-foreground transition hover:bg-muted disabled:pointer-events-none disabled:opacity-40"
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
  return <span className="inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium text-foreground/80">{children}</span>;
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
