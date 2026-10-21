'use client';

import { useMemo, useState } from 'react';
import {
  BadgeIndianRupee,
  Bot,
  ChevronDown,
  HeartPulse,
  Lock,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
  Wallet,
} from 'lucide-react';
import {
  PERMISSIONS,
  ORG_ADMIN_PERMISSIONS,
  BRANCH_ADMIN_PERMISSIONS,
  HOD_PERMISSIONS,
  TEACHER_PERMISSIONS,
  ADMISSION_COUNSELOR_PERMISSIONS,
  ACCOUNTANT_PERMISSIONS,
  HR_MANAGER_PERMISSIONS,
  RECEPTIONIST_PERMISSIONS,
  PLACEMENT_OFFICER_PERMISSIONS,
  CAREER_COUNSELOR_PERMISSIONS,
  HOSTEL_WARDEN_PERMISSIONS,
  INVENTORY_MANAGER_PERMISSIONS,
} from '@campus-verse/shared/constants';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

type Perms = Record<string, string[]>;

/** Areas of the app, in sidebar order, with the permission prefixes they cover. */
const GROUPS: Array<{ id: string; label: string; hint: string }> = [
  { id: 'dashboard', label: 'Dashboard & reports', hint: 'Overview screens and exports' },
  { id: 'organization', label: 'Organization', hint: 'Institutions, users, roles, settings' },
  { id: 'students', label: 'Students', hint: 'Records, profiles, promotion' },
  { id: 'admissions', label: 'Admissions', hint: 'Leads and applications' },
  { id: 'attendance', label: 'Attendance', hint: 'Marking and reports' },
  { id: 'teaching', label: 'Teaching', hint: 'Classes, timetable, grades' },
  { id: 'exams', label: 'Exams & report cards', hint: 'Exams, marks, results' },
  { id: 'registration', label: 'Course registration', hint: 'CBCS / NEP schemes' },
  { id: 'obe', label: 'OBE attainment', hint: 'CO / PO mapping' },
  { id: 'courses', label: 'Online courses', hint: 'Courses, lessons, quizzes' },
  { id: 'finance', label: 'Finance', hint: 'Fee counter, structures, dues' },
  { id: 'hr', label: 'HR & payroll', hint: 'Staff, leave, payroll' },
  { id: 'health', label: 'Health Connect', hint: 'Records, visits, benefits' },
  { id: 'careerConnect', label: 'Career Connect', hint: 'Placements and alumni' },
  { id: 'hostel', label: 'Hostel', hint: 'Rooms and allocations' },
  { id: 'transport', label: 'Transport', hint: 'Buses, stops, riders' },
  { id: 'clubs', label: 'Clubs', hint: 'Running campus clubs' },
  { id: 'communications', label: 'Communications', hint: 'SMS, announcements, calendar' },
  { id: 'certificates', label: 'Certificates & ID cards', hint: 'Requests and designs' },
  { id: 'campusFeed', label: 'Campus feed', hint: 'Posts and moderation' },
  { id: 'inventory', label: 'Inventory', hint: 'Assets and stores' },
  { id: 'expense', label: 'Expenses', hint: 'Requests and budgets' },
  { id: 'visitor', label: 'Visitors', hint: 'Passes and logs' },
  { id: 'feedback', label: 'Concerns & feedback', hint: 'Tickets' },
  { id: 'reports', label: 'Reports', hint: 'Cross-module reports' },
  { id: 'ai', label: 'AI Assistant', hint: 'Chat and actions' },
];

/** Friendlier names where the key alone reads poorly. */
const LABELS: Record<string, string> = {
  'dashboard.ownerView': 'Owner dashboard',
  'dashboard.branchView': 'Branch dashboard',
  'dashboard.fees': 'Fee figures on dashboards',
  'dashboard.audit': 'Activity log',
  'students.fees': 'Fee details on student profiles',
  'finance.feeCounter': 'Fee counter',
  'health.benefits': 'cInsurance & Pharma-C',
  'clubs.manage': 'Create & edit clubs',
  'hr.payroll': 'Payroll',
  'hr.payslips': 'Payslips',
  'ai.assistant': 'Use the assistant',
  'organization.academics': 'Academic structure',
  'teaching.myClasses': 'My classes',
  'teaching.myStudents': 'My students',
  'careerConnect.jobBoard': 'Job board',
  'campusFeed.posts': 'Posts',
};

/** Data an admin should decide on deliberately, role by role. */
const SENSITIVE: Array<{
  key: string;
  actions: string[];
  icon: typeof Wallet;
  label: string;
  text: string;
}> = [
  {
    key: 'students.fees',
    actions: ['view'],
    icon: Wallet,
    label: 'Student fee details',
    text: 'Dues, payments and instalments on student profiles and in the assistant.',
  },
  {
    key: 'dashboard.fees',
    actions: ['view'],
    icon: BadgeIndianRupee,
    label: 'Fee figures on dashboards',
    text: 'Collection and outstanding totals on the dashboard.',
  },
  {
    key: 'hr.payroll',
    actions: ['view'],
    icon: Lock,
    label: 'Payroll & salaries',
    text: 'Salary structures, pay runs and amounts.',
  },
  {
    key: 'health.records',
    actions: ['view'],
    icon: HeartPulse,
    label: 'Student health records',
    text: 'Medical history, visits and vaccinations.',
  },
  {
    key: 'health.benefits',
    actions: ['view'],
    icon: ShieldCheck,
    label: 'cInsurance & Pharma-C',
    text: 'Upcoming partner benefit pages.',
  },
  {
    key: 'clubs.manage',
    actions: ['create', 'edit'],
    icon: Users,
    label: 'Run clubs',
    text: 'Create clubs and edit their details.',
  },
  {
    key: 'ai.assistant',
    actions: ['use'],
    icon: Bot,
    label: 'AI Assistant',
    text: 'Ask and act across the modules this role can reach.',
  },
];

const TEMPLATES: Array<{ id: string; label: string; perms: Perms }> = [
  { id: 'ORG_ADMIN', label: 'Org admin', perms: ORG_ADMIN_PERMISSIONS },
  { id: 'BRANCH_ADMIN', label: 'Campus / branch admin', perms: BRANCH_ADMIN_PERMISSIONS },
  { id: 'HOD', label: 'Head of department', perms: HOD_PERMISSIONS },
  { id: 'TEACHER', label: 'Teacher', perms: TEACHER_PERMISSIONS },
  { id: 'ACCOUNTANT', label: 'Accountant', perms: ACCOUNTANT_PERMISSIONS },
  { id: 'HR_MANAGER', label: 'HR manager', perms: HR_MANAGER_PERMISSIONS },
  {
    id: 'ADMISSION_COUNSELOR',
    label: 'Admissions counsellor',
    perms: ADMISSION_COUNSELOR_PERMISSIONS,
  },
  { id: 'RECEPTIONIST', label: 'Front desk', perms: RECEPTIONIST_PERMISSIONS },
  { id: 'PLACEMENT_OFFICER', label: 'Placement officer', perms: PLACEMENT_OFFICER_PERMISSIONS },
  { id: 'CAREER_COUNSELOR', label: 'Career counsellor', perms: CAREER_COUNSELOR_PERMISSIONS },
  { id: 'HOSTEL_WARDEN', label: 'Hostel warden', perms: HOSTEL_WARDEN_PERMISSIONS },
  { id: 'INVENTORY_MANAGER', label: 'Stores / inventory', perms: INVENTORY_MANAGER_PERMISSIONS },
];

const humanize = (s: string) =>
  s
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]/g, ' ')
    .replace(/^\w/, (c) => c.toUpperCase());
const labelOf = (key: string) => LABELS[key] ?? humanize(key.split('.').slice(1).join(' ') || key);

const MODULES = Object.entries(PERMISSIONS as unknown as Perms).map(([key, actions]) => ({
  key,
  group: key.split('.')[0],
  label: labelOf(key),
  actions,
}));

type Level = 'none' | 'view' | 'full' | 'custom';
function levelOf(have: string[] | undefined, actions: string[]): Level {
  if (!have?.length) return 'none';
  if (actions.every((a) => have.includes(a))) return 'full';
  if (have.length === 1 && have[0] === 'view') return 'view';
  return 'custom';
}

interface Props {
  permissions: Perms;
  onChange?: (next: Perms) => void;
  readOnly?: boolean;
}

/**
 * Role permissions as an admin thinks about them: start from a familiar role,
 * decide the sensitive data first, then set each area to None / View / Full —
 * or open it up to pick individual actions.
 */
export function PermissionMatrix({ permissions, onChange, readOnly }: Props) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [expandedModule, setExpandedModule] = useState<string | null>(null);

  const set = (key: string, actions: string[]) => {
    if (readOnly || !onChange) return;
    const next = { ...permissions };
    if (actions.length) next[key] = actions;
    else delete next[key];
    onChange(next);
  };

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    return GROUPS.map((g) => ({
      ...g,
      modules: MODULES.filter(
        (m) =>
          m.group === g.id &&
          (!q ||
            m.label.toLowerCase().includes(q) ||
            m.key.toLowerCase().includes(q) ||
            g.label.toLowerCase().includes(q))
      ),
    })).filter((g) => g.modules.length > 0);
  }, [query]);

  const toggleGroup = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const setGroup = (id: string, level: 'none' | 'view' | 'full') => {
    if (readOnly || !onChange) return;
    const next = { ...permissions };
    for (const m of MODULES.filter((x) => x.group === id)) {
      if (level === 'none') delete next[m.key];
      else if (level === 'full') next[m.key] = [...m.actions];
      else if (m.actions.includes('view')) next[m.key] = ['view'];
    }
    onChange(next);
  };

  return (
    <div className="space-y-6">
      {!readOnly && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-background p-4">
          <Sparkles className="h-4 w-4 text-[hsl(var(--brand-cyan))]" />
          <div className="mr-auto">
            <p className="text-sm font-semibold">Start from a familiar role</p>
            <p className="text-xs text-muted-foreground">
              Fills in that role&apos;s defaults; adjust anything afterwards.
            </p>
          </div>
          <Select
            onValueChange={(id) =>
              onChange?.({ ...(TEMPLATES.find((t) => t.id === id)?.perms ?? {}) })
            }
          >
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Choose a template" />
            </SelectTrigger>
            <SelectContent>
              {TEMPLATES.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <section className="rounded-xl border bg-background">
        <div className="border-b px-4 py-3">
          <p className="text-sm font-semibold">Sensitive data &amp; features</p>
          <p className="text-xs text-muted-foreground">Decide these deliberately for every role.</p>
        </div>
        <div className="grid gap-px bg-border sm:grid-cols-2">
          {SENSITIVE.map((s) => {
            const on = s.actions.every((a) => permissions[s.key]?.includes(a));
            return (
              <label
                key={s.key}
                className={cn(
                  'flex items-start gap-3 bg-background px-4 py-3',
                  !readOnly && 'cursor-pointer hover:bg-muted/40'
                )}
              >
                <span
                  className={cn(
                    'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                    on ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                  )}
                >
                  <s.icon className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{s.label}</span>
                  <span className="block text-xs text-muted-foreground">{s.text}</span>
                </span>
                <Switch
                  checked={on}
                  disabled={readOnly}
                  onCheckedChange={(v) => {
                    const rest = (permissions[s.key] ?? []).filter((a) => !s.actions.includes(a));
                    set(s.key, v ? [...new Set([...rest, ...s.actions])] : rest);
                  }}
                />
              </label>
            );
          })}
        </div>
      </section>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search modules, e.g. timetable, payroll"
          className="pl-9"
        />
      </div>

      <div className="space-y-3">
        {groups.map((g) => {
          const granted = g.modules.filter((m) => permissions[m.key]?.length).length;
          const isOpen = open.has(g.id) || !!query.trim();
          return (
            <section key={g.id} className="overflow-hidden rounded-xl border bg-background">
              <div className="flex items-center gap-3 px-4 py-3">
                <button
                  type="button"
                  onClick={() => toggleGroup(g.id)}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                >
                  <ChevronDown
                    className={cn(
                      'h-4 w-4 shrink-0 text-muted-foreground transition-transform',
                      !isOpen && '-rotate-90'
                    )}
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold">{g.label}</span>
                    <span className="block truncate text-xs text-muted-foreground">{g.hint}</span>
                  </span>
                </button>
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-xs font-medium tabular-nums',
                    granted ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                  )}
                >
                  {granted}/{g.modules.length}
                </span>
                {!readOnly && (
                  <div className="hidden gap-1 sm:flex">
                    {(['none', 'view', 'full'] as const).map((l) => (
                      <button
                        key={l}
                        type="button"
                        onClick={() => setGroup(g.id, l)}
                        className="rounded-md border px-2 py-1 text-xs capitalize text-muted-foreground hover:border-primary/50 hover:text-foreground"
                      >
                        {l === 'none' ? 'None' : l === 'view' ? 'View all' : 'Full'}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {isOpen && (
                <div className="divide-y border-t">
                  {g.modules.map((m) => {
                    const have = permissions[m.key];
                    const level = levelOf(have, m.actions);
                    const expanded = expandedModule === m.key || level === 'custom';
                    return (
                      <div key={m.key} className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-3">
                          <span className="min-w-0 flex-1 text-sm font-medium">{m.label}</span>
                          <div className="flex overflow-hidden rounded-lg border text-xs">
                            {(['none', 'view', 'full'] as const).map((l) => {
                              const disabledView = l === 'view' && !m.actions.includes('view');
                              return (
                                <button
                                  key={l}
                                  type="button"
                                  disabled={readOnly || disabledView}
                                  onClick={() =>
                                    set(
                                      m.key,
                                      l === 'none' ? [] : l === 'view' ? ['view'] : [...m.actions]
                                    )
                                  }
                                  className={cn(
                                    'px-3 py-1.5 transition-colors disabled:opacity-40',
                                    level === l
                                      ? 'bg-primary text-primary-foreground'
                                      : 'bg-background text-muted-foreground hover:bg-muted'
                                  )}
                                >
                                  {l === 'none' ? 'None' : l === 'view' ? 'View' : 'Full'}
                                </button>
                              );
                            })}
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedModule(expanded && level !== 'custom' ? null : m.key)
                              }
                              className={cn(
                                'border-l px-3 py-1.5 transition-colors',
                                level === 'custom'
                                  ? 'bg-primary text-primary-foreground'
                                  : 'bg-background text-muted-foreground hover:bg-muted'
                              )}
                            >
                              Custom
                            </button>
                          </div>
                        </div>
                        {expanded && (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {m.actions.map((a) => {
                              const on = !!have?.includes(a);
                              return (
                                <button
                                  key={a}
                                  type="button"
                                  disabled={readOnly}
                                  onClick={() =>
                                    set(
                                      m.key,
                                      on ? have!.filter((x) => x !== a) : [...(have ?? []), a]
                                    )
                                  }
                                  className={cn(
                                    'rounded-md border px-2.5 py-1 text-xs capitalize transition-colors',
                                    on
                                      ? 'border-primary bg-primary/10 text-primary'
                                      : 'text-muted-foreground hover:border-primary/50'
                                  )}
                                >
                                  {humanize(a)}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
