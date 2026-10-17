'use client';

import { useState } from 'react';
import { termApi } from '@/lib/api';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { CalendarRange, Plus, Pencil, Trash2, Clock, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/utils';

export interface BatchTerm {
  _id: string;
  name: string;
  half?: 'odd' | 'even';
  /** Trimester calendars: 3 for the third term of the session. */
  part?: 1 | 2 | 3;
  semesterNumber?: number;
  startDate: string;
  endDate: string;
  registrationWindow?: { opensAt: string; closesAt: string };
  addDropDeadline?: string;
}

interface SemestersDialogProps {
  open: boolean;
  onClose: () => void;
  batchId: string;
  batchName: string;
  terms: BatchTerm[];
  canManage: boolean;
  /** Called after any successful mutation so the parent can refetch. */
  onChanged: () => void | Promise<void>;
}

const NONE_HALF = '__none__';

function toDateInput(value?: string): string {
  if (!value) return '';
  const d = new Date(value);
  return isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
}

function toDateTimeInput(value?: string): string {
  if (!value) return '';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const THIRD_TERM = 'third';

/**
 * Where the term sits in the session. The semester each class is in follows
 * from this and its program's year plan (an annual year spans the whole
 * session), so no fixed "Sem 1 · 3 · 5 · 7" label applies across programs.
 */
export function termPositionLabel(term: { half?: 'odd' | 'even'; part?: number }): string | null {
  if (term.part === 3) return '3rd term of the year';
  if (term.half === 'odd' || term.part === 1) return '1st term of the year';
  if (term.half === 'even' || term.part === 2) return '2nd term of the year';
  return null;
}

/**
 * Manage the semester terms of one academic session. Terms subdivide the
 * session (they aren't a hierarchy level), so this lives with the academic
 * year in Academic Structure — course registration, exams, and fees consume
 * them from there.
 */
export function SemestersDialog({
  open,
  onClose,
  batchId,
  batchName,
  terms,
  canManage,
  onChanged,
}: SemestersDialogProps) {
  const [view, setView] = useState<'list' | 'form'>('list');
  const [editing, setEditing] = useState<BatchTerm | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BatchTerm | null>(null);
  const [saving, setSaving] = useState(false);

  const [formName, setFormName] = useState('');
  const [formHalf, setFormHalf] = useState<string>(NONE_HALF);
  const [formStart, setFormStart] = useState('');
  const [formEnd, setFormEnd] = useState('');
  const [formRegOpens, setFormRegOpens] = useState('');
  const [formRegCloses, setFormRegCloses] = useState('');
  const [formAddDrop, setFormAddDrop] = useState('');

  const openAdd = () => {
    setEditing(null);
    // The first term of a session is the Jul–Dec half, the second Jan–Jun —
    // pre-filled so the admin usually never thinks about it.
    const suggestedHalf = terms.some((t) => t.half === 'odd') ? 'even' : 'odd';
    const year = new Date(terms[0]?.startDate ?? Date.now()).getFullYear();
    setFormName(suggestedHalf === 'odd' ? `Odd Semester ${year}` : `Even Semester ${year}`);
    setFormHalf(suggestedHalf);
    setFormStart('');
    setFormEnd('');
    setFormRegOpens('');
    setFormRegCloses('');
    setFormAddDrop('');
    setView('form');
  };

  const openEdit = (term: BatchTerm) => {
    setEditing(term);
    setFormName(term.name);
    setFormHalf(term.part === 3 ? THIRD_TERM : (term.half ?? NONE_HALF));
    setFormStart(toDateInput(term.startDate));
    setFormEnd(toDateInput(term.endDate));
    setFormRegOpens(toDateTimeInput(term.registrationWindow?.opensAt));
    setFormRegCloses(toDateTimeInput(term.registrationWindow?.closesAt));
    setFormAddDrop(toDateInput(term.addDropDeadline));
    setView('form');
  };

  const handleSave = async () => {
    if (!formName.trim() || !formStart || !formEnd) {
      toast.error('Name, start date, and end date are required');
      return;
    }
    if ((formRegOpens && !formRegCloses) || (!formRegOpens && formRegCloses)) {
      toast.error('Set both open and close times for the registration window');
      return;
    }

    const payload: Record<string, unknown> = {
      name: formName.trim(),
      half: formHalf === NONE_HALF || formHalf === THIRD_TERM ? undefined : formHalf,
      part: formHalf === THIRD_TERM ? 3 : undefined,
      startDate: formStart,
      endDate: formEnd,
      registrationWindow:
        formRegOpens && formRegCloses
          ? {
              opensAt: new Date(formRegOpens).toISOString(),
              closesAt: new Date(formRegCloses).toISOString(),
            }
          : undefined,
      addDropDeadline: formAddDrop ? new Date(`${formAddDrop}T23:59:59`).toISOString() : undefined,
    };

    setSaving(true);
    try {
      if (editing) {
        await termApi.updateTerm(batchId, editing._id, { ...payload, _id: editing._id });
        toast.success('Semester updated');
      } else {
        await termApi.addTerm(batchId, payload);
        toast.success('Semester added');
      }
      setView('list');
      await onChanged();
    } catch (err) {
      toast.error(getErrorMessage(err) || 'Failed to save semester');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await termApi.deleteTerm(batchId, deleteTarget._id);
      toast.success('Semester deleted');
      setDeleteTarget(null);
      await onChanged();
    } catch (err) {
      toast.error(getErrorMessage(err) || 'Failed to delete semester');
    }
  };

  const close = () => {
    setView('list');
    onClose();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !o && close()}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarRange className="h-4 w-4 text-primary" />
              {view === 'form'
                ? editing
                  ? 'Edit semester'
                  : 'Add semester'
                : `Semesters · ${batchName}`}
            </DialogTitle>
            <DialogDescription>
              {view === 'form'
                ? "Pick which half of the year this semester covers — each student's semester number is worked out from their year (a Year 2 student is in Semester 3 during the first half)."
                : 'Semesters divide this academic year. Course registration, exams, and fees are scoped to them.'}
            </DialogDescription>
          </DialogHeader>

          {view === 'list' ? (
            <div className="space-y-3">
              {terms.length === 0 ? (
                <div className="rounded-lg border border-dashed bg-muted/20 p-6 text-center">
                  <CalendarRange className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    No semesters yet. Add the two halves of {batchName} so course registration and
                    exams can be scoped per semester.
                  </p>
                </div>
              ) : (
                terms.map((term) => {
                  const now = Date.now();
                  const w = term.registrationWindow;
                  const windowState = !w
                    ? 'none'
                    : now < new Date(w.opensAt).getTime()
                      ? 'upcoming'
                      : now > new Date(w.closesAt).getTime()
                        ? 'closed'
                        : 'open';
                  return (
                    <div key={term._id} className="rounded-lg border p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-medium">{term.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(term.startDate).toLocaleDateString()} –{' '}
                            {new Date(term.endDate).toLocaleDateString()}
                          </p>
                          <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {w
                              ? `Registration ${new Date(w.opensAt).toLocaleDateString()} → ${new Date(w.closesAt).toLocaleDateString()}`
                              : 'No registration window set'}
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1.5">
                          <div className="flex gap-1.5">
                            {termPositionLabel(term) && (
                              <Badge variant="secondary" className="text-[10px]">
                                {termPositionLabel(term)}
                              </Badge>
                            )}
                            {windowState === 'open' && (
                              <Badge className="text-[10px]">Reg. open</Badge>
                            )}
                            {windowState === 'upcoming' && (
                              <Badge variant="outline" className="text-[10px]">
                                Upcoming
                              </Badge>
                            )}
                          </div>
                          {canManage && (
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2"
                                onClick={() => openEdit(term)}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-muted-foreground hover:text-destructive"
                                onClick={() => setDeleteTarget(term)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}

              {canManage && (
                <Button variant="outline" className="w-full" onClick={openAdd}>
                  <Plus className="mr-1.5 h-4 w-4" /> Add semester
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="term-name">Name</Label>
                  <Input
                    id="term-name"
                    placeholder="e.g. Odd Semester 2026"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Which term of the year?</Label>
                  <Select value={formHalf} onValueChange={setFormHalf}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="odd">1st term (odd semester / trimester 1)</SelectItem>
                      <SelectItem value="even">2nd term (even semester / trimester 2)</SelectItem>
                      <SelectItem value={THIRD_TERM}>
                        3rd term (trimester calendars only)
                      </SelectItem>
                      <SelectItem value={NONE_HALF}>Not applicable (single term)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="term-start">Start date</Label>
                  <Input
                    id="term-start"
                    type="date"
                    value={formStart}
                    onChange={(e) => setFormStart(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="term-end">End date</Label>
                  <Input
                    id="term-end"
                    type="date"
                    value={formEnd}
                    onChange={(e) => setFormEnd(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="reg-opens">Registration opens</Label>
                  <Input
                    id="reg-opens"
                    type="datetime-local"
                    value={formRegOpens}
                    onChange={(e) => setFormRegOpens(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="reg-closes">Registration closes</Label>
                  <Input
                    id="reg-closes"
                    type="datetime-local"
                    value={formRegCloses}
                    onChange={(e) => setFormRegCloses(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="add-drop">Add/drop deadline (optional)</Label>
                <Input
                  id="add-drop"
                  type="date"
                  value={formAddDrop}
                  onChange={(e) => setFormAddDrop(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Students can change electives or withdraw until this date. Defaults to the
                  registration close date when unset.
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            {view === 'form' ? (
              <>
                <Button variant="ghost" onClick={() => setView('list')} disabled={saving}>
                  <ArrowLeft className="mr-1.5 h-4 w-4" /> Back
                </Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? 'Saving…' : editing ? 'Save changes' : 'Add semester'}
                </Button>
              </>
            ) : (
              <Button variant="outline" onClick={close}>
                Done
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Semesters with course registrations cannot be deleted. This does not affect the
              academic year itself.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
