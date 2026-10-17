import { ObjectId, WithId, Document } from 'mongodb';
import { collections } from '../../config/database';
import { logger } from '../../lib/logger';
import { ApiError } from '../../middleware/errorHandler';

export type VacancyStatus = 'draft' | 'published' | 'closed';
export type EmploymentType = 'full_time' | 'part_time' | 'contract' | 'internship';
export type WorkMode = 'onsite' | 'remote' | 'hybrid';

export type ApplicationStatus =
  | 'new'
  | 'in_review'
  | 'shortlisted'
  | 'interviewing'
  | 'offered'
  | 'hired'
  | 'rejected';

export const APPLICATION_STATUSES: ApplicationStatus[] = [
  'new',
  'in_review',
  'shortlisted',
  'interviewing',
  'offered',
  'hired',
  'rejected',
];

export interface VacancyDocument extends Document {
  _id: ObjectId;
  title: string;
  slug: string;
  /** Department / team — used for filter chips. */
  department: string;
  /** Job category, e.g. Engineering, Design, Sales. */
  category: string;
  location: string;
  employmentType: EmploymentType;
  workMode: WorkMode;
  experience?: string;
  salaryRange?: string;
  /** When true, the public site hides salary on listing card + detail header. */
  hideSalary?: boolean;
  shortDescription: string;
  /** Full JD (rich HTML from BlockNote). */
  description: string;
  status: VacancyStatus;
  createdBy: ObjectId;
  createdAt: Date;
  updatedAt: Date;
  publishedAt?: Date;
  closedAt?: Date;
}

export interface CreateVacancyInput {
  title: string;
  department?: string;
  category?: string;
  location?: string;
  employmentType?: EmploymentType;
  workMode?: WorkMode;
  experience?: string;
  salaryRange?: string;
  hideSalary?: boolean;
  shortDescription?: string;
  description: string;
  status?: VacancyStatus;
}

export type UpdateVacancyInput = Partial<CreateVacancyInput>;

export interface ApplicationDocument extends Document {
  _id: ObjectId;
  vacancyId: ObjectId;
  vacancyTitle: string;
  fullName: string;
  email: string;
  phone: string;
  coverLetter?: string;
  resumeUrl: string;
  resumeKey?: string;
  resumeFileName?: string;
  linkedinUrl?: string;
  portfolioUrl?: string;
  status: ApplicationStatus;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
  source?: { ip?: string; userAgent?: string };
}

export interface CreateApplicationInput {
  vacancyId: string;
  fullName: string;
  email: string;
  phone: string;
  coverLetter?: string;
  resumeUrl: string;
  resumeKey?: string;
  resumeFileName?: string;
  linkedinUrl?: string;
  portfolioUrl?: string;
  source?: { ip?: string; userAgent?: string };
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

function toPlainText(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function formatVacancy(doc: WithId<VacancyDocument>) {
  return {
    id: doc._id.toString(),
    title: doc.title,
    slug: doc.slug,
    department: doc.department,
    category: doc.category,
    location: doc.location,
    employmentType: doc.employmentType,
    workMode: doc.workMode,
    experience: doc.experience,
    salaryRange: doc.salaryRange,
    hideSalary: doc.hideSalary ?? false,
    shortDescription: doc.shortDescription,
    description: doc.description,
    status: doc.status,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    publishedAt: doc.publishedAt,
    closedAt: doc.closedAt,
  };
}

function formatApplication(doc: WithId<ApplicationDocument>, vacancyTitle?: string) {
  return {
    id: doc._id.toString(),
    vacancyId: doc.vacancyId.toString(),
    vacancyTitle: vacancyTitle ?? doc.vacancyTitle,
    fullName: doc.fullName,
    email: doc.email,
    phone: doc.phone,
    coverLetter: doc.coverLetter,
    resumeUrl: doc.resumeUrl,
    resumeFileName: doc.resumeFileName,
    linkedinUrl: doc.linkedinUrl,
    portfolioUrl: doc.portfolioUrl,
    status: doc.status,
    notes: doc.notes,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export type VacancyResponse = ReturnType<typeof formatVacancy>;
export type ApplicationResponse = ReturnType<typeof formatApplication>;

class CareersService {
  // ───────────────── Slug helpers ─────────────────

  private async uniqueSlug(base: string, excludeId?: ObjectId): Promise<string> {
    const root = base || 'role';
    let candidate = root;
    let n = 1;
    while (true) {
      const existing = await collections.careerVacancies.findOne({ slug: candidate });
      if (!existing || (excludeId && existing._id.equals(excludeId))) return candidate;
      n += 1;
      candidate = `${root}-${n}`;
    }
  }

  // ───────────────── Vacancies: Admin ─────────────────

  async createVacancy(input: CreateVacancyInput, adminId: string): Promise<VacancyResponse> {
    const title = input.title?.trim();
    if (!title) throw new ApiError('INVALID_INPUT', 'Title is required', 400);
    if (!input.description?.trim())
      throw new ApiError('INVALID_INPUT', 'Description is required', 400);

    const now = new Date();
    const status: VacancyStatus = input.status ?? 'draft';
    const slug = await this.uniqueSlug(slugify(title));

    const doc: VacancyDocument = {
      _id: new ObjectId(),
      title,
      slug,
      department: input.department?.trim() || 'General',
      category: input.category?.trim() || 'General',
      location: input.location?.trim() || 'Visakhapatnam, India',
      employmentType: input.employmentType ?? 'full_time',
      workMode: input.workMode ?? 'onsite',
      experience: input.experience?.trim() || undefined,
      salaryRange: input.salaryRange?.trim() || undefined,
      hideSalary: input.hideSalary ?? false,
      shortDescription:
        input.shortDescription?.trim() || toPlainText(input.description).slice(0, 180),
      description: input.description,
      status,
      createdBy: new ObjectId(adminId),
      createdAt: now,
      updatedAt: now,
      publishedAt: status === 'published' ? now : undefined,
      closedAt: status === 'closed' ? now : undefined,
    };

    await collections.careerVacancies.insertOne(doc);
    logger.info({ id: doc._id.toString(), slug, status }, 'Vacancy created');
    return formatVacancy(doc as WithId<VacancyDocument>);
  }

  async updateVacancy(id: string, input: UpdateVacancyInput): Promise<VacancyResponse> {
    if (!ObjectId.isValid(id)) throw new ApiError('INVALID_ID', 'Invalid vacancy id', 400);
    const _id = new ObjectId(id);
    const existing = (await collections.careerVacancies.findOne({
      _id,
    })) as WithId<VacancyDocument> | null;
    if (!existing) throw new ApiError('NOT_FOUND', 'Vacancy not found', 404);

    const now = new Date();
    const set: Partial<VacancyDocument> = { updatedAt: now };

    if (input.title !== undefined) {
      const title = input.title.trim();
      if (!title) throw new ApiError('INVALID_INPUT', 'Title cannot be empty', 400);
      set.title = title;
      if (title !== existing.title) set.slug = await this.uniqueSlug(slugify(title), _id);
    }
    if (input.description !== undefined) {
      if (!input.description.trim())
        throw new ApiError('INVALID_INPUT', 'Description cannot be empty', 400);
      set.description = input.description;
      if (input.shortDescription === undefined)
        set.shortDescription = toPlainText(input.description).slice(0, 180);
    }
    if (input.shortDescription !== undefined) set.shortDescription = input.shortDescription.trim();
    if (input.department !== undefined) set.department = input.department.trim() || 'General';
    if (input.category !== undefined) set.category = input.category.trim() || 'General';
    if (input.location !== undefined)
      set.location = input.location.trim() || 'Visakhapatnam, India';
    if (input.employmentType !== undefined) set.employmentType = input.employmentType;
    if (input.workMode !== undefined) set.workMode = input.workMode;
    if (input.experience !== undefined) set.experience = input.experience.trim() || undefined;
    if (input.salaryRange !== undefined) set.salaryRange = input.salaryRange.trim() || undefined;
    if (input.hideSalary !== undefined) set.hideSalary = input.hideSalary;

    if (input.status !== undefined && input.status !== existing.status) {
      set.status = input.status;
      if (input.status === 'published' && !existing.publishedAt) set.publishedAt = now;
      if (input.status === 'closed') set.closedAt = now;
    }

    await collections.careerVacancies.updateOne({ _id }, { $set: set });
    const updated = (await collections.careerVacancies.findOne({
      _id,
    })) as WithId<VacancyDocument>;
    return formatVacancy(updated);
  }

  async setVacancyStatus(id: string, status: VacancyStatus): Promise<VacancyResponse> {
    return this.updateVacancy(id, { status });
  }

  async removeVacancy(id: string): Promise<void> {
    if (!ObjectId.isValid(id)) throw new ApiError('INVALID_ID', 'Invalid vacancy id', 400);
    const _id = new ObjectId(id);
    const result = await collections.careerVacancies.deleteOne({ _id });
    if (result.deletedCount === 0) throw new ApiError('NOT_FOUND', 'Vacancy not found', 404);
    // Detach applications — keep them but mark vacancy as deleted via title preserved.
    logger.info({ id }, 'Vacancy deleted');
  }

  async listVacanciesAdmin(params: {
    status?: VacancyStatus;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<{ data: VacancyResponse[]; meta: { total: number; page: number; limit: number } }> {
    const { status, search, page = 1, limit = 50 } = params;
    const query: Record<string, unknown> = {};
    if (status) query.status = status;
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { department: { $regex: search, $options: 'i' } },
        { category: { $regex: search, $options: 'i' } },
        { location: { $regex: search, $options: 'i' } },
      ];
    }
    const total = await collections.careerVacancies.countDocuments(query);
    const docs = (await collections.careerVacancies
      .find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray()) as WithId<VacancyDocument>[];
    return { data: docs.map(formatVacancy), meta: { total, page, limit } };
  }

  async getVacancyById(id: string): Promise<VacancyResponse> {
    if (!ObjectId.isValid(id)) throw new ApiError('INVALID_ID', 'Invalid vacancy id', 400);
    const doc = (await collections.careerVacancies.findOne({
      _id: new ObjectId(id),
    })) as WithId<VacancyDocument> | null;
    if (!doc) throw new ApiError('NOT_FOUND', 'Vacancy not found', 404);
    return formatVacancy(doc);
  }

  // ───────────────── Vacancies: Public ─────────────────

  async listVacanciesPublic(params: {
    category?: string;
    department?: string;
    employmentType?: EmploymentType;
    workMode?: WorkMode;
    location?: string;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<{ data: VacancyResponse[]; meta: { total: number; page: number; limit: number } }> {
    const {
      category,
      department,
      employmentType,
      workMode,
      location,
      search,
      page = 1,
      limit = 48,
    } = params;
    const query: Record<string, unknown> = { status: 'published' };
    if (category) query.category = category;
    if (department) query.department = department;
    if (employmentType) query.employmentType = employmentType;
    if (workMode) query.workMode = workMode;
    if (location) query.location = { $regex: location, $options: 'i' };
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { shortDescription: { $regex: search, $options: 'i' } },
        { department: { $regex: search, $options: 'i' } },
      ];
    }
    const total = await collections.careerVacancies.countDocuments(query);
    const docs = (await collections.careerVacancies
      .find(query)
      .sort({ publishedAt: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray()) as WithId<VacancyDocument>[];
    return { data: docs.map(formatVacancy), meta: { total, page, limit } };
  }

  async getPublishedVacancyBySlug(slug: string): Promise<VacancyResponse> {
    const doc = (await collections.careerVacancies.findOne({
      slug,
      status: 'published',
    })) as WithId<VacancyDocument> | null;
    if (!doc) throw new ApiError('NOT_FOUND', 'Vacancy not found', 404);
    return formatVacancy(doc);
  }

  // ───────────────── Applications ─────────────────

  async createApplication(input: CreateApplicationInput): Promise<ApplicationResponse> {
    if (!ObjectId.isValid(input.vacancyId))
      throw new ApiError('INVALID_ID', 'Invalid vacancy id', 400);
    const vacancy = (await collections.careerVacancies.findOne({
      _id: new ObjectId(input.vacancyId),
    })) as WithId<VacancyDocument> | null;
    if (!vacancy) throw new ApiError('NOT_FOUND', 'Vacancy not found', 404);
    if (vacancy.status !== 'published')
      throw new ApiError(
        'VACANCY_NOT_OPEN',
        'This vacancy is no longer accepting applications',
        400
      );

    const fullName = input.fullName?.trim();
    const email = input.email?.trim().toLowerCase();
    const phone = input.phone?.trim();
    if (!fullName) throw new ApiError('INVALID_INPUT', 'Full name is required', 400);
    if (!email) throw new ApiError('INVALID_INPUT', 'Email is required', 400);
    if (!phone) throw new ApiError('INVALID_INPUT', 'Phone is required', 400);
    if (!input.resumeUrl) throw new ApiError('INVALID_INPUT', 'Resume is required', 400);

    const now = new Date();
    const doc: ApplicationDocument = {
      _id: new ObjectId(),
      vacancyId: vacancy._id,
      vacancyTitle: vacancy.title,
      fullName,
      email,
      phone,
      coverLetter: input.coverLetter?.trim() || undefined,
      resumeUrl: input.resumeUrl,
      resumeKey: input.resumeKey,
      resumeFileName: input.resumeFileName,
      linkedinUrl: input.linkedinUrl?.trim() || undefined,
      portfolioUrl: input.portfolioUrl?.trim() || undefined,
      status: 'new',
      createdAt: now,
      updatedAt: now,
      source: input.source,
    };
    await collections.careerApplications.insertOne(doc);
    logger.info(
      { id: doc._id.toString(), vacancyId: vacancy._id.toString() },
      'Career application submitted'
    );
    return formatApplication(doc as WithId<ApplicationDocument>);
  }

  async listApplications(params: {
    vacancyId?: string;
    status?: ApplicationStatus;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    data: ApplicationResponse[];
    meta: { total: number; page: number; limit: number };
  }> {
    const { vacancyId, status, search, page = 1, limit = 50 } = params;
    const query: Record<string, unknown> = {};
    if (vacancyId) {
      if (!ObjectId.isValid(vacancyId)) throw new ApiError('INVALID_ID', 'Invalid vacancy id', 400);
      query.vacancyId = new ObjectId(vacancyId);
    }
    if (status) query.status = status;
    if (search) {
      query.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { vacancyTitle: { $regex: search, $options: 'i' } },
      ];
    }
    const total = await collections.careerApplications.countDocuments(query);
    const docs = (await collections.careerApplications
      .find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray()) as WithId<ApplicationDocument>[];
    return { data: docs.map((d) => formatApplication(d)), meta: { total, page, limit } };
  }

  async getApplicationById(id: string): Promise<ApplicationResponse> {
    if (!ObjectId.isValid(id)) throw new ApiError('INVALID_ID', 'Invalid application id', 400);
    const doc = (await collections.careerApplications.findOne({
      _id: new ObjectId(id),
    })) as WithId<ApplicationDocument> | null;
    if (!doc) throw new ApiError('NOT_FOUND', 'Application not found', 404);
    return formatApplication(doc);
  }

  async updateApplicationStatus(
    id: string,
    status: ApplicationStatus,
    notes?: string
  ): Promise<ApplicationResponse> {
    if (!APPLICATION_STATUSES.includes(status))
      throw new ApiError('INVALID_INPUT', 'Invalid status', 400);
    if (!ObjectId.isValid(id)) throw new ApiError('INVALID_ID', 'Invalid application id', 400);
    const _id = new ObjectId(id);
    const set: Partial<ApplicationDocument> = { status, updatedAt: new Date() };
    if (notes !== undefined) set.notes = notes.trim();
    const result = await collections.careerApplications.updateOne({ _id }, { $set: set });
    if (result.matchedCount === 0) throw new ApiError('NOT_FOUND', 'Application not found', 404);
    const updated = (await collections.careerApplications.findOne({
      _id,
    })) as WithId<ApplicationDocument>;
    return formatApplication(updated);
  }

  async removeApplication(id: string): Promise<void> {
    if (!ObjectId.isValid(id)) throw new ApiError('INVALID_ID', 'Invalid application id', 400);
    const result = await collections.careerApplications.deleteOne({ _id: new ObjectId(id) });
    if (result.deletedCount === 0) throw new ApiError('NOT_FOUND', 'Application not found', 404);
  }
}

export const careersService = new CareersService();
