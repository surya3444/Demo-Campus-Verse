import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ObjectId } from 'mongodb';
import { createMockCollection } from '../helpers/setup';

const TENANT_ID = new ObjectId().toString();
const BRANCH_ID = new ObjectId().toString();
const STAFF_ID = new ObjectId();
const ASST_PROF = { _id: new ObjectId(), name: 'Assistant Professor', level: 3 };
const ASSOC_PROF = { _id: new ObjectId(), name: 'Associate Professor', level: 2 };

const mockStaff = createMockCollection();
const mockDesignations = createMockCollection();
const mockPromotionPolicies = createMockCollection();
const mockStaffPromotions = createMockCollection();
const mockSalaryStructures = createMockCollection();
const mockStaffSalaryAssignments = createMockCollection();

vi.mock('@/config/database', () => ({
  collections: {
    get staff() {
      return mockStaff;
    },
    get designations() {
      return mockDesignations;
    },
    get promotionPolicies() {
      return mockPromotionPolicies;
    },
    get staffPromotions() {
      return mockStaffPromotions;
    },
    get salaryStructures() {
      return mockSalaryStructures;
    },
    get staffSalaryAssignments() {
      return mockStaffSalaryAssignments;
    },
  },
  getDb: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { promotionService } from '@/modules/hr/promotion.service';
import { payrollService } from '@/modules/hr/payroll.service';

function designationLookup(...docs: Array<{ _id: ObjectId }>) {
  mockDesignations.findOne.mockImplementation(async (filter: { _id: ObjectId }) => {
    return docs.find((d) => d._id.equals(filter._id)) ?? null;
  });
  mockDesignations.find.mockReturnValue({
    project: vi.fn().mockReturnThis(),
    sort: vi.fn().mockReturnThis(),
    toArray: vi.fn().mockResolvedValue(docs),
  });
}

function arrangeStaff() {
  mockStaff.findOne.mockResolvedValue({
    _id: STAFF_ID,
    tenantId: new ObjectId(TENANT_ID),
    employment: { designationId: ASST_PROF._id },
    status: 'active',
  });
}

function promotionReadback() {
  // findPromotionById reads the inserted doc back — return whatever was inserted.
  mockStaffPromotions.findOne.mockImplementation(
    async () => mockStaffPromotions.insertOne.mock.calls[0]?.[0] ?? null
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe('promote — designation ladder', () => {
  it('rejects a downward/equal move unless flagged lateral (level 1 = highest)', async () => {
    mockStaff.findOne.mockResolvedValue({
      _id: STAFF_ID,
      tenantId: new ObjectId(TENANT_ID),
      employment: { designationId: ASSOC_PROF._id },
      status: 'active',
    });
    designationLookup(ASST_PROF, ASSOC_PROF);

    await expect(
      promotionService.promote(
        TENANT_ID,
        BRANCH_ID,
        STAFF_ID.toString(),
        { toDesignationId: ASST_PROF._id.toString() },
        new ObjectId().toString()
      )
    ).rejects.toMatchObject({ code: 'NOT_A_PROMOTION' });
    expect(mockStaffPromotions.insertOne).not.toHaveBeenCalled();
  });

  it('applies immediately when no policy requires approval, writing designation + history', async () => {
    arrangeStaff();
    designationLookup(ASST_PROF, ASSOC_PROF);
    mockPromotionPolicies.findOne.mockResolvedValue(null); // no policy at all
    promotionReadback();

    const promotion = await promotionService.promote(
      TENANT_ID,
      BRANCH_ID,
      STAFF_ID.toString(),
      { toDesignationId: ASSOC_PROF._id.toString() },
      new ObjectId().toString()
    );

    expect(promotion.status).toBe('applied');
    const staffUpdate = mockStaff.updateOne.mock.calls[0][1];
    expect(staffUpdate.$set['employment.designationId']).toEqual(ASSOC_PROF._id);
    expect(staffUpdate.$push.designationHistory.toDesignationId).toEqual(ASSOC_PROF._id);
    expect(staffUpdate.$push.designationHistory.fromDesignationId).toEqual(ASST_PROF._id);
  });

  it('parks the promotion as pending when the matched policy requires approval', async () => {
    arrangeStaff();
    designationLookup(ASST_PROF, ASSOC_PROF);
    mockPromotionPolicies.findOne.mockResolvedValue({
      _id: new ObjectId(),
      requiresApproval: true,
      increment: { type: 'percentage', value: 10, base: 'basic' },
    });
    promotionReadback();

    const promotion = await promotionService.promote(
      TENANT_ID,
      BRANCH_ID,
      STAFF_ID.toString(),
      { toDesignationId: ASSOC_PROF._id.toString() },
      new ObjectId().toString()
    );

    expect(promotion.status).toBe('pending');
    // Nothing applied yet: designation untouched until approval.
    expect(mockStaff.updateOne).not.toHaveBeenCalled();
  });
});

describe('promote — salary revision via policy', () => {
  it('applies a +10%-on-basic policy through the payroll revision machinery', async () => {
    arrangeStaff();
    designationLookup(ASST_PROF, ASSOC_PROF);
    mockPromotionPolicies.findOne.mockResolvedValue({
      _id: new ObjectId(),
      requiresApproval: false,
      increment: { type: 'percentage', value: 10, base: 'basic' },
    });
    promotionReadback();

    const currentAssignment = {
      _id: new ObjectId(),
      earnings: [
        { code: 'BASIC', name: 'Basic', amount: 50000 },
        { code: 'HRA', name: 'HRA', amount: 20000 },
      ],
      deductions: [{ code: 'PF', name: 'PF', amount: 1800 }],
      personalAllowances: [{ code: 'CAR', name: 'Car Allowance', amount: 5000 }],
      netSalary: 73200,
    };
    const getAssignment = vi
      .spyOn(payrollService, 'getStaffSalaryAssignment')
      .mockResolvedValue(currentAssignment as never);
    const revise = vi
      .spyOn(payrollService, 'reviseSalary')
      .mockResolvedValue({ netSalary: 78200 } as never);

    await promotionService.promote(
      TENANT_ID,
      BRANCH_ID,
      STAFF_ID.toString(),
      { toDesignationId: ASSOC_PROF._id.toString() },
      new ObjectId().toString()
    );

    expect(getAssignment).toHaveBeenCalled();
    const [, assignmentId, revision] = revise.mock.calls[0];
    expect(assignmentId).toBe(currentAssignment._id.toString());
    const earnings = revision.earnings as Array<{ code: string; amount: number }>;
    expect(earnings.find((e) => e.code === 'BASIC')?.amount).toBe(55000); // +10%
    expect(earnings.find((e) => e.code === 'HRA')?.amount).toBe(20000); // untouched
    // personalAllowances carry forward untouched
    expect(revision.personalAllowances).toEqual(currentAssignment.personalAllowances);
    // salary change recorded on the promotion
    const salaryChangeUpdate = mockStaffPromotions.updateOne.mock.calls.find(
      (c) => c[1].$set?.salaryChange
    );
    expect(salaryChangeUpdate?.[1].$set.salaryChange).toEqual({
      previousNet: 73200,
      newNet: 78200,
    });
  });

  it('re-derives percentage-of-BASIC lines from the salary structure after a raise', async () => {
    arrangeStaff();
    designationLookup(ASST_PROF, ASSOC_PROF);
    mockPromotionPolicies.findOne.mockResolvedValue({
      _id: new ObjectId(),
      requiresApproval: false,
      increment: { type: 'percentage', value: 10, base: 'basic' },
    });
    promotionReadback();
    const structureId = new ObjectId();
    mockSalaryStructures.findOne.mockResolvedValue({
      _id: structureId,
      earnings: [
        { code: 'BASIC', type: 'fixed', defaultAmount: 50000 },
        { code: 'HRA', type: 'percentage', percentageOf: 'BASIC', defaultAmount: 40 },
        { code: 'SPL', type: 'fixed', defaultAmount: 3000 },
      ],
      deductions: [{ code: 'PF', type: 'percentage', percentageOf: 'BASIC', defaultAmount: 12 }],
    });
    vi.spyOn(payrollService, 'getStaffSalaryAssignment').mockResolvedValue({
      _id: new ObjectId(),
      salaryStructureId: structureId,
      earnings: [
        { code: 'BASIC', name: 'Basic', amount: 50000 },
        { code: 'HRA', name: 'HRA', amount: 20000 },
        { code: 'SPL', name: 'Special', amount: 3000 },
      ],
      deductions: [{ code: 'PF', name: 'PF', amount: 6000 }],
      personalAllowances: [],
      netSalary: 67000,
    } as never);
    const revise = vi
      .spyOn(payrollService, 'reviseSalary')
      .mockResolvedValue({ netSalary: 73100 } as never);

    await promotionService.promote(
      TENANT_ID,
      BRANCH_ID,
      STAFF_ID.toString(),
      { toDesignationId: ASSOC_PROF._id.toString() },
      new ObjectId().toString()
    );

    const revision = revise.mock.calls[0][2];
    const amount = (rows: unknown, code: string) =>
      (rows as Array<{ code: string; amount: number }>).find((r) => r.code === code)?.amount;
    expect(amount(revision.earnings, 'BASIC')).toBe(55000);
    expect(amount(revision.earnings, 'HRA')).toBe(22000); // 40% of the NEW basic
    expect(amount(revision.earnings, 'SPL')).toBe(3000); // fixed lines stay
    expect(amount(revision.deductions, 'PF')).toBe(6600); // 12% of the NEW basic
  });

  it('applies the designation without salary revision when no assignment exists', async () => {
    arrangeStaff();
    designationLookup(ASST_PROF, ASSOC_PROF);
    mockPromotionPolicies.findOne.mockResolvedValue({
      _id: new ObjectId(),
      requiresApproval: false,
      increment: { type: 'fixed', value: 5000 },
    });
    promotionReadback();
    const getAssignment = vi
      .spyOn(payrollService, 'getStaffSalaryAssignment')
      .mockResolvedValue(null as never);
    const revise = vi.spyOn(payrollService, 'reviseSalary');

    const promotion = await promotionService.promote(
      TENANT_ID,
      BRANCH_ID,
      STAFF_ID.toString(),
      { toDesignationId: ASSOC_PROF._id.toString() },
      new ObjectId().toString()
    );

    expect(promotion.status).toBe('applied');
    expect(getAssignment).toHaveBeenCalled();
    expect(revise).not.toHaveBeenCalled();
    expect(mockStaff.updateOne).toHaveBeenCalled();
  });
});
