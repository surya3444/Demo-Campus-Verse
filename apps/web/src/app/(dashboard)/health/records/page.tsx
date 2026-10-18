'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ChevronRight, FileHeart, Plus } from 'lucide-react';
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
  useDebounced,
  type Person,
} from '@/components/connect/kit';

interface HealthRecord {
  _id: string;
  personName: string;
  personType: 'student' | 'staff';
  bloodGroup?: string;
  bmi?: number;
  allergies?: Array<{ name: string; severity?: string }>;
  conditions?: Array<{ name: string; status?: string }>;
  lastCheckupDate?: string;
  hasOverdueVaccinations?: boolean;
  person?: Person | null;
}

type Who = 'all' | 'student' | 'staff';
type Flag = '' | 'allergies' | 'conditions';
const LIMIT = 20;

export default function HealthRecordsPage() {
  const router = useRouter();
  const { hasPermission } = usePermissions();
  const [search, setSearch] = useState('');
  const [who, setWho] = useState<Who>('all');
  const [flag, setFlag] = useState<Flag>('');
  const [page, setPage] = useState(1);
  const q = useDebounced(search);

  const { data, isLoading } = useQuery({
    queryKey: ['health-records', q, who, flag, page],
    queryFn: () =>
      healthApi.getRecords({
        search: q || undefined,
        personType: who === 'all' ? undefined : who,
        ...(flag === 'allergies' && { hasAllergies: true }),
        ...(flag === 'conditions' && { hasConditions: true }),
        page,
        limit: LIMIT,
      } as Parameters<typeof healthApi.getRecords>[0]),
    placeholderData: (prev) => prev,
  });
  const { data: statsData } = useQuery({
    queryKey: ['health-records-stats'],
    queryFn: () => healthApi.getRecordStats(),
  });
  const stats = (statsData?.data ?? {}) as {
    totalRecords?: number;
    studentRecords?: number;
    staffRecords?: number;
    recordsWithAllergies?: number;
    alertCounts?: { vaccinationOverdue?: number };
  };
  const records = (data?.data ?? []) as HealthRecord[];
  const total = (data?.meta as { total?: number } | undefined)?.total ?? 0;

  return (
    <>
      <PageTitle
        title="Health records"
        description="Medical history, allergies and check-ups for every student and staff member."
        actions={
          hasPermission('health.records', 'create') ? (
            <Button size="sm" asChild>
              <Link href="/health/records/new">
                <Plus className="mr-1.5 h-4 w-4" />
                New record
              </Link>
            </Button>
          ) : null
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          accent="health"
          label="Records on file"
          value={stats.totalRecords ?? 0}
          hint={`${stats.studentRecords ?? 0} students · ${stats.staffRecords ?? 0} staff`}
        />
        <Stat
          accent="health"
          label="With allergies"
          value={stats.recordsWithAllergies ?? 0}
          hint="Shown to the sick room on every visit"
        />
        <Stat accent="health" label="Students covered" value={stats.studentRecords ?? 0} />
        <Stat
          accent="health"
          label="Vaccinations overdue"
          value={stats.alertCounts?.vaccinationOverdue ?? 0}
        />
      </div>

      <Panel bodyClassName="p-0">
        <div className="flex flex-wrap items-center gap-3 border-b border-border/70 px-5 py-3">
          <SearchBox
            value={search}
            onChange={(v) => (setSearch(v), setPage(1))}
            placeholder="Search by name"
          />
          <Segmented<Flag>
            value={flag}
            onChange={(v) => (setFlag(v), setPage(1))}
            options={[
              { value: '', label: 'All records' },
              { value: 'allergies', label: 'Allergies' },
              { value: 'conditions', label: 'Conditions' },
            ]}
          />
          <div className="ml-auto">
            <Segmented<Who>
              value={who}
              onChange={(v) => (setWho(v), setPage(1))}
              options={[
                { value: 'all', label: 'Everyone' },
                { value: 'student', label: 'Students' },
                { value: 'staff', label: 'Staff' },
              ]}
            />
          </div>
        </div>

        {isLoading ? (
          <Skeleton rows={10} />
        ) : records.length === 0 ? (
          <Empty icon={FileHeart} title="No records match" text="Try another name or filter." />
        ) : (
          <>
            <Table
              head={['Person', 'Blood group', 'Allergies & conditions', 'BMI', 'Last check-up', '']}
            >
              {records.map((r) => {
                const flags = [
                  ...(r.allergies ?? []).map((a) => ({ label: a.name, tone: 'red' as const })),
                  ...(r.conditions ?? []).map((c) => ({ label: c.name, tone: 'amber' as const })),
                ];
                return (
                  <tr
                    key={r._id}
                    onClick={() => router.push(`/health/records/${r._id}`)}
                    className="cursor-pointer transition-colors hover:bg-muted/40"
                  >
                    <Cell>
                      <PersonCell
                        person={r.person ?? { name: r.personName }}
                        sub={
                          r.personType === 'staff' ? r.person?.designation || 'Staff' : undefined
                        }
                      />
                    </Cell>
                    <Cell>
                      {r.bloodGroup ? (
                        <span className="inline-flex min-w-9 justify-center rounded-md bg-rose-50 px-1.5 py-0.5 text-xs font-semibold text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
                          {r.bloodGroup}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </Cell>
                    <Cell>
                      {flags.length ? (
                        <div className="flex max-w-xs flex-wrap gap-1">
                          {flags.slice(0, 3).map((f) => (
                            <Pill key={f.label} tone={f.tone}>
                              {f.label}
                            </Pill>
                          ))}
                          {flags.length > 3 && (
                            <span className="text-xs text-muted-foreground">
                              +{flags.length - 3}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">None recorded</span>
                      )}
                    </Cell>
                    <Cell className="tabular-nums">{r.bmi ? r.bmi.toFixed(1) : '—'}</Cell>
                    <Cell>
                      <span className="text-sm text-muted-foreground">
                        {fmtDate(r.lastCheckupDate)}
                      </span>
                      {r.hasOverdueVaccinations && (
                        <span className="mt-0.5 flex items-center gap-1 text-xs text-rose-600">
                          <AlertTriangle className="h-3 w-3" /> Vaccination overdue
                        </span>
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
