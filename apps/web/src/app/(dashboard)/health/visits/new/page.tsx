'use client';

import Link from 'next/link';
import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertTriangle, FilePlus2, Loader2, Plus, Search, X } from 'lucide-react';
import { healthApi, hrApi, studentApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { Avatar, PageTitle, Panel, Pill, Segmented } from '@/components/connect/kit';

type PersonType = 'student' | 'staff';
type VisitType = 'illness' | 'injury' | 'emergency' | 'routine' | 'follow-up' | 'other';
interface Picked {
  id: string;
  type: PersonType;
  name: string;
  photo?: string | null;
  detail: string;
}
interface HealthRecord {
  _id: string;
  bloodGroup?: string;
  allergies?: Array<{ name: string; severity?: string }>;
  conditions?: Array<{ name: string }>;
  currentMedications?: Array<{ name: string }>;
}

const VISIT_TYPES: Array<{ value: VisitType; label: string }> = [
  { value: 'illness', label: 'Illness' },
  { value: 'injury', label: 'Injury' },
  { value: 'emergency', label: 'Emergency' },
  { value: 'routine', label: 'Routine' },
  { value: 'follow-up', label: 'Follow-up' },
];
const SYMPTOMS = ['Fever', 'Headache', 'Nausea', 'Vomiting', 'Dizziness', 'Stomach ache', 'Cough', 'Cold', 'Sore throat', 'Body ache', 'Rash', 'Bleeding', 'Swelling', 'Breathlessness'];
type ApiErr = Error & { response?: { data?: { error?: { message?: string; details?: Array<{ message?: string; path?: string[] }> } } } };

export default function NewVisitPage() {
  return (
    <Suspense fallback={null}>
      <NewVisit />
    </Suspense>
  );
}

function NewVisit() {
  const router = useRouter();
  const params = useSearchParams();
  const [person, setPerson] = useState<Picked | null>(() => {
    const id = params.get('personId');
    const type = params.get('personType') as PersonType | null;
    return id && type
      ? { id, type, name: params.get('name') ?? 'Selected person', photo: params.get('photo'), detail: '' }
      : null;
  });
  const [who, setWho] = useState<PersonType>('student');
  const [search, setSearch] = useState('');
  const [visitType, setVisitType] = useState<VisitType>('illness');
  const [complaint, setComplaint] = useState('');
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [custom, setCustom] = useState('');
  const [incident, setIncident] = useState(false);
  const [place, setPlace] = useState('');
  const [what, setWhat] = useState('');
  const [v, setV] = useState({ temp: '', sys: '', dia: '', pulse: '', spo2: '' });

  const q = search.trim();
  const { data: results, isFetching } = useQuery({
    queryKey: ['visit-person-search', who, q],
    queryFn: async () => {
      if (who === 'student') {
        const r = await studentApi.getStudents({ search: q, limit: 8 });
        return (r.data ?? []).map((s: { _id: string; displayName?: string; firstName: string; lastName?: string; photo?: string; rollNumber?: string; currentEnrollment?: { className?: string; sectionName?: string } }) => ({
          id: s._id,
          type: 'student' as const,
          name: s.displayName || `${s.firstName} ${s.lastName ?? ''}`.trim(),
          photo: s.photo,
          detail: [s.currentEnrollment?.className?.split(' · ').slice(-2).join(' · '), s.currentEnrollment?.sectionName && `Sec ${s.currentEnrollment.sectionName}`].filter(Boolean).join(' · '),
        }));
      }
      const r = await hrApi.getStaff({ search: q, limit: 8 });
      return (r.data ?? []).map((s: { _id: string; displayName?: string; firstName: string; lastName?: string; photo?: string; employeeId?: string; employment?: { designation?: string; department?: string } }) => ({
        id: s._id,
        type: 'staff' as const,
        name: s.displayName || `${s.firstName} ${s.lastName ?? ''}`.trim(),
        photo: s.photo,
        detail: [s.employment?.designation, s.employeeId].filter(Boolean).join(' · ') || 'Staff',
      }));
    },
    enabled: !person && q.length >= 2,
  });

  // Their health record, if they have one (first visits don't — the API opens it)
  const { data: record, isLoading: recordLoading } = useQuery({
    queryKey: ['health-record-by-person', person?.type, person?.id],
    queryFn: () =>
      healthApi
        .getRecordByPerson(person!.type, person!.id)
        .then((r) => r.data as HealthRecord)
        .catch(() => null),
    enabled: !!person,
  });

  const save = useMutation({
    mutationFn: () => {
      const n = (s: string) => (s.trim() ? Number(s) : undefined);
      const vitals = {
        temperatureCelsius: n(v.temp),
        bloodPressureSystolic: n(v.sys),
        bloodPressureDiastolic: n(v.dia),
        pulseRate: n(v.pulse),
        oxygenSaturation: n(v.spo2),
      };
      return healthApi.createVisit({
        personType: person!.type,
        personId: person!.id,
        healthRecordId: record?._id,
        visitType,
        chiefComplaint: complaint.trim(),
        symptoms: symptoms.length ? symptoms : undefined,
        vitals: Object.values(vitals).some((x) => x !== undefined) ? vitals : undefined,
        isIncident: incident || undefined,
        incidentLocation: incident ? place.trim() || undefined : undefined,
        incidentDescription: incident ? what.trim() || undefined : undefined,
      });
    },
    onSuccess: (r: { data?: { _id?: string } }) => {
      toast.success(`Visit logged for ${person?.name.split(' ')[0]}`);
      router.push(r.data?._id ? `/health/visits/${r.data._id}` : '/health/visits');
    },
    onError: (e: ApiErr) => {
      const d = e.response?.data?.error;
      const first = d?.details?.[0];
      toast.error(first?.message ? `${first.path?.join('.') ?? 'Field'}: ${first.message}` : d?.message || 'Could not log the visit');
    },
  });

  const toggle = (s: string) => setSymptoms((xs) => (xs.includes(s) ? xs.filter((x) => x !== s) : [...xs, s]));
  const vitalsBad =
    (v.temp && (Number(v.temp) < 30 || Number(v.temp) > 45)) ||
    (v.spo2 && (Number(v.spo2) < 50 || Number(v.spo2) > 100)) ||
    (v.pulse && (Number(v.pulse) < 30 || Number(v.pulse) > 220));
  const ready = !!person && complaint.trim().length > 0 && !vitalsBad;

  return (
    <>
      <PageTitle
        title="Log a sick-room visit"
        description="Pick who came in, note what happened and take vitals. You can add the diagnosis and outcome when you close the visit."
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-6">
          {/* 1 · Who */}
          <Panel title={<Step n={1}>Who’s in the sick room?</Step>}>
            {person ? (
              <div className="flex items-center gap-4 rounded-xl border bg-muted/30 p-4">
                <Avatar person={person} size={52} />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{person.name}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    {person.detail || (person.type === 'staff' ? 'Staff' : 'Student')}
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setPerson(null)}>
                  Change
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                  <Segmented<PersonType>
                    value={who}
                    onChange={(x) => (setWho(x), setSearch(''))}
                    options={[
                      { value: 'student', label: 'Student' },
                      { value: 'staff', label: 'Staff' },
                    ]}
                  />
                  <div className="relative min-w-[240px] flex-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      autoFocus
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder={who === 'student' ? 'Type a name or roll number…' : 'Type a name or employee ID…'}
                      className="pl-9"
                    />
                  </div>
                </div>
                {q.length >= 2 && (
                  <ul className="max-h-80 divide-y overflow-y-auto rounded-xl border">
                    {isFetching && !results ? (
                      <li className="flex justify-center p-4">
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      </li>
                    ) : !results?.length ? (
                      <li className="p-4 text-center text-sm text-muted-foreground">Nobody matches “{q}”</li>
                    ) : (
                      results.map((p: Picked) => (
                        <li key={p.id}>
                          <button
                            type="button"
                            onClick={() => (setPerson(p), setSearch(''))}
                            className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-muted/50"
                          >
                            <Avatar person={p} size={36} />
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-medium">{p.name}</span>
                              <span className="block truncate text-xs text-muted-foreground">{p.detail}</span>
                            </span>
                          </button>
                        </li>
                      ))
                    )}
                  </ul>
                )}
                {q.length < 2 && (
                  <p className="text-sm text-muted-foreground">Start typing at least two letters.</p>
                )}
              </div>
            )}
          </Panel>

          {/* 2 · What happened */}
          <Panel title={<Step n={2}>What happened?</Step>}>
            <div className="space-y-5">
              <div className="flex flex-wrap gap-2">
                {VISIT_TYPES.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => (setVisitType(t.value), t.value === 'injury' && setIncident(true))}
                    className={cn(
                      'rounded-full border px-3.5 py-1.5 text-sm font-medium transition',
                      visitType === t.value ? 'border-primary bg-primary text-primary-foreground' : 'hover:border-primary/40'
                    )}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="complaint">Main complaint *</Label>
                <Input
                  id="complaint"
                  value={complaint}
                  onChange={(e) => setComplaint(e.target.value)}
                  placeholder="e.g. Fever since morning, twisted ankle during football"
                />
              </div>
              <div className="space-y-2">
                <Label>Symptoms</Label>
                <div className="flex flex-wrap gap-1.5">
                  {[...SYMPTOMS, ...symptoms.filter((s) => !SYMPTOMS.includes(s))].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => toggle(s)}
                      className={cn(
                        'rounded-full border px-2.5 py-1 text-xs transition',
                        symptoms.includes(s) ? 'border-primary bg-primary/10 font-medium text-primary' : 'text-muted-foreground hover:border-primary/40'
                      )}
                    >
                      {s}
                    </button>
                  ))}
                </div>
                <div className="flex max-w-sm gap-2">
                  <Input
                    value={custom}
                    onChange={(e) => setCustom(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && custom.trim()) {
                        e.preventDefault();
                        if (!symptoms.includes(custom.trim())) setSymptoms([...symptoms, custom.trim()]);
                        setCustom('');
                      }
                    }}
                    placeholder="Another symptom"
                    className="h-8"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!custom.trim()}
                    onClick={() => (!symptoms.includes(custom.trim()) && setSymptoms([...symptoms, custom.trim()]), setCustom(''))}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="rounded-xl border p-4">
                <label className="flex items-center justify-between gap-3">
                  <span>
                    <span className="block text-sm font-medium">Log as an incident</span>
                    <span className="block text-xs text-muted-foreground">Injuries on campus go to the safety register</span>
                  </span>
                  <Switch checked={incident} onCheckedChange={setIncident} />
                </label>
                {incident && (
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="place">Where</Label>
                      <Input id="place" value={place} onChange={(e) => setPlace(e.target.value)} placeholder="e.g. Football ground" />
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label htmlFor="what">What happened</Label>
                      <Textarea id="what" rows={2} value={what} onChange={(e) => setWhat(e.target.value)} />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </Panel>

          {/* 3 · Vitals */}
          <Panel title={<Step n={3}>Vitals</Step>} description="Optional — fill what you measured.">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {(
                [
                  ['temp', 'Temperature', '°C', '37.0'],
                  ['sys', 'BP systolic', 'mmHg', '120'],
                  ['dia', 'BP diastolic', 'mmHg', '80'],
                  ['pulse', 'Pulse', 'bpm', '72'],
                  ['spo2', 'SpO₂', '%', '98'],
                ] as const
              ).map(([k, label, unit, ph]) => (
                <div key={k} className="space-y-1.5">
                  <Label htmlFor={k}>
                    {label} <span className="font-normal text-muted-foreground">({unit})</span>
                  </Label>
                  <Input
                    id={k}
                    type="number"
                    inputMode="decimal"
                    step={k === 'temp' ? '0.1' : '1'}
                    placeholder={ph}
                    value={v[k]}
                    onChange={(e) => setV({ ...v, [k]: e.target.value })}
                  />
                </div>
              ))}
            </div>
            {vitalsBad && (
              <p className="mt-3 text-sm text-rose-600">
                Check the vitals — temperature is in °C (30–45), SpO₂ 50–100%, pulse 30–220.
              </p>
            )}
          </Panel>

          <div className="flex justify-end gap-3">
            <Button variant="outline" asChild>
              <Link href="/health/visits">Cancel</Link>
            </Button>
            <Button disabled={!ready || save.isPending} onClick={() => save.mutate()}>
              {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Log visit
            </Button>
          </div>
        </div>

        {/* Health snapshot */}
        <aside className="space-y-4 xl:sticky xl:top-20 xl:self-start">
          <Panel title="Health snapshot">
            {!person ? (
              <p className="text-sm text-muted-foreground">Pick a person to see their allergies and conditions before treating them.</p>
            ) : recordLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : record ? (
              <div className="space-y-4 text-sm">
                {record.allergies?.length ? (
                  <div className="flex gap-2 rounded-lg bg-rose-50 p-3 text-rose-800 dark:bg-rose-500/10 dark:text-rose-200">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>
                      <span className="font-semibold">Allergic to</span>{' '}
                      {record.allergies.map((a) => `${a.name}${a.severity ? ` (${a.severity})` : ''}`).join(', ')}
                    </span>
                  </div>
                ) : (
                  <p className="text-muted-foreground">No known allergies.</p>
                )}
                {record.bloodGroup && (
                  <p>
                    Blood group <span className="ml-1 rounded-md bg-rose-50 px-1.5 py-0.5 text-xs font-semibold text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">{record.bloodGroup}</span>
                  </p>
                )}
                {record.conditions?.length ? (
                  <div className="flex flex-wrap gap-1.5">
                    {record.conditions.map((c) => (
                      <Pill key={c.name} tone="amber">
                        {c.name}
                      </Pill>
                    ))}
                  </div>
                ) : null}
                {record.currentMedications?.length ? (
                  <p className="text-muted-foreground">On {record.currentMedications.map((m) => m.name).join(', ')}</p>
                ) : null}
                <Link href={`/health/records/${record._id}`} className="inline-block text-sm font-medium text-primary hover:underline">
                  Open full health record
                </Link>
              </div>
            ) : (
              <div className="flex gap-3 text-sm">
                <FilePlus2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <p className="text-muted-foreground">
                  First visit — there’s no health record yet. One will be opened automatically when you log this visit.
                </p>
              </div>
            )}
          </Panel>
          {person && (
            <button type="button" onClick={() => setPerson(null)} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
              <X className="h-3 w-3" /> Pick someone else
            </button>
          )}
        </aside>
      </div>
    </>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-2.5">
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">{n}</span>
      {children}
    </span>
  );
}
