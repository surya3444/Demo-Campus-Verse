import { describe, it, expect, vi } from 'vitest';
import { ObjectId } from 'mongodb';
import { createMockCollection } from '../helpers/setup';

const mockPayslips = createMockCollection();
const mockRuns = createMockCollection();
const cursor = {
  sort: vi.fn().mockReturnThis(),
  skip: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  toArray: vi.fn().mockResolvedValue([]),
};
mockPayslips.find.mockReturnValue(cursor);

vi.mock('@/config/database', () => ({
  collections: {
    get payslips() {
      return mockPayslips;
    },
    get payrollRuns() {
      return mockRuns;
    },
  },
  getDb: vi.fn(),
}));
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { payrollService } from '@/modules/hr/payroll.service';

describe('paged lists sort on a unique tie-breaker', () => {
  // A payroll run inserts every payslip at the same instant; sorting on
  // createdAt alone let pages overlap and hid payslips (169 of 280 shown).
  it('payslips sort by the requested field, then _id', async () => {
    await payrollService.getPayslips(new ObjectId().toString(), new ObjectId().toString(), {
      page: 2,
      limit: 100,
    });
    expect(cursor.sort).toHaveBeenCalledWith({ createdAt: -1, _id: -1 });
  });
});

describe('payroll run breakdown', () => {
  it('404s for a run that is not on this campus', async () => {
    mockRuns.findOne.mockResolvedValueOnce(null);
    await expect(
      payrollService.getRunBreakdown(
        new ObjectId().toString(),
        new ObjectId().toString(),
        new ObjectId().toString()
      )
    ).rejects.toMatchObject({ code: 'PAYROLL_RUN_NOT_FOUND' });
  });

  it('sums components and departments, rounded to rupees', async () => {
    mockRuns.findOne.mockResolvedValueOnce({
      _id: new ObjectId(),
      month: 9,
      year: 2026,
      status: 'finalized',
      staffCount: 2,
    });
    mockPayslips.aggregate
      .mockReturnValueOnce({
        toArray: vi.fn().mockResolvedValue([{ _id: 'BASIC', name: 'Basic Pay', amount: 100.6 }]),
      })
      .mockReturnValueOnce({
        toArray: vi.fn().mockResolvedValue([{ _id: 'PF', name: 'Provident Fund', amount: 12.4 }]),
      })
      .mockReturnValueOnce({
        toArray: vi.fn().mockResolvedValue([{ _id: 'CSE', staff: 2, gross: 200.5, net: 180.4 }]),
      });
    mockPayslips.countDocuments.mockResolvedValueOnce(2);
    const r = await payrollService.getRunBreakdown(
      new ObjectId().toString(),
      new ObjectId().toString(),
      new ObjectId().toString()
    );
    expect(r.earnings).toEqual([{ code: 'BASIC', name: 'Basic Pay', amount: 101 }]);
    expect(r.deductions[0].amount).toBe(12);
    expect(r.departments).toEqual([{ name: 'CSE', staff: 2, gross: 201, net: 180 }]);
    expect(r.paidCount).toBe(2);
  });
});

describe('mark a finalized run paid (own bank, no gateway)', () => {
  it('refuses a run that is not finalized yet', async () => {
    mockRuns.findOne.mockResolvedValueOnce({ _id: new ObjectId(), status: 'processed' });
    await expect(
      payrollService.markRunPaid(
        new ObjectId().toString(),
        new ObjectId().toString(),
        new ObjectId().toString(),
        { paymentReference: 'UTR123' },
        new ObjectId().toString()
      )
    ).rejects.toMatchObject({ code: 'RUN_NOT_FINALIZED' });
  });

  it('records only unpaid payslips as a bank transfer with the reference', async () => {
    const runId = new ObjectId();
    mockRuns.findOne.mockResolvedValueOnce({ _id: runId, status: 'finalized' });
    mockPayslips.updateMany.mockResolvedValueOnce({ modifiedCount: 280 });
    const r = await payrollService.markRunPaid(
      new ObjectId().toString(),
      new ObjectId().toString(),
      runId.toString(),
      { paymentReference: 'UTR-OCT' },
      new ObjectId().toString()
    );
    expect(r.paid).toBe(280);
    const [filter, update] = mockPayslips.updateMany.mock.calls.at(-1)!;
    expect(filter).toMatchObject({ payrollRunId: runId, 'disbursement.status': { $ne: 'paid' } });
    expect(update.$set).toMatchObject({
      'disbursement.status': 'paid',
      'disbursement.paymentMode': 'bank_transfer',
      'disbursement.paymentReference': 'UTR-OCT',
    });
  });
});
