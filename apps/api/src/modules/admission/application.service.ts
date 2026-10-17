import { ObjectId, WithId, Document, Filter } from 'mongodb';
import { collections } from '../../config/database';
import { logger } from '../../lib/logger';
import { ApiError } from '../../middleware/errorHandler';
import { feeStructureService } from '../finance/feeStructure.service';
import { nextAdmissionNumber, studentService } from '../student/student.service';
import { feeAssignmentService } from '../finance/feeAssignment.service';
import { concessionService } from '../finance/concession.service';
import { enrollmentService as transportEnrollmentService } from '../transport/enrollment.service';
import type { EnrollApplicationInput } from '@campus-verse/shared/schemas';

interface ApplicationDocument extends Document {
  _id: ObjectId;
  tenantId: ObjectId;
  branchId: ObjectId;
  applicationNumber: string;
  academicBatchId: ObjectId;
  classId: ObjectId;
  sectionId?: ObjectId;

  // Student Info
  student: {
    firstName: string;
    lastName: string;
    dateOfBirth: Date;
    gender: 'male' | 'female' | 'other';
    bloodGroup?: string;
    nationality?: string;
    religion?: string;
    caste?: string;
    category?: string;
    motherTongue?: string;
    photo?: string;
  };

  // Contact
  contact: {
    email?: string;
    phone: string;
    alternatePhone?: string;
    address: {
      street?: string;
      city: string;
      state: string;
      pincode: string;
      country: string;
    };
  };

  // Parents/Guardians
  parents: {
    father?: {
      name: string;
      phone?: string;
      email?: string;
      occupation?: string;
      qualification?: string;
      annualIncome?: number;
    };
    mother?: {
      name: string;
      phone?: string;
      email?: string;
      occupation?: string;
      qualification?: string;
    };
    guardian?: {
      name: string;
      relation: string;
      phone: string;
      email?: string;
    };
  };

  // Previous Education
  previousEducation?: {
    schoolName?: string;
    board?: string;
    class?: string;
    percentage?: number;
    yearOfPassing?: number;
    tcNumber?: string;
  };

  // Documents
  documents?: Array<{
    type: string;
    fileName: string;
    fileUrl: string;
    uploadedAt: Date;
  }>;

  // Application Details
  source: string;
  leadId?: ObjectId;
  referredBy?: string;
  applicationFee?: {
    amount: number;
    paid: boolean;
    transactionId?: string;
    paidAt?: Date;
  };

  // Status tracking
  status:
    | 'draft'
    | 'submitted'
    | 'under_review'
    | 'docs_verified'
    | 'fee_paid'
    | 'approved'
    | 'rejected'
    | 'enrolled'
    | 'withdrawn';
  statusHistory: Array<{
    status: string;
    changedAt: Date;
    changedBy: ObjectId;
    remarks?: string;
  }>;

  remarks?: string;
  enrolledStudentId?: ObjectId;
  createdBy: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateApplicationInput {
  academicBatchId: string;
  classId: string;
  sectionId?: string;
  student: {
    firstName: string;
    lastName: string;
    dateOfBirth: string;
    gender: 'male' | 'female' | 'other';
    bloodGroup?: string;
    nationality?: string;
    religion?: string;
    caste?: string;
    category?: string;
    motherTongue?: string;
  };
  contact: {
    email?: string;
    phone: string;
    alternatePhone?: string;
    address: {
      street?: string;
      city: string;
      state: string;
      pincode: string;
      country: string;
    };
  };
  parents: {
    father?: {
      name: string;
      phone?: string;
      email?: string;
      occupation?: string;
      qualification?: string;
      annualIncome?: number;
    };
    mother?: {
      name: string;
      phone?: string;
      email?: string;
      occupation?: string;
      qualification?: string;
    };
    guardian?: {
      name: string;
      relation: string;
      phone: string;
      email?: string;
    };
  };
  previousEducation?: {
    schoolName?: string;
    board?: string;
    class?: string;
    percentage?: number;
    yearOfPassing?: number;
    tcNumber?: string;
  };
  source: string;
  leadId?: string;
  referredBy?: string;
}

export interface ApplicationListParams {
  /** Caller's scoped classes (middleware/scope.ts); null/undefined = unrestricted. */
  restrictToClassIds?: ObjectId[] | null;
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  classId?: string;
  academicBatchId?: string;
  fromDate?: string;
  toDate?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

class ApplicationService {
  private async generateApplicationNumber(tenantId: string, branchId: string): Promise<string> {
    const year = new Date().getFullYear().toString().slice(-2);
    const count = await collections.applications.countDocuments({
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
    });
    return `APP${year}${String(count + 1).padStart(5, '0')}`;
  }

  async create(
    tenantId: string,
    branchId: string,
    data: CreateApplicationInput,
    createdBy: string
  ) {
    // Validate ObjectId formats
    const isValidObjectId = (id: string | undefined): boolean => {
      if (!id) return false;
      return /^[a-fA-F0-9]{24}$/.test(id);
    };

    if (!isValidObjectId(data.academicBatchId)) {
      throw new ApiError('INVALID_FIELD', `Invalid academicBatchId: ${data.academicBatchId}`, 400);
    }
    if (!isValidObjectId(data.classId)) {
      throw new ApiError('INVALID_FIELD', `Invalid classId: ${data.classId}`, 400);
    }
    if (data.sectionId && !isValidObjectId(data.sectionId)) {
      throw new ApiError('INVALID_FIELD', `Invalid sectionId: ${data.sectionId}`, 400);
    }
    if (data.leadId && !isValidObjectId(data.leadId)) {
      throw new ApiError('INVALID_FIELD', `Invalid leadId: ${data.leadId}`, 400);
    }

    const applicationId = new ObjectId();
    const now = new Date();
    const applicationNumber = await this.generateApplicationNumber(tenantId, branchId);

    const application: Omit<ApplicationDocument, '_id'> & { _id: ObjectId } = {
      _id: applicationId,
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
      applicationNumber,
      academicBatchId: new ObjectId(data.academicBatchId),
      classId: new ObjectId(data.classId),
      sectionId: data.sectionId ? new ObjectId(data.sectionId) : undefined,
      student: {
        ...data.student,
        dateOfBirth: new Date(data.student.dateOfBirth),
      },
      contact: data.contact,
      parents: data.parents,
      previousEducation: data.previousEducation,
      source: data.source,
      leadId: data.leadId ? new ObjectId(data.leadId) : undefined,
      referredBy: data.referredBy,
      status: 'submitted',
      statusHistory: [
        {
          status: 'submitted',
          changedAt: now,
          changedBy: new ObjectId(createdBy),
        },
      ],
      createdBy: new ObjectId(createdBy),
      createdAt: now,
      updatedAt: now,
    };

    await collections.applications.insertOne(application);

    // If created from a lead, update the lead to converted
    if (data.leadId) {
      await collections.leads.updateOne({ _id: new ObjectId(data.leadId) }, {
        $set: {
          stage: 'converted',
          status: 'converted',
          applicationId: applicationId,
          updatedAt: now,
        },
        $push: {
          stageHistory: {
            stage: 'converted',
            date: now,
            changedBy: new ObjectId(createdBy),
            notes: `Application ${applicationNumber} created`,
          },
        },
      } as unknown as import('mongodb').UpdateFilter<Document>);
    }

    logger.info(
      { applicationId: applicationId.toString(), applicationNumber, tenantId },
      'Application created'
    );

    return this.formatApplication(application as WithId<ApplicationDocument>);
  }

  async findById(tenantId: string, applicationId: string) {
    const application = (await collections.applications.findOne({
      _id: new ObjectId(applicationId),
      tenantId: new ObjectId(tenantId),
    })) as WithId<ApplicationDocument> | null;

    if (!application) {
      throw new ApiError('APPLICATION_NOT_FOUND', 'Application not found', 404);
    }

    return this.formatApplication(application);
  }

  async findAll(tenantId: string, branchId: string, params: ApplicationListParams = {}) {
    const {
      page = 1,
      limit = 20,
      search,
      status,
      classId,
      academicBatchId,
      fromDate,
      toDate,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = params;

    const filter: Filter<Document> = {
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
    };

    if (params.restrictToClassIds) {
      // $and so an explicit class filter below can only narrow, never widen.
      filter.$and = [{ classId: { $in: params.restrictToClassIds } }];
    }

    if (search) {
      filter.$or = [
        { applicationNumber: { $regex: search, $options: 'i' } },
        { 'student.firstName': { $regex: search, $options: 'i' } },
        { 'student.lastName': { $regex: search, $options: 'i' } },
        { 'contact.phone': { $regex: search, $options: 'i' } },
      ];
    }

    if (status) {
      filter.status = status;
    }

    if (classId) {
      filter.classId = new ObjectId(classId);
    }

    if (academicBatchId) {
      filter.academicBatchId = new ObjectId(academicBatchId);
    }

    if (fromDate || toDate) {
      filter.createdAt = {};
      if (fromDate) {
        (filter.createdAt as Record<string, Date>).$gte = new Date(fromDate);
      }
      if (toDate) {
        (filter.createdAt as Record<string, Date>).$lte = new Date(toDate);
      }
    }

    const skip = (page - 1) * limit;
    const sortDirection = sortOrder === 'asc' ? 1 : -1;

    const [applications, total] = await Promise.all([
      collections.applications
        .aggregate([
          { $match: filter },
          { $sort: { [sortBy]: sortDirection, _id: sortDirection } },
          { $skip: skip },
          { $limit: limit },
          {
            $lookup: {
              from: 'classes',
              localField: 'classId',
              foreignField: '_id',
              as: 'class',
            },
          },
          { $unwind: { path: '$class', preserveNullAndEmptyArrays: true } },
        ])
        .toArray() as Promise<WithId<ApplicationDocument>[]>,
      collections.applications.countDocuments(filter),
    ]);

    return {
      data: applications.map((a) => this.formatApplication(a)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: skip + applications.length < total,
      },
    };
  }

  async update(tenantId: string, applicationId: string, data: Partial<CreateApplicationInput>) {
    const existing = (await collections.applications.findOne({
      _id: new ObjectId(applicationId),
      tenantId: new ObjectId(tenantId),
    })) as WithId<ApplicationDocument> | null;

    if (!existing) {
      throw new ApiError('APPLICATION_NOT_FOUND', 'Application not found', 404);
    }

    if (existing.status === 'enrolled') {
      throw new ApiError('CANNOT_UPDATE', 'Cannot update enrolled application', 400);
    }

    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (data.academicBatchId) updateData.academicBatchId = new ObjectId(data.academicBatchId);
    if (data.classId) updateData.classId = new ObjectId(data.classId);
    if (data.sectionId) updateData.sectionId = new ObjectId(data.sectionId);
    if (data.student) {
      updateData.student = {
        ...data.student,
        dateOfBirth: data.student.dateOfBirth
          ? new Date(data.student.dateOfBirth)
          : existing.student.dateOfBirth,
      };
    }
    if (data.contact) updateData.contact = data.contact;
    if (data.parents) updateData.parents = data.parents;
    if (data.previousEducation) updateData.previousEducation = data.previousEducation;

    await collections.applications.updateOne(
      { _id: new ObjectId(applicationId) },
      { $set: updateData }
    );

    logger.info({ applicationId, tenantId }, 'Application updated');

    return this.findById(tenantId, applicationId);
  }

  async updateStatus(
    tenantId: string,
    applicationId: string,
    status: ApplicationDocument['status'],
    userId: string,
    remarks?: string
  ) {
    const existing = (await collections.applications.findOne({
      _id: new ObjectId(applicationId),
      tenantId: new ObjectId(tenantId),
    })) as WithId<ApplicationDocument> | null;

    if (!existing) {
      throw new ApiError('APPLICATION_NOT_FOUND', 'Application not found', 404);
    }

    const statusEntry = {
      status,
      changedAt: new Date(),
      changedBy: new ObjectId(userId),
      remarks,
    };

    await collections.applications.updateOne({ _id: new ObjectId(applicationId) }, {
      $set: {
        status,
        remarks,
        updatedAt: new Date(),
      },
      $push: { statusHistory: statusEntry },
    } as unknown as import('mongodb').UpdateFilter<Document>);

    // Reverse sync to linked lead
    if (existing.leadId) {
      const now = new Date();
      if (status === 'rejected') {
        await collections.leads.updateOne({ _id: existing.leadId }, {
          $set: {
            stage: 'lost',
            status: 'lost',
            lostReason: remarks || 'Application rejected',
            updatedAt: now,
          },
          $push: {
            stageHistory: {
              stage: 'lost',
              date: now,
              changedBy: new ObjectId(userId),
              notes: `Application ${existing.applicationNumber} rejected${remarks ? ': ' + remarks : ''}`,
            },
          },
        } as unknown as import('mongodb').UpdateFilter<Document>);
      }
    }

    logger.info({ applicationId, status, tenantId }, 'Application status updated');

    return this.findById(tenantId, applicationId);
  }

  async convertFromLead(
    tenantId: string,
    branchId: string,
    leadId: string,
    additionalData: Partial<CreateApplicationInput>,
    createdBy: string
  ) {
    // Validate leadId format
    if (!leadId || !/^[a-fA-F0-9]{24}$/.test(leadId)) {
      throw new ApiError('INVALID_FIELD', `Invalid leadId format: ${leadId}`, 400);
    }

    const lead = await collections.leads.findOne({
      _id: new ObjectId(leadId),
      tenantId: new ObjectId(tenantId),
    });

    if (!lead) {
      throw new ApiError('LEAD_NOT_FOUND', 'Lead not found', 404);
    }

    // Get names from lead - leads store firstName/lastName separately
    const firstName = (lead.firstName as string) || '';
    const lastName = (lead.lastName as string) || '';
    const contactPhone = (lead.contact?.phone as string) || '';
    const contactEmail = (lead.contact?.email as string) || '';
    const parentName =
      (lead.parents?.father?.name as string) || (lead.parents?.mother?.name as string) || '';

    // Helper to validate ObjectId format
    const isValidObjectId = (id: string | undefined): boolean => {
      if (!id) return false;
      return /^[a-fA-F0-9]{24}$/.test(id);
    };

    // Determine classId and academicBatchId - these are required
    const classId = (lead.interestedIn?.classId as ObjectId)?.toString() || additionalData.classId;
    const academicBatchId = additionalData.academicBatchId;

    if (!academicBatchId) {
      throw new ApiError(
        'MISSING_FIELD',
        'Academic batch is required to convert lead to application',
        400
      );
    }

    if (!isValidObjectId(academicBatchId)) {
      throw new ApiError(
        'INVALID_FIELD',
        `Invalid academicBatchId format: ${academicBatchId}`,
        400
      );
    }

    if (!classId) {
      throw new ApiError('MISSING_FIELD', 'Class is required to convert lead to application', 400);
    }

    if (!isValidObjectId(classId)) {
      throw new ApiError('INVALID_FIELD', `Invalid classId format: ${classId}`, 400);
    }

    if (additionalData.sectionId && !isValidObjectId(additionalData.sectionId)) {
      throw new ApiError(
        'INVALID_FIELD',
        `Invalid sectionId format: ${additionalData.sectionId}`,
        400
      );
    }

    if (!additionalData.student?.dateOfBirth) {
      throw new ApiError(
        'MISSING_FIELD',
        'Student date of birth is required to convert lead to application',
        400
      );
    }

    // Build application data from lead
    const applicationData: CreateApplicationInput = {
      academicBatchId,
      classId,
      sectionId: additionalData.sectionId,
      student: {
        ...additionalData.student,
        firstName: firstName || additionalData.student?.firstName || '',
        lastName: lastName || additionalData.student?.lastName || '',
        dateOfBirth: additionalData.student.dateOfBirth,
        gender: additionalData.student?.gender || 'male',
      },
      contact: {
        ...additionalData.contact,
        phone: contactPhone || additionalData.contact?.phone || '',
        email: contactEmail || additionalData.contact?.email,
        address: additionalData.contact?.address || {
          city: '',
          state: '',
          pincode: '',
          country: 'India',
        },
      },
      parents: additionalData.parents || {
        father: parentName
          ? {
              name: parentName,
              phone: contactPhone,
            }
          : undefined,
      },
      previousEducation: additionalData.previousEducation,
      source: (lead.source as string) || 'lead_conversion',
      leadId,
      referredBy: lead.referredBy as string,
    };

    return this.create(tenantId, branchId, applicationData, createdBy);
  }

  async enroll(
    tenantId: string,
    applicationId: string,
    enrollmentData: EnrollApplicationInput,
    userId: string
  ) {
    const application = (await collections.applications.findOne({
      _id: new ObjectId(applicationId),
      tenantId: new ObjectId(tenantId),
    })) as WithId<ApplicationDocument> | null;

    if (!application) {
      throw new ApiError('APPLICATION_NOT_FOUND', 'Application not found', 404);
    }

    if (application.status !== 'fee_paid' && application.status !== 'approved') {
      throw new ApiError(
        'NOT_READY',
        `Cannot enroll: application is currently "${application.status}". It must be "fee_paid" or "approved" before enrollment.`,
        400
      );
    }

    // Generate admission number if not provided
    const admissionNumber =
      enrollmentData.admissionNumber ||
      (await nextAdmissionNumber(
        tenantId,
        application.branchId.toString(),
        application.academicBatchId.toString(),
        application.classId.toString()
      ));

    const now = new Date();
    const studentId = new ObjectId();

    // Fetch class and section names for currentEnrollment
    const sectionId = enrollmentData.sectionId
      ? new ObjectId(enrollmentData.sectionId)
      : application.sectionId;

    const [classDoc, sectionDoc] = await Promise.all([
      collections.classes.findOne({ _id: application.classId }),
      sectionId ? collections.sections.findOne({ _id: sectionId }) : null,
    ]);

    const className = (classDoc as { displayName?: string } | null)?.displayName || 'Unknown Class';
    const sectionName = (sectionDoc as { name?: string } | null)?.name || '';

    // ── Pre-validate electives against the class's elective subjects ──
    const electives = await this.validateAndResolveElectives(
      tenantId,
      classDoc as WithId<Document> | null,
      enrollmentData.electiveSubjectIds
    );

    // ── Pre-validate transport (bus exists, stop exists, has capacity) ──
    const transportPlan = await this.validateTransportSelection(
      tenantId,
      application.branchId.toString(),
      enrollmentData.transport
    );

    // Create student record
    const firstName = application.student.firstName;
    const lastName = application.student.lastName;
    const displayName = `${firstName}${lastName ? ' ' + lastName : ''}`.trim();

    const studentData = {
      _id: studentId,
      tenantId: application.tenantId,
      branchId: application.branchId,
      admissionNumber,
      rollNumber: enrollmentData.rollNumber,
      firstName,
      lastName,
      displayName,
      dateOfBirth: application.student.dateOfBirth,
      gender: application.student.gender,
      bloodGroup: application.student.bloodGroup,
      nationality: application.student.nationality,
      religion: application.student.religion,
      caste: application.student.caste,
      category: application.student.category,
      ...(enrollmentData.admissionCategory && {
        admissionCategory: enrollmentData.admissionCategory,
      }),
      motherTongue: application.student.motherTongue,
      photo: application.student.photo,
      contact: application.contact,
      parents: application.parents,
      previousEducation: application.previousEducation,
      admissionDate: enrollmentData.admissionDate ? new Date(enrollmentData.admissionDate) : now,
      currentEnrollment: {
        academicBatchId: application.academicBatchId,
        classId: application.classId,
        sectionId: sectionId,
        className,
        sectionName,
        ...(electives.length > 0
          ? {
              electiveSubjectIds: electives.map((e) => e.subjectId),
              electives: electives.map((e) => ({
                subjectId: e.subjectId.toString(),
                name: e.name,
                code: e.code,
              })),
            }
          : {}),
      },
      applicationId: application._id,
      status: 'active',
      createdBy: new ObjectId(userId),
      createdAt: now,
      updatedAt: now,
    };

    await collections.students.insertOne(studentData);

    // Enrollment history, as for students added directly.
    await collections.studentEnrollments.insertOne({
      tenantId: application.tenantId,
      branchId: application.branchId,
      studentId,
      academicBatchId: application.academicBatchId,
      classId: application.classId,
      sectionId,
      rollNumber: enrollmentData.rollNumber,
      enrollmentDate: now,
      enrollmentType: 'new',
      status: 'active',
      createdBy: new ObjectId(userId),
      createdAt: now,
      updatedAt: now,
    });

    // The same portal login a directly-added student gets (temporary password,
    // set their own on first sign-in). Never blocks the admission.
    const { tempPassword } = await studentService.ensurePortalAccount(
      tenantId,
      application.branchId.toString(),
      studentId,
      {
        email: (application.contact as { email?: string } | undefined)?.email,
        firstName,
        lastName,
      },
      userId
    );

    // ── Transport enrollment: create record + mirror on student.services.transport ──
    if (transportPlan) {
      try {
        const transportEnrollment = await transportEnrollmentService.create(
          tenantId,
          application.branchId.toString(),
          {
            busId: transportPlan.busId,
            studentId: studentId.toString(),
            stopId: transportPlan.stopId,
            pickupEnabled: transportPlan.pickupEnabled,
            dropEnabled: transportPlan.dropEnabled,
            priceOverride: transportPlan.priceOverride,
          },
          userId
        );

        await collections.students.updateOne(
          { _id: studentId },
          {
            $set: {
              'services.transport': {
                isAvailing: true,
                enrollmentId: new ObjectId(transportEnrollment._id),
                busId: new ObjectId(transportEnrollment.busId),
                busNumber: transportEnrollment.busNumber,
                busName: transportEnrollment.busName,
                routeId: new ObjectId(transportEnrollment.busId),
                stopId: new ObjectId(transportEnrollment.stopId),
                stopName: transportEnrollment.stopName,
                pickupTime: transportPlan.pickupTime,
                dropTime: transportPlan.dropTime,
              },
              updatedAt: now,
            },
          }
        );
      } catch (error) {
        logger.error(
          { studentId: studentId.toString(), error },
          'Transport enrollment failed after student creation; student record persisted without transport'
        );
        // Do not fail the whole admission enrollment. Admin can retry via
        // Transport → Enrollments for this student.
      }
    }

    // Update application status
    const statusEntry = {
      status: 'enrolled',
      changedAt: now,
      changedBy: new ObjectId(userId),
      remarks: `Enrolled as student ${admissionNumber}`,
    };

    await collections.applications.updateOne({ _id: application._id }, {
      $set: {
        status: 'enrolled',
        enrolledStudentId: studentId,
        updatedAt: now,
      },
      $push: { statusHistory: statusEntry },
    } as unknown as import('mongodb').UpdateFilter<Document>);

    // Update lead if exists
    if (application.leadId) {
      await collections.leads.updateOne({ _id: application.leadId }, {
        $set: {
          stage: 'converted',
          status: 'converted',
          enrolledStudentId: studentId,
          updatedAt: now,
        },
        $push: {
          stageHistory: {
            stage: 'converted',
            date: now,
            changedBy: new ObjectId(userId),
            notes: `Student enrolled with admission number ${admissionNumber}`,
          },
        },
      } as unknown as import('mongodb').UpdateFilter<Document>);
    }

    logger.info(
      { applicationId, studentId: studentId.toString(), admissionNumber, tenantId },
      'Application enrolled as student'
    );

    // Fee assignment: explicit selection takes priority over auto-assign.
    // Transport fee structures are assigned when transport is opted in OR
    // when the actual transport enrollment succeeded.
    const effectiveTransportOptIn =
      enrollmentData.transport?.optIn === true ||
      enrollmentData.transportOptIn === true ||
      transportPlan !== null;

    this.handleFeeAssignment(
      tenantId,
      application.branchId.toString(),
      studentId.toString(),
      application.classId.toString(),
      sectionId?.toString(),
      application.academicBatchId.toString(),
      {
        feeStructureIds: enrollmentData.feeStructureIds,
        transportOptIn: effectiveTransportOptIn,
        concession: enrollmentData.concession,
      },
      userId
    ).catch((err) => {
      logger.error(
        { studentId: studentId.toString(), err },
        'Fee assignment failed for enrolled student'
      );
    });

    return {
      studentId: studentId.toString(),
      admissionNumber,
      tempPassword,
      message: 'Student enrolled successfully',
    };
  }

  private async handleFeeAssignment(
    tenantId: string,
    branchId: string,
    studentId: string,
    classId: string,
    sectionId: string | undefined,
    academicBatchId: string,
    enrollmentData: {
      feeStructureIds?: string[];
      transportOptIn?: boolean;
      concession?: {
        type: 'scholarship' | 'staff-ward' | 'sibling' | 'merit' | 'need-based' | 'custom';
        name: string;
        discountType: 'percentage' | 'fixed';
        discountValue: number;
        appliedTo: 'total' | 'tuition' | 'specific';
        specificComponents?: string[];
        reason?: string;
      };
    },
    userId: string
  ): Promise<void> {
    // 1. Fee structure assignment: explicit selection or auto-assign
    if (enrollmentData.feeStructureIds && enrollmentData.feeStructureIds.length > 0) {
      for (const structureId of enrollmentData.feeStructureIds) {
        try {
          await feeAssignmentService.create(
            tenantId,
            branchId,
            { studentId, feeStructureId: structureId, academicBatchId },
            userId
          );
        } catch (error) {
          if (error instanceof ApiError && error.code === 'ASSIGNMENT_EXISTS') continue;
          logger.error(
            { studentId, structureId, error },
            'Fee assignment failed during enrollment'
          );
        }
      }
    } else {
      await feeStructureService.autoAssignForStudent(
        tenantId,
        branchId,
        studentId,
        classId,
        sectionId,
        academicBatchId,
        userId
      );
    }

    // 2. Transport opt-in: assign the branch's generic transport structures,
    // unless the bus enrollment already billed this student its own fare.
    const busBilled =
      enrollmentData.transportOptIn &&
      (await collections.feeAssignments.countDocuments({
        tenantId: new ObjectId(tenantId),
        studentId: new ObjectId(studentId),
        type: 'transport',
        status: { $ne: 'cancelled' },
      })) > 0;
    if (enrollmentData.transportOptIn && !busBilled) {
      const transportStructures = await collections.feeStructures
        .find({
          tenantId: new ObjectId(tenantId),
          branchId: new ObjectId(branchId),
          isActive: true,
          category: 'transport',
          // Per-enrollment fares (transportFee.service) belong to one student.
          code: { $not: /^TRANSPORT-[0-9a-f]{24}$/ },
        })
        .toArray();

      for (const ts of transportStructures) {
        try {
          await feeAssignmentService.create(
            tenantId,
            branchId,
            { studentId, feeStructureId: ts._id.toString(), academicBatchId },
            userId
          );
        } catch (error) {
          if (error instanceof ApiError && error.code === 'ASSIGNMENT_EXISTS') continue;
          logger.error(
            { studentId, structureId: ts._id.toString(), error },
            'Transport fee assignment failed during enrollment'
          );
        }
      }
    }

    // 3. Concession: create a concession request if specified
    if (enrollmentData.concession) {
      const primaryAssignment = await collections.feeAssignments.findOne({
        tenantId: new ObjectId(tenantId),
        studentId: new ObjectId(studentId),
        status: 'active',
      });

      if (primaryAssignment) {
        try {
          // appliedTo for concession service is an array of component codes:
          // empty array = apply to all, otherwise specific component codes
          const appliedTo =
            enrollmentData.concession.appliedTo === 'specific' &&
            enrollmentData.concession.specificComponents
              ? enrollmentData.concession.specificComponents
              : [];

          await concessionService.create(
            tenantId,
            branchId,
            {
              studentId,
              feeAssignmentId: primaryAssignment._id.toString(),
              academicBatchId,
              type: enrollmentData.concession.type,
              name: enrollmentData.concession.name,
              discountType: enrollmentData.concession.discountType,
              discountValue: enrollmentData.concession.discountValue,
              appliedTo,
              reason: enrollmentData.concession.reason || 'Applied during enrollment',
            },
            userId
          );
        } catch (error) {
          logger.error({ studentId, error }, 'Concession creation failed during enrollment');
        }
      } else {
        logger.warn({ studentId }, 'No fee assignment found for concession during enrollment');
      }
    }
  }

  /**
   * Verify that the caller's selected elective subject IDs are all mapped to
   * the class and of type `elective` (or `language`, which we treat as an
   * opt-in subject too). Returns a denormalized list ready to persist on the
   * student so the UI can render without an extra join.
   */
  private async validateAndResolveElectives(
    tenantId: string,
    classDoc: WithId<Document> | null,
    electiveSubjectIds: string[] | undefined
  ): Promise<Array<{ subjectId: ObjectId; name: string; code: string }>> {
    if (!electiveSubjectIds || electiveSubjectIds.length === 0) return [];
    if (!classDoc) {
      throw new ApiError('CLASS_NOT_FOUND', 'Class for this application no longer exists', 404);
    }

    const classSubjects =
      (classDoc as { subjects?: Array<{ subjectId: ObjectId }> }).subjects ?? [];
    const mappedIds = new Set(classSubjects.map((s) => s.subjectId.toString()));

    for (const id of electiveSubjectIds) {
      if (!mappedIds.has(id)) {
        throw new ApiError(
          'INVALID_ELECTIVE',
          `Subject ${id} is not part of this class's curriculum`,
          400
        );
      }
    }

    const subjectDocs = await collections.subjects
      .find({
        _id: { $in: electiveSubjectIds.map((id) => new ObjectId(id)) },
        tenantId: new ObjectId(tenantId),
      })
      .toArray();

    const nonElective = subjectDocs.find(
      (s) => (s.type as string) !== 'elective' && (s.type as string) !== 'language'
    );
    if (nonElective) {
      throw new ApiError(
        'INVALID_ELECTIVE',
        `Subject "${nonElective.name as string}" is a core subject and cannot be chosen as an elective`,
        400
      );
    }

    if (subjectDocs.length !== electiveSubjectIds.length) {
      throw new ApiError('INVALID_ELECTIVE', 'One or more elective subjects not found', 404);
    }

    return subjectDocs.map((s) => ({
      subjectId: s._id,
      name: s.name as string,
      code: s.code as string,
    }));
  }

  /**
   * Check that the caller's transport opt-in is internally consistent: bus
   * exists on this branch, is active, has capacity, and the stop belongs to
   * it. Returns a normalized plan to pass to the transport enrollment
   * service, or `null` if transport wasn't requested.
   */
  private async validateTransportSelection(
    tenantId: string,
    branchId: string,
    transport: EnrollApplicationInput['transport']
  ): Promise<{
    busId: string;
    stopId: string;
    pickupEnabled: boolean;
    dropEnabled: boolean;
    pickupTime?: string;
    dropTime?: string;
    priceOverride?: number;
  } | null> {
    if (!transport || !transport.optIn) return null;
    if (!transport.busId || !transport.stopId) {
      throw new ApiError(
        'TRANSPORT_INCOMPLETE',
        'Bus and stop must be provided when opting into transport',
        400
      );
    }

    const bus = await collections.transportBuses.findOne({
      _id: new ObjectId(transport.busId),
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
      status: 'active',
    });

    if (!bus) {
      throw new ApiError('BUS_NOT_FOUND', 'Selected bus is not available on this branch', 404);
    }

    if ((bus.enrolledCount || 0) >= (bus.capacity as number)) {
      throw new ApiError('BUS_FULL', `Bus ${bus.busNumber as string} is at full capacity`, 400);
    }

    const stop = (
      bus.stops as Array<{ _id: ObjectId; pickupTime?: string; dropTime?: string }>
    ).find((s) => s._id.toString() === transport.stopId);

    if (!stop) {
      throw new ApiError('STOP_NOT_FOUND', 'Selected stop does not belong to this bus', 404);
    }

    return {
      busId: transport.busId,
      stopId: transport.stopId,
      pickupEnabled: transport.pickupEnabled ?? true,
      dropEnabled: transport.dropEnabled ?? true,
      pickupTime: stop.pickupTime,
      dropTime: stop.dropTime,
      priceOverride: transport.priceOverride,
    };
  }

  async getStats(tenantId: string, branchId: string) {
    const tenantObjId = new ObjectId(tenantId);
    const branchObjId = new ObjectId(branchId);

    const stats = await collections.applications
      .aggregate([
        {
          $match: {
            tenantId: tenantObjId,
            branchId: branchObjId,
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

    const result: Record<string, number> = {
      draft: 0,
      submitted: 0,
      under_review: 0,
      docs_verified: 0,
      fee_paid: 0,
      approved: 0,
      rejected: 0,
      enrolled: 0,
      withdrawn: 0,
      total: 0,
    };

    stats.forEach((s) => {
      result[s._id] = s.count;
      result.total += s.count;
    });

    return result;
  }

  async delete(tenantId: string, applicationId: string) {
    const application = (await collections.applications.findOne({
      _id: new ObjectId(applicationId),
      tenantId: new ObjectId(tenantId),
    })) as WithId<ApplicationDocument> | null;

    if (!application) {
      throw new ApiError('APPLICATION_NOT_FOUND', 'Application not found', 404);
    }

    if (application.status === 'enrolled') {
      throw new ApiError('CANNOT_DELETE', 'Cannot delete enrolled application', 400);
    }

    await collections.applications.deleteOne({ _id: new ObjectId(applicationId) });

    logger.info({ applicationId, tenantId }, 'Application deleted');

    return { success: true };
  }

  private formatApplication(application: WithId<ApplicationDocument>) {
    return {
      _id: application._id.toString(),
      tenantId: application.tenantId.toString(),
      branchId: application.branchId.toString(),
      applicationNumber: application.applicationNumber,
      academicBatchId: application.academicBatchId.toString(),
      classId: application.classId.toString(),
      className: (application as unknown as { class?: { name: string } }).class?.name,
      sectionId: application.sectionId?.toString(),
      student: {
        ...application.student,
        dateOfBirth: application.student.dateOfBirth,
      },
      contact: application.contact,
      parents: application.parents,
      previousEducation: application.previousEducation,
      documents: application.documents,
      source: application.source,
      leadId: application.leadId?.toString(),
      referredBy: application.referredBy,
      applicationFee: application.applicationFee,
      status: application.status,
      statusHistory: application.statusHistory?.map((h) => ({
        ...h,
        changedBy: h.changedBy.toString(),
      })),
      remarks: application.remarks,
      enrolledStudentId: application.enrolledStudentId?.toString(),
      createdBy: application.createdBy.toString(),
      createdAt: application.createdAt,
      updatedAt: application.updatedAt,
    };
  }
}

export const applicationService = new ApplicationService();
