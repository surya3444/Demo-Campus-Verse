import { ObjectId, WithId, Document } from 'mongodb';
import { collections } from '../../config/database';
import { logger } from '../../lib/logger';
import { ApiError } from '../../middleware/errorHandler';
import { generateSequence, padSequence } from '../../utils/generators';

// ============ Certificate Settings Document ============
interface CertificateSettingsDocument extends Document {
  _id: ObjectId;
  tenantId: ObjectId;
  branchId: ObjectId;

  // Certificate number sequence
  certificateSequence: {
    prefix: string;
    padding: number;
    includeYear: boolean;
    yearFormat: '2' | '4';
    separator: string;
    resetYearly: boolean;
  };

  // ID card sequence
  idCardSequence: {
    prefix: string;
    padding: number;
    includeYear: boolean;
    yearFormat: '2' | '4';
    separator: string;
    resetYearly: boolean;
  };

  // Default settings per certificate type
  certificateTypeDefaults: Array<{
    typeCode: string;
    requiresApproval: boolean;
    approvalRoles: string[];
    processingDays: number;
    fee: number;
    validityDays?: number;
  }>;

  // Staff certificate types
  staffCertificateTypes: Array<{
    code: string;
    name: string;
    description?: string;
    templateContent: string;
    requiresApproval: boolean;
    approvalRoles: string[];
    fee: number;
    isActive: boolean;
  }>;

  // General settings
  generalSettings: {
    allowSelfRequest: boolean;
    requirePayment: boolean;
    defaultProcessingDays: number;
    sendNotificationOnApproval: boolean;
    sendNotificationOnIssue: boolean;
    printCopies: number;
  };

  createdAt: Date;
  updatedAt: Date;
}

const DEFAULT_CERTIFICATE_SEQUENCE = {
  prefix: 'CERT',
  padding: 6,
  includeYear: true,
  yearFormat: '2' as const,
  separator: '-',
  resetYearly: true,
};

const DEFAULT_ID_CARD_SEQUENCE = {
  prefix: 'ID',
  padding: 6,
  includeYear: true,
  yearFormat: '2' as const,
  separator: '-',
  resetYearly: true,
};

const DEFAULT_STAFF_CERTIFICATE_TYPES = [
  {
    code: 'EXPERIENCE',
    name: 'Experience Certificate',
    description: 'Certificate confirming employment duration and experience',
    templateContent: `
      This is to certify that {employeeName} (Employee ID: {employeeId}) has worked with {organizationName}
      from {joiningDate} to {exitDate} as {designation} in {department} department.

      During their tenure, they have performed their duties satisfactorily.

      We wish them all the best for their future endeavors.
    `,
    requiresApproval: true,
    approvalRoles: ['HR_HEAD', 'BRANCH_ADMIN'],
    fee: 0,
    isActive: true,
  },
  {
    code: 'EMPLOYMENT',
    name: 'Employment Certificate',
    description: 'Certificate confirming current employment',
    templateContent: `
      This is to certify that {employeeName} (Employee ID: {employeeId}) is currently employed with
      {organizationName} as {designation} in {department} department since {joiningDate}.

      This certificate is issued upon request for {purpose}.
    `,
    requiresApproval: true,
    approvalRoles: ['HR_HEAD', 'BRANCH_ADMIN'],
    fee: 0,
    isActive: true,
  },
  {
    code: 'SALARY',
    name: 'Salary Certificate',
    description: 'Certificate confirming salary details',
    templateContent: `
      This is to certify that {employeeName} (Employee ID: {employeeId}) is employed with
      {organizationName} as {designation} and draws a monthly salary of Rs. {salary}/-.

      This certificate is issued upon request for {purpose}.
    `,
    requiresApproval: true,
    approvalRoles: ['HR_HEAD', 'FINANCE_HEAD', 'BRANCH_ADMIN'],
    fee: 0,
    isActive: true,
  },
  {
    code: 'SERVICE',
    name: 'Service Certificate',
    description: 'Certificate confirming service details',
    templateContent: `
      This is to certify that {employeeName} (Employee ID: {employeeId}) has been serving as
      {designation} at {organizationName} since {joiningDate}.

      Total service: {yearsOfService} years {monthsOfService} months.
    `,
    requiresApproval: true,
    approvalRoles: ['HR_HEAD', 'BRANCH_ADMIN'],
    fee: 0,
    isActive: true,
  },
  {
    code: 'NOC',
    name: 'No Objection Certificate',
    description: 'NOC for various purposes',
    templateContent: `
      This is to certify that {organizationName} has no objection to {employeeName} (Employee ID: {employeeId})
      {purpose}.

      This NOC is valid for {validityDays} days from the date of issue.
    `,
    requiresApproval: true,
    approvalRoles: ['BRANCH_ADMIN'],
    fee: 0,
    isActive: true,
  },
];

const DEFAULT_GENERAL_SETTINGS = {
  allowSelfRequest: true,
  requirePayment: false,
  defaultProcessingDays: 3,
  sendNotificationOnApproval: true,
  sendNotificationOnIssue: true,
  printCopies: 2,
};

class CertificateSettingsService {
  async getSettings(tenantId: string, branchId: string) {
    const branch = await collections.branches.findOne({
      _id: new ObjectId(branchId),
      tenantId: new ObjectId(tenantId),
    });

    if (!branch) {
      throw new ApiError('BRANCH_NOT_FOUND', 'Branch not found', 404);
    }

    let settings = (await collections.certificateSettings.findOne({
      branchId: new ObjectId(branchId),
      tenantId: new ObjectId(tenantId),
    })) as WithId<CertificateSettingsDocument> | null;

    if (!settings) {
      const now = new Date();
      const newSettings = {
        _id: new ObjectId(),
        branchId: new ObjectId(branchId),
        tenantId: new ObjectId(tenantId),
        certificateSequence: DEFAULT_CERTIFICATE_SEQUENCE,
        idCardSequence: DEFAULT_ID_CARD_SEQUENCE,
        certificateTypeDefaults: [],
        staffCertificateTypes: DEFAULT_STAFF_CERTIFICATE_TYPES,
        generalSettings: DEFAULT_GENERAL_SETTINGS,
        createdAt: now,
        updatedAt: now,
      } as CertificateSettingsDocument;

      await collections.certificateSettings.insertOne(newSettings);
      settings = newSettings as WithId<CertificateSettingsDocument>;
    }

    return this.formatSettings(settings);
  }

  async updateSettings(
    tenantId: string,
    branchId: string,
    data: Partial<{
      certificateSequence: Partial<CertificateSettingsDocument['certificateSequence']>;
      idCardSequence: Partial<CertificateSettingsDocument['idCardSequence']>;
      generalSettings: Partial<CertificateSettingsDocument['generalSettings']>;
    }>,
    updatedBy: string
  ) {
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (data.certificateSequence) {
      Object.entries(data.certificateSequence).forEach(([key, value]) => {
        if (value !== undefined) {
          updateData[`certificateSequence.${key}`] = value;
        }
      });
    }

    if (data.idCardSequence) {
      Object.entries(data.idCardSequence).forEach(([key, value]) => {
        if (value !== undefined) {
          updateData[`idCardSequence.${key}`] = value;
        }
      });
    }

    if (data.generalSettings) {
      Object.entries(data.generalSettings).forEach(([key, value]) => {
        if (value !== undefined) {
          updateData[`generalSettings.${key}`] = value;
        }
      });
    }

    const result = await collections.certificateSettings.findOneAndUpdate(
      {
        branchId: new ObjectId(branchId),
        tenantId: new ObjectId(tenantId),
      },
      {
        $set: updateData,
        $setOnInsert: {
          branchId: new ObjectId(branchId),
          tenantId: new ObjectId(tenantId),
          certificateTypeDefaults: [],
          staffCertificateTypes: DEFAULT_STAFF_CERTIFICATE_TYPES,
          createdAt: new Date(),
        },
      },
      { upsert: true, returnDocument: 'after' }
    );

    logger.info({ branchId, tenantId, updatedBy }, 'Certificate settings updated');

    return this.formatSettings(result as unknown as WithId<CertificateSettingsDocument>);
  }

  // ============ Staff Certificate Types ============
  async addStaffCertificateType(
    tenantId: string,
    branchId: string,
    certType: CertificateSettingsDocument['staffCertificateTypes'][0],
    addedBy: string
  ) {
    const existingSettings = await collections.certificateSettings.findOne({
      branchId: new ObjectId(branchId),
      tenantId: new ObjectId(tenantId),
      'staffCertificateTypes.code': certType.code,
    });

    if (existingSettings) {
      throw new ApiError('DUPLICATE_CERT_TYPE', 'Staff certificate type with this code already exists', 409);
    }

    const result = await collections.certificateSettings.findOneAndUpdate(
      { branchId: new ObjectId(branchId), tenantId: new ObjectId(tenantId) },
      {
        $push: { staffCertificateTypes: certType } as unknown,
        $set: { updatedAt: new Date() },
        $setOnInsert: {
          branchId: new ObjectId(branchId),
          tenantId: new ObjectId(tenantId),
          certificateSequence: DEFAULT_CERTIFICATE_SEQUENCE,
          idCardSequence: DEFAULT_ID_CARD_SEQUENCE,
          certificateTypeDefaults: [],
          generalSettings: DEFAULT_GENERAL_SETTINGS,
          createdAt: new Date(),
        },
      } as Document,
      { upsert: true, returnDocument: 'after' }
    );

    logger.info({ branchId, tenantId, certType: certType.code, addedBy }, 'Staff certificate type added');

    return this.formatSettings(result as unknown as WithId<CertificateSettingsDocument>);
  }

  async updateStaffCertificateType(
    tenantId: string,
    branchId: string,
    typeCode: string,
    data: Partial<CertificateSettingsDocument['staffCertificateTypes'][0]>,
    updatedBy: string
  ) {
    const updateFields: Record<string, unknown> = { updatedAt: new Date() };

    if (data.name !== undefined) updateFields['staffCertificateTypes.$.name'] = data.name;
    if (data.description !== undefined) updateFields['staffCertificateTypes.$.description'] = data.description;
    if (data.templateContent !== undefined)
      updateFields['staffCertificateTypes.$.templateContent'] = data.templateContent;
    if (data.requiresApproval !== undefined)
      updateFields['staffCertificateTypes.$.requiresApproval'] = data.requiresApproval;
    if (data.approvalRoles !== undefined)
      updateFields['staffCertificateTypes.$.approvalRoles'] = data.approvalRoles;
    if (data.fee !== undefined) updateFields['staffCertificateTypes.$.fee'] = data.fee;
    if (data.isActive !== undefined) updateFields['staffCertificateTypes.$.isActive'] = data.isActive;

    const result = await collections.certificateSettings.findOneAndUpdate(
      {
        branchId: new ObjectId(branchId),
        tenantId: new ObjectId(tenantId),
        'staffCertificateTypes.code': typeCode,
      },
      { $set: updateFields },
      { returnDocument: 'after' }
    );

    if (!result) {
      throw new ApiError('CERT_TYPE_NOT_FOUND', 'Staff certificate type not found', 404);
    }

    logger.info({ branchId, tenantId, typeCode, updatedBy }, 'Staff certificate type updated');

    return this.formatSettings(result as unknown as WithId<CertificateSettingsDocument>);
  }

  async deleteStaffCertificateType(tenantId: string, branchId: string, typeCode: string, deletedBy: string) {
    const result = await collections.certificateSettings.findOneAndUpdate(
      { branchId: new ObjectId(branchId), tenantId: new ObjectId(tenantId) },
      {
        $pull: { staffCertificateTypes: { code: typeCode } } as unknown,
        $set: { updatedAt: new Date() },
      } as Document,
      { returnDocument: 'after' }
    );

    if (!result) {
      throw new ApiError('SETTINGS_NOT_FOUND', 'Certificate settings not found', 404);
    }

    logger.info({ branchId, tenantId, typeCode, deletedBy }, 'Staff certificate type deleted');

    return this.formatSettings(result as unknown as WithId<CertificateSettingsDocument>);
  }

  // ============ Generate Numbers ============
  async generateCertificateNumber(tenantId: string, branchId: string): Promise<string> {
    const settings = await this.getSettings(tenantId, branchId);
    const seq = settings.certificateSequence;

    const sequenceType = seq.resetYearly ? `certificate_${new Date().getFullYear()}` : 'certificate';
    const sequence = await generateSequence(sequenceType, tenantId, branchId);

    let certNumber = seq.prefix;
    if (seq.separator) certNumber += seq.separator;
    if (seq.includeYear) {
      const year = seq.yearFormat === '2'
        ? new Date().getFullYear().toString().slice(-2)
        : new Date().getFullYear().toString();
      certNumber += year;
      if (seq.separator) certNumber += seq.separator;
    }
    certNumber += padSequence(sequence, seq.padding);

    return certNumber;
  }

  async generateIdCardNumber(tenantId: string, branchId: string): Promise<string> {
    const settings = await this.getSettings(tenantId, branchId);
    const seq = settings.idCardSequence;

    const sequenceType = seq.resetYearly ? `idcard_${new Date().getFullYear()}` : 'idcard';
    const sequence = await generateSequence(sequenceType, tenantId, branchId);

    let idCardNumber = seq.prefix;
    if (seq.separator) idCardNumber += seq.separator;
    if (seq.includeYear) {
      const year = seq.yearFormat === '2'
        ? new Date().getFullYear().toString().slice(-2)
        : new Date().getFullYear().toString();
      idCardNumber += year;
      if (seq.separator) idCardNumber += seq.separator;
    }
    idCardNumber += padSequence(sequence, seq.padding);

    return idCardNumber;
  }

  private formatSettings(settings: WithId<CertificateSettingsDocument>) {
    return {
      _id: settings._id.toString(),
      branchId: settings.branchId.toString(),
      tenantId: settings.tenantId.toString(),
      certificateSequence: settings.certificateSequence || DEFAULT_CERTIFICATE_SEQUENCE,
      idCardSequence: settings.idCardSequence || DEFAULT_ID_CARD_SEQUENCE,
      certificateTypeDefaults: settings.certificateTypeDefaults || [],
      staffCertificateTypes: settings.staffCertificateTypes || DEFAULT_STAFF_CERTIFICATE_TYPES,
      generalSettings: settings.generalSettings || DEFAULT_GENERAL_SETTINGS,
      createdAt: settings.createdAt,
      updatedAt: settings.updatedAt,
    };
  }
}

export const certificateSettingsService = new CertificateSettingsService();
