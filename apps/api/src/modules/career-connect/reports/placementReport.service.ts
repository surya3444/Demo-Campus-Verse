import { ObjectId } from 'mongodb';
import { collections } from '../../../config/database';

class PlacementReportService {
  async getPlacementSummary(tenantId: string, branchId: string) {
    const baseMatch = {
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
    };

    const [driveStats, offerStats, acceptedOffers] = await Promise.all([
      // Drive counts
      collections.placementDrives
        .aggregate([
          { $match: baseMatch },
          {
            $group: {
              _id: null,
              totalDrives: { $sum: 1 },
              activeDrives: {
                $sum: {
                  $cond: [
                    {
                      $in: ['$status', ['registration_open', 'registration_closed', 'in_progress']],
                    },
                    1,
                    0,
                  ],
                },
              },
              completedDrives: {
                $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] },
              },
              totalRegistered: { $sum: '$stats.totalRegistered' },
            },
          },
        ])
        .toArray(),

      // Total offers
      collections.placementOffers
        .aggregate([
          { $match: baseMatch },
          {
            $group: {
              _id: null,
              totalOffers: { $sum: 1 },
              accepted: {
                $sum: { $cond: [{ $eq: ['$status', 'accepted'] }, 1, 0] },
              },
            },
          },
        ])
        .toArray(),

      // Accepted offers for CTC analysis
      collections.placementOffers
        .find({
          ...baseMatch,
          status: 'accepted',
        })
        .project({ ctc: 1 })
        .toArray(),
    ]);

    const drives = driveStats[0] || {
      totalDrives: 0,
      activeDrives: 0,
      completedDrives: 0,
      totalRegistered: 0,
    };
    const offers = offerStats[0] || { totalOffers: 0, accepted: 0 };

    // CTC calculations from accepted offers
    const ctcValues = acceptedOffers
      .map((o) => o.ctc as number)
      .filter((c) => c != null && c > 0)
      .sort((a, b) => a - b);

    const totalPlaced = offers.accepted;
    const highestCTC = ctcValues.length > 0 ? Math.max(...ctcValues) : 0;
    const averageCTC =
      ctcValues.length > 0
        ? Math.round((ctcValues.reduce((a, b) => a + b, 0) / ctcValues.length) * 100) / 100
        : 0;
    const medianCTC =
      ctcValues.length > 0
        ? ctcValues.length % 2 === 0
          ? Math.round(
              ((ctcValues[ctcValues.length / 2 - 1] + ctcValues[ctcValues.length / 2]) / 2) * 100
            ) / 100
          : ctcValues[Math.floor(ctcValues.length / 2)]
        : 0;

    const placementPercentage =
      drives.totalRegistered > 0
        ? Math.round((totalPlaced / drives.totalRegistered) * 10000) / 100
        : 0;

    const acceptanceRate =
      offers.totalOffers > 0 ? Math.round((offers.accepted / offers.totalOffers) * 10000) / 100 : 0;

    return {
      totalDrives: drives.totalDrives,
      activeDrives: drives.activeDrives,
      completedDrives: drives.completedDrives,
      totalStudentsRegistered: drives.totalRegistered,
      totalPlaced,
      totalOffers: offers.totalOffers,
      acceptanceRate,
      highestCTC,
      averageCTC,
      medianCTC,
      placementPercentage,
    };
  }

  async getCompanyWiseReport(tenantId: string, branchId: string) {
    const baseMatch = {
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
    };

    const pipeline = [
      { $match: baseMatch },
      {
        $group: {
          _id: { companyId: '$companyId', companyName: '$companyName' },
          totalOffers: { $sum: 1 },
          accepted: {
            $sum: { $cond: [{ $eq: ['$status', 'accepted'] }, 1, 0] },
          },
          declined: {
            $sum: { $cond: [{ $eq: ['$status', 'declined'] }, 1, 0] },
          },
          ctcValues: {
            $push: {
              $cond: [{ $eq: ['$status', 'accepted'] }, '$ctc', '$$REMOVE'],
            },
          },
          roles: { $addToSet: '$role' },
        },
      },
      {
        $project: {
          companyId: '$_id.companyId',
          companyName: '$_id.companyName',
          totalOffers: 1,
          accepted: 1,
          declined: 1,
          roles: 1,
          avgCTC: {
            $cond: [
              { $gt: [{ $size: '$ctcValues' }, 0] },
              { $round: [{ $avg: '$ctcValues' }, 2] },
              0,
            ],
          },
          highestCTC: {
            $cond: [{ $gt: [{ $size: '$ctcValues' }, 0] }, { $max: '$ctcValues' }, 0],
          },
        },
      },
      { $sort: { totalOffers: -1 as const } },
    ];

    const data = await collections.placementOffers.aggregate(pipeline).toArray();

    return data.map((d) => ({
      ...d,
      _id: undefined,
      companyId: d.companyId?.toString(),
    }));
  }

  async getDepartmentWiseReport(tenantId: string, branchId: string) {
    const baseMatch = {
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
    };

    // Get student career profiles grouped by department
    const profilePipeline = [
      { $match: baseMatch },
      {
        $group: {
          _id: '$department',
          totalStudents: { $sum: 1 },
          placed: {
            $sum: { $cond: [{ $eq: ['$placementStatus', 'placed'] }, 1, 0] },
          },
        },
      },
    ];

    const profileData = await collections.studentCareerProfiles
      .aggregate(profilePipeline)
      .toArray();

    // Get avg CTC per department from accepted offers via student career profiles
    const ctcPipeline = [
      {
        $match: {
          ...baseMatch,
          status: 'accepted',
        },
      },
      {
        $lookup: {
          from: 'student_career_profiles',
          localField: 'studentId',
          foreignField: 'studentId',
          as: 'profile',
        },
      },
      { $unwind: { path: '$profile', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: '$profile.department',
          avgCTC: { $avg: '$ctc' },
        },
      },
    ];

    const ctcData = await collections.placementOffers.aggregate(ctcPipeline).toArray();
    const ctcMap = new Map(ctcData.map((c) => [c._id, c.avgCTC]));

    const result = profileData
      .map((dept) => ({
        department: dept._id || 'Unknown',
        totalStudents: dept.totalStudents,
        placedCount: dept.placed,
        placementPercentage:
          dept.totalStudents > 0 ? Math.round((dept.placed / dept.totalStudents) * 10000) / 100 : 0,
        avgCTC: Math.round((ctcMap.get(dept._id) || 0) * 100) / 100,
      }))
      .sort((a, b) => b.placementPercentage - a.placementPercentage);

    return result;
  }

  async getSalaryAnalysis(tenantId: string, branchId: string) {
    const baseMatch = {
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
      status: 'accepted',
    };

    // Salary bucket distribution
    const bucketPipeline = [
      { $match: baseMatch },
      {
        $bucket: {
          groupBy: '$ctc',
          boundaries: [0, 300000, 600000, 1000000, 1500000, 2500000, Infinity],
          default: 'Other',
          output: {
            count: { $sum: 1 },
            avgCTC: { $avg: '$ctc' },
          },
        },
      },
    ];

    const bucketData = await collections.placementOffers.aggregate(bucketPipeline).toArray();

    const rangeLabels: Record<string, string> = {
      '0': '0-3L',
      '300000': '3-6L',
      '600000': '6-10L',
      '1000000': '10-15L',
      '1500000': '15-25L',
      '2500000': '25L+',
    };

    const salaryDistribution = bucketData.map((b) => ({
      range: rangeLabels[String(b._id)] || 'Other',
      count: b.count,
      avgCTC: Math.round((b.avgCTC || 0) * 100) / 100,
    }));

    // Percentile calculations
    const acceptedOffers = await collections.placementOffers
      .find(baseMatch)
      .project({ ctc: 1, offerDate: 1 })
      .toArray();

    const ctcValues = acceptedOffers
      .map((o) => o.ctc as number)
      .filter((c) => c != null && c > 0)
      .sort((a, b) => a - b);

    const getPercentile = (arr: number[], p: number): number => {
      if (arr.length === 0) return 0;
      const index = (p / 100) * (arr.length - 1);
      const lower = Math.floor(index);
      const upper = Math.ceil(index);
      if (lower === upper) return arr[lower];
      return Math.round((arr[lower] + (index - lower) * (arr[upper] - arr[lower])) * 100) / 100;
    };

    const percentiles = {
      p25: getPercentile(ctcValues, 25),
      p50: getPercentile(ctcValues, 50),
      p75: getPercentile(ctcValues, 75),
      p90: getPercentile(ctcValues, 90),
    };

    // Year-over-year comparison
    const yoyPipeline = [
      { $match: baseMatch },
      {
        $group: {
          _id: { $year: '$offerDate' },
          count: { $sum: 1 },
          avgCTC: { $avg: '$ctc' },
          highestCTC: { $max: '$ctc' },
          medianCTCValues: { $push: '$ctc' },
        },
      },
      { $sort: { _id: 1 as const } },
    ];

    const yoyData = await collections.placementOffers.aggregate(yoyPipeline).toArray();

    const yearOverYear = yoyData.map((y) => {
      const sorted = ((y.medianCTCValues as number[]) || [])
        .filter((v) => v != null && v > 0)
        .sort((a, b) => a - b);
      const median =
        sorted.length > 0
          ? sorted.length % 2 === 0
            ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
            : sorted[Math.floor(sorted.length / 2)]
          : 0;

      return {
        year: y._id,
        count: y.count,
        avgCTC: Math.round((y.avgCTC || 0) * 100) / 100,
        highestCTC: y.highestCTC || 0,
        medianCTC: Math.round(median * 100) / 100,
      };
    });

    return {
      salaryDistribution,
      percentiles,
      yearOverYear,
    };
  }

  async getPlacementTrends(tenantId: string, branchId: string) {
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

    const pipeline = [
      {
        $match: {
          tenantId: new ObjectId(tenantId),
          branchId: new ObjectId(branchId),
          status: 'accepted',
          offerDate: { $gte: twelveMonthsAgo },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m', date: '$offerDate' } },
          count: { $sum: 1 },
          avgCTC: { $avg: '$ctc' },
          highestCTC: { $max: '$ctc' },
        },
      },
      { $sort: { _id: 1 as const } },
      {
        $project: {
          month: '$_id',
          count: 1,
          avgCTC: { $round: ['$avgCTC', 2] },
          highestCTC: 1,
        },
      },
    ];

    const data = await collections.placementOffers.aggregate(pipeline).toArray();

    return data.map((d) => ({
      month: d.month,
      count: d.count,
      avgCTC: d.avgCTC || 0,
      highestCTC: d.highestCTC || 0,
    }));
  }
}

export const placementReportService = new PlacementReportService();
