import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ObjectId } from 'mongodb';
import { createMockCollection } from '../helpers/setup';

const mockSlots = createMockCollection();
const mockEntries = createMockCollection();
const mockSections = createMockCollection();
const mockStaff = createMockCollection();

vi.mock('@/config/database', () => ({
  collections: {
    get timetableSlots() {
      return mockSlots;
    },
    get timetableEntries() {
      return mockEntries;
    },
    get sections() {
      return mockSections;
    },
    get staff() {
      return mockStaff;
    },
  },
  getDb: vi.fn(),
}));
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('@/modules/teaching/scope', () => ({
  getElectiveSubjectIds: vi.fn().mockResolvedValue(new Set()),
}));

import { timetableService } from '@/modules/teaching/timetable.service';

const chain = (docs: unknown[]) => ({
  project: vi.fn().mockReturnThis(),
  sort: vi.fn().mockReturnThis(),
  toArray: vi.fn().mockResolvedValue(docs),
});

const TENANT = new ObjectId().toString();
const BRANCH = new ObjectId().toString();
const SECTION = new ObjectId();
const A1 = new ObjectId();
const A2 = new ObjectId();
const DS_LAB = new ObjectId().toString();
const DBMS_LAB = new ObjectId().toString();
const T1 = new ObjectId().toString();
const T2 = new ObjectId().toString();

const entry = (rows: Array<Record<string, unknown>>) => ({
  sectionId: SECTION.toString(),
  slotId: new ObjectId().toString(),
  dayOfWeek: 2,
  subjects: rows.map((r) => ({ isMandatory: true, ...r })) as never,
});

beforeEach(() => {
  vi.clearAllMocks();
  mockSlots.findOne.mockResolvedValue({ startTime: '13:30', endTime: '14:20' });
  mockSlots.find.mockReturnValue(chain([]));
  mockEntries.find.mockReturnValue(chain([]));
  mockSections.findOne.mockResolvedValue({
    batches: [
      { _id: A1, name: 'A1' },
      { _id: A2, name: 'A2' },
    ],
  });
});

describe('lab batches in one period', () => {
  it('runs two batches in parallel labs (different teachers and rooms)', async () => {
    await timetableService.createEntry(
      TENANT,
      BRANCH,
      entry([
        { subjectId: DS_LAB, teacherId: T1, batchId: A1.toString(), roomNumber: 'Lab-1' },
        { subjectId: DBMS_LAB, teacherId: T2, batchId: A2.toString(), roomNumber: 'Lab-2' },
      ]),
      new ObjectId().toString()
    );
    expect(mockEntries.insertMany).toHaveBeenCalled();
  });

  it('refuses the same batch twice in one period', async () => {
    await expect(
      timetableService.createEntry(
        TENANT,
        BRANCH,
        entry([
          { subjectId: DS_LAB, teacherId: T1, batchId: A1.toString() },
          { subjectId: DBMS_LAB, teacherId: T2, batchId: A1.toString() },
        ]),
        new ObjectId().toString()
      )
    ).rejects.toMatchObject({ code: 'BATCH_CONFLICT' });
  });

  it('refuses a batch that is not part of the section', async () => {
    await expect(
      timetableService.createEntry(
        TENANT,
        BRANCH,
        entry([{ subjectId: DS_LAB, teacherId: T1, batchId: new ObjectId().toString() }]),
        new ObjectId().toString()
      )
    ).rejects.toMatchObject({ code: 'BATCH_NOT_FOUND' });
  });

  it('refuses one lab room for two different classes', async () => {
    await expect(
      timetableService.createEntry(
        TENANT,
        BRANCH,
        entry([
          { subjectId: DS_LAB, teacherId: T1, batchId: A1.toString(), roomNumber: 'Lab-1' },
          { subjectId: DBMS_LAB, teacherId: T2, batchId: A2.toString(), roomNumber: 'lab-1 ' },
        ]),
        new ObjectId().toString()
      )
    ).rejects.toMatchObject({ code: 'ROOM_CONFLICT' });
  });
});
