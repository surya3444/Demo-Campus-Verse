'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Loader2, Pencil, Plus, Search } from 'lucide-react';
import { toast } from 'sonner';
import { yearTermRanges, type YearTermPattern } from '@campus-verse/shared';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { registrationApi } from '@/lib/api';
import { errorMessage } from './parts';
import { AddSubjectDialog, useDepartmentSubjects, type SubjectRow } from './SubjectsPanel';

type Slot =
  | { kind: 'core'; subjectId: string; credits: number; category?: string }
  | { kind: 'basket'; label: string; chooseCount: number; options: unknown[] };

interface Scheme {
  _id: string;
  semesterNumber: number;
  status: 'draft' | 'published' | 'archived';
  slots: Slot[];
}

interface Props {
  prog: {
    _id: string;
    name: string;
    durationYears: number;
    totalSemesters?: number;
    termPattern?: string;
    yearPatterns?: YearTermPattern[];
  };
  dept: { _id: string; name: string; code: string };
  canEdit: boolean;
}

/**
 * The program's curriculum, one row per semester. Saving a semester publishes
 * it, which puts its subjects into every section of the year that studies it.
 * Electives (choose-N groups) stay on the full Curriculum page.
 */
export function CurriculumPanel({ prog, dept, canEdit }: Props) {
  const { subjects, reload: reloadSubjects } = useDepartmentSubjects(dept._id);
  const [schemes, setSchemes] = useState<Scheme[] | null>(null);
  const [editing, setEditing] = useState<number | null>(null);

  const load = useCallback(async () => {
    const r = await registrationApi.getSchemes({ programId: prog._id }).catch(() => ({ data: [] }));
    setSchemes((r.data ?? []) as Scheme[]);
  }, [prog._id]);
  useEffect(() => {
    load();
  }, [load]);

  // Semester k → the year that studies it (two per year unless the program says otherwise).
  const terms = useMemo(
    () =>
      yearTermRanges({
        durationYears: prog.durationYears,
        termPattern: prog.termPattern as YearTermPattern | undefined,
        yearPatterns: prog.yearPatterns,
      }).flatMap((r) =>
        Array.from({ length: r.last - r.first + 1 }, (_, i) => ({
          term: r.first + i,
          year: r.year,
        }))
      ),
    [prog]
  );
  const nameOf = useMemo(() => new Map((subjects ?? []).map((s) => [s._id, s])), [subjects]);
  const bySem = new Map((schemes ?? []).map((s) => [s.semesterNumber, s]));

  if (schemes === null || subjects === null) {
    return (
      <div className="flex h-16 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Curriculum — subjects for each semester
          </h2>
          <p className="text-xs text-muted-foreground">
            Saving a semester sends its subjects to every section of that year. Subjects come from{' '}
            {dept.name}.
          </p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href="/registration">Electives &amp; registration</Link>
        </Button>
      </div>
      <div className="divide-y rounded-xl border bg-card">
        {terms.map(({ term, year }) => {
          const scheme = bySem.get(term);
          const cores = (scheme?.slots ?? []).filter((s) => s.kind === 'core') as Extract<
            Slot,
            { kind: 'core' }
          >[];
          const electives = (scheme?.slots ?? []).length - cores.length;
          return (
            <div key={term} className="flex flex-wrap items-start gap-3 px-4 py-3">
              <div className="w-28 shrink-0">
                <p className="text-sm font-semibold">Sem {term}</p>
                <p className="text-xs text-muted-foreground">Year {year}</p>
              </div>
              <div className="min-w-0 flex-1 basis-56">
                {cores.length === 0 && !electives ? (
                  <p className="text-sm text-muted-foreground">No subjects yet</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {cores.map((c) => (
                      <Badge key={c.subjectId} variant="secondary" className="font-normal">
                        {nameOf.get(c.subjectId)?.name ?? 'Subject from another department'}
                        <span className="ml-1 text-muted-foreground">{c.credits}cr</span>
                      </Badge>
                    ))}
                    {electives > 0 && (
                      <Badge variant="outline" className="font-normal">
                        + {electives} elective group{electives === 1 ? '' : 's'}
                      </Badge>
                    )}
                  </div>
                )}
                {scheme?.status === 'draft' && (
                  <p className="mt-1 text-xs text-amber-600">Draft — not sent to sections yet</p>
                )}
              </div>
              {canEdit && (
                <Button variant="ghost" size="sm" onClick={() => setEditing(term)}>
                  <Pencil className="mr-1.5 h-3.5 w-3.5" />
                  {cores.length ? 'Edit' : 'Add subjects'}
                </Button>
              )}
            </div>
          );
        })}
      </div>
      {editing !== null && (
        <SemesterDialog
          term={editing}
          year={terms.find((t) => t.term === editing)?.year ?? 1}
          prog={prog}
          dept={dept}
          scheme={bySem.get(editing)}
          subjects={subjects}
          onSubjectAdded={reloadSubjects}
          onClose={() => setEditing(null)}
          onSaved={load}
        />
      )}
    </section>
  );
}

function SemesterDialog({
  term,
  year,
  prog,
  dept,
  scheme,
  subjects,
  onSubjectAdded,
  onClose,
  onSaved,
}: {
  term: number;
  year: number;
  prog: Props['prog'];
  dept: Props['dept'];
  scheme?: Scheme;
  subjects: SubjectRow[];
  onSubjectAdded: () => Promise<void> | void;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
}) {
  const initial = (scheme?.slots ?? []).filter((s) => s.kind === 'core') as Extract<
    Slot,
    { kind: 'core' }
  >[];
  const [picked, setPicked] = useState<Map<string, number>>(
    () => new Map(initial.map((c) => [c.subjectId, c.credits]))
  );
  const [query, setQuery] = useState('');
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);

  const toggle = (s: SubjectRow) =>
    setPicked((m) => {
      const next = new Map(m);
      if (next.has(s._id)) next.delete(s._id);
      else next.set(s._id, s.credits ?? 3);
      return next;
    });
  const shown = subjects.filter((s) =>
    `${s.name} ${s.code}`.toLowerCase().includes(query.trim().toLowerCase())
  );
  const total = [...picked.values()].reduce((n, c) => n + c, 0);

  const save = async () => {
    setSaving(true);
    try {
      const baskets = (scheme?.slots ?? []).filter((s) => s.kind === 'basket');
      const slots = [
        ...[...picked].map(([subjectId, credits]) => ({
          kind: 'core' as const,
          subjectId,
          credits,
        })),
        ...baskets,
      ];
      // Credit bounds the registration rules accept for exactly these subjects.
      const minCredits = Math.min(total, 16);
      const maxCredits = Math.min(Math.max(total + 8, minCredits, 28), 60);
      const saved = scheme
        ? await registrationApi.updateScheme(scheme._id, {
            slots: slots as never,
            minCredits,
            maxCredits,
          })
        : await registrationApi.createScheme({
            departmentCode: dept.code,
            departmentName: dept.name,
            programId: prog._id,
            semesterNumber: term,
            slots: slots as never,
            minCredits,
            maxCredits,
          });
      const id = scheme?._id ?? (saved.data ?? saved)._id;
      if (scheme?.status !== 'published') await registrationApi.publishScheme(id);
      toast.success(`Sem ${term} saved — its subjects are in every Year ${year} section`);
      await onSaved();
      onClose();
    } catch (err) {
      toast.error(errorMessage(err, `Could not save Sem ${term}`));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {prog.name} — Sem {term}
          </DialogTitle>
          <DialogDescription>
            Tick what Year {year} studies this semester. Saving adds these subjects to every Year{' '}
            {year} section; choose teachers there.
          </DialogDescription>
        </DialogHeader>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="Search subjects"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <Button variant="outline" onClick={() => setAdding(true)}>
            <Plus className="mr-1.5 h-4 w-4" />
            New subject
          </Button>
        </div>
        <div className="max-h-72 divide-y overflow-y-auto rounded-lg border">
          {shown.length === 0 ? (
            <p className="p-4 text-center text-sm text-muted-foreground">
              No subjects match. Use “New subject” to create one.
            </p>
          ) : (
            shown.map((s) => (
              <label
                key={s._id}
                className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-muted/50"
              >
                <Checkbox checked={picked.has(s._id)} onCheckedChange={() => toggle(s)} />
                <span className="min-w-0 flex-1 truncate">{s.name}</span>
                <span className="font-mono text-xs text-muted-foreground">{s.code}</span>
                <span className="w-10 text-right text-xs text-muted-foreground">
                  {s.credits ?? 3}cr
                </span>
              </label>
            ))
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          {picked.size} subject{picked.size === 1 ? '' : 's'} · {total} credits
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={saving || picked.size === 0} onClick={save}>
            {saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}Save Sem {term}
          </Button>
        </DialogFooter>
        <AddSubjectDialog
          open={adding}
          dept={dept}
          onClose={() => setAdding(false)}
          onAdded={async (s) => {
            await onSubjectAdded();
            setPicked((m) => new Map(m).set(s._id, s.credits ?? 3));
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
