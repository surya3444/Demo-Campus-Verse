import { ObjectId, WithId, Document, Filter } from 'mongodb';
import { collections } from '../../config/database';
import { logger } from '../../lib/logger';
import { ApiError } from '../../middleware/errorHandler';
import { InstitutionType, SubjectCategory } from '@campus-verse/shared';

interface SubjectDocument extends Document {
  _id: ObjectId;
  tenantId: ObjectId;
  branchId?: ObjectId;
  name: string;
  code: string;
  shortName?: string;
  description?: string;
  type: 'theory' | 'practical' | 'both';
  /** CBCS/NEP category (DSC/DSE/GE/AECC/SEC/VAC) — used by program schemes. */
  category?: SubjectCategory;
  /** Lecture-Tutorial-Practical hours per week. */
  ltp?: { lecture: number; tutorial: number; practical: number };
  applicableTo?: {
    institutionTypes?: string[];
    grades?: string[];
    streams?: string[];
    departments?: string[];
  };
  /** Department that owns/teaches this subject (e.g. a service department like S&H). */
  ownerDepartmentId?: ObjectId;
  /** Global (everyone) / core (owner only) / shared (owner + offeredTo). */
  sharing?: 'global' | 'core' | 'shared';
  offeredToDepartmentIds?: ObjectId[];
  credits?: number;
  maxMarks?: number;
  passingMarks?: number;
  status: 'active' | 'inactive';
  createdBy?: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateSubjectInput {
  name: string;
  code: string;
  shortName?: string;
  description?: string;
  type: 'theory' | 'practical' | 'both';
  category?: SubjectCategory;
  ltp?: { lecture: number; tutorial: number; practical: number };
  applicableTo?: {
    institutionTypes?: InstitutionType[];
    grades?: string[];
    streams?: string[];
    departments?: string[];
  };
  ownerDepartmentId?: string | null;
  sharing?: 'global' | 'core' | 'shared';
  offeredToDepartmentIds?: string[];
  credits?: number;
  maxMarks?: number;
  passingMarks?: number;
}

export interface SubjectListParams {
  page?: number;
  limit?: number;
  branchId?: string;
  type?: 'theory' | 'practical' | 'both';
  institutionType?: InstitutionType;
  status?: 'active' | 'inactive';
  search?: string;
  /**
   * Department context for curriculum pickers: narrows to subjects the
   * department may consume (global, unowned, owned by it, or offered to it).
   */
  usableByDepartmentId?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Who may use a subject — the single rule the curriculum, sections and the
 * timetable all follow:
 *   - 'global' (or no owner at all): every department;
 *   - 'core' (or unset) with an owner: only the owner department;
 *   - 'shared': the owner plus the departments it is offered to.
 * Returns null for "every department".
 */
export function departmentsWithAccess(subject: {
  sharing?: string | null;
  ownerDepartmentId?: unknown;
  offeredToDepartmentIds?: unknown[] | null;
}): Set<string> | null {
  if (subject.sharing === 'global' || !subject.ownerDepartmentId) return null;
  const ids = new Set([String(subject.ownerDepartmentId)]);
  if (subject.sharing === 'shared') {
    for (const id of subject.offeredToDepartmentIds ?? []) ids.add(String(id));
  }
  return ids;
}

/** sharing === 'shared' must name an owner and at least one consumer. */
function validateSharing(data: {
  sharing?: 'global' | 'core' | 'shared';
  ownerDepartmentId?: string | null;
  offeredToDepartmentIds?: string[];
}) {
  // The owner always has access; listing it as a consumer too is noise.
  if (data.offeredToDepartmentIds && data.ownerDepartmentId) {
    data.offeredToDepartmentIds = [...new Set(data.offeredToDepartmentIds)].filter(
      (id) => id !== data.ownerDepartmentId
    );
  }
  if (data.sharing === 'shared') {
    if (!data.ownerDepartmentId) {
      throw new ApiError(
        'SHARING_REQUIRES_OWNER',
        'A shared subject must have an owner department',
        400
      );
    }
    if (!data.offeredToDepartmentIds?.length) {
      throw new ApiError(
        'SHARING_REQUIRES_CONSUMERS',
        'A shared subject must list the departments it is offered to',
        400
      );
    }
  }
}

class SubjectService {
  async create(
    tenantId: string,
    branchId: string | undefined,
    data: CreateSubjectInput,
    createdBy?: string
  ) {
    // Check for duplicate subject code
    const filter: Filter<Document> = {
      tenantId: new ObjectId(tenantId),
      code: data.code.toUpperCase(),
    };
    if (branchId) {
      filter.$or = [{ branchId: new ObjectId(branchId) }, { branchId: { $exists: false } }];
    }

    const existingSubject = await collections.subjects.findOne(filter);

    if (existingSubject) {
      throw new ApiError('DUPLICATE_SUBJECT_CODE', 'A subject with this code already exists', 409);
    }

    validateSharing(data);

    const subjectId = new ObjectId();
    const now = new Date();

    const subject: Omit<SubjectDocument, '_id'> & { _id: ObjectId } = {
      _id: subjectId,
      tenantId: new ObjectId(tenantId),
      ...(branchId && { branchId: new ObjectId(branchId) }),
      name: data.name,
      code: data.code.toUpperCase(),
      shortName: data.shortName || data.name.substring(0, 4).toUpperCase(),
      ...(data.description && { description: data.description }),
      type: data.type,
      ...(data.category && { category: data.category }),
      ...(data.ltp && { ltp: data.ltp }),
      applicableTo: data.applicableTo,
      ...(data.ownerDepartmentId && { ownerDepartmentId: new ObjectId(data.ownerDepartmentId) }),
      ...(data.sharing && { sharing: data.sharing }),
      ...(data.offeredToDepartmentIds && {
        offeredToDepartmentIds: data.offeredToDepartmentIds.map((id) => new ObjectId(id)),
      }),
      credits: data.credits,
      maxMarks: data.maxMarks,
      passingMarks: data.passingMarks,
      status: 'active',
      createdAt: now,
      updatedAt: now,
      ...(createdBy && { createdBy: new ObjectId(createdBy) }),
    };

    await collections.subjects.insertOne(subject);

    logger.info({ subjectId: subjectId.toString(), tenantId }, 'Subject created');

    return this.formatSubject(subject as WithId<SubjectDocument>);
  }

  async findById(tenantId: string, subjectId: string) {
    const subject = (await collections.subjects.findOne({
      _id: new ObjectId(subjectId),
      tenantId: new ObjectId(tenantId),
    })) as WithId<SubjectDocument> | null;

    if (!subject) {
      throw new ApiError('SUBJECT_NOT_FOUND', 'Subject not found', 404);
    }

    return this.formatSubject(subject);
  }

  async findAll(tenantId: string, params: SubjectListParams = {}) {
    const {
      page = 1,
      limit = 100,
      branchId,
      type,
      institutionType,
      status,
      search,
      usableByDepartmentId,
      sortBy = 'name',
      sortOrder = 'asc',
    } = params;

    const filter: Filter<Document> = {
      tenantId: new ObjectId(tenantId),
    };

    // Branch scoping and search each need their own $or — combine them under
    // $and so setting one can never clobber the other.
    const andClauses: Filter<Document>[] = [];

    if (branchId) {
      andClauses.push({
        $or: [{ branchId: new ObjectId(branchId) }, { branchId: { $exists: false } }],
      });
    }

    if (type) {
      filter.type = type;
    }

    if (institutionType) {
      filter['applicableTo.institutionTypes'] = institutionType;
    }

    if (status) {
      filter.status = status;
    }

    if (search) {
      andClauses.push({
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { code: { $regex: search, $options: 'i' } },
          { shortName: { $regex: search, $options: 'i' } },
        ],
      });
    }

    // Sharing rules for curriculum pickers — mirrors isSubjectUsableByDepartment.
    if (usableByDepartmentId) {
      const deptOid = new ObjectId(usableByDepartmentId);
      andClauses.push({
        $or: [
          { sharing: 'global' },
          { ownerDepartmentId: { $exists: false } },
          { ownerDepartmentId: null },
          { ownerDepartmentId: deptOid },
          { sharing: 'shared', offeredToDepartmentIds: deptOid },
        ],
      });
    }

    if (andClauses.length > 0) {
      filter.$and = andClauses;
    }

    const skip = (page - 1) * limit;
    const sortDirection = sortOrder === 'asc' ? 1 : -1;

    const [subjects, total] = await Promise.all([
      collections.subjects
        .find(filter)
        .sort({ [sortBy]: sortDirection, _id: sortDirection })
        .skip(skip)
        .limit(limit)
        .toArray() as Promise<WithId<SubjectDocument>[]>,
      collections.subjects.countDocuments(filter),
    ]);

    // Batch-resolve owner departments so the catalogue can render names
    // without N+1 client fetches.
    const deptIds = [
      ...new Set(subjects.map((s) => s.ownerDepartmentId?.toString()).filter(Boolean)),
    ] as string[];
    const depts = deptIds.length
      ? await collections.departments
          .find({ _id: { $in: deptIds.map((id) => new ObjectId(id)) } })
          .project({ name: 1, code: 1 })
          .toArray()
      : [];
    const deptMap = new Map(depts.map((d) => [d._id.toString(), d]));

    return {
      data: subjects.map((s) => {
        const owner = s.ownerDepartmentId ? deptMap.get(s.ownerDepartmentId.toString()) : undefined;
        return {
          ...this.formatSubject(s),
          ownerDepartment: owner
            ? { _id: owner._id.toString(), name: owner.name as string, code: owner.code as string }
            : null,
        };
      }),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: skip + subjects.length < total,
      },
    };
  }

  async update(tenantId: string, subjectId: string, data: Partial<CreateSubjectInput>) {
    const existingSubject = (await collections.subjects.findOne({
      _id: new ObjectId(subjectId),
      tenantId: new ObjectId(tenantId),
    })) as WithId<SubjectDocument> | null;

    if (!existingSubject) {
      throw new ApiError('SUBJECT_NOT_FOUND', 'Subject not found', 404);
    }

    // Check code uniqueness if changing
    if (data.code && data.code.toUpperCase() !== existingSubject.code) {
      const codeConflict = await collections.subjects.findOne({
        tenantId: new ObjectId(tenantId),
        code: data.code.toUpperCase(),
        _id: { $ne: new ObjectId(subjectId) },
      });

      if (codeConflict) {
        throw new ApiError(
          'DUPLICATE_SUBJECT_CODE',
          'A subject with this code already exists',
          409
        );
      }
    }

    // Sharing invariants hold on the MERGED state — a partial update can't
    // leave a 'shared' subject without an owner or consumers.
    validateSharing({
      sharing: data.sharing ?? existingSubject.sharing,
      ownerDepartmentId:
        data.ownerDepartmentId !== undefined
          ? data.ownerDepartmentId
          : (existingSubject.ownerDepartmentId?.toString() ?? null),
      offeredToDepartmentIds:
        data.offeredToDepartmentIds ?? existingSubject.offeredToDepartmentIds?.map(String),
    });

    // Narrowing who may use the subject must not strand a department that
    // still teaches it.
    const merged = {
      sharing: data.sharing ?? existingSubject.sharing,
      ownerDepartmentId:
        data.ownerDepartmentId !== undefined
          ? data.ownerDepartmentId
          : existingSubject.ownerDepartmentId,
      offeredToDepartmentIds: data.offeredToDepartmentIds ?? existingSubject.offeredToDepartmentIds,
    };
    const after = departmentsWithAccess(merged);
    if (after) {
      const usage = await this.usageByDepartment(tenantId, subjectId);
      const stranded = [...usage.byDepartment].filter(
        ([deptId]) => deptId !== 'none' && !after.has(deptId)
      );
      if (stranded.length) {
        const places = stranded.flatMap(([, where]) => where);
        throw new ApiError(
          'SUBJECT_ACCESS_IN_USE',
          `Can't take this subject away from a department still using it: ${places
            .slice(0, 4)
            .join(
              '; '
            )}${places.length > 4 ? ` and ${places.length - 4} more` : ''}. Remove it there first.`,
          409
        );
      }
    }

    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (data.name !== undefined) updateData.name = data.name;
    if (data.code !== undefined) updateData.code = data.code.toUpperCase();
    if (data.shortName !== undefined) updateData.shortName = data.shortName;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.type !== undefined) updateData.type = data.type;
    if (data.category !== undefined) updateData.category = data.category;
    if (data.ltp !== undefined) updateData.ltp = data.ltp;
    if (data.applicableTo !== undefined) updateData.applicableTo = data.applicableTo;
    if (data.ownerDepartmentId !== undefined) {
      updateData.ownerDepartmentId = data.ownerDepartmentId
        ? new ObjectId(data.ownerDepartmentId)
        : null;
    }
    if (data.sharing !== undefined) updateData.sharing = data.sharing;
    if (data.offeredToDepartmentIds !== undefined) {
      updateData.offeredToDepartmentIds = data.offeredToDepartmentIds.map((id) => new ObjectId(id));
    }
    if (data.credits !== undefined) updateData.credits = data.credits;
    if (data.maxMarks !== undefined) updateData.maxMarks = data.maxMarks;
    if (data.passingMarks !== undefined) updateData.passingMarks = data.passingMarks;

    await collections.subjects.updateOne({ _id: new ObjectId(subjectId) }, { $set: updateData });

    logger.info({ subjectId, tenantId }, 'Subject updated');

    return this.findById(tenantId, subjectId);
  }

  async updateStatus(tenantId: string, subjectId: string, status: 'active' | 'inactive') {
    const subject = await collections.subjects.findOne({
      _id: new ObjectId(subjectId),
      tenantId: new ObjectId(tenantId),
    });

    if (!subject) {
      throw new ApiError('SUBJECT_NOT_FOUND', 'Subject not found', 404);
    }

    await collections.subjects.updateOne(
      { _id: new ObjectId(subjectId) },
      { $set: { status, updatedAt: new Date() } }
    );

    logger.info({ subjectId, tenantId, status }, 'Subject status updated');

    return this.findById(tenantId, subjectId);
  }

  async delete(tenantId: string, subjectId: string) {
    const subject = await collections.subjects.findOne({
      _id: new ObjectId(subjectId),
      tenantId: new ObjectId(tenantId),
    });

    if (!subject) {
      throw new ApiError('SUBJECT_NOT_FOUND', 'Subject not found', 404);
    }

    // Curriculum, sections and the timetable all point at the subject.
    const usage = await this.usageByDepartment(tenantId, subjectId);
    if (usage.places.length || usage.timetablePeriods) {
      const places = [
        ...usage.places,
        ...(usage.timetablePeriods ? [`${usage.timetablePeriods} timetable periods`] : []),
      ];
      throw new ApiError(
        'SUBJECT_IN_USE',
        `Still used in ${places.slice(0, 4).join('; ')}${places.length > 4 ? ` and ${places.length - 4} more` : ''}. Remove it from those first.`,
        409
      );
    }

    await collections.subjects.deleteOne({ _id: new ObjectId(subjectId) });

    logger.info({ subjectId, tenantId }, 'Subject deleted');

    return { success: true };
  }

  private formatSubject(subject: WithId<SubjectDocument>) {
    return {
      _id: subject._id.toString(),
      tenantId: subject.tenantId.toString(),
      branchId: subject.branchId?.toString(),
      name: subject.name,
      code: subject.code,
      shortName: subject.shortName,
      description: subject.description,
      type: subject.type,
      category: subject.category,
      ltp: subject.ltp,
      applicableTo: subject.applicableTo,
      ownerDepartmentId: subject.ownerDepartmentId?.toString() ?? null,
      sharing: subject.sharing ?? null,
      offeredToDepartmentIds: subject.offeredToDepartmentIds?.map((id) => id.toString()) ?? [],
      credits: subject.credits,
      maxMarks: subject.maxMarks,
      passingMarks: subject.passingMarks,
      status: subject.status,
      createdAt: subject.createdAt,
      updatedAt: subject.updatedAt,
    };
  }

  /**
   * Where one subject is used, grouped by the department using it: curriculum
   * semesters (by the scheme's department) and sections (by their year's
   * department). Timetable periods are counted, not grouped.
   */
  async usageByDepartment(tenantId: string, subjectId: string) {
    const tenantOid = new ObjectId(tenantId);
    const subjectOid = new ObjectId(subjectId);
    const [sections, schemes, timetablePeriods] = await Promise.all([
      collections.sections
        .find({
          tenantId: tenantOid,
          'subjects.subjectId': subjectOid,
          status: { $ne: 'inactive' },
        })
        .project({ name: 1, classId: 1 })
        .toArray(),
      collections.programSchemes
        .find({
          tenantId: tenantOid,
          status: { $ne: 'archived' },
          $or: [{ 'slots.subjectId': subjectOid }, { 'slots.options.subjectId': subjectOid }],
        })
        .project({ departmentId: 1, programName: 1, departmentCode: 1, semesterNumber: 1 })
        .toArray(),
      collections.timetableEntries.countDocuments({ tenantId: tenantOid, subjectId: subjectOid }),
    ]);
    const classes = sections.length
      ? await collections.classes
          .find({ _id: { $in: sections.map((x) => x.classId as ObjectId) } })
          .project({ displayName: 1, departmentId: 1 })
          .toArray()
      : [];
    const classById = new Map(classes.map((c) => [String(c._id), c]));
    const byDepartment = new Map<string, string[]>();
    const places: string[] = [];
    const note = (deptId: unknown, where: string) => {
      if (places.includes(where)) return; // the same section in this and next year
      places.push(where);
      const key = deptId ? String(deptId) : 'none';
      byDepartment.set(key, [...(byDepartment.get(key) ?? []), where]);
    };
    for (const sc of schemes) {
      note(
        sc.departmentId,
        `${sc.programName || sc.departmentCode} Sem ${sc.semesterNumber} curriculum`
      );
    }
    for (const sec of sections) {
      const cls = classById.get(String(sec.classId));
      const name = String(cls?.displayName ?? '')
        .split(' · ')
        .slice(-2)
        .join(' · ');
      note(cls?.departmentId, `${name} · Section ${sec.name}`);
    }
    return { byDepartment, places, timetablePeriods };
  }

  /**
   * Every subject on the campus with where it is used: the curriculum
   * semesters it sits in and, this academic year, each section that teaches
   * it and who teaches it there.
   */
  async usage(tenantId: string, branchId: string) {
    const tenantOid = new ObjectId(tenantId);
    const branchOid = new ObjectId(branchId);
    const batch = await collections.academicBatches.findOne(
      { tenantId: tenantOid, branchId: branchOid, isCurrent: true },
      { projection: { _id: 1, name: 1 } }
    );
    const [subjects, schemes, classes] = await Promise.all([
      collections.subjects
        .find({
          tenantId: tenantOid,
          status: 'active',
          $or: [{ branchId: branchOid }, { branchId: { $exists: false } }],
        })
        .project({
          name: 1,
          code: 1,
          credits: 1,
          type: 1,
          ownerDepartmentId: 1,
          sharing: 1,
          offeredToDepartmentIds: 1,
        })
        .sort({ name: 1 })
        .toArray(),
      collections.programSchemes
        .find({ tenantId: tenantOid, branchId: branchOid, status: { $ne: 'archived' } })
        .project({
          programId: 1,
          programName: 1,
          departmentCode: 1,
          semesterNumber: 1,
          status: 1,
          slots: 1,
        })
        .toArray(),
      collections.classes
        .find({
          tenantId: tenantOid,
          branchId: branchOid,
          ...(batch && { academicBatchId: batch._id }),
          status: 'active',
        })
        .project({ displayName: 1, departmentId: 1, programId: 1 })
        .toArray(),
    ]);
    const classById = new Map(classes.map((c) => [String(c._id), c]));
    const [sections, departments] = await Promise.all([
      classes.length
        ? collections.sections
            .find({
              tenantId: tenantOid,
              classId: { $in: classes.map((c) => c._id) },
              status: 'active',
            })
            .project({ name: 1, classId: 1, subjects: 1 })
            .toArray()
        : [],
      collections.departments.find({ tenantId: tenantOid }).project({ name: 1, code: 1 }).toArray(),
    ]);
    const teacherIds = [
      ...new Set(
        sections.flatMap((s) =>
          ((s.subjects ?? []) as Array<{ teacherId?: ObjectId }>)
            .map((x) => x.teacherId && String(x.teacherId))
            .filter(Boolean)
        )
      ),
    ] as string[];
    const teachers = teacherIds.length
      ? await collections.staff
          .find({ _id: { $in: teacherIds.map((id) => new ObjectId(id)) } })
          .project({ displayName: 1, firstName: 1, lastName: 1, employeeId: 1 })
          .toArray()
      : [];
    const teacherName = new Map(
      teachers.map((t) => [
        String(t._id),
        (t.displayName as string) || [t.firstName, t.lastName].filter(Boolean).join(' '),
      ])
    );
    const deptById = new Map(departments.map((d) => [String(d._id), d]));

    type CurriculumUse = {
      programId: string | null;
      programName: string;
      semesterNumber: number;
      elective: boolean;
      status: string;
    };
    type SectionUse = {
      sectionId: string;
      sectionName: string;
      classId: string;
      className: string;
      teacherId: string | null;
      teacherName: string | null;
    };
    const curriculum = new Map<string, CurriculumUse[]>();
    const add = <T>(m: Map<string, T[]>, k: string, v: T) => {
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(v);
    };
    for (const sc of schemes) {
      const base = {
        programId: sc.programId ? String(sc.programId) : null,
        programName: (sc.programName as string) || (sc.departmentCode as string),
        semesterNumber: sc.semesterNumber as number,
        status: sc.status as string,
      };
      for (const slot of (sc.slots ?? []) as Array<{
        kind: string;
        subjectId?: ObjectId;
        options?: Array<{ subjectId: ObjectId }>;
      }>) {
        if (slot.kind === 'core' && slot.subjectId)
          add(curriculum, String(slot.subjectId), { ...base, elective: false });
        for (const o of slot.options ?? [])
          add(curriculum, String(o.subjectId), { ...base, elective: true });
      }
    }
    const taught = new Map<string, SectionUse[]>();
    for (const sec of sections) {
      const cls = classById.get(String(sec.classId));
      for (const x of (sec.subjects ?? []) as Array<{
        subjectId: ObjectId;
        teacherId?: ObjectId | null;
      }>) {
        const tid = x.teacherId ? String(x.teacherId) : null;
        add(taught, String(x.subjectId), {
          sectionId: String(sec._id),
          sectionName: sec.name as string,
          classId: String(sec.classId),
          className: (cls?.displayName as string) ?? '',
          teacherId: tid,
          teacherName: tid ? (teacherName.get(tid) ?? null) : null,
        });
      }
    }

    return {
      academicYear: (batch?.name as string) ?? null,
      subjects: subjects.map((s) => {
        const owner = s.ownerDepartmentId ? deptById.get(String(s.ownerDepartmentId)) : undefined;
        return {
          _id: String(s._id),
          name: s.name as string,
          code: s.code as string,
          credits: s.credits as number | undefined,
          type: s.type as string | undefined,
          sharing: (s.sharing as string) ?? null,
          offeredTo: ((s.offeredToDepartmentIds ?? []) as unknown[])
            .map((id) => deptById.get(String(id)))
            .filter(Boolean)
            .map((d) => ({
              _id: String(d!._id),
              name: d!.name as string,
              code: d!.code as string,
            })),
          department: owner
            ? { _id: String(owner._id), name: owner.name as string, code: owner.code as string }
            : null,
          curriculum: (curriculum.get(String(s._id)) ?? []).sort(
            (a, b) =>
              a.programName.localeCompare(b.programName) || a.semesterNumber - b.semesterNumber
          ),
          sections: (taught.get(String(s._id)) ?? []).sort(
            (a, b) =>
              a.className.localeCompare(b.className) || a.sectionName.localeCompare(b.sectionName)
          ),
        };
      }),
    };
  }
}

export const subjectService = new SubjectService();
