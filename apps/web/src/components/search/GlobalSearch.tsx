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
  // "fc" → "Fee Counter": every letter, in order.
  let i = 0;
  for (const ch of full) if (ch === q[i]) i++;
  return i === q.length ? 10 : 0;
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

// ── Recent picks (per browser, best effort) ─────────────────────────────────

const RECENT_KEY = 'cv-search-recent';
type Recent = { key: string; title: string; subtitle?: string; href: string; group: string };

function readRecent(): Recent[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]') as Recent[];
  } catch {
    return [];
  }
}
function pushRecent(item: Recent) {
  try {
    const next = [item, ...readRecent().filter((r) => r.key !== item.key)].slice(0, 6);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // storage blocked: recents are a nicety
  }
}

// ── Small display helpers ───────────────────────────────────────────────────

function Highlight({ text, query }: { text: string; query: string }) {
  if (!text) return null;
  const i = query ? text.toLowerCase().indexOf(query.toLowerCase()) : -1;
  if (i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <mark className="rounded-sm bg-amber-200/70 px-0.5 text-inherit dark:bg-amber-500/30">
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
            {[h.meta?.className, h.meta?.sectionName && `Section ${s(h.meta.sectionName)}`]
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
  'flex cursor-pointer select-none items-center gap-3 rounded-lg px-3 py-2 text-sm outline-none data-[selected=true]:bg-accent/10 data-[selected=true]:text-foreground';
const groupClass =
  '[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-muted-foreground';

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

  const go = useCallback(
    (href: string, recentItem: Recent, group?: string, hitId?: string) => {
      pushRecent(recentItem);
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
      onSelect={() =>
        go(p.href, {
          key: `page:${p.key}`,
          title: p.label,
          subtitle: p.crumb,
          href: p.href,
          group: p.kind,
        })
      }
      className={itemClass}
    >
      <IconTile icon={p.icon} tone="bg-primary/10 text-primary" />
      <div className="min-w-0 flex-1">
        <span className="truncate font-medium">
          <Highlight text={p.label} query={q} />
        </span>
        {p.crumb && <p className="truncate text-xs text-muted-foreground">{p.crumb}</p>}
      </div>
      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground/60" />
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
        <DialogContent className="top-[12vh] max-w-2xl translate-y-0 gap-0 overflow-hidden p-0 [&>button]:hidden">
          <DialogTitle className="sr-only">Search</DialogTitle>
          <CommandPrimitive shouldFilter={false} loop className="flex flex-col">
            <div className="flex items-center gap-3 border-b px-4">
              <Search className="h-5 w-5 shrink-0 text-muted-foreground" />
              <CommandPrimitive.Input
                autoFocus
                value={query}
                onValueChange={setQuery}
                placeholder={
                  isStudent
                    ? 'Search pages…'
                    : 'Search by name, roll no., admission no., receipt, bus, course…'
                }
                className="h-14 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted-foreground"
              />
              {isFetching && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
              <kbd className="rounded-md border px-1.5 py-0.5 text-[11px] text-muted-foreground">
                esc
              </kbd>
            </div>

            <CommandPrimitive.List className="max-h-[60vh] overflow-y-auto overscroll-contain px-2 pb-2">
              {!q && recent.length > 0 && (
                <CommandPrimitive.Group heading="Recent" className={groupClass}>
                  {recent.map((r) => (
                    <CommandPrimitive.Item
                      key={r.key}
                      value={`recent:${r.key}`}
                      onSelect={() => go(r.href, r)}
                      className={itemClass}
                    >
                      <IconTile icon={Clock} tone="bg-muted text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <span className="truncate font-medium">{r.title}</span>
                        {r.subtitle && (
                          <p className="truncate text-xs text-muted-foreground">{r.subtitle}</p>
                        )}
                      </div>
                    </CommandPrimitive.Item>
                  ))}
                </CommandPrimitive.Group>
              )}

              {!q && (
                <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                  {isStudent ? (
                    'Type to jump to any page in your portal.'
                  ) : (
                    <>
                      Search everything you have access to: students by name or roll number, staff,
                      fee receipts, admissions, programs, subjects, exams, buses and every page and
                      setting.
                    </>
                  )}
                </div>
              )}

              {pageResults.length > 0 && (
                <CommandPrimitive.Group heading="Pages" className={groupClass}>
                  {pageResults.map(pageItem)}
                </CommandPrimitive.Group>
              )}

              {remoteGroups.map((g) => (
                <CommandPrimitive.Group key={g.key} heading={g.label} className={groupClass}>
                  {(remote?.[g.key] ?? []).map((hit) => (
                    <CommandPrimitive.Item
                      key={`${g.key}:${hit.id}`}
                      value={`${g.key}:${hit.id}`}
                      onSelect={() =>
                        go(
                          hit.href,
                          {
                            key: `${g.key}:${hit.id}`,
                            title: hit.title,
                            subtitle: g.label,
                            href: hit.href,
                            group: g.key,
                          },
                          g.key,
                          hit.id
                        )
                      }
                      className={itemClass}
                    >
                      {g.render(hit, q)}
                    </CommandPrimitive.Item>
                  ))}
                </CommandPrimitive.Group>
              ))}

              {settingsResults.length > 0 && (
                <CommandPrimitive.Group heading="Settings" className={groupClass}>
                  {settingsResults.map(pageItem)}
                </CommandPrimitive.Group>
              )}

              {q.length === 1 && !isStudent && (
                <p className="px-3 py-3 text-xs text-muted-foreground">
                  Keep typing to search records…
                </p>
              )}

              {nothing && (
                <div className="px-3 py-10 text-center">
                  <p className="text-sm font-medium">No results for “{q}”</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Only records you have access to in the current campus are searched.
                  </p>
                </div>
              )}
            </CommandPrimitive.List>

            <div className="flex items-center gap-4 border-t bg-muted/30 px-4 py-2 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <kbd className="rounded border bg-background px-1">↑</kbd>
                <kbd className="rounded border bg-background px-1">↓</kbd> navigate
              </span>
              <span className="flex items-center gap-1">
                <kbd className="rounded border bg-background px-1">
                  <CornerDownLeft className="h-3 w-3" />
                </kbd>
                open
              </span>
              <span className="ml-auto hidden sm:inline">Results follow your role and access</span>
            </div>
          </CommandPrimitive>
        </DialogContent>
      </Dialog>
    </>
  );
}
