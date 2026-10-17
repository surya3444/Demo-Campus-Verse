'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
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
import { Loader2, Zap, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { hrApi } from '@/lib/api';

interface PayRunButtonProps {
  runId: string;
  onPaid?: () => void;
}

function paiseToRupees(paise: number | null | undefined): string {
  if (paise === null || paise === undefined) return '—';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(paise / 100);
}

export function PayRunButton({ runId, onPaid }: PayRunButtonProps) {
  const [xConnected, setXConnected] = useState<boolean | null>(null);
  const [summary, setSummary] = useState<{
    pendingCount: number;
    pendingTotalPaise: number;
  } | null>(null);
  const [open, setOpen] = useState(false);
  const [balancePaise, setBalancePaise] = useState<number | null>(null);
  const [loadingBalance, setLoadingBalance] = useState(false);
  const [mode, setMode] = useState<'IMPS' | 'NEFT' | 'RTGS' | 'UPI'>('IMPS');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<null | {
    initiated: number;
    skipped: Array<{ staffName: string; reason: string }>;
    failed: Array<{ staffName: string; reason: string }>;
  }>(null);

  const refreshSummary = () => {
    hrApi
      .getPayrollRunPaySummary(runId)
      .then((res) =>
        setSummary({
          pendingCount: res?.data?.pendingCount ?? 0,
          pendingTotalPaise: res?.data?.pendingTotalPaise ?? 0,
        })
      )
      .catch(() => setSummary({ pendingCount: 0, pendingTotalPaise: 0 }));
  };

  // Cheap one-shot check to know if the branch has RazorpayX configured, and
  // pull the accurate server-side pending totals (not the capped list preview).
  useEffect(() => {
    let cancelled = false;
    hrApi
      .getRazorpayXSettings()
      .then((res) => {
        if (cancelled) return;
        setXConnected(res?.data?.status === 'connected');
      })
      .catch(() => {
        if (!cancelled) setXConnected(false);
      });
    refreshSummary();
    return () => {
      cancelled = true;
    };
  }, [runId]);

  // Load balance when the modal opens so the admin sees the health before firing.
  useEffect(() => {
    if (!open) return;
    setResult(null);
    setLoadingBalance(true);
    hrApi
      .getRazorpayXBalance()
      .then((res) => setBalancePaise(res?.data?.balancePaise ?? null))
      .catch(() => setBalancePaise(null))
      .finally(() => setLoadingBalance(false));
  }, [open]);

  if (!xConnected) return null;
  if (summary === null) return null; // loading
  if (summary.pendingCount === 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-700 dark:text-emerald-300">
        <CheckCircle2 className="h-3.5 w-3.5" /> All salaries paid
      </span>
    );
  }

  const insufficientBalance =
    balancePaise !== null && balancePaise !== undefined && balancePaise < summary.pendingTotalPaise;

  const submit = async () => {
    setSubmitting(true);
    try {
      const res = await hrApi.payPayrollRun(runId, { mode });
      if (res.success) {
        setResult({
          initiated: res.data.initiated,
          skipped: res.data.skipped ?? [],
          failed: res.data.failed ?? [],
        });
        toast.success(`Initiated ${res.data.initiated} of ${res.data.totalPayslips} payouts.`);
        refreshSummary();
        onPaid?.();
      } else {
        toast.error(res?.error?.message || 'Payouts failed');
      }
    } catch (err) {
      const e = err as { response?: { data?: { error?: { message?: string } } } };
      toast.error(e?.response?.data?.error?.message || 'Payouts failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)} className="bg-primary">
        <Zap className="h-4 w-4 mr-1" /> Pay Salaries
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Pay salaries via RazorpayX</DialogTitle>
            <DialogDescription>
              Money moves from your RazorpayX source virtual account to each staff&apos;s bank. This
              is irreversible once the payouts are processed by the bank.
            </DialogDescription>
          </DialogHeader>

          {!result && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 rounded-lg border p-3">
                <div>
                  <p className="text-xs text-muted-foreground">Payslips pending</p>
                  <p className="text-lg font-semibold">{summary.pendingCount}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total to pay</p>
                  <p className="text-lg font-semibold">
                    {paiseToRupees(summary.pendingTotalPaise)}
                  </p>
                </div>
                <div className="col-span-2 border-t pt-2">
                  <p className="text-xs text-muted-foreground">Source VA balance</p>
                  <p
                    className={`text-lg font-semibold ${insufficientBalance ? 'text-destructive' : ''}`}
                  >
                    {loadingBalance ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      paiseToRupees(balancePaise)
                    )}
                  </p>
                  {insufficientBalance && (
                    <p className="mt-1 flex items-center gap-1 text-xs text-destructive">
                      <AlertTriangle className="h-3 w-3" /> Balance is short — payouts will be
                      queued until you fund the VA.
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs uppercase tracking-wide text-muted-foreground">
                  Payout mode
                </label>
                <Select value={mode} onValueChange={(v) => setMode(v as typeof mode)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="IMPS">IMPS — instant, ≤ ₹5L per payout</SelectItem>
                    <SelectItem value="NEFT">NEFT — batched, no upper cap, cheapest</SelectItem>
                    <SelectItem value="RTGS">RTGS — near instant, ≥ ₹2L</SelectItem>
                    <SelectItem value="UPI">
                      UPI — instant, requires VPA on the fund account
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {result && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 p-3 text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 className="h-4 w-4" />
                <span className="text-sm font-medium">{result.initiated} payouts initiated</span>
              </div>
              {result.skipped.length > 0 && (
                <div className="rounded-lg border border-amber-300/60 bg-amber-50 p-3 text-xs dark:border-amber-700/40 dark:bg-amber-950/30">
                  <p className="font-medium text-amber-900 dark:text-amber-200">
                    Skipped: {result.skipped.length}
                  </p>
                  <ul className="mt-1 list-disc pl-5 text-amber-800/90 dark:text-amber-300/90">
                    {result.skipped.slice(0, 5).map((s, i) => (
                      <li key={i}>
                        <span className="font-medium">{s.staffName}:</span> {s.reason}
                      </li>
                    ))}
                    {result.skipped.length > 5 && <li>…and {result.skipped.length - 5} more</li>}
                  </ul>
                </div>
              )}
              {result.failed.length > 0 && (
                <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-xs">
                  <p className="flex items-center gap-1 font-medium text-destructive">
                    <XCircle className="h-3 w-3" /> Failed: {result.failed.length}
                  </p>
                  <ul className="mt-1 list-disc pl-5 text-destructive/90">
                    {result.failed.slice(0, 5).map((f, i) => (
                      <li key={i}>
                        <span className="font-medium">{f.staffName}:</span> {f.reason}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            {!result && (
              <>
                <Button variant="ghost" onClick={() => setOpen(false)} disabled={submitting}>
                  Cancel
                </Button>
                <Button onClick={submit} disabled={submitting}>
                  {submitting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Zap className="mr-2 h-4 w-4" />
                  )}
                  Confirm & pay {summary.pendingCount} salaries
                </Button>
              </>
            )}
            {result && <Button onClick={() => setOpen(false)}>Close</Button>}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
