import { ObjectId } from 'mongodb';
import { collections } from '../../../config/database';

class AlumniReportService {
  async getAlumniDemographics(tenantId: string, branchId: string) {
    const baseMatch = {
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
    };

    const [totalAndVerified, topCompanies, topRoles, locationDist, gradYearDist, mentorsCount] =
      await Promise.all([
        // Total alumni and verified count
        collections.alumniProfiles
          .aggregate([
            { $match: baseMatch },
            {
              $group: {
                _id: null,
                total: { $sum: 1 },
                verified: {
                  $sum: { $cond: [{ $eq: ['$isVerified', true] }, 1, 0] },
                },
              },
            },
          ])
          .toArray(),

        // Top companies
        collections.alumniProfiles
          .aggregate([
            {
              $match: {
                ...baseMatch,
                company: { $nin: [null, ''] },
              },
            },
            {
              $group: {
                _id: '$company',
                count: { $sum: 1 },
              },
            },
            { $sort: { count: -1 as const } },
            { $limit: 15 },
            {
              $project: {
                company: '$_id',
                count: 1,
                _id: 0,
              },
            },
          ])
          .toArray(),

        // Top roles
        collections.alumniProfiles
          .aggregate([
            {
              $match: {
                ...baseMatch,
                designation: { $nin: [null, ''] },
              },
            },
            {
              $group: {
                _id: '$designation',
                count: { $sum: 1 },
              },
            },
            { $sort: { count: -1 as const } },
            { $limit: 15 },
            {
              $project: {
                role: '$_id',
                count: 1,
                _id: 0,
              },
            },
          ])
          .toArray(),

        // Location distribution
        collections.alumniProfiles
          .aggregate([
            {
              $match: {
                ...baseMatch,
                location: { $nin: [null, ''] },
              },
            },
            {
              $group: {
                _id: '$location',
                count: { $sum: 1 },
              },
            },
            { $sort: { count: -1 as const } },
            { $limit: 20 },
            {
              $project: {
                location: '$_id',
                count: 1,
                _id: 0,
              },
            },
          ])
          .toArray(),

        // Graduation year distribution
        collections.alumniProfiles
          .aggregate([
            {
              $match: {
                ...baseMatch,
                graduationYear: { $ne: null },
              },
            },
            {
              $group: {
                _id: '$graduationYear',
                count: { $sum: 1 },
              },
            },
            { $sort: { _id: -1 as const } },
            {
              $project: {
                year: '$_id',
                count: 1,
                _id: 0,
              },
            },
          ])
          .toArray(),

        // Mentors available count
        collections.alumniProfiles.countDocuments({
          ...baseMatch,
          'mentorshipInfo.willingToMentor': true,
        }),
      ]);

    const counts = totalAndVerified[0] || { total: 0, verified: 0 };

    return {
      totalAlumni: counts.total,
      verifiedCount: counts.verified,
      topCompanies,
      topRoles,
      locationDistribution: locationDist,
      graduationYearDistribution: gradYearDist,
      mentorsAvailable: mentorsCount,
    };
  }

  async getMentorshipImpact(tenantId: string, branchId: string) {
    const baseMatch = {
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
    };

    const [programsByStatus, sessionStats, guidanceAreas, activeMentors, activeMentees] =
      await Promise.all([
        // Programs by status
        collections.mentorshipPrograms
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

        // Total sessions conducted and average per program
        collections.mentorshipPrograms
          .aggregate([
            { $match: baseMatch },
            {
              $project: {
                sessionCount: {
                  $cond: [{ $isArray: '$sessions' }, { $size: '$sessions' }, 0],
                },
              },
            },
            {
              $group: {
                _id: null,
                totalSessions: { $sum: '$sessionCount' },
                totalPrograms: { $sum: 1 },
                avgSessionsPerProgram: { $avg: '$sessionCount' },
              },
            },
          ])
          .toArray(),

        // Top areas of guidance
        collections.mentorshipPrograms
          .aggregate([
            { $match: baseMatch },
            { $unwind: '$areaOfGuidance' },
            {
              $group: {
                _id: '$areaOfGuidance',
                count: { $sum: 1 },
              },
            },
            { $sort: { count: -1 as const } },
            { $limit: 10 },
            {
              $project: {
                area: '$_id',
                count: 1,
                _id: 0,
              },
            },
          ])
          .toArray(),

        // Active mentors count (distinct mentors in active programs)
        collections.mentorshipPrograms
          .aggregate([
            {
              $match: {
                ...baseMatch,
                status: 'active',
              },
            },
            {
              $group: {
                _id: '$mentorId',
              },
            },
            {
              $count: 'total',
            },
          ])
          .toArray(),

        // Active mentees count (distinct mentees in active programs)
        collections.mentorshipPrograms
          .aggregate([
            {
              $match: {
                ...baseMatch,
                status: 'active',
              },
            },
            {
              $group: {
                _id: '$menteeId',
              },
            },
            {
              $count: 'total',
            },
          ])
          .toArray(),
      ]);

    // Build status map
    const statusMap: Record<string, number> = {};
    for (const s of programsByStatus) {
      statusMap[s._id as string] = s.count;
    }

    const sessions = sessionStats[0] || {
      totalSessions: 0,
      totalPrograms: 0,
      avgSessionsPerProgram: 0,
    };

    return {
      programsByStatus: statusMap,
      totalSessions: sessions.totalSessions,
      averageSessionsPerProgram: Math.round((sessions.avgSessionsPerProgram || 0) * 100) / 100,
      topGuidanceAreas: guidanceAreas,
      activeMentorsCount: activeMentors[0]?.total || 0,
      activeMenteesCount: activeMentees[0]?.total || 0,
    };
  }
}

export const alumniReportService = new AlumniReportService();
