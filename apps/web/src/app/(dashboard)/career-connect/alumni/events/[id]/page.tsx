'use client';

import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { CalendarDays, Clock, MapPin, Video } from 'lucide-react';
import { careerConnectApi } from '@/lib/api';
import { usePermissions } from '@/hooks/usePermissions';
import { Button } from '@/components/ui/button';
import {
  Avatar,
  Empty,
  Meter,
  PageTitle,
  Panel,
  PersonCell,
  Skeleton,
  StatusPill,
  fmtDate,
  fmtTime,
} from '@/components/connect/kit';
import { EVENT_TYPE, type AlumniEvent } from '../types';

type ApiErr = Error & { response?: { data?: { error?: { message?: string } } } };

export default function AlumniEventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const canEdit = hasPermission('careerConnect.alumni', 'edit');

  const { data, isLoading } = useQuery({
    queryKey: ['alumni-event', id],
    queryFn: () => careerConnectApi.getAlumniEvent(id),
  });
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['alumni-event', id] });
    queryClient.invalidateQueries({ queryKey: ['alumni-events'] });
  };
  const onErr = (f: string) => (e: ApiErr) => toast.error(e.response?.data?.error?.message || f);
  const setStatus = useMutation({
    mutationFn: (status: string) => careerConnectApi.updateAlumniEventStatus(id, { status }),
    onSuccess: () => (toast.success('Event updated'), refresh()),
    onError: onErr('Could not update the event'),
  });
  const register = useMutation({
    mutationFn: () => careerConnectApi.registerForAlumniEvent(id),
    onSuccess: () => (toast.success('You’re registered'), refresh()),
    onError: onErr('Could not register'),
  });
  const remove = useMutation({
    mutationFn: () => careerConnectApi.deleteAlumniEvent(id),
    onSuccess: () => {
      toast.success('Event deleted');
      queryClient.invalidateQueries({ queryKey: ['alumni-events'] });
      router.push('/career-connect/alumni/events');
    },
    onError: onErr('Could not delete'),
  });

  if (isLoading) return <Skeleton rows={10} />;
  const e = data?.data as AlumniEvent | undefined;
  if (!e) return <Empty icon={CalendarDays} title="Event not found" />;
  const regs = [...(e.registrations ?? [])].sort(
    (a, b) => new Date(b.registeredAt).getTime() - new Date(a.registeredAt).getTime()
  );
  const upcoming = new Date(e.eventDate).getTime() > Date.now();

  return (
    <>
      <PageTitle
        crumbs={[
          { label: 'Events', href: '/career-connect/alumni/events' },
          { label: EVENT_TYPE[e.type] ?? 'Event' },
        ]}
        title={e.title}
        description={`${EVENT_TYPE[e.type] ?? e.type} · ${fmtDate(e.eventDate, { weekday: 'long', day: 'numeric', month: 'long' })}`}
        actions={
          <>
            <StatusPill status={e.status} />
            {canEdit && e.status === 'draft' && (
              <Button size="sm" onClick={() => setStatus.mutate('published')}>
                Publish
              </Button>
            )}
            {canEdit && e.status === 'published' && !upcoming && (
              <Button size="sm" onClick={() => setStatus.mutate('completed')}>
                Mark completed
              </Button>
            )}
            {e.status === 'published' && upcoming && (
              <Button size="sm" variant="outline" onClick={() => register.mutate()}>
                Register
              </Button>
            )}
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-6">
          {e.description && (
            <Panel title="About">
              <p className="whitespace-pre-line text-[15px] leading-7 text-foreground/85">{e.description}</p>
            </Panel>
          )}
          {e.speakers?.length ? (
            <Panel title={e.speakers.length > 1 ? 'Speakers' : 'Speaker'}>
              <div className="grid gap-4 sm:grid-cols-2">
                {e.speakers.map((s) => {
                  const body = (
                    <>
                      <Avatar person={s} size={52} />
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{s.name}</p>
                        <p className="truncate text-sm text-muted-foreground">{s.designation}</p>
                        <p className="truncate text-sm text-muted-foreground">{s.company}</p>
                      </div>
                    </>
                  );
                  return s.alumniId ? (
                    <Link
                      key={s.name}
                      href={`/career-connect/alumni/directory/${s.alumniId}`}
                      className="flex items-center gap-3.5 rounded-xl p-2 transition hover:bg-muted/50"
                    >
                      {body}
                    </Link>
                  ) : (
                    <div key={s.name} className="flex items-center gap-3.5 p-2">
                      {body}
                    </div>
                  );
                })}
              </div>
            </Panel>
          ) : null}
          <Panel
            title={e.status === 'completed' ? 'Attended' : 'Registered'}
            description={`${regs.length} student${regs.length === 1 ? '' : 's'}`}
          >
            {regs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No registrations yet.</p>
            ) : (
              <ul className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
                {regs.slice(0, 40).map((r) => (
                  <li key={r.userId}>
                    <PersonCell
                      person={r.person ?? { name: r.userName ?? 'Student' }}
                      href={r.studentId ? `/career-connect/student-profile/${r.studentId}` : undefined}
                      size={32}
                    />
                  </li>
                ))}
              </ul>
            )}
            {regs.length > 40 && (
              <p className="mt-4 text-sm text-muted-foreground">and {regs.length - 40} more</p>
            )}
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title="When & where">
            <ul className="space-y-3.5 text-sm">
              <li className="flex gap-3">
                <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                {fmtDate(e.eventDate, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </li>
              <li className="flex gap-3">
                <Clock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                {fmtTime(e.eventDate)}
                {e.endDate ? ` – ${fmtTime(e.endDate)}` : ''}
              </li>
              <li className="flex gap-3">
                {e.isVirtual ? (
                  <Video className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                ) : (
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                )}
                {e.isVirtual ? (
                  e.virtualLink ? (
                    <a href={e.virtualLink} target="_blank" rel="noreferrer" className="text-[#1e4fd8] hover:underline">
                      Join online
                    </a>
                  ) : (
                    'Online'
                  )
                ) : (
                  e.venue || 'On campus'
                )}
              </li>
            </ul>
          </Panel>
          {e.maxCapacity ? (
            <Panel title="Seats">
              <p className="text-3xl font-semibold tabular-nums tracking-tight">
                {regs.length}
                <span className="text-base font-normal text-muted-foreground"> / {e.maxCapacity}</span>
              </p>
              <Meter value={(regs.length / e.maxCapacity) * 100} className="mt-3" />
              <p className="mt-2 text-xs text-muted-foreground">
                {Math.max(0, e.maxCapacity - regs.length)} seats left
              </p>
            </Panel>
          ) : null}
          {canEdit && e.status !== 'cancelled' && e.status !== 'completed' && (
            <button
              className="text-sm text-muted-foreground hover:text-rose-600"
              onClick={() => confirm('Cancel this event?') && setStatus.mutate('cancelled')}
            >
              Cancel event
            </button>
          )}
          {hasPermission('careerConnect.alumni', 'delete') && (
            <button
              className="block text-sm text-muted-foreground hover:text-rose-600"
              onClick={() => confirm('Delete this event?') && remove.mutate()}
            >
              Delete
            </button>
          )}
        </div>
      </div>
    </>
  );
}
