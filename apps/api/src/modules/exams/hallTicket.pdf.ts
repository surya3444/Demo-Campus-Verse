import PDFDocument from 'pdfkit';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { nanoid } from 'nanoid';
import { getS3Client, getBucketName, isS3Configured } from '../../config/s3';
import { logger } from '../../lib/logger';
import type { HallTicketDocument } from './hallTicket.service';

interface RenderInput {
  schoolName: string;
  schoolLogoUrl?: string;
  showQrCode: boolean;
  ticket: HallTicketDocument;
}

const NAVY = '#04266D';
const SLATE = '#475569';
const SLATE_LIGHT = '#94a3b8';
const RULE = '#cbd5e1';
const SOFT_BG = '#f1f5f9';
const ACCENT = '#0ac5ff';

/** A4 portrait hall ticket. */
export async function renderHallTicketPdf(input: RenderInput): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 36,
        info: {
          Title: `${input.ticket.studentName} — Hall Ticket`,
          Author: input.schoolName,
          Subject: input.ticket.examName,
        },
      });

      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      drawHeader(doc, input);
      drawStudentBlock(doc, input);
      drawScheduleTable(doc, input);
      drawInstructions(doc);
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

  doc.rect(doc.page.margins.left, top, pageWidth, 60).fill(NAVY);
  // Cyan accent stripe
  doc.rect(doc.page.margins.left, top + 60, pageWidth, 3).fill(ACCENT);

  doc
    .fillColor('#ffffff')
    .font('Helvetica-Bold')
    .fontSize(18)
    .text(input.schoolName, doc.page.margins.left + 18, top + 13, { width: pageWidth - 36 });

  doc
    .font('Helvetica')
    .fontSize(11)
    .fillColor('#cbd5e1')
    .text('HALL TICKET / ADMIT CARD', doc.page.margins.left + 18, top + 38, {
      width: pageWidth - 36,
      characterSpacing: 2,
    });

  doc.fillColor('#000000');
  doc.y = top + 80;
}

function drawStudentBlock(doc: PDFKit.PDFDocument, input: RenderInput) {
  const left = doc.page.margins.left;
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const t = input.ticket;

  doc.moveDown(0.4);
  doc.roundedRect(left, doc.y, width, 100, 8).lineWidth(0.7).strokeColor(RULE).stroke();

  const top = doc.y + 12;
  const rowHeight = 38;

  // Two-row grid: 4 cells per row.
  const grid: Array<[string, string]> = [
    ['EXAM', `${t.examName} (${t.termName})`],
    ['CLASS', `${t.className}${t.sectionName ? ` · ${t.sectionName}` : ''}`],
    ['STUDENT', t.studentName],
    ['ADMISSION NO.', t.admissionNumber || '—'],
    ['ROLL NO.', t.rollNumber || '—'],
    ['SEAT NO.', t.seatNumber || '—'],
    ['VENUE', t.venue || '—'],
    ['', ''], // filler
  ];

  const cols = 4;
  const colWidth = (width - 20) / cols;
  grid.forEach(([label, value], i) => {
    const row = Math.floor(i / cols);
    const col = i % cols;
    const x = left + 10 + col * colWidth;
    const y = top + row * rowHeight;
    if (!label) return;
    doc
      .font('Helvetica-Bold')
      .fontSize(7)
      .fillColor(SLATE_LIGHT)
      .text(label, x, y, { width: colWidth - 10, characterSpacing: 1 });
    doc
      .font('Helvetica')
      .fontSize(11)
      .fillColor('#0f172a')
      .text(value, x, y + 12, { width: colWidth - 10, ellipsis: true });
  });

  doc.y = top + 96;
  doc.fillColor('#000000');
}

function drawScheduleTable(doc: PDFKit.PDFDocument, input: RenderInput) {
  const left = doc.page.margins.left;
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const t = input.ticket;

  doc.moveDown(0.8);
  doc
    .font('Helvetica-Bold')
    .fontSize(9)
    .fillColor(SLATE)
    .text('EXAM SCHEDULE', left, doc.y, { width, characterSpacing: 1.5 });
  doc.moveDown(0.4);

  const cols = [width * 0.18, width * 0.27, width * 0.13, width * 0.18, width * 0.1, width * 0.14];
  const headers = ['Date', 'Subject', 'Start', 'End', 'Marks', 'Room'];

  let y = doc.y;
  doc.rect(left, y, width, 22).fill(SOFT_BG);
  let x = left + 8;
  headers.forEach((h, i) => {
    doc
      .fillColor(SLATE)
      .font('Helvetica-Bold')
      .fontSize(9)
      .text(h, x, y + 7, { width: cols[i] - 8, ellipsis: true });
    x += cols[i];
  });
  y += 22;

  for (const p of t.papers) {
    if (y + 22 > doc.page.height - doc.page.margins.bottom - 140) {
      doc.addPage();
      y = doc.page.margins.top;
    }
    x = left + 8;
    const d = new Date(p.date);
    const cells = [
      d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) +
        ' ' +
        d.toLocaleDateString('en-IN', { weekday: 'short' }),
      p.subjectName,
      p.startTime,
      p.endTime + ` (${p.durationMinutes}m)`,
      String(p.totalMarks),
      p.room || '—',
    ];
    cells.forEach((c, i) => {
      doc
        .fillColor('#0f172a')
        .font('Helvetica')
        .fontSize(10)
        .text(c, x, y + 6, { width: cols[i] - 8, ellipsis: true });
      x += cols[i];
    });
    doc
      .lineWidth(0.4)
      .strokeColor(RULE)
      .moveTo(left, y + 22)
      .lineTo(left + width, y + 22)
      .stroke();
    y += 22;
  }
  doc.y = y + 6;
}

function drawInstructions(doc: PDFKit.PDFDocument) {
  const left = doc.page.margins.left;
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  doc.moveDown(1);
  doc
    .font('Helvetica-Bold')
    .fontSize(9)
    .fillColor(SLATE)
    .text('IMPORTANT INSTRUCTIONS', left, doc.y, { width, characterSpacing: 1.5 });
  doc.moveDown(0.3);
  const lines = [
    'Arrive at least 30 minutes before the scheduled start time.',
    'Bring this hall ticket and a valid school ID. Entry will be denied without both.',
    'Mobile phones, smart watches and other electronic devices are not permitted in the examination hall.',
    'Use only blue or black ball-point pens unless your subject requires otherwise.',
    'Hall tickets must be retained until results are declared.',
  ];
  lines.forEach((line) => {
    doc.font('Helvetica').fontSize(9).fillColor(SLATE).text(`•  ${line}`, left, doc.y, { width });
  });
}

function drawFooter(doc: PDFKit.PDFDocument, input: RenderInput) {
  const left = doc.page.margins.left;
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;

  // Signature line at the right
  const signY = doc.page.height - doc.page.margins.bottom - 50;
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
    .text('Controller of Examinations', signLeft, signY + 6, {
      width: 180,
      align: 'center',
    });

  if (input.showQrCode) {
    // pdfkit can't render a real QR without an extra dep; we draw a placeholder
    // box so the layout stays consistent. Wire `qrcode` package in a follow-up.
    doc
      .roundedRect(left, signY - 60, 80, 80, 4)
      .lineWidth(0.6)
      .strokeColor(RULE)
      .stroke();
    doc
      .font('Helvetica')
      .fontSize(7)
      .fillColor(SLATE_LIGHT)
      .text('QR (placeholder)', left + 6, signY - 6, { width: 70, align: 'center' });
  }

  doc
    .font('Helvetica')
    .fontSize(7)
    .fillColor(SLATE_LIGHT)
    .text(
      `Issued ${new Date().toLocaleString('en-IN')} · ${input.ticket._id.toString().slice(-8)}`,
      left,
      doc.page.height - doc.page.margins.bottom - 4,
      { width, align: 'right' }
    );
}

export async function uploadHallTicketPdf(args: {
  tenantId: string;
  branchId: string;
  examId: string;
  studentId: string;
  buffer: Buffer;
}): Promise<{ key: string; url: string }> {
  if (!isS3Configured()) {
    throw new Error('Cannot store hall ticket PDF — S3 is not configured.');
  }
  const bucket = getBucketName();
  const uniq = nanoid(8);
  const key = `${args.tenantId}/${args.branchId}/hall-tickets/${args.examId}/${args.studentId}-${uniq}.pdf`;

  await getS3Client().send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: args.buffer,
      ContentType: 'application/pdf',
      ContentDisposition: 'inline',
    })
  );

  const url = `https://${bucket}.s3.amazonaws.com/${key}`;
  logger.info({ key }, 'Hall ticket PDF uploaded');
  return { key, url };
}
