import { Bot, Building2, FileSearch, MessagesSquare, Sparkles, Target } from 'lucide-react';

const FEATURES = [
  {
    icon: FileSearch,
    title: 'Resume reviews, instantly',
    body: 'Every student gets feedback on their resume, tuned to the roles they want.',
  },
  {
    icon: Target,
    title: 'Right student, right drive',
    body: 'Matches each placement drive with the students who fit it best.',
  },
  {
    icon: MessagesSquare,
    title: 'Mock interviews, any time',
    body: 'Practice rounds with instant tips, so students walk in prepared.',
  },
  {
    icon: Building2,
    title: 'Recruiter follow-ups',
    body: 'Keeps companies, schedules and offers moving — so your team can focus on students.',
  },
];

export default function VirtualPlacementOfficePage() {
  return (
    <div className="mx-auto max-w-5xl space-y-8 py-4">
      <section className="relative overflow-hidden rounded-3xl border bg-gradient-to-br from-primary via-primary to-[hsl(var(--brand-cyan,199_89%_48%))] px-6 py-12 text-primary-foreground shadow-lg motion-safe:animate-fade-up sm:px-12 sm:py-16">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/10 blur-2xl motion-safe:animate-pulse-soft"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-20 left-1/3 h-56 w-56 rounded-full bg-white/10 blur-3xl"
        />

        <div className="relative flex flex-col items-center gap-8 text-center sm:flex-row sm:text-left">
          <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-3xl bg-white/15 ring-1 ring-white/30 backdrop-blur motion-safe:animate-float">
            <Bot className="h-12 w-12" aria-hidden />
          </div>
          <div className="space-y-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] ring-1 ring-white/30">
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
              Coming soon
            </span>
            <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
              Virtual Placement Office
            </h1>
            <p className="text-lg font-medium text-white/90">
              Campus Verse · Flagship Support for Placements
            </p>
            <p className="max-w-xl text-sm text-white/80">
              An always-on placement office for every student — guiding careers, preparing them for
              interviews and connecting them with the right companies.
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        {FEATURES.map((f, i) => (
          <div
            key={f.title}
            className="flex gap-4 rounded-2xl border bg-card p-5 transition-shadow hover:shadow-md motion-safe:animate-fade-up [animation-fill-mode:both]"
            style={{ animationDelay: `${150 + i * 90}ms` }}
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <f.icon className="h-5 w-5" aria-hidden />
            </div>
            <div>
              <h2 className="font-sans text-base font-semibold tracking-normal">{f.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{f.body}</p>
            </div>
          </div>
        ))}
      </section>

      <p
        className="text-center text-sm text-muted-foreground motion-safe:animate-fade-in [animation-fill-mode:both]"
        style={{ animationDelay: '600ms' }}
      >
        We&apos;re building this now. It will appear here for your placement team as soon as
        it&apos;s ready.
      </p>
    </div>
  );
}
