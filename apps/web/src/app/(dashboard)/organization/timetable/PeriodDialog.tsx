'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { FlaskConical, Loader2, Trash2, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { academicApi, hrApi, teachingApi } from '@/lib/api';
import { errorMessage } from '../explorer/parts';
import type { LabBatch } from './LabBatchesDialog';

export interface Slot {
  _id: string;
  name: string;
  startTime: string;
  endTime: string;
  order: number;
  type: 'period' | 'break' | 'assembly' | 'lunch';
  sectionId?: string | null;
}
export interface Entry {
  _id: string;
  groupId: string;
  slotId: string;
  dayOfWeek: number;
  subjectId: string;
  subjectName: string;
  teacherId: string;
  teacherName: string;
  roomNumber?: string | null;
  isLinked?: boolean;
  isMandatory?: boolean;
  batchId?: string | null;
  batchName?: string | null;
}
export interface SectionSubject {
  subjectId: string;
  teacherId?: string | null;
}
export interface Subject {
  _id: string;
  name: string;
  code: string;
  type?: 'theory' | 'practical' | 'both';
  ownerDepartmentId?: string | null;
}
interface Teacher {
  _id: string;
  name: string;
  employeeId?: string;
}
interface Row {
  subjectId: string;
  teacherId: string;
  room: string;
}

const NONE = '__none__';
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const EMPTY: Row = { subjectId: '', teacherId: '', room: '' };
const isLab = (s?: Subject) => s?.type === 'practical' || s?.type === 'both';
const nameOf = (t: { displayName?: string; firstName?: string; lastName?: string }) =>
  t.displayName || [t.firstName, t.lastName].filter(Boolean).join(' ');

/**
 * One period of one section, two ways:
 *  - Whole section: one subject, one teacher.
 *  - Lab by batches: each batch (A1, A2…) gets its own lab, teacher and room —
 *    the same lab in parallel rooms, different labs side by side, or only some
 *    batches (the rest are free). "Also next period" books a double lab.
 * Subjects are only this section's; teachers start with the one assigned to
 * the subject here, then that subject's department; anyone busy then is
 * shown but can't be picked. The server re-checks every clash.
 */
export function PeriodDialog({
  sectionId,
  departmentId,
  slot,
  nextSlot,
  nextSlotTaken,
  day,
  existing,
  batches,
  sectionSubjects,
  subjects,
  onClose,
  onSaved,
  onManageBatches,
}: {
  sectionId: string;
  departmentId: string | null;
  slot: Slot;
  /** The class period right after this one, for double labs. */
  nextSlot?: Slot;
  nextSlotTaken: boolean;
  day: number;
  existing: Entry[];
  batches: LabBatch[];
  sectionSubjects: SectionSubject[];
  subjects: Map<string, Subject>;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
  onManageBatches: () => void;
}) {
  const own = existing.filter((e) => !e.isLinked);
  const complex = existing.some((e) => e.isLinked || e.isMandatory === false);
  const groupId = own[0]?.groupId;
  const startsAsBatches = own.some((e) => e.batchId);

  const [mode, setMode] = useState<'whole' | 'batches'>(startsAsBatches ? 'batches' : 'whole');
  const [whole, setWhole] = useState<Row>(() => {
    const e = own.find((x) => !x.batchId);
    return e ? { subjectId: e.subjectId, teacherId: e.teacherId, room: e.roomNumber ?? '' } : EMPTY;
  });
  const [perBatch, setPerBatch] = useState<Record<string, Row>>(() =>
    Object.fromEntries(
      batches.map((b) => {
        const e = own.find((x) => x.batchId === b._id);
        return [
          b._id,
          e ? { subjectId: e.subjectId, teacherId: e.teacherId, room: e.roomNumber ?? '' } : EMPTY,
        ];
      })
    )
  );
  const [double, setDouble] = useState(false);
  const [busy, setBusy] = useState<Map<string, string>>(new Map());
  const [busyNext, setBusyNext] = useState<Map<string, string>>(new Map());
  const [teachersByDept, setTeachersByDept] = useState<Record<string, Teacher[]>>({});
  const [allTeachers, setAllTeachers] = useState<Map<string, Teacher>>(new Map());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    teachingApi
      .getBusyTeachers(slot._id, day, groupId)
      .then((r) => setBusy(new Map(r.data.map((b) => [b.teacherId, b.where]))))
      .catch(() => setBusy(new Map()));
    academicApi
      .getAvailableTeachers()
      .then((r) => setAllTeachers(new Map(((r.data ?? []) as Teacher[]).map((t) => [t._id, t]))))
      .catch(() => setAllTeachers(new Map()));
    if (nextSlot) {
      teachingApi
        .getBusyTeachers(nextSlot._id, day)
        .then((r) => setBusyNext(new Map(r.data.map((b) => [b.teacherId, b.where]))))
        .catch(() => setBusyNext(new Map()));
    }
  }, [slot._id, day, groupId, nextSlot?._id]);

  // Teachers of every department any chosen subject belongs to.
  const chosen = mode === 'whole' ? [whole] : Object.values(perBatch);
  const deptKey = [
    ...new Set(
      chosen
        .map((r) => subjects.get(r.subjectId)?.ownerDepartmentId ?? departmentId)
        .filter(Boolean)
    ),
  ]
    .sort()
    .join(',');
  const requested = useRef(new Set<string>());
  useEffect(() => {
    for (const d of deptKey ? deptKey.split(',') : []) {
      if (requested.current.has(d)) continue;
      requested.current.add(d);
      hrApi
        .getStaff({ departmentId: d, isTeaching: true, status: 'active', limit: 200 })
        .then((r) =>
          setTeachersByDept((m) => ({
            ...m,
            [d]: (
              (r.data ?? []) as Array<{
                _id: string;
                employeeId?: string;
                displayName?: string;
                firstName?: string;
                lastName?: string;
              }>
            ).map((t) => ({ _id: t._id, name: nameOf(t), employeeId: t.employeeId })),
          }))
        )
        .catch(() => setTeachersByDept((m) => ({ ...m, [d]: [] })));
    }
  }, [deptKey]);

  const assignedFor = (subjectId: string) =>
    sectionSubjects.find((s) => s.subjectId === subjectId)?.teacherId ?? null;
  const pickSubject = (row: Row, subjectId: string): Row => {
    const t = assignedFor(subjectId);
    return { ...row, subjectId, teacherId: t && !busy.has(t) ? t : '' };
  };

  const labSubjects = sectionSubjects.filter((s) => isLab(subjects.get(s.subjectId)));
  const otherSubjects = sectionSubjects.filter((s) => !isLab(subjects.get(s.subjectId)));
  const subjectLabel = (id: string) => {
    const s = subjects.get(id);
    return s ? `${s.name} · ${s.code}${s.type === 'practical' ? ' (lab)' : ''}` : 'Subject';
  };

  const subjectSelect = (row: Row, onPick: (r: Row) => void, labFirst: boolean) => (
    <Select
      value={row.subjectId || NONE}
      onValueChange={(v) => onPick(v === NONE ? EMPTY : pickSubject(row, v))}
    >
      <SelectTrigger>
        <SelectValue placeholder="Pick a subject" />
      </SelectTrigger>
      <SelectContent>
        {labFirst ? (
          <>
            <SelectItem value={NONE}>No lab this period (free)</SelectItem>
            {labSubjects.length > 0 && (
              <SelectGroup>
                <SelectLabel>Lab subjects</SelectLabel>
                {labSubjects.map((s) => (
                  <SelectItem key={s.subjectId} value={s.subjectId}>
                    {subjectLabel(s.subjectId)}
                  </SelectItem>
                ))}
              </SelectGroup>
            )}
            {otherSubjects.length > 0 && (
              <SelectGroup>
                <SelectLabel>Other subjects</SelectLabel>
                {otherSubjects.map((s) => (
                  <SelectItem key={s.subjectId} value={s.subjectId}>
                    {subjectLabel(s.subjectId)}
                  </SelectItem>
                ))}
              </SelectGroup>
            )}
          </>
        ) : (
          <>
            <SelectItem value={NONE} disabled>
              Pick a subject
            </SelectItem>
            {sectionSubjects.map((s) => (
              <SelectItem key={s.subjectId} value={s.subjectId}>
                {subjectLabel(s.subjectId)}
              </SelectItem>
            ))}
          </>
        )}
      </SelectContent>
    </Select>
  );

  const teacherSelect = (
    row: Row,
    onPick: (r: Row) => void,
    takenByOthers: Map<string, string>
  ) => {
    const dept = subjects.get(row.subjectId)?.ownerDepartmentId ?? departmentId;
    const assigned = assignedFor(row.subjectId);
    const deptList = (dept && teachersByDept[dept]) || [];
    const assignedT = assigned
      ? (deptList.find((t) => t._id === assigned) ??
        allTeachers.get(assigned) ?? { _id: assigned, name: 'Assigned teacher' })
      : null;
    const item = (t: Teacher) => {
      const why = busy.get(t._id) ?? takenByOthers.get(t._id);
      return (
        <SelectItem key={t._id} value={t._id} disabled={!!why}>
          {t.name}
          {t.employeeId ? ` · ${t.employeeId}` : ''}
          {why ? ` — busy: ${why}` : ''}
        </SelectItem>
      );
    };
    return (
      <Select
        value={row.teacherId || NONE}
        onValueChange={(v) => v !== NONE && onPick({ ...row, teacherId: v })}
        disabled={!row.subjectId}
      >
        <SelectTrigger>
          <SelectValue placeholder={row.subjectId ? 'Pick a teacher' : 'Subject first'} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE} disabled>
            Pick a teacher
          </SelectItem>
          {assignedT && (
            <SelectGroup>
              <SelectLabel>Assigned to this subject here</SelectLabel>
              {item(assignedT)}
            </SelectGroup>
          )}
          {deptList.filter((t) => t._id !== assigned).length > 0 && (
            <SelectGroup>
              <SelectLabel>Other teachers of this subject&apos;s department</SelectLabel>
              {deptList.filter((t) => t._id !== assigned).map(item)}
            </SelectGroup>
          )}
        </SelectContent>
      </Select>
    );
  };

  const batchRows = batches.filter((b) => perBatch[b._id]?.subjectId);
  // A double period needs every chosen teacher free in the next one too.
  const pickedTeachers = (mode === 'whole' ? [whole] : batchRows.map((b) => perBatch[b._id]))
    .map((r) => r.teacherId)
    .filter(Boolean);
  const nextBlocker = pickedTeachers
    .map((id) => {
      const where = busyNext.get(id);
      const name = allTeachers.get(id)?.name ?? 'A chosen teacher';
      return where ? `${name} is busy then (${where})` : null;
    })
    .find(Boolean);
  useEffect(() => {
    if (nextBlocker) setDouble(false);
  }, [nextBlocker]);
  const valid =
    mode === 'whole'
      ? !!whole.subjectId && !!whole.teacherId
      : batchRows.length > 0 && batchRows.every((b) => perBatch[b._id].teacherId);

  const rowsToSave = () =>
    mode === 'whole'
      ? [
          {
            subjectId: whole.subjectId,
            teacherId: whole.teacherId,
            isMandatory: true,
            ...(whole.room && { roomNumber: whole.room }),
          },
        ]
      : batchRows.map((b) => {
          const r = perBatch[b._id];
          return {
            subjectId: r.subjectId,
            teacherId: r.teacherId,
            batchId: b._id,
            isMandatory: true,
            ...(r.room && { roomNumber: r.room }),
          };
        });

  const save = async () => {
    setSaving(true);
    const rows = rowsToSave();
    try {
      if (groupId) {
        // Keep entry ids for rows that stay (same batch, or the whole-section row).
        await teachingApi.updateGroup(groupId, {
          subjects: rows.map((r) => {
            const match = own.find(
              (e) => (e.batchId ?? null) === ((r as { batchId?: string }).batchId ?? null)
            );
            return { ...r, ...(match && { entryId: match._id }) };
          }),
        });
      } else {
        await teachingApi.createEntry({
          sectionId,
          slotId: slot._id,
          dayOfWeek: day,
          subjects: rows,
        });
      }
      let msg = `${DAYS[day]} ${slot.name} saved`;
      if (double && nextSlot) {
        try {
          await teachingApi.createEntry({
            sectionId,
            slotId: nextSlot._id,
            dayOfWeek: day,
            subjects: rows,
          });
          msg = `${DAYS[day]} ${slot.name} + ${nextSlot.name} saved (double lab)`;
        } catch (err) {
          toast.error(
            `${slot.name} saved, but ${nextSlot.name} couldn't be: ${errorMessage(err, 'clash')}`
          );
        }
      }
      toast.success(msg);
      await onSaved();
      onClose();
    } catch (err) {
      toast.error(errorMessage(err, 'Could not save this period'));
    } finally {
      setSaving(false);
    }
  };
  const clear = async () => {
    if (!groupId) return;
    setSaving(true);
    try {
      await teachingApi.deleteGroup(groupId);
      toast.success(`${DAYS[day]} ${slot.name} cleared`);
      await onSaved();
      onClose();
    } catch (err) {
      toast.error(errorMessage(err, 'Could not clear this period'));
    } finally {
      setSaving(false);
    }
  };

  // Teachers already picked in another batch row this period.
  const takenExcept = (batchId: string) =>
    new Map(
      batches
        .filter((b) => b._id !== batchId && perBatch[b._id]?.teacherId)
        .map((b) => [perBatch[b._id].teacherId, `taking ${b.name} this period`])
    );

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {DAYS[day]} · {slot.name} ({slot.startTime}–{slot.endTime})
          </DialogTitle>
          <DialogDescription>
            Only this section&apos;s subjects are listed; teachers busy at this time are greyed out.
          </DialogDescription>
        </DialogHeader>

        {complex ? (
          <p className="text-sm text-muted-foreground">
            This period is an elective or a class combined with other sections. Edit it in{' '}
            <Link
              href={`/hr/timetable?sectionId=${sectionId}`}
              className="text-primary hover:underline"
            >
              Electives &amp; combined classes
            </Link>
            .
          </p>
        ) : sectionSubjects.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            This section has no subjects yet. Add them to its semester in the program&apos;s
            Curriculum (Explorer), then come back.
          </p>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              {(['whole', 'batches'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={`flex items-start gap-2 rounded-lg border p-3 text-left text-sm transition-colors ${mode === m ? 'border-primary bg-primary/[0.05]' : 'hover:bg-muted/50'}`}
                >
                  {m === 'whole' ? (
                    <Users className="mt-0.5 h-4 w-4 text-primary" />
                  ) : (
                    <FlaskConical className="mt-0.5 h-4 w-4 text-primary" />
                  )}
                  <span>
                    <span className="block font-medium">
                      {m === 'whole' ? 'Whole section' : 'Lab by batches'}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {m === 'whole'
                        ? 'One subject and teacher for everyone'
                        : 'Each batch has its own lab, teacher and room'}
                    </span>
                  </span>
                </button>
              ))}
            </div>

            {mode === 'whole' ? (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Subject</Label>
                  {subjectSelect(whole, setWhole, false)}
                  {subjects.get(whole.subjectId)?.type === 'practical' && batches.length > 0 && (
                    <p className="text-xs text-amber-600">
                      This is a lab subject — usually booked per batch. Switch to “Lab by batches”.
                    </p>
                  )}
                </div>
                <div className="grid grid-cols-[1fr_140px] gap-3">
                  <div className="space-y-1.5">
                    <Label>Teacher</Label>
                    {teacherSelect(whole, setWhole, new Map())}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="room">Room</Label>
                    <Input
                      id="room"
                      value={whole.room}
                      onChange={(e) => setWhole({ ...whole, room: e.target.value })}
                      placeholder="BLR-140"
                    />
                  </div>
                </div>
              </div>
            ) : batches.length === 0 ? (
              <div className="space-y-2 rounded-lg border border-dashed p-4 text-sm">
                <p>This section has no lab batches yet.</p>
                <Button size="sm" onClick={onManageBatches}>
                  Create lab batches
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {batches.map((b) => {
                  const row = perBatch[b._id] ?? EMPTY;
                  const setRow = (r: Row) => setPerBatch((m) => ({ ...m, [b._id]: r }));
                  return (
                    <div key={b._id} className="space-y-2 rounded-lg border p-3">
                      <p className="text-sm font-semibold">Batch {b.name}</p>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1.3fr_1.3fr_110px]">
                        {subjectSelect(row, setRow, true)}
                        {teacherSelect(row, setRow, takenExcept(b._id))}
                        <Input
                          value={row.room}
                          onChange={(e) => setRow({ ...row, room: e.target.value })}
                          placeholder="Lab room"
                          aria-label={`Room for batch ${b.name}`}
                          disabled={!row.subjectId}
                        />
                      </div>
                    </div>
                  );
                })}
                <p className="text-xs text-muted-foreground">
                  Same lab in two rooms, two labs side by side, or only some batches — leave a batch
                  on “No lab” and it&apos;s free.{' '}
                  <button
                    type="button"
                    className="text-primary hover:underline"
                    onClick={onManageBatches}
                  >
                    Change batches
                  </button>
                </p>
              </div>
            )}

            {nextSlot && (
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <Checkbox
                  checked={double}
                  disabled={nextSlotTaken || !!nextBlocker}
                  onCheckedChange={(v) => setDouble(!!v)}
                />
                Also book {nextSlot.name} ({nextSlot.startTime}–{nextSlot.endTime}) — a double
                period
                {(nextSlotTaken || nextBlocker) && (
                  <span className="text-xs text-muted-foreground">
                    (
                    {nextSlotTaken
                      ? `${nextSlot.name} already has a class — clear it first`
                      : nextBlocker}
                    )
                  </span>
                )}
              </label>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          {groupId && !complex ? (
            <Button variant="ghost" className="text-destructive" onClick={clear} disabled={saving}>
              <Trash2 className="mr-1.5 h-4 w-4" />
              Clear period
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            {!complex && sectionSubjects.length > 0 && (
              <Button onClick={save} disabled={saving || !valid}>
                {saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}Save
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
