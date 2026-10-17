import { ObjectId, Filter, Document, UpdateFilter } from 'mongodb';
import { collections } from '../../../config/database';
import { ApiError } from '../../../middleware/errorHandler';
import { getPagination, buildPaginationMeta } from '../../../utils/pagination';

class ReferralService {
  async list(
    tenantId: string,
    branchId: string,
    query: {
      search?: string;
      status?: string;
      alumniId?: string;
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
        { companyName: { $regex: query.search, $options: 'i' } },
        { roleTitle: { $regex: query.search, $options: 'i' } },
      ];
    }
    if (query.status) filter.status = query.status;
    if (query.alumniId) filter.alumniId = new ObjectId(query.alumniId);

    const [data, total] = await Promise.all([
      collections.alumniReferrals
        .find(filter)
        .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1, _id: sortOrder === 'asc' ? 1 : -1 })
        .skip(skip)
        .limit(limit)
        .toArray(),
      collections.alumniReferrals.countDocuments(filter),
    ]);

    return {
      data: data.map(this.formatReferral),
      meta: buildPaginationMeta(page, limit, total),
    };
  }

  async getById(tenantId: string, id: string) {
    const referral = await collections.alumniReferrals.findOne({
      _id: new ObjectId(id),
      tenantId: new ObjectId(tenantId),
    });

    if (!referral) {
      throw new ApiError('REFERRAL_NOT_FOUND', 'Referral not found', 404);
    }

    return this.formatReferral(referral);
  }

  async create(tenantId: string, branchId: string, userId: string, data: Record<string, unknown>) {
    const now = new Date();

    const doc = {
      ...data,
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
      alumniId: new ObjectId((data.alumniId as string) || userId),
      status: 'open',
      studentsReferred: [],
      createdBy: new ObjectId(userId),
      createdAt: now,
      updatedAt: now,
    };

    const result = await collections.alumniReferrals.insertOne(doc);

    return this.getById(tenantId, result.insertedId.toString());
  }

  async update(tenantId: string, id: string, data: Record<string, unknown>) {
    const referral = await collections.alumniReferrals.findOne({
      _id: new ObjectId(id),
      tenantId: new ObjectId(tenantId),
    });

    if (!referral) {
      throw new ApiError('REFERRAL_NOT_FOUND', 'Referral not found', 404);
    }

    await collections.alumniReferrals.updateOne(
      { _id: new ObjectId(id) },
      { $set: { ...data, updatedAt: new Date() } }
    );

    return this.getById(tenantId, id);
  }

  async delete(tenantId: string, id: string) {
    const referral = await collections.alumniReferrals.findOne({
      _id: new ObjectId(id),
      tenantId: new ObjectId(tenantId),
    });

    if (!referral) {
      throw new ApiError('REFERRAL_NOT_FOUND', 'Referral not found', 404);
    }

    await collections.alumniReferrals.deleteOne({ _id: new ObjectId(id) });
  }

  async referStudent(tenantId: string, id: string, studentId: string, studentName: string) {
    const referral = await collections.alumniReferrals.findOne({
      _id: new ObjectId(id),
      tenantId: new ObjectId(tenantId),
    });

    if (!referral) {
      throw new ApiError('REFERRAL_NOT_FOUND', 'Referral not found', 404);
    }

    // Check if student already referred
    const alreadyReferred = (referral.studentsReferred as Array<Record<string, unknown>>)?.some(
      (r) => (r.studentId as ObjectId).toString() === studentId
    );

    if (alreadyReferred) {
      throw new ApiError(
        'STUDENT_ALREADY_REFERRED',
        'Student has already been referred for this opportunity',
        400
      );
    }

    const referralEntry = {
      studentId: new ObjectId(studentId),
      studentName,
      status: 'referred',
      referredAt: new Date(),
    };

    await collections.alumniReferrals.updateOne({ _id: new ObjectId(id) }, {
      $push: { studentsReferred: referralEntry },
      $set: { updatedAt: new Date() },
    } as unknown as UpdateFilter<Document>);

    return this.getById(tenantId, id);
  }

  private formatReferral(doc: Document) {
    return {
      ...doc,
      _id: doc._id.toString(),
      tenantId: doc.tenantId?.toString(),
      branchId: doc.branchId?.toString(),
      alumniId: doc.alumniId?.toString(),
      createdBy: doc.createdBy?.toString(),
      studentsReferred: (doc.studentsReferred || []).map((r: Record<string, unknown>) => ({
        ...r,
        studentId: (r.studentId as ObjectId)?.toString(),
      })),
    };
  }
}

export const referralService = new ReferralService();
