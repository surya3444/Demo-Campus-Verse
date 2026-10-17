import type { LucideIcon } from 'lucide-react';
import { Sparkles } from 'lucide-react';

interface EditorialHeaderProps {
  /** Tiny tracked-uppercase label that sits above the title. */
  eyebrow: string;
  /** Optional code/identifier in mono shown after the eyebrow (e.g. exam code). */
  meta?: string;
  title: string;
  description?: string;
  icon?: LucideIcon;
  /** Right-aligned slot for action buttons. */
  actions?: React.ReactNode;
}

/**
 * Module-level page header used across the Exams pages.
 * Same vocabulary as the organization settings page:
 *   - eyebrow (uppercase tracked) + optional mono meta
 *   - display-font title
 *   - muted description line
 */
export function EditorialHeader({
  eyebrow,
  meta,
  title,
  description,
  icon: Icon = Sparkles,
  actions,
}: EditorialHeaderProps) {
  return (
    <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div className="space-y-1.5 min-w-0">
        <div className="flex items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
          <Icon className="h-3 w-3 text-accent shrink-0" />
          <span className="truncate">{eyebrow}</span>
          {meta && (
            <>
              <span className="h-px w-6 bg-border shrink-0" />
              <span className="font-mono normal-case tracking-normal text-muted-foreground/80 truncate">
                {meta}
              </span>
            </>
          )}
        </div>
        <h1 className="font-display text-3xl font-bold tracking-tight md:text-4xl">{title}</h1>
        {description && <p className="text-sm text-muted-foreground max-w-2xl">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
