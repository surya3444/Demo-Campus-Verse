'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { ClipboardCheck, Ear, Eye, Smile } from 'lucide-react';
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

interface Exam {
  result?: string;
  leftEye?: string;
  rightEye?: string;
  notes?: string;
  findings?: string[];
}
interface Checkup {
  _id: string;
  healthRecordId: string;
  personId: string;
  personName: string;
  personType: string;
  campaignId?: string;
  checkupType: string;
  checkupDate: string;
  status: string;
  vitals?: {
    heightCm?: number;
    weightKg?: number;
    bmi?: number;
    bloodPressureSystolic?: number;
    bloodPressureDiastolic?: number;
    pulseRate?: number;
    temperatureCelsius?: number;
    oxygenSaturation?: number;
  };
  visionExam?: Exam | null;
  hearingExam?: Exam | null;
  dentalExam?: Exam | null;
  findings?: string[];
  recommendations?: string[];
  followUpRequired?: boolean;
  followUpDate?: string;
  examinerName?: string;
  person?: Person | null;
}

const bmiBand = (b: number) =>
  b < 18.5
    ? { label: 'Underweight', tone: 'amber' as const }
    : b < 25
      ? { label: 'Healthy', tone: 'green' as const }
      : b < 30
        ? { label: 'Overweight', tone: 'amber' as const }
        : { label: 'Obese', tone: 'red' as const };

export default function CheckupDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { hasPermission } = usePermissions();
  const { data, isLoading } = useQuery({
    queryKey: ['health-checkup', id],
    queryFn: () => healthApi.getCheckup(id),
  });

  if (isLoading) return <Skeleton rows={10} />;
  const c = data?.data as Checkup | undefined;
  if (!c) return <Empty icon={ClipboardCheck} title="Check-up not found" />;

  const v = c.vitals ?? {};
  const done = c.status === 'completed';
  const band = v.bmi ? bmiBand(v.bmi) : null;
  const tiles: Array<[string, string | null, string?]> = [
    ['Height', v.heightCm ? `${v.heightCm} cm` : null],
    ['Weight', v.weightKg ? `${v.weightKg} kg` : null],
    ['BMI', v.bmi ? v.bmi.toFixed(1) : null, band?.label],
    ['Blood pressure', v.bloodPressureSystolic ? `${v.bloodPressureSystolic}/${v.bloodPressureDiastolic}` : null, 'mmHg'],
    ['Pulse', v.pulseRate ? `${v.pulseRate}` : null, 'bpm'],
    ['SpO₂', v.oxygenSaturation ? `${v.oxygenSaturation}%` : null],
  ];
  const exams: Array<[string, typeof Eye, Exam | null | undefined, string?]> = [
    ['Vision', Eye, c.visionExam, c.visionExam?.leftEye ? `L ${c.visionExam.leftEye} · R ${c.visionExam.rightEye}` : undefined],
    ['Hearing', Ear, c.hearingExam],
    ['Dental', Smile, c.dentalExam],
  ];

  return (
    <>
      <PageTitle
        crumbs={[{ label: 'Check-ups', href: '/health/checkups' }, { label: c.personName }]}
        title={`${c.checkupType.charAt(0).toUpperCase()}${c.checkupType.slice(1).replace('-', ' ')} check-up`}
        description={`${c.person?.name ?? c.personName} · ${fmtDate(c.checkupDate, { weekday: 'long', day: 'numeric', month: 'long' })}${c.examinerName ? ` · examined by ${c.examinerName}` : ''}`}
        actions={
          <>
            <StatusPill status={c.status} />
            {!done && hasPermission('health.checkups', 'edit') && (
              <Button size="sm" asChild>
                <Link href={`/health/checkups/${id}/complete`}>Record results</Link>
              </Button>
            )}
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-6">
          {done ? (
            <>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
                {tiles.map(([label, value, sub]) => (
                  <div
                    key={label}
                    className="rounded-xl border bg-card p-4 shadow-xs"
                  >
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="mt-1 text-xl font-semibold tabular-nums">
                      {value ?? <span className="text-muted-foreground/60">—</span>}
                    </p>
                    {value && sub ? <p className="text-xs text-muted-foreground">{sub}</p> : null}
                  </div>
                ))}
              </div>

              <Panel title="Screenings">
                <ul className="divide-y divide-border/60">
                  {exams.map(([label, Icon, exam, detail]) => (
                    <li key={label} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-success/10 text-success  ">
                        <Icon className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{label}</p>
                        {detail && <p className="text-xs text-muted-foreground">{detail}</p>}
                      </div>
                      {exam?.result ? (
                        <Pill tone={exam.result === 'normal' ? 'green' : 'amber'} className="capitalize">
                          {exam.result.replace('_', ' ')}
                        </Pill>
                      ) : (
                        <span className="text-sm text-muted-foreground">Not done</span>
                      )}
                    </li>
                  ))}
                </ul>
              </Panel>

              <Panel title="Findings & advice">
                <div className="grid gap-6 md:grid-cols-2">
                  <div>
                    <p className="mb-2 text-xs text-muted-foreground">Findings</p>
                    <ul className="space-y-1.5 text-sm">
                      {(c.findings?.length ? c.findings : ['Nothing of note']).map((f) => (
                        <li key={f}>{f}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="mb-2 text-xs text-muted-foreground">Recommendations</p>
                    <ul className="space-y-1.5 text-sm">
                      {(c.recommendations?.length ? c.recommendations : ['—']).map((r) => (
                        <li key={r}>{r}</li>
                      ))}
                    </ul>
                  </div>
                </div>
                {c.followUpRequired && (
                  <p className="mt-5 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
                    Follow-up {c.followUpDate ? `on ${fmtDate(c.followUpDate)}` : 'needed'}
                  </p>
                )}
              </Panel>
            </>
          ) : (
            <Panel>
              <Empty
                icon={ClipboardCheck}
                title="Results not recorded yet"
                text={`Scheduled for ${fmtDate(c.checkupDate)}.`}
              />
            </Panel>
          )}
        </div>

        <div className="space-y-6">
          <div className="rounded-xl border bg-card p-5 text-center shadow-xs">
            <Avatar person={c.person ?? { name: c.personName }} size={72} className="mx-auto" />
            <p className="mt-3 font-semibold">{c.person?.name ?? c.personName}</p>
            <p className="text-sm text-muted-foreground">
              {c.person?.program ?? c.person?.designation ?? c.personType}
            </p>
            <Button variant="outline" size="sm" className="mt-4" asChild>
              <Link href={`/health/records/${c.healthRecordId}`}>Open health record</Link>
            </Button>
          </div>
          <Panel title="Details">
            <KeyValue
              cols={1}
              items={[
                ['Type', <span key="t" className="capitalize">{c.checkupType.replace('-', ' ')}</span>],
                ['Date', fmtDate(c.checkupDate)],
                ...(c.campaignId
                  ? [[
                      'Campaign',
                      <Link key="c" href={`/health/checkups/campaigns/${c.campaignId}`} className="text-success hover:underline">
                        View campaign
                      </Link>,
                    ] as [string, React.ReactNode]]
                  : []),
              ]}
            />
          </Panel>
        </div>
      </div>
    </>
  );
}
