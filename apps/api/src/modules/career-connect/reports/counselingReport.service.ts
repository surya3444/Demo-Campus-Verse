import { ObjectId } from 'mongodb';
import { collections } from '../../../config/database';

class CounselingReportService {
  async getCounselingSummary(tenantId: string, branchId: string) {
    const baseMatch = {
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
    };

    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

    const [statusBreakdown, typeBreakdown, monthlyTrend, uniqueStudents] = await Promise.all([
      // Sessions by status
      collections.careerCounselingSessions
        .aggregate([
          { $match: baseMatch },
          {
            $group: {
              _id: '$status',
              count: { $sum: 1 },
            },
          },
          { $sort: { count: -1 as const } },
        ])
        .toArray(),

      // Sessions by type
      collections.careerCounselingSessions
        .aggregate([
          { $match: baseMatch },
          {
            $group: {
              _id: '$sessionType',
              count: { $sum: 1 },
            },
          },
          { $sort: { count: -1 as const } },
        ])
        .toArray(),

      // Sessions per month (last 12 months)
      collections.careerCounselingSessions
        .aggregate([
          {
            $match: {
              ...baseMatch,
              scheduledDate: { $gte: twelveMonthsAgo },
            },
          },
          {
            $group: {
              _id: { $dateToString: { format: '%Y-%m', date: '$scheduledDate' } },
              count: { $sum: 1 },
              completed: {
                $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] },
              },
            },
          },
          { $sort: { _id: 1 as const } },
        ])
        .toArray(),

      // Unique students counseled
      collections.careerCounselingSessions
        .aggregate([
          {
            $match: {
              ...baseMatch,
              studentId: { $ne: null },
            },
          },
          {
            $group: {
              _id: '$studentId',
            },
          },
          {
            $count: 'total',
          },
        ])
        .toArray(),
    ]);

    // Build status map with defaults
    const statusMap: Record<string, number> = {
      scheduled: 0,
      completed: 0,
      cancelled: 0,
      no_show: 0,
    };
    for (const s of statusBreakdown) {
      statusMap[s._id as string] = s.count;
    }

    // Build type map
    const typeMap: Record<string, number> = {
      individual: 0,
      group: 0,
      workshop: 0,
    };
    for (const t of typeBreakdown) {
      typeMap[t._id as string] = t.count;
    }

    const totalSessions = Object.values(statusMap).reduce((a, b) => a + b, 0);

    return {
      totalSessions,
      byStatus: statusMap,
      byType: typeMap,
      sessionsPerMonth: monthlyTrend.map((m) => ({
        month: m._id,
        count: m.count,
        completed: m.completed,
      })),
      totalUniqueStudents: uniqueStudents[0]?.total || 0,
    };
  }

  async getAssessmentAnalytics(tenantId: string, branchId: string) {
    const baseMatch = {
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
    };

    const [byType, careerPaths, avgScores, studentsAssessed] = await Promise.all([
      // Total assessments by type
      collections.careerAssessments
        .aggregate([
          { $match: baseMatch },
          {
            $group: {
              _id: '$assessmentType',
              count: { $sum: 1 },
            },
          },
          { $sort: { count: -1 as const } },
        ])
        .toArray(),

      // Top recommended career paths
      collections.careerAssessments
        .aggregate([
          { $match: baseMatch },
          { $unwind: '$recommendedCareers' },
          {
            $group: {
              _id: '$recommendedCareers',
              count: { $sum: 1 },
            },
          },
          { $sort: { count: -1 as const } },
          { $limit: 15 },
          {
            $project: {
              careerPath: '$_id',
              count: 1,
              _id: 0,
            },
          },
        ])
        .toArray(),

      // Average scores by assessment type
      collections.careerAssessments
        .aggregate([
          {
            $match: {
              ...baseMatch,
              score: { $ne: null },
            },
          },
          {
            $group: {
              _id: '$assessmentType',
              avgScore: { $avg: '$score' },
              minScore: { $min: '$score' },
              maxScore: { $max: '$score' },
              count: { $sum: 1 },
            },
          },
          { $sort: { _id: 1 as const } },
        ])
        .toArray(),

      // Students assessed count
      collections.careerAssessments
        .aggregate([
          {
            $match: {
              ...baseMatch,
              studentId: { $ne: null },
            },
          },
          {
            $group: {
              _id: '$studentId',
            },
          },
          {
            $count: 'total',
          },
        ])
        .toArray(),
    ]);

    return {
      totalAssessmentsByType: byType.map((t) => ({
        assessmentType: t._id,
        count: t.count,
      })),
      topRecommendedCareers: careerPaths,
      averageScoresByType: avgScores.map((s) => ({
        assessmentType: s._id,
        avgScore: Math.round((s.avgScore || 0) * 100) / 100,
        minScore: s.minScore || 0,
        maxScore: s.maxScore || 0,
        count: s.count,
      })),
      studentsAssessedCount: studentsAssessed[0]?.total || 0,
    };
  }
}

export const counselingReportService = new CounselingReportService();
