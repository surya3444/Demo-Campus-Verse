import { ObjectId, Filter, Document } from 'mongodb';
import { collections } from '../../../config/database';
import { ApiError } from '../../../middleware/errorHandler';
import { getPagination, buildPaginationMeta } from '../../../utils/pagination';
import { generateJobPostingNumber } from '../../../utils/generators';

class JobPostingService {
  async list(
    tenantId: string,
    branchId: string,
    query: {
      search?: string;
      status?: string;
      type?: string;
      workMode?: string;
      companyId?: string;
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
    if (query.type) filter.type = query.type;
    if (query.workMode) filter.workMode = query.workMode;
    if (query.companyId) filter.companyId = new ObjectId(query.companyId);

    const [data, total] = await Promise.all([
      collections.jobPostings
        .find(filter)
        .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1, _id: sortOrder === 'asc' ? 1 : -1 })
        .skip(skip)
        .limit(limit)
        .toArray(),
      collections.jobPostings.countDocuments(filter),
    ]);

    return {
      data: await this.withWebsite(data.map(this.formatPosting)),
      meta: buildPaginationMeta(page, limit, total),
    };
  }

  async getById(tenantId: string, id: string) {
    const posting = await collections.jobPostings.findOne({
      _id: new ObjectId(id),
      tenantId: new ObjectId(tenantId),
    });

    if (!posting) {
      throw new ApiError('POSTING_NOT_FOUND', 'Job posting not found', 404);
    }

    return (await this.withWebsite([this.formatPosting(posting)]))[0];
  }

  async create(tenantId: string, branchId: string, userId: string, data: Record<string, unknown>) {
    const now = new Date();
    const postingNumber = await generateJobPostingNumber(tenantId, branchId);

    const doc = {
      ...data,
      postingNumber,
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
      companyId: data.companyId ? new ObjectId(data.companyId as string) : undefined,
      status: 'draft',
      applicationCount: 0,
      createdBy: new ObjectId(userId),
      createdAt: now,
      updatedAt: now,
    };

    const result = await collections.jobPostings.insertOne(doc);

    return this.getById(tenantId, result.insertedId.toString());
  }

  async update(tenantId: string, id: string, data: Record<string, unknown>) {
    const posting = await collections.jobPostings.findOne({
      _id: new ObjectId(id),
      tenantId: new ObjectId(tenantId),
    });

    if (!posting) {
      throw new ApiError('POSTING_NOT_FOUND', 'Job posting not found', 404);
    }

    if (data.companyId) {
      data.companyId = new ObjectId(data.companyId as string);
    }

    await collections.jobPostings.updateOne(
      { _id: new ObjectId(id) },
      { $set: { ...data, updatedAt: new Date() } }
    );

    return this.getById(tenantId, id);
  }

  async delete(tenantId: string, id: string) {
    const posting = await collections.jobPostings.findOne({
      _id: new ObjectId(id),
      tenantId: new ObjectId(tenantId),
    });

    if (!posting) {
      throw new ApiError('POSTING_NOT_FOUND', 'Job posting not found', 404);
    }

    if (posting.status !== 'draft') {
      throw new ApiError('POSTING_NOT_DRAFT', 'Only draft postings can be deleted', 400);
    }

    const applicationCount = await collections.jobApplications.countDocuments({
      jobPostingId: new ObjectId(id),
      tenantId: new ObjectId(tenantId),
    });

    if (applicationCount > 0) {
      throw new ApiError(
        'POSTING_HAS_APPLICATIONS',
        'Cannot delete posting with existing applications',
        400
      );
    }

    await collections.jobPostings.deleteOne({ _id: new ObjectId(id) });
  }

  async updateStatus(tenantId: string, id: string, status: string) {
    const posting = await collections.jobPostings.findOne({
      _id: new ObjectId(id),
      tenantId: new ObjectId(tenantId),
    });

    if (!posting) {
      throw new ApiError('POSTING_NOT_FOUND', 'Job posting not found', 404);
    }

    const validTransitions: Record<string, string[]> = {
      draft: ['active'],
      active: ['closed'],
      closed: ['active'],
    };

    const allowed = validTransitions[posting.status as string] || [];
    if (!allowed.includes(status)) {
      throw new ApiError(
        'INVALID_STATUS_TRANSITION',
        `Cannot transition from ${posting.status} to ${status}`,
        400
      );
    }

    await collections.jobPostings.updateOne(
      { _id: new ObjectId(id) },
      { $set: { status, updatedAt: new Date() } }
    );

    return this.getById(tenantId, id);
  }

  async getStats(tenantId: string, branchId: string) {
    const filter = {
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
    };

    const [statusCounts, totalApplications] = await Promise.all([
      collections.jobPostings
        .aggregate([{ $match: filter }, { $group: { _id: '$status', count: { $sum: 1 } } }])
        .toArray(),
      collections.jobApplications
        .aggregate([{ $match: filter }, { $group: { _id: '$status', count: { $sum: 1 } } }])
        .toArray(),
    ]);

    const postingsByStatus: Record<string, number> = {};
    let totalPostings = 0;
    for (const item of statusCounts) {
      postingsByStatus[item._id as string] = item.count as number;
      totalPostings += item.count as number;
    }

    const applicationsByStatus: Record<string, number> = {};
    let totalApps = 0;
    for (const item of totalApplications) {
      applicationsByStatus[item._id as string] = item.count as number;
      totalApps += item.count as number;
    }

    return {
      totalPostings,
      postingsByStatus,
      totalApplications: totalApps,
      applicationsByStatus,
    };
  }

  /** Company website, for the logo. */
  private async withWebsite<T extends { companyId?: unknown; companyName?: unknown }>(rows: T[]) {
    const ids = rows.map((r) => r.companyId).filter((id) => id && ObjectId.isValid(String(id)));
    const companies = await collections.placementCompanies
      .find({ _id: { $in: ids.map((id) => new ObjectId(String(id))) } })
      .project({ website: 1 })
      .toArray();
    const site = new Map(companies.map((c) => [String(c._id), c.website as string]));
    return rows.map((r) => ({ ...r, companyWebsite: site.get(String(r.companyId)) ?? null }));
  }

  private formatPosting(doc: Document) {
    return {
      ...doc,
      _id: doc._id.toString(),
      tenantId: doc.tenantId?.toString(),
      branchId: doc.branchId?.toString(),
      companyId: doc.companyId?.toString(),
      createdBy: doc.createdBy?.toString(),
    };
  }
}

export const jobPostingService = new JobPostingService();
