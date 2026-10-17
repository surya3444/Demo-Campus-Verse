import { ObjectId, Document } from 'mongodb';
import bcrypt from 'bcryptjs';
import { collections } from '../../config/database';
import { ApiError } from '../../middleware/errorHandler';
import { logger } from '../../lib/logger';
import { generateSequence, padSequence, generatePassword } from '../../utils/generators';
import { feeStructureService } from '../finance/feeStructure.service';
import { emailService } from '../../services/email.service';
import { resolveClassByName, type GradeCodePathEntry } from '@campus-verse/shared/utils';
import { resolveBranchHierarchy } from '../organization/class.service';

// Lifecycle states accepted by the bulk importer. Matches STUDENT_STATUS in the
// shared constants; duplicated as a plain array here to avoid importing the
// shared package just for lookup.
const VALID_STATUSES = [
  'active',
  'inactive',
  'alumni',
  'archived',
  'transferred',
  'withdrawn',
] as const;
type BulkStudentStatus = (typeof VALID_STATUSES)[number];

interface BulkStudentRow {
  // Required fields
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  className: string;
  sectionName: string;

  // Optional fields
  rollNumber?: string;
  category?: string;
  phone?: string;
  email?: string;
  fatherName?: string;
  fatherPhone?: string;
  motherName?: string;
  motherPhone?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  /**
   * Lifecycle status. Default 'active'. Use 'alumni' / 'archived' /
   * 'transferred' / 'withdrawn' when importing historical rosters so fee
   * auto-assignment is skipped and the records land as non-active.
   */
  status?: string;
  /** YYYY-MM-DD. Optional — overrides the default "now" admission date. */
  admissionDate?: string;
}

interface ValidationError {
  row: number;
  field: string;
  message: string;
}

interface ParsedStudent extends BulkStudentRow {
  classId: string;
  sectionId: string;
}

interface ValidateResult {
  totalRows: number;
  validCount: number;
  errorCount: number;
  errors: ValidationError[];
  validatedData: ParsedStudent[];
}

interface ProcessResult {
  bulkUploadId: string;
  totalRows: number;
  successCount: number;
  failedCount: number;
  results: Array<{
    row: number;
    admissionNumber?: string;
    status: 'success' | 'failed';
    message?: string;
  }>;
}

// Indian phone regex - accepts 10 digits starting with 6-9, optionally with +91/91/0 prefix
const PHONE_REGEX = /^(?:\+91|91|0)?[6-9]\d{9}$/;

class StudentBulkUploadService {
  /**
   * Parse CSV content into row objects
   */
  parseCSV(csvContent: string): BulkStudentRow[] {
    const lines = csvContent.split('\n').filter((line) => line.trim());

    if (lines.length < 2) {
      return [];
    }

    // Parse headers (first line)
    const headers = this.parseCSVLine(lines[0]).map((h) =>
      h.trim().replace(/[*()]/g, '').split(' ')[0].toLowerCase()
    );

    // Normalize header names
    const headerMap: Record<string, string> = {
      firstname: 'firstName',
      lastname: 'lastName',
      dateofbirth: 'dateOfBirth',
      gender: 'gender',
      classname: 'className',
      sectionname: 'sectionName',
      rollnumber: 'rollNumber',
      category: 'category',
      phone: 'phone',
      email: 'email',
      fathername: 'fatherName',
      fatherphone: 'fatherPhone',
      mothername: 'motherName',
      motherphone: 'motherPhone',
      address: 'address',
      city: 'city',
      state: 'state',
      pincode: 'pincode',
      status: 'status',
      admissiondate: 'admissionDate',
    };

    const rows: BulkStudentRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = this.parseCSVLine(lines[i]);
      const row: Record<string, string> = {};

      headers.forEach((header, index) => {
        const normalizedHeader = headerMap[header] || header;
        row[normalizedHeader] = values[index]?.trim() || '';
      });

      // Only add non-empty rows
      if (row.firstName || row.lastName) {
        rows.push(row as unknown as BulkStudentRow);
      }
    }

    return rows;
  }

  /**
   * Parse a single CSV line, handling quoted fields
   */
  private parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.replace(/^"|"$/g, '').trim());
        current = '';
      } else {
        current += char;
      }
    }

    result.push(current.replace(/^"|"$/g, '').trim());
    return result;
  }

  /**
   * Validate rows and resolve class/section IDs
   */
  async validateRows(
    tenantId: string,
    branchId: string,
    academicBatchId: string,
    rows: BulkStudentRow[]
  ): Promise<ValidateResult> {
    const result: ValidateResult = {
      totalRows: rows.length,
      validCount: 0,
      errorCount: 0,
      errors: [],
      validatedData: [],
    };

    if (rows.length === 0) {
      return result;
    }

    // Get classes for this branch and batch
    const classes = await collections.classes
      .find({
        tenantId: new ObjectId(tenantId),
        branchId: new ObjectId(branchId),
        academicBatchId: new ObjectId(academicBatchId),
        status: 'active',
      })
      .toArray();

    // Spreadsheets rarely spell the class the way we store it: a school sheet
    // says "5" or "Class 5" for a class stored as "Grade 5", a university sheet
    // says "CS Year 1" for "Computer Science · Year 1". resolveClassByName
    // matches on the hierarchy path (department code OR name, plus the year
    // number) and returns null when the value is ambiguous — the web app calls
    // the same shared helper, so what previews resolves identically on submit.
    const classCandidates = classes.map((c) => ({
      _id: c._id as ObjectId,
      displayName: c.displayName as string,
      path: (c.path ?? []) as GradeCodePathEntry[],
    }));
    type ResolvedClass = (typeof classCandidates)[number];

    const classLookupCache = new Map<string, ResolvedClass | null>();
    const lookupClass = (value: string): ResolvedClass | null => {
      const key = (value ?? '').trim().toLowerCase();
      if (!key) return null;
      const cached = classLookupCache.get(key);
      if (cached !== undefined) return cached;
      const match = resolveClassByName(key, classCandidates) ?? null;
      classLookupCache.set(key, match);
      return match;
    };

    // Get all sections
    const classIds = classes.map((c) => c._id);
    const sections = await collections.sections
      .find({
        tenantId: new ObjectId(tenantId),
        classId: { $in: classIds },
      })
      .toArray();

    // Map sections by classId-sectionName
    const sectionMap = new Map<string, { _id: ObjectId; name: string; classId: ObjectId }>();
    sections.forEach((s) => {
      const key = `${s.classId.toString()}-${(s.name as string).toLowerCase()}`;
      sectionMap.set(key, {
        _id: s._id as ObjectId,
        name: s.name as string,
        classId: s.classId as ObjectId,
      });
    });

    // ───────── Pre-fetch existing students for duplicate detection ─────────
    // Identity match: tenant + firstName + lastName + dateOfBirth (case-insensitive
    // name compare). Roll-number match: tenant + branch + classId + sectionId +
    // rollNumber. Querying once up-front keeps the per-row loop O(1).
    const identityCandidates = rows
      .filter((r) => r.firstName?.trim() && r.lastName?.trim() && r.dateOfBirth)
      .map((r) => ({
        firstName: r.firstName.trim(),
        lastName: r.lastName.trim(),
        dateOfBirth: new Date(r.dateOfBirth),
      }))
      .filter((r) => !isNaN(r.dateOfBirth.getTime()));

    const existingIdentitySet = new Set<string>();
    if (identityCandidates.length > 0) {
      const existing = await collections.students
        .find(
          {
            tenantId: new ObjectId(tenantId),
            // Soft-deleted students should not block a fresh import — admins
            // routinely re-add students they previously removed.
            status: { $ne: 'deleted' },
            $or: identityCandidates,
          },
          { collation: { locale: 'en', strength: 2 } }
        )
        .project({ firstName: 1, lastName: 1, dateOfBirth: 1 })
        .toArray();
      existing.forEach((s) => {
        const dobIso =
          s.dateOfBirth instanceof Date
            ? s.dateOfBirth.toISOString().slice(0, 10)
            : new Date(s.dateOfBirth as string).toISOString().slice(0, 10);
        existingIdentitySet.add(
          `${(s.firstName as string).toLowerCase()}-${(s.lastName as string).toLowerCase()}-${dobIso}`
        );
      });
    }

    // Roll-number duplicate index for the destination sections.
    const existingRollSet = new Set<string>();
    const rollCandidates = rows
      .filter(
        (r) => r.rollNumber?.toString().trim() && r.className?.trim() && r.sectionName?.trim()
      )
      .map((r) => {
        const classInfo = lookupClass(r.className);
        if (!classInfo) return null;
        const sectionInfo = sectionMap.get(
          `${classInfo._id.toString()}-${r.sectionName.trim().toLowerCase()}`
        );
        if (!sectionInfo) return null;
        return {
          classId: classInfo._id,
          sectionId: sectionInfo._id,
          rollNumber: r.rollNumber!.toString().trim(),
        };
      })
      .filter(
        (r): r is { classId: ObjectId; sectionId: ObjectId; rollNumber: string } => r !== null
      );

    if (rollCandidates.length > 0) {
      const existingRolls = await collections.students
        .find({
          tenantId: new ObjectId(tenantId),
          branchId: new ObjectId(branchId),
          // Soft-deleted students don't reserve their roll number anymore.
          status: { $ne: 'deleted' },
          $or: rollCandidates.map((rc) => ({
            'currentEnrollment.classId': rc.classId,
            'currentEnrollment.sectionId': rc.sectionId,
            rollNumber: rc.rollNumber,
          })),
        })
        .project({ rollNumber: 1, currentEnrollment: 1 })
        .toArray();
      existingRolls.forEach((s) => {
        const enr = s.currentEnrollment as { classId?: ObjectId; sectionId?: ObjectId } | undefined;
        if (!enr?.classId || !enr?.sectionId) return;
        existingRollSet.add(
          `${enr.classId.toString()}-${enr.sectionId.toString()}-${(s.rollNumber as string).toLowerCase()}`
        );
      });
    }

    // Track duplicates within upload
    const processedSet = new Set<string>();
    const processedRollSet = new Set<string>();

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNumber = i + 2; // Account for header row
      const rowErrors: ValidationError[] = [];

      // Validate required fields
      if (!row.firstName?.trim()) {
        rowErrors.push({
          row: rowNumber,
          field: 'firstName',
          message: 'First name is required',
        });
      }

      if (!row.lastName?.trim()) {
        rowErrors.push({
          row: rowNumber,
          field: 'lastName',
          message: 'Last name is required',
        });
      }

      if (!row.dateOfBirth) {
        rowErrors.push({
          row: rowNumber,
          field: 'dateOfBirth',
          message: 'Date of birth is required',
        });
      } else {
        const dob = new Date(row.dateOfBirth);
        if (isNaN(dob.getTime())) {
          rowErrors.push({
            row: rowNumber,
            field: 'dateOfBirth',
            message: `Invalid date format: ${row.dateOfBirth}. Use YYYY-MM-DD`,
          });
        } else {
          // Validate age between 3 and 30
          const age = (Date.now() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
          if (age < 3 || age > 30) {
            rowErrors.push({
              row: rowNumber,
              field: 'dateOfBirth',
              message: 'Student age must be between 3 and 30 years',
            });
          }
        }
      }

      if (!row.gender) {
        rowErrors.push({
          row: rowNumber,
          field: 'gender',
          message: 'Gender is required',
        });
      } else if (!['male', 'female', 'other'].includes(row.gender.toLowerCase())) {
        rowErrors.push({
          row: rowNumber,
          field: 'gender',
          message: `Invalid gender: ${row.gender}. Must be male/female/other`,
        });
      }

      if (!row.className?.trim()) {
        rowErrors.push({
          row: rowNumber,
          field: 'className',
          message: 'Class name is required',
        });
      }

      if (!row.sectionName?.trim()) {
        rowErrors.push({
          row: rowNumber,
          field: 'sectionName',
          message: 'Section name is required',
        });
      }

      // Validate optional fields
      if (row.phone && !PHONE_REGEX.test(row.phone)) {
        rowErrors.push({
          row: rowNumber,
          field: 'phone',
          message: 'Invalid phone number format',
        });
      }

      if (row.fatherPhone && !PHONE_REGEX.test(row.fatherPhone)) {
        rowErrors.push({
          row: rowNumber,
          field: 'fatherPhone',
          message: 'Invalid father phone number format',
        });
      }

      if (row.motherPhone && !PHONE_REGEX.test(row.motherPhone)) {
        rowErrors.push({
          row: rowNumber,
          field: 'motherPhone',
          message: 'Invalid mother phone number format',
        });
      }

      if (row.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) {
        rowErrors.push({
          row: rowNumber,
          field: 'email',
          message: 'Invalid email format',
        });
      }

      if (row.category && !['general', 'obc', 'sc', 'st'].includes(row.category.toLowerCase())) {
        rowErrors.push({
          row: rowNumber,
          field: 'category',
          message: `Invalid category: ${row.category}. Must be general/obc/sc/st`,
        });
      }

      if (row.pincode && !/^\d{6}$/.test(row.pincode)) {
        rowErrors.push({
          row: rowNumber,
          field: 'pincode',
          message: 'Pincode must be 6 digits',
        });
      }

      if (row.status && !VALID_STATUSES.includes(row.status.toLowerCase() as BulkStudentStatus)) {
        rowErrors.push({
          row: rowNumber,
          field: 'status',
          message: `Invalid status: ${row.status}. Must be one of ${VALID_STATUSES.join('/')}`,
        });
      }

      if (row.admissionDate) {
        const ad = new Date(row.admissionDate);
        if (isNaN(ad.getTime())) {
          rowErrors.push({
            row: rowNumber,
            field: 'admissionDate',
            message: `Invalid admission date: ${row.admissionDate}. Use YYYY-MM-DD`,
          });
        }
      }

      // Validate class exists
      let classId: string | undefined;
      let sectionId: string | undefined;

      if (row.className) {
        const classInfo = lookupClass(row.className);
        if (!classInfo) {
          // Name the real classes — "Class not found: 1" is useless when the
          // fix is to write "CS Year 1" instead of a bare year number.
          const known = classCandidates.map((c) => c.displayName);
          const examples =
            known.length <= 6 ? known.join(', ') : `${known.slice(0, 6).join(', ')}, …`;
          rowErrors.push({
            row: rowNumber,
            field: 'className',
            message: known.length
              ? `Class not found: "${row.className}". Expected one of: ${examples}`
              : `Class not found: "${row.className}". No classes exist in this academic batch.`,
          });
        } else {
          classId = classInfo._id.toString();

          // Validate section exists for this class
          if (row.sectionName) {
            const sectionKey = `${classInfo._id.toString()}-${row.sectionName.toLowerCase()}`;
            const sectionInfo = sectionMap.get(sectionKey);
            if (!sectionInfo) {
              rowErrors.push({
                row: rowNumber,
                field: 'sectionName',
                message: `Section "${row.sectionName}" not found in class "${row.className}"`,
              });
            } else {
              sectionId = sectionInfo._id.toString();
            }
          }
        }
      }

      // Check for duplicates within upload
      if (row.firstName && row.lastName && row.dateOfBirth) {
        const dobIso = (() => {
          const d = new Date(row.dateOfBirth);
          return isNaN(d.getTime()) ? row.dateOfBirth : d.toISOString().slice(0, 10);
        })();
        const key = `${row.firstName.trim().toLowerCase()}-${row.lastName.trim().toLowerCase()}-${dobIso}`;
        if (processedSet.has(key)) {
          rowErrors.push({
            row: rowNumber,
            field: 'firstName',
            message: 'Duplicate entry in upload (same name and DOB)',
          });
        } else if (existingIdentitySet.has(key)) {
          // Already exists in the database — same name and DOB at the tenant
          // level. Block re-importing the same student.
          rowErrors.push({
            row: rowNumber,
            field: 'firstName',
            message: 'A student with this name and date of birth already exists',
          });
        }
        processedSet.add(key);
      }

      // Roll-number conflict check (within upload + against DB) for the
      // resolved class/section.
      if (row.rollNumber?.toString().trim() && classId && sectionId) {
        const rollKey = `${classId}-${sectionId}-${row.rollNumber.toString().trim().toLowerCase()}`;
        if (processedRollSet.has(rollKey)) {
          rowErrors.push({
            row: rowNumber,
            field: 'rollNumber',
            message: 'Duplicate roll number in upload for this section',
          });
        } else if (existingRollSet.has(rollKey)) {
          rowErrors.push({
            row: rowNumber,
            field: 'rollNumber',
            message: 'Roll number already taken in this section',
          });
        }
        processedRollSet.add(rollKey);
      }

      if (rowErrors.length > 0) {
        result.errors.push(...rowErrors);
        result.errorCount++;
      } else if (classId && sectionId) {
        result.validCount++;
        result.validatedData.push({
          ...row,
          classId,
          sectionId,
          gender: row.gender.toLowerCase(),
          category: row.category?.toLowerCase(),
          status: row.status?.toLowerCase(),
        });
      }
    }

    return result;
  }

  /**
   * Process validated data and create students
   */
  async processUpload(
    tenantId: string,
    branchId: string,
    academicBatchId: string,
    validatedData: ParsedStudent[],
    createdBy: string,
    meta?: { fileName?: string; source?: 'csv' | 'ai' | 'manual' }
  ): Promise<ProcessResult> {
    // One id for the whole batch. Every student created below is tagged with
    // it, and a bulk_uploads record links back here — that's what powers the
    // upload-history list and its cascade delete.
    const bulkUploadId = new ObjectId();

    const result: ProcessResult = {
      bulkUploadId: bulkUploadId.toString(),
      totalRows: validatedData.length,
      successCount: 0,
      failedCount: 0,
      results: [],
    };

    if (validatedData.length === 0) {
      return result;
    }

    // Get branch and batch info for admission number generation
    const [branch, batch] = await Promise.all([
      collections.branches.findOne({
        _id: new ObjectId(branchId),
        tenantId: new ObjectId(tenantId),
      }),
      collections.academicBatches.findOne({
        _id: new ObjectId(academicBatchId),
        tenantId: new ObjectId(tenantId),
      }),
    ]);

    if (!branch || !batch) {
      throw new Error('Branch or batch not found');
    }

    // Track what this batch creates so the history record can show counts and
    // the cascade delete knows exactly which user accounts to remove (only the
    // ones THIS upload minted — never a pre-existing account it merely linked).
    const createdStudentIds: ObjectId[] = [];
    const createdUserIds: ObjectId[] = [];

    const branchCode = branch.code as string;
    const batchCode = batch.code as string;
    const now = new Date();

    // Pre-fetch the STUDENT role once — every row that has an email will get
    // a user account so the student can sign in. If the role is missing, we
    // log once and skip user creation across the whole batch (the import
    // itself still succeeds).
    const studentRole = await collections.roles.findOne({
      tenantId: new ObjectId(tenantId),
      code: 'STUDENT',
    });
    if (!studentRole) {
      logger.warn(
        { tenantId },
        'STUDENT role not found — bulk upload will skip user account creation'
      );
    }

    // Pre-fetch the tenant name once for the welcome-email "from" line.
    const tenantDoc = await collections.tenants.findOne(
      { _id: new ObjectId(tenantId) },
      { projection: { name: 1 } }
    );
    const organizationName = (tenantDoc?.name as string) || 'Campus Verse';

    // Get class and section display names for currentEnrollment
    const classIds = [...new Set(validatedData.map((d) => d.classId))];
    const sectionIds = [...new Set(validatedData.map((d) => d.sectionId))];

    const [classes, sections] = await Promise.all([
      collections.classes.find({ _id: { $in: classIds.map((id) => new ObjectId(id)) } }).toArray(),
      collections.sections
        .find({ _id: { $in: sectionIds.map((id) => new ObjectId(id)) } })
        .toArray(),
    ]);

    const classNameMap = new Map<string, string>();
    classes.forEach((c) => {
      classNameMap.set(c._id.toString(), c.displayName as string);
    });

    const sectionNameMap = new Map<string, string>();
    sections.forEach((s) => {
      sectionNameMap.set(s._id.toString(), s.name as string);
    });

    // Process each student
    for (let i = 0; i < validatedData.length; i++) {
      const data = validatedData[i];
      const rowNumber = i + 2;

      try {
        // Generate admission number
        const sequence = await generateSequence(
          'admissionNumber',
          tenantId,
          branchId,
          academicBatchId
        );
        const admissionNumber = `${branchCode}-${batchCode}-${padSequence(sequence)}`;

        // Generate enrollment code
        const enrollmentSequence = await generateSequence('enrollmentCode', tenantId);
        const enrollmentCode = `EN${padSequence(enrollmentSequence, 8)}`;

        const studentId = new ObjectId();
        const status: BulkStudentStatus = (data.status as BulkStudentStatus) || 'active';
        const admissionDate = data.admissionDate ? new Date(data.admissionDate) : now;

        // Build student document
        const student: Document = {
          _id: studentId,
          tenantId: new ObjectId(tenantId),
          branchId: new ObjectId(branchId),
          admissionNumber,
          enrollmentCode,
          rollNumber: data.rollNumber || undefined,
          firstName: data.firstName.trim(),
          lastName: data.lastName.trim(),
          displayName: `${data.firstName.trim()} ${data.lastName.trim()}`,
          dateOfBirth: new Date(data.dateOfBirth),
          gender: data.gender,
          category: data.category || undefined,
          contact: {
            phone: data.phone || undefined,
            email: data.email || undefined,
            address:
              data.address || data.city || data.state || data.pincode
                ? {
                    current: {
                      street: data.address || undefined,
                      city: data.city || undefined,
                      state: data.state || undefined,
                      pincode: data.pincode || undefined,
                    },
                  }
                : undefined,
          },
          parents: {
            father:
              data.fatherName || data.fatherPhone
                ? { name: data.fatherName, phone: data.fatherPhone }
                : undefined,
            mother:
              data.motherName || data.motherPhone
                ? { name: data.motherName, phone: data.motherPhone }
                : undefined,
          },
          currentEnrollment: {
            academicBatchId: new ObjectId(academicBatchId),
            classId: new ObjectId(data.classId),
            sectionId: new ObjectId(data.sectionId),
            className: classNameMap.get(data.classId) || data.className,
            sectionName: sectionNameMap.get(data.sectionId) || data.sectionName,
          },
          admissionDate,
          admissionType: 'new',
          status,
          statusHistory: [
            {
              status,
              date: now,
              reason: 'Bulk upload',
              changedBy: new ObjectId(createdBy),
            },
          ],
          // Links the student back to its upload batch (see processUpload).
          bulkUploadId,
          createdBy: new ObjectId(createdBy),
          createdAt: now,
          updatedAt: now,
        };

        await collections.students.insertOne(student);

        // Auto-create a user account so the student can sign in. Mirrors the
        // single-student create logic in student.service.ts. Skipped silently
        // when no email is provided or the STUDENT role isn't configured.
        const studentEmail = data.email?.toLowerCase().trim();
        if (studentEmail && studentRole) {
          try {
            const existingUser = await collections.users.findOne({
              tenantId: new ObjectId(tenantId),
              email: studentEmail,
            });
            if (existingUser && !existingUser.studentId) {
              await collections.students.updateOne(
                { _id: studentId },
                { $set: { userId: existingUser._id, updatedAt: new Date() } }
              );
              await collections.users.updateOne(
                { _id: existingUser._id },
                { $set: { studentId, updatedAt: new Date() } }
              );
            } else if (!existingUser) {
              const tempPassword = generatePassword();
              const passwordHash = await bcrypt.hash(tempPassword, 12);
              const userId = new ObjectId();
              await collections.users.insertOne({
                _id: userId,
                tenantId: new ObjectId(tenantId),
                email: studentEmail,
                passwordHash,
                profile: {
                  firstName: data.firstName.trim(),
                  lastName: data.lastName.trim(),
                  displayName: `${data.firstName.trim()} ${data.lastName.trim()}`,
                },
                roleId: studentRole._id,
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
              // Only accounts created here are cascade-deleted with the batch.
              createdUserIds.push(userId);
              logger.info(
                { studentId: studentId.toString(), userId: userId.toString(), tenantId },
                'Auto-created user for bulk uploaded student'
              );

              // Email the credentials. Fire-and-forget — email failures must
              // not fail the bulk import. emailService no-ops with a logged
              // warning when RESEND_API_KEY is missing.
              void emailService
                .sendUserWelcomeEmail(
                  studentEmail,
                  `${data.firstName.trim()} ${data.lastName.trim()}`,
                  tempPassword,
                  organizationName,
                  'Student'
                )
                .catch((emailErr) => {
                  logger.warn(
                    { err: emailErr, studentId: studentId.toString(), email: studentEmail },
                    'Welcome email could not be sent for bulk-uploaded student'
                  );
                });
            }
          } catch (userErr: unknown) {
            const mongoErr = userErr as { code?: number };
            if (mongoErr.code === 11000) {
              logger.info(
                { tenantId, email: studentEmail },
                'Handled duplicate during bulk-upload user creation'
              );
            } else {
              logger.error(
                { err: userErr, studentId: studentId.toString() },
                'Failed to auto-create user during bulk upload — student inserted without login'
              );
            }
          }
        }

        // Mirror student.status onto the enrollment record so historical
        // rosters (alumni / archived) don't pollute active enrollment queries.
        const enrollmentStatus = status === 'active' ? 'active' : status;

        await collections.studentEnrollments.insertOne({
          tenantId: new ObjectId(tenantId),
          branchId: new ObjectId(branchId),
          studentId,
          academicBatchId: new ObjectId(academicBatchId),
          classId: new ObjectId(data.classId),
          sectionId: new ObjectId(data.sectionId),
          enrollmentDate: admissionDate,
          enrollmentType: 'new',
          status: enrollmentStatus,
          createdBy: new ObjectId(createdBy),
          createdAt: now,
          updatedAt: now,
        });

        // Only bill active students. Alumni/archived/withdrawn are historical
        // records — skip fee auto-assignment for them.
        if (status === 'active') {
          feeStructureService
            .autoAssignForStudent(
              tenantId,
              branchId,
              studentId.toString(),
              data.classId,
              data.sectionId,
              academicBatchId,
              createdBy
            )
            .catch((err) => {
              logger.error(
                { studentId: studentId.toString(), err },
                'Fee auto-assignment failed for bulk uploaded student'
              );
            });
        }

        createdStudentIds.push(studentId);
        result.successCount++;
        result.results.push({
          row: rowNumber,
          admissionNumber,
          status: 'success',
        });

        logger.info(
          { studentId: studentId.toString(), admissionNumber, tenantId, branchId },
          'Student created via bulk upload'
        );
      } catch (error) {
        result.failedCount++;
        result.results.push({
          row: rowNumber,
          status: 'failed',
          message: error instanceof Error ? error.message : 'Unknown error',
        });

        logger.error(
          { error, row: rowNumber, data: { firstName: data.firstName, lastName: data.lastName } },
          'Failed to create student via bulk upload'
        );
      }
    }

    // Record the batch for upload history — but only when it actually created
    // students. A run where every row failed leaves nothing to list or revert.
    if (createdStudentIds.length > 0) {
      const uploader = await collections.users.findOne(
        { _id: new ObjectId(createdBy) },
        { projection: { profile: 1 } }
      );
      const uploaderName =
        (uploader?.profile?.displayName as string) ||
        [uploader?.profile?.firstName, uploader?.profile?.lastName].filter(Boolean).join(' ') ||
        'Unknown';

      await collections.bulkUploads.insertOne({
        _id: bulkUploadId,
        tenantId: new ObjectId(tenantId),
        branchId: new ObjectId(branchId),
        academicBatchId: new ObjectId(academicBatchId),
        academicBatchName: (batch.name as string) || (batch.code as string) || '',
        fileName: meta?.fileName?.trim() || null,
        source: meta?.source || 'csv',
        totalRows: result.totalRows,
        successCount: result.successCount,
        failedCount: result.failedCount,
        // Snapshot of what was created. The cascade delete re-queries students
        // by bulkUploadId (authoritative), but this keeps a record even if some
        // were later removed individually.
        studentIds: createdStudentIds,
        createdUserIds,
        status: result.failedCount === 0 ? 'completed' : 'partial',
        uploadedBy: new ObjectId(createdBy),
        uploadedByName: uploaderName,
        createdAt: now,
        updatedAt: now,
      });
    }

    return result;
  }

  /**
   * List bulk upload batches for a branch, most recent first.
   */
  async listUploads(
    tenantId: string,
    branchId: string,
    opts: { skip: number; limit: number }
  ): Promise<{ uploads: Document[]; total: number }> {
    const filter = {
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
    };

    const [docs, total] = await Promise.all([
      collections.bulkUploads
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(opts.skip)
        .limit(opts.limit)
        .toArray(),
      collections.bulkUploads.countDocuments(filter),
    ]);

    // The cascade delete is non-reverting, so a batch's stored counts can drift
    // from reality once individual students are deleted elsewhere. Report the
    // live count of students that still carry this bulkUploadId.
    const uploads = await Promise.all(
      docs.map(async (doc) => {
        const remainingStudents = await collections.students.countDocuments({
          tenantId: new ObjectId(tenantId),
          bulkUploadId: doc._id,
        });
        return {
          ...doc,
          _id: doc._id.toString(),
          tenantId: doc.tenantId.toString(),
          branchId: doc.branchId.toString(),
          academicBatchId: doc.academicBatchId?.toString(),
          uploadedBy: doc.uploadedBy?.toString(),
          studentIds: undefined,
          createdUserIds: undefined,
          remainingStudents,
        };
      })
    );

    return { uploads, total };
  }

  /**
   * Hard-delete a bulk upload batch and everything it created: the students,
   * their enrollment records, their auto-generated fee assignments, and the
   * login accounts this batch minted. Pre-existing accounts it merely linked
   * are unlinked (studentId cleared), not deleted. Attendance and fee
   * transactions are intentionally left as-is — they're historical and may
   * carry real money. This is irreversible.
   */
  async deleteUpload(
    tenantId: string,
    branchId: string,
    bulkUploadId: string
  ): Promise<{ deletedStudents: number; deletedUsers: number }> {
    const tenantObjId = new ObjectId(tenantId);
    const uploadObjId = new ObjectId(bulkUploadId);

    const upload = await collections.bulkUploads.findOne({
      _id: uploadObjId,
      tenantId: tenantObjId,
      branchId: new ObjectId(branchId),
    });

    if (!upload) {
      throw new ApiError('UPLOAD_NOT_FOUND', 'Bulk upload not found', 404);
    }

    // Authoritative set: every student still tagged with this batch.
    const students = await collections.students
      .find({ tenantId: tenantObjId, bulkUploadId: uploadObjId })
      .project({ _id: 1, userId: 1 })
      .toArray();

    const studentIds = students.map((s) => s._id);
    const linkedUserIds = students
      .map((s) => s.userId as ObjectId | undefined)
      .filter((u): u is ObjectId => !!u);
    const createdUserIds = (upload.createdUserIds as ObjectId[] | undefined) || [];

    if (studentIds.length > 0) {
      // Dependent records first, then the students themselves.
      await collections.studentEnrollments.deleteMany({ studentId: { $in: studentIds } });
      await collections.feeAssignments.deleteMany({ studentId: { $in: studentIds } });
      await collections.students.deleteMany({
        tenantId: tenantObjId,
        bulkUploadId: uploadObjId,
      });
    }

    // Delete only the accounts this batch created; unlink the rest.
    if (createdUserIds.length > 0) {
      await collections.users.deleteMany({ _id: { $in: createdUserIds } });
    }
    const unlinkUserIds = linkedUserIds.filter((u) => !createdUserIds.some((c) => c.equals(u)));
    if (unlinkUserIds.length > 0) {
      await collections.users.updateMany(
        { _id: { $in: unlinkUserIds } },
        { $unset: { studentId: '' }, $set: { updatedAt: new Date() } }
      );
    }

    // Remove the batch record last so a mid-way failure leaves it retryable.
    await collections.bulkUploads.deleteOne({ _id: uploadObjId, tenantId: tenantObjId });

    logger.info(
      { tenantId, branchId, bulkUploadId, deletedStudents: studentIds.length },
      'Bulk upload batch hard-deleted'
    );

    return { deletedStudents: studentIds.length, deletedUsers: createdUserIds.length };
  }

  /**
   * Generate CSV template with sample rows based on actual classes/sections
   */
  async getTemplate(
    tenantId: string,
    branchId: string,
    academicBatchId: string
  ): Promise<{ filename: string; content: string; contentType: string }> {
    const headers = [
      'firstName*',
      'lastName*',
      'dateOfBirth* (YYYY-MM-DD)',
      'gender* (male/female/other)',
      'className*',
      'sectionName*',
      'rollNumber',
      'category (general/obc/sc/st)',
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
      'status (active/inactive/alumni/archived/transferred/withdrawn)',
      'admissionDate (YYYY-MM-DD)',
    ];

    // Get classes and sections for this batch
    const classes = await collections.classes
      .find({
        tenantId: new ObjectId(tenantId),
        branchId: new ObjectId(branchId),
        academicBatchId: new ObjectId(academicBatchId),
        status: 'active',
      })
      .sort({ order: 1 })
      .toArray();

    const sampleRows: string[][] = [];
    const names = [
      { first: 'John', last: 'Doe', gender: 'male' },
      { first: 'Jane', last: 'Smith', gender: 'female' },
      { first: 'Alex', last: 'Johnson', gender: 'male' },
      { first: 'Emily', last: 'Brown', gender: 'female' },
      { first: 'Chris', last: 'Wilson', gender: 'other' },
    ];

    // Sample DOBs have to be plausible for the institution: a 10-year-old in a
    // university template is a confusing thing to hand someone as an example.
    const { institutionType } = await resolveBranchHierarchy(tenantId, branchId);
    const baseAge = institutionType === 'school' ? 10 : 18;

    let nameIndex = 0;

    for (const classDoc of classes) {
      const sections = await collections.sections
        .find({
          tenantId: new ObjectId(tenantId),
          classId: classDoc._id,
        })
        .sort({ name: 1 })
        .toArray();

      for (const section of sections) {
        if (nameIndex >= names.length) break;

        const name = names[nameIndex];
        const year = new Date().getFullYear() - baseAge - nameIndex;

        sampleRows.push([
          name.first,
          name.last,
          `${year}-0${nameIndex + 1}-15`,
          name.gender,
          classDoc.displayName as string,
          section.name as string,
          `${nameIndex + 1}`,
          'general',
          `987654321${nameIndex}`,
          `${name.first.toLowerCase()}@example.com`,
          `${name.first} Father`,
          `987654320${nameIndex}`,
          `${name.first} Mother`,
          `987654319${nameIndex}`,
          `${100 + nameIndex} Main Street`,
          'Mumbai',
          'Maharashtra',
          `40000${nameIndex + 1}`,
          'active',
          '',
        ]);

        nameIndex++;
      }

      if (nameIndex >= names.length) break;
    }

    // If no classes/sections found, add a generic sample row
    if (sampleRows.length === 0) {
      sampleRows.push([
        'John',
        'Doe',
        '2015-05-15',
        'male',
        'Class 1',
        'Section A',
        '1',
        'general',
        '9876543210',
        'john@example.com',
        'John Father',
        '9876543211',
        'John Mother',
        '9876543212',
        '123 Main Street',
        'Mumbai',
        'Maharashtra',
        '400001',
        'active',
        '',
      ]);
    }

    // Extra sample row demonstrating an alumni import (only if we have a class to reference).
    if (classes.length > 0 && sampleRows.length > 0) {
      const firstClass = classes[0];
      const firstSectionDoc = await collections.sections.findOne({
        tenantId: new ObjectId(tenantId),
        classId: firstClass._id,
      });
      if (firstSectionDoc) {
        sampleRows.push([
          'Priya',
          'Alumni',
          '2005-06-15',
          'female',
          firstClass.displayName as string,
          firstSectionDoc.name as string,
          '',
          'general',
          '',
          'priya.alumni@example.com',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          'alumni',
          '2021-06-01',
        ]);
      }
    }

    const csvLines = [
      headers.join(','),
      ...sampleRows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
    ];

    return {
      filename: 'student_bulk_upload_template.csv',
      content: csvLines.join('\n'),
      contentType: 'text/csv',
    };
  }
}

export const studentBulkUploadService = new StudentBulkUploadService();
