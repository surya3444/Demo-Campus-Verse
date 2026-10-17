import { ObjectId, WithId, Document, Filter } from 'mongodb';
import { collections } from '../../config/database';
import { ApiError } from '../../middleware/errorHandler';
import { obeProgramService } from './program.service';
import { obeSettingsService } from './settings.service';
import { type ObeAttainmentDocument } from './attainment.service';
import { type ObeCourseOutcomeDocument } from './outcome.service';

/**
 * Accreditation document builders — NBA SAR Criterion 3, NAAC SSR Criterion 2
 * (Key Indicator 2.6), and the OBE-derived slice of NIRF.
 *
 * These are *documents*, not dashboards: they follow the section numbering an
 * assessor expects, restate the methodology in prose, and every number is
 * pulled from computed attainment records rather than typed in. Nothing is
 * invented — where the ERP has no source for a required field, the report says
 * so explicitly instead of emitting a plausible zero (an accreditation file
 * with fabricated figures is worse than an incomplete one).
 *
 * Reference practice: NBA SAR Tier-I/II Criterion 3 (3.1 CO-PO articulation,
 * 3.2 CO attainment, 3.3 PO/PSO attainment + gap analysis and action taken)
 * and NAAC SSR 2.6.1-2.6.3 (outcomes stated, attainment evaluated, pass
 * percentage).
 */

const STRENGTH_LABELS: Record<number, string> = { 1: 'Low', 2: 'Medium', 3: 'High' };

export interface AccreditationCourse {
  offeringId: string;
  subjectCode: string;
  subjectName: string;
  semesterNumber?: number;
  termName: string;
  cohortSize: number;
  isFinal: boolean;
  computedAt: Date;
  cos: Array<{
    coId: string;
    code: string;
    statement: string;
    bloomLevel?: number;
    internal: number | null;
    external: number | null;
    direct: number | null;
    indirect: number | null;
    overall: number | null;
    targetMet: boolean;
    correctiveAction?: string;
  }>;
  courseAverage: number | null;
  /** CO × PO strength grid for section 3.1.2 (null = unmapped). */
  articulation: Array<{ coCode: string; cells: Array<number | null> }>;
  psoArticulation: Array<{ coCode: string; cells: Array<number | null> }>;
  poAttainment: Array<{ code: string; weightedAverage: number | null; attainment: number | null }>;
  psoAttainment: Array<{ code: string; weightedAverage: number | null; attainment: number | null }>;
  surveyRespondents: number;
}

function mean2(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round((values.reduce((s, v) => s + v, 0) / values.length) * 100) / 100;
}

class AccreditationService {
  /**
   * The shared data pull behind every report: program identity, its POs/PSOs,
   * every computed offering in the filtered window, and each offering's CO
   * definitions and articulation matrix.
   */
  private async gather(
    tenantId: string,
    branchId: string,
    programId: string,
    filters: { academicBatchId?: string; termId?: string }
  ) {
    const program = await obeProgramService.getDoc(tenantId, branchId, programId);
    const settings = await obeSettingsService.getSettings(tenantId, branchId);

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

    const subjectIds = [...new Set(attainments.map((a) => a.subjectId.toString()))];
    const outcomeDocs = subjectIds.length
      ? ((await collections.obeCourseOutcomes
          .find({
            tenantId: program.tenantId,
            programId: program._id,
            subjectId: { $in: subjectIds.map((id) => new ObjectId(id)) },
          })
          .toArray()) as WithId<ObeCourseOutcomeDocument>[])
      : [];
    const outcomesBySubject = new Map(outcomeDocs.map((doc) => [doc.subjectId.toString(), doc]));

    const offeringIds = attainments.map((a) => a.offeringId);
    const offerings = offeringIds.length
      ? await collections.obeOfferings
          .find({ _id: { $in: offeringIds } })
          .project({ termName: 1, coCorrectiveActions: 1, credits: 1, subjectName: 1 })
          .toArray()
      : [];
    const offeringById = new Map(offerings.map((o) => [o._id.toString(), o]));

    const poIds = program.pos.map((po) => po._id.toString());
    const psoIds = program.psos.map((pso) => pso._id.toString());

    const courses: AccreditationCourse[] = attainments.map((attainment) => {
      const outcomeDoc = outcomesBySubject.get(attainment.subjectId.toString());
      const statements = new Map(
        (outcomeDoc?.cos ?? []).map((co) => [
          co._id.toString(),
          { statement: co.statement, bloomLevel: co.bloomLevel },
        ])
      );
      const offering = offeringById.get(attainment.offeringId.toString());
      const actions = new Map(
        ((offering?.coCorrectiveActions ?? []) as Array<{ coId: ObjectId; text: string }>).map(
          (a) => [a.coId.toString(), a.text]
        )
      );

      const strengthFor = (
        cells: Array<{ coId: ObjectId; poId?: ObjectId; psoId?: ObjectId; strength: number }>,
        coId: string,
        targetId: string,
        key: 'poId' | 'psoId'
      ): number | null => {
        const cell = cells.find(
          (c) => c.coId.toString() === coId && c[key]?.toString() === targetId
        );
        return cell ? cell.strength : null;
      };

      const perCo = attainment.perCo as Array<{
        coId: string;
        code: string;
        internalAttainment: number | null;
        externalAttainment: number | null;
        directAttainment: number | null;
        indirectAttainment: number | null;
        overallAttainment: number | null;
        targetMet: boolean;
      }>;

      return {
        offeringId: attainment.offeringId.toString(),
        subjectCode: attainment.subjectCode,
        // Attainment rows don't carry the subject name; the offering does.
        subjectName: String(
          offering?.subjectName ?? attainment.subjectName ?? attainment.subjectCode
        ),
        semesterNumber: attainment.semesterNumber,
        termName: String(offering?.termName ?? ''),
        cohortSize: attainment.cohortSize,
        isFinal: attainment.isFinal,
        computedAt: attainment.computedAt,
        cos: perCo.map((co) => ({
          coId: co.coId,
          code: co.code,
          statement: statements.get(co.coId)?.statement ?? '',
          bloomLevel: statements.get(co.coId)?.bloomLevel,
          internal: co.internalAttainment,
          external: co.externalAttainment,
          direct: co.directAttainment,
          indirect: co.indirectAttainment,
          overall: co.overallAttainment,
          targetMet: co.targetMet,
          correctiveAction: actions.get(co.coId),
        })),
        courseAverage: attainment.courseAverageCoAttainment,
        articulation: perCo.map((co) => ({
          coCode: co.code,
          cells: poIds.map((poId) =>
            strengthFor(outcomeDoc?.poMapping ?? [], co.coId, poId, 'poId')
          ),
        })),
        psoArticulation: perCo.map((co) => ({
          coCode: co.code,
          cells: psoIds.map((psoId) =>
            strengthFor(outcomeDoc?.psoMapping ?? [], co.coId, psoId, 'psoId')
          ),
        })),
        poAttainment: (
          attainment.poAttainment as Array<{
            outcomeId: string;
            code: string;
            weightedAverage: number | null;
            attainment: number | null;
          }>
        ).map((row) => ({
          code: row.code,
          weightedAverage: row.weightedAverage,
          attainment: row.attainment,
        })),
        psoAttainment: (
          attainment.psoAttainment as Array<{
            outcomeId: string;
            code: string;
            weightedAverage: number | null;
            attainment: number | null;
          }>
        ).map((row) => ({
          code: row.code,
          weightedAverage: row.weightedAverage,
          attainment: row.attainment,
        })),
        surveyRespondents: attainment.surveyRespondents,
      };
    });

    return { program, settings, attainments, courses, poIds, psoIds };
  }

  /**
   * NBA SAR Criterion 3 — "Course Outcomes and Program Outcomes".
   *
   * Sections follow the SAR numbering so the output can be pasted into the
   * file section by section:
   *   3.1.1 Course Outcomes of every course
   *   3.1.2 CO-PO/PSO articulation matrix per course
   *   3.1.3 Program-level course × PO matrix (course row = mean of its CO
   *         strengths for that PO, the convention SAR tables use)
   *   3.2.2 CO attainment of every course, against the configured target
   *   3.3.2 PO/PSO attainment, direct and indirect
   *   3.4   Gap analysis + action taken (from recorded corrective actions)
   */
  async nbaCriterion3(
    tenantId: string,
    branchId: string,
    programId: string,
    filters: { academicBatchId?: string; termId?: string } = {}
  ) {
    const { program, settings, courses, poIds, psoIds } = await this.gather(
      tenantId,
      branchId,
      programId,
      filters
    );

    const branch = await collections.branches.findOne(
      { _id: program.branchId },
      { projection: { name: 1 } }
    );
    // NBA/NAAC reports are per program, so take the institution from the
    // program's department; fall back to the campus default for legacy rows.
    const department = program.departmentId
      ? await collections.departments.findOne(
          { _id: program.departmentId },
          { projection: { institutionId: 1 } }
        )
      : null;
    const institution = department?.institutionId
      ? await collections.institutions.findOne(
          { _id: department.institutionId as ObjectId },
          { projection: { name: 1, code: 1 } }
        )
      : await collections.institutions.findOne(
          { branchId: program.branchId, isDefault: true },
          { projection: { name: 1, code: 1 } }
        );
    const batch = filters.academicBatchId
      ? await collections.academicBatches.findOne(
          { _id: new ObjectId(filters.academicBatchId) },
          { projection: { name: 1 } }
        )
      : null;

    const pos = program.pos.map((po) => ({
      _id: po._id.toString(),
      code: po.code,
      title: po.title,
      statement: po.statement,
      isCustom: po.isCustom,
    }));
    const psos = program.psos.map((pso) => ({
      _id: pso._id.toString(),
      code: pso.code,
      statement: pso.statement,
    }));

    // 3.1.3 — program-level course × PO matrix.
    const courseMatrix = courses.map((course) => ({
      subjectCode: course.subjectCode,
      subjectName: course.subjectName,
      semesterNumber: course.semesterNumber,
      cells: poIds.map((_, index) => {
        const strengths = course.articulation
          .map((row) => row.cells[index])
          .filter((v): v is number => v !== null);
        return mean2(strengths);
      }),
      psoCells: psoIds.map((_, index) => {
        const strengths = course.psoArticulation
          .map((row) => row.cells[index])
          .filter((v): v is number => v !== null);
        return mean2(strengths);
      }),
    }));

    // 3.3.2 — program aggregate per PO/PSO: mean over the courses that map it.
    const aggregate = (
      outcomes: Array<{ code: string }>,
      pick: (course: AccreditationCourse) => AccreditationCourse['poAttainment']
    ) =>
      outcomes.map((outcome) => {
        const values = courses
          .map((course) => pick(course).find((row) => row.code === outcome.code)?.attainment)
          .filter((v): v is number => v !== null && v !== undefined);
        const attained = mean2(values);
        return {
          code: outcome.code,
          attainment: attained,
          contributingCourses: values.length,
          target: settings.targetAttainmentLevel,
          targetMet: attained !== null && attained >= settings.targetAttainmentLevel,
        };
      });

    const poAggregate = aggregate(pos, (c) => c.poAttainment);
    const psoAggregate = aggregate(psos, (c) => c.psoAttainment);

    // 3.4 — gaps first, then whatever the department recorded against them.
    const poCorrectiveActions = new Map(
      (program.poCorrectiveActions ?? [])
        .filter(
          (a) =>
            !filters.academicBatchId || a.academicBatchId.toString() === filters.academicBatchId
        )
        .map((a) => [a.poId.toString(), a.text])
    );

    const gaps = [
      ...poAggregate
        .filter((row) => !row.targetMet)
        .map((row) => {
          const po = pos.find((p) => p.code === row.code);
          return {
            kind: 'PO' as const,
            code: row.code,
            attainment: row.attainment,
            target: row.target,
            gap:
              row.attainment === null
                ? null
                : Math.round((row.target - row.attainment) * 100) / 100,
            actionTaken: po ? poCorrectiveActions.get(po._id) : undefined,
          };
        }),
      ...psoAggregate
        .filter((row) => !row.targetMet)
        .map((row) => ({
          kind: 'PSO' as const,
          code: row.code,
          attainment: row.attainment,
          target: row.target,
          gap:
            row.attainment === null ? null : Math.round((row.target - row.attainment) * 100) / 100,
          actionTaken: undefined,
        })),
    ];

    const courseGaps = courses.flatMap((course) =>
      course.cos
        .filter((co) => !co.targetMet)
        .map((co) => ({
          subjectCode: course.subjectCode,
          coCode: co.code,
          attainment: co.overall,
          target: settings.targetAttainmentLevel,
          actionTaken: co.correctiveAction,
        }))
    );

    const uncomputed = courses.filter((c) => !c.isFinal).map((c) => c.subjectCode);

    return {
      meta: {
        institution: institution ? { name: institution.name, code: institution.code } : null,
        branchName: branch?.name ?? null,
        program: {
          name: program.name,
          departmentCode: program.departmentCode,
          curriculumProgramName: program.curriculumProgramName ?? null,
          preset: program.preset,
        },
        academicBatch: batch?.name ?? 'All batches',
        generatedAt: new Date(),
        courseCount: courses.length,
        // An assessor will ask; better to state it than to let a half-finished
        // window read as a complete one.
        provisionalCourses: uncomputed,
      },
      methodology: {
        internalThresholdPercent: settings.internalThresholdPercent,
        internalLevelBands: settings.internalLevelBands,
        externalLevelBands: settings.externalLevelBands,
        directWeights: settings.directWeights,
        overallWeights: settings.overallWeights,
        targetAttainmentLevel: settings.targetAttainmentLevel,
        maxAttainmentLevel: settings.maxAttainmentLevel,
        strengthLegend: STRENGTH_LABELS,
      },
      section3_1_1: courses.map((course) => ({
        subjectCode: course.subjectCode,
        subjectName: course.subjectName,
        semesterNumber: course.semesterNumber,
        cos: course.cos.map((co) => ({
          code: co.code,
          statement: co.statement,
          bloomLevel: co.bloomLevel,
        })),
      })),
      section3_1_2: courses.map((course) => ({
        subjectCode: course.subjectCode,
        subjectName: course.subjectName,
        poCodes: pos.map((po) => po.code),
        psoCodes: psos.map((pso) => pso.code),
        rows: course.articulation.map((row, i) => ({
          coCode: row.coCode,
          poCells: row.cells,
          psoCells: course.psoArticulation[i]?.cells ?? [],
        })),
      })),
      section3_1_3: {
        poCodes: pos.map((po) => po.code),
        psoCodes: psos.map((pso) => pso.code),
        courses: courseMatrix,
      },
      section3_2_2: courses.map((course) => ({
        subjectCode: course.subjectCode,
        subjectName: course.subjectName,
        cohortSize: course.cohortSize,
        surveyRespondents: course.surveyRespondents,
        courseAverage: course.courseAverage,
        cos: course.cos.map((co) => ({
          code: co.code,
          internal: co.internal,
          external: co.external,
          direct: co.direct,
          indirect: co.indirect,
          overall: co.overall,
          targetMet: co.targetMet,
        })),
      })),
      section3_3_2: {
        pos: pos.map((po) => ({ code: po.code, title: po.title, statement: po.statement })),
        psos: psos.map((pso) => ({ code: pso.code, statement: pso.statement })),
        poAggregate,
        psoAggregate,
        perCourse: courses.map((course) => ({
          subjectCode: course.subjectCode,
          poAttainment: course.poAttainment,
          psoAttainment: course.psoAttainment,
        })),
      },
      section3_4: { outcomeGaps: gaps, courseGaps },
    };
  }

  /**
   * NAAC SSR Criterion 2, Key Indicator 2.6 — "Student Performance and
   * Learning Outcomes". 2.6.1 asks whether outcomes are stated and made
   * known; 2.6.2 whether attainment is evaluated; 2.6.3 for the pass
   * percentage of final-year students.
   */
  async naacKeyIndicator26(
    tenantId: string,
    branchId: string,
    programId: string,
    filters: { academicBatchId?: string; termId?: string } = {}
  ) {
    const { program, settings, courses } = await this.gather(
      tenantId,
      branchId,
      programId,
      filters
    );

    const coCount = courses.reduce((sum, c) => sum + c.cos.length, 0);
    const attainedCos = courses.reduce(
      (sum, c) => sum + c.cos.filter((co) => co.targetMet).length,
      0
    );
    const withSurvey = courses.filter((c) => c.surveyRespondents > 0).length;

    // 2.6.3's pass percentage comes from the external instrument: the share of
    // students who cleared the university examination in each course. Courses
    // with no external component simply don't contribute (a purely internal
    // course has no "pass percentage" in the NAAC sense).
    const attainments = (await collections.obeAttainments
      .find({
        tenantId: program.tenantId,
        branchId: program.branchId,
        programId: program._id,
        ...(filters.academicBatchId && {
          academicBatchId: new ObjectId(filters.academicBatchId),
        }),
      })
      .project({ subjectCode: 1, perInstrument: 1, cohortSize: 1 })
      .toArray()) as Array<{
      subjectCode: string;
      cohortSize: number;
      perInstrument?: Array<{
        kind: string;
        external?: { present: number; passed: number; percentPassed: number | null };
      }>;
    }>;

    const passRows = attainments
      .map((doc) => {
        const external = (doc.perInstrument ?? []).find((i) => i.kind === 'external')?.external;
        if (!external) return null;
        return {
          subjectCode: doc.subjectCode,
          appeared: external.present,
          passed: external.passed,
          passPercentage: external.percentPassed,
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);

    const totalAppeared = passRows.reduce((s, r) => s + r.appeared, 0);
    const totalPassed = passRows.reduce((s, r) => s + r.passed, 0);

    return {
      meta: {
        program: {
          name: program.name,
          departmentCode: program.departmentCode,
          curriculumProgramName: program.curriculumProgramName ?? null,
        },
        generatedAt: new Date(),
      },
      metric2_6_1: {
        posDefined: program.pos.length,
        psosDefined: program.psos.length,
        coursesWithCos: courses.filter((c) => c.cos.length > 0).length,
        totalCourses: courses.length,
        cosDefined: coCount,
        statement:
          'Program Outcomes, Program Specific Outcomes and Course Outcomes are defined in the ERP, published to faculty and students, and versioned with the curriculum.',
      },
      metric2_6_2: {
        methodology:
          'Direct attainment from internal assessments and the end-semester examination, combined per the configured weights; indirect attainment from the course-end student survey. COs at or above the target level are counted as attained.',
        targetLevel: settings.targetAttainmentLevel,
        maxLevel: settings.maxAttainmentLevel,
        cosEvaluated: coCount,
        cosAttained: attainedCos,
        attainmentRate: coCount > 0 ? Math.round((attainedCos / coCount) * 100) : null,
        coursesWithIndirectEvidence: withSurvey,
        coursesEvaluated: courses.length,
      },
      metric2_6_3: {
        courses: passRows,
        appeared: totalAppeared,
        passed: totalPassed,
        passPercentage:
          totalAppeared > 0 ? Math.round((totalPassed / totalAppeared) * 10000) / 100 : null,
        // Say plainly when there is no external data rather than reporting 0%.
        note:
          passRows.length === 0
            ? 'No end-semester examination results are recorded for this window, so a pass percentage cannot be derived.'
            : undefined,
      },
    };
  }

  /**
   * The OBE-derived slice of NIRF. NIRF's own parameters (TLR, RP, GO, OI, PR)
   * mostly draw on data this ERP does not hold — publications, patents,
   * graduation outcomes, perception. Only what the system can evidence is
   * emitted; the rest is listed as "not tracked" so nobody mistakes a blank
   * for a zero.
   */
  async nirfDataPoints(
    tenantId: string,
    branchId: string,
    filters: { academicBatchId?: string } = {}
  ) {
    const tenantOid = new ObjectId(tenantId);
    const branchOid = new ObjectId(branchId);

    const [studentsByCategory, staffTotals, programCount, attainmentRows] = await Promise.all([
      collections.students
        .aggregate([
          { $match: { tenantId: tenantOid, branchId: branchOid, status: 'active' } },
          { $group: { _id: '$gender', count: { $sum: 1 } } },
        ])
        .toArray(),
      collections.staff
        .aggregate([
          { $match: { tenantId: tenantOid, branchId: branchOid, status: 'active' } },
          {
            $group: {
              _id: null,
              total: { $sum: 1 },
              teaching: { $sum: { $cond: ['$teaching.isTeaching', 1, 0] } },
              permanent: {
                $sum: { $cond: [{ $eq: ['$employment.employmentType', 'permanent'] }, 1, 0] },
              },
            },
          },
        ])
        .toArray(),
      collections.programs.countDocuments({
        tenantId: tenantOid,
        branchId: branchOid,
        status: 'active',
      }),
      collections.obeAttainments
        .aggregate([
          {
            $match: {
              tenantId: tenantOid,
              branchId: branchOid,
              ...(filters.academicBatchId && {
                academicBatchId: new ObjectId(filters.academicBatchId),
              }),
            },
          },
          { $unwind: '$poAttainment' },
          { $group: { _id: null, meanPo: { $avg: '$poAttainment.attainment' }, n: { $sum: 1 } } },
        ])
        .toArray(),
    ]);

    const students = studentsByCategory.reduce((sum, row) => sum + Number(row.count ?? 0), 0);
    const female = studentsByCategory
      .filter((row) => String(row._id ?? '').toLowerCase() === 'female')
      .reduce((sum, row) => sum + Number(row.count ?? 0), 0);
    const staff = staffTotals[0] ?? { total: 0, teaching: 0, permanent: 0 };

    return {
      generatedAt: new Date(),
      sourced: {
        totalStudents: students,
        femaleStudents: female,
        femaleShare: students > 0 ? Math.round((female / students) * 1000) / 10 : null,
        totalStaff: staff.total,
        teachingStaff: staff.teaching,
        permanentStaff: staff.permanent,
        // NIRF's Faculty-Student Ratio parameter.
        facultyStudentRatio:
          staff.teaching > 0 ? `1:${Math.round(students / staff.teaching)}` : null,
        programsOffered: programCount,
        meanPoAttainment:
          attainmentRows[0]?.meanPo !== undefined && attainmentRows[0]?.meanPo !== null
            ? Math.round(Number(attainmentRows[0].meanPo) * 100) / 100
            : null,
      },
      notTracked: [
        'Publications, citations and IPR (RP parameter)',
        'Median salary and higher-studies placement (GO parameter)',
        'Financial resources and utilisation (TLR — FRU)',
        'Perception survey responses (PR parameter)',
        'Region/state diversity of enrolled students (OI parameter)',
      ],
    };
  }

  /** Guard used by the controllers before an expensive build. */
  async assertHasComputedData(tenantId: string, branchId: string, programId: string) {
    const count = await collections.obeAttainments.countDocuments({
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
      programId: new ObjectId(programId),
    });
    if (count === 0) {
      throw new ApiError(
        'NO_ATTAINMENT_DATA',
        'No course attainment has been computed for this program yet — compute at least one offering before generating an accreditation report.',
        400
      );
    }
  }
}

export const accreditationService = new AccreditationService();
