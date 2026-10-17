import type { LucideIcon } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export interface KpiItem {
  label: string;
  value: React.ReactNode;
  footnote?: React.ReactNode;
  icon: LucideIcon;
  /** Highlights this cell with a brand wash + primary value tone. */
  accent?: boolean;
  /** Tints the value in destructive red — use for outstanding / pending counts. */
  destructive?: boolean;
}

interface KpiStripProps {
  loading?: boolean;
  items: KpiItem[];
  /** Aria label for the whole strip. */
  ariaLabel?: string;
  className?: string;
}

/**
 * Single rounded-2xl card holding 1–4 KPI cells divided by hairline rules.
 * A subtle gradient line on the very top edge sells the editorial feel.
 */
export function KpiStrip({ loading, items, ariaLabel = 'Key stats', className }: KpiStripProps) {
  return (
    <section
      aria-label={ariaLabel}
      className={cn('relative overflow-hidden rounded-2xl border bg-card shadow-soft', className)}
    >
      <div className="pointer-events-none absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
      <div
        className={cn(
          'grid grid-cols-1 divide-y md:divide-x md:divide-y-0',
          items.length === 2 && 'md:grid-cols-2',
          items.length === 3 && 'md:grid-cols-3',
          items.length >= 4 && 'md:grid-cols-2 lg:grid-cols-4'
        )}
      >
        {items.map((item, i) => {
          const Icon = item.icon;
          return (
            <div
              key={item.label}
              className={cn(
                'relative flex flex-col gap-3 px-6 py-7',
                item.accent && 'bg-gradient-to-br from-primary/5 via-transparent to-transparent'
              )}
            >
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                  {item.label}
                </p>
                <Icon
                  className={cn(
                    'h-3.5 w-3.5',
                    item.accent
                      ? 'text-primary'
                      : item.destructive
                        ? 'text-destructive/70'
                        : 'text-muted-foreground'
                  )}
                />
              </div>
              {loading ? (
                <Skeleton className="h-10 w-32" />
              ) : (
                <p
                  className={cn(
                    'font-display text-[40px] leading-none font-bold tracking-tight tabular-nums',
                    item.destructive
                      ? 'text-destructive'
                      : item.accent
                        ? 'text-primary'
                        : 'text-foreground'
                  )}
                >
                  {item.value}
                </p>
              )}
              <div className="text-xs">
                {loading ? <Skeleton className="h-3 w-24" /> : item.footnote || <span>&nbsp;</span>}
              </div>
              <span className="absolute right-5 top-2 text-[10px] font-mono text-muted-foreground/40">
                {String(i + 1).padStart(2, '0')}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
