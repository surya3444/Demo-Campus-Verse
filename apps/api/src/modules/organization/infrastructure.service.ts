import { ObjectId, Filter, Document } from 'mongodb';
import { collections } from '../../config/database';
import { logger } from '../../lib/logger';
import { ApiError } from '../../middleware/errorHandler';
import { getPagination, buildPaginationMeta } from '../../utils/pagination';
import type {
  CreateBuildingInput,
  UpdateBuildingInput,
  CreateInfraRoomInput,
  UpdateInfraRoomInput,
  AddFloorInput,
  UpdateFloorInput,
} from '@campus-verse/shared';

class InfrastructureService {
  // ============ Buildings ============

  async createBuilding(
    tenantId: string,
    branchId: string,
    data: CreateBuildingInput,
    userId?: string
  ) {
    // Check unique code within branch
    const existing = await collections.buildings.findOne({
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
      code: data.code.toUpperCase(),
    });

    if (existing) {
      throw new ApiError(
        'DUPLICATE_BUILDING_CODE',
        'A building with this code already exists in this branch',
        409
      );
    }

    const now = new Date();
    const buildingId = new ObjectId();

    // Generate _id for each floor
    const floors = data.floors.map((f) => ({
      _id: new ObjectId(),
      name: f.name,
      number: f.number,
      status: f.status || 'active',
    }));

    const building = {
      _id: buildingId,
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
      name: data.name,
      code: data.code.toUpperCase(),
      floors,
      totalRooms: 0,
      description: data.description,
      status: 'active' as const,
      createdAt: now,
      updatedAt: now,
      ...(userId && { createdBy: new ObjectId(userId) }),
    };

    await collections.buildings.insertOne(building);
    logger.info({ buildingId: buildingId.toString(), tenantId }, 'Building created');

    return this.formatBuilding(building);
  }

  async findAllBuildings(tenantId: string, branchId: string, query: Record<string, unknown> = {}) {
    const { page, limit, sortBy, sortOrder } = getPagination(query);
    const skip = (page - 1) * limit;

    const filter: Filter<Document> = {
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
    };

    if (query.search) {
      const searchRegex = new RegExp(String(query.search), 'i');
      filter.$or = [{ name: searchRegex }, { code: searchRegex }];
    }

    if (query.status) {
      filter.status = query.status;
    }

    const [data, total] = await Promise.all([
      collections.buildings
        .find(filter)
        .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1, _id: sortOrder === 'asc' ? 1 : -1 })
        .skip(skip)
        .limit(limit)
        .toArray(),
      collections.buildings.countDocuments(filter),
    ]);

    return {
      data: data.map((b) => this.formatBuilding(b)),
      meta: buildPaginationMeta(page, limit, total),
    };
  }

  async findBuildingById(tenantId: string, id: string) {
    const building = await collections.buildings.findOne({
      _id: new ObjectId(id),
      tenantId: new ObjectId(tenantId),
    });

    if (!building) {
      throw new ApiError('BUILDING_NOT_FOUND', 'Building not found', 404);
    }

    return this.formatBuilding(building);
  }

  async updateBuilding(tenantId: string, id: string, data: UpdateBuildingInput, userId?: string) {
    const building = await collections.buildings.findOne({
      _id: new ObjectId(id),
      tenantId: new ObjectId(tenantId),
    });

    if (!building) {
      throw new ApiError('BUILDING_NOT_FOUND', 'Building not found', 404);
    }

    // If code is changing, check uniqueness
    if (data.code && data.code.toUpperCase() !== building.code) {
      const existing = await collections.buildings.findOne({
        tenantId: new ObjectId(tenantId),
        branchId: building.branchId,
        code: data.code.toUpperCase(),
        _id: { $ne: new ObjectId(id) },
      });

      if (existing) {
        throw new ApiError(
          'DUPLICATE_BUILDING_CODE',
          'A building with this code already exists in this branch',
          409
        );
      }
    }

    // If floors are being replaced, check that no rooms reference removed floors
    if (data.floors) {
      const newFloors = data.floors.map((f) => ({
        _id: new ObjectId(),
        name: f.name,
        number: f.number,
        status: f.status || 'active',
      }));

      const newFloorNames = newFloors.map((f) => f.name);

      // Check if any rooms reference floors that are being removed
      const existingFloorNames = (building.floors || []).map((f: { name: string }) => f.name);
      const removedFloorNames = existingFloorNames.filter(
        (name: string) => !newFloorNames.includes(name)
      );

      if (removedFloorNames.length > 0) {
        // Check if rooms reference any existing floor IDs that map to removed names
        const removedFloorIdObjects = (building.floors || [])
          .filter((f: { name: string }) => removedFloorNames.includes(f.name))
          .map((f: { _id: ObjectId }) => f._id.toString());

        const roomCount = await collections.infrastructureRooms.countDocuments({
          buildingId: new ObjectId(id),
          floorId: { $in: removedFloorIdObjects.map((fid: string) => new ObjectId(fid)) },
        });

        if (roomCount > 0) {
          throw new ApiError(
            'FLOOR_HAS_ROOMS',
            'Cannot remove floors that have rooms assigned to them',
            400
          );
        }
      }

      // Preserve existing floor _ids for floors that match by name
      const finalFloors = newFloors.map((nf) => {
        const existingFloor = (building.floors || []).find(
          (ef: { name: string }) => ef.name === nf.name
        );
        return existingFloor ? { ...nf, _id: existingFloor._id } : nf;
      });

      (data as Record<string, unknown>).floors = finalFloors;
    }

    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
      ...(userId && { updatedBy: new ObjectId(userId) }),
    };

    if (data.name !== undefined) updateData.name = data.name;
    if (data.code !== undefined) updateData.code = data.code.toUpperCase();
    if (data.description !== undefined) updateData.description = data.description;
    if (data.status !== undefined) updateData.status = data.status;
    if ((data as Record<string, unknown>).floors !== undefined)
      updateData.floors = (data as Record<string, unknown>).floors;

    await collections.buildings.updateOne(
      { _id: new ObjectId(id), tenantId: new ObjectId(tenantId) },
      { $set: updateData }
    );

    return this.findBuildingById(tenantId, id);
  }

  async deleteBuilding(tenantId: string, id: string) {
    const building = await collections.buildings.findOne({
      _id: new ObjectId(id),
      tenantId: new ObjectId(tenantId),
    });

    if (!building) {
      throw new ApiError('BUILDING_NOT_FOUND', 'Building not found', 404);
    }

    // Check for rooms
    const roomCount = await collections.infrastructureRooms.countDocuments({
      buildingId: new ObjectId(id),
    });

    if (roomCount > 0) {
      throw new ApiError(
        'BUILDING_HAS_ROOMS',
        `Cannot delete building with ${roomCount} room(s). Remove all rooms first.`,
        400
      );
    }

    await collections.buildings.deleteOne({
      _id: new ObjectId(id),
      tenantId: new ObjectId(tenantId),
    });

    logger.info({ buildingId: id, tenantId }, 'Building deleted');
  }

  // ============ Floor Management ============

  async addFloor(tenantId: string, buildingId: string, data: AddFloorInput) {
    const building = await collections.buildings.findOne({
      _id: new ObjectId(buildingId),
      tenantId: new ObjectId(tenantId),
    });

    if (!building) {
      throw new ApiError('BUILDING_NOT_FOUND', 'Building not found', 404);
    }

    // Check duplicate floor name
    const existingFloor = (building.floors || []).find(
      (f: { name: string }) => f.name.toLowerCase() === data.name.toLowerCase()
    );
    if (existingFloor) {
      throw new ApiError('DUPLICATE_FLOOR', 'A floor with this name already exists', 409);
    }

    const floor = {
      _id: new ObjectId(),
      name: data.name,
      number: data.number,
      status: data.status || 'active',
    };

    await collections.buildings.updateOne(
      { _id: new ObjectId(buildingId), tenantId: new ObjectId(tenantId) },
      {
        $push: { floors: floor } as unknown as Document,
        $set: { updatedAt: new Date() },
      }
    );

    logger.info({ buildingId, floorId: floor._id.toString() }, 'Floor added to building');

    return this.findBuildingById(tenantId, buildingId);
  }

  async updateFloor(tenantId: string, buildingId: string, floorId: string, data: UpdateFloorInput) {
    const building = await collections.buildings.findOne({
      _id: new ObjectId(buildingId),
      tenantId: new ObjectId(tenantId),
    });

    if (!building) {
      throw new ApiError('BUILDING_NOT_FOUND', 'Building not found', 404);
    }

    const floorIndex = (building.floors || []).findIndex(
      (f: { _id: ObjectId }) => f._id.toString() === floorId
    );

    if (floorIndex === -1) {
      throw new ApiError('FLOOR_NOT_FOUND', 'Floor not found', 404);
    }

    // Check duplicate name if name is changing
    if (data.name) {
      const newName = data.name;
      const duplicate = (building.floors || []).find(
        (f: { _id: ObjectId; name: string }) =>
          f._id.toString() !== floorId && f.name.toLowerCase() === newName.toLowerCase()
      );
      if (duplicate) {
        throw new ApiError('DUPLICATE_FLOOR', 'A floor with this name already exists', 409);
      }
    }

    const updateFields: Record<string, unknown> = { updatedAt: new Date() };
    if (data.name !== undefined) updateFields[`floors.${floorIndex}.name`] = data.name;
    if (data.number !== undefined) updateFields[`floors.${floorIndex}.number`] = data.number;
    if (data.status !== undefined) updateFields[`floors.${floorIndex}.status`] = data.status;

    await collections.buildings.updateOne(
      { _id: new ObjectId(buildingId), tenantId: new ObjectId(tenantId) },
      { $set: updateFields }
    );

    // Update denormalized floor name in rooms if name changed
    if (data.name !== undefined) {
      await collections.infrastructureRooms.updateMany(
        { buildingId: new ObjectId(buildingId), floorId: new ObjectId(floorId) },
        { $set: { floorName: data.name, updatedAt: new Date() } }
      );
    }

    return this.findBuildingById(tenantId, buildingId);
  }

  async removeFloor(tenantId: string, buildingId: string, floorId: string) {
    const building = await collections.buildings.findOne({
      _id: new ObjectId(buildingId),
      tenantId: new ObjectId(tenantId),
    });

    if (!building) {
      throw new ApiError('BUILDING_NOT_FOUND', 'Building not found', 404);
    }

    const floor = (building.floors || []).find(
      (f: { _id: ObjectId }) => f._id.toString() === floorId
    );

    if (!floor) {
      throw new ApiError('FLOOR_NOT_FOUND', 'Floor not found', 404);
    }

    // Check for rooms on this floor
    const roomCount = await collections.infrastructureRooms.countDocuments({
      buildingId: new ObjectId(buildingId),
      floorId: new ObjectId(floorId),
    });

    if (roomCount > 0) {
      throw new ApiError(
        'FLOOR_HAS_ROOMS',
        `Cannot remove floor with ${roomCount} room(s). Remove all rooms first.`,
        400
      );
    }

    await collections.buildings.updateOne(
      { _id: new ObjectId(buildingId), tenantId: new ObjectId(tenantId) },
      {
        $pull: { floors: { _id: new ObjectId(floorId) } } as unknown as Document,
        $set: { updatedAt: new Date() },
      }
    );

    logger.info({ buildingId, floorId }, 'Floor removed from building');

    return this.findBuildingById(tenantId, buildingId);
  }

  // ============ Rooms ============

  async createRoom(
    tenantId: string,
    branchId: string,
    data: CreateInfraRoomInput,
    userId?: string
  ) {
    // Validate building exists
    const building = await collections.buildings.findOne({
      _id: new ObjectId(data.buildingId),
      tenantId: new ObjectId(tenantId),
    });

    if (!building) {
      throw new ApiError('BUILDING_NOT_FOUND', 'Building not found', 404);
    }

    // Validate floor exists in building
    const floor = (building.floors || []).find(
      (f: { _id: ObjectId }) => f._id.toString() === data.floorId
    );

    if (!floor) {
      throw new ApiError('FLOOR_NOT_FOUND', 'Floor not found in this building', 404);
    }

    // Check unique room number within building
    const existingRoom = await collections.infrastructureRooms.findOne({
      buildingId: new ObjectId(data.buildingId),
      roomNumber: data.roomNumber,
    });

    if (existingRoom) {
      throw new ApiError(
        'DUPLICATE_ROOM_NUMBER',
        'A room with this number already exists in this building',
        409
      );
    }

    const now = new Date();
    const roomId = new ObjectId();

    const room = {
      _id: roomId,
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
      buildingId: new ObjectId(data.buildingId),
      buildingName: building.name,
      floorId: new ObjectId(data.floorId),
      floorName: floor.name,
      roomNumber: data.roomNumber,
      name: data.name,
      type: data.type,
      capacity: data.capacity,
      area: data.area,
      amenities: data.amenities || [],
      status: 'available' as const,
      createdAt: now,
      updatedAt: now,
      ...(userId && { createdBy: new ObjectId(userId) }),
    };

    await collections.infrastructureRooms.insertOne(room);

    // Increment building totalRooms
    await collections.buildings.updateOne(
      { _id: new ObjectId(data.buildingId) },
      { $inc: { totalRooms: 1 }, $set: { updatedAt: now } }
    );

    logger.info(
      { roomId: roomId.toString(), buildingId: data.buildingId },
      'Infrastructure room created'
    );

    return this.formatRoom(room);
  }

  async findAllRooms(tenantId: string, branchId: string, query: Record<string, unknown> = {}) {
    const { page, limit, sortBy, sortOrder } = getPagination(query);
    const skip = (page - 1) * limit;

    const filter: Filter<Document> = {
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
    };

    if (query.buildingId) {
      filter.buildingId = new ObjectId(String(query.buildingId));
    }

    if (query.floorId) {
      filter.floorId = new ObjectId(String(query.floorId));
    }

    if (query.type) {
      filter.type = query.type;
    }

    if (query.status) {
      filter.status = query.status;
    }

    if (query.search) {
      const searchRegex = new RegExp(String(query.search), 'i');
      filter.$or = [{ roomNumber: searchRegex }, { name: searchRegex }];
    }

    const [data, total] = await Promise.all([
      collections.infrastructureRooms
        .find(filter)
        .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1, _id: sortOrder === 'asc' ? 1 : -1 })
        .skip(skip)
        .limit(limit)
        .toArray(),
      collections.infrastructureRooms.countDocuments(filter),
    ]);

    return {
      data: data.map((r) => this.formatRoom(r)),
      meta: buildPaginationMeta(page, limit, total),
    };
  }

  async findRoomById(tenantId: string, id: string) {
    const room = await collections.infrastructureRooms.findOne({
      _id: new ObjectId(id),
      tenantId: new ObjectId(tenantId),
    });

    if (!room) {
      throw new ApiError('ROOM_NOT_FOUND', 'Room not found', 404);
    }

    return this.formatRoom(room);
  }

  async updateRoom(tenantId: string, id: string, data: UpdateInfraRoomInput, userId?: string) {
    const room = await collections.infrastructureRooms.findOne({
      _id: new ObjectId(id),
      tenantId: new ObjectId(tenantId),
    });

    if (!room) {
      throw new ApiError('ROOM_NOT_FOUND', 'Room not found', 404);
    }

    // If room number is changing, check uniqueness
    if (data.roomNumber && data.roomNumber !== room.roomNumber) {
      const existing = await collections.infrastructureRooms.findOne({
        buildingId: room.buildingId,
        roomNumber: data.roomNumber,
        _id: { $ne: new ObjectId(id) },
      });

      if (existing) {
        throw new ApiError(
          'DUPLICATE_ROOM_NUMBER',
          'A room with this number already exists in this building',
          409
        );
      }
    }

    // If floor is changing, validate it exists
    if (data.floorId) {
      const building = await collections.buildings.findOne({
        _id: room.buildingId,
        tenantId: new ObjectId(tenantId),
      });

      if (!building) {
        throw new ApiError('BUILDING_NOT_FOUND', 'Building not found', 404);
      }

      const floor = (building.floors || []).find(
        (f: { _id: ObjectId }) => f._id.toString() === data.floorId
      );

      if (!floor) {
        throw new ApiError('FLOOR_NOT_FOUND', 'Floor not found in this building', 404);
      }

      (data as Record<string, unknown>).floorId = new ObjectId(data.floorId);
      (data as Record<string, unknown>).floorName = floor.name;
    }

    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
      ...(userId && { updatedBy: new ObjectId(userId) }),
    };

    const allowedFields = [
      'roomNumber',
      'name',
      'type',
      'capacity',
      'area',
      'amenities',
      'status',
      'floorId',
      'floorName',
    ];

    for (const field of allowedFields) {
      if ((data as Record<string, unknown>)[field] !== undefined) {
        updateData[field] = (data as Record<string, unknown>)[field];
      }
    }

    await collections.infrastructureRooms.updateOne(
      { _id: new ObjectId(id), tenantId: new ObjectId(tenantId) },
      { $set: updateData }
    );

    return this.findRoomById(tenantId, id);
  }

  async deleteRoom(tenantId: string, id: string) {
    const room = await collections.infrastructureRooms.findOne({
      _id: new ObjectId(id),
      tenantId: new ObjectId(tenantId),
    });

    if (!room) {
      throw new ApiError('ROOM_NOT_FOUND', 'Room not found', 404);
    }

    await collections.infrastructureRooms.deleteOne({
      _id: new ObjectId(id),
      tenantId: new ObjectId(tenantId),
    });

    // Decrement building totalRooms
    await collections.buildings.updateOne(
      { _id: room.buildingId },
      { $inc: { totalRooms: -1 }, $set: { updatedAt: new Date() } }
    );

    logger.info(
      { roomId: id, buildingId: room.buildingId.toString() },
      'Infrastructure room deleted'
    );
  }

  // ============ Stats ============

  async getStats(tenantId: string, branchId: string) {
    const filter = {
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
    };

    const [totalBuildings, buildings, totalRooms, byType, byStatus] = await Promise.all([
      collections.buildings.countDocuments(filter),
      collections.buildings.find(filter).project({ floors: 1 }).toArray(),
      collections.infrastructureRooms.countDocuments(filter),
      collections.infrastructureRooms
        .aggregate([
          { $match: filter },
          { $group: { _id: '$type', count: { $sum: 1 } } },
          { $project: { type: '$_id', count: 1, _id: 0 } },
          { $sort: { count: -1 } },
        ])
        .toArray(),
      collections.infrastructureRooms
        .aggregate([
          { $match: filter },
          { $group: { _id: '$status', count: { $sum: 1 } } },
          { $project: { status: '$_id', count: 1, _id: 0 } },
        ])
        .toArray(),
    ]);

    const totalFloors = buildings.reduce((sum, b) => sum + (b.floors ? b.floors.length : 0), 0);

    return {
      totalBuildings,
      totalFloors,
      totalRooms,
      byType,
      byStatus,
    };
  }

  // ============ Formatters ============

  private formatBuilding(doc: Document) {
    return {
      _id: doc._id.toString(),
      tenantId: doc.tenantId?.toString(),
      branchId: doc.branchId?.toString(),
      name: doc.name,
      code: doc.code,
      floors: (doc.floors || []).map(
        (f: { _id: ObjectId; name: string; number: number; status: string }) => ({
          _id: f._id.toString(),
          name: f.name,
          number: f.number,
          status: f.status,
        })
      ),
      totalRooms: doc.totalRooms || 0,
      description: doc.description,
      status: doc.status,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      createdBy: doc.createdBy?.toString(),
    };
  }

  private formatRoom(doc: Document) {
    return {
      _id: doc._id.toString(),
      tenantId: doc.tenantId?.toString(),
      branchId: doc.branchId?.toString(),
      buildingId: doc.buildingId?.toString(),
      buildingName: doc.buildingName,
      floorId: doc.floorId?.toString(),
      floorName: doc.floorName,
      roomNumber: doc.roomNumber,
      name: doc.name,
      type: doc.type,
      capacity: doc.capacity,
      area: doc.area,
      amenities: doc.amenities || [],
      status: doc.status,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      createdBy: doc.createdBy?.toString(),
    };
  }
}

export const infrastructureService = new InfrastructureService();
