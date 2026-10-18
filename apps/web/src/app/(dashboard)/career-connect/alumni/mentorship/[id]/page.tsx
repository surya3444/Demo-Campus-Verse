'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { CalendarPlus, HeartHandshake, Star, Target } from 'lucide-react';
import { careerConnectApi } from '@/lib/api';
import { usePermissions } from '@/hooks/usePermissions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Avatar,
  Empty,
  KeyValue,
  PageTitle,
  Panel,
  Skeleton,
  StatusPill,
  fmtDate,
} from '@/components/connect/kit';
import type { Mentorship } from '../types';

type ApiErr = Error & { response?: { data?: { error?: { message?: string } } } };
const TYPE: Record<string, string> = {
  one_on_one: 'One-on-one',
  group: 'Group circle',
  project_based: 'Project mentoring',
};

export default function MentorshipDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const canEdit = hasPermission('careerConnect.alumni', 'edit');
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState('');
  const [duration, setDuration] = useState('45');
  const [notes, setNotes] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['mentorship-program', id],
    queryFn: () => careerConnectApi.getMentorshipProgram(id),
  });
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['mentorship-program', id] });
    queryClient.invalidateQueries({ queryKey: ['mentorship-programs'] });
  };
  const onErr = (f: string) => (e: ApiErr) => toast.error(e.response?.data?.error?.message || f);
  const update = useMutation({
    mutationFn: (d: Record<string, unknown>) => careerConnectApi.updateMentorshipProgram(id, d),
    onSuccess: () => (toast.success('Mentorship updated'), refresh()),
    onError: onErr('Could not update'),
  });
  const addSession = useMutation({
    mutationFn: () =>
      careerConnectApi.addMentorshipSession(id, {
        date,
        duration: duration ? Number(duration) : undefined,
        notes: notes || undefined,
      }),
    onSuccess: () => {
      toast.success('Session logged');
      refresh();
      setOpen(false);
      setDate('');
      setNotes('');
    },
    onError: onErr('Could not log the session'),
  });
  const remove = useMutation({
    mutationFn: () => careerConnectApi.deleteMentorshipProgram(id),
    onSuccess: () => {
      toast.success('Mentorship removed');
      queryClient.invalidateQueries({ queryKey: ['mentorship-programs'] });
      router.push('/career-connect/alumni/mentorship');
    },
    onError: onErr('Could not remove'),
  });

  if (isLoading) return <Skeleton rows={10} />;
  const m = data?.data as Mentorship | undefined;
  if (!m) return <Empty icon={HeartHandshake} title="Mentorship not found" />;

  const sessions = [...(m.sessions ?? [])].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
  const minutes = sessions.reduce((n, s) => n + (s.duration ?? 0), 0);

  return (
    <>
      <PageTitle
        crumbs={[
          { label: 'Mentorship', href: '/career-connect/alumni/mentorship' },
          { label: m.mentee?.name ?? 'Pairing' },
        ]}
        title={m.areaOfGuidance}
        description={`${TYPE[m.programType ?? ''] ?? 'Mentorship'}${m.startDate ? ` · since ${fmtDate(m.startDate)}` : ''}`}
        actions={
          <>
            <StatusPill status={m.status} />
            {canEdit && m.status === 'requested' && (
              <Button size="sm" onClick={() => update.mutate({ status: 'active' })}>
                Approve pairing
              </Button>
            )}
            {canEdit && m.status === 'active' && (
              <>
                <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
                  <CalendarPlus className="mr-1.5 h-4 w-4" />
                  Log a session
                </Button>
                <Button size="sm" onClick={() => update.mutate({ status: 'completed' })}>
                  Mark complete
                </Button>
              </>
            )}
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            {[
              {
                tag: 'Mentor',
                href: m.mentor ? `/career-connect/alumni/directory/${m.mentor.id}` : undefined,
                person: { name: m.mentor?.name ?? 'Mentor', photo: m.mentor?.photo },
                line1: [m.mentor?.role, m.mentor?.company].filter(Boolean).join(' · '),
                line2: [m.mentor?.program, m.mentor?.graduationYear && `Class of ${m.mentor.graduationYear}`]
                  .filter(Boolean)
                  .join(' · '),
              },
              {
                tag: 'Mentee',
                href: `/career-connect/student-profile/${m.menteeStudentId}`,
                person: { name: m.mentee?.name ?? 'Student', photo: m.mentee?.photo },
                line1: m.mentee?.program ?? '',
                line2: m.mentee?.cgpa ? `CGPA ${m.mentee.cgpa.toFixed(2)}` : '',
              },
            ].map((p) => (
              <Link
                key={p.tag}
                href={p.href ?? '#'}
                className="flex items-center gap-4 rounded-2xl border border-border/70 bg-card p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition hover:shadow-md"
              >
                <Avatar person={p.person} size={56} />
                <div className="min-w-0">
                  <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    {p.tag}
                  </p>
                  <p className="truncate font-semibold">{p.person.name}</p>
                  <p className="truncate text-sm text-muted-foreground">{p.line1}</p>
                  {p.line2 && <p className="truncate text-xs text-muted-foreground">{p.line2}</p>}
                </div>
              </Link>
            ))}
          </div>

          <Panel
            title="Sessions"
            description={
              sessions.length
                ? `${sessions.length} sessions · ${Math.round(minutes / 60)} hours together`
                : undefined
            }
          >
            {sessions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {m.status === 'requested'
                  ? 'Sessions start once the pairing is approved.'
                  : 'No sessions logged yet.'}
              </p>
            ) : (
              <ol className="relative space-y-6 border-l border-border pl-6">
                {sessions.map((s, i) => (
                  <li key={s._id ?? i} className="relative">
                    <span className="absolute -left-[29px] top-1 h-2.5 w-2.5 rounded-full bg-[#1e4fd8] ring-4 ring-card" />
                    <p className="text-sm font-medium">
                      {fmtDate(s.date, { weekday: 'short', day: 'numeric', month: 'short' })}
                      {s.duration ? (
                        <span className="font-normal text-muted-foreground"> · {s.duration} min</span>
                      ) : null}
                    </p>
                    {s.notes && <p className="mt-1 text-sm text-foreground/80">{s.notes}</p>}
                  </li>
                ))}
              </ol>
            )}
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title="Goals">
            {m.goals?.length ? (
              <ul className="space-y-2.5">
                {m.goals.map((g) => (
                  <li key={g} className="flex items-start gap-2.5 text-sm">
                    <Target className="mt-0.5 h-4 w-4 shrink-0 text-[#1e4fd8]" />
                    {g}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No goals set.</p>
            )}
          </Panel>
          <Panel title="Details">
            <KeyValue
              cols={1}
              items={[
                ['Format', TYPE[m.programType ?? ''] ?? '—'],
                ['Requested', fmtDate(m.createdAt)],
                ['Started', fmtDate(m.startDate)],
                ...(m.endDate ? [['Ended', fmtDate(m.endDate)] as [string, string]] : []),
              ]}
            />
          </Panel>
          {m.feedback?.menteeRating ? (
            <Panel title="Feedback">
              <div className="flex gap-0.5">
                {Array.from({ length: 5 }, (_, i) => (
                  <Star
                    key={i}
                    className={
                      i < (m.feedback?.menteeRating ?? 0)
                        ? 'h-4 w-4 fill-amber-400 text-amber-400'
                        : 'h-4 w-4 text-muted-foreground/30'
                    }
                  />
                ))}
              </div>
              {m.feedback.comments && (
                <p className="mt-2 text-sm text-foreground/80">“{m.feedback.comments}”</p>
              )}
            </Panel>
          ) : null}
          {canEdit && m.status !== 'cancelled' && m.status !== 'completed' && (
            <button
              className="text-sm text-muted-foreground hover:text-rose-600"
              onClick={() => update.mutate({ status: 'cancelled' })}
            >
              Cancel this mentorship
            </button>
          )}
          {hasPermission('careerConnect.alumni', 'delete') && (
            <button
              className="block text-sm text-muted-foreground hover:text-rose-600"
              onClick={() => confirm('Delete this mentorship and its sessions?') && remove.mutate()}
            >
              Delete
            </button>
          )}
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Log a session</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="d">Date</Label>
                <Input id="d" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="m">Minutes</Label>
                <Input
                  id="m"
                  type="number"
                  min={5}
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="n">What you covered</Label>
              <Textarea id="n" rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!date || addSession.isPending}
              onClick={() => addSession.mutate()}
            >
              Save session
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
