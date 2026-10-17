import { ObjectId, Document } from 'mongodb';
import { collections } from '../../config/database';
import { logger } from '../../lib/logger';
import { ApiError } from '../../middleware/errorHandler';
import { admissionSettingsService } from './settings.service';

interface BulkApplicationRow {
  // Student info
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: 'male' | 'female' | 'other';
  bloodGroup?: string;
  nationality?: string;
  religion?: string;
  caste?: string;
  category?: string;

  // Contact
  email?: string;
  phone: string;
  alternatePhone?: string;
  street?: string;
  city: string;
  state: string;
  pincode: string;
  country?: string;

  // Parents
  fatherName?: string;
  fatherPhone?: string;
  fatherEmail?: string;
  fatherOccupation?: string;
  motherName?: string;
  motherPhone?: string;
  motherEmail?: string;
  motherOccupation?: string;
  guardianName?: string;
  guardianRelation?: string;
  guardianPhone?: string;

  // Previous Education
  previousSchool?: string;
  previousBoard?: string;
  previousClass?: string;
  previousPercentage?: number;
  yearOfPassing?: number;
  tcNumber?: string;

  // Application
  classCode?: string;
  className?: string;
  sectionCode?: string;
  source?: string;
  referredBy?: string;
}

interface BulkUploadResult {
  success: boolean;
  totalRows: number;
  successCount: number;
  errorCount: number;
  errors: Array<{
    row: number;
    field?: string;
    message: string;
    data?: Record<string, unknown>;
  }>;
  createdApplications: string[];
}

class BulkUploadService {
  async uploadApplications(
    tenantId: string,
    branchId: string,
    academicBatchId: string,
    data: BulkApplicationRow[],
    createdBy: string
  ): Promise<BulkUploadResult> {
    const result: BulkUploadResult = {
      success: true,
      totalRows: data.length,
      successCount: 0,
      errorCount: 0,
      errors: [],
      createdApplications: [],
    };

    if (!data.length) {
      throw new ApiError('NO_DATA', 'No data provided for bulk upload', 400);
    }

    // Get classes for mapping
    const classes = await collections.classes
      .find({
        tenantId: new ObjectId(tenantId),
        branchId: new ObjectId(branchId),
        status: 'active',
      })
      .toArray();

    const classMap = new Map<string, { _id: ObjectId; name: string }>();
    classes.forEach((c) => {
      classMap.set(c.code?.toLowerCase(), { _id: c._id as ObjectId, name: c.name as string });
      classMap.set(c.name?.toLowerCase(), { _id: c._id as ObjectId, name: c.name as string });
    });

    // Get sections for mapping
    const sections = await collections.sections
      .find({
        tenantId: new ObjectId(tenantId),
        branchId: new ObjectId(branchId),
      })
      .toArray();

    const sectionMap = new Map<string, ObjectId>();
    sections.forEach((s) => {
      const key = `${s.classId.toString()}-${s.code?.toLowerCase()}`;
      sectionMap.set(key, s._id as ObjectId);
    });

    const now = new Date();
    const applicationsToInsert: Document[] = [];

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowNumber = i + 2; // Account for header row

      try {
        // Validate required fields
        const validationErrors: string[] = [];

        if (!row.firstName) validationErrors.push('firstName is required');
        if (!row.lastName) validationErrors.push('lastName is required');
        if (!row.dateOfBirth) validationErrors.push('dateOfBirth is required');
        if (!row.gender) validationErrors.push('gender is required');
        if (!row.phone) validationErrors.push('phone is required');
        if (!row.city) validationErrors.push('city is required');
        if (!row.state) validationErrors.push('state is required');
        if (!row.pincode) validationErrors.push('pincode is required');
        if (!row.classCode && !row.className)
          validationErrors.push('classCode or className is required');

        if (validationErrors.length > 0) {
          result.errors.push({
            row: rowNumber,
            message: validationErrors.join(', '),
            data: row as unknown as Record<string, unknown>,
          });
          result.errorCount++;
          continue;
        }

        // Map class
        const classKey = (row.classCode || row.className)?.toLowerCase() || '';
        const classInfo = classMap.get(classKey);

        if (!classInfo) {
          result.errors.push({
            row: rowNumber,
            field: 'classCode/className',
            message: `Class not found: ${row.classCode || row.className}`,
            data: row as unknown as Record<string, unknown>,
          });
          result.errorCount++;
          continue;
        }

        // Map section if provided
        let sectionId: ObjectId | undefined;
        if (row.sectionCode) {
          const sectionKey = `${classInfo._id.toString()}-${row.sectionCode.toLowerCase()}`;
          sectionId = sectionMap.get(sectionKey);
        }

        // Validate date of birth
        const dob = new Date(row.dateOfBirth);
        if (isNaN(dob.getTime())) {
          result.errors.push({
            row: rowNumber,
            field: 'dateOfBirth',
            message: `Invalid date format: ${row.dateOfBirth}`,
            data: row as unknown as Record<string, unknown>,
          });
          result.errorCount++;
          continue;
        }

        // Validate gender
        if (!['male', 'female', 'other'].includes(row.gender.toLowerCase())) {
          result.errors.push({
            row: rowNumber,
            field: 'gender',
            message: `Invalid gender: ${row.gender}`,
            data: row as unknown as Record<string, unknown>,
          });
          result.errorCount++;
          continue;
        }

        // Generate application number
        const applicationNumber = await admissionSettingsService.generateNumber(
          tenantId,
          branchId,
          'applicationNumber'
        );

        // Build application document
        const application = {
          _id: new ObjectId(),
          tenantId: new ObjectId(tenantId),
          branchId: new ObjectId(branchId),
          applicationNumber,
          academicBatchId: new ObjectId(academicBatchId),
          classId: classInfo._id,
          sectionId,
          student: {
            firstName: row.firstName.trim(),
            lastName: row.lastName.trim(),
            dateOfBirth: dob,
            gender: row.gender.toLowerCase() as 'male' | 'female' | 'other',
            bloodGroup: row.bloodGroup,
            nationality: row.nationality || 'Indian',
            religion: row.religion,
            caste: row.caste,
            category: row.category || 'General',
          },
          contact: {
            email: row.email,
            phone: row.phone,
            alternatePhone: row.alternatePhone,
            address: {
              street: row.street,
              city: row.city,
              state: row.state,
              pincode: row.pincode,
              country: row.country || 'India',
            },
          },
          parents: {
            father: row.fatherName
              ? {
                  name: row.fatherName,
                  phone: row.fatherPhone,
                  email: row.fatherEmail,
                  occupation: row.fatherOccupation,
                }
              : undefined,
            mother: row.motherName
              ? {
                  name: row.motherName,
                  phone: row.motherPhone,
                  email: row.motherEmail,
                  occupation: row.motherOccupation,
                }
              : undefined,
            guardian: row.guardianName
              ? {
                  name: row.guardianName,
                  relation: row.guardianRelation || 'Guardian',
                  phone: row.guardianPhone || row.phone,
                }
              : undefined,
          },
          previousEducation: row.previousSchool
            ? {
                schoolName: row.previousSchool,
                board: row.previousBoard,
                class: row.previousClass,
                percentage: row.previousPercentage,
                yearOfPassing: row.yearOfPassing,
                tcNumber: row.tcNumber,
              }
            : undefined,
          source: row.source || 'bulk_upload',
          referredBy: row.referredBy,
          status: 'submitted',
          statusHistory: [
            {
              status: 'submitted',
              changedAt: now,
              changedBy: new ObjectId(createdBy),
              remarks: 'Bulk upload',
            },
          ],
          createdBy: new ObjectId(createdBy),
          createdAt: now,
          updatedAt: now,
        };

        applicationsToInsert.push(application);
        result.createdApplications.push(applicationNumber);
        result.successCount++;
      } catch (error) {
        result.errors.push({
          row: rowNumber,
          message: error instanceof Error ? error.message : 'Unknown error',
          data: row as unknown as Record<string, unknown>,
        });
        result.errorCount++;
      }
    }

    // Bulk insert all valid applications
    if (applicationsToInsert.length > 0) {
      await collections.applications.insertMany(applicationsToInsert);
      logger.info(
        { tenantId, branchId, count: applicationsToInsert.length, createdBy },
        'Bulk applications created'
      );
    }

    result.success = result.errorCount === 0;

    return result;
  }

  async uploadLeads(
    tenantId: string,
    branchId: string,
    data: Array<{
      firstName: string;
      lastName?: string;
      phone: string;
      email?: string;
      parentName?: string;
      parentPhone?: string;
      interestedClass?: string;
      interestedStream?: string;
      source?: string;
      notes?: string;
    }>,
    createdBy: string
  ): Promise<BulkUploadResult> {
    const result: BulkUploadResult = {
      success: true,
      totalRows: data.length,
      successCount: 0,
      errorCount: 0,
      errors: [],
      createdApplications: [], // Will contain lead numbers
    };

    if (!data.length) {
      throw new ApiError('NO_DATA', 'No data provided for bulk upload', 400);
    }

    const now = new Date();
    const leadsToInsert: Document[] = [];

    // Get classes for mapping
    const classes = await collections.classes
      .find({
        tenantId: new ObjectId(tenantId),
        branchId: new ObjectId(branchId),
        status: 'active',
      })
      .toArray();

    const classMap = new Map<string, ObjectId>();
    classes.forEach((c) => {
      classMap.set(c.code?.toLowerCase(), c._id as ObjectId);
      classMap.set(c.name?.toLowerCase(), c._id as ObjectId);
    });

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowNumber = i + 2;

      try {
        // Validate required fields
        if (!row.firstName) {
          result.errors.push({
            row: rowNumber,
            field: 'firstName',
            message: 'firstName is required',
          });
          result.errorCount++;
          continue;
        }

        if (!row.phone) {
          result.errors.push({
            row: rowNumber,
            field: 'phone',
            message: 'phone is required',
          });
          result.errorCount++;
          continue;
        }

        // Map class if provided
        let interestedClassId: ObjectId | undefined;
        if (row.interestedClass) {
          interestedClassId = classMap.get(row.interestedClass.toLowerCase());
        }

        // Generate lead number
        const leadNumber = await admissionSettingsService.generateNumber(
          tenantId,
          branchId,
          'leadCode'
        );

        const lead = {
          _id: new ObjectId(),
          tenantId: new ObjectId(tenantId),
          branchId: new ObjectId(branchId),
          leadNumber,
          studentName: row.lastName ? `${row.firstName} ${row.lastName}` : row.firstName,
          phone: row.phone,
          email: row.email,
          parentName: row.parentName,
          parentPhone: row.parentPhone,
          interestedClass: interestedClassId,
          interestedStream: row.interestedStream,
          source: row.source || 'bulk_upload',
          stage: 'new',
          stageHistory: [
            {
              stage: 'new',
              date: now,
              changedBy: new ObjectId(createdBy),
              notes: 'Bulk upload',
            },
          ],
          followups: [],
          notes: row.notes,
          status: 'active',
          createdBy: new ObjectId(createdBy),
          createdAt: now,
          updatedAt: now,
        };

        leadsToInsert.push(lead);
        result.createdApplications.push(leadNumber);
        result.successCount++;
      } catch (error) {
        result.errors.push({
          row: rowNumber,
          message: error instanceof Error ? error.message : 'Unknown error',
        });
        result.errorCount++;
      }
    }

    // Bulk insert all valid leads
    if (leadsToInsert.length > 0) {
      await collections.leads.insertMany(leadsToInsert);
      logger.info(
        { tenantId, branchId, count: leadsToInsert.length, createdBy },
        'Bulk leads created'
      );
    }

    result.success = result.errorCount === 0;

    return result;
  }

  getApplicationTemplate(): string[] {
    return [
      'firstName',
      'lastName',
      'dateOfBirth',
      'gender',
      'bloodGroup',
      'nationality',
      'religion',
      'caste',
      'category',
      'email',
      'phone',
      'alternatePhone',
      'street',
      'city',
      'state',
      'pincode',
      'country',
      'fatherName',
      'fatherPhone',
      'fatherEmail',
      'fatherOccupation',
      'motherName',
      'motherPhone',
      'motherEmail',
      'motherOccupation',
      'guardianName',
      'guardianRelation',
      'guardianPhone',
      'previousSchool',
      'previousBoard',
      'previousClass',
      'previousPercentage',
      'yearOfPassing',
      'tcNumber',
      'classCode',
      'className',
      'sectionCode',
      'source',
      'referredBy',
    ];
  }

  getLeadTemplate(): string[] {
    return [
      'firstName',
      'lastName',
      'phone',
      'email',
      'parentName',
      'parentPhone',
      'interestedClass',
      'interestedStream',
      'source',
      'notes',
    ];
  }
}

export const bulkUploadService = new BulkUploadService();
