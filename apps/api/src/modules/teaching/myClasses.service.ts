import { ObjectId, Filter, Document, WithId } from 'mongodb';
import { collections } from '../../config/database';
import { logger } from '../../lib/logger';
import { getPagination, buildPaginationMeta } from '../../utils/pagination';
import { getElectiveRosterFilter } from '../registration/roster';

interface ClassEntry {
  sectionId: string;
  sectionName: string;
  classId: string;
  className: string;
  subjectIds: string[];
  subjectNames: string[];
  subjects: Array<{ subjectId: string; subjectName: string }>;
  studentCount: number;
  isClassTeacher: boolean;
  averageAttendance: number | null;
  source: 'class_teacher' | 'teaching_assignment' | 'timetable';
}

class MyClassesService {
  async getMyClasses(tenantId: string, branchId: string, staffId: string): Promise<ClassEntry[]> {
    const tenantObjId = new ObjectId(tenantId);
    const branchObjId = new ObjectId(branchId);
    const staffObjId = new ObjectId(staffId);

    // 1. Find sections where this staff is the section teacher (class teacher)
    const classTeacherSections = await collections.sections
      .find({
        tenantId: tenantObjId,
        branchId: branchObjId,
        sectionTeacherId: staffObjId,
        status: 'active',
      })
      .toArray();

    // 2. Look up the staff record for teaching.subjects to find classIds where this teacher teaches
    const staffRecord = await collections.staff.findOne({
      _id: staffObjId,
      tenantId: tenantObjId,
    });

    const teachingSubjects =
      (
        staffRecord?.teaching as {
          subjects?: Array<{ subjectId: ObjectId; classIds: ObjectId[] }>;
        }
      )?.subjects || [];

    // Collect all classIds from teaching subjects
    const teachingClassIds: ObjectId[] = [];
    for (const subj of teachingSubjects) {
      for (const cid of subj.classIds) {
        if (!teachingClassIds.some((existing) => existing.equals(cid))) {
          teachingClassIds.push(cid);
        }
      }
    }

    // 3. Find sections for the classes this teacher teaches
    let teachingSections: WithId<Document>[] = [];
    if (teachingClassIds.length > 0) {
      teachingSections = await collections.sections
        .find({
          tenantId: tenantObjId,
          branchId: branchObjId,
          classId: { $in: teachingClassIds },
          status: 'active',
        })
        .toArray();
    }

    // Merge sections, deduplicating by sectionId
    const sectionMap = new Map<
      string,
      {
        section: WithId<Document>;
        isClassTeacher: boolean;
        subjectIds: ObjectId[];
        source: 'class_teacher' | 'teaching_assignment' | 'timetable';
      }
    >();

    for (const section of classTeacherSections) {
      const sid = section._id.toString();
      sectionMap.set(sid, {
        section,
        isClassTeacher: true,
        subjectIds: [],
        source: 'class_teacher',
      });
    }

    for (const section of teachingSections) {
      const sid = section._id.toString();
      const classId = section.classId as ObjectId;

      // Find which subjects this teacher teaches for this class
      const subjectIdsForClass: ObjectId[] = [];
      for (const subj of teachingSubjects) {
        if (subj.classIds.some((cid: ObjectId) => cid.equals(classId))) {
          subjectIdsForClass.push(subj.subjectId);
        }
      }

      if (sectionMap.has(sid)) {
        // Already exists as class teacher, add subject info
        const entry = sectionMap.get(sid)!;
        for (const subjId of subjectIdsForClass) {
          if (!entry.subjectIds.some((existing) => existing.equals(subjId))) {
            entry.subjectIds.push(subjId);
          }
        }
      } else {
        sectionMap.set(sid, {
          section,
          isClassTeacher: false,
          subjectIds: subjectIdsForClass,
          source: 'teaching_assignment',
        });
      }
    }

    // 2a. Canonical source: teaching_assignments (section-granular).
    const activeAssignments = await collections.teachingAssignments
      .find({
        tenantId: tenantObjId,
        branchId: branchObjId,
        staffId: staffObjId,
        status: 'active',
      })
      .project({ sectionId: 1, subjectId: 1 })
      .toArray();

    if (activeAssignments.length > 0) {
      const assignmentSectionSubjects = new Map<string, Set<string>>();
      for (const a of activeAssignments) {
        const secId = (a.sectionId as ObjectId).toString();
        if (!assignmentSectionSubjects.has(secId)) {
          assignmentSectionSubjects.set(secId, new Set());
        }
        if (a.subjectId) {
          assignmentSectionSubjects.get(secId)!.add((a.subjectId as ObjectId).toString());
        }
      }

      const newAssignmentSectionIds = Array.from(assignmentSectionSubjects.keys()).filter(
        (sid) => !sectionMap.has(sid)
      );
      if (newAssignmentSectionIds.length > 0) {
        const taSections = await collections.sections
          .find({
            _id: { $in: newAssignmentSectionIds.map((id) => new ObjectId(id)) },
            tenantId: tenantObjId,
            status: 'active',
          })
          .toArray();
        for (const section of taSections) {
          const sid = (section._id as ObjectId).toString();
          const subIds = assignmentSectionSubjects.get(sid);
          sectionMap.set(sid, {
            section,
            isClassTeacher: false,
            subjectIds: subIds ? Array.from(subIds).map((id) => new ObjectId(id)) : [],
            source: 'teaching_assignment',
          });
        }
      }

      // Merge assignment subjects into sections discovered by other sources.
      for (const [secId, subIds] of assignmentSectionSubjects) {
        const entry = sectionMap.get(secId);
        if (entry) {
          for (const subId of subIds) {
            const subObjId = new ObjectId(subId);
            if (!entry.subjectIds.some((existing) => existing.equals(subObjId))) {
              entry.subjectIds.push(subObjId);
            }
          }
        }
      }
    }

    // 2b. Timetable-based class discovery
    const timetableEntries = await collections.timetableEntries
      .find({
        tenantId: tenantObjId,
        branchId: branchObjId,
        teacherId: staffObjId,
      })
      .project({ sectionId: 1, subjectId: 1 })
      .toArray();

    // Collect unique sectionId→subjectId mappings from timetable
    const timetableSectionSubjects = new Map<string, Set<string>>();
    for (const entry of timetableEntries) {
      if (entry.sectionId && entry.subjectId) {
        const secId = (entry.sectionId as ObjectId).toString();
        const subId = (entry.subjectId as ObjectId).toString();
        if (!timetableSectionSubjects.has(secId)) {
          timetableSectionSubjects.set(secId, new Set());
        }
        timetableSectionSubjects.get(secId)!.add(subId);
      }
    }

    // Find sections not already in sectionMap
    const newTimetableSectionIds = Array.from(timetableSectionSubjects.keys()).filter(
      (sid) => !sectionMap.has(sid)
    );

    if (newTimetableSectionIds.length > 0) {
      const ttSections = await collections.sections
        .find({
          _id: { $in: newTimetableSectionIds.map((id) => new ObjectId(id)) },
          tenantId: tenantObjId,
          status: 'active',
        })
        .toArray();

      for (const section of ttSections) {
        const sid = (section._id as ObjectId).toString();
        const subIds = timetableSectionSubjects.get(sid);
        sectionMap.set(sid, {
          section,
          isClassTeacher: false,
          subjectIds: subIds ? Array.from(subIds).map((id) => new ObjectId(id)) : [],
          source: 'timetable',
        });
      }
    }

    // Also merge timetable subjects into existing sections
    for (const [secId, subIds] of timetableSectionSubjects) {
      const entry = sectionMap.get(secId);
      if (entry && entry.source !== 'timetable') {
        for (const subId of subIds) {
          const subObjId = new ObjectId(subId);
          if (!entry.subjectIds.some((existing) => existing.equals(subObjId))) {
            entry.subjectIds.push(subObjId);
          }
        }
      }
    }

    if (sectionMap.size === 0) {
      return [];
    }

    // 4. Gather all classIds and subjectIds for lookup
    const allClassIds = new Set<string>();
    const allSubjectIds = new Set<string>();
    const allSectionIds: ObjectId[] = [];

    for (const entry of sectionMap.values()) {
      allClassIds.add((entry.section.classId as ObjectId).toString());
      allSectionIds.push(entry.section._id as ObjectId);
      for (const subjId of entry.subjectIds) {
        allSubjectIds.add(subjId.toString());
      }
    }

    // 5. Look up class names
    const classes = await collections.classes
      .find({
        _id: { $in: Array.from(allClassIds).map((id) => new ObjectId(id)) },
        tenantId: tenantObjId,
      })
      .project({ _id: 1, displayName: 1 })
      .toArray();

    const classNameMap = new Map<string, string>();
    for (const cls of classes) {
      classNameMap.set((cls._id as ObjectId).toString(), cls.displayName as string);
    }

    // 6. Look up subject names
    const subjects =
      allSubjectIds.size > 0
        ? await collections.subjects
            .find({
              _id: { $in: Array.from(allSubjectIds).map((id) => new ObjectId(id)) },
              tenantId: tenantObjId,
            })
            .project({ _id: 1, name: 1 })
            .toArray()
        : [];

    const subjectNameMap = new Map<string, string>();
    for (const subj of subjects) {
      subjectNameMap.set((subj._id as ObjectId).toString(), subj.name as string);
    }

    // 7. Get student counts for all sections
    const studentCountPipeline = [
      {
        $match: {
          tenantId: tenantObjId,
          'currentEnrollment.sectionId': { $in: allSectionIds },
          status: 'active',
        },
      },
      {
        $group: {
          _id: '$currentEnrollment.sectionId',
          count: { $sum: 1 },
        },
      },
    ];

    const studentCounts = await collections.students.aggregate(studentCountPipeline).toArray();
    const studentCountMap = new Map<string, number>();
    for (const sc of studentCounts) {
      studentCountMap.set((sc._id as ObjectId).toString(), sc.count as number);
    }

    // 7b. Get average attendance for last 30 days per section
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const attendanceStats =
      allSectionIds.length > 0
        ? await collections.studentAttendance
            .aggregate([
              {
                $match: {
                  tenantId: tenantObjId,
                  branchId: branchObjId,
                  sectionId: { $in: allSectionIds },
                  date: { $gte: thirtyDaysAgo },
                },
              },
              {
                $group: {
                  _id: '$sectionId',
                  totalRecords: { $sum: { $ifNull: ['$summary.total', 0] } },
                  totalPresent: {
                    $sum: {
                      $add: [
                        { $ifNull: ['$summary.present', 0] },
                        { $ifNull: ['$summary.late', 0] },
                      ],
                    },
                  },
                },
              },
            ])
            .toArray()
        : [];

    const attendanceMap = new Map<string, number | null>();
    for (const att of attendanceStats) {
      const total = att.totalRecords as number;
      const present = att.totalPresent as number;
      attendanceMap.set(
        (att._id as ObjectId).toString(),
        total > 0 ? Math.round((present / total) * 100) : null
      );
    }

    // 8. Build result
    const result: ClassEntry[] = [];
    for (const entry of sectionMap.values()) {
      const sectionId = (entry.section._id as ObjectId).toString();
      const classId = (entry.section.classId as ObjectId).toString();

      const subjectIdStrs = entry.subjectIds.map((id) => id.toString());
      const subjectNameStrs = subjectIdStrs.map((id) => subjectNameMap.get(id) || '');
      result.push({
        sectionId,
        sectionName: entry.section.name as string,
        classId,
        className: classNameMap.get(classId) || '',
        subjectIds: subjectIdStrs,
        subjectNames: subjectNameStrs,
        subjects: subjectIdStrs.map((id, i) => ({
          subjectId: id,
          subjectName: subjectNameStrs[i],
        })),
        studentCount: studentCountMap.get(sectionId) || 0,
        isClassTeacher: entry.isClassTeacher,
        averageAttendance: attendanceMap.get(sectionId) ?? null,
        source: entry.source,
      });
    }

    logger.info({ staffId, tenantId, classCount: result.length }, 'My classes retrieved');

    return result;
  }

  /**
   * Returns all active sections in a branch — used by admins who don't have a staff record.
   */
  async getAllBranchClasses(
    tenantId: string,
    branchId: string,
    restrictToSectionIds?: ObjectId[] | null
  ): Promise<ClassEntry[]> {
    const tenantObjId = new ObjectId(tenantId);
    const branchObjId = new ObjectId(branchId);

    // Every active section of the campus, narrowed to the caller's scope
    // (an institution admin sees their institution's sections only).
    const sections = await collections.sections
      .find({
        tenantId: tenantObjId,
        branchId: branchObjId,
        status: 'active',
        ...(restrictToSectionIds && { _id: { $in: restrictToSectionIds } }),
      })
      .toArray();

    if (sections.length === 0) return [];

    // Gather classIds and sectionIds
    const classIdSet = new Set<string>();
    const sectionIds: ObjectId[] = [];

    for (const section of sections) {
      classIdSet.add((section.classId as ObjectId).toString());
      sectionIds.push(section._id as ObjectId);
    }

    // Look up class names
    const classes = await collections.classes
      .find({
        _id: { $in: Array.from(classIdSet).map((id) => new ObjectId(id)) },
        tenantId: tenantObjId,
      })
      .project({ _id: 1, displayName: 1 })
      .toArray();

    const classNameMap = new Map<string, string>();
    for (const cls of classes) {
      classNameMap.set((cls._id as ObjectId).toString(), cls.displayName as string);
    }

    // Get student counts
    const studentCounts = await collections.students
      .aggregate([
        {
          $match: {
            tenantId: tenantObjId,
            'currentEnrollment.sectionId': { $in: sectionIds },
            status: 'active',
          },
        },
        { $group: { _id: '$currentEnrollment.sectionId', count: { $sum: 1 } } },
      ])
      .toArray();

    const studentCountMap = new Map<string, number>();
    for (const sc of studentCounts) {
      studentCountMap.set((sc._id as ObjectId).toString(), sc.count as number);
    }

    return sections.map((section) => {
      const sectionId = (section._id as ObjectId).toString();
      const classId = (section.classId as ObjectId).toString();

      return {
        sectionId,
        sectionName: section.name as string,
        classId,
        className: classNameMap.get(classId) || '',
        subjectIds: [],
        subjectNames: [],
        subjects: [],
        studentCount: studentCountMap.get(sectionId) || 0,
        isClassTeacher: false,
        averageAttendance: null,
        source: 'class_teacher' as const,
      };
    });
  }

  async getSectionStudents(
    tenantId: string,
    branchId: string,
    sectionId: string,
    params: {
      search?: string;
      page?: number;
      limit?: number;
      sortBy?: string;
      sortOrder?: string;
      /** When viewing in a subject context, electives narrow to registered students. */
      subjectId?: string;
    }
  ) {
    const { page, limit, sortBy, sortOrder } = getPagination(params as Record<string, unknown>);
    const search = params.search;

    const filter: Filter<Document> = {
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
      'currentEnrollment.sectionId': new ObjectId(sectionId),
      status: 'active',
    };

    // Course-registration integration: for an elective subject the roster is
    // the registered students, not the whole section. Cores return null here
    // and keep the full-section behaviour.
    if (params.subjectId) {
      const roster = await getElectiveRosterFilter(tenantId, branchId, params.subjectId);
      if (roster !== null) {
        filter._id = { $in: roster };
      }
    }

    if (search) {
      filter.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { admissionNumber: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (page - 1) * limit;
    const sortDirection = sortOrder === 'asc' ? 1 : -1;

    const [students, total] = await Promise.all([
      collections.students
        .find(filter)
        .project({
          _id: 1,
          firstName: 1,
          lastName: 1,
          displayName: 1,
          admissionNumber: 1,
          gender: 1,
          dateOfBirth: 1,
          contact: 1,
          profileImage: 1,
          currentEnrollment: 1,
        })
        .sort({ [sortBy]: sortDirection, _id: sortDirection })
        .skip(skip)
        .limit(limit)
        .toArray(),
      collections.students.countDocuments(filter),
    ]);

    const meta = buildPaginationMeta(page, limit, total);

    return {
      data: students.map((s) => ({
        _id: (s._id as ObjectId).toString(),
        firstName: s.firstName,
        lastName: s.lastName,
        displayName: s.displayName || `${s.firstName} ${s.lastName}`,
        admissionNumber: s.admissionNumber,
        gender: s.gender,
        dateOfBirth: s.dateOfBirth,
        contact: s.contact,
        profileImage: s.profileImage,
        currentEnrollment: s.currentEnrollment
          ? {
              academicBatchId: (
                s.currentEnrollment as { academicBatchId?: ObjectId }
              ).academicBatchId?.toString(),
              classId: (s.currentEnrollment as { classId?: ObjectId }).classId?.toString(),
              sectionId: (s.currentEnrollment as { sectionId?: ObjectId }).sectionId?.toString(),
            }
          : undefined,
      })),
      meta,
    };
  }

  async getSectionLessonPlans(
    tenantId: string,
    branchId: string,
    sectionId: string,
    staffId: string,
    params: { page?: number; limit?: number; sortBy?: string; sortOrder?: string }
  ) {
    const { page, limit, sortBy, sortOrder } = getPagination(params as Record<string, unknown>);
    const skip = (page - 1) * limit;
    const sortDirection = sortOrder === 'asc' ? 1 : -1;

    const filter: Filter<Document> = {
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
      sectionId: new ObjectId(sectionId),
      teacherId: new ObjectId(staffId),
    };

    const [plans, total] = await Promise.all([
      collections.lessonPlans
        .find(filter)
        .sort({ [sortBy]: sortDirection, _id: sortDirection })
        .skip(skip)
        .limit(limit)
        .toArray(),
      collections.lessonPlans.countDocuments(filter),
    ]);

    const meta = buildPaginationMeta(page, limit, total);

    return {
      data: plans.map((plan) => ({
        _id: (plan._id as ObjectId).toString(),
        title: plan.title as string,
        date: plan.date as Date,
        subjectName: (plan.subjectName as string) || '',
        subjectId: (plan.subjectId as ObjectId)?.toString() || '',
        status: plan.status as string,
        teachingStatus: (plan.teachingStatus as string) || 'not_started',
        linkedAssignmentId: (plan.linkedAssignmentId as ObjectId)?.toString() || undefined,
        createdAt: plan.createdAt as Date,
      })),
      meta,
    };
  }
}

export const myClassesService = new MyClassesService();
