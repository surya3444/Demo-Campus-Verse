import { ObjectId, Document } from 'mongodb';
import { collections } from '../../config/database';

interface DateRange {
  fromDate?: string;
  toDate?: string;
}

interface LeadsReportParams extends DateRange {
  groupBy?: 'source' | 'stage' | 'assignedTo' | 'day' | 'week' | 'month';
  source?: string;
  stage?: string;
  assignedTo?: string;
}

interface ApplicationsReportParams extends DateRange {
  groupBy?: 'status' | 'class' | 'source' | 'day' | 'week' | 'month';
  status?: string;
  classId?: string;
  academicBatchId?: string;
}

class AdmissionReportService {
  // ============ Leads Report ============
  async getLeadsReport(tenantId: string, branchId: string, params: LeadsReportParams = {}) {
    const { fromDate, toDate, groupBy = 'source', source, stage, assignedTo } = params;

    const match: Record<string, unknown> = {
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
    };

    if (fromDate || toDate) {
      match.createdAt = {};
      if (fromDate) (match.createdAt as Record<string, Date>).$gte = new Date(fromDate);
      if (toDate) (match.createdAt as Record<string, Date>).$lte = new Date(toDate);
    }

    if (source) match.source = source;
    if (stage) match.stage = stage;
    if (assignedTo) match.assignedTo = new ObjectId(assignedTo);

    // Get summary stats
    const summaryPipeline = [
      { $match: match },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          converted: { $sum: { $cond: [{ $eq: ['$stage', 'converted'] }, 1, 0] } },
          lost: { $sum: { $cond: [{ $eq: ['$stage', 'lost'] }, 1, 0] } },
          active: {
            $sum: {
              $cond: [
                { $and: [{ $ne: ['$stage', 'converted'] }, { $ne: ['$stage', 'lost'] }] },
                1,
                0,
              ],
            },
          },
          hasFollowupDue: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $ne: ['$nextFollowupDate', null] },
                    { $lt: ['$nextFollowupDate', new Date()] },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
    ];

    const summary = await collections.leads.aggregate(summaryPipeline).toArray();

    // Get grouped data based on groupBy parameter
    let groupByField: string;
    let groupPipeline: Document[];

    switch (groupBy) {
      case 'source':
        groupByField = '$source';
        groupPipeline = [
          { $match: match },
          {
            $group: {
              _id: groupByField,
              count: { $sum: 1 },
              converted: { $sum: { $cond: [{ $eq: ['$stage', 'converted'] }, 1, 0] } },
              lost: { $sum: { $cond: [{ $eq: ['$stage', 'lost'] }, 1, 0] } },
            },
          },
          { $sort: { count: -1 } },
        ];
        break;

      case 'stage':
        groupByField = '$stage';
        groupPipeline = [
          { $match: match },
          {
            $group: {
              _id: groupByField,
              count: { $sum: 1 },
            },
          },
          { $sort: { count: -1 } },
        ];
        break;

      case 'assignedTo':
        groupPipeline = [
          { $match: match },
          {
            $lookup: {
              from: 'users',
              localField: 'assignedTo',
              foreignField: '_id',
              as: 'assignee',
            },
          },
          { $unwind: { path: '$assignee', preserveNullAndEmptyArrays: true } },
          {
            $group: {
              _id: '$assignedTo',
              name: {
                $first: {
                  $concat: ['$assignee.profile.firstName', ' ', '$assignee.profile.lastName'],
                },
              },
              count: { $sum: 1 },
              converted: { $sum: { $cond: [{ $eq: ['$stage', 'converted'] }, 1, 0] } },
            },
          },
          { $sort: { count: -1 } },
        ];
        break;

      case 'day':
        groupPipeline = [
          { $match: match },
          {
            $group: {
              _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
              count: { $sum: 1 },
              converted: { $sum: { $cond: [{ $eq: ['$stage', 'converted'] }, 1, 0] } },
            },
          },
          { $sort: { _id: 1 } },
        ];
        break;

      case 'week':
        groupPipeline = [
          { $match: match },
          {
            $group: {
              _id: {
                year: { $isoWeekYear: '$createdAt' },
                week: { $isoWeek: '$createdAt' },
              },
              count: { $sum: 1 },
              converted: { $sum: { $cond: [{ $eq: ['$stage', 'converted'] }, 1, 0] } },
            },
          },
          { $sort: { '_id.year': 1, '_id.week': 1 } },
        ];
        break;

      case 'month':
        groupPipeline = [
          { $match: match },
          {
            $group: {
              _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
              count: { $sum: 1 },
              converted: { $sum: { $cond: [{ $eq: ['$stage', 'converted'] }, 1, 0] } },
            },
          },
          { $sort: { _id: 1 } },
        ];
        break;

      default:
        groupPipeline = [
          { $match: match },
          {
            $group: {
              _id: '$source',
              count: { $sum: 1 },
            },
          },
        ];
    }

    const groupedData = await collections.leads.aggregate(groupPipeline).toArray();

    // Get top sources
    const topSourcesPipeline = [
      { $match: match },
      {
        $group: {
          _id: '$source',
          count: { $sum: 1 },
          converted: { $sum: { $cond: [{ $eq: ['$stage', 'converted'] }, 1, 0] } },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 5 },
      {
        $project: {
          source: '$_id',
          count: 1,
          converted: 1,
          conversionRate: {
            $cond: [
              { $gt: ['$count', 0] },
              { $multiply: [{ $divide: ['$converted', '$count'] }, 100] },
              0,
            ],
          },
        },
      },
    ];

    const topSources = await collections.leads.aggregate(topSourcesPipeline).toArray();

    // Conversion funnel
    const funnelPipeline = [
      { $match: match },
      {
        $group: {
          _id: '$stage',
          count: { $sum: 1 },
        },
      },
    ];

    const funnelData = await collections.leads.aggregate(funnelPipeline).toArray();

    const stageOrder = [
      'new',
      'contacted',
      'interested',
      'followup',
      'visit_scheduled',
      'visited',
      'converted',
      'lost',
    ];
    const funnel = stageOrder.map((stage) => {
      const data = funnelData.find((f) => f._id === stage);
      return { stage, count: data?.count || 0 };
    });

    return {
      summary: summary[0] || { total: 0, converted: 0, lost: 0, active: 0, hasFollowupDue: 0 },
      groupedBy: groupBy,
      data: groupedData,
      topSources,
      funnel,
      conversionRate: summary[0]?.total
        ? ((summary[0].converted / summary[0].total) * 100).toFixed(2) + '%'
        : '0%',
    };
  }

  async getLeadsConversionReport(tenantId: string, branchId: string, params: DateRange = {}) {
    const { fromDate, toDate } = params;

    const match: Record<string, unknown> = {
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
    };

    if (fromDate || toDate) {
      match.createdAt = {};
      if (fromDate) (match.createdAt as Record<string, Date>).$gte = new Date(fromDate);
      if (toDate) (match.createdAt as Record<string, Date>).$lte = new Date(toDate);
    }

    // Average time to conversion
    const conversionTimePipeline = [
      {
        $match: {
          ...match,
          stage: 'converted',
          'stageHistory.stage': 'converted',
        },
      },
      {
        $project: {
          createdAt: 1,
          convertedAt: {
            $arrayElemAt: [
              {
                $filter: {
                  input: '$stageHistory',
                  as: 'h',
                  cond: { $eq: ['$$h.stage', 'converted'] },
                },
              },
              0,
            ],
          },
        },
      },
      {
        $project: {
          daysToConvert: {
            $divide: [{ $subtract: ['$convertedAt.date', '$createdAt'] }, 1000 * 60 * 60 * 24],
          },
        },
      },
      {
        $group: {
          _id: null,
          avgDays: { $avg: '$daysToConvert' },
          minDays: { $min: '$daysToConvert' },
          maxDays: { $max: '$daysToConvert' },
          count: { $sum: 1 },
        },
      },
    ];

    const conversionTime = await collections.leads.aggregate(conversionTimePipeline).toArray();

    // Conversion by source
    const conversionBySourcePipeline = [
      { $match: match },
      {
        $group: {
          _id: '$source',
          total: { $sum: 1 },
          converted: { $sum: { $cond: [{ $eq: ['$stage', 'converted'] }, 1, 0] } },
        },
      },
      {
        $project: {
          source: '$_id',
          total: 1,
          converted: 1,
          conversionRate: {
            $cond: [
              { $gt: ['$total', 0] },
              { $multiply: [{ $divide: ['$converted', '$total'] }, 100] },
              0,
            ],
          },
        },
      },
      { $sort: { conversionRate: -1 } },
    ];

    const conversionBySource = await collections.leads
      .aggregate(conversionBySourcePipeline)
      .toArray();

    return {
      averageConversionTime: conversionTime[0] || { avgDays: 0, minDays: 0, maxDays: 0, count: 0 },
      conversionBySource,
    };
  }

  // ============ Applications Report ============
  async getApplicationsReport(
    tenantId: string,
    branchId: string,
    params: ApplicationsReportParams = {}
  ) {
    const { fromDate, toDate, groupBy = 'status', status, classId, academicBatchId } = params;

    const match: Record<string, unknown> = {
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
    };

    if (fromDate || toDate) {
      match.createdAt = {};
      if (fromDate) (match.createdAt as Record<string, Date>).$gte = new Date(fromDate);
      if (toDate) (match.createdAt as Record<string, Date>).$lte = new Date(toDate);
    }

    if (status) match.status = status;
    if (classId) match.classId = new ObjectId(classId);
    if (academicBatchId) match.academicBatchId = new ObjectId(academicBatchId);

    // Summary stats
    const summaryPipeline = [
      { $match: match },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          draft: { $sum: { $cond: [{ $eq: ['$status', 'draft'] }, 1, 0] } },
          submitted: { $sum: { $cond: [{ $eq: ['$status', 'submitted'] }, 1, 0] } },
          underReview: { $sum: { $cond: [{ $eq: ['$status', 'under_review'] }, 1, 0] } },
          docsVerified: { $sum: { $cond: [{ $eq: ['$status', 'docs_verified'] }, 1, 0] } },
          feePaid: { $sum: { $cond: [{ $eq: ['$status', 'fee_paid'] }, 1, 0] } },
          approved: { $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] } },
          rejected: { $sum: { $cond: [{ $eq: ['$status', 'rejected'] }, 1, 0] } },
          enrolled: { $sum: { $cond: [{ $eq: ['$status', 'enrolled'] }, 1, 0] } },
          withdrawn: { $sum: { $cond: [{ $eq: ['$status', 'withdrawn'] }, 1, 0] } },
        },
      },
    ];

    const summary = await collections.applications.aggregate(summaryPipeline).toArray();

    // Grouped data
    let groupPipeline: Document[];

    switch (groupBy) {
      case 'status':
        groupPipeline = [
          { $match: match },
          {
            $group: {
              _id: '$status',
              count: { $sum: 1 },
            },
          },
          { $sort: { count: -1 } },
        ];
        break;

      case 'class':
        groupPipeline = [
          { $match: match },
          {
            $lookup: {
              from: 'classes',
              localField: 'classId',
              foreignField: '_id',
              as: 'class',
            },
          },
          { $unwind: { path: '$class', preserveNullAndEmptyArrays: true } },
          {
            $group: {
              _id: '$classId',
              className: { $first: '$class.name' },
              count: { $sum: 1 },
              enrolled: { $sum: { $cond: [{ $eq: ['$status', 'enrolled'] }, 1, 0] } },
              rejected: { $sum: { $cond: [{ $eq: ['$status', 'rejected'] }, 1, 0] } },
            },
          },
          { $sort: { count: -1 } },
        ];
        break;

      case 'source':
        groupPipeline = [
          { $match: match },
          {
            $group: {
              _id: '$source',
              count: { $sum: 1 },
              enrolled: { $sum: { $cond: [{ $eq: ['$status', 'enrolled'] }, 1, 0] } },
            },
          },
          { $sort: { count: -1 } },
        ];
        break;

      case 'day':
        groupPipeline = [
          { $match: match },
          {
            $group: {
              _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
              count: { $sum: 1 },
              enrolled: { $sum: { $cond: [{ $eq: ['$status', 'enrolled'] }, 1, 0] } },
            },
          },
          { $sort: { _id: 1 } },
        ];
        break;

      case 'week':
        groupPipeline = [
          { $match: match },
          {
            $group: {
              _id: {
                year: { $isoWeekYear: '$createdAt' },
                week: { $isoWeek: '$createdAt' },
              },
              count: { $sum: 1 },
              enrolled: { $sum: { $cond: [{ $eq: ['$status', 'enrolled'] }, 1, 0] } },
            },
          },
          { $sort: { '_id.year': 1, '_id.week': 1 } },
        ];
        break;

      case 'month':
        groupPipeline = [
          { $match: match },
          {
            $group: {
              _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
              count: { $sum: 1 },
              enrolled: { $sum: { $cond: [{ $eq: ['$status', 'enrolled'] }, 1, 0] } },
            },
          },
          { $sort: { _id: 1 } },
        ];
        break;

      default:
        groupPipeline = [
          { $match: match },
          {
            $group: {
              _id: '$status',
              count: { $sum: 1 },
            },
          },
        ];
    }

    const groupedData = await collections.applications.aggregate(groupPipeline).toArray();

    // Class-wise breakdown
    const classBreakdownPipeline = [
      { $match: match },
      {
        $lookup: {
          from: 'classes',
          localField: 'classId',
          foreignField: '_id',
          as: 'class',
        },
      },
      { $unwind: { path: '$class', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: {
            classId: '$classId',
            status: '$status',
          },
          className: { $first: '$class.name' },
          count: { $sum: 1 },
        },
      },
      {
        $group: {
          _id: '$_id.classId',
          className: { $first: '$className' },
          statusBreakdown: {
            $push: {
              status: '$_id.status',
              count: '$count',
            },
          },
          total: { $sum: '$count' },
        },
      },
      { $sort: { total: -1 } },
    ];

    const classBreakdown = await collections.applications
      .aggregate(classBreakdownPipeline)
      .toArray();

    // Application funnel
    const statusOrder = [
      'submitted',
      'under_review',
      'docs_verified',
      'fee_paid',
      'approved',
      'enrolled',
    ];
    const funnelData = summary[0] || {};
    const funnel = statusOrder.map((status) => ({
      status,
      count: funnelData[status.replace('_', '')] || funnelData[status] || 0,
    }));

    return {
      summary: summary[0] || {
        total: 0,
        draft: 0,
        submitted: 0,
        underReview: 0,
        docsVerified: 0,
        feePaid: 0,
        approved: 0,
        rejected: 0,
        enrolled: 0,
        withdrawn: 0,
      },
      groupedBy: groupBy,
      data: groupedData,
      classBreakdown,
      funnel,
      enrollmentRate: summary[0]?.total
        ? ((summary[0].enrolled / summary[0].total) * 100).toFixed(2) + '%'
        : '0%',
    };
  }

  async getApplicationProcessingTime(tenantId: string, branchId: string, params: DateRange = {}) {
    const { fromDate, toDate } = params;

    const match: Record<string, unknown> = {
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
      status: 'enrolled',
    };

    if (fromDate || toDate) {
      match.createdAt = {};
      if (fromDate) (match.createdAt as Record<string, Date>).$gte = new Date(fromDate);
      if (toDate) (match.createdAt as Record<string, Date>).$lte = new Date(toDate);
    }

    const pipeline = [
      { $match: match },
      {
        $project: {
          createdAt: 1,
          enrolledAt: {
            $arrayElemAt: [
              {
                $filter: {
                  input: '$statusHistory',
                  as: 'h',
                  cond: { $eq: ['$$h.status', 'enrolled'] },
                },
              },
              0,
            ],
          },
        },
      },
      {
        $project: {
          daysToEnroll: {
            $divide: [{ $subtract: ['$enrolledAt.changedAt', '$createdAt'] }, 1000 * 60 * 60 * 24],
          },
        },
      },
      {
        $group: {
          _id: null,
          avgDays: { $avg: '$daysToEnroll' },
          minDays: { $min: '$daysToEnroll' },
          maxDays: { $max: '$daysToEnroll' },
          count: { $sum: 1 },
        },
      },
    ];

    const result = await collections.applications.aggregate(pipeline).toArray();

    return result[0] || { avgDays: 0, minDays: 0, maxDays: 0, count: 0 };
  }

  // ============ Combined Admission Analytics ============
  async getAdmissionAnalytics(tenantId: string, branchId: string, params: DateRange = {}) {
    const [leadsReport, applicationsReport, conversionReport, processingTime] = await Promise.all([
      this.getLeadsReport(tenantId, branchId, { ...params, groupBy: 'source' }),
      this.getApplicationsReport(tenantId, branchId, { ...params, groupBy: 'status' }),
      this.getLeadsConversionReport(tenantId, branchId, params),
      this.getApplicationProcessingTime(tenantId, branchId, params),
    ]);

    return {
      leads: leadsReport.summary,
      applications: applicationsReport.summary,
      conversion: conversionReport,
      processingTime,
      topSources: leadsReport.topSources,
      leadsFunnel: leadsReport.funnel,
      applicationsFunnel: applicationsReport.funnel,
    };
  }
}

export const admissionReportService = new AdmissionReportService();
