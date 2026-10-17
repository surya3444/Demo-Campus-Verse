import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ObjectId } from 'mongodb';
import {
  TEST_TENANT_ID,
  TEST_BRANCH_ID,
  TEST_USER_ID,
  TEST_CLASS_ID,
  TEST_SECTION_ID,
  TEST_BATCH_ID,
  createMockCollection,
} from '../helpers/setup';
import { createMockStudent } from '../helpers/factories';

// ---------------------------------------------------------------------------
// Mock dependencies BEFORE importing the service
// ---------------------------------------------------------------------------

const mockStudents = createMockCollection();
const mockStudentEnrollments = createMockCollection();
const mockBranches = createMockCollection();
const mockAcademicBatches = createMockCollection();
const mockClasses = createMockCollection();
const mockSections = createMockCollection();
const mockUsers = createMockCollection();

// NOTE: vi.mock factories are hoisted above the const declarations, so they run
// while the mock objects are still in the temporal dead zone. Getters defer the
// dereference to call time (inside tests), when the consts are initialized.
// (createMockCollection is an import binding — safe to call in the factory,
// since the helper module is evaluated before this module's imports finish.)
vi.mock('@/config/database', () => ({
  collections: {
    get students() {
      return mockStudents;
    },
    get studentEnrollments() {
      return mockStudentEnrollments;
    },
    get branches() {
      return mockBranches;
    },
    get academicBatches() {
      return mockAcademicBatches;
    },
    get classes() {
      return mockClasses;
    },
    get sections() {
      return mockSections;
    },
    get users() {
      return mockUsers;
    },
    feeAssignments: createMockCollection(),
    feeTransactions: createMockCollection(),
    studentAttendance: createMockCollection(),
  },
}));

vi.mock('@/modules/career-connect/alumni/alumniProfile.service', () => ({
  alumniProfileService: { getMyProfile: vi.fn().mockResolvedValue({}) },
}));

vi.mock('@/utils/generators', () => ({
  generateSequence: vi.fn().mockResolvedValue(1),
  padSequence: vi.fn((seq: number, len = 4) => String(seq).padStart(len, '0')),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// The service transitively imports @/config/env (via email.service), which
// validates process.env at import time and throws without JWT secrets.
vi.mock('@/config/env', () => ({
  env: {
    NODE_ENV: 'test',
    JWT_ACCESS_SECRET: 'test-access-secret-that-is-32chars!',
    JWT_REFRESH_SECRET: 'test-refresh-secret-that-is-32chars',
    APP_URL: 'http://localhost:3000',
    EMAIL_FROM: 'test@campusverse.test',
  },
}));

// Import after all mocks are registered
import { studentService } from '../../modules/student/student.service';
import { generateSequence, padSequence } from '@/utils/generators';
import { alumniProfileService } from '@/modules/career-connect/alumni/alumniProfile.service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const tenantObjId = new ObjectId(TEST_TENANT_ID);
const branchObjId = new ObjectId(TEST_BRANCH_ID);

/** Build a student document that mirrors what the DB would return. */
function buildStudentDoc(overrides: Record<string, unknown> = {}) {
  return createMockStudent({
    tenantId: tenantObjId,
    branchId: branchObjId,
    enrollmentCode: 'EN00000001',
    displayName: 'Amit Kumar',
    currentEnrollment: {
      academicBatchId: new ObjectId(TEST_BATCH_ID),
      classId: new ObjectId(TEST_CLASS_ID),
      sectionId: new ObjectId(TEST_SECTION_ID),
      className: 'Class 1',
      sectionName: 'Section A',
    },
    ...overrides,
  });
}

/** Minimal input for creating a student. */
function buildCreateInput() {
  return {
    firstName: 'Amit',
    lastName: 'Kumar',
    dateOfBirth: '2010-05-15',
    gender: 'male',
    academicBatchId: TEST_BATCH_ID,
    classId: TEST_CLASS_ID,
    sectionId: TEST_SECTION_ID,
  };
}

// ---------------------------------------------------------------------------
// Setup common mock return chain for find().sort().skip().limit().toArray()
// ---------------------------------------------------------------------------

function mockFindChain(collection: ReturnType<typeof createMockCollection>, docs: unknown[]) {
  const chain = {
    sort: vi.fn().mockReturnThis(),
    skip: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    toArray: vi.fn().mockResolvedValue(docs),
  };
  collection.find.mockReturnValue(chain);
  return chain;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('StudentService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // 1. create
  // =========================================================================
  describe('create', () => {
    it('should create a student with generated admissionNumber and enrollment record', async () => {
      // Setup look-ups
      mockBranches.findOne.mockResolvedValue({ _id: branchObjId, code: 'MAIN' });
      mockAcademicBatches.findOne.mockResolvedValue({
        _id: new ObjectId(TEST_BATCH_ID),
        code: '2025',
      });
      mockClasses.findOne.mockResolvedValue({
        _id: new ObjectId(TEST_CLASS_ID),
        displayName: 'Class 1',
      });
      mockSections.findOne.mockResolvedValue({
        _id: new ObjectId(TEST_SECTION_ID),
        name: 'Section A',
      });

      (generateSequence as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(1);
      (padSequence as ReturnType<typeof vi.fn>)
        .mockReturnValueOnce('0001')
        .mockReturnValueOnce('00000001');

      // For the formatStudent call at the end, findById will be called
      // The service calls this.formatStudent directly after insertOne, so no extra findOne needed

      const result = await studentService.create(
        TEST_TENANT_ID,
        TEST_BRANCH_ID,
        buildCreateInput() as any,
        TEST_USER_ID
      );

      // Verify student inserted
      expect(mockStudents.insertOne).toHaveBeenCalledOnce();
      const insertedStudent = mockStudents.insertOne.mock.calls[0][0];
      expect(insertedStudent.admissionNumber).toBe('MAIN-2025-0001');
      expect(insertedStudent.enrollmentCode).toBe('EN00000001');
      expect(insertedStudent.status).toBe('active');
      expect(insertedStudent.firstName).toBe('Amit');
      expect(insertedStudent.lastName).toBe('Kumar');
      expect(insertedStudent.displayName).toBe('Amit Kumar');

      // Verify enrollment created
      expect(mockStudentEnrollments.insertOne).toHaveBeenCalledOnce();
      const enrollment = mockStudentEnrollments.insertOne.mock.calls[0][0];
      expect(enrollment.enrollmentType).toBe('new');
      expect(enrollment.status).toBe('active');

      // Verify formatted result
      expect(result).toHaveProperty('_id');
      expect(result.admissionNumber).toBe('MAIN-2025-0001');
      expect(result.status).toBe('active');
    });

    it('should throw BRANCH_NOT_FOUND when branch does not exist', async () => {
      mockBranches.findOne.mockResolvedValue(null);

      await expect(
        studentService.create(
          TEST_TENANT_ID,
          TEST_BRANCH_ID,
          buildCreateInput() as any,
          TEST_USER_ID
        )
      ).rejects.toMatchObject({ code: 'BRANCH_NOT_FOUND', statusCode: 404 });
    });

    it('should throw BATCH_NOT_FOUND when academic batch does not exist', async () => {
      mockBranches.findOne.mockResolvedValue({ _id: branchObjId, code: 'MAIN' });
      mockAcademicBatches.findOne.mockResolvedValue(null);

      await expect(
        studentService.create(
          TEST_TENANT_ID,
          TEST_BRANCH_ID,
          buildCreateInput() as any,
          TEST_USER_ID
        )
      ).rejects.toMatchObject({ code: 'BATCH_NOT_FOUND', statusCode: 404 });
    });
  });

  // =========================================================================
  // 2. findAll (getStudents)
  // =========================================================================
  describe('findAll', () => {
    it('should return paginated students with default active filter', async () => {
      const student1 = buildStudentDoc({ firstName: 'Amit' });
      const student2 = buildStudentDoc({ firstName: 'Priya' });
      mockFindChain(mockStudents, [student1, student2]);
      mockStudents.countDocuments.mockResolvedValue(2);

      const result = await studentService.findAll(TEST_TENANT_ID, TEST_BRANCH_ID);

      expect(result.data).toHaveLength(2);
      expect(result.meta).toEqual({
        page: 1,
        limit: 20,
        total: 2,
        totalPages: 1,
        hasMore: false,
      });

      // Verify filter includes tenantId, branchId, and default status=active
      const filterArg = mockStudents.find.mock.calls[0][0];
      expect(filterArg.tenantId).toEqual(tenantObjId);
      expect(filterArg.branchId).toEqual(branchObjId);
      expect(filterArg.status).toBe('active');
    });

    it('should apply classId and sectionId filters', async () => {
      mockFindChain(mockStudents, []);
      mockStudents.countDocuments.mockResolvedValue(0);

      await studentService.findAll(TEST_TENANT_ID, TEST_BRANCH_ID, {
        classId: TEST_CLASS_ID,
        sectionId: TEST_SECTION_ID,
      });

      const filterArg = mockStudents.find.mock.calls[0][0];
      expect(filterArg['currentEnrollment.classId']).toEqual(new ObjectId(TEST_CLASS_ID));
      expect(filterArg['currentEnrollment.sectionId']).toEqual(new ObjectId(TEST_SECTION_ID));
    });

    it('should apply search filter with $or regex', async () => {
      mockFindChain(mockStudents, []);
      mockStudents.countDocuments.mockResolvedValue(0);

      await studentService.findAll(TEST_TENANT_ID, TEST_BRANCH_ID, { search: 'amit' });

      const filterArg = mockStudents.find.mock.calls[0][0];
      expect(filterArg.$or).toBeDefined();
      expect(filterArg.$or).toHaveLength(6); // name ×2, admission no., roll no., code, phone
      expect(filterArg.$or[0]).toEqual({ firstName: { $regex: 'amit', $options: 'i' } });
    });

    it('should support array status filter', async () => {
      mockFindChain(mockStudents, []);
      mockStudents.countDocuments.mockResolvedValue(0);

      await studentService.findAll(TEST_TENANT_ID, TEST_BRANCH_ID, {
        status: ['active', 'inactive'],
      });

      const filterArg = mockStudents.find.mock.calls[0][0];
      expect(filterArg.status).toEqual({ $in: ['active', 'inactive'] });
    });
  });

  // =========================================================================
  // 3. findById
  // =========================================================================
  describe('findById', () => {
    it('should return formatted student when found', async () => {
      const student = buildStudentDoc();
      mockStudents.findOne.mockResolvedValue(student);

      const result = await studentService.findById(TEST_TENANT_ID, student._id.toString());

      expect(result._id).toBe(student._id.toString());
      expect(result.firstName).toBe('Amit');
      expect(result.tenantId).toBe(TEST_TENANT_ID);
      // Verify currentEnrollment IDs are stringified
      expect(typeof result.currentEnrollment?.classId).toBe('string');
    });

    it('should throw STUDENT_NOT_FOUND when student does not exist', async () => {
      mockStudents.findOne.mockResolvedValue(null);

      await expect(
        studentService.findById(TEST_TENANT_ID, new ObjectId().toString())
      ).rejects.toMatchObject({ code: 'STUDENT_NOT_FOUND', statusCode: 404 });
    });
  });

  // =========================================================================
  // 4. update
  // =========================================================================
  describe('update', () => {
    it('should update specified fields and return updated student', async () => {
      const student = buildStudentDoc();
      // First findOne for existence check
      mockStudents.findOne.mockResolvedValueOnce(student);
      // Second findOne for the findById call at the end
      mockStudents.findOne.mockResolvedValueOnce({
        ...student,
        firstName: 'Rahul',
        displayName: 'Rahul Kumar',
      });

      const result = await studentService.update(
        TEST_TENANT_ID,
        student._id.toString(),
        { firstName: 'Rahul' } as any,
        TEST_USER_ID
      );

      expect(mockStudents.updateOne).toHaveBeenCalledOnce();
      const updateArg = mockStudents.updateOne.mock.calls[0][1];
      expect(updateArg.$set.firstName).toBe('Rahul');
      expect(updateArg.$set.displayName).toBe('Rahul Kumar');
      expect(result.firstName).toBe('Rahul');
    });

    it('should throw STUDENT_NOT_FOUND when updating non-existent student', async () => {
      mockStudents.findOne.mockResolvedValue(null);

      await expect(
        studentService.update(
          TEST_TENANT_ID,
          new ObjectId().toString(),
          { firstName: 'X' } as any,
          TEST_USER_ID
        )
      ).rejects.toMatchObject({ code: 'STUDENT_NOT_FOUND' });
    });
  });

  // =========================================================================
  // 5. updateStatus (deactivate / archive)
  // =========================================================================
  describe('updateStatus', () => {
    it('should set student to inactive with status history entry', async () => {
      const student = buildStudentDoc();
      // First findOne for existence check
      mockStudents.findOne.mockResolvedValueOnce(student);
      // Second findOne for the findById call at the end
      mockStudents.findOne.mockResolvedValueOnce({ ...student, status: 'inactive' });

      const result = await studentService.updateStatus(
        TEST_TENANT_ID,
        student._id.toString(),
        'inactive',
        'Taking a break',
        TEST_USER_ID
      );

      expect(mockStudents.updateOne).toHaveBeenCalledOnce();
      const updateArg = mockStudents.updateOne.mock.calls[0][1];
      expect(updateArg.$set.status).toBe('inactive');
      expect(updateArg.$push.statusHistory.status).toBe('inactive');
      expect(updateArg.$push.statusHistory.reason).toBe('Taking a break');

      // Should NOT complete enrollment for inactive
      expect(mockStudentEnrollments.updateOne).not.toHaveBeenCalled();

      expect(result.status).toBe('inactive');
    });

    it('withdrawing closes the enrollment and switches off the login', async () => {
      const userId = new ObjectId();
      const student = buildStudentDoc({ userId });
      mockStudents.findOne.mockResolvedValueOnce(student);
      mockStudents.findOne.mockResolvedValueOnce({ ...student, status: 'withdrawn' });

      await studentService.updateStatus(
        TEST_TENANT_ID,
        student._id.toString(),
        'withdrawn',
        'Left for a job',
        TEST_USER_ID
      );

      expect(mockStudentEnrollments.updateOne.mock.calls[0][1].$set.status).toBe('withdrawn');
      expect(mockUsers.updateOne).toHaveBeenCalledWith(
        { _id: userId },
        { $set: expect.objectContaining({ status: 'inactive' }) }
      );
    });

    it('returning from leave re-enables a switched-off login', async () => {
      const userId = new ObjectId();
      const student = buildStudentDoc({ userId, status: 'inactive' });
      mockStudents.findOne.mockResolvedValueOnce(student);
      mockStudents.findOne.mockResolvedValueOnce({ ...student, status: 'active' });

      await studentService.updateStatus(
        TEST_TENANT_ID,
        student._id.toString(),
        'active',
        'Back',
        TEST_USER_ID
      );

      expect(mockStudentEnrollments.updateOne).not.toHaveBeenCalled();
      expect(mockUsers.updateOne).toHaveBeenCalledWith(
        { _id: userId, status: 'inactive' },
        { $set: expect.objectContaining({ status: 'active' }) }
      );
    });

    it('should complete enrollment when student becomes alumni', async () => {
      const student = buildStudentDoc();
      mockStudents.findOne.mockResolvedValueOnce(student);
      mockStudents.findOne.mockResolvedValueOnce({ ...student, status: 'alumni' });

      await studentService.updateStatus(
        TEST_TENANT_ID,
        student._id.toString(),
        'alumni',
        'Graduated',
        TEST_USER_ID
      );

      // Enrollment should be completed
      expect(mockStudentEnrollments.updateOne).toHaveBeenCalledOnce();
      const enrollUpdate = mockStudentEnrollments.updateOne.mock.calls[0][1];
      expect(enrollUpdate.$set.status).toBe('completed');
      expect(alumniProfileService.getMyProfile).toHaveBeenCalledWith(
        TEST_TENANT_ID,
        student._id.toString()
      );
    });

    it('should mark enrollment as withdrawn when student is transferred', async () => {
      const student = buildStudentDoc();
      mockStudents.findOne.mockResolvedValueOnce(student);
      mockStudents.findOne.mockResolvedValueOnce({ ...student, status: 'transferred' });

      await studentService.updateStatus(
        TEST_TENANT_ID,
        student._id.toString(),
        'transferred',
        'Moving to another city',
        TEST_USER_ID
      );

      const enrollUpdate = mockStudentEnrollments.updateOne.mock.calls[0][1];
      expect(enrollUpdate.$set.status).toBe('withdrawn');
    });
  });

  // =========================================================================
  // 6. shuffleStudent
  // =========================================================================
  describe('shuffleStudent', () => {
    it('should change section and update enrollment record', async () => {
      const student = buildStudentDoc();
      const newSectionId = new ObjectId().toString();

      // findOne for the student
      mockStudents.findOne.mockResolvedValueOnce(student);
      // findOne for the new section validation
      mockSections.findOne.mockResolvedValue({
        _id: new ObjectId(newSectionId),
        name: 'Section B',
      });
      // findOne for the findById at end
      mockStudents.findOne.mockResolvedValueOnce({
        ...student,
        currentEnrollment: {
          ...student.currentEnrollment,
          sectionId: new ObjectId(newSectionId),
          sectionName: 'Section B',
        },
      });

      const result = await studentService.shuffleStudent(
        TEST_TENANT_ID,
        student._id.toString(),
        { newSectionId, reason: 'Balance sections' },
        TEST_USER_ID
      );

      // Enrollment record updated with new section and shuffle history
      expect(mockStudentEnrollments.updateOne).toHaveBeenCalledOnce();
      const enrollUpdate = mockStudentEnrollments.updateOne.mock.calls[0][1];
      expect(enrollUpdate.$set.sectionId).toEqual(new ObjectId(newSectionId));
      expect(enrollUpdate.$push.shuffleHistory.reason).toBe('Balance sections');

      // Student record updated
      expect(mockStudents.updateOne).toHaveBeenCalledOnce();
      const studentUpdate = mockStudents.updateOne.mock.calls[0][1];
      expect(studentUpdate.$set['currentEnrollment.sectionId']).toEqual(new ObjectId(newSectionId));
      expect(studentUpdate.$set['currentEnrollment.sectionName']).toBe('Section B');

      expect(result.currentEnrollment?.sectionName).toBe('Section B');
    });

    it('should throw INVALID_STATUS when shuffling a non-active student', async () => {
      const student = buildStudentDoc({ status: 'alumni' });
      mockStudents.findOne.mockResolvedValue(student);

      await expect(
        studentService.shuffleStudent(
          TEST_TENANT_ID,
          student._id.toString(),
          { newSectionId: new ObjectId().toString() },
          TEST_USER_ID
        )
      ).rejects.toMatchObject({ code: 'INVALID_STATUS', statusCode: 400 });
    });
  });

  // =========================================================================
  // 7. transferStudent
  // =========================================================================
  describe('transferStudent', () => {
    it('should transfer student to a new branch, complete old enrollment, create new enrollment', async () => {
      const student = buildStudentDoc();
      const toBranchId = new ObjectId().toString();
      const toClassId = new ObjectId().toString();
      const toSectionId = new ObjectId().toString();
      const toBatchId = new ObjectId().toString();

      mockStudents.findOne.mockResolvedValueOnce(student);
      mockBranches.findOne.mockResolvedValue({ _id: new ObjectId(toBranchId) });
      mockClasses.findOne.mockResolvedValue({
        _id: new ObjectId(toClassId),
        displayName: 'Class 5',
      });
      mockSections.findOne.mockResolvedValue({ _id: new ObjectId(toSectionId), name: 'Section C' });
      // Service validates the batch exists in the target branch (or tenant-wide)
      mockAcademicBatches.findOne.mockResolvedValue({ _id: new ObjectId(toBatchId) });
      // findById at end
      mockStudents.findOne.mockResolvedValueOnce({
        ...student,
        branchId: new ObjectId(toBranchId),
        currentEnrollment: {
          academicBatchId: new ObjectId(toBatchId),
          classId: new ObjectId(toClassId),
          sectionId: new ObjectId(toSectionId),
          className: 'Class 5',
          sectionName: 'Section C',
        },
      });

      const result = await studentService.transferStudent(
        TEST_TENANT_ID,
        student._id.toString(),
        {
          toBranchId,
          toClassId,
          toSectionId,
          toAcademicBatchId: toBatchId,
          reason: 'Parent relocation',
        },
        TEST_USER_ID
      );

      // Old enrollment marked as transferred
      expect(mockStudentEnrollments.updateOne).toHaveBeenCalledOnce();
      const oldEnrollUpdate = mockStudentEnrollments.updateOne.mock.calls[0][1];
      expect(oldEnrollUpdate.$set.status).toBe('transferred');

      // New enrollment created in target branch
      expect(mockStudentEnrollments.insertOne).toHaveBeenCalledOnce();
      const newEnroll = mockStudentEnrollments.insertOne.mock.calls[0][0];
      expect(newEnroll.branchId).toEqual(new ObjectId(toBranchId));
      expect(newEnroll.enrollmentType).toBe('transfer');
      expect(newEnroll.previousBranchId).toEqual(student.branchId);

      // Student branchId updated
      expect(mockStudents.updateOne).toHaveBeenCalledOnce();
      const studentUpdate = mockStudents.updateOne.mock.calls[0][1];
      expect(studentUpdate.$set.branchId).toEqual(new ObjectId(toBranchId));
      expect(studentUpdate.$set.currentEnrollment.className).toBe('Class 5');

      expect(result.currentEnrollment?.className).toBe('Class 5');
    });

    it('should throw INVALID_STATUS when transferring a non-active student', async () => {
      const student = buildStudentDoc({ status: 'inactive' });
      mockStudents.findOne.mockResolvedValue(student);

      await expect(
        studentService.transferStudent(
          TEST_TENANT_ID,
          student._id.toString(),
          {
            toBranchId: new ObjectId().toString(),
            toClassId: new ObjectId().toString(),
            toSectionId: new ObjectId().toString(),
            toAcademicBatchId: new ObjectId().toString(),
          },
          TEST_USER_ID
        )
      ).rejects.toMatchObject({ code: 'INVALID_STATUS', statusCode: 400 });
    });
  });

  // =========================================================================
  // 8. getStats
  // =========================================================================
  describe('getStats', () => {
    it('should return total, active, inactive, and gender distribution', async () => {
      mockStudents.countDocuments
        .mockResolvedValueOnce(100) // total
        .mockResolvedValueOnce(85) // active
        .mockResolvedValueOnce(45) // male
        .mockResolvedValueOnce(35); // female

      const result = await studentService.getStats(TEST_TENANT_ID, TEST_BRANCH_ID);

      expect(result.total).toBe(100);
      expect(result.active).toBe(85);
      expect(result.inactive).toBe(15);
      expect(result.genderDistribution).toEqual({ male: 45, female: 35, other: 5 });

      // Should have been called 4 times
      expect(mockStudents.countDocuments).toHaveBeenCalledTimes(4);
    });
  });

  // =========================================================================
  // 9. bulkPromote
  // =========================================================================
  describe('bulkPromote', () => {
    it('should promote all matching students and return results', async () => {
      const student1 = buildStudentDoc({ _id: new ObjectId() });
      const student2 = buildStudentDoc({ _id: new ObjectId() });
      const newClassId = new ObjectId().toString();
      const newSectionId = new ObjectId().toString();
      const newBatchId = new ObjectId().toString();

      // find() for getting students in the from class
      mockFindChain(mockStudents, [student1, student2]);

      // For each promoteStudent call: findOne (student), findOne (class), findOne (section), findById at end
      mockStudents.findOne
        .mockResolvedValueOnce(student1) // promoteStudent call 1: lookup
        .mockResolvedValueOnce(student1) // promoteStudent call 1: findById
        .mockResolvedValueOnce(student2) // promoteStudent call 2: lookup
        .mockResolvedValueOnce(student2); // promoteStudent call 2: findById

      mockClasses.findOne.mockResolvedValue({
        _id: new ObjectId(newClassId),
        displayName: 'Class 2',
      });
      mockSections.findOne.mockResolvedValue({
        _id: new ObjectId(newSectionId),
        name: 'Section A',
      });

      const result = await studentService.bulkPromote(
        TEST_TENANT_ID,
        TEST_BRANCH_ID,
        {
          fromAcademicBatchId: TEST_BATCH_ID,
          toAcademicBatchId: newBatchId,
          promotions: [
            {
              fromClassId: TEST_CLASS_ID,
              toClassId: newClassId,
              toSectionId: newSectionId,
              result: 'promoted',
            },
          ],
        },
        TEST_USER_ID
      );

      expect(result.promoted).toBe(2);
      expect(result.failed).toBe(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should track errors for individual student promotion failures', async () => {
      const student1 = buildStudentDoc({ _id: new ObjectId() });
      const newClassId = new ObjectId().toString();
      const newSectionId = new ObjectId().toString();
      const newBatchId = new ObjectId().toString();

      mockFindChain(mockStudents, [student1]);

      // Student exists but class not found during promote
      mockStudents.findOne.mockResolvedValueOnce(student1);
      mockClasses.findOne.mockResolvedValue(null);

      const result = await studentService.bulkPromote(
        TEST_TENANT_ID,
        TEST_BRANCH_ID,
        {
          fromAcademicBatchId: TEST_BATCH_ID,
          toAcademicBatchId: newBatchId,
          promotions: [
            {
              fromClassId: TEST_CLASS_ID,
              toClassId: newClassId,
              toSectionId: newSectionId,
            },
          ],
        },
        TEST_USER_ID
      );

      expect(result.promoted).toBe(0);
      expect(result.failed).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].studentId).toBe(student1._id.toString());
    });
  });

  // =========================================================================
  // 10. delete (soft delete)
  // =========================================================================
  describe('delete', () => {
    it('should soft delete the student and withdraw active enrollments', async () => {
      const student = buildStudentDoc();
      mockStudents.findOne.mockResolvedValue(student);

      const result = await studentService.delete(TEST_TENANT_ID, student._id.toString());

      expect(result).toEqual({ success: true });

      // Student soft deleted
      expect(mockStudents.updateOne).toHaveBeenCalledOnce();
      const updateArg = mockStudents.updateOne.mock.calls[0][1];
      expect(updateArg.$set.status).toBe('deleted');
      expect(updateArg.$set.previousEnrollment).toEqual(student.currentEnrollment);
      expect(updateArg.$unset.currentEnrollment).toBe('');

      // Active enrollments withdrawn
      expect(mockStudentEnrollments.updateMany).toHaveBeenCalledOnce();
      const enrollUpdate = mockStudentEnrollments.updateMany.mock.calls[0][1];
      expect(enrollUpdate.$set.status).toBe('withdrawn');
    });

    it('should throw STUDENT_NOT_FOUND for non-existent student', async () => {
      mockStudents.findOne.mockResolvedValue(null);

      await expect(
        studentService.delete(TEST_TENANT_ID, new ObjectId().toString())
      ).rejects.toMatchObject({ code: 'STUDENT_NOT_FOUND', statusCode: 404 });
    });
  });
});
