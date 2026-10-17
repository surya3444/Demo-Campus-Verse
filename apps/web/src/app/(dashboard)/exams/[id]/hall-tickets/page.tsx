'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Check,
  Download,
  ExternalLink,
  FileText,
  Loader2,
  Pencil,
  RefreshCw,
  Ticket,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { examsApi, academicApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { EditorialHeader } from '@/components/exams/EditorialHeader';
import { SectionPanel } from '@/components/exams/SectionPanel';
import { KpiStrip, type KpiItem } from '@/components/exams/KpiStrip';
import { Field } from '@/components/exams/Field';

interface HallTicket {
  _id: string;
  examName: string;
  termName: string;
  studentId: string;
  studentName: string;
  admissionNumber?: string;
  rollNumber?: string;
  sectionName: string;
  className: string;
  seatNumber?: string;
  venue?: string;
  papers: Array<{
    subjectName: string;
    date: string;
    startTime: string;
    endTime: string;
    room?: string;
    totalMarks: number;
  }>;
  pdfUrl?: string;
  generatedAt: string;
}

interface Exam {
  _id: string;
  name: string;
  classIds: string[];
}

export default function HallTicketsPage() {
  const params = useParams();
  const examId = params.id as string;
  const queryClient = useQueryClient();
  const [selectedSection, setSelectedSection] = useState<string>('');
  const [preview, setPreview] = useState<HallTicket | null>(null);
  const [editingSeat, setEditingSeat] = useState<{ id: string; value: string } | null>(null);

  const examQuery = useQuery({
    queryKey: ['exam', examId],
    queryFn: () => examsApi.getExam(examId),
  });
  const exam = examQuery.data?.data as Exam | undefined;

  const sectionsQuery = useQuery({
    queryKey: ['sections-for-classes', exam?.classIds],
    queryFn: async () => {
      if (!exam) return [];
      const responses = await Promise.all(
        exam.classIds.map((cid) => academicApi.getSectionsByClass(cid))
      );
      return responses.flatMap((r) => (r.data as Array<Record<string, unknown>>) || []);
    },
    enabled: !!exam,
  });
  const sections = sectionsQuery.data || [];

  const ticketsQuery = useQuery({
    queryKey: ['hall-tickets', examId, selectedSection],
    queryFn: () =>
      examsApi.listHallTickets({
        examId,
        sectionId: selectedSection || undefined,
      }),
  });
  const tickets = (ticketsQuery.data?.data as HallTicket[]) || [];

  const generateMutation = useMutation({
    mutationFn: () =>
      examsApi.generateHallTickets({
        examId,
        sectionId: selectedSection || undefined,
      }),
    onSuccess: (res) => {
      const data = res.data as { generated: number };
      toast.success(`Generated ${data.generated} hall ticket(s)`);
      queryClient.invalidateQueries({ queryKey: ['hall-tickets', examId] });
    },
    onError: (err: Error & { response?: { data?: { error?: { message?: string } } } }) => {
      toast.error(err.response?.data?.error?.message || 'Failed to generate');
    },
  });

  const updateSeatMutation = useMutation({
    mutationFn: ({ id, seat }: { id: string; seat: string }) =>
      examsApi.updateHallTicketSeat(id, seat),
    onSuccess: () => {
      toast.success('Seat updated');
      setEditingSeat(null);
      queryClient.invalidateQueries({ queryKey: ['hall-tickets', examId] });
    },
    onError: () => toast.error('Failed to update seat'),
  });

  const kpis: KpiItem[] = useMemo(() => {
    const total = tickets.length;
    const withSeat = tickets.filter((t) => t.seatNumber).length;
    const withPdf = tickets.filter((t) => t.pdfUrl).length;
    return [
      {
        label: 'Tickets',
        value: total.toLocaleString(),
        icon: Ticket,
        footnote: <span className="text-muted-foreground">For this scope</span>,
      },
      {
        label: 'With seat',
        value: withSeat.toLocaleString(),
        icon: Check,
        accent: withSeat > 0,
        footnote: <span className="text-muted-foreground">Allocated</span>,
      },
      {
        label: 'PDFs ready',
        value: withPdf.toLocaleString(),
        icon: FileText,
        footnote: <span className="text-muted-foreground">Downloadable</span>,
      },
    ];
  }, [tickets]);

  if (examQuery.isLoading || !exam) {
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
        eyebrow={`${exam.name} · Hall tickets`}
        meta="PDF admit cards"
        icon={Ticket}
        title="Hall tickets"
        description="Generate per-student admit cards with seat numbers, room assignments and the exam timetable. Seating mode is set on the Settings page."
        actions={
          <Link href={`/exams/${examId}`}>
            <Button variant="outline" size="sm" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to exam
            </Button>
          </Link>
        }
      />

      <KpiStrip ariaLabel="Hall ticket stats" items={kpis} loading={ticketsQuery.isLoading} />

      <SectionPanel
        eyebrow="Generate"
        title="Build hall tickets"
        description="Creates one PDF per student in the chosen scope. Seat allocation follows the seating mode set in Settings; you can override seat numbers individually below."
      >
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Section scope">
            <Select
              value={selectedSection || 'all'}
              onValueChange={(v) => setSelectedSection(v === 'all' ? '' : v)}
            >
              <SelectTrigger className="w-[260px]">
                <SelectValue placeholder="All sections" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All sections</SelectItem>
                {sections.map((s) => (
                  <SelectItem key={s._id as string} value={s._id as string}>
                    {s.name as string}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Button
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending}
            className="gap-2"
          >
            {generateMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Generate {selectedSection ? 'for section' : 'for all'}
          </Button>
        </div>
      </SectionPanel>

      <SectionPanel
        eyebrow="Issued tickets"
        title={`${tickets.length} on file`}
        description="Inline-edit seat number for any student, preview the PDF, or download the file."
        flush
      >
        {ticketsQuery.isLoading ? (
          <div className="p-7 space-y-3">
            <Skeleton className="h-12 w-full rounded-xl" />
            <Skeleton className="h-12 w-full rounded-xl" />
          </div>
        ) : tickets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="h-12 w-12 rounded-full bg-gradient-to-br from-primary/15 to-primary/5 flex items-center justify-center mb-3">
              <Ticket className="h-6 w-6 text-primary" />
            </div>
            <h3 className="font-display text-lg font-semibold">No hall tickets yet</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm">
              Schedule papers first, then generate hall tickets here.
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Class · Section</TableHead>
                <TableHead className="text-center">Roll</TableHead>
                <TableHead>Seat</TableHead>
                <TableHead className="text-center">Papers</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tickets.map((t) => (
                <TableRow key={t._id} className="group">
                  <TableCell>
                    <div className="font-medium">{t.studentName}</div>
                    <div className="text-xs text-muted-foreground font-mono">
                      {t.admissionNumber || ''}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {t.className} · {t.sectionName}
                  </TableCell>
                  <TableCell className="text-center text-sm tabular-nums">
                    {t.rollNumber || '—'}
                  </TableCell>
                  <TableCell>
                    {editingSeat?.id === t._id ? (
                      <div className="flex gap-1">
                        <Input
                          value={editingSeat.value}
                          onChange={(e) => setEditingSeat({ id: t._id, value: e.target.value })}
                          className="h-8 w-24 tabular-nums"
                          autoFocus
                        />
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() =>
                            updateSeatMutation.mutate({
                              id: t._id,
                              seat: editingSeat.value,
                            })
                          }
                          disabled={updateSeatMutation.isPending}
                        >
                          {updateSeatMutation.isPending ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Check className="h-3.5 w-3.5 text-emerald-600" />
                          )}
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => setEditingSeat(null)}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setEditingSeat({ id: t._id, value: t.seatNumber || '' })}
                        className="inline-flex items-center gap-1.5 text-sm hover:text-primary transition-colors group/edit"
                      >
                        <span className="tabular-nums font-mono">
                          {t.seatNumber || (
                            <span className="italic text-muted-foreground">Set</span>
                          )}
                        </span>
                        <Pencil className="h-3 w-3 opacity-0 group-hover/edit:opacity-100 transition-opacity" />
                      </button>
                    )}
                  </TableCell>
                  <TableCell className="text-center text-sm">{t.papers.length}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {t.pdfUrl && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setPreview(t)}
                            className="gap-1"
                          >
                            <FileText className="h-4 w-4" /> Preview
                          </Button>
                          <a href={t.pdfUrl} target="_blank" rel="noreferrer" download>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <Download className="h-4 w-4" />
                            </Button>
                          </a>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </SectionPanel>

      <Dialog
        open={!!preview}
        onOpenChange={(open) => {
          if (!open) setPreview(null);
        }}
      >
        <DialogContent className="max-w-4xl h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-display">
              {preview?.studentName} — Hall Ticket
              {preview?.pdfUrl && (
                <a
                  href={preview.pdfUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-primary inline-flex items-center gap-1 font-normal"
                >
                  Open in new tab <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </DialogTitle>
          </DialogHeader>
          {preview?.pdfUrl ? (
            <iframe
              src={preview.pdfUrl}
              className="flex-1 w-full border rounded"
              title="Hall ticket preview"
            />
          ) : (
            <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
              PDF not available. Regenerate this ticket.
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
