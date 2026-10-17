import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ObjectId } from 'mongodb';
import {
  TEST_TENANT_ID,
  TEST_BRANCH_ID,
  TEST_USER_ID,
  TEST_CLASS_ID,
  TEST_BATCH_ID,
  TEST_SECTION_ID,
  createMockCollection,
} from '../helpers/setup';
import { createMockLead } from '../helpers/factories';

// ---- Mock collections ----
const mockApplications = createMockCollection();
const mockLeads = createMockCollection();
const mockStudents = createMockCollection();
const mockClasses = createMockCollection();
const mockSections = createMockCollection();

// NOTE: vi.mock factories are hoisted above the const declarations, so they run
// while the mock objects are still in the temporal dead zone. Getters defer the
// dereference to call time (inside tests), when the consts are initialized.
vi.mock('@/config/database', () => ({
  collections: {
    get applications() {
      return mockApplications;
    },
    get leads() {
      return mockLeads;
    },
    get students() {
      return mockStudents;
    },
    get classes() {
      return mockClasses;
    },
    get sections() {
      return mockSections;
    },
  },
  getDb: vi.fn(),
}));

vi.mock('@/modules/student/student.service', () => ({
  nextAdmissionNumber: vi.fn().mockResolvedValue('PNE-AY2627-0001'),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

// Import after mocking
import { applicationService } from '../../modules/admission/application.service';
import type { CreateApplicationInput } from '../../modules/admission/application.service';
import { ApiError } from '../../middleware/errorHandler';

// ---- Helpers ----

function buildValidApplicationInput(
  overrides: Partial<CreateApplicationInput> = {}
): CreateApplicationInput {
  return {
    academicBatchId: TEST_BATCH_ID,
    classId: TEST_CLASS_ID,
    sectionId: TEST_SECTION_ID,
    student: {
      firstName: 'Rahul',
      lastName: 'Sharma',
      dateOfBirth: '2010-05-15',
      gender: 'male',
    },
    contact: {
      phone: '+919876543210',
      email: 'parent@example.com',
      address: {
        city: 'Pune',
        state: 'Maharashtra',
        pincode: '411001',
        country: 'India',
      },
    },
    parents: {
      father: { name: 'Suresh Sharma', phone: '+919876543210' },
    },
    source: 'walk-in',
    ...overrides,
  };
}

function buildApplicationDoc(overrides: Record<string, unknown> = {}) {
  const tenantObjId = new ObjectId(TEST_TENANT_ID);
  const branchObjId = new ObjectId(TEST_BRANCH_ID);
  const id = new ObjectId();
  return {
    _id: id,
    tenantId: tenantObjId,
    branchId: branchObjId,
    applicationNumber: 'APP2600001',
    academicBatchId: new ObjectId(TEST_BATCH_ID),
    classId: new ObjectId(TEST_CLASS_ID),
    sectionId: new ObjectId(TEST_SECTION_ID),
    student: {
      firstName: 'Rahul',
      lastName: 'Sharma',
      dateOfBirth: new Date('2010-05-15'),
      gender: 'male',
    },
    contact: {
      phone: '+919876543210',
      email: 'parent@example.com',
      address: {
        city: 'Pune',
        state: 'Maharashtra',
        pincode: '411001',
        country: 'India',
      },
    },
    parents: {
      father: { name: 'Suresh Sharma', phone: '+919876543210' },
    },
    source: 'walk-in',
    status: 'submitted',
    statusHistory: [
      {
        status: 'submitted',
        changedAt: new Date(),
        changedBy: new ObjectId(TEST_USER_ID),
      },
    ],
    createdBy: new ObjectId(TEST_USER_ID),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// ---- Tests ----

describe('ApplicationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset default mock return values
    mockApplications.countDocuments.mockResolvedValue(0);
    mockApplications.insertOne.mockResolvedValue({ insertedId: new ObjectId() });
    mockApplications.updateOne.mockResolvedValue({ modifiedCount: 1 });
    mockApplications.deleteOne.mockResolvedValue({ deletedCount: 1 });
    mockApplications.aggregate.mockReturnValue({
      toArray: vi.fn().mockResolvedValue([]),
    });
    mockLeads.updateOne.mockResolvedValue({ modifiedCount: 1 });
    mockStudents.insertOne.mockResolvedValue({ insertedId: new ObjectId() });
    mockStudents.countDocuments.mockResolvedValue(0);
  });

  // ---------- 1. create ----------
  describe('create', () => {
    it('should create an application, generate applicationNumber, and return formatted result', async () => {
      mockApplications.countDocuments.mockResolvedValue(4); // next will be 5

      const input = buildValidApplicationInput();
      const result = await applicationService.create(
        TEST_TENANT_ID,
        TEST_BRANCH_ID,
        input,
        TEST_USER_ID
      );

      // applicationNumber format: APP{YY}{00005}
      const year = new Date().getFullYear().toString().slice(-2);
      expect(result.applicationNumber).toBe(`APP${year}00005`);
      expect(result.status).toBe('submitted');
      expect(result.student.firstName).toBe('Rahul');
      expect(result.tenantId).toBe(TEST_TENANT_ID);
      expect(result.branchId).toBe(TEST_BRANCH_ID);
      expect(result.classId).toBe(TEST_CLASS_ID);
      expect(result.academicBatchId).toBe(TEST_BATCH_ID);
      expect(result.statusHistory).toHaveLength(1);
      expect(result.statusHistory[0].status).toBe('submitted');

      expect(mockApplications.insertOne).toHaveBeenCalledOnce();
    });

    it('should update linked lead to converted when leadId is provided', async () => {
      const leadId = new ObjectId().toString();
      const input = buildValidApplicationInput({ leadId });

      await applicationService.create(TEST_TENANT_ID, TEST_BRANCH_ID, input, TEST_USER_ID);

      expect(mockLeads.updateOne).toHaveBeenCalledOnce();
      const [filter, update] = mockLeads.updateOne.mock.calls[0];
      expect(filter._id).toEqual(new ObjectId(leadId));
      expect(update.$set.stage).toBe('converted');
      expect(update.$set.status).toBe('converted');
    });

    it('should throw ApiError for invalid ObjectId fields', async () => {
      const input = buildValidApplicationInput({ classId: 'bad-id' });

      await expect(
        applicationService.create(TEST_TENANT_ID, TEST_BRANCH_ID, input, TEST_USER_ID)
      ).rejects.toThrow(ApiError);

      await expect(
        applicationService.create(TEST_TENANT_ID, TEST_BRANCH_ID, input, TEST_USER_ID)
      ).rejects.toThrow(/Invalid classId/);
    });
  });

  // ---------- 2. findAll ----------
  describe('findAll', () => {
    it('should return paginated applications with meta', async () => {
      const doc = buildApplicationDoc();
      mockApplications.aggregate.mockReturnValue({
        toArray: vi.fn().mockResolvedValue([doc]),
      });
      mockApplications.countDocuments.mockResolvedValue(1);

      const result = await applicationService.findAll(TEST_TENANT_ID, TEST_BRANCH_ID, {
        page: 1,
        limit: 20,
      });

      expect(result.data).toHaveLength(1);
      expect(result.meta).toEqual({
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
        hasMore: false,
      });
      expect(result.data[0]._id).toBe(doc._id.toString());
    });

    it('should apply status and search filters', async () => {
      mockApplications.aggregate.mockReturnValue({
        toArray: vi.fn().mockResolvedValue([]),
      });
      mockApplications.countDocuments.mockResolvedValue(0);

      await applicationService.findAll(TEST_TENANT_ID, TEST_BRANCH_ID, {
        status: 'submitted',
        search: 'Rahul',
      });

      // Verify the aggregate call received the correct match filter
      const aggregatePipeline = mockApplications.aggregate.mock.calls[0][0];
      const matchStage = aggregatePipeline[0].$match;
      expect(matchStage.status).toBe('submitted');
      expect(matchStage.$or).toBeDefined();
      expect(matchStage.$or).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ 'student.firstName': expect.any(Object) }),
        ])
      );
    });
  });

  // ---------- 3. findById ----------
  describe('findById', () => {
    it('should return formatted application when found', async () => {
      const doc = buildApplicationDoc();
      mockApplications.findOne.mockResolvedValue(doc);

      const result = await applicationService.findById(TEST_TENANT_ID, doc._id.toString());

      expect(result._id).toBe(doc._id.toString());
      expect(result.applicationNumber).toBe('APP2600001');
      expect(result.status).toBe('submitted');
      expect(mockApplications.findOne).toHaveBeenCalledWith({
        _id: doc._id,
        tenantId: new ObjectId(TEST_TENANT_ID),
      });
    });

    it('should throw APPLICATION_NOT_FOUND when application does not exist', async () => {
      mockApplications.findOne.mockResolvedValue(null);
      const fakeId = new ObjectId().toString();

      await expect(applicationService.findById(TEST_TENANT_ID, fakeId)).rejects.toThrow(ApiError);

      await expect(applicationService.findById(TEST_TENANT_ID, fakeId)).rejects.toThrow(
        'Application not found'
      );
    });
  });

  // ---------- 4. updateStatus - stage progression ----------
  describe('updateStatus', () => {
    it('should update status and append to statusHistory', async () => {
      const doc = buildApplicationDoc({ status: 'submitted' });
      // First call for the existing lookup, second call for findById after update
      mockApplications.findOne
        .mockResolvedValueOnce(doc)
        .mockResolvedValueOnce({ ...doc, status: 'under_review' });

      const result = await applicationService.updateStatus(
        TEST_TENANT_ID,
        doc._id.toString(),
        'under_review',
        TEST_USER_ID,
        'Documents look good'
      );

      expect(mockApplications.updateOne).toHaveBeenCalledOnce();
      const [, update] = mockApplications.updateOne.mock.calls[0];
      expect(update.$set.status).toBe('under_review');
      expect(update.$push.statusHistory.status).toBe('under_review');
      expect(update.$push.statusHistory.remarks).toBe('Documents look good');
      expect(result.status).toBe('under_review');
    });

    it('should throw APPLICATION_NOT_FOUND when application does not exist', async () => {
      mockApplications.findOne.mockResolvedValue(null);

      await expect(
        applicationService.updateStatus(
          TEST_TENANT_ID,
          new ObjectId().toString(),
          'under_review',
          TEST_USER_ID
        )
      ).rejects.toThrow('Application not found');
    });
  });

  // ---------- 5. rejectApplication - reverse sync ----------
  describe('updateStatus - rejection with reverse lead sync', () => {
    it('should set lead to lost when application with leadId is rejected', async () => {
      const leadId = new ObjectId();
      const doc = buildApplicationDoc({ status: 'under_review', leadId });
      const rejectedDoc = { ...doc, status: 'rejected' };

      mockApplications.findOne.mockResolvedValueOnce(doc).mockResolvedValueOnce(rejectedDoc);

      await applicationService.updateStatus(
        TEST_TENANT_ID,
        doc._id.toString(),
        'rejected',
        TEST_USER_ID,
        'Incomplete documents'
      );

      // Verify lead reverse sync
      expect(mockLeads.updateOne).toHaveBeenCalledOnce();
      const [leadFilter, leadUpdate] = mockLeads.updateOne.mock.calls[0];
      expect(leadFilter._id).toEqual(leadId);
      expect(leadUpdate.$set.stage).toBe('lost');
      expect(leadUpdate.$set.status).toBe('lost');
      expect(leadUpdate.$set.lostReason).toBe('Incomplete documents');
      expect(leadUpdate.$push.stageHistory.stage).toBe('lost');
      expect(leadUpdate.$push.stageHistory.notes).toContain('rejected');
    });

    it('should NOT sync to lead when rejected application has no leadId', async () => {
      const doc = buildApplicationDoc({ status: 'under_review', leadId: undefined });
      const rejectedDoc = { ...doc, status: 'rejected' };

      mockApplications.findOne.mockResolvedValueOnce(doc).mockResolvedValueOnce(rejectedDoc);

      await applicationService.updateStatus(
        TEST_TENANT_ID,
        doc._id.toString(),
        'rejected',
        TEST_USER_ID,
        'Not eligible'
      );

      expect(mockLeads.updateOne).not.toHaveBeenCalled();
    });
  });

  // ---------- 6. getStats ----------
  describe('getStats', () => {
    it('should return aggregated status counts with defaults', async () => {
      mockApplications.aggregate.mockReturnValue({
        toArray: vi.fn().mockResolvedValue([
          { _id: 'submitted', count: 5 },
          { _id: 'enrolled', count: 2 },
          { _id: 'rejected', count: 1 },
        ]),
      });

      const stats = await applicationService.getStats(TEST_TENANT_ID, TEST_BRANCH_ID);

      expect(stats.submitted).toBe(5);
      expect(stats.enrolled).toBe(2);
      expect(stats.rejected).toBe(1);
      expect(stats.total).toBe(8);
      // Unrepresented statuses default to 0
      expect(stats.draft).toBe(0);
      expect(stats.under_review).toBe(0);
      expect(stats.docs_verified).toBe(0);
      expect(stats.fee_paid).toBe(0);
      expect(stats.approved).toBe(0);
      expect(stats.withdrawn).toBe(0);
    });
  });

  // ---------- 7. convertFromLead ----------
  describe('convertFromLead', () => {
    it('should build application from lead data and create it', async () => {
      const lead = createMockLead({
        tenantId: new ObjectId(TEST_TENANT_ID),
        branchId: new ObjectId(TEST_BRANCH_ID),
        firstName: 'Aarav',
        lastName: 'Patel',
        contact: { phone: '+919999988888', email: 'aarav@example.com' },
        parents: { father: { name: 'Vikram Patel', phone: '+919999988888' } },
        interestedIn: { classId: new ObjectId(TEST_CLASS_ID) },
        source: 'website',
      });
      mockLeads.findOne.mockResolvedValue(lead);
      mockApplications.countDocuments.mockResolvedValue(0);

      const result = await applicationService.convertFromLead(
        TEST_TENANT_ID,
        TEST_BRANCH_ID,
        lead._id.toString(),
        {
          academicBatchId: TEST_BATCH_ID,
          student: {
            firstName: 'Aarav',
            lastName: 'Patel',
            dateOfBirth: '2012-03-20',
            gender: 'male',
          },
          contact: {
            phone: '+919999988888',
            address: { city: 'Mumbai', state: 'Maharashtra', pincode: '400001', country: 'India' },
          },
        },
        TEST_USER_ID
      );

      expect(result.status).toBe('submitted');
      expect(result.leadId).toBe(lead._id.toString());
      expect(result.source).toBe('website');
      // Lead should be updated to converted via the create method
      expect(mockLeads.updateOne).toHaveBeenCalled();
      expect(mockApplications.insertOne).toHaveBeenCalledOnce();
    });

    it('should throw LEAD_NOT_FOUND when lead does not exist', async () => {
      mockLeads.findOne.mockResolvedValue(null);

      await expect(
        applicationService.convertFromLead(
          TEST_TENANT_ID,
          TEST_BRANCH_ID,
          new ObjectId().toString(),
          {
            academicBatchId: TEST_BATCH_ID,
            student: { firstName: 'X', lastName: 'Y', dateOfBirth: '2010-01-01', gender: 'male' },
          },
          TEST_USER_ID
        )
      ).rejects.toThrow('Lead not found');
    });

    it('should throw MISSING_FIELD when academicBatchId is not provided', async () => {
      const lead = createMockLead({
        tenantId: new ObjectId(TEST_TENANT_ID),
      });
      mockLeads.findOne.mockResolvedValue(lead);

      await expect(
        applicationService.convertFromLead(
          TEST_TENANT_ID,
          TEST_BRANCH_ID,
          lead._id.toString(),
          {
            student: { firstName: 'A', lastName: 'B', dateOfBirth: '2010-01-01', gender: 'male' },
          },
          TEST_USER_ID
        )
      ).rejects.toThrow('Academic batch is required');
    });
  });

  // ---------- 8. delete ----------
  describe('delete', () => {
    it('should delete a non-enrolled application', async () => {
      const doc = buildApplicationDoc({ status: 'submitted' });
      mockApplications.findOne.mockResolvedValue(doc);

      const result = await applicationService.delete(TEST_TENANT_ID, doc._id.toString());

      expect(result).toEqual({ success: true });
      expect(mockApplications.deleteOne).toHaveBeenCalledOnce();
      const [deleteFilter] = mockApplications.deleteOne.mock.calls[0];
      expect(deleteFilter._id.toString()).toBe(doc._id.toString());
    });

    it('should throw CANNOT_DELETE for enrolled applications', async () => {
      const doc = buildApplicationDoc({ status: 'enrolled' });
      mockApplications.findOne.mockResolvedValue(doc);

      await expect(applicationService.delete(TEST_TENANT_ID, doc._id.toString())).rejects.toThrow(
        'Cannot delete enrolled application'
      );
    });
  });
});
