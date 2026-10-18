'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays, MapPin, Plus, Video } from 'lucide-react';
import { careerConnectApi } from '@/lib/api';
import { usePermissions } from '@/hooks/usePermissions';
import { Button } from '@/components/ui/button';
import {
  Avatar,
  Empty,
  Faces,
  Meter,
  PageTitle,
  Segmented,
  Skeleton,
  StatusPill,
  fmtTime,
} from '@/components/connect/kit';
import { EVENT_TYPE, type AlumniEvent } from './types';

type Show = 'upcoming' | 'past' | 'drafts';

export default function AlumniEventsPage() {
  const { hasPermission } = usePermissions();
  const [show, setShow] = useState<Show>('upcoming');
  const { data, isLoading } = useQuery({
    queryKey: ['alumni-events'],
    queryFn: () => careerConnectApi.getAlumniEvents({ limit: 100, sortBy: 'eventDate', sortOrder: 'asc' }),
  });
  const all = (data?.data ?? []) as AlumniEvent[];
  const now = Date.now();
  const rows = all
    .filter((e) =>
      show === 'drafts'
        ? e.status === 'draft'
        : e.status !== 'draft' &&
          (show === 'upcoming'
            ? new Date(e.eventDate).getTime() >= now - 86_400_000
            : new Date(e.eventDate).getTime() < now - 86_400_000)
    )
    .sort((a, b) =>
      show === 'past'
        ? new Date(b.eventDate).getTime() - new Date(a.eventDate).getTime()
        : new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime()
    );

  return (
    <>
      <PageTitle
        title="Alumni events"
        description="Guest lectures, panels, workshops and reunions — alumni coming back to campus."
        actions={
          hasPermission('careerConnect.alumni', 'create') ? (
            <Button size="sm" asChild>
              <Link href="/career-connect/alumni/events/new">
                <Plus className="mr-1.5 h-4 w-4" />
                Plan an event
              </Link>
            </Button>
          ) : null
        }
      />

      <div className="mb-5">
        <Segmented<Show>
          value={show}
          onChange={setShow}
          options={[
            { value: 'upcoming', label: 'Upcoming' },
            { value: 'past', label: 'Past' },
            { value: 'drafts', label: 'Drafts' },
          ]}
        />
      </div>

      {isLoading ? (
        <Skeleton rows={8} />
      ) : rows.length === 0 ? (
        <div className="rounded-xl border bg-card">
          <Empty icon={CalendarDays} title={show === 'upcoming' ? 'Nothing scheduled' : 'Nothing here'} />
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((e) => {
            const d = new Date(e.eventDate);
            const regs = e.registrations ?? [];
            return (
              <Link
                key={e._id}
                href={`/career-connect/alumni/events/${e._id}`}
                className="flex flex-col gap-5 rounded-xl border bg-card p-5 shadow-xs transition hover:shadow-md sm:flex-row sm:items-center"
              >
                <div className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-xl bg-primary/[0.07] text-primary">
                  <span className="text-[11px] font-semibold uppercase tracking-wider">
                    {d.toLocaleDateString('en-IN', { month: 'short' })}
                  </span>
                  <span className="text-2xl font-semibold leading-none tabular-nums">{d.getDate()}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {EVENT_TYPE[e.type] ?? e.type}
                  </p>
                  <p className="mt-0.5 font-semibold leading-snug">{e.title}</p>
                  <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted-foreground">
                    <span>
                      {d.toLocaleDateString('en-IN', { weekday: 'short' })}, {fmtTime(e.eventDate)}
                    </span>
                    <span className="flex items-center gap-1">
                      {e.isVirtual ? <Video className="h-3.5 w-3.5" /> : <MapPin className="h-3.5 w-3.5" />}
                      {e.isVirtual ? 'Online' : e.venue || 'Campus'}
                    </span>
                  </p>
                </div>
                {e.speakers?.length ? (
                  <div className="flex items-center gap-2.5 sm:w-60">
                    <div className="flex -space-x-2">
                      {e.speakers.slice(0, 3).map((s) => (
                        <Avatar key={s.name} person={s} size={34} className="ring-2 ring-card" />
                      ))}
                    </div>
                    <p className="min-w-0 text-xs leading-snug text-muted-foreground">
                      <span className="block truncate font-medium text-foreground">
                        {e.speakers.map((s) => s.name.split(' ')[0]).join(', ')}
                      </span>
                      <span className="block truncate">
                        {[...new Set(e.speakers.map((s) => s.company).filter(Boolean))].join(', ')}
                      </span>
                    </p>
                  </div>
                ) : (
                  <div className="hidden sm:block sm:w-60" />
                )}
                <div className="sm:w-44">
                  {e.status === 'published' || e.status === 'completed' ? (
                    <>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <Faces people={regs.slice(0, 4).map((r) => r.person ?? { name: r.userName ?? '?' })} max={4} size={20} />
                        <span className="tabular-nums">
                          {regs.length}
                          {e.maxCapacity ? ` / ${e.maxCapacity}` : ''}
                        </span>
                      </div>
                      {e.maxCapacity ? (
                        <Meter value={(regs.length / e.maxCapacity) * 100} className="mt-1.5" />
                      ) : null}
                    </>
                  ) : (
                    <StatusPill status={e.status} />
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
