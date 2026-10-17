import PDFDocument from 'pdfkit';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { nanoid } from 'nanoid';
import { getS3Client, getBucketName, isS3Configured } from '../../config/s3';
import { logger } from '../../lib/logger';
import type { ReportCardDocument } from './reportCard.service';

interface RenderInput {
  schoolName: string;
  schoolLogoUrl?: string;
  principalName?: string;
  schoolMotto?: string;
  showAttendance: boolean;
  showRank: boolean;
  showRemarks: boolean;
  coScholasticEnabled: boolean;
  report: ReportCardDocument;
}

const NAVY = '#04266D';
const SLATE = '#475569';
const SLATE_LIGHT = '#94a3b8';
const RULE = '#cbd5e1';
const SOFT_BG = '#f1f5f9';

/**
 * Render one report card as a PDF buffer.
 *
 * Layout decisions:
 *   - A4 portrait, 36-pt margins.
 *   - Header band with school name and (optionally) "Report Card / Term · Exam".
 *   - Student block in two rows (Name + Admission + Class + Roll).
 *   - Scholastic table with columns: Subject, Marks, Total, %, Grade, Remarks?.
 *   - Co-scholastic table (when enabled).
 *   - Overall summary card (total, %, grade, rank, pass/fail).
 *   - Footer with attendance, principal sign-line, generated timestamp.
 */
export async function renderReportCardPdf(input: RenderInput): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 36,
        info: {
          Title: `${input.report.studentName} — Report Card`,
          Author: input.schoolName,
          Subject: input.report.examName,
        },
      });

      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // ─── Header band ───
      drawHeader(doc, input);

      // ─── Student block ───
      drawStudentBlock(doc, input);

      // ─── Scholastic table ───
      drawScholasticTable(doc, input);

      // ─── Co-scholastic table ───
      if (input.coScholasticEnabled && (input.report.coScholastic?.length || 0) > 0) {
        drawCoScholasticTable(doc, input);
      }

      // ─── Overall summary ───
      drawOverallSummary(doc, input);

      // ─── Footer ───
      drawFooter(doc, input);

      doc.end();
    } catch (err) {
      reject(err as Error);
    }
  });
}

function drawHeader(doc: PDFKit.PDFDocument, input: RenderInput) {
  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const top = doc.page.margins.top;

  // Navy band
  doc.rect(doc.page.margins.left, top, pageWidth, 60).fill(NAVY);

  doc
    .fillColor('#ffffff')
    .font('Helvetica-Bold')
    .fontSize(20)
    .text(input.schoolName, doc.page.margins.left + 18, top + 12, { width: pageWidth - 36 });

  doc
    .font('Helvetica')
    .fontSize(10)
    .fillColor('#cbd5e1')
    .text(
      `Report Card · ${input.report.termName} · ${input.report.examName}`,
      doc.page.margins.left + 18,
      top + 38,
      { width: pageWidth - 36 }
    );

  doc.fillColor('#000000').moveDown(0.5);
  doc.y = top + 78;
}

function drawStudentBlock(doc: PDFKit.PDFDocument, input: RenderInput) {
  const left = doc.page.margins.left;
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const r = input.report;

  doc.roundedRect(left, doc.y, width, 70, 8).lineWidth(0.7).strokeColor(RULE).stroke();

  const top = doc.y + 12;
  const colWidth = (width - 20) / 4;

  const cells: Array<[string, string]> = [
    ['STUDENT', r.studentName],
    ['ADMISSION NO.', r.admissionNumber || '—'],
    ['CLASS', `${r.className}${r.sectionName ? ` · ${r.sectionName}` : ''}`],
    ['ROLL NO.', r.rollNumber || '—'],
  ];

  cells.forEach(([label, value], i) => {
    const x = left + 10 + i * colWidth;
    doc
      .font('Helvetica-Bold')
      .fontSize(7)
      .fillColor(SLATE_LIGHT)
      .text(label, x, top, { width: colWidth - 10 });
    doc
      .font('Helvetica')
      .fontSize(11)
      .fillColor('#0f172a')
      .text(value, x, top + 14, { width: colWidth - 10 });
  });

  doc.y = top + 60;
  doc.fillColor('#000000');
}

function drawScholasticTable(doc: PDFKit.PDFDocument, input: RenderInput) {
  const left = doc.page.margins.left;
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;

  doc.moveDown(0.8);
  doc
    .font('Helvetica-Bold')
    .fontSize(9)
    .fillColor(SLATE)
    .text('SCHOLASTIC AREAS', left, doc.y, { width, characterSpacing: 1.5 });
  doc.moveDown(0.4);

  const showRemarks = input.showRemarks;
  const colWidths = showRemarks
    ? [width * 0.32, width * 0.13, width * 0.13, width * 0.12, width * 0.1, width * 0.2]
    : [width * 0.42, width * 0.14, width * 0.14, width * 0.14, width * 0.16];
  const headers = showRemarks
    ? ['Subject', 'Marks', 'Total', '%', 'Grade', 'Remarks']
    : ['Subject', 'Marks', 'Total', '%', 'Grade'];

  // Header row
  let y = doc.y;
  doc.rect(left, y, width, 22).fill(SOFT_BG);
  let x = left + 8;
  headers.forEach((h, i) => {
    doc
      .fillColor(SLATE)
      .font('Helvetica-Bold')
      .fontSize(9)
      .text(h, x, y + 7, { width: colWidths[i] - 8, ellipsis: true });
    x += colWidths[i];
  });
  y += 22;

  // Body rows
  for (const row of input.report.scholastic) {
    if (y + 20 > doc.page.height - doc.page.margins.bottom - 100) {
      doc.addPage();
      y = doc.page.margins.top;
    }
    x = left + 8;
    const cells = showRemarks
      ? [
          row.subjectName,
          row.absent ? 'AB' : String(row.marksObtained),
          String(row.totalMarks),
          row.absent ? '—' : `${row.percentage}%`,
          row.absent ? '—' : row.grade || '—',
          row.remarks || '',
        ]
      : [
          row.subjectName,
          row.absent ? 'AB' : String(row.marksObtained),
          String(row.totalMarks),
          row.absent ? '—' : `${row.percentage}%`,
          row.absent ? '—' : row.grade || '—',
        ];
    cells.forEach((c, i) => {
      doc
        .fillColor(row.passed ? '#0f172a' : '#dc2626')
        .font('Helvetica')
        .fontSize(10)
        .text(c, x, y + 5, { width: colWidths[i] - 8, ellipsis: true });
      x += colWidths[i];
    });
    // Row underline
    doc
      .lineWidth(0.4)
      .strokeColor(RULE)
      .moveTo(left, y + 20)
      .lineTo(left + width, y + 20)
      .stroke();
    y += 20;
  }
  doc.y = y + 6;
  doc.fillColor('#000000');
}

function drawCoScholasticTable(doc: PDFKit.PDFDocument, input: RenderInput) {
  const left = doc.page.margins.left;
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;

  doc.moveDown(0.8);
  doc
    .font('Helvetica-Bold')
    .fontSize(9)
    .fillColor(SLATE)
    .text('CO-SCHOLASTIC AREAS', left, doc.y, { width, characterSpacing: 1.5 });
  doc.moveDown(0.4);

  const colWidths = [width * 0.55, width * 0.15, width * 0.3];
  let y = doc.y;
  doc.rect(left, y, width, 22).fill(SOFT_BG);
  let x = left + 8;
  ['Area', 'Grade', 'Remarks'].forEach((h, i) => {
    doc
      .fillColor(SLATE)
      .font('Helvetica-Bold')
      .fontSize(9)
      .text(h, x, y + 7, { width: colWidths[i] - 8 });
    x += colWidths[i];
  });
  y += 22;

  for (const row of input.report.coScholastic || []) {
    if (y + 20 > doc.page.height - doc.page.margins.bottom - 80) {
      doc.addPage();
      y = doc.page.margins.top;
    }
    x = left + 8;
    [row.areaName, row.grade, row.remarks || ''].forEach((c, i) => {
      doc
        .fillColor('#0f172a')
        .font('Helvetica')
        .fontSize(10)
        .text(c, x, y + 5, { width: colWidths[i] - 8, ellipsis: true });
      x += colWidths[i];
    });
    doc
      .lineWidth(0.4)
      .strokeColor(RULE)
      .moveTo(left, y + 20)
      .lineTo(left + width, y + 20)
      .stroke();
    y += 20;
  }
  doc.y = y + 6;
}

function drawOverallSummary(doc: PDFKit.PDFDocument, input: RenderInput) {
  const left = doc.page.margins.left;
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const r = input.report.overall;

  doc.moveDown(0.8);

  const cardHeight = 80;
  doc.roundedRect(left, doc.y, width, cardHeight, 8).lineWidth(0.7).strokeColor(RULE).stroke();

  const top = doc.y + 12;
  const cellWidth = width / 5;

  const cells: Array<[string, string]> = [
    ['TOTAL MARKS', `${r.totalMarksObtained} / ${r.totalMarks}`],
    ['PERCENTAGE', `${r.percentage}%`],
    ['GRADE', r.grade || '—'],
    ['STATUS', r.passed ? 'Pass' : 'Fail'],
  ];
  if (input.showRank) {
    cells.push(['RANK', r.rank ? `${ordinal(r.rank)}` : '—']);
  }

  cells.forEach(([label, value], i) => {
    const x = left + i * cellWidth + 12;
    doc
      .font('Helvetica-Bold')
      .fontSize(7)
      .fillColor(SLATE_LIGHT)
      .text(label, x, top, { width: cellWidth - 20, characterSpacing: 1 });
    doc
      .font('Helvetica-Bold')
      .fontSize(15)
      .fillColor(label === 'STATUS' && !r.passed ? '#dc2626' : NAVY)
      .text(value, x, top + 16, { width: cellWidth - 20 });
  });
  doc.y = top + cardHeight - 8;
  doc.fillColor('#000000');
}

function drawFooter(doc: PDFKit.PDFDocument, input: RenderInput) {
  const left = doc.page.margins.left;
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const r = input.report;

  doc.moveDown(1.2);
  const y = doc.y;

  if (input.showAttendance && r.attendance) {
    doc
      .font('Helvetica-Bold')
      .fontSize(8)
      .fillColor(SLATE_LIGHT)
      .text('ATTENDANCE', left, y, { characterSpacing: 1 });
    doc
      .font('Helvetica')
      .fontSize(10)
      .fillColor('#0f172a')
      .text(
        `${r.attendance.present} of ${r.attendance.total} working days · ${r.attendance.percent}%`,
        left,
        y + 12
      );
  }

  // Principal sign at far right
  const signY = doc.page.height - doc.page.margins.bottom - 70;
  const signLeft = left + width - 200;
  doc
    .lineWidth(0.6)
    .strokeColor(SLATE)
    .moveTo(signLeft, signY)
    .lineTo(signLeft + 180, signY)
    .stroke();
  doc
    .font('Helvetica')
    .fontSize(9)
    .fillColor(SLATE)
    .text(
      input.principalName ? `${input.principalName} · Principal` : 'Principal',
      signLeft,
      signY + 6,
      {
        width: 180,
        align: 'center',
      }
    );

  // Motto / footer line
  if (input.schoolMotto) {
    doc
      .font('Helvetica-Oblique')
      .fontSize(8)
      .fillColor(SLATE_LIGHT)
      .text(input.schoolMotto, left, doc.page.height - doc.page.margins.bottom - 14, {
        width,
        align: 'center',
      });
  }

  // Tiny generated stamp
  doc
    .font('Helvetica')
    .fontSize(7)
    .fillColor(SLATE_LIGHT)
    .text(
      `Generated ${new Date().toLocaleString('en-IN')}`,
      left,
      doc.page.height - doc.page.margins.bottom - 4,
      { width, align: 'right' }
    );
}

function ordinal(n: number): string {
  const j = n % 10;
  const k = n % 100;
  if (j === 1 && k !== 11) return `${n}st`;
  if (j === 2 && k !== 12) return `${n}nd`;
  if (j === 3 && k !== 13) return `${n}rd`;
  return `${n}th`;
}

/**
 * Push a generated PDF to S3 under a deterministic-per-key path so a regenerated
 * card replaces the old object. Returns the public URL + key.
 */
export async function uploadReportCardPdf(args: {
  tenantId: string;
  branchId: string;
  examId: string;
  studentId: string;
  buffer: Buffer;
}): Promise<{ key: string; url: string }> {
  if (!isS3Configured()) {
    throw new Error('Cannot store report card PDF — S3 is not configured. Set AWS_* env vars.');
  }
  const bucket = getBucketName();
  const uniq = nanoid(8);
  const key = `${args.tenantId}/${args.branchId}/report-cards/${args.examId}/${args.studentId}-${uniq}.pdf`;

  await getS3Client().send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: args.buffer,
      ContentType: 'application/pdf',
      ContentDisposition: 'inline',
    })
  );

  // Standard S3 URL — works whether the bucket is publicly readable (typical
  // for student-facing assets) or fronted by a CDN. If the deployment requires
  // signed URLs, swap this for a getSignedUrl(GetObjectCommand) call at read
  // time. For now we go with the simpler model.
  const url = `https://${bucket}.s3.amazonaws.com/${key}`;
  logger.info({ key }, 'Report card PDF uploaded');
  return { key, url };
}
