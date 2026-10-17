import type { LucideIcon } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export interface KpiItem {
  label: string;
  value: React.ReactNode;
  footnote: React.ReactNode;
  icon: LucideIcon;
  /** Highlights this cell with a brand wash + primary value tone. */
  accent?: boolean;
  /** Tints the value in destructive red — use for outstanding / blocked counts. */
  destructive?: boolean;
}

interface Props {
  loading?: boolean;
  items: KpiItem[];
  ariaLabel: string;
}

/**
 * Single rounded-2xl card carrying 1-4 KPI cells separated by hairline dividers.
 * A subtle gradient line at the very top adds editorial polish.
 */
export function KpiStrip({ loading, items, ariaLabel }: Props) {
  return (
    <section
      aria-label={ariaLabel}
      className="relative overflow-hidden rounded-2xl border border-border bg-card shadow-soft"
    >
      <div className="pointer-events-none absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
      <div
        className={cn(
          'grid grid-cols-1 divide-y divide-border md:divide-x md:divide-y-0',
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
                <Skeleton className="h-12 w-32" />
              ) : (
                <p
                  className={cn(
                    'font-display text-[44px] font-bold leading-none tracking-tight tabular-nums',
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
                {loading ? <Skeleton className="h-3 w-24" /> : item.footnote}
              </div>
              <span className="absolute right-5 top-2 text-[10px] font-mono text-muted-foreground/40">
                0{i + 1}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
