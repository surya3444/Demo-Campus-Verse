'use client';

import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Banknote, ArrowUpRight } from 'lucide-react';
import { payrollApi } from '@/lib/api';
import { formatCurrency } from './utils';
import Link from 'next/link';

interface Payslip {
  _id: string;
  payslipNumber: string;
  month: number;
  year: number;
  netPayable: number;
  grossEarnings: number;
  totalDeductions: number;
  disbursement?: { status: 'pending' | 'processing' | 'paid' | 'reversed' | 'hold' | 'failed' };
}

function monthLabel(month: number, year: number) {
  return new Date(year, month - 1).toLocaleDateString('en-IN', {
    month: 'long',
    year: 'numeric',
  });
}

const DISBURSEMENT_BADGE: Record<
  string,
  { variant: 'success' | 'warning' | 'destructive'; label: string }
> = {
  paid: { variant: 'success', label: 'Paid' },
  processing: { variant: 'warning', label: 'Processing' },
  pending: { variant: 'warning', label: 'Pending' },
  hold: { variant: 'warning', label: 'On hold' },
  reversed: { variant: 'destructive', label: 'Reversed' },
  failed: { variant: 'destructive', label: 'Failed' },
};

/**
 * Latest payslip (self-service) — hides itself when the user has no payslips
 * (e.g. payroll not run, or no staff profile).
 */
export function PayslipCard({ allPayslipsHref }: { allPayslipsHref?: string }) {
  const { data, isLoading, error } = useQuery<{ success: boolean; data: Payslip[] }>({
    queryKey: ['my-payslips-card'],
    queryFn: () => payrollApi.getMyPayslips({ limit: 3 }),
    staleTime: 10 * 60 * 1000,
    retry: false,
  });

  if (error) return null;
  if (isLoading) return <Skeleton className="h-40 rounded-2xl" />;

  const payslips = data?.data || [];
  if (payslips.length === 0) return null;

  const [latest, ...older] = payslips;
  const disbursement =
    DISBURSEMENT_BADGE[latest.disbursement?.status || 'pending'] ?? DISBURSEMENT_BADGE.pending;

  return (
    <section className="rounded-2xl border bg-card shadow-xs">
      <header className="flex items-center justify-between border-b px-6 py-4">
        <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
          <Banknote className="h-3.5 w-3.5 text-success" />
          Latest payslip
        </div>
        {allPayslipsHref && (
          <Link
            href={allPayslipsHref}
            className="flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            All payslips <ArrowUpRight className="h-3 w-3" />
          </Link>
        )}
      </header>

      <div className="px-6 py-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-display text-3xl font-bold tracking-tight tabular-nums">
              {formatCurrency(latest.netPayable)}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Net pay · {monthLabel(latest.month, latest.year)}
            </p>
          </div>
          <div className="text-right">
            <Badge variant={disbursement.variant}>{disbursement.label}</Badge>
            <p className="mt-1.5 font-mono text-[11px] text-muted-foreground">
              {latest.payslipNumber}
            </p>
          </div>
        </div>

        <div className="mt-3 flex gap-4 border-t pt-3 text-xs text-muted-foreground">
          <span>
            Gross{' '}
            <span className="font-medium text-foreground">
              {formatCurrency(latest.grossEarnings)}
            </span>
          </span>
          <span>
            Deductions{' '}
            <span className="font-medium text-foreground">
              −{formatCurrency(latest.totalDeductions)}
            </span>
          </span>
        </div>

        {older.length > 0 && (
          <ul className="mt-3 space-y-1.5 border-t pt-3">
            {older.map((slip) => (
              <li
                key={slip._id}
                className="flex items-center justify-between text-xs text-muted-foreground"
              >
                <span>{monthLabel(slip.month, slip.year)}</span>
                <span className="font-mono tabular-nums">{formatCurrency(slip.netPayable)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
