import { ObjectId, WithId, Document, Filter } from 'mongodb';
import { collections } from '../../config/database';
import { logger } from '../../lib/logger';
import { ApiError } from '../../middleware/errorHandler';
import { feeTransactionService } from './feeTransaction.service';
import { CreateScholarshipInput, ScholarshipDisbursementInput } from '@campus-verse/shared/schemas';

/**
 * Scholarships are RECEIVABLES, not discounts. A Concession shrinks the
 * payable at approval time (destructively rewriting the fee assignment); a
 * scholarship leaves the fee whole — the institution carries a receivable
 * against the sponsor (government ePASS, trusts, …) and tracks disbursements
 * against the sanctioned amount.
 *
 * Approval marks `summary.sponsoredAmount` on the fee assignment (fully
 * reversible), which registration fee-gating subtracts so a student whose
 * fees are sponsored-but-not-yet-disbursed is not blocked. The balance is NOT
 * reduced at approval. Each disbursement is then posted to the fee ledger as a
 * receipted transaction (feeTransactionService.collectFee) and the sponsored
 * portion shrinks by the same amount — one entry, no re-keying at the counter.
 */

interface ScholarshipDocument extends Document {
  _id: ObjectId;
  tenantId: ObjectId;
  branchId: ObjectId;
  studentId: ObjectId;
  academicBatchId?: ObjectId;
  feeAssignmentId?: ObjectId;
  scheme: string;
  sponsor: 'government' | 'private' | 'institution';
  sanctionedAmount: number;
  appliedAmount?: number;
  applicationRef?: string;
  status: 'applied' | 'approved' | 'rejected' | 'partially_disbursed' | 'disbursed' | 'lapsed';
  disbursements: Array<{
    _id: ObjectId;
    amount: number;
    receivedAt: Date;
    utrRef?: string;
    /** Fee-ledger posting of this disbursement (absent on pre-posting records). */
    feeTransactionId?: ObjectId;
    receiptNumber?: string;
    postedAmount?: number;
    recordedBy: ObjectId;
    recordedAt: Date;
  }>;
  requestedBy?: ObjectId;
  requestedAt?: Date;
  approvedBy?: ObjectId;
  approvedAt?: Date;
  rejectionReason?: string;
  remarks?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ScholarshipListParams {
  page?: number;
  limit?: number;
  studentId?: string;
  status?: string;
  scheme?: string;
  sponsor?: string;
}

function totalReceived(doc: ScholarshipDocument): number {
  return (doc.disbursements ?? []).reduce((sum, d) => sum + d.amount, 0);
}

class ScholarshipService {
  async create(
    tenantId: string,
    branchId: string,
    data: CreateScholarshipInput,
    requestedBy: string
  ) {
    const student = await collections.students.findOne(
      { _id: new ObjectId(data.studentId), tenantId: new ObjectId(tenantId) },
      { projection: { 'currentEnrollment.academicBatchId': 1 } }
    );
    if (!student) {
      throw new ApiError('STUDENT_NOT_FOUND', 'Student not found', 404);
    }

    if (data.feeAssignmentId) {
      const assignment = await collections.feeAssignments.findOne({
        _id: new ObjectId(data.feeAssignmentId),
        tenantId: new ObjectId(tenantId),
        studentId: new ObjectId(data.studentId),
      });
      if (!assignment) {
        throw new ApiError(
          'FEE_ASSIGNMENT_NOT_FOUND',
          'Fee assignment not found for this student',
          404
        );
      }
    }

    const now = new Date();
    const doc: ScholarshipDocument = {
      _id: new ObjectId(),
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
      studentId: new ObjectId(data.studentId),
      ...(student.currentEnrollment?.academicBatchId && {
        academicBatchId: student.currentEnrollment.academicBatchId as ObjectId,
      }),
      ...(data.feeAssignmentId && { feeAssignmentId: new ObjectId(data.feeAssignmentId) }),
      scheme: data.scheme,
      sponsor: data.sponsor ?? 'government',
      sanctionedAmount: data.sanctionedAmount,
      ...(data.applicationRef && { applicationRef: data.applicationRef }),
      ...(data.remarks && { remarks: data.remarks }),
      status: 'applied',
      disbursements: [],
      requestedBy: new ObjectId(requestedBy),
      requestedAt: now,
      createdAt: now,
      updatedAt: now,
    };

    await collections.scholarships.insertOne(doc);

    logger.info(
      { tenantId, scholarshipId: doc._id.toString(), studentId: data.studentId },
      'Scholarship application recorded'
    );

    return this.formatScholarship(doc as WithId<ScholarshipDocument>);
  }

  async findAll(tenantId: string, branchId: string, params: ScholarshipListParams = {}) {
    const { page = 1, limit = 20 } = params;

    const filter: Filter<Document> = {
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
    };
    if (params.studentId) filter.studentId = new ObjectId(params.studentId);
    if (params.status) filter.status = params.status;
    if (params.scheme) filter.scheme = params.scheme;
    if (params.sponsor) filter.sponsor = params.sponsor;

    const skip = (page - 1) * limit;
    const [scholarships, total] = await Promise.all([
      collections.scholarships
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .toArray() as Promise<WithId<ScholarshipDocument>[]>,
      collections.scholarships.countDocuments(filter),
    ]);

    // Enrich with student identity for the listing.
    const studentIds = [...new Set(scholarships.map((s) => s.studentId.toString()))];
    const students = studentIds.length
      ? await collections.students
          .find({ _id: { $in: studentIds.map((id) => new ObjectId(id)) } })
          .project({ firstName: 1, lastName: 1, displayName: 1, admissionNumber: 1 })
          .toArray()
      : [];
    const studentMap = new Map(students.map((s) => [s._id.toString(), s]));

    return {
      data: scholarships.map((s) => {
        const student = studentMap.get(s.studentId.toString());
        return {
          ...this.formatScholarship(s),
          studentName: student
            ? (student.displayName as string) || `${student.firstName} ${student.lastName}`
            : '',
          admissionNumber: (student?.admissionNumber as string) ?? '',
        };
      }),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: skip + scholarships.length < total,
      },
    };
  }

  async findById(tenantId: string, scholarshipId: string) {
    const scholarship = (await collections.scholarships.findOne({
      _id: new ObjectId(scholarshipId),
      tenantId: new ObjectId(tenantId),
    })) as WithId<ScholarshipDocument> | null;

    if (!scholarship) {
      throw new ApiError('SCHOLARSHIP_NOT_FOUND', 'Scholarship not found', 404);
    }

    return this.formatScholarship(scholarship);
  }

  /**
   * Approve: pick the target fee assignment (given, or the student's active
   * assignment with the largest balance) and mark the sponsored portion —
   * capped at the assignment's current balance so a generous sanction never
   * "sponsors" more than the student actually owes.
   */
  async approve(tenantId: string, scholarshipId: string, approvedBy: string) {
    const scholarship = (await collections.scholarships.findOne({
      _id: new ObjectId(scholarshipId),
      tenantId: new ObjectId(tenantId),
    })) as WithId<ScholarshipDocument> | null;

    if (!scholarship) {
      throw new ApiError('SCHOLARSHIP_NOT_FOUND', 'Scholarship not found', 404);
    }
    if (scholarship.status !== 'applied') {
      throw new ApiError('ALREADY_PROCESSED', `Scholarship is already ${scholarship.status}`, 400);
    }

    let assignment: WithId<Document> | null = null;
    if (scholarship.feeAssignmentId) {
      assignment = await collections.feeAssignments.findOne({
        _id: scholarship.feeAssignmentId,
        tenantId: scholarship.tenantId,
      });
    } else {
      assignment = await collections.feeAssignments.findOne(
        {
          tenantId: scholarship.tenantId,
          studentId: scholarship.studentId,
          status: 'active',
          'summary.balance': { $gt: 0 },
        },
        { sort: { 'summary.balance': -1 } }
      );
    }

    const balance = (assignment?.summary as { balance?: number } | undefined)?.balance ?? 0;
    const appliedAmount = assignment ? Math.min(scholarship.sanctionedAmount, balance) : 0;

    if (assignment && appliedAmount > 0) {
      await collections.feeAssignments.updateOne(
        { _id: assignment._id },
        {
          $inc: { 'summary.sponsoredAmount': appliedAmount },
          $set: { updatedAt: new Date() },
        }
      );
    }

    await collections.scholarships.updateOne(
      { _id: scholarship._id },
      {
        $set: {
          status: 'approved',
          approvedBy: new ObjectId(approvedBy),
          approvedAt: new Date(),
          ...(assignment && { feeAssignmentId: assignment._id }),
          appliedAmount,
          updatedAt: new Date(),
        },
      }
    );

    logger.info(
      { tenantId, scholarshipId, appliedAmount },
      'Scholarship approved; sponsored portion marked on fee assignment'
    );

    return this.findById(tenantId, scholarshipId);
  }

  async reject(tenantId: string, scholarshipId: string, rejectedBy: string, reason: string) {
    const scholarship = (await collections.scholarships.findOne({
      _id: new ObjectId(scholarshipId),
      tenantId: new ObjectId(tenantId),
    })) as WithId<ScholarshipDocument> | null;

    if (!scholarship) {
      throw new ApiError('SCHOLARSHIP_NOT_FOUND', 'Scholarship not found', 404);
    }
    if (scholarship.status !== 'applied') {
      throw new ApiError('ALREADY_PROCESSED', `Scholarship is already ${scholarship.status}`, 400);
    }

    await collections.scholarships.updateOne(
      { _id: scholarship._id },
      {
        $set: {
          status: 'rejected',
          approvedBy: new ObjectId(rejectedBy),
          approvedAt: new Date(),
          rejectionReason: reason,
          updatedAt: new Date(),
        },
      }
    );

    logger.info({ tenantId, scholarshipId }, 'Scholarship rejected');

    return this.findById(tenantId, scholarshipId);
  }

  /** Record money received from the sponsor against the sanction. */
  async recordDisbursement(
    tenantId: string,
    scholarshipId: string,
    data: ScholarshipDisbursementInput,
    recordedBy: string
  ) {
    const scholarship = (await collections.scholarships.findOne({
      _id: new ObjectId(scholarshipId),
      tenantId: new ObjectId(tenantId),
    })) as WithId<ScholarshipDocument> | null;

    if (!scholarship) {
      throw new ApiError('SCHOLARSHIP_NOT_FOUND', 'Scholarship not found', 404);
    }
    if (scholarship.status !== 'approved' && scholarship.status !== 'partially_disbursed') {
      throw new ApiError(
        'NOT_DISBURSABLE',
        `Cannot record a disbursement on a ${scholarship.status} scholarship`,
        400
      );
    }

    const received = totalReceived(scholarship) + data.amount;
    if (received > scholarship.sanctionedAmount) {
      throw new ApiError(
        'OVER_DISBURSED',
        `Disbursements (₹${received}) would exceed the sanctioned amount (₹${scholarship.sanctionedAmount})`,
        400
      );
    }

    // Sponsor money is fee money: post it to the student's fee account as a
    // receipted transaction, so the ledger, receipts and collection reports
    // all see it, and shrink the sponsored portion by what has now arrived.
    // Without this the accountant re-entered every disbursement at the
    // counter and nothing reconciled the two.
    const posted = await this.postToFeeLedger(scholarship, data, recordedBy);

    const disbursement = {
      _id: new ObjectId(),
      amount: data.amount,
      receivedAt: data.receivedAt ?? new Date(),
      ...(data.utrRef && { utrRef: data.utrRef }),
      ...(posted && {
        feeTransactionId: new ObjectId(posted.transactionId),
        receiptNumber: posted.receiptNumber,
        postedAmount: posted.amount,
      }),
      recordedBy: new ObjectId(recordedBy),
      recordedAt: new Date(),
    };

    await collections.scholarships.updateOne({ _id: scholarship._id }, {
      $push: { disbursements: disbursement },
      $set: {
        status: received >= scholarship.sanctionedAmount ? 'disbursed' : 'partially_disbursed',
        updatedAt: new Date(),
      },
    } as unknown as import('mongodb').UpdateFilter<Document>);

    logger.info(
      { tenantId, scholarshipId, amount: data.amount, received },
      'Scholarship disbursement recorded'
    );

    return this.findById(tenantId, scholarshipId);
  }

  /**
   * Post a disbursement to the linked fee assignment, capped at what is still
   * due there. Returns null when there is nothing to post (no assignment, or
   * it is already settled) — the disbursement is still recorded as received.
   */
  private async postToFeeLedger(
    scholarship: WithId<ScholarshipDocument>,
    data: ScholarshipDisbursementInput,
    recordedBy: string
  ): Promise<{ transactionId: string; receiptNumber: string; amount: number } | null> {
    if (!scholarship.feeAssignmentId) return null;
    const assignment = await collections.feeAssignments.findOne({
      _id: scholarship.feeAssignmentId,
      tenantId: scholarship.tenantId,
    });
    if (!assignment) return null;

    const summary = (assignment.summary ?? {}) as { balance?: number; sponsoredAmount?: number };
    const amount = Math.min(data.amount, summary.balance ?? 0);
    if (amount <= 0) return null;

    const installments = (assignment.installments ?? []) as Array<{
      installmentNumber: number;
      balance: number;
    }>;
    const transaction = (await feeTransactionService.collectFee(
      scholarship.tenantId.toString(),
      scholarship.branchId.toString(),
      {
        studentId: scholarship.studentId.toString(),
        feeAssignmentId: scholarship.feeAssignmentId.toString(),
        paymentMode: 'netbanking',
        paymentDetails: data.utrRef ? { referenceNumber: data.utrRef } : undefined,
        components: [],
        installmentNumbers: installments
          .filter((i) => i.balance > 0)
          .map((i) => i.installmentNumber),
        feeAmount: amount,
        remarks: `Scholarship disbursement — ${scholarship.scheme} (${scholarship.sponsor})`,
      },
      recordedBy
    )) as { _id: string; receiptNumber: string };

    await collections.feeAssignments.updateOne(
      { _id: assignment._id },
      {
        $set: {
          'summary.sponsoredAmount': Math.max(0, (summary.sponsoredAmount ?? 0) - amount),
          updatedAt: new Date(),
        },
      }
    );

    return { transactionId: transaction._id, receiptNumber: transaction.receiptNumber, amount };
  }

  async delete(tenantId: string, scholarshipId: string) {
    const scholarship = (await collections.scholarships.findOne({
      _id: new ObjectId(scholarshipId),
      tenantId: new ObjectId(tenantId),
    })) as WithId<ScholarshipDocument> | null;

    if (!scholarship) {
      throw new ApiError('SCHOLARSHIP_NOT_FOUND', 'Scholarship not found', 404);
    }
    if (scholarship.status !== 'applied' && scholarship.status !== 'rejected') {
      // Approved scholarships carry a sponsored mark on the fee assignment
      // and possibly received money — deleting them would corrupt receivables.
      throw new ApiError(
        'CANNOT_DELETE',
        'Only applied or rejected scholarships can be deleted',
        400
      );
    }

    await collections.scholarships.deleteOne({ _id: scholarship._id });

    logger.info({ tenantId, scholarshipId }, 'Scholarship deleted');

    return { success: true };
  }

  /** Receivables overview: what the sponsors still owe the institution. */
  async getStats(tenantId: string, branchId: string) {
    const rows = (await collections.scholarships
      .find({
        tenantId: new ObjectId(tenantId),
        branchId: new ObjectId(branchId),
      })
      .project({ status: 1, sanctionedAmount: 1, disbursements: 1, sponsor: 1, scheme: 1 })
      .toArray()) as WithId<ScholarshipDocument>[];

    let pending = 0;
    let sanctioned = 0;
    let received = 0;
    let receivable = 0;
    const bySponsor = new Map<string, { sanctioned: number; received: number }>();

    for (const row of rows) {
      if (row.status === 'applied') pending++;
      if (
        row.status === 'approved' ||
        row.status === 'partially_disbursed' ||
        row.status === 'disbursed'
      ) {
        const rowReceived = totalReceived(row);
        sanctioned += row.sanctionedAmount;
        received += rowReceived;
        receivable += Math.max(0, row.sanctionedAmount - rowReceived);
        const key = row.sponsor;
        const agg = bySponsor.get(key) ?? { sanctioned: 0, received: 0 };
        agg.sanctioned += row.sanctionedAmount;
        agg.received += rowReceived;
        bySponsor.set(key, agg);
      }
    }

    return {
      total: rows.length,
      pendingApproval: pending,
      sanctioned,
      received,
      receivable,
      bySponsor: [...bySponsor.entries()].map(([sponsor, v]) => ({
        sponsor,
        sanctioned: v.sanctioned,
        received: v.received,
        receivable: Math.max(0, v.sanctioned - v.received),
      })),
    };
  }

  private formatScholarship(s: WithId<ScholarshipDocument>) {
    const received = totalReceived(s);
    return {
      _id: s._id.toString(),
      tenantId: s.tenantId.toString(),
      branchId: s.branchId.toString(),
      studentId: s.studentId.toString(),
      academicBatchId: s.academicBatchId?.toString(),
      feeAssignmentId: s.feeAssignmentId?.toString(),
      scheme: s.scheme,
      sponsor: s.sponsor,
      sanctionedAmount: s.sanctionedAmount,
      appliedAmount: s.appliedAmount,
      applicationRef: s.applicationRef,
      status: s.status,
      disbursements: (s.disbursements ?? []).map((d) => ({
        _id: d._id.toString(),
        amount: d.amount,
        receivedAt: d.receivedAt,
        utrRef: d.utrRef,
        feeTransactionId: d.feeTransactionId?.toString(),
        receiptNumber: d.receiptNumber,
        postedAmount: d.postedAmount,
        recordedBy: d.recordedBy.toString(),
        recordedAt: d.recordedAt,
      })),
      receivedAmount: received,
      receivableAmount: Math.max(0, s.sanctionedAmount - received),
      requestedBy: s.requestedBy?.toString(),
      requestedAt: s.requestedAt,
      approvedBy: s.approvedBy?.toString(),
      approvedAt: s.approvedAt,
      rejectionReason: s.rejectionReason,
      remarks: s.remarks,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    };
  }
}

export const scholarshipService = new ScholarshipService();
