'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, HeartHandshake, Plus } from 'lucide-react';
import { careerConnectApi } from '@/lib/api';
import { usePermissions } from '@/hooks/usePermissions';
import { Button } from '@/components/ui/button';
import {
  Avatar,
  Empty,
  Meter,
  PageTitle,
  Pager,
  Segmented,
  Skeleton,
  Stat,
  StatusPill,
  fmtDate,
} from '@/components/connect/kit';
import type { AlumniCard, Mentorship } from './types';

type Show = '' | 'active' | 'requested' | 'completed';
const LIMIT = 18;
const TYPE: Record<string, string> = {
  one_on_one: 'One-on-one',
  group: 'Group circle',
  project_based: 'Project mentoring',
};

export default function MentorshipPage() {
  const { hasPermission } = usePermissions();
  const [show, setShow] = useState<Show>('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['mentorship-programs', show, page],
    queryFn: () =>
      careerConnectApi.getMentorshipPrograms({
        status: show || undefined,
        page,
        limit: LIMIT,
      }),
    placeholderData: (prev) => prev,
  });
  const { data: allData } = useQuery({
    queryKey: ['mentorship-programs', 'all'],
    queryFn: () => careerConnectApi.getMentorshipPrograms({ limit: 100 }),
  });
  const rows = (data?.data ?? []) as Mentorship[];
  const all = (allData?.data ?? []) as Mentorship[];
  const total = (data?.meta as { total?: number } | undefined)?.total ?? 0;
  const sessions = all.reduce((n, m) => n + (m.sessions?.length ?? 0), 0);
  const mentors = new Map<string, AlumniCard & { mentees: number }>();
  for (const m of all)
    if (m.mentor) {
      const cur = mentors.get(m.mentor.id);
      mentors.set(m.mentor.id, { ...m.mentor, mentees: (cur?.mentees ?? 0) + 1 });
    }
  const rated = all.filter((m) => m.feedback?.menteeRating);

  return (
    <>
      <PageTitle
        title="Mentorship"
        description="Alumni guiding final-year students — one-on-one, in small circles or through a project."
        actions={
          hasPermission('careerConnect.alumni', 'create') ? (
            <Button size="sm" asChild>
              <Link href="/career-connect/alumni/mentorship/new">
                <Plus className="mr-1.5 h-4 w-4" />
                Pair a mentor
              </Link>
            </Button>
          ) : null
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Active pairings"
          value={all.filter((m) => m.status === 'active').length}
          hint={`${all.filter((m) => m.status === 'requested').length} waiting for a mentor`}
        />
        <Stat label="Alumni mentoring" value={mentors.size} />
        <Stat label="Sessions held" value={sessions} hint="Across all pairings" />
        <Stat
          label="Mentee rating"
          value={
            rated.length
              ? rated.reduce((n, m) => n + (m.feedback?.menteeRating ?? 0), 0) / rated.length
              : 0
          }
          format={(n) => (n ? `${n.toFixed(1)} / 5` : '—')}
          hint={`${rated.length} completed with feedback`}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0">
          <div className="mb-4">
            <Segmented<Show>
              value={show}
              onChange={(v) => (setShow(v), setPage(1))}
              options={[
                { value: '', label: 'All' },
                { value: 'active', label: 'Active' },
                { value: 'requested', label: 'Requested' },
                { value: 'completed', label: 'Completed' },
              ]}
            />
          </div>
          {isLoading ? (
            <Skeleton rows={8} />
          ) : rows.length === 0 ? (
            <div className="rounded-2xl border border-border/70 bg-card">
              <Empty icon={HeartHandshake} title="No pairings here" />
            </div>
          ) : (
            <>
              <div className="grid gap-4 lg:grid-cols-2">
                {rows.map((m) => {
                  const done = m.sessions?.length ?? 0;
                  return (
                    <Link
                      key={m._id}
                      href={`/career-connect/alumni/mentorship/${m._id}`}
                      className="group rounded-2xl border border-border/70 bg-card p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition hover:border-border hover:shadow-md"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          {TYPE[m.programType ?? ''] ?? 'Mentorship'}
                        </span>
                        <StatusPill status={m.status} />
                      </div>
                      <div className="mt-4 flex items-center gap-3">
                        <Avatar person={{ name: m.mentor?.name ?? '?', photo: m.mentor?.photo }} size={44} />
                        <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground/60" />
                        <Avatar person={{ name: m.mentee?.name ?? '?', photo: m.mentee?.photo }} size={44} />
                        <div className="min-w-0 pl-1">
                          <p className="truncate text-sm font-semibold">
                            {m.mentor?.name ?? 'Mentor'} <span className="font-normal text-muted-foreground">mentoring</span> {m.mentee?.name?.split(' ')[0] ?? 'a student'}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {[m.mentor?.role, m.mentor?.company].filter(Boolean).join(' · ')}
                          </p>
                        </div>
                      </div>
                      <p className="mt-4 line-clamp-1 text-sm">{m.areaOfGuidance}</p>
                      {m.goals?.length ? (
                        <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                          Goal: {m.goals[0]}
                        </p>
                      ) : null}
                      <div className="mt-4 flex items-center gap-3 text-xs text-muted-foreground">
                        <Meter value={Math.min(100, (done / 6) * 100)} className="flex-1" />
                        <span className="shrink-0 tabular-nums">
                          {done} session{done === 1 ? '' : 's'}
                          {m.startDate ? ` · since ${fmtDate(m.startDate, { day: 'numeric', month: 'short' })}` : ''}
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
              <div className="mt-4 rounded-2xl border border-border/70 bg-card">
                <Pager page={page} total={total} limit={LIMIT} onPage={setPage} />
              </div>
            </>
          )}
        </div>

        <aside className="rounded-2xl border border-border/70 bg-card p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] xl:self-start">
          <p className="font-semibold">Mentors</p>
          <p className="mt-0.5 text-sm text-muted-foreground">Alumni giving their time this term</p>
          <ul className="mt-4 space-y-3.5">
            {[...mentors.values()]
              .sort((a, b) => b.mentees - a.mentees)
              .slice(0, 10)
              .map((m) => (
                <li key={m.id}>
                  <Link
                    href={`/career-connect/alumni/directory/${m.id}`}
                    className="flex items-center gap-3 hover:opacity-80"
                  >
                    <Avatar person={m} size={36} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{m.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {m.company} · ’{String(m.graduationYear ?? '').slice(2)}
                      </p>
                    </div>
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {m.mentees} mentee{m.mentees === 1 ? '' : 's'}
                    </span>
                  </Link>
                </li>
              ))}
          </ul>
        </aside>
      </div>
    </>
  );
}
