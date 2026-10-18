'use client';

import { useQuery } from '@tanstack/react-query';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Download } from 'lucide-react';
import { healthApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import {
  ACCENT,
  Cell,
  ChartTip,
  Meter,
  PageTitle,
  Panel,
  Skeleton,
  Stat,
  Table,
} from '@/components/connect/kit';

const TEAL = ACCENT.health.hex;

interface Compliance {
  totalHealthRecords: number;
  vaccinationCompliance: Array<{ vaccineName: string; total: number; completed: number; overdue: number; complianceRate: number }>;
  checkupCompliance: { totalRecords: number; withRecentCheckup: number; complianceRate: number };
  dataCompleteness: { withAllergies: number; withEmergencyContacts: number; emergencyContactRate: number };
}
interface VisitStats {
  totalVisits: number;
  monthVisits: number;
  incidentCount: number;
  averageVisitDuration?: number;
  byType: Record<string, number>;
  byOutcome: Record<string, number>;
}

const OUTCOME: Record<string, string> = {
  returned_to_class: 'Back in class',
  sent_home: 'Sent home',
  referred: 'Referred',
  under_observation: 'Observation',
  hospitalized: 'Hospitalised',
};

function Bars({ items, color = TEAL }: { items: Array<{ name: string; value: number }>; color?: string }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <ul className="space-y-3">
      {items.map((i) => (
        <li key={i.name}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate">{i.name}</span>
            <span className="tabular-nums text-muted-foreground">{i.value}</span>
          </div>
          <Meter value={(i.value / max) * 100} color={color} className="mt-1.5" />
        </li>
      ))}
    </ul>
  );
}

export default function HealthReportsPage() {
  const { data: c } = useQuery({
    queryKey: ['health-compliance'],
    queryFn: () => healthApi.getComplianceReport(),
  });
  const { data: v } = useQuery({
    queryKey: ['health-visit-stats'],
    queryFn: () => healthApi.getVisitStats(),
  });
  const { data: k } = useQuery({
    queryKey: ['health-checkup-stats'],
    queryFn: () => healthApi.getCheckupStats(),
  });
  const { data: ins } = useQuery({
    queryKey: ['health-insights'],
    queryFn: () => healthApi.getReportInsights(),
  });

  const comp = c?.data as Compliance | undefined;
  const visits = v?.data as VisitStats | undefined;
  const checkups = k?.data as { averageBmi?: number; visionIssues?: number; referralsMade?: number } | undefined;
  const i = ins?.data;
  if (!comp || !visits || !i) return <Skeleton rows={12} />;

  const outcomes = Object.entries(visits.byOutcome ?? {})
    .map(([name, value]) => ({ name: OUTCOME[name] ?? name, value }))
    .sort((a, b) => b.value - a.value);
  const busiest = [...i.byHour].sort((a, b) => b.value - a.value)[0];

  const exportCsv = () => {
    const rows = [
      ['Section', 'Item', 'Value'],
      ['Check-ups', 'Records with a check-up this year', `${comp.checkupCompliance.withRecentCheckup} of ${comp.checkupCompliance.totalRecords}`],
      ...comp.vaccinationCompliance.map((x) => ['Vaccines', x.vaccineName, `${x.completed}/${x.total} (${x.complianceRate}%)`]),
      ...i.checkupCoverage.map((x) => ['Check-up coverage', x.name, `${x.completed}/${x.total} (${x.rate}%)`]),
      ...i.visitsByDepartment.map((x) => ['Visits by department', x.name, String(x.value)]),
      ...i.incidentsByLocation.map((x) => ['Incidents by place', x.name, String(x.value)]),
      ...i.allergies.map((x) => ['Allergies', x.name, String(x.value)]),
    ];
    const csv = rows.map((r) => r.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = 'health-report.csv';
    a.click();
  };

  return (
    <>
      <PageTitle
        title="Health reports"
        description="Compliance, patterns and risk across the campus — for the medical officer and the management."
        actions={
          <Button size="sm" variant="outline" onClick={exportCsv}>
            <Download className="mr-1.5 h-4 w-4" />
            Export CSV
          </Button>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          accent="health"
          label="Check-up coverage"
          value={comp.checkupCompliance.complianceRate}
          format={(n) => `${Math.round(n)}%`}
          hint={`${comp.checkupCompliance.withRecentCheckup} of ${comp.checkupCompliance.totalRecords} records this year`}
        />
        <Stat
          accent="health"
          label="Sick-room visits"
          value={visits.totalVisits}
          hint={`${visits.monthVisits} in the last 30 days`}
        />
        <Stat
          accent="health"
          label="Incidents"
          value={visits.incidentCount}
          hint="Injuries logged to the safety register"
        />
        <Stat
          accent="health"
          label="Average stay"
          value={visits.averageVisitDuration ?? 0}
          format={(n) => `${Math.round(n)} min`}
          hint={busiest?.value ? `Busiest around ${busiest.name}` : undefined}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Panel title="When students come in" description="Visits by arrival time" className="xl:col-span-2">
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={i.byHour} margin={{ top: 4, right: 4, left: -26, bottom: 0 }} barCategoryGap="30%">
                <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="2 4" />
                <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={11} tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis tickLine={false} axisLine={false} fontSize={11} allowDecimals={false} tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                <Tooltip content={<ChartTip />} cursor={{ fill: 'hsl(var(--muted))', opacity: 0.5 }} />
                <Bar dataKey="value" name="Visits" fill={TEAL} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel title="How visits ended">
          <Bars items={outcomes} />
        </Panel>

        <Panel title="Visits by department" description={`Students · plus ${i.staffVisits} staff visits`}>
          <Bars items={i.visitsByDepartment} />
        </Panel>
        <Panel title="Where incidents happen" description="Plan first-aid kits and supervision">
          <Bars items={i.incidentsByLocation} color="#f59e0b" />
        </Panel>
        <Panel title="Allergies on file" description={`${comp.dataCompleteness.withAllergies} people with at least one`}>
          <Bars items={i.allergies} color="#e11d48" />
        </Panel>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Panel title="Check-up coverage by department" description="Lowest first — where to send the next camp" bodyClassName="p-0">
          <Table head={['Department', 'Done', 'Coverage']}>
            {i.checkupCoverage.map((d) => (
              <tr key={d.name}>
                <Cell className="text-sm">{d.name}</Cell>
                <Cell className="whitespace-nowrap text-sm tabular-nums text-muted-foreground">
                  {d.completed} / {d.total}
                </Cell>
                <Cell last className="w-48">
                  <div className="flex items-center gap-3">
                    <Meter value={d.rate} color={d.rate >= 75 ? TEAL : '#f59e0b'} className="flex-1" />
                    <span className="w-9 text-right text-sm tabular-nums">{d.rate}%</span>
                  </div>
                </Cell>
              </tr>
            ))}
          </Table>
        </Panel>
        <Panel title="Vaccine compliance" bodyClassName="p-0">
          <Table head={['Vaccine', 'Given', 'Overdue', 'Compliance']}>
            {comp.vaccinationCompliance.map((x) => (
              <tr key={x.vaccineName}>
                <Cell className="text-sm font-medium">{x.vaccineName}</Cell>
                <Cell className="text-sm tabular-nums text-muted-foreground">
                  {x.completed} / {x.total}
                </Cell>
                <Cell className={`text-sm tabular-nums ${x.overdue ? 'text-rose-600' : 'text-muted-foreground'}`}>
                  {x.overdue}
                </Cell>
                <Cell last className="w-40">
                  <div className="flex items-center gap-3">
                    <Meter value={x.complianceRate} color={x.complianceRate >= 75 ? TEAL : '#f59e0b'} className="flex-1" />
                    <span className="w-9 text-right text-sm tabular-nums">{x.complianceRate}%</span>
                  </div>
                </Cell>
              </tr>
            ))}
          </Table>
        </Panel>
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-3">
        <Panel title="Blood groups">
          <div className="grid grid-cols-4 gap-2">
            {i.bloodGroups.map((b) => (
              <div key={b.name} className="rounded-lg bg-rose-50 px-2 py-2.5 text-center dark:bg-rose-500/10">
                <p className="text-sm font-semibold text-rose-700 dark:text-rose-300">{b.name}</p>
                <p className="text-xs tabular-nums text-muted-foreground">{b.value}</p>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="Chronic conditions">
          {i.conditions.length ? <Bars items={i.conditions} color="#f59e0b" /> : <p className="text-sm text-muted-foreground">None recorded.</p>}
        </Panel>
        <Panel title="Screening flags">
          <ul className="space-y-3 text-sm">
            <li className="flex justify-between">
              <span>Average BMI</span>
              <span className="font-medium tabular-nums">{checkups?.averageBmi?.toFixed(1) ?? '—'}</span>
            </li>
            <li className="flex justify-between">
              <span>Vision concerns</span>
              <span className="font-medium tabular-nums">{checkups?.visionIssues ?? 0}</span>
            </li>
            <li className="flex justify-between">
              <span>Specialist referrals</span>
              <span className="font-medium tabular-nums">{checkups?.referralsMade ?? 0}</span>
            </li>
            <li className="flex justify-between">
              <span>Emergency contacts on file</span>
              <span className="font-medium tabular-nums">{comp.dataCompleteness.emergencyContactRate}%</span>
            </li>
          </ul>
        </Panel>
      </div>
    </>
  );
}
