import { ObjectId, Filter, Document } from 'mongodb';
import { collections } from '../../../config/database';
import { ApiError } from '../../../middleware/errorHandler';
import { getPagination, buildPaginationMeta } from '../../../utils/pagination';

class ResourceService {
  async list(
    tenantId: string,
    branchId: string,
    query: {
      search?: string;
      type?: string;
      category?: string;
      isPublished?: string;
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
      filter.title = { $regex: query.search, $options: 'i' };
    }
    if (query.type) filter.type = query.type;
    if (query.category) filter.category = query.category;
    if (query.isPublished !== undefined) {
      filter.isPublished = query.isPublished === 'true';
    }

    const [data, total] = await Promise.all([
      collections.careerResources
        .find(filter)
        .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1, _id: sortOrder === 'asc' ? 1 : -1 })
        .skip(skip)
        .limit(limit)
        .toArray(),
      collections.careerResources.countDocuments(filter),
    ]);

    return {
      data: data.map(this.formatResource),
      meta: buildPaginationMeta(page, limit, total),
    };
  }

  async getById(tenantId: string, id: string) {
    const resource = await collections.careerResources.findOne({
      _id: new ObjectId(id),
      tenantId: new ObjectId(tenantId),
    });

    if (!resource) {
      throw new ApiError('RESOURCE_NOT_FOUND', 'Career resource not found', 404);
    }

    return this.formatResource(resource);
  }

  async create(tenantId: string, branchId: string, userId: string, data: Record<string, unknown>) {
    const now = new Date();

    const doc: Record<string, unknown> = {
      ...data,
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
      createdBy: new ObjectId(userId),
      createdAt: now,
      updatedAt: now,
    };

    if (data.isPublished) {
      doc.publishedAt = now;
    }

    const result = await collections.careerResources.insertOne(doc);

    return this.getById(tenantId, result.insertedId.toString());
  }

  async update(tenantId: string, id: string, data: Record<string, unknown>) {
    const resource = await collections.careerResources.findOne({
      _id: new ObjectId(id),
      tenantId: new ObjectId(tenantId),
    });

    if (!resource) {
      throw new ApiError('RESOURCE_NOT_FOUND', 'Career resource not found', 404);
    }

    // If transitioning isPublished to true, set publishedAt
    if (data.isPublished === true && !resource.isPublished) {
      data.publishedAt = new Date();
    }

    await collections.careerResources.updateOne(
      { _id: new ObjectId(id) },
      { $set: { ...data, updatedAt: new Date() } }
    );

    return this.getById(tenantId, id);
  }

  async delete(tenantId: string, id: string) {
    const resource = await collections.careerResources.findOne({
      _id: new ObjectId(id),
      tenantId: new ObjectId(tenantId),
    });

    if (!resource) {
      throw new ApiError('RESOURCE_NOT_FOUND', 'Career resource not found', 404);
    }

    await collections.careerResources.deleteOne({ _id: new ObjectId(id) });
  }

  private formatResource(doc: Document) {
    return {
      ...doc,
      _id: doc._id.toString(),
      tenantId: doc.tenantId?.toString(),
      branchId: doc.branchId?.toString(),
      createdBy: doc.createdBy?.toString(),
    };
  }
}

export const resourceService = new ResourceService();
