'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  AlertTriangle,
  ClipboardCheck,
  Edit,
  FileHeart,
  Phone,
  Pill as PillIcon,
  Stethoscope,
  Syringe,
} from 'lucide-react';
import { healthApi } from '@/lib/api';
import { usePermissions } from '@/hooks/usePermissions';
import { Button } from '@/components/ui/button';
import {
  Avatar,
  Empty,
  KeyValue,
  PageTitle,
  Panel,
  Pill,
  Skeleton,
  StatusPill,
  fmtDate,
  type Person,
} from '@/components/connect/kit';

interface HealthRecordDetail {
  _id: string;
  personId: string;
  personType: 'student' | 'staff';
  personName: string;
  dateOfBirth?: string;
  gender?: string;
  bloodGroup?: string;
  heightCm?: number;
  weightKg?: number;
  bmi?: number;
  allergies?: Array<{ name: string; category?: string; severity?: string; symptoms?: string[] }>;
  conditions?: Array<{ name: string; status?: string; diagnosedDate?: string }>;
  currentMedications?: Array<{ name: string; dosage: string; frequency: string; reason?: string }>;
  disabilities?: Array<{ type?: string; description?: string }>;
  emergencyContacts?: Array<{ name: string; relation: string; phone: string; isPrimary?: boolean }>;
  insurance?: { provider?: string; policyNumber?: string; validTo?: string };
  lastCheckupDate?: string;
  hasOverdueVaccinations?: boolean;
  notes?: string;
  person?: (Person & { rollNumber?: string | null }) | null;
}
interface Visit {
  _id: string;
  visitDate: string;
  chiefComplaint: string;
  visitType: string;
  status: string;
  outcome?: string;
  diagnosis?: string;
}
interface Checkup {
  _id: string;
  checkupDate: string;
  checkupType: string;
  status: string;
  vitals?: {
    heightCm?: number;
    weightKg?: number;
    bmi?: number;
    bloodPressureSystolic?: number;
    bloodPressureDiastolic?: number;
  };
  findings?: string[];
}
interface Vaccination {
  _id: string;
  vaccineName: string;
  doseNumber: number;
  totalDoses?: number;
  status: string;
  administeredDate?: string;
  scheduledDate?: string;
}

const SEVERITY: Record<string, 'red' | 'amber' | 'gray'> = {
  severe: 'red',
  life_threatening: 'red',
  moderate: 'amber',
  mild: 'gray',
};
const age = (dob?: string) =>
  dob ? Math.floor((Date.now() - +new Date(dob)) / 31_557_600_000) : null;
const list = <T,>(r: { data?: unknown } | undefined) => (r?.data ?? []) as T[];

export default function HealthRecordDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { hasPermission } = usePermissions();
  const { data, isLoading } = useQuery({
    queryKey: ['health-record', id],
    queryFn: () => healthApi.getRecord(id),
  });
  const record = data?.data as HealthRecordDetail | undefined;
  const personId = record?.personId;
  const visits = useQuery({
    queryKey: ['record-visits', personId],
    queryFn: () => healthApi.getVisits({ personId, limit: 8 }),
    enabled: !!personId,
  });
  const checkups = useQuery({
    queryKey: ['record-checkups', personId],
    queryFn: () => healthApi.getCheckups({ personId, limit: 5 }),
    enabled: !!personId,
  });
  const vaccines = useQuery({
    queryKey: ['record-vaccines', personId],
    queryFn: () => healthApi.getVaccinations({ personId, limit: 20 }),
    enabled: !!personId,
  });

  if (isLoading) {
    return (
      <Panel>
        <Skeleton rows={6} />
      </Panel>
    );
  }
  if (!record) return <Empty icon={FileHeart} title="Health record not found" />;

  const p = record.person;
  const qs = `personId=${record.personId}&personType=${record.personType}&healthRecordId=${id}`;
  const lastCheck = list<Checkup>(checkups.data).find((c) => c.status === 'completed');
  const bmi = record.bmi ?? lastCheck?.vitals?.bmi;
  const years = age(record.dateOfBirth);

  return (
    <div className="space-y-6">
      <PageTitle
        crumbs={[
          { label: 'Health records', href: '/health/records' },
          { label: record.personName },
        ]}
        title={record.personName}
        description={[
          p?.program ?? (record.personType === 'staff' ? p?.designation || 'Staff' : 'Student'),
          p?.section && `Section ${p.section}`,
          years && `${years} years`,
          record.gender,
        ]
          .filter(Boolean)
          .join(' · ')}
        actions={
          <>
            {hasPermission('health.visits', 'create') && (
              <Button variant="outline" size="sm" asChild>
                <Link href={`/health/visits/new?${qs}`}>
                  <Stethoscope className="mr-1.5 h-4 w-4" />
                  Log visit
                </Link>
              </Button>
            )}
            {hasPermission('health.records', 'edit') && (
              <Button size="sm" asChild>
                <Link href={`/health/records/${id}/edit`}>
                  <Edit className="mr-1.5 h-4 w-4" />
                  Edit record
                </Link>
              </Button>
            )}
          </>
        }
      />

      {(record.allergies?.length ?? 0) > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-rose-200 bg-rose-50/70 px-4 py-3 dark:border-rose-500/30 dark:bg-rose-500/10">
          <AlertTriangle className="h-4 w-4 text-rose-600" />
          <span className="text-sm font-medium text-rose-800 dark:text-rose-200">Allergies:</span>
          {record.allergies!.map((a) => (
            <Pill key={a.name} tone={SEVERITY[a.severity ?? ''] ?? 'red'}>
              {a.name}
              {a.severity ? ` · ${a.severity.replace(/_/g, ' ')}` : ''}
            </Pill>
          ))}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="space-y-6">
          <Panel>
            <div className="flex items-center gap-4">
              <Avatar person={{ name: record.personName, photo: p?.photo }} size={64} />
              <div className="min-w-0">
                <p className="truncate text-base font-semibold">{record.personName}</p>
                <p className="truncate text-sm text-muted-foreground">
                  {p?.rollNumber
                    ? `Roll ${p.rollNumber}`
                    : record.personType === 'staff'
                      ? 'Staff'
                      : 'Student'}
                </p>
              </div>
            </div>
            <div className="mt-5 grid grid-cols-3 divide-x divide-border/70 rounded-xl border text-center">
              {[
                ['Blood', record.bloodGroup ?? '—'],
                ['BMI', bmi ? bmi.toFixed(1) : '—'],
                [
                  'Height',
                  (record.heightCm ?? lastCheck?.vitals?.heightCm)
                    ? `${record.heightCm ?? lastCheck?.vitals?.heightCm} cm`
                    : '—',
                ],
              ].map(([k, v]) => (
                <div key={k} className="py-2.5">
                  <p className="text-sm font-semibold tabular-nums">{v}</p>
                  <p className="text-[11px] text-muted-foreground">{k}</p>
                </div>
              ))}
            </div>
            <div className="mt-5">
              <KeyValue
                cols={1}
                items={[
                  ['Date of birth', fmtDate(record.dateOfBirth)],
                  ['Last check-up', fmtDate(record.lastCheckupDate ?? lastCheck?.checkupDate)],
                  [
                    'Insurance',
                    record.insurance?.provider
                      ? `${record.insurance.provider}${record.insurance.policyNumber ? ` · ${record.insurance.policyNumber}` : ''}`
                      : '—',
                  ],
                ]}
              />
            </div>
          </Panel>

          <Panel title="Emergency contacts">
            {record.emergencyContacts?.length ? (
              <ul className="space-y-3">
                {record.emergencyContacts.map((c) => (
                  <li key={c.phone} className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {c.name}{' '}
                        {c.isPrimary && (
                          <span className="text-xs font-normal text-muted-foreground">
                            · primary
                          </span>
                        )}
                      </p>
                      <p className="text-xs capitalize text-muted-foreground">{c.relation}</p>
                    </div>
                    <a
                      href={`tel:${c.phone}`}
                      className="text-sm tabular-nums text-success hover:underline "
                    >
                      {c.phone}
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No emergency contacts added.</p>
            )}
          </Panel>

          {record.conditions?.length || record.currentMedications?.length ? (
            <Panel title="Conditions & medication">
              <ul className="space-y-3 text-sm">
                {record.conditions?.map((c) => (
                  <li key={c.name} className="flex items-center justify-between gap-2">
                    <span>{c.name}</span>
                    {c.status && <StatusPill status={c.status} />}
                  </li>
                ))}
                {record.currentMedications?.map((m) => (
                  <li key={m.name} className="flex items-start gap-2">
                    <PillIcon className="mt-0.5 h-4 w-4 text-success" />
                    <span>
                      <span className="font-medium">{m.name}</span>
                      <span className="block text-xs text-muted-foreground">
                        {m.dosage} · {m.frequency}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </Panel>
          ) : null}
        </aside>

        <div className="space-y-6">
          <Panel
            title="Sick-room visits"
            action={
              <Link
                href={`/health/visits?personId=${record.personId}`}
                className="text-sm font-medium text-success hover:underline "
              >
                All
              </Link>
            }
            bodyClassName="px-0 pb-2"
          >
            {list<Visit>(visits.data).length ? (
              <ul className="divide-y divide-border/60">
                {list<Visit>(visits.data).map((v) => (
                  <li key={v._id}>
                    <Link
                      href={`/health/visits/${v._id}`}
                      className="flex items-center gap-4 px-5 py-3 hover:bg-muted/40"
                    >
                      <span className="w-20 shrink-0 text-xs tabular-nums text-muted-foreground">
                        {fmtDate(v.visitDate, { day: 'numeric', month: 'short' })}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{v.chiefComplaint}</p>
                        {v.diagnosis && (
                          <p className="truncate text-xs text-muted-foreground">{v.diagnosis}</p>
                        )}
                      </div>
                      <StatusPill
                        status={
                          v.status === 'in_progress' ? 'in_progress' : (v.outcome ?? v.status)
                        }
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty icon={Activity} title="No sick-room visits" />
            )}
          </Panel>

          <div className="grid gap-6 xl:grid-cols-2">
            <Panel
              title="Check-ups"
              action={
                hasPermission('health.checkups', 'create') ? (
                  <Link
                    href={`/health/checkups/new?${qs}`}
                    className="text-sm font-medium text-success hover:underline "
                  >
                    Schedule
                  </Link>
                ) : null
              }
            >
              {list<Checkup>(checkups.data).length ? (
                <ul className="space-y-4">
                  {list<Checkup>(checkups.data).map((c) => (
                    <li key={c._id}>
                      <Link href={`/health/checkups/${c._id}`} className="block hover:opacity-80">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium capitalize">
                            {c.checkupType} check-up
                          </span>
                          <StatusPill status={c.status} />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {fmtDate(c.checkupDate)}
                          {c.vitals?.bmi ? ` · BMI ${c.vitals.bmi}` : ''}
                          {c.vitals?.bloodPressureSystolic
                            ? ` · BP ${c.vitals.bloodPressureSystolic}/${c.vitals.bloodPressureDiastolic}`
                            : ''}
                        </p>
                        {c.findings?.length ? (
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {c.findings.join(' · ')}
                          </p>
                        ) : null}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <Empty icon={ClipboardCheck} title="No check-ups yet" />
              )}
            </Panel>

            <Panel
              title="Vaccinations"
              action={
                hasPermission('health.vaccinations', 'create') ? (
                  <Link
                    href={`/health/vaccinations/new?${qs}`}
                    className="text-sm font-medium text-success hover:underline "
                  >
                    Add
                  </Link>
                ) : null
              }
            >
              {list<Vaccination>(vaccines.data).length ? (
                <ul className="space-y-3">
                  {list<Vaccination>(vaccines.data).map((v) => (
                    <li key={v._id} className="flex items-center justify-between gap-2">
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">{v.vaccineName}</span>
                        <span className="block text-xs text-muted-foreground">
                          Dose {v.doseNumber}
                          {v.totalDoses ? ` of ${v.totalDoses}` : ''} ·{' '}
                          {fmtDate(v.administeredDate ?? v.scheduledDate)}
                        </span>
                      </span>
                      <StatusPill status={v.status} />
                    </li>
                  ))}
                </ul>
              ) : (
                <Empty icon={Syringe} title="No vaccinations recorded" />
              )}
            </Panel>
          </div>

          {record.notes && (
            <Panel title="Notes">
              <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                {record.notes}
              </p>
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}
