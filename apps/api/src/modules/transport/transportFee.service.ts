import { ObjectId } from 'mongodb';
import { collections } from '../../config/database';
import { logger } from '../../lib/logger';
import { feeStructureService } from '../finance/feeStructure.service';
import { feeAssignmentService } from '../finance/feeAssignment.service';
import { hostelFeeService } from '../hostel/hostelFee.service';

const MONTHS_PER_INSTALLMENT = { monthly: 1, quarterly: 3, yearly: 12 } as const;

interface EnrollmentFeeInfo {
  _id: ObjectId;
  studentId: ObjectId;
  busNumber?: string;
  stopName?: string;
  startDate: Date;
  priceSnapshot: number;
  frequencySnapshot: keyof typeof MONTHS_PER_INSTALLMENT;
}

/**
 * Bills transport the way hostel bills rooms: an enrollment gets its own fee
 * assignment (type 'transport'), so it shows on the student's fees, the fee
 * counter and the dues reports.
 */
class TransportFeeService {
  async createFeeForEnrollment(
    tenantId: string,
    branchId: string,
    enrollment: EnrollmentFeeInfo,
    createdBy: string
  ): Promise<string | null> {
    if (!enrollment.priceSnapshot || enrollment.priceSnapshot <= 0) return null;

    const student = await collections.students.findOne(
      { _id: enrollment.studentId, tenantId: new ObjectId(tenantId) },
      { projection: { 'currentEnrollment.academicBatchId': 1 } }
    );
    const academicBatchId = (
      student?.currentEnrollment as { academicBatchId?: ObjectId } | undefined
    )?.academicBatchId;
    if (!academicBatchId) {
      logger.info(
        { enrollmentId: enrollment._id.toString() },
        'Skipping transport fee: student has no academic batch'
      );
      return null;
    }

    const batch = await collections.academicBatches.findOne({ _id: academicBatchId });
    const start = new Date(enrollment.startDate);
    const end = batch?.endDate
      ? new Date(batch.endDate as Date)
      : new Date(start.getMonth() >= 3 ? start.getFullYear() + 1 : start.getFullYear(), 2, 31);

    // One installment per billing period, due on the 5th, from the start month to the batch end.
    const step = MONTHS_PER_INSTALLMENT[enrollment.frequencySnapshot] ?? 1;
    const installments: Array<{
      name: string;
      dueDate: Date;
      components: Array<{ componentCode: string; amount: number }>;
    }> = [];
    for (
      const d = new Date(start.getFullYear(), start.getMonth(), 1);
      d <= end;
      d.setMonth(d.getMonth() + step)
    ) {
      const label = d.toLocaleString('en-IN', { month: 'long', year: 'numeric' });
      installments.push({
        name: `Transport Fee - ${label}`,
        dueDate: new Date(d.getFullYear(), d.getMonth(), 5),
        components: [{ componentCode: 'TRANSPORT', amount: enrollment.priceSnapshot }],
      });
    }
    if (installments.length === 0) return null;

    // ponytail: one structure per enrollment so the installments start at this
    // enrollment's month; share structures by route/rate if the list gets noisy.
    const structure = await feeStructureService.create(
      tenantId,
      branchId,
      {
        name: `Transport Fee - ${enrollment.busNumber ?? 'Bus'}${
          enrollment.stopName ? ` (${enrollment.stopName})` : ''
        }`,
        code: `TRANSPORT-${enrollment._id.toString()}`,
        academicBatchId: academicBatchId.toString(),
        applicableTo: { classIds: [] },
        components: [
          {
            name: 'Transport Fee',
            code: 'TRANSPORT',
            type: 'service-based',
            // A component carries the total for the period; installments split it.
            amount: enrollment.priceSnapshot * installments.length,
            frequency: enrollment.frequencySnapshot === 'yearly' ? 'yearly' : 'monthly',
            taxable: false,
            refundable: false,
          },
        ],
        installments,
        category: 'transport',
      },
      createdBy,
      { skipAutoAssign: true }
    );

    const assignment = await feeAssignmentService.create(
      tenantId,
      branchId,
      {
        studentId: enrollment.studentId.toString(),
        feeStructureId: structure._id,
        academicBatchId: academicBatchId.toString(),
        type: 'transport',
        sourceRef: { collection: 'transport_enrollments', id: enrollment._id.toString() },
      },
      createdBy
    );

    logger.info(
      { assignmentId: assignment._id, enrollmentId: enrollment._id.toString() },
      'Transport fee assignment created'
    );
    return assignment._id;
  }

  /** Withdrawal: future unpaid installments are dropped, paid ones stay. */
  handleWithdrawal(tenantId: string, enrollmentId: string, effectiveDate: Date) {
    return hostelFeeService.handleVacation(tenantId, enrollmentId, effectiveDate, 'transport');
  }
}

export const transportFeeService = new TransportFeeService();
