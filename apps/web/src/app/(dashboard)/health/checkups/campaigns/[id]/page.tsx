'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ChevronRight, ClipboardCheck } from 'lucide-react';
import { healthApi } from '@/lib/api';
import { usePermissions } from '@/hooks/usePermissions';
import { Button } from '@/components/ui/button';
import {
  ACCENT,
  Cell,
  Empty,
  KeyValue,
  Meter,
  PageTitle,
  Pager,
  Panel,
  PersonCell,
  Pill,
  Segmented,
  Skeleton,
  Stat,
  StatusPill,
  Table,
  fmtDate,
  type Person,
} from '@/components/connect/kit';

interface Campaign {
  _id: string;
  name: string;
  description?: string;
  personType: string;
  checkupType: string;
  scheduledDate: string;
  scheduledEndDate?: string;
  venue?: string;
  status: string;
  totalTarget?: number;
  completedCount?: number;
  pendingCount?: number;
  includeVision?: boolean;
  includeHearing?: boolean;
  includeDental?: boolean;
  includeGrowth?: boolean;
  notes?: string;
}
interface Checkup {
  _id: string;
  personName: string;
  checkupDate: string;
  status: string;
  vitals?: { bmi?: number };
  findings?: string[];
  person?: Person | null;
}

type Show = '' | 'scheduled' | 'completed';
const LIMIT = 20;

export default function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const [show, setShow] = useState<Show>('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['health-campaign', id],
    queryFn: () => healthApi.getCampaign(id),
  });
  const { data: listData } = useQuery({
    queryKey: ['health-campaign-checkups', id, show, page],
    queryFn: () =>
      healthApi.getCampaignCheckups(id, { page, limit: LIMIT, status: show || undefined }),
    placeholderData: (prev) => prev,
  });
  const start = useMutation({
    mutationFn: () => healthApi.startCampaign(id),
    onSuccess: () => {
      toast.success('Campaign started — check-ups scheduled');
      queryClient.invalidateQueries({ queryKey: ['health-campaign', id] });
      queryClient.invalidateQueries({ queryKey: ['health-campaign-checkups', id] });
    },
    onError: () => toast.error('Could not start the campaign'),
  });

  if (isLoading) return <Skeleton rows={10} />;
  const c = data?.data as Campaign | undefined;
  if (!c) return <Empty icon={ClipboardCheck} title="Campaign not found" />;

  const rows = (listData?.data ?? []) as Checkup[];
  const total = (listData?.meta as { total?: number } | undefined)?.total ?? 0;
  const target = c.totalTarget ?? 0;
  const done = c.completedCount ?? 0;
  const pct = target ? Math.round((done / target) * 100) : 0;
  const screenings = [
    c.includeVision && 'Vision',
    c.includeHearing && 'Hearing',
    c.includeDental && 'Dental',
    c.includeGrowth && 'Growth',
  ].filter(Boolean) as string[];
  const canRecord = hasPermission('health.checkups', 'edit');

  return (
    <>
      <PageTitle
        crumbs={[{ label: 'Check-ups', href: '/health/checkups' }, { label: 'Campaign' }]}
        title={c.name}
        description={`${fmtDate(c.scheduledDate, { day: 'numeric', month: 'long' })}${c.scheduledEndDate ? ` – ${fmtDate(c.scheduledEndDate, { day: 'numeric', month: 'long' })}` : ''}${c.venue ? ` · ${c.venue}` : ''}`}
        actions={
          <>
            <StatusPill status={c.status} />
            {c.status === 'scheduled' && hasPermission('health.checkups', 'create') && (
              <Button
                size="sm"
                className="bg-teal-600 hover:bg-teal-700"
                onClick={() => start.mutate()}
                disabled={start.isPending}
              >
                Start campaign
              </Button>
            )}
          </>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat accent="health" label="Target" value={target} hint={c.personType === 'staff' ? 'Staff' : 'Students'} />
        <Stat accent="health" label="Completed" value={done} />
        <Stat accent="health" label="Still to see" value={c.pendingCount ?? Math.max(0, target - done)} />
        <Stat accent="health" label="Progress" value={pct} format={(n) => `${Math.round(n)}%`} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Panel bodyClassName="p-0" className="min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 px-5 py-3">
            <p className="font-semibold">People in this campaign</p>
            <Segmented<Show>
              value={show}
              onChange={(v) => (setShow(v), setPage(1))}
              options={[
                { value: '', label: 'All' },
                { value: 'scheduled', label: 'To do' },
                { value: 'completed', label: 'Done' },
              ]}
            />
          </div>
          {rows.length === 0 ? (
            <Empty icon={ClipboardCheck} title="Nobody here yet" text={c.status === 'scheduled' ? 'Start the campaign to schedule check-ups.' : undefined} />
          ) : (
            <>
              <Table head={['Person', 'Date', 'Result', 'Status', '']}>
                {rows.map((k) => (
                  <tr
                    key={k._id}
                    onClick={() =>
                      router.push(
                        k.status === 'scheduled' && canRecord
                          ? `/health/checkups/${k._id}/complete`
                          : `/health/checkups/${k._id}`
                      )
                    }
                    className="cursor-pointer transition-colors hover:bg-muted/40"
                  >
                    <Cell>
                      <PersonCell person={k.person ?? { name: k.personName }} />
                    </Cell>
                    <Cell className="whitespace-nowrap text-sm text-muted-foreground">
                      {fmtDate(k.checkupDate, { day: 'numeric', month: 'short' })}
                    </Cell>
                    <Cell className="max-w-[220px] truncate text-sm">
                      {k.status === 'completed'
                        ? [k.vitals?.bmi && `BMI ${k.vitals.bmi}`, k.findings?.[0]].filter(Boolean).join(' · ') || '—'
                        : <span className="text-muted-foreground">{canRecord ? 'Record results →' : 'Awaiting'}</span>}
                    </Cell>
                    <Cell>
                      <StatusPill status={k.status} />
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

        <div className="space-y-6">
          <Panel title="Progress">
            <p className="text-3xl font-semibold tabular-nums tracking-tight">
              {done}
              <span className="text-base font-normal text-muted-foreground"> / {target}</span>
            </p>
            <Meter value={pct} color={ACCENT.health.hex} className="mt-3" />
            <p className="mt-2 text-xs text-muted-foreground">{pct}% examined</p>
          </Panel>
          <Panel title="About">
            {c.description && <p className="mb-4 text-sm text-foreground/85">{c.description}</p>}
            <KeyValue
              cols={1}
              items={[
                ['Type', <span key="t" className="capitalize">{c.checkupType}</span>],
                ['Who', c.personType === 'staff' ? 'All staff' : 'All students'],
                ['Venue', c.venue || '—'],
              ]}
            />
            {screenings.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {screenings.map((s) => (
                  <Pill key={s} tone="teal" dot={false}>
                    {s}
                  </Pill>
                ))}
              </div>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
