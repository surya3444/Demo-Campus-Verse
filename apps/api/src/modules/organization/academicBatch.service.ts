import { ObjectId, WithId, Document, Filter, UpdateFilter } from 'mongodb';
import { collections } from '../../config/database';
import { logger } from '../../lib/logger';
import { ApiError } from '../../middleware/errorHandler';
import { AcademicTermInput, CreateAcademicBatchInput } from '@campus-verse/shared';

interface TermSubdocument {
  _id: ObjectId;
  name: string;
  /** 'odd' → Year-N students are in semester 2N-1; 'even' → 2N. */
  half?: 'odd' | 'even';
  /** Trimester calendars: position 1-3 in the session. */
  part?: 1 | 2 | 3;
  /** Calendar this term belongs to (semester / trimester / annual); absent = all. */
  pattern?: 'semester' | 'trimester' | 'annual';
  /** Explicit override for single-cohort programs (1-12). */
  semesterNumber?: number;
  startDate: Date;
  endDate: Date;
  registrationWindow?: {
    opensAt: Date;
    closesAt: Date;
  };
  addDropDeadline?: Date;
}

interface AcademicBatchDocument extends Document {
  _id: ObjectId;
  tenantId: ObjectId;
  branchId?: ObjectId;
  name: string;
  code: string;
  startDate: Date;
  endDate: Date;
  isCurrent: boolean;
  terms?: TermSubdocument[];
  status: 'upcoming' | 'active' | 'completed';
  createdBy?: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

/** Build a term subdocument, preserving an existing _id when supplied. */
function buildTerm(t: AcademicTermInput): TermSubdocument {
  return {
    _id: t._id ? new ObjectId(t._id) : new ObjectId(),
    name: t.name,
    ...(t.half && { half: t.half }),
    ...(t.part !== undefined && { part: t.part as 1 | 2 | 3 }),
    ...(t.pattern && { pattern: t.pattern }),
    ...(t.semesterNumber !== undefined && { semesterNumber: t.semesterNumber }),
    startDate: new Date(t.startDate),
    endDate: new Date(t.endDate),
    ...(t.registrationWindow && {
      registrationWindow: {
        opensAt: new Date(t.registrationWindow.opensAt),
        closesAt: new Date(t.registrationWindow.closesAt),
      },
    }),
    ...(t.addDropDeadline && { addDropDeadline: new Date(t.addDropDeadline) }),
  };
}

/** Reject duplicate semester numbers within one batch's terms. */
function assertUniqueSemesterNumbers(terms: TermSubdocument[]) {
  const nums = terms.map((t) => t.semesterNumber).filter((n): n is number => n !== undefined);
  if (new Set(nums).size !== nums.length) {
    throw new ApiError(
      'DUPLICATE_SEMESTER_NUMBER',
      'Each term in a batch must have a distinct semester number',
      400
    );
  }
}

export interface AcademicBatchListParams {
  page?: number;
  limit?: number;
  branchId?: string;
  status?: 'upcoming' | 'active' | 'completed';
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

class AcademicBatchService {
  async create(
    tenantId: string,
    branchId: string | undefined,
    data: CreateAcademicBatchInput,
    createdBy?: string
  ) {
    // Check if batch code already exists
    const filter: Filter<Document> = {
      tenantId: new ObjectId(tenantId),
      code: data.code.toUpperCase(),
    };
    if (branchId) {
      filter.branchId = new ObjectId(branchId);
    }

    const existingBatch = await collections.academicBatches.findOne(filter);

    if (existingBatch) {
      throw new ApiError(
        'DUPLICATE_BATCH_CODE',
        'An academic batch with this code already exists',
        409
      );
    }

    // Validate dates
    const startDate = new Date(data.startDate);
    const endDate = new Date(data.endDate);

    if (endDate <= startDate) {
      throw new ApiError('INVALID_DATE_RANGE', 'End date must be after start date', 400);
    }

    // Determine status based on dates
    const now = new Date();
    let status: 'upcoming' | 'active' | 'completed' = 'upcoming';
    if (now >= startDate && now <= endDate) {
      status = 'active';
    } else if (now > endDate) {
      status = 'completed';
    }

    const batchId = new ObjectId();
    const nowDate = new Date();

    const terms = data.terms?.map(buildTerm);
    if (terms) assertUniqueSemesterNumbers(terms);

    const batch: Omit<AcademicBatchDocument, '_id'> & { _id: ObjectId } = {
      _id: batchId,
      tenantId: new ObjectId(tenantId),
      ...(branchId && { branchId: new ObjectId(branchId) }),
      name: data.name,
      code: data.code.toUpperCase(),
      startDate,
      endDate,
      isCurrent: false,
      terms,
      status,
      createdAt: nowDate,
      updatedAt: nowDate,
      ...(createdBy && { createdBy: new ObjectId(createdBy) }),
    };

    await collections.academicBatches.insertOne(batch);

    logger.info({ batchId: batchId.toString(), tenantId }, 'Academic batch created');

    return this.formatBatch(batch as WithId<AcademicBatchDocument>);
  }

  async findById(tenantId: string, batchId: string) {
    const batch = (await collections.academicBatches.findOne({
      _id: new ObjectId(batchId),
      tenantId: new ObjectId(tenantId),
    })) as WithId<AcademicBatchDocument> | null;

    if (!batch) {
      throw new ApiError('BATCH_NOT_FOUND', 'Academic batch not found', 404);
    }

    return this.formatBatch(batch);
  }

  async findAll(tenantId: string, params: AcademicBatchListParams = {}) {
    const {
      page = 1,
      limit = 20,
      branchId,
      status,
      sortBy = 'startDate',
      sortOrder = 'desc',
    } = params;

    const matchStage: Filter<Document> = {
      tenantId: new ObjectId(tenantId),
    };

    if (branchId) {
      matchStage.$or = [{ branchId: new ObjectId(branchId) }, { branchId: { $exists: false } }];
    }

    if (status) {
      matchStage.status = status;
    }

    const skip = (page - 1) * limit;
    const sortDirection = sortOrder === 'asc' ? 1 : -1;

    // Use aggregation to get class and student counts
    const pipeline = [
      { $match: matchStage },
      {
        $lookup: {
          from: 'classes',
          let: { batchId: '$_id', tenantId: '$tenantId' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$academicBatchId', '$$batchId'] },
                    { $eq: ['$tenantId', '$$tenantId'] },
                  ],
                },
              },
            },
          ],
          as: 'classes',
        },
      },
      {
        $lookup: {
          from: 'students',
          let: { batchId: '$_id', tenantId: '$tenantId' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$currentEnrollment.academicBatchId', '$$batchId'] },
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
        $addFields: {
          classCount: { $size: '$classes' },
          studentCount: {
            $ifNull: [{ $arrayElemAt: ['$studentData.count', 0] }, 0],
          },
        },
      },
      {
        $project: {
          classes: 0,
          studentData: 0,
        },
      },
      { $sort: { [sortBy]: sortDirection, _id: sortDirection } },
      { $skip: skip },
      { $limit: limit },
    ];

    const [batches, totalResult] = await Promise.all([
      collections.academicBatches.aggregate(pipeline).toArray(),
      collections.academicBatches.countDocuments(matchStage),
    ]);

    return {
      data: batches.map((batch) => this.formatBatchWithCounts(batch)),
      meta: {
        page,
        limit,
        total: totalResult,
        totalPages: Math.ceil(totalResult / limit),
        hasMore: skip + batches.length < totalResult,
      },
    };
  }

  async update(tenantId: string, batchId: string, data: Partial<CreateAcademicBatchInput>) {
    const existingBatch = (await collections.academicBatches.findOne({
      _id: new ObjectId(batchId),
      tenantId: new ObjectId(tenantId),
    })) as WithId<AcademicBatchDocument> | null;

    if (!existingBatch) {
      throw new ApiError('BATCH_NOT_FOUND', 'Academic batch not found', 404);
    }

    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (data.name !== undefined) updateData.name = data.name;
    if (data.code !== undefined) updateData.code = data.code.toUpperCase();
    if (data.startDate !== undefined) updateData.startDate = new Date(data.startDate);
    if (data.endDate !== undefined) updateData.endDate = new Date(data.endDate);
    if (data.terms !== undefined) {
      const terms = data.terms.map(buildTerm);
      assertUniqueSemesterNumbers(terms);
      updateData.terms = terms;
    }

    // Recalculate status if dates changed
    if (data.startDate || data.endDate) {
      const startDate = data.startDate ? new Date(data.startDate) : existingBatch.startDate;
      const endDate = data.endDate ? new Date(data.endDate) : existingBatch.endDate;
      const now = new Date();

      if (now >= startDate && now <= endDate) {
        updateData.status = 'active';
      } else if (now > endDate) {
        updateData.status = 'completed';
      } else {
        updateData.status = 'upcoming';
      }
    }

    await collections.academicBatches.updateOne(
      { _id: new ObjectId(batchId) },
      { $set: updateData }
    );

    logger.info({ batchId, tenantId }, 'Academic batch updated');

    return this.findById(tenantId, batchId);
  }

  async setAsCurrent(tenantId: string, batchId: string, branchId?: string) {
    const batch = (await collections.academicBatches.findOne({
      _id: new ObjectId(batchId),
      tenantId: new ObjectId(tenantId),
    })) as WithId<AcademicBatchDocument> | null;

    if (!batch) {
      throw new ApiError('BATCH_NOT_FOUND', 'Academic batch not found', 404);
    }

    // Unset current from all other batches
    const unsetFilter: Filter<Document> = {
      tenantId: new ObjectId(tenantId),
      isCurrent: true,
    };
    if (branchId) {
      unsetFilter.$or = [{ branchId: new ObjectId(branchId) }, { branchId: { $exists: false } }];
    }

    await collections.academicBatches.updateMany(unsetFilter, {
      $set: { isCurrent: false, updatedAt: new Date() },
    });

    // Set this batch as current
    await collections.academicBatches.updateOne(
      { _id: new ObjectId(batchId) },
      { $set: { isCurrent: true, status: 'active', updatedAt: new Date() } }
    );

    logger.info({ batchId, tenantId }, 'Academic batch set as current');

    return this.findById(tenantId, batchId);
  }

  async delete(tenantId: string, batchId: string) {
    const batch = (await collections.academicBatches.findOne({
      _id: new ObjectId(batchId),
      tenantId: new ObjectId(tenantId),
    })) as WithId<AcademicBatchDocument> | null;

    if (!batch) {
      throw new ApiError('BATCH_NOT_FOUND', 'Academic batch not found', 404);
    }

    if (batch.isCurrent) {
      throw new ApiError(
        'CANNOT_DELETE_CURRENT_BATCH',
        'Cannot delete the current academic batch',
        400
      );
    }

    // Check if batch has any classes
    const classCount = await collections.classes.countDocuments({
      tenantId: new ObjectId(tenantId),
      academicBatchId: new ObjectId(batchId),
    });

    if (classCount > 0) {
      throw new ApiError(
        'BATCH_HAS_CLASSES',
        `Cannot delete batch with ${classCount} classes`,
        400
      );
    }

    await collections.academicBatches.deleteOne({ _id: new ObjectId(batchId) });

    logger.info({ batchId, tenantId }, 'Academic batch deleted');

    return { success: true };
  }

  async getCurrent(tenantId: string, branchId?: string) {
    const filter: Filter<Document> = {
      tenantId: new ObjectId(tenantId),
      isCurrent: true,
    };

    if (branchId) {
      filter.$or = [{ branchId: new ObjectId(branchId) }, { branchId: { $exists: false } }];
    }

    const batch = (await collections.academicBatches.findOne(
      filter
    )) as WithId<AcademicBatchDocument> | null;

    return batch ? this.formatBatch(batch) : null;
  }

  // ─── Terms (semesters) ────────────────────────────────────────────────────

  private async requireBatch(tenantId: string, batchId: string) {
    const batch = (await collections.academicBatches.findOne({
      _id: new ObjectId(batchId),
      tenantId: new ObjectId(tenantId),
    })) as WithId<AcademicBatchDocument> | null;

    if (!batch) {
      throw new ApiError('BATCH_NOT_FOUND', 'Academic batch not found', 404);
    }
    return batch;
  }

  async addTerm(tenantId: string, batchId: string, data: AcademicTermInput) {
    const batch = await this.requireBatch(tenantId, batchId);

    const term = buildTerm({ ...data, _id: undefined });
    assertUniqueSemesterNumbers([...(batch.terms ?? []), term]);

    await collections.academicBatches.updateOne({ _id: batch._id }, {
      $push: { terms: term },
      $set: { updatedAt: new Date() },
    } as unknown as UpdateFilter<Document>);

    logger.info({ batchId, tenantId, termId: term._id.toString() }, 'Term added to batch');

    return this.findById(tenantId, batchId);
  }

  async updateTerm(tenantId: string, batchId: string, termId: string, data: AcademicTermInput) {
    const batch = await this.requireBatch(tenantId, batchId);

    const existing = (batch.terms ?? []).find((t) => t._id.toString() === termId);
    if (!existing) {
      throw new ApiError('TERM_NOT_FOUND', 'Term not found in this batch', 404);
    }

    const updated = buildTerm({ ...data, _id: termId });
    assertUniqueSemesterNumbers([
      ...(batch.terms ?? []).filter((t) => t._id.toString() !== termId),
      updated,
    ]);

    await collections.academicBatches.updateOne(
      { _id: batch._id, 'terms._id': new ObjectId(termId) },
      { $set: { 'terms.$': updated, updatedAt: new Date() } }
    );

    logger.info({ batchId, tenantId, termId }, 'Term updated');

    return this.findById(tenantId, batchId);
  }

  async deleteTerm(tenantId: string, batchId: string, termId: string) {
    const batch = await this.requireBatch(tenantId, batchId);

    const existing = (batch.terms ?? []).find((t) => t._id.toString() === termId);
    if (!existing) {
      throw new ApiError('TERM_NOT_FOUND', 'Term not found in this batch', 404);
    }

    // A term with course registrations cannot be removed — that would orphan
    // every student's registration for the semester.
    const registrationCount = await collections.courseRegistrations.countDocuments({
      tenantId: new ObjectId(tenantId),
      termId: new ObjectId(termId),
    });
    if (registrationCount > 0) {
      throw new ApiError(
        'TERM_HAS_REGISTRATIONS',
        `Cannot delete term with ${registrationCount} course registration(s)`,
        400
      );
    }

    await collections.academicBatches.updateOne({ _id: batch._id }, {
      $pull: { terms: { _id: new ObjectId(termId) } },
      $set: { updatedAt: new Date() },
    } as unknown as UpdateFilter<Document>);

    logger.info({ batchId, tenantId, termId }, 'Term deleted');

    return this.findById(tenantId, batchId);
  }

  private formatBatch(batch: WithId<AcademicBatchDocument>) {
    return {
      _id: batch._id.toString(),
      tenantId: batch.tenantId.toString(),
      branchId: batch.branchId?.toString(),
      name: batch.name,
      code: batch.code,
      startDate: batch.startDate,
      endDate: batch.endDate,
      isCurrent: batch.isCurrent,
      terms: batch.terms?.map((t) => ({ ...t, _id: t._id?.toString() })),
      status: batch.status,
      createdAt: batch.createdAt,
      updatedAt: batch.updatedAt,
    };
  }

  private formatBatchWithCounts(batch: Document) {
    return {
      _id: batch._id.toString(),
      tenantId: batch.tenantId.toString(),
      branchId: batch.branchId?.toString(),
      name: batch.name,
      code: batch.code,
      startDate: batch.startDate,
      endDate: batch.endDate,
      isCurrent: batch.isCurrent,
      terms: Array.isArray(batch.terms)
        ? batch.terms.map((t: TermSubdocument) => ({ ...t, _id: t._id?.toString() }))
        : batch.terms,
      status: batch.status,
      classCount: batch.classCount || 0,
      studentCount: batch.studentCount || 0,
      createdAt: batch.createdAt,
      updatedAt: batch.updatedAt,
    };
  }
}

export const academicBatchService = new AcademicBatchService();
