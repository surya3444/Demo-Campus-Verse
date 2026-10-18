'use client';

import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { toast } from 'sonner';
import { AlertTriangle, BellRing, CheckCircle2, Stethoscope } from 'lucide-react';
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
  fmtDate,
  fmtTime,
  type Person,
} from '@/components/connect/kit';

interface Visit {
  _id: string;
  healthRecordId: string;
  personType: string;
  personId: string;
  personName: string;
  visitType: string;
  visitDate: string;
  arrivalTime?: string;
  departureTime?: string;
  chiefComplaint: string;
  symptoms?: string[];
  painLevel?: number;
  vitals?: {
    temperatureCelsius?: number;
    pulseRate?: number;
    bloodPressureSystolic?: number;
    bloodPressureDiastolic?: number;
    oxygenSaturation?: number;
    respiratoryRate?: number;
  };
  diagnosis?: string;
  treatment?: string;
  medicationsGiven?: Array<{ name: string; dosage?: string }>;
  isIncident?: boolean;
  incidentLocation?: string;
  incidentDescription?: string;
  outcome?: string;
  outcomeNotes?: string;
  followUpRequired?: boolean;
  followUpDate?: string;
  followUpInstructions?: string;
  parentNotified?: boolean;
  parentNotifiedAt?: string;
  attendedByName?: string;
  status: string;
  notes?: string;
  person?: Person | null;
}

const OUTCOME: Record<string, { label: string; tone: 'green' | 'amber' | 'violet' | 'blue' | 'red' }> = {
  returned_to_class: { label: 'Back in class', tone: 'green' },
  sent_home: { label: 'Sent home', tone: 'amber' },
  referred: { label: 'Referred to hospital', tone: 'violet' },
  under_observation: { label: 'Under observation', tone: 'blue' },
  hospitalized: { label: 'Hospitalised', tone: 'red' },
};

export default function VisitDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const canEdit = hasPermission('health.visits', 'edit');

  const { data, isLoading } = useQuery({
    queryKey: ['health-visit', id],
    queryFn: () => healthApi.getVisit(id),
  });
  const v = data?.data as Visit | undefined;
  const { data: recordData } = useQuery({
    queryKey: ['health-record', v?.healthRecordId],
    queryFn: () => healthApi.getRecord(v!.healthRecordId),
    enabled: !!v?.healthRecordId,
  });
  const notify = useMutation({
    mutationFn: () => healthApi.notifyParent(id),
    onSuccess: () => {
      toast.success('Marked as informed');
      queryClient.invalidateQueries({ queryKey: ['health-visit', id] });
    },
    onError: () => toast.error('Could not update'),
  });

  if (isLoading) return <Skeleton rows={10} />;
  if (!v) return <Empty icon={Stethoscope} title="Visit not found" />;

  const record = recordData?.data as
    | { allergies?: Array<{ name: string; severity?: string }>; bloodGroup?: string; conditions?: Array<{ name: string }> }
    | undefined;
  const open = v.status === 'in_progress';
  const o = OUTCOME[v.outcome ?? ''];
  const vit = v.vitals ?? {};
  const vitals: Array<[string, string | null, boolean]> = [
    ['Temperature', vit.temperatureCelsius ? `${vit.temperatureCelsius} °C` : null, (vit.temperatureCelsius ?? 0) >= 37.8],
    ['Pulse', vit.pulseRate ? `${vit.pulseRate} bpm` : null, (vit.pulseRate ?? 0) > 100],
    [
      'Blood pressure',
      vit.bloodPressureSystolic ? `${vit.bloodPressureSystolic}/${vit.bloodPressureDiastolic}` : null,
      (vit.bloodPressureSystolic ?? 0) >= 140,
    ],
    ['SpO₂', vit.oxygenSaturation ? `${vit.oxygenSaturation}%` : null, (vit.oxygenSaturation ?? 100) < 95],
  ];
  const minutes =
    v.departureTime && v.arrivalTime
      ? Math.round((new Date(v.departureTime).getTime() - new Date(v.arrivalTime).getTime()) / 60000)
      : null;

  return (
    <>
      <PageTitle
        crumbs={[{ label: 'Sick-room visits', href: '/health/visits' }, { label: v.personName }]}
        title={v.chiefComplaint}
        description={`${fmtDate(v.visitDate, { weekday: 'long', day: 'numeric', month: 'long' })} · arrived ${fmtTime(v.arrivalTime ?? v.visitDate)}${v.attendedByName ? ` · seen by ${v.attendedByName}` : ''}`}
        actions={
          <>
            {open ? <Pill tone="red">In sick room</Pill> : o ? <Pill tone={o.tone}>{o.label}</Pill> : null}
            {canEdit && !v.parentNotified && v.personType === 'student' && (
              <Button size="sm" variant="outline" onClick={() => notify.mutate()} disabled={notify.isPending}>
                <BellRing className="mr-1.5 h-4 w-4" />
                Mark parent informed
              </Button>
            )}
            {canEdit && open && (
              <Button size="sm" asChild>
                <Link href={`/health/visits/${id}/close`}>Close visit</Link>
              </Button>
            )}
          </>
        }
      />

      {record?.allergies?.length ? (
        <div className="mb-6 flex items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>
            <span className="font-semibold">Allergies:</span>{' '}
            {record.allergies.map((a) => `${a.name}${a.severity ? ` (${a.severity})` : ''}`).join(', ')}
          </span>
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {vitals.map(([label, value, high]) => (
              <div
                key={label}
                className="rounded-xl border bg-card p-4 shadow-xs"
              >
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className={`mt-1 text-xl font-semibold tabular-nums ${high ? 'text-rose-600' : ''}`}>
                  {value ?? <span className="text-muted-foreground/60">—</span>}
                </p>
              </div>
            ))}
          </div>

          <Panel title="Assessment">
            <div className="space-y-5">
              <div>
                <p className="text-xs text-muted-foreground">Symptoms</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {(v.symptoms ?? []).length ? (
                    v.symptoms!.map((s) => (
                      <Pill key={s} tone="gray" dot={false}>
                        {s}
                      </Pill>
                    ))
                  ) : (
                    <span className="text-sm text-muted-foreground">Not recorded</span>
                  )}
                  {v.painLevel ? (
                    <Pill tone={v.painLevel >= 7 ? 'red' : 'amber'} dot={false}>
                      Pain {v.painLevel}/10
                    </Pill>
                  ) : null}
                </div>
              </div>
              <KeyValue
                cols={2}
                items={[
                  ['Diagnosis', v.diagnosis || (open ? 'Pending' : '—')],
                  ['Treatment', v.treatment || (open ? 'In progress' : '—')],
                  ...(v.medicationsGiven?.length
                    ? [['Medication', v.medicationsGiven.map((m) => `${m.name}${m.dosage ? ` ${m.dosage}` : ''}`).join(', ')] as [string, string]]
                    : []),
                  ...(v.notes ? [['Notes', v.notes] as [string, string]] : []),
                ]}
              />
            </div>
          </Panel>

          {v.isIncident && (
            <Panel title="Incident" description="Logged for the safety register">
              <KeyValue
                cols={2}
                items={[
                  ['Where', v.incidentLocation || '—'],
                  ['What happened', v.incidentDescription || '—'],
                ]}
              />
            </Panel>
          )}

          {!open && (
            <Panel title="Outcome">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" />
                <div className="space-y-1 text-sm">
                  <p className="font-medium">
                    {o?.label ?? 'Closed'}
                    {v.departureTime ? ` at ${fmtTime(v.departureTime)}` : ''}
                    {minutes ? <span className="font-normal text-muted-foreground"> · {minutes} min in the sick room</span> : null}
                  </p>
                  {v.outcomeNotes && <p className="text-muted-foreground">{v.outcomeNotes}</p>}
                  {v.followUpRequired && (
                    <p className="text-amber-700">
                      Follow-up {v.followUpDate ? `on ${fmtDate(v.followUpDate)}` : 'needed'}
                      {v.followUpInstructions ? ` — ${v.followUpInstructions}` : ''}
                    </p>
                  )}
                </div>
              </div>
            </Panel>
          )}
        </div>

        <div className="space-y-6">
          <div className="rounded-xl border bg-card p-5 text-center shadow-xs">
            <Avatar person={v.person ?? { name: v.personName }} size={72} className="mx-auto" />
            <p className="mt-3 font-semibold">{v.person?.name ?? v.personName}</p>
            <p className="text-sm text-muted-foreground">
              {v.person?.program ?? v.person?.designation ?? (v.personType === 'staff' ? 'Staff' : 'Student')}
            </p>
            {record?.bloodGroup && (
              <span className="mt-3 inline-flex rounded-md bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
                {record.bloodGroup}
              </span>
            )}
            <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
              <Button variant="outline" size="sm" asChild>
                <Link href={`/health/records/${v.healthRecordId}`}>Health record</Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link href={`/health/visits?personId=${v.personId}`}>All visits</Link>
              </Button>
            </div>
          </div>
          <Panel title="Visit">
            <KeyValue
              cols={1}
              items={[
                ['Type', <span key="t" className="capitalize">{v.visitType.replace('-', ' ')}</span>],
                ['Arrived', fmtTime(v.arrivalTime ?? v.visitDate)],
                ['Left', v.departureTime ? fmtTime(v.departureTime) : open ? 'Still here' : '—'],
                ['Parent informed', v.parentNotified ? `Yes${v.parentNotifiedAt ? `, ${fmtTime(v.parentNotifiedAt)}` : ''}` : 'Not yet'],
              ]}
            />
          </Panel>
          {record?.conditions?.length ? (
            <Panel title="Known conditions">
              <div className="flex flex-wrap gap-1.5">
                {record.conditions.map((c) => (
                  <Pill key={c.name} tone="amber">
                    {c.name}
                  </Pill>
                ))}
              </div>
            </Panel>
          ) : null}
        </div>
      </div>
    </>
  );
}
