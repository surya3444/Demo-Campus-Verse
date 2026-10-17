import { ObjectId, Document, WithId } from 'mongodb';
import { collections } from '../../config/database';
import { logger } from '../../lib/logger';
import { ApiError } from '../../middleware/errorHandler';

interface GradeDocument extends Document {
  _id: ObjectId;
  tenantId: ObjectId;
  branchId: ObjectId;
  assignmentId: ObjectId;
  studentId: ObjectId;
  studentName: string;
  admissionNumber?: string;
  marksObtained: number;
  totalMarks: number;
  percentage: number;
  grade?: string;
  remarks?: string;
  gradedBy: ObjectId;
  gradedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

class GradeService {
  async gradeStudent(
    tenantId: string,
    branchId: string,
    data: {
      assignmentId: string;
      studentId: string;
      marksObtained: number;
      grade?: string;
      remarks?: string;
    },
    gradedBy: string
  ) {
    const tenantObjId = new ObjectId(tenantId);
    const assignmentObjId = new ObjectId(data.assignmentId);
    const studentObjId = new ObjectId(data.studentId);

    // Validate assignment exists
    const assignment = await collections.assignments.findOne({
      _id: assignmentObjId,
      tenantId: tenantObjId,
    });

    if (!assignment) {
      throw new ApiError('ASSIGNMENT_NOT_FOUND', 'Assignment not found', 404);
    }

    const totalMarks = assignment.totalMarks as number;

    // Validate marks
    if (data.marksObtained > totalMarks) {
      throw new ApiError(
        'INVALID_MARKS',
        `Marks obtained (${data.marksObtained}) cannot exceed total marks (${totalMarks})`,
        400
      );
    }

    if (data.marksObtained < 0) {
      throw new ApiError('INVALID_MARKS', 'Marks obtained cannot be negative', 400);
    }

    // Look up student name
    const student = await collections.students.findOne({
      _id: studentObjId,
      tenantId: tenantObjId,
    });

    const studentName = student
      ? (student.displayName as string) || `${student.firstName} ${student.lastName}`
      : '';
    const admissionNumber = (student?.admissionNumber as string) || undefined;

    const now = new Date();
    const percentage =
      totalMarks > 0 ? Math.round((data.marksObtained / totalMarks) * 10000) / 100 : 0;

    // Upsert on {tenantId, assignmentId, studentId}
    const result = await collections.grades.updateOne(
      {
        tenantId: tenantObjId,
        assignmentId: assignmentObjId,
        studentId: studentObjId,
      },
      {
        $set: {
          tenantId: tenantObjId,
          branchId: new ObjectId(branchId),
          assignmentId: assignmentObjId,
          studentId: studentObjId,
          studentName,
          admissionNumber,
          marksObtained: data.marksObtained,
          totalMarks,
          percentage,
          grade: data.grade,
          remarks: data.remarks,
          gradedBy: new ObjectId(gradedBy),
          gradedAt: now,
          updatedAt: now,
        },
        $setOnInsert: {
          createdAt: now,
        },
      },
      { upsert: true }
    );

    logger.info(
      {
        assignmentId: data.assignmentId,
        studentId: data.studentId,
        tenantId,
        upserted: !!result.upsertedId,
      },
      'Student graded'
    );

    // Fetch and return the grade
    const grade = (await collections.grades.findOne({
      tenantId: tenantObjId,
      assignmentId: assignmentObjId,
      studentId: studentObjId,
    })) as WithId<GradeDocument>;

    return this.formatGrade(grade);
  }

  async bulkGrade(
    tenantId: string,
    branchId: string,
    data: {
      assignmentId: string;
      grades: Array<{
        studentId: string;
        marksObtained: number;
        grade?: string;
        remarks?: string;
      }>;
    },
    gradedBy: string
  ) {
    const tenantObjId = new ObjectId(tenantId);
    const branchObjId = new ObjectId(branchId);
    const assignmentObjId = new ObjectId(data.assignmentId);
    const gradedByObjId = new ObjectId(gradedBy);

    // Validate assignment exists
    const assignment = await collections.assignments.findOne({
      _id: assignmentObjId,
      tenantId: tenantObjId,
    });

    if (!assignment) {
      throw new ApiError('ASSIGNMENT_NOT_FOUND', 'Assignment not found', 404);
    }

    const totalMarks = assignment.totalMarks as number;

    // Validate all marks
    const errors: Array<{ index: number; studentId: string; message: string }> = [];
    for (let i = 0; i < data.grades.length; i++) {
      const g = data.grades[i];
      if (g.marksObtained > totalMarks) {
        errors.push({
          index: i,
          studentId: g.studentId,
          message: `Marks obtained (${g.marksObtained}) cannot exceed total marks (${totalMarks})`,
        });
      }
      if (g.marksObtained < 0) {
        errors.push({
          index: i,
          studentId: g.studentId,
          message: 'Marks obtained cannot be negative',
        });
      }
    }

    if (errors.length > 0) {
      throw new ApiError('INVALID_MARKS', 'Some grades have invalid marks', 400, errors);
    }

    // Look up all student names
    const studentIds = data.grades.map((g) => new ObjectId(g.studentId));
    const students = await collections.students
      .find({
        _id: { $in: studentIds },
        tenantId: tenantObjId,
      })
      .project({ _id: 1, firstName: 1, lastName: 1, displayName: 1, admissionNumber: 1 })
      .toArray();

    const studentMap = new Map(
      students.map((s) => [
        (s._id as ObjectId).toString(),
        {
          name: (s.displayName as string) || `${s.firstName} ${s.lastName}`,
          admissionNumber: s.admissionNumber as string | undefined,
        },
      ])
    );

    const now = new Date();

    // Build bulkWrite operations
    const operations = data.grades.map((g) => {
      const studentObjId = new ObjectId(g.studentId);
      const studentInfo = studentMap.get(g.studentId) || { name: '', admissionNumber: undefined };
      const percentage =
        totalMarks > 0 ? Math.round((g.marksObtained / totalMarks) * 10000) / 100 : 0;

      return {
        updateOne: {
          filter: {
            tenantId: tenantObjId,
            assignmentId: assignmentObjId,
            studentId: studentObjId,
          },
          update: {
            $set: {
              tenantId: tenantObjId,
              branchId: branchObjId,
              assignmentId: assignmentObjId,
              studentId: studentObjId,
              studentName: studentInfo.name,
              admissionNumber: studentInfo.admissionNumber,
              marksObtained: g.marksObtained,
              totalMarks,
              percentage,
              grade: g.grade,
              remarks: g.remarks,
              gradedBy: gradedByObjId,
              gradedAt: now,
              updatedAt: now,
            },
            $setOnInsert: {
              createdAt: now,
            },
          },
          upsert: true,
        },
      };
    });

    const result = await collections.grades.bulkWrite(operations);

    logger.info(
      {
        assignmentId: data.assignmentId,
        tenantId,
        matched: result.matchedCount,
        upserted: result.upsertedCount,
        modified: result.modifiedCount,
      },
      'Bulk grading completed'
    );

    return {
      summary: {
        total: data.grades.length,
        matched: result.matchedCount,
        upserted: result.upsertedCount,
        modified: result.modifiedCount,
      },
    };
  }

  async getGradesForAssignment(tenantId: string, assignmentId: string) {
    const tenantObjId = new ObjectId(tenantId);
    const assignmentObjId = new ObjectId(assignmentId);

    // Validate assignment exists
    const assignment = await collections.assignments.findOne({
      _id: assignmentObjId,
      tenantId: tenantObjId,
    });

    if (!assignment) {
      throw new ApiError('ASSIGNMENT_NOT_FOUND', 'Assignment not found', 404);
    }

    const grades = (await collections.grades
      .find({
        tenantId: tenantObjId,
        assignmentId: assignmentObjId,
      })
      .sort({ studentName: 1 })
      .toArray()) as WithId<GradeDocument>[];

    // Look up student names from the students collection for freshest data
    const studentIds = grades.map((g) => g.studentId);
    const students =
      studentIds.length > 0
        ? await collections.students
            .find({ _id: { $in: studentIds }, tenantId: tenantObjId })
            .project({ _id: 1, firstName: 1, lastName: 1, displayName: 1, admissionNumber: 1 })
            .toArray()
        : [];

    const studentMap = new Map(
      students.map((s) => [
        (s._id as ObjectId).toString(),
        {
          name: (s.displayName as string) || `${s.firstName} ${s.lastName}`,
          admissionNumber: s.admissionNumber as string | undefined,
        },
      ])
    );

    return grades.map((grade) => {
      const studentInfo = studentMap.get(grade.studentId.toString());
      const formatted = this.formatGrade(grade);
      if (studentInfo) {
        formatted.studentName = studentInfo.name;
        formatted.admissionNumber = studentInfo.admissionNumber;
      }
      return formatted;
    });
  }

  async getStudentGrades(tenantId: string, studentId: string) {
    const tenantObjId = new ObjectId(tenantId);
    const studentObjId = new ObjectId(studentId);

    const grades = (await collections.grades
      .find({
        tenantId: tenantObjId,
        studentId: studentObjId,
      })
      .sort({ gradedAt: -1 })
      .toArray()) as WithId<GradeDocument>[];

    if (grades.length === 0) {
      return [];
    }

    // Look up assignment AND questionnaire details
    const gradeIds = [...new Set(grades.map((g) => g.assignmentId.toString()))];
    const idObjects = gradeIds.map((id) => new ObjectId(id));

    const [assignments, questionnaires] = await Promise.all([
      collections.assignments
        .find({ _id: { $in: idObjects }, tenantId: tenantObjId })
        .project({
          _id: 1,
          title: 1,
          type: 1,
          subjectId: 1,
          subjectName: 1,
          sectionId: 1,
          sectionName: 1,
          totalMarks: 1,
          assignedDate: 1,
          dueDate: 1,
          status: 1,
        })
        .toArray(),
      collections.questionnaires
        .find({ _id: { $in: idObjects }, tenantId: tenantObjId })
        .project({
          _id: 1,
          title: 1,
          subjectId: 1,
          subjectName: 1,
          sectionId: 1,
          sectionName: 1,
          totalMarks: 1,
          dueDate: 1,
          status: 1,
        })
        .toArray(),
    ]);

    const itemMap = new Map<string, Record<string, unknown>>();
    for (const a of assignments)
      itemMap.set((a._id as ObjectId).toString(), { ...a, kind: 'assignment' });
    for (const q of questionnaires)
      itemMap.set((q._id as ObjectId).toString(), { ...q, kind: 'questionnaire' });

    return grades.map((grade) => {
      const formatted = this.formatGrade(grade);
      const doc = itemMap.get(grade.assignmentId.toString());

      return {
        ...formatted,
        assignment: doc
          ? {
              _id: (doc._id as ObjectId).toString(),
              title: doc.title as string,
              type: (doc.type as string) || 'quiz',
              kind: doc.kind as string,
              subjectId: (doc.subjectId as ObjectId)?.toString(),
              subjectName: doc.subjectName as string,
              sectionId: (doc.sectionId as ObjectId)?.toString(),
              sectionName: doc.sectionName as string,
              totalMarks: doc.totalMarks as number,
              assignedDate: doc.assignedDate,
              dueDate: doc.dueDate,
              status: doc.status as string,
            }
          : null,
      };
    });
  }

  async getSectionReport(tenantId: string, branchId: string, sectionId: string) {
    const tenantObjId = new ObjectId(tenantId);
    const branchObjId = new ObjectId(branchId);
    const sectionObjId = new ObjectId(sectionId);

    // Find all assignments for the section
    const assignments = await collections.assignments
      .find({
        tenantId: tenantObjId,
        branchId: branchObjId,
        sectionId: sectionObjId,
      })
      .project({
        _id: 1,
        title: 1,
        type: 1,
        subjectId: 1,
        subjectName: 1,
        totalMarks: 1,
        status: 1,
        assignedDate: 1,
      })
      .sort({ assignedDate: -1 })
      .toArray();

    if (assignments.length === 0) {
      return [];
    }

    const assignmentIds = assignments.map((a) => a._id as ObjectId);

    // Aggregate grades for all assignments in this section
    const gradeStats = await collections.grades
      .aggregate([
        {
          $match: {
            tenantId: tenantObjId,
            assignmentId: { $in: assignmentIds },
          },
        },
        {
          $group: {
            _id: '$assignmentId',
            averageMarks: { $avg: '$marksObtained' },
            averagePercentage: { $avg: '$percentage' },
            highestMarks: { $max: '$marksObtained' },
            lowestMarks: { $min: '$marksObtained' },
            gradedCount: { $sum: 1 },
          },
        },
      ])
      .toArray();

    const statsMap = new Map(gradeStats.map((s) => [(s._id as ObjectId).toString(), s]));

    return assignments.map((a) => {
      const aid = (a._id as ObjectId).toString();
      const stats = statsMap.get(aid);

      return {
        assignmentId: aid,
        title: a.title,
        type: a.type,
        subjectId: (a.subjectId as ObjectId)?.toString(),
        subjectName: a.subjectName,
        totalMarks: a.totalMarks,
        status: a.status,
        assignedDate: a.assignedDate,
        averageMarks: stats ? Math.round((stats.averageMarks as number) * 100) / 100 : null,
        averagePercentage: stats
          ? Math.round((stats.averagePercentage as number) * 100) / 100
          : null,
        highestMarks: (stats?.highestMarks as number) ?? null,
        lowestMarks: (stats?.lowestMarks as number) ?? null,
        gradedCount: (stats?.gradedCount as number) || 0,
      };
    });
  }

  async getSectionStudentGrades(tenantId: string, branchId: string, sectionId: string) {
    const tenantObjId = new ObjectId(tenantId);
    const sectionObjId = new ObjectId(sectionId);

    // Get all assignments AND questionnaires for this section
    const [assignments, questionnaires] = await Promise.all([
      collections.assignments
        .find({ tenantId: tenantObjId, branchId: new ObjectId(branchId), sectionId: sectionObjId })
        .project({ _id: 1 })
        .toArray(),
      collections.questionnaires
        .find({ tenantId: tenantObjId, branchId: new ObjectId(branchId), sectionId: sectionObjId })
        .project({ _id: 1 })
        .toArray(),
    ]);

    const assignmentIds = [
      ...assignments.map((a) => a._id as ObjectId),
      ...questionnaires.map((q) => q._id as ObjectId),
    ];
    if (assignmentIds.length === 0) return [];

    // Get all grades for these assignments
    const grades = await collections.grades
      .find({
        tenantId: tenantObjId,
        assignmentId: { $in: assignmentIds },
      })
      .toArray();

    // Look up student names
    const studentIds = [...new Set(grades.map((g) => (g.studentId as ObjectId).toString()))];
    const students =
      studentIds.length > 0
        ? await collections.students
            .find({ _id: { $in: studentIds.map((id) => new ObjectId(id)) } })
            .project({ _id: 1, firstName: 1, lastName: 1, admissionNumber: 1 })
            .toArray()
        : [];

    const studentMap = new Map(
      students.map((s) => [
        (s._id as ObjectId).toString(),
        {
          name: `${s.firstName || ''} ${s.lastName || ''}`.trim(),
          admissionNumber: (s.admissionNumber as string) || '',
        },
      ])
    );

    return grades.map((g) => {
      const student = studentMap.get((g.studentId as ObjectId).toString());
      return {
        _id: (g._id as ObjectId).toString(),
        studentId: (g.studentId as ObjectId).toString(),
        studentName: student?.name || '',
        admissionNumber: student?.admissionNumber || '',
        assignmentId: (g.assignmentId as ObjectId).toString(),
        marksObtained: g.marksObtained as number,
        totalMarks: g.totalMarks as number,
        percentage: g.percentage as number,
        gradedAt: g.gradedAt as Date,
      };
    });
  }

  private formatGrade(grade: WithId<GradeDocument>) {
    return {
      _id: grade._id.toString(),
      tenantId: grade.tenantId.toString(),
      branchId: grade.branchId.toString(),
      assignmentId: grade.assignmentId.toString(),
      studentId: grade.studentId.toString(),
      studentName: grade.studentName,
      admissionNumber: grade.admissionNumber,
      marksObtained: grade.marksObtained,
      totalMarks: grade.totalMarks,
      percentage: grade.percentage,
      grade: grade.grade,
      remarks: grade.remarks,
      gradedBy: grade.gradedBy.toString(),
      gradedAt: grade.gradedAt,
      createdAt: grade.createdAt,
      updatedAt: grade.updatedAt,
    };
  }
}

export const gradeService = new GradeService();
