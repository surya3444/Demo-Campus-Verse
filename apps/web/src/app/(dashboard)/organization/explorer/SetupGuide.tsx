'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, ChevronDown, ChevronUp, Circle, Copy, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { academicApi, registrationApi } from '@/lib/api';

export interface GuideBatch {
  _id: string;
  name: string;
  isCurrent?: boolean;
  startDate?: string;
  terms?: unknown[];
}

interface Props {
  batches: GuideBatch[];
  departments: number;
  programs: number;
  years: number;
  sections: number;
  students: number;
  canEdit: boolean;
  /** Called after the next year's structure is created, so counts refresh. */
  onChanged: () => void;
}

const OPEN_KEY = 'explorer-setup-guide-open';

/**
 * The academic setup in order, one line each, with live status. Steps 2–4 are
 * done in the Explorer itself; the rest link to the screen that owns them.
 */
export function SetupGuide(props: Props) {
  const { batches, canEdit, onChanged } = props;
  const current = batches.find((b) => b.isCurrent) ?? batches[0];
  const next = current
    ? batches
        .filter((b) => b._id !== current._id && (b.startDate ?? '') > (current.startDate ?? ''))
        .sort((a, b) => (a.startDate ?? '').localeCompare(b.startDate ?? ''))[0]
    : undefined;

  const [open, setOpen] = useState(true);
  const [schemes, setSchemes] = useState<number | null>(null);
  const [nextYears, setNextYears] = useState<number | null>(null);
  const [copying, setCopying] = useState(false);

  useEffect(() => {
    try {
      setOpen(localStorage.getItem(OPEN_KEY) !== '0');
    } catch {
      /* storage blocked — stay open */
    }
  }, []);
  const toggle = () => {
    setOpen((o) => {
      try {
        localStorage.setItem(OPEN_KEY, o ? '0' : '1');
      } catch {
        /* ignore */
      }
      return !o;
    });
  };

  useEffect(() => {
    registrationApi
      .getSchemes({ status: 'published' })
      .then((r) => setSchemes((r.data ?? []).length))
      .catch(() => setSchemes(null));
  }, []);
  useEffect(() => {
    if (!next) return setNextYears(null);
    academicApi
      .getClasses({ academicBatchId: next._id, limit: 1 })
      .then((r) => setNextYears(r.meta?.total ?? (r.data ?? []).length))
      .catch(() => setNextYears(null));
  }, [next?._id]); // re-check only when the next year changes

  const copyForward = async () => {
    if (!current || !next) return;
    setCopying(true);
    try {
      const res = await academicApi.copyAcademicStructure(next._id, current._id);
      const r = res.data;
      toast.success(
        `${next.name} is ready: ${r.classesCreated} years and ${r.sectionsCreated} sections copied`
      );
      setNextYears((n) => (n ?? 0) + r.classesCreated);
      onChanged();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: { message?: string } } } };
      toast.error(e.response?.data?.error?.message || 'Could not copy the structure');
    } finally {
      setCopying(false);
    }
  };

  const steps: Array<{
    title: string;
    explain: string;
    status: string;
    done: boolean;
    action?: { label: string; href?: string; onClick?: () => void; busy?: boolean };
  }> = [
    {
      title: 'Academic year & semesters',
      explain: 'The school calendar, e.g. AY 2026-27 with an Odd and an Even semester.',
      status: current ? `${current.name} · ${current.terms?.length ?? 0} terms` : 'Not set',
      done: !!current && (current.terms?.length ?? 0) > 0,
    },
    {
      title: 'Departments',
      explain: 'Big groups of teachers and subjects, e.g. Computer Science.',
      status: `${props.departments} added`,
      done: props.departments > 0,
    },
    {
      title: 'Programs',
      explain: 'A course of study with a length, e.g. B.Tech (4 years = 8 semesters).',
      status: `${props.programs} added`,
      done: props.programs > 0,
    },
    {
      title: 'Years & sections',
      explain:
        'Year 1, Year 2… of a program for this academic year; sections are the classrooms (A, B).',
      status: `${props.years} years · ${props.sections} sections`,
      done: props.years > 0 && props.sections > 0,
    },
    {
      title: 'Subjects for each semester',
      explain:
        'Create subjects in a department, then open a program and tick what each semester studies.',
      status: schemes === null ? '—' : `${schemes} semesters published`,
      done: (schemes ?? 0) > 0,
    },
    {
      title: 'Teachers for each subject',
      explain: 'Open a section (program → year → section) and pick a teacher for each subject.',
      status: 'Per section',
      done: props.sections > 0,
    },
    {
      title: 'Students',
      explain: 'Admit students into a year and section. Their semester follows automatically.',
      status: `${props.students.toLocaleString()} enrolled`,
      done: props.students > 0,
      action: { label: 'Admissions', href: '/admissions' },
    },
    {
      title: 'Next academic year & promotion',
      explain: next
        ? `Copy this year's years and sections into ${next.name}, then promote: Year 1 → Year 2, final year → alumni.`
        : 'Add the next academic year (button above), then copy this year into it and promote students.',
      status: !next
        ? 'No next year yet'
        : nextYears
          ? `${next.name}: ${nextYears} years ready`
          : `${next.name}: empty`,
      done: !!next && (nextYears ?? 0) > 0,
      action: !next
        ? undefined
        : nextYears
          ? { label: 'Promote students', href: '/exams/promotion' }
          : canEdit
            ? { label: `Copy into ${next.name}`, onClick: copyForward, busy: copying }
            : undefined,
    },
  ];
  const doneCount = steps.filter((s) => s.done).length;

  return (
    <section className="mb-6 rounded-2xl border border-border bg-card">
      <button
        type="button"
        onClick={toggle}
        className="flex w-full items-center justify-between px-5 py-4 text-left"
        aria-expanded={open}
      >
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            Setup guide
          </p>
          <p className="mt-0.5 text-sm font-medium">
            {doneCount} of {steps.length} steps done — follow them in order
          </p>
        </div>
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>
      {open && (
        <ol className="divide-y divide-border border-t border-border">
          {steps.map((s, i) => (
            <li key={s.title} className="flex flex-wrap items-center gap-3 px-5 py-3">
              {s.done ? (
                <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" aria-label="Done" />
              ) : (
                <Circle className="h-5 w-5 shrink-0 text-muted-foreground" aria-label="To do" />
              )}
              <div className="min-w-0 flex-1 basis-64">
                <p className="text-sm font-medium">
                  {i + 1}. {s.title}
                  <span className="ml-2 text-xs font-normal text-muted-foreground">{s.status}</span>
                </p>
                <p className="text-xs text-muted-foreground">{s.explain}</p>
              </div>
              {s.action &&
                (s.action.href ? (
                  <Button variant="outline" size="sm" asChild>
                    <Link href={s.action.href}>{s.action.label}</Link>
                  </Button>
                ) : (
                  <Button size="sm" onClick={s.action.onClick} disabled={s.action.busy}>
                    {s.action.busy ? (
                      <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                    ) : (
                      <Copy className="mr-1.5 h-4 w-4" />
                    )}
                    {s.action.label}
                  </Button>
                ))}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
