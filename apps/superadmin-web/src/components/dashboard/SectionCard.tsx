import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  /** Tiny tracked-uppercase label above the title. */
  eyebrow: string;
  /** Optional display-font headline beneath the eyebrow. */
  title?: React.ReactNode;
  /** Optional right-aligned link in the header (e.g. "View all"). */
  action?: { href: string; label: string };
  /** Optional badge/count rendered to the right of the eyebrow. */
  badge?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}

/** Editorial section card — bordered, rounded-2xl, with a divided header. */
export function SectionCard({ eyebrow, title, action, badge, className, children }: Props) {
  return (
    <section
      className={cn(
        'rounded-2xl border border-border bg-card shadow-soft overflow-hidden',
        className
      )}
    >
      <header className="flex items-center justify-between gap-4 border-b border-border px-6 py-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              {eyebrow}
            </p>
            {badge}
          </div>
          {title && <h3 className="font-display text-lg font-semibold mt-0.5 truncate">{title}</h3>}
        </div>
        {action && (
          <Link
            href={action.href}
            className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors shrink-0"
          >
            {action.label} <ArrowUpRight className="h-3 w-3" />
          </Link>
        )}
      </header>
      <div className="px-6 py-6">{children}</div>
    </section>
  );
}
