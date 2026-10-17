import { ObjectId, WithId, Document, Filter } from 'mongodb';
import { collections } from '../../config/database';
import { ApiError } from '../../middleware/errorHandler';
import { obeProgramService } from './program.service';
import { obeOfferingService } from './offering.service';
import { obeAttainmentService, type ObeAttainmentDocument } from './attainment.service';
import { type ObeCourseOutcomeDocument } from './outcome.service';
import { serializeCsv } from './csv';

interface CoRow {
  coId: string;
  code: string;
  internalAttainment: number | null;
  externalAttainment: number | null;
  directAttainment: number | null;
  indirectAttainment: number | null;
  overallAttainment: number | null;
  targetMet: boolean;
}

interface OutcomeRow {
  outcomeId: string;
  code: string;
  weightedAverage: number | null;
  attainment: number | null;
}

function mean2(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round((values.reduce((s, v) => s + v, 0) / values.length) * 100) / 100;
}

class ObeReportService {
  /**
   * Program-level PO/PSO dashboard: every computed offering's contribution
   * plus the program aggregate (mean over courses that map each outcome).
   */
  async programAttainment(
    tenantId: string,
    branchId: string,
    programId: string,
    filters: { academicBatchId?: string; termId?: string }
  ) {
    const program = await obeProgramService.getDoc(tenantId, branchId, programId);

    const filter: Filter<Document> = {
      tenantId: program.tenantId,
      branchId: program.branchId,
      programId: program._id,
    };
    if (filters.academicBatchId) filter.academicBatchId = new ObjectId(filters.academicBatchId);
    if (filters.termId) filter.termId = new ObjectId(filters.termId);

    const attainments = (await collections.obeAttainments
      .find(filter)
      .sort({ semesterNumber: 1, subjectCode: 1 })
      .toArray()) as WithId<ObeAttainmentDocument>[];

    const courses = attainments.map((doc) => ({
      offeringId: doc.offeringId.toString(),
      subjectCode: doc.subjectCode,
      semesterNumber: doc.semesterNumber,
      computedAt: doc.computedAt,
      isFinal: doc.isFinal,
      courseAverageCoAttainment: doc.courseAverageCoAttainment,
      poAttainment: doc.poAttainment as OutcomeRow[],
      psoAttainment: doc.psoAttainment as OutcomeRow[],
    }));

    const aggregate = (
      outcomes: { _id: ObjectId; code: string }[],
      pick: (course: (typeof courses)[number]) => OutcomeRow[]
    ) =>
      outcomes.map((outcome) => {
        const values = courses
          .map((course) => pick(course).find((row) => row.outcomeId === outcome._id.toString()))
          .filter((row): row is OutcomeRow => Boolean(row))
          .map((row) => row.attainment)
          .filter((v): v is number => v !== null);
        return {
          outcomeId: outcome._id.toString(),
          code: outcome.code,
          attainment: mean2(values),
          contributingCourses: values.length,
        };
      });

    const batchActions = filters.academicBatchId
      ? (program.poCorrectiveActions ?? []).filter(
          (a) => a.academicBatchId.toString() === filters.academicBatchId
        )
      : [];

    return {
      program: {
        _id: program._id.toString(),
        name: program.name,
        departmentCode: program.departmentCode,
        pos: program.pos.map((po) => ({ _id: po._id.toString(), code: po.code, title: po.title })),
        psos: program.psos.map((pso) => ({ _id: pso._id.toString(), code: pso.code })),
      },
      courses,
      poAggregate: aggregate(program.pos, (c) => c.poAttainment),
      psoAggregate: aggregate(program.psos, (c) => c.psoAttainment),
      poCorrectiveActions: batchActions.map((a) => ({
        poId: a.poId.toString(),
        text: a.text,
        updatedAt: a.updatedAt,
      })),
    };
  }

  /** Course attainment report as CSV (CO table + annexures + PO/PSO tables). */
  async courseReportCsv(tenantId: string, branchId: string, offeringId: string): Promise<string> {
    const offering = await obeOfferingService.getDoc(tenantId, branchId, offeringId);
    const attainment = await obeAttainmentService.get(tenantId, branchId, offeringId);
    const outcomeDoc = (await collections.obeCourseOutcomes.findOne({
      tenantId: offering.tenantId,
      subjectId: offering.subjectId,
      programId: offering.programId,
    })) as WithId<ObeCourseOutcomeDocument> | null;
    const statementByCo = new Map(
      (outcomeDoc?.cos ?? []).map((co) => [co._id.toString(), co.statement])
    );
    const actionByCo = new Map(attainment.coCorrectiveActions.map((a) => [a.coId, a.text]));

    const rows: (string | number | null | undefined)[][] = [];
    rows.push([`${offering.subjectCode} — ${offering.subjectName}`]);
    rows.push([`Term: ${offering.termName}`, `Computed: ${attainment.computedAt.toISOString()}`]);
    rows.push([
      `Cohort: ${attainment.cohortSize}`,
      `Survey respondents: ${attainment.surveyRespondents}`,
    ]);
    rows.push([]);

    rows.push(['CO Attainment']);
    rows.push([
      'CO',
      'Statement',
      'Internal (IE)',
      'External (EE)',
      'Direct',
      'Indirect',
      'Overall',
      'Target met',
      'Corrective action',
    ]);
    for (const co of attainment.perCo as CoRow[]) {
      rows.push([
        co.code,
        statementByCo.get(co.coId),
        co.internalAttainment,
        co.externalAttainment,
        co.directAttainment,
        co.indirectAttainment,
        co.overallAttainment,
        co.targetMet ? 'yes' : 'no',
        actionByCo.get(co.coId),
      ]);
    }
    rows.push([
      'Course average CO attainment',
      '',
      '',
      '',
      '',
      '',
      attainment.courseAverageCoAttainment,
    ]);
    rows.push([]);

    for (const instrument of attainment.perInstrument as {
      name: string;
      kind: string;
      items?: {
        setLabel: string;
        label: string;
        coIds: string[];
        maxMarks: number;
        attempted: number;
        cleared: number;
        percentCleared: number | null;
        level: number | null;
      }[];
      external?: {
        present: number;
        passed: number;
        percentPassed: number | null;
        level: number | null;
      };
    }[]) {
      rows.push([`Annexure — ${instrument.name}`]);
      if (instrument.kind === 'internal' && instrument.items) {
        rows.push([
          'Set',
          'Question',
          'COs',
          'Max marks',
          'Attempted',
          'Cleared threshold',
          '% cleared',
          'Level',
        ]);
        const codeByCo = new Map((attainment.perCo as CoRow[]).map((co) => [co.coId, co.code]));
        for (const item of instrument.items) {
          rows.push([
            item.setLabel,
            item.label,
            item.coIds.map((id) => codeByCo.get(id) ?? id).join(' '),
            item.maxMarks,
            item.attempted,
            item.cleared,
            item.percentCleared,
            item.level,
          ]);
        }
      } else if (instrument.external) {
        rows.push(['Present', 'Passed', '% passed', 'Level']);
        rows.push([
          instrument.external.present,
          instrument.external.passed,
          instrument.external.percentPassed,
          instrument.external.level,
        ]);
      }
      rows.push([]);
    }

    const outcomeTable = (title: string, entries: OutcomeRow[]) => {
      rows.push([title]);
      rows.push(['Outcome', 'Weighted average', 'Attainment']);
      for (const entry of entries) {
        rows.push([entry.code, entry.weightedAverage ?? '-', entry.attainment ?? '-']);
      }
      rows.push([]);
    };
    outcomeTable('PO Attainment', attainment.poAttainment as OutcomeRow[]);
    outcomeTable('PSO Attainment', attainment.psoAttainment as OutcomeRow[]);

    return serializeCsv(rows);
  }

  /** Program PO/PSO table as CSV: one row per course, aggregate row at the end. */
  async programReportCsv(
    tenantId: string,
    branchId: string,
    programId: string,
    filters: { academicBatchId?: string; termId?: string }
  ): Promise<string> {
    const report = await this.programAttainment(tenantId, branchId, programId, filters);
    if (report.courses.length === 0) {
      throw new ApiError('NO_DATA', 'No computed offerings match the selected filters', 404);
    }

    const outcomes = [
      ...report.program.pos,
      ...report.program.psos.map((pso) => ({ ...pso, title: undefined })),
    ];
    const rows: (string | number | null | undefined)[][] = [];
    rows.push([`${report.program.name} (${report.program.departmentCode}) — PO/PSO Attainment`]);
    rows.push([]);
    rows.push(['Course', 'Semester', 'CO average', ...outcomes.map((o) => o.code)]);
    for (const course of report.courses) {
      const byOutcome = new Map(
        [...course.poAttainment, ...course.psoAttainment].map((row) => [
          row.outcomeId,
          row.attainment,
        ])
      );
      rows.push([
        course.subjectCode,
        course.semesterNumber ?? '-',
        course.courseAverageCoAttainment ?? '-',
        ...outcomes.map((o) => byOutcome.get(o._id) ?? '-'),
      ]);
    }
    const aggregateByOutcome = new Map(
      [...report.poAggregate, ...report.psoAggregate].map((row) => [row.outcomeId, row.attainment])
    );
    rows.push([
      'Program attainment',
      '',
      '',
      ...outcomes.map((o) => aggregateByOutcome.get(o._id) ?? '-'),
    ]);
    return serializeCsv(rows);
  }
}

export const obeReportService = new ObeReportService();
