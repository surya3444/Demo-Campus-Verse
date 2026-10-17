import { ObjectId, WithId, Document, Filter } from 'mongodb';
import { collections } from '../../config/database';
import { logger } from '../../lib/logger';
import { ApiError } from '../../middleware/errorHandler';
import {
  CreateClassInput,
  UpdateClassInput,
  ClassPathEntryInput,
  AcademicHierarchyConfig,
  DEFAULT_HIERARCHY_CONFIG,
  InstitutionType,
} from '@campus-verse/shared';
import { matchDepartmentForPathTop, isDepartmentLevelKey } from '@campus-verse/shared/utils';

interface ClassPathEntry {
  levelKey: string;
  name: string;
  code: string;
  order?: number;
}

interface ClassDocument extends Document {
  _id: ObjectId;
  tenantId: ObjectId;
  branchId: ObjectId;
  academicBatchId: ObjectId;
  path: ClassPathEntry[];
  displayName: string;
  /** FK → departments, derived from path[0] on write (null when unmatched). */
  departmentId?: ObjectId | null;
  /** FK → programs; set explicitly, never derived. */
  programId?: ObjectId | null;
  capacity?: number;
  classTeacherId?: ObjectId;
  status: 'active' | 'inactive';
  createdBy?: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface ClassListParams {
  page?: number;
  limit?: number;
  branchId?: string;
  academicBatchId?: string;
  status?: 'active' | 'inactive';
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  /** Department-scope narrowing (middleware/scope.ts). */
  restrictToClassIds?: ObjectId[];
}

/**
 * Resolve the academic hierarchy in priority order:
 *   branch.academicHierarchy → tenant.academicHierarchy → DEFAULT_HIERARCHY_CONFIG[branch.institutionType]
 *
 * Returned config always has at least one leaf level.
 */
export async function resolveBranchHierarchy(
  tenantId: string,
  branchId: string
): Promise<{ hierarchy: AcademicHierarchyConfig; institutionType: InstitutionType }> {
  const branch = await collections.branches.findOne(
    { _id: new ObjectId(branchId), tenantId: new ObjectId(tenantId) },
    { projection: { academicHierarchy: 1, institutionType: 1 } }
  );

  if (!branch) {
    throw new ApiError('BRANCH_NOT_FOUND', 'Branch not found', 404);
  }

  const institutionType = (branch.institutionType as InstitutionType) || 'school';

  if (branch.academicHierarchy?.levels?.length) {
    return { hierarchy: branch.academicHierarchy, institutionType };
  }

  const tenant = await collections.tenants.findOne(
    { _id: new ObjectId(tenantId) },
    { projection: { academicHierarchy: 1 } }
  );

  if (tenant?.academicHierarchy?.levels?.length) {
    return { hierarchy: tenant.academicHierarchy, institutionType };
  }

  return { hierarchy: DEFAULT_HIERARCHY_CONFIG[institutionType], institutionType };
}

/**
 * Validate that a path[] matches the non-leaf levels of the resolved hierarchy.
 * - path.length must equal hierarchy.nonLeafLevels.length
 * - path[i].levelKey must equal hierarchy.nonLeafLevels[i].key (after sorting by order)
 */
function validatePath(path: ClassPathEntryInput[], hierarchy: AcademicHierarchyConfig) {
  const orderedLevels = [...hierarchy.levels].sort((a, b) => a.order - b.order);
  const nonLeaf = orderedLevels.filter((l) => !l.isLeaf);

  if (path.length !== nonLeaf.length) {
    throw new ApiError(
      'INVALID_PATH',
      `Class path must have exactly ${nonLeaf.length} levels (one per non-leaf hierarchy level)`,
      400
    );
  }

  for (let i = 0; i < path.length; i++) {
    if (path[i].levelKey !== nonLeaf[i].key) {
      throw new ApiError(
        'INVALID_PATH',
        `path[${i}].levelKey '${path[i].levelKey}' does not match hierarchy level '${nonLeaf[i].key}'`,
        400
      );
    }
    if (!path[i].name?.trim() || !path[i].code?.trim()) {
      throw new ApiError('INVALID_PATH', `path[${i}] must have non-empty name and code`, 400);
    }
  }
}

/** Build a stable display string from a class path. */
export function generateDisplayName(path: ClassPathEntryInput[]): string {
  return path
    .map((p) => p.name?.trim())
    .filter(Boolean)
    .join(' · ');
}

/**
 * Dual-write half of the path→FK migration: derive the department FK from the
 * class path's top entry using the shared matching convention. Null when the
 * branch has no matching department (schools; unmatched university classes) —
 * `path` stays authoritative for display either way.
 */
export async function resolveDepartmentIdForPath(
  tenantId: string,
  branchId: string,
  path: ClassPathEntryInput[]
): Promise<ObjectId | null> {
  const top = path?.[0];
  // Only department-like top levels resolve a FK — a school's "Grade 5" must
  // never match an organizational department like "Primary".
  if (!top || !isDepartmentLevelKey(top.levelKey)) return null;

  const departments = await collections.departments
    .find({
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
      status: 'active',
    })
    .project({ code: 1, name: 1 })
    .toArray();

  const match = matchDepartmentForPathTop(top, departments);
  return match ? (match._id as ObjectId) : null;
}

/**
 * A class's display name: its path, with the program inserted after the
 * department when the path does not already name it, so B.Tech CSE Year 1 and
 * M.Tech CSE Year 1 are distinct classes with distinct names.
 */
export async function classDisplayName(
  path: ClassPathEntryInput[],
  programId?: ObjectId | null
): Promise<string> {
  const parts = path.map((p) => p.name?.trim()).filter((n): n is string => !!n);
  if (!programId) return parts.join(' · ');
  const program = await collections.programs.findOne(
    { _id: programId },
    { projection: { name: 1 } }
  );
  const name = (program?.name as string | undefined)?.trim();
  if (!name || path.some((p) => p.levelKey === 'program') || parts.includes(name)) {
    return parts.join(' · ');
  }
  parts.splice(Math.min(1, parts.length), 0, name);
  return parts.join(' · ');
}

/**
 * Pull the year number out of a class path — "Year 2", "2nd Year", "II Year"
 * all yield 2. Null when no level looks like a year or it carries no digits;
 * callers treat that as "nothing to check against the program".
 */
export function yearNumberFromPath(path: ClassPathEntryInput[]): number | null {
  const entry = path?.find((p) => String(p.levelKey ?? '').toLowerCase() === 'year');
  if (!entry) return null;
  const digits = String(entry.name ?? '').match(/\d+/);
  return digits ? Number(digits[0]) : null;
}

class ClassService {
  /**
   * A class's program has to agree with the rest of the class. The program must
   * live on this campus, belong to the same department the path resolved to,
   * and actually run for as many years as the path claims — a "Year 5" cohort
   * under a 4-year B.Tech is a typo, not a cohort.
   */
  private async resolveProgramId(
    tenantId: string,
    branchId: string,
    programId: string,
    path: ClassPathEntryInput[],
    departmentId: ObjectId | null
  ): Promise<ObjectId> {
    if (!ObjectId.isValid(programId)) {
      throw new ApiError('PROGRAM_NOT_FOUND', 'Program not found', 404);
    }

    const program = await collections.programs.findOne({
      _id: new ObjectId(programId),
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
    });
    if (!program) {
      throw new ApiError('PROGRAM_NOT_FOUND', 'Program not found on this campus', 404);
    }
    if (program.status === 'archived') {
      throw new ApiError('PROGRAM_ARCHIVED', 'Cannot link a class to an archived program', 400);
    }

    if (departmentId && program.departmentId && !departmentId.equals(program.departmentId)) {
      throw new ApiError(
        'PROGRAM_DEPARTMENT_MISMATCH',
        `${program.name} is offered by a different department than this class`,
        400
      );
    }

    const year = yearNumberFromPath(path);
    const duration = Number(program.durationYears);
    if (year !== null && Number.isFinite(duration) && duration > 0 && year > duration) {
      throw new ApiError(
        'PROGRAM_YEAR_OUT_OF_RANGE',
        `${program.name} runs for ${duration} year(s), so it has no Year ${year}`,
        400
      );
    }

    return program._id as ObjectId;
  }

  async create(tenantId: string, branchId: string, data: CreateClassInput, createdBy?: string) {
    const batch = await collections.academicBatches.findOne({
      _id: new ObjectId(data.academicBatchId),
      tenantId: new ObjectId(tenantId),
    });

    if (!batch) {
      throw new ApiError('BATCH_NOT_FOUND', 'Academic batch not found', 404);
    }

    const { hierarchy } = await resolveBranchHierarchy(tenantId, branchId);
    validatePath(data.path, hierarchy);

    const departmentId = await resolveDepartmentIdForPath(tenantId, branchId, data.path);

    let programId: ObjectId | null = null;
    if (data.programId) {
      programId = await this.resolveProgramId(
        tenantId,
        branchId,
        data.programId,
        data.path,
        departmentId
      );
    }

    // The program is part of a class's identity: two programs of one
    // department each have their own Year 1.
    const displayName = await classDisplayName(data.path, programId);

    const existingClass = await collections.classes.findOne({
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
      academicBatchId: new ObjectId(data.academicBatchId),
      displayName,
    });

    if (existingClass) {
      throw new ApiError('DUPLICATE_CLASS', 'A class with this configuration already exists', 409);
    }

    const classId = new ObjectId();
    const now = new Date();

    const classDoc: Omit<ClassDocument, '_id'> & { _id: ObjectId } = {
      _id: classId,
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
      academicBatchId: new ObjectId(data.academicBatchId),
      path: data.path,
      displayName,
      departmentId,
      programId,
      ...(data.capacity !== undefined && { capacity: data.capacity }),
      ...(data.classTeacherId && { classTeacherId: new ObjectId(data.classTeacherId) }),
      status: 'active',
      createdAt: now,
      updatedAt: now,
      ...(createdBy && { createdBy: new ObjectId(createdBy) }),
    };

    await collections.classes.insertOne(classDoc);

    logger.info({ classId: classId.toString(), tenantId, branchId }, 'Class created');

    return this.formatClass(classDoc as WithId<ClassDocument>);
  }

  async findById(tenantId: string, classId: string) {
    const classDoc = (await collections.classes.findOne({
      _id: new ObjectId(classId),
      tenantId: new ObjectId(tenantId),
    })) as WithId<ClassDocument> | null;

    if (!classDoc) {
      throw new ApiError('CLASS_NOT_FOUND', 'Class not found', 404);
    }

    return this.formatClass(classDoc);
  }

  async findAll(tenantId: string, params: ClassListParams = {}) {
    const {
      page = 1,
      limit = 50,
      branchId,
      academicBatchId,
      status,
      sortBy = 'displayName',
      sortOrder = 'asc',
    } = params;

    const matchStage: Filter<Document> = {
      tenantId: new ObjectId(tenantId),
    };

    if (params.restrictToClassIds) {
      matchStage._id = { $in: params.restrictToClassIds };
    }

    if (branchId) {
      matchStage.branchId = new ObjectId(branchId);
    }

    if (academicBatchId) {
      matchStage.academicBatchId = new ObjectId(academicBatchId);
    }

    if (status) {
      matchStage.status = status;
    }

    const skip = (page - 1) * limit;
    const sortDirection = sortOrder === 'asc' ? 1 : -1;

    const pipeline = [
      { $match: matchStage },
      {
        $lookup: {
          from: 'sections',
          let: { classId: '$_id' },
          pipeline: [{ $match: { $expr: { $eq: ['$classId', '$$classId'] } } }],
          as: 'sections',
        },
      },
      {
        $lookup: {
          from: 'students',
          let: { classId: '$_id', tenantId: '$tenantId' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$currentEnrollment.classId', '$$classId'] },
                    { $eq: ['$tenantId', '$$tenantId'] },
                  ],
                },
              },
            },
            { $count: 'count' },
          ],
          as: 'studentData',
        },
      },
      {
        $lookup: {
          from: 'academicBatches',
          localField: 'academicBatchId',
          foreignField: '_id',
          as: 'batchData',
        },
      },
      {
        $addFields: {
          sectionCount: { $size: '$sections' },
          studentCount: {
            $ifNull: [{ $arrayElemAt: ['$studentData.count', 0] }, 0],
          },
          subjectCount: {
            $size: {
              $setUnion: [
                {
                  $reduce: {
                    input: '$sections',
                    initialValue: [],
                    in: {
                      $concatArrays: [
                        '$$value',
                        {
                          $map: {
                            input: { $ifNull: ['$$this.subjects', []] },
                            as: 'sub',
                            in: '$$sub.subjectId',
                          },
                        },
                      ],
                    },
                  },
                },
              ],
            },
          },
          batchCode: { $arrayElemAt: ['$batchData.code', 0] },
        },
      },
      {
        $project: {
          studentData: 0,
          batchData: 0,
        },
      },
      { $sort: { [sortBy]: sortDirection, _id: sortDirection } },
      { $skip: skip },
      { $limit: limit },
    ];

    const [classes, total] = await Promise.all([
      collections.classes.aggregate(pipeline).toArray(),
      collections.classes.countDocuments(matchStage),
    ]);

    return {
      data: classes.map((c) => this.formatClassWithCounts(c)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: skip + classes.length < total,
      },
    };
  }

  async update(tenantId: string, classId: string, data: UpdateClassInput) {
    const existingClass = (await collections.classes.findOne({
      _id: new ObjectId(classId),
      tenantId: new ObjectId(tenantId),
    })) as WithId<ClassDocument> | null;

    if (!existingClass) {
      throw new ApiError('CLASS_NOT_FOUND', 'Class not found', 404);
    }

    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (data.path !== undefined) {
      const { hierarchy } = await resolveBranchHierarchy(
        tenantId,
        existingClass.branchId.toString()
      );
      validatePath(data.path, hierarchy);
      updateData.path = data.path;
      updateData.displayName = generateDisplayName(data.path);
      updateData.departmentId = await resolveDepartmentIdForPath(
        tenantId,
        existingClass.branchId.toString(),
        data.path
      );
    }

    // Re-check the program against the class as it will be AFTER this update —
    // an edit that only moves the path still has to leave the pairing valid.
    const effectivePath = (data.path ?? existingClass.path ?? []) as ClassPathEntryInput[];
    const effectiveDepartmentId = (
      data.path !== undefined ? updateData.departmentId : existingClass.departmentId
    ) as ObjectId | null | undefined;
    const effectiveProgramId =
      data.programId !== undefined ? data.programId : existingClass.programId?.toString();

    if (data.programId !== undefined || data.path !== undefined) {
      if (effectiveProgramId) {
        const resolved = await this.resolveProgramId(
          tenantId,
          existingClass.branchId.toString(),
          effectiveProgramId,
          effectivePath,
          effectiveDepartmentId ?? null
        );
        if (data.programId !== undefined) updateData.programId = resolved;
      } else if (data.programId !== undefined) {
        updateData.programId = null;
      }
    }

    if (data.path !== undefined || data.programId !== undefined) {
      const effectiveProgram =
        data.programId !== undefined
          ? (updateData.programId as ObjectId | null | undefined)
          : (existingClass.programId as ObjectId | undefined);
      updateData.displayName = await classDisplayName(effectivePath, effectiveProgram ?? null);
    }

    if (data.capacity !== undefined) updateData.capacity = data.capacity;
    if (data.classTeacherId !== undefined) {
      updateData.classTeacherId = data.classTeacherId ? new ObjectId(data.classTeacherId) : null;
    }

    await collections.classes.updateOne({ _id: new ObjectId(classId) }, { $set: updateData });

    // Students carry the class name for lists and reports; keep it in step.
    if (updateData.displayName && updateData.displayName !== existingClass.displayName) {
      await collections.students.updateMany(
        { tenantId: new ObjectId(tenantId), 'currentEnrollment.classId': new ObjectId(classId) },
        { $set: { 'currentEnrollment.className': updateData.displayName } }
      );
    }

    logger.info({ classId, tenantId }, 'Class updated');

    return this.findById(tenantId, classId);
  }

  async updateStatus(tenantId: string, classId: string, status: 'active' | 'inactive') {
    const classDoc = await collections.classes.findOne({
      _id: new ObjectId(classId),
      tenantId: new ObjectId(tenantId),
    });

    if (!classDoc) {
      throw new ApiError('CLASS_NOT_FOUND', 'Class not found', 404);
    }

    await collections.classes.updateOne(
      { _id: new ObjectId(classId) },
      { $set: { status, updatedAt: new Date() } }
    );

    logger.info({ classId, tenantId, status }, 'Class status updated');

    return this.findById(tenantId, classId);
  }

  async delete(tenantId: string, classId: string) {
    const classDoc = await collections.classes.findOne({
      _id: new ObjectId(classId),
      tenantId: new ObjectId(tenantId),
    });

    if (!classDoc) {
      throw new ApiError('CLASS_NOT_FOUND', 'Class not found', 404);
    }

    const sectionCount = await collections.sections.countDocuments({
      classId: new ObjectId(classId),
    });

    if (sectionCount > 0) {
      throw new ApiError(
        'CLASS_HAS_SECTIONS',
        `Cannot delete class with ${sectionCount} sections`,
        400
      );
    }

    const studentCount = await collections.students.countDocuments({
      'currentEnrollment.classId': new ObjectId(classId),
      status: 'active',
    });

    if (studentCount > 0) {
      throw new ApiError(
        'CLASS_HAS_STUDENTS',
        `Cannot delete class with ${studentCount} enrolled students`,
        400
      );
    }

    await collections.classes.deleteOne({ _id: new ObjectId(classId) });

    logger.info({ classId, tenantId }, 'Class deleted');

    return { success: true };
  }

  /**
   * Start a new academic year from the last one: every active class (Year N of
   * a program) and its sections — subjects and teachers included — are copied
   * into `toBatchId`, so promotion has a Year N+1 to move students into.
   * Students are not copied; promotion moves them. Idempotent: classes the
   * target year already has (same display name) are skipped.
   */
  async copyStructure(
    tenantId: string,
    branchId: string,
    fromBatchId: string,
    toBatchId: string,
    createdBy?: string
  ) {
    if (fromBatchId === toBatchId) {
      throw new ApiError('SAME_BATCH', 'Pick a different academic year to copy from', 400);
    }
    const tenantObjId = new ObjectId(tenantId);
    const branchObjId = new ObjectId(branchId);
    const batches = await collections.academicBatches
      .find({
        _id: { $in: [new ObjectId(fromBatchId), new ObjectId(toBatchId)] },
        tenantId: tenantObjId,
        branchId: branchObjId,
      })
      .project({ _id: 1 })
      .toArray();
    if (batches.length !== 2) {
      throw new ApiError('BATCH_NOT_FOUND', 'Both academic years must belong to this campus', 404);
    }

    const [sourceClasses, existing] = await Promise.all([
      collections.classes
        .find({
          tenantId: tenantObjId,
          branchId: branchObjId,
          academicBatchId: new ObjectId(fromBatchId),
          status: 'active',
        })
        .toArray(),
      collections.classes
        .find({
          tenantId: tenantObjId,
          branchId: branchObjId,
          academicBatchId: new ObjectId(toBatchId),
        })
        .project({ displayName: 1 })
        .toArray(),
    ]);
    const taken = new Set(existing.map((c) => c.displayName));

    const now = new Date();
    const by = createdBy ? { createdBy: new ObjectId(createdBy) } : {};
    let classesCreated = 0;
    let sectionsCreated = 0;
    for (const src of sourceClasses) {
      if (taken.has(src.displayName)) continue;
      const classId = new ObjectId();
      await collections.classes.insertOne({
        _id: classId,
        tenantId: tenantObjId,
        branchId: branchObjId,
        academicBatchId: new ObjectId(toBatchId),
        path: src.path,
        displayName: src.displayName,
        departmentId: src.departmentId ?? null,
        programId: src.programId ?? null,
        ...(src.capacity !== undefined && { capacity: src.capacity }),
        ...(src.classTeacherId && { classTeacherId: src.classTeacherId }),
        status: 'active',
        createdAt: now,
        updatedAt: now,
        ...by,
      });
      classesCreated++;

      const sections = await collections.sections
        .find({ tenantId: tenantObjId, classId: src._id, status: 'active' })
        .toArray();
      if (sections.length) {
        await collections.sections.insertMany(
          sections.map((s) => ({
            _id: new ObjectId(),
            tenantId: tenantObjId,
            branchId: branchObjId,
            classId,
            name: s.name,
            code: s.code,
            ...(s.roomNumber && { roomNumber: s.roomNumber }),
            ...(s.capacity !== undefined && { capacity: s.capacity }),
            ...(s.sectionTeacherId && { sectionTeacherId: s.sectionTeacherId }),
            // Same year, same curriculum: subjects and their teachers carry over.
            subjects: s.subjects ?? [],
            status: 'active',
            createdAt: now,
            updatedAt: now,
            ...by,
          }))
        );
        sectionsCreated += sections.length;
      }
    }

    logger.info(
      { tenantId, branchId, fromBatchId, toBatchId, classesCreated, sectionsCreated },
      'Academic structure copied to new year'
    );
    return {
      classesCreated,
      classesSkipped: sourceClasses.length - classesCreated,
      sectionsCreated,
    };
  }

  /**
   * Returns the deduplicated set of subjects across all sections of this class,
   * preserving backward compatibility for callers that still query at the class level
   * (e.g. enrolment-time elective listing). Authoritative subject assignment lives
   * on individual sections.
   */
  async getSubjects(tenantId: string, classId: string) {
    const classDoc = (await collections.classes.findOne({
      _id: new ObjectId(classId),
      tenantId: new ObjectId(tenantId),
    })) as WithId<ClassDocument> | null;

    if (!classDoc) {
      throw new ApiError('CLASS_NOT_FOUND', 'Class not found', 404);
    }

    const sections = (await collections.sections
      .find({ classId: new ObjectId(classId), tenantId: new ObjectId(tenantId) })
      .project({ subjects: 1 })
      .toArray()) as Array<{
      subjects?: Array<{ subjectId: ObjectId; teacherId?: ObjectId; periodsPerWeek?: number }>;
    }>;

    const seen = new Set<string>();
    const flat: Array<{
      subjectId: ObjectId;
      teacherId?: ObjectId;
      periodsPerWeek?: number;
    }> = [];
    for (const section of sections) {
      for (const entry of section.subjects ?? []) {
        const key = entry.subjectId.toString();
        if (!seen.has(key)) {
          seen.add(key);
          flat.push(entry);
        }
      }
    }

    if (flat.length === 0) return [];

    const subjectIds = flat.map((s) => s.subjectId);
    const subjects = await collections.subjects.find({ _id: { $in: subjectIds } }).toArray();
    const subjectMap = new Map(subjects.map((s) => [s._id.toString(), s]));

    return flat.map((entry) => {
      const subject = subjectMap.get(entry.subjectId.toString());
      return {
        subjectId: entry.subjectId.toString(),
        teacherId: entry.teacherId?.toString(),
        periodsPerWeek: entry.periodsPerWeek,
        subject: subject
          ? {
              _id: subject._id.toString(),
              name: subject.name,
              code: subject.code,
              shortName: subject.shortName,
              type: subject.type,
            }
          : null,
      };
    });
  }

  private formatClass(classDoc: WithId<ClassDocument>) {
    return {
      _id: classDoc._id.toString(),
      tenantId: classDoc.tenantId.toString(),
      branchId: classDoc.branchId.toString(),
      academicBatchId: classDoc.academicBatchId.toString(),
      path: classDoc.path || [],
      displayName: classDoc.displayName,
      departmentId: classDoc.departmentId?.toString(),
      programId: classDoc.programId?.toString(),
      capacity: classDoc.capacity,
      classTeacherId: classDoc.classTeacherId?.toString(),
      status: classDoc.status,
      createdAt: classDoc.createdAt,
      updatedAt: classDoc.updatedAt,
    };
  }

  private formatClassWithCounts(classDoc: Document) {
    return {
      _id: classDoc._id.toString(),
      tenantId: classDoc.tenantId.toString(),
      branchId: classDoc.branchId.toString(),
      academicBatchId: classDoc.academicBatchId.toString(),
      path: classDoc.path || [],
      displayName: classDoc.displayName,
      departmentId: classDoc.departmentId?.toString(),
      programId: classDoc.programId?.toString(),
      capacity: classDoc.capacity,
      classTeacherId: classDoc.classTeacherId?.toString(),
      sectionCount: classDoc.sectionCount || 0,
      studentCount: classDoc.studentCount || 0,
      subjectCount: classDoc.subjectCount || 0,
      batchCode: classDoc.batchCode,
      sections: Array.isArray(classDoc.sections)
        ? classDoc.sections.map((s: { _id: ObjectId; name: string; status?: string }) => ({
            _id: s._id.toString(),
            name: s.name,
            status: s.status,
          }))
        : [],
      status: classDoc.status,
      createdAt: classDoc.createdAt,
      updatedAt: classDoc.updatedAt,
    };
  }
}

export const classService = new ClassService();
