import { ObjectId, Filter, Document, WithId } from 'mongodb';
import { collections } from '../../config/database';
import { logger } from '../../lib/logger';
import { ApiError } from '../../middleware/errorHandler';
import { getPagination, buildPaginationMeta } from '../../utils/pagination';
import {
  CreateHostelInput,
  UpdateHostelInput,
  HostelQueryInput,
} from '@campus-verse/shared/schemas';

interface HostelDocument extends Document {
  _id: ObjectId;
  tenantId: ObjectId;
  branchId: ObjectId;
  name: string;
  code: string;
  type: 'boys' | 'girls' | 'co-ed';
  totalFloors: number;
  floors: string[];
  totalRooms: number;
  totalBeds: number;
  occupiedBeds: number;
  availableBeds: number;
  wardenId?: ObjectId;
  wardenName?: string;
  amenities: string[];
  status: 'active' | 'inactive';
  contactNumber?: string;
  email?: string;
  createdBy: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

class HostelService {
  async create(tenantId: string, branchId: string, data: CreateHostelInput, createdBy: string) {
    const tenantObjId = new ObjectId(tenantId);
    const branchObjId = new ObjectId(branchId);

    // Validate unique code per branch
    const existing = await collections.hostels.findOne({
      tenantId: tenantObjId,
      branchId: branchObjId,
      code: data.code,
    });

    if (existing) {
      throw new ApiError(
        'DUPLICATE_CODE',
        'A hostel with this code already exists in this branch',
        409
      );
    }

    const hostelId = new ObjectId();
    const now = new Date();

    // Generate floor names if not provided
    const floors =
      data.floors && data.floors.length > 0
        ? data.floors
        : Array.from({ length: data.totalFloors }, (_, i) =>
            i === 0 ? 'Ground Floor' : `Floor ${i}`
          );

    const hostel: HostelDocument = {
      _id: hostelId,
      tenantId: tenantObjId,
      branchId: branchObjId,
      name: data.name,
      code: data.code,
      type: data.type,
      totalFloors: data.totalFloors,
      floors,
      totalRooms: 0,
      totalBeds: 0,
      occupiedBeds: 0,
      availableBeds: 0,
      wardenId: data.wardenId ? new ObjectId(data.wardenId) : undefined,
      wardenName: data.wardenName,
      amenities: data.amenities || [],
      status: 'active',
      contactNumber: data.contactNumber,
      email: data.email,
      createdBy: new ObjectId(createdBy),
      createdAt: now,
      updatedAt: now,
    };

    await collections.hostels.insertOne(hostel);

    logger.info({ hostelId: hostelId.toString(), code: data.code, tenantId }, 'Hostel created');

    return this.format(hostel as WithId<HostelDocument>);
  }

  async findAll(tenantId: string, branchId: string, query: HostelQueryInput) {
    const { page, limit, sortBy, sortOrder } = getPagination(query as Record<string, unknown>);
    const skip = (page - 1) * limit;

    const filter: Filter<Document> = {
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
    };

    if (query.search) {
      filter.$or = [
        { name: { $regex: query.search, $options: 'i' } },
        { code: { $regex: query.search, $options: 'i' } },
      ];
    }

    if (query.type) {
      filter.type = query.type;
    }

    if (query.status) {
      filter.status = query.status;
    } else {
      // Default to showing active hostels only
      filter.status = 'active';
    }

    if (query.wardenId) {
      filter.wardenId = new ObjectId(query.wardenId);
    }

    const [data, total] = await Promise.all([
      collections.hostels
        .find(filter)
        .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1, _id: sortOrder === 'asc' ? 1 : -1 })
        .skip(skip)
        .limit(limit)
        .toArray() as Promise<WithId<HostelDocument>[]>,
      collections.hostels.countDocuments(filter),
    ]);

    return {
      data: data.map((d) => this.format(d)),
      meta: buildPaginationMeta(page, limit, total),
    };
  }

  async findById(tenantId: string, id: string) {
    const hostel = (await collections.hostels.findOne({
      _id: new ObjectId(id),
      tenantId: new ObjectId(tenantId),
    })) as WithId<HostelDocument> | null;

    if (!hostel) {
      throw new ApiError('HOSTEL_NOT_FOUND', 'Hostel not found', 404);
    }

    return this.format(hostel);
  }

  async update(tenantId: string, id: string, data: UpdateHostelInput, updatedBy: string) {
    const tenantObjId = new ObjectId(tenantId);
    const hostelObjId = new ObjectId(id);

    const existing = (await collections.hostels.findOne({
      _id: hostelObjId,
      tenantId: tenantObjId,
    })) as WithId<HostelDocument> | null;

    if (!existing) {
      throw new ApiError('HOSTEL_NOT_FOUND', 'Hostel not found', 404);
    }

    // Validate code uniqueness if changed
    if (data.code && data.code !== existing.code) {
      const duplicate = await collections.hostels.findOne({
        tenantId: tenantObjId,
        branchId: existing.branchId,
        code: data.code,
        _id: { $ne: hostelObjId },
      });

      if (duplicate) {
        throw new ApiError(
          'DUPLICATE_CODE',
          'A hostel with this code already exists in this branch',
          409
        );
      }
    }

    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (data.name !== undefined) updateData.name = data.name;
    if (data.code !== undefined) updateData.code = data.code;
    if (data.type !== undefined) updateData.type = data.type;
    if (data.totalFloors !== undefined) updateData.totalFloors = data.totalFloors;
    if (data.floors !== undefined) updateData.floors = data.floors;
    if (data.wardenId !== undefined)
      updateData.wardenId = data.wardenId ? new ObjectId(data.wardenId) : undefined;
    if (data.wardenName !== undefined) updateData.wardenName = data.wardenName;
    if (data.amenities !== undefined) updateData.amenities = data.amenities;
    if (data.contactNumber !== undefined) updateData.contactNumber = data.contactNumber;
    if (data.email !== undefined) updateData.email = data.email;

    await collections.hostels.updateOne({ _id: hostelObjId }, { $set: updateData });

    logger.info({ hostelId: id, tenantId, updatedBy }, 'Hostel updated');

    return this.findById(tenantId, id);
  }

  async delete(tenantId: string, id: string) {
    const tenantObjId = new ObjectId(tenantId);
    const hostelObjId = new ObjectId(id);

    const hostel = await collections.hostels.findOne({
      _id: hostelObjId,
      tenantId: tenantObjId,
    });

    if (!hostel) {
      throw new ApiError('HOSTEL_NOT_FOUND', 'Hostel not found', 404);
    }

    // Verify no active allocations in this hostel
    const activeAllocations = await collections.bedAllocations.countDocuments({
      hostelId: hostelObjId,
      tenantId: tenantObjId,
      status: 'active',
    });

    if (activeAllocations > 0) {
      throw new ApiError(
        'HOSTEL_HAS_ALLOCATIONS',
        `Cannot deactivate hostel with ${activeAllocations} active allocation(s). Vacate all students first.`,
        400
      );
    }

    // Soft delete
    await collections.hostels.updateOne(
      { _id: hostelObjId },
      { $set: { status: 'inactive', updatedAt: new Date() } }
    );

    logger.info({ hostelId: id, tenantId }, 'Hostel deactivated (soft delete)');

    return { success: true };
  }

  async getStats(tenantId: string, branchId: string) {
    const tenantObjId = new ObjectId(tenantId);
    const branchObjId = new ObjectId(branchId);

    const baseFilter = {
      tenantId: tenantObjId,
      branchId: branchObjId,
      status: 'active',
    };

    const [totalHostels, byType] = await Promise.all([
      collections.hostels.countDocuments(baseFilter),
      collections.hostels
        .aggregate([
          { $match: baseFilter },
          {
            $group: {
              _id: '$type',
              count: { $sum: 1 },
              beds: { $sum: '$totalBeds' },
              occupied: { $sum: '$occupiedBeds' },
            },
          },
        ])
        .toArray(),
    ]);

    // Aggregate totals from active hostels
    const totals = await collections.hostels
      .aggregate([
        { $match: baseFilter },
        {
          $group: {
            _id: null,
            totalRooms: { $sum: '$totalRooms' },
            totalBeds: { $sum: '$totalBeds' },
            occupiedBeds: { $sum: '$occupiedBeds' },
            availableBeds: { $sum: '$availableBeds' },
          },
        },
      ])
      .toArray();

    const agg = totals[0] || { totalRooms: 0, totalBeds: 0, occupiedBeds: 0, availableBeds: 0 };

    // Per-hostel occupancy for the overview's "Occupancy by Hostel" card.
    const hostelBreakdown = await collections.hostels
      .find(baseFilter)
      .project({ name: 1, totalBeds: 1, occupiedBeds: 1 })
      .sort({ name: 1 })
      .toArray();

    return {
      totalHostels,
      totalRooms: agg.totalRooms,
      totalBeds: agg.totalBeds,
      occupiedBeds: agg.occupiedBeds,
      availableBeds: agg.availableBeds,
      occupancyRate: agg.totalBeds > 0 ? Math.round((agg.occupiedBeds / agg.totalBeds) * 100) : 0,
      hostelBreakdown: hostelBreakdown.map((h) => ({
        _id: h._id.toString(),
        name: h.name as string,
        totalBeds: (h.totalBeds as number) ?? 0,
        occupiedBeds: (h.occupiedBeds as number) ?? 0,
      })),
      byType: byType.map((t) => ({
        type: t._id as string,
        count: t.count as number,
        beds: t.beds as number,
        occupied: t.occupied as number,
      })),
    };
  }

  async recalculateCapacity(hostelId: ObjectId) {
    const rooms = await collections.rooms
      .find({
        hostelId,
        roomStatus: { $ne: 'maintenance' },
      })
      .toArray();

    let totalRooms = rooms.length;
    let totalBeds = 0;
    let occupiedBeds = 0;

    for (const room of rooms) {
      const beds = room.beds as Array<{ status: string }>;
      totalBeds += beds.length;
      occupiedBeds += beds.filter((b) => b.status === 'occupied').length;
    }

    // Also count maintenance rooms
    const maintenanceRooms = await collections.rooms.countDocuments({
      hostelId,
      roomStatus: 'maintenance',
    });
    totalRooms += maintenanceRooms;

    const availableBeds = totalBeds - occupiedBeds;

    await collections.hostels.updateOne(
      { _id: hostelId },
      {
        $set: {
          totalRooms,
          totalBeds,
          occupiedBeds,
          availableBeds,
          updatedAt: new Date(),
        },
      }
    );

    logger.debug(
      { hostelId: hostelId.toString(), totalRooms, totalBeds, occupiedBeds, availableBeds },
      'Hostel capacity recalculated'
    );
  }

  private format(doc: WithId<HostelDocument>) {
    return {
      _id: doc._id.toString(),
      tenantId: doc.tenantId.toString(),
      branchId: doc.branchId.toString(),
      name: doc.name,
      code: doc.code,
      type: doc.type,
      totalFloors: doc.totalFloors,
      floors: doc.floors,
      totalRooms: doc.totalRooms,
      totalBeds: doc.totalBeds,
      occupiedBeds: doc.occupiedBeds,
      availableBeds: doc.availableBeds,
      wardenId: doc.wardenId?.toString(),
      wardenName: doc.wardenName,
      amenities: doc.amenities,
      status: doc.status,
      contactNumber: doc.contactNumber,
      email: doc.email,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }
}

export const hostelService = new HostelService();
