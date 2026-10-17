'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  ExternalLink,
  FileText,
  Loader2,
  RefreshCw,
  Send,
  Undo2,
} from 'lucide-react';
import { toast } from 'sonner';
import { examsApi, academicApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
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
import { StatusBadge } from '@/components/exams/StatusBadge';

interface ReportCard {
  _id: string;
  examId: string;
  studentId: string;
  studentName: string;
  admissionNumber?: string;
  rollNumber?: string;
  sectionName: string;
  className: string;
  examName: string;
  termName: string;
  overall: {
    totalMarksObtained: number;
    totalMarks: number;
    percentage: number;
    grade?: string;
    rank?: number;
    passed: boolean;
  };
  pdfUrl?: string;
  status: 'draft' | 'published';
  generatedAt: string;
  publishedAt?: string;
}

interface Exam {
  _id: string;
  name: string;
  classIds: string[];
}

export default function ReportCardsPage() {
  const params = useParams();
  const examId = params.id as string;
  const queryClient = useQueryClient();

  const [selectedSection, setSelectedSection] = useState<string>('');
  const [previewCard, setPreviewCard] = useState<ReportCard | null>(null);

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

  const cardsQuery = useQuery({
    queryKey: ['report-cards', examId, selectedSection],
    queryFn: () =>
      examsApi.listReportCards({
        examId,
        sectionId: selectedSection || undefined,
      }),
  });
  const cards = (cardsQuery.data?.data as ReportCard[]) || [];

  const generateMutation = useMutation({
    mutationFn: () =>
      examsApi.generateReportCards({
        examId,
        sectionId: selectedSection || undefined,
      }),
    onSuccess: (res) => {
      const data = res.data as { generated: number; skipped: number };
      toast.success(
        `Generated ${data.generated} card(s)${data.skipped ? ` · ${data.skipped} skipped` : ''}`
      );
      queryClient.invalidateQueries({ queryKey: ['report-cards', examId] });
    },
    onError: (err: Error & { response?: { data?: { error?: { message?: string } } } }) => {
      toast.error(err.response?.data?.error?.message || 'Failed to generate');
    },
  });

  const publishMutation = useMutation({
    mutationFn: (id: string) => examsApi.publishReportCard(id),
    onSuccess: () => {
      toast.success('Published');
      queryClient.invalidateQueries({ queryKey: ['report-cards', examId] });
    },
    onError: () => toast.error('Failed to publish'),
  });

  const unpublishMutation = useMutation({
    mutationFn: (id: string) => examsApi.unpublishReportCard(id),
    onSuccess: () => {
      toast.success('Unpublished');
      queryClient.invalidateQueries({ queryKey: ['report-cards', examId] });
    },
    onError: () => toast.error('Failed to unpublish'),
  });

  const bulkPublishMutation = useMutation({
    mutationFn: () =>
      examsApi.bulkPublishReportCards({
        examId,
        sectionId: selectedSection || undefined,
      }),
    onSuccess: (res) => {
      const data = res.data as { published: number };
      toast.success(`Published ${data.published} card(s)`);
      queryClient.invalidateQueries({ queryKey: ['report-cards', examId] });
    },
    onError: () => toast.error('Failed to bulk-publish'),
  });

  const draftCount = useMemo(() => cards.filter((c) => c.status === 'draft').length, [cards]);
  const publishedCount = useMemo(
    () => cards.filter((c) => c.status === 'published').length,
    [cards]
  );

  const kpis: KpiItem[] = [
    {
      label: 'Total cards',
      value: cards.length.toLocaleString(),
      icon: FileText,
      footnote: <span className="text-muted-foreground">All scopes</span>,
    },
    {
      label: 'Drafts',
      value: draftCount.toLocaleString(),
      icon: RefreshCw,
      accent: draftCount > 0,
      footnote: <span className="text-muted-foreground">Awaiting publish</span>,
    },
    {
      label: 'Published',
      value: publishedCount.toLocaleString(),
      icon: CheckCircle2,
      footnote: <span className="text-muted-foreground">Visible to parents</span>,
    },
  ];

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
        eyebrow={`${exam.name} · Report cards`}
        meta="PDF + publish"
        icon={FileText}
        title="Report cards"
        description="Generate per-student PDFs from current marks, preview the layout, and publish to release them to parents."
        actions={
          <Link href={`/exams/${examId}`}>
            <Button variant="outline" size="sm" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to exam
            </Button>
          </Link>
        }
      />

      <KpiStrip ariaLabel="Report card stats" items={kpis} loading={cardsQuery.isLoading} />

      <SectionPanel
        eyebrow="Generate & publish"
        title="Build or refresh the PDFs"
        description="Generating builds the PDF from current marks, applies the grading scale, and stores the card as a draft. Drafts aren't visible to students until you publish them."
      >
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Section scope" hint="Leave on All sections to process the entire exam.">
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
            Generate {selectedSection ? 'for section' : 'for all sections'}
          </Button>
          <Button
            variant={draftCount === 0 ? 'outline' : 'default'}
            onClick={() => {
              if (
                draftCount > 0 &&
                confirm(
                  `Publish ${draftCount} draft report card(s)? Students and parents will be able to view them.`
                )
              ) {
                bulkPublishMutation.mutate();
              }
            }}
            disabled={bulkPublishMutation.isPending || draftCount === 0}
            className="gap-2"
          >
            {bulkPublishMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Publish drafts ({draftCount})
          </Button>
        </div>
      </SectionPanel>

      <SectionPanel
        eyebrow="All cards"
        title={`${cards.length} on file`}
        description="One row per student per exam. Preview a card before publishing to check the layout."
        flush
      >
        {cardsQuery.isLoading ? (
          <div className="p-7 space-y-3">
            <Skeleton className="h-12 w-full rounded-xl" />
            <Skeleton className="h-12 w-full rounded-xl" />
          </div>
        ) : cards.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="h-12 w-12 rounded-full bg-gradient-to-br from-primary/15 to-primary/5 flex items-center justify-center mb-3">
              <FileText className="h-6 w-6 text-primary" />
            </div>
            <h3 className="font-display text-lg font-semibold">No report cards yet</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm">
              Once marks are entered, generate report cards to produce PDFs you can review and
              publish.
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Class · Section</TableHead>
                <TableHead className="text-right">%</TableHead>
                <TableHead>Grade</TableHead>
                <TableHead className="text-center">Rank</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cards.map((c) => (
                <TableRow key={c._id} className="group">
                  <TableCell>
                    <div className="font-medium">{c.studentName}</div>
                    <div className="text-xs text-muted-foreground">
                      {c.admissionNumber ? `Adm ${c.admissionNumber}` : ''}
                      {c.rollNumber ? ` · Roll ${c.rollNumber}` : ''}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {c.className} · {c.sectionName}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{c.overall.percentage}%</TableCell>
                  <TableCell className="font-mono text-sm">{c.overall.grade || '—'}</TableCell>
                  <TableCell className="text-center text-sm tabular-nums">
                    {c.overall.rank ?? '—'}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={c.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {c.pdfUrl && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setPreviewCard(c)}
                            className="gap-1"
                          >
                            <FileText className="h-4 w-4" />
                            Preview
                          </Button>
                          <a href={c.pdfUrl} download target="_blank" rel="noreferrer">
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <Download className="h-4 w-4" />
                            </Button>
                          </a>
                        </>
                      )}
                      {c.status === 'draft' ? (
                        <Button
                          size="sm"
                          onClick={() => publishMutation.mutate(c._id)}
                          disabled={publishMutation.isPending}
                          className="gap-1"
                        >
                          <Send className="h-3 w-3" />
                          Publish
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            if (confirm('Unpublish this card? Students will no longer see it.')) {
                              unpublishMutation.mutate(c._id);
                            }
                          }}
                          className="gap-1"
                        >
                          <Undo2 className="h-3 w-3" />
                          Unpublish
                        </Button>
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
        open={!!previewCard}
        onOpenChange={(open) => {
          if (!open) setPreviewCard(null);
        }}
      >
        <DialogContent className="max-w-4xl h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-display">
              {previewCard?.studentName}
              {previewCard?.pdfUrl && (
                <a
                  href={previewCard.pdfUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-primary inline-flex items-center gap-1 font-normal"
                >
                  Open in new tab <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </DialogTitle>
          </DialogHeader>
          {previewCard?.pdfUrl ? (
            <iframe
              src={previewCard.pdfUrl}
              className="flex-1 w-full border rounded"
              title={`${previewCard.studentName} report card`}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
              PDF not available — regenerate this report card.
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
