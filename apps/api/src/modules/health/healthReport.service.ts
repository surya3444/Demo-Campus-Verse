import { ObjectId, WithId, Document } from 'mongodb';
import { collections } from '../../config/database';
import { ApiError } from '../../middleware/errorHandler';
import { healthRecordService } from './healthRecord.service';
import { healthCheckupService } from './healthCheckup.service';
import { vaccinationService } from './vaccination.service';
import { medicalVisitService } from './medicalVisit.service';

class HealthReportService {
  async getDashboard(tenantId: string, branchId: string) {
    const [recordStats, checkupStats, vaccinationStats, visitStats] = await Promise.all([
      healthRecordService.getStats(tenantId, branchId),
      healthCheckupService.getCheckupStats(tenantId, branchId),
      vaccinationService.getStats(tenantId, branchId),
      medicalVisitService.getStats(tenantId, branchId),
    ]);

    // Get recent alerts
    const recentAlerts = await collections.healthRecords
      .aggregate([
        {
          $match: {
            tenantId: new ObjectId(tenantId),
            branchId: new ObjectId(branchId),
            status: 'active',
          },
        },
        { $unwind: '$alerts' },
        { $match: { 'alerts.dismissedAt': { $exists: false } } },
        { $sort: { 'alerts.dueDate': 1 } },
        { $limit: 10 },
        {
          $project: {
            _id: 1,
            personName: 1,
            personType: 1,
            alert: '$alerts',
          },
        },
      ])
      .toArray();

    // Get today's visits
    const todayVisits = await medicalVisitService.getTodayVisits(tenantId, branchId);

    // Get upcoming checkups (next 30 days)
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    const upcomingCheckups = await collections.healthCheckups
      .find({
        tenantId: new ObjectId(tenantId),
        branchId: new ObjectId(branchId),
        status: 'scheduled',
        checkupDate: { $lte: thirtyDaysFromNow },
      })
      .sort({ checkupDate: 1 })
      .limit(10)
      .toArray();

    // Get overdue vaccinations
    const overdueVaccinations = await collections.vaccinations
      .find({
        tenantId: new ObjectId(tenantId),
        branchId: new ObjectId(branchId),
        status: { $in: ['scheduled', 'overdue'] },
        scheduledDate: { $lt: new Date() },
      })
      .sort({ scheduledDate: 1 })
      .limit(10)
      .toArray();

    return {
      recordStats,
      checkupStats,
      vaccinationStats,
      visitStats,
      recentAlerts: recentAlerts.map((a) => ({
        recordId: (a._id as ObjectId).toString(),
        personName: a.personName,
        personType: a.personType,
        ...a.alert,
      })),
      todayVisits: todayVisits.inProgress,
      upcomingCheckups: upcomingCheckups.map((c) => ({
        _id: (c._id as ObjectId).toString(),
        personName: c.personName,
        personType: c.personType,
        checkupDate: c.checkupDate,
        checkupType: c.checkupType,
      })),
      overdueVaccinations: overdueVaccinations.map((v) => ({
        _id: (v._id as ObjectId).toString(),
        personName: v.personName,
        personType: v.personType,
        vaccineName: v.vaccineName,
        scheduledDate: v.scheduledDate,
        doseNumber: v.doseNumber,
      })),
    };
  }

  async getGrowthChart(tenantId: string, personId: string) {
    // Get health record for person info
    const healthRecord = await collections.healthRecords.findOne({
      tenantId: new ObjectId(tenantId),
      personId: new ObjectId(personId),
    });

    if (!healthRecord) {
      throw new ApiError('HEALTH_RECORD_NOT_FOUND', 'Health record not found', 404);
    }

    // Get all completed checkups for this person
    const checkups = await collections.healthCheckups
      .find({
        tenantId: new ObjectId(tenantId),
        personId: new ObjectId(personId),
        status: 'completed',
        'vitals.heightCm': { $exists: true },
        'vitals.weightKg': { $exists: true },
      })
      .sort({ checkupDate: 1 })
      .toArray();

    const measurements = checkups.map((c) => {
      const vitals = c.vitals as Record<string, number>;
      const growth = c.growthPercentile as Record<string, number> | undefined;

      return {
        date: c.checkupDate as Date,
        ageInMonths: growth?.ageInMonths || 0,
        heightCm: vitals.heightCm,
        weightKg: vitals.weightKg,
        bmi: vitals.bmi || 0,
        heightPercentile: growth?.heightPercentile,
        weightPercentile: growth?.weightPercentile,
        bmiPercentile: growth?.bmiPercentile,
      };
    });

    return {
      personId,
      personName: healthRecord.personName as string,
      dateOfBirth: healthRecord.dateOfBirth as Date,
      gender: healthRecord.gender as string,
      measurements,
    };
  }

  async getHealthSummary(tenantId: string, personId: string) {
    const tenantObjId = new ObjectId(tenantId);
    const personObjId = new ObjectId(personId);

    // Get health record
    const healthRecord = await collections.healthRecords.findOne({
      tenantId: tenantObjId,
      personId: personObjId,
    }) as WithId<Document> | null;

    if (!healthRecord) {
      throw new ApiError('HEALTH_RECORD_NOT_FOUND', 'Health record not found', 404);
    }

    // Get recent checkups
    const recentCheckups = await collections.healthCheckups
      .find({
        tenantId: tenantObjId,
        personId: personObjId,
        status: 'completed',
      })
      .sort({ checkupDate: -1 })
      .limit(5)
      .toArray();

    // Get vaccination summary
    const vaccinations = await collections.vaccinations
      .find({
        tenantId: tenantObjId,
        personId: personObjId,
      })
      .sort({ administeredDate: -1 })
      .toArray();

    const vaccinationSummary = {
      total: vaccinations.length,
      completed: vaccinations.filter((v) => v.status === 'completed').length,
      scheduled: vaccinations.filter((v) => v.status === 'scheduled').length,
      overdue: vaccinations.filter((v) => v.status === 'overdue').length,
    };

    // Get recent visits
    const recentVisits = await collections.medicalVisits
      .find({
        tenantId: tenantObjId,
        personId: personObjId,
      })
      .sort({ visitDate: -1 })
      .limit(5)
      .toArray();

    return {
      healthRecord: {
        _id: (healthRecord._id as ObjectId).toString(),
        personName: healthRecord.personName,
        personType: healthRecord.personType,
        bloodGroup: healthRecord.bloodGroup,
        heightCm: healthRecord.heightCm,
        weightKg: healthRecord.weightKg,
        bmi: healthRecord.bmi,
        allergiesCount: (healthRecord.allergies as unknown[])?.length || 0,
        conditionsCount: (healthRecord.conditions as unknown[])?.length || 0,
        lastCheckupDate: healthRecord.lastCheckupDate,
        lastVaccinationDate: healthRecord.lastVaccinationDate,
      },
      recentCheckups: recentCheckups.map((c) => ({
        _id: (c._id as ObjectId).toString(),
        checkupDate: c.checkupDate,
        checkupType: c.checkupType,
        findings: c.findings,
      })),
      vaccinationSummary,
      recentVisits: recentVisits.map((v) => ({
        _id: (v._id as ObjectId).toString(),
        visitDate: v.visitDate,
        visitType: v.visitType,
        chiefComplaint: v.chiefComplaint,
        outcome: v.outcome,
      })),
    };
  }

  async exportHealthCard(tenantId: string, personId: string) {
    // Get comprehensive health data for export
    const summary = await this.getHealthSummary(tenantId, personId);
    const growthData = await this.getGrowthChart(tenantId, personId);

    // Get full health record
    const healthRecord = await collections.healthRecords.findOne({
      tenantId: new ObjectId(tenantId),
      personId: new ObjectId(personId),
    });

    if (!healthRecord) {
      throw new ApiError('HEALTH_RECORD_NOT_FOUND', 'Health record not found', 404);
    }

    // Get all vaccinations
    const vaccinations = await collections.vaccinations
      .find({
        tenantId: new ObjectId(tenantId),
        personId: new ObjectId(personId),
      })
      .sort({ administeredDate: 1 })
      .toArray();

    return {
      exportDate: new Date(),
      person: {
        name: healthRecord.personName as string,
        type: healthRecord.personType as string,
        code: healthRecord.personCode as string,
        dateOfBirth: healthRecord.dateOfBirth as Date,
        gender: healthRecord.gender as string,
        bloodGroup: healthRecord.bloodGroup as string,
      },
      measurements: {
        heightCm: healthRecord.heightCm as number,
        weightKg: healthRecord.weightKg as number,
        bmi: healthRecord.bmi as number,
      },
      medicalHistory: {
        allergies: healthRecord.allergies as unknown[],
        conditions: healthRecord.conditions as unknown[],
        currentMedications: healthRecord.currentMedications as unknown[],
        pastSurgeries: healthRecord.pastSurgeries as unknown[],
        disabilities: healthRecord.disabilities as unknown[],
      },
      emergencyContacts: healthRecord.emergencyContacts as unknown[],
      insurance: healthRecord.insurance,
      vaccinations: vaccinations.map((v) => ({
        vaccineName: v.vaccineName,
        doseNumber: v.doseNumber,
        totalDoses: v.totalDoses,
        administeredDate: v.administeredDate,
        status: v.status,
      })),
      growthHistory: growthData.measurements,
      recentCheckups: summary.recentCheckups,
      recentVisits: summary.recentVisits,
    };
  }

  async getComplianceReport(tenantId: string, branchId: string) {
    const tenantObjId = new ObjectId(tenantId);
    const branchObjId = new ObjectId(branchId);

    // Vaccination compliance by vaccine
    const vaccinationCompliance = await collections.vaccinations.aggregate([
      {
        $match: {
          tenantId: tenantObjId,
          branchId: branchObjId,
        },
      },
      {
        $group: {
          _id: '$vaccineName',
          total: { $sum: 1 },
          completed: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] },
          },
          overdue: {
            $sum: { $cond: [{ $eq: ['$status', 'overdue'] }, 1, 0] },
          },
        },
      },
      {
        $project: {
          vaccineName: '$_id',
          total: 1,
          completed: 1,
          overdue: 1,
          complianceRate: {
            $multiply: [{ $divide: ['$completed', '$total'] }, 100],
          },
        },
      },
      { $sort: { vaccineName: 1 } },
    ]).toArray();

    // Checkup compliance
    const totalHealthRecords = await collections.healthRecords.countDocuments({
      tenantId: tenantObjId,
      branchId: branchObjId,
      status: 'active',
    });

    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    const recordsWithRecentCheckup = await collections.healthRecords.countDocuments({
      tenantId: tenantObjId,
      branchId: branchObjId,
      status: 'active',
      lastCheckupDate: { $gte: oneYearAgo },
    });

    const checkupCompliance = totalHealthRecords > 0
      ? Math.round((recordsWithRecentCheckup / totalHealthRecords) * 100)
      : 0;

    // Records with complete data
    const recordsWithAllergies = await collections.healthRecords.countDocuments({
      tenantId: tenantObjId,
      branchId: branchObjId,
      status: 'active',
      'allergies.0': { $exists: true },
    });

    const recordsWithEmergencyContacts = await collections.healthRecords.countDocuments({
      tenantId: tenantObjId,
      branchId: branchObjId,
      status: 'active',
      'emergencyContacts.0': { $exists: true },
    });

    return {
      totalHealthRecords,
      vaccinationCompliance: vaccinationCompliance.map((v) => ({
        vaccineName: v.vaccineName,
        total: v.total,
        completed: v.completed,
        overdue: v.overdue,
        complianceRate: Math.round(v.complianceRate),
      })),
      checkupCompliance: {
        totalRecords: totalHealthRecords,
        withRecentCheckup: recordsWithRecentCheckup,
        complianceRate: checkupCompliance,
      },
      dataCompleteness: {
        totalRecords: totalHealthRecords,
        withAllergies: recordsWithAllergies,
        withEmergencyContacts: recordsWithEmergencyContacts,
        allergyRate: totalHealthRecords > 0 ? Math.round((recordsWithAllergies / totalHealthRecords) * 100) : 0,
        emergencyContactRate: totalHealthRecords > 0 ? Math.round((recordsWithEmergencyContacts / totalHealthRecords) * 100) : 0,
      },
    };
  }
}

export const healthReportService = new HealthReportService();
