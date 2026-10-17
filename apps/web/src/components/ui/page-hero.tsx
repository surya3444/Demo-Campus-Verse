'use client';

import { ReactNode, Children, cloneElement, isValidElement, ReactElement } from 'react';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

/* -------------------------------------------------------------------------- */
/*  PageHero                                                                   */
/*                                                                            */
/*  A premium page header that matches the dashboard's "new UI" language:     */
/*  rounded-2xl bg-card surface with a layered radial gradient mesh, a         */
/*  decorative top hairline, an icon tile, an uppercase eyebrow, a font-       */
/*  display title and a flexible actions slot. Theme-safe in every sidebar     */
/*  palette (the accent colours derive from --primary / --accent), so action  */
/*  buttons keep their normal contrast.                                        */
/* -------------------------------------------------------------------------- */

interface PageHeroProps {
  /** Leading icon shown in a gradient tile. */
  icon?: LucideIcon;
  /** Tiny uppercase label above the title (e.g. "Organization"). */
  eyebrow?: string;
  title: string;
  description?: string;
  /** Right-aligned action buttons / controls. */
  actions?: ReactNode;
  /** Extra content rendered below the title row (e.g. inline highlight chips). */
  children?: ReactNode;
  className?: string;
}

export function PageHero({
  icon: Icon,
  eyebrow,
  title,
  description,
  actions,
  children,
  className,
}: PageHeroProps) {
  return (
    <header className={cn('relative animate-fade-in', className)}>
      <div className="relative flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0 space-y-2">
          {eyebrow && (
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              {Icon && <Icon className="h-3.5 w-3.5 shrink-0 text-primary" />}
              <span>{eyebrow}</span>
            </div>
          )}
          <h1 className="font-display text-3xl font-bold leading-tight tracking-tight md:text-4xl">
            {title}
          </h1>
          {description && <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>}
        </div>

        {actions && (
          <div className="flex shrink-0 flex-wrap items-center gap-2 md:justify-end">{actions}</div>
        )}
      </div>

      {children && <div className="relative mt-5">{children}</div>}
    </header>
  );
}

/* -------------------------------------------------------------------------- */
/*  StatGrid / StatTile                                                        */
/*                                                                            */
/*  A joined KPI strip exactly like the dashboard's BranchKPIStrip: a single   */
/*  rounded-2xl bg-card panel with a top gradient hairline, vertical dividers   */
/*  between cells, an "01–04" mono index in each corner, a small plain icon on  */
/*  the label row, and big font-display tabular numbers. StatGrid is the panel; */
/*  each StatTile is a divided cell. StatGrid injects the running index.        */
/* -------------------------------------------------------------------------- */

type StatVariant = 'default' | 'primary' | 'success' | 'warning' | 'destructive' | 'info';

interface StatTileProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: LucideIcon;
  variant?: StatVariant;
  loading?: boolean;
  /** Injected by StatGrid — the 1-based position used for the corner index. */
  index?: number;
  className?: string;
}

const ICON_COLOR: Record<StatVariant, string> = {
  default: 'text-muted-foreground',
  primary: 'text-primary',
  success: 'text-success',
  warning: 'text-warning',
  destructive: 'text-destructive/70',
  info: 'text-info',
};

export function StatTile({
  title,
  value,
  subtitle,
  icon: Icon,
  variant = 'default',
  loading,
  index,
  className,
}: StatTileProps) {
  const isAccent = variant === 'primary';
  const isDestructive = variant === 'destructive';

  return (
    <div
      className={cn(
        'relative flex flex-col gap-3 px-6 py-7',
        isAccent && 'bg-gradient-to-br from-primary/5 via-transparent to-transparent',
        className
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
          {title}
        </p>
        {Icon && <Icon className={cn('h-3.5 w-3.5', ICON_COLOR[variant])} />}
      </div>

      {loading ? (
        <Skeleton className="h-11 w-28" />
      ) : (
        <p
          className={cn(
            'font-display text-[40px] font-bold leading-none tracking-tight tabular-nums',
            isDestructive ? 'text-destructive' : isAccent ? 'text-primary' : 'text-foreground'
          )}
        >
          {typeof value === 'number' ? value.toLocaleString() : value}
        </p>
      )}

      <div className="min-h-[1rem] text-xs text-muted-foreground">
        {loading ? <Skeleton className="h-3 w-24" /> : subtitle}
      </div>

      {index != null && (
        <span className="pointer-events-none absolute right-5 top-3 font-mono text-[10px] text-muted-foreground/40">
          {String(index).padStart(2, '0')}
        </span>
      )}
    </div>
  );
}

export function StatGrid({ children, className }: { children: ReactNode; className?: string }) {
  const cells = Children.toArray(children).map((child, i) =>
    isValidElement(child)
      ? cloneElement(child as ReactElement<StatTileProps>, { index: i + 1 })
      : child
  );

  return (
    <section
      className={cn(
        'relative overflow-hidden rounded-2xl border border-border bg-card shadow-soft animate-fade-in',
        className
      )}
    >
      <div className="pointer-events-none absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
      <div className="grid grid-cols-1 divide-y divide-border md:grid-cols-2 md:divide-x md:divide-y-0 lg:grid-cols-4">
        {cells}
      </div>
    </section>
  );
}
