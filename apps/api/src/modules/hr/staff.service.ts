import { ObjectId, WithId, Document, Filter } from 'mongodb';
import bcrypt from 'bcryptjs';
import { collections } from '../../config/database';
import { logger } from '../../lib/logger';
import { ApiError } from '../../middleware/errorHandler';
import { intersectScope } from '../../middleware/scope';
import { hrSettingsService } from './hrSettings.service';
import { razorpayXPayoutService } from './razorpayXPayout.service';
import { teachingAssignmentService } from '../teaching/teachingAssignment.service';
import { generatePassword } from '../../utils/generators';
import { emailService } from '../../services/email.service';

interface StaffDocument extends Document {
  _id: ObjectId;
  tenantId: ObjectId;
  branchId: ObjectId;
  additionalBranches?: ObjectId[];
  employeeId: string;
  userId?: ObjectId;
  firstName: string;
  lastName: string;
  displayName: string;
  dateOfBirth?: Date;
  gender?: string;
  bloodGroup?: string;
  nationality?: string;
  photo?: string;
  contact: {
    email: string;
    phone: string;
    alternatePhone?: string;
    emergencyContact?: {
      name: string;
      relation: string;
      phone: string;
    };
    address?: {
      current?: {
        line1?: string;
        line2?: string;
        city?: string;
        state?: string;
        country?: string;
        pincode?: string;
      };
      permanent?: {
        line1?: string;
        line2?: string;
        city?: string;
        state?: string;
        country?: string;
        pincode?: string;
      };
    };
  };
  employment: {
    joiningDate: Date;
    confirmationDate?: Date;
    employmentType: 'permanent' | 'contract' | 'part-time' | 'visiting';
    departmentId?: ObjectId;
    designationId?: ObjectId;
    reportingTo?: ObjectId;
    noticePeriod?: number;
  };
  teaching?: {
    isTeaching: boolean;
    subjects?: Array<{
      subjectId: ObjectId;
      classIds: ObjectId[];
    }>;
    classTeacherOf?: ObjectId;
    periodsPerWeek?: number;
  };
  qualifications?: Array<{
    degree: string;
    specialization?: string;
    institution: string;
    year?: number;
    percentage?: number;
  }>;
  experience?: Array<{
    organization: string;
    designation: string;
    fromDate?: Date;
    toDate?: Date;
    responsibilities?: string;
  }>;
  bankDetails?: {
    accountNumber?: string;
    bankName?: string;
    ifscCode?: string;
    accountType?: string;
  };
  documents?: Array<{
    type: string;
    number?: string;
    url?: string;
    verifiedAt?: Date;
  }>;
  status: 'active' | 'inactive' | 'on-leave' | 'resigned' | 'terminated';
  statusHistory: Array<{
    status: string;
    date: Date;
    reason?: string;
    changedBy: ObjectId;
  }>;
  exitDate?: Date;
  exitReason?: string;
  customFields?: Record<string, unknown>;
  // Approval workflow — staff created by lower-level admins require
  // Group Owner / Org Admin approval before user account + email.
  approvalStatus?: 'approved' | 'pending_approval' | 'rejected';
  approvalRequestedBy?: ObjectId;
  approvalDecidedBy?: ObjectId;
  approvalDecidedAt?: Date;
  requestedRoleCode?: string;
  requestedAccessScope?: CreateStaffInput['accessScope'];
  requestedPasswordHash?: string;
  rejectionReason?: string;
  createdBy: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateStaffInput {
  firstName: string;
  lastName: string;
  dateOfBirth?: string;
  gender?: string;
  bloodGroup?: string;
  nationality?: string;
  photo?: string;
  contact: {
    email: string;
    phone: string;
    alternatePhone?: string;
    emergencyContact?: {
      name: string;
      relation: string;
      phone: string;
    };
    address?: {
      current?: Record<string, string>;
      permanent?: Record<string, string>;
    };
  };
  employment: {
    joiningDate: string;
    confirmationDate?: string;
    employmentType: 'permanent' | 'contract' | 'part-time' | 'visiting';
    departmentId?: string;
    designationId?: string;
    reportingTo?: string;
    noticePeriod?: number;
  };
  teaching?: {
    isTeaching: boolean;
    subjects?: Array<{
      subjectId: string;
      classIds: string[];
    }>;
    classTeacherOf?: string;
    periodsPerWeek?: number;
  };
  qualifications?: Array<{
    degree: string;
    specialization?: string;
    institution: string;
    year?: number;
    percentage?: number;
  }>;
  customFields?: Record<string, unknown>;
  /** Optional role override. Defaults to TEACHER/RECEPTIONIST based on isTeaching. */
  roleCode?: string;
  /**
   * What the staff login may see. Defaults to the whole campus; an HOD gets
   * their department, an institution admin their institution.
   */
  accessScope?: {
    type: 'branch' | 'institution' | 'department' | 'program';
    institutionIds?: string[];
    departmentIds?: string[];
    programIds?: string[];
  };
  /** Initial password chosen by the admin; otherwise a temporary one is emailed. */
  password?: string;
  /** Internal: the hashed admin-chosen password carried through approval. */
  passwordHash?: string;
}

export interface StaffListParams {
  page?: number;
  limit?: number;
  search?: string;
  departmentId?: string;
  /** Scope guard: department ids the caller is confined to (null = unrestricted). */
  restrictToDepartmentIds?: ObjectId[] | null;
  designationId?: string;
  status?: string;
  employmentType?: string;
  isTeaching?: boolean;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * The login scope for a new staff member. Every id must belong to this campus:
 * an admin cannot grant another campus's institution or department.
 */
async function buildStaffScope(
  tenantId: string,
  branchId: string,
  scope?: CreateStaffInput['accessScope']
) {
  const branchIds = [new ObjectId(branchId)];
  if (!scope || scope.type === 'branch') return { type: 'branch' as const, branchIds };
  const pick = {
    institution: {
      ids: scope.institutionIds,
      col: collections.institutions,
      key: 'institutionIds',
    },
    department: { ids: scope.departmentIds, col: collections.departments, key: 'departmentIds' },
    program: { ids: scope.programIds, col: collections.programs, key: 'programIds' },
  }[scope.type];
  const ids = (pick.ids ?? []).filter((id) => ObjectId.isValid(id)).map((id) => new ObjectId(id));
  if (ids.length === 0) {
    throw new ApiError(
      'SCOPE_REQUIRED',
      `Pick at least one ${scope.type} for this staff member`,
      400
    );
  }
  const found = await pick.col.countDocuments({
    _id: { $in: ids },
    tenantId: new ObjectId(tenantId),
    branchId: new ObjectId(branchId),
  });
  if (found !== ids.length) {
    throw new ApiError('SCOPE_OUT_OF_CAMPUS', `Every ${scope.type} must be on this campus`, 400);
  }
  return { type: scope.type, branchIds, [pick.key]: ids };
}

class StaffService {
  async create(
    tenantId: string,
    branchId: string,
    data: CreateStaffInput,
    createdBy: string,
    creatorRoleLevel: number = 0
  ) {
    // Check for duplicate email
    const existing = await collections.staff.findOne({
      tenantId: new ObjectId(tenantId),
      'contact.email': data.contact.email,
    });

    if (existing) {
      throw new ApiError('DUPLICATE_EMAIL', 'Staff with this email already exists', 409);
    }

    const staffId = new ObjectId();
    const employeeId = await hrSettingsService.generateEmployeeId(tenantId, branchId);
    const now = new Date();

    const staff: Omit<StaffDocument, '_id'> & { _id: ObjectId } = {
      _id: staffId,
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
      employeeId,
      firstName: data.firstName,
      lastName: data.lastName,
      displayName: `${data.firstName} ${data.lastName}`,
      dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : undefined,
      gender: data.gender,
      bloodGroup: data.bloodGroup,
      nationality: data.nationality,
      photo: data.photo,
      contact: {
        email: data.contact.email,
        phone: data.contact.phone,
        alternatePhone: data.contact.alternatePhone,
        emergencyContact: data.contact.emergencyContact,
        address: data.contact.address,
      },
      employment: {
        joiningDate: new Date(data.employment.joiningDate),
        confirmationDate: data.employment.confirmationDate
          ? new Date(data.employment.confirmationDate)
          : undefined,
        employmentType: data.employment.employmentType,
        ...(data.employment.departmentId && {
          departmentId: new ObjectId(data.employment.departmentId),
        }),
        ...(data.employment.designationId && {
          designationId: new ObjectId(data.employment.designationId),
        }),
        ...(data.employment.reportingTo && {
          reportingTo: new ObjectId(data.employment.reportingTo),
        }),
        noticePeriod: data.employment.noticePeriod,
      },
      teaching: data.teaching
        ? {
            isTeaching: data.teaching.isTeaching,
            subjects: data.teaching.subjects?.map((s) => ({
              subjectId: new ObjectId(s.subjectId),
              classIds: s.classIds.map((c) => new ObjectId(c)),
            })),
            ...(data.teaching.classTeacherOf && {
              classTeacherOf: new ObjectId(data.teaching.classTeacherOf),
            }),
            periodsPerWeek: data.teaching.periodsPerWeek,
          }
        : undefined,
      qualifications: data.qualifications,
      customFields: data.customFields,
      status: 'active',
      statusHistory: [
        {
          status: 'active',
          date: now,
          reason: 'Staff created',
          changedBy: new ObjectId(createdBy),
        },
      ],
      createdBy: new ObjectId(createdBy),
      createdAt: now,
      updatedAt: now,
    };

    // Determine the role code for the user account
    const autoRoleCode = data.teaching?.isTeaching ? 'TEACHER' : 'RECEPTIONIST';
    const roleCode = data.roleCode || autoRoleCode;

    // Approval logic: admins (level 0-2) create directly, others need approval
    if (creatorRoleLevel <= 2) {
      (staff as Record<string, unknown>).approvalStatus = 'approved';
    } else {
      (staff as Record<string, unknown>).approvalStatus = 'pending_approval';
      (staff as Record<string, unknown>).requestedRoleCode = roleCode;
      // Kept for approval, when the login is created (never the password).
      if (data.accessScope)
        (staff as Record<string, unknown>).requestedAccessScope = data.accessScope;
      // An admin-chosen password survives approval as a hash only.
      if (data.password) {
        (staff as Record<string, unknown>).requestedPasswordHash = await bcrypt.hash(
          data.password,
          12
        );
      }
      (staff as Record<string, unknown>).approvalRequestedBy = new ObjectId(createdBy);
    }

    await collections.staff.insertOne(staff);

    // Phase-5 bridge: mirror the class-granular teaching summary into the
    // canonical section-granular teaching_assignments (fire-and-forget).
    if (data.teaching?.subjects?.length) {
      void teachingAssignmentService
        .syncFromStaffTeaching(tenantId, staffId.toString(), data.teaching.subjects)
        .catch((err) => {
          logger.warn({ err, staffId: staffId.toString() }, 'Teaching-assignment sync failed');
        });
    }

    // Only create user account + send email if auto-approved
    if (creatorRoleLevel <= 2) {
      await this.createUserAndSendEmail(tenantId, branchId, staffId, data, roleCode, createdBy);
    } else {
      logger.info(
        { staffId: staffId.toString(), tenantId, createdBy },
        'Staff created with pending_approval — user account deferred until Group Owner approves'
      );
    }

    logger.info({ staffId: staffId.toString(), employeeId, tenantId, branchId }, 'Staff created');

    return this.formatStaff(staff as WithId<StaffDocument>);
  }

  /**
   * Approve a pending staff request. Creates the user account, sends the
   * welcome email, and flips the approval status to 'approved'.
   * Only callable by users with roleLevel <= 2.
   */
  async approveStaff(tenantId: string, staffId: string, approvedBy: string) {
    const staff = (await collections.staff.findOne({
      _id: new ObjectId(staffId),
      tenantId: new ObjectId(tenantId),
      approvalStatus: 'pending_approval',
    })) as WithId<StaffDocument> | null;

    if (!staff) {
      throw new ApiError('STAFF_NOT_FOUND', 'Pending staff request not found', 404);
    }

    const roleCode =
      (staff.requestedRoleCode as string) ||
      (staff.teaching?.isTeaching ? 'TEACHER' : 'RECEPTIONIST');

    await this.createUserAndSendEmail(
      tenantId,
      staff.branchId.toString(),
      staff._id,
      {
        firstName: staff.firstName,
        lastName: staff.lastName,
        contact: staff.contact as CreateStaffInput['contact'],
        employment: staff.employment as unknown as CreateStaffInput['employment'],
        teaching: staff.teaching as unknown as CreateStaffInput['teaching'],
        accessScope: staff.requestedAccessScope as CreateStaffInput['accessScope'],
        passwordHash: staff.requestedPasswordHash as string | undefined,
      } as CreateStaffInput,
      roleCode,
      approvedBy
    );

    await collections.staff.updateOne(
      { _id: staff._id },
      {
        $set: {
          approvalStatus: 'approved',
          approvalDecidedBy: new ObjectId(approvedBy),
          approvalDecidedAt: new Date(),
          updatedAt: new Date(),
        },
        $unset: { requestedPasswordHash: '' },
      }
    );

    logger.info({ staffId, tenantId, approvedBy }, 'Staff approved — user account created');

    return this.findById(tenantId, staffId);
  }

  /**
   * Reject a pending staff request.
   */
  async rejectStaff(tenantId: string, staffId: string, rejectedBy: string, reason?: string) {
    const result = await collections.staff.findOneAndUpdate(
      {
        _id: new ObjectId(staffId),
        tenantId: new ObjectId(tenantId),
        approvalStatus: 'pending_approval',
      },
      {
        $set: {
          approvalStatus: 'rejected',
          approvalDecidedBy: new ObjectId(rejectedBy),
          approvalDecidedAt: new Date(),
          rejectionReason: reason || undefined,
          updatedAt: new Date(),
        },
      },
      { returnDocument: 'after' }
    );

    if (!result) {
      throw new ApiError('STAFF_NOT_FOUND', 'Pending staff request not found', 404);
    }

    logger.info({ staffId, tenantId, rejectedBy, reason }, 'Staff request rejected');

    return this.formatStaff(result as WithId<StaffDocument>);
  }

  /**
   * List staff with pending approval status.
   */
  async getPendingApprovals(tenantId: string, branchId?: string) {
    const filter: Filter<Document> = {
      tenantId: new ObjectId(tenantId),
      approvalStatus: 'pending_approval',
    };
    if (branchId) {
      filter.branchId = new ObjectId(branchId);
    }

    const staff = (await collections.staff
      .find(filter)
      .sort({ createdAt: -1 })
      .toArray()) as WithId<StaffDocument>[];

    return staff.map((s) => this.formatStaff(s));
  }

  /**
   * Extract user-account creation + welcome email into a reusable helper.
   * Called both from create() (direct approval) and approveStaff().
   */
  private async createUserAndSendEmail(
    tenantId: string,
    branchId: string,
    staffId: ObjectId,
    data: CreateStaffInput,
    roleCode: string,
    createdBy: string
  ) {
    if (!data.contact?.email) return;

    const email = data.contact.email.toLowerCase();
    const existingUser = await collections.users.findOne({
      tenantId: new ObjectId(tenantId),
      email,
    });

    if (existingUser && !existingUser.staffId) {
      // User exists but not linked — link bidirectionally
      await collections.staff.updateOne(
        { _id: staffId },
        { $set: { userId: existingUser._id, updatedAt: new Date() } }
      );
      await collections.users.updateOne(
        { _id: existingUser._id },
        { $set: { staffId, updatedAt: new Date() } }
      );
      logger.info(
        { staffId: staffId.toString(), userId: existingUser._id.toString(), tenantId },
        'Auto-linked staff to existing user'
      );
      return;
    }

    if (existingUser) return; // already linked

    // No user exists — create one
    try {
      const role = await collections.roles.findOne({
        tenantId: new ObjectId(tenantId),
        code: roleCode,
      });

      if (!role) {
        logger.warn({ tenantId, roleCode }, 'Role not found, skipping user auto-creation');
        return;
      }

      const now = new Date();
      const accessScope = await buildStaffScope(tenantId, branchId, data.accessScope);
      // A password the admin chose is never emailed; otherwise a temporary one is.
      const adminSet = !!(data.password || data.passwordHash);
      const tempPassword = data.password || generatePassword();
      const passwordHash = data.passwordHash || (await bcrypt.hash(tempPassword, 12));
      const userId = new ObjectId();
      const displayName = `${data.firstName} ${data.lastName}`;

      await collections.users.insertOne({
        _id: userId,
        tenantId: new ObjectId(tenantId),
        email,
        phone: data.contact.phone,
        passwordHash,
        profile: {
          firstName: data.firstName,
          lastName: data.lastName,
          displayName,
        },
        roleId: role._id,
        accessScope,
        security: {
          mfaEnabled: false,
          passwordChangedAt: now,
          loginAttempts: 0,
          mustChangePassword: true,
        },
        status: 'pending',
        staffId,
        createdBy: new ObjectId(createdBy),
        createdAt: now,
        updatedAt: now,
      } as unknown as Parameters<typeof collections.users.insertOne>[0]);

      // Link staff to user
      await collections.staff.updateOne(
        { _id: staffId },
        { $set: { userId, updatedAt: new Date() } }
      );

      logger.info(
        { staffId: staffId.toString(), userId: userId.toString(), tenantId },
        'Auto-created user account for staff'
      );

      // Send welcome email (async — don't block)
      const tenant = await collections.tenants.findOne(
        { _id: new ObjectId(tenantId) },
        { projection: { name: 1 } }
      );
      emailService
        .sendUserWelcomeEmail(
          email,
          displayName,
          adminSet ? '(set by your administrator)' : tempPassword,
          tenant?.name || 'Your Organization',
          role.name
        )
        .catch((err) => {
          logger.error(
            { err, staffId: staffId.toString() },
            'Failed to send welcome email for staff'
          );
        });
    } catch (err: unknown) {
      const mongoErr = err as { code?: number };
      if (mongoErr.code === 11000) {
        // Race condition — link instead
        const raceUser = await collections.users.findOne({
          tenantId: new ObjectId(tenantId),
          email,
        });
        if (raceUser && !raceUser.staffId) {
          await collections.staff.updateOne(
            { _id: staffId },
            { $set: { userId: raceUser._id, updatedAt: new Date() } }
          );
          await collections.users.updateOne(
            { _id: raceUser._id },
            { $set: { staffId, updatedAt: new Date() } }
          );
        }
        logger.info({ tenantId, email }, 'Handled race condition during user auto-creation');
      } else {
        logger.error(
          { err, staffId: staffId.toString(), tenantId },
          'Failed to auto-create user for staff'
        );
      }
    }
  }

  async findById(tenantId: string, staffId: string) {
    const staff = (await collections.staff.findOne({
      _id: new ObjectId(staffId),
      tenantId: new ObjectId(tenantId),
    })) as WithId<StaffDocument> | null;

    if (!staff) {
      throw new ApiError('STAFF_NOT_FOUND', 'Staff not found', 404);
    }

    return this.formatStaff(staff);
  }

  async findAll(tenantId: string, branchId: string, params: StaffListParams = {}) {
    const {
      page = 1,
      limit = 20,
      search,
      departmentId,
      restrictToDepartmentIds,
      designationId,
      status,
      employmentType,
      isTeaching,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = params;

    const filter: Filter<Document> = {
      tenantId: new ObjectId(tenantId),
      $or: [{ branchId: new ObjectId(branchId) }, { additionalBranches: new ObjectId(branchId) }],
    };

    if (search) {
      filter.$and = [
        {
          $or: [
            { firstName: { $regex: search, $options: 'i' } },
            { lastName: { $regex: search, $options: 'i' } },
            { employeeId: { $regex: search, $options: 'i' } },
            { 'contact.email': { $regex: search, $options: 'i' } },
            { 'contact.phone': { $regex: search, $options: 'i' } },
          ],
        },
      ];
    }

    // Scope intersects the explicit filter: an out-of-scope departmentId
    // yields nothing rather than widening back to the whole branch.
    const departmentFilter = intersectScope(restrictToDepartmentIds ?? null, departmentId);
    if (departmentFilter !== undefined) {
      filter['employment.departmentId'] = departmentFilter;
    }

    if (designationId) {
      filter['employment.designationId'] = new ObjectId(designationId);
    }

    if (status) {
      filter.status = status;
    }

    if (employmentType) {
      filter['employment.employmentType'] = employmentType;
    }

    if (typeof isTeaching === 'boolean') {
      filter['teaching.isTeaching'] = isTeaching;
    }

    const skip = (page - 1) * limit;
    const sortDirection = sortOrder === 'asc' ? 1 : -1;

    const [staffList, total] = await Promise.all([
      collections.staff
        .find(filter)
        .sort({ [sortBy]: sortDirection, _id: sortDirection })
        .skip(skip)
        .limit(limit)
        .toArray() as Promise<WithId<StaffDocument>[]>,
      collections.staff.countDocuments(filter),
    ]);

    return {
      data: staffList.map((s) => this.formatStaff(s)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: skip + staffList.length < total,
      },
    };
  }

  async update(tenantId: string, staffId: string, data: Partial<CreateStaffInput>) {
    const existing = (await collections.staff.findOne({
      _id: new ObjectId(staffId),
      tenantId: new ObjectId(tenantId),
    })) as WithId<StaffDocument> | null;

    if (!existing) {
      throw new ApiError('STAFF_NOT_FOUND', 'Staff not found', 404);
    }

    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (data.firstName !== undefined) {
      updateData.firstName = data.firstName;
      updateData.displayName = `${data.firstName} ${data.lastName || existing.lastName}`;
    }
    if (data.lastName !== undefined) {
      updateData.lastName = data.lastName;
      updateData.displayName = `${data.firstName || existing.firstName} ${data.lastName}`;
    }
    if (data.dateOfBirth !== undefined) updateData.dateOfBirth = new Date(data.dateOfBirth);
    if (data.gender !== undefined) updateData.gender = data.gender;
    if (data.bloodGroup !== undefined) updateData.bloodGroup = data.bloodGroup;
    if (data.nationality !== undefined) updateData.nationality = data.nationality;
    if (data.photo !== undefined) updateData.photo = data.photo;
    if (data.contact !== undefined) {
      updateData.contact = {
        ...existing.contact,
        ...data.contact,
      };
    }
    if (data.employment !== undefined) {
      updateData.employment = {
        ...existing.employment,
        joiningDate: data.employment.joiningDate
          ? new Date(data.employment.joiningDate)
          : existing.employment.joiningDate,
        confirmationDate: data.employment.confirmationDate
          ? new Date(data.employment.confirmationDate)
          : existing.employment.confirmationDate,
        employmentType: data.employment.employmentType || existing.employment.employmentType,
        ...(data.employment.departmentId && {
          departmentId: new ObjectId(data.employment.departmentId),
        }),
        ...(data.employment.designationId && {
          designationId: new ObjectId(data.employment.designationId),
        }),
        ...(data.employment.reportingTo && {
          reportingTo: new ObjectId(data.employment.reportingTo),
        }),
        noticePeriod: data.employment.noticePeriod ?? existing.employment.noticePeriod,
      };
    }
    if (data.teaching !== undefined) {
      updateData.teaching = {
        isTeaching: data.teaching.isTeaching,
        subjects: data.teaching.subjects?.map((s) => ({
          subjectId: new ObjectId(s.subjectId),
          classIds: s.classIds.map((c) => new ObjectId(c)),
        })),
        ...(data.teaching.classTeacherOf && {
          classTeacherOf: new ObjectId(data.teaching.classTeacherOf),
        }),
        periodsPerWeek: data.teaching.periodsPerWeek,
      };
    }
    if (data.qualifications !== undefined) {
      updateData.qualifications = data.qualifications;
    }
    // Bank details — merge with existing so partial updates work. Detect
    // whether the account/IFSC changed so we can trigger a RazorpayX re-sync.
    let bankDetailsChanged = false;
    if ((data as { bankDetails?: StaffDocument['bankDetails'] }).bankDetails !== undefined) {
      const incoming = (data as { bankDetails?: StaffDocument['bankDetails'] }).bankDetails;
      const existingBank = existing.bankDetails ?? {};
      const merged = { ...existingBank, ...incoming };
      // Clear the cached Razorpay sync if identifying fields changed —
      // fund_account is created against the specific bank account, so a new
      // account/IFSC means a new fund_account must be provisioned.
      if (
        (incoming?.accountNumber && incoming.accountNumber !== existingBank.accountNumber) ||
        (incoming?.ifscCode && incoming.ifscCode !== existingBank.ifscCode)
      ) {
        bankDetailsChanged = true;
        (merged as { razorpayX?: unknown }).razorpayX = undefined;
      }
      updateData.bankDetails = merged;
    }
    if (data.customFields !== undefined) updateData.customFields = data.customFields;

    await collections.staff.updateOne({ _id: new ObjectId(staffId) }, { $set: updateData });

    logger.info({ staffId, tenantId, bankDetailsChanged }, 'Staff updated');

    // Phase-5 bridge: keep teaching_assignments in step with the legacy
    // class-granular summary (additive — never auto-ends assignments).
    if (data.teaching?.subjects?.length) {
      void teachingAssignmentService
        .syncFromStaffTeaching(tenantId, staffId, data.teaching.subjects)
        .catch((err) => {
          logger.warn({ err, staffId }, 'Teaching-assignment sync failed');
        });
    }

    // Fire-and-forget RazorpayX sync when bank details actually changed. Any
    // failure is logged inside the service; we never want a Razorpay
    // hiccup to fail the local update.
    if (bankDetailsChanged) {
      void razorpayXPayoutService
        .syncStaff(tenantId, existing.branchId.toString(), staffId)
        .catch((err) => {
          logger.warn({ err, staffId }, 'Deferred RazorpayX staff sync failed');
        });
    }

    return this.findById(tenantId, staffId);
  }

  async updateStatus(
    tenantId: string,
    staffId: string,
    status: StaffDocument['status'],
    reason: string,
    changedBy: string
  ) {
    const staff = (await collections.staff.findOne({
      _id: new ObjectId(staffId),
      tenantId: new ObjectId(tenantId),
    })) as WithId<StaffDocument> | null;

    if (!staff) {
      throw new ApiError('STAFF_NOT_FOUND', 'Staff not found', 404);
    }

    const now = new Date();
    const statusEntry = {
      status,
      date: now,
      reason,
      changedBy: new ObjectId(changedBy),
    };

    const updateData: Record<string, unknown> = {
      status,
      updatedAt: now,
    };

    if (status === 'resigned' || status === 'terminated') {
      updateData.exitDate = now;
      updateData.exitReason = reason;
    }

    await collections.staff.updateOne({ _id: new ObjectId(staffId) }, {
      $set: updateData,
      $push: { statusHistory: statusEntry },
    } as unknown as import('mongodb').UpdateFilter<Document>);

    logger.info({ staffId, tenantId, status, changedBy }, 'Staff status updated');

    return this.findById(tenantId, staffId);
  }

  async delete(tenantId: string, staffId: string) {
    const staff = await collections.staff.findOne({
      _id: new ObjectId(staffId),
      tenantId: new ObjectId(tenantId),
    });

    if (!staff) {
      throw new ApiError('STAFF_NOT_FOUND', 'Staff not found', 404);
    }

    // Soft delete by setting status to inactive
    await collections.staff.updateOne(
      { _id: new ObjectId(staffId) },
      { $set: { status: 'inactive', updatedAt: new Date() } }
    );

    logger.info({ staffId, tenantId }, 'Staff deleted (soft)');

    return { success: true };
  }

  async updatePhoto(tenantId: string, staffId: string, photoUrl: string, photoKey: string) {
    const staff = await collections.staff.findOne({
      _id: new ObjectId(staffId),
      tenantId: new ObjectId(tenantId),
    });

    if (!staff) {
      throw new ApiError('STAFF_NOT_FOUND', 'Staff not found', 404);
    }

    await collections.staff.updateOne(
      { _id: new ObjectId(staffId) },
      {
        $set: {
          photo: photoUrl,
          photoKey: photoKey,
          updatedAt: new Date(),
        },
      }
    );

    logger.info({ staffId, tenantId }, 'Staff photo updated');

    return this.findById(tenantId, staffId);
  }

  async getStats(tenantId: string, branchId: string) {
    const filter = {
      tenantId: new ObjectId(tenantId),
      $or: [{ branchId: new ObjectId(branchId) }, { additionalBranches: new ObjectId(branchId) }],
    };

    const pipeline = [
      { $match: filter },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ];

    const statusStats = await collections.staff.aggregate(pipeline).toArray();

    const typePipeline = [
      { $match: { ...filter, status: 'active' } },
      {
        $group: {
          _id: '$employment.employmentType',
          count: { $sum: 1 },
        },
      },
    ];

    const typeStats = await collections.staff.aggregate(typePipeline).toArray();

    const teachingCount = await collections.staff.countDocuments({
      ...filter,
      status: 'active',
      'teaching.isTeaching': true,
    });

    const total = await collections.staff.countDocuments(filter);

    return {
      total,
      byStatus: Object.fromEntries(statusStats.map((s) => [s._id, s.count])),
      byType: Object.fromEntries(typeStats.map((s) => [s._id, s.count])),
      teaching: teachingCount,
      nonTeaching: total - teachingCount,
    };
  }

  private formatStaff(staff: WithId<StaffDocument>) {
    return {
      _id: staff._id.toString(),
      tenantId: staff.tenantId.toString(),
      branchId: staff.branchId.toString(),
      additionalBranches: staff.additionalBranches?.map((b) => b.toString()),
      employeeId: staff.employeeId,
      userId: staff.userId?.toString(),
      firstName: staff.firstName,
      lastName: staff.lastName,
      displayName: staff.displayName,
      dateOfBirth: staff.dateOfBirth,
      gender: staff.gender,
      bloodGroup: staff.bloodGroup,
      nationality: staff.nationality,
      photo: staff.photo,
      contact: staff.contact,
      employment: {
        ...staff.employment,
        departmentId: staff.employment.departmentId?.toString(),
        designationId: staff.employment.designationId?.toString(),
        reportingTo: staff.employment.reportingTo?.toString(),
      },
      teaching: staff.teaching
        ? {
            ...staff.teaching,
            subjects: staff.teaching.subjects?.map((s) => ({
              subjectId: s.subjectId.toString(),
              classIds: s.classIds.map((c) => c.toString()),
            })),
            classTeacherOf: staff.teaching.classTeacherOf?.toString(),
          }
        : undefined,
      qualifications: staff.qualifications,
      experience: staff.experience,
      bankDetails: staff.bankDetails,
      documents: staff.documents,
      status: staff.status,
      statusHistory:
        staff.statusHistory?.map((s) => ({
          ...s,
          changedBy: s.changedBy?.toString() || '',
        })) || [],
      // Written by the promotion workflow; ids stringified like statusHistory.
      designationHistory: (
        ((staff as unknown as { designationHistory?: Array<Record<string, unknown>> })
          .designationHistory ?? []) as Array<Record<string, unknown>>
      ).map((h) =>
        Object.fromEntries(
          Object.entries(h).map(([k, v]) => [k, v instanceof ObjectId ? v.toString() : v])
        )
      ),
      exitDate: staff.exitDate,
      exitReason: staff.exitReason,
      customFields: staff.customFields,
      approvalStatus: staff.approvalStatus || 'approved',
      approvalRequestedBy: staff.approvalRequestedBy?.toString(),
      approvalDecidedBy: staff.approvalDecidedBy?.toString(),
      approvalDecidedAt: staff.approvalDecidedAt,
      requestedRoleCode: staff.requestedRoleCode,
      rejectionReason: staff.rejectionReason,
      createdAt: staff.createdAt,
      updatedAt: staff.updatedAt,
    };
  }

  getBulkUploadTemplate() {
    const headers = [
      'firstName*',
      'lastName*',
      'email*',
      'phone*',
      'gender (male/female/other)',
      'dateOfBirth (YYYY-MM-DD)',
      'joiningDate* (YYYY-MM-DD)',
      'employmentType* (permanent/contract/part-time/visiting)',
      'departmentName',
      'designationName',
      'isTeaching (true/false)',
      'address',
      'city',
      'state',
      'pincode',
    ];

    const sampleRow = [
      'John',
      'Doe',
      'john.doe@school.com',
      '9876543210',
      'male',
      '1990-05-15',
      '2024-01-01',
      'permanent',
      'Mathematics',
      'Teacher',
      'true',
      '123 Main Street',
      'Mumbai',
      'Maharashtra',
      '400001',
    ];

    const csv = [headers.join(','), sampleRow.map((cell) => `"${cell}"`).join(',')].join('\n');

    return {
      filename: 'staff_bulk_upload_template.csv',
      content: csv,
      contentType: 'text/csv',
    };
  }

  async validateBulkUpload(
    tenantId: string,
    branchId: string,
    csvContent: string
  ): Promise<{
    valid: boolean;
    totalRows: number;
    validRows: number;
    errorRows: number;
    errors: Array<{ row: number; field: string; message: string }>;
    preview: Array<Record<string, string>>;
  }> {
    const tenantObjId = new ObjectId(tenantId);
    const branchObjId = new ObjectId(branchId);

    // Parse CSV
    const lines = csvContent.trim().split('\n');
    if (lines.length < 2) {
      return {
        valid: false,
        totalRows: 0,
        validRows: 0,
        errorRows: 0,
        errors: [
          { row: 0, field: 'file', message: 'CSV file must have header and at least one data row' },
        ],
        preview: [],
      };
    }

    const headers = lines[0].split(',').map((h) =>
      h
        .trim()
        .replace(/\*/g, '')
        .replace(/\(.*\)/g, '')
        .trim()
        .toLowerCase()
    );
    const errors: Array<{ row: number; field: string; message: string }> = [];
    const preview: Array<Record<string, string>> = [];

    // Get existing departments and designations for name matching
    const [departments, designations, existingEmails] = await Promise.all([
      collections.departments.find({ tenantId: tenantObjId, branchId: branchObjId }).toArray(),
      collections.designations.find({ tenantId: tenantObjId, branchId: branchObjId }).toArray(),
      collections.staff.find({ tenantId: tenantObjId }).project({ 'contact.email': 1 }).toArray(),
    ]);

    const deptByName = new Map(
      departments.map((d) => [(d.name as string).toLowerCase(), d._id.toString()])
    );
    const desgByName = new Map(
      designations.map((d) => [(d.name as string).toLowerCase(), d._id.toString()])
    );
    const existingEmailSet = new Set(
      existingEmails.map((s) => (s.contact as { email: string }).email.toLowerCase())
    );

    const seenEmails = new Set<string>();

    for (let i = 1; i < lines.length; i++) {
      const values = this.parseCSVLine(lines[i]);
      const row: Record<string, string> = {};

      headers.forEach((header, idx) => {
        row[header] = values[idx]?.trim() || '';
      });

      // Validate required fields
      if (!row.firstname) {
        errors.push({ row: i + 1, field: 'firstName', message: 'First name is required' });
      }
      if (!row.lastname) {
        errors.push({ row: i + 1, field: 'lastName', message: 'Last name is required' });
      }
      if (!row.email) {
        errors.push({ row: i + 1, field: 'email', message: 'Email is required' });
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) {
        errors.push({ row: i + 1, field: 'email', message: 'Invalid email format' });
      } else if (existingEmailSet.has(row.email.toLowerCase())) {
        errors.push({ row: i + 1, field: 'email', message: 'Email already exists in system' });
      } else if (seenEmails.has(row.email.toLowerCase())) {
        errors.push({ row: i + 1, field: 'email', message: 'Duplicate email in upload file' });
      } else {
        seenEmails.add(row.email.toLowerCase());
      }

      if (!row.phone) {
        errors.push({ row: i + 1, field: 'phone', message: 'Phone is required' });
      }

      if (!row.joiningdate) {
        errors.push({ row: i + 1, field: 'joiningDate', message: 'Joining date is required' });
      } else if (!/^\d{4}-\d{2}-\d{2}$/.test(row.joiningdate)) {
        errors.push({
          row: i + 1,
          field: 'joiningDate',
          message: 'Invalid date format (use YYYY-MM-DD)',
        });
      }

      if (!row.employmenttype) {
        errors.push({
          row: i + 1,
          field: 'employmentType',
          message: 'Employment type is required',
        });
      } else if (
        !['permanent', 'contract', 'part-time', 'visiting'].includes(
          row.employmenttype.toLowerCase()
        )
      ) {
        errors.push({ row: i + 1, field: 'employmentType', message: 'Invalid employment type' });
      }

      // Validate department if provided
      if (row.departmentname && !deptByName.has(row.departmentname.toLowerCase())) {
        errors.push({
          row: i + 1,
          field: 'departmentName',
          message: `Department "${row.departmentname}" not found`,
        });
      }

      // Validate designation if provided
      if (row.designationname && !desgByName.has(row.designationname.toLowerCase())) {
        errors.push({
          row: i + 1,
          field: 'designationName',
          message: `Designation "${row.designationname}" not found`,
        });
      }

      preview.push({
        firstName: row.firstname || '',
        lastName: row.lastname || '',
        email: row.email || '',
        phone: row.phone || '',
        joiningDate: row.joiningdate || '',
        employmentType: row.employmenttype || '',
        departmentName: row.departmentname || '',
        designationName: row.designationname || '',
      });
    }

    const totalRows = lines.length - 1;
    const errorRowNumbers = new Set(errors.map((e) => e.row));
    const errorRows = errorRowNumbers.size;
    const validRows = totalRows - errorRows;

    return {
      valid: errors.length === 0,
      totalRows,
      validRows,
      errorRows,
      errors,
      preview: preview.slice(0, 10), // Return first 10 for preview
    };
  }

  async processBulkUpload(
    tenantId: string,
    branchId: string,
    csvContent: string,
    createdBy: string
  ): Promise<{
    success: boolean;
    totalProcessed: number;
    successCount: number;
    failureCount: number;
    results: Array<{
      email: string;
      status: 'created' | 'failed';
      employeeId?: string;
      error?: string;
    }>;
  }> {
    const tenantObjId = new ObjectId(tenantId);
    const branchObjId = new ObjectId(branchId);

    // First validate
    const validation = await this.validateBulkUpload(tenantId, branchId, csvContent);
    if (!validation.valid) {
      return {
        success: false,
        totalProcessed: 0,
        successCount: 0,
        failureCount: validation.errorRows,
        results: validation.errors.slice(0, 10).map((e) => ({
          email: 'N/A',
          status: 'failed' as const,
          error: `Row ${e.row}: ${e.field} - ${e.message}`,
        })),
      };
    }

    // Parse CSV
    const lines = csvContent.trim().split('\n');
    const headers = lines[0].split(',').map((h) =>
      h
        .trim()
        .replace(/\*/g, '')
        .replace(/\(.*\)/g, '')
        .trim()
        .toLowerCase()
    );

    // Get departments and designations for name matching
    const [departments, designations] = await Promise.all([
      collections.departments.find({ tenantId: tenantObjId, branchId: branchObjId }).toArray(),
      collections.designations.find({ tenantId: tenantObjId, branchId: branchObjId }).toArray(),
    ]);

    const deptByName = new Map(departments.map((d) => [(d.name as string).toLowerCase(), d._id]));
    const desgByName = new Map(designations.map((d) => [(d.name as string).toLowerCase(), d._id]));

    const results: Array<{
      email: string;
      status: 'created' | 'failed';
      employeeId?: string;
      error?: string;
    }> = [];
    let successCount = 0;
    let failureCount = 0;

    for (let i = 1; i < lines.length; i++) {
      const values = this.parseCSVLine(lines[i]);
      const row: Record<string, string> = {};
      headers.forEach((header, idx) => {
        row[header] = values[idx]?.trim() || '';
      });

      try {
        const staffData: CreateStaffInput = {
          firstName: row.firstname,
          lastName: row.lastname,
          gender: row.gender || undefined,
          dateOfBirth: row.dateofbirth || undefined,
          contact: {
            email: row.email,
            phone: row.phone,
            address:
              row.address || row.city || row.state || row.pincode
                ? {
                    current: {
                      line1: row.address,
                      city: row.city,
                      state: row.state,
                      pincode: row.pincode,
                    },
                  }
                : undefined,
          },
          employment: {
            joiningDate: row.joiningdate,
            employmentType: row.employmenttype.toLowerCase() as
              | 'permanent'
              | 'contract'
              | 'part-time'
              | 'visiting',
            departmentId: row.departmentname
              ? deptByName.get(row.departmentname.toLowerCase())?.toString()
              : undefined,
            designationId: row.designationname
              ? desgByName.get(row.designationname.toLowerCase())?.toString()
              : undefined,
          },
          teaching: row.isteaching === 'true' ? { isTeaching: true } : { isTeaching: false },
        };

        const staff = await this.create(tenantId, branchId, staffData, createdBy);
        results.push({
          email: row.email,
          status: 'created',
          employeeId: staff.employeeId,
        });
        successCount++;
      } catch (error) {
        results.push({
          email: row.email || `Row ${i + 1}`,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        failureCount++;
      }
    }

    logger.info(
      { tenantId, branchId, totalProcessed: lines.length - 1, successCount, failureCount },
      'Bulk staff upload completed'
    );

    return {
      success: failureCount === 0,
      totalProcessed: lines.length - 1,
      successCount,
      failureCount,
      results,
    };
  }

  private parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current);

    return result.map((s) => s.trim().replace(/^"|"$/g, ''));
  }

  async getWorkload(tenantId: string, branchId: string, staffId?: string) {
    const tenantObjId = new ObjectId(tenantId);
    const branchObjId = new ObjectId(branchId);

    const match: Filter<Document> = {
      tenantId: tenantObjId,
      branchId: branchObjId,
      status: 'active',
      'teaching.isTeaching': true,
    };

    if (staffId) {
      match._id = new ObjectId(staffId);
    }

    const staff = await collections.staff
      .find(match)
      .project({
        _id: 1,
        firstName: 1,
        lastName: 1,
        displayName: 1,
        employeeId: 1,
        'employment.departmentId': 1,
        'teaching.subjects': 1,
        'teaching.periodsPerWeek': 1,
      })
      .toArray();

    if (staff.length === 0) {
      return {
        hasData: false,
        message: 'No teaching staff found',
        workload: [],
      };
    }

    // Collect all unique subjectIds to batch-resolve names
    const allSubjectIds = new Set<string>();
    for (const s of staff) {
      const teachingSubjects = (s.teaching as StaffDocument['teaching'])?.subjects || [];
      for (const sub of teachingSubjects) {
        allSubjectIds.add(sub.subjectId.toString());
      }
    }

    // Batch-fetch subject names
    const subjectDocs =
      allSubjectIds.size > 0
        ? await collections.subjects
            .find({ _id: { $in: [...allSubjectIds].map((id) => new ObjectId(id)) } })
            .project({ _id: 1, name: 1 })
            .toArray()
        : [];
    const subjectNameMap = new Map(subjectDocs.map((s) => [s._id.toString(), s.name as string]));

    // Count timetable periods per staff from timetable entries
    const staffIds = staff.map((s) => s._id as ObjectId);
    const timetableCounts = await collections.timetableEntries
      .aggregate([
        { $match: { tenantId: tenantObjId, branchId: branchObjId, teacherId: { $in: staffIds } } },
        { $group: { _id: '$teacherId', periodsPerWeek: { $sum: 1 } } },
      ])
      .toArray();
    const timetableMap = new Map(
      timetableCounts.map((t) => [t._id.toString(), t.periodsPerWeek as number])
    );

    return {
      hasData: true,
      workload: staff.map((s) => {
        const teachingSubjects = (s.teaching as StaffDocument['teaching'])?.subjects || [];
        const subjectNames = teachingSubjects.map(
          (sub) => subjectNameMap.get(sub.subjectId.toString()) || 'Unknown'
        );
        const uniqueClassIds = new Set(
          teachingSubjects.flatMap((sub) => sub.classIds.map((c: ObjectId) => c.toString()))
        );
        const staffIdStr = (s._id as ObjectId).toString();
        const periodsFromTeaching = (s.teaching as StaffDocument['teaching'])?.periodsPerWeek || 0;
        const periodsFromTimetable = timetableMap.get(staffIdStr) || 0;

        return {
          staffId: staffIdStr,
          staffName: s.displayName || `${s.firstName} ${s.lastName}`,
          employeeId: s.employeeId,
          subjects: subjectNames,
          classes: uniqueClassIds.size,
          periodsPerWeek: periodsFromTimetable || periodsFromTeaching,
        };
      }),
    };
  }

  async assignWorkload(
    tenantId: string,
    _branchId: string,
    staffId: string,
    data: { subjects?: string[]; classIds?: string[] }
  ) {
    const tenantObjId = new ObjectId(tenantId);
    const staffObjId = new ObjectId(staffId);

    const staff = await collections.staff.findOne({
      _id: staffObjId,
      tenantId: tenantObjId,
    });

    if (!staff) {
      throw new ApiError('STAFF_NOT_FOUND', 'Staff member not found', 404);
    }

    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (data.subjects) {
      updateData['teaching.subjects'] = data.subjects;
    }

    if (data.classIds) {
      updateData['teaching.classes'] = data.classIds.map((id) => new ObjectId(id));
    }

    await collections.staff.updateOne({ _id: staffObjId }, { $set: updateData });

    return this.findById(tenantId, staffId);
  }

  // ============ Resignation Management ============

  async submitResignation(
    tenantId: string,
    branchId: string,
    staffId: string,
    data: {
      reason: string;
      requestedExitDate: string;
      remarks?: string;
    }
  ) {
    const tenantObjId = new ObjectId(tenantId);
    const branchObjId = new ObjectId(branchId);
    const staffObjId = new ObjectId(staffId);

    const staff = (await collections.staff.findOne({
      _id: staffObjId,
      tenantId: tenantObjId,
      branchId: branchObjId,
    })) as WithId<StaffDocument> | null;

    if (!staff) {
      throw new ApiError('STAFF_NOT_FOUND', 'Staff member not found', 404);
    }

    if (staff.status !== 'active') {
      throw new ApiError('INVALID_STATUS', 'Only active staff can submit resignation', 400);
    }

    // Check if there's already a pending resignation
    const existingResignation = await collections.resignations.findOne({
      staffId: staffObjId,
      status: 'pending',
    });

    if (existingResignation) {
      throw new ApiError(
        'RESIGNATION_PENDING',
        'There is already a pending resignation request',
        409
      );
    }

    const resignationId = new ObjectId();
    const now = new Date();
    const noticePeriodDays = staff.employment.noticePeriod || 30;

    const resignation = {
      _id: resignationId,
      tenantId: tenantObjId,
      branchId: branchObjId,
      staffId: staffObjId,
      employeeId: staff.employeeId,
      staffName: staff.displayName,
      departmentId: staff.employment.departmentId,
      designationId: staff.employment.designationId,
      joiningDate: staff.employment.joiningDate,
      reason: data.reason,
      requestedExitDate: new Date(data.requestedExitDate),
      noticePeriodDays,
      remarks: data.remarks,
      status: 'pending' as const,
      submittedAt: now,
      createdAt: now,
      updatedAt: now,
    };

    await collections.resignations.insertOne(resignation);

    logger.info(
      { resignationId: resignationId.toString(), staffId, tenantId },
      'Resignation submitted'
    );

    return {
      _id: resignationId.toString(),
      staffId: staffId,
      employeeId: staff.employeeId,
      staffName: staff.displayName,
      reason: data.reason,
      requestedExitDate: data.requestedExitDate,
      noticePeriodDays,
      status: 'pending',
      submittedAt: now,
    };
  }

  async getResignations(
    tenantId: string,
    branchId: string,
    params: { status?: string; page?: number; limit?: number } = {}
  ) {
    const { status, page = 1, limit = 20 } = params;
    const tenantObjId = new ObjectId(tenantId);
    const branchObjId = new ObjectId(branchId);

    const filter: Filter<Document> = {
      tenantId: tenantObjId,
      branchId: branchObjId,
    };

    if (status) {
      filter.status = status;
    }

    const skip = (page - 1) * limit;

    const [resignations, total] = await Promise.all([
      collections.resignations
        .find(filter)
        .sort({ submittedAt: -1 })
        .skip(skip)
        .limit(limit)
        .toArray(),
      collections.resignations.countDocuments(filter),
    ]);

    return {
      data: resignations.map((r) => ({
        _id: (r._id as ObjectId).toString(),
        staffId: (r.staffId as ObjectId).toString(),
        employeeId: r.employeeId,
        staffName: r.staffName,
        departmentId: (r.departmentId as ObjectId | undefined)?.toString(),
        reason: r.reason,
        requestedExitDate: r.requestedExitDate,
        approvedExitDate: r.approvedExitDate,
        noticePeriodDays: r.noticePeriodDays,
        remarks: r.remarks,
        status: r.status,
        submittedAt: r.submittedAt,
        reviewedAt: r.reviewedAt,
        reviewedBy: (r.reviewedBy as ObjectId | undefined)?.toString(),
        reviewRemarks: r.reviewRemarks,
      })),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async approveResignation(
    tenantId: string,
    branchId: string,
    resignationId: string,
    data: {
      approvedExitDate: string;
      remarks?: string;
    },
    approvedBy: string
  ) {
    const tenantObjId = new ObjectId(tenantId);
    const branchObjId = new ObjectId(branchId);
    const resignationObjId = new ObjectId(resignationId);

    const resignation = await collections.resignations.findOne({
      _id: resignationObjId,
      tenantId: tenantObjId,
      branchId: branchObjId,
    });

    if (!resignation) {
      throw new ApiError('RESIGNATION_NOT_FOUND', 'Resignation request not found', 404);
    }

    if (resignation.status !== 'pending') {
      throw new ApiError('INVALID_STATUS', 'Resignation is not in pending status', 400);
    }

    const now = new Date();
    const approvedExitDate = new Date(data.approvedExitDate);

    // Update resignation status
    await collections.resignations.updateOne(
      { _id: resignationObjId },
      {
        $set: {
          status: 'approved',
          approvedExitDate,
          reviewedAt: now,
          reviewedBy: new ObjectId(approvedBy),
          reviewRemarks: data.remarks,
          updatedAt: now,
        },
      }
    );

    // Update staff status to resigned with scheduled exit date
    const staffId = resignation.staffId as ObjectId;
    await collections.staff.updateOne({ _id: staffId }, {
      $set: {
        status: 'resigned',
        exitDate: approvedExitDate,
        exitReason: resignation.reason,
        updatedAt: now,
      },
      $push: {
        statusHistory: {
          status: 'resigned',
          date: now,
          reason: `Resignation approved. Exit date: ${approvedExitDate.toISOString().split('T')[0]}`,
          changedBy: new ObjectId(approvedBy),
        },
      },
    } as unknown as import('mongodb').UpdateFilter<Document>);

    logger.info({ resignationId, staffId: staffId.toString(), approvedBy }, 'Resignation approved');

    return {
      _id: resignationId,
      status: 'approved',
      approvedExitDate: data.approvedExitDate,
      reviewedAt: now,
    };
  }

  async rejectResignation(
    tenantId: string,
    branchId: string,
    resignationId: string,
    data: { remarks: string },
    rejectedBy: string
  ) {
    const tenantObjId = new ObjectId(tenantId);
    const branchObjId = new ObjectId(branchId);
    const resignationObjId = new ObjectId(resignationId);

    const resignation = await collections.resignations.findOne({
      _id: resignationObjId,
      tenantId: tenantObjId,
      branchId: branchObjId,
    });

    if (!resignation) {
      throw new ApiError('RESIGNATION_NOT_FOUND', 'Resignation request not found', 404);
    }

    if (resignation.status !== 'pending') {
      throw new ApiError('INVALID_STATUS', 'Resignation is not in pending status', 400);
    }

    const now = new Date();

    await collections.resignations.updateOne(
      { _id: resignationObjId },
      {
        $set: {
          status: 'rejected',
          reviewedAt: now,
          reviewedBy: new ObjectId(rejectedBy),
          reviewRemarks: data.remarks,
          updatedAt: now,
        },
      }
    );

    logger.info({ resignationId, rejectedBy }, 'Resignation rejected');

    return {
      _id: resignationId,
      status: 'rejected',
      reviewedAt: now,
      reviewRemarks: data.remarks,
    };
  }

  async getMyResignation(tenantId: string, staffId: string) {
    const tenantObjId = new ObjectId(tenantId);
    const staffObjId = new ObjectId(staffId);

    const resignation = await collections.resignations.findOne({
      tenantId: tenantObjId,
      staffId: staffObjId,
      status: { $in: ['pending', 'approved'] },
    });

    if (!resignation) {
      return null;
    }

    return {
      _id: (resignation._id as ObjectId).toString(),
      reason: resignation.reason,
      requestedExitDate: resignation.requestedExitDate,
      approvedExitDate: resignation.approvedExitDate,
      noticePeriodDays: resignation.noticePeriodDays,
      status: resignation.status,
      submittedAt: resignation.submittedAt,
      reviewedAt: resignation.reviewedAt,
      reviewRemarks: resignation.reviewRemarks,
    };
  }

  async withdrawResignation(tenantId: string, staffId: string, resignationId: string) {
    const tenantObjId = new ObjectId(tenantId);
    const staffObjId = new ObjectId(staffId);
    const resignationObjId = new ObjectId(resignationId);

    const resignation = await collections.resignations.findOne({
      _id: resignationObjId,
      tenantId: tenantObjId,
      staffId: staffObjId,
    });

    if (!resignation) {
      throw new ApiError('RESIGNATION_NOT_FOUND', 'Resignation request not found', 404);
    }

    if (resignation.status !== 'pending') {
      throw new ApiError('CANNOT_WITHDRAW', 'Only pending resignations can be withdrawn', 400);
    }

    const now = new Date();

    await collections.resignations.updateOne(
      { _id: resignationObjId },
      {
        $set: {
          status: 'withdrawn',
          updatedAt: now,
        },
      }
    );

    logger.info({ resignationId, staffId }, 'Resignation withdrawn');

    return { success: true, message: 'Resignation withdrawn successfully' };
  }
}

export const staffService = new StaffService();
