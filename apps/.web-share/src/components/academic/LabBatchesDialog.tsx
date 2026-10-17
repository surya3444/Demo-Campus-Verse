'use client';

import { useEffect, useMemo, useState } from 'react';
import { academicApi, studentApi } from '@/lib/api';
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
import { FlaskConical, Plus, Trash2, Loader2, Shuffle, Users } from 'lucide-react';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/utils';

export interface LabBatch {
  _id: string;
  name: string;
}

export interface LabBatchesTarget {
  sectionId: string;
  sectionName: string;
  className: string;
  batches: LabBatch[];
}

interface LabBatchesDialogProps {
  /** Section under management; null keeps the dialog closed. */
  target: LabBatchesTarget | null;
  canManage: boolean;
  onClose: () => void;
  /** Called with the saved list so the parent can patch local state. */
  onSaved: (sectionId: string, batches: LabBatch[]) => void;
}

/** Editable row; `key` is a stable client id, `serverId` survives renames. */
interface BatchRow {
  key: string;
  serverId?: string;
  name: string;
}

interface StudentLite {
  _id: string;
  displayName?: string;
  rollNumber?: number;
  admissionNumber?: string;
  currentEnrollment?: { labBatchId?: string };
}

const UNASSIGNED = '__none__';
const MAX_BATCHES = 10;

let keySeq = 0;
const nextKey = () => `batch-${++keySeq}`;

/**
 * Manage a section's lab batches: define the batch list and place students
 * into batches. Batches subdivide a section for practical scheduling — the
 * timetable and per-batch attendance registers consume them from here.
 */
export function LabBatchesDialog({ target, canManage, onClose, onSaved }: LabBatchesDialogProps) {
  const [rows, setRows] = useState<BatchRow[]>([]);
  const [students, setStudents] = useState<StudentLite[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  /** studentId → BatchRow.key (or UNASSIGNED). */
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  // (Re)initialise whenever a section is opened.
  useEffect(() => {
    if (!target) return;
    const initial = target.batches.map((b) => ({ key: nextKey(), serverId: b._id, name: b.name }));
    setRows(initial);
    setAssignments({});
    setStudents([]);
    setStudentsLoading(true);
    let cancelled = false;
    (async () => {
      try {
        const res = await studentApi.getStudents({
          sectionId: target.sectionId,
          limit: 200,
          status: 'active',
          sortBy: 'rollNumber',
          sortOrder: 'asc',
        });
        if (cancelled) return;
        const list: StudentLite[] = res.data ?? [];
        setStudents(list);
        const byServerId = new Map<string | undefined, string>(
          initial.map((r) => [r.serverId, r.key])
        );
        const map: Record<string, string> = {};
        for (const s of list) {
          map[s._id] = byServerId.get(s.currentEnrollment?.labBatchId) ?? UNASSIGNED;
        }
        setAssignments(map);
      } catch (err) {
        if (!cancelled) toast.error(getErrorMessage(err) || 'Failed to load students');
      } finally {
        if (!cancelled) setStudentsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // Intentionally keyed on the section id alone — `target.batches` identity
    // changes every parent render and must not re-trigger the load.
  }, [target?.sectionId]);

  const memberCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const key of Object.values(assignments)) {
      if (key !== UNASSIGNED) counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  }, [assignments]);

  if (!target) return null;

  const addBatch = () => {
    if (rows.length >= MAX_BATCHES) {
      toast.error(`A section can have at most ${MAX_BATCHES} lab batches`);
      return;
    }
    setRows((prev) => [...prev, { key: nextKey(), name: `Batch ${prev.length + 1}` }]);
  };

  const removeBatch = (key: string) => {
    setRows((prev) => prev.filter((r) => r.key !== key));
    // Members of the removed batch fall back to unassigned.
    setAssignments((prev) => {
      const next = { ...prev };
      for (const [studentId, batchKey] of Object.entries(next)) {
        if (batchKey === key) next[studentId] = UNASSIGNED;
      }
      return next;
    });
  };

  const distributeEvenly = () => {
    if (rows.length === 0) return;
    setAssignments(() => {
      const next: Record<string, string> = {};
      students.forEach((s, i) => {
        next[s._id] = rows[i % rows.length].key;
      });
      return next;
    });
    toast.success(`${students.length} students distributed across ${rows.length} batches`);
  };

  const handleSave = async () => {
    if (rows.some((r) => !r.name.trim())) {
      toast.error('Every batch needs a name');
      return;
    }
    setSaving(true);
    try {
      // 1. Save the batch list. The server preserves order, so the response
      //    aligns index-for-index with what we sent — that mapping resolves
      //    the ids of newly created batches.
      const res = await academicApi.updateSectionBatches(
        target.sectionId,
        rows.map((r) => ({ ...(r.serverId ? { _id: r.serverId } : {}), name: r.name.trim() }))
      );
      const saved: LabBatch[] = res.data?.batches ?? [];
      const keyToServerId = new Map(rows.map((r, i) => [r.key, saved[i]?._id]));

      // 2. Push only the assignments that changed.
      const diff: Array<{ studentId: string; batchId: string | null }> = [];
      for (const s of students) {
        const selectedKey = assignments[s._id] ?? UNASSIGNED;
        const nextId = selectedKey === UNASSIGNED ? null : (keyToServerId.get(selectedKey) ?? null);
        const prevId = s.currentEnrollment?.labBatchId ?? null;
        if (nextId !== prevId) diff.push({ studentId: s._id, batchId: nextId });
      }
      if (diff.length > 0) {
        await academicApi.assignLabBatches(target.sectionId, diff);
      }

      toast.success(
        diff.length > 0
          ? `Lab batches saved · ${diff.length} students reassigned`
          : 'Lab batches saved'
      );
      onSaved(target.sectionId, saved);
      onClose();
    } catch (err) {
      toast.error(getErrorMessage(err) || 'Failed to save lab batches');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FlaskConical className="h-4 w-4 text-primary" />
            Lab batches — {target.className} · {target.sectionName}
          </DialogTitle>
          <DialogDescription>
            Batches subdivide this section for practicals: schedule lab periods per batch in the
            timetable and mark per-batch lab attendance.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto pr-1">
          {/* ───── Batch list ───── */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Batches</p>
              <Button
                variant="outline"
                size="sm"
                className="h-7 gap-1 text-xs"
                onClick={addBatch}
                disabled={!canManage || rows.length >= MAX_BATCHES}
              >
                <Plus className="h-3 w-3" /> Add batch
              </Button>
            </div>
            {rows.length === 0 ? (
              <p className="rounded-lg border border-dashed py-4 text-center text-sm text-muted-foreground">
                No lab batches yet — add one to start splitting this section.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {rows.map((row) => (
                  <li key={row.key} className="flex items-center gap-2">
                    <Input
                      value={row.name}
                      onChange={(e) =>
                        setRows((prev) =>
                          prev.map((r) => (r.key === row.key ? { ...r, name: e.target.value } : r))
                        )
                      }
                      disabled={!canManage}
                      className="h-8 text-sm"
                      maxLength={50}
                    />
                    <span className="flex w-24 shrink-0 items-center gap-1 font-mono text-[11px] text-muted-foreground">
                      <Users className="h-3 w-3" />
                      {memberCounts.get(row.key) ?? 0} students
                    </span>
                    <button
                      onClick={() => removeBatch(row.key)}
                      disabled={!canManage}
                      aria-label="Remove batch"
                      className="shrink-0 text-muted-foreground/40 transition-colors hover:text-destructive disabled:pointer-events-none"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {rows.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Removing a batch unassigns its students; it does not remove them from the section.
              </p>
            )}
          </div>

          {/* ───── Student assignment ───── */}
          {rows.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">
                  Students
                  <span className="ml-1.5 font-mono text-xs text-muted-foreground">
                    · {students.length}
                  </span>
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1 text-xs"
                  onClick={distributeEvenly}
                  disabled={!canManage || students.length === 0}
                >
                  <Shuffle className="h-3 w-3" /> Distribute evenly
                </Button>
              </div>
              {studentsLoading ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                </div>
              ) : students.length === 0 ? (
                <p className="rounded-lg border border-dashed py-4 text-center text-sm text-muted-foreground">
                  No active students in this section.
                </p>
              ) : (
                <ul className="divide-y rounded-lg border">
                  {students.map((s) => (
                    <li key={s._id} className="flex items-center justify-between gap-3 px-3 py-1.5">
                      <div className="min-w-0">
                        <p className="truncate text-sm">{s.displayName || 'Student'}</p>
                        <p className="font-mono text-[10px] text-muted-foreground">
                          {s.rollNumber != null && `Roll ${s.rollNumber} · `}
                          {s.admissionNumber}
                        </p>
                      </div>
                      <Select
                        value={assignments[s._id] ?? UNASSIGNED}
                        onValueChange={(v) => setAssignments((prev) => ({ ...prev, [s._id]: v }))}
                        disabled={!canManage}
                      >
                        <SelectTrigger className="h-8 w-36 shrink-0 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
                          {rows.map((r) => (
                            <SelectItem key={r.key} value={r.key}>
                              {r.name.trim() || 'Unnamed batch'}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!canManage || saving} className="gap-2">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
