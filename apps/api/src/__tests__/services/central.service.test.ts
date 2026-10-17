import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ObjectId } from 'mongodb';
import { createMockCollection } from '../helpers/setup';

/**
 * "All institutions" rollups. Documents are branch-keyed, and a campus hosts
 * several institutions, so every aggregate is attributed to an institution
 * through what it is about — class → department → institution, a staff
 * member's department, a student's class, an OBE program's department.
 * Anything that can't be attributed lands on the campus-level row (the
 * campus's default institution), so totals still reconcile.
 */

const TENANT_ID = new ObjectId().toString();

// Main campus hosts Engineering and Design (+ its default, campus-level row);
// City campus hosts only its default institution.
const MAIN = new ObjectId();
const CITY = new ObjectId();
const MAIN_DEFAULT = new ObjectId();
const CITY_DEFAULT = new ObjectId();
const ENGG = new ObjectId();
const DESIGN = new ObjectId();

const CSE = new ObjectId();
const ARCH = new ObjectId();
const CSE_Y1 = new ObjectId();
const ARCH_Y1 = new ObjectId();
const NO_DEPT_CLASS = new ObjectId();

const STUDENT_CSE = new ObjectId();
const STUDENT_ARCH = new ObjectId();
const STAFF_CSE = new ObjectId();

const mocks = Object.fromEntries(
  [
    'branches',
    'institutions',
    'departments',
    'classes',
    'students',
    'staff',
    'feeAssignments',
    'leads',
    'applications',
    'scholarships',
    'staffPromotions',
    'staffSalaryAssignments',
    'designations',
    'programs',
    'obePrograms',
    'obeOfferings',
    'obeAttainments',
    'courseRegistrations',
  ].map((name) => [name, createMockCollection()])
) as Record<string, ReturnType<typeof createMockCollection>>;

vi.mock('@/config/database', () => ({
  collections: new Proxy({}, { get: (_t, name: string) => mocks[name] }),
  getDb: vi.fn(),
}));

import { centralService, resolveAttribution } from '@/modules/central/central.service';

function findChain(docs: unknown[]) {
  return {
    project: vi.fn().mockReturnThis(),
    sort: vi.fn().mockReturnThis(),
    toArray: vi.fn().mockResolvedValue(docs),
  };
}

function aggregateOnce(docs: unknown[]) {
  return { toArray: vi.fn().mockResolvedValue(docs) };
}

const ALL = [MAIN, CITY];

beforeEach(() => {
  vi.clearAllMocks();
  for (const m of Object.values(mocks)) {
    m.find.mockReturnValue(findChain([]));
    m.aggregate.mockReturnValue(aggregateOnce([]));
  }
  mocks.branches.find.mockReturnValue(
    findChain([
      { _id: MAIN, name: 'Main campus', code: 'MAIN' },
      { _id: CITY, name: 'City campus', code: 'CITY' },
    ])
  );
  mocks.institutions.find.mockReturnValue(
    findChain([
      { _id: MAIN_DEFAULT, name: 'Main campus', code: 'MAIN', isDefault: true, branchId: MAIN },
      { _id: ENGG, name: 'Engineering', code: 'ENGG', branchId: MAIN },
      { _id: DESIGN, name: 'Design', code: 'DES', branchId: MAIN },
      { _id: CITY_DEFAULT, name: 'City campus', code: 'CITY', isDefault: true, branchId: CITY },
    ])
  );
  mocks.departments.find.mockReturnValue(
    findChain([
      { _id: CSE, institutionId: ENGG },
      { _id: ARCH, institutionId: DESIGN },
    ])
  );
  mocks.classes.find.mockReturnValue(
    findChain([
      { _id: CSE_Y1, departmentId: CSE },
      { _id: ARCH_Y1, departmentId: ARCH },
      { _id: NO_DEPT_CLASS },
    ])
  );
  mocks.students.find.mockReturnValue(
    findChain([
      { _id: STUDENT_CSE, currentEnrollment: { classId: CSE_Y1 } },
      { _id: STUDENT_ARCH, currentEnrollment: { classId: ARCH_Y1 } },
    ])
  );
  mocks.staff.find.mockReturnValue(
    findChain([{ _id: STAFF_CSE, employment: { departmentId: CSE } }])
  );
});

const row = <T extends { institution: { _id: string } }>(rows: T[], id: ObjectId): T | undefined =>
  rows.find((r) => r.institution._id === id.toString());

describe('resolveAttribution', () => {
  it('lists one row per institution, campus-level rows first on each campus', async () => {
    const { groups } = await resolveAttribution(TENANT_ID, ALL);
    expect(groups.map((g) => g.name)).toEqual(
      expect.arrayContaining(['Engineering', 'Design', 'Main campus', 'City campus'])
    );
    const mainRows = groups.filter((g) => g.branchIds[0] === MAIN.toString());
    expect(mainRows[0].isDefault).toBe(true);
    expect(mainRows.map((g) => g.name)).toEqual(['Main campus', 'Design', 'Engineering']);
  });

  it('narrows rows to an institution-scoped grant', async () => {
    const { groups } = await resolveAttribution(TENANT_ID, [MAIN], {
      allowedInstitutionIds: [ENGG.toString()],
    });
    expect(groups.map((g) => g.name)).toEqual(['Engineering']);
  });

  it('attributes a class to its department’s institution, and the rest to the campus row', async () => {
    const attr = await resolveAttribution(TENANT_ID, ALL);
    expect(attr.key(MAIN, 'class', CSE_Y1)).toBe(ENGG.toString());
    expect(attr.key(MAIN, 'class', ARCH_Y1)).toBe(DESIGN.toString());
    expect(attr.key(MAIN, 'class', NO_DEPT_CLASS)).toBe(MAIN_DEFAULT.toString());
    expect(attr.key(MAIN, 'class', undefined)).toBe(MAIN_DEFAULT.toString());
  });

  it('never attributes to an institution hosted on another campus', async () => {
    const attr = await resolveAttribution(TENANT_ID, ALL);
    // A City-campus document pointing at an Engineering class still belongs to City.
    expect(attr.key(CITY, 'class', CSE_Y1)).toBe(CITY_DEFAULT.toString());
  });
});

describe('centralService.overview', () => {
  it('splits a shared campus between its institutions', async () => {
    mocks.students.aggregate.mockReturnValue(
      aggregateOnce([
        { _id: { b: MAIN, k: CSE_Y1 }, students: 120 },
        { _id: { b: MAIN, k: ARCH_Y1 }, students: 40 },
        { _id: { b: MAIN }, students: 5 },
        { _id: { b: CITY, k: NO_DEPT_CLASS }, students: 30 },
      ])
    );
    mocks.feeAssignments.aggregate.mockReturnValue(
      aggregateOnce([
        { _id: { b: MAIN, k: STUDENT_CSE }, billed: 1000, paid: 600, sponsored: 0, balance: 400 },
        { _id: { b: MAIN, k: STUDENT_ARCH }, billed: 500, paid: 500, sponsored: 0, balance: 0 },
      ])
    );
    mocks.staff.aggregate.mockReturnValue(
      aggregateOnce([{ _id: { b: MAIN, k: CSE }, staff: 9, teaching: 7 }])
    );
    mocks.applications.aggregate.mockReturnValue(
      aggregateOnce([{ _id: { b: MAIN, k: ARCH_Y1 }, applications: 25, enrolled: 10 }])
    );

    const result = await centralService.overview(TENANT_ID, ALL);

    expect(row(result.institutions, ENGG)).toMatchObject({
      students: 120,
      billed: 1000,
      collected: 600,
      staff: 9,
      isCampusLevel: false,
    });
    expect(row(result.institutions, DESIGN)).toMatchObject({
      students: 40,
      billed: 500,
      applications: 25,
      enrolled: 10,
    });
    expect(row(result.institutions, MAIN_DEFAULT)).toMatchObject({
      students: 5,
      isCampusLevel: true,
    });
    expect(row(result.institutions, CITY_DEFAULT)?.students).toBe(30);
    expect(result.totals.students).toBe(195);
  });

  it('drops other institutions’ data for an institution-scoped caller', async () => {
    mocks.students.aggregate.mockReturnValue(
      aggregateOnce([
        { _id: { b: MAIN, k: CSE_Y1 }, students: 120 },
        { _id: { b: MAIN, k: ARCH_Y1 }, students: 40 },
      ])
    );
    const result = await centralService.overview(TENANT_ID, [MAIN], [ENGG.toString()]);
    expect(result.institutions).toHaveLength(1);
    expect(result.totals.students).toBe(120);
  });
});

describe('centralService.finance', () => {
  it('counts only sanctioned scholarships as receivable, per institution', async () => {
    mocks.scholarships.aggregate.mockReturnValue(
      aggregateOnce([
        {
          _id: { b: MAIN, k: STUDENT_CSE, v: 'approved' },
          sanctioned: 35000,
          received: 20000,
          count: 1,
        },
        { _id: { b: MAIN, k: STUDENT_CSE, v: 'applied' }, sanctioned: 9000, received: 0, count: 1 },
      ])
    );
    const result = await centralService.finance(TENANT_ID, ALL);
    expect(row(result.institutions, ENGG)?.scholarships).toEqual({
      sanctioned: 35000,
      received: 20000,
      pending: 15000,
      count: 2,
    });
  });

  it('keeps admission-category splits per institution', async () => {
    mocks.students.aggregate.mockReturnValue(
      aggregateOnce([
        { _id: { b: MAIN, k: CSE_Y1, v: 'management' }, students: 30 },
        { _id: { b: MAIN, k: CSE_Y1, v: 'convener' }, students: 90 },
        { _id: { b: MAIN, k: ARCH_Y1, v: 'management' }, students: 12 },
      ])
    );
    const result = await centralService.finance(TENANT_ID, ALL);
    expect(row(result.institutions, ENGG)?.admissionCategories).toEqual({
      management: 30,
      convener: 90,
    });
    expect(row(result.institutions, DESIGN)?.admissionCategories).toEqual({ management: 12 });
  });
});

describe('centralService.admissions', () => {
  it('buckets enquiries by the class they are interested in', async () => {
    mocks.leads.aggregate.mockReturnValue(
      aggregateOnce([
        { _id: { b: MAIN, k: CSE_Y1, v: 'new' }, count: 8 },
        { _id: { b: MAIN, v: 'new' }, count: 3 },
      ])
    );
    const result = await centralService.admissions(TENANT_ID, ALL);
    expect(row(result.institutions, ENGG)?.leadStages).toEqual({ new: 8 });
    // An enquiry with no class yet is a campus-level enquiry.
    expect(row(result.institutions, MAIN_DEFAULT)?.leadStages).toEqual({ new: 3 });
  });
});

describe('centralService.hr', () => {
  it('attributes payroll through the staff member’s department', async () => {
    mocks.staffSalaryAssignments.aggregate.mockReturnValue(
      aggregateOnce([{ _id: { b: MAIN, k: STAFF_CSE }, monthlyNet: 78000, assignments: 1 }])
    );
    const result = await centralService.hr(TENANT_ID, ALL);
    expect(row(result.institutions, ENGG)?.monthlyPayroll).toBe(78000);
    expect(row(result.institutions, DESIGN)?.monthlyPayroll).toBe(0);
  });
});
