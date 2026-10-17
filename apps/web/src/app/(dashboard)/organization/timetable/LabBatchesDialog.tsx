'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Plus, Shuffle, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { academicApi, studentApi } from '@/lib/api';
import { errorMessage } from '../explorer/parts';

export interface LabBatch {
  _id: string;
  name: string;
}
interface StudentRow {
  _id: string;
  displayName: string;
  rollNumber?: string;
  admissionNumber?: string;
  currentEnrollment?: { labBatchId?: string };
}

const NONE = '__none__';

/**
 * A section's lab batches (A1, A2…) and who is in each. Lab periods in the
 * timetable are booked per batch; attendance for a lab lists only its batch.
 */
export function LabBatchesDialog({
  open,
  sectionId,
  sectionName,
  onClose,
  onChanged,
}: {
  open: boolean;
  sectionId: string;
  sectionName: string;
  onClose: () => void;
  onChanged: () => Promise<void> | void;
}) {
  const [batches, setBatches] = useState<LabBatch[] | null>(null);
  const [names, setNames] = useState<Record<string, string>>({});
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [assigned, setAssigned] = useState<Record<string, string | null>>({});
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [sec, st] = await Promise.all([
      academicApi.getSection(sectionId).catch(() => ({ data: null })),
      studentApi
        .getStudents({ sectionId, limit: 300, status: 'active' })
        .catch(() => ({ data: [] })),
    ]);
    const list = ((sec.data?.batches ?? []) as LabBatch[]).sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { numeric: true })
    );
    setBatches(list);
    setNames(Object.fromEntries(list.map((b) => [b._id, b.name])));
    const rows = ((st.data ?? []) as StudentRow[]).sort((a, b) =>
      String(a.rollNumber ?? a.admissionNumber ?? '').localeCompare(
        String(b.rollNumber ?? b.admissionNumber ?? ''),
        undefined,
        { numeric: true }
      )
    );
    setStudents(rows);
    setAssigned(
      Object.fromEntries(rows.map((s) => [s._id, s.currentEnrollment?.labBatchId ?? null]))
    );
    setDirty(false);
  }, [sectionId]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const counts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const b of Object.values(assigned)) if (b) m[b] = (m[b] ?? 0) + 1;
    return m;
  }, [assigned]);
  const unassigned = students.filter((s) => !assigned[s._id]).length;

  const saveBatches = async (list: Array<{ _id?: string; name: string }>, ok: string) => {
    setBusy(true);
    try {
      await academicApi.updateSectionBatches(sectionId, list);
      toast.success(ok);
      await load();
      await onChanged();
    } catch (err) {
      toast.error(errorMessage(err, 'Could not save the batches'));
    } finally {
      setBusy(false);
    }
  };

  const createBatches = (n: number) =>
    saveBatches(
      Array.from({ length: n }, (_, i) => ({ name: `${sectionName}${i + 1}` })),
      `${n} batches created — now split the students`
    );
  const addBatch = () =>
    saveBatches(
      [
        ...(batches ?? []).map((b) => ({ _id: b._id, name: names[b._id] ?? b.name })),
        { name: `${sectionName}${(batches?.length ?? 0) + 1}` },
      ],
      'Batch added'
    );
  const renameAll = () =>
    saveBatches(
      (batches ?? []).map((b) => ({ _id: b._id, name: (names[b._id] ?? b.name).trim() })),
      'Batch names saved'
    );
  const removeBatch = (id: string) =>
    saveBatches(
      (batches ?? [])
        .filter((b) => b._id !== id)
        .map((b) => ({ _id: b._id, name: names[b._id] ?? b.name })),
      'Batch removed'
    );

  /** Roll-number order, cut into equal runs: 1–20 → A1, 21–40 → A2… */
  const splitEvenly = () => {
    if (!batches?.length) return;
    const per = Math.ceil(students.length / batches.length);
    setAssigned(
      Object.fromEntries(students.map((s, i) => [s._id, batches[Math.floor(i / per)]._id]))
    );
    setDirty(true);
  };

  const saveAssignments = async () => {
    setBusy(true);
    try {
      const changes = students
        .filter((s) => (s.currentEnrollment?.labBatchId ?? null) !== (assigned[s._id] ?? null))
        .map((s) => ({ studentId: s._id, batchId: assigned[s._id] ?? null }));
      if (changes.length) await academicApi.assignLabBatches(sectionId, changes);
      toast.success(
        `${changes.length} student${changes.length === 1 ? '' : 's'} placed in batches`
      );
      await load();
      await onChanged();
    } catch (err) {
      toast.error(errorMessage(err, 'Could not save the batch lists'));
    } finally {
      setBusy(false);
    }
  };

  const renamed = (batches ?? []).some((b) => (names[b._id] ?? b.name).trim() !== b.name);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Lab batches — Section {sectionName}</DialogTitle>
          <DialogDescription>
            Split the section into smaller groups for labs. In the timetable a lab period is booked
            per batch, and lab attendance lists only that batch.
          </DialogDescription>
        </DialogHeader>

        {batches === null ? (
          <div className="flex h-32 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : batches.length === 0 ? (
          <div className="space-y-3 rounded-lg border border-dashed p-4">
            <p className="text-sm">
              No lab batches yet. {students.length} students in this section — how many groups?
            </p>
            <div className="flex flex-wrap gap-2">
              {[2, 3, 4].map((n) => (
                <Button key={n} variant="outline" disabled={busy} onClick={() => createBatches(n)}>
                  {n} batches (~{Math.ceil(students.length / n) || 0} each)
                </Button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            <section className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Batches
              </p>
              <div className="flex flex-wrap items-center gap-2">
                {batches.map((b) => (
                  <div key={b._id} className="flex items-center gap-1 rounded-lg border px-2 py-1">
                    <Input
                      className="h-7 w-24 border-0 px-1 font-medium shadow-none focus-visible:ring-0"
                      value={names[b._id] ?? b.name}
                      onChange={(e) => setNames((n) => ({ ...n, [b._id]: e.target.value }))}
                      aria-label={`Name of batch ${b.name}`}
                    />
                    <span className="text-xs text-muted-foreground">{counts[b._id] ?? 0}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive"
                      disabled={busy}
                      onClick={() => removeBatch(b._id)}
                      aria-label={`Remove batch ${b.name}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy || batches.length >= 10}
                  onClick={addBatch}
                >
                  <Plus className="mr-1 h-4 w-4" />
                  Add batch
                </Button>
                {renamed && (
                  <Button size="sm" disabled={busy} onClick={renameAll}>
                    Save names
                  </Button>
                )}
              </div>
            </section>

            <section className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Students{' '}
                  {unassigned > 0 && (
                    <span className="text-amber-600">· {unassigned} not in a batch</span>
                  )}
                </p>
                <Button variant="outline" size="sm" onClick={splitEvenly} disabled={busy}>
                  <Shuffle className="mr-1.5 h-4 w-4" />
                  Split evenly by roll number
                </Button>
              </div>
              <div className="max-h-72 divide-y overflow-y-auto rounded-lg border">
                {students.map((s) => (
                  <div key={s._id} className="flex items-center gap-3 px-3 py-1.5 text-sm">
                    <span className="w-16 font-mono text-xs text-muted-foreground">
                      {s.rollNumber ?? '—'}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{s.displayName}</span>
                    <Select
                      value={assigned[s._id] ?? NONE}
                      onValueChange={(v) => {
                        setAssigned((a) => ({ ...a, [s._id]: v === NONE ? null : v }));
                        setDirty(true);
                      }}
                    >
                      <SelectTrigger className="h-8 w-32" aria-label={`Batch for ${s.displayName}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>No batch</SelectItem>
                        {batches.map((b) => (
                          <SelectItem key={b._id} value={b._id}>
                            {b.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          {!!batches?.length && (
            <Button disabled={busy || !dirty} onClick={saveAssignments}>
              {busy && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}Save batch lists
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
