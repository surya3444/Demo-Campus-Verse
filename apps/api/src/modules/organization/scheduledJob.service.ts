import { ObjectId, WithId, Document } from 'mongodb';
import { collections } from '../../config/database';
import { logger } from '../../lib/logger';
import { ApiError } from '../../middleware/errorHandler';

interface ScheduledJobDocument extends Document {
  _id: ObjectId;
  tenantId: ObjectId;
  branchId?: ObjectId;
  name: string;
  code: string;
  description?: string;
  type: 'report' | 'notification' | 'sync' | 'cleanup' | 'reminder' | 'custom';

  // Schedule configuration
  schedule: {
    type: 'once' | 'daily' | 'weekly' | 'monthly' | 'cron';
    time?: string; // HH:mm format
    dayOfWeek?: number; // 0-6 for weekly
    dayOfMonth?: number; // 1-31 for monthly
    cronExpression?: string; // For cron type
    timezone: string;
  };

  // Job configuration
  config: {
    module: string;
    action: string;
    params?: Record<string, unknown>;
    recipients?: string[]; // Email addresses for notifications/reports
  };

  // Execution tracking
  lastRun?: Date;
  nextRun?: Date;
  runCount: number;
  lastStatus?: 'success' | 'failed' | 'running';
  lastError?: string;

  isActive: boolean;
  createdBy: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

interface JobExecutionDocument extends Document {
  _id: ObjectId;
  jobId: ObjectId;
  tenantId: ObjectId;
  status: 'running' | 'success' | 'failed';
  startedAt: Date;
  completedAt?: Date;
  duration?: number; // in milliseconds
  result?: Record<string, unknown>;
  error?: string;
}

interface CreateJobInput {
  name: string;
  code: string;
  description?: string;
  type: ScheduledJobDocument['type'];
  schedule: ScheduledJobDocument['schedule'];
  config: ScheduledJobDocument['config'];
  branchId?: string;
}

class ScheduledJobService {
  async getJobs(
    tenantId: string,
    branchId?: string,
    params: { type?: string; isActive?: boolean } = {}
  ) {
    const filter: Record<string, unknown> = {
      tenantId: new ObjectId(tenantId),
    };

    if (branchId) {
      filter.$or = [{ branchId: new ObjectId(branchId) }, { branchId: { $exists: false } }];
    }

    if (params.type) filter.type = params.type;
    if (params.isActive !== undefined) filter.isActive = params.isActive;

    const jobs = (await collections.scheduledJobs
      .find(filter)
      .sort({ name: 1 })
      .toArray()) as WithId<ScheduledJobDocument>[];

    return jobs.map(this.formatJob);
  }

  async getJob(tenantId: string, jobId: string) {
    const job = (await collections.scheduledJobs.findOne({
      _id: new ObjectId(jobId),
      tenantId: new ObjectId(tenantId),
    })) as WithId<ScheduledJobDocument> | null;

    if (!job) {
      throw new ApiError('JOB_NOT_FOUND', 'Scheduled job not found', 404);
    }

    return this.formatJob(job);
  }

  async createJob(tenantId: string, data: CreateJobInput, createdBy: string) {
    // Check for duplicate code
    const existing = await collections.scheduledJobs.findOne({
      tenantId: new ObjectId(tenantId),
      code: data.code,
    });

    if (existing) {
      throw new ApiError('DUPLICATE_JOB', 'Job with this code already exists', 400);
    }

    const now = new Date();
    const nextRun = this.calculateNextRun(data.schedule);

    const job: ScheduledJobDocument = {
      _id: new ObjectId(),
      tenantId: new ObjectId(tenantId),
      branchId: data.branchId ? new ObjectId(data.branchId) : undefined,
      name: data.name,
      code: data.code,
      description: data.description,
      type: data.type,
      schedule: {
        ...data.schedule,
        timezone: data.schedule.timezone || 'Asia/Kolkata',
      },
      config: data.config,
      nextRun,
      runCount: 0,
      isActive: true,
      createdBy: new ObjectId(createdBy),
      createdAt: now,
      updatedAt: now,
    };

    await collections.scheduledJobs.insertOne(job);

    logger.info(
      { jobId: job._id.toString(), tenantId, code: data.code, createdBy },
      'Scheduled job created'
    );

    return this.formatJob(job as WithId<ScheduledJobDocument>);
  }

  async updateJob(
    tenantId: string,
    jobId: string,
    data: Partial<CreateJobInput>,
    updatedBy: string
  ) {
    const existing = await collections.scheduledJobs.findOne({
      _id: new ObjectId(jobId),
      tenantId: new ObjectId(tenantId),
    });

    if (!existing) {
      throw new ApiError('JOB_NOT_FOUND', 'Scheduled job not found', 404);
    }

    const updateData: Record<string, unknown> = { updatedAt: new Date() };

    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.type !== undefined) updateData.type = data.type;
    if (data.config !== undefined) updateData.config = data.config;

    if (data.schedule !== undefined) {
      updateData.schedule = {
        ...data.schedule,
        timezone: data.schedule.timezone || 'Asia/Kolkata',
      };
      updateData.nextRun = this.calculateNextRun(data.schedule);
    }

    const result = await collections.scheduledJobs.findOneAndUpdate(
      { _id: new ObjectId(jobId) },
      { $set: updateData },
      { returnDocument: 'after' }
    );

    logger.info({ jobId, tenantId, updatedBy }, 'Scheduled job updated');

    return this.formatJob(result as WithId<ScheduledJobDocument>);
  }

  async toggleJobStatus(tenantId: string, jobId: string, isActive: boolean, updatedBy: string) {
    const result = await collections.scheduledJobs.findOneAndUpdate(
      {
        _id: new ObjectId(jobId),
        tenantId: new ObjectId(tenantId),
      },
      {
        $set: {
          isActive,
          updatedAt: new Date(),
        },
      },
      { returnDocument: 'after' }
    );

    if (!result) {
      throw new ApiError('JOB_NOT_FOUND', 'Scheduled job not found', 404);
    }

    logger.info({ jobId, tenantId, isActive, updatedBy }, 'Scheduled job status toggled');

    return this.formatJob(result as WithId<ScheduledJobDocument>);
  }

  async deleteJob(tenantId: string, jobId: string, deletedBy: string) {
    const result = await collections.scheduledJobs.deleteOne({
      _id: new ObjectId(jobId),
      tenantId: new ObjectId(tenantId),
    });

    if (result.deletedCount === 0) {
      throw new ApiError('JOB_NOT_FOUND', 'Scheduled job not found', 404);
    }

    // Also delete execution history
    await collections.jobExecutions.deleteMany({
      jobId: new ObjectId(jobId),
    });

    logger.info({ jobId, tenantId, deletedBy }, 'Scheduled job deleted');

    return { success: true };
  }

  async runJobNow(tenantId: string, jobId: string, triggeredBy: string) {
    const job = await this.getJob(tenantId, jobId);

    // Create execution record
    const execution: JobExecutionDocument = {
      _id: new ObjectId(),
      jobId: new ObjectId(jobId),
      tenantId: new ObjectId(tenantId),
      status: 'running',
      startedAt: new Date(),
    };

    await collections.jobExecutions.insertOne(execution);

    // Update job status
    await collections.scheduledJobs.updateOne(
      { _id: new ObjectId(jobId) },
      {
        $set: {
          lastStatus: 'running',
          lastRun: new Date(),
          updatedAt: new Date(),
        },
      }
    );

    logger.info({ jobId, tenantId, triggeredBy }, 'Manual job execution started');

    // Note: In a real implementation, this would trigger the actual job execution
    // For now, we'll simulate a successful completion after a short delay
    setTimeout(async () => {
      await this.completeExecution(execution._id.toString(), tenantId, 'success');
    }, 1000);

    return {
      executionId: execution._id.toString(),
      job,
      message: 'Job execution started',
    };
  }

  async getJobExecutions(tenantId: string, jobId: string, params: { limit?: number } = {}) {
    const { limit = 20 } = params;

    const executions = (await collections.jobExecutions
      .find({
        jobId: new ObjectId(jobId),
        tenantId: new ObjectId(tenantId),
      })
      .sort({ startedAt: -1 })
      .limit(limit)
      .toArray()) as WithId<JobExecutionDocument>[];

    return executions.map(this.formatExecution);
  }

  async completeExecution(
    executionId: string,
    tenantId: string,
    status: 'success' | 'failed',
    result?: Record<string, unknown>,
    error?: string
  ) {
    const completedAt = new Date();

    const execution = (await collections.jobExecutions.findOneAndUpdate(
      {
        _id: new ObjectId(executionId),
        tenantId: new ObjectId(tenantId),
      },
      {
        $set: {
          status,
          completedAt,
          result,
          error,
        },
      },
      { returnDocument: 'after' }
    )) as WithId<JobExecutionDocument> | null;

    if (execution) {
      const duration = completedAt.getTime() - execution.startedAt.getTime();

      await collections.jobExecutions.updateOne(
        { _id: new ObjectId(executionId) },
        { $set: { duration } }
      );

      // Update job with last execution status
      const job = await collections.scheduledJobs.findOne({ _id: execution.jobId });
      if (job) {
        const nextRun = this.calculateNextRun(job.schedule);
        await collections.scheduledJobs.updateOne(
          { _id: execution.jobId },
          {
            $set: {
              lastStatus: status,
              lastError: error,
              nextRun,
              updatedAt: new Date(),
            },
            $inc: { runCount: 1 },
          }
        );
      }
    }

    return execution ? this.formatExecution(execution) : null;
  }

  private calculateNextRun(schedule: ScheduledJobDocument['schedule']): Date {
    const now = new Date();
    const [hours, minutes] = (schedule.time || '00:00').split(':').map(Number);

    switch (schedule.type) {
      case 'once': {
        // For one-time jobs, use the specified time.
        const onceDate = new Date(now);
        onceDate.setHours(hours, minutes, 0, 0);

        if (onceDate <= now) {
          onceDate.setDate(onceDate.getDate() + 1);
        }

        return onceDate;
      }

      case 'daily': {
        const dailyDate = new Date(now);
        dailyDate.setHours(hours, minutes, 0, 0);

        if (dailyDate <= now) {
          dailyDate.setDate(dailyDate.getDate() + 1);
        }

        return dailyDate;
      }

      case 'weekly': {
        const weeklyDate = new Date(now);
        weeklyDate.setHours(hours, minutes, 0, 0);

        const currentDay = weeklyDate.getDay();
        const targetDay = schedule.dayOfWeek || 0;
        let daysUntilTarget = targetDay - currentDay;

        if (daysUntilTarget <= 0) {
          daysUntilTarget += 7;
        }

        weeklyDate.setDate(weeklyDate.getDate() + daysUntilTarget);
        return weeklyDate;
      }

      case 'monthly': {
        const monthlyDate = new Date(now);
        monthlyDate.setHours(hours, minutes, 0, 0);
        monthlyDate.setDate(schedule.dayOfMonth || 1);

        if (monthlyDate <= now) {
          monthlyDate.setMonth(monthlyDate.getMonth() + 1);
        }

        return monthlyDate;
      }

      case 'cron': {
        // Placeholder until cron expressions are parsed.
        const cronDate = new Date(now);
        cronDate.setHours(now.getHours() + 1, 0, 0, 0);
        return cronDate;
      }

      default: {
        return new Date(now.getTime() + 24 * 60 * 60 * 1000);
      }
    }
  }

  private formatJob(job: WithId<ScheduledJobDocument>) {
    return {
      _id: job._id.toString(),
      tenantId: job.tenantId.toString(),
      branchId: job.branchId?.toString(),
      name: job.name,
      code: job.code,
      description: job.description,
      type: job.type,
      schedule: job.schedule,
      config: job.config,
      lastRun: job.lastRun,
      nextRun: job.nextRun,
      runCount: job.runCount,
      lastStatus: job.lastStatus,
      lastError: job.lastError,
      isActive: job.isActive,
      createdBy: job.createdBy.toString(),
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
    };
  }

  private formatExecution(execution: WithId<JobExecutionDocument>) {
    return {
      _id: execution._id.toString(),
      jobId: execution.jobId.toString(),
      tenantId: execution.tenantId.toString(),
      status: execution.status,
      startedAt: execution.startedAt,
      completedAt: execution.completedAt,
      duration: execution.duration,
      result: execution.result,
      error: execution.error,
    };
  }

  // ============ Predefined Job Templates ============
  getJobTemplates() {
    return [
      {
        code: 'daily_attendance_report',
        name: 'Daily Attendance Report',
        type: 'report',
        description: 'Generate and email daily attendance summary',
        config: {
          module: 'attendance',
          action: 'generateDailyReport',
        },
        suggestedSchedule: {
          type: 'daily',
          time: '18:00',
        },
      },
      {
        code: 'fee_due_reminder',
        name: 'Fee Due Reminder',
        type: 'reminder',
        description: 'Send SMS/Email reminders for pending fees',
        config: {
          module: 'finance',
          action: 'sendFeeReminders',
        },
        suggestedSchedule: {
          type: 'weekly',
          dayOfWeek: 1, // Monday
          time: '10:00',
        },
      },
      {
        code: 'monthly_fee_report',
        name: 'Monthly Fee Collection Report',
        type: 'report',
        description: 'Generate monthly fee collection summary',
        config: {
          module: 'finance',
          action: 'generateMonthlyReport',
        },
        suggestedSchedule: {
          type: 'monthly',
          dayOfMonth: 1,
          time: '08:00',
        },
      },
      {
        code: 'followup_reminder',
        name: 'Lead Follow-up Reminder',
        type: 'reminder',
        description: 'Notify staff about pending lead follow-ups',
        config: {
          module: 'admissions',
          action: 'sendFollowupReminders',
        },
        suggestedSchedule: {
          type: 'daily',
          time: '09:00',
        },
      },
      {
        code: 'birthday_wishes',
        name: 'Birthday Wishes',
        type: 'notification',
        description: 'Send birthday wishes to students and staff',
        config: {
          module: 'communication',
          action: 'sendBirthdayWishes',
        },
        suggestedSchedule: {
          type: 'daily',
          time: '08:00',
        },
      },
      {
        code: 'data_cleanup',
        name: 'Data Cleanup',
        type: 'cleanup',
        description: 'Clean up old logs and temporary data',
        config: {
          module: 'system',
          action: 'cleanupData',
          params: { olderThanDays: 90 },
        },
        suggestedSchedule: {
          type: 'weekly',
          dayOfWeek: 0, // Sunday
          time: '02:00',
        },
      },
    ];
  }
}

export const scheduledJobService = new ScheduledJobService();
