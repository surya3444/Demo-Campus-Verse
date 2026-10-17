'use client';

import { useCallback, useEffect, useState } from 'react';
import { BookMarked, Loader2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { academicApi } from '@/lib/api';
import { ItemActions } from './parts';
import { SubjectDialog, type SubjectInput } from './SubjectDialog';

export interface SubjectRow extends SubjectInput {
  ownerDepartment?: { name: string; code: string } | null;
}

/** Subjects a department may teach: its own, plus global and shared ones. */
export function useDepartmentSubjects(departmentId?: string) {
  const [subjects, setSubjects] = useState<SubjectRow[] | null>(null);
  const reload = useCallback(async () => {
    if (!departmentId) return setSubjects([]);
    const r = await academicApi
      .getSubjects({ usableByDepartmentId: departmentId, status: 'active', limit: 500 })
      .catch(() => ({ data: [] }));
    setSubjects((r.data ?? []) as SubjectRow[]);
  }, [departmentId]);
  useEffect(() => {
    reload();
  }, [reload]);
  return { subjects, reload };
}

const TYPE_LABEL = { theory: 'Theory', practical: 'Practical / lab', both: 'Theory + lab' };

/** One short phrase for who may use a subject. */
export function accessLabel(s: {
  sharing?: string | null;
  ownerDepartmentId?: string | null;
  offeredToDepartmentIds?: string[];
}) {
  if (s.sharing === 'global' || !s.ownerDepartmentId) return 'Every department';
  if (s.sharing === 'shared') return `Shared with ${s.offeredToDepartmentIds?.length ?? 0} more`;
  return 'This department only';
}

export function SubjectsPanel({
  dept,
  canEdit,
}: {
  dept: { _id: string; name: string; code: string };
  canEdit: boolean;
}) {
  const { subjects, reload } = useDepartmentSubjects(dept._id);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<SubjectRow | null>(null);

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Subjects
          </h2>
          <p className="text-xs text-muted-foreground">
            Everything {dept.name} can teach — its own, those shared with it, and campus-wide ones.
            Put them into semesters from a program&apos;s Curriculum.
          </p>
        </div>
        {canEdit && (
          <Button size="sm" onClick={() => setAdding(true)}>
            <Plus className="mr-1.5 h-4 w-4" />
            Add subject
          </Button>
        )}
      </div>
      {subjects === null ? (
        <div className="flex h-16 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : subjects.length === 0 ? (
        <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          No subjects yet. Add the first one — e.g. &quot;Data Structures&quot;, 4 credits.
        </p>
      ) : (
        <div className="divide-y rounded-xl border bg-card">
          {subjects.map((s) => {
            const own = s.ownerDepartmentId === dept._id;
            return (
              <div key={s._id} className="flex items-center gap-3 px-4 py-2.5">
                <BookMarked className="h-4 w-4 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{s.name}</p>
                  <p className="text-xs text-muted-foreground">
                    <span className="font-mono">{s.code}</span>
                    {s.credits ? ` · ${s.credits} credits` : ''}
                    {s.type ? ` · ${TYPE_LABEL[s.type]}` : ''}
                  </p>
                </div>
                <Badge variant="secondary" className="shrink-0 text-[10px] font-normal">
                  {own
                    ? accessLabel(s)
                    : s.ownerDepartment
                      ? `From ${s.ownerDepartment.code}`
                      : 'Every department'}
                </Badge>
                {canEdit && own && (
                  <ItemActions
                    what="subject"
                    name={s.name}
                    onEdit={() => setEditing(s)}
                    onDelete={() => academicApi.deleteSubject(s._id).then(reload)}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
      <AddSubjectDialog
        open={adding}
        dept={dept}
        onClose={() => setAdding(false)}
        onAdded={() => reload()}
      />
      <SubjectDialog
        open={!!editing}
        subject={editing ?? undefined}
        onClose={() => setEditing(null)}
        onSaved={() => reload()}
      />
    </section>
  );
}

/** Create a subject whose home is `dept`; used from the Subjects panel and the Curriculum. */
export function AddSubjectDialog({
  open,
  dept,
  onClose,
  onAdded,
}: {
  open: boolean;
  dept: { _id: string; name: string; code: string };
  onClose: () => void;
  onAdded: (subject: SubjectRow) => void;
}) {
  return (
    <SubjectDialog
      open={open}
      ownerDept={dept}
      onClose={onClose}
      onSaved={(s) => onAdded(s as unknown as SubjectRow)}
    />
  );
}
