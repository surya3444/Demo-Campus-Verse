import { ObjectId, Filter, Document, UpdateFilter } from 'mongodb';
import { collections } from '../../../config/database';
import { ApiError } from '../../../middleware/errorHandler';
import { getPagination, buildPaginationMeta } from '../../../utils/pagination';
import { generateDriveNumber } from '../../../utils/generators';
import { withPeople } from '../../../utils/people';

const VALID_STATUS_TRANSITIONS: Record<string, string[]> = {
  draft: ['registration_open', 'cancelled'],
  registration_open: ['registration_closed', 'cancelled'],
  registration_closed: ['in_progress', 'cancelled'],
  in_progress: ['completed', 'cancelled'],
};

class DriveService {
  async list(
    tenantId: string,
    branchId: string,
    query: {
      search?: string;
      status?: string;
      companyId?: string;
      type?: string;
      page?: number;
      limit?: number;
      sortBy?: string;
      sortOrder?: string;
    }
  ) {
    const { page, limit, sortBy, sortOrder } = getPagination(query);
    const skip = (page - 1) * limit;

    const filter: Filter<Document> = {
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
    };

    if (query.search) {
      filter.$or = [
        { title: { $regex: query.search, $options: 'i' } },
        { companyName: { $regex: query.search, $options: 'i' } },
      ];
    }
    if (query.status) filter.status = query.status;
    if (query.companyId) filter.companyId = new ObjectId(query.companyId);
    if (query.type) filter.type = query.type;

    const [data, total] = await Promise.all([
      collections.placementDrives
        .find(filter)
        .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1, _id: sortOrder === 'asc' ? 1 : -1 })
        .skip(skip)
        .limit(limit)
        .toArray(),
      collections.placementDrives.countDocuments(filter),
    ]);

    return {
      data: await this.enrich(tenantId, data.map(this.formatDrive), false),
      meta: buildPaginationMeta(page, limit, total),
    };
  }

  async getById(tenantId: string, id: string) {
    const drive = await collections.placementDrives.findOne({
      _id: new ObjectId(id),
      tenantId: new ObjectId(tenantId),
    });

    if (!drive) {
      throw new ApiError('DRIVE_NOT_FOUND', 'Placement drive not found', 404);
    }

    return (await this.enrich(tenantId, [this.formatDrive(drive)], true))[0];
  }

  async create(tenantId: string, branchId: string, userId: string, data: Record<string, unknown>) {
    const now = new Date();

    // Lookup company name
    let companyName = '';
    if (data.companyId) {
      const company = await collections.placementCompanies.findOne({
        _id: new ObjectId(data.companyId as string),
        tenantId: new ObjectId(tenantId),
      });
      if (!company) {
        throw new ApiError('COMPANY_NOT_FOUND', 'Company not found', 404);
      }
      companyName = company.name as string;
    }

    const driveNumber = await generateDriveNumber(tenantId, branchId);

    const doc = {
      ...data,
      driveNumber,
      companyId: data.companyId ? new ObjectId(data.companyId as string) : undefined,
      companyName,
      status: 'draft',
      rounds: [],
      registrations: [],
      stats: {
        totalRegistered: 0,
        totalEligible: 0,
        totalPlaced: 0,
      },
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
      createdBy: new ObjectId(userId),
      createdAt: now,
      updatedAt: now,
    };

    const result = await collections.placementDrives.insertOne(doc);

    return this.getById(tenantId, result.insertedId.toString());
  }

  async update(tenantId: string, id: string, data: Record<string, unknown>) {
    const drive = await collections.placementDrives.findOne({
      _id: new ObjectId(id),
      tenantId: new ObjectId(tenantId),
    });

    if (!drive) {
      throw new ApiError('DRIVE_NOT_FOUND', 'Placement drive not found', 404);
    }

    if (!['draft', 'registration_open'].includes(drive.status as string)) {
      throw new ApiError(
        'DRIVE_NOT_EDITABLE',
        'Only draft or registration_open drives can be updated',
        400
      );
    }

    // If companyId is being changed, update companyName
    if (data.companyId) {
      const company = await collections.placementCompanies.findOne({
        _id: new ObjectId(data.companyId as string),
        tenantId: new ObjectId(tenantId),
      });
      if (!company) {
        throw new ApiError('COMPANY_NOT_FOUND', 'Company not found', 404);
      }
      data.companyId = new ObjectId(data.companyId as string);
      data.companyName = company.name;
    }

    await collections.placementDrives.updateOne(
      { _id: new ObjectId(id) },
      { $set: { ...data, updatedAt: new Date() } }
    );

    return this.getById(tenantId, id);
  }

  async delete(tenantId: string, id: string) {
    const drive = await collections.placementDrives.findOne({
      _id: new ObjectId(id),
      tenantId: new ObjectId(tenantId),
    });

    if (!drive) {
      throw new ApiError('DRIVE_NOT_FOUND', 'Placement drive not found', 404);
    }

    if (drive.status !== 'draft') {
      throw new ApiError('DRIVE_NOT_DELETABLE', 'Only draft drives can be deleted', 400);
    }

    await collections.placementDrives.deleteOne({ _id: new ObjectId(id) });
  }

  async updateStatus(tenantId: string, id: string, status: string) {
    const drive = await collections.placementDrives.findOne({
      _id: new ObjectId(id),
      tenantId: new ObjectId(tenantId),
    });

    if (!drive) {
      throw new ApiError('DRIVE_NOT_FOUND', 'Placement drive not found', 404);
    }

    const currentStatus = drive.status as string;

    // "cancelled" is allowed from any status
    if (status !== 'cancelled') {
      const allowed = VALID_STATUS_TRANSITIONS[currentStatus] || [];
      if (!allowed.includes(status)) {
        throw new ApiError(
          'INVALID_STATUS_TRANSITION',
          `Cannot transition from ${currentStatus} to ${status}`,
          400
        );
      }
    }

    await collections.placementDrives.updateOne(
      { _id: new ObjectId(id) },
      { $set: { status, updatedAt: new Date() } }
    );

    return this.getById(tenantId, id);
  }

  async addRound(tenantId: string, id: string, roundData: Record<string, unknown>) {
    const drive = await collections.placementDrives.findOne({
      _id: new ObjectId(id),
      tenantId: new ObjectId(tenantId),
    });

    if (!drive) {
      throw new ApiError('DRIVE_NOT_FOUND', 'Placement drive not found', 404);
    }

    const roundDoc = {
      ...roundData,
      _id: new ObjectId(),
      status: 'pending',
      createdAt: new Date(),
    };

    await collections.placementDrives.updateOne({ _id: new ObjectId(id) }, {
      $push: { rounds: roundDoc },
      $set: { updatedAt: new Date() },
    } as unknown as UpdateFilter<Document>);

    return this.getById(tenantId, id);
  }

  async updateRound(tenantId: string, id: string, roundId: string, data: Record<string, unknown>) {
    const drive = await collections.placementDrives.findOne({
      _id: new ObjectId(id),
      tenantId: new ObjectId(tenantId),
    });

    if (!drive) {
      throw new ApiError('DRIVE_NOT_FOUND', 'Placement drive not found', 404);
    }

    const updateFields: Record<string, unknown> = { updatedAt: new Date() };
    for (const [key, value] of Object.entries(data)) {
      updateFields[`rounds.$.${key}`] = value;
    }

    const result = await collections.placementDrives.updateOne(
      {
        _id: new ObjectId(id),
        'rounds._id': new ObjectId(roundId),
      },
      { $set: updateFields }
    );

    if (result.matchedCount === 0) {
      throw new ApiError('ROUND_NOT_FOUND', 'Round not found', 404);
    }

    return this.getById(tenantId, id);
  }

  async removeRound(tenantId: string, id: string, roundId: string) {
    const drive = await collections.placementDrives.findOne({
      _id: new ObjectId(id),
      tenantId: new ObjectId(tenantId),
    });

    if (!drive) {
      throw new ApiError('DRIVE_NOT_FOUND', 'Placement drive not found', 404);
    }

    // Check round status
    const round = (drive.rounds as Array<Record<string, unknown>>)?.find(
      (r) => (r._id as ObjectId).toString() === roundId
    );

    if (!round) {
      throw new ApiError('ROUND_NOT_FOUND', 'Round not found', 404);
    }

    if (round.status !== 'pending') {
      throw new ApiError('ROUND_NOT_REMOVABLE', 'Only pending rounds can be removed', 400);
    }

    await collections.placementDrives.updateOne({ _id: new ObjectId(id) }, {
      $pull: { rounds: { _id: new ObjectId(roundId) } },
      $set: { updatedAt: new Date() },
    } as unknown as UpdateFilter<Document>);

    return this.getById(tenantId, id);
  }

  async registerStudent(tenantId: string, id: string, studentId: string, studentName?: string) {
    if (!studentName) {
      const st = await collections.students.findOne(
        { _id: new ObjectId(studentId), tenantId: new ObjectId(tenantId) },
        { projection: { displayName: 1, firstName: 1, lastName: 1 } }
      );
      if (!st) throw new ApiError('STUDENT_NOT_FOUND', 'Student not found', 404);
      studentName =
        (st.displayName as string) || [st.firstName, st.lastName].filter(Boolean).join(' ');
    }
    const drive = await collections.placementDrives.findOne({
      _id: new ObjectId(id),
      tenantId: new ObjectId(tenantId),
    });

    if (!drive) {
      throw new ApiError('DRIVE_NOT_FOUND', 'Placement drive not found', 404);
    }

    if (drive.status !== 'registration_open') {
      throw new ApiError('REGISTRATION_NOT_OPEN', 'Registration is not open for this drive', 400);
    }

    // Check if student already registered
    const alreadyRegistered = (drive.registrations as Array<Record<string, unknown>>)?.some(
      (r) => (r.studentId as ObjectId).toString() === studentId
    );

    if (alreadyRegistered) {
      throw new ApiError('ALREADY_REGISTERED', 'Student is already registered for this drive', 400);
    }

    // Eligibility is enforced against the student's academic standing (kept
    // current by the exams module). A drive with no criteria, or a student
    // with no published results yet, registers unblocked.
    const eligibility = (drive.eligibility ?? {}) as {
      minCGPA?: number;
      maxBacklogs?: number;
    };
    if (eligibility.minCGPA !== undefined || eligibility.maxBacklogs !== undefined) {
      const student = await collections.students.findOne(
        { _id: new ObjectId(studentId), tenantId: new ObjectId(tenantId) },
        { projection: { academicSummary: 1 } }
      );
      const summary = student?.academicSummary as
        | { cgpa?: number | null; backlogs?: unknown[] }
        | undefined;

      if (summary) {
        if (
          eligibility.minCGPA !== undefined &&
          typeof summary.cgpa === 'number' &&
          summary.cgpa < eligibility.minCGPA
        ) {
          throw new ApiError(
            'NOT_ELIGIBLE',
            `This drive requires a CGPA of ${eligibility.minCGPA}; yours is ${summary.cgpa}`,
            403
          );
        }
        const backlogCount = summary.backlogs?.length ?? 0;
        if (eligibility.maxBacklogs !== undefined && backlogCount > eligibility.maxBacklogs) {
          throw new ApiError(
            'NOT_ELIGIBLE',
            `This drive allows at most ${eligibility.maxBacklogs} backlog(s); you have ${backlogCount}`,
            403
          );
        }
      }
    }

    const registration = {
      studentId: new ObjectId(studentId),
      studentName,
      isEligible: true,
      registeredAt: new Date(),
    };

    await collections.placementDrives.updateOne({ _id: new ObjectId(id) }, {
      $push: { registrations: registration },
      $inc: { 'stats.totalRegistered': 1 },
      $set: { updatedAt: new Date() },
    } as unknown as UpdateFilter<Document>);

    return this.getById(tenantId, id);
  }

  async unregisterStudent(tenantId: string, id: string, studentId: string) {
    const drive = await collections.placementDrives.findOne({
      _id: new ObjectId(id),
      tenantId: new ObjectId(tenantId),
    });

    if (!drive) {
      throw new ApiError('DRIVE_NOT_FOUND', 'Placement drive not found', 404);
    }

    const wasRegistered = (drive.registrations as Array<Record<string, unknown>>)?.some(
      (r) => (r.studentId as ObjectId).toString() === studentId
    );

    if (!wasRegistered) {
      throw new ApiError('NOT_REGISTERED', 'Student is not registered for this drive', 400);
    }

    await collections.placementDrives.updateOne({ _id: new ObjectId(id) }, {
      $pull: { registrations: { studentId: new ObjectId(studentId) } },
      $inc: { 'stats.totalRegistered': -1 },
      $set: { updatedAt: new Date() },
    } as unknown as UpdateFilter<Document>);

    return this.getById(tenantId, id);
  }

  async getRegistrations(tenantId: string, id: string) {
    const drive = await collections.placementDrives.findOne({
      _id: new ObjectId(id),
      tenantId: new ObjectId(tenantId),
    });

    if (!drive) {
      throw new ApiError('DRIVE_NOT_FOUND', 'Placement drive not found', 404);
    }

    // How far each student got: the last round whose results include them.
    const rounds = ((drive.rounds as Array<Record<string, unknown>>) || [])
      .filter((r) => r.status === 'completed')
      .sort((a, b) => (Number(a.roundNumber) || 0) - (Number(b.roundNumber) || 0));
    const rows = ((drive.registrations as Array<Record<string, unknown>>) || []).map((r) => {
      const sid = (r.studentId as ObjectId)?.toString();
      const cleared = rounds.filter((x) =>
        ((x.qualifiedStudentIds as ObjectId[]) || []).some((q) => String(q) === sid)
      );
      return {
        ...r,
        studentId: sid,
        roundsCleared: cleared.length,
        lastRound: (cleared.at(-1)?.name as string) ?? null,
        roundsTotal: ((drive.rounds as unknown[]) || []).length,
      };
    });
    return withPeople(rows, 'studentId');
  }

  async submitRoundResults(
    tenantId: string,
    id: string,
    roundId: string,
    qualifiedStudentIds: string[]
  ) {
    const drive = await collections.placementDrives.findOne({
      _id: new ObjectId(id),
      tenantId: new ObjectId(tenantId),
    });

    if (!drive) {
      throw new ApiError('DRIVE_NOT_FOUND', 'Placement drive not found', 404);
    }

    const round = (drive.rounds as Array<Record<string, unknown>>)?.find(
      (r) => (r._id as ObjectId).toString() === roundId
    );

    if (!round) {
      throw new ApiError('ROUND_NOT_FOUND', 'Round not found', 404);
    }

    const updateFields: Record<string, unknown> = {
      'rounds.$.status': 'completed',
      'rounds.$.qualifiedStudentIds': qualifiedStudentIds.map((sid) => new ObjectId(sid)),
      'rounds.$.completedAt': new Date(),
      updatedAt: new Date(),
    };

    await collections.placementDrives.updateOne(
      {
        _id: new ObjectId(id),
        'rounds._id': new ObjectId(roundId),
      },
      { $set: updateFields }
    );

    return this.getById(tenantId, id);
  }

  async getStats(tenantId: string, branchId: string) {
    const filter: Filter<Document> = {
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
    };

    const [totalDrives, activeDrives, placementStats] = await Promise.all([
      collections.placementDrives.countDocuments(filter),
      collections.placementDrives.countDocuments({
        ...filter,
        status: { $in: ['registration_open', 'registration_closed', 'in_progress'] },
      }),
      collections.placementOffers
        .aggregate([
          {
            $match: {
              tenantId: new ObjectId(tenantId),
              branchId: new ObjectId(branchId),
              status: 'accepted',
            },
          },
          {
            $group: {
              _id: null,
              totalPlacements: { $sum: 1 },
              averageCTC: { $avg: '$ctc' },
              highestCTC: { $max: '$ctc' },
            },
          },
        ])
        .toArray(),
    ]);

    const stats = placementStats[0] || { totalPlacements: 0, averageCTC: 0, highestCTC: 0 };

    return {
      totalDrives,
      activeDrives,
      totalPlacements: stats.totalPlacements,
      averageCTC: Math.round((stats.averageCTC || 0) * 100) / 100,
      highestCTC: stats.highestCTC || 0,
    };
  }

  /**
   * Company website (for logos), offer counts, and — for a single drive — each
   * registrant's photo, programme and CGPA plus their offer, so the drive page
   * shows real students rather than bare names.
   */
  private async enrich<
    T extends { _id: string; companyId?: string; registrations?: Array<{ studentId: string }> },
  >(tenantId: string, rows: T[], withPeopleData: boolean) {
    if (!rows.length) return rows;
    const tenantOid = new ObjectId(tenantId);
    const companyIds = [...new Set(rows.map((r) => r.companyId).filter(Boolean))].map(
      (id) => new ObjectId(id as string)
    );
    const [companies, offers] = await Promise.all([
      collections.placementCompanies
        .find({ _id: { $in: companyIds } })
        .project({ website: 1 })
        .toArray(),
      collections.placementOffers
        .find({ tenantId: tenantOid, driveId: { $in: rows.map((r) => new ObjectId(r._id)) } })
        .project({ driveId: 1, studentId: 1, status: 1, ctc: 1, role: 1 })
        .toArray(),
    ]);
    const site = new Map(companies.map((c) => [String(c._id), c.website as string | undefined]));
    return Promise.all(
      rows.map(async (r) => {
        const mine = offers.filter((o) => String(o.driveId) === r._id);
        const base = {
          ...r,
          companyWebsite: r.companyId ? (site.get(String(r.companyId)) ?? null) : null,
          offerCounts: {
            offered: mine.length,
            accepted: mine.filter((o) => o.status === 'accepted').length,
          },
        };
        if (!withPeopleData || !r.registrations?.length) return base;
        const offerOf = new Map(mine.map((o) => [String(o.studentId), o]));
        const regs = await withPeople(
          r.registrations.map((x) => ({ ...x, studentId: String(x.studentId) })),
          'studentId'
        );
        return {
          ...base,
          registrations: regs.map((x) => {
            const o = offerOf.get(x.studentId);
            return {
              ...x,
              offer: o
                ? { status: o.status as string, ctc: Number(o.ctc) || 0, role: o.role as string }
                : null,
            };
          }),
        };
      })
    );
  }

  private formatDrive(doc: Document) {
    return {
      ...doc,
      _id: doc._id.toString(),
      tenantId: doc.tenantId?.toString(),
      branchId: doc.branchId?.toString(),
      companyId: doc.companyId?.toString(),
      createdBy: doc.createdBy?.toString(),
      rounds: (doc.rounds || []).map((r: Record<string, unknown>) => ({
        ...r,
        _id: (r._id as ObjectId)?.toString(),
        qualifiedStudentIds: ((r.qualifiedStudentIds as ObjectId[]) || []).map((sid) =>
          sid?.toString()
        ),
      })),
      registrations: (doc.registrations || []).map((r: Record<string, unknown>) => ({
        ...r,
        studentId: (r.studentId as ObjectId)?.toString(),
      })),
    };
  }
}

export const driveService = new DriveService();
