import { ObjectId, WithId, Document } from 'mongodb';
import type { Filter } from 'mongodb';
import { collections } from '../../config/database';
import { studentService } from '../student/student.service';
import { logger } from '../../lib/logger';
import { ApiError } from '../../middleware/errorHandler';
import { examSettingsService } from './settings.service';
import { parseYearNumber } from '../organization/termNumbering';

type Outcome = 'promote' | 'graduate' | 'hold' | 'transfer_out';

interface PromotionDecision {
  studentId: ObjectId;
  admissionNumber?: string;
  studentName: string;
  fromClassId: ObjectId;
  fromClassName: string;
  fromSectionId: ObjectId;
  fromSectionName: string;
  toClassId?: ObjectId;
  toClassName?: string;
  toSectionId?: ObjectId;
  toSectionName?: string;
  outcome: Outcome;
  /**
   * Reason for the auto-computed outcome (e.g. "Failed in 2 subjects",
   * "All subjects passed", "No report card on file").
   */
  reason?: string;
  manualOverride?: boolean;
  /** Snapshot of per-subject pass/fail used to make the decision. */
  subjectsSummary?: Array<{ subjectName: string; percentage: number; passed: boolean }>;
}

export interface PromotionRunDocument extends Document {
  _id: ObjectId;
  tenantId: ObjectId;
  branchId: ObjectId;
  fromBatchId: ObjectId;
  fromBatchName: string;
  toBatchId: ObjectId;
  toBatchName: string;
  rules: {
    passMarkPercent: number;
    passSubjectsRequired: 'all' | number;
  };
  decisions: PromotionDecision[];
  status: 'draft' | 'committed';
  committedAt?: Date;
  committedBy?: ObjectId;
  createdAt: Date;
  createdBy: ObjectId;
  updatedAt: Date;
}

function formatRun(doc: WithId<PromotionRunDocument>) {
  return {
    _id: doc._id.toString(),
    tenantId: doc.tenantId.toString(),
    branchId: doc.branchId.toString(),
    fromBatchId: doc.fromBatchId.toString(),
    fromBatchName: doc.fromBatchName,
    toBatchId: doc.toBatchId.toString(),
    toBatchName: doc.toBatchName,
    rules: doc.rules,
    decisions: doc.decisions.map((d) => ({
      studentId: d.studentId.toString(),
      admissionNumber: d.admissionNumber,
      studentName: d.studentName,
      fromClassId: d.fromClassId.toString(),
      fromClassName: d.fromClassName,
      fromSectionId: d.fromSectionId.toString(),
      fromSectionName: d.fromSectionName,
      toClassId: d.toClassId?.toString(),
      toClassName: d.toClassName,
      toSectionId: d.toSectionId?.toString(),
      toSectionName: d.toSectionName,
      outcome: d.outcome,
      reason: d.reason,
      manualOverride: d.manualOverride,
      subjectsSummary: d.subjectsSummary,
    })),
    status: doc.status,
    committedAt: doc.committedAt,
    committedBy: doc.committedBy?.toString(),
    createdAt: doc.createdAt,
    createdBy: doc.createdBy.toString(),
    updatedAt: doc.updatedAt,
  };
}

class PromotionService {
  /**
   * Build a fresh promotion run.
   *
   * For every student currently enrolled in `fromBatchId`:
   *   - Look up their published report cards in this batch.
   *   - Apply pass criteria (rules.passMarkPercent + passSubjectsRequired) over
   *     the union of scholastic subjects across all those report cards.
   *   - Decide outcome: 'promote' (eligible) | 'hold' (failed criteria) |
   *     'transfer_out' (no eligibility data on file).
   *   - Suggest a target class+section in `toBatchId` by name match.
   *
   * Saves a draft run that admins can preview and override before committing.
   */
  async createRun(
    tenantId: string,
    branchId: string,
    input: {
      fromBatchId: string;
      toBatchId: string;
      passMarkPercentOverride?: number;
      passSubjectsRequiredOverride?: 'all' | number;
    },
    createdBy: string
  ) {
    const tenantObjId = new ObjectId(tenantId);
    const branchObjId = new ObjectId(branchId);
    const fromBatchObjId = new ObjectId(input.fromBatchId);
    const toBatchObjId = new ObjectId(input.toBatchId);

    if (fromBatchObjId.equals(toBatchObjId)) {
      throw new ApiError('INVALID_INPUT', 'Source and target batch must be different', 400);
    }

    const [fromBatch, toBatch] = await Promise.all([
      collections.academicBatches.findOne({ _id: fromBatchObjId, tenantId: tenantObjId }),
      collections.academicBatches.findOne({ _id: toBatchObjId, tenantId: tenantObjId }),
    ]);
    if (!fromBatch || !toBatch) {
      throw new ApiError('NOT_FOUND', 'Academic batch not found', 404);
    }

    const settings = await examSettingsService.getSettings(tenantId, branchId);
    const passMarkPercent = input.passMarkPercentOverride ?? settings.promotion.passMarkPercent;
    const passSubjectsRequired =
      input.passSubjectsRequiredOverride ?? settings.promotion.passSubjectsRequired;

    // Pull every active student in this branch + batch.
    const students = await collections.students
      .find({
        tenantId: tenantObjId,
        branchId: branchObjId,
        'currentEnrollment.academicBatchId': fromBatchObjId,
        status: { $ne: 'inactive' },
      })
      .project({
        _id: 1,
        firstName: 1,
        lastName: 1,
        displayName: 1,
        admissionNumber: 1,
        currentEnrollment: 1,
      })
      .toArray();

    if (students.length === 0) {
      throw new ApiError(
        'NO_STUDENTS',
        'No active students in the source batch — nothing to promote.',
        400
      );
    }

    // Pull all published report cards for these students in the source batch.
    const studentIds = students.map((s) => s._id as ObjectId);
    const reportCards = await collections.reportCards
      .find({
        tenantId: tenantObjId,
        branchId: branchObjId,
        academicBatchId: fromBatchObjId,
        status: 'published',
        studentId: { $in: studentIds },
      })
      .project({
        studentId: 1,
        scholastic: 1,
        overall: 1,
      })
      .toArray();

    const cardsByStudent = new Map<string, typeof reportCards>();
    for (const c of reportCards) {
      const sid = (c.studentId as ObjectId).toString();
      if (!cardsByStudent.has(sid)) cardsByStudent.set(sid, []);
      cardsByStudent.get(sid)!.push(c);
    }

    // Resolve source class/section names.
    const classIds = new Set<string>();
    const sectionIds = new Set<string>();
    for (const s of students) {
      const e = s.currentEnrollment as { classId?: ObjectId; sectionId?: ObjectId } | undefined;
      if (e?.classId) classIds.add(e.classId.toString());
      if (e?.sectionId) sectionIds.add(e.sectionId.toString());
    }
    const [classes, sections, toClasses] = await Promise.all([
      collections.classes
        .find({ _id: { $in: [...classIds].map((id) => new ObjectId(id)) } })
        .project({ _id: 1, name: 1, displayName: 1, path: 1, programId: 1, departmentId: 1 })
        .toArray(),
      collections.sections
        .find({ _id: { $in: [...sectionIds].map((id) => new ObjectId(id)) } })
        .project({ _id: 1, name: 1, classId: 1 })
        .toArray(),
      collections.classes
        .find({
          tenantId: tenantObjId,
          branchId: branchObjId,
          academicBatchId: toBatchObjId,
        })
        .project({ _id: 1, name: 1, displayName: 1, path: 1, programId: 1, departmentId: 1 })
        .toArray(),
    ]);

    const classNameById = new Map(
      classes.map((c) => [
        (c._id as ObjectId).toString(),
        ((c.displayName as string) || (c.name as string) || '') as string,
      ])
    );
    // Year N of a program moves to Year N+1 of the same program and department;
    // passing the program's last year means graduating.
    const classById = new Map(classes.map((c) => [(c._id as ObjectId).toString(), c]));
    const programIds = [...new Set(classes.map((c) => c.programId?.toString()).filter(Boolean))];
    const programYears = new Map(
      (programIds.length
        ? await collections.programs
            .find({ _id: { $in: programIds.map((id) => new ObjectId(id as string)) } })
            .project({ durationYears: 1 })
            .toArray()
        : []
      ).map((p) => [(p._id as ObjectId).toString(), p.durationYears as number])
    );
    const sameTrack = (a: Document, b: Document) =>
      String(a.programId ?? '') === String(b.programId ?? '') &&
      String(a.departmentId ?? '') === String(b.departmentId ?? '');
    function nextYearClass(fromClassId?: ObjectId): Document | 'graduate' | undefined {
      const from = fromClassId ? classById.get(fromClassId.toString()) : undefined;
      const year = from?.path ? parseYearNumber(from.path) : undefined;
      if (!from || year === undefined || !from.programId) return undefined;
      const duration = programYears.get(from.programId.toString());
      if (duration && year >= duration) return 'graduate';
      return toClasses.find(
        (c) => sameTrack(c, from) && parseYearNumber(c.path ?? []) === year + 1
      );
    }

    const sectionNameById = new Map(
      sections.map((s) => [(s._id as ObjectId).toString(), (s.name as string) || ''])
    );
    // Build name → next-year-class lookup for matching promotion targets.
    const toClassByName = new Map<string, { _id: ObjectId; displayName: string }>();
    for (const c of toClasses) {
      const name = (c.displayName as string) || (c.name as string) || '';
      toClassByName.set(name.trim().toLowerCase(), {
        _id: c._id as ObjectId,
        displayName: name,
      });
    }

    // Sections of target classes — for name-match suggestion.
    const toSectionsByClass = new Map<string, Array<{ _id: ObjectId; name: string }>>();
    if (toClasses.length > 0) {
      const toSections = await collections.sections
        .find({
          classId: { $in: toClasses.map((c) => c._id as ObjectId) },
        })
        .project({ _id: 1, name: 1, classId: 1 })
        .toArray();
      for (const s of toSections) {
        const cid = (s.classId as ObjectId).toString();
        if (!toSectionsByClass.has(cid)) toSectionsByClass.set(cid, []);
        toSectionsByClass.get(cid)!.push({
          _id: s._id as ObjectId,
          name: (s.name as string) || '',
        });
      }
    }

    function decide(studentId: string): {
      outcome: Outcome;
      reason: string;
      subjectsSummary: PromotionDecision['subjectsSummary'];
    } {
      const cards = cardsByStudent.get(studentId) || [];
      if (cards.length === 0) {
        return { outcome: 'hold', reason: 'No published report card on file', subjectsSummary: [] };
      }
      // Use the LATEST card per subject (last term wins).
      const bySubject = new Map<string, { name: string; percentage: number; passed: boolean }>();
      for (const c of cards) {
        const scholastic =
          (c.scholastic as Array<{
            subjectName: string;
            percentage: number;
            passed: boolean;
          }>) || [];
        for (const row of scholastic) {
          bySubject.set(row.subjectName, {
            name: row.subjectName,
            percentage: row.percentage,
            passed: row.percentage >= passMarkPercent,
          });
        }
      }
      const subjects = [...bySubject.values()];
      const summary = subjects.map((s) => ({
        subjectName: s.name,
        percentage: s.percentage,
        passed: s.passed,
      }));
      const passed = subjects.filter((s) => s.passed).length;
      const failed = subjects.length - passed;
      const eligible =
        passSubjectsRequired === 'all' ? failed === 0 : passed >= (passSubjectsRequired as number);
      if (!eligible) {
        return {
          outcome: 'hold',
          reason:
            failed === 0
              ? 'Insufficient passes'
              : `Failed in ${failed} of ${subjects.length} subjects (≥ ${passMarkPercent}% required)`,
          subjectsSummary: summary,
        };
      }
      return {
        outcome: 'promote',
        reason: `Passed all required subjects (≥ ${passMarkPercent}%)`,
        subjectsSummary: summary,
      };
    }

    /**
     * Heuristic target class match: take the source class name, look up its
     * "grade number" (last numeric token) and try to find a class in toBatch
     * whose name has grade+1. Falls back to exact-name match.
     */
    function suggestTargetClass(sourceClassName: string): {
      classId?: ObjectId;
      className?: string;
    } {
      const trimmed = sourceClassName.trim();
      // Advance "Class 5" / "Grade 5" → "Class 6" / "Grade 6". The same name in
      // the new year is the same grade, so it only counts for unnumbered classes.
      const numMatch = trimmed.match(/(\d+)/);
      if (numMatch) {
        const grade = parseInt(numMatch[1]);
        const advanced = trimmed.replace(/\d+/, String(grade + 1)).toLowerCase();
        const found = toClassByName.get(advanced);
        return found ? { classId: found._id, className: found.displayName } : {};
      }
      const exact = toClassByName.get(trimmed.toLowerCase());
      return exact ? { classId: exact._id, className: exact.displayName } : {};
    }

    const decisions: PromotionDecision[] = students.map((s) => {
      const enrollment = s.currentEnrollment as
        | { classId?: ObjectId; sectionId?: ObjectId }
        | undefined;
      const fromClassId = enrollment?.classId as ObjectId;
      const fromSectionId = enrollment?.sectionId as ObjectId;
      const fromClassName = fromClassId ? classNameById.get(fromClassId.toString()) || '' : '';
      const fromSectionName = fromSectionId
        ? sectionNameById.get(fromSectionId.toString()) || ''
        : '';
      const decision = decide((s._id as ObjectId).toString());
      const next = nextYearClass(fromClassId);
      if (decision.outcome === 'promote' && next === 'graduate') {
        decision.outcome = 'graduate';
        decision.reason = 'Completed the final year of the program';
      }
      let toClassId: ObjectId | undefined;
      let toClassName: string | undefined;
      let toSectionId: ObjectId | undefined;
      let toSectionName: string | undefined;

      if (decision.outcome === 'promote' && fromClassName) {
        const suggested =
          next && next !== 'graduate'
            ? { classId: next._id as ObjectId, className: next.displayName as string }
            : suggestTargetClass(fromClassName);
        if (suggested.classId) {
          toClassId = suggested.classId;
          toClassName = suggested.className;
          // Match section by name within the target class.
          const sectionsInClass = toSectionsByClass.get(suggested.classId.toString()) || [];
          const match = sectionsInClass.find(
            (sec) => sec.name.toLowerCase() === fromSectionName.toLowerCase()
          );
          // Same section name if the next year has it, else its first section.
          const target = match ?? sectionsInClass[0];
          if (target) {
            toSectionId = target._id;
            toSectionName = target.name;
          }
        }
      }

      const studentName =
        (s.displayName as string) ||
        `${(s.firstName as string) ?? ''} ${(s.lastName as string) ?? ''}`.trim();

      return {
        studentId: s._id as ObjectId,
        admissionNumber: (s.admissionNumber as string) || undefined,
        studentName,
        fromClassId: fromClassId ?? new ObjectId(),
        fromClassName,
        fromSectionId: fromSectionId ?? new ObjectId(),
        fromSectionName,
        toClassId,
        toClassName,
        toSectionId,
        toSectionName,
        outcome: decision.outcome,
        reason: decision.reason,
        subjectsSummary: decision.subjectsSummary,
        manualOverride: false,
      } as PromotionDecision;
    });

    const now = new Date();
    const doc: PromotionRunDocument = {
      _id: new ObjectId(),
      tenantId: tenantObjId,
      branchId: branchObjId,
      fromBatchId: fromBatchObjId,
      fromBatchName: (fromBatch.name as string) || '',
      toBatchId: toBatchObjId,
      toBatchName: (toBatch.name as string) || '',
      rules: { passMarkPercent, passSubjectsRequired },
      decisions,
      status: 'draft',
      createdAt: now,
      createdBy: new ObjectId(createdBy),
      updatedAt: now,
    };
    await collections.promotionRuns.insertOne(doc);

    logger.info(
      {
        runId: doc._id.toString(),
        fromBatchId: input.fromBatchId,
        toBatchId: input.toBatchId,
        students: decisions.length,
      },
      'Promotion run created'
    );

    return formatRun(doc as WithId<PromotionRunDocument>);
  }

  async list(tenantId: string, branchId: string, query: { status?: string } = {}) {
    const filter: Filter<Document> = {
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
    };
    if (query.status) filter.status = query.status;
    const docs = (await collections.promotionRuns
      .find(filter)
      .sort({ createdAt: -1 })
      .toArray()) as WithId<PromotionRunDocument>[];
    return docs.map(formatRun);
  }

  async getById(tenantId: string, branchId: string, id: string) {
    const doc = (await collections.promotionRuns.findOne({
      _id: new ObjectId(id),
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
    })) as WithId<PromotionRunDocument> | null;
    if (!doc) throw new ApiError('NOT_FOUND', 'Promotion run not found', 404);
    return formatRun(doc);
  }

  async overrideDecision(
    tenantId: string,
    branchId: string,
    runId: string,
    studentId: string,
    patch: {
      outcome?: Outcome;
      toClassId?: string;
      toSectionId?: string;
      reason?: string;
    }
  ) {
    const tenantObjId = new ObjectId(tenantId);
    const branchObjId = new ObjectId(branchId);
    const runObjId = new ObjectId(runId);

    const run = (await collections.promotionRuns.findOne({
      _id: runObjId,
      tenantId: tenantObjId,
      branchId: branchObjId,
    })) as WithId<PromotionRunDocument> | null;
    if (!run) throw new ApiError('NOT_FOUND', 'Promotion run not found', 404);
    if (run.status === 'committed') {
      throw new ApiError('RUN_COMMITTED', 'Cannot edit a committed run', 400);
    }

    const decisions = run.decisions.map((d) => {
      if (d.studentId.toString() !== studentId) return d;
      const next = { ...d, manualOverride: true };
      if (patch.outcome) next.outcome = patch.outcome;
      if (patch.reason !== undefined) next.reason = patch.reason;
      if (patch.toClassId !== undefined) {
        next.toClassId = patch.toClassId ? new ObjectId(patch.toClassId) : undefined;
        next.toClassName = undefined; // resolved below
      }
      if (patch.toSectionId !== undefined) {
        next.toSectionId = patch.toSectionId ? new ObjectId(patch.toSectionId) : undefined;
        next.toSectionName = undefined;
      }
      return next;
    });

    // Re-resolve names for any newly-set toClassId/toSectionId.
    const classIds = decisions.map((d) => d.toClassId).filter(Boolean) as ObjectId[];
    const sectionIds = decisions.map((d) => d.toSectionId).filter(Boolean) as ObjectId[];
    const classes = classIds.length
      ? await collections.classes
          .find({ _id: { $in: classIds } })
          .project({ _id: 1, name: 1, displayName: 1 })
          .toArray()
      : [];
    const sections = sectionIds.length
      ? await collections.sections
          .find({ _id: { $in: sectionIds } })
          .project({ _id: 1, name: 1 })
          .toArray()
      : [];
    const classMap = new Map(
      classes.map((c) => [
        (c._id as ObjectId).toString(),
        (c.displayName as string) || (c.name as string) || '',
      ])
    );
    const sectionMap = new Map(
      sections.map((s) => [(s._id as ObjectId).toString(), (s.name as string) || ''])
    );
    for (const d of decisions) {
      if (d.toClassId) d.toClassName = classMap.get(d.toClassId.toString()) || d.toClassName;
      if (d.toSectionId)
        d.toSectionName = sectionMap.get(d.toSectionId.toString()) || d.toSectionName;
    }

    const result = await collections.promotionRuns.findOneAndUpdate(
      { _id: runObjId, tenantId: tenantObjId, branchId: branchObjId },
      { $set: { decisions, updatedAt: new Date() } },
      { returnDocument: 'after' }
    );
    if (!result) throw new ApiError('NOT_FOUND', 'Promotion run not found', 404);
    return formatRun(result as WithId<PromotionRunDocument>);
  }

  /**
   * Commit a run: walk every decision and apply it to the students collection.
   *   - promote → update currentEnrollment.{academicBatchId, classId, sectionId}.
   *   - hold → leave enrollment as-is (admin re-runs after the student catches up).
   *   - transfer_out → mark student status as 'inactive'.
   *
   * Writes one audit_logs entry per affected student.
   * Idempotent on second invocation? Returns 400 if already committed.
   */
  async commitRun(tenantId: string, branchId: string, runId: string, committedBy: string) {
    const tenantObjId = new ObjectId(tenantId);
    const branchObjId = new ObjectId(branchId);
    const runObjId = new ObjectId(runId);

    const run = (await collections.promotionRuns.findOne({
      _id: runObjId,
      tenantId: tenantObjId,
      branchId: branchObjId,
    })) as WithId<PromotionRunDocument> | null;
    if (!run) throw new ApiError('NOT_FOUND', 'Promotion run not found', 404);
    if (run.status === 'committed') {
      throw new ApiError('RUN_COMMITTED', 'Run already committed', 400);
    }

    let promoted = 0;
    let held = 0;
    let transferred = 0;
    let graduated = 0;
    const auditEntries: Document[] = [];

    for (const d of run.decisions) {
      if (d.outcome === 'promote') {
        if (!d.toClassId || !d.toSectionId) {
          // Promote with missing target — leave alone, mark hold.
          held += 1;
          continue;
        }
        // Same path as a manual promotion: closes the old enrollment, opens
        // the new one, refreshes class/section names and assigns the new
        // year's fees.
        try {
          await studentService.promoteStudent(
            tenantId,
            d.studentId.toString(),
            {
              newAcademicBatchId: run.toBatchId.toString(),
              newClassId: d.toClassId.toString(),
              newSectionId: d.toSectionId.toString(),
              result: 'promoted',
              remarks: `Promotion run ${run.fromBatchName} → ${run.toBatchName}`,
            },
            committedBy
          );
        } catch (err) {
          logger.warn({ err, studentId: d.studentId.toString(), runId }, 'Promotion skipped');
          held += 1;
          continue;
        }
        promoted += 1;
      } else if (d.outcome === 'graduate') {
        // Alumni status closes the enrollment and adds them to the alumni directory.
        await studentService.updateStatus(
          tenantId,
          d.studentId.toString(),
          'alumni',
          `Graduated — ${run.fromBatchName}`,
          committedBy
        );
        graduated += 1;
      } else if (d.outcome === 'transfer_out') {
        await collections.students.updateOne(
          { _id: d.studentId, tenantId: tenantObjId },
          { $set: { status: 'inactive', updatedAt: new Date() } }
        );
        transferred += 1;
      } else {
        held += 1;
      }
      auditEntries.push({
        _id: new ObjectId(),
        tenantId: tenantObjId,
        userId: new ObjectId(committedBy),
        action: 'exam.promotion_decision',
        entityType: 'student',
        entityId: d.studentId,
        details: {
          runId,
          outcome: d.outcome,
          fromBatch: run.fromBatchName,
          toBatch: run.toBatchName,
          fromClass: d.fromClassName,
          toClass: d.toClassName,
          reason: d.reason,
          manualOverride: d.manualOverride,
        },
        timestamp: new Date(),
      });
    }

    if (auditEntries.length > 0) {
      try {
        await collections.auditLogs.insertMany(auditEntries);
      } catch (err) {
        logger.warn({ err }, 'Failed to write promotion audit entries');
      }
    }

    const now = new Date();
    await collections.promotionRuns.updateOne(
      { _id: runObjId },
      {
        $set: {
          status: 'committed',
          committedAt: now,
          committedBy: new ObjectId(committedBy),
          updatedAt: now,
        },
      }
    );

    logger.info(
      { runId, promoted, graduated, held, transferred, committedBy },
      'Promotion run committed'
    );

    return { promoted, graduated, held, transferred };
  }

  async deleteRun(tenantId: string, branchId: string, runId: string) {
    const run = (await collections.promotionRuns.findOne({
      _id: new ObjectId(runId),
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
    })) as WithId<PromotionRunDocument> | null;
    if (!run) throw new ApiError('NOT_FOUND', 'Run not found', 404);
    if (run.status === 'committed') {
      throw new ApiError('RUN_COMMITTED', 'Cannot delete a committed run', 400);
    }
    await collections.promotionRuns.deleteOne({ _id: new ObjectId(runId) });
  }
}

export const promotionService = new PromotionService();
