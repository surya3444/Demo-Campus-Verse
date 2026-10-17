import { ObjectId, Filter, Document, WithId } from 'mongodb';
import { collections } from '../../config/database';
import { logger } from '../../lib/logger';
import { transportFeeService } from './transportFee.service';
import { ApiError } from '../../middleware/errorHandler';
import { getPagination, buildPaginationMeta } from '../../utils/pagination';
import {
  CreateTransportEnrollmentInput,
  UpdateTransportEnrollmentInput,
  WithdrawEnrollmentInput,
  TransportEnrollmentQueryInput,
} from '@campus-verse/shared/schemas';

interface EnrollmentDocument extends Document {
  _id: ObjectId;
  tenantId: ObjectId;
  branchId: ObjectId;
  busId: ObjectId;
  busNumber?: string;
  busName?: string;
  stopId: ObjectId;
  stopName?: string;
  pickupTime?: string;
  dropTime?: string;
  studentId: ObjectId;
  studentName?: string;
  admissionNumber?: string;
  classId?: ObjectId;
  className?: string;
  sectionId?: ObjectId;
  sectionName?: string;
  pickupEnabled: boolean;
  dropEnabled: boolean;
  startDate: Date;
  endDate?: Date;
  priceSnapshot: number;
  frequencySnapshot: 'monthly' | 'quarterly' | 'yearly';
  pricingModeSnapshot: 'flat' | 'per_stop';
  currencySnapshot: string;
  status: 'active' | 'withdrawn' | 'transferred';
  withdrawnAt?: Date;
  withdrawnReason?: string;
  createdBy: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

class EnrollmentService {
  async create(
    tenantId: string,
    branchId: string,
    data: CreateTransportEnrollmentInput,
    createdBy: string
  ) {
    const tenantObjId = new ObjectId(tenantId);
    const branchObjId = new ObjectId(branchId);
    const busObjId = new ObjectId(data.busId);
    const studentObjId = new ObjectId(data.studentId);

    const bus = await collections.transportBuses.findOne({
      _id: busObjId,
      tenantId: tenantObjId,
      branchId: branchObjId,
      status: 'active',
    });

    if (!bus) {
      throw new ApiError('BUS_NOT_FOUND', 'Bus not found or inactive', 404);
    }

    if ((bus.enrolledCount || 0) >= bus.capacity) {
      throw new ApiError(
        'BUS_FULL',
        `Bus capacity (${bus.capacity}) reached. Cannot enroll more students.`,
        400
      );
    }

    const stop = (
      bus.stops as Array<{
        _id: ObjectId;
        name: string;
        fare?: number;
        pickupTime?: string;
        dropTime?: string;
      }>
    ).find((s) => s._id.toString() === data.stopId);

    if (!stop) {
      throw new ApiError('STOP_NOT_FOUND', 'Stop not found on this bus route', 404);
    }

    const existingActive = await collections.transportEnrollments.findOne({
      tenantId: tenantObjId,
      studentId: studentObjId,
      status: 'active',
    });

    if (existingActive) {
      throw new ApiError(
        'STUDENT_ALREADY_ENROLLED',
        'Student already has an active transport enrollment. Withdraw first.',
        409
      );
    }

    const student = await collections.students.findOne({
      _id: studentObjId,
      tenantId: tenantObjId,
    });

    if (!student) {
      throw new ApiError('STUDENT_NOT_FOUND', 'Student not found', 404);
    }

    const pricing = bus.pricing as {
      mode: 'flat' | 'per_stop';
      flatPrice?: number;
      currency: string;
      frequency: 'monthly' | 'quarterly' | 'yearly';
    };

    let priceSnapshot: number;
    if (typeof data.priceOverride === 'number') {
      priceSnapshot = data.priceOverride;
    } else if (pricing.mode === 'flat') {
      priceSnapshot = pricing.flatPrice ?? 0;
    } else {
      priceSnapshot = stop.fare ?? 0;
    }

    const now = new Date();
    const enrollmentId = new ObjectId();

    const studentName = `${student.firstName as string} ${student.lastName as string}`.trim();
    const current = student.currentEnrollment as
      | { classId?: ObjectId; className?: string; sectionId?: ObjectId; sectionName?: string }
      | undefined;

    const enrollment: EnrollmentDocument = {
      _id: enrollmentId,
      tenantId: tenantObjId,
      branchId: branchObjId,
      busId: busObjId,
      busNumber: bus.busNumber as string,
      busName: bus.name as string,
      stopId: new ObjectId(data.stopId),
      stopName: stop.name,
      pickupTime: stop.pickupTime,
      dropTime: stop.dropTime,
      studentId: studentObjId,
      studentName,
      admissionNumber: student.admissionNumber as string | undefined,
      classId: current?.classId,
      className: current?.className,
      sectionId: current?.sectionId,
      sectionName: current?.sectionName,
      pickupEnabled: data.pickupEnabled ?? true,
      dropEnabled: data.dropEnabled ?? true,
      startDate: data.startDate ?? now,
      priceSnapshot,
      frequencySnapshot: pricing.frequency,
      pricingModeSnapshot: pricing.mode,
      currencySnapshot: pricing.currency,
      status: 'active',
      createdBy: new ObjectId(createdBy),
      createdAt: now,
      updatedAt: now,
    };

    await collections.transportEnrollments.insertOne(enrollment);

    await collections.transportBuses.updateOne(
      { _id: busObjId, 'stops._id': new ObjectId(data.stopId) },
      {
        $inc: { enrolledCount: 1, 'stops.$.enrolledStudents': 1 },
        $set: { updatedAt: now },
      }
    );

    logger.info(
      { enrollmentId: enrollmentId.toString(), busId: data.busId, studentId: data.studentId },
      'Transport enrollment created'
    );

    // Bill it, like a hostel bed; a billing failure must not undo the seat.
    await transportFeeService
      .createFeeForEnrollment(tenantId, branchId, enrollment, createdBy)
      .catch((err) =>
        logger.error(
          { err, enrollmentId: enrollmentId.toString() },
          'Failed to create transport fee assignment'
        )
      );

    return this.findById(tenantId, enrollmentId.toString());
  }

  async findAll(tenantId: string, branchId: string, query: TransportEnrollmentQueryInput) {
    const { page, limit, sortBy, sortOrder } = getPagination(query as Record<string, unknown>);
    const skip = (page - 1) * limit;

    const filter: Filter<Document> = {
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
    };

    if (query.busId) filter.busId = new ObjectId(query.busId);
    if (query.studentId) filter.studentId = new ObjectId(query.studentId);
    if (query.classId) filter.classId = new ObjectId(query.classId);
    if (query.stopId && ObjectId.isValid(query.stopId)) filter.stopId = new ObjectId(query.stopId);

    if (query.status) {
      filter.status = query.status;
    } else {
      filter.status = 'active';
    }

    if (query.search) {
      filter.$or = [
        { studentName: { $regex: query.search, $options: 'i' } },
        { admissionNumber: { $regex: query.search, $options: 'i' } },
        { busNumber: { $regex: query.search, $options: 'i' } },
      ];
    }

    const [data, total] = await Promise.all([
      collections.transportEnrollments
        .find(filter)
        .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1, _id: sortOrder === 'asc' ? 1 : -1 })
        .skip(skip)
        .limit(limit)
        .toArray() as Promise<WithId<EnrollmentDocument>[]>,
      collections.transportEnrollments.countDocuments(filter),
    ]);

    return {
      data: data.map((d) => this.format(d)),
      meta: buildPaginationMeta(page, limit, total),
    };
  }

  async findById(tenantId: string, id: string) {
    const enrollment = (await collections.transportEnrollments.findOne({
      _id: new ObjectId(id),
      tenantId: new ObjectId(tenantId),
    })) as WithId<EnrollmentDocument> | null;

    if (!enrollment) {
      throw new ApiError('ENROLLMENT_NOT_FOUND', 'Enrollment not found', 404);
    }

    return this.format(enrollment);
  }

  async findByStudent(tenantId: string, studentId: string) {
    const enrollment = (await collections.transportEnrollments.findOne(
      {
        tenantId: new ObjectId(tenantId),
        studentId: new ObjectId(studentId),
        status: 'active',
      },
      { sort: { createdAt: -1 } }
    )) as WithId<EnrollmentDocument> | null;

    return enrollment ? this.format(enrollment) : null;
  }

  /**
   * Self-scoped lookup for the authenticated user. Resolves user → student
   * record → active transport enrollment, then enriches with the bus's full
   * route (all stops, driver contact, pricing) so a student can see the
   * context without extra calls.
   */
  async findMineByUserId(tenantId: string, userId: string) {
    const tenantObjId = new ObjectId(tenantId);
    const user = (await collections.users.findOne({
      _id: new ObjectId(userId),
      tenantId: tenantObjId,
    })) as { studentId?: ObjectId } | null;

    if (!user?.studentId) return null;

    const enrollmentDoc = (await collections.transportEnrollments.findOne(
      {
        tenantId: tenantObjId,
        studentId: user.studentId,
        status: 'active',
      },
      { sort: { createdAt: -1 } }
    )) as WithId<EnrollmentDocument> | null;

    if (!enrollmentDoc) return null;

    const enrollment = this.format(enrollmentDoc);

    const bus = await collections.transportBuses.findOne({
      _id: enrollmentDoc.busId,
      tenantId: tenantObjId,
    });

    if (!bus) return { enrollment, bus: null };

    const stops = (
      bus.stops as Array<{
        _id: ObjectId;
        name: string;
        address?: string;
        location?: { lat: number; lng: number };
        sequence: number;
        pickupTime?: string;
        dropTime?: string;
        fare?: number;
      }>
    )
      .map((s) => ({
        _id: s._id.toString(),
        name: s.name,
        address: s.address,
        location: s.location,
        sequence: s.sequence,
        pickupTime: s.pickupTime,
        dropTime: s.dropTime,
        fare: s.fare,
      }))
      .sort((a, b) => a.sequence - b.sequence);

    return {
      enrollment,
      bus: {
        _id: bus._id.toString(),
        busNumber: bus.busNumber as string,
        name: bus.name as string,
        type: bus.type as string,
        capacity: bus.capacity as number,
        driverName: bus.driverName as string | undefined,
        driverPhone: bus.driverPhone as string | undefined,
        conductorName: bus.conductorName as string | undefined,
        conductorPhone: bus.conductorPhone as string | undefined,
        vehicleRegistration: bus.vehicleRegistration as string | undefined,
        startLocation: bus.startLocation,
        stops,
        pricing: bus.pricing,
        totalDistanceMeters: bus.totalDistanceMeters as number | undefined,
        totalDurationSeconds: bus.totalDurationSeconds as number | undefined,
      },
    };
  }

  async update(tenantId: string, id: string, data: UpdateTransportEnrollmentInput) {
    const tenantObjId = new ObjectId(tenantId);
    const enrollmentObjId = new ObjectId(id);

    const existing = (await collections.transportEnrollments.findOne({
      _id: enrollmentObjId,
      tenantId: tenantObjId,
    })) as WithId<EnrollmentDocument> | null;

    if (!existing) {
      throw new ApiError('ENROLLMENT_NOT_FOUND', 'Enrollment not found', 404);
    }

    if (existing.status !== 'active') {
      throw new ApiError('ENROLLMENT_INACTIVE', 'Cannot update a non-active enrollment', 400);
    }

    const updateData: Record<string, unknown> = { updatedAt: new Date() };

    if (data.pickupEnabled !== undefined) updateData.pickupEnabled = data.pickupEnabled;
    if (data.dropEnabled !== undefined) updateData.dropEnabled = data.dropEnabled;
    if (data.endDate !== undefined) updateData.endDate = data.endDate;

    if (data.stopId !== undefined && data.stopId !== existing.stopId.toString()) {
      const bus = await collections.transportBuses.findOne({
        _id: existing.busId,
        tenantId: tenantObjId,
      });

      if (!bus) {
        throw new ApiError('BUS_NOT_FOUND', 'Bus not found', 404);
      }

      const newStop = (bus.stops as Array<{ _id: ObjectId; name: string; fare?: number }>).find(
        (s) => s._id.toString() === data.stopId
      );

      if (!newStop) {
        throw new ApiError('STOP_NOT_FOUND', 'New stop not found on this bus', 404);
      }

      const pricing = bus.pricing as { mode: 'flat' | 'per_stop'; flatPrice?: number };
      const newPrice = pricing.mode === 'per_stop' ? (newStop.fare ?? 0) : (pricing.flatPrice ?? 0);

      updateData.stopId = newStop._id;
      updateData.stopName = newStop.name;
      updateData.priceSnapshot = newPrice;

      await collections.transportBuses.updateOne(
        { _id: existing.busId, 'stops._id': existing.stopId },
        { $inc: { 'stops.$.enrolledStudents': -1 } }
      );
      await collections.transportBuses.updateOne(
        { _id: existing.busId, 'stops._id': newStop._id },
        { $inc: { 'stops.$.enrolledStudents': 1 } }
      );
    }

    await collections.transportEnrollments.updateOne(
      { _id: enrollmentObjId },
      { $set: updateData }
    );

    return this.findById(tenantId, id);
  }

  async withdraw(tenantId: string, id: string, data: WithdrawEnrollmentInput) {
    const tenantObjId = new ObjectId(tenantId);
    const enrollmentObjId = new ObjectId(id);

    const existing = (await collections.transportEnrollments.findOne({
      _id: enrollmentObjId,
      tenantId: tenantObjId,
    })) as WithId<EnrollmentDocument> | null;

    if (!existing) {
      throw new ApiError('ENROLLMENT_NOT_FOUND', 'Enrollment not found', 404);
    }

    if (existing.status !== 'active') {
      throw new ApiError('ALREADY_WITHDRAWN', 'Enrollment is not active', 400);
    }

    const now = new Date();

    await collections.transportEnrollments.updateOne(
      { _id: enrollmentObjId },
      {
        $set: {
          status: 'withdrawn',
          withdrawnAt: now,
          withdrawnReason: data.reason,
          endDate: data.effectiveDate ?? now,
          updatedAt: now,
        },
      }
    );

    await collections.transportBuses.updateOne(
      { _id: existing.busId, 'stops._id': existing.stopId },
      {
        $inc: { enrolledCount: -1, 'stops.$.enrolledStudents': -1 },
        $set: { updatedAt: now },
      }
    );

    await transportFeeService
      .handleWithdrawal(tenantId, id, data.effectiveDate ?? now)
      .catch((err) =>
        logger.error({ err, enrollmentId: id }, 'Failed to adjust transport fee on withdrawal')
      );

    logger.info({ enrollmentId: id, reason: data.reason }, 'Transport enrollment withdrawn');

    return this.findById(tenantId, id);
  }

  format(doc: WithId<EnrollmentDocument>) {
    return {
      _id: doc._id.toString(),
      tenantId: doc.tenantId.toString(),
      branchId: doc.branchId.toString(),
      busId: doc.busId.toString(),
      busNumber: doc.busNumber,
      busName: doc.busName,
      stopId: doc.stopId.toString(),
      stopName: doc.stopName,
      pickupTime: doc.pickupTime,
      dropTime: doc.dropTime,
      studentId: doc.studentId.toString(),
      studentName: doc.studentName,
      admissionNumber: doc.admissionNumber,
      classId: doc.classId?.toString(),
      className: doc.className,
      sectionId: doc.sectionId?.toString(),
      sectionName: doc.sectionName,
      pickupEnabled: doc.pickupEnabled,
      dropEnabled: doc.dropEnabled,
      startDate: doc.startDate,
      endDate: doc.endDate,
      priceSnapshot: doc.priceSnapshot,
      frequencySnapshot: doc.frequencySnapshot,
      pricingModeSnapshot: doc.pricingModeSnapshot,
      currencySnapshot: doc.currencySnapshot,
      status: doc.status,
      withdrawnAt: doc.withdrawnAt,
      withdrawnReason: doc.withdrawnReason,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }
}

export const enrollmentService = new EnrollmentService();
