'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  BookOpenCheck,
  Calculator,
  CheckCircle2,
  Heart,
  Loader2,
  MailCheck,
  Plus,
  Save,
  Settings,
  Ticket,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { examsApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  BOARD_PRESETS,
  CBSE_GRADING_SCALE,
  ICSE_GRADING_SCALE,
  UGC_GRADING_SCALE,
  DEFAULT_CO_SCHOLASTIC_AREAS,
  type BoardPreset,
  type GradingScaleBand,
} from '@campus-verse/shared/constants';
import { cn } from '@/lib/utils';
import { EditorialHeader } from '@/components/exams/EditorialHeader';
import { SectionPanel } from '@/components/exams/SectionPanel';
import { Field } from '@/components/exams/Field';

interface SettingsState {
  boardPreset: BoardPreset;
  gradingScale: GradingScaleBand[];
  coScholasticEnabled: boolean;
  coScholasticAreas: string[];
  coScholasticGrades: string[];
  passMarkPercent: number;
  passSubjectsRequired: 'all' | number;
  reportCard: {
    showAttendance: boolean;
    showRank: boolean;
    showRemarks: boolean;
    principalName?: string;
    schoolMotto?: string;
  };
  hallTicket: {
    seatingMode: 'roll_number' | 'manual';
    showQrCode: boolean;
    venueDefault?: string;
  };
  resultNotification: {
    sendSms: boolean;
    sendEmail: boolean;
    smsTemplate?: string;
    emailSubject?: string;
    emailBody?: string;
  };
  promotion: {
    passMarkPercent: number;
    passSubjectsRequired: 'all' | number;
  };
}

const SECTIONS = [
  {
    id: 'board',
    number: '01',
    title: 'Board preset',
    subtitle: 'CBSE · ICSE · UGC · Custom',
    icon: BookOpenCheck,
  },
  {
    id: 'scale',
    number: '02',
    title: 'Grading scale',
    subtitle: 'Percentage bands',
    icon: Calculator,
  },
  {
    id: 'pass',
    number: '03',
    title: 'Pass criteria',
    subtitle: 'Marks & subject rules',
    icon: CheckCircle2,
  },
  {
    id: 'coscholastic',
    number: '04',
    title: 'Co-scholastic',
    subtitle: 'Optional CBSE area',
    icon: Heart,
  },
  {
    id: 'reportcard',
    number: '05',
    title: 'Report card',
    subtitle: 'PDF appearance',
    icon: Settings,
  },
  {
    id: 'hallticket',
    number: '06',
    title: 'Hall ticket',
    subtitle: 'Seating & venue',
    icon: Ticket,
  },
  {
    id: 'notifications',
    number: '07',
    title: 'Notifications',
    subtitle: 'SMS & email parents',
    icon: MailCheck,
  },
];

export default function ExamSettingsPage() {
  const queryClient = useQueryClient();
  const [state, setState] = useState<SettingsState | null>(null);
  const [active, setActive] = useState('board');

  const { data, isLoading } = useQuery({
    queryKey: ['exam-settings'],
    queryFn: () => examsApi.getSettings(),
  });

  useEffect(() => {
    if (data?.data) setState(data.data as SettingsState);
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: () => examsApi.updateSettings(state as unknown as Record<string, unknown>),
    onSuccess: () => {
      toast.success('Settings saved');
      queryClient.invalidateQueries({ queryKey: ['exam-settings'] });
    },
    onError: (err: Error & { response?: { data?: { error?: { message?: string } } } }) => {
      toast.error(err.response?.data?.error?.message || 'Failed to save');
    },
  });

  const applyPreset = (preset: BoardPreset) => {
    if (!state) return;
    if (preset === 'cbse') {
      setState({
        ...state,
        boardPreset: 'cbse',
        gradingScale: CBSE_GRADING_SCALE,
        coScholasticEnabled: true,
        coScholasticAreas: DEFAULT_CO_SCHOLASTIC_AREAS,
        passMarkPercent: 33,
      });
      toast.success('CBSE preset loaded');
    } else if (preset === 'icse') {
      setState({
        ...state,
        boardPreset: 'icse',
        gradingScale: ICSE_GRADING_SCALE,
        coScholasticEnabled: false,
        passMarkPercent: 40,
      });
      toast.success('ICSE preset loaded');
    } else if (preset === 'ugc') {
      setState({
        ...state,
        boardPreset: 'ugc',
        gradingScale: UGC_GRADING_SCALE,
        coScholasticEnabled: false,
        passMarkPercent: 40,
      });
      toast.success('UGC preset loaded');
    } else {
      setState({ ...state, boardPreset: 'custom' });
    }
  };

  const updateBand = (idx: number, patch: Partial<GradingScaleBand>) => {
    if (!state) return;
    setState({
      ...state,
      gradingScale: state.gradingScale.map((b, i) => (i === idx ? { ...b, ...patch } : b)),
    });
  };

  const addBand = () => {
    if (!state) return;
    setState({
      ...state,
      gradingScale: [...state.gradingScale, { minPercent: 0, maxPercent: 0, grade: '' }],
    });
  };

  const removeBand = (idx: number) => {
    if (!state) return;
    setState({
      ...state,
      gradingScale: state.gradingScale.filter((_, i) => i !== idx),
    });
  };

  const summary = useMemo(() => {
    if (!state) return null;
    return {
      bandCount: state.gradingScale.length,
      passMark: state.passMarkPercent,
      coScholastic: state.coScholasticEnabled,
      sms: state.resultNotification.sendSms,
      email: state.resultNotification.sendEmail,
    };
  }, [state]);

  if (isLoading || !state) {
    return (
      <div className="space-y-8 pb-12">
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-32 rounded-2xl" />
        <Skeleton className="h-[500px] rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      <EditorialHeader
        eyebrow="Examinations · Settings"
        meta="/exams/settings"
        icon={Settings}
        title="Exam settings"
        description="Pick a board preset, configure grading and report-card style, and decide how parent notifications go out when results are published."
        actions={
          <>
            <Link href="/exams">
              <Button variant="outline" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back to exams
              </Button>
            </Link>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              className="gap-2"
            >
              {saveMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save changes
            </Button>
          </>
        }
      />

      <BoardHero state={state} summary={summary} onPresetSwitch={applyPreset} />

      <div className="grid gap-8 md:grid-cols-[260px_1fr]">
        <nav className="md:sticky md:top-20 md:self-start" aria-label="Exam settings sections">
          <p className="px-3 mb-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            Configure
          </p>
          <ul className="space-y-1">
            {SECTIONS.map((s) => {
              const Icon = s.icon;
              const isActive = active === s.id;
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setActive(s.id);
                      document
                        .getElementById(`section-${s.id}`)
                        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }}
                    className={cn(
                      'group relative flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-all',
                      isActive
                        ? 'bg-gradient-to-r from-primary/10 via-primary/5 to-transparent text-foreground'
                        : 'hover:bg-muted/50 text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {isActive && (
                      <span
                        aria-hidden
                        className="absolute inset-y-2 left-0 w-[3px] rounded-r-full bg-primary"
                      />
                    )}
                    <span
                      className={cn(
                        'font-mono text-[10px] font-semibold tabular-nums',
                        isActive ? 'text-primary' : 'text-muted-foreground/60'
                      )}
                    >
                      {s.number}
                    </span>
                    <Icon
                      className={cn(
                        'h-4 w-4 shrink-0',
                        isActive ? 'text-primary' : 'text-muted-foreground/70'
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <p
                        className={cn(
                          'text-sm leading-tight',
                          isActive ? 'font-semibold text-foreground' : 'font-medium'
                        )}
                      >
                        {s.title}
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground/80 truncate">
                        {s.subtitle}
                      </p>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="min-w-0 space-y-8">
          <div id="section-board">
            <SectionPanel
              eyebrow="Board preset"
              title="Pick a board to seed defaults"
              description="Selecting a preset auto-loads its grading scale and co-scholastic settings. Switch to Custom for full control."
            >
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {BOARD_PRESETS.map((p) => {
                  const isActive = state.boardPreset === p;
                  const meta =
                    p === 'cbse'
                      ? { title: 'CBSE', subtitle: '9-point scale · A1–E2 · co-scholastic on' }
                      : p === 'icse'
                        ? { title: 'ICSE', subtitle: 'Percentage bands · A–E' }
                        : p === 'ugc'
                          ? { title: 'UGC', subtitle: '10-point CGPA · O–F · universities' }
                          : { title: 'Custom', subtitle: 'Define everything yourself' };
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => applyPreset(p)}
                      className={cn(
                        'group flex flex-col items-start gap-2 rounded-xl border p-4 text-left transition-all',
                        isActive
                          ? 'border-primary/40 bg-gradient-to-br from-primary/10 via-card to-accent/5 shadow-soft'
                          : 'hover:border-foreground/20 hover:bg-muted/30'
                      )}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className="font-display text-lg font-bold tracking-tight">
                          {meta.title}
                        </span>
                        {isActive && <CheckCircle2 className="h-5 w-5 text-primary" />}
                      </div>
                      <span className="text-xs text-muted-foreground leading-relaxed">
                        {meta.subtitle}
                      </span>
                    </button>
                  );
                })}
              </div>
            </SectionPanel>
          </div>

          <div id="section-scale">
            <SectionPanel
              eyebrow="Grading scale"
              title="Percentage bands"
              description="Each band maps a percentage range to a grade letter and optional points. Bands should cover 0–100 with no overlap."
              action={
                <Button size="sm" variant="outline" onClick={addBand} className="gap-1">
                  <Plus className="h-3 w-3" /> Add band
                </Button>
              }
            >
              <div className="space-y-2">
                <div className="grid grid-cols-12 gap-2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-semibold pb-1">
                  <div className="col-span-2">Min %</div>
                  <div className="col-span-2">Max %</div>
                  <div className="col-span-2">Grade</div>
                  <div className="col-span-2">Points</div>
                  <div className="col-span-3">Remark</div>
                  <div className="col-span-1"></div>
                </div>
                {state.gradingScale.map((band, i) => (
                  <div
                    key={i}
                    className="grid grid-cols-12 gap-2 items-center p-2 rounded-xl border bg-muted/20"
                  >
                    <Input
                      type="number"
                      className="col-span-2 h-9 tabular-nums"
                      value={band.minPercent}
                      onChange={(e) => updateBand(i, { minPercent: parseInt(e.target.value) || 0 })}
                    />
                    <Input
                      type="number"
                      className="col-span-2 h-9 tabular-nums"
                      value={band.maxPercent}
                      onChange={(e) => updateBand(i, { maxPercent: parseInt(e.target.value) || 0 })}
                    />
                    <Input
                      className="col-span-2 h-9 font-mono uppercase"
                      value={band.grade}
                      onChange={(e) => updateBand(i, { grade: e.target.value })}
                    />
                    <Input
                      type="number"
                      className="col-span-2 h-9 tabular-nums"
                      value={band.points ?? ''}
                      onChange={(e) =>
                        updateBand(i, {
                          points: e.target.value === '' ? undefined : parseInt(e.target.value),
                        })
                      }
                    />
                    <Input
                      className="col-span-3 h-9"
                      placeholder="Optional descriptor"
                      value={band.remark ?? ''}
                      onChange={(e) => updateBand(i, { remark: e.target.value })}
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      className="col-span-1 h-9 w-9 mx-auto"
                      onClick={() => removeBand(i)}
                    >
                      <Trash2 className="h-4 w-4 text-rose-500" />
                    </Button>
                  </div>
                ))}
              </div>
            </SectionPanel>
          </div>

          <div id="section-pass">
            <SectionPanel
              eyebrow="Pass criteria"
              title="When is a subject a pass?"
              description="Set the percentage threshold for a subject pass, and how many subjects a student must pass overall."
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <Field label="Pass mark %" hint="Subject is considered passed when % ≥ this value.">
                  <Input
                    type="number"
                    value={state.passMarkPercent}
                    onChange={(e) =>
                      setState({ ...state, passMarkPercent: parseInt(e.target.value) || 0 })
                    }
                  />
                </Field>
                <Field
                  label="Subjects required to pass"
                  hint="Used by the year-end promotion workflow."
                >
                  <Select
                    value={
                      state.passSubjectsRequired === 'all'
                        ? 'all'
                        : String(state.passSubjectsRequired)
                    }
                    onValueChange={(v) =>
                      setState({
                        ...state,
                        passSubjectsRequired: v === 'all' ? 'all' : parseInt(v),
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All subjects must pass</SelectItem>
                      {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                        <SelectItem key={n} value={String(n)}>
                          At least {n} subject{n === 1 ? '' : 's'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
            </SectionPanel>
          </div>

          <div id="section-coscholastic">
            <SectionPanel
              eyebrow="Co-scholastic"
              title="Include a non-academic grades section"
              description="Common on CBSE report cards. Areas like Work Education, Health & PE, Art Education are graded separately and don't affect promotion."
              action={
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {state.coScholasticEnabled ? 'Enabled' : 'Disabled'}
                  </span>
                  <Switch
                    checked={state.coScholasticEnabled}
                    onCheckedChange={(c) => setState({ ...state, coScholasticEnabled: c })}
                  />
                </div>
              }
            >
              {state.coScholasticEnabled ? (
                <div className="grid gap-5">
                  <Field
                    label="Co-scholastic areas"
                    hint="One area per row on the report card. Comma-separated."
                  >
                    <Input
                      value={state.coScholasticAreas.join(', ')}
                      onChange={(e) =>
                        setState({
                          ...state,
                          coScholasticAreas: e.target.value
                            .split(',')
                            .map((s) => s.trim())
                            .filter(Boolean),
                        })
                      }
                    />
                  </Field>
                  <Field
                    label="Allowed grades"
                    hint="Letters teachers can pick from when grading each area."
                  >
                    <Input
                      value={state.coScholasticGrades.join(', ')}
                      onChange={(e) =>
                        setState({
                          ...state,
                          coScholasticGrades: e.target.value
                            .split(',')
                            .map((s) => s.trim())
                            .filter(Boolean),
                        })
                      }
                    />
                  </Field>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">
                  Toggle on to add a co-scholastic section to report cards.
                </p>
              )}
            </SectionPanel>
          </div>

          <div id="section-reportcard">
            <SectionPanel
              eyebrow="Report card"
              title="What appears on the PDF"
              description="Toggle elements on or off, and provide the principal's name for the signature line."
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <Field label="Principal name">
                  <Input
                    placeholder="Dr. Aparna Iyer"
                    value={state.reportCard.principalName ?? ''}
                    onChange={(e) =>
                      setState({
                        ...state,
                        reportCard: { ...state.reportCard, principalName: e.target.value },
                      })
                    }
                  />
                </Field>
                <Field label="Footer motto" hint="Printed at the very bottom of the report card.">
                  <Input
                    placeholder="Veritas · Carpe diem"
                    value={state.reportCard.schoolMotto ?? ''}
                    onChange={(e) =>
                      setState({
                        ...state,
                        reportCard: { ...state.reportCard, schoolMotto: e.target.value },
                      })
                    }
                  />
                </Field>
                <ToggleRow
                  label="Show attendance summary"
                  description="Aggregates per-day attendance over the exam window."
                  checked={state.reportCard.showAttendance}
                  onChange={(c) =>
                    setState({
                      ...state,
                      reportCard: { ...state.reportCard, showAttendance: c },
                    })
                  }
                />
                <ToggleRow
                  label="Show class rank"
                  description="Rank is computed within the student's section."
                  checked={state.reportCard.showRank}
                  onChange={(c) =>
                    setState({
                      ...state,
                      reportCard: { ...state.reportCard, showRank: c },
                    })
                  }
                />
                <ToggleRow
                  label="Show per-subject remarks"
                  description="Optional column for teacher notes per subject."
                  checked={state.reportCard.showRemarks}
                  onChange={(c) =>
                    setState({
                      ...state,
                      reportCard: { ...state.reportCard, showRemarks: c },
                    })
                  }
                />
              </div>
            </SectionPanel>
          </div>

          <div id="section-hallticket">
            <SectionPanel
              eyebrow="Hall ticket"
              title="Admit-card defaults"
              description="Seat allocation can be auto by roll number or set manually per student."
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <Field label="Seat allocation">
                  <Select
                    value={state.hallTicket.seatingMode}
                    onValueChange={(v) =>
                      setState({
                        ...state,
                        hallTicket: {
                          ...state.hallTicket,
                          seatingMode: v as 'roll_number' | 'manual',
                        },
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="roll_number">By roll number (auto)</SelectItem>
                      <SelectItem value="manual">Manual</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Default venue">
                  <Input
                    placeholder="e.g. Main Examination Hall"
                    value={state.hallTicket.venueDefault ?? ''}
                    onChange={(e) =>
                      setState({
                        ...state,
                        hallTicket: { ...state.hallTicket, venueDefault: e.target.value },
                      })
                    }
                  />
                </Field>
                <ToggleRow
                  label="Print QR code"
                  description="A simple QR encoding the student / exam ID for entry scanning."
                  checked={state.hallTicket.showQrCode}
                  onChange={(c) =>
                    setState({ ...state, hallTicket: { ...state.hallTicket, showQrCode: c } })
                  }
                />
              </div>
            </SectionPanel>
          </div>

          <div id="section-notifications">
            <SectionPanel
              eyebrow="Notifications"
              title="Tell parents when results land"
              description="When you publish report cards, the system can dispatch SMS and email to the parent contacts on file. Templates support {{studentName}}, {{examName}}, {{termName}} placeholders."
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <ToggleRow
                  label="Send SMS"
                  description="Uses your school's SMS gateway. Category: exam."
                  checked={state.resultNotification.sendSms}
                  onChange={(c) =>
                    setState({
                      ...state,
                      resultNotification: { ...state.resultNotification, sendSms: c },
                    })
                  }
                />
                <ToggleRow
                  label="Send email"
                  description="Uses Resend (transactional). Works without setup in dev."
                  checked={state.resultNotification.sendEmail}
                  onChange={(c) =>
                    setState({
                      ...state,
                      resultNotification: { ...state.resultNotification, sendEmail: c },
                    })
                  }
                />
                <div className="md:col-span-2">
                  <Field
                    label="Email subject"
                    hint="Defaults to “<examName> results published — <studentName>”."
                  >
                    <Input
                      placeholder="Your child's exam results are now available"
                      value={state.resultNotification.emailSubject ?? ''}
                      onChange={(e) =>
                        setState({
                          ...state,
                          resultNotification: {
                            ...state.resultNotification,
                            emailSubject: e.target.value,
                          },
                        })
                      }
                    />
                  </Field>
                </div>
                <div className="md:col-span-2">
                  <Field
                    label="Email body"
                    hint="Use {{studentName}}, {{examName}}, {{termName}} placeholders."
                  >
                    <Textarea
                      rows={4}
                      placeholder="Dear parent, the results for {{examName}} are now available in the student portal."
                      value={state.resultNotification.emailBody ?? ''}
                      onChange={(e) =>
                        setState({
                          ...state,
                          resultNotification: {
                            ...state.resultNotification,
                            emailBody: e.target.value,
                          },
                        })
                      }
                    />
                  </Field>
                </div>
              </div>
            </SectionPanel>
          </div>
        </div>
      </div>
    </div>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (c: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-3 rounded-xl border bg-muted/20 p-4 cursor-pointer hover:bg-muted/40 transition-colors">
      <Switch checked={checked} onCheckedChange={onChange} className="mt-0.5" />
      <div className="min-w-0">
        <p className="text-sm font-semibold leading-snug">{label}</p>
        <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">{description}</p>
      </div>
    </label>
  );
}

function BoardHero({
  state,
  summary,
  onPresetSwitch,
}: {
  state: SettingsState;
  summary: {
    bandCount: number;
    passMark: number;
    coScholastic: boolean;
    sms: boolean;
    email: boolean;
  } | null;
  onPresetSwitch: (p: BoardPreset) => void;
}) {
  if (!summary) return null;
  return (
    <section className="relative overflow-hidden rounded-2xl border bg-card shadow-soft">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 60% 100% at 0% 0%, hsl(var(--primary) / 0.10), transparent 60%), radial-gradient(ellipse 50% 80% at 100% 100%, hsl(var(--accent) / 0.10), transparent 60%)',
        }}
      />
      <div className="pointer-events-none absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />

      <div className="relative grid grid-cols-1 gap-6 p-6 lg:grid-cols-[auto_1fr_auto] lg:items-center lg:p-7">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl ring-1 ring-foreground/5 shadow-soft-md bg-gradient-to-br from-primary to-primary/70">
            <BookOpenCheck className="h-7 w-7 text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              Active board
            </p>
            <h2 className="font-display text-2xl font-bold leading-tight tracking-tight md:text-[28px]">
              {state.boardPreset === 'cbse'
                ? 'CBSE'
                : state.boardPreset === 'icse'
                  ? 'ICSE'
                  : 'Custom configuration'}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground max-w-md">
              {state.boardPreset === 'cbse'
                ? 'Nine-point grading scale with separate scholastic and co-scholastic tables.'
                : state.boardPreset === 'icse'
                  ? 'Percentage-based bands. Co-scholastic disabled by default.'
                  : 'You are configuring everything from scratch.'}
            </p>
          </div>
        </div>

        <ul className="grid grid-cols-2 sm:grid-cols-4 gap-0 self-stretch rounded-xl border border-border/60 bg-card/40 p-1 backdrop-blur-sm lg:bg-transparent lg:border-0 lg:p-0">
          <HeroStat label="Grade bands" value={summary.bandCount} sublabel="rows" />
          <HeroStat
            label="Pass mark"
            value={`${summary.passMark}%`}
            sublabel="per subject"
            divider
          />
          <HeroStat
            label="Co-scholastic"
            value={summary.coScholastic ? 'On' : 'Off'}
            sublabel="report card"
            divider
          />
          <HeroStat
            label="Notify parents"
            value={
              summary.sms && summary.email
                ? 'SMS + email'
                : summary.sms
                  ? 'SMS only'
                  : summary.email
                    ? 'Email only'
                    : 'Off'
            }
            sublabel="on publish"
            divider
          />
        </ul>

        <div className="flex shrink-0 items-center gap-1 rounded-xl border bg-card/80 px-2 py-1.5 shadow-soft backdrop-blur-sm">
          {BOARD_PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => onPresetSwitch(p)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium uppercase tracking-wider transition-colors',
                state.boardPreset === p
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
              )}
            >
              {p === 'cbse' ? 'CBSE' : p === 'icse' ? 'ICSE' : 'Custom'}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

function HeroStat({
  label,
  value,
  sublabel,
  divider,
}: {
  label: string;
  value: React.ReactNode;
  sublabel: string;
  divider?: boolean;
}) {
  return (
    <li
      className={cn(
        'flex flex-col items-start justify-center px-4 py-1',
        divider && 'border-l border-border/60'
      )}
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
        {label}
      </p>
      <p className="font-display text-xl font-bold tabular-nums leading-tight mt-1">{value}</p>
      <p className="mt-1 text-[11px] text-muted-foreground">{sublabel}</p>
    </li>
  );
}
