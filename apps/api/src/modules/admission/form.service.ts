import { ObjectId, WithId, Document } from 'mongodb';
import { collections } from '../../config/database';
import { logger } from '../../lib/logger';
import { ApiError } from '../../middleware/errorHandler';
import { nanoid } from 'nanoid';

// ============ Form Field Types ============
interface FormField {
  id: string;
  type:
    | 'text'
    | 'textarea'
    | 'email'
    | 'phone'
    | 'number'
    | 'date'
    | 'select'
    | 'radio'
    | 'checkbox'
    | 'file'
    | 'section';
  name: string;
  label: string;
  placeholder?: string;
  helpText?: string;
  required: boolean;
  validation?: {
    minLength?: number;
    maxLength?: number;
    min?: number;
    max?: number;
    pattern?: string;
    acceptedFileTypes?: string[];
    maxFileSize?: number; // in MB
  };
  options?: Array<{ value: string; label: string }>;
  defaultValue?: string | boolean;
  width?: 'full' | 'half' | 'third';
  order: number;
}

// ============ Form Document ============
interface FormDocument extends Document {
  _id: ObjectId;
  tenantId: ObjectId;
  branchId: ObjectId;

  // Form metadata
  name: string;
  slug: string; // URL-friendly unique identifier
  description?: string;
  type: 'lead' | 'application' | 'enquiry' | 'feedback' | 'custom';

  // Form configuration
  fields: FormField[];
  settings: {
    collectPayment: boolean;
    paymentAmount?: number;
    redirectUrl?: string;
    confirmationMessage: string;
    notifyOnSubmission: boolean;
    notifyEmails: string[];
    autoCreateLead: boolean;
    assignToClassId?: ObjectId;
    assignToAcademicBatchId?: ObjectId;
  };

  // Styling
  styling: {
    headerImage?: string;
    logo?: string;
    primaryColor: string;
    backgroundColor: string;
  };

  // Status
  status: 'draft' | 'published' | 'closed' | 'archived';
  publishedAt?: Date;
  closesAt?: Date;
  maxSubmissions?: number;
  submissionCount: number;

  createdBy: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

// ============ Form Submission ============
interface FormSubmissionDocument extends Document {
  _id: ObjectId;
  tenantId: ObjectId;
  branchId: ObjectId;
  formId: ObjectId;

  // Submitted data
  data: Record<string, unknown>;
  files?: Array<{
    fieldId: string;
    fileName: string;
    fileUrl: string;
    fileSize: number;
  }>;

  // Source tracking
  source: {
    ip?: string;
    userAgent?: string;
    referrer?: string;
  };

  // Payment (if applicable)
  payment?: {
    required: boolean;
    amount: number;
    status: 'pending' | 'paid' | 'failed';
    transactionId?: string;
    paidAt?: Date;
  };

  // Processing
  status: 'new' | 'reviewed' | 'processed' | 'archived';
  processedAs?: {
    type: 'lead' | 'application';
    id: ObjectId;
  };
  notes?: string;

  createdAt: Date;
  updatedAt: Date;
}

export interface CreateFormInput {
  name: string;
  slug?: string;
  description?: string;
  type: 'lead' | 'application' | 'enquiry' | 'feedback' | 'custom';
  fields?: FormField[];
  settings?: Partial<FormDocument['settings']>;
  styling?: Partial<FormDocument['styling']>;
}

export interface UpdateFormInput {
  name?: string;
  description?: string;
  fields?: FormField[];
  settings?: Partial<FormDocument['settings']>;
  styling?: Partial<FormDocument['styling']>;
  status?: 'draft' | 'published' | 'closed' | 'archived';
  closesAt?: string;
  maxSubmissions?: number;
}

export interface SubmitFormInput {
  data: Record<string, unknown>;
  files?: Array<{
    fieldId: string;
    fileName: string;
    fileUrl: string;
    fileSize: number;
  }>;
  source?: {
    ip?: string;
    userAgent?: string;
    referrer?: string;
  };
}

const DEFAULT_SETTINGS: FormDocument['settings'] = {
  collectPayment: false,
  confirmationMessage: 'Thank you for your submission! We will get back to you soon.',
  notifyOnSubmission: true,
  notifyEmails: [],
  autoCreateLead: true,
};

const DEFAULT_STYLING: FormDocument['styling'] = {
  primaryColor: '#4F46E5',
  backgroundColor: '#FFFFFF',
};

// Default fields for lead form
const DEFAULT_LEAD_FIELDS: FormField[] = [
  {
    id: 'name',
    type: 'text',
    name: 'name',
    label: 'Full Name',
    required: true,
    order: 1,
    width: 'full',
  },
  {
    id: 'email',
    type: 'email',
    name: 'email',
    label: 'Email Address',
    required: false,
    order: 2,
    width: 'half',
  },
  {
    id: 'phone',
    type: 'phone',
    name: 'phone',
    label: 'Phone Number',
    required: true,
    order: 3,
    width: 'half',
  },
  {
    id: 'class',
    type: 'select',
    name: 'class',
    label: 'Interested Class',
    required: true,
    order: 4,
    width: 'half',
    options: [],
  },
  {
    id: 'message',
    type: 'textarea',
    name: 'message',
    label: 'Message',
    required: false,
    order: 5,
    width: 'full',
  },
];

class FormService {
  // ============ Form CRUD ============

  async createForm(tenantId: string, branchId: string, data: CreateFormInput, createdBy: string) {
    // Generate unique slug
    let slug = data.slug || this.generateSlug(data.name);

    // Ensure slug is unique
    const existingSlug = await collections.forms.findOne({
      tenantId: new ObjectId(tenantId),
      slug,
    });

    if (existingSlug) {
      slug = `${slug}-${nanoid(6)}`;
    }

    const formId = new ObjectId();
    const now = new Date();

    const defaultFields = data.type === 'lead' ? DEFAULT_LEAD_FIELDS : [];

    const form: Omit<FormDocument, '_id'> & { _id: ObjectId } = {
      _id: formId,
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
      name: data.name,
      slug,
      description: data.description,
      type: data.type,
      fields: data.fields || defaultFields,
      settings: { ...DEFAULT_SETTINGS, ...data.settings },
      styling: { ...DEFAULT_STYLING, ...data.styling },
      status: 'draft',
      submissionCount: 0,
      createdBy: new ObjectId(createdBy),
      createdAt: now,
      updatedAt: now,
    };

    await collections.forms.insertOne(form);

    logger.info({ tenantId, branchId, formId, slug, createdBy }, 'Form created');

    return this.formatForm(form as WithId<FormDocument>);
  }

  async updateForm(
    tenantId: string,
    branchId: string,
    formId: string,
    data: UpdateFormInput,
    updatedBy: string
  ) {
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.fields !== undefined) updateData.fields = data.fields;
    if (data.settings !== undefined) updateData.settings = data.settings;
    if (data.styling !== undefined) updateData.styling = data.styling;
    if (data.closesAt !== undefined) updateData.closesAt = new Date(data.closesAt);
    if (data.maxSubmissions !== undefined) updateData.maxSubmissions = data.maxSubmissions;

    if (data.status !== undefined) {
      updateData.status = data.status;
      if (data.status === 'published') {
        updateData.publishedAt = new Date();
      }
    }

    const result = await collections.forms.findOneAndUpdate(
      {
        _id: new ObjectId(formId),
        tenantId: new ObjectId(tenantId),
        branchId: new ObjectId(branchId),
      },
      { $set: updateData },
      { returnDocument: 'after' }
    );

    if (!result) {
      throw new ApiError('FORM_NOT_FOUND', 'Form not found', 404);
    }

    logger.info({ tenantId, branchId, formId, updatedBy }, 'Form updated');

    return this.formatForm(result as unknown as WithId<FormDocument>);
  }

  async deleteForm(tenantId: string, branchId: string, formId: string, deletedBy: string) {
    const result = await collections.forms.deleteOne({
      _id: new ObjectId(formId),
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
    });

    if (result.deletedCount === 0) {
      throw new ApiError('FORM_NOT_FOUND', 'Form not found', 404);
    }

    logger.info({ tenantId, branchId, formId, deletedBy }, 'Form deleted');

    return { success: true };
  }

  async getForm(tenantId: string, branchId: string, formId: string) {
    const form = await collections.forms.findOne({
      _id: new ObjectId(formId),
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
    });

    if (!form) {
      throw new ApiError('FORM_NOT_FOUND', 'Form not found', 404);
    }

    return this.formatForm(form as unknown as WithId<FormDocument>);
  }

  async getFormBySlug(slug: string) {
    const form = await collections.forms.findOne({
      slug,
      status: 'published',
    });

    if (!form) {
      throw new ApiError('FORM_NOT_FOUND', 'Form not found or not published', 404);
    }

    // Check if form is closed
    const typedForm = form as unknown as WithId<FormDocument>;
    if (typedForm.closesAt && new Date(typedForm.closesAt) < new Date()) {
      throw new ApiError('FORM_CLOSED', 'This form is no longer accepting submissions', 400);
    }

    // Check max submissions
    if (typedForm.maxSubmissions && typedForm.submissionCount >= typedForm.maxSubmissions) {
      throw new ApiError('FORM_MAX_SUBMISSIONS', 'This form has reached maximum submissions', 400);
    }

    return this.formatPublicForm(typedForm);
  }

  async getForms(
    tenantId: string,
    branchId: string,
    params: {
      page?: number;
      limit?: number;
      status?: string;
      type?: string;
      search?: string;
    }
  ) {
    const { page = 1, limit = 20, status, type, search } = params;
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = {
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
    };

    if (status) filter.status = status;
    if (type) filter.type = type;
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { slug: { $regex: search, $options: 'i' } },
      ];
    }

    const [forms, total] = await Promise.all([
      collections.forms.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray(),
      collections.forms.countDocuments(filter),
    ]);

    return {
      data: forms.map((f) => this.formatForm(f as unknown as WithId<FormDocument>)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async duplicateForm(
    tenantId: string,
    branchId: string,
    formId: string,
    newName: string,
    createdBy: string
  ) {
    const original = await collections.forms.findOne({
      _id: new ObjectId(formId),
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
    });

    if (!original) {
      throw new ApiError('FORM_NOT_FOUND', 'Form not found', 404);
    }

    const typedOriginal = original as unknown as WithId<FormDocument>;

    return this.createForm(
      tenantId,
      branchId,
      {
        name: newName,
        description: typedOriginal.description,
        type: typedOriginal.type,
        fields: typedOriginal.fields,
        settings: typedOriginal.settings,
        styling: typedOriginal.styling,
      },
      createdBy
    );
  }

  // ============ Form Submissions ============

  async submitForm(slug: string, data: SubmitFormInput) {
    const form = await collections.forms.findOne({
      slug,
      status: 'published',
    });

    if (!form) {
      throw new ApiError('FORM_NOT_FOUND', 'Form not found or not published', 404);
    }

    const typedForm = form as unknown as WithId<FormDocument>;

    // Validate form is still accepting submissions
    if (typedForm.closesAt && new Date(typedForm.closesAt) < new Date()) {
      throw new ApiError('FORM_CLOSED', 'This form is no longer accepting submissions', 400);
    }

    if (typedForm.maxSubmissions && typedForm.submissionCount >= typedForm.maxSubmissions) {
      throw new ApiError('FORM_MAX_SUBMISSIONS', 'This form has reached maximum submissions', 400);
    }

    // Validate required fields
    for (const field of typedForm.fields) {
      if (field.required && field.type !== 'section') {
        const value = data.data[field.name];
        if (value === undefined || value === null || value === '') {
          throw new ApiError('VALIDATION_ERROR', `${field.label} is required`, 400);
        }
      }
    }

    const submissionId = new ObjectId();
    const now = new Date();

    const submission: Omit<FormSubmissionDocument, '_id'> & { _id: ObjectId } = {
      _id: submissionId,
      tenantId: typedForm.tenantId,
      branchId: typedForm.branchId,
      formId: typedForm._id,
      data: data.data,
      files: data.files,
      source: data.source || {},
      status: 'new',
      createdAt: now,
      updatedAt: now,
    };

    // Add payment info if required
    if (typedForm.settings.collectPayment && typedForm.settings.paymentAmount) {
      submission.payment = {
        required: true,
        amount: typedForm.settings.paymentAmount,
        status: 'pending',
      };
    }

    await collections.formSubmissions.insertOne(submission);

    // Increment submission count
    await collections.forms.updateOne({ _id: typedForm._id }, { $inc: { submissionCount: 1 } });

    // Auto-create lead if enabled
    if (typedForm.settings.autoCreateLead && typedForm.type === 'lead') {
      try {
        await this.createLeadFromSubmission(typedForm, data.data, submissionId);
      } catch (err) {
        logger.error({ err, submissionId }, 'Failed to auto-create lead from submission');
      }
    }

    logger.info({ formId: typedForm._id, submissionId }, 'Form submission received');

    return {
      success: true,
      submissionId: submissionId.toString(),
      confirmationMessage: typedForm.settings.confirmationMessage,
      redirectUrl: typedForm.settings.redirectUrl,
      paymentRequired: submission.payment?.required || false,
      paymentAmount: submission.payment?.amount,
    };
  }

  async getSubmissions(
    tenantId: string,
    branchId: string,
    formId: string,
    params: {
      page?: number;
      limit?: number;
      status?: string;
    }
  ) {
    const { page = 1, limit = 20, status } = params;
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = {
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
      formId: new ObjectId(formId),
    };

    if (status) filter.status = status;

    const [submissions, total] = await Promise.all([
      collections.formSubmissions
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .toArray(),
      collections.formSubmissions.countDocuments(filter),
    ]);

    return {
      data: submissions.map((s) =>
        this.formatSubmission(s as unknown as WithId<FormSubmissionDocument>)
      ),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getSubmission(tenantId: string, branchId: string, submissionId: string) {
    const submission = await collections.formSubmissions.findOne({
      _id: new ObjectId(submissionId),
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
    });

    if (!submission) {
      throw new ApiError('SUBMISSION_NOT_FOUND', 'Submission not found', 404);
    }

    return this.formatSubmission(submission as unknown as WithId<FormSubmissionDocument>);
  }

  async updateSubmissionStatus(
    tenantId: string,
    branchId: string,
    submissionId: string,
    status: 'reviewed' | 'processed' | 'archived',
    notes?: string
  ) {
    const result = await collections.formSubmissions.findOneAndUpdate(
      {
        _id: new ObjectId(submissionId),
        tenantId: new ObjectId(tenantId),
        branchId: new ObjectId(branchId),
      },
      {
        $set: {
          status,
          notes,
          updatedAt: new Date(),
        },
      },
      { returnDocument: 'after' }
    );

    if (!result) {
      throw new ApiError('SUBMISSION_NOT_FOUND', 'Submission not found', 404);
    }

    return this.formatSubmission(result as unknown as WithId<FormSubmissionDocument>);
  }

  // ============ Helper Methods ============

  private async createLeadFromSubmission(
    form: WithId<FormDocument>,
    data: Record<string, unknown>,
    submissionId: ObjectId
  ) {
    const leadData = {
      tenantId: form.tenantId,
      branchId: form.branchId,
      name: String(data.name || data.fullName || data.student_name || ''),
      email: String(data.email || ''),
      phone: String(data.phone || data.mobile || ''),
      source: `form:${form.slug}`,
      status: 'new',
      notes: `Auto-created from form submission ${submissionId}`,
      classId: form.settings.assignToClassId,
      academicBatchId: form.settings.assignToAcademicBatchId,
      formSubmissionId: submissionId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    if (!leadData.name || !leadData.phone) {
      throw new Error('Name and phone are required to create lead');
    }

    await collections.leads.insertOne(leadData);
  }

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .substring(0, 50);
  }

  private formatForm(form: WithId<FormDocument>) {
    return {
      _id: form._id.toString(),
      tenantId: form.tenantId.toString(),
      branchId: form.branchId.toString(),
      name: form.name,
      slug: form.slug,
      description: form.description,
      type: form.type,
      fields: form.fields,
      settings: form.settings,
      styling: form.styling,
      status: form.status,
      publishedAt: form.publishedAt,
      closesAt: form.closesAt,
      maxSubmissions: form.maxSubmissions,
      submissionCount: form.submissionCount,
      createdBy: form.createdBy.toString(),
      createdAt: form.createdAt,
      updatedAt: form.updatedAt,
    };
  }

  private formatPublicForm(form: WithId<FormDocument>) {
    return {
      _id: form._id.toString(),
      name: form.name,
      description: form.description,
      type: form.type,
      fields: form.fields,
      styling: form.styling,
      collectPayment: form.settings.collectPayment,
      paymentAmount: form.settings.paymentAmount,
    };
  }

  private formatSubmission(submission: WithId<FormSubmissionDocument>) {
    return {
      _id: submission._id.toString(),
      formId: submission.formId.toString(),
      data: submission.data,
      files: submission.files,
      source: submission.source,
      payment: submission.payment,
      status: submission.status,
      processedAs: submission.processedAs
        ? {
            type: submission.processedAs.type,
            id: submission.processedAs.id.toString(),
          }
        : undefined,
      notes: submission.notes,
      createdAt: submission.createdAt,
      updatedAt: submission.updatedAt,
    };
  }
}

export const formService = new FormService();
