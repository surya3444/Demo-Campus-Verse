import { deriveTermNumber, parseYearNumber, TermPlan } from '../organization/termNumbering';
import { ObjectId, WithId, Document, Filter, UpdateFilter } from 'mongodb';
import { collections } from '../../config/database';
import { logger } from '../../lib/logger';
import { ApiError } from '../../middleware/errorHandler';
import { SubmitRegistrationInput, UpdateRegistrationInput } from '@campus-verse/shared';
import { schemeService, SchemeDocument } from './scheme.service';

/**
 * Course registration — a student's instantiation of a program scheme for a
 * term. Cores are auto-filled; electives are chosen from baskets whose seat
 * caps are enforced with atomic counters on the scheme document (claim first,
 * roll back on any later failure, release on drop/withdraw).
 */

interface RegistrationEntry {
  slotId: string;
  kind: 'core' | 'basket';
  category?: string;
  subjectId: ObjectId;
  credits: number;
}

interface RegistrationDocument extends Document {
  _id: ObjectId;
  tenantId: ObjectId;
  branchId: ObjectId;
  studentId: ObjectId;
  academicBatchId: ObjectId;
  termId: ObjectId;
  schemeId: ObjectId;
  /** Denormalized for reporting — matches the scheme at submit time. */
  departmentCode: string;
  semesterNumber: number;
  entries: RegistrationEntry[];
  totalCredits: number;
  status: 'submitted' | 'withdrawn';
  submittedAt: Date;
  modifiedAt?: Date;
  withdrawnAt?: Date;
  /** Set when an admin registered/withdrew on the student's behalf. */
  overriddenBy?: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

interface TermSubdocument {
  _id: ObjectId;
  name: string;
  half?: 'odd' | 'even';
  part?: 1 | 2 | 3;
  semesterNumber?: number;
  startDate: Date;
  endDate: Date;
  registrationWindow?: { opensAt: Date; closesAt: Date };
  addDropDeadline?: Date;
}

interface StudentAcademics {
  studentId: ObjectId;
  displayName: string;
  classId: ObjectId;
  className: string;
  departmentCode: string;
  departmentName: string;
  /** Legacy path[0] code when it differs from the FK-resolved code — scheme lookups try both. */
  fallbackDepartmentCode?: string;
  /** FK → programs, from the student's class. Selects the program's scheme when set. */
  programId?: string;
  programName?: string;
  yearNumber?: number;
  /** The program's year plan, so term numbers follow annual/semester/trimester years. */
  termPlan?: TermPlan;
}

/**
 * Derive the student's absolute term number for a session term. Follows the
 * program's year plan (an annual Year 1 makes Year 2's semesters terms 2-3);
 * a class with no program keeps the classic two-semesters-per-year rule.
 */
function deriveSemesterNumber(term: TermSubdocument, yearNumber?: number, plan?: TermPlan): number {
  const number = deriveTermNumber(term, yearNumber, plan);
  if (number !== undefined) return number;
  throw new ApiError(
    'TERM_NOT_CONFIGURED',
    'This term has neither a semester number nor an odd/even half configured — ask your administrator to complete the term setup',
    400
  );
}

class RegistrationService {
  // ─── Resolution helpers ───────────────────────────────────────────────────

  /** Resolve the student's userId → student doc (self-service endpoints). */
  async resolveStudentForUser(tenantId: string, userId: string): Promise<ObjectId> {
    const student = await collections.students.findOne(
      {
        tenantId: new ObjectId(tenantId),
        userId: new ObjectId(userId),
        status: 'active',
      },
      { projection: { _id: 1 } }
    );
    if (!student) {
      throw new ApiError(
        'STUDENT_NOT_FOUND',
        'No active student record linked to this account',
        404
      );
    }
    return student._id as ObjectId;
  }

  private async resolveStudentAcademics(
    tenantId: string,
    branchId: string,
    studentId: string
  ): Promise<StudentAcademics> {
    const student = await collections.students.findOne(
      {
        _id: new ObjectId(studentId),
        tenantId: new ObjectId(tenantId),
        branchId: new ObjectId(branchId),
        status: 'active',
      },
      { projection: { displayName: 1, currentEnrollment: 1 } }
    );
    if (!student) {
      throw new ApiError('STUDENT_NOT_FOUND', 'Active student not found in this branch', 404);
    }

    const classId = student.currentEnrollment?.classId as ObjectId | undefined;
    if (!classId) {
      throw new ApiError('NOT_ENROLLED', 'Student has no current class enrollment', 400);
    }

    const classDoc = await collections.classes.findOne(
      { _id: classId, tenantId: new ObjectId(tenantId) },
      { projection: { path: 1, displayName: 1, departmentId: 1, programId: 1 } }
    );
    if (!classDoc?.path?.length) {
      throw new ApiError(
        'CLASS_NOT_FOUND',
        "Student's class or its hierarchy path is missing",
        400
      );
    }

    const path = classDoc.path as Array<{
      levelKey: string;
      name?: string;
      code?: string;
      order?: number;
    }>;
    const top = path[0];

    // Phase-5 re-key: the department FK is the preferred identity source;
    // the path[0] string parse remains as the fallback for unresolved classes.
    let departmentCode = '';
    let departmentName = '';
    if (classDoc.departmentId) {
      const department = await collections.departments.findOne(
        { _id: classDoc.departmentId as ObjectId },
        { projection: { code: 1, name: 1 } }
      );
      if (department) {
        departmentCode = String(department.code ?? '').trim();
        departmentName = String(department.name ?? department.code ?? '').trim();
      }
    }
    const pathCode = (top.code || top.name || '').trim();
    if (!departmentCode) {
      departmentCode = pathCode;
      departmentName = (top.name || top.code || '').trim();
    }
    if (!departmentCode) {
      throw new ApiError('CLASS_NOT_FOUND', "Student's class has no department code", 400);
    }

    // The program FK, when the class carries one, picks the exact curriculum
    // for a department that runs several (CSE vs CSE-AIML vs CSE-DS).
    let programId: string | undefined;
    let programName: string | undefined;
    let termPlan: TermPlan | undefined;
    if (classDoc.programId) {
      programId = String(classDoc.programId);
      const program = await collections.programs.findOne(
        { _id: classDoc.programId as ObjectId },
        { projection: { name: 1, durationYears: 1, termPattern: 1, yearPatterns: 1 } }
      );
      if (program) {
        programName = String(program.name);
        termPlan = program as unknown as TermPlan;
      }
    }

    return {
      studentId: student._id as ObjectId,
      displayName: student.displayName as string,
      classId,
      className: classDoc.displayName as string,
      departmentCode,
      departmentName,
      ...(pathCode && pathCode !== departmentCode && { fallbackDepartmentCode: pathCode }),
      ...(programId && { programId }),
      ...(programName && { programName }),
      ...(termPlan && { termPlan }),
      yearNumber: parseYearNumber(path),
    };
  }

  private async resolveTerm(
    tenantId: string,
    academicBatchId: string,
    termId: string
  ): Promise<{ batchId: ObjectId; term: TermSubdocument }> {
    const batch = await collections.academicBatches.findOne(
      { _id: new ObjectId(academicBatchId), tenantId: new ObjectId(tenantId) },
      { projection: { terms: 1 } }
    );
    if (!batch) {
      throw new ApiError('BATCH_NOT_FOUND', 'Academic batch not found', 404);
    }
    const term = ((batch.terms ?? []) as TermSubdocument[]).find(
      (t) => t._id.toString() === termId
    );
    if (!term) {
      throw new ApiError('TERM_NOT_FOUND', 'Term not found in this batch', 404);
    }
    return { batchId: batch._id as ObjectId, term };
  }

  private assertWindowOpen(term: TermSubdocument) {
    const w = term.registrationWindow;
    if (!w) {
      throw new ApiError(
        'REGISTRATION_NOT_OPEN',
        'Registration is not open for this term (no registration window configured)',
        400
      );
    }
    const now = new Date();
    if (now < new Date(w.opensAt)) {
      throw new ApiError(
        'REGISTRATION_NOT_OPEN',
        `Registration opens on ${new Date(w.opensAt).toDateString()}`,
        400
      );
    }
    if (now > new Date(w.closesAt)) {
      throw new ApiError('REGISTRATION_CLOSED', 'The registration window has closed', 400);
    }
  }

  /** Add/drop is allowed until addDropDeadline, falling back to window close. */
  private addDropDeadline(term: TermSubdocument): Date | null {
    if (term.addDropDeadline) return new Date(term.addDropDeadline);
    if (term.registrationWindow?.closesAt) return new Date(term.registrationWindow.closesAt);
    return null;
  }

  /**
   * Fee clearance: only OVERDUE dues block registration (an installment past
   * its due date with balance remaining). Future installments don't block.
   * The sponsored portion of an assignment (approved scholarship / government
   * fee reimbursement, summary.sponsoredAmount) counts as covered — a convener
   * student whose reimbursement is sanctioned but not yet disbursed must not
   * be blocked from registering.
   */
  async feeClearance(
    tenantId: string,
    branchId: string,
    studentId: string
  ): Promise<{ cleared: boolean; overdueAmount: number }> {
    const assignments = await collections.feeAssignments
      .find({
        tenantId: new ObjectId(tenantId),
        branchId: new ObjectId(branchId),
        studentId: new ObjectId(studentId),
        status: 'active',
      })
      .project({ installments: 1, 'summary.sponsoredAmount': 1 })
      .toArray();

    const now = new Date();
    let overdueAmount = 0;
    for (const a of assignments) {
      let assignmentOverdue = 0;
      for (const inst of (a.installments ?? []) as Array<{
        dueDate?: Date;
        balance?: number;
      }>) {
        if (inst.dueDate && new Date(inst.dueDate) < now && (inst.balance ?? 0) > 0) {
          assignmentOverdue += inst.balance ?? 0;
        }
      }
      const sponsored =
        (a.summary as { sponsoredAmount?: number } | undefined)?.sponsoredAmount ?? 0;
      overdueAmount += Math.max(0, assignmentOverdue - sponsored);
    }
    return { cleared: overdueAmount === 0, overdueAmount };
  }

  // ─── Seat counters ────────────────────────────────────────────────────────

  /**
   * Atomically claim one seat on a basket option. When the option has a seat
   * cap, the update matches only while seatsTaken < cap — a concurrent 41st
   * claim on a 40-seat option simply doesn't match and returns false.
   */
  private async claimSeat(
    schemeId: ObjectId,
    slotId: string,
    subjectId: ObjectId,
    seatCap?: number
  ): Promise<boolean> {
    const optionFilter: Record<string, unknown> = { 'o.subjectId': subjectId };
    if (seatCap !== undefined && seatCap > 0) {
      optionFilter['o.seatsTaken'] = { $lt: seatCap };
    }
    const result = await collections.programSchemes.updateOne(
      { _id: schemeId },
      { $inc: { 'slots.$[s].options.$[o].seatsTaken': 1 } } as unknown as UpdateFilter<Document>,
      { arrayFilters: [{ 's.slotId': slotId }, optionFilter] }
    );
    return result.modifiedCount === 1;
  }

  private async releaseSeat(schemeId: ObjectId, slotId: string, subjectId: ObjectId) {
    await collections.programSchemes.updateOne(
      { _id: schemeId },
      { $inc: { 'slots.$[s].options.$[o].seatsTaken': -1 } } as unknown as UpdateFilter<Document>,
      {
        arrayFilters: [
          { 's.slotId': slotId },
          { 'o.subjectId': subjectId, 'o.seatsTaken': { $gt: 0 } },
        ],
      }
    );
  }

  private async releaseAllBasketSeats(schemeId: ObjectId, entries: RegistrationEntry[]) {
    for (const entry of entries) {
      if (entry.kind === 'basket') {
        await this.releaseSeat(schemeId, entry.slotId, entry.subjectId);
      }
    }
  }

  // ─── Entry building ───────────────────────────────────────────────────────

  /**
   * Build the full entry list from the scheme + basket selections. Cores are
   * always included; each basket must have exactly `chooseCount` distinct
   * picks from its own options.
   */
  private buildEntries(
    scheme: WithId<SchemeDocument>,
    selections: Array<{ slotId: string; subjectIds: string[] }>
  ): RegistrationEntry[] {
    const selectionBySlot = new Map(selections.map((s) => [s.slotId, s.subjectIds]));
    const knownSlotIds = new Set(scheme.slots.map((s) => s.slotId));
    for (const sel of selections) {
      if (!knownSlotIds.has(sel.slotId)) {
        throw new ApiError('INVALID_SELECTION', `Unknown basket slot '${sel.slotId}'`, 400);
      }
    }

    const entries: RegistrationEntry[] = [];
    for (const slot of scheme.slots) {
      if (slot.kind === 'core') {
        entries.push({
          slotId: slot.slotId,
          kind: 'core',
          ...(slot.category && { category: slot.category }),
          subjectId: slot.subjectId as ObjectId,
          credits: slot.credits ?? 0,
        });
        continue;
      }

      const picks = selectionBySlot.get(slot.slotId) ?? [];
      const distinct = new Set(picks);
      if (distinct.size !== picks.length) {
        throw new ApiError('INVALID_SELECTION', `Duplicate picks in "${slot.label}"`, 400);
      }
      if (picks.length !== (slot.chooseCount ?? 1)) {
        throw new ApiError(
          'INVALID_SELECTION',
          `"${slot.label}" requires exactly ${slot.chooseCount} choice(s), got ${picks.length}`,
          400
        );
      }
      const optionsById = new Map((slot.options ?? []).map((o) => [o.subjectId.toString(), o]));
      for (const subjectId of picks) {
        const option = optionsById.get(subjectId);
        if (!option) {
          throw new ApiError(
            'INVALID_SELECTION',
            `Subject is not an option of "${slot.label}"`,
            400
          );
        }
        entries.push({
          slotId: slot.slotId,
          kind: 'basket',
          ...(slot.category && { category: slot.category }),
          subjectId: option.subjectId,
          credits: option.credits,
        });
      }
    }
    return entries;
  }

  // ─── Student flows ────────────────────────────────────────────────────────

  /**
   * Everything the registration page needs in one call: the term picker,
   * the student's derived semester + scheme, any existing registration, fee
   * clearance, and window state.
   */
  async getMyContext(tenantId: string, branchId: string, studentId: string, termId?: string) {
    const academics = await this.resolveStudentAcademics(tenantId, branchId, studentId);

    const batch = await collections.academicBatches.findOne(
      {
        tenantId: new ObjectId(tenantId),
        isCurrent: true,
        $or: [{ branchId: new ObjectId(branchId) }, { branchId: { $exists: false } }],
      },
      { projection: { name: 1, terms: 1 } }
    );
    if (!batch) {
      return { student: this.formatAcademics(academics), batch: null, terms: [], term: null };
    }

    const terms = ((batch.terms ?? []) as TermSubdocument[]).map((t) => ({
      _id: t._id.toString(),
      name: t.name,
      half: t.half,
      semesterNumber: t.semesterNumber,
      startDate: t.startDate,
      endDate: t.endDate,
      registrationWindow: t.registrationWindow,
      addDropDeadline: t.addDropDeadline,
    }));

    // Pick the working term: requested → open window → next to open → last.
    const now = new Date();
    const allTerms = (batch.terms ?? []) as TermSubdocument[];
    let term: TermSubdocument | undefined;
    if (termId) {
      term = allTerms.find((t) => t._id.toString() === termId);
      if (!term) throw new ApiError('TERM_NOT_FOUND', 'Term not found in the current batch', 404);
    } else {
      term =
        allTerms.find(
          (t) =>
            t.registrationWindow &&
            now >= new Date(t.registrationWindow.opensAt) &&
            now <= new Date(t.registrationWindow.closesAt)
        ) ??
        allTerms
          .filter((t) => t.registrationWindow && now < new Date(t.registrationWindow.opensAt))
          .sort(
            (a, b) =>
              new Date(a.registrationWindow!.opensAt).getTime() -
              new Date(b.registrationWindow!.opensAt).getTime()
          )[0] ??
        allTerms[allTerms.length - 1];
    }

    if (!term) {
      return {
        student: this.formatAcademics(academics),
        batch: { _id: batch._id.toString(), name: batch.name },
        terms,
        term: null,
      };
    }

    let semesterNumber: number | null = null;
    let semesterError: string | null = null;
    try {
      semesterNumber = deriveSemesterNumber(term, academics.yearNumber, academics.termPlan);
    } catch (err) {
      semesterError = err instanceof ApiError ? err.message : 'Could not derive semester';
    }

    const scheme =
      semesterNumber !== null
        ? await schemeService.findPublished(
            tenantId,
            branchId,
            academics.departmentCode,
            semesterNumber,
            academics.fallbackDepartmentCode ? [academics.fallbackDepartmentCode] : [],
            academics.programId
          )
        : null;

    const registration = (await collections.courseRegistrations.findOne({
      tenantId: new ObjectId(tenantId),
      studentId: academics.studentId,
      termId: term._id,
      status: 'submitted',
    })) as WithId<RegistrationDocument> | null;

    const feeClearance = await this.feeClearance(tenantId, branchId, studentId);

    const windowState = !term.registrationWindow
      ? 'not_configured'
      : now < new Date(term.registrationWindow.opensAt)
        ? 'upcoming'
        : now > new Date(term.registrationWindow.closesAt)
          ? 'closed'
          : 'open';
    const deadline = this.addDropDeadline(term);

    return {
      student: this.formatAcademics(academics),
      batch: { _id: batch._id.toString(), name: batch.name },
      terms,
      term: {
        _id: term._id.toString(),
        name: term.name,
        half: term.half,
        registrationWindow: term.registrationWindow,
        addDropDeadline: term.addDropDeadline,
        windowState,
        addDropOpen: deadline !== null && now <= deadline,
      },
      semesterNumber,
      semesterError,
      scheme: scheme
        ? {
            ...schemeService.formatScheme(scheme),
            subjects: await schemeService.subjectMap(scheme),
          }
        : null,
      registration: registration ? await this.formatRegistration(registration) : null,
      feeClearance,
    };
  }

  async submit(
    tenantId: string,
    branchId: string,
    studentId: string,
    data: SubmitRegistrationInput,
    _userId: string,
    options: { override?: boolean; overriddenBy?: string } = {}
  ) {
    const academics = await this.resolveStudentAcademics(tenantId, branchId, studentId);
    const { batchId, term } = await this.resolveTerm(tenantId, data.academicBatchId, data.termId);

    if (!options.override) {
      this.assertWindowOpen(term);
      const clearance = await this.feeClearance(tenantId, branchId, studentId);
      if (!clearance.cleared) {
        throw new ApiError(
          'FEE_DUES_PENDING',
          `Registration is blocked: ₹${clearance.overdueAmount.toLocaleString('en-IN')} in overdue fees. Clear your dues to continue.`,
          402
        );
      }
    }

    const semesterNumber = deriveSemesterNumber(term, academics.yearNumber, academics.termPlan);
    const scheme = await schemeService.findPublished(
      tenantId,
      branchId,
      academics.departmentCode,
      semesterNumber,
      academics.fallbackDepartmentCode ? [academics.fallbackDepartmentCode] : [],
      academics.programId
    );
    if (!scheme) {
      throw new ApiError(
        'SCHEME_NOT_FOUND',
        `No published scheme for ${academics.programName ?? academics.departmentCode} semester ${semesterNumber}`,
        404
      );
    }

    const existing = await collections.courseRegistrations.findOne({
      tenantId: new ObjectId(tenantId),
      studentId: academics.studentId,
      termId: term._id,
      status: 'submitted',
    });
    if (existing) {
      throw new ApiError('ALREADY_REGISTERED', 'Already registered for this term', 409);
    }

    const entries = this.buildEntries(scheme, data.selections);
    const totalCredits = entries.reduce((sum, e) => sum + e.credits, 0);
    if (totalCredits < scheme.minCredits || totalCredits > scheme.maxCredits) {
      throw new ApiError(
        'CREDIT_BOUNDS',
        `Total credits (${totalCredits}) must be between ${scheme.minCredits} and ${scheme.maxCredits}`,
        400
      );
    }

    // Claim basket seats one by one; on any failure, release what we took.
    const claimed: RegistrationEntry[] = [];
    const optionCap = new Map<string, number | undefined>();
    for (const slot of scheme.slots) {
      for (const o of slot.options ?? []) {
        optionCap.set(`${slot.slotId}:${o.subjectId.toString()}`, o.seatCap);
      }
    }
    for (const entry of entries) {
      if (entry.kind !== 'basket') continue;
      const cap = optionCap.get(`${entry.slotId}:${entry.subjectId.toString()}`);
      const ok = await this.claimSeat(scheme._id, entry.slotId, entry.subjectId, cap);
      if (!ok) {
        await this.releaseAllBasketSeats(scheme._id, claimed);
        throw new ApiError(
          'SEAT_FULL',
          'One of your chosen electives just filled up — pick another option',
          409,
          [{ slotId: entry.slotId, subjectId: entry.subjectId.toString() }]
        );
      }
      claimed.push(entry);
    }

    const now = new Date();
    const doc: RegistrationDocument = {
      _id: new ObjectId(),
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
      studentId: academics.studentId,
      academicBatchId: batchId,
      termId: term._id,
      schemeId: scheme._id,
      departmentCode: academics.departmentCode,
      semesterNumber,
      entries,
      totalCredits,
      status: 'submitted',
      submittedAt: now,
      createdAt: now,
      updatedAt: now,
      ...(options.overriddenBy && { overriddenBy: new ObjectId(options.overriddenBy) }),
    };

    try {
      await collections.courseRegistrations.insertOne(doc);
    } catch (err) {
      // Unique (tenantId, studentId, termId) index — concurrent double submit.
      await this.releaseAllBasketSeats(scheme._id, claimed);
      if ((err as { code?: number }).code === 11000) {
        throw new ApiError('ALREADY_REGISTERED', 'Already registered for this term', 409);
      }
      throw err;
    }

    logger.info(
      {
        registrationId: doc._id.toString(),
        tenantId,
        studentId,
        termId: data.termId,
        totalCredits,
        override: !!options.override,
      },
      'Course registration submitted'
    );

    return this.formatRegistration(doc as WithId<RegistrationDocument>);
  }

  /** Add/drop: replace basket choices before the deadline. */
  async updateSelections(
    tenantId: string,
    branchId: string,
    studentId: string,
    termId: string,
    data: UpdateRegistrationInput,
    options: { override?: boolean; overriddenBy?: string } = {}
  ) {
    const registration = (await collections.courseRegistrations.findOne({
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
      studentId: new ObjectId(studentId),
      termId: new ObjectId(termId),
      status: 'submitted',
    })) as WithId<RegistrationDocument> | null;
    if (!registration) {
      throw new ApiError('REGISTRATION_NOT_FOUND', 'No registration found for this term', 404);
    }

    const { term } = await this.resolveTermById(tenantId, registration.academicBatchId, termId);
    if (!options.override) {
      const deadline = this.addDropDeadline(term);
      if (!deadline || new Date() > deadline) {
        throw new ApiError('ADD_DROP_CLOSED', 'The add/drop window has closed', 400);
      }
    }

    const scheme = (await collections.programSchemes.findOne({
      _id: registration.schemeId,
      tenantId: new ObjectId(tenantId),
    })) as WithId<SchemeDocument> | null;
    if (!scheme) {
      throw new ApiError('SCHEME_NOT_FOUND', 'The registered scheme no longer exists', 404);
    }

    const newEntries = this.buildEntries(scheme, data.selections);
    const totalCredits = newEntries.reduce((sum, e) => sum + e.credits, 0);
    if (totalCredits < scheme.minCredits || totalCredits > scheme.maxCredits) {
      throw new ApiError(
        'CREDIT_BOUNDS',
        `Total credits (${totalCredits}) must be between ${scheme.minCredits} and ${scheme.maxCredits}`,
        400
      );
    }

    // Diff basket entries: claim additions before releasing removals so a
    // failed claim leaves the original registration fully intact.
    const key = (e: RegistrationEntry) => `${e.slotId}:${e.subjectId.toString()}`;
    const oldBaskets = registration.entries.filter((e) => e.kind === 'basket');
    const newBaskets = newEntries.filter((e) => e.kind === 'basket');
    const oldKeys = new Set(oldBaskets.map(key));
    const newKeys = new Set(newBaskets.map(key));
    const toClaim = newBaskets.filter((e) => !oldKeys.has(key(e)));
    const toRelease = oldBaskets.filter((e) => !newKeys.has(key(e)));

    const optionCap = new Map<string, number | undefined>();
    for (const slot of scheme.slots) {
      for (const o of slot.options ?? []) {
        optionCap.set(`${slot.slotId}:${o.subjectId.toString()}`, o.seatCap);
      }
    }

    const claimed: RegistrationEntry[] = [];
    for (const entry of toClaim) {
      const ok = await this.claimSeat(
        scheme._id,
        entry.slotId,
        entry.subjectId,
        optionCap.get(key(entry))
      );
      if (!ok) {
        await this.releaseAllBasketSeats(scheme._id, claimed);
        throw new ApiError(
          'SEAT_FULL',
          'One of your new electives just filled up — pick another option',
          409,
          [{ slotId: entry.slotId, subjectId: entry.subjectId.toString() }]
        );
      }
      claimed.push(entry);
    }
    await this.releaseAllBasketSeats(scheme._id, toRelease);

    const now = new Date();
    await collections.courseRegistrations.updateOne(
      { _id: registration._id },
      {
        $set: {
          entries: newEntries,
          totalCredits,
          modifiedAt: now,
          updatedAt: now,
          ...(options.overriddenBy && { overriddenBy: new ObjectId(options.overriddenBy) }),
        },
      }
    );

    logger.info(
      { registrationId: registration._id.toString(), tenantId, studentId, totalCredits },
      'Course registration updated (add/drop)'
    );

    const updated = (await collections.courseRegistrations.findOne({
      _id: registration._id,
    })) as WithId<RegistrationDocument>;
    return this.formatRegistration(updated);
  }

  async withdraw(
    tenantId: string,
    branchId: string,
    studentId: string,
    termId: string,
    options: { override?: boolean; overriddenBy?: string } = {}
  ) {
    const registration = (await collections.courseRegistrations.findOne({
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
      studentId: new ObjectId(studentId),
      termId: new ObjectId(termId),
      status: 'submitted',
    })) as WithId<RegistrationDocument> | null;
    if (!registration) {
      throw new ApiError('REGISTRATION_NOT_FOUND', 'No registration found for this term', 404);
    }

    if (!options.override) {
      const { term } = await this.resolveTermById(tenantId, registration.academicBatchId, termId);
      const deadline = this.addDropDeadline(term);
      if (!deadline || new Date() > deadline) {
        throw new ApiError(
          'ADD_DROP_CLOSED',
          'The add/drop window has closed — contact the registrar to withdraw',
          400
        );
      }
    }

    await this.releaseAllBasketSeats(
      registration.schemeId,
      registration.entries.filter((e) => e.kind === 'basket')
    );

    const now = new Date();
    await collections.courseRegistrations.updateOne(
      { _id: registration._id },
      {
        $set: {
          status: 'withdrawn',
          withdrawnAt: now,
          updatedAt: now,
          ...(options.overriddenBy && { overriddenBy: new ObjectId(options.overriddenBy) }),
        },
      }
    );

    logger.info(
      { registrationId: registration._id.toString(), tenantId, studentId },
      'Course registration withdrawn'
    );
    return { success: true };
  }

  private async resolveTermById(tenantId: string, batchId: ObjectId, termId: string) {
    return this.resolveTerm(tenantId, batchId.toString(), termId);
  }

  // ─── Registrar / admin ────────────────────────────────────────────────────

  async listForTerm(
    tenantId: string,
    branchId: string,
    termId: string,
    params: { departmentCode?: string; page?: number; limit?: number } = {}
  ) {
    const { departmentCode, page = 1, limit = 50 } = params;
    const filter: Filter<Document> = {
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
      termId: new ObjectId(termId),
      status: 'submitted',
    };
    if (departmentCode) filter.departmentCode = departmentCode;

    const skip = (page - 1) * limit;
    const [rows, total] = await Promise.all([
      collections.courseRegistrations
        .aggregate([
          { $match: filter },
          { $sort: { submittedAt: -1 } },
          { $skip: skip },
          { $limit: limit },
          {
            $lookup: {
              from: 'students',
              localField: 'studentId',
              foreignField: '_id',
              as: 'student',
              pipeline: [{ $project: { displayName: 1, admissionNumber: 1, rollNumber: 1 } }],
            },
          },
          { $addFields: { student: { $arrayElemAt: ['$student', 0] } } },
        ])
        .toArray(),
      collections.courseRegistrations.countDocuments(filter),
    ]);

    return {
      data: await Promise.all(
        rows.map(async (r) => ({
          ...(await this.formatRegistration(r as WithId<RegistrationDocument>)),
          student: r.student
            ? {
                _id: r.student._id.toString(),
                displayName: r.student.displayName,
                admissionNumber: r.student.admissionNumber,
                rollNumber: r.student.rollNumber,
              }
            : null,
        }))
      ),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: skip + rows.length < total,
      },
    };
  }

  /**
   * Students who SHOULD register for this term but haven't: active students
   * in the branch whose department+semester has a published scheme and who
   * have no submitted registration.
   */
  async pendingForTerm(
    tenantId: string,
    branchId: string,
    academicBatchId: string,
    termId: string,
    params: { departmentCode?: string; limit?: number } = {}
  ) {
    const { term } = await this.resolveTerm(tenantId, academicBatchId, termId);
    const limit = Math.min(params.limit ?? 500, 2000);

    // Map every class in the branch to its department + year.
    const classes = await collections.classes
      .find({ tenantId: new ObjectId(tenantId), branchId: new ObjectId(branchId) })
      .project({ path: 1, displayName: 1, programId: 1 })
      .toArray();
    const programIds = [
      ...new Set(
        classes
          .map((c) => c.programId)
          .filter(Boolean)
          .map(String)
      ),
    ];
    const plans = new Map(
      (programIds.length
        ? await collections.programs
            .find({ _id: { $in: programIds.map((id) => new ObjectId(id)) } })
            .project({ durationYears: 1, termPattern: 1, yearPatterns: 1 })
            .toArray()
        : []
      ).map((p) => [p._id.toString(), p as unknown as TermPlan])
    );
    const classInfo = new Map<
      string,
      { departmentCode: string; className: string; yearNumber?: number; termPlan?: TermPlan }
    >();
    for (const c of classes) {
      const path = (c.path ?? []) as Array<{
        levelKey: string;
        name?: string;
        code?: string;
        order?: number;
      }>;
      const top = path[0];
      if (!top) continue;
      classInfo.set(c._id.toString(), {
        departmentCode: (top.code || top.name || '').trim(),
        className: c.displayName as string,
        yearNumber: parseYearNumber(path),
        termPlan: c.programId ? plans.get(String(c.programId)) : undefined,
      });
    }

    // Published schemes for the branch, keyed by department:semester.
    const schemes = (await collections.programSchemes
      .find({
        tenantId: new ObjectId(tenantId),
        branchId: new ObjectId(branchId),
        status: 'published',
      })
      .project({ departmentCode: 1, semesterNumber: 1 })
      .toArray()) as Array<{ departmentCode: string; semesterNumber: number }>;
    const schemeKeys = new Set(schemes.map((s) => `${s.departmentCode}:${s.semesterNumber}`));

    // Already-registered students for this term.
    const registered = await collections.courseRegistrations
      .find({
        tenantId: new ObjectId(tenantId),
        branchId: new ObjectId(branchId),
        termId: new ObjectId(termId),
        status: 'submitted',
      })
      .project({ studentId: 1 })
      .toArray();
    const registeredIds = new Set(registered.map((r) => r.studentId.toString()));

    const students = await collections.students
      .find({
        tenantId: new ObjectId(tenantId),
        branchId: new ObjectId(branchId),
        status: 'active',
        'currentEnrollment.academicBatchId': new ObjectId(academicBatchId),
      })
      .project({ displayName: 1, admissionNumber: 1, rollNumber: 1, currentEnrollment: 1 })
      .toArray();

    const pending: Array<Record<string, unknown>> = [];
    for (const s of students) {
      if (registeredIds.has(s._id.toString())) continue;
      const info = classInfo.get(s.currentEnrollment?.classId?.toString() ?? '');
      if (!info?.departmentCode) continue;
      if (params.departmentCode && info.departmentCode !== params.departmentCode) continue;

      let semesterNumber: number;
      try {
        semesterNumber = deriveSemesterNumber(term, info.yearNumber, info.termPlan);
      } catch {
        continue; // term not configured for derivation — nothing to expect
      }
      if (!schemeKeys.has(`${info.departmentCode}:${semesterNumber}`)) continue;

      pending.push({
        _id: s._id.toString(),
        displayName: s.displayName,
        admissionNumber: s.admissionNumber,
        rollNumber: s.rollNumber,
        className: info.className,
        departmentCode: info.departmentCode,
        semesterNumber,
      });
      if (pending.length >= limit) break;
    }

    return { data: pending, truncated: pending.length >= limit };
  }

  /** Per-scheme fill stats for the registrar overview. */
  async overview(tenantId: string, branchId: string, termId: string) {
    const schemes = (await collections.programSchemes
      .find({
        tenantId: new ObjectId(tenantId),
        branchId: new ObjectId(branchId),
        status: 'published',
      })
      .sort({ departmentCode: 1, semesterNumber: 1 })
      .toArray()) as WithId<SchemeDocument>[];

    const counts = await collections.courseRegistrations
      .aggregate([
        {
          $match: {
            tenantId: new ObjectId(tenantId),
            branchId: new ObjectId(branchId),
            termId: new ObjectId(termId),
            status: 'submitted',
          },
        },
        { $group: { _id: '$schemeId', count: { $sum: 1 } } },
      ])
      .toArray();
    const countByScheme = new Map(counts.map((c) => [String(c._id), c.count as number]));

    return Promise.all(
      schemes.map(async (scheme) => {
        const subjects = await schemeService.subjectMap(scheme);
        return {
          schemeId: scheme._id.toString(),
          departmentCode: scheme.departmentCode,
          departmentName: scheme.departmentName,
          semesterNumber: scheme.semesterNumber,
          registeredCount: countByScheme.get(scheme._id.toString()) ?? 0,
          baskets: scheme.slots
            .filter((s) => s.kind === 'basket')
            .map((slot) => ({
              slotId: slot.slotId,
              label: slot.label,
              options: (slot.options ?? []).map((o) => ({
                subjectId: o.subjectId.toString(),
                subjectName: subjects[o.subjectId.toString()]?.name,
                seatCap: o.seatCap,
                seatsTaken: o.seatsTaken,
              })),
            })),
        };
      })
    );
  }

  // ─── Formatting ───────────────────────────────────────────────────────────

  private formatAcademics(a: StudentAcademics) {
    return {
      _id: a.studentId.toString(),
      displayName: a.displayName,
      classId: a.classId.toString(),
      className: a.className,
      departmentCode: a.departmentCode,
      departmentName: a.departmentName,
      programId: a.programId,
      programName: a.programName,
      yearNumber: a.yearNumber,
    };
  }

  private async formatRegistration(reg: WithId<RegistrationDocument>) {
    const subjectIds = reg.entries.map((e) => e.subjectId);
    const subjects = subjectIds.length
      ? await collections.subjects
          .find({ _id: { $in: subjectIds } })
          .project({ name: 1, code: 1, shortName: 1 })
          .toArray()
      : [];
    const subjectMap = new Map(subjects.map((s) => [s._id.toString(), s]));

    return {
      _id: reg._id.toString(),
      studentId: reg.studentId.toString(),
      academicBatchId: reg.academicBatchId.toString(),
      termId: reg.termId.toString(),
      schemeId: reg.schemeId.toString(),
      departmentCode: reg.departmentCode,
      semesterNumber: reg.semesterNumber,
      entries: reg.entries.map((e) => {
        const subject = subjectMap.get(e.subjectId.toString());
        return {
          slotId: e.slotId,
          kind: e.kind,
          category: e.category,
          subjectId: e.subjectId.toString(),
          credits: e.credits,
          subject: subject
            ? { name: subject.name, code: subject.code, shortName: subject.shortName }
            : null,
        };
      }),
      totalCredits: reg.totalCredits,
      status: reg.status,
      submittedAt: reg.submittedAt,
      modifiedAt: reg.modifiedAt,
      withdrawnAt: reg.withdrawnAt,
    };
  }
}

export const registrationService = new RegistrationService();
