import { ObjectId, Filter, Document } from 'mongodb';
import { collections } from '../../../config/database';
import { ApiError } from '../../../middleware/errorHandler';
import { getPagination, buildPaginationMeta } from '../../../utils/pagination';

class JobApplicationService {
  async apply(
    tenantId: string,
    branchId: string,
    studentId: string,
    studentName: string,
    jobPostingId: string,
    data: Record<string, unknown>
  ) {
    const posting = await collections.jobPostings.findOne({
      _id: new ObjectId(jobPostingId),
      tenantId: new ObjectId(tenantId),
    });

    if (!posting) {
      throw new ApiError('POSTING_NOT_FOUND', 'Job posting not found', 404);
    }

    if (posting.status !== 'active') {
      throw new ApiError('POSTING_NOT_ACTIVE', 'Job posting is not accepting applications', 400);
    }

    if (
      posting.applicationDeadline &&
      new Date() > new Date(posting.applicationDeadline as string)
    ) {
      throw new ApiError('DEADLINE_PASSED', 'Application deadline has passed', 400);
    }

    if (posting.maxApplications) {
      const currentCount = await collections.jobApplications.countDocuments({
        jobPostingId: new ObjectId(jobPostingId),
        tenantId: new ObjectId(tenantId),
        status: { $ne: 'withdrawn' },
      });
      if (currentCount >= (posting.maxApplications as number)) {
        throw new ApiError(
          'MAX_APPLICATIONS_REACHED',
          'Maximum number of applications reached',
          400
        );
      }
    }

    const existing = await collections.jobApplications.findOne({
      studentId: new ObjectId(studentId),
      jobPostingId: new ObjectId(jobPostingId),
      tenantId: new ObjectId(tenantId),
    });

    if (existing) {
      throw new ApiError('ALREADY_APPLIED', 'You have already applied for this posting', 400);
    }

    const now = new Date();
    const doc = {
      ...data,
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
      studentId: new ObjectId(studentId),
      studentName,
      jobPostingId: new ObjectId(jobPostingId),
      jobTitle: posting.title,
      companyName: posting.companyName,
      status: 'applied',
      appliedAt: now,
      createdAt: now,
      updatedAt: now,
    };

    const result = await collections.jobApplications.insertOne(doc);

    await collections.jobPostings.updateOne(
      { _id: new ObjectId(jobPostingId) },
      { $inc: { applicationCount: 1 } }
    );

    return this.getById(tenantId, result.insertedId.toString());
  }

  async getByPosting(
    tenantId: string,
    jobPostingId: string,
    query: {
      status?: string;
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
      jobPostingId: new ObjectId(jobPostingId),
    };

    if (query.status) filter.status = query.status;

    const [data, total] = await Promise.all([
      collections.jobApplications
        .find(filter)
        .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1, _id: sortOrder === 'asc' ? 1 : -1 })
        .skip(skip)
        .limit(limit)
        .toArray(),
      collections.jobApplications.countDocuments(filter),
    ]);

    return {
      data: data.map(this.formatApplication),
      meta: buildPaginationMeta(page, limit, total),
    };
  }

  async getMyApplications(
    tenantId: string,
    studentId: string,
    query: {
      status?: string;
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
      studentId: new ObjectId(studentId),
    };

    if (query.status) filter.status = query.status;

    const [data, total] = await Promise.all([
      collections.jobApplications
        .find(filter)
        .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1, _id: sortOrder === 'asc' ? 1 : -1 })
        .skip(skip)
        .limit(limit)
        .toArray(),
      collections.jobApplications.countDocuments(filter),
    ]);

    return {
      data: data.map(this.formatApplication),
      meta: buildPaginationMeta(page, limit, total),
    };
  }

  async getById(tenantId: string, id: string) {
    const application = await collections.jobApplications.findOne({
      _id: new ObjectId(id),
      tenantId: new ObjectId(tenantId),
    });

    if (!application) {
      throw new ApiError('APPLICATION_NOT_FOUND', 'Job application not found', 404);
    }

    return this.formatApplication(application);
  }

  async updateStatus(
    tenantId: string,
    id: string,
    data: { status: string; statusRemarks?: string }
  ) {
    const application = await collections.jobApplications.findOne({
      _id: new ObjectId(id),
      tenantId: new ObjectId(tenantId),
    });

    if (!application) {
      throw new ApiError('APPLICATION_NOT_FOUND', 'Job application not found', 404);
    }

    const updateData: Record<string, unknown> = {
      status: data.status,
      updatedAt: new Date(),
    };

    if (data.statusRemarks) {
      updateData.statusRemarks = data.statusRemarks;
    }

    await collections.jobApplications.updateOne({ _id: new ObjectId(id) }, { $set: updateData });

    return this.getById(tenantId, id);
  }

  async withdraw(tenantId: string, id: string, studentId: string) {
    const application = await collections.jobApplications.findOne({
      _id: new ObjectId(id),
      tenantId: new ObjectId(tenantId),
    });

    if (!application) {
      throw new ApiError('APPLICATION_NOT_FOUND', 'Job application not found', 404);
    }

    if (application.studentId.toString() !== studentId) {
      throw new ApiError('UNAUTHORIZED', 'You can only withdraw your own applications', 403);
    }

    if (application.status === 'withdrawn') {
      throw new ApiError('ALREADY_WITHDRAWN', 'Application is already withdrawn', 400);
    }

    await collections.jobApplications.updateOne(
      { _id: new ObjectId(id) },
      { $set: { status: 'withdrawn', updatedAt: new Date() } }
    );

    await collections.jobPostings.updateOne(
      { _id: application.jobPostingId },
      { $inc: { applicationCount: -1 } }
    );

    return this.getById(tenantId, id);
  }

  private formatApplication(doc: Document) {
    return {
      ...doc,
      _id: doc._id.toString(),
      tenantId: doc.tenantId?.toString(),
      branchId: doc.branchId?.toString(),
      studentId: doc.studentId?.toString(),
      jobPostingId: doc.jobPostingId?.toString(),
    };
  }
}

export const jobApplicationService = new JobApplicationService();
