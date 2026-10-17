import { ObjectId } from 'mongodb';
import { collections } from '../../config/database';
import { logger } from '../../lib/logger';
import { feeAssignmentService } from './feeAssignment.service';

export interface FeeUploadRow {
  admissionNumber: string;
  feeStructureCode: string;
  academicBatchCode?: string;
  discounts?: Array<{
    componentCode: string;
    discountAmount: number;
  }>;
  remarks?: string;
}

export interface ConcessionUploadRow {
  admissionNumber: string;
  concessionType: string;
  concessionName: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  appliedToComponents?: string;
  reason: string;
}

export interface UploadResult {
  success: number;
  failed: number;
  errors: Array<{
    row: number;
    admissionNumber?: string;
    error: string;
  }>;
  processed: Array<{
    row: number;
    admissionNumber: string;
    status: 'success' | 'failed';
    message?: string;
  }>;
}

class FeeImportService {
  // ============ Fee Assignment Bulk Upload ============
  async parseFeeUpload(data: FeeUploadRow[]): Promise<{
    valid: FeeUploadRow[];
    errors: Array<{ row: number; error: string }>;
  }> {
    const valid: FeeUploadRow[] = [];
    const errors: Array<{ row: number; error: string }> = [];

    data.forEach((row, index) => {
      const rowNum = index + 2; // Account for header row

      if (!row.admissionNumber) {
        errors.push({ row: rowNum, error: 'Admission number is required' });
        return;
      }

      if (!row.feeStructureCode) {
        errors.push({ row: rowNum, error: 'Fee structure code is required' });
        return;
      }

      valid.push(row);
    });

    return { valid, errors };
  }

  async validateFeeUpload(
    tenantId: string,
    branchId: string,
    academicBatchId: string,
    data: FeeUploadRow[]
  ): Promise<{
    valid: Array<FeeUploadRow & { studentId: string; feeStructureId: string }>;
    errors: Array<{ row: number; admissionNumber?: string; error: string }>;
  }> {
    const valid: Array<FeeUploadRow & { studentId: string; feeStructureId: string }> = [];
    const errors: Array<{ row: number; admissionNumber?: string; error: string }> = [];

    // Get all fee structures for the branch
    const feeStructures = await collections.feeStructures
      .find({
        tenantId: new ObjectId(tenantId),
        branchId: new ObjectId(branchId),
        academicBatchId: new ObjectId(academicBatchId),
        isActive: true,
      })
      .toArray();

    const feeStructureMap = new Map<string, string>();
    feeStructures.forEach((fs) => {
      feeStructureMap.set(fs.code, fs._id.toString());
    });

    // Get all students for the branch
    const students = await collections.students
      .find({
        tenantId: new ObjectId(tenantId),
        branchId: new ObjectId(branchId),
        status: 'active',
      })
      .toArray();

    const studentMap = new Map<string, string>();
    students.forEach((s) => {
      studentMap.set(s.admissionNumber, s._id.toString());
    });

    // Check for existing assignments
    const existingAssignments = await collections.feeAssignments
      .find({
        tenantId: new ObjectId(tenantId),
        academicBatchId: new ObjectId(academicBatchId),
        status: 'active',
      })
      .toArray();

    const existingAssignmentSet = new Set<string>();
    existingAssignments.forEach((a) => {
      existingAssignmentSet.add(a.studentId.toString());
    });

    // Validate each row
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowNum = i + 2;

      // Check if student exists
      const studentId = studentMap.get(row.admissionNumber);
      if (!studentId) {
        errors.push({
          row: rowNum,
          admissionNumber: row.admissionNumber,
          error: `Student not found: ${row.admissionNumber}`,
        });
        continue;
      }

      // Check if fee structure exists
      const feeStructureId = feeStructureMap.get(row.feeStructureCode);
      if (!feeStructureId) {
        errors.push({
          row: rowNum,
          admissionNumber: row.admissionNumber,
          error: `Fee structure not found: ${row.feeStructureCode}`,
        });
        continue;
      }

      // Check if assignment already exists
      if (existingAssignmentSet.has(studentId)) {
        errors.push({
          row: rowNum,
          admissionNumber: row.admissionNumber,
          error: 'Fee assignment already exists for this student',
        });
        continue;
      }

      valid.push({
        ...row,
        studentId,
        feeStructureId,
      });

      // Add to set to prevent duplicates within the upload
      existingAssignmentSet.add(studentId);
    }

    return { valid, errors };
  }

  async processFeeUpload(
    tenantId: string,
    branchId: string,
    academicBatchId: string,
    data: FeeUploadRow[],
    createdBy: string
  ): Promise<UploadResult> {
    const result: UploadResult = {
      success: 0,
      failed: 0,
      errors: [],
      processed: [],
    };

    // Parse the data
    const { valid: parsedData, errors: parseErrors } = await this.parseFeeUpload(data);
    result.errors.push(...parseErrors);
    result.failed += parseErrors.length;

    // Validate the data
    const { valid: validatedData, errors: validationErrors } = await this.validateFeeUpload(
      tenantId,
      branchId,
      academicBatchId,
      parsedData
    );
    result.errors.push(...validationErrors);
    result.failed += validationErrors.length;

    // Process valid rows
    for (let i = 0; i < validatedData.length; i++) {
      const row = validatedData[i];
      const rowNum = i + 2;

      try {
        await feeAssignmentService.create(
          tenantId,
          branchId,
          {
            studentId: row.studentId,
            feeStructureId: row.feeStructureId,
            academicBatchId,
            discounts: row.discounts,
          },
          createdBy
        );

        result.success++;
        result.processed.push({
          row: rowNum,
          admissionNumber: row.admissionNumber,
          status: 'success',
        });
      } catch (error) {
        result.failed++;
        result.errors.push({
          row: rowNum,
          admissionNumber: row.admissionNumber,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        result.processed.push({
          row: rowNum,
          admissionNumber: row.admissionNumber,
          status: 'failed',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    logger.info(
      { success: result.success, failed: result.failed, tenantId, branchId },
      'Fee bulk upload completed'
    );

    return result;
  }

  getFeeUploadTemplate(): string {
    const headers = [
      'Admission Number*',
      'Fee Structure Code*',
      'Discount Component Code',
      'Discount Amount',
      'Remarks',
    ];
    return headers.join(',');
  }

  // ============ Concession Bulk Upload ============
  async parseConcessionUpload(data: ConcessionUploadRow[]): Promise<{
    valid: ConcessionUploadRow[];
    errors: Array<{ row: number; error: string }>;
  }> {
    const valid: ConcessionUploadRow[] = [];
    const errors: Array<{ row: number; error: string }> = [];

    const validTypes = ['scholarship', 'staff-ward', 'sibling', 'merit', 'need-based', 'custom'];
    const validDiscountTypes = ['percentage', 'fixed'];

    data.forEach((row, index) => {
      const rowNum = index + 2;

      if (!row.admissionNumber) {
        errors.push({ row: rowNum, error: 'Admission number is required' });
        return;
      }

      if (!row.concessionType || !validTypes.includes(row.concessionType)) {
        errors.push({
          row: rowNum,
          error: `Invalid concession type. Must be one of: ${validTypes.join(', ')}`,
        });
        return;
      }

      if (!row.concessionName) {
        errors.push({ row: rowNum, error: 'Concession name is required' });
        return;
      }

      if (!row.discountType || !validDiscountTypes.includes(row.discountType)) {
        errors.push({
          row: rowNum,
          error: `Invalid discount type. Must be one of: ${validDiscountTypes.join(', ')}`,
        });
        return;
      }

      if (row.discountValue === undefined || row.discountValue <= 0) {
        errors.push({ row: rowNum, error: 'Discount value must be greater than 0' });
        return;
      }

      if (row.discountType === 'percentage' && row.discountValue > 100) {
        errors.push({ row: rowNum, error: 'Percentage discount cannot exceed 100' });
        return;
      }

      if (!row.reason) {
        errors.push({ row: rowNum, error: 'Reason is required' });
        return;
      }

      valid.push(row);
    });

    return { valid, errors };
  }

  async validateConcessionUpload(
    tenantId: string,
    branchId: string,
    academicBatchId: string,
    data: ConcessionUploadRow[]
  ): Promise<{
    valid: Array<ConcessionUploadRow & { studentId: string; feeAssignmentId: string }>;
    errors: Array<{ row: number; admissionNumber?: string; error: string }>;
  }> {
    const valid: Array<ConcessionUploadRow & { studentId: string; feeAssignmentId: string }> = [];
    const errors: Array<{ row: number; admissionNumber?: string; error: string }> = [];

    // Get all students
    const students = await collections.students
      .find({
        tenantId: new ObjectId(tenantId),
        branchId: new ObjectId(branchId),
        status: 'active',
      })
      .toArray();

    const studentMap = new Map<string, string>();
    students.forEach((s) => {
      studentMap.set(s.admissionNumber, s._id.toString());
    });

    // Get all fee assignments
    const assignments = await collections.feeAssignments
      .find({
        tenantId: new ObjectId(tenantId),
        branchId: new ObjectId(branchId),
        academicBatchId: new ObjectId(academicBatchId),
        status: 'active',
      })
      .toArray();

    const assignmentMap = new Map<string, string>();
    assignments.forEach((a) => {
      assignmentMap.set(a.studentId.toString(), a._id.toString());
    });

    // Validate each row
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowNum = i + 2;

      // Check if student exists
      const studentId = studentMap.get(row.admissionNumber);
      if (!studentId) {
        errors.push({
          row: rowNum,
          admissionNumber: row.admissionNumber,
          error: `Student not found: ${row.admissionNumber}`,
        });
        continue;
      }

      // Check if fee assignment exists
      const feeAssignmentId = assignmentMap.get(studentId);
      if (!feeAssignmentId) {
        errors.push({
          row: rowNum,
          admissionNumber: row.admissionNumber,
          error: 'No fee assignment found for this student. Assign fee first.',
        });
        continue;
      }

      valid.push({
        ...row,
        studentId,
        feeAssignmentId,
      });
    }

    return { valid, errors };
  }

  async processConcessionUpload(
    tenantId: string,
    branchId: string,
    academicBatchId: string,
    data: ConcessionUploadRow[],
    createdBy: string
  ): Promise<UploadResult> {
    const result: UploadResult = {
      success: 0,
      failed: 0,
      errors: [],
      processed: [],
    };

    // Parse the data
    const { valid: parsedData, errors: parseErrors } = await this.parseConcessionUpload(data);
    result.errors.push(...parseErrors);
    result.failed += parseErrors.length;

    // Validate the data
    const { valid: validatedData, errors: validationErrors } = await this.validateConcessionUpload(
      tenantId,
      branchId,
      academicBatchId,
      parsedData
    );
    result.errors.push(...validationErrors);
    result.failed += validationErrors.length;

    // Process valid rows
    const now = new Date();

    for (let i = 0; i < validatedData.length; i++) {
      const row = validatedData[i];
      const rowNum = i + 2;

      try {
        // Get fee assignment to calculate concession amount
        const assignment = await collections.feeAssignments.findOne({
          _id: new ObjectId(row.feeAssignmentId),
        });

        if (!assignment) {
          throw new Error('Fee assignment not found');
        }

        // Calculate applied to components
        const appliedTo = row.appliedToComponents
          ? row.appliedToComponents.split(',').map((c) => c.trim())
          : assignment.components.map((c: { componentCode: string }) => c.componentCode);

        // Calculate concession amount
        let calculatedAmount = 0;
        if (row.discountType === 'fixed') {
          calculatedAmount = row.discountValue;
        } else {
          // Percentage
          const applicableAmount = assignment.components
            .filter((c: { componentCode: string }) => appliedTo.includes(c.componentCode))
            .reduce((sum: number, c: { originalAmount: number }) => sum + c.originalAmount, 0);
          calculatedAmount = (applicableAmount * row.discountValue) / 100;
        }

        // Create concession
        const concessionId = new ObjectId();
        await collections.concessions.insertOne({
          _id: concessionId,
          tenantId: new ObjectId(tenantId),
          branchId: new ObjectId(branchId),
          studentId: new ObjectId(row.studentId),
          feeAssignmentId: new ObjectId(row.feeAssignmentId),
          academicBatchId: new ObjectId(academicBatchId),
          type: row.concessionType,
          name: row.concessionName,
          reason: row.reason,
          discountType: row.discountType,
          discountValue: row.discountValue,
          calculatedAmount,
          appliedTo,
          status: 'pending',
          requestedBy: new ObjectId(createdBy),
          requestedAt: now,
          createdAt: now,
          updatedAt: now,
        });

        result.success++;
        result.processed.push({
          row: rowNum,
          admissionNumber: row.admissionNumber,
          status: 'success',
        });
      } catch (error) {
        result.failed++;
        result.errors.push({
          row: rowNum,
          admissionNumber: row.admissionNumber,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        result.processed.push({
          row: rowNum,
          admissionNumber: row.admissionNumber,
          status: 'failed',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    logger.info(
      { success: result.success, failed: result.failed, tenantId, branchId },
      'Concession bulk upload completed'
    );

    return result;
  }

  getConcessionUploadTemplate(): string {
    const headers = [
      'Admission Number*',
      'Concession Type*',
      'Concession Name*',
      'Discount Type*',
      'Discount Value*',
      'Applied To Components (comma-separated)',
      'Reason*',
    ];
    return headers.join(',');
  }
}

export const feeImportService = new FeeImportService();
