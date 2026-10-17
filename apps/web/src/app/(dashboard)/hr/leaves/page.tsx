'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CalendarOff, CheckCircle2, Clock, Inbox, Plus, XCircle, ArrowUpRight } from 'lucide-react';
import { toast } from 'sonner';
import { PageHero } from '@/components/ui/page-hero';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
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
import { hrApi } from '@/lib/api';
import { getErrorMessage } from '@/lib/utils';
import { usePermissions } from '@/hooks/usePermissions';

interface Balance {
  code: string;
  leaveType: string;
  color?: string;
  unlimited: boolean;
  total: number;
  used: number;
  pending: number;
  available: number;
}

interface Leave {
  _id: string;
  leaveType: string;
  leaveTypeName?: string;
  fromDate: string;
  toDate: string;
  days: number;
  isHalfDay: boolean;
  reason: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  approverRemarks?: string;
  appliedAt: string;
}

const STATUS = {
  pending: { label: 'Pending', icon: Clock, cls: 'bg-warning/10 text-warning border-warning/20' },
  approved: {
    label: 'Approved',
    icon: CheckCircle2,
    cls: 'bg-success/10 text-success border-success/20',
  },
  rejected: {
    label: 'Rejected',
    icon: XCircle,
    cls: 'bg-destructive/10 text-destructive border-destructive/20',
  },
  cancelled: { label: 'Cancelled', icon: XCircle, cls: 'bg-muted text-muted-foreground' },
} as const;

const fmt = (d: string) =>
  new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const todayKey = () => new Date().toISOString().slice(0, 10);

/**
 * Everyone's own leave: what's left of each type, applying, and the history
 * of their requests. Approvers reach the team queue from here.
 */
export default function MyLeavePageRoute() {
  // useSearchParams needs a Suspense boundary for the production build.
  return (
    <Suspense>
      <MyLeavePage />
    </Suspense>
  );
}

function MyLeavePage() {
  const { hasPermission } = usePermissions();
  const canApply = hasPermission('hr.leaves', 'create');
  const canApprove = ['approve', 'edit'].some((a) => hasPermission('hr.leaves', a));
  const queryClient = useQueryClient();
  const params = useSearchParams();
  const router = useRouter();
  const [applyOpen, setApplyOpen] = useState(false);
  const [cancelling, setCancelling] = useState<Leave | null>(null);

  // Dashboard "Apply leave" buttons link here with ?apply=1.
  useEffect(() => {
    if (params.get('apply') && canApply) {
      setApplyOpen(true);
      router.replace('/hr/leaves');
    }
  }, [params, canApply, router]);

  const balanceQ = useQuery({
    queryKey: ['my-leave-balance'],
    queryFn: () => hrApi.getLeaveBalance(),
  });
  const leavesQ = useQuery({
    queryKey: ['my-leaves'],
    queryFn: () => hrApi.getMyLeaves({ limit: 50 }),
  });
  const balances = (balanceQ.data?.data?.balances ?? []) as Balance[];
  const leaves = (leavesQ.data?.data ?? []) as Leave[];
  const noStaffProfile =
    (balanceQ.error as { response?: { data?: { error?: { code?: string } } } } | null)?.response
      ?.data?.error?.code === 'STAFF_NOT_FOUND';
  const typeName = (code: string) => balances.find((b) => b.code === code)?.leaveType ?? code;

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['my-leave-balance'] });
    queryClient.invalidateQueries({ queryKey: ['my-leaves'] });
  };

  const cancelMutation = useMutation({
    mutationFn: (leave: Leave) => hrApi.cancelLeave(leave._id, 'Cancelled by applicant'),
    onSuccess: () => {
      toast.success('Leave cancelled');
      setCancelling(null);
      refresh();
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  if (noStaffProfile) {
    return (
      <div className="space-y-8">
        <PageHero icon={CalendarOff} eyebrow="HR" title="My leave" />
        <div className="rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          Your account isn&apos;t linked to a staff profile, so there&apos;s no leave to show.
          {canApprove && (
            <>
              {' '}
              <Link href="/hr/approvals" className="font-medium text-primary hover:underline">
                Go to leave approvals
              </Link>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      <PageHero
        icon={CalendarOff}
        eyebrow="HR"
        title="My leave"
        description="What you have left, your requests, and their status."
        actions={
          <>
            {canApprove && (
              <Button variant="outline" asChild className="gap-2">
                <Link href="/hr/approvals">
                  Team requests <ArrowUpRight className="h-4 w-4" />
                </Link>
              </Button>
            )}
            {canApply && (
              <Button className="gap-2" onClick={() => setApplyOpen(true)}>
                <Plus className="h-4 w-4" /> Apply for leave
              </Button>
            )}
          </>
        }
      />

      {/* Balances */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {balanceQ.isLoading
          ? [1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-32 rounded-2xl" />)
          : balances.map((b, i) => (
              <div
                key={b.code}
                className="cv-rise rounded-2xl border border-border bg-card p-5 shadow-soft"
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    {b.leaveType}
                  </p>
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: b.color || 'hsl(var(--primary))' }}
                  />
                </div>
                {b.unlimited ? (
                  <>
                    <p className="mt-3 font-display text-3xl font-bold">—</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      No limit · {b.used} taken{b.pending ? ` · ${b.pending} pending` : ''}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="mt-3 font-display text-3xl font-bold tabular-nums">
                      {b.available}
                      <span className="ml-1 text-sm font-normal text-muted-foreground">
                        of {b.total} left
                      </span>
                    </p>
                    <div className="mt-3 flex h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className="bg-primary"
                        style={{ width: `${(b.used / Math.max(b.total, 1)) * 100}%` }}
                      />
                      <div
                        className="bg-warning"
                        style={{ width: `${(b.pending / Math.max(b.total, 1)) * 100}%` }}
                      />
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {b.used} taken{b.pending ? ` · ${b.pending} pending` : ''}
                    </p>
                  </>
                )}
              </div>
            ))}
      </section>

      {/* Requests */}
      <section className="rounded-2xl border border-border bg-card shadow-soft">
        <header className="border-b border-border px-6 py-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            My requests
          </p>
        </header>
        {leavesQ.isLoading ? (
          <div className="space-y-3 p-6">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        ) : leaves.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12 text-sm text-muted-foreground">
            <Inbox className="h-6 w-6 text-muted-foreground/40" />
            You haven&apos;t applied for any leave yet.
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {leaves.map((l) => {
              const s = STATUS[l.status];
              const cancellable =
                l.status === 'pending' ||
                (l.status === 'approved' && l.fromDate.slice(0, 10) > todayKey());
              return (
                <li key={l._id} className="flex flex-wrap items-center gap-4 px-6 py-4">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">
                      {l.leaveTypeName ?? typeName(l.leaveType)}
                      <span className="ml-2 text-sm font-normal text-muted-foreground">
                        {l.fromDate.slice(0, 10) === l.toDate.slice(0, 10)
                          ? fmt(l.fromDate)
                          : `${fmt(l.fromDate)} – ${fmt(l.toDate)}`}{' '}
                        · {l.isHalfDay ? 'half day' : `${l.days} day${l.days === 1 ? '' : 's'}`}
                      </span>
                    </p>
                    <p className="truncate text-sm text-muted-foreground">{l.reason}</p>
                    {l.approverRemarks && l.status !== 'pending' && (
                      <p className="text-xs text-muted-foreground">
                        Approver: &ldquo;{l.approverRemarks}&rdquo;
                      </p>
                    )}
                  </div>
                  <Badge variant="outline" className={`gap-1 ${s.cls}`}>
                    <s.icon className="h-3 w-3" /> {s.label}
                  </Badge>
                  {cancellable && (
                    <Button variant="ghost" size="sm" onClick={() => setCancelling(l)}>
                      Cancel
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <ApplyDialog
        open={applyOpen}
        onOpenChange={setApplyOpen}
        balances={balances}
        onApplied={refresh}
      />

      <Dialog open={!!cancelling} onOpenChange={(o) => !o && setCancelling(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel this leave?</DialogTitle>
            <DialogDescription>
              {cancelling &&
                `${cancelling.leaveTypeName ?? typeName(cancelling.leaveType)}, ${fmt(cancelling.fromDate)}${cancelling.fromDate !== cancelling.toDate ? ` – ${fmt(cancelling.toDate)}` : ''}. The days go back to your balance.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelling(null)}>
              Keep it
            </Button>
            <Button
              variant="destructive"
              disabled={cancelMutation.isPending}
              onClick={() => cancelling && cancelMutation.mutate(cancelling)}
            >
              Cancel leave
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ApplyDialog({
  open,
  onOpenChange,
  balances,
  onApplied,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  balances: Balance[];
  onApplied: () => void;
}) {
  const [form, setForm] = useState({
    leaveType: '',
    fromDate: '',
    toDate: '',
    isHalfDay: false,
    halfDayType: 'first-half' as 'first-half' | 'second-half',
    reason: '',
  });
  useEffect(() => {
    if (open) {
      setForm({
        leaveType: balances[0]?.code ?? '',
        fromDate: todayKey(),
        toDate: todayKey(),
        isHalfDay: false,
        halfDayType: 'first-half',
        reason: '',
      });
    }
  }, [open, balances]);

  const selected = balances.find((b) => b.code === form.leaveType);
  const calendarDays = useMemo(() => {
    if (!form.fromDate || !form.toDate || form.toDate < form.fromDate) return 0;
    return (new Date(form.toDate).getTime() - new Date(form.fromDate).getTime()) / 86_400_000 + 1;
  }, [form.fromDate, form.toDate]);

  const mutation = useMutation({
    mutationFn: () =>
      hrApi.applyLeave({
        leaveType: form.leaveType,
        fromDate: form.fromDate,
        toDate: form.isHalfDay ? form.fromDate : form.toDate,
        isHalfDay: form.isHalfDay,
        halfDayType: form.isHalfDay ? form.halfDayType : undefined,
        reason: form.reason,
      }),
    onSuccess: (res) => {
      const days = res?.data?.days;
      toast.success(`Leave requested${days ? ` · ${days} day${days === 1 ? '' : 's'}` : ''}`);
      onOpenChange(false);
      onApplied();
    },
    // The server explains exactly what's wrong (balance, overlap, notice…).
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const invalid =
    !form.leaveType ||
    !form.fromDate ||
    (!form.isHalfDay && (!form.toDate || form.toDate < form.fromDate)) ||
    !form.reason.trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Apply for leave</DialogTitle>
          <DialogDescription>
            Weekly offs and holidays inside your dates aren&apos;t counted.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Leave type</Label>
            <Select
              value={form.leaveType}
              onValueChange={(v) => setForm({ ...form, leaveType: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choose a type" />
              </SelectTrigger>
              <SelectContent>
                {balances.map((b) => (
                  <SelectItem key={b.code} value={b.code}>
                    {b.leaveType}
                    <span className="ml-2 text-muted-foreground">
                      {b.unlimited ? 'no limit' : `${b.available} left`}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between rounded-lg border px-3 py-2">
            <Label htmlFor="half-day" className="cursor-pointer">
              Half day
            </Label>
            <Switch
              id="half-day"
              checked={form.isHalfDay}
              onCheckedChange={(v) => setForm({ ...form, isHalfDay: v })}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="from">{form.isHalfDay ? 'Date' : 'From'}</Label>
              <Input
                id="from"
                type="date"
                value={form.fromDate}
                onChange={(e) =>
                  setForm({
                    ...form,
                    fromDate: e.target.value,
                    toDate: form.toDate < e.target.value ? e.target.value : form.toDate,
                  })
                }
              />
            </div>
            {form.isHalfDay ? (
              <div className="space-y-2">
                <Label>Which half</Label>
                <Select
                  value={form.halfDayType}
                  onValueChange={(v) =>
                    setForm({ ...form, halfDayType: v as 'first-half' | 'second-half' })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="first-half">First half</SelectItem>
                    <SelectItem value="second-half">Second half</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="to">To</Label>
                <Input
                  id="to"
                  type="date"
                  min={form.fromDate}
                  value={form.toDate}
                  onChange={(e) => setForm({ ...form, toDate: e.target.value })}
                />
              </div>
            )}
          </div>

          {!form.isHalfDay && calendarDays > 0 && selected && !selected.unlimited && (
            <p className="text-xs text-muted-foreground">
              {calendarDays} calendar day{calendarDays === 1 ? '' : 's'} selected ·{' '}
              {selected.available} {selected.leaveType.toLowerCase()} day
              {selected.available === 1 ? '' : 's'} left
            </p>
          )}

          <div className="space-y-2">
            <Label htmlFor="reason">Reason</Label>
            <Textarea
              id="reason"
              rows={3}
              placeholder="A short note for your approver"
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={invalid || mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending ? 'Sending…' : 'Send request'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
