import { ObjectId, Filter, Document, WithId } from 'mongodb';
import { collections } from '../../config/database';
import { logger } from '../../lib/logger';
import { ApiError } from '../../middleware/errorHandler';
import { CreateVaccinationInput, UpdateVaccinationInput, AdministerVaccinationInput, VaccinationQueryInput } from '@campus-verse/shared/schemas';
import { withPeople } from '../../utils/people';

interface VaccinationDocument extends Document {
  _id: ObjectId;
  tenantId: ObjectId;
  branchId: ObjectId;
  healthRecordId: ObjectId;
  personType: 'student' | 'staff';
  personId: ObjectId;
  personName?: string;
  vaccineName: string;
  vaccineCode?: string;
  manufacturer?: string;
  batchNumber?: string;
  doseNumber: number;
  totalDoses?: number;
  scheduledDate?: Date;
  administeredDate?: Date;
  administeredBy?: string;
  administeredAt?: string;
  status: 'scheduled' | 'completed' | 'missed' | 'overdue' | 'exempt';
  exemptionReason?: string;
  sideEffects?: string[];
  sideEffectSeverity?: string;
  nextDoseDate?: Date;
  notes?: string;
  verifiedBy?: ObjectId;
  verifiedAt?: Date;
  createdBy: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

class VaccinationService {
  async create(tenantId: string, branchId: string, data: CreateVaccinationInput, createdBy: string) {
    const tenantObjId = new ObjectId(tenantId);
    const branchObjId = new ObjectId(branchId);

    // Verify health record exists
    const healthRecord = await collections.healthRecords.findOne({
      _id: new ObjectId(data.healthRecordId),
      tenantId: tenantObjId,
    });

    if (!healthRecord) {
      throw new ApiError('HEALTH_RECORD_NOT_FOUND', 'Health record not found', 404);
    }

    const vaccinationId = new ObjectId();
    const now = new Date();

    const vaccination: Omit<VaccinationDocument, '_id'> & { _id: ObjectId } = {
      _id: vaccinationId,
      tenantId: tenantObjId,
      branchId: branchObjId,
      healthRecordId: new ObjectId(data.healthRecordId),
      personType: data.personType,
      personId: new ObjectId(data.personId),
      personName: healthRecord.personName as string,
      vaccineName: data.vaccineName,
      vaccineCode: data.vaccineCode,
      manufacturer: data.manufacturer,
      batchNumber: data.batchNumber,
      doseNumber: data.doseNumber,
      totalDoses: data.totalDoses,
      scheduledDate: data.scheduledDate ? new Date(data.scheduledDate) : undefined,
      administeredDate: data.administeredDate ? new Date(data.administeredDate) : undefined,
      administeredBy: data.administeredBy,
      administeredAt: data.administeredAt,
      status: data.status || 'scheduled',
      exemptionReason: data.exemptionReason,
      nextDoseDate: data.nextDoseDate ? new Date(data.nextDoseDate) : undefined,
      notes: data.notes,
      createdBy: new ObjectId(createdBy),
      createdAt: now,
      updatedAt: now,
    };

    // Set status to completed if already administered
    if (vaccination.administeredDate) {
      vaccination.status = 'completed';
    }

    await collections.vaccinations.insertOne(vaccination);

    // Update health record vaccination info
    await collections.healthRecords.updateOne(
      { _id: new ObjectId(data.healthRecordId) },
      {
        $set: {
          lastVaccinationDate: vaccination.administeredDate || now,
          updatedAt: now,
        },
      }
    );

    logger.info({ vaccinationId: vaccinationId.toString(), personId: data.personId, vaccineName: data.vaccineName, tenantId }, 'Vaccination record created');

    return this.formatVaccination(vaccination as WithId<VaccinationDocument>);
  }

  async findById(tenantId: string, vaccinationId: string) {
    const vaccination = await collections.vaccinations.findOne({
      _id: new ObjectId(vaccinationId),
      tenantId: new ObjectId(tenantId),
    }) as WithId<VaccinationDocument> | null;

    if (!vaccination) {
      throw new ApiError('VACCINATION_NOT_FOUND', 'Vaccination record not found', 404);
    }

    return (await withPeople([this.formatVaccination(vaccination)], 'personId'))[0];
  }

  async findAll(tenantId: string, branchId: string, params: VaccinationQueryInput) {
    const { page = 1, limit = 20, search, personType, personId, healthRecordId, vaccineName, status, fromDate, toDate } = params;

    const filter: Filter<Document> = {
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
    };

    if (personType) filter.personType = personType;
    if (personId) filter.personId = new ObjectId(personId);
    if (healthRecordId) filter.healthRecordId = new ObjectId(healthRecordId);
    if (vaccineName) filter.vaccineName = { $regex: vaccineName, $options: 'i' };
    if (status) filter.status = status;

    if (search) {
      filter.$or = [
        { personName: { $regex: search, $options: 'i' } },
        { vaccineName: { $regex: search, $options: 'i' } },
      ];
    }

    if (fromDate || toDate) {
      const dateFilter: Record<string, Date> = {};
      if (fromDate) dateFilter.$gte = new Date(fromDate);
      if (toDate) dateFilter.$lte = new Date(toDate);
      filter.$or = [
        { scheduledDate: dateFilter },
        { administeredDate: dateFilter },
      ];
    }

    const skip = (page - 1) * limit;

    const [vaccinations, total] = await Promise.all([
      collections.vaccinations
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .toArray() as Promise<WithId<VaccinationDocument>[]>,
      collections.vaccinations.countDocuments(filter),
    ]);

    return {
      data: await withPeople(vaccinations.map((v) => this.formatVaccination(v)), 'personId'),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: skip + vaccinations.length < total,
      },
    };
  }

  async update(tenantId: string, vaccinationId: string, data: UpdateVaccinationInput) {
    const existing = await collections.vaccinations.findOne({
      _id: new ObjectId(vaccinationId),
      tenantId: new ObjectId(tenantId),
    });

    if (!existing) {
      throw new ApiError('VACCINATION_NOT_FOUND', 'Vaccination record not found', 404);
    }

    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (data.vaccineName) updateData.vaccineName = data.vaccineName;
    if (data.vaccineCode !== undefined) updateData.vaccineCode = data.vaccineCode;
    if (data.manufacturer !== undefined) updateData.manufacturer = data.manufacturer;
    if (data.batchNumber !== undefined) updateData.batchNumber = data.batchNumber;
    if (data.doseNumber !== undefined) updateData.doseNumber = data.doseNumber;
    if (data.totalDoses !== undefined) updateData.totalDoses = data.totalDoses;
    if (data.scheduledDate) updateData.scheduledDate = new Date(data.scheduledDate);
    if (data.administeredDate) updateData.administeredDate = new Date(data.administeredDate);
    if (data.administeredBy !== undefined) updateData.administeredBy = data.administeredBy;
    if (data.administeredAt !== undefined) updateData.administeredAt = data.administeredAt;
    if (data.status) updateData.status = data.status;
    if (data.exemptionReason !== undefined) updateData.exemptionReason = data.exemptionReason;
    if (data.nextDoseDate) updateData.nextDoseDate = new Date(data.nextDoseDate);
    if (data.notes !== undefined) updateData.notes = data.notes;

    await collections.vaccinations.updateOne(
      { _id: new ObjectId(vaccinationId) },
      { $set: updateData }
    );

    logger.info({ vaccinationId, tenantId }, 'Vaccination record updated');

    return this.findById(tenantId, vaccinationId);
  }

  async administer(tenantId: string, vaccinationId: string, data: AdministerVaccinationInput, administeredByUserId: string) {
    const existing = await collections.vaccinations.findOne({
      _id: new ObjectId(vaccinationId),
      tenantId: new ObjectId(tenantId),
    }) as WithId<VaccinationDocument> | null;

    if (!existing) {
      throw new ApiError('VACCINATION_NOT_FOUND', 'Vaccination record not found', 404);
    }

    if (existing.status === 'completed') {
      throw new ApiError('ALREADY_ADMINISTERED', 'This vaccination has already been administered', 400);
    }

    const now = new Date();

    const updateData: Record<string, unknown> = {
      administeredDate: new Date(data.administeredDate),
      administeredBy: data.administeredBy,
      administeredAt: data.administeredAt,
      batchNumber: data.batchNumber || existing.batchNumber,
      status: 'completed',
      sideEffects: data.sideEffects,
      sideEffectSeverity: data.sideEffectSeverity,
      nextDoseDate: data.nextDoseDate ? new Date(data.nextDoseDate) : undefined,
      notes: data.notes,
      verifiedBy: new ObjectId(administeredByUserId),
      verifiedAt: now,
      updatedAt: now,
    };

    await collections.vaccinations.updateOne(
      { _id: new ObjectId(vaccinationId) },
      { $set: updateData }
    );

    // Update health record
    await collections.healthRecords.updateOne(
      { _id: existing.healthRecordId },
      {
        $set: {
          lastVaccinationDate: new Date(data.administeredDate),
          updatedAt: now,
        },
      }
    );

    logger.info({ vaccinationId, tenantId, administeredByUserId }, 'Vaccination administered');

    return this.findById(tenantId, vaccinationId);
  }

  async getDueVaccinations(tenantId: string, branchId: string, daysAhead: number = 30) {
    const tenantObjId = new ObjectId(tenantId);
    const branchObjId = new ObjectId(branchId);
    const now = new Date();
    const futureDate = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);

    const filter: Filter<Document> = {
      tenantId: tenantObjId,
      branchId: branchObjId,
      status: 'scheduled',
      scheduledDate: {
        $lte: futureDate,
      },
    };

    const vaccinations = await collections.vaccinations
      .find(filter)
      .sort({ scheduledDate: 1 })
      .limit(100)
      .toArray() as WithId<VaccinationDocument>[];

    // Separate into due soon and overdue
    const dueSoon = vaccinations.filter((v) => v.scheduledDate && v.scheduledDate >= now);
    const overdue = vaccinations.filter((v) => v.scheduledDate && v.scheduledDate < now);

    return {
      dueSoon: dueSoon.map((v) => this.formatVaccination(v)),
      overdue: overdue.map((v) => this.formatVaccination(v)),
      totalDue: dueSoon.length,
      totalOverdue: overdue.length,
    };
  }

  async getStats(tenantId: string, branchId: string) {
    const tenantObjId = new ObjectId(tenantId);
    const branchObjId = new ObjectId(branchId);

    const baseFilter = {
      tenantId: tenantObjId,
      branchId: branchObjId,
    };

    const now = new Date();

    const [totalVaccinations, completedVaccinations, scheduledVaccinations, overdueVaccinations, exemptVaccinations, vaccineCoverage] = await Promise.all([
      collections.vaccinations.countDocuments(baseFilter),
      collections.vaccinations.countDocuments({ ...baseFilter, status: 'completed' }),
      collections.vaccinations.countDocuments({ ...baseFilter, status: 'scheduled' }),
      collections.vaccinations.countDocuments({
        ...baseFilter,
        $or: [{ status: 'overdue' }, { status: 'scheduled', scheduledDate: { $lt: now } }],
      }),
      collections.vaccinations.countDocuments({ ...baseFilter, status: 'exempt' }),
      collections.vaccinations.aggregate([
        { $match: baseFilter },
        {
          $group: {
            _id: '$vaccineName',
            total: { $sum: 1 },
            completed: {
              $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] },
            },
          },
        },
      ]).toArray(),
    ]);

    const complianceRate = totalVaccinations > 0
      ? Math.round((completedVaccinations / totalVaccinations) * 100)
      : 0;

    const vaccineCoverageMap: Record<string, { total: number; completed: number }> = {};
    for (const vc of vaccineCoverage) {
      vaccineCoverageMap[vc._id as string] = {
        total: vc.total,
        completed: vc.completed,
      };
    }

    return {
      totalVaccinations,
      completedVaccinations,
      scheduledVaccinations,
      overdueVaccinations,
      exemptVaccinations,
      complianceRate,
      vaccineCoverage: vaccineCoverageMap,
    };
  }

  async markOverdue(tenantId: string, branchId: string) {
    const now = new Date();

    const result = await collections.vaccinations.updateMany(
      {
        tenantId: new ObjectId(tenantId),
        branchId: new ObjectId(branchId),
        status: 'scheduled',
        scheduledDate: { $lt: now },
      },
      {
        $set: {
          status: 'overdue',
          updatedAt: now,
        },
      }
    );

    logger.info({ tenantId, branchId, updatedCount: result.modifiedCount }, 'Marked overdue vaccinations');

    return { updatedCount: result.modifiedCount };
  }

  async delete(tenantId: string, vaccinationId: string) {
    const vaccination = await collections.vaccinations.findOne({
      _id: new ObjectId(vaccinationId),
      tenantId: new ObjectId(tenantId),
    });

    if (!vaccination) {
      throw new ApiError('VACCINATION_NOT_FOUND', 'Vaccination record not found', 404);
    }

    await collections.vaccinations.deleteOne({ _id: new ObjectId(vaccinationId) });

    logger.info({ vaccinationId, tenantId }, 'Vaccination record deleted');

    return { success: true };
  }

  private formatVaccination(vaccination: WithId<VaccinationDocument>) {
    return {
      _id: vaccination._id.toString(),
      tenantId: vaccination.tenantId.toString(),
      branchId: vaccination.branchId.toString(),
      healthRecordId: vaccination.healthRecordId.toString(),
      personType: vaccination.personType,
      personId: vaccination.personId.toString(),
      personName: vaccination.personName,
      vaccineName: vaccination.vaccineName,
      vaccineCode: vaccination.vaccineCode,
      manufacturer: vaccination.manufacturer,
      batchNumber: vaccination.batchNumber,
      doseNumber: vaccination.doseNumber,
      totalDoses: vaccination.totalDoses,
      scheduledDate: vaccination.scheduledDate,
      administeredDate: vaccination.administeredDate,
      administeredBy: vaccination.administeredBy,
      administeredAt: vaccination.administeredAt,
      status: vaccination.status,
      exemptionReason: vaccination.exemptionReason,
      sideEffects: vaccination.sideEffects,
      sideEffectSeverity: vaccination.sideEffectSeverity,
      nextDoseDate: vaccination.nextDoseDate,
      notes: vaccination.notes,
      verifiedBy: vaccination.verifiedBy?.toString(),
      verifiedAt: vaccination.verifiedAt,
      createdAt: vaccination.createdAt,
      updatedAt: vaccination.updatedAt,
    };
  }
}

export const vaccinationService = new VaccinationService();
