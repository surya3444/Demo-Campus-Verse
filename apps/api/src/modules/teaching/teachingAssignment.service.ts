import { ObjectId, WithId, Document, Filter } from 'mongodb';
import { collections } from '../../config/database';
import { logger } from '../../lib/logger';
import { ApiError } from '../../middleware/errorHandler';
import {
  CreateTeachingAssignmentInput,
  UpdateTeachingAssignmentInput,
} from '@campus-verse/shared/schemas';
import { isSubjectUsableByDepartment } from '@campus-verse/shared/utils';

interface TeachingAssignmentDocument extends Document {
  _id: ObjectId;
  tenantId: ObjectId;
  /** Branch of the SECTION being taught (may differ from the teacher's home branch). */
  branchId: ObjectId;
  academicBatchId: ObjectId;
  termId?: ObjectId;
  staffId: ObjectId;
  subjectId: ObjectId;
  sectionId: ObjectId;
  batchIds?: ObjectId[];
  role: 'primary' | 'assistant' | 'lab';
  status: 'active' | 'ended';
  createdBy?: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface TeachingAssignmentListParams {
  staffId?: string;
  sectionId?: string;
  subjectId?: string;
  status?: 'active' | 'ended';
}

class TeachingAssignmentService {
  async create(tenantId: string, data: CreateTeachingAssignmentInput, createdBy?: string) {
    const tenantOid = new ObjectId(tenantId);

    const section = await collections.sections.findOne(
      { _id: new ObjectId(data.sectionId), tenantId: tenantOid },
      { projection: { branchId: 1, classId: 1 } }
    );
    if (!section) {
      throw new ApiError('SECTION_NOT_FOUND', 'Section not found', 404);
    }

    const classDoc = await collections.classes.findOne(
      { _id: section.classId as ObjectId, tenantId: tenantOid },
      { projection: { academicBatchId: 1, departmentId: 1 } }
    );
    if (!classDoc) {
      throw new ApiError('CLASS_NOT_FOUND', "Section's class not found", 404);
    }

    const staff = await collections.staff.findOne(
      { _id: new ObjectId(data.staffId), tenantId: tenantOid, status: 'active' },
      { projection: { _id: 1 } }
    );
    if (!staff) {
      throw new ApiError('STAFF_NOT_FOUND', 'Staff member not found or inactive', 404);
    }

    const subject = await collections.subjects.findOne({
      _id: new ObjectId(data.subjectId),
      tenantId: tenantOid,
    });
    if (!subject) {
      throw new ApiError('SUBJECT_NOT_FOUND', 'Subject not found', 404);
    }

    // Cross-department teaching is allowed exactly where the subject's sharing
    // rules permit: EEE faculty teaching BEE to Mechanical sections works
    // because BEE is 'shared' with Mechanical — not because nothing checks.
    const classDepartmentId = classDoc.departmentId ? String(classDoc.departmentId) : null;
    const sharingView = subject as {
      sharing?: 'global' | 'core' | 'shared';
      ownerDepartmentId?: ObjectId;
      offeredToDepartmentIds?: ObjectId[];
    };
    if (!isSubjectUsableByDepartment(sharingView, classDepartmentId)) {
      throw new ApiError(
        'SUBJECT_NOT_OFFERED',
        "This subject is not offered to this section's department — check the subject's sharing settings",
        400
      );
    }

    const duplicate = await collections.teachingAssignments.findOne({
      tenantId: tenantOid,
      staffId: new ObjectId(data.staffId),
      sectionId: new ObjectId(data.sectionId),
      subjectId: new ObjectId(data.subjectId),
      ...(data.termId ? { termId: new ObjectId(data.termId) } : { termId: { $exists: false } }),
      status: 'active',
    });
    if (duplicate) {
      throw new ApiError(
        'DUPLICATE_ASSIGNMENT',
        'An active assignment for this teacher, section and subject already exists',
        409
      );
    }

    const now = new Date();
    const doc: TeachingAssignmentDocument = {
      _id: new ObjectId(),
      tenantId: tenantOid,
      branchId: section.branchId as ObjectId,
      academicBatchId: classDoc.academicBatchId as ObjectId,
      ...(data.termId && { termId: new ObjectId(data.termId) }),
      staffId: new ObjectId(data.staffId),
      subjectId: new ObjectId(data.subjectId),
      sectionId: new ObjectId(data.sectionId),
      ...(data.batchIds?.length && { batchIds: data.batchIds.map((id) => new ObjectId(id)) }),
      role: data.role ?? 'primary',
      status: 'active',
      createdAt: now,
      updatedAt: now,
      ...(createdBy && { createdBy: new ObjectId(createdBy) }),
    };

    await collections.teachingAssignments.insertOne(doc);

    logger.info(
      { tenantId, assignmentId: doc._id.toString(), staffId: data.staffId },
      'Teaching assignment created'
    );

    return this.formatAssignment(doc as WithId<TeachingAssignmentDocument>);
  }

  async findAll(tenantId: string, branchId: string, params: TeachingAssignmentListParams = {}) {
    const filter: Filter<Document> = {
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
    };
    if (params.staffId) filter.staffId = new ObjectId(params.staffId);
    if (params.sectionId) filter.sectionId = new ObjectId(params.sectionId);
    if (params.subjectId) filter.subjectId = new ObjectId(params.subjectId);
    filter.status = params.status ?? 'active';

    const assignments = (await collections.teachingAssignments
      .find(filter)
      .sort({ createdAt: -1 })
      .toArray()) as WithId<TeachingAssignmentDocument>[];

    if (assignments.length === 0) return [];

    // Batch-enrich display names.
    const staffIds = [...new Set(assignments.map((a) => a.staffId.toString()))];
    const subjectIds = [...new Set(assignments.map((a) => a.subjectId.toString()))];
    const sectionIds = [...new Set(assignments.map((a) => a.sectionId.toString()))];

    const [staff, subjects, sections] = await Promise.all([
      collections.staff
        .find({ _id: { $in: staffIds.map((id) => new ObjectId(id)) } })
        .project({ displayName: 1 })
        .toArray(),
      collections.subjects
        .find({ _id: { $in: subjectIds.map((id) => new ObjectId(id)) } })
        .project({ name: 1, code: 1 })
        .toArray(),
      collections.sections
        .find({ _id: { $in: sectionIds.map((id) => new ObjectId(id)) } })
        .project({ name: 1, classId: 1 })
        .toArray(),
    ]);

    const classIds = [...new Set(sections.map((s) => (s.classId as ObjectId).toString()))];
    const classes = classIds.length
      ? await collections.classes
          .find({ _id: { $in: classIds.map((id) => new ObjectId(id)) } })
          .project({ displayName: 1 })
          .toArray()
      : [];

    const staffMap = new Map(staff.map((s) => [s._id.toString(), s]));
    const subjectMap = new Map(subjects.map((s) => [s._id.toString(), s]));
    const sectionMap = new Map(sections.map((s) => [s._id.toString(), s]));
    const classMap = new Map(classes.map((c) => [c._id.toString(), c]));

    return assignments.map((a) => {
      const sec = sectionMap.get(a.sectionId.toString());
      const cls = sec ? classMap.get((sec.classId as ObjectId).toString()) : undefined;
      return {
        ...this.formatAssignment(a),
        staffName: (staffMap.get(a.staffId.toString())?.displayName as string) ?? '',
        subjectName: (subjectMap.get(a.subjectId.toString())?.name as string) ?? '',
        subjectCode: (subjectMap.get(a.subjectId.toString())?.code as string) ?? '',
        sectionName: (sec?.name as string) ?? '',
        className: (cls?.displayName as string) ?? '',
      };
    });
  }

  async update(tenantId: string, assignmentId: string, data: UpdateTeachingAssignmentInput) {
    const existing = (await collections.teachingAssignments.findOne({
      _id: new ObjectId(assignmentId),
      tenantId: new ObjectId(tenantId),
    })) as WithId<TeachingAssignmentDocument> | null;

    if (!existing) {
      throw new ApiError('ASSIGNMENT_NOT_FOUND', 'Teaching assignment not found', 404);
    }

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (data.role !== undefined) updateData.role = data.role;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.termId !== undefined) {
      updateData.termId = data.termId ? new ObjectId(data.termId) : null;
    }
    if (data.batchIds !== undefined) {
      updateData.batchIds = data.batchIds ? data.batchIds.map((id) => new ObjectId(id)) : null;
    }

    await collections.teachingAssignments.updateOne({ _id: existing._id }, { $set: updateData });

    logger.info({ tenantId, assignmentId }, 'Teaching assignment updated');

    const updated = (await collections.teachingAssignments.findOne({
      _id: existing._id,
    })) as WithId<TeachingAssignmentDocument>;
    return this.formatAssignment(updated);
  }

  async delete(tenantId: string, assignmentId: string) {
    const result = await collections.teachingAssignments.deleteOne({
      _id: new ObjectId(assignmentId),
      tenantId: new ObjectId(tenantId),
    });
    if (result.deletedCount === 0) {
      throw new ApiError('ASSIGNMENT_NOT_FOUND', 'Teaching assignment not found', 404);
    }

    logger.info({ tenantId, assignmentId }, 'Teaching assignment deleted');

    return { success: true };
  }

  /**
   * Deprecation bridge for staff.teaching.subjects (Phase 5): whenever HR
   * saves the class-granular summary, expand it into section-granular active
   * teaching_assignments so the canonical collection stays complete without a
   * separate migration run. Additive only — assignments are never auto-ended
   * here (ending is an explicit action in the assignments UI), and failures
   * are swallowed per-row so a staff save can never break on sync.
   */
  async syncFromStaffTeaching(
    tenantId: string,
    staffId: string,
    subjects: Array<{ subjectId: string; classIds: string[] }>
  ): Promise<void> {
    const tenantOid = new ObjectId(tenantId);
    const staffOid = new ObjectId(staffId);
    const now = new Date();

    for (const subject of subjects) {
      for (const classId of subject.classIds ?? []) {
        try {
          const classDoc = await collections.classes.findOne(
            { _id: new ObjectId(classId), tenantId: tenantOid },
            { projection: { academicBatchId: 1 } }
          );
          if (!classDoc) continue;

          const sections = await collections.sections
            .find(
              { classId: new ObjectId(classId), tenantId: tenantOid, status: 'active' },
              { projection: { _id: 1, branchId: 1 } }
            )
            .toArray();

          for (const section of sections) {
            const existing = await collections.teachingAssignments.findOne({
              tenantId: tenantOid,
              staffId: staffOid,
              sectionId: section._id,
              subjectId: new ObjectId(subject.subjectId),
              status: 'active',
            });
            if (existing) continue;

            await collections.teachingAssignments.insertOne({
              _id: new ObjectId(),
              tenantId: tenantOid,
              branchId: section.branchId as ObjectId,
              academicBatchId: classDoc.academicBatchId as ObjectId,
              staffId: staffOid,
              subjectId: new ObjectId(subject.subjectId),
              sectionId: section._id,
              role: 'primary',
              status: 'active',
              origin: 'staff_teaching_sync',
              createdAt: now,
              updatedAt: now,
            });
          }
        } catch (err) {
          logger.warn(
            { err, tenantId, staffId, subjectId: subject.subjectId, classId },
            'Teaching-assignment sync skipped a row'
          );
        }
      }
    }
  }

  private formatAssignment(a: WithId<TeachingAssignmentDocument>) {
    return {
      _id: a._id.toString(),
      tenantId: a.tenantId.toString(),
      branchId: a.branchId.toString(),
      academicBatchId: a.academicBatchId.toString(),
      termId: a.termId?.toString(),
      staffId: a.staffId.toString(),
      subjectId: a.subjectId.toString(),
      sectionId: a.sectionId.toString(),
      batchIds: a.batchIds?.map((id) => id.toString()),
      role: a.role,
      status: a.status,
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
    };
  }
}

export const teachingAssignmentService = new TeachingAssignmentService();
