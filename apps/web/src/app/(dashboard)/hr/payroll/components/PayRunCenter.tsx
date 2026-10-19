'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  CalendarCheck,
  Calculator,
  Check,
  FileText,
  Landmark,
  Loader2,
  Lock,
  Users,
} from 'lucide-react';
import { hrApi, payrollApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { CampusPayDialog } from './CampusPayDialog';

interface Run {
  _id: string;
  month: number;
  year: number;
  period: string;
  status: 'processing' | 'processed' | 'finalized' | 'cancelled';
  staffCount: number;
  totalGross: number;
  totalDeductions: number;
  totalNet: number;
  processedAt?: string;
  finalizedAt?: string;
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const inr = (n: number) =>
  n >= 1e7 ? `₹${(n / 1e7).toFixed(2)} Cr` : n >= 1e5 ? `₹${(n / 1e5).toFixed(2)} L` : `₹${Math.round(n).toLocaleString('en-IN')}`;
type ApiErr = Error & { response?: { data?: { error?: { message?: string } } } };

/**
 * One month's pay run as a guided path: every step says what it does, what
 * is done and what is next, so no one has to know the tabs.
 */
export function PayRunCenter({ canCreate, canFinalize, canPay }: { canCreate: boolean; canFinalize: boolean; canPay: boolean }) {
  const qc = useQueryClient();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [payOpen, setPayOpen] = useState(false);
  const period = `${year}-${String(month).padStart(2, '0')}`;

  const runs = useQuery({ queryKey: ['payroll-runs', 'center'], queryFn: () => payrollApi.getPayrollRuns({ limit: 24 }) });
  const assigned = useQuery({ queryKey: ['salary-assignments', 'count'], queryFn: () => payrollApi.getSalaryAssignments({ limit: 1 }) });
  const staff = useQuery({ queryKey: ['staff', 'active-count'], queryFn: () => hrApi.getStaff({ limit: 1, status: 'active' }) });
  const run = ((runs.data?.data ?? []) as Run[]).find((r) => r.period === period && r.status !== 'cancelled');
  const breakdown = useQuery({
    queryKey: ['payroll-breakdown', run?._id],
    queryFn: () => payrollApi.getPayrollRunBreakdown(run!._id),
    enabled: !!run && run.status !== 'processing',
  });
  const paidCount = (breakdown.data?.data?.paidCount as number | undefined) ?? 0;
  const assignedCount = (assigned.data?.meta as { total?: number } | undefined)?.total ?? 0;
  const staffCount = (staff.data?.meta as { total?: number } | undefined)?.total ?? 0;

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['payroll-runs'] });
    qc.invalidateQueries({ queryKey: ['payroll-breakdown'] });
    qc.invalidateQueries({ queryKey: ['payslips'] });
  };
  const onErr = (f: string) => (e: ApiErr) => toast.error(e.response?.data?.error?.message || f);
  const calculate = useMutation({
    mutationFn: () => payrollApi.processPayroll({ month, year }),
    onSuccess: () => (toast.success(`${MONTHS[month - 1]} payroll calculated`), refresh()),
    onError: onErr('Could not calculate payroll'),
  });
  const finalize = useMutation({
    mutationFn: () => payrollApi.finalizePayroll(run!._id),
    onSuccess: () => (toast.success(`${MONTHS[month - 1]} payroll finalized`), refresh()),
    onError: onErr('Could not finalize'),
  });
  const recalc = useMutation({
    mutationFn: async () => {
      await payrollApi.cancelPayroll(run!._id);
      return payrollApi.processPayroll({ month, year });
    },
    onSuccess: () => (toast.success('Recalculated with the latest salaries and attendance'), refresh()),
    onError: onErr('Could not recalculate'),
  });

  const stage = !run ? 0 : run.status === 'processed' ? 1 : run.status === 'finalized' && paidCount < run.staffCount ? 2 : 3;
  const steps = [
    {
      icon: Users,
      title: 'Salaries set',
      done: assignedCount > 0,
      body: `${assignedCount} of ${staffCount} staff have a salary assigned${assignedCount < staffCount ? ' — the rest are skipped' : ''}.`,
    },
    {
      icon: CalendarCheck,
      title: 'Attendance',
      done: true,
      body: 'Absences without approved paid leave become loss of pay automatically.',
    },
    {
      icon: Calculator,
      title: 'Calculate',
      done: stage >= 1,
      body: run ? `Calculated ${run.processedAt ? new Date(run.processedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : ''} for ${run.staffCount} staff.` : 'Builds a draft payslip for everyone. You can recalculate until you finalize.',
    },
    {
      icon: Lock,
      title: 'Finalize',
      done: run?.status === 'finalized',
      body: run?.status === 'finalized' ? 'Locked — figures can no longer change.' : 'Check the totals, then lock the month.',
    },
    {
      icon: Landmark,
      title: 'Pay',
      done: !!run && paidCount >= run.staffCount,
      body: run?.status === 'finalized' ? `${paidCount} of ${run.staffCount} credited.` : 'Send salaries through CampusPay once finalized.',
    },
    {
      icon: FileText,
      title: 'Payslips',
      done: !!run && paidCount >= run.staffCount,
      body: 'Staff see their payslip in the app as soon as they are paid.',
    },
  ];
  const current = steps.findIndex((s) => !s.done);

  return (
    <section className="overflow-hidden rounded-2xl border bg-card shadow-xs">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b bg-gradient-to-r from-primary/[0.06] via-transparent to-transparent px-6 py-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Pay run</p>
          <div className="mt-1 flex items-center gap-2">
            <select
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              className="rounded-lg border-0 bg-transparent font-display text-2xl font-bold tracking-tight focus:ring-2 focus:ring-primary/30"
            >
              {MONTHS.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="rounded-lg border-0 bg-transparent font-display text-2xl font-bold tracking-tight text-muted-foreground focus:ring-2 focus:ring-primary/30"
            >
              {[year - 1, year, year + 1].map((y) => (
                <option key={y}>{y}</option>
              ))}
            </select>
          </div>
        </div>
        {run && (
          <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm sm:grid-cols-4">
            <Figure label="Gross" value={inr(run.totalGross)} />
            <Figure label="Deductions" value={inr(run.totalDeductions)} />
            <Figure label="Take-home" value={inr(run.totalNet)} strong />
            <Figure label="Staff" value={String(run.staffCount)} />
          </div>
        )}
      </div>

      <ol className="grid gap-px bg-border sm:grid-cols-3 xl:grid-cols-6">
        {steps.map((s, i) => {
          const active = i === current;
          return (
            <li key={s.title} className={cn('relative bg-card p-5', active && 'bg-primary/[0.04]')}>
              <div className="flex items-center gap-2.5">
                <span
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition',
                    s.done ? 'bg-success text-white' : active ? 'bg-primary text-primary-foreground ring-4 ring-primary/15' : 'bg-muted text-muted-foreground'
                  )}
                >
                  {s.done ? <Check className="h-4 w-4" /> : <s.icon className="h-4 w-4" />}
                </span>
                <p className={cn('text-sm font-semibold', !s.done && !active && 'text-muted-foreground')}>
                  <span className="mr-1 text-muted-foreground">{i + 1}.</span>
                  {s.title}
                </p>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{s.body}</p>
              {active && <span className="absolute inset-x-0 bottom-0 h-0.5 bg-primary" />}
            </li>
          );
        })}
      </ol>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t px-6 py-4">
        <p className="text-sm text-muted-foreground">
          {stage === 0 && 'Nothing calculated for this month yet.'}
          {stage === 1 && 'Draft payslips are ready. Review them in Payslips, then finalize.'}
          {stage === 2 && `Finalized. ${run!.staffCount - paidCount} staff waiting to be paid.`}
          {stage === 3 && 'Everyone in this run has been paid.'}
        </p>
        <div className="flex flex-wrap gap-2">
          {stage === 0 && canCreate && (
            <Button onClick={() => calculate.mutate()} disabled={calculate.isPending || !assignedCount}>
              {calculate.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Calculator className="mr-2 h-4 w-4" />}
              Calculate {MONTHS[month - 1]} pay
            </Button>
          )}
          {stage === 1 && canCreate && (
            <Button variant="outline" onClick={() => recalc.mutate()} disabled={recalc.isPending}>
              {recalc.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Recalculate
            </Button>
          )}
          {stage === 1 && canFinalize && (
            <Button onClick={() => confirm(`Finalize ${MONTHS[month - 1]} ${year}? Figures will be locked.`) && finalize.mutate()} disabled={finalize.isPending}>
              <Lock className="mr-2 h-4 w-4" />
              Finalize
            </Button>
          )}
          {stage === 2 && (canPay || canFinalize) && (
            <Button onClick={() => setPayOpen(true)} className="bg-gradient-to-r from-primary to-[hsl(218_75%_34%)] shadow-soft">
              <Landmark className="mr-2 h-4 w-4" />
              {paidCount > 0 ? `Pay the remaining ${run!.staffCount - paidCount} staff` : `Pay ${inr(run!.totalNet)} with CampusPay`}
            </Button>
          )}
        </div>
      </div>

      {run && (
        <CampusPayDialog
          open={payOpen}
          onOpenChange={setPayOpen}
          run={run}
          monthLabel={`${MONTHS[run.month - 1]} ${run.year}`}
          pendingCount={run.staffCount - paidCount}
          onDone={refresh}
        />
      )}
    </section>
  );
}

function Figure({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={cn('font-semibold tabular-nums', strong && 'text-success')}>{value}</p>
    </div>
  );
}
