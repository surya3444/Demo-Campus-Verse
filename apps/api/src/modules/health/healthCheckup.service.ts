import { ObjectId, Filter, Document, WithId } from 'mongodb';
import { collections } from '../../config/database';
import { logger } from '../../lib/logger';
import { ApiError } from '../../middleware/errorHandler';
import { CreateHealthCheckupInput, UpdateHealthCheckupInput, CompleteHealthCheckupInput, HealthCheckupQueryInput, CreateCheckupCampaignInput, UpdateCheckupCampaignInput, CheckupCampaignQueryInput } from '@campus-verse/shared/schemas';
import { calculateBmi, calculateGrowthPercentiles } from './utils/bmiCalculator';
import { withPeople } from '../../utils/people';

interface HealthCheckupDocument extends Document {
  _id: ObjectId;
  tenantId: ObjectId;
  branchId: ObjectId;
  healthRecordId: ObjectId;
  personType: 'student' | 'staff';
  personId: ObjectId;
  personName?: string;
  campaignId?: ObjectId;
  checkupDate: Date;
  checkupType: string;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  vitals: Record<string, unknown>;
  visionExam?: Record<string, unknown>;
  hearingExam?: Record<string, unknown>;
  dentalExam?: Record<string, unknown>;
  generalExam?: Record<string, unknown>;
  growthPercentile?: Record<string, unknown>;
  findings?: string[];
  recommendations?: string[];
  referrals?: Array<{
    specialist: string;
    reason: string;
    urgency: string;
    referredTo?: string;
  }>;
  followUpRequired?: boolean;
  followUpDate?: Date;
  followUpNotes?: string;
  examinedBy?: ObjectId;
  examinerName?: string;
  examinerQualification?: string;
  notes?: string;
  completedAt?: Date;
  createdBy: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

interface HealthCheckupCampaignDocument extends Document {
  _id: ObjectId;
  tenantId: ObjectId;
  branchId: ObjectId;
  name: string;
  description?: string;
  targetType: string;
  targetIds?: ObjectId[];
  personType: 'student' | 'staff';
  scheduledDate: Date;
  scheduledEndDate?: Date;
  venue?: string;
  checkupType: string;
  includeVision?: boolean;
  includeHearing?: boolean;
  includeDental?: boolean;
  includeGrowth?: boolean;
  status: 'draft' | 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  totalTarget: number;
  completedCount: number;
  pendingCount: number;
  assignedStaff?: ObjectId[];
  externalExaminers?: Array<{
    name: string;
    qualification: string;
    specialization?: string;
  }>;
  notes?: string;
  startedAt?: Date;
  completedAt?: Date;
  createdBy: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

class HealthCheckupService {
  // ============ Checkups ============

  async createCheckup(tenantId: string, branchId: string, data: CreateHealthCheckupInput, createdBy: string) {
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

    const checkupId = new ObjectId();
    const now = new Date();

    // Calculate BMI if vitals provided
    let vitals = data.vitals || {};
    if (vitals.heightCm && vitals.weightKg) {
      vitals = {
        ...vitals,
        bmi: calculateBmi(vitals.heightCm as number, vitals.weightKg as number),
      };
    }

    const checkup: Omit<HealthCheckupDocument, '_id'> & { _id: ObjectId } = {
      _id: checkupId,
      tenantId: tenantObjId,
      branchId: branchObjId,
      healthRecordId: new ObjectId(data.healthRecordId),
      personType: data.personType,
      personId: new ObjectId(data.personId),
      personName: healthRecord.personName as string,
      campaignId: data.campaignId ? new ObjectId(data.campaignId) : undefined,
      checkupDate: new Date(data.checkupDate),
      checkupType: data.checkupType,
      status: 'scheduled',
      vitals,
      visionExam: data.visionExam,
      hearingExam: data.hearingExam,
      dentalExam: data.dentalExam,
      generalExam: data.generalExam,
      growthPercentile: data.growthPercentile,
      findings: data.findings,
      recommendations: data.recommendations,
      referrals: data.referrals,
      followUpRequired: data.followUpRequired,
      followUpDate: data.followUpDate ? new Date(data.followUpDate) : undefined,
      followUpNotes: data.followUpNotes,
      examinedBy: data.examinedBy ? new ObjectId(data.examinedBy) : undefined,
      examinerName: data.examinerName,
      examinerQualification: data.examinerQualification,
      notes: data.notes,
      createdBy: new ObjectId(createdBy),
      createdAt: now,
      updatedAt: now,
    };

    await collections.healthCheckups.insertOne(checkup);

    logger.info({ checkupId: checkupId.toString(), personId: data.personId, tenantId }, 'Health checkup created');

    return this.formatCheckup(checkup as WithId<HealthCheckupDocument>);
  }

  async findCheckupById(tenantId: string, checkupId: string) {
    const checkup = await collections.healthCheckups.findOne({
      _id: new ObjectId(checkupId),
      tenantId: new ObjectId(tenantId),
    }) as WithId<HealthCheckupDocument> | null;

    if (!checkup) {
      throw new ApiError('CHECKUP_NOT_FOUND', 'Health checkup not found', 404);
    }

    return (await withPeople([this.formatCheckup(checkup)], 'personId'))[0];
  }

  async findAllCheckups(tenantId: string, branchId: string, params: HealthCheckupQueryInput) {
    const { page = 1, limit = 20, search, personType, personId, healthRecordId, campaignId, checkupType, status, fromDate, toDate } = params;

    const filter: Filter<Document> = {
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
    };

    if (personType) filter.personType = personType;
    if (personId) filter.personId = new ObjectId(personId);
    if (healthRecordId) filter.healthRecordId = new ObjectId(healthRecordId);
    if (campaignId) filter.campaignId = new ObjectId(campaignId);
    if (checkupType) filter.checkupType = checkupType;
    if (status) filter.status = status;

    if (search) {
      filter.personName = { $regex: search, $options: 'i' };
    }

    if (fromDate || toDate) {
      filter.checkupDate = {};
      if (fromDate) filter.checkupDate.$gte = new Date(fromDate);
      if (toDate) filter.checkupDate.$lte = new Date(toDate);
    }

    const skip = (page - 1) * limit;

    const [checkups, total] = await Promise.all([
      collections.healthCheckups
        .find(filter)
        .sort({ checkupDate: -1 })
        .skip(skip)
        .limit(limit)
        .toArray() as Promise<WithId<HealthCheckupDocument>[]>,
      collections.healthCheckups.countDocuments(filter),
    ]);

    return {
      data: await withPeople(checkups.map((c) => this.formatCheckup(c)), 'personId'),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: skip + checkups.length < total,
      },
    };
  }

  async updateCheckup(tenantId: string, checkupId: string, data: UpdateHealthCheckupInput) {
    const existing = await collections.healthCheckups.findOne({
      _id: new ObjectId(checkupId),
      tenantId: new ObjectId(tenantId),
    });

    if (!existing) {
      throw new ApiError('CHECKUP_NOT_FOUND', 'Health checkup not found', 404);
    }

    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (data.checkupDate) updateData.checkupDate = new Date(data.checkupDate);
    if (data.checkupType) updateData.checkupType = data.checkupType;
    if (data.vitals) {
      let vitals = data.vitals;
      if (vitals.heightCm && vitals.weightKg) {
        vitals = { ...vitals, bmi: calculateBmi(vitals.heightCm, vitals.weightKg) };
      }
      updateData.vitals = vitals;
    }
    if (data.visionExam !== undefined) updateData.visionExam = data.visionExam;
    if (data.hearingExam !== undefined) updateData.hearingExam = data.hearingExam;
    if (data.dentalExam !== undefined) updateData.dentalExam = data.dentalExam;
    if (data.generalExam !== undefined) updateData.generalExam = data.generalExam;
    if (data.growthPercentile !== undefined) updateData.growthPercentile = data.growthPercentile;
    if (data.findings !== undefined) updateData.findings = data.findings;
    if (data.recommendations !== undefined) updateData.recommendations = data.recommendations;
    if (data.referrals !== undefined) updateData.referrals = data.referrals;
    if (data.followUpRequired !== undefined) updateData.followUpRequired = data.followUpRequired;
    if (data.followUpDate) updateData.followUpDate = new Date(data.followUpDate);
    if (data.followUpNotes !== undefined) updateData.followUpNotes = data.followUpNotes;
    if (data.notes !== undefined) updateData.notes = data.notes;

    await collections.healthCheckups.updateOne(
      { _id: new ObjectId(checkupId) },
      { $set: updateData }
    );

    logger.info({ checkupId, tenantId }, 'Health checkup updated');

    return this.findCheckupById(tenantId, checkupId);
  }

  async completeCheckup(tenantId: string, checkupId: string, data: CompleteHealthCheckupInput, completedBy: string) {
    const existing = await collections.healthCheckups.findOne({
      _id: new ObjectId(checkupId),
      tenantId: new ObjectId(tenantId),
    }) as WithId<HealthCheckupDocument> | null;

    if (!existing) {
      throw new ApiError('CHECKUP_NOT_FOUND', 'Health checkup not found', 404);
    }

    const now = new Date();
    let vitals = data.vitals;

    // Calculate BMI
    if (vitals.heightCm && vitals.weightKg) {
      vitals = { ...vitals, bmi: calculateBmi(vitals.heightCm, vitals.weightKg) };
    }

    // Calculate growth percentiles for students
    let growthPercentile = data.growthPercentile;
    if (existing.personType === 'student' && vitals.heightCm && vitals.weightKg) {
      const healthRecord = await collections.healthRecords.findOne({
        _id: existing.healthRecordId,
      });

      if (healthRecord?.dateOfBirth && healthRecord?.gender) {
        const percentiles = calculateGrowthPercentiles(
          vitals.heightCm as number,
          vitals.weightKg as number,
          healthRecord.dateOfBirth as Date,
          healthRecord.gender as 'male' | 'female'
        );
        growthPercentile = {
          ...growthPercentile,
          ageInMonths: percentiles.ageInMonths,
          heightPercentile: percentiles.heightPercentile ?? undefined,
          weightPercentile: percentiles.weightPercentile ?? undefined,
          bmiPercentile: percentiles.bmiPercentile ?? undefined,
        };
      }
    }

    const updateData: Record<string, unknown> = {
      status: 'completed',
      vitals,
      visionExam: data.visionExam,
      hearingExam: data.hearingExam,
      dentalExam: data.dentalExam,
      generalExam: data.generalExam,
      growthPercentile,
      findings: data.findings,
      recommendations: data.recommendations,
      referrals: data.referrals,
      followUpRequired: data.followUpRequired,
      followUpDate: data.followUpDate ? new Date(data.followUpDate) : undefined,
      followUpNotes: data.followUpNotes,
      notes: data.notes,
      completedAt: now,
      updatedAt: now,
    };

    await collections.healthCheckups.updateOne(
      { _id: new ObjectId(checkupId) },
      { $set: updateData }
    );

    // Update health record with checkup data
    await collections.healthRecords.updateOne(
      { _id: existing.healthRecordId },
      {
        $set: {
          heightCm: vitals.heightCm,
          weightKg: vitals.weightKg,
          bmi: vitals.bmi,
          lastCheckupDate: now,
          updatedAt: now,
        },
      }
    );

    // Update campaign if part of one
    if (existing.campaignId) {
      await collections.healthCheckupCampaigns.updateOne(
        { _id: existing.campaignId },
        {
          $inc: { completedCount: 1, pendingCount: -1 },
          $set: { updatedAt: now },
        }
      );
    }

    logger.info({ checkupId, tenantId, completedBy }, 'Health checkup completed');

    return this.findCheckupById(tenantId, checkupId);
  }

  async getCheckupStats(tenantId: string, branchId: string) {
    const tenantObjId = new ObjectId(tenantId);
    const branchObjId = new ObjectId(branchId);

    const baseFilter = {
      tenantId: tenantObjId,
      branchId: branchObjId,
    };

    const [totalCheckups, completedCheckups, pendingCheckups, referralStats, bmiStats] = await Promise.all([
      collections.healthCheckups.countDocuments(baseFilter),
      collections.healthCheckups.countDocuments({ ...baseFilter, status: 'completed' }),
      collections.healthCheckups.countDocuments({ ...baseFilter, status: { $in: ['scheduled', 'in_progress'] } }),
      collections.healthCheckups.countDocuments({ ...baseFilter, status: 'completed', 'referrals.0': { $exists: true } }),
      collections.healthCheckups.aggregate([
        { $match: { ...baseFilter, status: 'completed', 'vitals.bmi': { $exists: true } } },
        { $group: { _id: null, avgBmi: { $avg: '$vitals.bmi' } } },
      ]).toArray(),
    ]);

    // Count issues
    const [visionIssues, hearingIssues, dentalIssues] = await Promise.all([
      collections.healthCheckups.countDocuments({
        ...baseFilter,
        status: 'completed',
        'visionExam.result': { $in: ['needs_correction', 'referred'] },
      }),
      collections.healthCheckups.countDocuments({
        ...baseFilter,
        status: 'completed',
        'hearingExam.result': { $in: ['mild_loss', 'moderate_loss', 'severe_loss', 'referred'] },
      }),
      collections.healthCheckups.countDocuments({
        ...baseFilter,
        status: 'completed',
        'dentalExam.result': { $in: ['needs_attention', 'urgent_care', 'referred'] },
      }),
    ]);

    return {
      totalCheckups,
      completedCheckups,
      pendingCheckups,
      referralsMade: referralStats,
      averageBmi: bmiStats[0]?.avgBmi ? Math.round(bmiStats[0].avgBmi * 10) / 10 : 0,
      visionIssues,
      hearingIssues,
      dentalIssues,
    };
  }

  // ============ Campaigns ============

  async createCampaign(tenantId: string, branchId: string, data: CreateCheckupCampaignInput, createdBy: string) {
    const tenantObjId = new ObjectId(tenantId);
    const branchObjId = new ObjectId(branchId);
    const campaignId = new ObjectId();
    const now = new Date();

    // Calculate total target based on target type
    let totalTarget = 0;

    if (data.targetType === 'all_students') {
      totalTarget = await collections.healthRecords.countDocuments({
        tenantId: tenantObjId,
        branchId: branchObjId,
        personType: 'student',
        status: 'active',
      });
    } else if (data.targetType === 'all_staff') {
      totalTarget = await collections.healthRecords.countDocuments({
        tenantId: tenantObjId,
        branchId: branchObjId,
        personType: 'staff',
        status: 'active',
      });
    } else if (data.targetIds && data.targetIds.length > 0) {
      // For class/section/department targeting, count health records in those groups
      // This would need to be expanded based on your data model
      totalTarget = data.targetIds.length;
    }

    const campaign: Omit<HealthCheckupCampaignDocument, '_id'> & { _id: ObjectId } = {
      _id: campaignId,
      tenantId: tenantObjId,
      branchId: branchObjId,
      name: data.name,
      description: data.description,
      targetType: data.targetType,
      targetIds: data.targetIds?.map((id) => new ObjectId(id)),
      personType: data.personType,
      scheduledDate: new Date(data.scheduledDate),
      scheduledEndDate: data.scheduledEndDate ? new Date(data.scheduledEndDate) : undefined,
      venue: data.venue,
      checkupType: data.checkupType,
      includeVision: data.includeVision ?? true,
      includeHearing: data.includeHearing ?? true,
      includeDental: data.includeDental ?? true,
      includeGrowth: data.includeGrowth ?? true,
      status: 'draft',
      totalTarget,
      completedCount: 0,
      pendingCount: 0,
      assignedStaff: data.assignedStaff?.map((id) => new ObjectId(id)),
      externalExaminers: data.externalExaminers,
      notes: data.notes,
      createdBy: new ObjectId(createdBy),
      createdAt: now,
      updatedAt: now,
    };

    await collections.healthCheckupCampaigns.insertOne(campaign);

    logger.info({ campaignId: campaignId.toString(), tenantId }, 'Health checkup campaign created');

    return this.formatCampaign(campaign as WithId<HealthCheckupCampaignDocument>);
  }

  async findCampaignById(tenantId: string, campaignId: string) {
    const campaign = await collections.healthCheckupCampaigns.findOne({
      _id: new ObjectId(campaignId),
      tenantId: new ObjectId(tenantId),
    }) as WithId<HealthCheckupCampaignDocument> | null;

    if (!campaign) {
      throw new ApiError('CAMPAIGN_NOT_FOUND', 'Health checkup campaign not found', 404);
    }

    return this.formatCampaign(campaign);
  }

  async findAllCampaigns(tenantId: string, branchId: string, params: CheckupCampaignQueryInput) {
    const { page = 1, limit = 20, search, personType, status, fromDate, toDate } = params;

    const filter: Filter<Document> = {
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
    };

    if (personType) filter.personType = personType;
    if (status) filter.status = status;

    if (search) {
      filter.name = { $regex: search, $options: 'i' };
    }

    if (fromDate || toDate) {
      filter.scheduledDate = {};
      if (fromDate) filter.scheduledDate.$gte = new Date(fromDate);
      if (toDate) filter.scheduledDate.$lte = new Date(toDate);
    }

    const skip = (page - 1) * limit;

    const [campaigns, total] = await Promise.all([
      collections.healthCheckupCampaigns
        .find(filter)
        .sort({ scheduledDate: -1 })
        .skip(skip)
        .limit(limit)
        .toArray() as Promise<WithId<HealthCheckupCampaignDocument>[]>,
      collections.healthCheckupCampaigns.countDocuments(filter),
    ]);

    return {
      data: campaigns.map((c) => this.formatCampaign(c)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: skip + campaigns.length < total,
      },
    };
  }

  async updateCampaign(tenantId: string, campaignId: string, data: UpdateCheckupCampaignInput) {
    const existing = await collections.healthCheckupCampaigns.findOne({
      _id: new ObjectId(campaignId),
      tenantId: new ObjectId(tenantId),
    });

    if (!existing) {
      throw new ApiError('CAMPAIGN_NOT_FOUND', 'Health checkup campaign not found', 404);
    }

    if (existing.status !== 'draft' && existing.status !== 'scheduled') {
      throw new ApiError('CAMPAIGN_LOCKED', 'Cannot update campaign that is in progress or completed', 400);
    }

    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (data.name) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.scheduledDate) updateData.scheduledDate = new Date(data.scheduledDate);
    if (data.scheduledEndDate) updateData.scheduledEndDate = new Date(data.scheduledEndDate);
    if (data.venue !== undefined) updateData.venue = data.venue;
    if (data.checkupType) updateData.checkupType = data.checkupType;
    if (data.includeVision !== undefined) updateData.includeVision = data.includeVision;
    if (data.includeHearing !== undefined) updateData.includeHearing = data.includeHearing;
    if (data.includeDental !== undefined) updateData.includeDental = data.includeDental;
    if (data.includeGrowth !== undefined) updateData.includeGrowth = data.includeGrowth;
    if (data.assignedStaff) updateData.assignedStaff = data.assignedStaff.map((id) => new ObjectId(id));
    if (data.externalExaminers !== undefined) updateData.externalExaminers = data.externalExaminers;
    if (data.notes !== undefined) updateData.notes = data.notes;

    await collections.healthCheckupCampaigns.updateOne(
      { _id: new ObjectId(campaignId) },
      { $set: updateData }
    );

    logger.info({ campaignId, tenantId }, 'Health checkup campaign updated');

    return this.findCampaignById(tenantId, campaignId);
  }

  async startCampaign(tenantId: string, branchId: string, campaignId: string, startedBy: string) {
    const campaign = await collections.healthCheckupCampaigns.findOne({
      _id: new ObjectId(campaignId),
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
    }) as WithId<HealthCheckupCampaignDocument> | null;

    if (!campaign) {
      throw new ApiError('CAMPAIGN_NOT_FOUND', 'Health checkup campaign not found', 404);
    }

    if (campaign.status !== 'draft' && campaign.status !== 'scheduled') {
      throw new ApiError('INVALID_STATUS', 'Campaign can only be started from draft or scheduled status', 400);
    }

    const now = new Date();

    // Get all eligible health records
    const recordFilter: Filter<Document> = {
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
      personType: campaign.personType,
      status: 'active',
    };

    const healthRecords = await collections.healthRecords.find(recordFilter).toArray();

    // Create checkup entries for each person
    const checkups = healthRecords.map((record) => ({
      _id: new ObjectId(),
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
      healthRecordId: record._id as ObjectId,
      personType: campaign.personType,
      personId: record.personId as ObjectId,
      personName: record.personName,
      campaignId: campaign._id,
      checkupDate: campaign.scheduledDate,
      checkupType: campaign.checkupType,
      status: 'scheduled' as const,
      vitals: {},
      createdBy: new ObjectId(startedBy),
      createdAt: now,
      updatedAt: now,
    }));

    if (checkups.length > 0) {
      await collections.healthCheckups.insertMany(checkups);
    }

    // Update campaign status
    await collections.healthCheckupCampaigns.updateOne(
      { _id: campaign._id },
      {
        $set: {
          status: 'in_progress',
          totalTarget: checkups.length,
          pendingCount: checkups.length,
          startedAt: now,
          updatedAt: now,
        },
      }
    );

    logger.info({ campaignId, checkupsCreated: checkups.length, tenantId }, 'Health checkup campaign started');

    return {
      campaignId,
      status: 'in_progress',
      checkupsCreated: checkups.length,
      startedAt: now,
    };
  }

  private formatCheckup(checkup: WithId<HealthCheckupDocument>) {
    return {
      _id: checkup._id.toString(),
      tenantId: checkup.tenantId.toString(),
      branchId: checkup.branchId.toString(),
      healthRecordId: checkup.healthRecordId.toString(),
      personType: checkup.personType,
      personId: checkup.personId.toString(),
      personName: checkup.personName,
      campaignId: checkup.campaignId?.toString(),
      checkupDate: checkup.checkupDate,
      checkupType: checkup.checkupType,
      status: checkup.status,
      vitals: checkup.vitals,
      visionExam: checkup.visionExam,
      hearingExam: checkup.hearingExam,
      dentalExam: checkup.dentalExam,
      generalExam: checkup.generalExam,
      growthPercentile: checkup.growthPercentile,
      findings: checkup.findings,
      recommendations: checkup.recommendations,
      referrals: checkup.referrals,
      followUpRequired: checkup.followUpRequired,
      followUpDate: checkup.followUpDate,
      followUpNotes: checkup.followUpNotes,
      examinedBy: checkup.examinedBy?.toString(),
      examinerName: checkup.examinerName,
      examinerQualification: checkup.examinerQualification,
      notes: checkup.notes,
      completedAt: checkup.completedAt,
      createdAt: checkup.createdAt,
      updatedAt: checkup.updatedAt,
    };
  }

  private formatCampaign(campaign: WithId<HealthCheckupCampaignDocument>) {
    return {
      _id: campaign._id.toString(),
      tenantId: campaign.tenantId.toString(),
      branchId: campaign.branchId.toString(),
      name: campaign.name,
      description: campaign.description,
      targetType: campaign.targetType,
      targetIds: campaign.targetIds?.map((id) => id.toString()),
      personType: campaign.personType,
      scheduledDate: campaign.scheduledDate,
      scheduledEndDate: campaign.scheduledEndDate,
      venue: campaign.venue,
      checkupType: campaign.checkupType,
      includeVision: campaign.includeVision,
      includeHearing: campaign.includeHearing,
      includeDental: campaign.includeDental,
      includeGrowth: campaign.includeGrowth,
      status: campaign.status,
      totalTarget: campaign.totalTarget,
      completedCount: campaign.completedCount,
      pendingCount: campaign.pendingCount,
      assignedStaff: campaign.assignedStaff?.map((id) => id.toString()),
      externalExaminers: campaign.externalExaminers,
      notes: campaign.notes,
      startedAt: campaign.startedAt,
      completedAt: campaign.completedAt,
      createdAt: campaign.createdAt,
      updatedAt: campaign.updatedAt,
    };
  }
}

export const healthCheckupService = new HealthCheckupService();
