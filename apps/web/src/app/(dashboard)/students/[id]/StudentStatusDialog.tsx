'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { studentApi } from '@/lib/api';

type Status = 'active' | 'inactive' | 'alumni' | 'transferred' | 'withdrawn';

/** What each move means for the student, in the words an office uses. */
const MOVES: Record<Status, { label: string; effect: string }> = {
  active: {
    label: 'Back to studying',
    effect: 'Returns to their year and section; their login works again.',
  },
  inactive: {
    label: 'On leave',
    effect: 'Stays in their section and keeps their login — e.g. medical leave.',
  },
  withdrawn: {
    label: 'Withdrawn (dropped out)',
    effect: "Leaves the institution: this year's enrolment closes and their login is switched off.",
  },
  transferred: {
    label: 'Left with a transfer certificate',
    effect:
      'Moving to another institution: enrolment closes and their login is switched off. To move to one of your own campuses, use Transfer instead.',
  },
  alumni: {
    label: 'Graduated',
    effect:
      'Completed the program: enrolment closes, they join the alumni directory and keep their login.',
  },
};

/** How the current state reads. */
const NOW: Record<Status, string> = {
  active: 'Studying',
  inactive: 'On leave',
  withdrawn: 'Withdrawn',
  transferred: 'Left with a transfer certificate',
  alumni: 'Graduated',
};

/** From each state, the moves that make sense. */
const NEXT: Record<Status, Status[]> = {
  active: ['inactive', 'withdrawn', 'transferred', 'alumni'],
  inactive: ['active', 'withdrawn', 'transferred'],
  withdrawn: ['active'],
  transferred: ['active'],
  alumni: [],
};

export function StudentStatusDialog({
  open,
  studentId,
  name,
  status,
  onClose,
  onChanged,
}: {
  open: boolean;
  studentId: string;
  name: string;
  status: Status;
  onClose: () => void;
  onChanged: () => void | Promise<void>;
}) {
  const options = NEXT[status] ?? [];
  const [next, setNext] = useState<Status | ''>('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setNext(options[0] ?? '');
      setReason('');
    }
  }, [open]); // reset each time it opens

  const save = async () => {
    if (!next) return;
    setSaving(true);
    try {
      await studentApi.updateStudentStatus(studentId, next, reason.trim());
      toast.success(`${name}: ${MOVES[next].label.toLowerCase()}`);
      await onChanged();
      onClose();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: { message?: string } } } };
      toast.error(e.response?.data?.error?.message || 'Could not change the status');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Change {name}&apos;s status</DialogTitle>
          <DialogDescription>
            Now: <span className="font-medium">{NOW[status] ?? status}</span>. Every change is kept
            in their history with your reason.
          </DialogDescription>
        </DialogHeader>
        {options.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            A graduate&apos;s record is final. Their alumni profile is in Career Connect → Alumni.
          </p>
        ) : (
          <div className="space-y-4">
            <RadioGroup value={next} onValueChange={(v) => setNext(v as Status)} className="gap-2">
              {options.map((o) => (
                <label
                  key={o}
                  className="flex cursor-pointer items-start gap-2 rounded-md border p-2.5 text-sm"
                >
                  <RadioGroupItem value={o} className="mt-0.5" />
                  <span>
                    <span className="font-medium">{MOVES[o].label}</span>
                    <span className="block text-xs text-muted-foreground">{MOVES[o].effect}</span>
                  </span>
                </label>
              ))}
            </RadioGroup>
            <div className="space-y-1.5">
              <Label htmlFor="status-reason">Reason</Label>
              <Textarea
                id="status-reason"
                rows={2}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Medical leave until December"
              />
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          {options.length > 0 && (
            <Button onClick={save} disabled={saving || !next || reason.trim().length < 2}>
              {saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}Change status
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
