import { ObjectId, Filter, Document, WithId } from 'mongodb';
import { collections } from '../../config/database';
import { logger } from '../../lib/logger';
import { ApiError } from '../../middleware/errorHandler';
import { CreateMedicalVisitInput, UpdateMedicalVisitInput, CloseMedicalVisitInput, MedicalVisitQueryInput } from '@campus-verse/shared/schemas';

interface MedicalVisitDocument extends Document {
  _id: ObjectId;
  tenantId: ObjectId;
  branchId: ObjectId;
  healthRecordId: ObjectId;
  personType: 'student' | 'staff';
  personId: ObjectId;
  personName?: string;
  visitType: string;
  visitDate: Date;
  arrivalTime: Date;
  departureTime?: Date;
  chiefComplaint: string;
  symptoms?: string[];
  symptomOnset?: Date;
  painLevel?: number;
  vitals?: Record<string, unknown>;
  diagnosis?: string;
  icdCode?: string;
  treatment?: string;
  medicationsGiven?: Array<{
    name: string;
    dosage: string;
    route: string;
    time: Date;
  }>;
  proceduresPerformed?: string[];
  isIncident?: boolean;
  incidentLocation?: string;
  incidentDescription?: string;
  incidentWitnesses?: string[];
  incidentReportFiled?: boolean;
  outcome?: string;
  outcomeNotes?: string;
  followUpRequired?: boolean;
  followUpDate?: Date;
  followUpInstructions?: string;
  parentNotified?: boolean;
  parentNotifiedAt?: Date;
  parentNotifiedBy?: ObjectId;
  attendedBy: ObjectId;
  attendedByName?: string;
  status: 'in_progress' | 'completed' | 'follow_up_required';
  notes?: string;
  closedAt?: Date;
  closedBy?: ObjectId;
  createdBy: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

class MedicalVisitService {
  async create(tenantId: string, branchId: string, data: CreateMedicalVisitInput, createdBy: string) {
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

    // Get attended by staff name
    const attendedByStaff = await collections.staff.findOne({
      _id: new ObjectId(data.attendedBy),
      tenantId: tenantObjId,
    });

    const visitId = new ObjectId();
    const now = new Date();

    const visit: Omit<MedicalVisitDocument, '_id'> & { _id: ObjectId } = {
      _id: visitId,
      tenantId: tenantObjId,
      branchId: branchObjId,
      healthRecordId: new ObjectId(data.healthRecordId),
      personType: data.personType,
      personId: new ObjectId(data.personId),
      personName: healthRecord.personName as string,
      visitType: data.visitType,
      visitDate: new Date(data.visitDate),
      arrivalTime: new Date(data.arrivalTime),
      chiefComplaint: data.chiefComplaint,
      symptoms: data.symptoms,
      symptomOnset: data.symptomOnset ? new Date(data.symptomOnset) : undefined,
      painLevel: data.painLevel,
      vitals: data.vitals,
      isIncident: data.isIncident,
      incidentLocation: data.incidentLocation,
      incidentDescription: data.incidentDescription,
      incidentWitnesses: data.incidentWitnesses,
      attendedBy: new ObjectId(data.attendedBy),
      attendedByName: attendedByStaff?.displayName as string || `${attendedByStaff?.firstName} ${attendedByStaff?.lastName}`,
      status: 'in_progress',
      notes: data.notes,
      createdBy: new ObjectId(createdBy),
      createdAt: now,
      updatedAt: now,
    };

    await collections.medicalVisits.insertOne(visit);

    logger.info({ visitId: visitId.toString(), personId: data.personId, visitType: data.visitType, tenantId }, 'Medical visit created');

    return this.formatVisit(visit as WithId<MedicalVisitDocument>);
  }

  async findById(tenantId: string, visitId: string) {
    const visit = await collections.medicalVisits.findOne({
      _id: new ObjectId(visitId),
      tenantId: new ObjectId(tenantId),
    }) as WithId<MedicalVisitDocument> | null;

    if (!visit) {
      throw new ApiError('VISIT_NOT_FOUND', 'Medical visit not found', 404);
    }

    return this.formatVisit(visit);
  }

  async findAll(tenantId: string, branchId: string, params: MedicalVisitQueryInput) {
    const { page = 1, limit = 20, search, personType, personId, healthRecordId, visitType, status, outcome, isIncident, fromDate, toDate, today } = params;

    const filter: Filter<Document> = {
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
    };

    if (personType) filter.personType = personType;
    if (personId) filter.personId = new ObjectId(personId);
    if (healthRecordId) filter.healthRecordId = new ObjectId(healthRecordId);
    if (visitType) filter.visitType = visitType;
    if (status) filter.status = status;
    if (outcome) filter.outcome = outcome;
    if (isIncident !== undefined) filter.isIncident = isIncident;

    if (search) {
      filter.$or = [
        { personName: { $regex: search, $options: 'i' } },
        { chiefComplaint: { $regex: search, $options: 'i' } },
        { diagnosis: { $regex: search, $options: 'i' } },
      ];
    }

    if (today) {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999);
      filter.visitDate = { $gte: startOfDay, $lte: endOfDay };
    } else if (fromDate || toDate) {
      filter.visitDate = {};
      if (fromDate) filter.visitDate.$gte = new Date(fromDate);
      if (toDate) filter.visitDate.$lte = new Date(toDate);
    }

    const skip = (page - 1) * limit;

    const [visits, total] = await Promise.all([
      collections.medicalVisits
        .find(filter)
        .sort({ arrivalTime: -1 })
        .skip(skip)
        .limit(limit)
        .toArray() as Promise<WithId<MedicalVisitDocument>[]>,
      collections.medicalVisits.countDocuments(filter),
    ]);

    return {
      data: visits.map((v) => this.formatVisit(v)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: skip + visits.length < total,
      },
    };
  }

  async update(tenantId: string, visitId: string, data: UpdateMedicalVisitInput) {
    const existing = await collections.medicalVisits.findOne({
      _id: new ObjectId(visitId),
      tenantId: new ObjectId(tenantId),
    });

    if (!existing) {
      throw new ApiError('VISIT_NOT_FOUND', 'Medical visit not found', 404);
    }

    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (data.diagnosis !== undefined) updateData.diagnosis = data.diagnosis;
    if (data.icdCode !== undefined) updateData.icdCode = data.icdCode;
    if (data.treatment !== undefined) updateData.treatment = data.treatment;
    if (data.medicationsGiven !== undefined) {
      updateData.medicationsGiven = data.medicationsGiven.map((m) => ({
        ...m,
        time: new Date(m.time),
      }));
    }
    if (data.proceduresPerformed !== undefined) updateData.proceduresPerformed = data.proceduresPerformed;
    if (data.incidentReportFiled !== undefined) updateData.incidentReportFiled = data.incidentReportFiled;
    if (data.followUpRequired !== undefined) updateData.followUpRequired = data.followUpRequired;
    if (data.followUpDate) updateData.followUpDate = new Date(data.followUpDate);
    if (data.followUpInstructions !== undefined) updateData.followUpInstructions = data.followUpInstructions;
    if (data.parentNotified !== undefined) {
      updateData.parentNotified = data.parentNotified;
      if (data.parentNotified) {
        updateData.parentNotifiedAt = new Date();
      }
    }
    if (data.notes !== undefined) updateData.notes = data.notes;

    await collections.medicalVisits.updateOne(
      { _id: new ObjectId(visitId) },
      { $set: updateData }
    );

    logger.info({ visitId, tenantId }, 'Medical visit updated');

    return this.findById(tenantId, visitId);
  }

  async close(tenantId: string, visitId: string, data: CloseMedicalVisitInput, closedBy: string) {
    const existing = await collections.medicalVisits.findOne({
      _id: new ObjectId(visitId),
      tenantId: new ObjectId(tenantId),
    });

    if (!existing) {
      throw new ApiError('VISIT_NOT_FOUND', 'Medical visit not found', 404);
    }

    if (existing.status === 'completed') {
      throw new ApiError('ALREADY_CLOSED', 'Medical visit is already closed', 400);
    }

    const now = new Date();

    const updateData: Record<string, unknown> = {
      outcome: data.outcome,
      outcomeNotes: data.outcomeNotes,
      departureTime: new Date(data.departureTime),
      status: data.followUpRequired ? 'follow_up_required' : 'completed',
      closedAt: now,
      closedBy: new ObjectId(closedBy),
      updatedAt: now,
    };

    if (data.diagnosis !== undefined) updateData.diagnosis = data.diagnosis;
    if (data.treatment !== undefined) updateData.treatment = data.treatment;
    if (data.followUpRequired !== undefined) updateData.followUpRequired = data.followUpRequired;
    if (data.followUpDate) updateData.followUpDate = new Date(data.followUpDate);
    if (data.followUpInstructions !== undefined) updateData.followUpInstructions = data.followUpInstructions;
    if (data.notes !== undefined) updateData.notes = data.notes;

    await collections.medicalVisits.updateOne(
      { _id: new ObjectId(visitId) },
      { $set: updateData }
    );

    logger.info({ visitId, tenantId, outcome: data.outcome, closedBy }, 'Medical visit closed');

    return this.findById(tenantId, visitId);
  }

  async getTodayVisits(tenantId: string, branchId: string) {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const visits = await collections.medicalVisits
      .find({
        tenantId: new ObjectId(tenantId),
        branchId: new ObjectId(branchId),
        visitDate: { $gte: startOfDay, $lte: endOfDay },
      })
      .sort({ arrivalTime: -1 })
      .toArray() as WithId<MedicalVisitDocument>[];

    const inProgress = visits.filter((v) => v.status === 'in_progress');
    const completed = visits.filter((v) => v.status !== 'in_progress');

    return {
      total: visits.length,
      inProgress: inProgress.map((v) => this.formatVisit(v)),
      completed: completed.map((v) => this.formatVisit(v)),
      inProgressCount: inProgress.length,
      completedCount: completed.length,
    };
  }

  async getStats(tenantId: string, branchId: string) {
    const tenantObjId = new ObjectId(tenantId);
    const branchObjId = new ObjectId(branchId);

    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const startOfWeek = new Date(now);
    startOfWeek.setDate(startOfWeek.getDate() - 7);
    const startOfMonth = new Date(now);
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const baseFilter = {
      tenantId: tenantObjId,
      branchId: branchObjId,
    };

    const [totalVisits, todayVisits, weekVisits, monthVisits, byType, byOutcome, incidentCount, avgDuration] = await Promise.all([
      collections.medicalVisits.countDocuments(baseFilter),
      collections.medicalVisits.countDocuments({ ...baseFilter, visitDate: { $gte: startOfToday } }),
      collections.medicalVisits.countDocuments({ ...baseFilter, visitDate: { $gte: startOfWeek } }),
      collections.medicalVisits.countDocuments({ ...baseFilter, visitDate: { $gte: startOfMonth } }),
      collections.medicalVisits.aggregate([
        { $match: baseFilter },
        { $group: { _id: '$visitType', count: { $sum: 1 } } },
      ]).toArray(),
      collections.medicalVisits.aggregate([
        { $match: { ...baseFilter, outcome: { $exists: true } } },
        { $group: { _id: '$outcome', count: { $sum: 1 } } },
      ]).toArray(),
      collections.medicalVisits.countDocuments({ ...baseFilter, isIncident: true }),
      collections.medicalVisits.aggregate([
        {
          $match: {
            ...baseFilter,
            departureTime: { $exists: true },
            arrivalTime: { $exists: true },
          },
        },
        {
          $project: {
            duration: {
              $divide: [
                { $subtract: ['$departureTime', '$arrivalTime'] },
                60000, // Convert to minutes
              ],
            },
          },
        },
        { $group: { _id: null, avgDuration: { $avg: '$duration' } } },
      ]).toArray(),
    ]);

    const byTypeMap: Record<string, number> = {};
    for (const t of byType) {
      byTypeMap[t._id as string] = t.count;
    }

    const byOutcomeMap: Record<string, number> = {};
    for (const o of byOutcome) {
      byOutcomeMap[o._id as string] = o.count;
    }

    return {
      totalVisits,
      todayVisits,
      weekVisits,
      monthVisits,
      byType: byTypeMap,
      byOutcome: byOutcomeMap,
      incidentCount,
      averageVisitDuration: avgDuration[0]?.avgDuration ? Math.round(avgDuration[0].avgDuration) : 0,
    };
  }

  async notifyParent(tenantId: string, visitId: string, notifiedBy: string) {
    const now = new Date();

    const result = await collections.medicalVisits.updateOne(
      {
        _id: new ObjectId(visitId),
        tenantId: new ObjectId(tenantId),
      },
      {
        $set: {
          parentNotified: true,
          parentNotifiedAt: now,
          parentNotifiedBy: new ObjectId(notifiedBy),
          updatedAt: now,
        },
      }
    );

    if (result.matchedCount === 0) {
      throw new ApiError('VISIT_NOT_FOUND', 'Medical visit not found', 404);
    }

    logger.info({ visitId, tenantId, notifiedBy }, 'Parent notified for medical visit');

    return { success: true, notifiedAt: now };
  }

  private formatVisit(visit: WithId<MedicalVisitDocument>) {
    return {
      _id: visit._id.toString(),
      tenantId: visit.tenantId.toString(),
      branchId: visit.branchId.toString(),
      healthRecordId: visit.healthRecordId.toString(),
      personType: visit.personType,
      personId: visit.personId.toString(),
      personName: visit.personName,
      visitType: visit.visitType,
      visitDate: visit.visitDate,
      arrivalTime: visit.arrivalTime,
      departureTime: visit.departureTime,
      chiefComplaint: visit.chiefComplaint,
      symptoms: visit.symptoms,
      symptomOnset: visit.symptomOnset,
      painLevel: visit.painLevel,
      vitals: visit.vitals,
      diagnosis: visit.diagnosis,
      icdCode: visit.icdCode,
      treatment: visit.treatment,
      medicationsGiven: visit.medicationsGiven,
      proceduresPerformed: visit.proceduresPerformed,
      isIncident: visit.isIncident,
      incidentLocation: visit.incidentLocation,
      incidentDescription: visit.incidentDescription,
      incidentWitnesses: visit.incidentWitnesses,
      incidentReportFiled: visit.incidentReportFiled,
      outcome: visit.outcome,
      outcomeNotes: visit.outcomeNotes,
      followUpRequired: visit.followUpRequired,
      followUpDate: visit.followUpDate,
      followUpInstructions: visit.followUpInstructions,
      parentNotified: visit.parentNotified,
      parentNotifiedAt: visit.parentNotifiedAt,
      parentNotifiedBy: visit.parentNotifiedBy?.toString(),
      attendedBy: visit.attendedBy.toString(),
      attendedByName: visit.attendedByName,
      status: visit.status,
      notes: visit.notes,
      closedAt: visit.closedAt,
      closedBy: visit.closedBy?.toString(),
      createdAt: visit.createdAt,
      updatedAt: visit.updatedAt,
    };
  }
}

export const medicalVisitService = new MedicalVisitService();
