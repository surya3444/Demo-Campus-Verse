import { ObjectId, Filter, Document, WithId } from 'mongodb';
import { collections } from '../../config/database';
import { logger } from '../../lib/logger';
import { ApiError } from '../../middleware/errorHandler';
import { CreateHealthRecordInput, UpdateHealthRecordInput, HealthRecordQueryInput } from '@campus-verse/shared/schemas';
import { calculateBmi } from './utils/bmiCalculator';

interface HealthRecordDocument extends Document {
  _id: ObjectId;
  tenantId: ObjectId;
  branchId: ObjectId;
  personType: 'student' | 'staff';
  personId: ObjectId;
  personName?: string;
  personCode?: string;
  dateOfBirth?: Date;
  gender?: string;
  bloodGroup?: string;
  heightCm?: number;
  weightKg?: number;
  bmi?: number;
  allergies: Array<{
    name: string;
    category: string;
    severity: string;
    symptoms?: string[];
    treatment?: string;
    diagnosedDate?: Date;
  }>;
  conditions: Array<{
    name: string;
    status: string;
    diagnosedDate?: Date;
    medications?: string[];
    notes?: string;
  }>;
  currentMedications: Array<{
    name: string;
    dosage: string;
    frequency: string;
    startDate?: Date;
    endDate?: Date;
    prescribedBy?: string;
    reason?: string;
  }>;
  pastSurgeries: Array<{
    name: string;
    date?: Date;
    hospital?: string;
    notes?: string;
  }>;
  disabilities: Array<{
    type: string;
    severity?: string;
    description?: string;
    accommodations?: string[];
  }>;
  familyHistory?: string;
  emergencyContacts: Array<{
    name: string;
    relation: string;
    phone: string;
    alternatePhone?: string;
    email?: string;
    isPrimary?: boolean;
  }>;
  insurance?: {
    provider?: string;
    policyNumber?: string;
    groupNumber?: string;
    coverageType?: string;
    validFrom?: Date;
    validTo?: Date;
    holderName?: string;
    holderRelation?: string;
  };
  alerts: Array<{
    type: string;
    message: string;
    priority: string;
    relatedId?: string;
    relatedType?: string;
    dueDate?: Date;
    dismissedAt?: Date;
    dismissedBy?: ObjectId;
  }>;
  lastCheckupDate?: Date;
  nextCheckupDate?: Date;
  lastVaccinationDate?: Date;
  hasOverdueVaccinations?: boolean;
  notes?: string;
  status: 'active' | 'inactive';
  createdBy: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

class HealthRecordService {
  async create(tenantId: string, branchId: string, data: CreateHealthRecordInput, createdBy: string) {
    const tenantObjId = new ObjectId(tenantId);
    const branchObjId = new ObjectId(branchId);
    const personObjId = new ObjectId(data.personId);

    // Check if health record already exists for this person
    const existing = await collections.healthRecords.findOne({
      tenantId: tenantObjId,
      personType: data.personType,
      personId: personObjId,
    });

    if (existing) {
      throw new ApiError('DUPLICATE_RECORD', 'Health record already exists for this person', 409);
    }

    // Get person details
    const personCollection = data.personType === 'student' ? collections.students : collections.staff;
    const person = await personCollection.findOne({
      _id: personObjId,
      tenantId: tenantObjId,
    });

    if (!person) {
      throw new ApiError('PERSON_NOT_FOUND', `${data.personType} not found`, 404);
    }

    const recordId = new ObjectId();
    const now = new Date();

    // Calculate BMI if height and weight provided
    let bmi: number | undefined;
    if (data.heightCm && data.weightKg) {
      bmi = calculateBmi(data.heightCm, data.weightKg);
    }

    // Get person name and code
    let personName: string;
    let personCode: string | undefined;
    let dateOfBirth: Date | undefined;
    let gender: string | undefined;

    if (data.personType === 'student') {
      personName = `${person.firstName} ${person.lastName}`;
      personCode = person.admissionNumber as string;
      dateOfBirth = person.dateOfBirth as Date;
      gender = person.gender as string;
    } else {
      personName = person.displayName as string || `${person.firstName} ${person.lastName}`;
      personCode = person.employeeId as string;
      dateOfBirth = person.dateOfBirth as Date;
      gender = person.gender as string;
    }

    const record: Omit<HealthRecordDocument, '_id'> & { _id: ObjectId } = {
      _id: recordId,
      tenantId: tenantObjId,
      branchId: branchObjId,
      personType: data.personType,
      personId: personObjId,
      personName,
      personCode,
      dateOfBirth,
      gender,
      bloodGroup: data.bloodGroup,
      heightCm: data.heightCm,
      weightKg: data.weightKg,
      bmi,
      allergies: data.allergies || [],
      conditions: data.conditions || [],
      currentMedications: data.currentMedications || [],
      pastSurgeries: data.pastSurgeries || [],
      disabilities: data.disabilities || [],
      familyHistory: data.familyHistory,
      emergencyContacts: data.emergencyContacts || [],
      insurance: data.insurance,
      alerts: [],
      notes: data.notes,
      status: 'active',
      createdBy: new ObjectId(createdBy),
      createdAt: now,
      updatedAt: now,
    };

    await collections.healthRecords.insertOne(record);

    logger.info({ recordId: recordId.toString(), personType: data.personType, personId: data.personId, tenantId }, 'Health record created');

    return this.formatRecord(record as WithId<HealthRecordDocument>);
  }

  async findById(tenantId: string, recordId: string) {
    const record = await collections.healthRecords.findOne({
      _id: new ObjectId(recordId),
      tenantId: new ObjectId(tenantId),
    }) as WithId<HealthRecordDocument> | null;

    if (!record) {
      throw new ApiError('RECORD_NOT_FOUND', 'Health record not found', 404);
    }

    return this.formatRecord(record);
  }

  async findByPerson(tenantId: string, personType: 'student' | 'staff', personId: string) {
    const record = await collections.healthRecords.findOne({
      tenantId: new ObjectId(tenantId),
      personType,
      personId: new ObjectId(personId),
    }) as WithId<HealthRecordDocument> | null;

    return record ? this.formatRecord(record) : null;
  }

  async findAll(tenantId: string, branchId: string, params: HealthRecordQueryInput) {
    const { page = 1, limit = 20, search, personType, hasAllergies, hasConditions, hasInsurance, bloodGroup, status } = params;

    const filter: Filter<Document> = {
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
    };

    if (personType) {
      filter.personType = personType;
    }

    if (search) {
      filter.$or = [
        { personName: { $regex: search, $options: 'i' } },
        { personCode: { $regex: search, $options: 'i' } },
      ];
    }

    if (hasAllergies !== undefined) {
      filter['allergies.0'] = hasAllergies ? { $exists: true } : { $exists: false };
    }

    if (hasConditions !== undefined) {
      filter['conditions.0'] = hasConditions ? { $exists: true } : { $exists: false };
    }

    if (hasInsurance !== undefined) {
      filter.insurance = hasInsurance ? { $exists: true, $ne: null } : { $exists: false };
    }

    if (bloodGroup) {
      filter.bloodGroup = bloodGroup;
    }

    if (status) {
      filter.status = status;
    }

    const skip = (page - 1) * limit;

    const [records, total] = await Promise.all([
      collections.healthRecords
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .toArray() as Promise<WithId<HealthRecordDocument>[]>,
      collections.healthRecords.countDocuments(filter),
    ]);

    return {
      data: records.map((r) => this.formatRecord(r)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: skip + records.length < total,
      },
    };
  }

  async update(tenantId: string, recordId: string, data: UpdateHealthRecordInput, updatedBy: string) {
    const existing = await collections.healthRecords.findOne({
      _id: new ObjectId(recordId),
      tenantId: new ObjectId(tenantId),
    }) as WithId<HealthRecordDocument> | null;

    if (!existing) {
      throw new ApiError('RECORD_NOT_FOUND', 'Health record not found', 404);
    }

    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    // Update fields if provided
    if (data.bloodGroup !== undefined) updateData.bloodGroup = data.bloodGroup;
    if (data.heightCm !== undefined) updateData.heightCm = data.heightCm;
    if (data.weightKg !== undefined) updateData.weightKg = data.weightKg;

    // Recalculate BMI if height or weight changed
    const heightCm = data.heightCm ?? existing.heightCm;
    const weightKg = data.weightKg ?? existing.weightKg;
    if (heightCm && weightKg) {
      updateData.bmi = calculateBmi(heightCm, weightKg);
    }

    if (data.allergies !== undefined) updateData.allergies = data.allergies;
    if (data.conditions !== undefined) updateData.conditions = data.conditions;
    if (data.currentMedications !== undefined) updateData.currentMedications = data.currentMedications;
    if (data.pastSurgeries !== undefined) updateData.pastSurgeries = data.pastSurgeries;
    if (data.disabilities !== undefined) updateData.disabilities = data.disabilities;
    if (data.familyHistory !== undefined) updateData.familyHistory = data.familyHistory;
    if (data.emergencyContacts !== undefined) updateData.emergencyContacts = data.emergencyContacts;
    if (data.insurance !== undefined) updateData.insurance = data.insurance;
    if (data.notes !== undefined) updateData.notes = data.notes;

    await collections.healthRecords.updateOne(
      { _id: new ObjectId(recordId) },
      { $set: updateData }
    );

    logger.info({ recordId, tenantId, updatedBy }, 'Health record updated');

    return this.findById(tenantId, recordId);
  }

  async delete(tenantId: string, recordId: string) {
    const record = await collections.healthRecords.findOne({
      _id: new ObjectId(recordId),
      tenantId: new ObjectId(tenantId),
    });

    if (!record) {
      throw new ApiError('RECORD_NOT_FOUND', 'Health record not found', 404);
    }

    // Soft delete
    await collections.healthRecords.updateOne(
      { _id: new ObjectId(recordId) },
      { $set: { status: 'inactive', updatedAt: new Date() } }
    );

    logger.info({ recordId, tenantId }, 'Health record deleted (soft)');

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

    const [
      totalRecords,
      studentRecords,
      staffRecords,
      recordsWithAllergies,
      recordsWithConditions,
      recordsWithInsurance,
      alertStats,
    ] = await Promise.all([
      collections.healthRecords.countDocuments(baseFilter),
      collections.healthRecords.countDocuments({ ...baseFilter, personType: 'student' }),
      collections.healthRecords.countDocuments({ ...baseFilter, personType: 'staff' }),
      collections.healthRecords.countDocuments({ ...baseFilter, 'allergies.0': { $exists: true } }),
      collections.healthRecords.countDocuments({ ...baseFilter, 'conditions.0': { $exists: true } }),
      collections.healthRecords.countDocuments({ ...baseFilter, insurance: { $exists: true, $ne: null } }),
      collections.healthRecords.aggregate([
        { $match: baseFilter },
        { $unwind: '$alerts' },
        { $match: { 'alerts.dismissedAt': { $exists: false } } },
        {
          $group: {
            _id: '$alerts.type',
            count: { $sum: 1 },
          },
        },
      ]).toArray(),
    ]);

    const alertCounts = {
      vaccinationDue: 0,
      vaccinationOverdue: 0,
      checkupDue: 0,
      highPriority: 0,
    };

    for (const stat of alertStats) {
      if (stat._id === 'vaccination_due') alertCounts.vaccinationDue = stat.count;
      if (stat._id === 'vaccination_overdue') alertCounts.vaccinationOverdue = stat.count;
      if (stat._id === 'checkup_due') alertCounts.checkupDue = stat.count;
    }

    // Count high priority alerts
    const highPriorityCount = await collections.healthRecords.countDocuments({
      ...baseFilter,
      'alerts.priority': { $in: ['high', 'urgent'] },
      'alerts.dismissedAt': { $exists: false },
    });
    alertCounts.highPriority = highPriorityCount;

    return {
      totalRecords,
      studentRecords,
      staffRecords,
      recordsWithAllergies,
      recordsWithConditions,
      recordsWithInsurance,
      alertCounts,
    };
  }

  async syncFromPerson(tenantId: string, branchId: string, personType: 'student' | 'staff', personId: string, createdBy: string) {
    // Check if record exists
    const existing = await this.findByPerson(tenantId, personType, personId);
    if (existing) {
      return existing;
    }

    // Create new record
    return this.create(tenantId, branchId, {
      personType,
      personId,
      allergies: [],
      conditions: [],
      currentMedications: [],
      pastSurgeries: [],
      disabilities: [],
      emergencyContacts: [],
    }, createdBy);
  }

  async addAlert(tenantId: string, recordId: string, alert: {
    type: string;
    message: string;
    priority: string;
    relatedId?: string;
    relatedType?: string;
    dueDate?: Date;
  }) {
    const result = await collections.healthRecords.updateOne(
      {
        _id: new ObjectId(recordId),
        tenantId: new ObjectId(tenantId),
      },
      {
        $push: {
          alerts: {
            ...alert,
            createdAt: new Date(),
          },
        },
        $set: { updatedAt: new Date() },
      } as unknown as import('mongodb').UpdateFilter<Document>
    );

    if (result.matchedCount === 0) {
      throw new ApiError('RECORD_NOT_FOUND', 'Health record not found', 404);
    }

    return { success: true };
  }

  async dismissAlert(tenantId: string, recordId: string, alertType: string, dismissedBy: string) {
    const result = await collections.healthRecords.updateOne(
      {
        _id: new ObjectId(recordId),
        tenantId: new ObjectId(tenantId),
        'alerts.type': alertType,
        'alerts.dismissedAt': { $exists: false },
      },
      {
        $set: {
          'alerts.$.dismissedAt': new Date(),
          'alerts.$.dismissedBy': new ObjectId(dismissedBy),
          updatedAt: new Date(),
        },
      }
    );

    if (result.matchedCount === 0) {
      throw new ApiError('ALERT_NOT_FOUND', 'Alert not found or already dismissed', 404);
    }

    return { success: true };
  }

  private formatRecord(record: WithId<HealthRecordDocument>) {
    return {
      _id: record._id.toString(),
      tenantId: record.tenantId.toString(),
      branchId: record.branchId.toString(),
      personType: record.personType,
      personId: record.personId.toString(),
      personName: record.personName,
      personCode: record.personCode,
      dateOfBirth: record.dateOfBirth,
      gender: record.gender,
      bloodGroup: record.bloodGroup,
      heightCm: record.heightCm,
      weightKg: record.weightKg,
      bmi: record.bmi,
      allergies: record.allergies,
      conditions: record.conditions,
      currentMedications: record.currentMedications,
      pastSurgeries: record.pastSurgeries,
      disabilities: record.disabilities,
      familyHistory: record.familyHistory,
      emergencyContacts: record.emergencyContacts,
      insurance: record.insurance,
      alerts: record.alerts.map(a => ({
        ...a,
        dismissedBy: a.dismissedBy?.toString(),
      })),
      lastCheckupDate: record.lastCheckupDate,
      nextCheckupDate: record.nextCheckupDate,
      lastVaccinationDate: record.lastVaccinationDate,
      hasOverdueVaccinations: record.hasOverdueVaccinations,
      notes: record.notes,
      status: record.status,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }
}

export const healthRecordService = new HealthRecordService();
