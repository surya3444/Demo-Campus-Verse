'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { Syringe } from 'lucide-react';
import { healthApi } from '@/lib/api';
import { usePermissions } from '@/hooks/usePermissions';
import { Button } from '@/components/ui/button';
import {
  Avatar,
  Empty,
  KeyValue,
  PageTitle,
  Panel,
  Skeleton,
  StatusPill,
  fmtDate,
  type Person,
} from '@/components/connect/kit';

interface Vaccination {
  _id: string;
  healthRecordId: string;
  personId: string;
  personName: string;
  personType: string;
  vaccineName: string;
  manufacturer?: string;
  batchNumber?: string;
  doseNumber: number;
  totalDoses?: number;
  scheduledDate?: string;
  administeredDate?: string;
  administeredBy?: string;
  administeredAt?: string;
  sideEffects?: string[];
  sideEffectSeverity?: string;
  nextDoseDate?: string;
  exemptionReason?: string;
  status: string;
  notes?: string;
  person?: Person | null;
}

export default function VaccinationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { hasPermission } = usePermissions();
  const { data, isLoading } = useQuery({
    queryKey: ['vaccination', id],
    queryFn: () => healthApi.getVaccination(id),
  });
  const v = data?.data as Vaccination | undefined;
  const { data: historyData } = useQuery({
    queryKey: ['vaccinations', 'person', v?.personId],
    queryFn: () => healthApi.getVaccinations({ personId: v!.personId, limit: 50 }),
    enabled: !!v?.personId,
  });

  if (isLoading) return <Skeleton rows={10} />;
  if (!v) return <Empty icon={Syringe} title="Vaccination not found" />;

  const given = v.status === 'completed';
  const pending = v.status === 'scheduled' || v.status === 'overdue';
  const history = ((historyData?.data ?? []) as Vaccination[]).sort(
    (a, b) =>
      new Date(a.administeredDate ?? a.scheduledDate ?? 0).getTime() -
      new Date(b.administeredDate ?? b.scheduledDate ?? 0).getTime()
  );
  const doses = Array.from({ length: Math.max(v.totalDoses ?? 1, v.doseNumber) }, (_, i) => i + 1);

  return (
    <>
      <PageTitle
        crumbs={[{ label: 'Vaccinations', href: '/health/vaccinations' }, { label: v.personName }]}
        title={v.vaccineName}
        description={`${v.person?.name ?? v.personName} · dose ${v.doseNumber}${v.totalDoses ? ` of ${v.totalDoses}` : ''}`}
        actions={
          <>
            <StatusPill status={v.status} />
            {pending && hasPermission('health.vaccinations', 'edit') && (
              <Button size="sm" asChild className="bg-teal-600 hover:bg-teal-700">
                <Link href={`/health/vaccinations/${id}/administer`}>Record dose</Link>
              </Button>
            )}
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-6">
          <Panel title="Course">
            <div className="flex items-center gap-2">
              {doses.map((d) => {
                const done = d < v.doseNumber || (d === v.doseNumber && given);
                const current = d === v.doseNumber;
                return (
                  <div key={d} className="flex-1">
                    <div
                      className={`h-2 rounded-full ${done ? 'bg-teal-600' : current && v.status === 'overdue' ? 'bg-rose-400' : current ? 'bg-teal-200' : 'bg-muted'}`}
                    />
                    <p className={`mt-2 text-xs ${current ? 'font-medium' : 'text-muted-foreground'}`}>Dose {d}</p>
                  </div>
                );
              })}
            </div>
            <div className="mt-6">
              {given ? (
                <KeyValue
                  cols={2}
                  items={[
                    ['Given on', fmtDate(v.administeredDate)],
                    ['Given at', v.administeredAt || 'Campus health centre'],
                    ['Batch', v.batchNumber || '—'],
                    ['Manufacturer', v.manufacturer || '—'],
                    ['Side effects', v.sideEffects?.length ? v.sideEffects.join(', ') : 'None reported'],
                    ['Next dose', v.nextDoseDate ? fmtDate(v.nextDoseDate) : 'Course complete'],
                  ]}
                />
              ) : v.status === 'exempt' ? (
                <KeyValue cols={1} items={[['Exemption', v.exemptionReason || '—']]} />
              ) : (
                <p className={`text-sm ${v.status === 'overdue' ? 'text-rose-600' : 'text-muted-foreground'}`}>
                  {v.status === 'overdue' ? 'Overdue — was due ' : 'Due '}
                  {fmtDate(v.scheduledDate, { weekday: 'long', day: 'numeric', month: 'long' })}
                </p>
              )}
              {v.notes && <p className="mt-4 text-sm text-muted-foreground">{v.notes}</p>}
            </div>
          </Panel>

          <Panel title="Vaccination history" description={`Everything on file for ${v.person?.name?.split(' ')[0] ?? v.personName}`} bodyClassName="p-0">
            <ul className="divide-y divide-border/60">
              {history.map((h) => (
                <li key={h._id}>
                  <Link
                    href={`/health/vaccinations/${h._id}`}
                    className={`flex items-center justify-between gap-3 px-5 py-3 text-sm transition-colors hover:bg-muted/40 ${h._id === v._id ? 'bg-teal-50/60 dark:bg-teal-500/5' : ''}`}
                  >
                    <span>
                      <span className="font-medium">{h.vaccineName}</span>
                      <span className="text-muted-foreground"> · dose {h.doseNumber}</span>
                    </span>
                    <span className="flex items-center gap-3">
                      <span className="text-muted-foreground">
                        {fmtDate(h.administeredDate ?? h.scheduledDate, { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                      <StatusPill status={h.status} />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Panel>
        </div>

        <div className="rounded-2xl border border-border/70 bg-card p-5 text-center shadow-[0_1px_2px_rgba(16,24,40,0.04)] xl:self-start">
          <Avatar person={v.person ?? { name: v.personName }} size={72} className="mx-auto" />
          <p className="mt-3 font-semibold">{v.person?.name ?? v.personName}</p>
          <p className="text-sm text-muted-foreground">
            {v.person?.program ?? v.person?.designation ?? v.personType}
          </p>
          <Button variant="outline" size="sm" className="mt-4" asChild>
            <Link href={`/health/records/${v.healthRecordId}`}>Open health record</Link>
          </Button>
        </div>
      </div>
    </>
  );
}
