import PDFDocument from 'pdfkit';

/**
 * Renders the accreditation documents as PDFs an assessor can read without
 * translation: SAR section numbering, the methodology stated up front, and
 * every matrix laid out as a grid rather than a list of pairs.
 *
 * Layout is A4 portrait for prose-heavy reports and A4 *landscape* for the
 * program articulation matrix, which has one column per PO (up to 12 POs +
 * PSOs) and simply does not fit portrait.
 */

const NAVY = '#04266D';
const SLATE = '#475569';
const SLATE_LIGHT = '#94a3b8';
const RULE = '#cbd5e1';
const SOFT_BG = '#f1f5f9';
const GOOD = '#15803d';
const BAD = '#b91c1c';

type Doc = PDFKit.PDFDocument;

interface NbaReport {
  meta: {
    institution: { name: unknown; code: unknown } | null;
    branchName: string | null;
    program: {
      name: string;
      departmentCode: string;
      curriculumProgramName: string | null;
      preset: string;
    };
    academicBatch: string;
    generatedAt: Date;
    courseCount: number;
    provisionalCourses: string[];
  };
  methodology: {
    internalThresholdPercent: number;
    internalLevelBands: Array<{ level: number; minPercent: number }>;
    externalLevelBands: Array<{ level: number; minPercent: number }>;
    directWeights: { internal: number; external: number };
    overallWeights: { direct: number; indirect: number };
    targetAttainmentLevel: number;
    maxAttainmentLevel: number;
  };
  section3_1_1: Array<{
    subjectCode: string;
    subjectName: string;
    semesterNumber?: number;
    cos: Array<{ code: string; statement: string; bloomLevel?: number }>;
  }>;
  section3_1_2: Array<{
    subjectCode: string;
    subjectName: string;
    poCodes: string[];
    psoCodes: string[];
    rows: Array<{ coCode: string; poCells: Array<number | null>; psoCells: Array<number | null> }>;
  }>;
  section3_1_3: {
    poCodes: string[];
    psoCodes: string[];
    courses: Array<{
      subjectCode: string;
      subjectName: string;
      semesterNumber?: number;
      cells: Array<number | null>;
      psoCells: Array<number | null>;
    }>;
  };
  section3_2_2: Array<{
    subjectCode: string;
    subjectName: string;
    cohortSize: number;
    surveyRespondents: number;
    courseAverage: number | null;
    cos: Array<{
      code: string;
      internal: number | null;
      external: number | null;
      direct: number | null;
      indirect: number | null;
      overall: number | null;
      targetMet: boolean;
    }>;
  }>;
  section3_3_2: {
    pos: Array<{ code: string; title: string; statement: string }>;
    psos: Array<{ code: string; statement: string }>;
    poAggregate: Array<{
      code: string;
      attainment: number | null;
      contributingCourses: number;
      target: number;
      targetMet: boolean;
    }>;
    psoAggregate: Array<{
      code: string;
      attainment: number | null;
      contributingCourses: number;
      target: number;
      targetMet: boolean;
    }>;
  };
  section3_4: {
    outcomeGaps: Array<{
      kind: string;
      code: string;
      attainment: number | null;
      target: number;
      gap: number | null;
      actionTaken?: string;
    }>;
    courseGaps: Array<{
      subjectCode: string;
      coCode: string;
      attainment: number | null;
      target: number;
      actionTaken?: string;
    }>;
  };
}

function contentWidth(doc: Doc): number {
  return doc.page.width - doc.page.margins.left - doc.page.margins.right;
}

/** Break to a new page when the next block wouldn't fit. */
function ensureSpace(doc: Doc, needed: number) {
  if (doc.y + needed > doc.page.height - doc.page.margins.bottom) {
    doc.addPage();
  }
}

function sectionHeading(doc: Doc, number: string, title: string) {
  ensureSpace(doc, 60);
  doc.moveDown(1);
  doc
    .font('Helvetica-Bold')
    .fontSize(12)
    .fillColor(NAVY)
    .text(`${number}  ${title}`, doc.page.margins.left, doc.y, { width: contentWidth(doc) });
  doc
    .moveTo(doc.page.margins.left, doc.y + 4)
    .lineTo(doc.page.margins.left + contentWidth(doc), doc.y + 4)
    .lineWidth(0.7)
    .strokeColor(RULE)
    .stroke();
  doc.moveDown(0.8);
  doc.fillColor('#0f172a');
}

function paragraph(doc: Doc, text: string) {
  ensureSpace(doc, 40);
  doc
    .font('Helvetica')
    .fontSize(9.5)
    .fillColor(SLATE)
    .text(text, doc.page.margins.left, doc.y, { width: contentWidth(doc), align: 'left' });
  doc.moveDown(0.5);
  doc.fillColor('#0f172a');
}

interface TableOptions {
  headers: string[];
  widths: number[];
  rows: Array<Array<{ text: string; color?: string; bold?: boolean }>>;
  fontSize?: number;
  /**
   * Let cells wrap onto multiple lines and grow the row to fit. Used for the
   * prose columns (CO statements, action taken) — a fixed row height silently
   * drew those over the rule below them.
   */
  wrap?: boolean;
}

/** A ruled table that repeats its header row after a page break. */
function table(doc: Doc, { headers, widths, rows, fontSize = 8.5, wrap = false }: TableOptions) {
  const left = doc.page.margins.left;
  const totalWidth = widths.reduce((a, b) => a + b, 0);
  const padding = 10;
  const headerHeight = fontSize + padding;

  const heightOf = (row: TableOptions['rows'][number]): number => {
    if (!wrap) return fontSize + padding;
    const tallest = Math.max(
      ...row.map((cell, i) => {
        doc.font(cell.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(fontSize);
        return doc.heightOfString(cell.text || ' ', { width: widths[i] - 8 });
      })
    );
    return Math.max(fontSize + padding, tallest + padding - 2);
  };

  const drawHeader = () => {
    const y = doc.y;
    doc.rect(left, y, totalWidth, headerHeight).fill(SOFT_BG);
    let x = left + 5;
    headers.forEach((header, i) => {
      doc
        .font('Helvetica-Bold')
        .fontSize(fontSize)
        .fillColor(SLATE)
        .text(header, x, y + 5, { width: widths[i] - 8, ellipsis: true, lineBreak: false });
      x += widths[i];
    });
    doc.y = y + headerHeight;
  };

  ensureSpace(doc, headerHeight * 3);
  drawHeader();

  for (const row of rows) {
    const rowHeight = heightOf(row);
    if (doc.y + rowHeight > doc.page.height - doc.page.margins.bottom) {
      doc.addPage();
      drawHeader();
    }
    const y = doc.y;
    let x = left + 5;
    row.forEach((cell, i) => {
      doc
        .font(cell.bold ? 'Helvetica-Bold' : 'Helvetica')
        .fontSize(fontSize)
        .fillColor(cell.color ?? '#0f172a')
        .text(cell.text, x, y + 4, {
          width: widths[i] - 8,
          ...(wrap ? { height: rowHeight - 6 } : { ellipsis: true, lineBreak: false }),
        });
      x += widths[i];
    });
    doc
      .moveTo(left, y + rowHeight - 1)
      .lineTo(left + totalWidth, y + rowHeight - 1)
      .lineWidth(0.4)
      .strokeColor(RULE)
      .stroke();
    doc.y = y + rowHeight;
  }
  doc.fillColor('#0f172a');
  doc.moveDown(0.6);
}

function num(value: number | null | undefined, dashes = '—'): string {
  return value === null || value === undefined ? dashes : value.toFixed(2);
}

function coverPage(doc: Doc, report: NbaReport, title: string, subtitle: string) {
  const left = doc.page.margins.left;
  const width = contentWidth(doc);

  doc.rect(left, doc.page.margins.top, width, 92).fill(NAVY);
  doc
    .fillColor('#ffffff')
    .font('Helvetica-Bold')
    .fontSize(19)
    .text(
      String(report.meta.institution?.name ?? report.meta.branchName ?? 'Institution'),
      left + 20,
      doc.page.margins.top + 18,
      {
        width: width - 40,
      }
    );
  doc
    .font('Helvetica')
    .fontSize(10.5)
    .fillColor('#cbd5e1')
    .text(subtitle, left + 20, doc.page.margins.top + 46, { width: width - 40 });
  doc
    .font('Helvetica-Bold')
    .fontSize(12)
    .fillColor('#ffffff')
    .text(title, left + 20, doc.page.margins.top + 64, { width: width - 40 });

  doc.y = doc.page.margins.top + 110;
  doc.fillColor('#0f172a');

  const facts: Array<[string, string]> = [
    ['Program', report.meta.program.curriculumProgramName ?? report.meta.program.name],
    ['Department', report.meta.program.departmentCode],
    ['Academic batch', report.meta.academicBatch],
    ['Courses covered', String(report.meta.courseCount)],
    ['Generated', new Date(report.meta.generatedAt).toLocaleString('en-IN')],
  ];

  table(doc, {
    headers: ['Field', 'Value'],
    widths: [width * 0.35, width * 0.65],
    rows: facts.map(([k, v]) => [{ text: k, bold: true }, { text: v }]),
    fontSize: 9.5,
  });

  if (report.meta.provisionalCourses.length > 0) {
    paragraph(
      doc,
      `Note: ${report.meta.provisionalCourses.length} course(s) in this window are computed but not yet finalized (${report.meta.provisionalCourses.join(', ')}). Their figures are provisional and may change when the department finalizes the offering.`
    );
  }
}

/** NBA SAR Criterion 3 as a printable file. */
export async function renderNbaCriterion3Pdf(report: NbaReport): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 36,
        info: {
          Title: `NBA SAR Criterion 3 — ${report.meta.program.name}`,
          Author: String(report.meta.institution?.name ?? 'Institution'),
          Subject: 'Course Outcomes and Program Outcomes',
        },
      });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const width = contentWidth(doc);

      coverPage(
        doc,
        report,
        'Criterion 3 — Course Outcomes and Program Outcomes',
        'National Board of Accreditation · Self Assessment Report'
      );

      // ── Methodology ───────────────────────────────────────────────────────
      sectionHeading(doc, '3.0', 'Assessment process and attainment methodology');
      const m = report.methodology;
      paragraph(
        doc,
        `A student is counted as having cleared an internal assessment component by scoring more than ${m.internalThresholdPercent}% of its maximum marks. The percentage of attempting students clearing each component is converted to an attainment level using the internal bands below; the end-semester examination is levelled on the percentage of students meeting the pass mark.`
      );
      paragraph(
        doc,
        `Direct attainment = ${m.directWeights.internal} × internal + ${m.directWeights.external} × external. Overall attainment = ${m.overallWeights.direct} × direct + ${m.overallWeights.indirect} × indirect (course-end student survey). A Course Outcome is treated as attained at level ${m.targetAttainmentLevel} or above on a ${m.maxAttainmentLevel}-point scale. PO attainment = (CO-PO column average × course CO average) ÷ ${m.maxAttainmentLevel}.`
      );
      table(doc, {
        headers: ['Level', 'Internal — % of students clearing', 'External — % of students passing'],
        widths: [width * 0.2, width * 0.4, width * 0.4],
        rows: m.internalLevelBands.map((band, i) => [
          { text: String(band.level), bold: true },
          // Standard-14 Helvetica is WinAnsi-encoded: it has no U+2265, which
          // renders as mojibake. Plain ">=" is safe in every PDF viewer.
          { text: `>= ${band.minPercent}%` },
          { text: m.externalLevelBands[i] ? `>= ${m.externalLevelBands[i].minPercent}%` : '-' },
        ]),
      });

      // ── 3.1.1 Course outcomes ─────────────────────────────────────────────
      sectionHeading(doc, '3.1.1', 'Course Outcomes of every course');
      for (const course of report.section3_1_1) {
        ensureSpace(doc, 80);
        doc
          .font('Helvetica-Bold')
          .fontSize(10)
          .fillColor('#0f172a')
          .text(
            `${course.subjectCode} — ${course.subjectName}${course.semesterNumber ? ` (Semester ${course.semesterNumber})` : ''}`,
            doc.page.margins.left,
            doc.y,
            { width }
          );
        doc.moveDown(0.3);
        table(doc, {
          headers: ['CO', 'Statement', "Bloom's level"],
          widths: [width * 0.1, width * 0.75, width * 0.15],
          rows: course.cos.map((co) => [
            { text: co.code, bold: true },
            { text: co.statement || '—' },
            { text: co.bloomLevel ? String(co.bloomLevel) : '—' },
          ]),
          wrap: true,
        });
      }

      // ── 3.1.2 Per-course articulation ────────────────────────────────────
      sectionHeading(doc, '3.1.2', 'CO-PO and CO-PSO articulation matrix of each course');
      paragraph(
        doc,
        'Correlation levels: 1 = Low, 2 = Medium, 3 = High. A blank cell means the Course Outcome is not mapped to that outcome.'
      );
      for (const course of report.section3_1_2) {
        ensureSpace(doc, 90);
        doc
          .font('Helvetica-Bold')
          .fontSize(10)
          .fillColor('#0f172a')
          .text(`${course.subjectCode} — ${course.subjectName}`, doc.page.margins.left, doc.y, {
            width,
          });
        doc.moveDown(0.3);
        const codes = [...course.poCodes, ...course.psoCodes];
        const firstCol = width * 0.12;
        const cellWidth = (width - firstCol) / Math.max(codes.length, 1);
        table(doc, {
          headers: ['CO', ...codes],
          widths: [firstCol, ...codes.map(() => cellWidth)],
          rows: course.rows.map((row) => [
            { text: row.coCode, bold: true },
            ...[...row.poCells, ...row.psoCells].map((cell) => ({
              text: cell === null ? '' : String(cell),
            })),
          ]),
          fontSize: 8,
        });
      }

      // ── 3.1.3 Program matrix (landscape) ─────────────────────────────────
      doc.addPage({ size: 'A4', layout: 'landscape', margin: 36 });
      doc.y = doc.page.margins.top;
      sectionHeading(doc, '3.1.3', 'Program-level course articulation matrix');
      paragraph(
        doc,
        'Each cell is the mean correlation of that course’s mapped Course Outcomes against the outcome — the convention used in SAR program articulation tables.'
      );
      {
        const landscapeWidth = contentWidth(doc);
        const codes = [...report.section3_1_3.poCodes, ...report.section3_1_3.psoCodes];
        const firstCol = landscapeWidth * 0.18;
        const cellWidth = (landscapeWidth - firstCol) / Math.max(codes.length, 1);
        table(doc, {
          headers: ['Course', ...codes],
          widths: [firstCol, ...codes.map(() => cellWidth)],
          rows: report.section3_1_3.courses.map((course) => [
            { text: course.subjectCode, bold: true },
            ...[...course.cells, ...course.psoCells].map((cell) => ({ text: num(cell, '') })),
          ]),
          fontSize: 7.5,
        });
      }

      // ── 3.2.2 CO attainment ───────────────────────────────────────────────
      doc.addPage({ size: 'A4', margin: 36 });
      doc.y = doc.page.margins.top;
      sectionHeading(doc, '3.2.2', 'Attainment of Course Outcomes');
      for (const course of report.section3_2_2) {
        ensureSpace(doc, 90);
        doc
          .font('Helvetica-Bold')
          .fontSize(10)
          .fillColor('#0f172a')
          .text(`${course.subjectCode} — ${course.subjectName}`, doc.page.margins.left, doc.y, {
            width,
          });
        doc
          .font('Helvetica')
          .fontSize(8.5)
          .fillColor(SLATE_LIGHT)
          .text(
            `Cohort ${course.cohortSize} · survey respondents ${course.surveyRespondents} · course average ${num(course.courseAverage)}`,
            doc.page.margins.left,
            doc.y + 2,
            { width }
          );
        doc.moveDown(0.6);
        doc.fillColor('#0f172a');
        table(doc, {
          headers: ['CO', 'Internal', 'External', 'Direct', 'Indirect', 'Overall', 'Target met'],
          widths: [
            width * 0.12,
            width * 0.14,
            width * 0.14,
            width * 0.14,
            width * 0.14,
            width * 0.16,
            width * 0.16,
          ],
          rows: course.cos.map((co) => [
            { text: co.code, bold: true },
            { text: num(co.internal) },
            { text: num(co.external) },
            { text: num(co.direct) },
            { text: num(co.indirect) },
            { text: num(co.overall), bold: true },
            { text: co.targetMet ? 'Yes' : 'No', color: co.targetMet ? GOOD : BAD },
          ]),
        });
      }

      // ── 3.3.2 PO/PSO attainment ───────────────────────────────────────────
      sectionHeading(doc, '3.3.2', 'Attainment of Program Outcomes and Program Specific Outcomes');
      table(doc, {
        headers: ['Outcome', 'Statement', 'Courses', 'Attainment', 'Target', 'Met'],
        widths: [width * 0.1, width * 0.44, width * 0.1, width * 0.14, width * 0.1, width * 0.12],
        rows: [
          ...report.section3_3_2.poAggregate.map((row) => {
            const po = report.section3_3_2.pos.find((p) => p.code === row.code);
            return [
              { text: row.code, bold: true },
              { text: po?.title || po?.statement || '—' },
              { text: String(row.contributingCourses) },
              { text: num(row.attainment), bold: true },
              { text: row.target.toFixed(2) },
              { text: row.targetMet ? 'Yes' : 'No', color: row.targetMet ? GOOD : BAD },
            ];
          }),
          ...report.section3_3_2.psoAggregate.map((row) => {
            const pso = report.section3_3_2.psos.find((p) => p.code === row.code);
            return [
              { text: row.code, bold: true },
              { text: pso?.statement || '—' },
              { text: String(row.contributingCourses) },
              { text: num(row.attainment), bold: true },
              { text: row.target.toFixed(2) },
              { text: row.targetMet ? 'Yes' : 'No', color: row.targetMet ? GOOD : BAD },
            ];
          }),
        ],
        wrap: true,
      });

      // ── 3.4 Gap analysis ──────────────────────────────────────────────────
      sectionHeading(doc, '3.4', 'Gap analysis and action taken');
      if (report.section3_4.outcomeGaps.length === 0 && report.section3_4.courseGaps.length === 0) {
        paragraph(
          doc,
          'Every Program Outcome, Program Specific Outcome and Course Outcome in this window met the target attainment level. No corrective action was required.'
        );
      } else {
        if (report.section3_4.outcomeGaps.length > 0) {
          table(doc, {
            headers: ['Type', 'Outcome', 'Attained', 'Target', 'Gap', 'Action taken'],
            widths: [
              width * 0.08,
              width * 0.12,
              width * 0.12,
              width * 0.1,
              width * 0.1,
              width * 0.48,
            ],
            rows: report.section3_4.outcomeGaps.map((gap) => [
              { text: gap.kind },
              { text: gap.code, bold: true },
              { text: num(gap.attainment), color: BAD },
              { text: gap.target.toFixed(2) },
              { text: num(gap.gap) },
              { text: gap.actionTaken || 'Not recorded' },
            ]),
            wrap: true,
          });
        }
        if (report.section3_4.courseGaps.length > 0) {
          paragraph(doc, 'Course Outcomes below target:');
          table(doc, {
            headers: ['Course', 'CO', 'Attained', 'Target', 'Action taken'],
            widths: [width * 0.16, width * 0.1, width * 0.12, width * 0.1, width * 0.52],
            rows: report.section3_4.courseGaps.map((gap) => [
              { text: gap.subjectCode, bold: true },
              { text: gap.coCode },
              { text: num(gap.attainment), color: BAD },
              { text: gap.target.toFixed(2) },
              { text: gap.actionTaken || 'Not recorded' },
            ]),
            wrap: true,
          });
        }
      }

      doc.end();
    } catch (error) {
      reject(error as Error);
    }
  });
}

interface NaacReport {
  meta: {
    program: { name: string; departmentCode: string; curriculumProgramName: string | null };
    generatedAt: Date;
  };
  metric2_6_1: {
    posDefined: number;
    psosDefined: number;
    coursesWithCos: number;
    totalCourses: number;
    cosDefined: number;
    statement: string;
  };
  metric2_6_2: {
    methodology: string;
    targetLevel: number;
    maxLevel: number;
    cosEvaluated: number;
    cosAttained: number;
    attainmentRate: number | null;
    coursesWithIndirectEvidence: number;
    coursesEvaluated: number;
  };
  metric2_6_3: {
    courses: Array<{
      subjectCode: string;
      appeared: number;
      passed: number;
      passPercentage: number | null;
    }>;
    appeared: number;
    passed: number;
    passPercentage: number | null;
    note?: string;
  };
}

/** NAAC SSR Key Indicator 2.6 as a printable file. */
export async function renderNaacKeyIndicator26Pdf(report: NaacReport): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 36,
        info: {
          Title: `NAAC SSR 2.6 — ${report.meta.program.name}`,
          Subject: 'Student Performance and Learning Outcomes',
        },
      });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const width = contentWidth(doc);
      const left = doc.page.margins.left;

      doc.rect(left, doc.page.margins.top, width, 78).fill(NAVY);
      doc
        .fillColor('#ffffff')
        .font('Helvetica-Bold')
        .fontSize(17)
        .text(
          'Criterion 2 — Teaching, Learning and Evaluation',
          left + 20,
          doc.page.margins.top + 16,
          {
            width: width - 40,
          }
        );
      doc
        .font('Helvetica')
        .fontSize(10.5)
        .fillColor('#cbd5e1')
        .text(
          'Key Indicator 2.6 — Student Performance and Learning Outcomes',
          left + 20,
          doc.page.margins.top + 42,
          { width: width - 40 }
        );
      doc
        .fontSize(9)
        .text(
          `${report.meta.program.curriculumProgramName ?? report.meta.program.name} · ${report.meta.program.departmentCode} · generated ${new Date(report.meta.generatedAt).toLocaleString('en-IN')}`,
          left + 20,
          doc.page.margins.top + 58,
          { width: width - 40 }
        );

      doc.y = doc.page.margins.top + 96;
      doc.fillColor('#0f172a');

      sectionHeading(doc, '2.6.1', 'Programme and course outcomes are stated and displayed');
      paragraph(doc, report.metric2_6_1.statement);
      table(doc, {
        headers: ['Element', 'Count'],
        widths: [width * 0.7, width * 0.3],
        rows: [
          [{ text: 'Program Outcomes defined' }, { text: String(report.metric2_6_1.posDefined) }],
          [
            { text: 'Program Specific Outcomes defined' },
            { text: String(report.metric2_6_1.psosDefined) },
          ],
          [
            { text: 'Courses with Course Outcomes defined' },
            {
              text: `${report.metric2_6_1.coursesWithCos} of ${report.metric2_6_1.totalCourses}`,
            },
          ],
          [{ text: 'Course Outcomes defined' }, { text: String(report.metric2_6_1.cosDefined) }],
        ],
        fontSize: 9.5,
      });

      sectionHeading(doc, '2.6.2', 'Attainment of programme and course outcomes is evaluated');
      paragraph(doc, report.metric2_6_2.methodology);
      table(doc, {
        headers: ['Measure', 'Value'],
        widths: [width * 0.7, width * 0.3],
        rows: [
          [
            { text: 'Target attainment level' },
            {
              text: `${report.metric2_6_2.targetLevel} of ${report.metric2_6_2.maxLevel}`,
            },
          ],
          [
            { text: 'Course Outcomes evaluated' },
            { text: String(report.metric2_6_2.cosEvaluated) },
          ],
          [{ text: 'Course Outcomes attained' }, { text: String(report.metric2_6_2.cosAttained) }],
          [
            { text: 'Attainment rate' },
            {
              text:
                report.metric2_6_2.attainmentRate === null
                  ? '—'
                  : `${report.metric2_6_2.attainmentRate}%`,
              bold: true,
            },
          ],
          [
            { text: 'Courses with indirect (survey) evidence' },
            {
              text: `${report.metric2_6_2.coursesWithIndirectEvidence} of ${report.metric2_6_2.coursesEvaluated}`,
            },
          ],
        ],
        fontSize: 9.5,
      });

      sectionHeading(doc, '2.6.3', 'Pass percentage of students');
      if (report.metric2_6_3.note) {
        paragraph(doc, report.metric2_6_3.note);
      } else {
        table(doc, {
          headers: ['Course', 'Appeared', 'Passed', 'Pass %'],
          widths: [width * 0.4, width * 0.2, width * 0.2, width * 0.2],
          rows: [
            ...report.metric2_6_3.courses.map((row) => [
              { text: row.subjectCode, bold: true },
              { text: String(row.appeared) },
              { text: String(row.passed) },
              { text: row.passPercentage === null ? '—' : `${row.passPercentage.toFixed(2)}%` },
            ]),
            [
              { text: 'Overall', bold: true },
              { text: String(report.metric2_6_3.appeared), bold: true },
              { text: String(report.metric2_6_3.passed), bold: true },
              {
                text:
                  report.metric2_6_3.passPercentage === null
                    ? '—'
                    : `${report.metric2_6_3.passPercentage.toFixed(2)}%`,
                bold: true,
              },
            ],
          ],
          fontSize: 9.5,
        });
      }

      doc.end();
    } catch (error) {
      reject(error as Error);
    }
  });
}
