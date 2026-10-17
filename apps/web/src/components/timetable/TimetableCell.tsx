import { FlaskConical, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SubjectColor } from './subjectColors';

/** One class in a timetable grid: a coloured card with subject, teacher and badges. */
export function TimetableCell({
  subjectName,
  teacherName,
  batchName,
  room,
  lab,
  color,
  isNew,
  muted,
  delay,
}: {
  subjectName: string;
  teacherName?: string;
  batchName?: string | null;
  room?: string;
  lab?: boolean;
  color: SubjectColor;
  isNew?: boolean;
  muted?: boolean;
  /** Stagger for the pop-in animation (ms); omit for no animation. */
  delay?: number;
}) {
  return (
    <span
      className={cn(
        'relative block overflow-hidden rounded-md border py-1 pl-2.5 pr-1.5 text-left',
        color.cell,
        muted && 'opacity-60',
        delay !== undefined && 'motion-safe:animate-pop-in [animation-fill-mode:both]'
      )}
      style={delay !== undefined ? { animationDelay: `${delay}ms` } : undefined}
    >
      <span className={cn('absolute inset-y-0 left-0 w-1', color.bar)} />
      <span className="flex items-center gap-1 truncate text-xs font-semibold">
        {(lab || batchName) && <FlaskConical className="h-3 w-3 shrink-0 opacity-70" />}
        {batchName && (
          <span className="rounded bg-background/70 px-1 text-[10px] font-bold">{batchName}</span>
        )}
        <span className="truncate">{subjectName}</span>
        {isNew && <Sparkles className="ml-auto h-3 w-3 shrink-0 opacity-60" />}
      </span>
      {(teacherName || room) && (
        <span className="block truncate text-[11px] opacity-75">
          {teacherName}
          {room ? ` · ${room}` : ''}
        </span>
      )}
    </span>
  );
}
