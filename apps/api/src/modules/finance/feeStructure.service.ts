import { ObjectId, WithId, Document, Filter } from 'mongodb';
import { gradeCodeFor } from '@campus-verse/shared/utils';
import { collections } from '../../config/database';
import { logger } from '../../lib/logger';
import { ApiError } from '../../middleware/errorHandler';
import { feeAssignmentService } from './feeAssignment.service';

/**
 * Hostel and transport are opt-in services billed per allocation (one
 * structure per room rate or bus enrollment, with no class targeting), so
 * class-wide auto-assignment and sync must leave them alone: otherwise every
 * student is billed for someone else's bed or bus.
 */
const SERVICE_BILLED = { category: { $nin: ['hostel', 'transport'] } };

// Grade-code derivation lives in @campus-verse/shared/utils (academic.ts) so
// the web assignment picker and this service can never drift apart.
// Re-exported here for backward compatibility with existing importers.
export { gradeCodeFor };

type GradedClassDoc = {
  path?: Array<{ levelKey: string; code?: string; name?: string }>;
};

interface FeeComponentScope {
  /** 'all' = grade-wide (default), 'sections' = specific sections only,
   *  'students' = specific students only. */
  type: 'all' | 'sections' | 'students';
  /** Section IDs this component applies to (when type='sections'). */
  sectionIds?: string[];
  /** Student IDs this component applies to (when type='students'). */
  studentIds?: string[];
  /** Quick on/off toggle — when false the component is skipped during
   *  assignment creation even if the student matches. Default true. */
  enabled?: boolean;
}

interface FeeComponent {
  name: string;
  code: string;
  type: 'mandatory' | 'optional' | 'service-based';
  amount: number;
  frequency: 'yearly' | 'term-wise' | 'monthly';
  taxable: boolean;
  taxRate?: number;
  refundable: boolean;
  /** Optional scoping — if absent the component applies to everyone in
   *  the grade (backward compatible with existing structures). */
  scope?: FeeComponentScope;
}

interface FeeInstallment {
  name: string;
  dueDate: Date;
  components: Array<{
    componentCode: string;
    amount: number;
  }>;
  totalAmount: number;
}

interface FeeStructureDocument extends Document {
  _id: ObjectId;
  tenantId: ObjectId;
  branchId: ObjectId;
  academicBatchId?: ObjectId; // Legacy: optional for new grade-scoped structures
  /** When set, this record is a clone/assignment derived from the referenced skeleton.
   *  When null/absent, this is a reusable skeleton. */
  parentStructureId?: ObjectId | null;
  name: string;
  code: string;
  applicableTo: {
    institutionType?: string;
    classIds: ObjectId[];
    sectionIds?: ObjectId[];
    /**
     * Stable grade identifiers (e.g. "school:X", "college:BCom:2"). When set,
     * this is the source of truth for student matching — classIds is legacy
     * and only kept for backward reads / migration.
     */
    gradeCodes?: string[];
    streams?: string[];
    categories?: string[];
    /**
     * Admission routes (management/convener/…) this structure targets. Empty
     * or absent ⇒ applies to every admission category. Matched in
     * autoAssignForStudent against Student.admissionCategory.
     */
    admissionCategories?: string[];
  };
  components: FeeComponent[];
  installments: FeeInstallment[];
  finalDueDate?: Date;
  fineRules: {
    type: 'fixed' | 'percentage' | 'daily';
    amount: number;
    gracePeriodDays: number;
    maxFine?: number;
  };
  concessionRules: {
    requireApproval: boolean;
    maxPercentage: number;
    allowedTypes: string[];
  };
  category: 'tuition' | 'hostel' | 'transport' | 'other';
  totalAmount: number;
  mandatoryTotal: number;
  isActive: boolean;
  createdBy: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateFeeStructureInput {
  name: string;
  code: string;
  /** Optional. Legacy field — new grade-scoped structures don't need it. */
  academicBatchId?: string;
  /** When set, the new record is a clone/assignment of the referenced skeleton. */
  parentStructureId?: string | null;
  applicableTo?: {
    institutionType?: string;
    classIds?: string[];
    sectionIds?: string[];
    /** Preferred. Stable across batches. */
    gradeCodes?: string[];
    streams?: string[];
    categories?: string[];
    admissionCategories?: string[];
  };
  components: FeeComponent[];
  installments?: Array<{
    name: string;
    dueDate: string | Date;
    components: Array<{
      componentCode: string;
      amount: number;
    }>;
  }>;
  fineRules?: {
    type: 'fixed' | 'percentage' | 'daily';
    amount: number;
    gracePeriodDays: number;
    maxFine?: number;
  };
  concessionRules?: {
    requireApproval: boolean;
    maxPercentage: number;
    allowedTypes: string[];
  };
  finalDueDate?: string | Date;
  category?: 'tuition' | 'hostel' | 'transport' | 'other';
}

export interface FeeStructureListParams {
  /** Caller scope (structureScopeFilter); ANDed in. */
  scopeFilter?: Filter<Document> | null;
  page?: number;
  limit?: number;
  search?: string;
  academicBatchId?: string;
  isActive?: boolean;
  classId?: string;
  category?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

function assertFeeStructureShape(data: { components?: unknown; installments?: unknown }): void {
  const bad = (message: string) => new ApiError('VALIDATION_ERROR', message, 400);
  if (!Array.isArray(data.components) || data.components.length === 0) {
    throw bad('At least one fee component is required');
  }
  for (const c of data.components as Array<{ code?: unknown; amount?: unknown }>) {
    if (typeof c?.code !== 'string' || typeof c?.amount !== 'number' || c.amount < 0) {
      throw bad('Each fee component needs a code and a non-negative amount');
    }
  }
  if (data.installments !== undefined && !Array.isArray(data.installments)) {
    throw bad('installments must be an array');
  }
  for (const inst of (data.installments as Array<{ dueDate?: unknown; components?: unknown }>) ??
    []) {
    if (!inst?.dueDate || !Array.isArray(inst.components)) {
      throw bad(
        'Each installment needs a dueDate and a components array of { componentCode, amount }'
      );
    }
  }
}

class FeeStructureService {
  async create(
    tenantId: string,
    branchId: string,
    data: CreateFeeStructureInput,
    createdBy: string,
    options?: { skipAutoAssign?: boolean }
  ) {
    // Duplicate-code check is now scoped only to (tenant, branch). The old
    // batch-scoped uniqueness is no longer meaningful since grade-scoped
    // structures aren't tied to a batch at all.
    const existing = await collections.feeStructures.findOne({
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
      code: data.code,
    });

    if (existing) {
      throw new ApiError('DUPLICATE_CODE', 'Fee structure with this code already exists', 409);
    }

    const structureId = new ObjectId();
    const now = new Date();

    // The route has no schema validation (the shared createFeeStructureSchema
    // describes an older shape), so malformed input used to crash with a 500.
    assertFeeStructureShape(data);

    // Calculate totals
    const mandatoryTotal = data.components
      .filter((c) => c.type === 'mandatory')
      .reduce((sum, c) => sum + c.amount, 0);

    const totalAmount = data.components.reduce((sum, c) => sum + c.amount, 0);

    // Calculate installment totals
    const installments: FeeInstallment[] = (data.installments || []).map((inst) => ({
      name: inst.name,
      dueDate: new Date(inst.dueDate),
      components: inst.components,
      totalAmount: inst.components.reduce((sum, c) => sum + c.amount, 0),
    }));

    // Resolve gradeCodes. If the caller passed them, use as-is. Otherwise
    // (legacy callers passing classIds), look up the referenced classes and
    // compute their grade codes so old clients keep working.
    let gradeCodes: string[] = data.applicableTo?.gradeCodes || [];
    const legacyClassIds = (data.applicableTo?.classIds || []).map((id) => new ObjectId(id));
    if (gradeCodes.length === 0 && legacyClassIds.length > 0) {
      const classDocs = (await collections.classes
        .find({ _id: { $in: legacyClassIds } })
        .toArray()) as unknown as GradedClassDoc[];
      gradeCodes = Array.from(
        new Set(classDocs.map((c) => gradeCodeFor(c)).filter((g): g is string => !!g))
      );
    }

    const structure: Omit<FeeStructureDocument, '_id'> & { _id: ObjectId } = {
      _id: structureId,
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
      ...(data.academicBatchId ? { academicBatchId: new ObjectId(data.academicBatchId) } : {}),
      ...(data.parentStructureId
        ? { parentStructureId: new ObjectId(data.parentStructureId) }
        : {}),
      name: data.name,
      code: data.code,
      applicableTo: {
        institutionType: data.applicableTo?.institutionType,
        classIds: legacyClassIds,
        sectionIds: (data.applicableTo?.sectionIds || []).map((id) => new ObjectId(id)),
        gradeCodes,
        streams: data.applicableTo?.streams,
        categories: data.applicableTo?.categories,
        admissionCategories: data.applicableTo?.admissionCategories ?? [],
      },
      components: data.components,
      installments,
      finalDueDate: data.finalDueDate ? new Date(data.finalDueDate) : undefined,
      // No rule → null, so the campus-wide late-fee setting applies (a stored
      // zero rule used to silently override it)
      fineRules: data.fineRules ?? null,
      description: (data as { description?: string }).description,
      paymentPlan: (data as { paymentPlan?: unknown }).paymentPlan,
      concessionRules: data.concessionRules || {
        requireApproval: true,
        maxPercentage: 100,
        allowedTypes: [],
      },
      category: data.category || 'tuition',
      totalAmount,
      mandatoryTotal,
      isActive: true,
      createdBy: new ObjectId(createdBy),
      createdAt: now,
      updatedAt: now,
    };

    await collections.feeStructures.insertOne(structure);

    logger.info(
      { structureId: structureId.toString(), tenantId, branchId },
      'Fee structure created'
    );

    // Auto-assign synchronously so the API response can report how many
    // students were assigned. Failures are caught + logged, not thrown,
    // because the structure itself is already saved.
    let assigned = 0;
    if (totalAmount > 0 && !options?.skipAutoAssign) {
      try {
        assigned = await this.autoAssignByGradeCodes(
          tenantId,
          branchId,
          structureId.toString(),
          gradeCodes,
          createdBy
        );
      } catch (err) {
        logger.error(
          { structureId: structureId.toString(), err },
          'Auto-assignment failed after fee structure creation'
        );
      }
    }

    return {
      ...this.formatStructure(structure as WithId<FeeStructureDocument>),
      assigned,
    };
  }

  async findById(tenantId: string, structureId: string) {
    const structure = (await collections.feeStructures.findOne({
      _id: new ObjectId(structureId),
      tenantId: new ObjectId(tenantId),
    })) as WithId<FeeStructureDocument> | null;

    if (!structure) {
      throw new ApiError('FEE_STRUCTURE_NOT_FOUND', 'Fee structure not found', 404);
    }

    return this.formatStructure(structure);
  }

  async findAll(tenantId: string, branchId: string, params: FeeStructureListParams = {}) {
    const {
      page = 1,
      limit = 20,
      search,
      academicBatchId,
      isActive,
      classId,
      category,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = params;

    const filter: Filter<Document> = {
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
    };

    if (params.scopeFilter) filter.$and = [params.scopeFilter];

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { code: { $regex: search, $options: 'i' } },
      ];
    }

    if (academicBatchId) {
      // Match either: a structure scoped to this exact batch (legacy),
      // OR a grade-scoped structure with no batch coupling at all.
      filter.$or = [
        { academicBatchId: new ObjectId(academicBatchId) },
        { academicBatchId: { $exists: false } },
        { academicBatchId: null },
      ];
    }

    if (typeof isActive === 'boolean') {
      filter.isActive = isActive;
    }

    if (classId) {
      filter['applicableTo.classIds'] = new ObjectId(classId);
    }

    if (category) {
      filter.category = category;
    } else {
      // By default, exclude hostel fee structures from the list
      filter.category = { $ne: 'hostel' };
    }

    const skip = (page - 1) * limit;
    const sortDirection = sortOrder === 'asc' ? 1 : -1;

    const [structures, total] = await Promise.all([
      collections.feeStructures
        .find(filter)
        .sort({ [sortBy]: sortDirection, _id: sortDirection })
        .skip(skip)
        .limit(limit)
        .toArray() as Promise<WithId<FeeStructureDocument>[]>,
      collections.feeStructures.countDocuments(filter),
    ]);

    return {
      data: structures.map((s) => this.formatStructure(s)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: skip + structures.length < total,
      },
    };
  }

  async update(
    tenantId: string,
    branchId: string,
    structureId: string,
    data: Partial<CreateFeeStructureInput>,
    updatedBy: string
  ) {
    const existing = (await collections.feeStructures.findOne({
      _id: new ObjectId(structureId),
      tenantId: new ObjectId(tenantId),
    })) as WithId<FeeStructureDocument> | null;

    if (!existing) {
      throw new ApiError('FEE_STRUCTURE_NOT_FOUND', 'Fee structure not found', 404);
    }

    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (data.name !== undefined) updateData.name = data.name;
    if (data.code !== undefined) updateData.code = data.code;

    if (data.applicableTo !== undefined) {
      let gradeCodes: string[] = data.applicableTo.gradeCodes || [];
      const legacyClassIds = (data.applicableTo.classIds || []).map((id) => new ObjectId(id));
      if (gradeCodes.length === 0 && legacyClassIds.length > 0) {
        const classDocs = (await collections.classes
          .find({ _id: { $in: legacyClassIds } })
          .toArray()) as unknown as GradedClassDoc[];
        gradeCodes = Array.from(
          new Set(classDocs.map((c) => gradeCodeFor(c)).filter((g): g is string => !!g))
        );
      }
      updateData.applicableTo = {
        institutionType: data.applicableTo.institutionType,
        classIds: legacyClassIds,
        sectionIds: (data.applicableTo.sectionIds || []).map((id) => new ObjectId(id)),
        gradeCodes,
        streams: data.applicableTo.streams,
        categories: data.applicableTo.categories,
        admissionCategories: data.applicableTo.admissionCategories,
      };
    }

    if (data.components !== undefined) {
      updateData.components = data.components;
      updateData.mandatoryTotal = data.components
        .filter((c) => c.type === 'mandatory')
        .reduce((sum, c) => sum + c.amount, 0);
      updateData.totalAmount = data.components.reduce((sum, c) => sum + c.amount, 0);
    }

    if (data.installments !== undefined) {
      updateData.installments = data.installments.map((inst) => ({
        name: inst.name,
        dueDate: new Date(inst.dueDate),
        components: inst.components || [],
        totalAmount: inst.components?.reduce((sum, c) => sum + c.amount, 0) ?? 0,
      }));
    }

    if (data.fineRules !== undefined) {
      updateData.fineRules = data.fineRules;
    }

    if (data.concessionRules !== undefined) {
      updateData.concessionRules = data.concessionRules;
    }

    const extra = data as { category?: string; description?: string; paymentPlan?: unknown };
    if (extra.category !== undefined) updateData.category = extra.category;
    if (extra.description !== undefined) updateData.description = extra.description;
    if (extra.paymentPlan !== undefined) updateData.paymentPlan = extra.paymentPlan;

    if (data.finalDueDate !== undefined) {
      updateData.finalDueDate = data.finalDueDate
        ? new Date(data.finalDueDate as string)
        : undefined;
    }

    await collections.feeStructures.updateOne(
      { _id: new ObjectId(structureId) },
      { $set: updateData }
    );

    logger.info({ structureId, tenantId }, 'Fee structure updated');

    // If grade selection changed, re-run auto-assignment so newly-eligible
    // students get an assignment. We don't touch existing assignments.
    if (data.applicableTo?.gradeCodes !== undefined || data.applicableTo?.classIds !== undefined) {
      const updatedStructure = (await collections.feeStructures.findOne({
        _id: new ObjectId(structureId),
      })) as WithId<FeeStructureDocument> | null;

      if (updatedStructure && updatedStructure.totalAmount > 0) {
        try {
          await this.autoAssignByGradeCodes(
            tenantId,
            branchId,
            structureId,
            updatedStructure.applicableTo.gradeCodes || [],
            updatedBy
          );
        } catch (err) {
          logger.error({ structureId, err }, 'Auto-assignment failed after structure update');
        }
      }
    }

    return this.findById(tenantId, structureId);
  }

  /**
   * Resolve a set of grade codes to all matching class _ids in this branch,
   * across every academic batch. This is the core join that lets a single
   * fee structure apply to "Grade 10" everywhere, regardless of which batch
   * a student is currently enrolled in.
   */
  private async resolveClassIdsForGradeCodes(
    tenantId: string,
    branchId: string,
    gradeCodes: string[]
  ): Promise<ObjectId[]> {
    if (!gradeCodes || gradeCodes.length === 0) return [];

    const classDocs = (await collections.classes
      .find({
        tenantId: new ObjectId(tenantId),
        branchId: new ObjectId(branchId),
        status: 'active',
      })
      .project({ _id: 1, path: 1 })
      .toArray()) as Array<WithId<Document> & GradedClassDoc>;

    const wanted = new Set(gradeCodes);
    return classDocs
      .filter((c) => {
        const code = gradeCodeFor(c);
        return code !== null && wanted.has(code);
      })
      .map((c) => c._id);
  }

  /**
   * Find every active student in this branch whose currently-enrolled class
   * matches one of the structure's grade codes (any batch, any year), and
   * create a fee assignment for each. Returns the count of NEW assignments
   * created (existing ones are skipped by feeAssignmentService.bulkCreate).
   */
  private async autoAssignByGradeCodes(
    tenantId: string,
    branchId: string,
    structureId: string,
    gradeCodes: string[],
    createdBy: string
  ): Promise<number> {
    const matchingClassIds = await this.resolveClassIdsForGradeCodes(
      tenantId,
      branchId,
      gradeCodes
    );

    const filter: Filter<Document> = {
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
      status: 'active',
    };

    // If grade codes were provided, scope by them. If empty, the structure
    // applies to ALL students in the branch (org-wide structure).
    if (gradeCodes.length > 0) {
      if (matchingClassIds.length === 0) {
        logger.info(
          { structureId, tenantId, gradeCodes },
          'Auto-assignment: no classes matched grade codes'
        );
        return 0;
      }
      filter['currentEnrollment.classId'] = { $in: matchingClassIds };
    }

    const students = await collections.students
      .find(filter)
      .project({ _id: 1, currentEnrollment: 1 })
      .toArray();

    if (students.length === 0) {
      logger.info({ structureId, tenantId }, 'Auto-assignment: no matching students found');
      return 0;
    }

    // bulkCreate needs an academicBatchId on each assignment. Use whatever
    // batch the student is currently enrolled in (so the assignment lives
    // alongside the student's actual class), grouped per batch.
    const byBatch = new Map<string, string[]>();
    for (const s of students) {
      const batchId = s.currentEnrollment?.academicBatchId?.toString();
      if (!batchId) continue;
      if (!byBatch.has(batchId)) byBatch.set(batchId, []);
      byBatch.get(batchId)!.push(s._id.toString());
    }

    let totalSuccess = 0;
    for (const [batchId, studentIds] of byBatch.entries()) {
      const result = await feeAssignmentService.bulkCreate(
        tenantId,
        branchId,
        { studentIds, feeStructureId: structureId, academicBatchId: batchId },
        createdBy
      );
      totalSuccess += result.success || 0;
    }

    logger.info(
      { structureId, tenantId, totalCandidates: students.length, created: totalSuccess },
      'Grade-based auto-assignment completed'
    );

    return totalSuccess;
  }

  /**
   * Auto-assign all applicable fee structures to a single student. Called
   * when a new student is created/enrolled or promoted to a new batch.
   * Matches structures by grade code (preferred) or legacy classIds.
   */
  async autoAssignForStudent(
    tenantId: string,
    branchId: string,
    studentId: string,
    classId: string,
    sectionId: string | undefined,
    academicBatchId: string,
    createdBy: string
  ): Promise<void> {
    // Compute the student's grade code from their current class
    const studentClass = (await collections.classes.findOne({
      _id: new ObjectId(classId),
    })) as unknown as GradedClassDoc | null;

    const studentGradeCode = studentClass ? gradeCodeFor(studentClass) : null;

    // Admission-category targeting (management vs convener structures): a
    // structure listing admissionCategories applies ONLY to students on one
    // of those routes; untargeted structures apply to everyone.
    const student = await collections.students.findOne(
      { _id: new ObjectId(studentId), tenantId: new ObjectId(tenantId) },
      { projection: { admissionCategory: 1 } }
    );
    // `null` matches both a missing field and the null the create form
    // stores; matching only $exists:false meant no new student ever got fees.
    const admissionCategoryClauses: Filter<Document>[] = [
      { 'applicableTo.admissionCategories': null },
      { 'applicableTo.admissionCategories': { $size: 0 } },
    ];
    if (student?.admissionCategory) {
      admissionCategoryClauses.push({
        'applicableTo.admissionCategories': student.admissionCategory,
      });
    }

    // Find every active fee structure in this branch that either:
    //  (a) targets the student's grade code via gradeCodes, or
    //  (b) targets the student's literal classId via legacy classIds, or
    //  (c) targets the student's sectionId via sectionIds, or
    //  (d) has no targeting at all (org-wide).
    const orClauses: Filter<Document>[] = [];
    if (studentGradeCode) {
      orClauses.push({ 'applicableTo.gradeCodes': studentGradeCode });
    }
    orClauses.push({ 'applicableTo.classIds': new ObjectId(classId) });
    if (sectionId) {
      orClauses.push({ 'applicableTo.sectionIds': new ObjectId(sectionId) });
    }
    orClauses.push({
      $and: [
        {
          $or: [
            { 'applicableTo.gradeCodes': { $exists: false } },
            { 'applicableTo.gradeCodes': { $size: 0 } },
          ],
        },
        {
          $or: [
            { 'applicableTo.classIds': { $exists: false } },
            { 'applicableTo.classIds': { $size: 0 } },
          ],
        },
        {
          $or: [
            { 'applicableTo.sectionIds': { $exists: false } },
            { 'applicableTo.sectionIds': { $size: 0 } },
          ],
        },
      ],
    });

    const structures = await collections.feeStructures
      .find({
        tenantId: new ObjectId(tenantId),
        branchId: new ObjectId(branchId),
        isActive: true,
        totalAmount: { $gt: 0 },
        ...SERVICE_BILLED,
        $and: [{ $or: orClauses }, { $or: admissionCategoryClauses }],
      })
      .toArray();

    if (structures.length === 0) {
      logger.info({ studentId, tenantId }, 'No fee structures found for student auto-assignment');
      return;
    }

    for (const structure of structures) {
      try {
        await feeAssignmentService.create(
          tenantId,
          branchId,
          {
            studentId,
            feeStructureId: structure._id.toString(),
            academicBatchId,
          },
          createdBy
        );
      } catch (error) {
        // Skip if assignment already exists
        if (error instanceof ApiError && error.code === 'ASSIGNMENT_EXISTS') continue;
        logger.error(
          { studentId, structureId: structure._id.toString(), error },
          'Failed to auto-assign fee structure to student'
        );
      }
    }

    logger.info(
      { studentId, tenantId, structureCount: structures.length },
      'Auto-assignment for new student completed'
    );
  }

  /**
   * Sync: find every active student in the branch and ensure they have an
   * assignment for every active fee structure whose grade codes (or legacy
   * classIds, or no scoping) match. Idempotent — existing assignments are
   * skipped. The `academicBatchId` argument is now optional and informational
   * only; matching is grade-based, not batch-based.
   */
  async syncAssignments(
    tenantId: string,
    branchId: string,
    academicBatchId: string | undefined,
    createdBy: string
  ): Promise<{
    assigned: number;
    skipped: number;
    appliedByStructure: Array<{
      structureId: string;
      structureName: string;
      code: string;
      count: number;
    }>;
  }> {
    // Get all active students in the branch — no batch filter, since
    // structures aren't batch-scoped anymore.
    const studentFilter: Filter<Document> = {
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
      status: 'active',
    };
    // Optional narrowing: if a batch is supplied, only sync that batch's
    // currently-enrolled students (kept for backward-compat with the
    // existing fee-counter Sync button which always passes the current batch).
    if (academicBatchId) {
      studentFilter['currentEnrollment.academicBatchId'] = new ObjectId(academicBatchId);
    }

    const students = await collections.students
      .find(studentFilter)
      .project({ _id: 1, currentEnrollment: 1 })
      .toArray();

    const structures = await collections.feeStructures
      .find({
        tenantId: new ObjectId(tenantId),
        branchId: new ObjectId(branchId),
        isActive: true,
        totalAmount: { $gt: 0 },
        ...SERVICE_BILLED,
      })
      .toArray();

    if (structures.length === 0 || students.length === 0) {
      return { assigned: 0, skipped: 0, appliedByStructure: [] };
    }

    // Pre-compute every class doc's grade code so we can map a student
    // (via their currentEnrollment.classId) to a grade code in O(1).
    const classDocs = (await collections.classes
      .find({
        tenantId: new ObjectId(tenantId),
        branchId: new ObjectId(branchId),
      })
      // `path` is what gradeCodeFor reads — without it every class maps to a
      // null grade code and Sync silently skips all grade-scoped structures.
      .project({ _id: 1, path: 1 })
      .toArray()) as Array<WithId<Document> & GradedClassDoc>;

    const gradeCodeByClassId = new Map<string, string>();
    for (const c of classDocs) {
      const code = gradeCodeFor(c);
      if (code) gradeCodeByClassId.set(c._id.toString(), code);
    }

    let assigned = 0;
    let skipped = 0;
    // Per-structure success counter so the UI can tell the cashier exactly
    // which fee structures were applied during this sync.
    const perStructure = new Map<
      string,
      { structureId: string; structureName: string; code: string; count: number }
    >();

    for (const student of students) {
      const classId = student.currentEnrollment?.classId;
      const studentBatchId = student.currentEnrollment?.academicBatchId;
      if (!classId || !studentBatchId) {
        skipped++;
        continue;
      }
      const studentGradeCode = gradeCodeByClassId.get(classId.toString());

      // Find structures applicable to this student
      const studentSectionId = student.currentEnrollment?.sectionId;
      const applicableStructures = structures.filter((s) => {
        const gradeCodes = (s.applicableTo?.gradeCodes as string[] | undefined) || [];
        const classIds = (s.applicableTo?.classIds as ObjectId[] | undefined) || [];
        const sectionIds = (s.applicableTo?.sectionIds as ObjectId[] | undefined) || [];
        // Org-wide structure (no targeting) → applies to everyone
        if (gradeCodes.length === 0 && classIds.length === 0 && sectionIds.length === 0)
          return true;
        // Grade-code match
        if (studentGradeCode && gradeCodes.includes(studentGradeCode)) return true;
        // Legacy literal classId match
        if (classIds.some((id: ObjectId) => id.equals(classId))) return true;
        // Section-level match
        if (studentSectionId && sectionIds.some((id: ObjectId) => id.equals(studentSectionId)))
          return true;
        return false;
      });

      for (const structure of applicableStructures) {
        try {
          await feeAssignmentService.create(
            tenantId,
            branchId,
            {
              studentId: student._id.toString(),
              feeStructureId: structure._id.toString(),
              academicBatchId: studentBatchId.toString(),
            },
            createdBy
          );
          assigned++;

          const structureId = structure._id.toString();
          const existing = perStructure.get(structureId);
          if (existing) {
            existing.count++;
          } else {
            perStructure.set(structureId, {
              structureId,
              structureName: (structure.name as string) || '(Unnamed structure)',
              code: (structure.code as string) || '',
              count: 1,
            });
          }
        } catch {
          skipped++;
        }
      }
    }

    const appliedByStructure = Array.from(perStructure.values()).sort((a, b) => b.count - a.count);

    logger.info(
      { tenantId, branchId, assigned, skipped, structureCount: appliedByStructure.length },
      'Fee assignment sync completed'
    );

    return { assigned, skipped, appliedByStructure };
  }

  async delete(tenantId: string, structureId: string, options?: { force?: boolean }) {
    const structure = await collections.feeStructures.findOne({
      _id: new ObjectId(structureId),
      tenantId: new ObjectId(tenantId),
    });

    if (!structure) {
      throw new ApiError('FEE_STRUCTURE_NOT_FOUND', 'Fee structure not found', 404);
    }

    // Check if any assignments exist
    const assignmentCount = await collections.feeAssignments.countDocuments({
      feeStructureId: new ObjectId(structureId),
    });

    if (assignmentCount > 0) {
      if (!options?.force) {
        throw new ApiError(
          'STRUCTURE_IN_USE',
          `Cannot delete fee structure that has been assigned to ${assignmentCount} student${assignmentCount === 1 ? '' : 's'}. Pass ?force=true to remove unpaid assignments first.`,
          400,
          [{ assignmentCount }]
        );
      }

      // Force delete: refuse only if any assignment has actual payments.
      const paidCount = await collections.feeAssignments.countDocuments({
        feeStructureId: new ObjectId(structureId),
        'summary.totalPaid': { $gt: 0 },
      });

      if (paidCount > 0) {
        throw new ApiError(
          'CANNOT_FORCE_DELETE',
          `${paidCount} assignment${paidCount === 1 ? '' : 's'} on this structure already ${paidCount === 1 ? 'has' : 'have'} payments and cannot be removed. Cancel or refund those payments first.`,
          400,
          [{ paidCount, assignmentCount }]
        );
      }

      // All clear — cascade delete the unpaid assignments, then the structure.
      const cascadeResult = await collections.feeAssignments.deleteMany({
        feeStructureId: new ObjectId(structureId),
      });
      logger.info(
        {
          structureId,
          tenantId,
          deletedAssignments: cascadeResult.deletedCount,
        },
        'Force-delete: cascaded fee assignments'
      );
    }

    await collections.feeStructures.deleteOne({ _id: new ObjectId(structureId) });

    logger.info({ structureId, tenantId, force: !!options?.force }, 'Fee structure deleted');

    return { success: true };
  }

  async clone(
    tenantId: string,
    structureId: string,
    newName: string,
    newCode: string,
    createdBy: string
  ) {
    const original = (await collections.feeStructures.findOne({
      _id: new ObjectId(structureId),
      tenantId: new ObjectId(tenantId),
    })) as WithId<FeeStructureDocument> | null;

    if (!original) {
      throw new ApiError('FEE_STRUCTURE_NOT_FOUND', 'Fee structure not found', 404);
    }

    // Check for duplicate code
    const existing = await collections.feeStructures.findOne({
      tenantId: new ObjectId(tenantId),
      branchId: original.branchId,
      academicBatchId: original.academicBatchId,
      code: newCode,
    });

    if (existing) {
      throw new ApiError('DUPLICATE_CODE', 'Fee structure with this code already exists', 409);
    }

    const newId = new ObjectId();
    const now = new Date();

    const cloned = {
      ...original,
      _id: newId,
      name: newName,
      code: newCode,
      createdBy: new ObjectId(createdBy),
      createdAt: now,
      updatedAt: now,
    };

    await collections.feeStructures.insertOne(cloned);

    logger.info(
      { originalId: structureId, newId: newId.toString(), tenantId },
      'Fee structure cloned'
    );

    return this.formatStructure(cloned as WithId<FeeStructureDocument>);
  }

  /**
   * Lightweight visibility query: how many active fee assignments exist for
   * this structure, and how many of them still have a positive balance.
   * Used by the structures list to show "N students assigned" badges.
   */
  async assignmentCountForStructure(
    tenantId: string,
    structureId: string
  ): Promise<{ total: number; withDues: number }> {
    const baseFilter = {
      tenantId: new ObjectId(tenantId),
      feeStructureId: new ObjectId(structureId),
      status: 'active' as const,
    };
    const [total, withDues] = await Promise.all([
      collections.feeAssignments.countDocuments(baseFilter),
      collections.feeAssignments.countDocuments({
        ...baseFilter,
        'summary.balance': { $gt: 0 },
      }),
    ]);
    return { total, withDues };
  }

  async setActive(tenantId: string, structureId: string, isActive: boolean) {
    const structure = await collections.feeStructures.findOne({
      _id: new ObjectId(structureId),
      tenantId: new ObjectId(tenantId),
    });

    if (!structure) {
      throw new ApiError('FEE_STRUCTURE_NOT_FOUND', 'Fee structure not found', 404);
    }

    await collections.feeStructures.updateOne(
      { _id: new ObjectId(structureId) },
      { $set: { isActive, updatedAt: new Date() } }
    );

    return this.findById(tenantId, structureId);
  }

  /**
   * Find all active fee structures applicable to a given section/class.
   * Used by the enrollment dialog to show which structures will be assigned.
   */
  async findForSection(tenantId: string, branchId: string, sectionId: string, classId: string) {
    const studentClass = (await collections.classes.findOne({
      _id: new ObjectId(classId),
    })) as unknown as GradedClassDoc | null;

    const gradeCode = studentClass ? gradeCodeFor(studentClass) : null;

    const orClauses: Filter<Document>[] = [
      { 'applicableTo.sectionIds': new ObjectId(sectionId) },
      { 'applicableTo.classIds': new ObjectId(classId) },
    ];
    if (gradeCode) {
      orClauses.push({ 'applicableTo.gradeCodes': gradeCode });
    }
    // Org-wide structures (no scoping at all)
    orClauses.push({
      $and: [
        {
          $or: [
            { 'applicableTo.gradeCodes': { $exists: false } },
            { 'applicableTo.gradeCodes': { $size: 0 } },
          ],
        },
        {
          $or: [
            { 'applicableTo.classIds': { $exists: false } },
            { 'applicableTo.classIds': { $size: 0 } },
          ],
        },
        {
          $or: [
            { 'applicableTo.sectionIds': { $exists: false } },
            { 'applicableTo.sectionIds': { $size: 0 } },
          ],
        },
      ],
    });

    const structures = await collections.feeStructures
      .find({
        tenantId: new ObjectId(tenantId),
        branchId: new ObjectId(branchId),
        isActive: true,
        $or: orClauses,
      })
      .toArray();

    return structures.map((s) => this.formatStructure(s as WithId<FeeStructureDocument>));
  }

  private formatStructure(structure: WithId<FeeStructureDocument>) {
    return {
      _id: structure._id.toString(),
      tenantId: structure.tenantId.toString(),
      branchId: structure.branchId.toString(),
      academicBatchId: structure.academicBatchId ? structure.academicBatchId.toString() : undefined,
      parentStructureId: structure.parentStructureId
        ? structure.parentStructureId.toString()
        : null,
      name: structure.name,
      code: structure.code,
      applicableTo: {
        institutionType: structure.applicableTo.institutionType,
        classIds: structure.applicableTo.classIds?.map((id) => id.toString()) || [],
        sectionIds: structure.applicableTo.sectionIds?.map((id: ObjectId) => id.toString()) || [],
        gradeCodes: structure.applicableTo.gradeCodes || [],
        streams: structure.applicableTo.streams,
        categories: structure.applicableTo.categories,
      },
      components: structure.components,
      installments: structure.installments,
      finalDueDate: structure.finalDueDate,
      fineRules: structure.fineRules,
      concessionRules: structure.concessionRules,
      category: structure.category || 'tuition',
      totalAmount: structure.totalAmount,
      mandatoryTotal: structure.mandatoryTotal,
      isActive: structure.isActive,
      createdAt: structure.createdAt,
      updatedAt: structure.updatedAt,
    };
  }
}

export const feeStructureService = new FeeStructureService();

/**
 * Structures a scoped admin may see: those targeting a class in their scope
 * (directly or by grade code) plus untargeted campus-wide structures. null
 * when the caller is not narrowed.
 */
export async function structureScopeFilter(
  tenantId: string,
  scopedClassIds: ObjectId[] | null
): Promise<Filter<Document> | null> {
  if (!scopedClassIds) return null;
  const classes = (await collections.classes
    .find({ tenantId: new ObjectId(tenantId), _id: { $in: scopedClassIds } })
    .toArray()) as unknown as GradedClassDoc[];
  const codes = classes.map((c) => gradeCodeFor(c)).filter((c): c is string => !!c);
  const empty = (field: string) => ({
    $or: [{ [field]: { $exists: false } }, { [field]: { $size: 0 } }],
  });
  return {
    $or: [
      { 'applicableTo.classIds': { $in: scopedClassIds } },
      ...(codes.length ? [{ 'applicableTo.gradeCodes': { $in: codes } }] : []),
      {
        $and: [
          empty('applicableTo.classIds'),
          empty('applicableTo.gradeCodes'),
          empty('applicableTo.sectionIds'),
        ],
      },
    ],
  };
}
