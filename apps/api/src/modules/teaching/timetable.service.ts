import { ObjectId, WithId, Document } from 'mongodb';
import { collections } from '../../config/database';
import { logger } from '../../lib/logger';
import { ApiError } from '../../middleware/errorHandler';
import { getElectiveSubjectIds } from './scope';

interface SlotDocument extends Document {
  _id: ObjectId;
  tenantId: ObjectId;
  branchId: ObjectId;
  classId: ObjectId;
  sectionId?: ObjectId | null;
  name: string;
  startTime: string;
  endTime: string;
  type: 'period' | 'break' | 'lunch' | 'assembly';
  order: number;
  status: 'active' | 'inactive';
  createdAt: Date;
  updatedAt: Date;
}

interface EntryDocument extends Document {
  _id: ObjectId;
  tenantId: ObjectId;
  branchId: ObjectId;
  sectionId: ObjectId;
  subjectId: ObjectId;
  teacherId: ObjectId;
  slotId: ObjectId;
  dayOfWeek: number;
  /** Lab slot for a subset of the section (id from Section.batches). */
  batchId?: ObjectId;
  roomNumber?: string;
  notes?: string;
  groupId: string;
  isMandatory: boolean;
  studentIds?: ObjectId[];
  linkedSectionIds?: ObjectId[];
  createdBy: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

type SubjectRow = {
  subjectId: string;
  teacherId: string;
  batchId?: string;
  roomNumber?: string;
  isMandatory: boolean;
};

const overlaps = (
  a: { startTime: string; endTime: string },
  b: { startTime: string; endTime: string }
) => a.startTime < b.endTime && b.startTime < a.endTime;

/**
 * Clash rules, by time rather than by slot record (periods are created per
 * class, so two classes' "11:00" are different slot ids):
 * - a teacher cannot be in two places at once, except the same subject at the
 *   same time, which is one combined class (an open elective);
 * - a whole-section row (mandatory, not a lab batch, not an elective) cannot
 *   share its time with any other row of that section.
 */
async function assertNoClash(
  tenantObjId: ObjectId,
  branchId: string,
  sectionObjId: ObjectId,
  slotObjId: ObjectId,
  dayOfWeek: number,
  rows: SubjectRow[],
  excludeGroupId?: string
): Promise<void> {
  const slot = await collections.timetableSlots.findOne({ _id: slotObjId });
  if (!slot) throw new ApiError('SLOT_NOT_FOUND', 'Time slot not found', 404);
  const time = { startTime: slot.startTime as string, endTime: slot.endTime as string };
  const electives = await getElectiveSubjectIds(tenantObjId.toString(), branchId);
  const wholeSection = (r: { subjectId: unknown; batchId?: unknown; isMandatory?: boolean }) =>
    r.isMandatory !== false && !r.batchId && !electives.has(String(r.subjectId));

  const sameDay = await collections.timetableEntries
    .find({
      tenantId: tenantObjId,
      dayOfWeek,
      ...(excludeGroupId && { groupId: { $ne: excludeGroupId } }),
      $or: [
        { teacherId: { $in: rows.map((r) => new ObjectId(r.teacherId)) } },
        { sectionId: sectionObjId },
      ],
    })
    .toArray();
  const slotIds = [...new Set(sameDay.map((e) => String(e.slotId)))].map((id) => new ObjectId(id));
  const slots = new Map(
    (await collections.timetableSlots.find({ _id: { $in: slotIds } }).toArray()).map((x) => [
      String(x._id),
      { startTime: x.startTime as string, endTime: x.endTime as string },
    ])
  );
  const atSameTime = sameDay.filter((e) => {
    const other = slots.get(String(e.slotId));
    return other && overlaps(time, other);
  });

  for (const row of rows) {
    const clash = atSameTime.find(
      (e) => String(e.teacherId) === row.teacherId && String(e.subjectId) !== row.subjectId
    );
    if (clash) {
      const teacher = await collections.staff.findOne(
        { _id: new ObjectId(row.teacherId) },
        { projection: { displayName: 1, firstName: 1, lastName: 1 } }
      );
      const name =
        (teacher?.displayName as string) ||
        `${teacher?.firstName || ''} ${teacher?.lastName || ''}`.trim() ||
        'This teacher';
      throw new ApiError(
        'TEACHER_CONFLICT',
        `${name} already teaches another subject at ${time.startTime}-${time.endTime} on this day`,
        409
      );
    }
  }

  const sectionRows = atSameTime.filter((e) => String(e.sectionId) === String(sectionObjId));
  const all: Array<{ subjectId: unknown; batchId?: unknown; isMandatory?: boolean }> = [
    ...rows,
    ...sectionRows.map((e) => ({
      subjectId: e.subjectId,
      batchId: e.batchId,
      isMandatory: e.isMandatory as boolean | undefined,
    })),
  ];
  if (all.length > 1 && all.some(wholeSection)) {
    throw new ApiError(
      'SECTION_CONFLICT',
      'A subject for the whole section cannot share its period with other subjects; mark parallel subjects as electives or lab batches',
      409
    );
  }

  // Lab batches: each must be one of this section's, and a batch can only be
  // in one place at a time.
  const batchRows = rows.filter((r) => r.batchId);
  if (batchRows.length) {
    const section = await collections.sections.findOne(
      { _id: sectionObjId },
      { projection: { batches: 1 } }
    );
    const names = new Map(
      ((section?.batches ?? []) as Array<{ _id: ObjectId; name: string }>).map((b) => [
        String(b._id),
        b.name,
      ])
    );
    const seen = new Set<string>();
    for (const r of batchRows) {
      const id = String(r.batchId);
      if (!names.has(id)) {
        throw new ApiError('BATCH_NOT_FOUND', 'That lab batch is not part of this section', 400);
      }
      const elsewhere = sectionRows.some((e) => e.batchId && String(e.batchId) === id);
      if (seen.has(id) || elsewhere) {
        throw new ApiError(
          'BATCH_CONFLICT',
          `Batch ${names.get(id)} already has a lab at ${time.startTime}-${time.endTime} on this day`,
          409
        );
      }
      seen.add(id);
    }
  }

  // A room (e.g. a lab) holds one class at a time — except the same subject,
  // which is one combined class.
  const norm = (v?: unknown) =>
    String(v ?? '')
      .trim()
      .toLowerCase();
  const rooms = rows.filter((r) => norm(r.roomNumber));
  for (const [i, r] of rooms.entries()) {
    if (
      rooms.some(
        (o, j) => j < i && norm(o.roomNumber) === norm(r.roomNumber) && o.subjectId !== r.subjectId
      )
    ) {
      throw new ApiError(
        'ROOM_CONFLICT',
        `${r.roomNumber} can't hold two classes in the same period`,
        409
      );
    }
  }
  if (rooms.length) {
    const roomSet = new Set(rooms.map((r) => norm(r.roomNumber)));
    const sameRoom = await collections.timetableEntries
      .find({
        tenantId: tenantObjId,
        branchId: new ObjectId(branchId),
        dayOfWeek,
        roomNumber: { $exists: true, $nin: [null, ''] },
        ...(excludeGroupId && { groupId: { $ne: excludeGroupId } }),
      })
      .project({ roomNumber: 1, slotId: 1, subjectId: 1, sectionId: 1 })
      .toArray();
    const candidates = sameRoom.filter((e) => roomSet.has(norm(e.roomNumber)));
    if (candidates.length) {
      const roomSlots = new Map(
        (
          await collections.timetableSlots
            .find({
              _id: {
                $in: [...new Set(candidates.map((e) => String(e.slotId)))].map(
                  (id) => new ObjectId(id)
                ),
              },
            })
            .project({ startTime: 1, endTime: 1 })
            .toArray()
        ).map((x) => [String(x._id), x as unknown as { startTime: string; endTime: string }])
      );
      for (const r of rooms) {
        const taken = candidates.find(
          (e) =>
            norm(e.roomNumber) === norm(r.roomNumber) &&
            String(e.subjectId) !== r.subjectId &&
            overlaps(time, roomSlots.get(String(e.slotId)) ?? { startTime: '', endTime: '' })
        );
        if (taken) {
          throw new ApiError(
            'ROOM_CONFLICT',
            `${r.roomNumber} is already booked at ${time.startTime}-${time.endTime} on this day`,
            409
          );
        }
      }
    }
  }
}

class TimetableService {
  // ============ Slots ============

  async createSlot(
    tenantId: string,
    branchId: string,
    data: {
      classId: string;
      sectionId?: string;
      name: string;
      startTime: string;
      endTime: string;
      type: string;
      order: number;
    }
  ) {
    const slotId = new ObjectId();
    const now = new Date();

    const slot: Omit<SlotDocument, '_id'> & { _id: ObjectId } = {
      _id: slotId,
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
      classId: new ObjectId(data.classId),
      sectionId: data.sectionId ? new ObjectId(data.sectionId) : null,
      name: data.name,
      startTime: data.startTime,
      endTime: data.endTime,
      type: data.type as SlotDocument['type'],
      order: data.order,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    };

    await collections.timetableSlots.insertOne(slot);

    logger.info(
      { slotId: slotId.toString(), tenantId, branchId, classId: data.classId },
      'Timetable slot created'
    );

    return this.formatSlot(slot as WithId<SlotDocument>);
  }

  async getSlots(tenantId: string, branchId: string, classId?: string) {
    const filter: Record<string, unknown> = {
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
    };
    if (classId) {
      filter.classId = new ObjectId(classId);
    }

    const slots = (await collections.timetableSlots
      .find(filter)
      .sort({ order: 1 })
      .toArray()) as WithId<SlotDocument>[];

    return slots.map((slot) => this.formatSlot(slot));
  }

  async copySlots(
    tenantId: string,
    branchId: string,
    sourceClassId: string,
    targetClassId: string
  ) {
    const tenantObjId = new ObjectId(tenantId);
    const branchObjId = new ObjectId(branchId);
    const targetClassObjId = new ObjectId(targetClassId);

    // Check target class doesn't already have slots
    const existingCount = await collections.timetableSlots.countDocuments({
      tenantId: tenantObjId,
      branchId: branchObjId,
      classId: targetClassObjId,
    });

    if (existingCount > 0) {
      throw new ApiError(
        'SLOTS_EXIST',
        'Target class already has slots defined. Delete them first to copy.',
        409
      );
    }

    const sourceSlots = (await collections.timetableSlots
      .find({
        tenantId: tenantObjId,
        branchId: branchObjId,
        classId: new ObjectId(sourceClassId),
        $or: [{ sectionId: null }, { sectionId: { $exists: false } }],
      })
      .sort({ order: 1 })
      .toArray()) as WithId<SlotDocument>[];

    if (sourceSlots.length === 0) {
      throw new ApiError('NO_SOURCE_SLOTS', 'Source class has no slots to copy', 404);
    }

    const now = new Date();
    const newSlots = sourceSlots.map((s) => ({
      _id: new ObjectId(),
      tenantId: tenantObjId,
      branchId: branchObjId,
      classId: targetClassObjId,
      sectionId: null,
      name: s.name,
      startTime: s.startTime,
      endTime: s.endTime,
      type: s.type,
      order: s.order,
      status: 'active' as const,
      createdAt: now,
      updatedAt: now,
    }));

    await collections.timetableSlots.insertMany(newSlots);

    logger.info(
      { sourceClassId, targetClassId, count: newSlots.length, tenantId },
      'Timetable slots copied'
    );

    return newSlots.map((s) => this.formatSlot(s as unknown as WithId<SlotDocument>));
  }

  async updateSlot(
    tenantId: string,
    slotId: string,
    data: {
      name?: string;
      startTime?: string;
      endTime?: string;
      type?: string;
      order?: number;
      status?: string;
      sectionId?: string | null;
    }
  ) {
    const existing = await collections.timetableSlots.findOne({
      _id: new ObjectId(slotId),
      tenantId: new ObjectId(tenantId),
    });

    if (!existing) {
      throw new ApiError('SLOT_NOT_FOUND', 'Timetable slot not found', 404);
    }

    const time = {
      startTime: data.startTime ?? (existing.startTime as string),
      endTime: data.endTime ?? (existing.endTime as string),
    };
    if (time.startTime >= time.endTime) {
      throw new ApiError('INVALID_SLOT_TIME', 'A period must end after it starts', 400);
    }
    const timeChanged = time.startTime !== existing.startTime || time.endTime !== existing.endTime;
    if (timeChanged) await this.assertSlotTimeFree(existing as WithId<SlotDocument>, time);
    if (data.type && data.type !== 'period' && existing.type === 'period') {
      const inUse = await collections.timetableEntries.countDocuments({
        tenantId: existing.tenantId,
        slotId: existing._id,
      });
      if (inUse) {
        throw new ApiError(
          'SLOT_IN_USE',
          `${existing.name} has ${inUse} class${inUse === 1 ? '' : 'es'} booked — clear them before making it a ${data.type}`,
          409
        );
      }
    }

    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (data.name !== undefined) updateData.name = data.name;
    if (data.startTime !== undefined) updateData.startTime = data.startTime;
    if (data.endTime !== undefined) updateData.endTime = data.endTime;
    if (data.type !== undefined) updateData.type = data.type;
    if (data.order !== undefined) updateData.order = data.order;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.sectionId === null) updateData.sectionId = null;
    else if (data.sectionId !== undefined) updateData.sectionId = new ObjectId(data.sectionId);

    await collections.timetableSlots.updateOne({ _id: new ObjectId(slotId) }, { $set: updateData });

    logger.info({ slotId, tenantId }, 'Timetable slot updated');

    const updated = (await collections.timetableSlots.findOne({
      _id: new ObjectId(slotId),
    })) as WithId<SlotDocument>;

    return this.formatSlot(updated);
  }

  /**
   * Moving a period to new times must not overlap the year's other periods,
   * nor put any of its teachers in two places at once on any day.
   */
  private async assertSlotTimeFree(
    slot: WithId<SlotDocument>,
    time: { startTime: string; endTime: string }
  ) {
    const siblings = await collections.timetableSlots
      .find({
        tenantId: slot.tenantId,
        classId: slot.classId,
        _id: { $ne: slot._id },
        status: { $ne: 'inactive' },
        $or: [
          { sectionId: null },
          { sectionId: { $exists: false } },
          ...(slot.sectionId ? [{ sectionId: slot.sectionId }] : []),
        ],
      })
      .toArray();
    const hit = siblings.find((x) =>
      overlaps(time, x as unknown as { startTime: string; endTime: string })
    );
    if (hit) {
      throw new ApiError(
        'SLOT_OVERLAP',
        `${time.startTime}–${time.endTime} overlaps ${hit.name} (${hit.startTime}–${hit.endTime}) of the same year`,
        409
      );
    }

    const mine = await collections.timetableEntries
      .find({ tenantId: slot.tenantId, slotId: slot._id })
      .project({ teacherId: 1, dayOfWeek: 1, subjectId: 1 })
      .toArray();
    if (!mine.length) return;
    const others = await collections.timetableEntries
      .find({
        tenantId: slot.tenantId,
        slotId: { $ne: slot._id },
        teacherId: {
          $in: [...new Set(mine.map((e) => String(e.teacherId)))].map((id) => new ObjectId(id)),
        },
      })
      .project({ teacherId: 1, dayOfWeek: 1, subjectId: 1, slotId: 1 })
      .toArray();
    if (!others.length) return;
    const otherSlots = new Map(
      (
        await collections.timetableSlots
          .find({
            _id: {
              $in: [...new Set(others.map((e) => String(e.slotId)))].map((id) => new ObjectId(id)),
            },
          })
          .project({ startTime: 1, endTime: 1 })
          .toArray()
      ).map((x) => [String(x._id), x as unknown as { startTime: string; endTime: string }])
    );
    const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const clashes: string[] = [];
    for (const e of mine) {
      const clash = others.find(
        (o) =>
          String(o.teacherId) === String(e.teacherId) &&
          o.dayOfWeek === e.dayOfWeek &&
          String(o.subjectId) !== String(e.subjectId) &&
          overlaps(time, otherSlots.get(String(o.slotId)) ?? { startTime: '', endTime: '' })
      );
      if (clash) {
        const t = await collections.staff.findOne(
          { _id: e.teacherId as ObjectId },
          { projection: { displayName: 1, firstName: 1, lastName: 1 } }
        );
        const name =
          (t?.displayName as string) || `${t?.firstName ?? ''} ${t?.lastName ?? ''}`.trim();
        clashes.push(`${name || 'A teacher'} on ${DAY[e.dayOfWeek as number]}`);
      }
    }
    if (clashes.length) {
      throw new ApiError(
        'SLOT_TEACHER_CONFLICT',
        `Moving ${slot.name} to ${time.startTime}–${time.endTime} would double-book ${[...new Set(clashes)].slice(0, 3).join(', ')}${clashes.length > 3 ? ' and others' : ''}. Move those classes first.`,
        409
      );
    }
  }

  /** Empty one section's week. Its periods (time slots) stay for next time. */
  async clearSectionTimetable(tenantId: string, branchId: string, sectionId: string) {
    const result = await collections.timetableEntries.deleteMany({
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
      sectionId: new ObjectId(sectionId),
    });
    logger.info({ tenantId, sectionId, deleted: result.deletedCount }, 'Section timetable cleared');
    return { deleted: result.deletedCount };
  }

  async deleteSlot(tenantId: string, slotId: string) {
    const existing = await collections.timetableSlots.findOne({
      _id: new ObjectId(slotId),
      tenantId: new ObjectId(tenantId),
    });

    if (!existing) {
      throw new ApiError('SLOT_NOT_FOUND', 'Timetable slot not found', 404);
    }

    // Check if any timetable entries reference this slot
    const entryCount = await collections.timetableEntries.countDocuments({
      slotId: new ObjectId(slotId),
      tenantId: new ObjectId(tenantId),
    });

    if (entryCount > 0) {
      throw new ApiError(
        'SLOT_IN_USE',
        `${existing.name} is used by ${entryCount} class${entryCount === 1 ? '' : 'es'} in the timetable. Clear those first.`,
        400
      );
    }

    await collections.timetableSlots.deleteOne({ _id: new ObjectId(slotId) });

    logger.info({ slotId, tenantId }, 'Timetable slot deleted');

    return { success: true };
  }

  // ============ Entries ============

  async createEntry(
    tenantId: string,
    branchId: string,
    data: {
      sectionId: string;
      slotId: string;
      dayOfWeek: number;
      subjects: Array<{
        subjectId: string;
        teacherId: string;
        batchId?: string;
        roomNumber?: string;
        notes?: string;
        isMandatory: boolean;
        studentIds?: string[];
        linkedSectionIds?: string[];
      }>;
    },
    createdBy: string
  ) {
    const tenantObjId = new ObjectId(tenantId);
    const branchObjId = new ObjectId(branchId);
    const slotObjId = new ObjectId(data.slotId);
    const sectionObjId = new ObjectId(data.sectionId);
    const createdByObjId = new ObjectId(createdBy);
    const groupId = new ObjectId().toString();
    const now = new Date();

    // Collect all unique linked section IDs across all subjects (for conflict checking)
    const allLinkedSectionIds = new Set<string>();
    for (const sub of data.subjects) {
      for (const id of sub.linkedSectionIds || []) {
        allLinkedSectionIds.add(id);
      }
    }

    await assertNoClash(
      tenantObjId,
      branchId,
      sectionObjId,
      slotObjId,
      data.dayOfWeek,
      data.subjects
    );

    // Check batch-internal teacher conflicts (same teacher in multiple subject rows)
    const teacherIdsInBatch = data.subjects.map((s) => s.teacherId);
    const uniqueTeachers = new Set(teacherIdsInBatch);
    if (uniqueTeachers.size !== teacherIdsInBatch.length) {
      throw new ApiError(
        'DUPLICATE_TEACHER',
        'The same teacher cannot be assigned to multiple subjects in the same period',
        409
      );
    }

    // Build entries (per-subject linkedSectionIds)
    const entries = data.subjects.map((sub) => {
      const subLinkedIds = (sub.linkedSectionIds || []).map((id) => new ObjectId(id));
      return {
        _id: new ObjectId(),
        tenantId: tenantObjId,
        branchId: branchObjId,
        sectionId: sectionObjId,
        subjectId: new ObjectId(sub.subjectId),
        teacherId: new ObjectId(sub.teacherId),
        ...(sub.batchId && { batchId: new ObjectId(sub.batchId) }),
        slotId: slotObjId,
        dayOfWeek: data.dayOfWeek,
        roomNumber: sub.roomNumber,
        notes: sub.notes,
        groupId,
        isMandatory: sub.isMandatory,
        studentIds: sub.isMandatory
          ? undefined
          : (sub.studentIds || []).map((id) => new ObjectId(id)),
        linkedSectionIds: subLinkedIds.length > 0 ? subLinkedIds : undefined,
        createdBy: createdByObjId,
        createdAt: now,
        updatedAt: now,
      };
    });

    await collections.timetableEntries.insertMany(entries);

    logger.info(
      { groupId, count: entries.length, tenantId, branchId },
      'Timetable group entries created'
    );

    return entries.map((e) => this.formatEntry(e as unknown as WithId<EntryDocument>));
  }

  async updateGroup(
    tenantId: string,
    groupId: string,
    data: {
      subjects: Array<{
        entryId?: string;
        subjectId: string;
        teacherId: string;
        batchId?: string;
        roomNumber?: string;
        notes?: string;
        isMandatory: boolean;
        studentIds?: string[];
        linkedSectionIds?: string[];
      }>;
    }
  ) {
    const tenantObjId = new ObjectId(tenantId);

    // Fetch existing entries in this group
    const existingEntries = await collections.timetableEntries
      .find({ tenantId: tenantObjId, groupId })
      .toArray();

    if (existingEntries.length === 0) {
      throw new ApiError('GROUP_NOT_FOUND', 'Timetable group not found', 404);
    }

    const refEntry = existingEntries[0];
    const slotObjId = refEntry.slotId as ObjectId;
    const sectionObjId = refEntry.sectionId as ObjectId;
    const dayOfWeek = refEntry.dayOfWeek as number;
    const now = new Date();

    // Check teacher conflicts for new/changed teachers
    const existingEntryIds = new Set(existingEntries.map((e) => (e._id as ObjectId).toString()));

    await assertNoClash(
      tenantObjId,
      String(refEntry.branchId),
      sectionObjId,
      slotObjId,
      dayOfWeek,
      data.subjects,
      groupId
    );

    // Check batch-internal teacher duplicates
    const teacherIdsInBatch = data.subjects.map((s) => s.teacherId);
    const uniqueTeachers = new Set(teacherIdsInBatch);
    if (uniqueTeachers.size !== teacherIdsInBatch.length) {
      throw new ApiError(
        'DUPLICATE_TEACHER',
        'The same teacher cannot be assigned to multiple subjects in the same period',
        409
      );
    }

    // Determine which entries to update, insert, delete
    const incomingEntryIds = new Set(data.subjects.filter((s) => s.entryId).map((s) => s.entryId!));
    const entriesToDelete = existingEntries.filter(
      (e) => !incomingEntryIds.has((e._id as ObjectId).toString())
    );

    // Delete removed entries
    if (entriesToDelete.length > 0) {
      await collections.timetableEntries.deleteMany({
        _id: { $in: entriesToDelete.map((e) => e._id as ObjectId) },
      });
    }

    // Update existing + insert new (per-subject linkedSectionIds)
    for (const sub of data.subjects) {
      const subLinkedIds = (sub.linkedSectionIds || []).map((id) => new ObjectId(id));
      const entryData = {
        subjectId: new ObjectId(sub.subjectId),
        teacherId: new ObjectId(sub.teacherId),
        batchId: sub.batchId ? new ObjectId(sub.batchId) : undefined,
        roomNumber: sub.roomNumber,
        notes: sub.notes,
        isMandatory: sub.isMandatory,
        studentIds: sub.isMandatory
          ? undefined
          : (sub.studentIds || []).map((id) => new ObjectId(id)),
        linkedSectionIds: subLinkedIds.length > 0 ? subLinkedIds : undefined,
        updatedAt: now,
      };

      if (sub.entryId && existingEntryIds.has(sub.entryId)) {
        // Update existing
        await collections.timetableEntries.updateOne(
          { _id: new ObjectId(sub.entryId) },
          { $set: entryData }
        );
      } else {
        // Insert new entry in same group
        await collections.timetableEntries.insertOne({
          _id: new ObjectId(),
          tenantId: tenantObjId,
          branchId: refEntry.branchId as ObjectId,
          sectionId: sectionObjId,
          slotId: slotObjId,
          dayOfWeek,
          groupId,
          createdBy: refEntry.createdBy as ObjectId,
          createdAt: now,
          ...entryData,
        });
      }
    }

    logger.info({ groupId, tenantId }, 'Timetable group updated');

    // Return updated group
    const updatedEntries = (await collections.timetableEntries
      .find({ tenantId: tenantObjId, groupId })
      .toArray()) as WithId<EntryDocument>[];

    return updatedEntries.map((e) => this.formatEntry(e));
  }

  async deleteGroup(tenantId: string, groupId: string) {
    const tenantObjId = new ObjectId(tenantId);

    const count = await collections.timetableEntries.countDocuments({
      tenantId: tenantObjId,
      groupId,
    });

    if (count === 0) {
      throw new ApiError('GROUP_NOT_FOUND', 'Timetable group not found', 404);
    }

    await collections.timetableEntries.deleteMany({ tenantId: tenantObjId, groupId });

    logger.info({ groupId, tenantId, deletedCount: count }, 'Timetable group deleted');

    return { success: true, deletedCount: count };
  }

  async bulkCreateEntries(
    tenantId: string,
    branchId: string,
    entries: Array<{
      sectionId: string;
      subjectId: string;
      teacherId: string;
      slotId: string;
      dayOfWeek: number;
      roomNumber?: string;
      notes?: string;
    }>,
    createdBy: string
  ) {
    const tenantObjId = new ObjectId(tenantId);
    const branchObjId = new ObjectId(branchId);
    const createdByObjId = new ObjectId(createdBy);
    const now = new Date();

    const conflicts: Array<{ index: number; type: string; message: string }> = [];
    const validEntries: Array<Record<string, unknown>> = [];

    for (let i = 0; i < entries.length; i++) {
      const data = entries[i];
      const slotObjId = new ObjectId(data.slotId);
      const teacherObjId = new ObjectId(data.teacherId);

      // Check teacher conflict
      const teacherConflict = await collections.timetableEntries.findOne({
        tenantId: tenantObjId,
        teacherId: teacherObjId,
        slotId: slotObjId,
        dayOfWeek: data.dayOfWeek,
      });

      if (teacherConflict) {
        conflicts.push({
          index: i,
          type: 'TEACHER_CONFLICT',
          message: `Teacher conflict at day ${data.dayOfWeek}, slot ${data.slotId}`,
        });
        continue;
      }

      // Check batch-internal teacher conflict
      const batchConflict = validEntries.some(
        (ve) =>
          (ve.teacherId as ObjectId).equals(teacherObjId) &&
          (ve.slotId as ObjectId).equals(slotObjId) &&
          ve.dayOfWeek === data.dayOfWeek
      );

      if (batchConflict) {
        conflicts.push({
          index: i,
          type: 'BATCH_CONFLICT',
          message: `Conflict with another entry in the same batch at day ${data.dayOfWeek}, slot ${data.slotId}`,
        });
        continue;
      }

      validEntries.push({
        _id: new ObjectId(),
        tenantId: tenantObjId,
        branchId: branchObjId,
        sectionId: new ObjectId(data.sectionId),
        subjectId: new ObjectId(data.subjectId),
        teacherId: teacherObjId,
        slotId: slotObjId,
        dayOfWeek: data.dayOfWeek,
        roomNumber: data.roomNumber,
        notes: data.notes,
        groupId: new ObjectId().toString(),
        isMandatory: true,
        createdBy: createdByObjId,
        createdAt: now,
        updatedAt: now,
      });
    }

    let inserted: Array<ReturnType<typeof this.formatEntry>> = [];
    if (validEntries.length > 0) {
      await collections.timetableEntries.insertMany(validEntries);
      inserted = validEntries.map((e) => this.formatEntry(e as unknown as WithId<EntryDocument>));
    }

    logger.info(
      {
        tenantId,
        branchId,
        total: entries.length,
        inserted: validEntries.length,
        conflicts: conflicts.length,
      },
      'Bulk timetable entries created'
    );

    return {
      inserted,
      conflicts,
      summary: {
        total: entries.length,
        inserted: validEntries.length,
        conflicted: conflicts.length,
      },
    };
  }

  async getSectionTimetable(tenantId: string, branchId: string, sectionId: string) {
    const tenantObjId = new ObjectId(tenantId);
    const branchObjId = new ObjectId(branchId);
    const sectionObjId = new ObjectId(sectionId);

    const entries = await collections.timetableEntries
      .find({
        tenantId: tenantObjId,
        branchId: branchObjId,
        $or: [{ sectionId: sectionObjId }, { linkedSectionIds: sectionObjId }],
      })
      .toArray();

    if (entries.length === 0) {
      return [];
    }

    // Gather IDs for lookups
    const slotIds = [...new Set(entries.map((e) => (e.slotId as ObjectId).toString()))];
    const subjectIds = [...new Set(entries.map((e) => (e.subjectId as ObjectId).toString()))];
    const teacherIds = [...new Set(entries.map((e) => (e.teacherId as ObjectId).toString()))];

    // Parallel lookups
    const [slots, subjects, teachers] = await Promise.all([
      collections.timetableSlots
        .find({ _id: { $in: slotIds.map((id) => new ObjectId(id)) } })
        .project({ _id: 1, name: 1, startTime: 1, endTime: 1, order: 1, type: 1 })
        .toArray(),
      collections.subjects
        .find({ _id: { $in: subjectIds.map((id) => new ObjectId(id)) } })
        .project({ _id: 1, name: 1, code: 1 })
        .toArray(),
      collections.staff
        .find({ _id: { $in: teacherIds.map((id) => new ObjectId(id)) } })
        .project({ _id: 1, firstName: 1, lastName: 1, displayName: 1 })
        .toArray(),
    ]);

    // Get student count for the section (for mandatory subjects)
    const sectionStudentCount = await collections.students.countDocuments({
      tenantId: tenantObjId,
      'currentEnrollment.sectionId': sectionObjId,
      status: 'active',
    });

    const slotMap = new Map(slots.map((s) => [(s._id as ObjectId).toString(), s]));
    const subjectMap = new Map(subjects.map((s) => [(s._id as ObjectId).toString(), s]));
    const teacherMap = new Map(teachers.map((t) => [(t._id as ObjectId).toString(), t]));
    const sectionDoc = await collections.sections.findOne(
      { _id: sectionObjId },
      { projection: { batches: 1 } }
    );
    const batchName = new Map(
      ((sectionDoc?.batches ?? []) as Array<{ _id: ObjectId; name: string }>).map((b) => [
        String(b._id),
        b.name,
      ])
    );

    return entries.map((entry) => {
      const slot = slotMap.get((entry.slotId as ObjectId).toString());
      const subject = subjectMap.get((entry.subjectId as ObjectId).toString());
      const teacher = teacherMap.get((entry.teacherId as ObjectId).toString());
      const isLinked = !(entry.sectionId as ObjectId).equals(sectionObjId);
      const isMandatory = entry.isMandatory !== false;
      const studentIds = (entry.studentIds as ObjectId[] | undefined) || [];

      return {
        _id: (entry._id as ObjectId).toString(),
        tenantId: (entry.tenantId as ObjectId).toString(),
        branchId: (entry.branchId as ObjectId).toString(),
        sectionId: (entry.sectionId as ObjectId).toString(),
        subjectId: (entry.subjectId as ObjectId).toString(),
        subjectName: (subject?.name as string) || '',
        subjectCode: (subject?.code as string) || '',
        teacherId: (entry.teacherId as ObjectId).toString(),
        teacherName:
          (teacher?.displayName as string) ||
          `${teacher?.firstName || ''} ${teacher?.lastName || ''}`.trim(),
        slotId: (entry.slotId as ObjectId).toString(),
        slotName: (slot?.name as string) || '',
        startTime: slot?.startTime || '',
        endTime: slot?.endTime || '',
        slotOrder: (slot?.order as number) || 0,
        slotType: (slot?.type as string) || '',
        dayOfWeek: entry.dayOfWeek,
        batchId: (entry.batchId as ObjectId | undefined)?.toString(),
        batchName: entry.batchId ? (batchName.get(String(entry.batchId)) ?? null) : null,
        roomNumber: entry.roomNumber,
        notes: entry.notes,
        groupId: (entry.groupId as string) || (entry._id as ObjectId).toString(),
        isMandatory,
        studentCount: isMandatory ? sectionStudentCount : studentIds.length,
        totalStudents: sectionStudentCount,
        studentIds: studentIds.map((id) => id.toString()),
        isLinked,
        linkedSectionIds: ((entry.linkedSectionIds as ObjectId[] | undefined) || []).map((id) =>
          id.toString()
        ),
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt,
      };
    });
  }

  async getMyTimetable(tenantId: string, branchId: string, staffId: string) {
    const tenantObjId = new ObjectId(tenantId);
    const staffObjId = new ObjectId(staffId);

    const entries = await collections.timetableEntries
      .find({
        tenantId: tenantObjId,
        branchId: new ObjectId(branchId),
        teacherId: staffObjId,
      })
      .toArray();

    if (entries.length === 0) {
      return [];
    }

    // Gather IDs for lookups
    const slotIds = [...new Set(entries.map((e) => (e.slotId as ObjectId).toString()))];
    const subjectIds = [...new Set(entries.map((e) => (e.subjectId as ObjectId).toString()))];
    const sectionIds = [...new Set(entries.map((e) => (e.sectionId as ObjectId).toString()))];

    // Parallel lookups
    const [slots, subjects, sections] = await Promise.all([
      collections.timetableSlots
        .find({ _id: { $in: slotIds.map((id) => new ObjectId(id)) } })
        .project({ _id: 1, name: 1, startTime: 1, endTime: 1, order: 1, type: 1 })
        .toArray(),
      collections.subjects
        .find({ _id: { $in: subjectIds.map((id) => new ObjectId(id)) } })
        .project({ _id: 1, name: 1, code: 1 })
        .toArray(),
      collections.sections
        .find({ _id: { $in: sectionIds.map((id) => new ObjectId(id)) } })
        .project({ _id: 1, name: 1, classId: 1, batches: 1 })
        .toArray(),
    ]);

    // Also look up class names for sections
    const classIds = [...new Set(sections.map((s) => (s.classId as ObjectId).toString()))];
    const classes =
      classIds.length > 0
        ? await collections.classes
            .find({ _id: { $in: classIds.map((id) => new ObjectId(id)) } })
            .project({ _id: 1, displayName: 1 })
            .toArray()
        : [];

    const slotMap = new Map(slots.map((s) => [(s._id as ObjectId).toString(), s]));
    const subjectMap = new Map(subjects.map((s) => [(s._id as ObjectId).toString(), s]));
    const sectionMap = new Map(sections.map((s) => [(s._id as ObjectId).toString(), s]));
    const classMap = new Map(classes.map((c) => [(c._id as ObjectId).toString(), c]));

    return entries.map((entry) => {
      const slot = slotMap.get((entry.slotId as ObjectId).toString());
      const subject = subjectMap.get((entry.subjectId as ObjectId).toString());
      const section = sectionMap.get((entry.sectionId as ObjectId).toString());
      const classDoc = section ? classMap.get((section.classId as ObjectId).toString()) : null;
      const isMandatory = entry.isMandatory !== false;
      const studentIds = (entry.studentIds as ObjectId[] | undefined) || [];

      return {
        _id: (entry._id as ObjectId).toString(),
        tenantId: (entry.tenantId as ObjectId).toString(),
        branchId: (entry.branchId as ObjectId).toString(),
        sectionId: (entry.sectionId as ObjectId).toString(),
        sectionName: (section?.name as string) || '',
        classId: section ? (section.classId as ObjectId).toString() : '',
        className: (classDoc?.displayName as string) || '',
        subjectId: (entry.subjectId as ObjectId).toString(),
        subjectName: (subject?.name as string) || '',
        subjectCode: (subject?.code as string) || '',
        teacherId: (entry.teacherId as ObjectId).toString(),
        slotId: (entry.slotId as ObjectId).toString(),
        slotName: (slot?.name as string) || '',
        startTime: slot?.startTime || '',
        endTime: slot?.endTime || '',
        slotOrder: (slot?.order as number) || 0,
        slotType: (slot?.type as string) || '',
        dayOfWeek: entry.dayOfWeek,
        batchId: (entry.batchId as ObjectId | undefined)?.toString(),
        batchName: entry.batchId
          ? (((section?.batches ?? []) as Array<{ _id: ObjectId; name: string }>).find(
              (b) => String(b._id) === String(entry.batchId)
            )?.name ?? null)
          : null,
        roomNumber: entry.roomNumber,
        notes: entry.notes,
        groupId: (entry.groupId as string) || (entry._id as ObjectId).toString(),
        isMandatory,
        studentCount: isMandatory ? 0 : studentIds.length,
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt,
      };
    });
  }

  async updateEntry(
    tenantId: string,
    entryId: string,
    data: {
      subjectId?: string;
      teacherId?: string;
      slotId?: string;
      dayOfWeek?: number;
      roomNumber?: string;
      notes?: string;
    }
  ) {
    const tenantObjId = new ObjectId(tenantId);
    const entryObjId = new ObjectId(entryId);

    const existing = (await collections.timetableEntries.findOne({
      _id: entryObjId,
      tenantId: tenantObjId,
    })) as WithId<EntryDocument> | null;

    if (!existing) {
      throw new ApiError('ENTRY_NOT_FOUND', 'Timetable entry not found', 404);
    }

    // If changing teacher, slot, or day, check for conflicts
    const effectiveTeacherId = data.teacherId ? new ObjectId(data.teacherId) : existing.teacherId;
    const effectiveSlotId = data.slotId ? new ObjectId(data.slotId) : existing.slotId;
    const effectiveDay = data.dayOfWeek !== undefined ? data.dayOfWeek : existing.dayOfWeek;

    if (data.teacherId || data.slotId || data.dayOfWeek !== undefined) {
      const teacherConflict = await collections.timetableEntries.findOne({
        tenantId: tenantObjId,
        teacherId: effectiveTeacherId,
        slotId: effectiveSlotId,
        dayOfWeek: effectiveDay,
        _id: { $ne: entryObjId },
        groupId: { $ne: existing.groupId },
      });

      if (teacherConflict) {
        throw new ApiError(
          'TEACHER_CONFLICT',
          'This teacher is already assigned to another class at this time slot',
          409
        );
      }
    }

    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (data.subjectId !== undefined) updateData.subjectId = new ObjectId(data.subjectId);
    if (data.teacherId !== undefined) updateData.teacherId = new ObjectId(data.teacherId);
    if (data.slotId !== undefined) updateData.slotId = new ObjectId(data.slotId);
    if (data.dayOfWeek !== undefined) updateData.dayOfWeek = data.dayOfWeek;
    if (data.roomNumber !== undefined) updateData.roomNumber = data.roomNumber;
    if (data.notes !== undefined) updateData.notes = data.notes;

    await collections.timetableEntries.updateOne({ _id: entryObjId }, { $set: updateData });

    logger.info({ entryId, tenantId }, 'Timetable entry updated');

    const updated = (await collections.timetableEntries.findOne({
      _id: entryObjId,
    })) as WithId<EntryDocument>;

    return this.formatEntry(updated);
  }

  async deleteEntry(tenantId: string, entryId: string) {
    const existing = await collections.timetableEntries.findOne({
      _id: new ObjectId(entryId),
      tenantId: new ObjectId(tenantId),
    });

    if (!existing) {
      throw new ApiError('ENTRY_NOT_FOUND', 'Timetable entry not found', 404);
    }

    await collections.timetableEntries.deleteOne({ _id: new ObjectId(entryId) });

    logger.info({ entryId, tenantId }, 'Timetable entry deleted');

    return { success: true };
  }

  // ============ Formatters ============

  private formatSlot(slot: WithId<SlotDocument>) {
    return {
      _id: slot._id.toString(),
      tenantId: slot.tenantId.toString(),
      branchId: slot.branchId.toString(),
      classId: slot.classId?.toString() || '',
      sectionId: slot.sectionId?.toString() || null,
      name: slot.name,
      startTime: slot.startTime,
      endTime: slot.endTime,
      type: slot.type,
      order: slot.order,
      status: slot.status,
      createdAt: slot.createdAt,
      updatedAt: slot.updatedAt,
    };
  }

  private formatEntry(entry: WithId<EntryDocument>) {
    return {
      _id: entry._id.toString(),
      tenantId: entry.tenantId.toString(),
      branchId: entry.branchId.toString(),
      sectionId: entry.sectionId.toString(),
      subjectId: entry.subjectId.toString(),
      teacherId: entry.teacherId.toString(),
      slotId: entry.slotId.toString(),
      dayOfWeek: entry.dayOfWeek,
      batchId: entry.batchId?.toString(),
      roomNumber: entry.roomNumber,
      notes: entry.notes,
      groupId: entry.groupId || entry._id.toString(),
      isMandatory: entry.isMandatory !== false,
      studentIds: (entry.studentIds || []).map((id) => id.toString()),
      linkedSectionIds: (entry.linkedSectionIds || []).map((id) => id.toString()),
      createdBy: entry.createdBy?.toString() || '',
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
    };
  }

  /**
   * Teachers already teaching at the time of `slotId` on `dayOfWeek`, and
   * where — so a timetable picker can grey them out instead of failing on save.
   * Same time-overlap rule as assertNoClash; `excludeGroupId` is the period
   * being edited.
   */
  async getBusyTeachers(
    tenantId: string,
    slotId: string,
    dayOfWeek: number,
    excludeGroupId?: string
  ) {
    const tenantObjId = new ObjectId(tenantId);
    const slot = await collections.timetableSlots.findOne({
      _id: new ObjectId(slotId),
      tenantId: tenantObjId,
    });
    if (!slot) throw new ApiError('SLOT_NOT_FOUND', 'Time slot not found', 404);
    const time = { startTime: slot.startTime as string, endTime: slot.endTime as string };

    const sameDay = await collections.timetableEntries
      .find({
        tenantId: tenantObjId,
        dayOfWeek,
        ...(excludeGroupId && { groupId: { $ne: excludeGroupId } }),
      })
      .project({ teacherId: 1, slotId: 1, sectionId: 1, subjectId: 1 })
      .toArray();
    const slots = new Map(
      (
        await collections.timetableSlots
          .find({
            _id: {
              $in: [...new Set(sameDay.map((e) => String(e.slotId)))].map((id) => new ObjectId(id)),
            },
          })
          .project({ startTime: 1, endTime: 1 })
          .toArray()
      ).map((x) => [String(x._id), x as unknown as { startTime: string; endTime: string }])
    );
    const busy = sameDay.filter((e) => {
      const other = slots.get(String(e.slotId));
      return other && overlaps(time, other);
    });
    if (!busy.length) return [];

    const [sections, subjects] = await Promise.all([
      collections.sections
        .find({ _id: { $in: busy.map((e) => e.sectionId as ObjectId) } })
        .project({ name: 1, classId: 1 })
        .toArray(),
      collections.subjects
        .find({ _id: { $in: busy.map((e) => e.subjectId as ObjectId) } })
        .project({ name: 1 })
        .toArray(),
    ]);
    const classes = await collections.classes
      .find({ _id: { $in: sections.map((x) => x.classId as ObjectId) } })
      .project({ displayName: 1 })
      .toArray();
    const sectionLabel = new Map(
      sections.map((x) => {
        const cls = classes.find((c) => String(c._id) === String(x.classId));
        const year = String(cls?.displayName ?? '')
          .split(' · ')
          .slice(-2)
          .join(' · ');
        return [String(x._id), `${year} · ${x.name}`];
      })
    );
    const subjectName = new Map(subjects.map((x) => [String(x._id), x.name as string]));
    return busy.map((e) => ({
      teacherId: String(e.teacherId),
      subjectId: String(e.subjectId),
      where: `${subjectName.get(String(e.subjectId)) ?? 'A class'} in ${sectionLabel.get(String(e.sectionId)) ?? 'another section'}`,
    }));
  }
}

export const timetableService = new TimetableService();
