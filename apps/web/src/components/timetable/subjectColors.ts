/**
 * Subject colours for timetable grids. Colours are handed out in sorted order
 * over the subjects on screen, so a section's subjects never share a colour
 * (a hash would collide with ~8 subjects in 10 hues). Class strings are
 * literal so Tailwind keeps them.
 */
const PALETTE = [
  {
    cell: 'border-sky-200 bg-sky-50 text-sky-950 dark:border-sky-400/30 dark:bg-sky-400/10 dark:text-sky-50',
    bar: 'bg-sky-500',
  },
  {
    cell: 'border-violet-200 bg-violet-50 text-violet-950 dark:border-violet-400/30 dark:bg-violet-400/10 dark:text-violet-50',
    bar: 'bg-violet-500',
  },
  {
    cell: 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-400/30 dark:bg-emerald-400/10 dark:text-emerald-50',
    bar: 'bg-emerald-500',
  },
  {
    cell: 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-50',
    bar: 'bg-amber-500',
  },
  {
    cell: 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-400/30 dark:bg-rose-400/10 dark:text-rose-50',
    bar: 'bg-rose-500',
  },
  {
    cell: 'border-teal-200 bg-teal-50 text-teal-950 dark:border-teal-400/30 dark:bg-teal-400/10 dark:text-teal-50',
    bar: 'bg-teal-500',
  },
  {
    cell: 'border-indigo-200 bg-indigo-50 text-indigo-950 dark:border-indigo-400/30 dark:bg-indigo-400/10 dark:text-indigo-50',
    bar: 'bg-indigo-500',
  },
  {
    cell: 'border-orange-200 bg-orange-50 text-orange-950 dark:border-orange-400/30 dark:bg-orange-400/10 dark:text-orange-50',
    bar: 'bg-orange-500',
  },
  {
    cell: 'border-fuchsia-200 bg-fuchsia-50 text-fuchsia-950 dark:border-fuchsia-400/30 dark:bg-fuchsia-400/10 dark:text-fuchsia-50',
    bar: 'bg-fuchsia-500',
  },
  {
    cell: 'border-lime-200 bg-lime-50 text-lime-950 dark:border-lime-400/30 dark:bg-lime-400/10 dark:text-lime-50',
    bar: 'bg-lime-500',
  },
  {
    cell: 'border-cyan-200 bg-cyan-50 text-cyan-950 dark:border-cyan-400/30 dark:bg-cyan-400/10 dark:text-cyan-50',
    bar: 'bg-cyan-500',
  },
  {
    cell: 'border-pink-200 bg-pink-50 text-pink-950 dark:border-pink-400/30 dark:bg-pink-400/10 dark:text-pink-50',
    bar: 'bg-pink-500',
  },
];

export type SubjectColor = (typeof PALETTE)[number];

export function subjectColors(subjectIds: Iterable<string>): (id: string) => SubjectColor {
  const index = new Map([...new Set(subjectIds)].sort().map((id, i) => [id, i]));
  return (id) => PALETTE[(index.get(id) ?? 0) % PALETTE.length];
}

/** Background for break / lunch rows. */
export const BREAK_ROW =
  'bg-[repeating-linear-gradient(135deg,hsl(var(--muted))_0_8px,transparent_8px_16px)]';
