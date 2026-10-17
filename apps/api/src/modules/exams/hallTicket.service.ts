import { ObjectId, WithId, Document } from 'mongodb';
import type { Filter } from 'mongodb';
import { collections } from '../../config/database';
import { logger } from '../../lib/logger';
import { ApiError } from '../../middleware/errorHandler';
import { examSettingsService } from './settings.service';
import type { ExamDocument } from './exam.service';
import { renderHallTicketPdf, uploadHallTicketPdf } from './hallTicket.pdf';

interface HallTicketPaperRow {
  paperId: ObjectId;
  subjectId: ObjectId;
  subjectName: string;
  date: Date;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  totalMarks: number;
  room?: string;
}

export interface HallTicketDocument extends Document {
  _id: ObjectId;
  tenantId: ObjectId;
  branchId: ObjectId;
  examId: ObjectId;
  examName: string;
  termName: string;
  studentId: ObjectId;
  studentName: string;
  admissionNumber?: string;
  rollNumber?: string;
  sectionId: ObjectId;
  sectionName: string;
  classId: ObjectId;
  className: string;
  /** Seat number assigned by `roll_number` or `manual` mode. */
  seatNumber?: string;
  venue?: string;
  papers: HallTicketPaperRow[];
  pdfKey?: string;
  pdfUrl?: string;
  generatedBy: ObjectId;
  generatedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

function formatTicket(doc: WithId<HallTicketDocument>) {
  return {
    _id: doc._id.toString(),
    examId: doc.examId.toString(),
    examName: doc.examName,
    termName: doc.termName,
    studentId: doc.studentId.toString(),
    studentName: doc.studentName,
    admissionNumber: doc.admissionNumber,
    rollNumber: doc.rollNumber,
    sectionId: doc.sectionId.toString(),
    sectionName: doc.sectionName,
    classId: doc.classId.toString(),
    className: doc.className,
    seatNumber: doc.seatNumber,
    venue: doc.venue,
    papers: doc.papers.map((p) => ({
      paperId: p.paperId.toString(),
      subjectId: p.subjectId.toString(),
      subjectName: p.subjectName,
      date: p.date,
      startTime: p.startTime,
      endTime: p.endTime,
      durationMinutes: p.durationMinutes,
      totalMarks: p.totalMarks,
      room: p.room,
    })),
    pdfKey: doc.pdfKey,
    pdfUrl: doc.pdfUrl,
    generatedBy: doc.generatedBy.toString(),
    generatedAt: doc.generatedAt,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

class HallTicketService {
  /**
   * Generate hall tickets for every student in the given section(s).
   * Allocation:
   *   - `roll_number` mode: students sorted by rollNumber within section, seat = rollNumber.
   *   - `manual` mode: no auto-seat; admin can edit `seatNumber` afterwards.
   * Re-running regenerates the PDF in place (idempotent).
   */
  async generate(
    tenantId: string,
    branchId: string,
    input: { examId: string; sectionId?: string; studentIds?: string[] },
    generatedBy: string
  ) {
    const tenantObjId = new ObjectId(tenantId);
    const branchObjId = new ObjectId(branchId);
    const examObjId = new ObjectId(input.examId);

    const exam = (await collections.exams.findOne({
      _id: examObjId,
      tenantId: tenantObjId,
      branchId: branchObjId,
    })) as WithId<ExamDocument> | null;
    if (!exam) throw new ApiError('NOT_FOUND', 'Exam not found', 404);

    // Resolve schedules so each ticket carries the per-paper date/time/room.
    const scheduleFilter: Filter<Document> = {
      tenantId: tenantObjId,
      examId: examObjId,
    };
    if (input.sectionId) scheduleFilter.sectionId = new ObjectId(input.sectionId);
    const schedules = await collections.examSchedules.find(scheduleFilter).toArray();
    if (schedules.length === 0) {
      throw new ApiError(
        'NO_SCHEDULES',
        'Schedule papers before generating hall tickets — no schedules exist for this exam.',
        400
      );
    }

    // Group schedules by section so each ticket lists only that section's papers.
    const schedulesBySection = new Map<string, typeof schedules>();
    for (const s of schedules) {
      const sid = (s.sectionId as ObjectId).toString();
      if (!schedulesBySection.has(sid)) schedulesBySection.set(sid, []);
      schedulesBySection.get(sid)!.push(s);
    }

    // Roster: students in each scheduled section.
    const allSectionIds = Array.from(schedulesBySection.keys()).map((id) => new ObjectId(id));
    const studentFilter: Filter<Document> = {
      tenantId: tenantObjId,
      branchId: branchObjId,
      'currentEnrollment.sectionId': { $in: allSectionIds },
      status: { $ne: 'inactive' },
    };
    if (input.studentIds && input.studentIds.length > 0) {
      studentFilter._id = { $in: input.studentIds.map((id) => new ObjectId(id)) };
    }
    const students = await collections.students
      .find(studentFilter)
      .project({
        _id: 1,
        firstName: 1,
        lastName: 1,
        displayName: 1,
        admissionNumber: 1,
        rollNumber: 1,
        currentEnrollment: 1,
      })
      .toArray();

    // Resolve section + class names for ticket header.
    const sections = await collections.sections
      .find({ _id: { $in: allSectionIds } })
      .project({ _id: 1, name: 1, classId: 1 })
      .toArray();
    const sectionMap = new Map(sections.map((s) => [(s._id as ObjectId).toString(), s]));
    const classIds = [...new Set(sections.map((s) => (s.classId as ObjectId).toString()))];
    const classes = await collections.classes
      .find({ _id: { $in: classIds.map((id) => new ObjectId(id)) } })
      .project({ _id: 1, name: 1, displayName: 1 })
      .toArray();
    const classMap = new Map(
      classes.map((c) => [
        (c._id as ObjectId).toString(),
        ((c.displayName as string) || (c.name as string) || '') as string,
      ])
    );

    const settings = await examSettingsService.getSettings(tenantId, branchId);
    const tenant = await collections.tenants.findOne({ _id: tenantObjId });
    const schoolName = (tenant?.name as string) || 'School';
    const schoolLogoUrl = (tenant?.logoUrl as string) || undefined;

    // Pre-compute seat order per section (roll_number mode).
    const seatBySection = new Map<string, Map<string, string>>();
    if (settings.hallTicket.seatingMode === 'roll_number') {
      for (const sectionId of schedulesBySection.keys()) {
        const sectionStudents = students.filter(
          (s) =>
            (s.currentEnrollment as { sectionId?: ObjectId } | undefined)?.sectionId?.toString() ===
            sectionId
        );
        sectionStudents.sort((a, b) => {
          const ar = (a.rollNumber as string) || '';
          const br = (b.rollNumber as string) || '';
          // Numeric-aware sort so "10" comes after "2".
          const an = parseInt(ar);
          const bn = parseInt(br);
          if (!isNaN(an) && !isNaN(bn)) return an - bn;
          return ar.localeCompare(br);
        });
        const map = new Map<string, string>();
        sectionStudents.forEach((s, idx) => {
          map.set((s._id as ObjectId).toString(), (s.rollNumber as string) || `${idx + 1}`);
        });
        seatBySection.set(sectionId, map);
      }
    }

    const now = new Date();
    const generated: WithId<HallTicketDocument>[] = [];

    for (const student of students) {
      const enrollment = student.currentEnrollment as
        | { sectionId?: ObjectId; classId?: ObjectId }
        | undefined;
      if (!enrollment?.sectionId || !enrollment.classId) continue;
      const sectionIdStr = enrollment.sectionId.toString();
      const section = sectionMap.get(sectionIdStr);
      if (!section) continue;
      const sectionSchedules = schedulesBySection.get(sectionIdStr) || [];

      const studentName =
        (student.displayName as string) ||
        `${(student.firstName as string) ?? ''} ${(student.lastName as string) ?? ''}`.trim();

      const papers: HallTicketPaperRow[] = sectionSchedules
        .slice()
        .sort((a, b) => new Date(a.date as Date).getTime() - new Date(b.date as Date).getTime())
        .map((s) => ({
          paperId: s.paperId as ObjectId,
          subjectId: s.subjectId as ObjectId,
          subjectName: s.subjectName as string,
          date: s.date as Date,
          startTime: s.startTime as string,
          endTime: s.endTime as string,
          durationMinutes: s.durationMinutes as number,
          totalMarks: s.totalMarks as number,
          room: (s.room as string) || undefined,
        }));

      const existing = (await collections.hallTickets.findOne({
        tenantId: tenantObjId,
        examId: examObjId,
        studentId: student._id as ObjectId,
      })) as WithId<HallTicketDocument> | null;

      const seatNumber =
        settings.hallTicket.seatingMode === 'roll_number'
          ? seatBySection.get(sectionIdStr)?.get((student._id as ObjectId).toString())
          : existing?.seatNumber; // manual mode: preserve admin-set seat

      const doc: HallTicketDocument = {
        _id: existing?._id || new ObjectId(),
        tenantId: tenantObjId,
        branchId: branchObjId,
        examId: examObjId,
        examName: exam.name,
        termName: exam.termName,
        studentId: student._id as ObjectId,
        studentName,
        admissionNumber: (student.admissionNumber as string) || undefined,
        rollNumber: (student.rollNumber as string) || undefined,
        sectionId: enrollment.sectionId,
        sectionName: (section.name as string) || '',
        classId: enrollment.classId,
        className: classMap.get(enrollment.classId.toString()) || '',
        seatNumber,
        venue: settings.hallTicket.venueDefault,
        papers,
        pdfKey: existing?.pdfKey,
        pdfUrl: existing?.pdfUrl,
        generatedBy: new ObjectId(generatedBy),
        generatedAt: now,
        createdAt: existing?.createdAt || now,
        updatedAt: now,
      };

      try {
        const buf = await renderHallTicketPdf({
          schoolName,
          schoolLogoUrl,
          showQrCode: settings.hallTicket.showQrCode,
          ticket: doc,
        });
        const uploaded = await uploadHallTicketPdf({
          tenantId,
          branchId,
          examId: input.examId,
          studentId: (student._id as ObjectId).toString(),
          buffer: buf,
        });
        doc.pdfKey = uploaded.key;
        doc.pdfUrl = uploaded.url;
      } catch (err) {
        logger.error(
          { err, studentId: (student._id as ObjectId).toString() },
          'Failed to render/upload hall ticket PDF'
        );
      }

      await collections.hallTickets.updateOne({ _id: doc._id }, { $set: doc }, { upsert: true });
      generated.push(doc as WithId<HallTicketDocument>);
    }

    logger.info(
      {
        examId: input.examId,
        sectionId: input.sectionId,
        tickets: generated.length,
        mode: settings.hallTicket.seatingMode,
      },
      'Hall tickets generated'
    );

    return { generated: generated.length, tickets: generated.map(formatTicket) };
  }

  async list(
    tenantId: string,
    branchId: string,
    query: { examId?: string; sectionId?: string; studentId?: string }
  ) {
    const filter: Filter<Document> = {
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
    };
    if (query.examId) filter.examId = new ObjectId(query.examId);
    if (query.sectionId) filter.sectionId = new ObjectId(query.sectionId);
    if (query.studentId) filter.studentId = new ObjectId(query.studentId);

    const docs = (await collections.hallTickets
      .find(filter)
      .sort({ sectionName: 1, rollNumber: 1, studentName: 1 })
      .toArray()) as WithId<HallTicketDocument>[];
    return docs.map(formatTicket);
  }

  async getById(tenantId: string, branchId: string, id: string) {
    const doc = (await collections.hallTickets.findOne({
      _id: new ObjectId(id),
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
    })) as WithId<HallTicketDocument> | null;
    if (!doc) throw new ApiError('NOT_FOUND', 'Hall ticket not found', 404);
    return formatTicket(doc);
  }

  async listForStudent(tenantId: string, studentId: string) {
    const docs = (await collections.hallTickets
      .find({ tenantId: new ObjectId(tenantId), studentId: new ObjectId(studentId) })
      .sort({ generatedAt: -1 })
      .toArray()) as WithId<HallTicketDocument>[];
    return docs.map(formatTicket);
  }

  /** Manual seat override for `manual` mode (or fixups in `roll_number` mode). */
  async updateSeat(tenantId: string, branchId: string, id: string, seatNumber: string) {
    const result = await collections.hallTickets.findOneAndUpdate(
      {
        _id: new ObjectId(id),
        tenantId: new ObjectId(tenantId),
        branchId: new ObjectId(branchId),
      },
      { $set: { seatNumber, updatedAt: new Date() } },
      { returnDocument: 'after' }
    );
    if (!result) throw new ApiError('NOT_FOUND', 'Hall ticket not found', 404);
    return formatTicket(result as WithId<HallTicketDocument>);
  }
}

export const hallTicketService = new HallTicketService();
