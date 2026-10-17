import { ObjectId } from 'mongodb';
import { nanoid, customAlphabet } from 'nanoid';
import { collections } from '../config/database';

export function generateId(size = 21): string {
  return nanoid(size);
}

const passwordAlphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
const generatePasswordNano = customAlphabet(passwordAlphabet, 12);

export function generatePassword(length = 12): string {
  return generatePasswordNano(length);
}

export function generateShortId(size = 12): string {
  return nanoid(size);
}

export async function generateSequence(
  type: string,
  tenantId: string,
  branchId?: string,
  academicBatchId?: string
): Promise<number> {
  const filter: Record<string, unknown> = {
    tenantId: new ObjectId(tenantId),
    type,
  };

  if (branchId) {
    filter.branchId = new ObjectId(branchId);
  }

  if (academicBatchId) {
    filter.academicBatchId = new ObjectId(academicBatchId);
  }

  const result = await collections.counters.findOneAndUpdate(
    filter,
    {
      $inc: { sequence: 1 },
      $setOnInsert: {
        tenantId: new ObjectId(tenantId),
        type,
        ...(branchId && { branchId: new ObjectId(branchId) }),
        ...(academicBatchId && { academicBatchId: new ObjectId(academicBatchId) }),
      },
    },
    {
      upsert: true,
      returnDocument: 'after',
    }
  );

  return result!.sequence as number;
}

export function padSequence(sequence: number, length = 4): string {
  return String(sequence).padStart(length, '0');
}

export async function generateReceiptNumber(
  tenantId: string,
  branchId: string,
  prefix = 'RCP'
): Promise<string> {
  const sequence = await generateSequence('receiptNumber', tenantId, branchId);
  const year = new Date().getFullYear().toString().slice(-2);
  return `${prefix}${year}${padSequence(sequence, 6)}`;
}

export async function generateAdmissionNumber(
  tenantId: string,
  branchId: string,
  branchCode: string,
  batchCode: string
): Promise<string> {
  const sequence = await generateSequence('admissionNumber', tenantId, branchId);
  return `${branchCode}-${batchCode}-${padSequence(sequence)}`;
}

export async function generateLeadNumber(tenantId: string, branchId: string): Promise<string> {
  const sequence = await generateSequence('leadNumber', tenantId, branchId);
  const year = new Date().getFullYear().toString().slice(-2);
  return `LD${year}${padSequence(sequence, 5)}`;
}

export async function generateApplicationNumber(
  tenantId: string,
  branchId: string
): Promise<string> {
  const sequence = await generateSequence('applicationNumber', tenantId, branchId);
  const year = new Date().getFullYear().toString().slice(-2);
  return `APP${year}${padSequence(sequence, 5)}`;
}

export async function generateEmployeeId(tenantId: string, prefix = 'EMP'): Promise<string> {
  const sequence = await generateSequence('employeeId', tenantId);
  return `${prefix}${padSequence(sequence, 5)}`;
}

export async function generateDriveNumber(tenantId: string, branchId: string): Promise<string> {
  const sequence = await generateSequence('driveNumber', tenantId, branchId);
  const year = new Date().getFullYear().toString().slice(-2);
  return `DRV${year}${padSequence(sequence, 5)}`;
}

export async function generateJobPostingNumber(
  tenantId: string,
  branchId: string
): Promise<string> {
  const sequence = await generateSequence('jobPostingNumber', tenantId, branchId);
  const year = new Date().getFullYear().toString().slice(-2);
  return `JOB${year}${padSequence(sequence, 5)}`;
}

export async function generateCounselingSessionNumber(
  tenantId: string,
  branchId: string
): Promise<string> {
  const sequence = await generateSequence('counselingSessionNumber', tenantId, branchId);
  const year = new Date().getFullYear().toString().slice(-2);
  return `CS${year}${padSequence(sequence, 5)}`;
}

export async function generateAlumniEventNumber(
  tenantId: string,
  branchId: string
): Promise<string> {
  const sequence = await generateSequence('alumniEventNumber', tenantId, branchId);
  const year = new Date().getFullYear().toString().slice(-2);
  return `ALU${year}${padSequence(sequence, 5)}`;
}

export async function generateCourseNumber(tenantId: string, branchId: string): Promise<string> {
  const sequence = await generateSequence('courseNumber', tenantId, branchId);
  const year = new Date().getFullYear().toString().slice(-2);
  return `CRS${year}${padSequence(sequence, 5)}`;
}

export async function generateAssetCode(tenantId: string, branchId: string): Promise<string> {
  const sequence = await generateSequence('assetCode', tenantId, branchId);
  const year = new Date().getFullYear().toString().slice(-2);
  return `AST${year}${padSequence(sequence, 5)}`;
}

export async function generateProcurementNumber(
  tenantId: string,
  branchId: string
): Promise<string> {
  const sequence = await generateSequence('procurementNumber', tenantId, branchId);
  const year = new Date().getFullYear().toString().slice(-2);
  return `PO${year}${padSequence(sequence, 5)}`;
}

export async function generateExpenseNumber(tenantId: string, branchId: string): Promise<string> {
  const sequence = await generateSequence('expenseNumber', tenantId, branchId);
  const year = new Date().getFullYear().toString().slice(-2);
  return `EXP${year}${padSequence(sequence, 6)}`;
}

export async function generateReimbursementNumber(
  tenantId: string,
  branchId: string
): Promise<string> {
  const sequence = await generateSequence('reimbursementNumber', tenantId, branchId);
  const year = new Date().getFullYear().toString().slice(-2);
  return `RMB${year}${padSequence(sequence, 5)}`;
}

export async function generateVisitorCode(tenantId: string, branchId: string): Promise<string> {
  const sequence = await generateSequence('visitorCode', tenantId, branchId);
  const year = new Date().getFullYear().toString().slice(-2);
  return `VIS${year}${padSequence(sequence, 5)}`;
}

export function generatePassCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const generate = customAlphabet(alphabet, 8);
  return generate();
}

export async function generateTicketNumber(tenantId: string, branchId: string): Promise<string> {
  const sequence = await generateSequence('ticketNumber', tenantId, branchId);
  const year = new Date().getFullYear().toString().slice(-2);
  return `TKT${year}${padSequence(sequence, 5)}`;
}

export async function generatePayslipNumber(
  tenantId: string,
  branchId: string,
  prefix = 'PS'
): Promise<string> {
  const sequence = await generateSequence('payslipNumber', tenantId, branchId);
  const year = new Date().getFullYear().toString().slice(-2);
  const month = String(new Date().getMonth() + 1).padStart(2, '0');
  return `${prefix}${year}${month}-${padSequence(sequence, 5)}`;
}
