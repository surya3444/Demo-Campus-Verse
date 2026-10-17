import { ObjectId, Document } from 'mongodb';
import { collections } from '../../config/database';
import { logger } from '../../lib/logger';
import { feeStructureService } from '../finance/feeStructure.service';
import { feeAssignmentService } from '../finance/feeAssignment.service';

interface AllocationInfo {
  _id: ObjectId;
  studentId: ObjectId;
  hostelId: ObjectId;
  roomId: ObjectId;
  bedNumber: string;
  allocationDate: Date;
  expectedVacatingDate?: Date;
}

interface RoomFeeInfo {
  monthlyRent: number;
  securityDeposit: number;
  roomNumber: string;
  roomType?: string;
}

class HostelFeeService {
  /**
   * Create a hostel fee assignment when a student is allocated a bed.
   */
  async createFeeForAllocation(
    tenantId: string,
    branchId: string,
    allocation: AllocationInfo,
    room: RoomFeeInfo,
    hostelName: string,
    hostelCode: string,
    academicBatchId: string,
    createdBy: string
  ): Promise<string | null> {
    if (!room.monthlyRent || room.monthlyRent <= 0) {
      logger.info(
        { allocationId: allocation._id.toString() },
        'Skipping hostel fee: room has no monthly rent'
      );
      return null;
    }

    // Get academic batch end date for installment calculation
    const batch = await collections.academicBatches.findOne({
      _id: new ObjectId(academicBatchId),
    });

    const allocationDate = new Date(allocation.allocationDate);
    const endDate = batch?.endDate
      ? new Date(batch.endDate as Date)
      : this.getAcademicYearEnd(allocationDate);

    // Find or create a hostel fee structure for this rate
    const structureCode = `HOSTEL-${hostelCode}-${room.monthlyRent}`;
    const structureName = `Hostel Fee - ${hostelName} (₹${room.monthlyRent}/mo)`;

    const structure = await collections.feeStructures.findOne({
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
      academicBatchId: new ObjectId(academicBatchId),
      code: structureCode,
      category: 'hostel',
    });

    let structureId: string;

    if (structure) {
      structureId = structure._id.toString();
    } else {
      // Build installments: security deposit + monthly rent
      const installments = this.buildInstallments(
        allocationDate,
        endDate,
        room.monthlyRent,
        room.securityDeposit || 0
      );
      const rentMonths = installments.filter((i) =>
        i.components.some((c) => c.componentCode === 'HOSTEL_RENT')
      ).length;

      // Build components (a component carries the total for the period)
      const components: {
        name: string;
        code: string;
        type: 'mandatory' | 'optional' | 'service-based';
        amount: number;
        frequency: 'yearly' | 'term-wise' | 'monthly';
        taxable: boolean;
        refundable: boolean;
      }[] = [
        {
          name: 'Hostel Rent',
          code: 'HOSTEL_RENT',
          type: 'service-based',
          amount: room.monthlyRent * rentMonths,
          frequency: 'monthly',
          taxable: false,
          refundable: false,
        },
      ];

      if (room.securityDeposit && room.securityDeposit > 0) {
        components.push({
          name: 'Security Deposit',
          code: 'HOSTEL_DEPOSIT',
          type: 'mandatory',
          amount: room.securityDeposit,
          frequency: 'yearly',
          taxable: false,
          refundable: true,
        });
      }

      const created = await feeStructureService.create(
        tenantId,
        branchId,
        {
          name: structureName,
          code: structureCode,
          academicBatchId,
          applicableTo: { classIds: [] },
          components,
          installments,
          category: 'hostel',
        },
        createdBy,
        { skipAutoAssign: true }
      );

      structureId = created._id;
    }

    // Create fee assignment for this student
    const assignment = await feeAssignmentService.create(
      tenantId,
      branchId,
      {
        studentId: allocation.studentId.toString(),
        feeStructureId: structureId,
        academicBatchId,
        type: 'hostel',
        sourceRef: {
          collection: 'bed_allocations',
          id: allocation._id.toString(),
        },
      },
      createdBy
    );

    logger.info(
      {
        assignmentId: assignment._id,
        allocationId: allocation._id.toString(),
        monthlyRent: room.monthlyRent,
      },
      'Hostel fee assignment created'
    );

    return assignment._id;
  }

  /**
   * Handle fee adjustment when a student vacates their bed.
   * Zeros out future unpaid installments and recalculates summary.
   */
  async handleVacation(
    tenantId: string,
    allocationId: string,
    vacationDate: Date,
    type: 'hostel' | 'transport' = 'hostel'
  ): Promise<void> {
    // Find the fee assignment linked to this allocation (or transport enrollment)
    const assignment = (await collections.feeAssignments.findOne({
      tenantId: new ObjectId(tenantId),
      type,
      'sourceRef.id': new ObjectId(allocationId),
      status: 'active',
    })) as Document | null;

    if (!assignment) {
      logger.info({ allocationId }, 'No active hostel fee assignment found for vacation');
      return;
    }

    const now = new Date();
    const installments = assignment.installments as Array<{
      installmentNumber: number;
      name: string;
      dueDate: Date;
      amount: number;
      fineAmount: number;
      totalDue: number;
      paidAmount: number;
      balance: number;
      status: string;
    }>;

    let adjustedAmount = 0;

    const updatedInstallments = installments.map((inst) => {
      const dueDate = new Date(inst.dueDate);

      // Future unpaid installments: zero them out
      if (dueDate > vacationDate && inst.status !== 'paid') {
        adjustedAmount += inst.balance;
        return {
          ...inst,
          amount: inst.paidAmount, // keep only what was paid
          totalDue: inst.paidAmount,
          balance: 0,
          status: inst.paidAmount > 0 ? 'paid' : 'paid',
        };
      }

      return inst;
    });

    // Recalculate summary
    const totalFee = updatedInstallments.reduce((sum, i) => sum + i.amount, 0);
    const totalPaid = updatedInstallments.reduce((sum, i) => sum + i.paidAmount, 0);
    const balance = totalFee - totalPaid;
    const newStatus = balance <= 0 ? 'cleared' : 'active';

    await collections.feeAssignments.updateOne(
      { _id: assignment._id },
      {
        $set: {
          installments: updatedInstallments,
          'summary.netPayable': totalFee,
          'summary.balance': balance,
          status: newStatus,
          updatedAt: now,
        },
      }
    );

    logger.info(
      {
        assignmentId: assignment._id.toString(),
        allocationId,
        adjustedAmount,
        newStatus,
        type,
      },
      'Fee adjusted for vacation'
    );
  }

  /**
   * Handle fee adjustment when a student transfers to a different room.
   * If rent is the same, update the sourceRef. If different, vacate old and create new.
   */
  async handleTransfer(
    tenantId: string,
    branchId: string,
    oldAllocationId: string,
    newAllocation: AllocationInfo,
    oldRoom: { monthlyRent: number },
    newRoom: RoomFeeInfo,
    hostelName: string,
    hostelCode: string,
    academicBatchId: string,
    createdBy: string
  ): Promise<string | null> {
    if (oldRoom.monthlyRent === newRoom.monthlyRent) {
      // Same rent — just update the sourceRef to point to new allocation
      await collections.feeAssignments.updateOne(
        {
          tenantId: new ObjectId(tenantId),
          type: 'hostel',
          'sourceRef.id': new ObjectId(oldAllocationId),
          status: 'active',
        },
        {
          $set: {
            'sourceRef.id': newAllocation._id,
            updatedAt: new Date(),
          },
        }
      );

      logger.info(
        { oldAllocationId, newAllocationId: newAllocation._id.toString() },
        'Hostel fee sourceRef updated for same-rent transfer'
      );
      return null;
    }

    // Different rent — vacate old and create new
    await this.handleVacation(tenantId, oldAllocationId, new Date());

    // For transfers, skip security deposit if already paid on old assignment
    const oldAssignment = (await collections.feeAssignments.findOne({
      tenantId: new ObjectId(tenantId),
      type: 'hostel',
      'sourceRef.id': new ObjectId(oldAllocationId),
    })) as Document | null;

    const depositAlreadyPaid =
      oldAssignment?.installments?.some(
        (i: { name: string; paidAmount: number }) =>
          i.name === 'Security Deposit' && i.paidAmount > 0
      ) ?? false;

    const adjustedRoom = depositAlreadyPaid ? { ...newRoom, securityDeposit: 0 } : newRoom;

    return this.createFeeForAllocation(
      tenantId,
      branchId,
      newAllocation,
      adjustedRoom,
      hostelName,
      hostelCode,
      academicBatchId,
      createdBy
    );
  }

  /**
   * Build installments for hostel fee: security deposit + monthly rent.
   */
  private buildInstallments(
    startDate: Date,
    endDate: Date,
    monthlyRent: number,
    securityDeposit: number
  ): Array<{
    name: string;
    dueDate: Date;
    components: Array<{ componentCode: string; amount: number }>;
  }> {
    const installments: Array<{
      name: string;
      dueDate: Date;
      components: Array<{ componentCode: string; amount: number }>;
    }> = [];

    // Security deposit as first installment
    if (securityDeposit > 0) {
      installments.push({
        name: 'Security Deposit',
        dueDate: startDate,
        components: [{ componentCode: 'HOSTEL_DEPOSIT', amount: securityDeposit }],
      });
    }

    // Monthly rent installments
    const current = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    const end = new Date(endDate.getFullYear(), endDate.getMonth(), 1);

    while (current <= end) {
      const monthName = current.toLocaleString('en-IN', { month: 'long', year: 'numeric' });
      const dueDate = new Date(current.getFullYear(), current.getMonth(), 5); // Due on 5th of each month

      installments.push({
        name: `Hostel Rent - ${monthName}`,
        dueDate,
        components: [{ componentCode: 'HOSTEL_RENT', amount: monthlyRent }],
      });

      current.setMonth(current.getMonth() + 1);
    }

    return installments;
  }

  /**
   * Default academic year end: March 31st of next year (Indian academic calendar).
   */
  private getAcademicYearEnd(fromDate: Date): Date {
    const year = fromDate.getMonth() >= 3 ? fromDate.getFullYear() + 1 : fromDate.getFullYear();
    return new Date(year, 2, 31); // March 31
  }
}

export const hostelFeeService = new HostelFeeService();
