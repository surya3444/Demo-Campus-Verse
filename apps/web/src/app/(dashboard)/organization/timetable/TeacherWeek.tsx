'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { teachingApi } from '@/lib/api';

interface TeacherEntry {
  _id: string;
  sectionId: string;
  sectionName: string;
  className: string;
  subjectName: string;
  startTime: string;
  endTime: string;
  dayOfWeek: number;
  roomNumber?: string | null;
  batchName?: string | null;
}

const DAYS = [
  { n: 1, label: 'Mon' },
  { n: 2, label: 'Tue' },
  { n: 3, label: 'Wed' },
  { n: 4, label: 'Thu' },
  { n: 5, label: 'Fri' },
  { n: 6, label: 'Sat' },
];

/**
 * One staff member's week, read-only. Rows are the actual times they teach
 * (different years may run different period timings), cells say what and where.
 */
export function TeacherWeek({
  staffId,
  onOpenSection,
}: {
  staffId: string;
  /** When given, a class in the grid links to its section's timetable. */
  onOpenSection?: (sectionId: string) => void;
}) {
  const [entries, setEntries] = useState<TeacherEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setEntries(null);
    setError(null);
    teachingApi
      .getMyTimetable(staffId)
      .then((r) => setEntries((r.data ?? []) as TeacherEntry[]))
      .catch((err) =>
        setError(err?.response?.data?.error?.message ?? 'Could not load this timetable')
      );
  }, [staffId]);

  const times = useMemo(
    () =>
      [...new Set((entries ?? []).map((e) => `${e.startTime}–${e.endTime}`))].sort((a, b) =>
        a.localeCompare(b)
      ),
    [entries]
  );

  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!entries) {
    return (
      <div className="flex h-32 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!entries.length) {
    return (
      <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
        No classes in the timetable for this staff member yet.
      </p>
    );
  }

  const busyDays = new Set(entries.map((e) => e.dayOfWeek)).size;
  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">
        {entries.length} periods a week across {busyDays} day{busyDays === 1 ? '' : 's'} ·{' '}
        {(() => {
          const n = new Set(entries.map((e) => e.sectionId)).size;
          return `${n} section${n === 1 ? '' : 's'}`;
        })()}
      </p>
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full min-w-[820px] table-fixed text-sm">
          <thead className="border-b bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="w-28 px-3 py-2.5 text-left">Time</th>
              {DAYS.map((d) => (
                <th key={d.n} className="px-2 py-2.5 text-left">
                  {d.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {times.map((t) => (
              <tr key={t}>
                <td className="px-3 py-2 align-top text-xs font-medium">{t}</td>
                {DAYS.map((d) => {
                  const here = entries.filter(
                    (e) => e.dayOfWeek === d.n && `${e.startTime}–${e.endTime}` === t
                  );
                  return (
                    <td key={d.n} className="p-1 align-top">
                      {here.map((e) => {
                        // "Year 4 · A" fits a cell; the full program name is on hover.
                        const where = `${e.className.split(' · ').pop()} · ${e.sectionName}`;
                        const full = `${e.className.split(' · ').slice(-2).join(' · ')} · Section ${e.sectionName}`;
                        const body = (
                          <>
                            <span className="block truncate text-xs font-semibold">
                              {e.batchName && (
                                <span className="mr-1 rounded bg-primary/10 px-1 text-[10px] font-semibold text-primary">
                                  {e.batchName}
                                </span>
                              )}
                              {e.subjectName}
                            </span>
                            <span className="block truncate text-[11px] text-muted-foreground">
                              {where}
                              {e.roomNumber ? ` · ${e.roomNumber}` : ''}
                            </span>
                          </>
                        );
                        return onOpenSection ? (
                          <button
                            key={e._id}
                            onClick={() => onOpenSection(e.sectionId)}
                            className="block w-full rounded-lg p-1.5 text-left hover:bg-primary/[0.05]"
                            title={`Open ${full}`}
                          >
                            {body}
                          </button>
                        ) : (
                          <span key={e._id} className="block p-1.5" title={full}>
                            {body}
                          </span>
                        );
                      })}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
