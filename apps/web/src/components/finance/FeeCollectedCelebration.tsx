'use client';

import { useEffect, useRef } from 'react';
import { Check, Printer, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface FeeCollectedDetails {
  studentName: string;
  amount: number;
  paymentMode: string;
  receiptNumber?: string;
  /** Transaction to print; omitted when there is nothing to print. */
  transactionId?: string;
  /** Online payments show the Razorpay badge. */
  online?: boolean;
  /** "Collect all" posts several receipts; shown as a count. */
  receiptCount?: number;
  /** The college the receipt is issued by (from the API); heads the receipt. */
  issuer?: { name: string; logo?: string };
}

/** "Institute of Engineering" → "IE": stands in when a college has no logo yet. */
const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter((w) => /^[A-Za-z]/.test(w) && !['of', 'and', 'the', '&'].includes(w.toLowerCase()))
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');

const MODE_LABEL: Record<string, string> = {
  cash: 'Cash',
  card: 'Card',
  upi: 'UPI',
  online: 'Online',
  razorpay: 'Online',
  netbanking: 'Net banking',
  cheque: 'Cheque',
};

/**
 * The fee-counter success moment, as in the product video: a "Collected"
 * pill ripples, the receipt slides in tilted and settles, a PAID stamp slams
 * down, then the payment badge and actions appear. All motion is CSS
 * (globals.css, .cv-*) and collapses to the end state for reduced motion.
 */
export function FeeCollectedCelebration({
  details,
  onClose,
  onPrint,
}: {
  details: FeeCollectedDetails | null;
  onClose: () => void;
  onPrint?: (transactionId: string) => void;
}) {
  const doneRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!details) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    // Focus lands on Done once it has faded in, so Enter dismisses.
    const t = setTimeout(() => doneRef.current?.focus(), 1900);
    return () => {
      window.removeEventListener('keydown', onKey);
      clearTimeout(t);
    };
  }, [details, onClose]);

  if (!details) return null;

  const { transactionId } = details;
  const amount = `₹${details.amount.toLocaleString('en-IN')}`;
  const mode = MODE_LABEL[details.paymentMode] ?? details.paymentMode;
  const today = new Date().toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Fee collected: ${amount} from ${details.studentName}`}
      className="fixed inset-0 z-[70] flex items-center justify-center overflow-hidden bg-slate-950/55 p-4 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="flex w-full max-w-md flex-col items-center gap-5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 1 · the button's "Collected" moment */}
        <div className="relative">
          <span
            aria-hidden
            className="cv-ripple pointer-events-none absolute inset-0 rounded-full border-4 border-emerald-400"
          />
          <div className="cv-pop flex items-center gap-2 rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-900/30">
            <Check className="h-4 w-4" />
            Collected {amount}
          </div>
        </div>

        {/* 2 · the receipt slides in, 3 · PAID stamp */}
        <div className="cv-receipt-in w-full">
          <div className="cv-impact relative overflow-hidden rounded-2xl bg-white p-7 text-slate-800 shadow-2xl">
            {/* Issued by the student's college, not by Campus Verse. */}
            <div className="flex items-center gap-3 pr-36">
              {details.issuer?.logo ? (
                <img
                  src={details.issuer.logo}
                  alt=""
                  className="h-12 w-12 shrink-0 rounded-lg object-contain"
                />
              ) : (
                <div
                  aria-hidden
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[#04266D] font-display text-lg font-bold text-white"
                >
                  {initials(details.issuer?.name ?? '') || '₹'}
                </div>
              )}
              <p className="font-display text-lg font-bold leading-tight text-[#04266D]">
                {details.issuer?.name ?? 'Fee receipt'}
              </p>
            </div>
            <p className="mt-6 text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
              Fee receipt
            </p>
            <p className="font-mono text-2xl font-bold text-[#04266D]">
              {details.receiptNumber ?? '—'}
            </p>

            <dl className="mt-4 divide-y divide-dashed divide-slate-200 text-[15px]">
              {[
                ['Student', details.studentName],
                ['Mode', mode],
                ...(details.receiptCount && details.receiptCount > 1
                  ? [['Receipts', String(details.receiptCount)]]
                  : []),
                ['Date', today],
                ['Amount paid', amount],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between py-2.5">
                  <dt className="text-slate-500">{label}</dt>
                  <dd className="font-semibold text-[#04266D]">{value}</dd>
                </div>
              ))}
            </dl>

            {/* 4 · payment badge */}
            <div className="cv-pop mt-5" style={{ animationDelay: '1450ms' }}>
              <span className="inline-flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-semibold text-[#053495]">
                <ShieldCheck className="h-4 w-4" />
                {details.online ? 'Secured by Razorpay' : `Paid by ${mode}`}
              </span>
            </div>

            <div
              aria-hidden
              className="cv-stamp pointer-events-none absolute right-7 top-20 rounded-xl border-[5px] border-emerald-600 px-5 py-1.5 font-display text-4xl font-extrabold tracking-[0.08em] text-emerald-600"
            >
              PAID
            </div>
          </div>
        </div>

        {/* 5 · actions */}
        <div className="cv-fade-up flex gap-3" style={{ animationDelay: '1700ms' }}>
          {transactionId && onPrint && (
            <Button variant="secondary" onClick={() => onPrint(transactionId)} className="gap-2">
              <Printer className="h-4 w-4" />
              Print receipt
            </Button>
          )}
          <Button ref={doneRef} onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </div>
  );
}
