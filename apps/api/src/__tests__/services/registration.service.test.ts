import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ObjectId } from 'mongodb';
import { createMockCollection } from '../helpers/setup';

// ---- Stable test IDs ----
const TENANT_ID = new ObjectId().toString();
const BRANCH_ID = new ObjectId().toString();
const USER_ID = new ObjectId().toString();
const STUDENT_OID = new ObjectId();
const CLASS_OID = new ObjectId();
const BATCH_OID = new ObjectId();
const TERM_OID = new ObjectId();
const SCHEME_OID = new ObjectId();
const CORE1_OID = new ObjectId();
const CORE2_OID = new ObjectId();
const ELEC1_OID = new ObjectId();
const ELEC2_OID = new ObjectId();

// ---- Mock collections ----
const mockStudents = createMockCollection();
const mockClasses = createMockCollection();
const mockAcademicBatches = createMockCollection();
const mockProgramSchemes = createMockCollection();
const mockCourseRegistrations = createMockCollection();
const mockFeeAssignments = createMockCollection();
const mockSubjects = createMockCollection();

// vi.mock factories are hoisted; getters defer dereference to call time.
vi.mock('@/config/database', () => ({
  collections: {
    get students() {
      return mockStudents;
    },
    get classes() {
      return mockClasses;
    },
    get academicBatches() {
      return mockAcademicBatches;
    },
    get programSchemes() {
      return mockProgramSchemes;
    },
    get courseRegistrations() {
      return mockCourseRegistrations;
    },
    get feeAssignments() {
      return mockFeeAssignments;
    },
    get subjects() {
      return mockSubjects;
    },
  },
  getDb: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { registrationService } from '@/modules/registration/registration.service';
import { schemeService } from '@/modules/registration/scheme.service';
import { getElectiveRosterFilter } from '@/modules/registration/roster';
import { ApiError } from '@/middleware/errorHandler';
import { collections as mockedCollections } from '../../config/database';

// ---- Fixtures ----

/** find() chain that supports .project().sort().skip().limit().toArray(). */
function chain(docs: unknown[]) {
  return {
    project: vi.fn().mockReturnThis(),
    sort: vi.fn().mockReturnThis(),
    skip: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    toArray: vi.fn().mockResolvedValue(docs),
  };
}

const HOUR = 60 * 60 * 1000;

function makeTerm(overrides: Record<string, unknown> = {}) {
  const now = Date.now();
  return {
    _id: TERM_OID,
    name: 'Odd Semester 2026',
    half: 'odd',
    startDate: new Date(now - 24 * HOUR),
    endDate: new Date(now + 120 * 24 * HOUR),
    registrationWindow: {
      opensAt: new Date(now - 2 * HOUR),
      closesAt: new Date(now + 48 * HOUR),
    },
    ...overrides,
  };
}

function makeScheme(overrides: Record<string, unknown> = {}) {
  return {
    _id: SCHEME_OID,
    tenantId: new ObjectId(TENANT_ID),
    branchId: new ObjectId(BRANCH_ID),
    departmentCode: 'CS',
    departmentName: 'Computer Science',
    semesterNumber: 3,
    minCredits: 8,
    maxCredits: 12,
    status: 'published',
    slots: [
      { slotId: 'slot-core-1', kind: 'core', subjectId: CORE1_OID, credits: 4 },
      { slotId: 'slot-core-2', kind: 'core', subjectId: CORE2_OID, credits: 4 },
      {
        slotId: 'slot-basket-1',
        kind: 'basket',
        label: 'Professional Elective I',
        chooseCount: 1,
        options: [
          { subjectId: ELEC1_OID, credits: 3, seatCap: 40, seatsTaken: 0 },
          { subjectId: ELEC2_OID, credits: 3, seatCap: 40, seatsTaken: 0 },
        ],
      },
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

/** Student in CS · Year 2 → odd term ⇒ semester 3. */
function primeHappyPath({ term = makeTerm(), scheme = makeScheme() } = {}) {
  mockStudents.findOne.mockResolvedValue({
    _id: STUDENT_OID,
    displayName: 'Asha Rao',
    currentEnrollment: { classId: CLASS_OID },
  });
  mockClasses.findOne.mockResolvedValue({
    _id: CLASS_OID,
    displayName: 'Computer Science · Year 2',
    path: [
      { levelKey: 'department', name: 'Computer Science', code: 'CS' },
      { levelKey: 'year', name: 'Year 2', code: 'Y2', order: 2 },
    ],
  });
  mockAcademicBatches.findOne.mockResolvedValue({ _id: BATCH_OID, terms: [term] });
  mockProgramSchemes.findOne.mockResolvedValue(scheme);
  mockCourseRegistrations.findOne.mockResolvedValue(null);
  mockFeeAssignments.find.mockReturnValue(chain([]));
  mockSubjects.find.mockReturnValue(
    chain([
      { _id: CORE1_OID, name: 'Data Structures', code: 'CS301' },
      { _id: CORE2_OID, name: 'Operating Systems', code: 'CS302' },
      { _id: ELEC1_OID, name: 'Graphics', code: 'CS351' },
      { _id: ELEC2_OID, name: 'AI Basics', code: 'CS352' },
    ])
  );
  // Seat claims succeed by default.
  mockProgramSchemes.updateOne.mockResolvedValue({ modifiedCount: 1 });
  mockCourseRegistrations.insertOne.mockResolvedValue({ insertedId: new ObjectId() });
}

const submitInput = {
  academicBatchId: BATCH_OID.toString(),
  termId: TERM_OID.toString(),
  selections: [{ slotId: 'slot-basket-1', subjectIds: [ELEC1_OID.toString()] }],
};

beforeEach(() => {
  vi.clearAllMocks();
});

// ─────────────────────────────────────────────────────────────────────────────

describe('registrationService.submit', () => {
  it('registers cores + chosen elective and derives semester from year × half', async () => {
    primeHappyPath();

    const result = await registrationService.submit(
      TENANT_ID,
      BRANCH_ID,
      STUDENT_OID.toString(),
      submitInput,
      USER_ID
    );

    // Year 2 + odd half ⇒ semester 3, scheme resolved for CS:3
    expect(mockProgramSchemes.findOne).toHaveBeenCalledWith(
      expect.objectContaining({ departmentCode: 'CS', semesterNumber: 3, status: 'published' })
    );
    expect(result.semesterNumber).toBe(3);
    expect(result.entries).toHaveLength(3); // 2 cores + 1 elective
    expect(result.totalCredits).toBe(11);
    expect(mockCourseRegistrations.insertOne).toHaveBeenCalledTimes(1);
    // One seat claim ($inc +1) for the chosen elective
    expect(mockProgramSchemes.updateOne).toHaveBeenCalledTimes(1);
  });

  it('rejects when the registration window is closed', async () => {
    const now = Date.now();
    primeHappyPath({
      term: makeTerm({
        registrationWindow: {
          opensAt: new Date(now - 48 * HOUR),
          closesAt: new Date(now - 2 * HOUR),
        },
      }),
    });

    await expect(
      registrationService.submit(TENANT_ID, BRANCH_ID, STUDENT_OID.toString(), submitInput, USER_ID)
    ).rejects.toMatchObject({ code: 'REGISTRATION_CLOSED' });
    expect(mockCourseRegistrations.insertOne).not.toHaveBeenCalled();
  });

  it('rejects when no registration window is configured', async () => {
    primeHappyPath({ term: makeTerm({ registrationWindow: undefined }) });

    await expect(
      registrationService.submit(TENANT_ID, BRANCH_ID, STUDENT_OID.toString(), submitInput, USER_ID)
    ).rejects.toMatchObject({ code: 'REGISTRATION_NOT_OPEN' });
  });

  it('blocks on OVERDUE fees but not on future installments', async () => {
    primeHappyPath();
    const now = Date.now();
    mockFeeAssignments.find.mockReturnValue(
      chain([
        {
          installments: [
            { dueDate: new Date(now - 24 * HOUR), balance: 5000 }, // overdue
            { dueDate: new Date(now + 60 * 24 * HOUR), balance: 20000 }, // future — ignored
          ],
        },
      ])
    );

    await expect(
      registrationService.submit(TENANT_ID, BRANCH_ID, STUDENT_OID.toString(), submitInput, USER_ID)
    ).rejects.toMatchObject({ code: 'FEE_DUES_PENDING' });

    // Future-only dues do NOT block.
    mockFeeAssignments.find.mockReturnValue(
      chain([{ installments: [{ dueDate: new Date(now + 60 * 24 * HOUR), balance: 20000 }] }])
    );
    const result = await registrationService.submit(
      TENANT_ID,
      BRANCH_ID,
      STUDENT_OID.toString(),
      submitInput,
      USER_ID
    );
    expect(result.totalCredits).toBe(11);
  });

  it('rejects wrong basket pick counts and unknown options', async () => {
    primeHappyPath();

    await expect(
      registrationService.submit(
        TENANT_ID,
        BRANCH_ID,
        STUDENT_OID.toString(),
        { ...submitInput, selections: [] },
        USER_ID
      )
    ).rejects.toMatchObject({ code: 'INVALID_SELECTION' });

    await expect(
      registrationService.submit(
        TENANT_ID,
        BRANCH_ID,
        STUDENT_OID.toString(),
        {
          ...submitInput,
          selections: [{ slotId: 'slot-basket-1', subjectIds: [new ObjectId().toString()] }],
        },
        USER_ID
      )
    ).rejects.toMatchObject({ code: 'INVALID_SELECTION' });
  });

  it('enforces the scheme credit bounds', async () => {
    //

    primeHappyPath({ scheme: makeScheme({ minCredits: 20, maxCredits: 24 }) });

    await expect(
      registrationService.submit(TENANT_ID, BRANCH_ID, STUDENT_OID.toString(), submitInput, USER_ID)
    ).rejects.toMatchObject({ code: 'CREDIT_BOUNDS' });
  });

  it('fails with SEAT_FULL when the claim does not match, without inserting', async () => {
    primeHappyPath();
    // The atomic claim finds no matching (seatsTaken < cap) element.
    mockProgramSchemes.updateOne.mockResolvedValue({ modifiedCount: 0 });

    await expect(
      registrationService.submit(TENANT_ID, BRANCH_ID, STUDENT_OID.toString(), submitInput, USER_ID)
    ).rejects.toMatchObject({ code: 'SEAT_FULL' });
    expect(mockCourseRegistrations.insertOne).not.toHaveBeenCalled();
  });

  it('rolls back claimed seats when the unique-index insert races', async () => {
    primeHappyPath();
    const dupErr = Object.assign(new Error('E11000'), { code: 11000 });
    mockCourseRegistrations.insertOne.mockRejectedValue(dupErr);

    await expect(
      registrationService.submit(TENANT_ID, BRANCH_ID, STUDENT_OID.toString(), submitInput, USER_ID)
    ).rejects.toMatchObject({ code: 'ALREADY_REGISTERED' });

    // claim (+1) then rollback release (−1)
    const incs = mockProgramSchemes.updateOne.mock.calls.map(
      (c) => (c[1] as { $inc: Record<string, number> }).$inc
    );
    expect(incs).toHaveLength(2);
    expect(Object.values(incs[0])[0]).toBe(1);
    expect(Object.values(incs[1])[0]).toBe(-1);
  });

  it('rejects a duplicate registration up front', async () => {
    primeHappyPath();
    mockCourseRegistrations.findOne.mockResolvedValue({ _id: new ObjectId() });

    await expect(
      registrationService.submit(TENANT_ID, BRANCH_ID, STUDENT_OID.toString(), submitInput, USER_ID)
    ).rejects.toMatchObject({ code: 'ALREADY_REGISTERED' });
  });

  it('override bypasses window and fee checks but not seat caps', async () => {
    const now = Date.now();
    primeHappyPath({
      term: makeTerm({
        registrationWindow: {
          opensAt: new Date(now - 48 * HOUR),
          closesAt: new Date(now - 2 * HOUR), // closed
        },
      }),
    });
    mockFeeAssignments.find.mockReturnValue(
      chain([{ installments: [{ dueDate: new Date(now - 24 * HOUR), balance: 9999 }] }])
    );

    const result = await registrationService.submit(
      TENANT_ID,
      BRANCH_ID,
      STUDENT_OID.toString(),
      submitInput,
      USER_ID,
      { override: true, overriddenBy: USER_ID }
    );
    expect(result.totalCredits).toBe(11);

    // ...but a full seat still fails even with override.
    mockCourseRegistrations.findOne.mockResolvedValue(null);
    mockProgramSchemes.updateOne.mockResolvedValue({ modifiedCount: 0 });
    await expect(
      registrationService.submit(
        TENANT_ID,
        BRANCH_ID,
        STUDENT_OID.toString(),
        submitInput,
        USER_ID,
        { override: true }
      )
    ).rejects.toMatchObject({ code: 'SEAT_FULL' });
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('registrationService.updateSelections (add/drop)', () => {
  function primeExistingRegistration(term = makeTerm()) {
    primeHappyPath({ term });
    const registration = {
      _id: new ObjectId(),
      tenantId: new ObjectId(TENANT_ID),
      branchId: new ObjectId(BRANCH_ID),
      studentId: STUDENT_OID,
      academicBatchId: BATCH_OID,
      termId: TERM_OID,
      schemeId: SCHEME_OID,
      departmentCode: 'CS',
      semesterNumber: 3,
      entries: [
        { slotId: 'slot-core-1', kind: 'core', subjectId: CORE1_OID, credits: 4 },
        { slotId: 'slot-core-2', kind: 'core', subjectId: CORE2_OID, credits: 4 },
        { slotId: 'slot-basket-1', kind: 'basket', subjectId: ELEC1_OID, credits: 3 },
      ],
      totalCredits: 11,
      status: 'submitted',
      submittedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    // 1st findOne → the registration; later findOne calls → refreshed copy.
    mockCourseRegistrations.findOne.mockResolvedValue(registration);
    return registration;
  }

  it('swaps electives: claims the new seat, releases the old one', async () => {
    primeExistingRegistration();

    await registrationService.updateSelections(
      TENANT_ID,
      BRANCH_ID,
      STUDENT_OID.toString(),
      TERM_OID.toString(),
      { selections: [{ slotId: 'slot-basket-1', subjectIds: [ELEC2_OID.toString()] }] }
    );

    const incs = mockProgramSchemes.updateOne.mock.calls.map(
      (c) => (c[1] as { $inc: Record<string, number> }).$inc
    );
    expect(incs).toHaveLength(2); // +1 for ELEC2, −1 for ELEC1
    expect(Object.values(incs[0])[0]).toBe(1);
    expect(Object.values(incs[1])[0]).toBe(-1);
    expect(mockCourseRegistrations.updateOne).toHaveBeenCalledTimes(1);
  });

  it('keeping the same elective claims nothing', async () => {
    primeExistingRegistration();

    await registrationService.updateSelections(
      TENANT_ID,
      BRANCH_ID,
      STUDENT_OID.toString(),
      TERM_OID.toString(),
      { selections: [{ slotId: 'slot-basket-1', subjectIds: [ELEC1_OID.toString()] }] }
    );

    expect(mockProgramSchemes.updateOne).not.toHaveBeenCalled();
  });

  it('rejects after the add/drop deadline', async () => {
    const now = Date.now();
    primeExistingRegistration(
      makeTerm({
        registrationWindow: {
          opensAt: new Date(now - 96 * HOUR),
          closesAt: new Date(now - 48 * HOUR),
        },
        addDropDeadline: new Date(now - 24 * HOUR),
      })
    );

    await expect(
      registrationService.updateSelections(
        TENANT_ID,
        BRANCH_ID,
        STUDENT_OID.toString(),
        TERM_OID.toString(),
        { selections: [{ slotId: 'slot-basket-1', subjectIds: [ELEC2_OID.toString()] }] }
      )
    ).rejects.toMatchObject({ code: 'ADD_DROP_CLOSED' });
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('registrationService.withdraw', () => {
  it('releases basket seats and marks the registration withdrawn', async () => {
    const registration = {
      _id: new ObjectId(),
      academicBatchId: BATCH_OID,
      schemeId: SCHEME_OID,
      entries: [
        { slotId: 'slot-core-1', kind: 'core', subjectId: CORE1_OID, credits: 4 },
        { slotId: 'slot-basket-1', kind: 'basket', subjectId: ELEC1_OID, credits: 3 },
      ],
      status: 'submitted',
    };
    mockCourseRegistrations.findOne.mockResolvedValue(registration);
    mockAcademicBatches.findOne.mockResolvedValue({ _id: BATCH_OID, terms: [makeTerm()] });
    mockProgramSchemes.updateOne.mockResolvedValue({ modifiedCount: 1 });

    const result = await registrationService.withdraw(
      TENANT_ID,
      BRANCH_ID,
      STUDENT_OID.toString(),
      TERM_OID.toString()
    );

    expect(result.success).toBe(true);
    // Only the basket entry releases a seat (cores have no counters).
    expect(mockProgramSchemes.updateOne).toHaveBeenCalledTimes(1);
    const setArg = (
      mockCourseRegistrations.updateOne.mock.calls[0][1] as { $set: Record<string, unknown> }
    ).$set;
    expect(setArg.status).toBe('withdrawn');
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('schemeService', () => {
  it('rejects a duplicate department × semester scheme', async () => {
    mockProgramSchemes.findOne.mockResolvedValue(makeScheme());

    await expect(
      schemeService.create(TENANT_ID, BRANCH_ID, {
        departmentCode: 'CS',
        departmentName: 'Computer Science',
        semesterNumber: 3,
        minCredits: 16,
        maxCredits: 28,
        slots: [{ kind: 'core', subjectId: CORE1_OID.toString(), credits: 4 }],
      })
    ).rejects.toMatchObject({ code: 'DUPLICATE_SCHEME' });
  });

  it('refuses to publish a scheme whose mandatory credits exceed maxCredits', async () => {
    mockProgramSchemes.findOne.mockResolvedValue(
      makeScheme({ status: 'draft', minCredits: 4, maxCredits: 6 }) // cores alone = 8
    );

    await expect(schemeService.publish(TENANT_ID, SCHEME_OID.toString())).rejects.toMatchObject({
      code: 'CREDITS_UNSATISFIABLE',
    });
  });

  it('freezes slot edits once registrations exist', async () => {
    mockProgramSchemes.findOne.mockResolvedValue(makeScheme());
    mockCourseRegistrations.countDocuments.mockResolvedValue(12);

    await expect(
      schemeService.update(TENANT_ID, SCHEME_OID.toString(), {
        slots: [{ kind: 'core', subjectId: CORE1_OID.toString(), credits: 4 }],
      })
    ).rejects.toMatchObject({ code: 'SCHEME_IN_USE' });
  });

  it('unknown subjects in a scheme are rejected', async () => {
    mockProgramSchemes.findOne.mockResolvedValue(null);
    mockSubjects.countDocuments.mockResolvedValue(0); // none of the ids exist

    await expect(
      schemeService.create(TENANT_ID, BRANCH_ID, {
        departmentCode: 'CS',
        departmentName: 'Computer Science',
        semesterNumber: 3,
        minCredits: 16,
        maxCredits: 28,
        slots: [{ kind: 'core', subjectId: new ObjectId().toString(), credits: 4 }],
      })
    ).rejects.toMatchObject({ code: 'UNKNOWN_SUBJECT' });
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('teaching integration', () => {
  const mockSections = createMockCollection();
  // The sections getter isn't in the base mock map — patch it in via the
  // classes/sections used by attachSubjectsToSections + roster.
  it('publish attaches scheme subjects to the matching department-year sections', async () => {
    const draft = makeScheme({ status: 'draft' });
    mockProgramSchemes.findOne.mockResolvedValue(draft);
    mockProgramSchemes.updateOne.mockResolvedValue({ modifiedCount: 1 });
    // Semester 3 → Year 2. One CS Year 2 class matches; CS Year 1 must not.
    const csY2Class = new ObjectId();
    mockClasses.find.mockReturnValue(
      chain([
        {
          _id: csY2Class,
          path: [
            { levelKey: 'department', code: 'CS', name: 'Computer Science' },
            { levelKey: 'year', code: 'Y2', name: 'Year 2', order: 2 },
          ],
        },
        {
          _id: new ObjectId(),
          path: [
            { levelKey: 'department', code: 'CS', name: 'Computer Science' },
            { levelKey: 'year', code: 'Y1', name: 'Year 1', order: 1 },
          ],
        },
        {
          _id: new ObjectId(),
          path: [
            { levelKey: 'department', code: 'ME', name: 'Mechanical' },
            { levelKey: 'year', code: 'Y2', name: 'Year 2', order: 2 },
          ],
        },
      ])
    );
    Object.defineProperty(mockedCollections, 'sections', {
      configurable: true,
      get: () => mockSections,
    });
    mockSections.updateMany.mockResolvedValue({ modifiedCount: 1 });

    await schemeService.publish(TENANT_ID, SCHEME_OID.toString());

    // 4 subjects in the scheme (2 cores + 2 basket options) → 4 updateMany calls,
    // each scoped to ONLY the CS Year 2 class.
    expect(mockSections.updateMany).toHaveBeenCalledTimes(4);
    for (const call of mockSections.updateMany.mock.calls) {
      const filter = call[0] as { classId: { $in: ObjectId[] } };
      expect(filter.classId.$in).toHaveLength(1);
      expect(filter.classId.$in[0].toString()).toBe(csY2Class.toString());
    }
  });

  it('roster: elective narrows to registered students, core returns null', async () => {
    // Core (not a basket option anywhere) → null
    mockProgramSchemes.findOne.mockResolvedValue(null);
    expect(await getElectiveRosterFilter(TENANT_ID, BRANCH_ID, CORE1_OID.toString())).toBeNull();

    // Elective → registered studentIds from the current batch
    mockProgramSchemes.findOne.mockResolvedValue({ _id: SCHEME_OID });
    mockAcademicBatches.findOne.mockResolvedValue({ _id: BATCH_OID });
    const takers = [new ObjectId(), new ObjectId()];
    mockCourseRegistrations.find.mockReturnValue(chain(takers.map((studentId) => ({ studentId }))));
    const roster = await getElectiveRosterFilter(TENANT_ID, BRANCH_ID, ELEC1_OID.toString());
    expect(roster).toHaveLength(2);
    expect(roster!.map((r) => r.toString())).toEqual(takers.map((t) => t.toString()));

    // Elective nobody registered for → EMPTY roster, not full section
    mockCourseRegistrations.find.mockReturnValue(chain([]));
    expect(await getElectiveRosterFilter(TENANT_ID, BRANCH_ID, ELEC2_OID.toString())).toEqual([]);
  });
});

// Sanity: ApiError shape used by all assertions above.
describe('ApiError contract', () => {
  it('exposes code and statusCode', () => {
    const err = new ApiError('X', 'msg', 400);
    expect(err.code).toBe('X');
    expect(err.statusCode).toBe(400);
  });
});
