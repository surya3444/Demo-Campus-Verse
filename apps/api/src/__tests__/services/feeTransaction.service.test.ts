import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ObjectId } from 'mongodb';
import { createMockCollection } from '../helpers/setup';

// ---- Stable test IDs ----
const TENANT_ID = new ObjectId().toString();
const BRANCH_ID = new ObjectId().toString();
const USER_ID = new ObjectId().toString();
const STUDENT_ID = new ObjectId().toString();
const ASSIGNMENT_ID = new ObjectId().toString();

// ---- Mock collections ----
const mockFeeTransactions = createMockCollection();
const mockFeeAssignments = createMockCollection();
const mockStudents = createMockCollection();
const mockFinanceSettings = createMockCollection();

// NOTE: vi.mock factories are hoisted above the const declarations, so they run
// while the mock objects are still in the temporal dead zone. Getters defer the
// dereference to call time (inside tests), when the consts are initialized.
vi.mock('@/config/database', () => ({
  collections: {
    get feeTransactions() {
      return mockFeeTransactions;
    },
    get feeAssignments() {
      return mockFeeAssignments;
    },
    get students() {
      return mockStudents;
    },
    get financeSettings() {
      return mockFinanceSettings;
    },
    counters: createMockCollection(),
  },
  getDb: vi.fn(),
}));

vi.mock('@/utils/generators', () => ({
  generateReceiptNumber: vi.fn().mockResolvedValue('RCP26000001'),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock feeAssignmentService
const mockUpdatePayment = vi.fn().mockResolvedValue(undefined);
vi.mock('@/modules/finance/feeAssignment.service', () => ({
  feeAssignmentService: {
    get updatePayment() {
      return mockUpdatePayment;
    },
  },
}));

// Mock razorpayService
vi.mock('@/modules/finance/receiptIssuer', () => ({
  resolveReceiptIssuer: vi.fn().mockResolvedValue({ name: 'Test College' }),
}));

vi.mock('@/services/razorpay.service', () => ({
  razorpayService: {
    createOrder: vi.fn(),
    verifyPayment: vi.fn(),
    getPayment: vi.fn(),
  },
}));

// Mock approvalRequestService
const mockApprovalCreate = vi.fn().mockResolvedValue({ _id: 'approval-123', status: 'pending' });
vi.mock('@/modules/finance/approvalRequest.service', () => ({
  approvalRequestService: {
    get create() {
      return mockApprovalCreate;
    },
  },
}));

// The service transitively imports @/config/env (via razorpayRoute.service),
// which validates process.env at import time and throws without JWT secrets.
vi.mock('@/config/env', () => ({
  env: {
    NODE_ENV: 'test',
    JWT_ACCESS_SECRET: 'test-access-secret-that-is-32chars!',
    JWT_REFRESH_SECRET: 'test-refresh-secret-that-is-32chars',
    APP_URL: 'http://localhost:3000',
    EMAIL_FROM: 'test@campusverse.test',
    RAZORPAY_KEY_ID: undefined,
    RAZORPAY_KEY_SECRET: undefined,
  },
}));

// Import after all mocks are set up
import { feeTransactionService } from '../../modules/finance/feeTransaction.service';
import { generateReceiptNumber } from '../../utils/generators';

// ---- Helpers ----
function buildCollectFeeInput(overrides: Record<string, unknown> = {}) {
  return {
    studentId: STUDENT_ID,
    feeAssignmentId: ASSIGNMENT_ID,
    paymentMode: 'cash' as const,
    components: [
      { componentCode: 'TUITION', name: 'Tuition Fee', amount: 8000 },
      { componentCode: 'LAB', name: 'Lab Fee', amount: 2000 },
    ],
    installmentNumbers: [1],
    feeAmount: 10000,
    fineAmount: 0,
    adjustments: 0,
    remarks: 'First installment',
    ...overrides,
  };
}

function buildTransactionDoc(overrides: Record<string, unknown> = {}) {
  const id = new ObjectId();
  return {
    _id: id,
    tenantId: new ObjectId(TENANT_ID),
    branchId: new ObjectId(BRANCH_ID),
    studentId: new ObjectId(STUDENT_ID),
    feeAssignmentId: new ObjectId(ASSIGNMENT_ID),
    receiptNumber: 'RCP26000001',
    receiptDate: new Date(),
    paymentMode: 'cash',
    components: [
      { componentCode: 'TUITION', name: 'Tuition Fee', amount: 8000 },
      { componentCode: 'LAB', name: 'Lab Fee', amount: 2000 },
    ],
    installmentNumbers: [1],
    feeAmount: 10000,
    fineAmount: 0,
    adjustments: 0,
    totalAmount: 10000,
    status: 'success',
    remarks: 'First installment',
    collectedBy: new ObjectId(USER_ID),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function buildAssignmentDoc(overrides: Record<string, unknown> = {}) {
  return {
    _id: new ObjectId(ASSIGNMENT_ID),
    tenantId: new ObjectId(TENANT_ID),
    summary: {
      totalPaid: 10000,
      netPayable: 20000,
      balance: 10000,
    },
    installments: [
      { installmentNumber: 1, paidAmount: 10000, totalDue: 10000, balance: 0, status: 'paid' },
      { installmentNumber: 2, paidAmount: 0, totalDue: 10000, balance: 10000, status: 'pending' },
    ],
    status: 'active',
    ...overrides,
  };
}

// ---- Tests ----
describe('FeeTransactionService', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset default findOne for financeSettings (no cancellation restrictions)
    mockFinanceSettings.findOne.mockResolvedValue(null);
  });

  // ==========================================================================
  // collectFee
  // ==========================================================================
  describe('collectFee', () => {
    it('should create a transaction, generate receipt, and update fee assignment', async () => {
      const mockAssignment = buildAssignmentDoc();
      const mockStudent = {
        _id: new ObjectId(STUDENT_ID),
        tenantId: new ObjectId(TENANT_ID),
        displayName: 'Amit Kumar',
      };

      mockFeeAssignments.findOne.mockResolvedValue(mockAssignment);
      mockStudents.findOne.mockResolvedValue(mockStudent);
      mockFeeTransactions.insertOne.mockResolvedValue({ insertedId: new ObjectId() });

      const input = buildCollectFeeInput();
      const result = await feeTransactionService.collectFee(TENANT_ID, BRANCH_ID, input, USER_ID);

      // Receipt number generated
      expect(generateReceiptNumber).toHaveBeenCalledWith(TENANT_ID, BRANCH_ID);
      expect(result.receiptNumber).toBe('RCP26000001');

      // Transaction document inserted
      expect(mockFeeTransactions.insertOne).toHaveBeenCalledOnce();
      const insertedDoc = mockFeeTransactions.insertOne.mock.calls[0][0];
      expect(insertedDoc.status).toBe('success');
      expect(insertedDoc.totalAmount).toBe(10000);
      expect(insertedDoc.paymentMode).toBe('cash');

      // Fee assignment updated
      expect(mockUpdatePayment).toHaveBeenCalledWith(TENANT_ID, ASSIGNMENT_ID, 10000, [1]);

      // Response is formatted (ObjectIds stringified)
      expect(typeof result._id).toBe('string');
      expect(typeof result.tenantId).toBe('string');
      expect(typeof result.studentId).toBe('string');
    });

    it('should compute totalAmount as feeAmount + fineAmount + adjustments', async () => {
      mockFeeAssignments.findOne.mockResolvedValue(buildAssignmentDoc());
      mockStudents.findOne.mockResolvedValue({
        _id: new ObjectId(STUDENT_ID),
        tenantId: new ObjectId(TENANT_ID),
      });
      mockFeeTransactions.insertOne.mockResolvedValue({ insertedId: new ObjectId() });

      const input = buildCollectFeeInput({
        feeAmount: 8000,
        fineAmount: 500,
        adjustments: 200,
      });

      const result = await feeTransactionService.collectFee(TENANT_ID, BRANCH_ID, input, USER_ID);

      expect(result.totalAmount).toBe(8700);
      expect(mockUpdatePayment).toHaveBeenCalledWith(TENANT_ID, ASSIGNMENT_ID, 8700, [1]);
    });

    it('should throw FEE_ASSIGNMENT_NOT_FOUND when assignment does not exist', async () => {
      mockFeeAssignments.findOne.mockResolvedValue(null);

      const input = buildCollectFeeInput();

      await expect(
        feeTransactionService.collectFee(TENANT_ID, BRANCH_ID, input, USER_ID)
      ).rejects.toThrow('Fee assignment not found');
    });

    it('should throw STUDENT_NOT_FOUND when student does not exist', async () => {
      mockFeeAssignments.findOne.mockResolvedValue(buildAssignmentDoc());
      mockStudents.findOne.mockResolvedValue(null);

      const input = buildCollectFeeInput();

      await expect(
        feeTransactionService.collectFee(TENANT_ID, BRANCH_ID, input, USER_ID)
      ).rejects.toThrow('Student not found');
    });
  });

  // ==========================================================================
  // findById
  // ==========================================================================
  describe('findById', () => {
    it('should return a formatted transaction when found', async () => {
      const txDoc = buildTransactionDoc();
      mockFeeTransactions.findOne.mockResolvedValue(txDoc);

      const result = await feeTransactionService.findById(TENANT_ID, txDoc._id.toString());

      expect(result._id).toBe(txDoc._id.toString());
      expect(result.receiptNumber).toBe('RCP26000001');
      expect(result.status).toBe('success');
      expect(typeof result.collectedBy).toBe('string');
    });

    it('should throw TRANSACTION_NOT_FOUND when transaction does not exist', async () => {
      mockFeeTransactions.findOne.mockResolvedValue(null);

      await expect(
        feeTransactionService.findById(TENANT_ID, new ObjectId().toString())
      ).rejects.toThrow('Transaction not found');
    });
  });

  // ==========================================================================
  // findAll (pagination & filters)
  // ==========================================================================
  describe('findAll', () => {
    it('should return paginated results with default params', async () => {
      const txDoc = buildTransactionDoc({
        student: {
          _id: new ObjectId(STUDENT_ID),
          admissionNumber: 'MAIN-2025-0001',
          displayName: 'Amit Kumar',
        },
      });

      mockFeeTransactions.aggregate.mockReturnValue({
        toArray: vi.fn().mockResolvedValue([txDoc]),
      });
      mockFeeTransactions.countDocuments.mockResolvedValue(1);

      const result = await feeTransactionService.findAll(TENANT_ID, BRANCH_ID);

      expect(result.data).toHaveLength(1);
      expect(result.meta).toEqual({
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
        hasMore: false,
      });
    });

    it('should apply paymentMode and status filters in the aggregate pipeline', async () => {
      mockFeeTransactions.aggregate.mockReturnValue({
        toArray: vi.fn().mockResolvedValue([]),
      });
      mockFeeTransactions.countDocuments.mockResolvedValue(0);

      await feeTransactionService.findAll(TENANT_ID, BRANCH_ID, {
        paymentMode: 'upi',
        status: 'success',
      });

      // The aggregate pipeline's $match stage should include the filters
      const pipeline = mockFeeTransactions.aggregate.mock.calls[0][0];
      const matchStage = pipeline[0].$match;
      expect(matchStage.paymentMode).toBe('upi');
      expect(matchStage.status).toBe('success');
    });

    it('should apply date range filters (fromDate and toDate)', async () => {
      mockFeeTransactions.aggregate.mockReturnValue({
        toArray: vi.fn().mockResolvedValue([]),
      });
      mockFeeTransactions.countDocuments.mockResolvedValue(0);

      await feeTransactionService.findAll(TENANT_ID, BRANCH_ID, {
        fromDate: '2026-01-01',
        toDate: '2026-01-31',
      });

      const pipeline = mockFeeTransactions.aggregate.mock.calls[0][0];
      const matchStage = pipeline[0].$match;
      expect(matchStage.receiptDate.$gte).toEqual(new Date('2026-01-01'));
      // The service extends toDate to end-of-day (23:59:59.999 local) so the
      // last day of the range is inclusive
      const expectedEnd = new Date('2026-01-31');
      expectedEnd.setHours(23, 59, 59, 999);
      expect(matchStage.receiptDate.$lte).toEqual(expectedEnd);
    });

    it('should handle custom pagination (page 2, limit 5)', async () => {
      mockFeeTransactions.aggregate.mockReturnValue({
        toArray: vi.fn().mockResolvedValue([]),
      });
      mockFeeTransactions.countDocuments.mockResolvedValue(12);

      const result = await feeTransactionService.findAll(TENANT_ID, BRANCH_ID, {
        page: 2,
        limit: 5,
      });

      // Verify $skip and $limit in pipeline
      const pipeline = mockFeeTransactions.aggregate.mock.calls[0][0];
      const skipStage = pipeline.find((s: Record<string, unknown>) => '$skip' in s);
      const limitStage = pipeline.find((s: Record<string, unknown>) => '$limit' in s);
      expect(skipStage.$skip).toBe(5); // (2-1) * 5
      expect(limitStage.$limit).toBe(5);

      expect(result.meta).toEqual({
        page: 2,
        limit: 5,
        total: 12,
        totalPages: 3,
        hasMore: true,
      });
    });
  });

  // ==========================================================================
  // cancel
  // ==========================================================================
  describe('cancel', () => {
    it('should cancel a successful transaction and reverse the assignment payment', async () => {
      const txDoc = buildTransactionDoc();
      const assignmentDoc = buildAssignmentDoc();

      // First findOne returns the transaction, second call inside findById also needs it
      mockFeeTransactions.findOne
        .mockResolvedValueOnce(txDoc) // lookup in cancel()
        .mockResolvedValueOnce({
          // lookup in findById() at the end
          ...txDoc,
          status: 'cancelled',
          cancellation: {
            reason: 'Duplicate entry',
            cancelledAt: expect.any(Date),
            cancelledBy: new ObjectId(USER_ID),
          },
        });

      mockFeeAssignments.findOne.mockResolvedValue(assignmentDoc);
      mockFinanceSettings.findOne.mockResolvedValue(null);

      await feeTransactionService.cancel(
        TENANT_ID,
        BRANCH_ID,
        txDoc._id.toString(),
        'Duplicate entry',
        USER_ID,
        true // forceApproval to skip approval flow
      );

      // Transaction updated to cancelled
      expect(mockFeeTransactions.updateOne).toHaveBeenCalledTimes(1);
      const updateCall = mockFeeTransactions.updateOne.mock.calls[0];
      expect(updateCall[1].$set.status).toBe('cancelled');
      expect(updateCall[1].$set.cancellation.reason).toBe('Duplicate entry');

      // Fee assignment balance reversed
      expect(mockFeeAssignments.updateOne).toHaveBeenCalledOnce();
      const assignmentUpdate = mockFeeAssignments.updateOne.mock.calls[0][1];
      expect(assignmentUpdate.$set['summary.totalPaid']).toBe(0); // 10000 - 10000
    });

    it('should throw TRANSACTION_NOT_FOUND when transaction does not exist', async () => {
      mockFeeTransactions.findOne.mockResolvedValue(null);

      await expect(
        feeTransactionService.cancel(
          TENANT_ID,
          BRANCH_ID,
          new ObjectId().toString(),
          'reason',
          USER_ID,
          true
        )
      ).rejects.toThrow('Transaction not found');
    });

    it('should throw CANNOT_CANCEL when transaction is not in success status', async () => {
      const txDoc = buildTransactionDoc({ status: 'cancelled' });
      mockFeeTransactions.findOne.mockResolvedValue(txDoc);

      await expect(
        feeTransactionService.cancel(
          TENANT_ID,
          BRANCH_ID,
          txDoc._id.toString(),
          'reason',
          USER_ID,
          true
        )
      ).rejects.toThrow('Only successful transactions can be cancelled');
    });

    it('should submit approval request when requiresApproval is true and forceApproval is false', async () => {
      const txDoc = buildTransactionDoc();
      mockFeeTransactions.findOne.mockResolvedValue(txDoc);

      mockFinanceSettings.findOne.mockResolvedValue({
        cancellationSettings: {
          requiresApproval: true,
        },
      });

      const result = await feeTransactionService.cancel(
        TENANT_ID,
        BRANCH_ID,
        txDoc._id.toString(),
        'Mistake',
        USER_ID,
        false // do not force
      );

      expect(result).toHaveProperty('requiresApproval', true);
      expect(result).toHaveProperty('message', 'Cancellation request submitted for approval');
      expect(mockApprovalCreate).toHaveBeenCalledWith(
        TENANT_ID,
        BRANCH_ID,
        expect.objectContaining({ type: 'cancellation', transactionId: txDoc._id.toString() }),
        USER_ID
      );

      // No direct update should happen
      expect(mockFeeTransactions.updateOne).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // getDaySheet (daily collection aggregation)
  // ==========================================================================
  describe('getDaySheet', () => {
    it('should return daily collection grouped by payment mode with totals', async () => {
      const byPaymentModeResult = [
        { _id: 'cash', count: 5, totalAmount: 50000 },
        { _id: 'upi', count: 3, totalAmount: 30000 },
      ];

      const totalResult = [
        {
          _id: null,
          totalTransactions: 8,
          totalFeeCollected: 72000,
          totalFineCollected: 2000,
          totalAmount: 80000,
        },
      ];

      // First aggregate call returns byPaymentMode, second returns totals
      mockFeeTransactions.aggregate
        .mockReturnValueOnce({ toArray: vi.fn().mockResolvedValue(byPaymentModeResult) })
        .mockReturnValueOnce({ toArray: vi.fn().mockResolvedValue(totalResult) });

      const result = await feeTransactionService.getDaySheet(TENANT_ID, BRANCH_ID, '2026-02-06');

      expect(result.date).toBe('2026-02-06');
      expect(result.byPaymentMode).toEqual([
        { paymentMode: 'cash', count: 5, totalAmount: 50000 },
        { paymentMode: 'upi', count: 3, totalAmount: 30000 },
      ]);
      expect(result.summary.totalTransactions).toBe(8);
      expect(result.summary.totalAmount).toBe(80000);
    });

    it('should return zero summary when no transactions exist for the day', async () => {
      mockFeeTransactions.aggregate
        .mockReturnValueOnce({ toArray: vi.fn().mockResolvedValue([]) })
        .mockReturnValueOnce({ toArray: vi.fn().mockResolvedValue([]) });

      const result = await feeTransactionService.getDaySheet(TENANT_ID, BRANCH_ID, '2026-02-06');

      expect(result.byPaymentMode).toEqual([]);
      expect(result.summary).toEqual({
        totalTransactions: 0,
        totalFeeCollected: 0,
        totalFineCollected: 0,
        totalAmount: 0,
      });
    });
  });

  // ==========================================================================
  // getCollectionSummary (totals by period)
  // ==========================================================================
  describe('getCollectionSummary', () => {
    it('should return monthly collection summary for a date range', async () => {
      const monthlyData = [
        {
          _id: { year: 2026, month: 1 },
          count: 20,
          totalFee: 200000,
          totalFine: 5000,
          totalAmount: 205000,
        },
        {
          _id: { year: 2026, month: 2 },
          count: 10,
          totalFee: 100000,
          totalFine: 2000,
          totalAmount: 102000,
        },
      ];

      const totalResult = [
        {
          _id: null,
          totalTransactions: 30,
          totalFeeCollected: 300000,
          totalFineCollected: 7000,
          totalAmount: 307000,
        },
      ];

      mockFeeTransactions.aggregate
        .mockReturnValueOnce({ toArray: vi.fn().mockResolvedValue(monthlyData) })
        .mockReturnValueOnce({ toArray: vi.fn().mockResolvedValue(totalResult) });

      const result = await feeTransactionService.getCollectionSummary(
        TENANT_ID,
        BRANCH_ID,
        '2026-01-01',
        '2026-02-28'
      );

      expect(result.period).toEqual({ from: '2026-01-01', to: '2026-02-28' });
      expect(result.monthly).toHaveLength(2);
      expect(result.monthly[0]).toEqual({
        year: 2026,
        month: 1,
        count: 20,
        totalFee: 200000,
        totalFine: 5000,
        totalAmount: 205000,
      });
      expect(result.summary.totalTransactions).toBe(30);
      expect(result.summary.totalAmount).toBe(307000);
    });
  });

  // ==========================================================================
  // refund
  // ==========================================================================
  describe('refund', () => {
    it('should refund a successful transaction and update the assignment balance', async () => {
      const txDoc = buildTransactionDoc({ totalAmount: 10000 });
      const assignmentDoc = buildAssignmentDoc();

      mockFeeTransactions.findOne
        .mockResolvedValueOnce(txDoc) // lookup in refund()
        .mockResolvedValueOnce({
          // lookup in findById() at the end
          ...txDoc,
          status: 'refunded',
          refund: {
            amount: 5000,
            reason: 'Fee revision',
            refundedAt: new Date(),
            refundedBy: new ObjectId(USER_ID),
          },
        });

      mockFeeAssignments.findOne.mockResolvedValue(assignmentDoc);
      mockFinanceSettings.findOne.mockResolvedValue(null);

      await feeTransactionService.refund(
        TENANT_ID,
        BRANCH_ID,
        txDoc._id.toString(),
        5000,
        'Fee revision',
        USER_ID,
        true // forceApproval
      );

      // Transaction updated to refunded
      expect(mockFeeTransactions.updateOne).toHaveBeenCalledTimes(1);
      const updateCall = mockFeeTransactions.updateOne.mock.calls[0];
      expect(updateCall[1].$set.status).toBe('refunded');
      expect(updateCall[1].$set.refund.amount).toBe(5000);
      expect(updateCall[1].$set.refund.reason).toBe('Fee revision');

      // Fee assignment balance adjusted
      expect(mockFeeAssignments.updateOne).toHaveBeenCalledOnce();
      const assignUpdate = mockFeeAssignments.updateOne.mock.calls[0][1];
      expect(assignUpdate.$set['summary.totalPaid']).toBe(5000); // 10000 - 5000
      expect(assignUpdate.$set['summary.balance']).toBe(15000); // 20000 - 5000
    });

    it('should throw CANNOT_REFUND when transaction is not in success status', async () => {
      const txDoc = buildTransactionDoc({ status: 'cancelled' });
      mockFeeTransactions.findOne.mockResolvedValue(txDoc);

      await expect(
        feeTransactionService.refund(
          TENANT_ID,
          BRANCH_ID,
          txDoc._id.toString(),
          5000,
          'reason',
          USER_ID,
          true
        )
      ).rejects.toThrow('Only successful transactions can be refunded');
    });

    it('should throw INVALID_AMOUNT when refund exceeds transaction total', async () => {
      const txDoc = buildTransactionDoc({ totalAmount: 10000 });
      mockFeeTransactions.findOne.mockResolvedValue(txDoc);

      await expect(
        feeTransactionService.refund(
          TENANT_ID,
          BRANCH_ID,
          txDoc._id.toString(),
          15000,
          'reason',
          USER_ID,
          true
        )
      ).rejects.toThrow('Refund amount cannot exceed transaction amount');
    });
  });

  // ==========================================================================
  // findByReceiptNumber
  // ==========================================================================
  describe('findByReceiptNumber', () => {
    it('should return a transaction found by receipt number', async () => {
      const txDoc = buildTransactionDoc({ receiptNumber: 'RCP26000042' });
      mockFeeTransactions.findOne.mockResolvedValue(txDoc);

      const result = await feeTransactionService.findByReceiptNumber(
        TENANT_ID,
        BRANCH_ID,
        'RCP26000042'
      );

      expect(result.receiptNumber).toBe('RCP26000042');
      expect(mockFeeTransactions.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ receiptNumber: 'RCP26000042' })
      );
    });

    it('should throw TRANSACTION_NOT_FOUND when receipt number is not found', async () => {
      mockFeeTransactions.findOne.mockResolvedValue(null);

      await expect(
        feeTransactionService.findByReceiptNumber(TENANT_ID, BRANCH_ID, 'INVALID')
      ).rejects.toThrow('Transaction not found');
    });
  });
});
