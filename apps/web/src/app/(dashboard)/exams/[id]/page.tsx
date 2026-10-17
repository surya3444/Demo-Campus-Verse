'use client';

import { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  ClipboardList,
  Edit3,
  FileText,
  Loader2,
  Send,
  Sparkles,
  Ticket,
} from 'lucide-react';
import { toast } from 'sonner';
import { examsApi, academicApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DatePicker } from '@/components/ui/date-picker';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { EXAM_TYPE_LABELS, type ExamType } from '@campus-verse/shared/constants';
import { cn } from '@/lib/utils';
import { EditorialHeader } from '@/components/exams/EditorialHeader';
import { SectionPanel } from '@/components/exams/SectionPanel';
import { Field } from '@/components/exams/Field';
import { StatusBadge } from '@/components/exams/StatusBadge';

const NEXT_STATUS: Record<string, string | null> = {
  draft: 'scheduled',
  scheduled: 'ongoing',
  ongoing: 'completed',
  completed: 'results_published',
  results_published: null,
  cancelled: null,
};

interface Paper {
  _id: string;
  subjectId: string;
  subjectName: string;
  totalMarks: number;
  passMarks: number;
}

interface Exam {
  _id: string;
  name: string;
  termName: string;
  type: ExamType;
  classIds: string[];
  papers: Paper[];
  status: string;
  startDate?: string;
  endDate?: string;
  instructions?: string;
}

interface Schedule {
  _id: string;
  paperId: string;
  subjectName: string;
  sectionId: string;
  sectionName: string;
  classId: string;
  className: string;
  date: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  room?: string;
}

export default function ExamDetailPage() {
  const params = useParams();
  const queryClient = useQueryClient();
  const examId = params.id as string;

  const examQuery = useQuery({
    queryKey: ['exam', examId],
    queryFn: () => examsApi.getExam(examId),
  });
  const scheduleQuery = useQuery({
    queryKey: ['exam-schedules', examId],
    queryFn: () => examsApi.listSchedules({ examId }),
  });

  const exam = examQuery.data?.data as Exam | undefined;
  const schedules = (scheduleQuery.data?.data as Schedule[]) || [];

  const statusMutation = useMutation({
    mutationFn: (status: string) => examsApi.setExamStatus(examId, status),
    onSuccess: () => {
      toast.success('Status updated');
      queryClient.invalidateQueries({ queryKey: ['exam', examId] });
    },
    onError: (err: Error & { response?: { data?: { error?: { message?: string } } } }) => {
      toast.error(err.response?.data?.error?.message || 'Failed');
    },
  });

  const publishMutation = useMutation({
    mutationFn: () => examsApi.publishResults({ examId }),
    onSuccess: () => {
      toast.success('Results published');
      queryClient.invalidateQueries({ queryKey: ['exam', examId] });
      queryClient.invalidateQueries({ queryKey: ['exams'] });
    },
    onError: (err: Error & { response?: { data?: { error?: { message?: string } } } }) => {
      toast.error(err.response?.data?.error?.message || 'Failed to publish');
    },
  });

  if (examQuery.isLoading || !exam) {
    return (
      <div className="space-y-8 pb-12">
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-32 rounded-2xl" />
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    );
  }

  const nextStatus = NEXT_STATUS[exam.status];
  const totalPapers = exam.papers.length;
  const scheduledPaperIds = new Set(schedules.map((s) => s.paperId));
  const totalScheduled = scheduledPaperIds.size;
  const dateRange = (() => {
    if (!exam.startDate) return null;
    const start = new Date(exam.startDate).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
    if (!exam.endDate) return start;
    const end = new Date(exam.endDate).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
    return `${start} – ${end}`;
  })();

  return (
    <div className="space-y-8 pb-12">
      <EditorialHeader
        eyebrow={`Examinations · ${exam.termName}`}
        meta={EXAM_TYPE_LABELS[exam.type] || exam.type}
        icon={ClipboardList}
        title={exam.name}
        description={exam.instructions || 'Schedule papers, capture marks, and publish results.'}
        actions={
          <>
            <Link href="/exams">
              <Button variant="outline" size="sm" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
            </Link>
            {nextStatus && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => statusMutation.mutate(nextStatus)}
                disabled={statusMutation.isPending}
                className="gap-2"
              >
                {statusMutation.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
                Move to {nextStatus.replace('_', ' ')}
              </Button>
            )}
            {exam.status === 'completed' && (
              <Button
                size="sm"
                className="gap-2"
                onClick={() => {
                  if (
                    confirm(
                      'Publish results for ALL papers and students? This will notify parents.'
                    )
                  ) {
                    publishMutation.mutate();
                  }
                }}
                disabled={publishMutation.isPending}
              >
                {publishMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Publish results
              </Button>
            )}
            <Link href={`/exams/${exam._id}/hall-tickets`}>
              <Button variant="outline" size="sm" className="gap-2">
                <Ticket className="h-4 w-4" />
                Hall tickets
              </Button>
            </Link>
            <Link href={`/exams/${exam._id}/report-cards`}>
              <Button variant="outline" size="sm" className="gap-2">
                <FileText className="h-4 w-4" />
                Report cards
              </Button>
            </Link>
          </>
        }
      />

      {/* Exam summary hero */}
      <section className="relative overflow-hidden rounded-2xl border bg-card shadow-soft">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse 50% 100% at 0% 0%, hsl(var(--primary) / 0.08), transparent 60%), radial-gradient(ellipse 50% 80% at 100% 100%, hsl(var(--accent) / 0.08), transparent 60%)',
          }}
        />
        <div className="pointer-events-none absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
        <div className="relative grid grid-cols-1 lg:grid-cols-[auto_1fr] gap-6 p-7 items-center">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl ring-1 ring-foreground/5 shadow-soft-md bg-gradient-to-br from-primary to-primary/70">
              <ClipboardList className="h-7 w-7 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                Current status
              </p>
              <div className="mt-1">
                <StatusBadge status={exam.status} />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{dateRange || 'No window set'}</p>
            </div>
          </div>
          <ul className="grid grid-cols-2 sm:grid-cols-4 gap-0 self-stretch rounded-xl border border-border/60 bg-card/40 p-1 backdrop-blur-sm lg:bg-transparent lg:border-0 lg:p-0">
            <HeroStat label="Papers" value={totalPapers} sublabel="total" />
            <HeroStat
              label="Scheduled"
              value={`${totalScheduled} / ${totalPapers}`}
              sublabel="papers"
              divider
            />
            <HeroStat label="Classes" value={exam.classIds.length} sublabel="covered" divider />
            <HeroStat
              label="Sessions"
              value={schedules.length}
              sublabel="across sections"
              divider
            />
          </ul>
        </div>
      </section>

      <Tabs defaultValue="schedule" className="space-y-6">
        <TabsList className="grid grid-cols-3 w-full max-w-lg">
          <TabsTrigger value="schedule" className="gap-2">
            <Calendar className="h-4 w-4" /> Schedule
          </TabsTrigger>
          <TabsTrigger value="papers" className="gap-2">
            <ClipboardList className="h-4 w-4" /> Papers
          </TabsTrigger>
          <TabsTrigger value="results" className="gap-2">
            <CheckCircle2 className="h-4 w-4" /> Results
          </TabsTrigger>
        </TabsList>

        <TabsContent value="schedule" className="space-y-6">
          <ScheduleSection
            exam={exam}
            schedules={schedules}
            onChanged={() =>
              queryClient.invalidateQueries({ queryKey: ['exam-schedules', examId] })
            }
          />
        </TabsContent>

        <TabsContent value="papers">
          <SectionPanel
            eyebrow="Papers"
            title="Subjects covered in this exam"
            description="Each paper is one subject's exam. Schedule a paper to a section to start collecting marks."
            flush
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Subject</TableHead>
                  <TableHead className="text-center">Total marks</TableHead>
                  <TableHead className="text-center">Pass marks</TableHead>
                  <TableHead>Coverage</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {exam.papers.map((p) => {
                  const paperSchedules = schedules.filter((s) => s.paperId === p._id);
                  return (
                    <TableRow key={p._id}>
                      <TableCell className="font-medium">{p.subjectName}</TableCell>
                      <TableCell className="text-center tabular-nums">{p.totalMarks}</TableCell>
                      <TableCell className="text-center tabular-nums">{p.passMarks}</TableCell>
                      <TableCell>
                        {paperSchedules.length === 0 ? (
                          <span className="text-xs text-muted-foreground italic">
                            Not scheduled
                          </span>
                        ) : (
                          <span className="text-xs">
                            {paperSchedules.length} section
                            {paperSchedules.length === 1 ? '' : 's'} scheduled
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </SectionPanel>
        </TabsContent>

        <TabsContent value="results">
          <ResultsSection exam={exam} />
        </TabsContent>
      </Tabs>
    </div>
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

function ScheduleSection({
  exam,
  schedules,
  onChanged,
}: {
  exam: Exam;
  schedules: Schedule[];
  onChanged: () => void;
}) {
  const [selectedPaper, setSelectedPaper] = useState<string>(exam.papers[0]?._id || '');
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('12:00');
  const [room, setRoom] = useState('');
  const [selectedSections, setSelectedSections] = useState<string[]>([]);

  const sectionsQuery = useQuery({
    queryKey: ['sections-for-classes', exam.classIds],
    queryFn: async () => {
      const responses = await Promise.all(
        exam.classIds.map((cid) => academicApi.getSectionsByClass(cid))
      );
      return responses.flatMap((r) => (r.data as Array<Record<string, unknown>>) || []);
    },
  });
  const sections = sectionsQuery.data || [];

  const bulkMutation = useMutation({
    mutationFn: () =>
      examsApi.bulkCreateSchedules({
        examId: exam._id,
        paperId: selectedPaper,
        sectionIds: selectedSections,
        date,
        startTime,
        endTime,
        room: room || undefined,
      }),
    onSuccess: (res) => {
      const data = res.data as { sectionsScheduled: number };
      toast.success(`Scheduled ${data.sectionsScheduled} section(s)`);
      setSelectedSections([]);
      onChanged();
    },
    onError: (err: Error & { response?: { data?: { error?: { message?: string } } } }) => {
      toast.error(err.response?.data?.error?.message || 'Failed');
    },
  });

  return (
    <div className="space-y-6">
      <SectionPanel
        eyebrow="New schedule"
        title="Place a paper on the calendar"
        description="Pick a paper, choose a date and time, and select every section it applies to. The same time slot is reused across sections."
      >
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Field label="Paper" required>
            <Select value={selectedPaper} onValueChange={setSelectedPaper}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {exam.papers.map((p) => (
                  <SelectItem key={p._id} value={p._id}>
                    {p.subjectName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Date" required>
            <DatePicker value={date} onChange={(iso) => setDate(iso)} />
          </Field>
          <Field label="Start time" required>
            <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
          </Field>
          <Field label="End time" required>
            <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
          </Field>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          <Field label="Room (optional)" hint="Same room used across selected sections.">
            <Input
              placeholder="e.g. Hall 1"
              value={room}
              onChange={(e) => setRoom(e.target.value)}
            />
          </Field>
        </div>
        <div className="mt-5 space-y-2">
          <Field
            label="Sections"
            hint="Schedule the paper across one or more sections at the same time."
            required
          >
            {sections.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">
                No sections available for the chosen classes.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2 pt-1">
                {sections.map((s) => {
                  const id = s._id as string;
                  const active = selectedSections.includes(id);
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() =>
                        setSelectedSections((prev) =>
                          prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
                        )
                      }
                      className={cn(
                        'px-3 py-1.5 rounded-full text-xs font-medium border transition-all',
                        active
                          ? 'bg-primary text-primary-foreground border-primary shadow-soft'
                          : 'bg-background hover:border-primary/40 hover:text-primary'
                      )}
                    >
                      {s.name as string}
                    </button>
                  );
                })}
              </div>
            )}
          </Field>
        </div>
        <div className="mt-6 pt-4 border-t flex items-center justify-end">
          <Button
            onClick={() => bulkMutation.mutate()}
            disabled={
              !selectedPaper ||
              !date ||
              !startTime ||
              !endTime ||
              selectedSections.length === 0 ||
              bulkMutation.isPending
            }
            className="gap-2"
          >
            {bulkMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Calendar className="h-4 w-4" />
            )}
            Schedule {selectedSections.length} section{selectedSections.length === 1 ? '' : 's'}
          </Button>
        </div>
      </SectionPanel>

      <SectionPanel
        eyebrow="Schedule"
        title={`${schedules.length} session${schedules.length === 1 ? '' : 's'} planned`}
        description="Click a row to enter marks for that paper/section."
        flush
      >
        {schedules.length === 0 ? (
          <div className="py-16 text-center">
            <div className="h-12 w-12 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-3">
              <Calendar className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">
              No schedules yet — use the form above to set dates.
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Subject</TableHead>
                <TableHead>Class · Section</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Time</TableHead>
                <TableHead>Room</TableHead>
                <TableHead className="text-right">Marks entry</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {schedules.map((s) => (
                <TableRow key={s._id} className="group">
                  <TableCell className="font-medium">{s.subjectName}</TableCell>
                  <TableCell className="text-sm">
                    {s.className} · {s.sectionName}
                  </TableCell>
                  <TableCell className="text-sm tabular-nums">
                    {new Date(s.date).toLocaleDateString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                    })}
                  </TableCell>
                  <TableCell className="text-sm tabular-nums">
                    {s.startTime} – {s.endTime}
                    <span className="text-muted-foreground"> ({s.durationMinutes} min)</span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{s.room || '—'}</TableCell>
                  <TableCell className="text-right">
                    <Link href={`/exams/${exam._id}/marks/${s._id}`}>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Edit3 className="h-3 w-3" /> Enter marks
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </SectionPanel>
    </div>
  );
}

function ResultsSection({ exam }: { exam: Exam }) {
  const sectionsQuery = useQuery({
    queryKey: ['sections-for-classes', exam.classIds],
    queryFn: async () => {
      const responses = await Promise.all(
        exam.classIds.map((cid) => academicApi.getSectionsByClass(cid))
      );
      return responses.flatMap((r) => (r.data as Array<Record<string, unknown>>) || []);
    },
  });
  const sections = sectionsQuery.data || [];
  const [selectedSection, setSelectedSection] = useState<string>('');

  const reportQuery = useQuery({
    queryKey: ['exam-section-report', exam._id, selectedSection],
    queryFn: () => examsApi.sectionReport({ examId: exam._id, sectionId: selectedSection }),
    enabled: !!selectedSection,
  });

  const rows =
    (reportQuery.data?.data as Array<{
      paperId: string;
      subjectName: string;
      entered: number;
      absent: number;
      passed: number;
      failed: number;
      highest: number | null;
      lowest: number | null;
      avgMarks: number | null;
      avgPercentage: number | null;
      totalMarks: number;
    }>) || [];

  const sectionOptions = useMemo(
    () =>
      sections.map((s) => ({
        id: s._id as string,
        label: (s.name as string) || '',
      })),
    [sections]
  );

  return (
    <SectionPanel
      eyebrow="Results"
      title="Section-level performance"
      description="Aggregated pass/fail counts per paper, including average percentage and highest/lowest marks."
      action={
        <div className="flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
          <Select value={selectedSection} onValueChange={setSelectedSection}>
            <SelectTrigger className="w-[260px] h-9">
              <SelectValue placeholder="Pick a section" />
            </SelectTrigger>
            <SelectContent>
              {sectionOptions.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      }
      flush
    >
      {!selectedSection ? (
        <div className="py-16 text-center">
          <p className="text-sm text-muted-foreground italic">
            Pick a section above to see paper-level performance.
          </p>
        </div>
      ) : reportQuery.isLoading ? (
        <div className="p-7 space-y-3">
          <Skeleton className="h-10 w-full rounded-xl" />
          <Skeleton className="h-10 w-full rounded-xl" />
        </div>
      ) : rows.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-sm text-muted-foreground italic">
            No marks entered yet for this section.
          </p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Subject</TableHead>
              <TableHead className="text-right">Entered</TableHead>
              <TableHead className="text-right">Absent</TableHead>
              <TableHead className="text-right">Pass</TableHead>
              <TableHead className="text-right">Fail</TableHead>
              <TableHead className="text-right">Avg %</TableHead>
              <TableHead className="text-right">High</TableHead>
              <TableHead className="text-right">Low</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.paperId}>
                <TableCell className="font-medium">{r.subjectName}</TableCell>
                <TableCell className="text-right tabular-nums">{r.entered}</TableCell>
                <TableCell className="text-right tabular-nums">{r.absent}</TableCell>
                <TableCell className="text-right tabular-nums text-emerald-600">
                  {r.passed}
                </TableCell>
                <TableCell className="text-right tabular-nums text-rose-600">{r.failed}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {r.avgPercentage != null ? `${r.avgPercentage}%` : '—'}
                </TableCell>
                <TableCell className="text-right tabular-nums">{r.highest ?? '—'}</TableCell>
                <TableCell className="text-right tabular-nums">{r.lowest ?? '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </SectionPanel>
  );
}
