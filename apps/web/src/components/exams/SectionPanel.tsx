import { cn } from '@/lib/utils';

interface SectionPanelProps {
  eyebrow?: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  /** Right-aligned slot in the header (e.g. small action button or badge). */
  action?: React.ReactNode;
  /** Removes the inner padding for content like full-width tables. */
  flush?: boolean;
  className?: string;
  children: React.ReactNode;
}

/**
 * Bordered rounded-2xl card with an optional editorial header.
 * Mirrors the section card on the organization settings page.
 */
export function SectionPanel({
  eyebrow,
  title,
  description,
  action,
  flush,
  className,
  children,
}: SectionPanelProps) {
  const hasHeader = !!(eyebrow || title || description || action);
  return (
    <section className={cn('rounded-2xl border bg-card shadow-soft overflow-hidden', className)}>
      {hasHeader && (
        <header className="flex items-start justify-between gap-4 border-b px-7 py-6">
          <div className="min-w-0 flex-1">
            {eyebrow && (
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                {eyebrow}
              </p>
            )}
            {title && (
              <h2 className="font-display text-xl font-bold tracking-tight mt-1 md:text-2xl">
                {title}
              </h2>
            )}
            {description && (
              <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted-foreground">
                {description}
              </p>
            )}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </header>
      )}
      <div className={flush ? '' : 'px-7 py-6'}>{children}</div>
    </section>
  );
}
