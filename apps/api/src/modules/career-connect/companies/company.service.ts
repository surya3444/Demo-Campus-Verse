import { ObjectId, Filter, Document, UpdateFilter } from 'mongodb';
import { collections } from '../../../config/database';
import { ApiError } from '../../../middleware/errorHandler';
import { getPagination, buildPaginationMeta } from '../../../utils/pagination';
import { withPeople } from '../../../utils/people';

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
      data: await this.withHiring(tenantId, data.map(this.formatCompany)),
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

    const [withStats] = await this.withHiring(tenantId, [this.formatCompany(company)]);
    // The people this company hired, with photos — the company page shows them.
    const offers = await collections.placementOffers
      .find({ tenantId: new ObjectId(tenantId), companyId: company._id, status: 'accepted' })
      .sort({ ctc: -1, _id: 1 })
      .limit(60)
      .toArray();
    const hires = await withPeople(
      offers.map((o) => ({
        studentId: String(o.studentId),
        role: o.role as string,
        ctc: Number(o.ctc) || 0,
        location: (o.location as string) ?? null,
        offerDate: o.offerDate ?? o.createdAt,
      })),
      'studentId'
    );
    return { ...withStats, hires };
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

  /** Drives, offers, hires and packages per company for this tenant. */
  private async withHiring<T extends { _id: string }>(tenantId: string, rows: T[]) {
    if (!rows.length)
      return rows.map((r) => ({
        ...r,
        stats: {
          drives: 0,
          offers: 0,
          hired: 0,
          topCtc: 0,
          avgCtc: 0,
          lastDrive: null as Date | null,
        },
      }));
    const ids = rows.map((r) => new ObjectId(r._id));
    const tenantOid = new ObjectId(tenantId);
    const [offers, drives] = await Promise.all([
      collections.placementOffers
        .aggregate([
          { $match: { tenantId: tenantOid, companyId: { $in: ids } } },
          {
            $group: {
              _id: '$companyId',
              offers: { $sum: 1 },
              hired: { $sum: { $cond: [{ $eq: ['$status', 'accepted'] }, 1, 0] } },
              topCtc: { $max: '$ctc' },
              avgCtc: { $avg: { $cond: [{ $eq: ['$status', 'accepted'] }, '$ctc', null] } },
            },
          },
        ])
        .toArray(),
      collections.placementDrives
        .aggregate([
          {
            $match: { tenantId: tenantOid, companyId: { $in: ids }, status: { $ne: 'cancelled' } },
          },
          {
            $group: {
              _id: '$companyId',
              drives: { $sum: 1 },
              lastDrive: { $max: '$registrationDeadline' },
            },
          },
        ])
        .toArray(),
    ]);
    const o = new Map(offers.map((x) => [String(x._id), x]));
    const d = new Map(drives.map((x) => [String(x._id), x]));
    return rows.map((r) => ({
      ...r,
      stats: {
        drives: d.get(r._id)?.drives ?? 0,
        lastDrive: (d.get(r._id)?.lastDrive as Date | undefined) ?? null,
        offers: o.get(r._id)?.offers ?? 0,
        hired: o.get(r._id)?.hired ?? 0,
        topCtc: o.get(r._id)?.topCtc ?? 0,
        avgCtc: Math.round(o.get(r._id)?.avgCtc ?? 0),
      },
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
