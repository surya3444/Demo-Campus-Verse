'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays, ChevronRight, ClipboardCheck, Plus } from 'lucide-react';
import { healthApi } from '@/lib/api';
import { usePermissions } from '@/hooks/usePermissions';
import { Button } from '@/components/ui/button';
import {
  ACCENT,
  Cell,
  Empty,
  Meter,
  PageTitle,
  Pager,
  Panel,
  PersonCell,
  SearchBox,
  Segmented,
  Skeleton,
  Stat,
  StatusPill,
  Table,
  fmtDate,
  useDebounced,
  type Person,
} from '@/components/connect/kit';

interface Checkup {
  _id: string;
  personName: string;
  checkupType: string;
  checkupDate: string;
  status: string;
  vitals?: { bmi?: number; bloodPressureSystolic?: number; bloodPressureDiastolic?: number };
  visionExam?: { result?: string } | null;
  findings?: string[];
  person?: Person | null;
}
interface Campaign {
  _id: string;
  name: string;
  personType: string;
  checkupType?: string;
  scheduledDate: string;
  scheduledEndDate?: string;
  venue?: string;
  status: string;
  totalTarget?: number;
  completedCount?: number;
}

type Show = '' | 'scheduled' | 'completed';
const LIMIT = 20;

export default function CheckupsPage() {
  const router = useRouter();
  const { hasPermission } = usePermissions();
  const canCreate = hasPermission('health.checkups', 'create');
  const [search, setSearch] = useState('');
  const [show, setShow] = useState<Show>('');
  const [page, setPage] = useState(1);
  const q = useDebounced(search);

  const { data, isLoading } = useQuery({
    queryKey: ['health-checkups', q, show, page],
    queryFn: () =>
      healthApi.getCheckups({
        search: q || undefined,
        status: show || undefined,
        page,
        limit: LIMIT,
      }),
    placeholderData: (prev) => prev,
  });
  const { data: campaignsData } = useQuery({
    queryKey: ['health-campaigns'],
    queryFn: () => healthApi.getCampaigns({ limit: 6 }),
  });
  const { data: statsData } = useQuery({
    queryKey: ['health-checkup-stats'],
    queryFn: () => healthApi.getCheckupStats(),
  });
  const stats = (statsData?.data ?? {}) as {
    totalCheckups?: number;
    completedCheckups?: number;
    pendingCheckups?: number;
    referralsMade?: number;
    averageBmi?: number;
  };
  const checkups = (data?.data ?? []) as Checkup[];
  const campaigns = (campaignsData?.data ?? []) as Campaign[];
  const total = (data?.meta as { total?: number } | undefined)?.total ?? 0;
  const rate = stats.totalCheckups
    ? Math.round(((stats.completedCheckups ?? 0) / stats.totalCheckups) * 100)
    : 0;

  return (
    <>
      <PageTitle
        title="Health check-ups"
        description="Annual and routine check-ups — run individually or as campus-wide campaigns."
        actions={
          canCreate ? (
            <>
              <Button variant="outline" size="sm" asChild>
                <Link href="/health/checkups/campaigns/new">New campaign</Link>
              </Button>
              <Button size="sm" asChild className="bg-teal-600 hover:bg-teal-700">
                <Link href="/health/checkups/new">
                  <Plus className="mr-1.5 h-4 w-4" />
                  Schedule check-up
                </Link>
              </Button>
            </>
          ) : null
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          accent="health"
          label="Completed"
          value={stats.completedCheckups ?? 0}
          hint={`${rate}% of ${stats.totalCheckups ?? 0} scheduled`}
        />
        <Stat accent="health" label="Still to do" value={stats.pendingCheckups ?? 0} />
        <Stat
          accent="health"
          label="Average BMI"
          value={stats.averageBmi ?? 0}
          format={(n) => n.toFixed(1)}
        />
        <Stat
          accent="health"
          label="Referrals"
          value={stats.referralsMade ?? 0}
          hint="Sent on to a specialist"
        />
      </div>

      {campaigns.length > 0 && (
        <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {campaigns.map((c) => {
            const pct = c.totalTarget
              ? Math.round(((c.completedCount ?? 0) / c.totalTarget) * 100)
              : 0;
            return (
              <Link
                key={c._id}
                href={`/health/checkups/campaigns/${c._id}`}
                className="rounded-2xl border border-border/70 bg-card p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition hover:border-border hover:shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold leading-snug">{c.name}</p>
                  <StatusPill status={c.status} />
                </div>
                <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <CalendarDays className="h-3.5 w-3.5" />
                  {fmtDate(c.scheduledDate, { day: 'numeric', month: 'short' })}
                  {c.scheduledEndDate
                    ? ` – ${fmtDate(c.scheduledEndDate, { day: 'numeric', month: 'short' })}`
                    : ''}
                  {c.venue ? ` · ${c.venue}` : ''}
                </p>
                <div className="mt-4 flex items-baseline justify-between text-xs">
                  <span className="text-muted-foreground">
                    {c.completedCount ?? 0} of {c.totalTarget ?? 0}{' '}
                    {c.personType === 'staff' ? 'staff' : 'students'}
                  </span>
                  <span className="font-medium tabular-nums">{pct}%</span>
                </div>
                <Meter value={pct} color={ACCENT.health.hex} className="mt-1.5" />
              </Link>
            );
          })}
        </div>
      )}

      <Panel bodyClassName="p-0">
        <div className="flex flex-wrap items-center gap-3 border-b border-border/70 px-5 py-3">
          <SearchBox
            value={search}
            onChange={(v) => (setSearch(v), setPage(1))}
            placeholder="Search by name"
          />
          <div className="ml-auto">
            <Segmented<Show>
              value={show}
              onChange={(v) => (setShow(v), setPage(1))}
              options={[
                { value: '', label: 'All' },
                { value: 'scheduled', label: 'Scheduled' },
                { value: 'completed', label: 'Completed' },
              ]}
            />
          </div>
        </div>
        {isLoading ? (
          <Skeleton rows={10} />
        ) : checkups.length === 0 ? (
          <Empty
            icon={ClipboardCheck}
            title="No check-ups here"
            text="Schedule one, or start a campaign for a whole year."
          />
        ) : (
          <>
            <Table head={['Person', 'Check-up', 'Date', 'Results', 'Status', '']}>
              {checkups.map((c) => (
                <tr
                  key={c._id}
                  onClick={() =>
                    router.push(
                      c.status === 'scheduled' && canCreate
                        ? `/health/checkups/${c._id}/complete`
                        : `/health/checkups/${c._id}`
                    )
                  }
                  className="cursor-pointer transition-colors hover:bg-muted/40"
                >
                  <Cell>
                    <PersonCell person={c.person ?? { name: c.personName }} />
                  </Cell>
                  <Cell className="text-sm capitalize">{c.checkupType.replace('-', ' ')}</Cell>
                  <Cell className="whitespace-nowrap text-sm text-muted-foreground">
                    {fmtDate(c.checkupDate)}
                  </Cell>
                  <Cell>
                    {c.status === 'completed' ? (
                      <span className="text-sm">
                        {[
                          c.vitals?.bmi && `BMI ${c.vitals.bmi}`,
                          c.vitals?.bloodPressureSystolic &&
                            `BP ${c.vitals.bloodPressureSystolic}/${c.vitals.bloodPressureDiastolic}`,
                        ]
                          .filter(Boolean)
                          .join(' · ') || '—'}
                        {c.findings?.length ? (
                          <span className="block max-w-[240px] truncate text-xs text-muted-foreground">
                            {c.findings.join(' · ')}
                          </span>
                        ) : null}
                      </span>
                    ) : (
                      <span className="text-sm text-muted-foreground">
                        {canCreate ? 'Record results →' : 'Awaiting'}
                      </span>
                    )}
                  </Cell>
                  <Cell>
                    <StatusPill status={c.status} />
                  </Cell>
                  <Cell last>
                    <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground" />
                  </Cell>
                </tr>
              ))}
            </Table>
            <Pager page={page} total={total} limit={LIMIT} onPage={setPage} />
          </>
        )}
      </Panel>
    </>
  );
}
