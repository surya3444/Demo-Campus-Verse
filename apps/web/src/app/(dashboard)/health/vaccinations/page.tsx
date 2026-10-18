'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Syringe } from 'lucide-react';
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

interface Vaccination {
  _id: string;
  personName: string;
  vaccineName: string;
  doseNumber: number;
  totalDoses?: number;
  scheduledDate?: string;
  administeredDate?: string;
  manufacturer?: string;
  status: string;
  person?: Person | null;
}
interface Stats {
  totalVaccinations?: number;
  completedVaccinations?: number;
  scheduledVaccinations?: number;
  overdueVaccinations?: number;
  complianceRate?: number;
  vaccineCoverage?: Record<string, { total: number; completed: number }>;
}

type Show = '' | 'scheduled' | 'overdue' | 'completed';
const LIMIT = 20;

export default function VaccinationsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const canEdit = hasPermission('health.vaccinations', 'edit');
  const [search, setSearch] = useState('');
  const [show, setShow] = useState<Show>('');
  const [page, setPage] = useState(1);
  const q = useDebounced(search);

  const { data, isLoading } = useQuery({
    queryKey: ['vaccinations', q, show, page],
    queryFn: () =>
      healthApi.getVaccinations({
        search: q || undefined,
        status: show || undefined,
        page,
        limit: LIMIT,
      }),
    placeholderData: (prev) => prev,
  });
  const { data: statsData } = useQuery({
    queryKey: ['vaccinations-stats'],
    queryFn: () => healthApi.getVaccinationStats(),
  });
  const stats = (statsData?.data ?? {}) as Stats;
  const markOverdue = useMutation({
    mutationFn: () => healthApi.markOverdueVaccinations(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vaccinations'] });
      queryClient.invalidateQueries({ queryKey: ['vaccinations-stats'] });
      toast.success('Doses past their date are now marked overdue');
    },
    onError: () => toast.error('Could not update overdue doses'),
  });

  const rows = (data?.data ?? []) as Vaccination[];
  const total = (data?.meta as { total?: number } | undefined)?.total ?? 0;
  const coverage = Object.entries(stats.vaccineCoverage ?? {})
    .map(([name, c]) => ({
      name,
      ...c,
      rate: c.total ? Math.round((c.completed / c.total) * 100) : 0,
    }))
    .sort((a, b) => b.total - a.total);

  return (
    <>
      <PageTitle
        title="Vaccinations"
        description="Doses given, doses due and who needs a reminder."
        actions={
          <>
            {canEdit && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => markOverdue.mutate()}
                disabled={markOverdue.isPending}
              >
                {markOverdue.isPending ? 'Updating…' : 'Mark overdue doses'}
              </Button>
            )}
            {hasPermission('health.vaccinations', 'create') && (
              <Button size="sm" asChild className="bg-teal-600 hover:bg-teal-700">
                <Link href="/health/vaccinations/new">
                  <Plus className="mr-1.5 h-4 w-4" />
                  Add vaccination
                </Link>
              </Button>
            )}
          </>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          accent="health"
          label="Compliance"
          value={stats.complianceRate ?? 0}
          format={(n) => `${Math.round(n)}%`}
          hint="Doses given on schedule"
        />
        <Stat accent="health" label="Doses given" value={stats.completedVaccinations ?? 0} />
        <Stat accent="health" label="Upcoming" value={stats.scheduledVaccinations ?? 0} />
        <Stat accent="health" label="Overdue" value={stats.overdueVaccinations ?? 0} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Panel bodyClassName="p-0">
          <div className="flex flex-wrap items-center gap-3 border-b border-border/70 px-5 py-3">
            <SearchBox
              value={search}
              onChange={(v) => (setSearch(v), setPage(1))}
              placeholder="Search by name or vaccine"
            />
            <div className="ml-auto">
              <Segmented<Show>
                value={show}
                onChange={(v) => (setShow(v), setPage(1))}
                options={[
                  { value: '', label: 'All' },
                  { value: 'scheduled', label: 'Upcoming' },
                  { value: 'overdue', label: 'Overdue' },
                  { value: 'completed', label: 'Given' },
                ]}
              />
            </div>
          </div>
          {isLoading ? (
            <Skeleton rows={10} />
          ) : rows.length === 0 ? (
            <Empty icon={Syringe} title="Nothing here" text="No vaccinations match this filter." />
          ) : (
            <>
              <Table head={['Person', 'Vaccine', 'Date', 'Status', '']}>
                {rows.map((v) => {
                  const pending = v.status === 'scheduled' || v.status === 'overdue';
                  return (
                    <tr
                      key={v._id}
                      onClick={() => router.push(`/health/vaccinations/${v._id}`)}
                      className="cursor-pointer transition-colors hover:bg-muted/40"
                    >
                      <Cell>
                        <PersonCell person={v.person ?? { name: v.personName }} />
                      </Cell>
                      <Cell>
                        <span className="block text-sm font-medium">{v.vaccineName}</span>
                        <span className="block text-xs text-muted-foreground">
                          Dose {v.doseNumber}
                          {v.totalDoses ? ` of ${v.totalDoses}` : ''}
                          {v.manufacturer ? ` · ${v.manufacturer}` : ''}
                        </span>
                      </Cell>
                      <Cell className="whitespace-nowrap text-sm text-muted-foreground">
                        {fmtDate(v.administeredDate ?? v.scheduledDate)}
                      </Cell>
                      <Cell>
                        <StatusPill status={v.status} />
                      </Cell>
                      <Cell last>
                        {pending && canEdit ? (
                          <span onClick={(e) => e.stopPropagation()}>
                            <Button variant="outline" size="sm" className="h-7" asChild>
                              <Link href={`/health/vaccinations/${v._id}/administer`}>
                                Record dose
                              </Link>
                            </Button>
                          </span>
                        ) : null}
                      </Cell>
                    </tr>
                  );
                })}
              </Table>
              <Pager page={page} total={total} limit={LIMIT} onPage={setPage} />
            </>
          )}
        </Panel>

        <Panel title="Coverage by vaccine">
          {coverage.length ? (
            <ul className="space-y-3.5">
              {coverage.map((c) => (
                <li key={c.name}>
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="truncate">{c.name}</span>
                    <span className="tabular-nums text-muted-foreground">{c.rate}%</span>
                  </div>
                  <Meter
                    value={c.rate}
                    color={c.rate >= 75 ? ACCENT.health.hex : '#f59e0b'}
                    className="mt-1.5"
                  />
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {c.completed} of {c.total} doses
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No vaccines recorded yet.</p>
          )}
        </Panel>
      </div>
    </>
  );
}
