import { ObjectId, Filter, Document, WithId } from 'mongodb';
import { collections } from '../../config/database';
import { logger } from '../../lib/logger';
import { ApiError } from '../../middleware/errorHandler';
import { getPagination, buildPaginationMeta } from '../../utils/pagination';
import { hostelService } from './hostel.service';
import { CreateRoomInput, UpdateRoomInput, RoomQueryInput } from '@campus-verse/shared/schemas';

interface BedDocument {
  bedNumber: string;
  status: 'available' | 'occupied' | 'maintenance' | 'reserved';
  studentId?: ObjectId;
  allocationId?: ObjectId;
}

interface RoomDocument extends Document {
  _id: ObjectId;
  tenantId: ObjectId;
  branchId: ObjectId;
  hostelId: ObjectId;
  hostelName?: string;
  roomNumber: string;
  floor: string;
  type: 'single' | 'double' | 'triple' | 'quad' | 'dormitory';
  capacity: number;
  beds: BedDocument[];
  occupiedBeds: number;
  availableBeds: number;
  amenities: string[];
  monthlyRent?: number;
  securityDeposit?: number;
  roomStatus: 'available' | 'partially_occupied' | 'occupied' | 'maintenance' | 'reserved';
  createdBy: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

class RoomService {
  async create(tenantId: string, branchId: string, data: CreateRoomInput, createdBy: string) {
    const tenantObjId = new ObjectId(tenantId);
    const branchObjId = new ObjectId(branchId);
    const hostelObjId = new ObjectId(data.hostelId);

    // Validate hostel exists and is active
    const hostel = await collections.hostels.findOne({
      _id: hostelObjId,
      tenantId: tenantObjId,
      status: 'active',
    });

    if (!hostel) {
      throw new ApiError('HOSTEL_NOT_FOUND', 'Hostel not found or inactive', 404);
    }

    // Validate unique room number within hostel
    const existingRoom = await collections.rooms.findOne({
      tenantId: tenantObjId,
      hostelId: hostelObjId,
      roomNumber: data.roomNumber,
    });

    if (existingRoom) {
      throw new ApiError(
        'DUPLICATE_ROOM',
        'A room with this number already exists in this hostel',
        409
      );
    }

    // Validate floor belongs to hostel
    const hostelFloors = hostel.floors as string[];
    if (!hostelFloors.includes(data.floor)) {
      throw new ApiError(
        'INVALID_FLOOR',
        `Floor "${data.floor}" does not exist in this hostel`,
        400
      );
    }

    const roomId = new ObjectId();
    const now = new Date();

    // Auto-generate beds array (A, B, C... based on capacity)
    const beds: BedDocument[] = Array.from({ length: data.capacity }, (_, i) => ({
      bedNumber: String.fromCharCode(65 + i), // A, B, C, ...
      status: 'available' as const,
    }));

    const room: RoomDocument = {
      _id: roomId,
      tenantId: tenantObjId,
      branchId: branchObjId,
      hostelId: hostelObjId,
      hostelName: hostel.name as string,
      roomNumber: data.roomNumber,
      floor: data.floor,
      type: data.type,
      capacity: data.capacity,
      beds,
      occupiedBeds: 0,
      availableBeds: data.capacity,
      amenities: data.amenities || [],
      monthlyRent: data.monthlyRent,
      securityDeposit: data.securityDeposit,
      roomStatus: 'available',
      createdBy: new ObjectId(createdBy),
      createdAt: now,
      updatedAt: now,
    };

    await collections.rooms.insertOne(room);

    // Recalculate hostel capacity
    await hostelService.recalculateCapacity(hostelObjId);

    logger.info(
      { roomId: roomId.toString(), roomNumber: data.roomNumber, hostelId: data.hostelId, tenantId },
      'Room created'
    );

    return this.format(room as WithId<RoomDocument>);
  }

  async findAll(tenantId: string, branchId: string, query: RoomQueryInput) {
    const { page, limit, sortBy, sortOrder } = getPagination(query as Record<string, unknown>);
    const skip = (page - 1) * limit;

    const filter: Filter<Document> = {
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
    };

    if (query.hostelId) {
      filter.hostelId = new ObjectId(query.hostelId);
    }

    if (query.floor) {
      filter.floor = query.floor;
    }

    if (query.type) {
      filter.type = query.type;
    }

    if (query.roomStatus) {
      filter.roomStatus = query.roomStatus;
    }

    if (query.hasAvailableBeds) {
      filter.availableBeds = { $gt: 0 };
    }

    const [data, total] = await Promise.all([
      collections.rooms
        .find(filter)
        .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1, _id: sortOrder === 'asc' ? 1 : -1 })
        .skip(skip)
        .limit(limit)
        .toArray() as Promise<WithId<RoomDocument>[]>,
      collections.rooms.countDocuments(filter),
    ]);

    return {
      data: data.map((d) => this.format(d)),
      meta: buildPaginationMeta(page, limit, total),
    };
  }

  async findById(tenantId: string, id: string) {
    const room = (await collections.rooms.findOne({
      _id: new ObjectId(id),
      tenantId: new ObjectId(tenantId),
    })) as WithId<RoomDocument> | null;

    if (!room) {
      throw new ApiError('ROOM_NOT_FOUND', 'Room not found', 404);
    }

    return this.format(room);
  }

  async update(tenantId: string, id: string, data: UpdateRoomInput, updatedBy: string) {
    const tenantObjId = new ObjectId(tenantId);
    const roomObjId = new ObjectId(id);

    const existing = (await collections.rooms.findOne({
      _id: roomObjId,
      tenantId: tenantObjId,
    })) as WithId<RoomDocument> | null;

    if (!existing) {
      throw new ApiError('ROOM_NOT_FOUND', 'Room not found', 404);
    }

    // Validate room number uniqueness if changed
    if (data.roomNumber && data.roomNumber !== existing.roomNumber) {
      const duplicate = await collections.rooms.findOne({
        tenantId: tenantObjId,
        hostelId: existing.hostelId,
        roomNumber: data.roomNumber,
        _id: { $ne: roomObjId },
      });

      if (duplicate) {
        throw new ApiError(
          'DUPLICATE_ROOM',
          'A room with this number already exists in this hostel',
          409
        );
      }
    }

    // Cannot reduce capacity below occupied beds
    if (data.capacity !== undefined) {
      const occupiedCount = existing.beds.filter((b) => b.status === 'occupied').length;
      if (data.capacity < occupiedCount) {
        throw new ApiError(
          'CAPACITY_TOO_LOW',
          `Cannot reduce capacity to ${data.capacity}. There are ${occupiedCount} occupied bed(s).`,
          400
        );
      }

      // Adjust beds array if capacity changed
      if (data.capacity !== existing.capacity) {
        const currentBeds = existing.beds;
        if (data.capacity > existing.capacity) {
          // Add new beds
          for (let i = existing.capacity; i < data.capacity; i++) {
            currentBeds.push({
              bedNumber: String.fromCharCode(65 + i),
              status: 'available',
            });
          }
        } else {
          // Remove unoccupied beds from the end
          while (currentBeds.length > data.capacity) {
            const lastBed = currentBeds[currentBeds.length - 1];
            if (lastBed.status === 'occupied') break;
            currentBeds.pop();
          }
        }

        const occupiedBeds = currentBeds.filter((b) => b.status === 'occupied').length;
        const availableBeds = currentBeds.filter((b) => b.status === 'available').length;

        await collections.rooms.updateOne(
          { _id: roomObjId },
          {
            $set: {
              beds: currentBeds,
              capacity: data.capacity,
              occupiedBeds,
              availableBeds,
              updatedAt: new Date(),
            },
          }
        );
      }
    }

    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (data.roomNumber !== undefined) updateData.roomNumber = data.roomNumber;
    if (data.floor !== undefined) updateData.floor = data.floor;
    if (data.type !== undefined) updateData.type = data.type;
    if (data.amenities !== undefined) updateData.amenities = data.amenities;
    if (data.monthlyRent !== undefined) updateData.monthlyRent = data.monthlyRent;
    if (data.securityDeposit !== undefined) updateData.securityDeposit = data.securityDeposit;

    // Only update non-capacity fields here (capacity handled above)
    if (Object.keys(updateData).length > 1) {
      await collections.rooms.updateOne({ _id: roomObjId }, { $set: updateData });
    }

    // Recalculate room status
    await this.recalculateRoomStatus(roomObjId);

    // Recalculate hostel capacity
    await hostelService.recalculateCapacity(existing.hostelId);

    logger.info({ roomId: id, tenantId, updatedBy }, 'Room updated');

    return this.findById(tenantId, id);
  }

  async updateStatus(
    tenantId: string,
    id: string,
    status: 'maintenance' | 'reserved' | 'available',
    updatedBy: string
  ) {
    const tenantObjId = new ObjectId(tenantId);
    const roomObjId = new ObjectId(id);

    const room = (await collections.rooms.findOne({
      _id: roomObjId,
      tenantId: tenantObjId,
    })) as WithId<RoomDocument> | null;

    if (!room) {
      throw new ApiError('ROOM_NOT_FOUND', 'Room not found', 404);
    }

    // Cannot set maintenance/reserved if there are occupied beds
    if (status === 'maintenance' || status === 'reserved') {
      const occupiedCount = room.beds.filter((b) => b.status === 'occupied').length;
      if (occupiedCount > 0) {
        throw new ApiError(
          'ROOM_HAS_OCCUPANTS',
          `Cannot set room to ${status}. There are ${occupiedCount} occupied bed(s). Vacate all students first.`,
          400
        );
      }

      // Update all bed statuses to match room status
      const updatedBeds = room.beds.map((b) => ({
        ...b,
        status: status as 'maintenance' | 'reserved',
      }));

      await collections.rooms.updateOne(
        { _id: roomObjId },
        {
          $set: {
            beds: updatedBeds,
            roomStatus: status,
            occupiedBeds: 0,
            availableBeds: 0,
            updatedAt: new Date(),
          },
        }
      );
    } else {
      // Setting back to available - reset unoccupied beds to available
      const updatedBeds = room.beds.map((b) => ({
        ...b,
        status: b.status === 'occupied' ? ('occupied' as const) : ('available' as const),
      }));

      const occupiedBeds = updatedBeds.filter((b) => b.status === 'occupied').length;
      const availableBeds = updatedBeds.filter((b) => b.status === 'available').length;

      await collections.rooms.updateOne(
        { _id: roomObjId },
        {
          $set: {
            beds: updatedBeds,
            occupiedBeds,
            availableBeds,
            updatedAt: new Date(),
          },
        }
      );

      // Recalculate room status based on occupancy
      await this.recalculateRoomStatus(roomObjId);
    }

    // Recalculate hostel capacity
    await hostelService.recalculateCapacity(room.hostelId);

    logger.info({ roomId: id, status, tenantId, updatedBy }, 'Room status updated');

    return this.findById(tenantId, id);
  }

  async delete(tenantId: string, id: string) {
    const tenantObjId = new ObjectId(tenantId);
    const roomObjId = new ObjectId(id);

    const room = (await collections.rooms.findOne({
      _id: roomObjId,
      tenantId: tenantObjId,
    })) as WithId<RoomDocument> | null;

    if (!room) {
      throw new ApiError('ROOM_NOT_FOUND', 'Room not found', 404);
    }

    // Verify no occupied beds
    const occupiedCount = room.beds.filter((b) => b.status === 'occupied').length;
    if (occupiedCount > 0) {
      throw new ApiError(
        'ROOM_HAS_OCCUPANTS',
        `Cannot delete room with ${occupiedCount} occupied bed(s). Vacate all students first.`,
        400
      );
    }

    await collections.rooms.deleteOne({ _id: roomObjId });

    // Recalculate hostel capacity
    await hostelService.recalculateCapacity(room.hostelId);

    logger.info({ roomId: id, tenantId }, 'Room deleted');

    return { success: true };
  }

  async recalculateRoomStatus(roomId: ObjectId) {
    const room = (await collections.rooms.findOne({ _id: roomId })) as WithId<RoomDocument> | null;
    if (!room) return;

    const beds = room.beds;
    const occupiedCount = beds.filter((b) => b.status === 'occupied').length;
    const maintenanceCount = beds.filter((b) => b.status === 'maintenance').length;
    const availableCount = beds.filter((b) => b.status === 'available').length;

    let roomStatus: string;

    if (maintenanceCount === beds.length) {
      roomStatus = 'maintenance';
    } else if (occupiedCount === beds.length) {
      roomStatus = 'occupied';
    } else if (occupiedCount > 0) {
      roomStatus = 'partially_occupied';
    } else if (beds.every((b) => b.status === 'reserved')) {
      roomStatus = 'reserved';
    } else {
      roomStatus = 'available';
    }

    await collections.rooms.updateOne(
      { _id: roomId },
      {
        $set: {
          roomStatus,
          occupiedBeds: occupiedCount,
          availableBeds: availableCount,
          updatedAt: new Date(),
        },
      }
    );
  }

  private format(doc: WithId<RoomDocument>) {
    return {
      _id: doc._id.toString(),
      tenantId: doc.tenantId.toString(),
      branchId: doc.branchId.toString(),
      hostelId: doc.hostelId.toString(),
      hostelName: doc.hostelName,
      roomNumber: doc.roomNumber,
      floor: doc.floor,
      type: doc.type,
      capacity: doc.capacity,
      beds: doc.beds.map((b) => ({
        bedNumber: b.bedNumber,
        status: b.status,
        studentId: b.studentId?.toString(),
        allocationId: b.allocationId?.toString(),
      })),
      occupiedBeds: doc.occupiedBeds,
      availableBeds: doc.availableBeds,
      amenities: doc.amenities,
      monthlyRent: doc.monthlyRent,
      securityDeposit: doc.securityDeposit,
      roomStatus: doc.roomStatus,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }
}

export const roomService = new RoomService();
