'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowRight,
  BedDouble,
  BookOpen,
  Building2,
  Bus,
  CalendarDays,
  ClipboardList,
  Clock,
  CornerDownLeft,
  FileText,
  GraduationCap,
  Layers,
  Loader2,
  MapPin,
  Megaphone,
  Receipt,
  Search,
  Settings,
  UserPlus,
  UserRound,
  Wallet,
  X,
  type LucideIcon,
} from 'lucide-react';
import { Command as CommandPrimitive } from 'cmdk';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { searchApi, type SearchHit } from '@/lib/api';
import { cn, formatCurrency } from '@/lib/utils';
import { useAuthStore } from '@/store/authStore';
import { useBranchStore } from '@/store/branchStore';
import { useVisibleNav } from '@/components/layout/useVisibleNav';

// ── Pages from the user's own menu ──────────────────────────────────────────

interface PageEntry {
  key: string;
  label: string;
  crumb?: string;
  href: string;
  icon: LucideIcon;
  kind: 'page' | 'settings';
}

/** Rank a page: exact > starts-with > word-start > contains > in-order letters. */
function scorePage(entry: PageEntry, q: string): number {
  const label = entry.label.toLowerCase();
  const full = `${entry.crumb ?? ''} ${entry.label}`.toLowerCase();
  if (label === q) return 100;
  if (label.startsWith(q)) return 80;
  if (label.split(/\s+/).some((w) => w.startsWith(q))) return 60;
  if (full.includes(q)) return 40;
  // "fc" → "Fee Counter": the label's word initials.
  const initials = label
    .split(/\s+/)
    .map((w) => w[0])
    .join('');
  return initials.startsWith(q) ? 10 : 0;
}

function usePageEntries(): PageEntry[] {
  const sections = useVisibleNav();
  return useMemo(() => {
    const out: PageEntry[] = [];
    for (const section of sections) {
      for (const m of section.modules) {
        if (m.href) {
          out.push({ key: m.href, label: m.name, href: m.href, icon: m.icon, kind: 'page' });
        }
        for (const c of m.children ?? []) {
          out.push({
            key: c.href,
            label: c.name,
            crumb: m.name,
            href: c.href,
            icon: c.icon,
            // Organization pages (users, roles, custom fields…) are setup, not daily work.
            kind: c.name === 'Settings' || m.id === 'organization' ? 'settings' : 'page',
          });
        }
        if (m.settingsHref) {
          out.push({
            key: m.settingsHref,
            label: `${m.name} settings`,
            crumb: m.name,
            href: m.settingsHref,
            icon: Settings,
            kind: 'settings',
          });
        }
      }
    }
    out.push({
      key: '/profile',
      label: 'My profile',
      crumb: 'Account',
      href: '/profile',
      icon: UserRound,
      kind: 'settings',
    });
    // The same page can sit under two modules (e.g. Departments); keep one.
    return out.filter((e, i) => out.findIndex((x) => x.href === e.href) === i);
  }, [sections]);
}

// ── Recent picks (this browser only; storage may be blocked) ───────────────

const RECENT_KEY = 'cv-search-recent';
const RECENT_MAX = 6;
type Recent = {
  key: string;
  title: string;
  subtitle?: string;
  href: string;
  group: string;
  hitId?: string;
};

function readRecent(): Recent[] {
  try {
    const v = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]');
    return Array.isArray(v) ? (v as Recent[]) : [];
  } catch {
    return [];
  }
}
function writeRecent(list: Recent[]) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(list));
  } catch {
    // storage blocked: recents are a nicety
  }
}

const RECENT_LOOK: Record<string, { icon: LucideIcon; tone: string }> = {
  students: {
    icon: GraduationCap,
    tone: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
  },
  staff: {
    icon: UserRound,
    tone: 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300',
  },
  receipts: {
    icon: Receipt,
    tone: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  },
  admissions: {
    icon: ClipboardList,
    tone: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300',
  },
  academics: {
    icon: BookOpen,
    tone: 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300',
  },
  exams: {
    icon: FileText,
    tone: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300',
  },
  courses: {
    icon: BookOpen,
    tone: 'bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300',
  },
  transport: {
    icon: Bus,
    tone: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  },
  hostel: {
    icon: BedDouble,
    tone: 'bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-500/15 dark:text-fuchsia-300',
  },
  feeStructures: {
    icon: Wallet,
    tone: 'bg-lime-100 text-lime-700 dark:bg-lime-500/15 dark:text-lime-300',
  },
  communications: {
    icon: Megaphone,
    tone: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-300',
  },
  campuses: {
    icon: Building2,
    tone: 'bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-300',
  },
};

// ── Small display helpers ───────────────────────────────────────────────────

function Highlight({ text, query }: { text: string; query: string }) {
  if (!text) return null;
  const i = query ? text.toLowerCase().indexOf(query.toLowerCase()) : -1;
  if (i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <mark className="rounded-[3px] bg-[hsl(var(--brand-cyan,199_89%_48%)/0.18)] font-semibold text-primary dark:text-sky-300">
        {text.slice(i, i + query.length)}
      </mark>
      {text.slice(i + query.length)}
    </>
  );
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');

function Avatar({ name, photo, tone }: { name: string; photo?: unknown; tone: string }) {
  if (typeof photo === 'string' && photo) {
    return <img src={photo} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" />;
  }
  return (
    <div
      className={cn(
        'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
        tone
      )}
    >
      {initials(name) || '?'}
    </div>
  );
}

function Chip({ children, mono, tone }: { children: ReactNode; mono?: boolean; tone?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] leading-none',
        mono && 'font-mono',
        tone ?? 'bg-muted text-muted-foreground'
      )}
    >
      {children}
    </span>
  );
}

function IconTile({ icon: Icon, tone }: { icon: LucideIcon; tone: string }) {
  return (
    <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', tone)}>
      <Icon className="h-4 w-4" />
    </div>
  );
}

const STATUS_TONE: Record<string, string> = {
  active: 'bg-emerald-500',
  published: 'bg-emerald-500',
  success: 'bg-emerald-500',
  draft: 'bg-slate-400',
  inactive: 'bg-slate-400',
  alumni: 'bg-sky-500',
  failed: 'bg-red-500',
};

const fmtDate = (v: unknown) =>
  v
    ? new Date(v as string).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : '';

const s = (v: unknown) => (v === undefined || v === null ? '' : String(v));

// ── One renderer per result group ───────────────────────────────────────────

type Renderer = (hit: SearchHit, q: string) => ReactNode;

const GROUPS: Array<{ key: string; label: string; render: Renderer }> = [
  {
    key: 'students',
    label: 'Students',
    render: (h, q) => (
      <>
        <Avatar name={h.title} photo={h.meta?.photo} tone="bg-blue-100 text-blue-700" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-medium">
              <Highlight text={h.title} query={q} />
            </span>
            <span
              className={cn(
                'h-1.5 w-1.5 shrink-0 rounded-full',
                STATUS_TONE[s(h.meta?.status)] ?? 'bg-slate-300'
              )}
              title={s(h.meta?.status)}
            />
            {Boolean(h.meta?.exact) && (
              <Chip tone="bg-emerald-100 text-emerald-700">Exact match</Chip>
            )}
          </div>
          <p className="truncate text-xs text-muted-foreground">
            {[
              s(h.meta?.className).split(' · ').slice(-2).join(' · '),
              h.meta?.sectionName && `Section ${s(h.meta.sectionName)}`,
            ]
              .filter(Boolean)
              .join(' · ') || 'No class assigned'}
          </p>
        </div>
        <div className="hidden shrink-0 flex-col items-end gap-1 sm:flex">
          {Boolean(h.meta?.rollNumber) && (
            <Chip mono>
              Roll <Highlight text={s(h.meta?.rollNumber)} query={q} />
            </Chip>
          )}
          {Boolean(h.meta?.admissionNumber) && (
            <Chip mono>
              <Highlight text={s(h.meta?.admissionNumber)} query={q} />
            </Chip>
          )}
        </div>
      </>
    ),
  },
  {
    key: 'staff',
    label: 'Staff',
    render: (h, q) => (
      <>
        <Avatar name={h.title} photo={h.meta?.photo} tone="bg-violet-100 text-violet-700" />
        <div className="min-w-0 flex-1">
          <span className="truncate font-medium">
            <Highlight text={h.title} query={q} />
          </span>
          <p className="truncate text-xs text-muted-foreground">
            {[h.meta?.designation, h.meta?.department].filter(Boolean).join(' · ') ||
              s(h.meta?.email)}
          </p>
        </div>
        {Boolean(h.meta?.employeeId) && (
          <Chip mono>
            <Highlight text={s(h.meta?.employeeId)} query={q} />
          </Chip>
        )}
      </>
    ),
  },
  {
    key: 'receipts',
    label: 'Fee receipts',
    render: (h, q) => (
      <>
        <IconTile icon={Receipt} tone="bg-emerald-100 text-emerald-700" />
        <div className="min-w-0 flex-1">
          <span className="font-mono text-sm font-medium">
            <Highlight text={h.title} query={q} />
          </span>
          <p className="truncate text-xs text-muted-foreground">
            {[h.subtitle, fmtDate(h.meta?.date)].filter(Boolean).join(' · ')}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className="text-sm font-semibold tabular-nums">
            {formatCurrency(Number(h.meta?.amount ?? 0))}
          </span>
          <Chip>{s(h.meta?.mode).toUpperCase()}</Chip>
        </div>
      </>
    ),
  },
  {
    key: 'admissions',
    label: 'Admissions',
    render: (h, q) => {
      const isLead = h.meta?.kind === 'lead';
      return (
        <>
          <IconTile
            icon={isLead ? UserPlus : ClipboardList}
            tone={isLead ? 'bg-orange-100 text-orange-700' : 'bg-indigo-100 text-indigo-700'}
          />
          <div className="min-w-0 flex-1">
            <span className="truncate font-medium">
              <Highlight text={h.title} query={q} />
            </span>
            <p className="truncate text-xs text-muted-foreground">
              {isLead ? 'Lead' : 'Application'}
              {h.meta?.number ? ` · ${s(h.meta.number)}` : ''}
            </p>
          </div>
          {Boolean(h.meta?.stage) && <Chip>{s(h.meta?.stage).replace(/_/g, ' ')}</Chip>}
        </>
      );
    },
  },
  {
    key: 'academics',
    label: 'Programs, subjects & classes',
    render: (h, q) => {
      const kind = s(h.meta?.kind);
      const icon = { program: GraduationCap, subject: BookOpen, department: Building2 }[kind];
      const detail =
        kind === 'program'
          ? [
              s(h.meta?.degreeType).toUpperCase(),
              h.meta?.years && `${s(h.meta.years)} yrs`,
              h.meta?.terms && `${s(h.meta.terms)} terms`,
            ]
          : kind === 'subject'
            ? [s(h.meta?.type), h.meta?.credits && `${s(h.meta.credits)} credits`]
            : [];
      return (
        <>
          <IconTile icon={icon ?? Layers} tone="bg-sky-100 text-sky-700" />
          <div className="min-w-0 flex-1">
            <span className="truncate font-medium">
              <Highlight text={h.title} query={q} />
            </span>
            <p className="truncate text-xs capitalize text-muted-foreground">
              {[kind, ...detail].filter(Boolean).join(' · ')}
            </p>
          </div>
          {Boolean(h.meta?.code) && (
            <Chip mono>
              <Highlight text={s(h.meta?.code)} query={q} />
            </Chip>
          )}
        </>
      );
    },
  },
  {
    key: 'exams',
    label: 'Exams',
    render: (h, q) => (
      <>
        <IconTile icon={FileText} tone="bg-rose-100 text-rose-700" />
        <div className="min-w-0 flex-1">
          <span className="truncate font-medium">
            <Highlight text={h.title} query={q} />
          </span>
          <p className="truncate text-xs text-muted-foreground">
            {[s(h.meta?.type), fmtDate(h.meta?.date)].filter(Boolean).join(' · ')}
          </p>
        </div>
        <Chip>{s(h.meta?.status)}</Chip>
      </>
    ),
  },
  {
    key: 'courses',
    label: 'Online courses',
    render: (h, q) => (
      <>
        <IconTile icon={BookOpen} tone="bg-teal-100 text-teal-700" />
        <div className="min-w-0 flex-1">
          <span className="truncate font-medium">
            <Highlight text={h.title} query={q} />
          </span>
          <p className="text-xs text-muted-foreground">
            {s(h.meta?.enrolled || 0)} enrolled · {s(h.meta?.status)}
          </p>
        </div>
      </>
    ),
  },
  {
    key: 'transport',
    label: 'Transport',
    render: (h, q) => {
      const cap = Number(h.meta?.capacity ?? 0);
      const used = Number(h.meta?.enrolled ?? 0);
      return (
        <>
          <IconTile icon={Bus} tone="bg-amber-100 text-amber-700" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-semibold">
                <Highlight text={h.title} query={q} />
              </span>
              <span className="truncate text-sm text-muted-foreground">
                <Highlight text={h.subtitle ?? ''} query={q} />
              </span>
            </div>
            <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
              {h.meta?.matchedStop ? (
                <>
                  <MapPin className="h-3 w-3" />
                  <Highlight text={s(h.meta.matchedStop)} query={q} />
                </>
              ) : (
                `${s(h.meta?.stops)} stops${h.meta?.driver ? ` · ${s(h.meta.driver)}` : ''}`
              )}
            </p>
          </div>
          <div className="w-20 shrink-0">
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-amber-500"
                style={{ width: `${cap ? Math.min(100, (used / cap) * 100) : 0}%` }}
              />
            </div>
            <p className="mt-1 text-right text-[11px] tabular-nums text-muted-foreground">
              {used}/{cap} seats
            </p>
          </div>
        </>
      );
    },
  },
  {
    key: 'hostel',
    label: 'Hostels',
    render: (h, q) => (
      <>
        <IconTile icon={BedDouble} tone="bg-fuchsia-100 text-fuchsia-700" />
        <div className="min-w-0 flex-1">
          <span className="truncate font-medium">
            <Highlight text={h.title} query={q} />
          </span>
          <p className="text-xs capitalize text-muted-foreground">
            {[s(h.meta?.type), h.meta?.beds && `${s(h.meta.occupied ?? 0)}/${s(h.meta.beds)} beds`]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
        {Boolean(h.meta?.code) && <Chip mono>{s(h.meta?.code)}</Chip>}
      </>
    ),
  },
  {
    key: 'feeStructures',
    label: 'Fee structures',
    render: (h, q) => (
      <>
        <IconTile icon={Wallet} tone="bg-lime-100 text-lime-700" />
        <div className="min-w-0 flex-1">
          <span className="truncate font-medium">
            <Highlight text={h.title} query={q} />
          </span>
          <p className="text-xs capitalize text-muted-foreground">{s(h.meta?.category)}</p>
        </div>
        <span className="text-sm font-semibold tabular-nums">
          {formatCurrency(Number(h.meta?.amount ?? 0))}
        </span>
      </>
    ),
  },
  {
    key: 'communications',
    label: 'Announcements & events',
    render: (h, q) => {
      const isEvent = h.meta?.kind === 'event';
      return (
        <>
          <IconTile icon={isEvent ? CalendarDays : Megaphone} tone="bg-cyan-100 text-cyan-700" />
          <div className="min-w-0 flex-1">
            <span className="truncate font-medium">
              <Highlight text={h.title} query={q} />
            </span>
            <p className="text-xs text-muted-foreground">
              {isEvent ? 'Event' : 'Announcement'}
              {h.meta?.date ? ` · ${fmtDate(h.meta.date)}` : ''}
            </p>
          </div>
        </>
      );
    },
  },
  {
    key: 'campuses',
    label: 'Switch campus',
    render: (h, q) => (
      <>
        <IconTile icon={Building2} tone="bg-slate-100 text-slate-700" />
        <div className="min-w-0 flex-1">
          <span className="truncate font-medium">
            <Highlight text={h.title} query={q} />
          </span>
          <p className="text-xs capitalize text-muted-foreground">
            {[s(h.meta?.type), s(h.meta?.city)].filter(Boolean).join(' · ')}
          </p>
        </div>
        {Boolean(h.meta?.code) && <Chip mono>{s(h.meta?.code)}</Chip>}
      </>
    ),
  },
];

const itemClass =
  'group/item relative flex cursor-pointer select-none items-center gap-3 rounded-xl px-3 py-2.5 text-sm outline-none transition-colors before:absolute before:inset-y-2 before:left-0 before:w-[3px] before:rounded-full before:bg-primary before:opacity-0 before:transition-opacity data-[selected=true]:bg-primary/[0.06] data-[selected=true]:before:opacity-100 dark:data-[selected=true]:bg-primary/20';
const groupClass =
  'motion-safe:animate-fade-in [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pb-1.5 [&_[cmdk-group-heading]]:pt-4 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.12em] [&_[cmdk-group-heading]]:text-muted-foreground';

/** Group heading with a result count. */
const heading = (label: string, n: number) => (
  <span className="flex items-center gap-2">
    {label}
    <span className="rounded-full bg-muted px-1.5 py-px text-[10px] font-semibold tabular-nums tracking-normal">
      {n}
    </span>
  </span>
);

// ── The palette ─────────────────────────────────────────────────────────────

export function GlobalSearch() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const isStudent = useAuthStore((st) => st.user?.roleCode === 'STUDENT');
  const selectedBranchId = useBranchStore((st) => st.selectedBranchId);
  const setSelectedBranchId = useBranchStore((st) => st.setSelectedBranchId);
  const pages = usePageEntries();

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [recent, setRecent] = useState<Recent[]>([]);

  // ⌘K / Ctrl+K anywhere, and "/" when not typing in a field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test((e.target as HTMLElement)?.tagName ?? '');
      if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !typing)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (open) setRecent(readRecent());
    else setQuery('');
  }, [open]);

  const remember = (item: Recent) =>
    writeRecent([item, ...readRecent().filter((r) => r.key !== item.key)].slice(0, RECENT_MAX));
  const forget = (key?: string) => {
    const next = key ? recent.filter((r) => r.key !== key) : [];
    setRecent(next);
    writeRecent(next);
  };

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 200);
    return () => clearTimeout(t);
  }, [query]);

  const q = query.trim();
  const remoteEnabled = open && !isStudent && debounced.length >= 2;
  const { data: remote, isFetching } = useQuery({
    queryKey: ['global-search', debounced, selectedBranchId],
    queryFn: () => searchApi.search(debounced).then((r) => r.data),
    enabled: remoteEnabled,
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });

  const pageHits = useMemo(() => {
    if (!q) return [];
    const lq = q.toLowerCase();
    return pages
      .map((p) => ({ p, score: scorePage(p, lq) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((x) => x.p);
  }, [pages, q]);
  const pageResults = pageHits.filter((p) => p.kind === 'page').slice(0, 6);
  const settingsResults = pageHits.filter((p) => p.kind === 'settings').slice(0, 4);

  // A few everyday pages to jump to before typing.
  const quick = useMemo(() => pages.filter((p) => p.kind === 'page').slice(0, 6), [pages]);

  const go = useCallback(
    (href: string, group?: string, hitId?: string) => {
      setOpen(false);
      if (group === 'campuses' && hitId) {
        setSelectedBranchId(hitId);
        queryClient.invalidateQueries();
        return;
      }
      router.push(href);
    },
    [router, queryClient, setSelectedBranchId]
  );

  const remoteGroups = remoteEnabled && remote ? GROUPS.filter((g) => remote[g.key]?.length) : [];
  const nothing =
    q.length > 0 &&
    !pageResults.length &&
    !settingsResults.length &&
    !remoteGroups.length &&
    !(isFetching || debounced !== q);

  const pageItem = (p: PageEntry) => (
    <CommandPrimitive.Item
      key={`page:${p.key}`}
      value={`page:${p.key}`}
      onSelect={() => {
        remember({
          key: `page:${p.href}`,
          title: p.label,
          subtitle: p.crumb,
          href: p.href,
          group: 'page',
        });
        go(p.href);
      }}
      className={itemClass}
    >
      <IconTile icon={p.icon} tone="bg-primary/10 text-primary" />
      <div className="min-w-0 flex-1">
        <span className="truncate font-medium">
          <Highlight text={p.label} query={q} />
        </span>
        {p.crumb && <p className="truncate text-xs text-muted-foreground">{p.crumb}</p>}
      </div>
      <ArrowRight className="h-4 w-4 shrink-0 -translate-x-1 text-primary opacity-0 transition-all group-data-[selected=true]/item:translate-x-0 group-data-[selected=true]/item:opacity-100" />
    </CommandPrimitive.Item>
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-10 w-[200px] items-center gap-3 rounded-xl bg-muted/50 px-4 text-sm text-muted-foreground transition-colors hover:bg-muted sm:w-[320px] lg:w-[400px]"
        aria-label="Search"
      >
        <Search className="h-4 w-4 shrink-0" />
        <span className="flex-1 truncate text-left">
          {isStudent ? 'Search pages…' : 'Search students, roll no., staff, pages…'}
        </span>
        <kbd className="hidden h-6 items-center gap-1 rounded-md border bg-white px-2 text-xs sm:inline-flex">
          <span className="text-xs">⌘</span>K
        </kbd>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="top-[10vh] max-w-2xl translate-y-0 gap-0 overflow-hidden rounded-2xl border-0 p-0 shadow-2xl ring-1 ring-primary/10 [&>button]:hidden">
          <DialogTitle className="sr-only">Search</DialogTitle>
          <CommandPrimitive shouldFilter={false} loop className="flex flex-col">
            <div className="relative flex items-center gap-3 border-b bg-gradient-to-b from-primary/[0.04] to-transparent px-4 py-1">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
                {isFetching ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
              </span>
              <CommandPrimitive.Input
                autoFocus
                value={query}
                onValueChange={setQuery}
                placeholder={
                  isStudent
                    ? 'Search pages…'
                    : 'Search by name, roll no., admission no., receipt, bus, course…'
                }
                className="h-14 flex-1 border-0 bg-transparent text-base shadow-none outline-none ring-0 placeholder:text-muted-foreground/70 focus:outline-none ![box-shadow:none] focus-visible:outline-none"
              />
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md border bg-background px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground shadow-sm hover:text-foreground"
              >
                esc
              </button>
            </div>

            <CommandPrimitive.List className="max-h-[calc(70vh-7.5rem)] overflow-y-auto overscroll-contain px-2 pb-2">
              {!q && recent.length > 0 && (
                <div className="px-2 pt-4 motion-safe:animate-fade-in">
                  <div className="flex items-center justify-between px-1 pb-1.5">
                    <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" />
                      Recent
                    </p>
                    <button
                      type="button"
                      onClick={() => forget()}
                      className="rounded-md px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                    >
                      Clear all
                    </button>
                  </div>
                  <CommandPrimitive.Group>
                    {recent.map((r, i) => {
                      const page = pages.find((p) => p.href === r.href);
                      const look =
                        RECENT_LOOK[r.group] ??
                        (r.group === 'page' || r.group === 'settings'
                          ? { icon: page?.icon ?? Layers, tone: 'bg-primary/10 text-primary' }
                          : { icon: Clock, tone: 'bg-muted text-muted-foreground' });
                      return (
                        <CommandPrimitive.Item
                          key={r.key}
                          value={`recent:${r.key}`}
                          onSelect={() => {
                            remember(r);
                            go(r.href, r.group, r.hitId);
                          }}
                          className={cn(
                            itemClass,
                            'py-2 motion-safe:animate-fade-up [animation-fill-mode:both]'
                          )}
                          style={{ animationDelay: `${i * 30}ms` }}
                        >
                          {r.group === 'students' || r.group === 'staff' ? (
                            <Avatar name={r.title} tone={look.tone} />
                          ) : (
                            <IconTile icon={look.icon} tone={look.tone} />
                          )}
                          <div className="min-w-0 flex-1">
                            <span className="block truncate font-medium">{r.title}</span>
                            {r.subtitle && (
                              <span className="block truncate text-xs text-muted-foreground">
                                {r.subtitle}
                              </span>
                            )}
                          </div>
                          <button
                            type="button"
                            aria-label={`Remove ${r.title} from recent`}
                            title="Remove from recent"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              forget(r.key);
                            }}
                            onPointerDown={(e) => e.stopPropagation()}
                            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted-foreground/60 opacity-0 transition-all hover:bg-destructive/10 hover:text-destructive focus-visible:opacity-100 group-hover/item:opacity-100 group-data-[selected=true]/item:opacity-100 [@media(hover:none)]:opacity-100"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </CommandPrimitive.Item>
                      );
                    })}
                  </CommandPrimitive.Group>
                </div>
              )}

              {!q && (
                <div className="px-2 pb-2 pt-4 motion-safe:animate-fade-in">
                  <p className="px-1 pb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Jump to
                  </p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {quick.map((p, i) => (
                      <CommandPrimitive.Item
                        key={p.key}
                        value={`quick:${p.key}`}
                        onSelect={() => go(p.href)}
                        className="group/item flex cursor-pointer items-center gap-2.5 rounded-xl border bg-card p-2.5 text-sm outline-none transition-all hover:-translate-y-px hover:shadow-sm data-[selected=true]:border-primary/40 data-[selected=true]:bg-primary/[0.05] motion-safe:animate-fade-up [animation-fill-mode:both]"
                        style={{ animationDelay: `${i * 35}ms` }}
                      >
                        <IconTile icon={p.icon} tone="bg-primary/10 text-primary" />
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{p.label}</span>
                          {p.crumb && (
                            <span className="block truncate text-[11px] text-muted-foreground">
                              {p.crumb}
                            </span>
                          )}
                        </span>
                      </CommandPrimitive.Item>
                    ))}
                  </div>
                  {!isStudent && (
                    <div className="mt-4 rounded-xl bg-muted/50 px-3 py-3">
                      <p className="text-xs font-medium">Search across your campus</p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {[
                          [GraduationCap, 'Students & roll no.'],
                          [UserRound, 'Staff'],
                          [Receipt, 'Fee receipts'],
                          [ClipboardList, 'Admissions'],
                          [BookOpen, 'Programs & subjects'],
                          [FileText, 'Exams'],
                          [Bus, 'Buses & stops'],
                          [Megaphone, 'Announcements'],
                        ].map(([Icon, label]) => {
                          const I = Icon as LucideIcon;
                          return (
                            <span
                              key={label as string}
                              className="inline-flex items-center gap-1 rounded-full border bg-background px-2 py-0.5 text-[11px] text-muted-foreground"
                            >
                              <I className="h-3 w-3 text-primary" />
                              {label as string}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {pageResults.length > 0 && (
                <CommandPrimitive.Group
                  heading={heading('Pages', pageResults.length)}
                  className={groupClass}
                >
                  {pageResults.map(pageItem)}
                </CommandPrimitive.Group>
              )}

              {remoteGroups.map((g) => (
                <CommandPrimitive.Group
                  key={g.key}
                  heading={heading(g.label, remote?.[g.key]?.length ?? 0)}
                  className={groupClass}
                >
                  {(remote?.[g.key] ?? []).map((hit) => (
                    <CommandPrimitive.Item
                      key={`${g.key}:${hit.id}`}
                      value={`${g.key}:${hit.id}`}
                      onSelect={() => {
                        remember({
                          key: `${g.key}:${hit.id}`,
                          title: hit.title,
                          subtitle: g.label,
                          href: hit.href,
                          group: g.key,
                          hitId: hit.id,
                        });
                        go(hit.href, g.key, hit.id);
                      }}
                      className={itemClass}
                    >
                      {g.render(hit, q)}
                    </CommandPrimitive.Item>
                  ))}
                </CommandPrimitive.Group>
              ))}

              {settingsResults.length > 0 && (
                <CommandPrimitive.Group
                  heading={heading('Settings', settingsResults.length)}
                  className={groupClass}
                >
                  {settingsResults.map(pageItem)}
                </CommandPrimitive.Group>
              )}

              {q.length === 1 && !isStudent && (
                <p className="px-3 py-3 text-xs text-muted-foreground">
                  Keep typing to search records…
                </p>
              )}

              {nothing && (
                <div className="flex flex-col items-center px-3 py-10 text-center motion-safe:animate-fade-in">
                  <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                    <Search className="h-5 w-5" />
                  </span>
                  <p className="text-sm font-medium">No results for “{q}”</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Only records you have access to in the current campus are searched.
                  </p>
                </div>
              )}
            </CommandPrimitive.List>

            <div className="flex shrink-0 items-center gap-4 border-t bg-muted/40 px-4 py-2.5 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded-md border bg-background px-1 shadow-sm">
                  ↑
                </kbd>
                <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded-md border bg-background px-1 shadow-sm">
                  ↓
                </kbd>
                navigate
              </span>
              <span className="flex items-center gap-1.5">
                <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded-md border bg-background px-1 shadow-sm">
                  <CornerDownLeft className="h-3 w-3" />
                </kbd>
                open
              </span>
              <span className="ml-auto hidden items-center gap-1.5 sm:inline-flex">
                <span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--brand-cyan,199_89%_48%))]" />
                Results follow your role and access
              </span>
            </div>
          </CommandPrimitive>
        </DialogContent>
      </Dialog>
    </>
  );
}
