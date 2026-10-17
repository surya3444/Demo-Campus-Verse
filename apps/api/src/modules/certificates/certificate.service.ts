import { ObjectId, WithId, Document, Filter } from 'mongodb';
import { collections } from '../../config/database';
import { logger } from '../../lib/logger';
import { ApiError } from '../../middleware/errorHandler';

// ============ Certificate Types ============

interface CertificateTypeDocument extends Document {
  _id: ObjectId;
  tenantId: ObjectId;
  name: string;
  code: string;
  category: 'student' | 'staff';
  template: string; // HTML template with placeholders
  fields: Array<{
    name: string;
    label: string;
    type: 'text' | 'date' | 'number' | 'select';
    required: boolean;
    options?: string[];
  }>;
  requiresApproval: boolean;
  approvalLevels?: number;
  sequencePrefix: string;
  currentSequence: number;
  status: 'active' | 'inactive';
  createdBy: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

// ============ Certificate Request ============

interface CertificateRequestDocument extends Document {
  _id: ObjectId;
  tenantId: ObjectId;
  branchId: ObjectId;
  certificateNumber: string;
  certificateTypeId: ObjectId;
  category: 'student' | 'staff';
  requestorId: ObjectId; // Student or Staff ID
  requestorType: 'student' | 'staff';
  purpose?: string;
  fieldValues: Record<string, unknown>;
  status: 'pending' | 'approved' | 'rejected' | 'issued' | 'cancelled';
  approvals?: Array<{
    level: number;
    approvedBy: ObjectId;
    approvedAt: Date;
    remarks?: string;
  }>;
  rejectionReason?: string;
  issuedAt?: Date;
  issuedBy?: ObjectId;
  generatedDocument?: {
    url: string;
    generatedAt: Date;
  };
  requestedBy: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

// ============ ID Card Template ============

interface IdCardTemplateDocument extends Document {
  _id: ObjectId;
  tenantId: ObjectId;
  branchId?: ObjectId;
  name: string;
  category: 'student' | 'staff';
  frontTemplate: string;
  backTemplate?: string;
  dimensions: {
    width: number;
    height: number;
    unit: 'mm' | 'cm' | 'in';
  };
  status: 'active' | 'inactive';
  createdBy: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCertificateTypeInput {
  name: string;
  code: string;
  category: 'student' | 'staff';
  template: string;
  fields?: Array<{
    name: string;
    label: string;
    type: 'text' | 'date' | 'number' | 'select';
    required: boolean;
    options?: string[];
  }>;
  requiresApproval?: boolean;
  approvalLevels?: number;
  sequencePrefix: string;
}

export interface CreateCertificateRequestInput {
  certificateTypeId: string;
  requestorId: string;
  requestorType: 'student' | 'staff';
  purpose?: string;
  fieldValues?: Record<string, unknown>;
}

class CertificateService {
  // ============ Certificate Types ============

  async createCertificateType(
    tenantId: string,
    data: CreateCertificateTypeInput,
    createdBy: string
  ) {
    const existing = await collections.certificateTypes.findOne({
      tenantId: new ObjectId(tenantId),
      code: data.code.toUpperCase(),
    });

    if (existing) {
      throw new ApiError('DUPLICATE_CODE', 'Certificate type code already exists', 400);
    }

    const typeId = new ObjectId();
    const now = new Date();

    const certificateType: Omit<CertificateTypeDocument, '_id'> & { _id: ObjectId } = {
      _id: typeId,
      tenantId: new ObjectId(tenantId),
      name: data.name,
      code: data.code.toUpperCase(),
      category: data.category ?? 'student',
      template: data.template,
      fields: data.fields || [],
      requiresApproval: data.requiresApproval || false,
      approvalLevels: data.approvalLevels,
      sequencePrefix: data.sequencePrefix,
      currentSequence: 0,
      status: 'active',
      createdBy: new ObjectId(createdBy),
      createdAt: now,
      updatedAt: now,
    };

    await collections.certificateTypes.insertOne(certificateType);

    logger.info(
      { typeId: typeId.toString(), name: data.name, tenantId },
      'Certificate type created'
    );

    return this.formatCertificateType(certificateType as WithId<CertificateTypeDocument>);
  }

  async findAllCertificateTypes(tenantId: string, category?: 'student' | 'staff') {
    const filter: Filter<Document> = {
      tenantId: new ObjectId(tenantId),
      status: 'active',
    };

    if (category) {
      filter.category = category;
    }

    const types = (await collections.certificateTypes
      .find(filter)
      .sort({ name: 1 })
      .toArray()) as WithId<CertificateTypeDocument>[];

    return types.map((t) => this.formatCertificateType(t));
  }

  async findCertificateTypeById(tenantId: string, typeId: string) {
    const type = (await collections.certificateTypes.findOne({
      _id: new ObjectId(typeId),
      tenantId: new ObjectId(tenantId),
    })) as WithId<CertificateTypeDocument> | null;

    if (!type) {
      throw new ApiError('TYPE_NOT_FOUND', 'Certificate type not found', 404);
    }

    return this.formatCertificateType(type);
  }

  async updateCertificateType(
    tenantId: string,
    typeId: string,
    data: Partial<CreateCertificateTypeInput>
  ) {
    const existing = (await collections.certificateTypes.findOne({
      _id: new ObjectId(typeId),
      tenantId: new ObjectId(tenantId),
    })) as WithId<CertificateTypeDocument> | null;

    if (!existing) {
      throw new ApiError('TYPE_NOT_FOUND', 'Certificate type not found', 404);
    }

    const updateData: Record<string, unknown> = { updatedAt: new Date() };

    if (data.name !== undefined) updateData.name = data.name;
    if (data.template !== undefined) updateData.template = data.template;
    if (data.fields !== undefined) updateData.fields = data.fields;
    if (data.requiresApproval !== undefined) updateData.requiresApproval = data.requiresApproval;
    if (data.approvalLevels !== undefined) updateData.approvalLevels = data.approvalLevels;

    await collections.certificateTypes.updateOne(
      { _id: new ObjectId(typeId) },
      { $set: updateData }
    );

    return this.findCertificateTypeById(tenantId, typeId);
  }

  // ============ Certificate Requests ============

  async createCertificateRequest(
    tenantId: string,
    branchId: string,
    data: CreateCertificateRequestInput,
    requestedBy: string
  ) {
    // Get certificate type
    const type = (await collections.certificateTypes.findOne({
      _id: new ObjectId(data.certificateTypeId),
      tenantId: new ObjectId(tenantId),
    })) as WithId<CertificateTypeDocument> | null;

    if (!type) {
      throw new ApiError('TYPE_NOT_FOUND', 'Certificate type not found', 404);
    }

    // Verify requestor exists
    const collection = data.requestorType === 'student' ? collections.students : collections.staff;
    const requestor = await collection.findOne({
      _id: new ObjectId(data.requestorId),
      tenantId: new ObjectId(tenantId),
    });

    if (!requestor) {
      throw new ApiError('REQUESTOR_NOT_FOUND', `${data.requestorType} not found`, 404);
    }

    // Generate certificate number
    const sequence = type.currentSequence + 1;
    // Types created without a prefix fall back to their code (was printing "null00006").
    const certificateNumber = `${type.sequencePrefix || `${type.code}-`}${String(sequence).padStart(5, '0')}`;

    // Update sequence
    await collections.certificateTypes.updateOne(
      { _id: type._id },
      { $inc: { currentSequence: 1 } }
    );

    const requestId = new ObjectId();
    const now = new Date();

    const request: Omit<CertificateRequestDocument, '_id'> & { _id: ObjectId } = {
      _id: requestId,
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
      certificateNumber,
      certificateTypeId: type._id,
      category: type.category,
      requestorId: new ObjectId(data.requestorId),
      requestorType: data.requestorType,
      purpose: data.purpose,
      fieldValues: data.fieldValues || {},
      status: type.requiresApproval ? 'pending' : 'approved',
      requestedBy: new ObjectId(requestedBy),
      createdAt: now,
      updatedAt: now,
    };

    await collections.certificateRequests.insertOne(request);

    logger.info(
      { requestId: requestId.toString(), certificateNumber, tenantId },
      'Certificate request created'
    );

    return this.formatCertificateRequest(request as WithId<CertificateRequestDocument>);
  }

  async findAllCertificateRequests(
    tenantId: string,
    branchId: string,
    params: {
      page?: number;
      limit?: number;
      status?: string;
      category?: string;
      requestorType?: string;
    } = {}
  ) {
    const { page = 1, limit = 20, status, category, requestorType } = params;

    const filter: Filter<Document> = {
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
    };

    if (status) filter.status = status;
    if (category) filter.category = category;
    if (requestorType) filter.requestorType = requestorType;

    const skip = (page - 1) * limit;

    const [requests, total] = await Promise.all([
      collections.certificateRequests
        .aggregate([
          { $match: filter },
          { $sort: { createdAt: -1 } },
          { $skip: skip },
          { $limit: limit },
          {
            $lookup: {
              from: 'certificateTypes',
              localField: 'certificateTypeId',
              foreignField: '_id',
              as: 'certificateType',
            },
          },
          { $unwind: { path: '$certificateType', preserveNullAndEmptyArrays: true } },
        ])
        .toArray() as Promise<WithId<CertificateRequestDocument>[]>,
      collections.certificateRequests.countDocuments(filter),
    ]);

    return {
      data: requests.map((r) => this.formatCertificateRequest(r)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findCertificateRequestById(tenantId: string, requestId: string) {
    const request = (await collections.certificateRequests
      .aggregate([
        {
          $match: {
            _id: new ObjectId(requestId),
            tenantId: new ObjectId(tenantId),
          },
        },
        {
          $lookup: {
            from: 'certificateTypes',
            localField: 'certificateTypeId',
            foreignField: '_id',
            as: 'certificateType',
          },
        },
        { $unwind: { path: '$certificateType', preserveNullAndEmptyArrays: true } },
      ])
      .toArray()) as WithId<CertificateRequestDocument>[];

    if (request.length === 0) {
      throw new ApiError('REQUEST_NOT_FOUND', 'Certificate request not found', 404);
    }

    return this.formatCertificateRequest(request[0]);
  }

  async approveCertificateRequest(
    tenantId: string,
    requestId: string,
    approvedBy: string,
    remarks?: string
  ) {
    const request = (await collections.certificateRequests.findOne({
      _id: new ObjectId(requestId),
      tenantId: new ObjectId(tenantId),
    })) as WithId<CertificateRequestDocument> | null;

    if (!request) {
      throw new ApiError('REQUEST_NOT_FOUND', 'Certificate request not found', 404);
    }

    if (request.status !== 'pending') {
      throw new ApiError('INVALID_STATUS', 'Only pending requests can be approved', 400);
    }

    const approval = {
      level: (request.approvals?.length || 0) + 1,
      approvedBy: new ObjectId(approvedBy),
      approvedAt: new Date(),
      remarks,
    };

    await collections.certificateRequests.updateOne({ _id: new ObjectId(requestId) }, {
      $set: {
        status: 'approved',
        updatedAt: new Date(),
      },
      $push: { approvals: approval },
    } as unknown as import('mongodb').UpdateFilter<Document>);

    logger.info({ requestId, tenantId }, 'Certificate request approved');

    return this.findCertificateRequestById(tenantId, requestId);
  }

  async rejectCertificateRequest(
    tenantId: string,
    requestId: string,
    _rejectedBy: string,
    reason: string
  ) {
    const request = (await collections.certificateRequests.findOne({
      _id: new ObjectId(requestId),
      tenantId: new ObjectId(tenantId),
    })) as WithId<CertificateRequestDocument> | null;

    if (!request) {
      throw new ApiError('REQUEST_NOT_FOUND', 'Certificate request not found', 404);
    }

    if (request.status !== 'pending') {
      throw new ApiError('INVALID_STATUS', 'Only pending requests can be rejected', 400);
    }

    await collections.certificateRequests.updateOne(
      { _id: new ObjectId(requestId) },
      {
        $set: {
          status: 'rejected',
          rejectionReason: reason,
          updatedAt: new Date(),
        },
      }
    );

    logger.info({ requestId, tenantId }, 'Certificate request rejected');

    return this.findCertificateRequestById(tenantId, requestId);
  }

  async issueCertificate(tenantId: string, requestId: string, issuedBy: string) {
    const request = (await collections.certificateRequests.findOne({
      _id: new ObjectId(requestId),
      tenantId: new ObjectId(tenantId),
    })) as WithId<CertificateRequestDocument> | null;

    if (!request) {
      throw new ApiError('REQUEST_NOT_FOUND', 'Certificate request not found', 404);
    }

    if (request.status !== 'approved') {
      throw new ApiError('INVALID_STATUS', 'Only approved requests can be issued', 400);
    }

    const now = new Date();

    await collections.certificateRequests.updateOne(
      { _id: new ObjectId(requestId) },
      {
        $set: {
          status: 'issued',
          issuedAt: now,
          issuedBy: new ObjectId(issuedBy),
          updatedAt: now,
        },
      }
    );

    logger.info({ requestId, tenantId }, 'Certificate issued');

    return this.findCertificateRequestById(tenantId, requestId);
  }

  // ============ ID Card Templates ============

  async createIdCardTemplate(
    tenantId: string,
    branchId: string | undefined,
    data: {
      name: string;
      category: 'student' | 'staff';
      frontTemplate: string;
      backTemplate?: string;
      dimensions: { width: number; height: number; unit: 'mm' | 'cm' | 'in' };
    },
    createdBy: string
  ) {
    const templateId = new ObjectId();
    const now = new Date();

    const template: Omit<IdCardTemplateDocument, '_id'> & { _id: ObjectId } = {
      _id: templateId,
      tenantId: new ObjectId(tenantId),
      branchId: branchId ? new ObjectId(branchId) : undefined,
      name: data.name,
      category: data.category,
      frontTemplate: data.frontTemplate,
      backTemplate: data.backTemplate,
      dimensions: data.dimensions,
      status: 'active',
      createdBy: new ObjectId(createdBy),
      createdAt: now,
      updatedAt: now,
    };

    await collections.idCardTemplates.insertOne(template);

    logger.info(
      { templateId: templateId.toString(), name: data.name, tenantId },
      'ID card template created'
    );

    return this.formatIdCardTemplate(template as WithId<IdCardTemplateDocument>);
  }

  async findAllIdCardTemplates(
    tenantId: string,
    branchId?: string,
    category?: 'student' | 'staff'
  ) {
    const filter: Filter<Document> = {
      tenantId: new ObjectId(tenantId),
      status: 'active',
      $or: [{ branchId: { $exists: false } }, { branchId: null }],
    };

    if (branchId) {
      filter.$or?.push({ branchId: new ObjectId(branchId) });
    }

    if (category) {
      filter.category = category;
    }

    const templates = (await collections.idCardTemplates
      .find(filter)
      .sort({ name: 1 })
      .toArray()) as WithId<IdCardTemplateDocument>[];

    return templates.map((t) => this.formatIdCardTemplate(t));
  }

  async generateIdCard(
    tenantId: string,
    _branchId: string,
    data: {
      templateId: string;
      entityId: string;
      entityType: 'student' | 'staff';
    }
  ) {
    // Get template
    const template = (await collections.idCardTemplates.findOne({
      _id: new ObjectId(data.templateId),
      tenantId: new ObjectId(tenantId),
    })) as WithId<IdCardTemplateDocument> | null;

    if (!template) {
      throw new ApiError('TEMPLATE_NOT_FOUND', 'ID card template not found', 404);
    }

    // Get entity data
    const collection = data.entityType === 'student' ? collections.students : collections.staff;
    const entity = await collection.findOne({
      _id: new ObjectId(data.entityId),
      tenantId: new ObjectId(tenantId),
    });

    if (!entity) {
      throw new ApiError('ENTITY_NOT_FOUND', `${data.entityType} not found`, 404);
    }

    // In a real implementation, this would generate a PDF/image
    // For now, return the template with entity data for frontend rendering
    return {
      template: {
        front: template.frontTemplate,
        back: template.backTemplate,
        dimensions: template.dimensions,
      },
      data: entity,
    };
  }

  // ============ Format Helpers ============

  private formatCertificateType(type: WithId<CertificateTypeDocument>) {
    return {
      _id: type._id.toString(),
      tenantId: type.tenantId.toString(),
      name: type.name,
      code: type.code,
      category: type.category,
      template: type.template,
      fields: type.fields,
      requiresApproval: type.requiresApproval,
      approvalLevels: type.approvalLevels,
      sequencePrefix: type.sequencePrefix,
      status: type.status,
      createdAt: type.createdAt,
      updatedAt: type.updatedAt,
    };
  }

  private formatCertificateRequest(request: WithId<CertificateRequestDocument>) {
    const formatted: Record<string, unknown> = {
      _id: request._id.toString(),
      tenantId: request.tenantId.toString(),
      branchId: request.branchId.toString(),
      certificateNumber: request.certificateNumber,
      certificateTypeId: request.certificateTypeId.toString(),
      category: request.category,
      requestorId: request.requestorId.toString(),
      requestorType: request.requestorType,
      purpose: request.purpose,
      fieldValues: request.fieldValues,
      status: request.status,
      approvals: request.approvals?.map((a) => ({
        ...a,
        approvedBy: a.approvedBy.toString(),
      })),
      rejectionReason: request.rejectionReason,
      issuedAt: request.issuedAt,
      issuedBy: request.issuedBy?.toString(),
      generatedDocument: request.generatedDocument,
      requestedBy: request.requestedBy.toString(),
      createdAt: request.createdAt,
      updatedAt: request.updatedAt,
    };

    // Add certificate type if joined
    const reqWithType = request as unknown as {
      certificateType?: { name: string; code: string };
    };
    if (reqWithType.certificateType) {
      formatted.certificateTypeName = reqWithType.certificateType.name;
      formatted.certificateTypeCode = reqWithType.certificateType.code;
    }

    return formatted;
  }

  private formatIdCardTemplate(template: WithId<IdCardTemplateDocument>) {
    return {
      _id: template._id.toString(),
      tenantId: template.tenantId.toString(),
      branchId: template.branchId?.toString(),
      name: template.name,
      category: template.category,
      frontTemplate: template.frontTemplate,
      backTemplate: template.backTemplate,
      dimensions: template.dimensions,
      status: template.status,
      createdAt: template.createdAt,
      updatedAt: template.updatedAt,
    };
  }

  async bulkGenerateIdCards(
    tenantId: string,
    branchId: string,
    data: {
      templateId: string;
      category: 'student' | 'staff';
      classId?: string;
      sectionId?: string;
      departmentId?: string;
      ids?: string[];
    },
    _generatedBy: string
  ) {
    const tenantObjId = new ObjectId(tenantId);
    const branchObjId = new ObjectId(branchId);
    const templateObjId = new ObjectId(data.templateId);

    // Verify template exists
    const template = await collections.idCardTemplates.findOne({
      _id: templateObjId,
      tenantId: tenantObjId,
      status: 'active',
    });

    if (!template) {
      throw new ApiError('TEMPLATE_NOT_FOUND', 'ID card template not found', 404);
    }

    let records: Array<{
      _id: ObjectId;
      displayName?: string;
      firstName?: string;
      lastName?: string;
    }> = [];

    if (data.category === 'student') {
      const filter: Filter<Document> = {
        tenantId: tenantObjId,
        branchId: branchObjId,
        status: 'active',
      };

      if (data.ids?.length) {
        filter._id = { $in: data.ids.map((id) => new ObjectId(id)) };
      } else {
        if (data.classId) {
          filter['currentEnrollment.classId'] = new ObjectId(data.classId);
        }
        if (data.sectionId) {
          filter['currentEnrollment.sectionId'] = new ObjectId(data.sectionId);
        }
      }

      records = (await collections.students
        .find(filter)
        .project({ _id: 1, displayName: 1, firstName: 1, lastName: 1 })
        .toArray()) as Array<{
        _id: ObjectId;
        displayName?: string;
        firstName?: string;
        lastName?: string;
      }>;
    } else {
      const filter: Filter<Document> = {
        tenantId: tenantObjId,
        branchId: branchObjId,
        status: 'active',
      };

      if (data.ids?.length) {
        filter._id = { $in: data.ids.map((id) => new ObjectId(id)) };
      } else if (data.departmentId) {
        filter['employment.departmentId'] = new ObjectId(data.departmentId);
      }

      records = (await collections.staff
        .find(filter)
        .project({ _id: 1, displayName: 1, firstName: 1, lastName: 1 })
        .toArray()) as Array<{
        _id: ObjectId;
        displayName?: string;
        firstName?: string;
        lastName?: string;
      }>;
    }

    if (records.length === 0) {
      return {
        hasData: false,
        message: `No ${data.category}s found matching the criteria`,
        generated: 0,
        failed: 0,
        cards: [],
      };
    }

    // In a real implementation, this would generate actual ID card files
    // For now, we return the list of records that would have ID cards generated
    const results = records.map((r) => ({
      id: r._id.toString(),
      name: r.displayName || `${r.firstName} ${r.lastName}`,
      status: 'queued' as const,
      message: 'ID card generation queued',
    }));

    logger.info(
      { tenantId, branchId, category: data.category, count: records.length },
      'Bulk ID card generation queued'
    );

    return {
      hasData: true,
      generated: records.length,
      failed: 0,
      message: `${records.length} ID cards queued for generation`,
      cards: results,
    };
  }

  // ============ Reports ============

  async getCertificateStats(tenantId: string, branchId: string) {
    const tenantObjId = new ObjectId(tenantId);
    const branchObjId = new ObjectId(branchId);

    const [byStatus, byCategory, byType, recentIssued] = await Promise.all([
      // Requests by status
      collections.certificateRequests
        .aggregate([
          { $match: { tenantId: tenantObjId, branchId: branchObjId } },
          { $group: { _id: '$status', count: { $sum: 1 } } },
        ])
        .toArray(),

      // Requests by category (student vs staff)
      collections.certificateRequests
        .aggregate([
          { $match: { tenantId: tenantObjId, branchId: branchObjId } },
          { $group: { _id: '$category', count: { $sum: 1 } } },
        ])
        .toArray(),

      // Requests by certificate type
      collections.certificateRequests
        .aggregate([
          { $match: { tenantId: tenantObjId, branchId: branchObjId } },
          {
            $lookup: {
              from: 'certificateTypes',
              localField: 'certificateTypeId',
              foreignField: '_id',
              as: 'type',
            },
          },
          { $unwind: { path: '$type', preserveNullAndEmptyArrays: true } },
          {
            $group: {
              _id: { typeId: '$certificateTypeId', typeName: '$type.name' },
              count: { $sum: 1 },
            },
          },
        ])
        .toArray(),

      // Recent issued certificates
      collections.certificateRequests
        .find({
          tenantId: tenantObjId,
          branchId: branchObjId,
          status: 'issued',
        })
        .sort({ issuedAt: -1 })
        .limit(10)
        .toArray(),
    ]);

    const statusStats: Record<string, number> = {};
    byStatus.forEach((s) => {
      statusStats[s._id as string] = s.count as number;
    });

    const categoryStats: Record<string, number> = {};
    byCategory.forEach((c) => {
      categoryStats[c._id as string] = c.count as number;
    });

    const typeStats = byType.map((t) => ({
      typeId: (t._id as { typeId: ObjectId }).typeId.toString(),
      typeName: (t._id as { typeName: string }).typeName || 'Unknown',
      count: t.count as number,
    }));

    return {
      summary: {
        total: Object.values(statusStats).reduce((a, b) => a + b, 0),
        pending: statusStats.pending || 0,
        approved: statusStats.approved || 0,
        rejected: statusStats.rejected || 0,
        issued: statusStats.issued || 0,
      },
      byCategory: categoryStats,
      byType: typeStats,
      recentIssued: (recentIssued as WithId<CertificateRequestDocument>[]).map((r) =>
        this.formatCertificateRequest(r)
      ),
    };
  }

  async getCertificateReport(
    tenantId: string,
    branchId: string,
    params: {
      fromDate?: string;
      toDate?: string;
      category?: string;
      typeId?: string;
      status?: string;
    }
  ) {
    const tenantObjId = new ObjectId(tenantId);
    const branchObjId = new ObjectId(branchId);

    const filter: Record<string, unknown> = {
      tenantId: tenantObjId,
      branchId: branchObjId,
    };

    if (params.fromDate || params.toDate) {
      filter.createdAt = {};
      if (params.fromDate) {
        (filter.createdAt as Record<string, Date>).$gte = new Date(params.fromDate);
      }
      if (params.toDate) {
        (filter.createdAt as Record<string, Date>).$lte = new Date(params.toDate);
      }
    }

    if (params.category) filter.category = params.category;
    if (params.typeId) filter.certificateTypeId = new ObjectId(params.typeId);
    if (params.status) filter.status = params.status;

    const [requests, dailyTrend] = await Promise.all([
      collections.certificateRequests
        .aggregate([
          { $match: filter },
          {
            $lookup: {
              from: 'certificateTypes',
              localField: 'certificateTypeId',
              foreignField: '_id',
              as: 'type',
            },
          },
          { $unwind: { path: '$type', preserveNullAndEmptyArrays: true } },
          { $sort: { createdAt: -1 } },
          { $limit: 100 },
        ])
        .toArray(),

      collections.certificateRequests
        .aggregate([
          { $match: filter },
          {
            $group: {
              _id: {
                $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
              },
              count: { $sum: 1 },
            },
          },
          { $sort: { _id: 1 } },
        ])
        .toArray(),
    ]);

    return {
      requests: (requests as WithId<CertificateRequestDocument>[]).map((r) =>
        this.formatCertificateRequest(r)
      ),
      dailyTrend: dailyTrend.map((d) => ({
        date: d._id as string,
        count: d.count as number,
      })),
    };
  }
}

export const certificateService = new CertificateService();
