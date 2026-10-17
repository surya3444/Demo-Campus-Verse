import { cn } from '@/lib/utils';

const STATUS_STYLES: Record<string, string> = {
  draft: 'border-slate-200 bg-slate-50 text-slate-600 dark:bg-slate-900 dark:text-slate-300',
  scheduled: 'border-blue-200 bg-blue-50 text-blue-700',
  ongoing: 'border-amber-200 bg-amber-50 text-amber-700',
  completed: 'border-violet-200 bg-violet-50 text-violet-700',
  results_published: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  cancelled: 'border-rose-200 bg-rose-50 text-rose-700',
  published: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  committed: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  promote: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  hold: 'border-amber-200 bg-amber-50 text-amber-700',
  transfer_out: 'border-rose-200 bg-rose-50 text-rose-700',
  // OBE offering lifecycle
  data_entry: 'border-amber-200 bg-amber-50 text-amber-700',
  computed: 'border-violet-200 bg-violet-50 text-violet-700',
  finalized: 'border-emerald-200 bg-emerald-50 text-emerald-700',
};

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  scheduled: 'Scheduled',
  ongoing: 'Ongoing',
  completed: 'Completed',
  results_published: 'Published',
  cancelled: 'Cancelled',
  published: 'Published',
  committed: 'Committed',
  promote: 'Promote',
  hold: 'Hold',
  transfer_out: 'Transfer out',
  data_entry: 'Data entry',
  computed: 'Computed',
  finalized: 'Finalized',
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const style = STATUS_STYLES[status] || 'border-border bg-muted text-muted-foreground';
  const label = STATUS_LABELS[status] || status;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium',
        style,
        className
      )}
    >
      <span
        className={cn(
          'h-1.5 w-1.5 rounded-full',
          status === 'results_published' ||
            status === 'published' ||
            status === 'promote' ||
            status === 'committed' ||
            status === 'finalized'
            ? 'bg-emerald-500'
            : status === 'ongoing' || status === 'hold' || status === 'data_entry'
              ? 'bg-amber-500'
              : status === 'scheduled'
                ? 'bg-blue-500'
                : status === 'completed' || status === 'computed'
                  ? 'bg-violet-500'
                  : status === 'cancelled' || status === 'transfer_out'
                    ? 'bg-rose-500'
                    : 'bg-slate-400'
        )}
      />
      {label}
    </span>
  );
}
