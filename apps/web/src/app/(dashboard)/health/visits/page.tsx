'use client';

import Link from 'next/link';
import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, Plus, Stethoscope } from 'lucide-react';
import { healthApi } from '@/lib/api';
import { usePermissions } from '@/hooks/usePermissions';
import { Button } from '@/components/ui/button';
import {
  Cell,
  Empty,
  PageTitle,
  Pager,
  Panel,
  PersonCell,
  Pill,
  SearchBox,
  Segmented,
  Skeleton,
  Stat,
  Table,
  fmtDate,
  fmtTime,
  useDebounced,
  type Person,
} from '@/components/connect/kit';

interface Visit {
  _id: string;
  personName: string;
  personType: string;
  visitType: string;
  visitDate: string;
  arrivalTime?: string;
  chiefComplaint: string;
  diagnosis?: string;
  status: string;
  outcome?: string;
  attendedByName?: string;
  person?: Person | null;
}

type Show = 'all' | 'today' | 'in_progress' | 'completed';
const LIMIT = 20;
const TYPE: Record<string, 'teal' | 'red' | 'amber' | 'gray' | 'violet'> = {
  illness: 'teal',
  injury: 'amber',
  emergency: 'red',
  routine: 'gray',
  'follow-up': 'violet',
  other: 'gray',
};
const OUTCOME: Record<
  string,
  { label: string; tone: 'green' | 'amber' | 'violet' | 'blue' | 'red' }
> = {
  returned_to_class: { label: 'Back in class', tone: 'green' },
  sent_home: { label: 'Sent home', tone: 'amber' },
  referred: { label: 'Referred', tone: 'violet' },
  under_observation: { label: 'Observation', tone: 'blue' },
  hospitalized: { label: 'Hospitalised', tone: 'red' },
};

export default function VisitsPage() {
  return (
    <Suspense fallback={null}>
      <Visits />
    </Suspense>
  );
}

function Visits() {
  const router = useRouter();
  const params = useSearchParams();
  const personId = params.get('personId') ?? undefined;
  const { hasPermission } = usePermissions();
  const [search, setSearch] = useState('');
  const [show, setShow] = useState<Show>('all');
  const [page, setPage] = useState(1);
  const q = useDebounced(search);

  const { data, isLoading } = useQuery({
    queryKey: ['health-visits', q, show, page, personId],
    queryFn: () =>
      healthApi.getVisits({
        search: q || undefined,
        personId,
        ...(show === 'today' && { today: true }),
        ...((show === 'in_progress' || show === 'completed') && { status: show }),
        page,
        limit: LIMIT,
      } as Parameters<typeof healthApi.getVisits>[0]),
    placeholderData: (prev) => prev,
  });
  const { data: statsData } = useQuery({
    queryKey: ['health-visit-stats'],
    queryFn: () => healthApi.getVisitStats(),
  });
  const stats = (statsData?.data ?? {}) as {
    todayVisits?: number;
    weekVisits?: number;
    monthVisits?: number;
    incidentCount?: number;
  };
  const visits = (data?.data ?? []) as Visit[];
  const total = (data?.meta as { total?: number } | undefined)?.total ?? 0;

  return (
    <>
      <PageTitle
        title="Sick-room visits"
        description="Every visit to the campus health room — what brought them in, what was done and where they went next."
        actions={
          hasPermission('health.visits', 'create') ? (
            <Button size="sm" asChild className="bg-teal-600 hover:bg-teal-700">
              <Link href="/health/visits/new">
                <Plus className="mr-1.5 h-4 w-4" />
                Log a visit
              </Link>
            </Button>
          ) : null
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat accent="health" label="Today" value={stats.todayVisits ?? 0} />
        <Stat accent="health" label="This week" value={stats.weekVisits ?? 0} />
        <Stat accent="health" label="This month" value={stats.monthVisits ?? 0} />
        <Stat
          accent="health"
          label="Incidents logged"
          value={stats.incidentCount ?? 0}
          hint="Injuries with an incident report"
        />
      </div>

      <Panel bodyClassName="p-0">
        <div className="flex flex-wrap items-center gap-3 border-b border-border/70 px-5 py-3">
          <SearchBox
            value={search}
            onChange={(v) => (setSearch(v), setPage(1))}
            placeholder="Search by name or complaint"
          />
          <div className="ml-auto">
            <Segmented<Show>
              value={show}
              onChange={(v) => (setShow(v), setPage(1))}
              options={[
                { value: 'all', label: 'All' },
                { value: 'today', label: 'Today' },
                { value: 'in_progress', label: 'In sick room' },
                { value: 'completed', label: 'Closed' },
              ]}
            />
          </div>
        </div>

        {isLoading ? (
          <Skeleton rows={10} />
        ) : visits.length === 0 ? (
          <Empty
            icon={Stethoscope}
            title="No visits here"
            text={
              show === 'today' ? 'Nobody has visited the sick room today.' : 'Try another filter.'
            }
          />
        ) : (
          <>
            <Table head={['Person', 'Reason', 'When', 'Seen by', 'Outcome', '']}>
              {visits.map((v) => {
                const o = v.status === 'in_progress' ? null : OUTCOME[v.outcome ?? ''];
                return (
                  <tr
                    key={v._id}
                    onClick={() => router.push(`/health/visits/${v._id}`)}
                    className="cursor-pointer transition-colors hover:bg-muted/40"
                  >
                    <Cell>
                      <PersonCell person={v.person ?? { name: v.personName }} />
                    </Cell>
                    <Cell>
                      <span className="block max-w-[260px] truncate text-sm font-medium">
                        {v.chiefComplaint}
                      </span>
                      <span className="mt-0.5 flex items-center gap-1.5">
                        <Pill tone={TYPE[v.visitType] ?? 'gray'} dot={false} className="capitalize">
                          {v.visitType.replace('-', ' ')}
                        </Pill>
                        {v.diagnosis && (
                          <span className="truncate text-xs text-muted-foreground">
                            {v.diagnosis}
                          </span>
                        )}
                      </span>
                    </Cell>
                    <Cell className="whitespace-nowrap">
                      <span className="block text-sm">
                        {fmtDate(v.visitDate, { day: 'numeric', month: 'short' })}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {fmtTime(v.arrivalTime ?? v.visitDate)}
                      </span>
                    </Cell>
                    <Cell className="text-sm text-muted-foreground">{v.attendedByName ?? '—'}</Cell>
                    <Cell>
                      {o ? (
                        <Pill tone={o.tone}>{o.label}</Pill>
                      ) : v.status === 'in_progress' ? (
                        <Pill tone="red">In sick room</Pill>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </Cell>
                    <Cell last>
                      <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground" />
                    </Cell>
                  </tr>
                );
              })}
            </Table>
            <Pager page={page} total={total} limit={LIMIT} onPage={setPage} />
          </>
        )}
      </Panel>
    </>
  );
}
