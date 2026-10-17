import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ObjectId } from 'mongodb';
import { createMockCollection } from '../helpers/setup';

const mockSlots = createMockCollection();
const mockEntries = createMockCollection();
const mockStaff = createMockCollection();

vi.mock('@/config/database', () => ({
  collections: {
    get timetableSlots() {
      return mockSlots;
    },
    get timetableEntries() {
      return mockEntries;
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

import { timetableService } from '@/modules/teaching/timetable.service';

const chain = (docs: unknown[]) => ({
  project: vi.fn().mockReturnThis(),
  sort: vi.fn().mockReturnThis(),
  toArray: vi.fn().mockResolvedValue(docs),
});

const TENANT = new ObjectId();
const CLASS = new ObjectId();
const P3 = {
  _id: new ObjectId(),
  tenantId: TENANT,
  branchId: new ObjectId(),
  classId: CLASS,
  sectionId: null,
  name: 'P3',
  startTime: '11:00',
  endTime: '11:50',
  type: 'period',
};

beforeEach(() => {
  vi.clearAllMocks();
  mockSlots.findOne.mockResolvedValue(P3);
});

describe('updateSlot — editing a period keeps the week conflict-free', () => {
  it('refuses a period that ends before it starts', async () => {
    await expect(
      timetableService.updateSlot(TENANT.toString(), P3._id.toString(), { endTime: '10:30' })
    ).rejects.toMatchObject({ code: 'INVALID_SLOT_TIME' });
  });

  it('refuses overlapping another period of the same year', async () => {
    mockSlots.find.mockReturnValueOnce(
      chain([{ _id: new ObjectId(), name: 'P4', startTime: '11:50', endTime: '12:40' }])
    );
    await expect(
      timetableService.updateSlot(TENANT.toString(), P3._id.toString(), { endTime: '12:10' })
    ).rejects.toMatchObject({ code: 'SLOT_OVERLAP' });
  });

  it('refuses moving it onto a time one of its teachers is teaching elsewhere', async () => {
    const teacher = new ObjectId();
    const elsewhere = new ObjectId();
    mockSlots.find
      .mockReturnValueOnce(chain([])) // no sibling overlap
      .mockReturnValueOnce(chain([{ _id: elsewhere, startTime: '11:30', endTime: '12:20' }]));
    mockEntries.find
      .mockReturnValueOnce(chain([{ teacherId: teacher, dayOfWeek: 1, subjectId: new ObjectId() }]))
      .mockReturnValueOnce(
        chain([{ teacherId: teacher, dayOfWeek: 1, subjectId: new ObjectId(), slotId: elsewhere }])
      );
    mockStaff.findOne.mockResolvedValue({ displayName: 'Swathi Iyer' });

    await expect(
      timetableService.updateSlot(TENANT.toString(), P3._id.toString(), {
        startTime: '11:20',
        endTime: '12:10',
      })
    ).rejects.toMatchObject({ code: 'SLOT_TEACHER_CONFLICT' });
  });

  it('allows a clean move', async () => {
    mockSlots.find.mockReturnValueOnce(chain([]));
    mockEntries.find.mockReturnValueOnce(chain([]));
    mockSlots.findOne
      .mockResolvedValueOnce(P3)
      .mockResolvedValueOnce({ ...P3, startTime: '11:05' });
    await timetableService.updateSlot(TENANT.toString(), P3._id.toString(), { startTime: '11:05' });
    expect(mockSlots.updateOne).toHaveBeenCalled();
  });
});
