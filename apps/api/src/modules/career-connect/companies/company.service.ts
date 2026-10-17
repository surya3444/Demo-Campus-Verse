import { ObjectId, Filter, Document, UpdateFilter } from 'mongodb';
import { collections } from '../../../config/database';
import { ApiError } from '../../../middleware/errorHandler';
import { getPagination, buildPaginationMeta } from '../../../utils/pagination';

class CompanyService {
  async list(
    tenantId: string,
    branchId: string,
    query: {
      search?: string;
      status?: string;
      industry?: string;
      size?: string;
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
        { name: { $regex: query.search, $options: 'i' } },
        { industry: { $regex: query.search, $options: 'i' } },
      ];
    }
    if (query.status) filter.status = query.status;
    if (query.industry) filter.industry = query.industry;
    if (query.size) filter.size = query.size;

    const [data, total] = await Promise.all([
      collections.placementCompanies
        .find(filter)
        .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1, _id: sortOrder === 'asc' ? 1 : -1 })
        .skip(skip)
        .limit(limit)
        .toArray(),
      collections.placementCompanies.countDocuments(filter),
    ]);

    return {
      data: data.map(this.formatCompany),
      meta: buildPaginationMeta(page, limit, total),
    };
  }

  async getById(tenantId: string, id: string) {
    const company = await collections.placementCompanies.findOne({
      _id: new ObjectId(id),
      tenantId: new ObjectId(tenantId),
    });

    if (!company) {
      throw new ApiError('COMPANY_NOT_FOUND', 'Company not found', 404);
    }

    return this.formatCompany(company);
  }

  async create(tenantId: string, branchId: string, userId: string, data: Record<string, unknown>) {
    const now = new Date();

    const doc = {
      ...data,
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
      hrContacts: data.hrContacts || [],
      visitHistory: [],
      rating: { average: 0, count: 0 },
      status: 'active',
      createdBy: new ObjectId(userId),
      createdAt: now,
      updatedAt: now,
    };

    const result = await collections.placementCompanies.insertOne(doc);

    return this.getById(tenantId, result.insertedId.toString());
  }

  async update(tenantId: string, id: string, data: Record<string, unknown>) {
    const company = await collections.placementCompanies.findOne({
      _id: new ObjectId(id),
      tenantId: new ObjectId(tenantId),
    });

    if (!company) {
      throw new ApiError('COMPANY_NOT_FOUND', 'Company not found', 404);
    }

    await collections.placementCompanies.updateOne(
      { _id: new ObjectId(id) },
      { $set: { ...data, updatedAt: new Date() } }
    );

    return this.getById(tenantId, id);
  }

  async delete(tenantId: string, id: string) {
    const company = await collections.placementCompanies.findOne({
      _id: new ObjectId(id),
      tenantId: new ObjectId(tenantId),
    });

    if (!company) {
      throw new ApiError('COMPANY_NOT_FOUND', 'Company not found', 404);
    }

    // Check if company has active drives
    const activeDrives = await collections.placementDrives.countDocuments({
      companyId: new ObjectId(id),
      tenantId: new ObjectId(tenantId),
      status: { $nin: ['completed', 'cancelled'] },
    });

    if (activeDrives > 0) {
      throw new ApiError(
        'COMPANY_HAS_ACTIVE_DRIVES',
        'Cannot delete company with active placement drives',
        400
      );
    }

    await collections.placementCompanies.deleteOne({ _id: new ObjectId(id) });
  }

  async updateStatus(tenantId: string, id: string, status: string) {
    const company = await collections.placementCompanies.findOne({
      _id: new ObjectId(id),
      tenantId: new ObjectId(tenantId),
    });

    if (!company) {
      throw new ApiError('COMPANY_NOT_FOUND', 'Company not found', 404);
    }

    await collections.placementCompanies.updateOne(
      { _id: new ObjectId(id) },
      { $set: { status, updatedAt: new Date() } }
    );

    return this.getById(tenantId, id);
  }

  async addContact(tenantId: string, id: string, contact: Record<string, unknown>) {
    const company = await collections.placementCompanies.findOne({
      _id: new ObjectId(id),
      tenantId: new ObjectId(tenantId),
    });

    if (!company) {
      throw new ApiError('COMPANY_NOT_FOUND', 'Company not found', 404);
    }

    const contactDoc = {
      ...contact,
      _id: new ObjectId(),
    };

    await collections.placementCompanies.updateOne({ _id: new ObjectId(id) }, {
      $push: { hrContacts: contactDoc },
      $set: { updatedAt: new Date() },
    } as unknown as UpdateFilter<Document>);

    return this.getById(tenantId, id);
  }

  async updateContact(
    tenantId: string,
    id: string,
    contactId: string,
    data: Record<string, unknown>
  ) {
    const company = await collections.placementCompanies.findOne({
      _id: new ObjectId(id),
      tenantId: new ObjectId(tenantId),
    });

    if (!company) {
      throw new ApiError('COMPANY_NOT_FOUND', 'Company not found', 404);
    }

    const updateFields: Record<string, unknown> = { updatedAt: new Date() };
    for (const [key, value] of Object.entries(data)) {
      updateFields[`hrContacts.$.${key}`] = value;
    }

    const result = await collections.placementCompanies.updateOne(
      {
        _id: new ObjectId(id),
        'hrContacts._id': new ObjectId(contactId),
      },
      { $set: updateFields }
    );

    if (result.matchedCount === 0) {
      throw new ApiError('CONTACT_NOT_FOUND', 'Contact not found', 404);
    }

    return this.getById(tenantId, id);
  }

  async removeContact(tenantId: string, id: string, contactId: string) {
    const company = await collections.placementCompanies.findOne({
      _id: new ObjectId(id),
      tenantId: new ObjectId(tenantId),
    });

    if (!company) {
      throw new ApiError('COMPANY_NOT_FOUND', 'Company not found', 404);
    }

    await collections.placementCompanies.updateOne({ _id: new ObjectId(id) }, {
      $pull: { hrContacts: { _id: new ObjectId(contactId) } },
      $set: { updatedAt: new Date() },
    } as unknown as UpdateFilter<Document>);

    return this.getById(tenantId, id);
  }

  async addVisit(tenantId: string, id: string, userId: string, visitData: Record<string, unknown>) {
    const company = await collections.placementCompanies.findOne({
      _id: new ObjectId(id),
      tenantId: new ObjectId(tenantId),
    });

    if (!company) {
      throw new ApiError('COMPANY_NOT_FOUND', 'Company not found', 404);
    }

    const visit = {
      ...visitData,
      _id: new ObjectId(),
      date: visitData.date ? new Date(visitData.date as string) : new Date(),
      createdBy: new ObjectId(userId),
      createdAt: new Date(),
    };

    await collections.placementCompanies.updateOne({ _id: new ObjectId(id) }, {
      $push: { visitHistory: visit },
      $set: { updatedAt: new Date() },
    } as unknown as UpdateFilter<Document>);

    return this.getById(tenantId, id);
  }

  async getVisits(tenantId: string, id: string) {
    const company = await collections.placementCompanies.findOne({
      _id: new ObjectId(id),
      tenantId: new ObjectId(tenantId),
    });

    if (!company) {
      throw new ApiError('COMPANY_NOT_FOUND', 'Company not found', 404);
    }

    return (company.visitHistory || []).map((v: Record<string, unknown>) => ({
      ...v,
      _id: (v._id as ObjectId)?.toString(),
      createdBy: (v.createdBy as ObjectId)?.toString(),
    }));
  }

  private formatCompany(doc: Document) {
    return {
      ...doc,
      _id: doc._id.toString(),
      tenantId: doc.tenantId?.toString(),
      branchId: doc.branchId?.toString(),
      createdBy: doc.createdBy?.toString(),
      hrContacts: (doc.hrContacts || []).map((c: Record<string, unknown>) => ({
        ...c,
        _id: (c._id as ObjectId)?.toString(),
      })),
      visitHistory: (doc.visitHistory || []).map((v: Record<string, unknown>) => ({
        ...v,
        _id: (v._id as ObjectId)?.toString(),
        createdBy: (v.createdBy as ObjectId)?.toString(),
      })),
    };
  }
}

export const companyService = new CompanyService();
