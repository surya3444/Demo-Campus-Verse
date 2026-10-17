import { Sparkles } from 'lucide-react';

interface Props {
  eyebrow: string;
  date: string;
  greeting: string;
  userName: string;
  rightSlot?: React.ReactNode;
}

/**
 * Atmospheric page header used across the super-admin app.
 *
 * - Tiny tracked uppercase eyebrow with a sparkle icon and the date.
 * - Display-font headline; the user's name carries a subtle gradient.
 * - Soft radial wash bleeds beyond the container; the parent must clip horizontal
 *   overflow (the (authed) layout does, since `<main>` has overflow-y-auto only
 *   and the wrapper has overflow-x-hidden semantics from the layout grid).
 */
export function EditorialHeader({ eyebrow, date, greeting, userName, rightSlot }: Props) {
  const maskFade = 'radial-gradient(ellipse 70% 120% at 50% 50%, black 40%, transparent 92%)';
  return (
    <header className="relative pb-8">
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-y-8"
        style={{
          left: '-50vw',
          right: '-50vw',
          background:
            'radial-gradient(ellipse 35% 90% at 30% 50%, hsl(var(--primary) / 0.10), transparent 70%), radial-gradient(ellipse 30% 80% at 70% 60%, hsl(var(--brand-cyan) / 0.10), transparent 70%)',
          WebkitMaskImage: maskFade,
          maskImage: maskFade,
        }}
      />
      <div className="relative flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2 min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
            <Sparkles className="h-3 w-3 shrink-0 text-[hsl(var(--brand-cyan))]" />
            <span className="min-w-0">{eyebrow}</span>
            <span className="hidden h-px w-8 bg-border sm:block" />
            <span>{date}</span>
          </div>
          <h1 className="font-display text-4xl font-bold leading-[1.15] tracking-tight text-foreground md:text-5xl">
            {greeting},{' '}
            <span className="bg-gradient-to-r from-primary via-primary to-[hsl(var(--brand-cyan))] bg-clip-text text-transparent">
              {userName}.
            </span>
          </h1>
        </div>
        {rightSlot && <div className="shrink-0">{rightSlot}</div>}
      </div>
    </header>
  );
}
