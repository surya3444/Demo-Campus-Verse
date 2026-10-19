'use client';

import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, BadgeCheck, Building2, Check, Download, Landmark, Loader2, ShieldCheck, X } from 'lucide-react';
import { payrollApi, type SandboxPayout } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { Avatar } from '@/components/connect/kit';

type Step = 'review' | 'authorize' | 'processing' | 'done';
const SANDBOX_OTP = '246810';
const inr = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
type ApiErr = Error & { response?: { data?: { error?: { message?: string } } } };

/**
 * CampusPay — a simulated salary payout. Looks and flows like a bank's bulk
 * payout (review → authorise with OTP → credits stream in → summary with
 * UTRs), but moves no money: the API records each payslip as credited.
 */
export function CampusPayDialog({
  open,
  onOpenChange,
  run,
  monthLabel,
  pendingCount,
  onDone,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  run: { _id: string; totalNet: number; staffCount: number };
  monthLabel: string;
  pendingCount: number;
  onDone: () => void;
}) {
  const [step, setStep] = useState<Step>('review');
  const [otp, setOtp] = useState('');
  const [result, setResult] = useState<SandboxPayout | null>(null);
  const [shown, setShown] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!open) {
      setStep('review');
      setOtp('');
      setResult(null);
      setShown(0);
      if (timer.current) clearInterval(timer.current);
    }
  }, [open]);

  const start = async () => {
    setStep('processing');
    try {
      const r = (await payrollApi.simulatePayout(run._id)).data;
      setResult(r);
      // Reveal credits one by one, like a payout console, in about four seconds
      const per = Math.max(1, Math.ceil(r.items.length / 80));
      timer.current = setInterval(() => {
        setShown((n) => {
          const next = Math.min(r.items.length, n + per);
          if (next >= r.items.length && timer.current) {
            clearInterval(timer.current);
            setTimeout(() => setStep('done'), 500);
          }
          return next;
        });
      }, 50);
      onDone();
    } catch (e) {
      toast.error((e as ApiErr).response?.data?.error?.message || 'Payout failed');
      setStep('review');
    }
  };

  const paidSoFar = result?.items.slice(0, shown).filter((x) => x.status === 'paid') ?? [];
  const amountSoFar = paidSoFar.reduce((n, x) => n + x.amount, 0);

  const exportCsv = () => {
    if (!result) return;
    const rows = [['Employee ID', 'Name', 'Bank', 'Account', 'Amount', 'Status', 'UTR', 'Reason']].concat(
      result.items.map((x) => [x.employeeId ?? '', x.name, x.bank ?? '', x.account ?? '', String(x.amount), x.status, x.utr ?? '', x.reason ?? ''])
    );
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n')], { type: 'text/csv' }));
    a.download = `${result.reference}.csv`;
    a.click();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => step !== 'processing' && onOpenChange(o)}>
      <DialogContent className="max-w-xl overflow-hidden p-0">
        {/* Gateway header */}
        <div className="relative overflow-hidden bg-[#0b1d4a] px-6 py-5 text-white">
          <span className="pointer-events-none absolute -right-10 -top-16 h-48 w-48 rounded-full bg-sky-400/20 blur-3xl" />
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10">
                <Landmark className="h-5 w-5" />
              </span>
              <div>
                <DialogTitle className="text-base font-semibold text-white">CampusPay</DialogTitle>
                <p className="text-[11px] text-sky-200/80">Bulk salary payout</p>
              </div>
            </div>
            <span className="rounded-full bg-amber-400/90 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#0b1d4a]">Sandbox</span>
          </div>
          <div className="relative mt-5 flex items-center gap-1.5 text-[11px]">
            {(['review', 'authorize', 'processing', 'done'] as Step[]).map((s, i, all) => {
              const idx = all.indexOf(step);
              return (
                <span key={s} className="flex items-center gap-1.5">
                  <span className={cn('rounded-full px-2 py-0.5 capitalize', i < idx ? 'bg-emerald-400/20 text-emerald-200' : i === idx ? 'bg-white text-[#0b1d4a]' : 'text-white/50')}>
                    {s === 'processing' ? 'Crediting' : s === 'done' ? 'Done' : s}
                  </span>
                  {i < all.length - 1 && <span className="text-white/30">›</span>}
                </span>
              );
            })}
          </div>
        </div>

        <div className="p-6">
          {step === 'review' && (
            <div className="space-y-5">
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Salaries for {monthLabel}</p>
                <p className="mt-1 font-display text-4xl font-bold tabular-nums">{inr(run.totalNet)}</p>
                <p className="mt-1 text-sm text-muted-foreground">to {pendingCount} staff bank accounts</p>
              </div>
              <div className="space-y-3 rounded-xl border p-4 text-sm">
                <Row icon={Building2} label="Debit from" value="Campus salary account •••• 4417" />
                <Row icon={Landmark} label="Transfer" value="NEFT/IMPS to each staff account on file" />
                <Row icon={ShieldCheck} label="Mode" value="Sandbox — no real money moves" />
              </div>
              <p className="text-xs text-muted-foreground">
                Staff without a bank account on file can’t be paid; they’ll be listed so you can add the account and pay them later.
              </p>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button onClick={() => setStep('authorize')}>Continue</Button>
              </div>
            </div>
          )}

          {step === 'authorize' && (
            <div className="space-y-5 text-center">
              <ShieldCheck className="mx-auto h-10 w-10 text-primary" />
              <div>
                <p className="font-semibold">Authorise the payout</p>
                <p className="mt-1 text-sm text-muted-foreground">Enter the 6-digit code sent to the authorised signatory.</p>
              </div>
              <input
                autoFocus
                inputMode="numeric"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                onKeyDown={(e) => e.key === 'Enter' && otp === SANDBOX_OTP && start()}
                className="mx-auto block w-48 rounded-xl border bg-muted/30 py-3 text-center font-mono text-2xl tracking-[0.5em] focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="••••••"
              />
              <p className="text-xs text-muted-foreground">
                Sandbox code: <span className="font-mono font-semibold text-foreground">{SANDBOX_OTP}</span>
              </p>
              {otp.length === 6 && otp !== SANDBOX_OTP && <p className="text-sm text-rose-600">That code doesn’t match.</p>}
              <div className="flex justify-center gap-2">
                <Button variant="outline" onClick={() => setStep('review')}>
                  Back
                </Button>
                <Button onClick={start} disabled={otp !== SANDBOX_OTP}>
                  Pay {inr(run.totalNet)}
                </Button>
              </div>
            </div>
          )}

          {step === 'processing' && (
            <div className="space-y-4">
              <div className="flex items-baseline justify-between">
                <p className="flex items-center gap-2 font-semibold">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  Crediting accounts…
                </p>
                <p className="text-sm tabular-nums text-muted-foreground">
                  {shown} / {result?.items.length ?? pendingCount}
                </p>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-success transition-[width] duration-150" style={{ width: `${result ? (shown / result.items.length) * 100 : 3}%` }} />
              </div>
              <p className="text-2xl font-bold tabular-nums text-success">{inr(Math.round(amountSoFar))}</p>
              <ul className="h-64 space-y-1 overflow-hidden [mask-image:linear-gradient(to_bottom,#000_70%,transparent)]">
                {(result?.items.slice(Math.max(0, shown - 7), shown) ?? []).reverse().map((x) => (
                  <Item key={x.payslipId} x={x} />
                ))}
              </ul>
            </div>
          )}

          {step === 'done' && result && (
            <div className="space-y-5">
              <div className="text-center">
                <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success/15 text-success">
                  <BadgeCheck className="h-8 w-8" />
                </span>
                <p className="mt-3 text-lg font-semibold">
                  {inr(result.paidAmount)} credited to {result.paidCount} staff
                </p>
                <p className="text-sm text-muted-foreground">
                  Batch <span className="font-mono">{result.reference}</span>
                </p>
              </div>
              {result.failedCount > 0 && (
                <div className="rounded-xl border border-amber-300/60 bg-amber-50 p-4 dark:bg-amber-500/10">
                  <p className="flex items-center gap-2 text-sm font-semibold text-amber-800 dark:text-amber-200">
                    <AlertTriangle className="h-4 w-4" />
                    {result.failedCount} not paid · {inr(result.failedAmount)}
                  </p>
                  <ul className="mt-2 space-y-1.5">
                    {result.items
                      .filter((x) => x.status === 'failed')
                      .map((x) => (
                        <li key={x.payslipId} className="flex items-center justify-between gap-2 text-sm">
                          <span>
                            {x.name} <span className="text-muted-foreground">· {x.employeeId}</span>
                          </span>
                          <span className="text-xs text-amber-800 dark:text-amber-200">{x.reason}</span>
                        </li>
                      ))}
                  </ul>
                  <p className="mt-2 text-xs text-muted-foreground">Add their bank account in Staff, then pay again — only the unpaid will be sent.</p>
                </div>
              )}
              <div className="flex justify-between gap-2">
                <Button variant="outline" onClick={exportCsv}>
                  <Download className="mr-2 h-4 w-4" />
                  Bank statement (CSV)
                </Button>
                <Button onClick={() => onOpenChange(false)}>Close</Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Row({ icon: Icon, label, value }: { icon: typeof Landmark; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="font-medium">{value}</p>
      </div>
    </div>
  );
}

function Item({ x }: { x: SandboxPayout['items'][number] }) {
  return (
    <li className="flex animate-[fadeUp_.25s_ease-out] items-center gap-3 rounded-lg px-2 py-1.5">
      <Avatar person={{ name: x.name, photo: x.photo }} size={28} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{x.name}</p>
        <p className="truncate font-mono text-[11px] text-muted-foreground">{x.status === 'paid' ? `${x.bank} ${x.account} · UTR ${x.utr}` : x.reason}</p>
      </div>
      <span className={cn('text-sm font-semibold tabular-nums', x.status === 'paid' ? 'text-success' : 'text-rose-600')}>{inr(x.amount)}</span>
      {x.status === 'paid' ? <Check className="h-4 w-4 text-success" /> : <X className="h-4 w-4 text-rose-600" />}
    </li>
  );
}
