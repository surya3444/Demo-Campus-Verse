import { ObjectId, WithId, Document } from 'mongodb';
import { collections } from '../../config/database';
import { logger } from '../../lib/logger';
import { ApiError } from '../../middleware/errorHandler';
import {
  SYSTEM_ENQUIRY_STAGES,
  TERMINAL_ENQUIRY_STAGES,
  LOCKED_STAGE_CODES,
} from '@campus-verse/shared/constants';

// ============ Settings Types ============
interface NumberSequenceSettings {
  prefix: string;
  suffix?: string;
  startingNumber: number;
  currentNumber: number;
  padding: number; // number of digits to pad
  includeYear: boolean;
  yearFormat: '2' | '4'; // YY or YYYY
  separator?: string;
  resetYearly: boolean;
}

interface AdmissionSettingsDocument extends Document {
  _id: ObjectId;
  tenantId: ObjectId;
  branchId: ObjectId;

  // Number sequences
  applicationNumber: NumberSequenceSettings;
  admissionNumber: NumberSequenceSettings;
  leadCode: NumberSequenceSettings;
  enrollmentCode: NumberSequenceSettings;
  taskNumber: NumberSequenceSettings;
  sourceCode: NumberSequenceSettings;
  agentCode: NumberSequenceSettings;

  // Enquiry/Pipeline stages
  enquiryStages: Array<{
    code: string;
    name: string;
    order: number;
    color: string;
    isDefault?: boolean;
    isTerminal?: boolean;
  }>;

  // Application fee settings
  applicationFee: {
    enabled: boolean;
    amount: number;
    currency: string;
    paymentModes: string[];
    exemptCategories?: string[];
  };

  // Required fields for admission form
  requiredFields: {
    student: string[];
    parents: string[];
    documents: string[];
    previousEducation: string[];
  };

  // Document types required
  documentTypes: Array<{
    code: string;
    name: string;
    required: boolean;
    category?: string;
  }>;

  // Web form configuration
  webForms: {
    enquiry: {
      enabled: boolean;
      title: string;
      description?: string;
      fields: Array<{
        fieldKey: string;
        label: string;
        type: 'text' | 'email' | 'phone' | 'select' | 'date' | 'textarea';
        required: boolean;
        options?: string[]; // for select type
        order: number;
      }>;
      thankYouMessage: string;
      notifyEmails?: string[];
    };
    application: {
      enabled: boolean;
      title: string;
      description?: string;
      fields: Array<{
        fieldKey: string;
        label: string;
        type: 'text' | 'email' | 'phone' | 'select' | 'date' | 'textarea' | 'file';
        required: boolean;
        options?: string[];
        order: number;
      }>;
      requirePayment: boolean;
      thankYouMessage: string;
      notifyEmails?: string[];
    };
  };

  createdAt: Date;
  updatedAt: Date;
}

// ============ Source Types ============
interface AdmissionSourceDocument extends Document {
  _id: ObjectId;
  tenantId: ObjectId;
  branchId?: ObjectId;
  code: string;
  name: string;
  description?: string;
  category: 'organic' | 'referral' | 'marketing' | 'agent' | 'other';
  isActive: boolean;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

// ============ Agent Types ============
interface AdmissionAgentDocument extends Document {
  _id: ObjectId;
  tenantId: ObjectId;
  branchId?: ObjectId;
  code: string;
  name: string;
  email?: string;
  phone: string;
  address?: {
    street?: string;
    city: string;
    state: string;
    pincode?: string;
  };
  commissionType: 'percentage' | 'fixed';
  commissionValue: number;
  bankDetails?: {
    accountName: string;
    accountNumber: string;
    bankName: string;
    ifscCode: string;
  };
  isActive: boolean;
  totalLeads: number;
  totalConversions: number;
  totalCommissionPaid: number;
  createdAt: Date;
  updatedAt: Date;
}

// ============ Default Settings ============
const DEFAULT_SETTINGS: Omit<
  AdmissionSettingsDocument,
  '_id' | 'tenantId' | 'branchId' | 'createdAt' | 'updatedAt'
> = {
  applicationNumber: {
    prefix: 'APP',
    startingNumber: 1,
    currentNumber: 0,
    padding: 5,
    includeYear: true,
    yearFormat: '2',
    resetYearly: true,
  },
  admissionNumber: {
    prefix: 'ADM',
    startingNumber: 1,
    currentNumber: 0,
    padding: 5,
    includeYear: true,
    yearFormat: '2',
    resetYearly: true,
  },
  leadCode: {
    prefix: 'LEAD',
    startingNumber: 1,
    currentNumber: 0,
    padding: 4,
    includeYear: true,
    yearFormat: '4',
    resetYearly: true,
  },
  enrollmentCode: {
    prefix: 'ENR',
    startingNumber: 1,
    currentNumber: 0,
    padding: 5,
    includeYear: true,
    yearFormat: '2',
    resetYearly: false,
  },
  taskNumber: {
    prefix: 'TASK',
    startingNumber: 1,
    currentNumber: 0,
    padding: 4,
    includeYear: true,
    yearFormat: '4',
    separator: '-',
    resetYearly: true,
  },
  sourceCode: {
    prefix: 'SRC',
    startingNumber: 1,
    currentNumber: 0,
    padding: 3,
    includeYear: false,
    yearFormat: '2',
    resetYearly: false,
  },
  agentCode: {
    prefix: 'AGT',
    startingNumber: 1,
    currentNumber: 0,
    padding: 3,
    includeYear: false,
    yearFormat: '2',
    resetYearly: false,
  },
  enquiryStages: [
    { code: 'new', name: 'New', order: 1, color: '#64748b', isDefault: true },
    { code: 'contacted', name: 'Contacted', order: 2, color: '#3b82f6' },
    { code: 'interested', name: 'Interested', order: 3, color: '#8b5cf6' },
    { code: 'followup', name: 'Follow-up', order: 4, color: '#f59e0b' },
    { code: 'visit_scheduled', name: 'Visit Scheduled', order: 5, color: '#06b6d4' },
    { code: 'visited', name: 'Visited', order: 6, color: '#10b981' },
    { code: 'converted', name: 'Converted', order: 7, color: '#22c55e', isTerminal: true },
    { code: 'lost', name: 'Lost', order: 8, color: '#ef4444', isTerminal: true },
  ],
  applicationFee: {
    enabled: false,
    amount: 0,
    currency: 'INR',
    paymentModes: ['cash', 'upi', 'card'],
  },
  requiredFields: {
    student: ['firstName', 'lastName', 'dateOfBirth', 'gender'],
    parents: ['father.name', 'father.phone'],
    documents: [],
    previousEducation: [],
  },
  documentTypes: [
    { code: 'birth_certificate', name: 'Birth Certificate', required: true, category: 'identity' },
    { code: 'aadhar_card', name: 'Aadhar Card', required: true, category: 'identity' },
    { code: 'previous_tc', name: 'Transfer Certificate', required: false, category: 'academic' },
    { code: 'marksheet', name: 'Previous Marksheet', required: false, category: 'academic' },
    { code: 'photo', name: 'Passport Photo', required: true, category: 'other' },
  ],
  webForms: {
    enquiry: {
      enabled: false,
      title: 'Enquiry Form',
      description: 'Submit your enquiry for admission',
      fields: [
        { fieldKey: 'studentName', label: 'Student Name', type: 'text', required: true, order: 1 },
        {
          fieldKey: 'parentName',
          label: 'Parent/Guardian Name',
          type: 'text',
          required: true,
          order: 2,
        },
        { fieldKey: 'phone', label: 'Contact Number', type: 'phone', required: true, order: 3 },
        { fieldKey: 'email', label: 'Email Address', type: 'email', required: false, order: 4 },
        {
          fieldKey: 'class',
          label: 'Class Interested In',
          type: 'select',
          required: true,
          options: [],
          order: 5,
        },
        { fieldKey: 'message', label: 'Message', type: 'textarea', required: false, order: 6 },
      ],
      thankYouMessage: 'Thank you for your enquiry. We will contact you soon.',
      notifyEmails: [],
    },
    application: {
      enabled: false,
      title: 'Admission Application',
      description: 'Apply for admission',
      fields: [
        { fieldKey: 'studentName', label: 'Student Name', type: 'text', required: true, order: 1 },
        { fieldKey: 'dateOfBirth', label: 'Date of Birth', type: 'date', required: true, order: 2 },
        {
          fieldKey: 'parentName',
          label: 'Parent/Guardian Name',
          type: 'text',
          required: true,
          order: 3,
        },
        { fieldKey: 'phone', label: 'Contact Number', type: 'phone', required: true, order: 4 },
        { fieldKey: 'email', label: 'Email Address', type: 'email', required: true, order: 5 },
        { fieldKey: 'address', label: 'Address', type: 'textarea', required: true, order: 6 },
        {
          fieldKey: 'class',
          label: 'Class Applying For',
          type: 'select',
          required: true,
          options: [],
          order: 7,
        },
        {
          fieldKey: 'previousSchool',
          label: 'Previous School',
          type: 'text',
          required: false,
          order: 8,
        },
      ],
      requirePayment: false,
      thankYouMessage: 'Thank you for your application. We will review and contact you soon.',
      notifyEmails: [],
    },
  },
};

const DEFAULT_SOURCES: Omit<
  AdmissionSourceDocument,
  '_id' | 'tenantId' | 'branchId' | 'createdAt' | 'updatedAt'
>[] = [
  { code: 'walk_in', name: 'Walk-in', category: 'organic', isActive: true, order: 1 },
  { code: 'website', name: 'Website', category: 'organic', isActive: true, order: 2 },
  { code: 'referral', name: 'Referral', category: 'referral', isActive: true, order: 3 },
  { code: 'social_media', name: 'Social Media', category: 'marketing', isActive: true, order: 4 },
  { code: 'advertisement', name: 'Advertisement', category: 'marketing', isActive: true, order: 5 },
  { code: 'event', name: 'Event/Fair', category: 'marketing', isActive: true, order: 6 },
  { code: 'agent', name: 'Agent', category: 'agent', isActive: true, order: 7 },
  { code: 'other', name: 'Other', category: 'other', isActive: true, order: 99 },
];

class AdmissionSettingsService {
  // ============ Settings CRUD ============
  async getSettings(tenantId: string, branchId: string) {
    let settings = (await collections.admissionSettings.findOne({
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
    })) as WithId<AdmissionSettingsDocument> | null;

    if (!settings) {
      settings = await this.createDefaultSettings(tenantId, branchId);
    }

    // Self-heal: ensure every system + terminal stage exists with the
    // correct order. Older tenants may have different ordering or may be
    // missing stages added later (like "applied", "enrolled").
    const allSystemStages = [...SYSTEM_ENQUIRY_STAGES, ...TERMINAL_ENQUIRY_STAGES];
    const lockedOrderByCode = new Map<string, number>(
      allSystemStages.map((s) => [s.code, s.order])
    );
    const existingStages = (settings.enquiryStages as Array<Record<string, unknown>>) || [];
    const existingCodes = new Set(existingStages.map((s) => s.code as string));

    const missingStages = allSystemStages.filter((s) => !existingCodes.has(s.code));

    // Fix order of existing locked stages + insert missing ones
    let needsPatch = missingStages.length > 0;
    const patched = existingStages.map((s) => {
      const lockedOrder = lockedOrderByCode.get(s.code as string);
      if (lockedOrder !== undefined && s.order !== lockedOrder) {
        needsPatch = true;
        return { ...s, order: lockedOrder };
      }
      return s;
    });
    // Insert any missing stages
    for (const s of missingStages) {
      patched.push({ ...s });
    }

    if (needsPatch) {
      patched.sort((a, b) => ((a.order as number) || 0) - ((b.order as number) || 0));
      await collections.admissionSettings.updateOne(
        { _id: settings._id },
        { $set: { enquiryStages: patched, updatedAt: new Date() } }
      );
      (settings as Record<string, unknown>).enquiryStages = patched;
      logger.info(
        { tenantId, branchId, added: missingStages.map((s) => s.code) },
        'Auto-healed enquiry stages (inserted missing / fixed order)'
      );
    }

    return this.formatSettings(settings);
  }

  async updateSettings(
    tenantId: string,
    branchId: string,
    data: Partial<AdmissionSettingsDocument>,
    updatedBy: string
  ) {
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    // Update number sequences
    if (data.applicationNumber) {
      Object.entries(data.applicationNumber).forEach(([key, value]) => {
        updateData[`applicationNumber.${key}`] = value;
      });
    }
    if (data.admissionNumber) {
      Object.entries(data.admissionNumber).forEach(([key, value]) => {
        updateData[`admissionNumber.${key}`] = value;
      });
    }
    if (data.leadCode) {
      Object.entries(data.leadCode).forEach(([key, value]) => {
        updateData[`leadCode.${key}`] = value;
      });
    }
    if (data.enrollmentCode) {
      Object.entries(data.enrollmentCode).forEach(([key, value]) => {
        updateData[`enrollmentCode.${key}`] = value;
      });
    }
    if (data.taskNumber) {
      Object.entries(data.taskNumber).forEach(([key, value]) => {
        updateData[`taskNumber.${key}`] = value;
      });
    }
    if (data.sourceCode) {
      Object.entries(data.sourceCode).forEach(([key, value]) => {
        updateData[`sourceCode.${key}`] = value;
      });
    }
    if (data.agentCode) {
      Object.entries(data.agentCode).forEach(([key, value]) => {
        updateData[`agentCode.${key}`] = value;
      });
    }

    // Update other settings
    if (data.enquiryStages) {
      // Validate that ALL system/terminal stages are still present.
      // Users can add/remove/reorder custom stages freely, but the locked
      // stages must always exist.
      const incomingCodes = new Set(
        (data.enquiryStages as Array<{ code: string }>).map((s) => s.code)
      );
      for (const code of LOCKED_STAGE_CODES) {
        if (!incomingCodes.has(code)) {
          throw new ApiError(
            'CANNOT_REMOVE_DEFAULT_STAGE',
            `The "${code}" stage is a default stage and cannot be removed.`,
            400
          );
        }
      }
      updateData.enquiryStages = data.enquiryStages;
    }
    if (data.applicationFee) updateData.applicationFee = data.applicationFee;
    if (data.requiredFields) updateData.requiredFields = data.requiredFields;
    if (data.documentTypes) updateData.documentTypes = data.documentTypes;
    if (data.webForms) updateData.webForms = data.webForms;

    // Build $setOnInsert that excludes any top-level key already being $set.
    // MongoDB throws "would create a conflict" if the same path appears in
    // both operators — e.g. $set has "applicationNumber.prefix" and
    // $setOnInsert has the full "applicationNumber" object.
    const setKeys = new Set(Object.keys(updateData).map((k) => k.split('.')[0]));
    const safeInsertDefaults: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
      if (!setKeys.has(key)) {
        safeInsertDefaults[key] = value;
      }
    }

    const result = await collections.admissionSettings.findOneAndUpdate(
      {
        tenantId: new ObjectId(tenantId),
        branchId: new ObjectId(branchId),
      },
      {
        $set: updateData,
        $setOnInsert: {
          ...safeInsertDefaults,
          tenantId: new ObjectId(tenantId),
          branchId: new ObjectId(branchId),
          createdAt: new Date(),
        },
      },
      { upsert: true, returnDocument: 'after' }
    );

    logger.info({ tenantId, branchId, updatedBy }, 'Admission settings updated');

    return this.formatSettings(result as WithId<AdmissionSettingsDocument>);
  }

  async generateNumber(
    tenantId: string,
    branchId: string,
    type:
      | 'applicationNumber'
      | 'admissionNumber'
      | 'leadCode'
      | 'enrollmentCode'
      | 'taskNumber'
      | 'sourceCode'
      | 'agentCode'
  ): Promise<string> {
    const settings = await this.getSettings(tenantId, branchId);
    const sequence = settings[type];

    // Increment counter
    const result = await collections.admissionSettings.findOneAndUpdate(
      {
        tenantId: new ObjectId(tenantId),
        branchId: new ObjectId(branchId),
      },
      { $inc: { [`${type}.currentNumber`]: 1 } },
      { returnDocument: 'after' }
    );

    const updatedSequence = (result as WithId<AdmissionSettingsDocument>)[type];
    const number = updatedSequence.currentNumber || 1;

    // Build the number string
    let generatedNumber = sequence.prefix;

    if (sequence.separator) generatedNumber += sequence.separator;

    if (sequence.includeYear) {
      const year = new Date().getFullYear();
      const yearStr = sequence.yearFormat === '4' ? year.toString() : year.toString().slice(-2);
      generatedNumber += yearStr;
      if (sequence.separator) generatedNumber += sequence.separator;
    }

    generatedNumber += String(number).padStart(sequence.padding, '0');

    if (sequence.suffix) {
      if (sequence.separator) generatedNumber += sequence.separator;
      generatedNumber += sequence.suffix;
    }

    return generatedNumber;
  }

  private async createDefaultSettings(tenantId: string, branchId: string) {
    const now = new Date();
    const settings = {
      _id: new ObjectId(),
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
      applicationNumber: DEFAULT_SETTINGS.applicationNumber,
      admissionNumber: DEFAULT_SETTINGS.admissionNumber,
      leadCode: DEFAULT_SETTINGS.leadCode,
      enrollmentCode: DEFAULT_SETTINGS.enrollmentCode,
      taskNumber: DEFAULT_SETTINGS.taskNumber,
      sourceCode: DEFAULT_SETTINGS.sourceCode,
      agentCode: DEFAULT_SETTINGS.agentCode,
      enquiryStages: DEFAULT_SETTINGS.enquiryStages,
      applicationFee: DEFAULT_SETTINGS.applicationFee,
      requiredFields: DEFAULT_SETTINGS.requiredFields,
      documentTypes: DEFAULT_SETTINGS.documentTypes,
      webForms: DEFAULT_SETTINGS.webForms,
      createdAt: now,
      updatedAt: now,
    } as AdmissionSettingsDocument;

    await collections.admissionSettings.insertOne(settings);

    // Also create default sources
    await this.createDefaultSources(tenantId, branchId);

    return settings as WithId<AdmissionSettingsDocument>;
  }

  private formatSettings(settings: WithId<AdmissionSettingsDocument>) {
    return {
      _id: settings._id.toString(),
      tenantId: settings.tenantId.toString(),
      branchId: settings.branchId.toString(),
      applicationNumber: settings.applicationNumber,
      admissionNumber: settings.admissionNumber,
      leadCode: settings.leadCode,
      enrollmentCode: settings.enrollmentCode,
      taskNumber: settings.taskNumber,
      sourceCode: settings.sourceCode || DEFAULT_SETTINGS.sourceCode,
      agentCode: settings.agentCode || DEFAULT_SETTINGS.agentCode,
      enquiryStages: settings.enquiryStages,
      applicationFee: settings.applicationFee,
      requiredFields: settings.requiredFields,
      documentTypes: settings.documentTypes,
      webForms: settings.webForms,
      createdAt: settings.createdAt,
      updatedAt: settings.updatedAt,
    };
  }

  // ============ Sources CRUD ============
  async getSources(tenantId: string, branchId?: string) {
    const filter: Record<string, unknown> = {
      tenantId: new ObjectId(tenantId),
    };

    if (branchId) {
      filter.$or = [{ branchId: new ObjectId(branchId) }, { branchId: { $exists: false } }];
    }

    const sources = (await collections.admissionSources
      .find(filter)
      .sort({ order: 1 })
      .toArray()) as WithId<AdmissionSourceDocument>[];

    return sources.map(this.formatSource);
  }

  async createSource(
    tenantId: string,
    branchId: string | null,
    data: {
      code?: string; // Optional - will be auto-generated if not provided
      name: string;
      description?: string;
      category: 'organic' | 'referral' | 'marketing' | 'agent' | 'other';
    },
    createdBy: string
  ) {
    // Generate code if not provided
    const code =
      data.code || (await this.generateNumber(tenantId, branchId || tenantId, 'sourceCode'));

    // Check for duplicate code
    const existing = await collections.admissionSources.findOne({
      tenantId: new ObjectId(tenantId),
      code: code,
    });

    if (existing) {
      throw new ApiError('DUPLICATE_SOURCE', 'Source with this code already exists', 400);
    }

    // Get max order
    const maxOrder = await collections.admissionSources
      .find({ tenantId: new ObjectId(tenantId) })
      .sort({ order: -1 })
      .limit(1)
      .toArray();

    const now = new Date();
    const source: AdmissionSourceDocument = {
      _id: new ObjectId(),
      tenantId: new ObjectId(tenantId),
      branchId: branchId ? new ObjectId(branchId) : undefined,
      code: code,
      name: data.name,
      description: data.description,
      category: data.category,
      isActive: true,
      order: maxOrder.length > 0 ? (maxOrder[0] as AdmissionSourceDocument).order + 1 : 1,
      createdAt: now,
      updatedAt: now,
    };

    await collections.admissionSources.insertOne(source);

    logger.info(
      { sourceId: source._id.toString(), tenantId, createdBy },
      'Admission source created'
    );

    return this.formatSource(source as WithId<AdmissionSourceDocument>);
  }

  async updateSource(
    tenantId: string,
    sourceId: string,
    data: Partial<AdmissionSourceDocument>,
    updatedBy: string
  ) {
    const existing = await collections.admissionSources.findOne({
      _id: new ObjectId(sourceId),
      tenantId: new ObjectId(tenantId),
    });

    if (!existing) {
      throw new ApiError('SOURCE_NOT_FOUND', 'Source not found', 404);
    }

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.category !== undefined) updateData.category = data.category;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.order !== undefined) updateData.order = data.order;

    const result = await collections.admissionSources.findOneAndUpdate(
      { _id: new ObjectId(sourceId) },
      { $set: updateData },
      { returnDocument: 'after' }
    );

    logger.info({ sourceId, tenantId, updatedBy }, 'Admission source updated');

    return this.formatSource(result as WithId<AdmissionSourceDocument>);
  }

  async deleteSource(tenantId: string, sourceId: string, deletedBy: string) {
    const result = await collections.admissionSources.deleteOne({
      _id: new ObjectId(sourceId),
      tenantId: new ObjectId(tenantId),
    });

    if (result.deletedCount === 0) {
      throw new ApiError('SOURCE_NOT_FOUND', 'Source not found', 404);
    }

    logger.info({ sourceId, tenantId, deletedBy }, 'Admission source deleted');

    return { success: true };
  }

  private async createDefaultSources(tenantId: string, branchId: string) {
    const now = new Date();
    const sources = DEFAULT_SOURCES.map((s, index) => ({
      ...s,
      _id: new ObjectId(),
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
      order: index + 1,
      createdAt: now,
      updatedAt: now,
    }));

    await collections.admissionSources.insertMany(sources);
  }

  private formatSource(source: WithId<AdmissionSourceDocument>) {
    return {
      _id: source._id.toString(),
      tenantId: source.tenantId.toString(),
      branchId: source.branchId?.toString(),
      code: source.code,
      name: source.name,
      description: source.description,
      category: source.category,
      isActive: source.isActive,
      order: source.order,
      createdAt: source.createdAt,
      updatedAt: source.updatedAt,
    };
  }

  // ============ Agents CRUD ============
  async getAgents(
    tenantId: string,
    branchId?: string,
    params: { isActive?: boolean; search?: string } = {}
  ) {
    const filter: Record<string, unknown> = {
      tenantId: new ObjectId(tenantId),
    };

    if (branchId) {
      filter.$or = [{ branchId: new ObjectId(branchId) }, { branchId: { $exists: false } }];
    }

    if (params.isActive !== undefined) {
      filter.isActive = params.isActive;
    }

    if (params.search) {
      filter.$or = [
        { name: { $regex: params.search, $options: 'i' } },
        { code: { $regex: params.search, $options: 'i' } },
        { phone: { $regex: params.search, $options: 'i' } },
      ];
    }

    const agents = (await collections.admissionAgents
      .find(filter)
      .sort({ name: 1 })
      .toArray()) as WithId<AdmissionAgentDocument>[];

    return agents.map(this.formatAgent);
  }

  async getAgent(tenantId: string, agentId: string) {
    const agent = (await collections.admissionAgents.findOne({
      _id: new ObjectId(agentId),
      tenantId: new ObjectId(tenantId),
    })) as WithId<AdmissionAgentDocument> | null;

    if (!agent) {
      throw new ApiError('AGENT_NOT_FOUND', 'Agent not found', 404);
    }

    return this.formatAgent(agent);
  }

  async createAgent(
    tenantId: string,
    branchId: string | null,
    data: {
      code?: string; // Optional - will be auto-generated if not provided
      name: string;
      email?: string;
      phone: string;
      address?: {
        street?: string;
        city: string;
        state: string;
        pincode?: string;
      };
      commissionType: 'percentage' | 'fixed';
      commissionValue: number;
      bankDetails?: {
        accountName: string;
        accountNumber: string;
        bankName: string;
        ifscCode: string;
      };
    },
    createdBy: string
  ) {
    // Generate code if not provided
    const code =
      data.code || (await this.generateNumber(tenantId, branchId || tenantId, 'agentCode'));

    // Check for duplicate code
    const existing = await collections.admissionAgents.findOne({
      tenantId: new ObjectId(tenantId),
      code: code,
    });

    if (existing) {
      throw new ApiError('DUPLICATE_AGENT', 'Agent with this code already exists', 400);
    }

    const now = new Date();
    const agent: AdmissionAgentDocument = {
      _id: new ObjectId(),
      tenantId: new ObjectId(tenantId),
      branchId: branchId ? new ObjectId(branchId) : undefined,
      code: code,
      name: data.name,
      email: data.email,
      phone: data.phone,
      address: data.address,
      commissionType: data.commissionType,
      commissionValue: data.commissionValue,
      bankDetails: data.bankDetails,
      isActive: true,
      totalLeads: 0,
      totalConversions: 0,
      totalCommissionPaid: 0,
      createdAt: now,
      updatedAt: now,
    };

    await collections.admissionAgents.insertOne(agent);

    logger.info({ agentId: agent._id.toString(), tenantId, createdBy }, 'Admission agent created');

    return this.formatAgent(agent as WithId<AdmissionAgentDocument>);
  }

  async updateAgent(
    tenantId: string,
    agentId: string,
    data: Partial<AdmissionAgentDocument>,
    updatedBy: string
  ) {
    const existing = await collections.admissionAgents.findOne({
      _id: new ObjectId(agentId),
      tenantId: new ObjectId(tenantId),
    });

    if (!existing) {
      throw new ApiError('AGENT_NOT_FOUND', 'Agent not found', 404);
    }

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (data.name !== undefined) updateData.name = data.name;
    if (data.email !== undefined) updateData.email = data.email;
    if (data.phone !== undefined) updateData.phone = data.phone;
    if (data.address !== undefined) updateData.address = data.address;
    if (data.commissionType !== undefined) updateData.commissionType = data.commissionType;
    if (data.commissionValue !== undefined) updateData.commissionValue = data.commissionValue;
    if (data.bankDetails !== undefined) updateData.bankDetails = data.bankDetails;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    const result = await collections.admissionAgents.findOneAndUpdate(
      { _id: new ObjectId(agentId) },
      { $set: updateData },
      { returnDocument: 'after' }
    );

    logger.info({ agentId, tenantId, updatedBy }, 'Admission agent updated');

    return this.formatAgent(result as WithId<AdmissionAgentDocument>);
  }

  async deleteAgent(tenantId: string, agentId: string, deletedBy: string) {
    const result = await collections.admissionAgents.deleteOne({
      _id: new ObjectId(agentId),
      tenantId: new ObjectId(tenantId),
    });

    if (result.deletedCount === 0) {
      throw new ApiError('AGENT_NOT_FOUND', 'Agent not found', 404);
    }

    logger.info({ agentId, tenantId, deletedBy }, 'Admission agent deleted');

    return { success: true };
  }

  async getAgentStats(tenantId: string, agentId: string) {
    const agent = await this.getAgent(tenantId, agentId);

    // Get leads count by this agent
    const leadStats = await collections.leads
      .aggregate([
        {
          $match: {
            tenantId: new ObjectId(tenantId),
            source: 'agent',
            referredBy: agentId,
          },
        },
        {
          $group: {
            _id: '$stage',
            count: { $sum: 1 },
          },
        },
      ])
      .toArray();

    // Get applications by this agent
    const applicationStats = await collections.applications
      .aggregate([
        {
          $match: {
            tenantId: new ObjectId(tenantId),
            source: 'agent',
            referredBy: agentId,
          },
        },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
          },
        },
      ])
      .toArray();

    const leads: Record<string, number> = {};
    leadStats.forEach((s) => {
      leads[s._id] = s.count;
    });

    const applications: Record<string, number> = {};
    applicationStats.forEach((s) => {
      applications[s._id] = s.count;
    });

    return {
      agent,
      leads,
      applications,
      totalLeads: Object.values(leads).reduce((a, b) => a + b, 0),
      totalApplications: Object.values(applications).reduce((a, b) => a + b, 0),
      totalEnrolled: applications.enrolled || 0,
      conversionRate: leads.converted
        ? (
            ((applications.enrolled || 0) / Object.values(leads).reduce((a, b) => a + b, 0)) *
            100
          ).toFixed(2) + '%'
        : '0%',
    };
  }

  async incrementAgentStats(
    tenantId: string,
    agentId: string,
    field: 'totalLeads' | 'totalConversions',
    increment: number = 1
  ) {
    await collections.admissionAgents.updateOne(
      {
        _id: new ObjectId(agentId),
        tenantId: new ObjectId(tenantId),
      },
      {
        $inc: { [field]: increment },
        $set: { updatedAt: new Date() },
      }
    );
  }

  private formatAgent(agent: WithId<AdmissionAgentDocument>) {
    return {
      _id: agent._id.toString(),
      tenantId: agent.tenantId.toString(),
      branchId: agent.branchId?.toString(),
      code: agent.code,
      name: agent.name,
      email: agent.email,
      phone: agent.phone,
      address: agent.address,
      commissionType: agent.commissionType,
      commissionValue: agent.commissionValue,
      bankDetails: agent.bankDetails,
      isActive: agent.isActive,
      totalLeads: agent.totalLeads,
      totalConversions: agent.totalConversions,
      totalCommissionPaid: agent.totalCommissionPaid,
      createdAt: agent.createdAt,
      updatedAt: agent.updatedAt,
    };
  }

  // ============ Public Web Forms ============

  async getPublicEnquiryForm(branchId: string) {
    const branch = await collections.branches.findOne({
      _id: new ObjectId(branchId),
      status: 'active',
    });

    if (!branch) {
      throw new ApiError('BRANCH_NOT_FOUND', 'Branch not found or inactive', 404);
    }

    const settings = await this.getSettings((branch.tenantId as ObjectId).toString(), branchId);

    if (!settings.webForms?.enquiry?.enabled) {
      throw new ApiError('FORM_DISABLED', 'Enquiry form is not enabled', 400);
    }

    // Return only public-facing form configuration
    return {
      branchId,
      branchName: branch.name,
      formType: 'enquiry',
      title: settings.webForms.enquiry.title,
      description: settings.webForms.enquiry.description,
      fields: settings.webForms.enquiry.fields.sort((a, b) => a.order - b.order),
      sources: await this.getSources((branch.tenantId as ObjectId).toString(), branchId),
    };
  }

  async submitPublicEnquiry(
    branchId: string,
    data: {
      formData: Record<string, unknown>;
      source?: string;
    }
  ) {
    const branch = await collections.branches.findOne({
      _id: new ObjectId(branchId),
      status: 'active',
    });

    if (!branch) {
      throw new ApiError('BRANCH_NOT_FOUND', 'Branch not found', 404);
    }

    const tenantId = (branch.tenantId as ObjectId).toString();
    const settings = await this.getSettings(tenantId, branchId);

    if (!settings.webForms?.enquiry?.enabled) {
      throw new ApiError('FORM_DISABLED', 'Enquiry form is not enabled', 400);
    }

    // Validate required fields
    for (const field of settings.webForms.enquiry.fields) {
      if (field.required && !data.formData[field.fieldKey]) {
        throw new ApiError('VALIDATION_ERROR', `Field ${field.label} is required`, 400);
      }
    }

    // Create lead from enquiry
    const leadId = new ObjectId();
    const now = new Date();
    const leadCode = await this.generateNumber(tenantId, branchId, 'leadCode');

    const lead = {
      _id: leadId,
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
      leadCode,
      studentName:
        (data.formData.studentName as string) || (data.formData.name as string) || 'Web Enquiry',
      email: data.formData.email as string,
      phone: data.formData.phone as string,
      class: data.formData.class as string,
      source: data.source || 'website',
      stage: 'new',
      customData: data.formData,
      followups: [],
      createdAt: now,
      updatedAt: now,
    };

    await collections.leads.insertOne(lead);

    logger.info(
      { leadId: leadId.toString(), branchId, source: 'web-form' },
      'Public enquiry submitted'
    );

    return {
      success: true,
      message: settings.webForms.enquiry.thankYouMessage || 'Thank you for your enquiry!',
      leadCode,
    };
  }

  async getPublicApplicationForm(branchId: string) {
    const branch = await collections.branches.findOne({
      _id: new ObjectId(branchId),
      status: 'active',
    });

    if (!branch) {
      throw new ApiError('BRANCH_NOT_FOUND', 'Branch not found or inactive', 404);
    }

    const settings = await this.getSettings((branch.tenantId as ObjectId).toString(), branchId);

    if (!settings.webForms?.application?.enabled) {
      throw new ApiError('FORM_DISABLED', 'Application form is not enabled', 400);
    }

    // Get classes for the branch
    const classes = await collections.classes
      .find({
        tenantId: branch.tenantId as ObjectId,
        branchId: new ObjectId(branchId),
        isActive: true,
      })
      .project({ _id: 1, displayName: 1 })
      .toArray();

    return {
      branchId,
      branchName: branch.name,
      formType: 'application',
      title: settings.webForms.application.title,
      description: settings.webForms.application.description,
      fields: settings.webForms.application.fields.sort((a, b) => a.order - b.order),
      requirePayment: settings.webForms.application.requirePayment,
      applicationFee: settings.webForms.application.requirePayment ? settings.applicationFee : null,
      classes: classes.map((c) => ({
        _id: c._id.toString(),
        name: c.displayName,
      })),
    };
  }

  async submitPublicApplication(
    branchId: string,
    data: {
      formData: Record<string, unknown>;
      classId: string;
    }
  ) {
    const branch = await collections.branches.findOne({
      _id: new ObjectId(branchId),
      status: 'active',
    });

    if (!branch) {
      throw new ApiError('BRANCH_NOT_FOUND', 'Branch not found', 404);
    }

    const tenantId = (branch.tenantId as ObjectId).toString();
    const settings = await this.getSettings(tenantId, branchId);

    if (!settings.webForms?.application?.enabled) {
      throw new ApiError('FORM_DISABLED', 'Application form is not enabled', 400);
    }

    // Validate required fields
    for (const field of settings.webForms.application.fields) {
      if (field.required && !data.formData[field.fieldKey]) {
        throw new ApiError('VALIDATION_ERROR', `Field ${field.label} is required`, 400);
      }
    }

    // Create application
    const applicationId = new ObjectId();
    const now = new Date();
    const applicationNumber = await this.generateNumber(tenantId, branchId, 'applicationNumber');

    const application = {
      _id: applicationId,
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
      applicationNumber,
      classId: new ObjectId(data.classId),
      student: {
        firstName:
          (data.formData.firstName as string) || (data.formData.studentName as string) || '',
        lastName: (data.formData.lastName as string) || '',
        dateOfBirth: data.formData.dateOfBirth as string,
        gender: data.formData.gender as string,
        email: data.formData.email as string,
        phone: data.formData.phone as string,
      },
      parents: {
        father: {
          name: data.formData.fatherName as string,
          phone: data.formData.fatherPhone as string,
        },
        mother: {
          name: data.formData.motherName as string,
          phone: data.formData.motherPhone as string,
        },
      },
      customData: data.formData,
      source: 'website',
      status: 'submitted',
      paymentStatus: settings.webForms.application.requirePayment ? 'pending' : 'not_required',
      createdAt: now,
      updatedAt: now,
    };

    await collections.applications.insertOne(application);

    logger.info(
      { applicationId: applicationId.toString(), branchId, source: 'web-form' },
      'Public application submitted'
    );

    return {
      success: true,
      message: settings.webForms.application.thankYouMessage || 'Thank you for your application!',
      applicationNumber,
      requirePayment: settings.webForms.application.requirePayment,
      applicationFee: settings.webForms.application.requirePayment ? settings.applicationFee : null,
    };
  }
}

export const admissionSettingsService = new AdmissionSettingsService();
