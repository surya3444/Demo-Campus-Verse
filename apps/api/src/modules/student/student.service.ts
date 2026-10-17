import { ObjectId, WithId, Document, Filter, UpdateFilter } from 'mongodb';
import bcrypt from 'bcryptjs';
import { collections } from '../../config/database';
import { alumniProfileService } from '../career-connect/alumni/alumniProfile.service';
import { logger } from '../../lib/logger';
import { ApiError } from '../../middleware/errorHandler';
import { generateSequence, padSequence, generatePassword } from '../../utils/generators';
import { CreateStudentInput, UpdateStudentInput } from '@campus-verse/shared';
import { feeStructureService } from '../finance/feeStructure.service';
import { studentAttendanceService } from '../attendance/studentAttendance.service';
import { emailService } from '../../services/email.service';

interface StudentDocument extends Document {
  _id: ObjectId;
  tenantId: ObjectId;
  branchId: ObjectId;
  admissionNumber: string;
  enrollmentCode: string;
  rollNumber?: string;
  firstName: string;
  lastName: string;
  displayName: string;
  dateOfBirth: Date;
  gender: string;
  bloodGroup?: string;
  nationality?: string;
  religion?: string;
  caste?: string;
  category?: string;
  /** Admission route/quota — distinct from the social-reservation category. */
  admissionCategory?: string;
  aadharNumber?: string;
  abcId?: string;
  photo?: string;
  userId?: ObjectId;
  contact?: {
    email?: string;
    phone?: string;
    alternatePhone?: string;
    address?: {
      current?: Record<string, unknown>;
      permanent?: Record<string, unknown>;
    };
  };
  parents?: {
    father?: Record<string, unknown>;
    mother?: Record<string, unknown>;
    guardian?: Record<string, unknown>;
  };
  primaryContactType?: string;
  admissionDate: Date;
  admissionType?: string;
  previousSchool?: Record<string, unknown>;
  currentEnrollment?: {
    academicBatchId: ObjectId;
    classId: ObjectId;
    sectionId: ObjectId;
    className: string;
    sectionName: string;
    /** Lab batch within the section (id from Section.batches). */
    labBatchId?: ObjectId;
  };
  familyId?: string;
  siblingIds?: ObjectId[];
  status: string;
  statusHistory?: Array<{
    status: string;
    date: Date;
    reason?: string;
    changedBy: ObjectId;
  }>;
  tags?: string[];
  notes?: string;
  customFields?: Record<string, unknown>;
  createdBy?: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface StudentListParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string | string[];
  classId?: string;
  sectionId?: string;
  academicBatchId?: string;
  category?: string;
  admissionCategory?: string;
  gender?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  customFields?: Record<string, string>;
  /** Department-scope narrowing (middleware/scope.ts); intersects with classId. */
  restrictToClassIds?: ObjectId[];
  /** Faculty narrowing (teaching/scope.ts): only sections the caller teaches. */
  restrictToSectionIds?: ObjectId[];
  /** Caller visibility (teaching/scope.ts getStudentVisibilityFilter); ANDed in. */
  visibilityFilter?: Filter<Document> | null;
}

/**
 * The one admission-number format, used by Students → Add and by admission
 * enrolment alike: `{prefix}-{academic year code}-{0001}`, where the prefix is
 * the student's institution's admissionPrefix when set, else the campus code.
 * The counter is per campus and academic year.
 */
export async function nextAdmissionNumber(
  tenantId: string,
  branchId: string,
  academicBatchId: string,
  classId?: string
): Promise<string> {
  const [branch, batch, classDoc] = await Promise.all([
    collections.branches.findOne({ _id: new ObjectId(branchId) }, { projection: { code: 1 } }),
    collections.academicBatches.findOne(
      { _id: new ObjectId(academicBatchId) },
      { projection: { code: 1 } }
    ),
    classId
      ? collections.classes.findOne(
          { _id: new ObjectId(classId) },
          { projection: { departmentId: 1, programId: 1 } }
        )
      : null,
  ]);
  // Class → department or program → institution → its admission prefix.
  let institutionId: ObjectId | undefined;
  if (classDoc?.departmentId) {
    const dept = await collections.departments.findOne(
      { _id: classDoc.departmentId as ObjectId },
      { projection: { institutionId: 1 } }
    );
    institutionId = (dept?.institutionId as ObjectId | undefined) ?? undefined;
  }
  if (!institutionId && classDoc?.programId) {
    const program = await collections.programs.findOne(
      { _id: classDoc.programId as ObjectId },
      { projection: { institutionId: 1 } }
    );
    institutionId = (program?.institutionId as ObjectId | undefined) ?? undefined;
  }
  const institution = institutionId
    ? await collections.institutions.findOne(
        { _id: institutionId },
        { projection: { 'settings.admissionPrefix': 1 } }
      )
    : null;
  const prefix =
    (institution?.settings as { admissionPrefix?: string } | undefined)?.admissionPrefix ||
    (branch?.code as string | undefined) ||
    'ADM';
  const sequence = await generateSequence('admissionNumber', tenantId, branchId, academicBatchId);
  return `${prefix}-${(batch?.code as string | undefined) ?? new Date().getFullYear()}-${padSequence(sequence)}`;
}

class StudentService {
  async create(tenantId: string, branchId: string, data: CreateStudentInput, createdBy: string) {
    // Get branch and batch info for admission number
    const branch = (await collections.branches.findOne({
      _id: new ObjectId(branchId),
      tenantId: new ObjectId(tenantId),
    })) as { code: string } | null;

    if (!branch) {
      throw new ApiError('BRANCH_NOT_FOUND', 'Branch not found', 404);
    }

    const batch = (await collections.academicBatches.findOne({
      _id: new ObjectId(data.academicBatchId),
      tenantId: new ObjectId(tenantId),
    })) as { code: string } | null;

    if (!batch) {
      throw new ApiError('BATCH_NOT_FOUND', 'Academic batch not found', 404);
    }

    // Validate class and section
    const classDoc = (await collections.classes.findOne({
      _id: new ObjectId(data.classId),
      tenantId: new ObjectId(tenantId),
    })) as { displayName: string } | null;

    if (!classDoc) {
      throw new ApiError('CLASS_NOT_FOUND', 'Class not found', 404);
    }

    const section = (await collections.sections.findOne({
      _id: new ObjectId(data.sectionId),
      classId: new ObjectId(data.classId),
    })) as { name: string } | null;

    if (!section) {
      throw new ApiError('SECTION_NOT_FOUND', 'Section not found', 404);
    }

    const admissionNumber = await nextAdmissionNumber(
      tenantId,
      branchId,
      data.academicBatchId,
      data.classId
    );

    // Generate enrollment code
    const enrollmentSequence = await generateSequence('enrollmentCode', tenantId);
    const enrollmentCode = `EN${padSequence(enrollmentSequence, 8)}`;

    const studentId = new ObjectId();
    const now = new Date();

    const student: Omit<StudentDocument, '_id'> & { _id: ObjectId } = {
      _id: studentId,
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
      admissionNumber,
      ...(data.rollNumber && { rollNumber: data.rollNumber }),
      enrollmentCode,
      firstName: data.firstName,
      lastName: data.lastName,
      displayName: `${data.firstName} ${data.lastName}`,
      dateOfBirth: new Date(data.dateOfBirth),
      gender: data.gender,
      bloodGroup: data.bloodGroup,
      nationality: data.nationality || 'Indian',
      religion: data.religion,
      caste: data.caste,
      category: data.category,
      admissionCategory: data.admissionCategory,
      aadharNumber: data.aadharNumber,
      abcId: data.abcId,
      contact: data.contact,
      parents: data.parents,
      primaryContactType: data.primaryContactType,
      admissionDate: new Date(data.admissionDate || now),
      admissionType: data.admissionType || 'new',
      previousSchool: data.previousSchool,
      currentEnrollment: {
        academicBatchId: new ObjectId(data.academicBatchId),
        classId: new ObjectId(data.classId),
        sectionId: new ObjectId(data.sectionId),
        className: classDoc.displayName,
        sectionName: section.name,
      },
      status: 'active',
      statusHistory: [
        {
          status: 'active',
          date: now,
          reason: 'New admission',
          changedBy: new ObjectId(createdBy),
        },
      ],
      customFields: data.customFields,
      createdBy: new ObjectId(createdBy),
      createdAt: now,
      updatedAt: now,
    };

    await collections.students.insertOne(student);

    // Create enrollment record
    await collections.studentEnrollments.insertOne({
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
      studentId,
      academicBatchId: new ObjectId(data.academicBatchId),
      classId: new ObjectId(data.classId),
      sectionId: new ObjectId(data.sectionId),
      ...(data.rollNumber && { rollNumber: data.rollNumber }),
      enrollmentDate: now,
      enrollmentType: 'new',
      status: 'active',
      createdBy: new ObjectId(createdBy),
      createdAt: now,
      updatedAt: now,
    });

    logger.info(
      { studentId: studentId.toString(), admissionNumber, tenantId, branchId },
      'Student created'
    );

    // Auto-assign fee structures
    feeStructureService
      .autoAssignForStudent(
        tenantId,
        branchId,
        studentId.toString(),
        data.classId,
        data.sectionId,
        data.academicBatchId,
        createdBy
      )
      .catch((err) => {
        logger.error(
          { studentId: studentId.toString(), err },
          'Fee auto-assignment failed for new student'
        );
      });

    const { userId: linkedUserId, tempPassword } = await this.ensurePortalAccount(
      tenantId,
      branchId,
      studentId,
      { email: data.contact?.email, firstName: data.firstName, lastName: data.lastName },
      createdBy
    );
    if (linkedUserId) (student as Record<string, unknown>).userId = linkedUserId;

    const result = this.formatStudent(student as WithId<StudentDocument>);
    return { ...result, tempPassword };
  }

  /**
   * Give a student their portal login, however they arrived (added directly,
   * enrolled from Admissions, or later from their profile): links an existing
   * account with the same email, or creates one on a temporary password
   * (status 'pending' — they set their own on first sign-in) and emails it.
   * No email, no account. Never throws: a login problem must not undo an
   * admission.
   */
  async ensurePortalAccount(
    tenantId: string,
    branchId: string,
    studentId: ObjectId,
    person: { email?: string | null; firstName: string; lastName: string },
    createdBy: string
  ): Promise<{ userId?: ObjectId; tempPassword?: string }> {
    let tempPassword: string | undefined;
    let linkedUserId: ObjectId | undefined;
    const email = person.email?.toLowerCase();
    const now = new Date();

    if (email) {
      try {
        const existingUser = await collections.users.findOne({
          tenantId: new ObjectId(tenantId),
          email,
        });

        if (existingUser && !existingUser.studentId) {
          // User exists but not linked — link bidirectionally
          await collections.students.updateOne(
            { _id: studentId },
            { $set: { userId: existingUser._id, updatedAt: new Date() } }
          );
          await collections.users.updateOne(
            { _id: existingUser._id },
            { $set: { studentId, updatedAt: new Date() } }
          );
          linkedUserId = existingUser._id;
          logger.info(
            { studentId: studentId.toString(), userId: existingUser._id.toString() },
            'Auto-linked student to existing user'
          );
        } else if (!existingUser) {
          const role = await collections.roles.findOne({
            tenantId: new ObjectId(tenantId),
            code: 'STUDENT',
          });

          if (!role) {
            logger.warn({ tenantId }, 'STUDENT role not found, skipping user auto-creation');
          } else {
            tempPassword = generatePassword();
            const passwordHash = await bcrypt.hash(tempPassword, 12);
            const userId = new ObjectId();

            await collections.users.insertOne({
              _id: userId,
              tenantId: new ObjectId(tenantId),
              email,
              passwordHash,
              profile: {
                firstName: person.firstName,
                lastName: person.lastName,
                displayName: `${person.firstName} ${person.lastName}`,
              },
              roleId: role._id,
              accessScope: {
                type: 'branch' as const,
                branchIds: [new ObjectId(branchId)],
              },
              security: {
                mfaEnabled: false,
                passwordChangedAt: now,
                loginAttempts: 0,
                mustChangePassword: true,
              },
              status: 'pending',
              studentId,
              createdBy: new ObjectId(createdBy),
              createdAt: now,
              updatedAt: now,
            } as unknown as Parameters<typeof collections.users.insertOne>[0]);

            await collections.students.updateOne(
              { _id: studentId },
              { $set: { userId, updatedAt: new Date() } }
            );
            linkedUserId = userId;

            logger.info(
              { studentId: studentId.toString(), userId: userId.toString(), tenantId },
              'Auto-created user account for student'
            );

            // Email the credentials to the student. Fire-and-forget — email
            // failures must not roll back the student create. emailService
            // gracefully no-ops with a warning when RESEND_API_KEY is missing.
            void (async () => {
              try {
                const tenant = await collections.tenants.findOne(
                  { _id: new ObjectId(tenantId) },
                  { projection: { name: 1 } }
                );
                await emailService.sendUserWelcomeEmail(
                  email,
                  `${person.firstName} ${person.lastName}`.trim(),
                  tempPassword!,
                  (tenant?.name as string) || 'Campus Verse',
                  'Student'
                );
              } catch (emailErr) {
                logger.warn(
                  { err: emailErr, studentId: studentId.toString(), email },
                  'Welcome email could not be sent — credentials still available via the create response'
                );
              }
            })();
          }
        }
      } catch (err: unknown) {
        const mongoErr = err as { code?: number };
        if (mongoErr.code === 11000) {
          logger.info({ tenantId, email }, 'Handled duplicate during student user auto-creation');
        } else {
          logger.error(
            { err, studentId: studentId.toString(), tenantId },
            'Failed to auto-create user for student'
          );
        }
      }
    }

    return { userId: linkedUserId, tempPassword };
  }

  /**
   * Reset a student's portal-account password (admin action). Returns the new
   * temp password so the admin can hand it over directly — students often
   * have placeholder/parent emails, so email-only delivery isn't enough.
   */
  async resetPortalPassword(tenantId: string, studentId: string, resetBy: string) {
    const student = (await collections.students.findOne({
      _id: new ObjectId(studentId),
      tenantId: new ObjectId(tenantId),
    })) as WithId<StudentDocument> | null;

    if (!student) {
      throw new ApiError('STUDENT_NOT_FOUND', 'Student not found', 404);
    }

    if (!student.userId) {
      // No login yet (e.g. admitted before enrolment created one): make it now.
      const email = (student.contact as { email?: string } | undefined)?.email;
      if (!email) {
        throw new ApiError(
          'NO_PORTAL_ACCOUNT',
          'This student has no email, so no login can be created. Add an email first.',
          400
        );
      }
      const made = await this.ensurePortalAccount(
        tenantId,
        String(student.branchId),
        student._id,
        { email, firstName: student.firstName as string, lastName: student.lastName as string },
        resetBy
      );
      if (!made.tempPassword) {
        throw new ApiError(
          'PORTAL_ACCOUNT_FAILED',
          'A login could not be created — the email may already belong to another account.',
          409
        );
      }
      return { tempPassword: made.tempPassword, email, created: true };
    }

    const user = await collections.users.findOne({
      _id: new ObjectId(student.userId),
      tenantId: new ObjectId(tenantId),
    });

    if (!user) {
      throw new ApiError('USER_NOT_FOUND', 'Linked portal account no longer exists', 404);
    }

    const tempPassword = generatePassword();
    const passwordHash = await bcrypt.hash(tempPassword, 12);
    const now = new Date();

    await collections.users.updateOne(
      { _id: user._id },
      {
        $set: {
          passwordHash,
          'security.passwordChangedAt': now,
          'security.loginAttempts': 0,
          'security.lockUntil': null,
          'security.mustChangePassword': true,
          updatedAt: now,
        },
      }
    );

    logger.info(
      { studentId, userId: user._id.toString(), tenantId, resetBy },
      'Student portal password reset'
    );

    // Email the temp password and report whether it actually went out, so the
    // UI can tell the admin to share it manually when email isn't configured.
    let emailSent = false;
    try {
      const tenant = await collections.tenants.findOne(
        { _id: new ObjectId(tenantId) },
        { projection: { name: 1 } }
      );
      emailSent = await emailService.sendPasswordResetEmail(
        user.email as string,
        `${student.firstName} ${student.lastName}`.trim(),
        tempPassword,
        (tenant?.name as string) || 'Campus Verse'
      );
    } catch (err) {
      logger.warn(
        { err, studentId },
        'Portal reset email could not be sent — password still in response'
      );
    }

    return { tempPassword, email: user.email as string, emailSent };
  }

  async findById(tenantId: string, studentId: string) {
    const student = (await collections.students.findOne({
      _id: new ObjectId(studentId),
      tenantId: new ObjectId(tenantId),
    })) as WithId<StudentDocument> | null;

    if (!student) {
      throw new ApiError('STUDENT_NOT_FOUND', 'Student not found', 404);
    }

    return this.formatStudent(student);
  }

  async findAll(tenantId: string, branchId: string, params: StudentListParams = {}) {
    const {
      page = 1,
      limit = 20,
      search,
      status,
      classId,
      sectionId,
      academicBatchId,
      category,
      gender,
      sortBy = 'firstName',
      sortOrder = 'asc',
      customFields,
    } = params;

    const filter: Filter<Document> = {
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
    };

    if (search) {
      filter.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { admissionNumber: { $regex: search, $options: 'i' } },
        { rollNumber: { $regex: search, $options: 'i' } },
        { enrollmentCode: { $regex: search, $options: 'i' } },
        { 'contact.phone': { $regex: search, $options: 'i' } },
      ];
    }

    if (status) {
      if (Array.isArray(status)) {
        filter.status = { $in: status };
      } else {
        filter.status = status;
      }
    } else {
      filter.status = 'active';
    }

    const { restrictToClassIds } = params;
    if (classId) {
      const classOid = new ObjectId(classId);
      // Scope wins over an explicit filter: asking for a class outside the
      // caller's departments returns nothing, not everything.
      filter['currentEnrollment.classId'] =
        restrictToClassIds && !restrictToClassIds.some((id) => id.equals(classOid))
          ? { $in: [] }
          : classOid;
    } else if (restrictToClassIds) {
      filter['currentEnrollment.classId'] = { $in: restrictToClassIds };
    }

    const { restrictToSectionIds } = params;
    if (sectionId) {
      const sectionOid = new ObjectId(sectionId);
      filter['currentEnrollment.sectionId'] =
        restrictToSectionIds && !restrictToSectionIds.some((id) => id.equals(sectionOid))
          ? { $in: [] }
          : sectionOid;
    } else if (restrictToSectionIds) {
      filter['currentEnrollment.sectionId'] = { $in: restrictToSectionIds };
    }

    if (academicBatchId) {
      filter['currentEnrollment.academicBatchId'] = new ObjectId(academicBatchId);
    }

    if (params.visibilityFilter) {
      filter.$and = [...((filter.$and as Filter<Document>[]) ?? []), params.visibilityFilter];
    }

    if (category) {
      filter.category = category;
    }

    if (params.admissionCategory) {
      filter.admissionCategory = params.admissionCategory;
    }

    if (gender) {
      filter.gender = gender;
    }

    // Custom field filters: only filterable (showInFilters: true), active student fields
    if (customFields && Object.keys(customFields).length > 0) {
      const filterableDefs = (await collections.customFields
        .find({
          tenantId: new ObjectId(tenantId),
          module: 'student',
          status: 'active',
          showInFilters: true,
        })
        .toArray()) as unknown as Array<{ fieldKey: string; fieldType: string }>;

      const defByKey = new Map(filterableDefs.map((d) => [d.fieldKey, d.fieldType]));

      for (const [key, rawValue] of Object.entries(customFields)) {
        const fieldType = defByKey.get(key);
        if (!fieldType) continue;
        if (rawValue === undefined || rawValue === null || rawValue === '') continue;

        const path = `customFields.${key}`;
        switch (fieldType) {
          case 'text':
          case 'textarea':
            filter[path] = { $regex: rawValue, $options: 'i' };
            break;
          case 'select':
            filter[path] = rawValue;
            break;
          case 'multiselect': {
            const values = rawValue
              .split(',')
              .map((v) => v.trim())
              .filter(Boolean);
            if (values.length > 0) {
              filter[path] = { $in: values };
            }
            break;
          }
          case 'checkbox':
            filter[path] = rawValue === 'true' || rawValue === '1';
            break;
          case 'number': {
            const num = Number(rawValue);
            if (!Number.isNaN(num)) {
              filter[path] = num;
            }
            break;
          }
          case 'date':
            filter[path] = rawValue;
            break;
          default:
            break;
        }
      }
    }

    const skip = (page - 1) * limit;
    const sortDirection = sortOrder === 'asc' ? 1 : -1;

    const [students, total] = await Promise.all([
      collections.students
        .find(filter)
        .sort({ [sortBy]: sortDirection, _id: sortDirection })
        .skip(skip)
        .limit(limit)
        .toArray() as Promise<WithId<StudentDocument>[]>,
      collections.students.countDocuments(filter),
    ]);

    return {
      data: students.map((student) => this.formatStudent(student)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: skip + students.length < total,
      },
    };
  }

  async update(tenantId: string, studentId: string, data: UpdateStudentInput, updatedBy: string) {
    const existingStudent = (await collections.students.findOne({
      _id: new ObjectId(studentId),
      tenantId: new ObjectId(tenantId),
    })) as WithId<StudentDocument> | null;

    if (!existingStudent) {
      throw new ApiError('STUDENT_NOT_FOUND', 'Student not found', 404);
    }

    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (data.firstName !== undefined) {
      updateData.firstName = data.firstName;
      updateData.displayName = `${data.firstName} ${data.lastName || existingStudent.lastName}`;
    }
    if (data.lastName !== undefined) {
      updateData.lastName = data.lastName;
      updateData.displayName = `${data.firstName || existingStudent.firstName} ${data.lastName}`;
    }
    if (data.dateOfBirth !== undefined) updateData.dateOfBirth = new Date(data.dateOfBirth);
    if (data.gender !== undefined) updateData.gender = data.gender;
    if (data.bloodGroup !== undefined) updateData.bloodGroup = data.bloodGroup;
    if (data.nationality !== undefined) updateData.nationality = data.nationality;
    if (data.religion !== undefined) updateData.religion = data.religion;
    if (data.caste !== undefined) updateData.caste = data.caste;
    if (data.category !== undefined) updateData.category = data.category;
    if (data.admissionCategory !== undefined) updateData.admissionCategory = data.admissionCategory;
    if (data.aadharNumber !== undefined) updateData.aadharNumber = data.aadharNumber;
    if (data.abcId !== undefined) updateData.abcId = data.abcId;
    if (data.contact !== undefined) updateData.contact = data.contact;
    if (data.parents !== undefined) updateData.parents = data.parents;
    if (data.primaryContactType !== undefined)
      updateData.primaryContactType = data.primaryContactType;
    if (data.previousSchool !== undefined) updateData.previousSchool = data.previousSchool;
    if (data.customFields !== undefined) updateData.customFields = data.customFields;

    await collections.students.updateOne({ _id: new ObjectId(studentId) }, { $set: updateData });

    logger.info({ studentId, tenantId, updatedBy }, 'Student updated');

    return this.findById(tenantId, studentId);
  }

  async updatePhoto(tenantId: string, studentId: string, photoUrl: string, photoKey: string) {
    const student = await collections.students.findOne({
      _id: new ObjectId(studentId),
      tenantId: new ObjectId(tenantId),
    });

    if (!student) {
      throw new ApiError('STUDENT_NOT_FOUND', 'Student not found', 404);
    }

    await collections.students.updateOne(
      { _id: new ObjectId(studentId) },
      {
        $set: {
          photo: photoUrl,
          photoKey: photoKey,
          updatedAt: new Date(),
        },
      }
    );

    logger.info({ studentId, tenantId }, 'Student photo updated');

    return this.findById(tenantId, studentId);
  }

  async updateStatus(
    tenantId: string,
    studentId: string,
    status: 'active' | 'inactive' | 'alumni' | 'transferred' | 'withdrawn',
    reason: string,
    updatedBy: string
  ) {
    const student = (await collections.students.findOne({
      _id: new ObjectId(studentId),
      tenantId: new ObjectId(tenantId),
    })) as WithId<StudentDocument> | null;

    if (!student) {
      throw new ApiError('STUDENT_NOT_FOUND', 'Student not found', 404);
    }

    const now = new Date();
    const statusEntry = {
      status,
      date: now,
      reason,
      changedBy: new ObjectId(updatedBy),
    };

    await collections.students.updateOne({ _id: new ObjectId(studentId) }, {
      $set: { status, updatedAt: now },
      $push: { statusHistory: statusEntry },
    } as unknown as UpdateFilter<Document>);

    // Leaving (graduated, transferred out, dropped out) closes this year's enrollment.
    if (status === 'alumni' || status === 'transferred' || status === 'withdrawn') {
      await collections.studentEnrollments.updateOne(
        {
          studentId: new ObjectId(studentId),
          status: 'active',
        },
        {
          $set: {
            status: status === 'alumni' ? 'completed' : 'withdrawn',
            completedDate: now,
            updatedAt: now,
          },
        }
      );
    }

    // The login follows the student: someone who has left the institution
    // can't sign in; a student returning from leave or re-admitted can again.
    // Graduates keep theirs (alumni portal).
    if (student.userId) {
      if (status === 'transferred' || status === 'withdrawn') {
        await collections.users.updateOne(
          { _id: student.userId as ObjectId },
          { $set: { status: 'inactive', updatedAt: now } }
        );
      } else if (status === 'active') {
        await collections.users.updateOne(
          { _id: student.userId as ObjectId, status: 'inactive' },
          { $set: { status: 'active', updatedAt: now } }
        );
      }
    }

    // Graduates appear in the alumni directory straight away.
    if (status === 'alumni') {
      await alumniProfileService.getMyProfile(tenantId, studentId);
    }

    logger.info({ studentId, tenantId, status, reason, updatedBy }, 'Student status updated');

    return this.findById(tenantId, studentId);
  }

  async delete(tenantId: string, studentId: string) {
    const student = await collections.students.findOne({
      _id: new ObjectId(studentId),
      tenantId: new ObjectId(tenantId),
    });

    if (!student) {
      throw new ApiError('STUDENT_NOT_FOUND', 'Student not found', 404);
    }

    // Soft delete - update status and clear enrollment so they're not counted in sections/classes
    await collections.students.updateOne(
      { _id: new ObjectId(studentId) },
      {
        $set: {
          status: 'deleted',
          updatedAt: new Date(),
          previousEnrollment: student.currentEnrollment, // Preserve for audit trail
        },
        $unset: { currentEnrollment: '' },
      }
    );

    // Also mark any active enrollment records as withdrawn
    if (student.currentEnrollment) {
      await collections.studentEnrollments.updateMany(
        {
          studentId: new ObjectId(studentId),
          status: 'active',
        },
        {
          $set: {
            status: 'withdrawn',
            updatedAt: new Date(),
          },
        }
      );
    }

    // Cascade to the linked user account: a soft-deleted student should not
    // continue to be able to sign in. We mark the user `inactive` (a status
    // already blocked by the login flow) rather than `deleted`, so the
    // record can be re-activated cleanly if the student is restored.
    if (student.userId) {
      await collections.users.updateOne(
        { _id: student.userId as ObjectId },
        { $set: { status: 'inactive', updatedAt: new Date() } }
      );
    }

    logger.info({ studentId, tenantId }, 'Student deleted (soft)');

    return { success: true };
  }

  async getEnrollmentHistory(tenantId: string, studentId: string) {
    const student = await collections.students.findOne({
      _id: new ObjectId(studentId),
      tenantId: new ObjectId(tenantId),
    });

    if (!student) {
      throw new ApiError('STUDENT_NOT_FOUND', 'Student not found', 404);
    }

    const enrollments = await collections.studentEnrollments
      .find({ studentId: new ObjectId(studentId) })
      .sort({ enrollmentDate: -1 })
      .toArray();

    // Names for the profile's history list (it shows class, section and year).
    const [classes, sections, batches] = await Promise.all([
      collections.classes
        .find({ _id: { $in: enrollments.map((e) => e.classId as ObjectId) } })
        .project({ displayName: 1, name: 1 })
        .toArray(),
      collections.sections
        .find({ _id: { $in: enrollments.map((e) => e.sectionId as ObjectId) } })
        .project({ name: 1 })
        .toArray(),
      collections.academicBatches
        .find({ _id: { $in: enrollments.map((e) => e.academicBatchId as ObjectId) } })
        .project({ name: 1 })
        .toArray(),
    ]);
    const nameIn = (docs: Document[], id: unknown, key = 'name') =>
      docs.find((d) => String(d._id) === String(id))?.[key] as string | undefined;

    return enrollments.map((e) => ({
      _id: e._id.toString(),
      className: nameIn(classes, e.classId, 'displayName') ?? nameIn(classes, e.classId),
      sectionName: nameIn(sections, e.sectionId),
      academicBatchName: nameIn(batches, e.academicBatchId),
      enrolledAt: e.enrollmentDate as Date,
      rollNumber: e.rollNumber as string | undefined,
      academicBatchId: (e.academicBatchId as ObjectId).toString(),
      classId: (e.classId as ObjectId).toString(),
      sectionId: (e.sectionId as ObjectId).toString(),
      enrollmentDate: e.enrollmentDate as Date,
      enrollmentType: e.enrollmentType as string,
      status: e.status as string,
      completedDate: e.completedDate as Date | undefined,
      result: e.result,
    }));
  }

  async getStats(tenantId: string, branchId: string) {
    const branchFilter = {
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
    };

    const [total, active, male, female] = await Promise.all([
      collections.students.countDocuments(branchFilter),
      collections.students.countDocuments({ ...branchFilter, status: 'active' }),
      collections.students.countDocuments({ ...branchFilter, status: 'active', gender: 'male' }),
      collections.students.countDocuments({ ...branchFilter, status: 'active', gender: 'female' }),
    ]);

    return {
      total,
      active,
      inactive: total - active,
      genderDistribution: { male, female, other: active - male - female },
    };
  }

  // ============ Promote / Shuffle / Transfer ============

  async promoteStudent(
    tenantId: string,
    studentId: string,
    data: {
      newAcademicBatchId: string;
      newClassId: string;
      newSectionId: string;
      result?: 'promoted' | 'passed' | 'failed' | 'detained';
      remarks?: string;
    },
    promotedBy: string
  ) {
    const student = (await collections.students.findOne({
      _id: new ObjectId(studentId),
      tenantId: new ObjectId(tenantId),
    })) as WithId<StudentDocument> | null;

    if (!student) {
      throw new ApiError('STUDENT_NOT_FOUND', 'Student not found', 404);
    }

    if (student.status !== 'active') {
      throw new ApiError('INVALID_STATUS', 'Only active students can be promoted', 400);
    }

    // Validate new class and section
    const newClass = (await collections.classes.findOne({
      _id: new ObjectId(data.newClassId),
      tenantId: new ObjectId(tenantId),
    })) as { displayName: string } | null;

    if (!newClass) {
      throw new ApiError('CLASS_NOT_FOUND', 'New class not found', 404);
    }

    const newSection = (await collections.sections.findOne({
      _id: new ObjectId(data.newSectionId),
      classId: new ObjectId(data.newClassId),
    })) as { name: string } | null;

    if (!newSection) {
      throw new ApiError('SECTION_NOT_FOUND', 'New section not found', 404);
    }

    const now = new Date();

    // Complete current enrollment
    await collections.studentEnrollments.updateOne(
      {
        studentId: new ObjectId(studentId),
        status: 'active',
      },
      {
        $set: {
          status: 'completed',
          completedDate: now,
          result: data.result || 'promoted',
          updatedAt: now,
        },
      }
    );

    // Create new enrollment
    await collections.studentEnrollments.insertOne({
      tenantId: new ObjectId(tenantId),
      branchId: student.branchId,
      studentId: new ObjectId(studentId),
      academicBatchId: new ObjectId(data.newAcademicBatchId),
      classId: new ObjectId(data.newClassId),
      sectionId: new ObjectId(data.newSectionId),
      enrollmentDate: now,
      enrollmentType: 'promotion',
      previousEnrollment: {
        academicBatchId: student.currentEnrollment?.academicBatchId,
        classId: student.currentEnrollment?.classId,
        sectionId: student.currentEnrollment?.sectionId,
      },
      status: 'active',
      createdBy: new ObjectId(promotedBy),
      createdAt: now,
      updatedAt: now,
    });

    // Update student's current enrollment
    await collections.students.updateOne(
      { _id: new ObjectId(studentId) },
      {
        $set: {
          currentEnrollment: {
            academicBatchId: new ObjectId(data.newAcademicBatchId),
            classId: new ObjectId(data.newClassId),
            sectionId: new ObjectId(data.newSectionId),
            className: newClass.displayName,
            sectionName: newSection.name,
          },
          updatedAt: now,
        },
      }
    );

    logger.info(
      { studentId, newClassId: data.newClassId, newSectionId: data.newSectionId, tenantId },
      'Student promoted'
    );

    // Auto-assign any fee structures that apply to the new grade. Idempotent
    // — existing assignments are skipped. Fire-and-forget so a fee error
    // doesn't fail the promotion itself.
    feeStructureService
      .autoAssignForStudent(
        tenantId,
        student.branchId.toString(),
        studentId,
        data.newClassId,
        data.newSectionId,
        data.newAcademicBatchId,
        promotedBy
      )
      .catch((err) => {
        logger.error({ studentId, err }, 'Fee auto-assignment failed after student promotion');
      });

    return this.findById(tenantId, studentId);
  }

  async bulkPromote(
    tenantId: string,
    branchId: string,
    data: {
      fromAcademicBatchId: string;
      toAcademicBatchId: string;
      promotions: Array<{
        fromClassId: string;
        fromSectionId?: string;
        toClassId: string;
        toSectionId: string;
        result?: 'promoted' | 'passed';
      }>;
      excludeStudentIds?: string[];
    },
    promotedBy: string
  ) {
    const results: {
      promoted: number;
      failed: number;
      errors: Array<{ studentId: string; error: string }>;
    } = {
      promoted: 0,
      failed: 0,
      errors: [],
    };

    for (const promotion of data.promotions) {
      // Get all active students in the from class/section
      const filter: Filter<Document> = {
        tenantId: new ObjectId(tenantId),
        branchId: new ObjectId(branchId),
        'currentEnrollment.academicBatchId': new ObjectId(data.fromAcademicBatchId),
        'currentEnrollment.classId': new ObjectId(promotion.fromClassId),
        status: 'active',
      };

      if (promotion.fromSectionId) {
        filter['currentEnrollment.sectionId'] = new ObjectId(promotion.fromSectionId);
      }

      if (data.excludeStudentIds?.length) {
        filter._id = { $nin: data.excludeStudentIds.map((id) => new ObjectId(id)) };
      }

      const students = await collections.students.find(filter).toArray();

      for (const student of students) {
        try {
          await this.promoteStudent(
            tenantId,
            student._id.toString(),
            {
              newAcademicBatchId: data.toAcademicBatchId,
              newClassId: promotion.toClassId,
              newSectionId: promotion.toSectionId,
              result: promotion.result,
            },
            promotedBy
          );
          results.promoted++;
        } catch (error) {
          results.failed++;
          results.errors.push({
            studentId: student._id.toString(),
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }
    }

    logger.info(
      { tenantId, branchId, promoted: results.promoted, failed: results.failed },
      'Bulk promotion completed'
    );

    return results;
  }

  async shuffleStudent(
    tenantId: string,
    studentId: string,
    data: {
      newSectionId: string;
      reason?: string;
    },
    shuffledBy: string
  ) {
    const student = (await collections.students.findOne({
      _id: new ObjectId(studentId),
      tenantId: new ObjectId(tenantId),
    })) as WithId<StudentDocument> | null;

    if (!student) {
      throw new ApiError('STUDENT_NOT_FOUND', 'Student not found', 404);
    }

    if (student.status !== 'active') {
      throw new ApiError('INVALID_STATUS', 'Only active students can be shuffled', 400);
    }

    // Validate new section (must be in same class)
    const newSection = (await collections.sections.findOne({
      _id: new ObjectId(data.newSectionId),
      classId: student.currentEnrollment?.classId,
    })) as { name: string } | null;

    if (!newSection) {
      throw new ApiError('SECTION_NOT_FOUND', 'Section not found or not in same class', 404);
    }

    const now = new Date();
    const oldSectionId = student.currentEnrollment?.sectionId;

    // Update current enrollment
    await collections.studentEnrollments.updateOne(
      {
        studentId: new ObjectId(studentId),
        status: 'active',
      },
      {
        $set: {
          sectionId: new ObjectId(data.newSectionId),
          updatedAt: now,
        },
        $push: {
          shuffleHistory: {
            fromSectionId: oldSectionId,
            toSectionId: new ObjectId(data.newSectionId),
            reason: data.reason,
            shuffledBy: new ObjectId(shuffledBy),
            shuffledAt: now,
          },
        },
      } as unknown as UpdateFilter<Document>
    );

    // Update student's current enrollment
    await collections.students.updateOne(
      { _id: new ObjectId(studentId) },
      {
        $set: {
          'currentEnrollment.sectionId': new ObjectId(data.newSectionId),
          'currentEnrollment.sectionName': newSection.name,
          updatedAt: now,
        },
      }
    );

    logger.info(
      {
        studentId,
        oldSectionId: oldSectionId?.toString(),
        newSectionId: data.newSectionId,
        tenantId,
      },
      'Student shuffled to new section'
    );

    return this.findById(tenantId, studentId);
  }

  async transferStudent(
    tenantId: string,
    studentId: string,
    data: {
      toBranchId: string;
      toClassId: string;
      toSectionId: string;
      toAcademicBatchId: string;
      transferDate?: string;
      reason?: string;
    },
    transferredBy: string
  ) {
    const student = (await collections.students.findOne({
      _id: new ObjectId(studentId),
      tenantId: new ObjectId(tenantId),
    })) as WithId<StudentDocument> | null;

    if (!student) {
      throw new ApiError('STUDENT_NOT_FOUND', 'Student not found', 404);
    }

    if (student.status !== 'active') {
      throw new ApiError('INVALID_STATUS', 'Only active students can be transferred', 400);
    }

    // Validate target branch
    const targetBranch = await collections.branches.findOne({
      _id: new ObjectId(data.toBranchId),
      tenantId: new ObjectId(tenantId),
    });

    if (!targetBranch) {
      throw new ApiError('BRANCH_NOT_FOUND', 'Target branch not found', 404);
    }

    // Validate new class and section
    const newClass = (await collections.classes.findOne({
      _id: new ObjectId(data.toClassId),
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(data.toBranchId),
    })) as { displayName: string } | null;

    if (!newClass) {
      throw new ApiError('CLASS_NOT_FOUND', 'Class not found in target branch', 404);
    }

    const newSection = (await collections.sections.findOne({
      _id: new ObjectId(data.toSectionId),
      tenantId: new ObjectId(tenantId),
      classId: new ObjectId(data.toClassId),
    })) as { name: string } | null;

    if (!newSection) {
      throw new ApiError('SECTION_NOT_FOUND', 'Section not found', 404);
    }

    // Batch must be tenant-wide or belong to the target branch (same rule as listing)
    const targetBatch = await collections.academicBatches.findOne({
      _id: new ObjectId(data.toAcademicBatchId),
      tenantId: new ObjectId(tenantId),
      $or: [{ branchId: new ObjectId(data.toBranchId) }, { branchId: { $exists: false } }],
    });

    if (!targetBatch) {
      throw new ApiError('BATCH_NOT_FOUND', 'Academic batch not found in target branch', 404);
    }

    const now = new Date();
    const transferDate = data.transferDate ? new Date(data.transferDate) : now;

    // Complete current enrollment with transfer status
    await collections.studentEnrollments.updateOne(
      {
        tenantId: new ObjectId(tenantId),
        studentId: new ObjectId(studentId),
        status: 'active',
      },
      {
        $set: {
          status: 'transferred',
          completedDate: transferDate,
          transferDetails: {
            toBranchId: new ObjectId(data.toBranchId),
            reason: data.reason,
          },
          updatedAt: now,
        },
      }
    );

    // Create new enrollment in target branch
    await collections.studentEnrollments.insertOne({
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(data.toBranchId),
      studentId: new ObjectId(studentId),
      academicBatchId: new ObjectId(data.toAcademicBatchId),
      classId: new ObjectId(data.toClassId),
      sectionId: new ObjectId(data.toSectionId),
      enrollmentDate: transferDate,
      enrollmentType: 'transfer',
      previousBranchId: student.branchId,
      status: 'active',
      createdBy: new ObjectId(transferredBy),
      createdAt: now,
      updatedAt: now,
    });

    // Update student record
    const sourceBranch = (await collections.branches.findOne({
      _id: student.branchId,
      tenantId: new ObjectId(tenantId),
    })) as { name?: string } | null;

    const statusEntry = {
      status: 'transferred_in',
      date: now,
      reason: `Transferred from ${sourceBranch?.name || student.branchId.toString()} to ${
        (targetBranch as { name?: string }).name || data.toBranchId
      }`,
      changedBy: new ObjectId(transferredBy),
    };

    await collections.students.updateOne({ _id: new ObjectId(studentId) }, {
      $set: {
        branchId: new ObjectId(data.toBranchId),
        currentEnrollment: {
          academicBatchId: new ObjectId(data.toAcademicBatchId),
          classId: new ObjectId(data.toClassId),
          sectionId: new ObjectId(data.toSectionId),
          className: newClass.displayName,
          sectionName: newSection.name,
        },
        updatedAt: now,
      },
      $push: { statusHistory: statusEntry },
    } as unknown as UpdateFilter<Document>);

    logger.info(
      {
        studentId,
        fromBranchId: student.branchId.toString(),
        toBranchId: data.toBranchId,
        tenantId,
      },
      'Student transferred'
    );

    return this.findById(tenantId, studentId);
  }

  async getClassWiseReport(tenantId: string, branchId: string, academicBatchId?: string) {
    const match: Record<string, unknown> = {
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
      status: 'active',
    };

    if (academicBatchId) {
      match['currentEnrollment.academicBatchId'] = new ObjectId(academicBatchId);
    }

    const report = await collections.students
      .aggregate([
        { $match: match },
        {
          $group: {
            _id: {
              classId: '$currentEnrollment.classId',
              className: '$currentEnrollment.className',
            },
            total: { $sum: 1 },
            male: { $sum: { $cond: [{ $eq: ['$gender', 'male'] }, 1, 0] } },
            female: { $sum: { $cond: [{ $eq: ['$gender', 'female'] }, 1, 0] } },
          },
        },
        {
          $project: {
            _id: 0,
            classId: '$_id.classId',
            className: '$_id.className',
            total: 1,
            male: 1,
            female: 1,
          },
        },
        { $sort: { className: 1 } },
      ])
      .toArray();

    return report;
  }

  async getSectionWiseReport(
    tenantId: string,
    branchId: string,
    classId?: string,
    academicBatchId?: string
  ) {
    const match: Record<string, unknown> = {
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
      status: 'active',
    };

    if (classId) {
      match['currentEnrollment.classId'] = new ObjectId(classId);
    }
    if (academicBatchId) {
      match['currentEnrollment.academicBatchId'] = new ObjectId(academicBatchId);
    }

    const report = await collections.students
      .aggregate([
        { $match: match },
        {
          $group: {
            _id: {
              classId: '$currentEnrollment.classId',
              className: '$currentEnrollment.className',
              sectionId: '$currentEnrollment.sectionId',
              sectionName: '$currentEnrollment.sectionName',
            },
            total: { $sum: 1 },
            male: { $sum: { $cond: [{ $eq: ['$gender', 'male'] }, 1, 0] } },
            female: { $sum: { $cond: [{ $eq: ['$gender', 'female'] }, 1, 0] } },
          },
        },
        {
          $project: {
            _id: 0,
            classId: '$_id.classId',
            className: '$_id.className',
            sectionId: '$_id.sectionId',
            sectionName: '$_id.sectionName',
            total: 1,
            male: 1,
            female: 1,
          },
        },
        { $sort: { className: 1, sectionName: 1 } },
      ])
      .toArray();

    return report;
  }

  async getActiveStudentReport(tenantId: string, branchId: string, academicBatchId?: string) {
    const match: Record<string, unknown> = {
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
      status: 'active',
    };

    if (academicBatchId) {
      match['currentEnrollment.academicBatchId'] = new ObjectId(academicBatchId);
    }

    // Get section capacities
    const sections = await collections.sections
      .aggregate([
        {
          $lookup: {
            from: 'classes',
            localField: 'classId',
            foreignField: '_id',
            as: 'classInfo',
          },
        },
        {
          $unwind: { path: '$classInfo', preserveNullAndEmptyArrays: true },
        },
        {
          $match: {
            'classInfo.tenantId': new ObjectId(tenantId),
            'classInfo.branchId': new ObjectId(branchId),
          },
        },
        {
          $project: {
            _id: 1,
            classId: 1,
            name: 1,
            capacity: { $ifNull: ['$capacity', 40] },
            className: '$classInfo.displayName',
          },
        },
      ])
      .toArray();

    const sectionCapacities = new Map<
      string,
      { capacity: number; className: string; sectionName: string }
    >();
    sections.forEach((s) => {
      sectionCapacities.set((s._id as ObjectId).toString(), {
        capacity: s.capacity as number,
        className: s.className as string,
        sectionName: s.name as string,
      });
    });

    // Get student counts by section
    const studentCounts = await collections.students
      .aggregate([
        { $match: match },
        {
          $group: {
            _id: '$currentEnrollment.sectionId',
            count: { $sum: 1 },
            classId: { $first: '$currentEnrollment.classId' },
            className: { $first: '$currentEnrollment.className' },
            sectionName: { $first: '$currentEnrollment.sectionName' },
          },
        },
      ])
      .toArray();

    const report = studentCounts.map((sc) => {
      const sectionId = (sc._id as ObjectId)?.toString() || '';
      const sectionInfo = sectionCapacities.get(sectionId);
      const capacity = sectionInfo?.capacity || 40;
      const count = sc.count as number;

      return {
        classId: (sc.classId as ObjectId)?.toString(),
        className: sc.className,
        sectionId,
        sectionName: sc.sectionName,
        enrolled: count,
        capacity,
        available: Math.max(0, capacity - count),
        utilizationPercent: Math.round((count / capacity) * 100),
      };
    });

    // Add sections with no students
    sections.forEach((s) => {
      const sectionId = (s._id as ObjectId).toString();
      if (!report.find((r) => r.sectionId === sectionId)) {
        report.push({
          classId: (s.classId as ObjectId).toString(),
          className: s.className as string,
          sectionId,
          sectionName: s.name as string,
          enrolled: 0,
          capacity: s.capacity as number,
          available: s.capacity as number,
          utilizationPercent: 0,
        });
      }
    });

    // Sort by class then section
    report.sort((a, b) => {
      if (a.className < b.className) return -1;
      if (a.className > b.className) return 1;
      if (a.sectionName < b.sectionName) return -1;
      if (a.sectionName > b.sectionName) return 1;
      return 0;
    });

    // Calculate totals
    const totals = report.reduce(
      (acc, r) => ({
        enrolled: acc.enrolled + r.enrolled,
        capacity: acc.capacity + r.capacity,
        available: acc.available + r.available,
      }),
      { enrolled: 0, capacity: 0, available: 0 }
    );

    return {
      sections: report,
      totals: {
        ...totals,
        utilizationPercent:
          totals.capacity > 0 ? Math.round((totals.enrolled / totals.capacity) * 100) : 0,
      },
    };
  }

  async getCategoryWiseReport(tenantId: string, branchId: string, academicBatchId?: string) {
    const match: Record<string, unknown> = {
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
      status: 'active',
    };

    if (academicBatchId) {
      match['currentEnrollment.academicBatchId'] = new ObjectId(academicBatchId);
    }

    const report = await collections.students
      .aggregate([
        { $match: match },
        {
          $group: {
            _id: '$category',
            total: { $sum: 1 },
            male: { $sum: { $cond: [{ $eq: ['$gender', 'male'] }, 1, 0] } },
            female: { $sum: { $cond: [{ $eq: ['$gender', 'female'] }, 1, 0] } },
          },
        },
        {
          $project: {
            _id: 0,
            category: { $ifNull: ['$_id', 'General'] },
            total: 1,
            male: 1,
            female: 1,
          },
        },
        { $sort: { total: -1 } },
      ])
      .toArray();

    return report;
  }

  async getNewAdmissionsReport(
    tenantId: string,
    branchId: string,
    fromDate?: string,
    toDate?: string
  ) {
    const match: Record<string, unknown> = {
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
      status: 'active',
    };

    if (fromDate || toDate) {
      match.admissionDate = {};
      if (fromDate) {
        (match.admissionDate as Record<string, Date>).$gte = new Date(fromDate);
      }
      if (toDate) {
        (match.admissionDate as Record<string, Date>).$lte = new Date(toDate);
      }
    } else {
      // Default to current month
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      match.admissionDate = { $gte: startOfMonth };
    }

    const report = await collections.students
      .aggregate([
        { $match: match },
        {
          $group: {
            _id: {
              classId: '$currentEnrollment.classId',
              className: '$currentEnrollment.className',
            },
            total: { $sum: 1 },
            male: { $sum: { $cond: [{ $eq: ['$gender', 'male'] }, 1, 0] } },
            female: { $sum: { $cond: [{ $eq: ['$gender', 'female'] }, 1, 0] } },
          },
        },
        {
          $project: {
            _id: 0,
            classId: '$_id.classId',
            className: '$_id.className',
            total: 1,
            male: 1,
            female: 1,
          },
        },
        { $sort: { className: 1 } },
      ])
      .toArray();

    const total = report.reduce(
      (acc, r) => ({
        total: acc.total + (r.total as number),
        male: acc.male + (r.male as number),
        female: acc.female + (r.female as number),
      }),
      { total: 0, male: 0, female: 0 }
    );

    return {
      byClass: report,
      summary: total,
    };
  }

  async exportStudents(
    tenantId: string,
    branchId: string,
    params: StudentListParams,
    format: 'csv' | 'json' = 'csv'
  ) {
    // Get all students matching filters (no pagination for export)
    const match: Filter<Document> = {
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
    };

    if (params.status) {
      match.status = Array.isArray(params.status) ? { $in: params.status } : params.status;
    } else {
      match.status = 'active';
    }

    if (params.classId) {
      match['currentEnrollment.classId'] = new ObjectId(params.classId);
    }
    if (params.sectionId) {
      match['currentEnrollment.sectionId'] = new ObjectId(params.sectionId);
    }
    if (params.academicBatchId) {
      match['currentEnrollment.academicBatchId'] = new ObjectId(params.academicBatchId);
    }

    const students = await collections.students
      .find(match)
      .sort({ 'currentEnrollment.className': 1, rollNumber: 1, displayName: 1 })
      .toArray();

    if (format === 'json') {
      return { students, total: students.length };
    }

    // Generate CSV
    const headers = [
      'Admission Number',
      'Enrollment Code',
      'Roll Number',
      'First Name',
      'Last Name',
      'Display Name',
      'Date of Birth',
      'Gender',
      'Category',
      'Class',
      'Section',
      'Phone',
      'Email',
      'Father Name',
      'Mother Name',
      'Status',
    ];

    const rows = students.map((s) => [
      s.admissionNumber || '',
      s.enrollmentCode || '',
      s.rollNumber || '',
      s.firstName || '',
      s.lastName || '',
      s.displayName || '',
      s.dateOfBirth ? new Date(s.dateOfBirth as Date).toISOString().split('T')[0] : '',
      s.gender || '',
      s.category || '',
      (s.currentEnrollment as { className?: string })?.className || '',
      (s.currentEnrollment as { sectionName?: string })?.sectionName || '',
      (s.contact as { phone?: string })?.phone || '',
      (s.contact as { email?: string })?.email || '',
      (s.parents as { father?: { name?: string } })?.father?.name || '',
      (s.parents as { mother?: { name?: string } })?.mother?.name || '',
      s.status || '',
    ]);

    const csv = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
    ].join('\n');

    return {
      filename: `students_export_${new Date().toISOString().split('T')[0]}.csv`,
      content: csv,
      contentType: 'text/csv',
      total: students.length,
    };
  }

  async getFeeSummary(tenantId: string, studentId: string) {
    const tenantObjId = new ObjectId(tenantId);
    const studentObjId = new ObjectId(studentId);

    // Get fee assignments for this student
    const feeAssignments = await collections.feeAssignments
      .find({
        tenantId: tenantObjId,
        studentId: studentObjId,
      })
      .toArray();

    if (feeAssignments.length === 0) {
      return {
        hasData: false,
        message: 'No fee records found for this student',
        summary: {
          totalAssigned: 0,
          totalPaid: 0,
          totalDue: 0,
          totalConcession: 0,
          totalFees: 0,
          totalPending: 0,
          totalOverdue: 0,
        },
        total: 0,
        paid: 0,
        pending: 0,
        assignments: [],
        structures: [],
        recentTransactions: [],
        transactions: [],
      };
    }

    // Get recent transactions (transactions use status 'success', not 'completed')
    const recentTransactions = await collections.feeTransactions
      .find({
        tenantId: tenantObjId,
        studentId: studentObjId,
        status: 'success',
      })
      // Transactions are dated by receiptDate (there is no paymentDate field).
      .sort({ receiptDate: -1 })
      .limit(20)
      .toArray();

    const structureDocs = await collections.feeStructures
      .find({ _id: { $in: feeAssignments.map((fa) => fa.feeStructureId).filter(Boolean) } })
      .project({ name: 1 })
      .toArray();
    const structureName = new Map(structureDocs.map((d) => [d._id.toString(), String(d.name)]));
    const nameOf = (fa: Document) =>
      (fa.feeStructureName as string | undefined) ??
      structureName.get(String(fa.feeStructureId)) ??
      `${String(fa.type ?? 'Tuition').replace(/^\w/, (c) => c.toUpperCase())} fee`;

    // Amounts live in the assignment's `summary` subdocument — there are no
    // flat totalAmount/paidAmount fields (reading them yielded zeros).
    type AssignmentSummary = {
      netPayable?: number;
      totalPaid?: number;
      totalDiscount?: number;
      balance?: number;
      sponsoredAmount?: number;
    };
    const summary = feeAssignments.reduce(
      (acc, fa) => {
        const s = (fa.summary as AssignmentSummary | undefined) ?? {};
        return {
          totalAssigned: acc.totalAssigned + (s.netPayable ?? 0),
          totalPaid: acc.totalPaid + (s.totalPaid ?? 0),
          totalConcession: acc.totalConcession + (s.totalDiscount ?? 0),
          totalSponsored: acc.totalSponsored + (s.sponsoredAmount ?? 0),
        };
      },
      { totalAssigned: 0, totalPaid: 0, totalConcession: 0, totalSponsored: 0 }
    );

    const totalDue = Math.max(0, summary.totalAssigned - summary.totalPaid);
    const now = Date.now();
    type Installment = {
      name?: string;
      installmentNumber?: number;
      dueDate: Date;
      totalDue?: number;
      amount?: number;
      paidAmount?: number;
      balance?: number;
      status?: string;
    };
    const overdue = feeAssignments.reduce(
      (sum, fa) =>
        sum +
        ((fa.installments ?? []) as Installment[])
          .filter((i) => (i.balance ?? 0) > 0 && new Date(i.dueDate).getTime() < now)
          .reduce((acc, i) => acc + (i.balance ?? 0), 0),
      0
    );
    const transactions = recentTransactions.map((t) => ({
      _id: (t._id as ObjectId).toString(),
      amount: (t.totalAmount as number) ?? 0,
      paymentMode: t.paymentMode as string,
      paymentDate: t.receiptDate as Date,
      receiptNumber: t.receiptNumber as string,
    }));

    // One response, three readers: the staff profile (total/paid/pending +
    // transactions), the student portal (structures with installments) and
    // the student app (summary.totalFees/totalPaid/totalPending/totalOverdue).
    return {
      hasData: true,
      summary: {
        ...summary,
        totalDue,
        totalFees: summary.totalAssigned,
        totalPending: totalDue,
        totalOverdue: overdue,
      },
      total: summary.totalAssigned,
      paid: summary.totalPaid,
      pending: totalDue,
      assignments: feeAssignments.map((fa) => {
        const s = (fa.summary as AssignmentSummary | undefined) ?? {};
        return {
          _id: (fa._id as ObjectId).toString(),
          feeStructureName: nameOf(fa),
          totalAmount: s.netPayable ?? 0,
          paidAmount: s.totalPaid ?? 0,
          concessionAmount: s.totalDiscount ?? 0,
          sponsoredAmount: s.sponsoredAmount ?? 0,
          dueAmount: s.balance ?? 0,
          status: fa.status,
        };
      }),
      structures: feeAssignments.map((fa) => {
        const s = (fa.summary as AssignmentSummary | undefined) ?? {};
        return {
          name: nameOf(fa),
          totalAmount: s.netPayable ?? 0,
          paidAmount: s.totalPaid ?? 0,
          balance: s.balance ?? 0,
          installments: ((fa.installments ?? []) as Installment[]).map((i) => ({
            name: i.name ?? `Installment ${i.installmentNumber ?? ''}`.trim(),
            dueDate: i.dueDate,
            amount: i.totalDue ?? i.amount ?? 0,
            paidAmount: i.paidAmount ?? 0,
            balance: i.balance ?? 0,
            status: i.status ?? ((i.balance ?? 0) > 0 ? 'pending' : 'paid'),
          })),
        };
      }),
      recentTransactions: transactions.slice(0, 5),
      transactions: transactions.map((t) => ({
        _id: t._id,
        date: t.paymentDate,
        amount: t.amount,
        mode: t.paymentMode,
        receiptNumber: t.receiptNumber,
        type: 'payment',
      })),
    };
  }

  async getAttendanceSummary(tenantId: string, studentId: string) {
    // Last six months, lectures when the campus marks lecture-wise.
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const s = await studentAttendanceService.summariseForStudent(tenantId, studentId, from);
    return {
      hasData: s.overall.held > 0,
      ...(s.overall.held === 0 && { message: 'No attendance records yet' }),
      basis: s.basis,
      month: now.getMonth() + 1,
      year: now.getFullYear(),
      totalDays: s.overall.held,
      present: s.overall.present + s.overall.late,
      absent: s.overall.absent,
      percentage: s.overall.percentage,
      threshold: s.threshold,
      monthly: s.monthly,
      subjects: s.subjects,
      summary: {
        totalDays: s.overall.held,
        present: s.overall.present,
        absent: s.overall.absent,
        late: s.overall.late,
        leave: s.overall.leave,
        attendancePercent: s.overall.percentage,
      },
    };
  }

  getBulkUploadTemplate() {
    const headers = [
      'firstName*',
      'lastName*',
      'dateOfBirth* (YYYY-MM-DD)',
      'gender* (male/female/other)',
      'className*',
      'sectionName*',
      'rollNumber',
      'category',
      'phone',
      'email',
      'fatherName',
      'fatherPhone',
      'motherName',
      'motherPhone',
      'address',
      'city',
      'state',
      'pincode',
    ];

    const sampleRow = [
      'John',
      'Doe',
      '2015-05-15',
      'male',
      'Class 1',
      'Section A',
      '1',
      'General',
      '9876543210',
      'john@example.com',
      'Robert Doe',
      '9876543211',
      'Jane Doe',
      '9876543212',
      '123 Main Street',
      'Mumbai',
      'Maharashtra',
      '400001',
    ];

    const csv = [headers.join(','), sampleRow.map((cell) => `"${cell}"`).join(',')].join('\n');

    return {
      filename: 'student_bulk_upload_template.csv',
      content: csv,
      contentType: 'text/csv',
    };
  }

  /**
   * Get alumni list with optional filters
   */
  async getAlumniList(
    tenantId: string,
    branchId: string,
    params: {
      page?: number;
      limit?: number;
      classId?: string;
      search?: string;
      fromYear?: string;
      toYear?: string;
    } = {}
  ) {
    const { page = 1, limit = 20, classId, search, fromYear, toYear } = params;

    const filter: Record<string, unknown> = {
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
      status: 'alumni',
    };

    if (classId) {
      filter['currentEnrollment.classId'] = new ObjectId(classId);
    }

    if (search) {
      filter.$or = [
        { displayName: { $regex: search, $options: 'i' } },
        { admissionNumber: { $regex: search, $options: 'i' } },
      ];
    }

    // Filter by status history (when they became alumni)
    if (fromYear || toYear) {
      filter.statusHistory = {
        $elemMatch: {
          status: 'alumni',
          ...(fromYear && { date: { $gte: new Date(`${fromYear}-01-01`) } }),
          ...(toYear && { date: { $lte: new Date(`${toYear}-12-31`) } }),
        },
      };
    }

    const skip = (page - 1) * limit;

    const [alumni, total] = await Promise.all([
      collections.students
        .find(filter)
        .sort({ displayName: 1 })
        .skip(skip)
        .limit(limit)
        .toArray() as Promise<WithId<StudentDocument>[]>,
      collections.students.countDocuments(filter),
    ]);

    return {
      data: alumni.map((s) => this.formatStudent(s)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: skip + alumni.length < total,
      },
    };
  }

  /**
   * Get alumni statistics
   */
  async getAlumniStats(tenantId: string, branchId: string) {
    const match = {
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
      status: 'alumni',
    };

    const [total, byClass, byYear] = await Promise.all([
      collections.students.countDocuments(match),
      collections.students
        .aggregate([
          { $match: match },
          {
            $group: {
              _id: {
                classId: '$currentEnrollment.classId',
                className: '$currentEnrollment.className',
              },
              count: { $sum: 1 },
            },
          },
          {
            $project: {
              _id: 0,
              classId: '$_id.classId',
              className: '$_id.className',
              count: 1,
            },
          },
          { $sort: { className: 1 } },
        ])
        .toArray(),
      collections.students
        .aggregate([
          { $match: match },
          { $unwind: { path: '$statusHistory', preserveNullAndEmptyArrays: false } },
          { $match: { 'statusHistory.status': 'alumni' } },
          {
            $group: {
              _id: { $year: '$statusHistory.date' },
              count: { $sum: 1 },
            },
          },
          {
            $project: {
              _id: 0,
              year: '$_id',
              count: 1,
            },
          },
          { $sort: { year: -1 } },
        ])
        .toArray(),
    ]);

    return {
      total,
      byClass: byClass.map((c) => ({
        classId: c.classId?.toString(),
        className: c.className || 'Unknown',
        count: c.count,
      })),
      byGraduationYear: byYear,
    };
  }

  private formatStudent(student: WithId<StudentDocument>) {
    return {
      _id: student._id?.toString(),
      tenantId: student.tenantId?.toString(),
      branchId: student.branchId?.toString(),
      admissionNumber: student.admissionNumber,
      enrollmentCode: student.enrollmentCode,
      rollNumber: student.rollNumber,
      firstName: student.firstName,
      lastName: student.lastName,
      displayName: student.displayName,
      dateOfBirth: student.dateOfBirth,
      gender: student.gender,
      bloodGroup: student.bloodGroup,
      nationality: student.nationality,
      religion: student.religion,
      caste: student.caste,
      category: student.category,
      aadharNumber: student.aadharNumber,
      abcId: student.abcId,
      // Derived by the exams module on result publish; read-only here.
      academicSummary: student.academicSummary,
      photo: student.photo,
      contact: student.contact,
      parents: student.parents,
      primaryContactType: student.primaryContactType,
      admissionDate: student.admissionDate,
      admissionType: student.admissionType,
      previousSchool: student.previousSchool,
      currentEnrollment: student.currentEnrollment
        ? {
            academicBatchId: student.currentEnrollment.academicBatchId?.toString(),
            classId: student.currentEnrollment.classId?.toString(),
            sectionId: student.currentEnrollment.sectionId?.toString(),
            className: student.currentEnrollment.className,
            sectionName: student.currentEnrollment.sectionName,
            labBatchId: student.currentEnrollment.labBatchId?.toString(),
          }
        : undefined,
      familyId: student.familyId,
      siblingIds: student.siblingIds?.map((id) => id?.toString()),
      userId: student.userId?.toString(),
      status: student.status,
      tags: student.tags,
      notes: student.notes,
      customFields: student.customFields,
      createdAt: student.createdAt,
      updatedAt: student.updatedAt,
    };
  }

  // ============ Bulk operations from list page selection ============

  async bulkUpdateStatus(
    tenantId: string,
    branchId: string,
    data: {
      studentIds: string[];
      status: 'active' | 'inactive' | 'alumni' | 'transferred';
      reason?: string;
    },
    updatedBy: string
  ) {
    if (!Array.isArray(data.studentIds) || data.studentIds.length === 0) {
      throw new ApiError('NO_STUDENTS', 'No students selected', 400);
    }

    const ids = data.studentIds.map((id) => new ObjectId(id));
    const filter: Filter<Document> = {
      _id: { $in: ids },
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
    };

    const now = new Date();
    const reason = data.reason || 'Status updated (bulk)';
    const statusEntry = {
      status: data.status,
      date: now,
      reason,
      changedBy: new ObjectId(updatedBy),
    };

    const updateResult = await collections.students.updateMany(filter, {
      $set: { status: data.status, updatedAt: now },
      $push: { statusHistory: statusEntry },
    } as unknown as UpdateFilter<Document>);

    if (data.status === 'alumni' || data.status === 'transferred') {
      await collections.studentEnrollments.updateMany(
        {
          studentId: { $in: ids },
          status: 'active',
        },
        {
          $set: {
            status: data.status === 'alumni' ? 'completed' : 'withdrawn',
            completedDate: now,
            updatedAt: now,
          },
        }
      );
    }

    logger.info(
      { tenantId, branchId, count: updateResult.modifiedCount, status: data.status, updatedBy },
      'Bulk student status update'
    );

    return {
      matched: updateResult.matchedCount,
      modified: updateResult.modifiedCount,
    };
  }

  async bulkShuffle(
    tenantId: string,
    branchId: string,
    data: {
      studentIds: string[];
      newSectionId: string;
      reason?: string;
    },
    shuffledBy: string
  ) {
    if (!Array.isArray(data.studentIds) || data.studentIds.length === 0) {
      throw new ApiError('NO_STUDENTS', 'No students selected', 400);
    }

    const ids = data.studentIds.map((id) => new ObjectId(id));
    const tenantObjId = new ObjectId(tenantId);
    const newSectionObjId = new ObjectId(data.newSectionId);

    const newSection = (await collections.sections.findOne({
      _id: newSectionObjId,
    })) as { _id: ObjectId; name: string; classId: ObjectId } | null;

    if (!newSection) {
      throw new ApiError('SECTION_NOT_FOUND', 'Section not found', 404);
    }

    // Only shuffle active students belonging to the same class as the destination section
    const students = (await collections.students
      .find({
        _id: { $in: ids },
        tenantId: tenantObjId,
        branchId: new ObjectId(branchId),
        status: 'active',
        'currentEnrollment.classId': newSection.classId,
      })
      .toArray()) as Array<WithId<StudentDocument>>;

    if (students.length === 0) {
      throw new ApiError(
        'NO_ELIGIBLE_STUDENTS',
        'None of the selected students are active in the target section’s class',
        400
      );
    }

    const eligibleIds = students.map((s) => s._id);
    const now = new Date();

    await collections.students.updateMany(
      { _id: { $in: eligibleIds } },
      {
        $set: {
          'currentEnrollment.sectionId': newSectionObjId,
          'currentEnrollment.sectionName': newSection.name,
          updatedAt: now,
        },
      }
    );

    // Update active enrollments + append shuffle history per student
    await Promise.all(
      students.map((student) =>
        collections.studentEnrollments.updateOne({ studentId: student._id, status: 'active' }, {
          $set: {
            sectionId: newSectionObjId,
            updatedAt: now,
          },
          $push: {
            shuffleHistory: {
              fromSectionId: student.currentEnrollment?.sectionId,
              toSectionId: newSectionObjId,
              reason: data.reason,
              shuffledBy: new ObjectId(shuffledBy),
              shuffledAt: now,
            },
          },
        } as unknown as UpdateFilter<Document>)
      )
    );

    logger.info(
      {
        tenantId,
        branchId,
        moved: students.length,
        skipped: ids.length - students.length,
        newSectionId: data.newSectionId,
        shuffledBy,
      },
      'Bulk student shuffle'
    );

    return {
      moved: students.length,
      skipped: ids.length - students.length,
    };
  }

  async bulkDelete(tenantId: string, branchId: string, studentIds: string[]) {
    if (!Array.isArray(studentIds) || studentIds.length === 0) {
      throw new ApiError('NO_STUDENTS', 'No students selected', 400);
    }

    const ids = studentIds.map((id) => new ObjectId(id));
    const tenantObjId = new ObjectId(tenantId);
    const branchObjId = new ObjectId(branchId);

    const students = (await collections.students
      .find({
        _id: { $in: ids },
        tenantId: tenantObjId,
        branchId: branchObjId,
      })
      .toArray()) as Array<WithId<StudentDocument>>;

    if (students.length === 0) {
      throw new ApiError('STUDENTS_NOT_FOUND', 'No matching students found', 404);
    }

    const eligibleIds = students.map((s) => s._id);
    const userIds = students.map((s) => s.userId).filter((u): u is ObjectId => !!u);
    const now = new Date();

    // Soft-delete: per student, preserve their currentEnrollment as previousEnrollment
    await Promise.all(
      students.map((student) =>
        collections.students.updateOne(
          { _id: student._id },
          {
            $set: {
              status: 'deleted',
              updatedAt: now,
              previousEnrollment: student.currentEnrollment,
            },
            $unset: { currentEnrollment: '' },
          }
        )
      )
    );

    await collections.studentEnrollments.updateMany(
      { studentId: { $in: eligibleIds }, status: 'active' },
      { $set: { status: 'withdrawn', updatedAt: now } }
    );

    if (userIds.length) {
      await collections.users.updateMany(
        { _id: { $in: userIds } },
        { $set: { status: 'inactive', updatedAt: now } }
      );
    }

    logger.info({ tenantId, branchId, count: students.length }, 'Bulk student delete (soft)');

    return {
      deleted: students.length,
      skipped: ids.length - students.length,
    };
  }

  async exportStudentsByIds(
    tenantId: string,
    branchId: string,
    studentIds: string[],
    format: 'csv' | 'json' = 'csv'
  ) {
    if (!Array.isArray(studentIds) || studentIds.length === 0) {
      throw new ApiError('NO_STUDENTS', 'No students selected', 400);
    }

    const ids = studentIds.map((id) => new ObjectId(id));
    const students = await collections.students
      .find({
        _id: { $in: ids },
        tenantId: new ObjectId(tenantId),
        branchId: new ObjectId(branchId),
      })
      .sort({ 'currentEnrollment.className': 1, rollNumber: 1, displayName: 1 })
      .toArray();

    if (format === 'json') {
      return { students, total: students.length };
    }

    const headers = [
      'Admission Number',
      'Enrollment Code',
      'Roll Number',
      'First Name',
      'Last Name',
      'Display Name',
      'Date of Birth',
      'Gender',
      'Category',
      'Class',
      'Section',
      'Phone',
      'Email',
      'Father Name',
      'Mother Name',
      'Status',
    ];

    const rows = students.map((s) => [
      s.admissionNumber || '',
      s.enrollmentCode || '',
      s.rollNumber || '',
      s.firstName || '',
      s.lastName || '',
      s.displayName || '',
      s.dateOfBirth ? new Date(s.dateOfBirth as Date).toISOString().split('T')[0] : '',
      s.gender || '',
      s.category || '',
      (s.currentEnrollment as { className?: string })?.className || '',
      (s.currentEnrollment as { sectionName?: string })?.sectionName || '',
      (s.contact as { phone?: string })?.phone || '',
      (s.contact as { email?: string })?.email || '',
      (s.parents as { father?: { name?: string } })?.father?.name || '',
      (s.parents as { mother?: { name?: string } })?.mother?.name || '',
      s.status || '',
    ]);

    const csv = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
    ].join('\n');

    return {
      filename: `students_selected_${new Date().toISOString().split('T')[0]}.csv`,
      content: csv,
      contentType: 'text/csv',
      total: students.length,
    };
  }
}

export const studentService = new StudentService();
