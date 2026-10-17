'use client';

import { useEffect, useState } from 'react';
import { CalendarRange, Loader2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import { SemestersDialog, type BatchTerm } from '@/components/academic/SemestersDialog';
import { academicApi } from '@/lib/api';
import { errorMessage } from './parts';

export interface YearBatch {
  _id: string;
  name: string;
  code?: string;
  isCurrent?: boolean;
  startDate?: string;
  endDate?: string;
  terms?: BatchTerm[];
}

const fmt = (d?: string) =>
  d
    ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : '';

/** The campus's academic years: which one is running, its semesters, and the next one. */
export function AcademicYearCard({
  batches,
  canEdit,
  onChanged,
}: {
  batches: YearBatch[];
  canEdit: boolean;
  onChanged: () => void | Promise<void>;
}) {
  const current = batches.find((b) => b.isCurrent) ?? batches[0];
  const others = batches.filter((b) => b._id !== current?._id);
  const [semesters, setSemesters] = useState(false);
  const [creating, setCreating] = useState(false);

  const makeCurrent = async (b: YearBatch) => {
    try {
      await academicApi.setCurrentBatch(b._id);
      toast.success(`${b.name} is now the current academic year`);
      await onChanged();
    } catch (err) {
      toast.error(errorMessage(err, 'Could not switch the academic year'));
    }
  };

  return (
    <section className="rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <CalendarRange className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Academic year
            </p>
            {current ? (
              <>
                <p className="font-semibold">
                  {current.name}{' '}
                  <Badge variant="secondary" className="ml-1 text-[10px]">
                    Current
                  </Badge>
                </p>
                <p className="text-xs text-muted-foreground">
                  {fmt(current.startDate)} – {fmt(current.endDate)} ·{' '}
                  {(current.terms ?? []).map((t) => t.name).join(', ') || 'no semesters yet'}
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">None yet — add the first one.</p>
            )}
          </div>
        </div>
        {canEdit && (
          <div className="flex flex-wrap gap-2">
            {current && (
              <Button variant="outline" size="sm" onClick={() => setSemesters(true)}>
                Semesters
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => setCreating(true)}>
              <Plus className="mr-1.5 h-4 w-4" />
              New academic year
            </Button>
          </div>
        )}
      </div>
      {others.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3 text-xs text-muted-foreground">
          Other years:
          {others.map((b) => (
            <span key={b._id} className="flex items-center gap-1 rounded-md border px-2 py-1">
              {b.name}
              {canEdit && (
                <button className="text-primary hover:underline" onClick={() => makeCurrent(b)}>
                  make current
                </button>
              )}
            </span>
          ))}
        </div>
      )}
      {current && (
        <SemestersDialog
          open={semesters}
          onClose={() => setSemesters(false)}
          batchId={current._id}
          batchName={current.name}
          terms={current.terms ?? []}
          canManage={canEdit}
          onChanged={onChanged}
        />
      )}
      <NewYearDialog
        open={creating}
        after={batches.reduce<YearBatch | undefined>(
          (a, b) => (!a || (b.endDate ?? '') > (a.endDate ?? '') ? b : a),
          undefined
        )}
        onClose={() => setCreating(false)}
        onCreated={onChanged}
      />
    </section>
  );
}

/** Suggests the year after the latest one: AY 2027-28, 1 Jul – 30 Jun. */
function NewYearDialog({
  open,
  after,
  onClose,
  onCreated,
}: {
  open: boolean;
  after?: YearBatch;
  onClose: () => void;
  onCreated: () => void | Promise<void>;
}) {
  const startYear = after?.endDate
    ? new Date(after.endDate).getFullYear()
    : new Date().getFullYear();
  const startMonth = after?.startDate ? new Date(after.startDate).getMonth() : 5;
  const iso = (y: number, m: number, d: number) =>
    `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const suggestion = {
    name: `AY ${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}`,
    code: `AY${String(startYear % 100).padStart(2, '0')}${String((startYear + 1) % 100).padStart(2, '0')}`,
    startDate: iso(startYear, startMonth, 1),
    // The day before the same date next year.
    endDate: (() => {
      const e = new Date(startYear + 1, startMonth, 0);
      return iso(e.getFullYear(), e.getMonth(), e.getDate());
    })(),
  };
  const [form, setForm] = useState(suggestion);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (open) setForm(suggestion);
  }, [open]); // the suggestion only needs refreshing when the dialog opens

  const save = async () => {
    setSaving(true);
    try {
      await academicApi.createAcademicBatch(form);
      toast.success(
        `${form.name} created. Copy this year's structure into it from the Setup guide.`
      );
      await onCreated();
      onClose();
    } catch (err) {
      toast.error(errorMessage(err, 'Could not create the academic year'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New academic year</DialogTitle>
          <DialogDescription>
            It starts empty. Add its semesters, then use the Setup guide to copy this year&apos;s
            years and sections into it.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 space-y-1.5">
            <Label>Name</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Code</Label>
            <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
          </div>
          <div />
          <div className="space-y-1.5">
            <Label>Starts</Label>
            <Input
              type="date"
              value={form.startDate}
              onChange={(e) => setForm({ ...form, startDate: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Ends</Label>
            <Input
              type="date"
              value={form.endDate}
              onChange={(e) => setForm({ ...form, endDate: e.target.value })}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={saving || !form.name.trim() || !form.code.trim()} onClick={save}>
            {saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
