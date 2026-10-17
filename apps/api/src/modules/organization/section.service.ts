import { ObjectId, WithId, Document } from 'mongodb';
import { collections } from '../../config/database';
import { logger } from '../../lib/logger';
import { ApiError } from '../../middleware/errorHandler';
import { CreateSectionInput } from '@campus-verse/shared';
import { isSubjectUsableByDepartment } from '@campus-verse/shared/utils';
import { hrSettingsService } from '../hr/hrSettings.service';

interface SectionSubjectEntry {
  subjectId: ObjectId;
  teacherId?: ObjectId;
  periodsPerWeek?: number;
  /**
   * Which semester of the program this subject is taught in. A Year-N section
   * spans semesters 2N-1 and 2N, so its subject list carries both — this tag
   * lets the UI group them. Set when a curriculum is published; absent for
   * schools and manually-added subjects.
   */
  semesterNumber?: number;
}

interface SectionDocument extends Document {
  _id: ObjectId;
  tenantId: ObjectId;
  branchId: ObjectId;
  classId: ObjectId;
  name: string;
  code: string;
  capacity?: number;
  sectionTeacherId?: ObjectId;
  subjects?: SectionSubjectEntry[];
  /** Lab batches; student membership lives on currentEnrollment.labBatchId. */
  batches?: Array<{ _id: ObjectId; name: string }>;
  roomNumber?: string;
  status: 'active' | 'inactive';
  createdBy?: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface SectionListParams {
  page?: number;
  limit?: number;
  classId?: string;
  status?: 'active' | 'inactive';
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  /** Department-scope narrowing (middleware/scope.ts); intersects with classId. */
  restrictToClassIds?: ObjectId[];
}

class SectionService {
  async create(tenantId: string, branchId: string, data: CreateSectionInput, createdBy?: string) {
    // Validate class exists
    const classDoc = await collections.classes.findOne({
      _id: new ObjectId(data.classId),
      tenantId: new ObjectId(tenantId),
    });

    if (!classDoc) {
      throw new ApiError('CLASS_NOT_FOUND', 'Class not found', 404);
    }

    // Check for duplicate section in same class (case-insensitive: "Section A" and
    // "section a" should clash) — uses a regex with an escaped exact-match pattern.
    const escapedName = data.name.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const existingSection = await collections.sections.findOne({
      tenantId: new ObjectId(tenantId),
      classId: new ObjectId(data.classId),
      name: { $regex: `^${escapedName}$`, $options: 'i' },
    });

    if (existingSection) {
      throw new ApiError(
        'DUPLICATE_SECTION',
        'A section with this name already exists in this class',
        409
      );
    }

    const sectionId = new ObjectId();
    const now = new Date();
    const trimmedName = data.name.trim();
    // Code is a machine-friendly identifier — keep it uppercased.
    const code = data.code || trimmedName.toUpperCase();

    const section: Omit<SectionDocument, '_id'> & { _id: ObjectId } = {
      _id: sectionId,
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
      classId: new ObjectId(data.classId),
      // Preserve the case the user typed — display reads this directly.
      name: trimmedName,
      code,
      // capacity: data.capacity, // commented out — capacity is optional and not collected from UI
      roomNumber: data.roomNumber,
      status: 'active',
      createdAt: now,
      updatedAt: now,
      ...(createdBy && { createdBy: new ObjectId(createdBy) }),
    };

    await collections.sections.insertOne(section);

    logger.info(
      { sectionId: sectionId.toString(), tenantId, classId: data.classId },
      'Section created'
    );

    return this.formatSection(section as WithId<SectionDocument>);
  }

  async findById(tenantId: string, sectionId: string) {
    const pipeline = [
      {
        $match: {
          _id: new ObjectId(sectionId),
          tenantId: new ObjectId(tenantId),
        },
      },
      {
        $lookup: {
          from: 'staff',
          localField: 'sectionTeacherId',
          foreignField: '_id',
          as: 'teacherData',
        },
      },
      {
        $lookup: {
          from: 'students',
          let: { sectionId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$currentEnrollment.sectionId', '$$sectionId'] },
                    { $eq: ['$status', 'active'] },
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
        $addFields: {
          studentCount: {
            $ifNull: [{ $arrayElemAt: ['$studentData.count', 0] }, 0],
          },
          classTeacher: {
            $cond: {
              if: { $gt: [{ $size: '$teacherData' }, 0] },
              then: {
                _id: { $toString: { $arrayElemAt: ['$teacherData._id', 0] } },
                name: {
                  $concat: [
                    { $arrayElemAt: ['$teacherData.firstName', 0] },
                    ' ',
                    { $arrayElemAt: ['$teacherData.lastName', 0] },
                  ],
                },
              },
              else: null,
            },
          },
        },
      },
      { $project: { studentData: 0, teacherData: 0 } },
    ];

    const sections = await collections.sections.aggregate(pipeline).toArray();

    if (sections.length === 0) {
      throw new ApiError('SECTION_NOT_FOUND', 'Section not found', 404);
    }

    const section = sections[0] as WithId<SectionDocument> & {
      studentCount: number;
      classTeacher: { _id: string; name: string } | null;
    };
    return this.formatSectionWithTeacher(section);
  }

  async findByClassId(tenantId: string, classId: string, params: SectionListParams = {}) {
    const { page = 1, limit = 50, status, sortBy = 'name', sortOrder = 'asc' } = params;

    const matchStage: Record<string, unknown> = {
      tenantId: new ObjectId(tenantId),
      classId: new ObjectId(classId),
    };

    if (status) {
      matchStage.status = status;
    }

    const skip = (page - 1) * limit;
    const sortDirection = sortOrder === 'asc' ? 1 : -1;

    // Use aggregation to include student counts and class teacher details
    const pipeline = [
      { $match: matchStage },
      {
        $lookup: {
          from: 'students',
          let: { sectionId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$currentEnrollment.sectionId', '$$sectionId'] },
                    { $eq: ['$status', 'active'] },
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
          from: 'staff',
          localField: 'sectionTeacherId',
          foreignField: '_id',
          as: 'teacherData',
        },
      },
      {
        $addFields: {
          studentCount: {
            $ifNull: [{ $arrayElemAt: ['$studentData.count', 0] }, 0],
          },
          classTeacher: {
            $cond: {
              if: { $gt: [{ $size: '$teacherData' }, 0] },
              then: {
                _id: { $toString: { $arrayElemAt: ['$teacherData._id', 0] } },
                name: {
                  $concat: [
                    { $arrayElemAt: ['$teacherData.firstName', 0] },
                    ' ',
                    { $arrayElemAt: ['$teacherData.lastName', 0] },
                  ],
                },
              },
              else: null,
            },
          },
        },
      },
      { $project: { studentData: 0, teacherData: 0 } },
      { $sort: { [sortBy]: sortDirection, _id: sortDirection } },
      { $skip: skip },
      { $limit: limit },
    ];

    const [sections, total] = await Promise.all([
      collections.sections.aggregate(pipeline).toArray(),
      collections.sections.countDocuments(matchStage),
    ]);

    return {
      data: sections.map((s) =>
        this.formatSectionWithTeacher(
          s as WithId<SectionDocument> & {
            studentCount: number;
            classTeacher: { _id: string; name: string } | null;
          }
        )
      ),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: skip + sections.length < total,
      },
    };
  }

  async findAll(tenantId: string, branchId: string, params: SectionListParams = {}) {
    const { page = 1, limit = 100, classId, status, sortBy = 'name', sortOrder = 'asc' } = params;

    const matchStage: Record<string, unknown> = {
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
    };

    const { restrictToClassIds } = params;
    if (classId) {
      const classOid = new ObjectId(classId);
      // Scope wins over an explicit filter: a class outside the caller's
      // departments yields nothing, not everything.
      matchStage.classId =
        restrictToClassIds && !restrictToClassIds.some((id) => id.equals(classOid))
          ? { $in: [] }
          : classOid;
    } else if (restrictToClassIds) {
      matchStage.classId = { $in: restrictToClassIds };
    }

    if (status) {
      matchStage.status = status;
    }

    const skip = (page - 1) * limit;
    const sortDirection = sortOrder === 'asc' ? 1 : -1;

    // Use aggregation to include student counts
    const pipeline = [
      { $match: matchStage },
      {
        $lookup: {
          from: 'students',
          let: { sectionId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$currentEnrollment.sectionId', '$$sectionId'] },
                    { $eq: ['$status', 'active'] },
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
        $addFields: {
          studentCount: {
            $ifNull: [{ $arrayElemAt: ['$studentData.count', 0] }, 0],
          },
        },
      },
      { $project: { studentData: 0 } },
      { $sort: { [sortBy]: sortDirection, _id: sortDirection } },
      { $skip: skip },
      { $limit: limit },
    ];

    const [sections, totalResult] = await Promise.all([
      collections.sections.aggregate(pipeline).toArray(),
      collections.sections.countDocuments(matchStage),
    ]);

    return {
      data: sections.map((s) =>
        this.formatSectionWithCount(s as WithId<SectionDocument> & { studentCount: number })
      ),
      meta: {
        page,
        limit,
        total: totalResult,
        totalPages: Math.ceil(totalResult / limit),
        hasMore: skip + sections.length < totalResult,
      },
    };
  }

  async update(tenantId: string, sectionId: string, data: Partial<CreateSectionInput>) {
    const existingSection = (await collections.sections.findOne({
      _id: new ObjectId(sectionId),
      tenantId: new ObjectId(tenantId),
    })) as WithId<SectionDocument> | null;

    if (!existingSection) {
      throw new ApiError('SECTION_NOT_FOUND', 'Section not found', 404);
    }

    // Check name uniqueness if changing
    if (data.name && data.name.toUpperCase() !== existingSection.name) {
      const nameConflict = await collections.sections.findOne({
        tenantId: new ObjectId(tenantId),
        classId: existingSection.classId,
        name: data.name.toUpperCase(),
        _id: { $ne: new ObjectId(sectionId) },
      });

      if (nameConflict) {
        throw new ApiError(
          'DUPLICATE_SECTION',
          'A section with this name already exists in this class',
          409
        );
      }
    }

    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (data.name !== undefined) updateData.name = data.name.toUpperCase();
    if (data.code !== undefined) updateData.code = data.code;
    // if (data.capacity !== undefined) updateData.capacity = data.capacity; // commented out
    if (data.roomNumber !== undefined) updateData.roomNumber = data.roomNumber;

    await collections.sections.updateOne({ _id: new ObjectId(sectionId) }, { $set: updateData });

    // Students carry the section name for lists and reports; keep it in step.
    if (updateData.name && updateData.name !== existingSection.name) {
      await collections.students.updateMany(
        {
          tenantId: new ObjectId(tenantId),
          'currentEnrollment.sectionId': new ObjectId(sectionId),
        },
        { $set: { 'currentEnrollment.sectionName': updateData.name } }
      );
    }

    logger.info({ sectionId, tenantId }, 'Section updated');

    return this.findById(tenantId, sectionId);
  }

  async updateStatus(tenantId: string, sectionId: string, status: 'active' | 'inactive') {
    const section = await collections.sections.findOne({
      _id: new ObjectId(sectionId),
      tenantId: new ObjectId(tenantId),
    });

    if (!section) {
      throw new ApiError('SECTION_NOT_FOUND', 'Section not found', 404);
    }

    await collections.sections.updateOne(
      { _id: new ObjectId(sectionId) },
      { $set: { status, updatedAt: new Date() } }
    );

    logger.info({ sectionId, tenantId, status }, 'Section status updated');

    return this.findById(tenantId, sectionId);
  }

  async delete(tenantId: string, sectionId: string) {
    const section = await collections.sections.findOne({
      _id: new ObjectId(sectionId),
      tenantId: new ObjectId(tenantId),
    });

    if (!section) {
      throw new ApiError('SECTION_NOT_FOUND', 'Section not found', 404);
    }

    // Check if section has active students
    const studentCount = await collections.students.countDocuments({
      'currentEnrollment.sectionId': new ObjectId(sectionId),
      status: 'active',
    });

    if (studentCount > 0) {
      throw new ApiError(
        'SECTION_HAS_STUDENTS',
        `Cannot delete section with ${studentCount} enrolled students`,
        400
      );
    }

    await collections.sections.deleteOne({ _id: new ObjectId(sectionId) });

    logger.info({ sectionId, tenantId }, 'Section deleted');

    return { success: true };
  }

  async getStudentCount(tenantId: string, sectionId: string) {
    const count = await collections.students.countDocuments({
      tenantId: new ObjectId(tenantId),
      'currentEnrollment.sectionId': new ObjectId(sectionId),
      status: 'active',
    });

    return { count };
  }

  /**
   * Resolves an id that may be either a staff `_id` or a user `_id` into a real
   * staff `_id`. When the id belongs to a user with the TEACHER role and there is
   * no staff record yet, one is auto-created and linked back to the user.
   *
   * This bridges `getTeachers()` returning a mixed list of staff + teacher-users
   * with the write paths (section teacher, subject teacher) that store a staff
   * `_id` only.
   */
  private async resolveTeacherStaffId(
    tenantId: string,
    idMaybeStaffOrUser: string,
    branchHint?: ObjectId
  ): Promise<ObjectId> {
    const candidate = new ObjectId(idMaybeStaffOrUser);

    const staff = await collections.staff.findOne({
      _id: candidate,
      tenantId: new ObjectId(tenantId),
      status: 'active',
    });
    if (staff) return candidate;

    // Fall back: maybe it's a user id for a teacher who has no staff record yet.
    const user = await collections.users.findOne({
      _id: candidate,
      tenantId: new ObjectId(tenantId),
      status: { $in: ['active', 'pending'] },
    });
    if (!user) {
      throw new ApiError('STAFF_NOT_FOUND', 'Staff member not found', 404);
    }

    const newStaffId = new ObjectId();
    const branchId =
      branchHint?.toString() ||
      (
        user as { accessScope?: { branchIds?: ObjectId[] } }
      ).accessScope?.branchIds?.[0]?.toString();
    if (!branchId) {
      throw new ApiError(
        'BRANCH_REQUIRED',
        'Cannot determine a branch to create a staff record for this teacher',
        400
      );
    }

    let employeeId: string;
    try {
      employeeId = await hrSettingsService.generateEmployeeId(tenantId, branchId);
    } catch {
      employeeId = `EMP${Date.now().toString(36).toUpperCase()}`;
    }

    const now = new Date();
    const profile = (
      user as unknown as {
        profile: { firstName: string; lastName: string; displayName?: string };
      }
    ).profile;

    await collections.staff.insertOne({
      _id: newStaffId,
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
      employeeId,
      userId: user._id,
      firstName: profile.firstName,
      lastName: profile.lastName,
      displayName: profile.displayName || `${profile.firstName} ${profile.lastName}`,
      contact: {
        email: (user as unknown as { email: string }).email,
        phone: (user as unknown as { phone?: string }).phone || '',
      },
      employment: {
        joiningDate: now,
        employmentType: 'permanent',
      },
      teaching: {
        isTeaching: true,
      },
      status: 'active',
      statusHistory: [
        {
          status: 'active',
          date: now,
          reason: 'Auto-created from user assignment',
          changedBy: user._id,
        },
      ],
      createdAt: now,
      updatedAt: now,
    });

    await collections.users.updateOne(
      { _id: user._id },
      { $set: { staffId: newStaffId, updatedAt: now } }
    );

    logger.info(
      { staffId: newStaffId.toString(), userId: idMaybeStaffOrUser, tenantId },
      'Auto-created staff record from user'
    );

    return newStaffId;
  }

  async assignTeacher(tenantId: string, sectionId: string, staffId: string | null) {
    const section = await collections.sections.findOne({
      _id: new ObjectId(sectionId),
      tenantId: new ObjectId(tenantId),
    });

    if (!section) {
      throw new ApiError('SECTION_NOT_FOUND', 'Section not found', 404);
    }

    // If assigning a teacher (not removing)
    if (staffId) {
      const resolvedStaffId = await this.resolveTeacherStaffId(
        tenantId,
        staffId,
        section.branchId as ObjectId
      );

      // Check if this teacher is already assigned to another section
      const existingAssignment = await collections.sections.findOne({
        tenantId: new ObjectId(tenantId),
        sectionTeacherId: resolvedStaffId,
        _id: { $ne: new ObjectId(sectionId) },
      });

      if (existingAssignment) {
        throw new ApiError(
          'TEACHER_ALREADY_ASSIGNED',
          `This teacher is already assigned to ${existingAssignment.name}`,
          409
        );
      }

      // Update section with teacher
      await collections.sections.updateOne(
        { _id: new ObjectId(sectionId) },
        { $set: { sectionTeacherId: resolvedStaffId, updatedAt: new Date() } }
      );

      // Also update staff's classTeacherOf field
      await collections.staff.updateOne(
        { _id: resolvedStaffId },
        { $set: { 'teaching.classTeacherOf': new ObjectId(sectionId), updatedAt: new Date() } }
      );

      logger.info(
        { sectionId, staffId: resolvedStaffId.toString(), tenantId },
        'Teacher assigned to section'
      );
    } else {
      // Remove teacher assignment
      const currentTeacherId = (section as { sectionTeacherId?: ObjectId }).sectionTeacherId;

      await collections.sections.updateOne(
        { _id: new ObjectId(sectionId) },
        { $unset: { sectionTeacherId: '' }, $set: { updatedAt: new Date() } }
      );

      // Clear staff's classTeacherOf if it was this section
      if (currentTeacherId) {
        await collections.staff.updateOne(
          { _id: currentTeacherId, 'teaching.classTeacherOf': new ObjectId(sectionId) },
          { $unset: { 'teaching.classTeacherOf': '' }, $set: { updatedAt: new Date() } }
        );
      }

      logger.info({ sectionId, tenantId }, 'Teacher removed from section');
    }

    return this.findById(tenantId, sectionId);
  }

  async getTeachers(tenantId: string, branchId: string) {
    const tenantOid = new ObjectId(tenantId);
    const branchOid = new ObjectId(branchId);

    // Get teaching staff from staff collection
    const staffTeachers = await collections.staff
      .find({
        tenantId: tenantOid,
        $or: [{ branchId: branchOid }, { additionalBranches: branchOid }],
        status: 'active',
        'teaching.isTeaching': true,
      })
      .project({
        _id: 1,
        firstName: 1,
        lastName: 1,
        displayName: 1,
        employeeId: 1,
        userId: 1,
        'teaching.classTeacherOf': 1,
      })
      .toArray();

    const staffResults = staffTeachers.map((t) => ({
      _id: (t._id as ObjectId).toString(),
      name: t.displayName || `${t.firstName} ${t.lastName}`,
      employeeId: t.employeeId,
      classTeacherOf: (t.teaching as { classTeacherOf?: ObjectId })?.classTeacherOf?.toString(),
    }));

    // Collect user IDs already represented by staff records
    const staffLinkedUserIds = new Set(
      staffTeachers.filter((s) => s.userId).map((s) => (s.userId as ObjectId).toString())
    );

    // Also get users with TEACHER role who don't have staff records yet
    const teacherRoles = await collections.roles
      .find({ tenantId: tenantOid, code: 'TEACHER' })
      .project({ _id: 1 })
      .toArray();

    if (teacherRoles.length > 0) {
      const teacherRoleIds = teacherRoles.map((r) => r._id);

      const userTeachers = await collections.users
        .find({
          tenantId: tenantOid,
          roleId: { $in: teacherRoleIds },
          status: { $in: ['active', 'pending'] },
          $or: [{ 'accessScope.type': 'global' }, { 'accessScope.branchIds': branchOid }],
        })
        .project({
          _id: 1,
          'profile.firstName': 1,
          'profile.lastName': 1,
          'profile.displayName': 1,
        })
        .toArray();

      // Filter out users already represented by staff records
      const newUserTeachers = userTeachers.filter(
        (u) => !staffLinkedUserIds.has((u._id as ObjectId).toString())
      );

      // Check sections for existing assignments by these user IDs
      // (in case a user was previously assigned and got a staff record that was later deleted)
      const userIds = newUserTeachers.map((u) => u._id as ObjectId);
      const assignedSections =
        userIds.length > 0
          ? await collections.sections
              .find({
                tenantId: tenantOid,
                sectionTeacherId: { $in: userIds },
              })
              .project({ sectionTeacherId: 1, _id: 1 })
              .toArray()
          : [];

      const assignmentMap = new Map(
        assignedSections.map((s) => [
          (s.sectionTeacherId as ObjectId).toString(),
          (s._id as ObjectId).toString(),
        ])
      );

      const userResults = newUserTeachers.map((u) => {
        const profile = u.profile as { firstName: string; lastName: string; displayName?: string };
        return {
          _id: (u._id as ObjectId).toString(),
          name: profile.displayName || `${profile.firstName} ${profile.lastName}`,
          employeeId: undefined as string | undefined,
          classTeacherOf: assignmentMap.get((u._id as ObjectId).toString()),
        };
      });

      return [...staffResults, ...userResults];
    }

    return staffResults;
  }

  async getSubjects(tenantId: string, sectionId: string) {
    const section = (await collections.sections.findOne({
      _id: new ObjectId(sectionId),
      tenantId: new ObjectId(tenantId),
    })) as WithId<SectionDocument> | null;

    if (!section) {
      throw new ApiError('SECTION_NOT_FOUND', 'Section not found', 404);
    }

    const entries = section.subjects ?? [];
    if (entries.length === 0) return [];

    const subjectIds = entries.map((s) => s.subjectId);
    const subjects = await collections.subjects.find({ _id: { $in: subjectIds } }).toArray();
    const subjectMap = new Map(subjects.map((s) => [s._id.toString(), s]));

    const teacherIds = entries
      .map((s) => s.teacherId)
      .filter((id): id is ObjectId => id !== undefined && id !== null);
    const teachers =
      teacherIds.length > 0
        ? await collections.staff
            .find({ _id: { $in: teacherIds } })
            .project({ _id: 1, firstName: 1, lastName: 1, displayName: 1 })
            .toArray()
        : [];
    const teacherMap = new Map(
      teachers.map((t) => [
        (t._id as ObjectId).toString(),
        {
          _id: (t._id as ObjectId).toString(),
          name:
            (t.displayName as string) || `${t.firstName ?? ''} ${t.lastName ?? ''}`.trim() || '',
        },
      ])
    );

    return entries.map((entry) => {
      const subject = subjectMap.get(entry.subjectId.toString());
      const teacherInfo = entry.teacherId ? teacherMap.get(entry.teacherId.toString()) : null;
      return {
        subjectId: entry.subjectId.toString(),
        teacherId: entry.teacherId?.toString() ?? null,
        periodsPerWeek: entry.periodsPerWeek,
        semesterNumber: entry.semesterNumber,
        subject: subject
          ? {
              _id: subject._id.toString(),
              name: subject.name,
              code: subject.code,
              shortName: subject.shortName,
              type: subject.type,
            }
          : null,
        teacher: teacherInfo ?? null,
      };
    });
  }

  async assignSubject(
    tenantId: string,
    sectionId: string,
    data: { subjectId: string; teacherId?: string; periodsPerWeek?: number }
  ) {
    const section = (await collections.sections.findOne({
      _id: new ObjectId(sectionId),
      tenantId: new ObjectId(tenantId),
    })) as WithId<SectionDocument> | null;

    if (!section) {
      throw new ApiError('SECTION_NOT_FOUND', 'Section not found', 404);
    }

    const subject = await collections.subjects.findOne({
      _id: new ObjectId(data.subjectId),
      tenantId: new ObjectId(tenantId),
    });

    if (!subject) {
      throw new ApiError('SUBJECT_NOT_FOUND', 'Subject not found', 404);
    }

    // Sharing rules: when the section's class resolves to a department, the
    // subject must be global, unowned, owned by that department, or offered to
    // it. Classes without a departmentId (schools) skip this entirely.
    const classDoc = await collections.classes.findOne(
      { _id: section.classId, tenantId: new ObjectId(tenantId) },
      { projection: { departmentId: 1 } }
    );
    const classDepartmentId = classDoc?.departmentId ? String(classDoc.departmentId) : null;
    const sharingView = subject as {
      sharing?: 'global' | 'core' | 'shared';
      ownerDepartmentId?: ObjectId;
      offeredToDepartmentIds?: ObjectId[];
    };
    if (!isSubjectUsableByDepartment(sharingView, classDepartmentId)) {
      throw new ApiError(
        'SUBJECT_NOT_OFFERED',
        "This subject is not offered to this class's department — check the subject's sharing settings",
        400
      );
    }

    const existing = section.subjects ?? [];
    if (existing.some((s) => s.subjectId.toString() === data.subjectId)) {
      throw new ApiError(
        'SUBJECT_ALREADY_ASSIGNED',
        'Subject is already assigned to this section',
        409
      );
    }

    // Resolve teacher id — accepts either a staff `_id` or a user `_id`,
    // auto-creating a staff record for the latter (mirrors assignTeacher).
    const resolvedTeacherId = data.teacherId
      ? await this.resolveTeacherStaffId(tenantId, data.teacherId, section.branchId as ObjectId)
      : undefined;

    const newEntry: SectionSubjectEntry = {
      subjectId: new ObjectId(data.subjectId),
      ...(resolvedTeacherId && { teacherId: resolvedTeacherId }),
      periodsPerWeek: data.periodsPerWeek ?? 0,
    };

    await collections.sections.updateOne({ _id: new ObjectId(sectionId) }, {
      $push: { subjects: newEntry },
      $set: { updatedAt: new Date() },
    } as unknown as import('mongodb').UpdateFilter<Document>);

    logger.info({ sectionId, subjectId: data.subjectId, tenantId }, 'Subject assigned to section');

    return this.getSubjects(tenantId, sectionId);
  }

  async updateSubject(
    tenantId: string,
    sectionId: string,
    subjectId: string,
    data: { teacherId?: string | null; periodsPerWeek?: number }
  ) {
    const section = await collections.sections.findOne({
      _id: new ObjectId(sectionId),
      tenantId: new ObjectId(tenantId),
    });

    if (!section) {
      throw new ApiError('SECTION_NOT_FOUND', 'Section not found', 404);
    }

    const updateFields: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (data.periodsPerWeek !== undefined) {
      updateFields['subjects.$.periodsPerWeek'] = data.periodsPerWeek ?? 0;
    }

    if (data.teacherId === null) {
      updateFields['subjects.$.teacherId'] = null;
    } else if (data.teacherId) {
      // Accept staff or user id — auto-create a staff record when needed so the
      // dropdown's mixed-source values always resolve to a real staff `_id`.
      updateFields['subjects.$.teacherId'] = await this.resolveTeacherStaffId(
        tenantId,
        data.teacherId,
        section.branchId as ObjectId
      );
    }

    await collections.sections.updateOne(
      {
        _id: new ObjectId(sectionId),
        'subjects.subjectId': new ObjectId(subjectId),
      },
      { $set: updateFields }
    );

    logger.info({ sectionId, subjectId, tenantId }, 'Section subject updated');

    return this.getSubjects(tenantId, sectionId);
  }

  async removeSubject(tenantId: string, sectionId: string, subjectId: string) {
    const section = await collections.sections.findOne({
      _id: new ObjectId(sectionId),
      tenantId: new ObjectId(tenantId),
    });

    if (!section) {
      throw new ApiError('SECTION_NOT_FOUND', 'Section not found', 404);
    }

    await collections.sections.updateOne({ _id: new ObjectId(sectionId) }, {
      $pull: { subjects: { subjectId: new ObjectId(subjectId) } },
      $set: { updatedAt: new Date() },
    } as unknown as import('mongodb').UpdateFilter<Document>);

    logger.info({ sectionId, subjectId, tenantId }, 'Subject removed from section');

    return { success: true };
  }

  /**
   * Replace the section's lab-batch list. Batches whose _id is passed back
   * keep their identity (and their students); removed batches have their
   * student memberships cleared.
   */
  async updateBatches(
    tenantId: string,
    sectionId: string,
    batches: Array<{ _id?: string; name: string }>
  ) {
    const section = (await collections.sections.findOne({
      _id: new ObjectId(sectionId),
      tenantId: new ObjectId(tenantId),
    })) as WithId<SectionDocument> | null;

    if (!section) {
      throw new ApiError('SECTION_NOT_FOUND', 'Section not found', 404);
    }

    const existingIds = new Set((section.batches ?? []).map((b) => b._id.toString()));
    const newList = batches.map((b) => ({
      _id: b._id && existingIds.has(b._id) ? new ObjectId(b._id) : new ObjectId(),
      name: b.name.trim(),
    }));

    const lower = newList.map((b) => b.name.toLowerCase());
    if (new Set(lower).size !== lower.length) {
      throw new ApiError(
        'DUPLICATE_BATCH',
        'Two lab batches in a section cannot share a name',
        400
      );
    }

    const keptIds = new Set(newList.map((b) => b._id.toString()));
    const removedIds = [...existingIds].filter((id) => !keptIds.has(id));
    // A batch with lab periods would leave them pointing at nothing.
    if (removedIds.length > 0) {
      const inUse = await collections.timetableEntries.countDocuments({
        tenantId: new ObjectId(tenantId),
        sectionId: section._id,
        batchId: { $in: removedIds.map((id) => new ObjectId(id)) },
      });
      if (inUse > 0) {
        const names = (section.batches ?? [])
          .filter((b) => removedIds.includes(b._id.toString()))
          .map((b) => b.name)
          .join(', ');
        throw new ApiError(
          'BATCH_IN_USE',
          `${names} still ha${removedIds.length === 1 ? 's' : 've'} ${inUse} lab period${inUse === 1 ? '' : 's'} in the timetable — clear those first`,
          409
        );
      }
    }
    if (removedIds.length > 0) {
      await collections.students.updateMany(
        {
          tenantId: new ObjectId(tenantId),
          'currentEnrollment.sectionId': section._id,
          'currentEnrollment.labBatchId': { $in: removedIds.map((id) => new ObjectId(id)) },
        },
        { $unset: { 'currentEnrollment.labBatchId': '' } }
      );
    }

    await collections.sections.updateOne(
      { _id: section._id },
      { $set: { batches: newList, updatedAt: new Date() } }
    );

    logger.info(
      { sectionId, tenantId, batchCount: newList.length, removed: removedIds.length },
      'Section lab batches updated'
    );

    return this.findById(tenantId, sectionId);
  }

  /** Assign students of this section to lab batches (null clears). */
  async assignStudentsToBatches(
    tenantId: string,
    sectionId: string,
    assignments: Array<{ studentId: string; batchId: string | null }>
  ) {
    const section = (await collections.sections.findOne({
      _id: new ObjectId(sectionId),
      tenantId: new ObjectId(tenantId),
    })) as WithId<SectionDocument> | null;

    if (!section) {
      throw new ApiError('SECTION_NOT_FOUND', 'Section not found', 404);
    }

    const validBatchIds = new Set((section.batches ?? []).map((b) => b._id.toString()));
    for (const a of assignments) {
      if (a.batchId && !validBatchIds.has(a.batchId)) {
        throw new ApiError('BATCH_NOT_FOUND', `Batch ${a.batchId} not found on this section`, 404);
      }
    }

    const ops = assignments.map((a) => ({
      updateOne: {
        filter: {
          _id: new ObjectId(a.studentId),
          tenantId: new ObjectId(tenantId),
          'currentEnrollment.sectionId': section._id,
        },
        update: a.batchId
          ? { $set: { 'currentEnrollment.labBatchId': new ObjectId(a.batchId) } }
          : { $unset: { 'currentEnrollment.labBatchId': '' } },
      },
    }));

    const result = await collections.students.bulkWrite(ops);

    logger.info(
      { sectionId, tenantId, assigned: result.modifiedCount },
      'Lab batch assignments updated'
    );

    return { updated: result.modifiedCount };
  }

  private formatSection(section: WithId<SectionDocument>) {
    return {
      _id: section._id.toString(),
      tenantId: section.tenantId.toString(),
      branchId: section.branchId.toString(),
      classId: section.classId.toString(),
      name: section.name,
      code: section.code,
      // capacity: section.capacity, // commented out
      sectionTeacherId: section.sectionTeacherId?.toString(),
      subjects: section.subjects?.map((s) => ({
        subjectId: s.subjectId.toString(),
        teacherId: s.teacherId?.toString(),
        periodsPerWeek: s.periodsPerWeek,
      })),
      batches: section.batches?.map((b) => ({ _id: b._id.toString(), name: b.name })),
      roomNumber: section.roomNumber,
      status: section.status,
      createdAt: section.createdAt,
      updatedAt: section.updatedAt,
    };
  }

  private formatSectionWithCount(section: WithId<SectionDocument> & { studentCount: number }) {
    return {
      ...this.formatSection(section),
      studentCount: section.studentCount || 0,
    };
  }

  private formatSectionWithTeacher(
    section: WithId<SectionDocument> & {
      studentCount: number;
      classTeacher: { _id: string; name: string } | null;
    }
  ) {
    const base = this.formatSection(section);
    return {
      ...base,
      studentCount: section.studentCount || 0,
      classTeacher: section.classTeacher,
    };
  }
}

export const sectionService = new SectionService();
