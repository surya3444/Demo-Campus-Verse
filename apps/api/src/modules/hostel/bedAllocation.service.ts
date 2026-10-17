import { ObjectId, Filter, Document, WithId } from 'mongodb';
import { collections } from '../../config/database';
import { logger } from '../../lib/logger';
import { ApiError } from '../../middleware/errorHandler';
import { getPagination, buildPaginationMeta } from '../../utils/pagination';
import { hostelService } from './hostel.service';
import { roomService } from './room.service';
import { hostelFeeService } from './hostelFee.service';
import {
  CreateBedAllocationInput,
  VacateBedInput,
  TransferBedInput,
  AllocationQueryInput,
} from '@campus-verse/shared/schemas';

interface BedAllocationDocument extends Document {
  _id: ObjectId;
  tenantId: ObjectId;
  branchId: ObjectId;
  hostelId: ObjectId;
  hostelName?: string;
  roomId: ObjectId;
  roomNumber?: string;
  bedNumber: string;
  studentId: ObjectId;
  studentName: string;
  admissionNumber?: string;
  classId?: ObjectId;
  className?: string;
  sectionId?: ObjectId;
  sectionName?: string;
  academicBatchId?: ObjectId;
  allocationDate: Date;
  expectedVacatingDate?: Date;
  actualVacatingDate?: Date;
  previousAllocationId?: ObjectId;
  status: 'active' | 'vacated' | 'transferred' | 'cancelled';
  vacatingReason?: string;
  createdBy: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

class BedAllocationService {
  async allocate(
    tenantId: string,
    branchId: string,
    data: CreateBedAllocationInput,
    createdBy: string
  ) {
    const tenantObjId = new ObjectId(tenantId);
    const branchObjId = new ObjectId(branchId);
    const studentObjId = new ObjectId(data.studentId);
    const hostelObjId = new ObjectId(data.hostelId);
    const roomObjId = new ObjectId(data.roomId);

    // 1. Validate student exists and is active
    const student = await collections.students.findOne({
      _id: studentObjId,
      tenantId: tenantObjId,
      status: 'active',
    });

    if (!student) {
      throw new ApiError('STUDENT_NOT_FOUND', 'Student not found or inactive', 404);
    }

    // 2. Check student has no existing active allocation
    const existingAllocation = await collections.bedAllocations.findOne({
      tenantId: tenantObjId,
      studentId: studentObjId,
      status: 'active',
    });

    if (existingAllocation) {
      throw new ApiError(
        'STUDENT_ALREADY_ALLOCATED',
        'Student already has an active bed allocation. Vacate or transfer first.',
        409
      );
    }

    // 3. Validate hostel exists and is active
    const hostel = await collections.hostels.findOne({
      _id: hostelObjId,
      tenantId: tenantObjId,
      status: 'active',
    });

    if (!hostel) {
      throw new ApiError('HOSTEL_NOT_FOUND', 'Hostel not found or inactive', 404);
    }

    // 4. Validate room exists
    const room = await collections.rooms.findOne({
      _id: roomObjId,
      tenantId: tenantObjId,
      hostelId: hostelObjId,
    });

    if (!room) {
      throw new ApiError('ROOM_NOT_FOUND', 'Room not found in this hostel', 404);
    }

    // 5. Validate target bed is available
    const beds = room.beds as Array<{
      bedNumber: string;
      status: string;
      studentId?: ObjectId;
      allocationId?: ObjectId;
    }>;
    const targetBed = beds.find((b) => b.bedNumber === data.bedNumber);

    if (!targetBed) {
      throw new ApiError(
        'BED_NOT_FOUND',
        `Bed "${data.bedNumber}" does not exist in this room`,
        404
      );
    }

    if (targetBed.status !== 'available') {
      throw new ApiError(
        'BED_NOT_AVAILABLE',
        `Bed "${data.bedNumber}" is not available (current status: ${targetBed.status})`,
        400
      );
    }

    // 6. Fetch student enrollment info for denormalization
    const enrollment = await collections.studentEnrollments.findOne({
      tenantId: tenantObjId,
      studentId: studentObjId,
      status: 'active',
    });

    let className: string | undefined;
    let classId: ObjectId | undefined;
    let sectionId: ObjectId | undefined;
    let sectionName: string | undefined;
    let academicBatchId: ObjectId | undefined;

    if (enrollment) {
      classId = enrollment.classId as ObjectId;
      sectionId = enrollment.sectionId as ObjectId;
      academicBatchId = enrollment.academicBatchId as ObjectId;

      // Fetch class name
      if (classId) {
        const classDoc = await collections.classes.findOne({ _id: classId });
        className = classDoc?.name as string;
      }

      // Fetch section name
      if (sectionId) {
        const sectionDoc = await collections.sections.findOne({ _id: sectionId });
        sectionName = sectionDoc?.name as string;
      }
    }

    // 7. Insert BedAllocation with status 'active'
    const allocationId = new ObjectId();
    const now = new Date();
    const studentName = `${student.firstName} ${student.lastName}`;

    const allocation: BedAllocationDocument = {
      _id: allocationId,
      tenantId: tenantObjId,
      branchId: branchObjId,
      hostelId: hostelObjId,
      hostelName: hostel.name as string,
      roomId: roomObjId,
      roomNumber: room.roomNumber as string,
      bedNumber: data.bedNumber,
      studentId: studentObjId,
      studentName,
      admissionNumber: student.admissionNumber as string | undefined,
      classId,
      className,
      sectionId,
      sectionName,
      academicBatchId,
      allocationDate: data.allocationDate || now,
      expectedVacatingDate: data.expectedVacatingDate,
      status: 'active',
      createdBy: new ObjectId(createdBy),
      createdAt: now,
      updatedAt: now,
    };

    await collections.bedAllocations.insertOne(allocation);

    // 8. Update room: set bed status to 'occupied' with studentId/allocationId
    const updatedBeds = beds.map((b) => {
      if (b.bedNumber === data.bedNumber) {
        return {
          ...b,
          status: 'occupied',
          studentId: studentObjId,
          allocationId,
        };
      }
      return b;
    });

    await collections.rooms.updateOne(
      { _id: roomObjId },
      { $set: { beds: updatedBeds, updatedAt: now } }
    );

    // 9. Recalculate room status and hostel counters
    await roomService.recalculateRoomStatus(roomObjId);
    await hostelService.recalculateCapacity(hostelObjId);

    // 10. Update student: set services.hostel
    await collections.students.updateOne(
      { _id: studentObjId },
      {
        $set: {
          'services.hostel': {
            isAvailing: true,
            hostelId: hostelObjId,
            roomId: roomObjId,
            bedNumber: data.bedNumber,
          },
          updatedAt: now,
        },
      }
    );

    logger.info(
      {
        allocationId: allocationId.toString(),
        studentId: data.studentId,
        hostelId: data.hostelId,
        roomId: data.roomId,
        bedNumber: data.bedNumber,
        tenantId,
      },
      'Bed allocated to student'
    );

    // 11. Create hostel fee assignment if room has rent
    if (room.monthlyRent && (room.monthlyRent as number) > 0 && academicBatchId) {
      hostelFeeService
        .createFeeForAllocation(
          tenantId,
          branchId,
          allocation,
          {
            monthlyRent: room.monthlyRent as number,
            securityDeposit: (room.securityDeposit as number) || 0,
            roomNumber: room.roomNumber as string,
          },
          hostel.name as string,
          hostel.code as string,
          academicBatchId.toString(),
          createdBy
        )
        .catch((err) => {
          logger.error(
            { err, allocationId: allocationId.toString() },
            'Failed to create hostel fee assignment'
          );
        });
    }

    return this.format(allocation as WithId<BedAllocationDocument>);
  }

  async vacate(tenantId: string, id: string, data: VacateBedInput, _updatedBy: string) {
    const tenantObjId = new ObjectId(tenantId);
    const allocationObjId = new ObjectId(id);

    // 1. Find allocation and verify status is active
    const allocation = (await collections.bedAllocations.findOne({
      _id: allocationObjId,
      tenantId: tenantObjId,
    })) as WithId<BedAllocationDocument> | null;

    if (!allocation) {
      throw new ApiError('ALLOCATION_NOT_FOUND', 'Bed allocation not found', 404);
    }

    if (allocation.status !== 'active') {
      throw new ApiError(
        'ALLOCATION_NOT_ACTIVE',
        `Cannot vacate allocation with status "${allocation.status}"`,
        400
      );
    }

    const now = new Date();

    // 2. Update allocation: status 'vacated', set actualVacatingDate, vacatingReason
    await collections.bedAllocations.updateOne(
      { _id: allocationObjId },
      {
        $set: {
          status: 'vacated',
          actualVacatingDate: data.actualVacatingDate || now,
          vacatingReason: data.vacatingReason,
          updatedAt: now,
        },
      }
    );

    // 3. Update room: free bed (status available, clear studentId)
    const room = await collections.rooms.findOne({ _id: allocation.roomId });
    if (room) {
      const beds = room.beds as Array<{
        bedNumber: string;
        status: string;
        studentId?: ObjectId;
        allocationId?: ObjectId;
      }>;
      const updatedBeds = beds.map((b) => {
        if (
          b.bedNumber === allocation.bedNumber &&
          b.allocationId?.toString() === allocationObjId.toString()
        ) {
          return {
            bedNumber: b.bedNumber,
            status: 'available',
          };
        }
        return b;
      });

      await collections.rooms.updateOne(
        { _id: allocation.roomId },
        { $set: { beds: updatedBeds, updatedAt: now } }
      );

      // 4. Recalculate room status and hostel counters
      await roomService.recalculateRoomStatus(allocation.roomId);
    }

    await hostelService.recalculateCapacity(allocation.hostelId);

    // 5. Update student: set services.hostel = { isAvailing: false }
    await collections.students.updateOne(
      { _id: allocation.studentId },
      {
        $set: {
          'services.hostel': { isAvailing: false },
          updatedAt: now,
        },
      }
    );

    // 6. Handle hostel fee on vacation
    hostelFeeService.handleVacation(tenantId, id, data.actualVacatingDate || now).catch((err) => {
      logger.error({ err, allocationId: id }, 'Failed to handle hostel fee on vacation');
    });

    logger.info(
      {
        allocationId: id,
        studentId: allocation.studentId.toString(),
        reason: data.vacatingReason,
        tenantId,
      },
      'Student vacated from bed'
    );

    return this.findById(tenantId, id);
  }

  async transfer(tenantId: string, id: string, data: TransferBedInput, updatedBy: string) {
    const tenantObjId = new ObjectId(tenantId);
    const allocationObjId = new ObjectId(id);
    const newHostelObjId = new ObjectId(data.newHostelId);
    const newRoomObjId = new ObjectId(data.newRoomId);

    // 1. Validate old allocation is active
    const oldAllocation = (await collections.bedAllocations.findOne({
      _id: allocationObjId,
      tenantId: tenantObjId,
    })) as WithId<BedAllocationDocument> | null;

    if (!oldAllocation) {
      throw new ApiError('ALLOCATION_NOT_FOUND', 'Bed allocation not found', 404);
    }

    if (oldAllocation.status !== 'active') {
      throw new ApiError(
        'ALLOCATION_NOT_ACTIVE',
        `Cannot transfer allocation with status "${oldAllocation.status}"`,
        400
      );
    }

    // 2. Validate new hostel exists and is active
    const newHostel = await collections.hostels.findOne({
      _id: newHostelObjId,
      tenantId: tenantObjId,
      status: 'active',
    });

    if (!newHostel) {
      throw new ApiError('NEW_HOSTEL_NOT_FOUND', 'Target hostel not found or inactive', 404);
    }

    // 3. Validate new room exists
    const newRoom = await collections.rooms.findOne({
      _id: newRoomObjId,
      tenantId: tenantObjId,
      hostelId: newHostelObjId,
    });

    if (!newRoom) {
      throw new ApiError(
        'NEW_ROOM_NOT_FOUND',
        'Target room not found in the specified hostel',
        404
      );
    }

    // 4. Validate new bed is available
    const newBeds = newRoom.beds as Array<{
      bedNumber: string;
      status: string;
      studentId?: ObjectId;
      allocationId?: ObjectId;
    }>;
    const targetBed = newBeds.find((b) => b.bedNumber === data.newBedNumber);

    if (!targetBed) {
      throw new ApiError(
        'NEW_BED_NOT_FOUND',
        `Bed "${data.newBedNumber}" does not exist in the target room`,
        404
      );
    }

    if (targetBed.status !== 'available') {
      throw new ApiError(
        'NEW_BED_NOT_AVAILABLE',
        `Target bed "${data.newBedNumber}" is not available (current status: ${targetBed.status})`,
        400
      );
    }

    const now = new Date();

    // 5. Mark old allocation as 'transferred'
    await collections.bedAllocations.updateOne(
      { _id: allocationObjId },
      {
        $set: {
          status: 'transferred',
          actualVacatingDate: now,
          vacatingReason: data.reason || 'Transferred to another bed',
          updatedAt: now,
        },
      }
    );

    // 6. Create new allocation with previousAllocationId
    const newAllocationId = new ObjectId();

    const newAllocation: BedAllocationDocument = {
      _id: newAllocationId,
      tenantId: tenantObjId,
      branchId: oldAllocation.branchId,
      hostelId: newHostelObjId,
      hostelName: newHostel.name as string,
      roomId: newRoomObjId,
      roomNumber: newRoom.roomNumber as string,
      bedNumber: data.newBedNumber,
      studentId: oldAllocation.studentId,
      studentName: oldAllocation.studentName,
      admissionNumber: oldAllocation.admissionNumber,
      classId: oldAllocation.classId,
      className: oldAllocation.className,
      sectionId: oldAllocation.sectionId,
      sectionName: oldAllocation.sectionName,
      academicBatchId: oldAllocation.academicBatchId,
      allocationDate: now,
      expectedVacatingDate: oldAllocation.expectedVacatingDate,
      previousAllocationId: allocationObjId,
      status: 'active',
      createdBy: new ObjectId(updatedBy),
      createdAt: now,
      updatedAt: now,
    };

    await collections.bedAllocations.insertOne(newAllocation);

    // 7. Update old room: free bed
    const oldRoom = await collections.rooms.findOne({ _id: oldAllocation.roomId });
    if (oldRoom) {
      const oldBeds = oldRoom.beds as Array<{
        bedNumber: string;
        status: string;
        studentId?: ObjectId;
        allocationId?: ObjectId;
      }>;
      const updatedOldBeds = oldBeds.map((b) => {
        if (
          b.bedNumber === oldAllocation.bedNumber &&
          b.allocationId?.toString() === allocationObjId.toString()
        ) {
          return {
            bedNumber: b.bedNumber,
            status: 'available',
          };
        }
        return b;
      });

      await collections.rooms.updateOne(
        { _id: oldAllocation.roomId },
        { $set: { beds: updatedOldBeds, updatedAt: now } }
      );

      await roomService.recalculateRoomStatus(oldAllocation.roomId);
    }

    // 8. Update new room: occupy bed
    const updatedNewBeds = newBeds.map((b) => {
      if (b.bedNumber === data.newBedNumber) {
        return {
          ...b,
          status: 'occupied',
          studentId: oldAllocation.studentId,
          allocationId: newAllocationId,
        };
      }
      return b;
    });

    await collections.rooms.updateOne(
      { _id: newRoomObjId },
      { $set: { beds: updatedNewBeds, updatedAt: now } }
    );

    await roomService.recalculateRoomStatus(newRoomObjId);

    // 9. Recalculate hostel counters for both old and new hostels
    await hostelService.recalculateCapacity(oldAllocation.hostelId);
    if (oldAllocation.hostelId.toString() !== newHostelObjId.toString()) {
      await hostelService.recalculateCapacity(newHostelObjId);
    }

    // 10. Update student: new hostelId/roomId/bedNumber
    await collections.students.updateOne(
      { _id: oldAllocation.studentId },
      {
        $set: {
          'services.hostel': {
            isAvailing: true,
            hostelId: newHostelObjId,
            roomId: newRoomObjId,
            bedNumber: data.newBedNumber,
          },
          updatedAt: now,
        },
      }
    );

    // 11. Handle hostel fee transfer
    if (oldAllocation.academicBatchId) {
      const oldRoomForFee =
        oldRoom || (await collections.rooms.findOne({ _id: oldAllocation.roomId }));
      hostelFeeService
        .handleTransfer(
          tenantId,
          oldAllocation.branchId.toString(),
          id,
          newAllocation,
          { monthlyRent: (oldRoomForFee?.monthlyRent as number) || 0 },
          {
            monthlyRent: (newRoom.monthlyRent as number) || 0,
            securityDeposit: (newRoom.securityDeposit as number) || 0,
            roomNumber: newRoom.roomNumber as string,
          },
          newHostel.name as string,
          newHostel.code as string,
          oldAllocation.academicBatchId.toString(),
          updatedBy
        )
        .catch((err) => {
          logger.error(
            { err, oldAllocationId: id, newAllocationId: newAllocationId.toString() },
            'Failed to handle hostel fee transfer'
          );
        });
    }

    logger.info(
      {
        oldAllocationId: id,
        newAllocationId: newAllocationId.toString(),
        studentId: oldAllocation.studentId.toString(),
        from: {
          hostelId: oldAllocation.hostelId.toString(),
          roomId: oldAllocation.roomId.toString(),
          bed: oldAllocation.bedNumber,
        },
        to: { hostelId: data.newHostelId, roomId: data.newRoomId, bed: data.newBedNumber },
        tenantId,
      },
      'Student transferred to new bed'
    );

    return this.format(newAllocation as WithId<BedAllocationDocument>);
  }

  async findAll(tenantId: string, branchId: string, query: AllocationQueryInput) {
    const { page, limit, sortBy, sortOrder } = getPagination(query as Record<string, unknown>);
    const skip = (page - 1) * limit;

    const filter: Filter<Document> = {
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
    };

    if (query.hostelId) {
      filter.hostelId = new ObjectId(query.hostelId);
    }

    if (query.roomId) {
      filter.roomId = new ObjectId(query.roomId);
    }

    if (query.studentId) {
      filter.studentId = new ObjectId(query.studentId);
    }

    if (query.status) {
      filter.status = query.status;
    }

    if (query.classId) {
      filter.classId = new ObjectId(query.classId);
    }

    if (query.search) {
      filter.$or = [
        { studentName: { $regex: query.search, $options: 'i' } },
        { admissionNumber: { $regex: query.search, $options: 'i' } },
        { roomNumber: { $regex: query.search, $options: 'i' } },
      ];
    }

    const [data, total] = await Promise.all([
      collections.bedAllocations
        .find(filter)
        .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1, _id: sortOrder === 'asc' ? 1 : -1 })
        .skip(skip)
        .limit(limit)
        .toArray() as Promise<WithId<BedAllocationDocument>[]>,
      collections.bedAllocations.countDocuments(filter),
    ]);

    return {
      data: data.map((d) => this.format(d)),
      meta: buildPaginationMeta(page, limit, total),
    };
  }

  async findById(tenantId: string, id: string) {
    const allocation = (await collections.bedAllocations.findOne({
      _id: new ObjectId(id),
      tenantId: new ObjectId(tenantId),
    })) as WithId<BedAllocationDocument> | null;

    if (!allocation) {
      throw new ApiError('ALLOCATION_NOT_FOUND', 'Bed allocation not found', 404);
    }

    return this.format(allocation);
  }

  async findByStudent(tenantId: string, studentId: string) {
    const allocations = (await collections.bedAllocations
      .find({
        tenantId: new ObjectId(tenantId),
        studentId: new ObjectId(studentId),
      })
      .sort({ createdAt: -1 })
      .toArray()) as WithId<BedAllocationDocument>[];

    return allocations.map((a) => this.format(a));
  }

  async getStats(tenantId: string, branchId: string) {
    const tenantObjId = new ObjectId(tenantId);
    const branchObjId = new ObjectId(branchId);

    const baseFilter = {
      tenantId: tenantObjId,
      branchId: branchObjId,
    };

    const [totalActive, totalVacated, totalTransferred, recentAllocations] = await Promise.all([
      collections.bedAllocations.countDocuments({ ...baseFilter, status: 'active' }),
      collections.bedAllocations.countDocuments({ ...baseFilter, status: 'vacated' }),
      collections.bedAllocations.countDocuments({ ...baseFilter, status: 'transferred' }),
      collections.bedAllocations
        .find({ ...baseFilter, status: 'active' })
        .sort({ createdAt: -1 })
        .limit(5)
        .toArray() as Promise<WithId<BedAllocationDocument>[]>,
    ]);

    return {
      totalActive,
      totalVacated,
      totalTransferred,
      recentAllocations: recentAllocations.map((a) => this.format(a)),
    };
  }

  private format(doc: WithId<BedAllocationDocument>) {
    return {
      _id: doc._id.toString(),
      tenantId: doc.tenantId.toString(),
      branchId: doc.branchId.toString(),
      hostelId: doc.hostelId.toString(),
      hostelName: doc.hostelName,
      roomId: doc.roomId.toString(),
      roomNumber: doc.roomNumber,
      bedNumber: doc.bedNumber,
      studentId: doc.studentId.toString(),
      studentName: doc.studentName,
      admissionNumber: doc.admissionNumber,
      classId: doc.classId?.toString(),
      className: doc.className,
      sectionId: doc.sectionId?.toString(),
      sectionName: doc.sectionName,
      academicBatchId: doc.academicBatchId?.toString(),
      allocationDate: doc.allocationDate,
      expectedVacatingDate: doc.expectedVacatingDate,
      actualVacatingDate: doc.actualVacatingDate,
      previousAllocationId: doc.previousAllocationId?.toString(),
      status: doc.status,
      vacatingReason: doc.vacatingReason,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }
}

export const bedAllocationService = new BedAllocationService();
