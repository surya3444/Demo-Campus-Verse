'use client';

import { useEffect, useState } from 'react';
import { Loader2, Plus, Save, Trash2 } from 'lucide-react';
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
import { teachingApi } from '@/lib/api';
import { errorMessage } from '../explorer/parts';

export interface PeriodSlot {
  _id: string;
  name: string;
  startTime: string;
  endTime: string;
  order: number;
  type: 'period' | 'break' | 'assembly' | 'lunch';
}
type Row = Omit<PeriodSlot, '_id'> & { _id?: string; dirty?: boolean };

const TYPES = [
  { v: 'period', l: 'Class period' },
  { v: 'break', l: 'Break' },
  { v: 'lunch', l: 'Lunch' },
  { v: 'assembly', l: 'Assembly' },
];

/**
 * The day's time blocks for one year — shared by all its sections. The server
 * refuses a change that would overlap another period or double-book a teacher,
 * and won't delete a period that still has classes in it.
 */
export function PeriodsDialog({
  open,
  classId,
  yearLabel,
  slots,
  onClose,
  onChanged,
}: {
  open: boolean;
  classId: string;
  yearLabel: string;
  slots: PeriodSlot[];
  onClose: () => void;
  onChanged: () => Promise<void> | void;
}) {
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState<number | null>(null);

  useEffect(() => {
    if (open) setRows(slots.map((s) => ({ ...s })));
  }, [open, slots]);

  const set = (i: number, patch: Partial<Row>) =>
    setRows((r) => r.map((x, j) => (j === i ? { ...x, ...patch, dirty: true } : x)));

  const save = async (i: number) => {
    const r = rows[i];
    setBusy(i);
    try {
      const body = {
        name: r.name.trim(),
        startTime: r.startTime,
        endTime: r.endTime,
        type: r.type,
        order: r.order,
      };
      if (r._id) await teachingApi.updateSlot(r._id, body);
      else await teachingApi.createSlot({ classId, ...body });
      toast.success(`${body.name} saved`);
      await onChanged();
    } catch (err) {
      toast.error(errorMessage(err, 'Could not save this period'));
    } finally {
      setBusy(null);
    }
  };
  const remove = async (i: number) => {
    const r = rows[i];
    if (!r._id) return setRows((x) => x.filter((_, j) => j !== i));
    setBusy(i);
    try {
      await teachingApi.deleteSlot(r._id);
      toast.success(`${r.name} removed`);
      await onChanged();
    } catch (err) {
      toast.error(errorMessage(err, 'Could not remove this period'));
    } finally {
      setBusy(null);
    }
  };
  const addRow = () => {
    const last = rows[rows.length - 1];
    const start = last?.endTime ?? '09:00';
    const [h, m] = start.split(':').map(Number);
    const end = `${String(Math.floor((h * 60 + m + 50) / 60) % 24).padStart(2, '0')}:${String((m + 50) % 60).padStart(2, '0')}`;
    setRows((r) => [
      ...r,
      {
        name: `P${r.filter((x) => x.type === 'period').length + 1}`,
        startTime: start,
        endTime: end,
        type: 'period',
        order: (last?.order ?? -1) + 1,
        dirty: true,
      },
    ]);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Periods &amp; timings — {yearLabel}</DialogTitle>
          <DialogDescription>
            Every section of this year uses these times. Save each row after changing it; a change
            that would clash with a teacher&apos;s other classes is refused with the reason.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <div className="grid grid-cols-[1fr_110px_110px_150px_76px] gap-2 px-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            <span>Name</span>
            <span>Starts</span>
            <span>Ends</span>
            <span>Kind</span>
            <span />
          </div>
          {rows.map((r, i) => (
            <div
              key={r._id ?? `new-${i}`}
              className="grid grid-cols-[1fr_110px_110px_150px_76px] items-center gap-2"
            >
              <Input
                value={r.name}
                onChange={(e) => set(i, { name: e.target.value })}
                aria-label="Period name"
              />
              <Input
                type="time"
                value={r.startTime}
                onChange={(e) => set(i, { startTime: e.target.value })}
                aria-label="Starts"
              />
              <Input
                type="time"
                value={r.endTime}
                onChange={(e) => set(i, { endTime: e.target.value })}
                aria-label="Ends"
              />
              <Select value={r.type} onValueChange={(v) => set(i, { type: v as Row['type'] })}>
                <SelectTrigger aria-label="Kind">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYPES.map((t) => (
                    <SelectItem key={t.v} value={t.v}>
                      {t.l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  disabled={!r.dirty || busy !== null || !r.name.trim()}
                  onClick={() => save(i)}
                  aria-label={`Save ${r.name}`}
                >
                  {busy === i ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive"
                  disabled={busy !== null}
                  onClick={() => remove(i)}
                  aria-label={`Remove ${r.name}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={addRow}>
            <Plus className="mr-1.5 h-4 w-4" />
            Add a period
          </Button>
        </div>
        <DialogFooter>
          <Button onClick={onClose}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
