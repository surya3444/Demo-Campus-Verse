'use client';

import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { registrationApi } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
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
import {
  BookOpenCheck,
  Lock,
  CheckCircle2,
  AlertCircle,
  Clock,
  IndianRupee,
  Pencil,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import { cn } from '@/lib/utils';

// ─── Types (mirror the API context payload) ─────────────────────────────────

interface BasketOption {
  subjectId: string;
  credits: number;
  seatCap?: number;
  seatsTaken: number;
}

interface SchemeSlot {
  slotId: string;
  kind: 'core' | 'basket';
  category?: string;
  subjectId?: string;
  credits?: number;
  label?: string;
  chooseCount?: number;
  options?: BasketOption[];
}

interface SubjectInfo {
  name: string;
  code: string;
  shortName?: string;
  category?: string;
}

interface RegistrationEntry {
  slotId: string;
  kind: 'core' | 'basket';
  category?: string;
  subjectId: string;
  credits: number;
  subject: { name: string; code: string; shortName?: string } | null;
}

interface MyContext {
  student: {
    displayName: string;
    className: string;
    departmentCode: string;
    departmentName: string;
    yearNumber?: number;
  };
  batch: { _id: string; name: string } | null;
  terms: Array<{ _id: string; name: string }>;
  term: {
    _id: string;
    name: string;
    registrationWindow?: { opensAt: string; closesAt: string };
    addDropDeadline?: string;
    windowState: 'open' | 'closed' | 'upcoming' | 'not_configured';
    addDropOpen: boolean;
  } | null;
  semesterNumber: number | null;
  semesterError: string | null;
  scheme:
    | ({
        _id: string;
        minCredits: number;
        maxCredits: number;
        slots: SchemeSlot[];
      } & { subjects: Record<string, SubjectInfo> })
    | null;
  registration: {
    _id: string;
    entries: RegistrationEntry[];
    totalCredits: number;
    submittedAt: string;
    modifiedAt?: string;
  } | null;
  feeClearance: { cleared: boolean; overdueAmount: number };
}

const CATEGORY_LABELS: Record<string, string> = {
  DSC: 'Core (DSC)',
  DSE: 'Discipline Elective',
  GE: 'Generic Elective',
  AECC: 'Ability Enhancement',
  SEC: 'Skill Enhancement',
  VAC: 'Value Added',
};

export default function StudentRegistrationPage() {
  const queryClient = useQueryClient();
  const [termId, setTermId] = useState<string | undefined>(undefined);
  // slotId → chosen subjectIds
  const [picks, setPicks] = useState<Record<string, string[]>>({});
  const [editing, setEditing] = useState(false);
  const [confirmWithdraw, setConfirmWithdraw] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['my-registration-context', termId],
    queryFn: () => registrationApi.getMyContext(termId),
  });

  const ctx = data?.data as MyContext | undefined;
  const scheme = ctx?.scheme ?? null;
  const registration = ctx?.registration ?? null;

  const coreSlots = useMemo(() => (scheme?.slots ?? []).filter((s) => s.kind === 'core'), [scheme]);
  const basketSlots = useMemo(
    () => (scheme?.slots ?? []).filter((s) => s.kind === 'basket'),
    [scheme]
  );

  // Seed picks from an existing registration when entering edit mode.
  const beginEdit = () => {
    if (!registration) return;
    const seeded: Record<string, string[]> = {};
    for (const entry of registration.entries) {
      if (entry.kind !== 'basket') continue;
      seeded[entry.slotId] = [...(seeded[entry.slotId] ?? []), entry.subjectId];
    }
    setPicks(seeded);
    setEditing(true);
  };

  const togglePick = (slot: SchemeSlot, subjectId: string) => {
    setPicks((curr) => {
      const list = curr[slot.slotId] ?? [];
      if (list.includes(subjectId)) {
        return { ...curr, [slot.slotId]: list.filter((id) => id !== subjectId) };
      }
      if (list.length >= (slot.chooseCount ?? 1)) {
        // Single-choice baskets swap; multi-choice baskets require unpick first
        if ((slot.chooseCount ?? 1) === 1) {
          return { ...curr, [slot.slotId]: [subjectId] };
        }
        toast.error(`Pick at most ${slot.chooseCount} in this group`);
        return curr;
      }
      return { ...curr, [slot.slotId]: [...list, subjectId] };
    });
  };

  const totalCredits = useMemo(() => {
    const core = coreSlots.reduce((sum, s) => sum + (s.credits ?? 0), 0);
    const elective = basketSlots.reduce((sum, slot) => {
      const chosen = picks[slot.slotId] ?? [];
      return (
        sum +
        chosen.reduce(
          (s, id) => s + (slot.options?.find((o) => o.subjectId === id)?.credits ?? 0),
          0
        )
      );
    }, 0);
    return core + elective;
  }, [coreSlots, basketSlots, picks]);

  const allBasketsComplete = basketSlots.every(
    (slot) => (picks[slot.slotId] ?? []).length === (slot.chooseCount ?? 1)
  );

  const submitMutation = useMutation({
    mutationFn: () =>
      registrationApi.submitMyRegistration({
        academicBatchId: ctx!.batch!._id,
        termId: ctx!.term!._id,
        selections: basketSlots.map((slot) => ({
          slotId: slot.slotId,
          subjectIds: picks[slot.slotId] ?? [],
        })),
      }),
    onSuccess: () => {
      toast.success('Registration submitted!');
      setEditing(false);
      queryClient.invalidateQueries({ queryKey: ['my-registration-context'] });
    },
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { error?: { code?: string; message?: string } } } };
      toast.error(e.response?.data?.error?.message || 'Failed to submit registration');
      if (e.response?.data?.error?.code === 'SEAT_FULL') {
        // Refresh seat availability so the full option shows as such
        queryClient.invalidateQueries({ queryKey: ['my-registration-context'] });
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: () =>
      registrationApi.updateMyRegistration(ctx!.term!._id, {
        selections: basketSlots.map((slot) => ({
          slotId: slot.slotId,
          subjectIds: picks[slot.slotId] ?? [],
        })),
      }),
    onSuccess: () => {
      toast.success('Registration updated');
      setEditing(false);
      queryClient.invalidateQueries({ queryKey: ['my-registration-context'] });
    },
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { error?: { message?: string } } } };
      toast.error(e.response?.data?.error?.message || 'Failed to update registration');
      queryClient.invalidateQueries({ queryKey: ['my-registration-context'] });
    },
  });

  const withdrawMutation = useMutation({
    mutationFn: () => registrationApi.withdrawMyRegistration(ctx!.term!._id),
    onSuccess: () => {
      toast.success('Registration withdrawn');
      setConfirmWithdraw(false);
      queryClient.invalidateQueries({ queryKey: ['my-registration-context'] });
    },
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { error?: { message?: string } } } };
      toast.error(e.response?.data?.error?.message || 'Failed to withdraw');
    },
  });

  // ─── Loading / error states ─────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (error || !ctx) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
          <AlertCircle className="h-8 w-8 text-destructive" />
          <p className="text-sm text-muted-foreground">
            Could not load your registration context. If this persists, contact your administrator.
          </p>
        </CardContent>
      </Card>
    );
  }

  const term = ctx.term;
  const windowOpen = term?.windowState === 'open';
  const showForm = windowOpen && !registration && scheme && ctx.feeClearance.cleared;
  const showEditForm = editing && registration && scheme && term?.addDropOpen;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <BookOpenCheck className="h-6 w-6 text-primary" />
            Course Registration
          </h1>
          <p className="text-sm text-muted-foreground">
            {ctx.student.className}
            {ctx.semesterNumber ? ` · Semester ${ctx.semesterNumber}` : ''}
            {ctx.batch ? ` · ${ctx.batch.name}` : ''}
          </p>
        </div>
        {ctx.terms.length > 1 && (
          <Select value={term?._id} onValueChange={(v) => setTermId(v)}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Select term" />
            </SelectTrigger>
            <SelectContent>
              {ctx.terms.map((t) => (
                <SelectItem key={t._id} value={t._id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* No term / not configured */}
      {!term && (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
            <Clock className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No terms are configured for the current academic session yet.
            </p>
          </CardContent>
        </Card>
      )}

      {term && ctx.semesterError && (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
            <AlertCircle className="h-8 w-8 text-amber-500" />
            <p className="text-sm text-muted-foreground">{ctx.semesterError}</p>
          </CardContent>
        </Card>
      )}

      {/* Window state banner */}
      {term && !ctx.semesterError && (
        <div
          className={cn(
            'flex flex-wrap items-center gap-2 rounded-lg border p-3 text-sm',
            windowOpen
              ? 'border-emerald-500/30 bg-emerald-500/5'
              : 'border-amber-500/30 bg-amber-500/5'
          )}
        >
          {windowOpen ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          ) : (
            <Clock className="h-4 w-4 text-amber-600" />
          )}
          <span className="font-medium">{term.name}:</span>
          {term.windowState === 'open' && term.registrationWindow && (
            <span>
              Registration open until {new Date(term.registrationWindow.closesAt).toLocaleString()}
            </span>
          )}
          {term.windowState === 'upcoming' && term.registrationWindow && (
            <span>
              Registration opens {new Date(term.registrationWindow.opensAt).toLocaleString()}
            </span>
          )}
          {term.windowState === 'closed' && <span>The registration window has closed</span>}
          {term.windowState === 'not_configured' && (
            <span>Registration dates have not been announced yet</span>
          )}
          {term.addDropDeadline && (
            <Badge variant="outline" className="ml-auto">
              Add/drop until {new Date(term.addDropDeadline).toLocaleDateString()}
            </Badge>
          )}
        </div>
      )}

      {/* Fee block */}
      {term && windowOpen && !registration && !ctx.feeClearance.cleared && (
        <Card className="border-destructive/40">
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <IndianRupee className="h-8 w-8 text-destructive" />
            <div>
              <p className="font-semibold">Registration blocked — overdue fees</p>
              <p className="mt-1 text-sm text-muted-foreground">
                You have ₹{ctx.feeClearance.overdueAmount.toLocaleString('en-IN')} in overdue dues.
                Clear them to register for this semester.
              </p>
            </div>
            <Button asChild>
              <Link href="/student/fees">View my fees</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* No published scheme */}
      {term &&
        windowOpen &&
        !registration &&
        ctx.feeClearance.cleared &&
        !scheme &&
        !ctx.semesterError && (
          <Card>
            <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
              <AlertCircle className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                The curriculum for {ctx.student.departmentName} Semester {ctx.semesterNumber} has
                not been published yet. Check back soon.
              </p>
            </CardContent>
          </Card>
        )}

      {/* Existing registration (read view) */}
      {registration && !showEditForm && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              Registered — {registration.totalCredits} credits
            </CardTitle>
            <div className="flex gap-2">
              {term?.addDropOpen && basketSlots.length > 0 && (
                <Button variant="outline" size="sm" onClick={beginEdit}>
                  <Pencil className="mr-1.5 h-3.5 w-3.5" /> Change electives
                </Button>
              )}
              {term?.addDropOpen && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive"
                  onClick={() => setConfirmWithdraw(true)}
                >
                  <X className="mr-1.5 h-3.5 w-3.5" /> Withdraw
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <p className="mb-3 text-xs text-muted-foreground">
              Submitted {new Date(registration.submittedAt).toLocaleString()}
              {registration.modifiedAt &&
                ` · modified ${new Date(registration.modifiedAt).toLocaleString()}`}
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="p-2">Code</th>
                    <th className="p-2">Course</th>
                    <th className="p-2">Category</th>
                    <th className="p-2 text-right">Credits</th>
                  </tr>
                </thead>
                <tbody>
                  {registration.entries.map((entry) => (
                    <tr
                      key={`${entry.slotId}-${entry.subjectId}`}
                      className="border-b last:border-0"
                    >
                      <td className="p-2 font-mono text-xs">{entry.subject?.code ?? '—'}</td>
                      <td className="p-2 font-medium">{entry.subject?.name ?? 'Unknown'}</td>
                      <td className="p-2">
                        <Badge variant={entry.kind === 'core' ? 'secondary' : 'outline'}>
                          {entry.category
                            ? (CATEGORY_LABELS[entry.category] ?? entry.category)
                            : entry.kind === 'core'
                              ? 'Core'
                              : 'Elective'}
                        </Badge>
                      </td>
                      <td className="p-2 text-right font-medium">{entry.credits}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Registration form (fresh submit or add/drop edit) */}
      {(showForm || showEditForm) && scheme && (
        <div className="space-y-4">
          {/* Cores */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Lock className="h-4 w-4 text-muted-foreground" />
                Core courses
                <span className="text-xs font-normal text-muted-foreground">
                  (automatically registered)
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 sm:grid-cols-2">
              {coreSlots.map((slot) => {
                const subject = slot.subjectId ? scheme.subjects[slot.subjectId] : undefined;
                return (
                  <div
                    key={slot.slotId}
                    className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2"
                  >
                    <div>
                      <p className="text-sm font-medium">{subject?.name ?? 'Course'}</p>
                      <p className="text-xs text-muted-foreground">
                        {subject?.code}
                        {slot.category
                          ? ` · ${CATEGORY_LABELS[slot.category] ?? slot.category}`
                          : ''}
                      </p>
                    </div>
                    <Badge variant="secondary">{slot.credits} cr</Badge>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Baskets */}
          {basketSlots.map((slot) => {
            const chosen = picks[slot.slotId] ?? [];
            return (
              <Card key={slot.slotId}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                  <CardTitle className="text-base">
                    {slot.label}
                    {slot.category && (
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        {CATEGORY_LABELS[slot.category] ?? slot.category}
                      </span>
                    )}
                  </CardTitle>
                  <Badge variant={chosen.length === slot.chooseCount ? 'default' : 'outline'}>
                    {chosen.length}/{slot.chooseCount} chosen
                  </Badge>
                </CardHeader>
                <CardContent className="grid gap-2 sm:grid-cols-2">
                  {(slot.options ?? []).map((option) => {
                    const subject = scheme.subjects[option.subjectId];
                    const isChosen = chosen.includes(option.subjectId);
                    const seatsLeft =
                      option.seatCap !== undefined
                        ? Math.max(0, option.seatCap - option.seatsTaken)
                        : null;
                    // In edit mode a seat you already hold stays selectable.
                    const alreadyMine = registration?.entries.some(
                      (e) => e.slotId === slot.slotId && e.subjectId === option.subjectId
                    );
                    const full = seatsLeft === 0 && !alreadyMine;
                    return (
                      <button
                        key={option.subjectId}
                        type="button"
                        disabled={full && !isChosen}
                        onClick={() => togglePick(slot, option.subjectId)}
                        className={cn(
                          'flex items-center justify-between rounded-lg border px-3 py-2 text-left transition-all',
                          isChosen
                            ? 'border-primary bg-primary/5 shadow-sm'
                            : full
                              ? 'cursor-not-allowed border-input opacity-50'
                              : 'border-input hover:border-primary/40 hover:bg-primary/5'
                        )}
                      >
                        <div>
                          <p className="text-sm font-medium">{subject?.name ?? 'Course'}</p>
                          <p className="text-xs text-muted-foreground">{subject?.code}</p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <Badge variant={isChosen ? 'default' : 'secondary'}>
                            {option.credits} cr
                          </Badge>
                          {seatsLeft !== null && (
                            <span
                              className={cn(
                                'text-[11px]',
                                full
                                  ? 'font-medium text-destructive'
                                  : seatsLeft <= 5
                                    ? 'font-medium text-amber-600'
                                    : 'text-muted-foreground'
                              )}
                            >
                              {full ? 'Full' : `${seatsLeft} seats left`}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </CardContent>
              </Card>
            );
          })}

          {/* Sticky credit counter + submit */}
          <div className="sticky bottom-4 z-10 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4 shadow-lg">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Total credits</p>
              <p
                className={cn(
                  'text-2xl font-bold',
                  totalCredits >= scheme.minCredits && totalCredits <= scheme.maxCredits
                    ? 'text-emerald-600'
                    : 'text-amber-600'
                )}
              >
                {totalCredits}
                <span className="ml-1 text-sm font-normal text-muted-foreground">
                  / {scheme.minCredits}–{scheme.maxCredits}
                </span>
              </p>
            </div>
            <div className="flex gap-2">
              {showEditForm && (
                <Button variant="outline" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
              )}
              <Button
                size="lg"
                disabled={
                  !allBasketsComplete ||
                  totalCredits < scheme.minCredits ||
                  totalCredits > scheme.maxCredits ||
                  submitMutation.isPending ||
                  updateMutation.isPending
                }
                onClick={() => (showEditForm ? updateMutation.mutate() : submitMutation.mutate())}
              >
                {showEditForm
                  ? updateMutation.isPending
                    ? 'Saving…'
                    : 'Save changes'
                  : submitMutation.isPending
                    ? 'Submitting…'
                    : 'Submit registration'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Withdraw confirmation */}
      <AlertDialog open={confirmWithdraw} onOpenChange={setConfirmWithdraw}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Withdraw registration?</AlertDialogTitle>
            <AlertDialogDescription>
              Your course selections for {term?.name} will be released, including your elective
              seats. You can register again while the window is open.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep registration</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => withdrawMutation.mutate()}
            >
              {withdrawMutation.isPending ? 'Withdrawing…' : 'Withdraw'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
