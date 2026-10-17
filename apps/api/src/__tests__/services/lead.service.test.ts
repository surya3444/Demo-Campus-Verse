import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ObjectId } from 'mongodb';

// Stable test IDs
const TEST_TENANT_ID = new ObjectId().toString();
const TEST_BRANCH_ID = new ObjectId().toString();
const TEST_USER_ID = new ObjectId().toString();
const TEST_LEAD_ID = new ObjectId();

// Mock collections
const mockLeads = {
  findOne: vi.fn(),
  find: vi.fn().mockReturnValue({
    sort: vi.fn().mockReturnThis(),
    skip: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    toArray: vi.fn().mockResolvedValue([]),
  }),
  insertOne: vi.fn().mockResolvedValue({ insertedId: new ObjectId() }),
  updateOne: vi.fn().mockResolvedValue({ modifiedCount: 1 }),
  deleteOne: vi.fn().mockResolvedValue({ deletedCount: 1 }),
  countDocuments: vi.fn().mockResolvedValue(0),
  aggregate: vi.fn().mockReturnValue({
    toArray: vi.fn().mockResolvedValue([]),
  }),
};

// NOTE: vi.mock factories are hoisted above the const declarations, so they run
// while the mock objects are still in the temporal dead zone. Getters defer the
// dereference to call time (inside tests), when the consts are initialized.
vi.mock('@/config/database', () => ({
  collections: {
    get leads() {
      return mockLeads;
    },
    counters: {
      findOneAndUpdate: vi.fn(),
    },
  },
  getDb: vi.fn(),
}));

vi.mock('@/utils/generators', () => ({
  generateLeadNumber: vi.fn().mockResolvedValue('LD2500001'),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

// Import after all mocks are set up
import { leadService } from '../../modules/admission/lead.service';
import { ApiError } from '../../middleware/errorHandler';

// Helper to build a full lead document as returned by MongoDB
function buildLeadDoc(overrides: Record<string, unknown> = {}) {
  const id = (overrides._id as ObjectId) || new ObjectId();
  const tenantId = (overrides.tenantId as ObjectId) || new ObjectId(TEST_TENANT_ID);
  const branchId = (overrides.branchId as ObjectId) || new ObjectId(TEST_BRANCH_ID);
  const createdBy = (overrides.createdBy as ObjectId) || new ObjectId(TEST_USER_ID);
  return {
    _id: id,
    tenantId,
    branchId,
    leadNumber: 'LD2500001',
    firstName: 'Rahul',
    lastName: 'Sharma',
    displayName: 'Rahul Sharma',
    dateOfBirth: new Date('2010-05-15'),
    gender: 'male',
    contact: {
      phone: '+919876543210',
      email: 'parent@example.com',
    },
    parents: {
      father: { name: 'Suresh Sharma', phone: '+919876543210' },
      mother: { name: 'Sunita Sharma' },
    },
    interestedIn: {
      classId: new ObjectId(),
      stream: 'Science',
    },
    source: 'walk_in' as const,
    stage: 'new' as const,
    stageHistory: [
      {
        stage: 'new',
        date: new Date(),
        changedBy: createdBy,
        notes: 'Lead created',
      },
    ],
    followups: [] as Array<Record<string, unknown>>,
    tags: [],
    status: 'active' as const,
    createdBy,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// Reset all mocks and re-wire the chainable find mock before each test
function resetFindMock(resolvedDocs: unknown[] = []) {
  const toArrayFn = vi.fn().mockResolvedValue(resolvedDocs);
  mockLeads.find.mockReturnValue({
    sort: vi.fn().mockReturnThis(),
    skip: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    toArray: toArrayFn,
  });
}

describe('LeadService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetFindMock();
  });

  // ---------------------------------------------------------------
  // 1. createLead
  // ---------------------------------------------------------------
  describe('create', () => {
    const createInput = {
      firstName: 'Rahul',
      lastName: 'Sharma',
      contact: { phone: '+919876543210', email: 'parent@example.com' },
      interestedIn: { classId: new ObjectId().toString(), stream: 'Science' },
      source: 'walk_in' as const,
    };

    it('generates a lead number, inserts the lead, and returns formatted output', async () => {
      // After insertOne, findById is called internally, so mock findOne for that
      const expectedDoc = buildLeadDoc();
      mockLeads.insertOne.mockResolvedValue({ insertedId: expectedDoc._id });
      mockLeads.findOne.mockResolvedValue(expectedDoc);

      const result = await leadService.create(
        TEST_TENANT_ID,
        TEST_BRANCH_ID,
        createInput,
        TEST_USER_ID
      );

      // insertOne was called
      expect(mockLeads.insertOne).toHaveBeenCalledOnce();
      const insertedDoc = mockLeads.insertOne.mock.calls[0][0];
      expect(insertedDoc.leadNumber).toBe('LD2500001');
      expect(insertedDoc.stage).toBe('new');
      expect(insertedDoc.status).toBe('active');
      expect(insertedDoc.followups).toEqual([]);
      expect(insertedDoc.stageHistory).toHaveLength(1);
      expect(insertedDoc.stageHistory[0].stage).toBe('new');

      // Result should have stringified IDs (formatLead)
      expect(typeof result._id).toBe('string');
      expect(typeof result.tenantId).toBe('string');
      expect(typeof result.branchId).toBe('string');
      expect(result.firstName).toBe('Rahul');
      expect(result.displayName).toBe('Rahul Sharma');
    });

    it('converts string ObjectId fields in interestedIn and assignedTo', async () => {
      const assignedToId = new ObjectId().toString();
      const batchId = new ObjectId().toString();
      const inputWithAssigned = {
        ...createInput,
        assignedTo: assignedToId,
        interestedIn: { ...createInput.interestedIn, academicBatchId: batchId },
      };

      const expectedDoc = buildLeadDoc({ assignedTo: new ObjectId(assignedToId) });
      mockLeads.insertOne.mockResolvedValue({ insertedId: expectedDoc._id });
      mockLeads.findOne.mockResolvedValue(expectedDoc);

      await leadService.create(TEST_TENANT_ID, TEST_BRANCH_ID, inputWithAssigned, TEST_USER_ID);

      const insertedDoc = mockLeads.insertOne.mock.calls[0][0];
      expect(insertedDoc.assignedTo).toBeInstanceOf(ObjectId);
      expect(insertedDoc.interestedIn.academicBatchId).toBeInstanceOf(ObjectId);
    });
  });

  // ---------------------------------------------------------------
  // 2. findAll (getLeads)
  // ---------------------------------------------------------------
  describe('findAll', () => {
    it('returns paginated leads with default parameters', async () => {
      const lead1 = buildLeadDoc({ leadNumber: 'LD2500001' });
      const lead2 = buildLeadDoc({ leadNumber: 'LD2500002' });
      resetFindMock([lead1, lead2]);
      mockLeads.countDocuments.mockResolvedValue(2);

      const result = await leadService.findAll(TEST_TENANT_ID, TEST_BRANCH_ID);

      expect(result.data).toHaveLength(2);
      expect(result.meta).toEqual({
        page: 1,
        limit: 20,
        total: 2,
        totalPages: 1,
        hasMore: false,
      });
      // Leads should be formatted (string IDs)
      expect(typeof result.data[0]._id).toBe('string');
    });

    it('applies stage filter as a single string', async () => {
      resetFindMock([]);
      mockLeads.countDocuments.mockResolvedValue(0);

      await leadService.findAll(TEST_TENANT_ID, TEST_BRANCH_ID, { stage: 'contacted' });

      // Inspect the filter passed to find()
      const filter = mockLeads.find.mock.calls[0][0];
      expect(filter.stage).toBe('contacted');
    });

    it('applies stage filter as an array using $in', async () => {
      resetFindMock([]);
      mockLeads.countDocuments.mockResolvedValue(0);

      await leadService.findAll(TEST_TENANT_ID, TEST_BRANCH_ID, {
        stage: ['new', 'contacted'],
      });

      const filter = mockLeads.find.mock.calls[0][0];
      expect(filter.stage).toEqual({ $in: ['new', 'contacted'] });
    });

    it('applies search filter with $or regex across multiple fields', async () => {
      resetFindMock([]);
      mockLeads.countDocuments.mockResolvedValue(0);

      await leadService.findAll(TEST_TENANT_ID, TEST_BRANCH_ID, { search: 'Rahul' });

      const filter = mockLeads.find.mock.calls[0][0];
      expect(filter.$or).toBeDefined();
      expect(filter.$or).toHaveLength(5);
      expect(filter.$or[0]).toEqual({ firstName: { $regex: 'Rahul', $options: 'i' } });
    });

    it('defaults status to active when not specified', async () => {
      resetFindMock([]);
      mockLeads.countDocuments.mockResolvedValue(0);

      await leadService.findAll(TEST_TENANT_ID, TEST_BRANCH_ID);

      const filter = mockLeads.find.mock.calls[0][0];
      expect(filter.status).toBe('active');
    });
  });

  // ---------------------------------------------------------------
  // 3. findById (getLeadById)
  // ---------------------------------------------------------------
  describe('findById', () => {
    it('returns a formatted lead when found', async () => {
      const doc = buildLeadDoc({ _id: TEST_LEAD_ID });
      mockLeads.findOne.mockResolvedValue(doc);

      const result = await leadService.findById(TEST_TENANT_ID, TEST_LEAD_ID.toString());

      expect(result._id).toBe(TEST_LEAD_ID.toString());
      expect(result.firstName).toBe('Rahul');
      expect(mockLeads.findOne).toHaveBeenCalledWith({
        _id: expect.any(ObjectId),
        tenantId: expect.any(ObjectId),
      });
    });

    it('throws LEAD_NOT_FOUND (404) when lead does not exist', async () => {
      mockLeads.findOne.mockResolvedValue(null);

      await expect(leadService.findById(TEST_TENANT_ID, new ObjectId().toString())).rejects.toThrow(
        ApiError
      );

      try {
        await leadService.findById(TEST_TENANT_ID, new ObjectId().toString());
      } catch (err) {
        expect((err as ApiError).code).toBe('LEAD_NOT_FOUND');
        expect((err as ApiError).statusCode).toBe(404);
      }
    });
  });

  // ---------------------------------------------------------------
  // 4. update
  // ---------------------------------------------------------------
  describe('update', () => {
    it('updates basic fields and returns the updated lead', async () => {
      const existingDoc = buildLeadDoc({ _id: TEST_LEAD_ID });
      // First findOne for existence check, second for findById after update
      mockLeads.findOne
        .mockResolvedValueOnce(existingDoc)
        .mockResolvedValueOnce({ ...existingDoc, firstName: 'Rohan', displayName: 'Rohan Sharma' });

      const result = await leadService.update(TEST_TENANT_ID, TEST_LEAD_ID.toString(), {
        firstName: 'Rohan',
      });

      expect(mockLeads.updateOne).toHaveBeenCalledOnce();
      const [filter, update] = mockLeads.updateOne.mock.calls[0];
      expect(filter._id).toEqual(new ObjectId(TEST_LEAD_ID.toString()));
      expect(update.$set.firstName).toBe('Rohan');
      expect(update.$set.updatedAt).toBeInstanceOf(Date);
      expect(result.firstName).toBe('Rohan');
    });

    it('throws LEAD_NOT_FOUND when updating a non-existent lead', async () => {
      mockLeads.findOne.mockResolvedValue(null);

      await expect(
        leadService.update(TEST_TENANT_ID, new ObjectId().toString(), { firstName: 'X' })
      ).rejects.toThrow(ApiError);
    });
  });

  // ---------------------------------------------------------------
  // 5. updateStage
  // ---------------------------------------------------------------
  describe('updateStage', () => {
    it('updates stage and pushes to stageHistory', async () => {
      const doc = buildLeadDoc({ _id: TEST_LEAD_ID, stage: 'new' });
      mockLeads.findOne
        .mockResolvedValueOnce(doc) // existence check
        .mockResolvedValueOnce({ ...doc, stage: 'contacted' }); // findById after

      await leadService.updateStage(
        TEST_TENANT_ID,
        TEST_LEAD_ID.toString(),
        'contacted',
        'Called the parent',
        TEST_USER_ID
      );

      expect(mockLeads.updateOne).toHaveBeenCalledOnce();
      const [, updateArg] = mockLeads.updateOne.mock.calls[0];
      expect(updateArg.$set.stage).toBe('contacted');
      expect(updateArg.$push.stageHistory.stage).toBe('contacted');
      expect(updateArg.$push.stageHistory.notes).toBe('Called the parent');
    });

    it('sets status to converted when stage is converted', async () => {
      const doc = buildLeadDoc({ _id: TEST_LEAD_ID, stage: 'visited' });
      mockLeads.findOne
        .mockResolvedValueOnce(doc)
        .mockResolvedValueOnce({ ...doc, stage: 'converted', status: 'converted' });

      await leadService.updateStage(
        TEST_TENANT_ID,
        TEST_LEAD_ID.toString(),
        'converted',
        undefined,
        TEST_USER_ID
      );

      const [, updateArg] = mockLeads.updateOne.mock.calls[0];
      expect(updateArg.$set.status).toBe('converted');
    });

    it('sets status to lost when stage is lost', async () => {
      const doc = buildLeadDoc({ _id: TEST_LEAD_ID, stage: 'contacted' });
      mockLeads.findOne
        .mockResolvedValueOnce(doc)
        .mockResolvedValueOnce({ ...doc, stage: 'lost', status: 'lost' });

      await leadService.updateStage(
        TEST_TENANT_ID,
        TEST_LEAD_ID.toString(),
        'lost',
        'Not interested',
        TEST_USER_ID
      );

      const [, updateArg] = mockLeads.updateOne.mock.calls[0];
      expect(updateArg.$set.status).toBe('lost');
    });
  });

  // ---------------------------------------------------------------
  // 6. addFollowup
  // ---------------------------------------------------------------
  describe('addFollowup', () => {
    it('pushes a followup entry with ObjectId and returns formatted lead', async () => {
      const doc = buildLeadDoc({ _id: TEST_LEAD_ID, stage: 'contacted' });
      mockLeads.findOne
        .mockResolvedValueOnce(doc) // existence check
        .mockResolvedValueOnce(doc); // findById after

      const followupData = {
        type: 'call' as const,
        notes: 'Discussed admission',
        nextFollowupDate: new Date('2025-04-10'),
      };

      await leadService.addFollowup(
        TEST_TENANT_ID,
        TEST_LEAD_ID.toString(),
        followupData,
        TEST_USER_ID
      );

      expect(mockLeads.updateOne).toHaveBeenCalledOnce();
      const [, updateArg] = mockLeads.updateOne.mock.calls[0];

      // Followup entry should have an ObjectId _id
      expect(updateArg.$push.followups._id).toBeInstanceOf(ObjectId);
      expect(updateArg.$push.followups.type).toBe('call');
      expect(updateArg.$push.followups.notes).toBe('Discussed admission');
      expect(updateArg.$push.followups.createdBy).toBeInstanceOf(ObjectId);

      // nextFollowupDate should be set on the lead
      expect(updateArg.$set.nextFollowupDate).toBeInstanceOf(Date);
    });

    it('auto-transitions stage from new to contacted on first followup', async () => {
      const doc = buildLeadDoc({ _id: TEST_LEAD_ID, stage: 'new' });
      mockLeads.findOne
        .mockResolvedValueOnce(doc)
        .mockResolvedValueOnce({ ...doc, stage: 'contacted' });

      await leadService.addFollowup(
        TEST_TENANT_ID,
        TEST_LEAD_ID.toString(),
        { type: 'call', notes: 'Initial call' },
        TEST_USER_ID
      );

      const [, updateArg] = mockLeads.updateOne.mock.calls[0];
      expect(updateArg.$set.stage).toBe('contacted');
    });

    it('does not change stage when lead is already past new', async () => {
      const doc = buildLeadDoc({ _id: TEST_LEAD_ID, stage: 'interested' });
      mockLeads.findOne.mockResolvedValueOnce(doc).mockResolvedValueOnce(doc);

      await leadService.addFollowup(
        TEST_TENANT_ID,
        TEST_LEAD_ID.toString(),
        { type: 'email', notes: 'Sent brochure' },
        TEST_USER_ID
      );

      const [, updateArg] = mockLeads.updateOne.mock.calls[0];
      expect(updateArg.$set.stage).toBe('interested');
    });

    it('throws LEAD_NOT_FOUND when lead does not exist', async () => {
      mockLeads.findOne.mockResolvedValue(null);

      await expect(
        leadService.addFollowup(
          TEST_TENANT_ID,
          new ObjectId().toString(),
          { type: 'call', notes: 'test' },
          TEST_USER_ID
        )
      ).rejects.toThrow(ApiError);
    });
  });

  // ---------------------------------------------------------------
  // 7. completeFollowup
  // ---------------------------------------------------------------
  describe('completeFollowup', () => {
    it('marks a followup as completed with outcome and timestamps', async () => {
      const followupId = new ObjectId();
      const doc = buildLeadDoc({
        _id: TEST_LEAD_ID,
        followups: [
          {
            _id: followupId,
            date: new Date(),
            type: 'call',
            notes: 'Call scheduled',
            createdBy: new ObjectId(TEST_USER_ID),
          },
        ],
      });
      // First findOne for existence, second for findById after completion
      mockLeads.findOne.mockResolvedValueOnce(doc).mockResolvedValueOnce(doc);

      await leadService.completeFollowup(
        TEST_TENANT_ID,
        TEST_LEAD_ID.toString(),
        0,
        { outcome: 'interested', notes: 'Parent very positive' },
        TEST_USER_ID
      );

      expect(mockLeads.updateOne).toHaveBeenCalledOnce();
      const [, updateArg] = mockLeads.updateOne.mock.calls[0];
      expect(updateArg.$set['followups.0.completedAt']).toBeInstanceOf(Date);
      expect(updateArg.$set['followups.0.completedBy']).toBeInstanceOf(ObjectId);
      expect(updateArg.$set['followups.0.outcome']).toBe('interested');
    });

    it('throws FOLLOWUP_NOT_FOUND when index is out of bounds', async () => {
      const doc = buildLeadDoc({ _id: TEST_LEAD_ID, followups: [] });
      mockLeads.findOne.mockResolvedValue(doc);

      await expect(
        leadService.completeFollowup(
          TEST_TENANT_ID,
          TEST_LEAD_ID.toString(),
          5,
          { outcome: 'no_response' },
          TEST_USER_ID
        )
      ).rejects.toThrow(ApiError);

      try {
        mockLeads.findOne.mockResolvedValue(doc);
        await leadService.completeFollowup(
          TEST_TENANT_ID,
          TEST_LEAD_ID.toString(),
          0,
          { outcome: 'no_response' },
          TEST_USER_ID
        );
      } catch (err) {
        expect((err as ApiError).code).toBe('FOLLOWUP_NOT_FOUND');
        expect((err as ApiError).statusCode).toBe(404);
      }
    });

    it('throws FOLLOWUP_ALREADY_COMPLETED when followup is already done', async () => {
      const doc = buildLeadDoc({
        _id: TEST_LEAD_ID,
        followups: [
          {
            _id: new ObjectId(),
            date: new Date(),
            type: 'call',
            notes: 'Done',
            createdBy: new ObjectId(TEST_USER_ID),
            completedAt: new Date(), // already completed
            completedBy: new ObjectId(TEST_USER_ID),
            outcome: 'interested',
          },
        ],
      });
      mockLeads.findOne.mockResolvedValue(doc);

      await expect(
        leadService.completeFollowup(
          TEST_TENANT_ID,
          TEST_LEAD_ID.toString(),
          0,
          { outcome: 'not_interested' },
          TEST_USER_ID
        )
      ).rejects.toThrow(ApiError);

      try {
        mockLeads.findOne.mockResolvedValue(doc);
        await leadService.completeFollowup(
          TEST_TENANT_ID,
          TEST_LEAD_ID.toString(),
          0,
          { outcome: 'not_interested' },
          TEST_USER_ID
        );
      } catch (err) {
        expect((err as ApiError).code).toBe('FOLLOWUP_ALREADY_COMPLETED');
        expect((err as ApiError).statusCode).toBe(400);
      }
    });
  });

  // ---------------------------------------------------------------
  // 8. getStats
  // ---------------------------------------------------------------
  describe('getStats', () => {
    it('returns aggregated stage counts, total, and followup due count', async () => {
      mockLeads.aggregate.mockReturnValue({
        toArray: vi.fn().mockResolvedValue([
          { _id: 'new', count: 5 },
          { _id: 'contacted', count: 3 },
          { _id: 'interested', count: 2 },
        ]),
      });
      mockLeads.countDocuments
        .mockResolvedValueOnce(10) // total
        .mockResolvedValueOnce(4); // followupDue

      const stats = await leadService.getStats(TEST_TENANT_ID, TEST_BRANCH_ID);

      expect(stats.total).toBe(10);
      expect(stats.followupDue).toBe(4);
      expect(stats.byStage).toEqual({
        new: 5,
        contacted: 3,
        interested: 2,
      });
      expect(mockLeads.aggregate).toHaveBeenCalledOnce();
      expect(mockLeads.countDocuments).toHaveBeenCalledTimes(2);
    });
  });

  // ---------------------------------------------------------------
  // 9. delete
  // ---------------------------------------------------------------
  describe('delete', () => {
    it('deletes the lead and returns success', async () => {
      const doc = buildLeadDoc({ _id: TEST_LEAD_ID });
      mockLeads.findOne.mockResolvedValue(doc);

      const result = await leadService.delete(TEST_TENANT_ID, TEST_LEAD_ID.toString());

      expect(mockLeads.deleteOne).toHaveBeenCalledWith({
        _id: new ObjectId(TEST_LEAD_ID.toString()),
      });
      expect(result).toEqual({ success: true });
    });

    it('throws LEAD_NOT_FOUND when trying to delete non-existent lead', async () => {
      mockLeads.findOne.mockResolvedValue(null);

      await expect(leadService.delete(TEST_TENANT_ID, new ObjectId().toString())).rejects.toThrow(
        ApiError
      );
    });
  });

  // ---------------------------------------------------------------
  // 10. formatLead (tested indirectly through findById)
  // ---------------------------------------------------------------
  describe('formatLead (via findById)', () => {
    it('stringifies all ObjectId fields including nested followup and stageHistory IDs', async () => {
      const followupId = new ObjectId();
      const completedById = new ObjectId();
      const doc = buildLeadDoc({
        _id: TEST_LEAD_ID,
        assignedTo: new ObjectId(),
        applicationId: new ObjectId(),
        stageHistory: [
          { stage: 'new', date: new Date(), changedBy: new ObjectId(), notes: 'Created' },
        ],
        followups: [
          {
            _id: followupId,
            date: new Date(),
            type: 'call',
            notes: 'Test call',
            createdBy: new ObjectId(),
            completedBy: completedById,
            completedAt: new Date(),
            outcome: 'interested',
          },
        ],
      });
      mockLeads.findOne.mockResolvedValue(doc);

      const result = await leadService.findById(TEST_TENANT_ID, TEST_LEAD_ID.toString());

      // Top-level ObjectId fields
      expect(typeof result._id).toBe('string');
      expect(typeof result.tenantId).toBe('string');
      expect(typeof result.branchId).toBe('string');
      expect(typeof result.assignedTo).toBe('string');
      expect(typeof result.applicationId).toBe('string');

      // Nested stageHistory
      expect(typeof result.stageHistory[0].changedBy).toBe('string');

      // Nested followups
      expect(typeof result.followups[0]._id).toBe('string');
      expect(typeof result.followups[0].createdBy).toBe('string');
      expect(typeof result.followups[0].completedBy).toBe('string');
      expect(result.followups[0]._id).toBe(followupId.toString());
    });
  });
});
