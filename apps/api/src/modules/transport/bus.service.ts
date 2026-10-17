import { ObjectId, Filter, Document, WithId } from 'mongodb';
import { collections } from '../../config/database';
import { logger } from '../../lib/logger';
import { ApiError } from '../../middleware/errorHandler';
import { getPagination, buildPaginationMeta } from '../../utils/pagination';
import { generateAssetCode } from '../../utils/generators';
import {
  CreateBusInput,
  UpdateBusInput,
  BusQueryInput,
  BusStopInput,
} from '@campus-verse/shared/schemas';

interface StopDocument {
  _id: ObjectId;
  name: string;
  address?: string;
  placeId?: string;
  location: { lat: number; lng: number };
  sequence: number;
  pickupTime?: string;
  dropTime?: string;
  fare?: number;
  enrolledStudents: number;
}

interface BusDocument extends Document {
  _id: ObjectId;
  tenantId: ObjectId;
  branchId: ObjectId;
  busNumber: string;
  name: string;
  type: 'mini' | 'standard' | 'luxury' | 'van';
  capacity: number;
  driverName?: string;
  driverPhone?: string;
  conductorName?: string;
  conductorPhone?: string;
  vehicleRegistration?: string;
  startLocation: {
    name: string;
    address?: string;
    placeId?: string;
    location: { lat: number; lng: number };
  };
  stops: StopDocument[];
  routePolyline?: string;
  totalDistanceMeters?: number;
  totalDurationSeconds?: number;
  pricing: {
    mode: 'flat' | 'per_stop';
    flatPrice?: number;
    currency: string;
    frequency: 'monthly' | 'quarterly' | 'yearly';
  };
  enrolledCount: number;
  status: 'active' | 'inactive';
  notes?: string;
  createdBy: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

function normalizeStops(stops: BusStopInput[]): StopDocument[] {
  return stops
    .slice()
    .sort((a, b) => a.sequence - b.sequence)
    .map((s, idx) => ({
      _id: s._id && ObjectId.isValid(s._id) ? new ObjectId(s._id) : new ObjectId(),
      name: s.name,
      address: s.address,
      placeId: s.placeId,
      location: s.location,
      sequence: idx,
      pickupTime: s.pickupTime,
      dropTime: s.dropTime,
      fare: s.fare,
      enrolledStudents: 0,
    }));
}

function mergeStops(existing: StopDocument[], incoming: BusStopInput[]): StopDocument[] {
  const byId = new Map(existing.map((s) => [s._id.toString(), s]));
  return incoming
    .slice()
    .sort((a, b) => a.sequence - b.sequence)
    .map((s, idx) => {
      const prev = s._id && byId.get(s._id) ? byId.get(s._id!)! : null;
      return {
        _id: prev ? prev._id : new ObjectId(),
        name: s.name,
        address: s.address,
        placeId: s.placeId,
        location: s.location,
        sequence: idx,
        pickupTime: s.pickupTime,
        dropTime: s.dropTime,
        fare: s.fare,
        enrolledStudents: prev ? prev.enrolledStudents : 0,
      };
    });
}

/**
 * Keep an Inventory asset record in sync with each transport bus. One asset per bus,
 * keyed by (sourceModule='transport', sourceId=busId). Failures are logged but never
 * thrown — transport is the source of truth, inventory mirroring is best-effort.
 */
async function syncBusToAsset(
  tenantObjId: ObjectId,
  branchObjId: ObjectId,
  busId: ObjectId,
  data: { busNumber: string; name: string; type: string; vehicleRegistration?: string },
  userId: string
): Promise<void> {
  try {
    const name = `${data.busNumber} · ${data.name}`;
    const existing = await collections.assets.findOne({
      tenantId: tenantObjId,
      sourceModule: 'transport',
      sourceId: busId,
    });
    const now = new Date();

    if (existing) {
      await collections.assets.updateOne(
        { _id: existing._id },
        {
          $set: {
            name,
            serialNumber: data.vehicleRegistration || null,
            tags: ['vehicle', 'bus', data.type],
            updatedAt: now,
          },
        }
      );
    } else {
      const assetCode = await generateAssetCode(tenantObjId.toString(), branchObjId.toString());
      await collections.assets.insertOne({
        tenantId: tenantObjId,
        branchId: branchObjId,
        assetCode,
        name,
        description: 'Auto-created from Transport module',
        categoryId: null,
        categoryName: 'Vehicle',
        location: null,
        serialNumber: data.vehicleRegistration || null,
        modelNumber: null,
        manufacturer: null,
        purchaseDate: null,
        purchasePrice: 0,
        currentValue: 0,
        warrantyExpiry: null,
        condition: 'good',
        status: 'available',
        assignedTo: null,
        tags: ['vehicle', 'bus', data.type],
        quantity: 1,
        unit: 'vehicle',
        sourceModule: 'transport',
        sourceId: busId,
        createdBy: new ObjectId(userId),
        createdAt: now,
        updatedAt: now,
      });
    }
  } catch (err) {
    logger.error(
      { err, busId: busId.toString(), tenantId: tenantObjId.toString() },
      'Failed to sync bus to inventory asset'
    );
  }
}

async function disposeBusAsset(tenantObjId: ObjectId, busId: ObjectId): Promise<void> {
  try {
    await collections.assets.updateOne(
      {
        tenantId: tenantObjId,
        sourceModule: 'transport',
        sourceId: busId,
      },
      {
        $set: {
          status: 'disposed',
          condition: 'disposed',
          updatedAt: new Date(),
        },
      }
    );
  } catch (err) {
    logger.error(
      { err, busId: busId.toString(), tenantId: tenantObjId.toString() },
      'Failed to dispose bus asset'
    );
  }
}

class BusService {
  async create(tenantId: string, branchId: string, data: CreateBusInput, createdBy: string) {
    const tenantObjId = new ObjectId(tenantId);
    const branchObjId = new ObjectId(branchId);

    const existing = await collections.transportBuses.findOne({
      tenantId: tenantObjId,
      branchId: branchObjId,
      busNumber: data.busNumber,
    });

    if (existing) {
      throw new ApiError(
        'DUPLICATE_BUS_NUMBER',
        'A bus with this number already exists in this branch',
        409
      );
    }

    const now = new Date();
    const busId = new ObjectId();

    const bus: BusDocument = {
      _id: busId,
      tenantId: tenantObjId,
      branchId: branchObjId,
      busNumber: data.busNumber,
      name: data.name,
      type: data.type,
      capacity: data.capacity,
      driverName: data.driverName,
      driverPhone: data.driverPhone,
      conductorName: data.conductorName,
      conductorPhone: data.conductorPhone,
      vehicleRegistration: data.vehicleRegistration,
      startLocation: data.startLocation,
      stops: normalizeStops(data.stops ?? []),
      routePolyline: data.routePolyline,
      totalDistanceMeters: data.totalDistanceMeters,
      totalDurationSeconds: data.totalDurationSeconds,
      pricing: {
        mode: data.pricing.mode,
        flatPrice: data.pricing.flatPrice,
        currency: data.pricing.currency || 'INR',
        frequency: data.pricing.frequency || 'monthly',
      },
      enrolledCount: 0,
      status: 'active',
      notes: data.notes,
      createdBy: new ObjectId(createdBy),
      createdAt: now,
      updatedAt: now,
    };

    await collections.transportBuses.insertOne(bus);

    logger.info(
      { busId: busId.toString(), busNumber: data.busNumber, tenantId },
      'Transport bus created'
    );

    await syncBusToAsset(
      tenantObjId,
      branchObjId,
      busId,
      {
        busNumber: data.busNumber,
        name: data.name,
        type: data.type,
        vehicleRegistration: data.vehicleRegistration,
      },
      createdBy
    );

    return this.format(bus as WithId<BusDocument>);
  }

  async findAll(tenantId: string, branchId: string, query: BusQueryInput) {
    const { page, limit, sortBy, sortOrder } = getPagination(query as Record<string, unknown>);
    const skip = (page - 1) * limit;

    const filter: Filter<Document> = {
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
    };

    if (query.search) {
      filter.$or = [
        { name: { $regex: query.search, $options: 'i' } },
        { busNumber: { $regex: query.search, $options: 'i' } },
        { vehicleRegistration: { $regex: query.search, $options: 'i' } },
      ];
    }

    if (query.type) filter.type = query.type;
    if (query.pricingMode) filter['pricing.mode'] = query.pricingMode;

    if (query.status) {
      filter.status = query.status;
    } else {
      filter.status = 'active';
    }

    const [data, total] = await Promise.all([
      collections.transportBuses
        .find(filter)
        .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1, _id: sortOrder === 'asc' ? 1 : -1 })
        .skip(skip)
        .limit(limit)
        .toArray() as Promise<WithId<BusDocument>[]>,
      collections.transportBuses.countDocuments(filter),
    ]);

    return {
      data: data.map((d) => this.format(d)),
      meta: buildPaginationMeta(page, limit, total),
    };
  }

  async findById(tenantId: string, id: string) {
    const bus = (await collections.transportBuses.findOne({
      _id: new ObjectId(id),
      tenantId: new ObjectId(tenantId),
    })) as WithId<BusDocument> | null;

    if (!bus) {
      throw new ApiError('BUS_NOT_FOUND', 'Bus not found', 404);
    }

    return this.format(bus);
  }

  async update(tenantId: string, id: string, data: UpdateBusInput, updatedBy: string) {
    const tenantObjId = new ObjectId(tenantId);
    const busObjId = new ObjectId(id);

    const existing = (await collections.transportBuses.findOne({
      _id: busObjId,
      tenantId: tenantObjId,
    })) as WithId<BusDocument> | null;

    if (!existing) {
      throw new ApiError('BUS_NOT_FOUND', 'Bus not found', 404);
    }

    if (data.busNumber && data.busNumber !== existing.busNumber) {
      const duplicate = await collections.transportBuses.findOne({
        tenantId: tenantObjId,
        branchId: existing.branchId,
        busNumber: data.busNumber,
        _id: { $ne: busObjId },
      });

      if (duplicate) {
        throw new ApiError(
          'DUPLICATE_BUS_NUMBER',
          'A bus with this number already exists in this branch',
          409
        );
      }
    }

    if (data.capacity !== undefined && data.capacity < existing.enrolledCount) {
      throw new ApiError(
        'CAPACITY_BELOW_ENROLLED',
        `Cannot set capacity below current enrolled students (${existing.enrolledCount})`,
        400
      );
    }

    const updateData: Record<string, unknown> = { updatedAt: new Date() };

    if (data.busNumber !== undefined) updateData.busNumber = data.busNumber;
    if (data.name !== undefined) updateData.name = data.name;
    if (data.type !== undefined) updateData.type = data.type;
    if (data.capacity !== undefined) updateData.capacity = data.capacity;
    if (data.driverName !== undefined) updateData.driverName = data.driverName;
    if (data.driverPhone !== undefined) updateData.driverPhone = data.driverPhone;
    if (data.conductorName !== undefined) updateData.conductorName = data.conductorName;
    if (data.conductorPhone !== undefined) updateData.conductorPhone = data.conductorPhone;
    if (data.vehicleRegistration !== undefined)
      updateData.vehicleRegistration = data.vehicleRegistration;
    if (data.startLocation !== undefined) updateData.startLocation = data.startLocation;
    if (data.routePolyline !== undefined) updateData.routePolyline = data.routePolyline;
    if (data.totalDistanceMeters !== undefined)
      updateData.totalDistanceMeters = data.totalDistanceMeters;
    if (data.totalDurationSeconds !== undefined)
      updateData.totalDurationSeconds = data.totalDurationSeconds;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.notes !== undefined) updateData.notes = data.notes;

    if (data.pricing !== undefined) {
      updateData.pricing = {
        mode: data.pricing.mode,
        flatPrice: data.pricing.flatPrice,
        currency: data.pricing.currency || existing.pricing.currency || 'INR',
        frequency: data.pricing.frequency || existing.pricing.frequency || 'monthly',
      };
    }

    if (data.stops !== undefined) {
      updateData.stops = mergeStops(existing.stops, data.stops);
    }

    await collections.transportBuses.updateOne({ _id: busObjId }, { $set: updateData });

    logger.info({ busId: id, tenantId, updatedBy }, 'Transport bus updated');

    // Re-sync linked inventory asset if any of the identifying fields changed.
    if (
      data.busNumber !== undefined ||
      data.name !== undefined ||
      data.type !== undefined ||
      data.vehicleRegistration !== undefined
    ) {
      await syncBusToAsset(
        tenantObjId,
        existing.branchId,
        busObjId,
        {
          busNumber: data.busNumber ?? existing.busNumber,
          name: data.name ?? existing.name,
          type: data.type ?? existing.type,
          vehicleRegistration:
            data.vehicleRegistration !== undefined
              ? data.vehicleRegistration
              : existing.vehicleRegistration,
        },
        updatedBy
      );
    }

    return this.findById(tenantId, id);
  }

  async delete(tenantId: string, id: string) {
    const tenantObjId = new ObjectId(tenantId);
    const busObjId = new ObjectId(id);

    const bus = await collections.transportBuses.findOne({
      _id: busObjId,
      tenantId: tenantObjId,
    });

    if (!bus) {
      throw new ApiError('BUS_NOT_FOUND', 'Bus not found', 404);
    }

    const activeEnrollments = await collections.transportEnrollments.countDocuments({
      busId: busObjId,
      tenantId: tenantObjId,
      status: 'active',
    });

    if (activeEnrollments > 0) {
      throw new ApiError(
        'BUS_HAS_ENROLLMENTS',
        `Cannot deactivate bus with ${activeEnrollments} active enrollment(s). Withdraw all students first.`,
        400
      );
    }

    await collections.transportBuses.updateOne(
      { _id: busObjId },
      { $set: { status: 'inactive', updatedAt: new Date() } }
    );

    logger.info({ busId: id, tenantId }, 'Transport bus deactivated');

    await disposeBusAsset(tenantObjId, busObjId);

    return { success: true };
  }

  async getStats(tenantId: string, branchId: string) {
    const tenantObjId = new ObjectId(tenantId);
    const branchObjId = new ObjectId(branchId);

    const baseFilter = {
      tenantId: tenantObjId,
      branchId: branchObjId,
    };

    const [totalBuses, activeBuses, totals] = await Promise.all([
      collections.transportBuses.countDocuments(baseFilter),
      collections.transportBuses.countDocuments({ ...baseFilter, status: 'active' }),
      collections.transportBuses
        .aggregate([
          { $match: { ...baseFilter, status: 'active' } },
          {
            $group: {
              _id: null,
              totalCapacity: { $sum: '$capacity' },
              totalEnrolled: { $sum: '$enrolledCount' },
              totalStops: { $sum: { $size: { $ifNull: ['$stops', []] } } },
            },
          },
        ])
        .toArray(),
    ]);

    const agg = totals[0] || { totalCapacity: 0, totalEnrolled: 0, totalStops: 0 };

    return {
      totalBuses,
      activeBuses,
      totalCapacity: agg.totalCapacity as number,
      totalEnrolled: agg.totalEnrolled as number,
      availableSeats: (agg.totalCapacity as number) - (agg.totalEnrolled as number),
      occupancyRate:
        (agg.totalCapacity as number) > 0
          ? Math.round(((agg.totalEnrolled as number) / (agg.totalCapacity as number)) * 100)
          : 0,
      totalStops: agg.totalStops as number,
    };
  }

  format(doc: WithId<BusDocument>) {
    return {
      _id: doc._id.toString(),
      tenantId: doc.tenantId.toString(),
      branchId: doc.branchId.toString(),
      busNumber: doc.busNumber,
      name: doc.name,
      type: doc.type,
      capacity: doc.capacity,
      driverName: doc.driverName,
      driverPhone: doc.driverPhone,
      conductorName: doc.conductorName,
      conductorPhone: doc.conductorPhone,
      vehicleRegistration: doc.vehicleRegistration,
      startLocation: doc.startLocation,
      stops: (doc.stops || []).map((s) => ({
        _id: s._id.toString(),
        name: s.name,
        address: s.address,
        placeId: s.placeId,
        location: s.location,
        sequence: s.sequence,
        pickupTime: s.pickupTime,
        dropTime: s.dropTime,
        fare: s.fare,
        enrolledStudents: s.enrolledStudents || 0,
      })),
      routePolyline: doc.routePolyline,
      totalDistanceMeters: doc.totalDistanceMeters,
      totalDurationSeconds: doc.totalDurationSeconds,
      pricing: doc.pricing,
      enrolledCount: doc.enrolledCount || 0,
      status: doc.status,
      notes: doc.notes,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }
}

export const busService = new BusService();
