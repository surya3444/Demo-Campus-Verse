'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { BookMarked, Loader2, Plus, UserRound, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { academicApi } from '@/lib/api';
import { errorMessage } from './parts';
import { useDepartmentSubjects, type SubjectRow } from './SubjectsPanel';

interface Teacher {
  _id: string;
  name: string;
  employeeId?: string;
}
interface SectionDoc {
  sectionTeacherId?: string | null;
  subjects?: Array<{ subjectId: string; teacherId?: string | null; semesterNumber?: number }>;
}

const NONE = '__none__';

/** Who teaches what in one section; the curriculum decides which subjects are here. */
export function SectionSubjects({
  sectionId,
  departmentId,
  canEdit,
}: {
  sectionId: string;
  departmentId?: string | null;
  canEdit: boolean;
}) {
  const [section, setSection] = useState<SectionDoc | null>(null);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [allSubjects, setAllSubjects] = useState<SubjectRow[]>([]);
  const { subjects: usable } = useDepartmentSubjects(departmentId ?? undefined);
  const [adding, setAdding] = useState('');

  const load = useCallback(async () => {
    const [sec, tch, sub] = await Promise.all([
      academicApi.getSection(sectionId).catch(() => ({ data: null })),
      academicApi.getAvailableTeachers().catch(() => ({ data: [] })),
      academicApi.getSubjects({ status: 'active', limit: 500 }).catch(() => ({ data: [] })),
    ]);
    setSection((sec.data ?? {}) as SectionDoc);
    setTeachers((tch.data ?? []) as Teacher[]);
    setAllSubjects((sub.data ?? []) as SubjectRow[]);
  }, [sectionId]);
  useEffect(() => {
    load();
  }, [load]);

  const subjectName = useMemo(() => new Map(allSubjects.map((s) => [s._id, s])), [allSubjects]);

  const act = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn();
      toast.success(ok);
      await load();
    } catch (err) {
      toast.error(errorMessage(err, 'Could not save'));
    }
  };

  if (!section) {
    return (
      <div className="flex h-16 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  const here = new Set((section.subjects ?? []).map((s) => String(s.subjectId)));
  const addable = (usable ?? allSubjects).filter((s) => !here.has(s._id));

  const teacherPicker = (value: string | null | undefined, onPick: (id: string | null) => void) => (
    <Select
      value={value ?? NONE}
      onValueChange={(v) => onPick(v === NONE ? null : v)}
      disabled={!canEdit}
    >
      <SelectTrigger className="h-8 w-56">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>Not assigned</SelectItem>
        {teachers.map((t) => (
          <SelectItem key={t._id} value={t._id}>
            {t.name}
            {t.employeeId ? ` · ${t.employeeId}` : ''}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  return (
    <section className="space-y-3">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Subjects &amp; teachers
      </h2>
      <div className="divide-y rounded-xl border bg-card">
        <div className="flex flex-wrap items-center gap-3 px-4 py-2.5">
          <UserRound className="h-4 w-4 shrink-0 text-primary" />
          <span className="flex-1 text-sm font-medium">Class teacher</span>
          {teacherPicker(section.sectionTeacherId, (id) =>
            act(() => academicApi.assignTeacher(sectionId, id), 'Class teacher updated')
          )}
        </div>
        {(section.subjects ?? []).length === 0 ? (
          <p className="px-4 py-4 text-sm text-muted-foreground">
            No subjects yet. Add them to this year&apos;s semester in the program&apos;s Curriculum
            — they appear here automatically.
          </p>
        ) : (
          (section.subjects ?? []).map((row) => {
            const id = String(row.subjectId);
            const s = subjectName.get(id);
            return (
              <div key={id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                <BookMarked className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{s?.name ?? 'Subject'}</p>
                  <p className="font-mono text-xs text-muted-foreground">
                    {s?.code}
                    {row.semesterNumber ? ` · Sem ${row.semesterNumber}` : ''}
                  </p>
                </div>
                {teacherPicker(row.teacherId, (tid) =>
                  act(
                    () => academicApi.updateSectionSubject(sectionId, id, { teacherId: tid }),
                    'Teacher updated'
                  )
                )}
                {canEdit && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    aria-label={`Remove ${s?.name ?? 'subject'} from this section`}
                    onClick={() =>
                      act(
                        () => academicApi.removeSubjectFromSection(sectionId, id),
                        'Subject removed'
                      )
                    }
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            );
          })
        )}
        {canEdit && addable.length > 0 && (
          <div className="flex flex-wrap items-center gap-3 px-4 py-2.5">
            <Plus className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="flex-1 text-sm text-muted-foreground">
              Extra subject for this section only
            </span>
            <Select
              value={adding || NONE}
              onValueChange={(v) => {
                if (v === NONE) return;
                setAdding('');
                act(
                  () => academicApi.assignSubjectToSection(sectionId, { subjectId: v }),
                  'Subject added'
                );
              }}
            >
              <SelectTrigger className="h-8 w-56">
                <SelectValue placeholder="Pick a subject" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE} disabled>
                  Pick a subject
                </SelectItem>
                {addable.map((s) => (
                  <SelectItem key={s._id} value={s._id}>
                    {s.name} · {s.code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
    </section>
  );
}
