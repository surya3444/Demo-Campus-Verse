import { ObjectId, WithId, Document, Filter } from 'mongodb';
import { collections } from '../../config/database';
import { logger } from '../../lib/logger';
import { ApiError } from '../../middleware/errorHandler';

export type JobType = 'attendance_summary' | 'fee_reminder' | 'report_generation' | 'data_backup';
export type JobStatus = 'active' | 'paused' | 'disabled';
export type ExecutionStatus = 'running' | 'success' | 'failed';

export interface ScheduledJobDocument extends Document {
  _id: ObjectId;
  tenantId: ObjectId;
  branchId?: ObjectId;
  name: string;
  type: JobType;
  schedule: string; // cron expression
  config: Record<string, unknown>;
  status: JobStatus;
  lastRun?: Date;
  nextRun: Date;
  createdBy: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface JobExecutionDocument extends Document {
  _id: ObjectId;
  jobId: ObjectId;
  tenantId: ObjectId;
  status: ExecutionStatus;
  startedAt: Date;
  completedAt?: Date;
  result?: Record<string, unknown>;
  error?: string;
}

export interface CreateJobInput {
  name: string;
  type: JobType;
  schedule: string;
  config?: Record<string, unknown>;
  branchId?: string;
}

export interface UpdateJobInput {
  name?: string;
  schedule?: string;
  config?: Record<string, unknown>;
  status?: JobStatus;
}

export interface JobListParams {
  type?: JobType;
  status?: JobStatus;
  branchId?: string;
  page?: number;
  limit?: number;
}

class SchedulerService {
  private parseNextRun(cronExpression: string): Date {
    // Simple cron parsing for common patterns
    // Format: minute hour dayOfMonth month dayOfWeek
    const parts = cronExpression.split(' ');
    if (parts.length !== 5) {
      // Invalid cron, return next hour as fallback
      const next = new Date();
      next.setHours(next.getHours() + 1, 0, 0, 0);
      return next;
    }

    const [minute, hour] = parts;
    const now = new Date();
    const next = new Date(now);
    next.setSeconds(0);
    next.setMilliseconds(0);

    // Parse minute
    const targetMinute = minute === '*' ? now.getMinutes() : parseInt(minute, 10);
    // Parse hour
    const targetHour = hour === '*' ? now.getHours() : parseInt(hour, 10);

    next.setMinutes(targetMinute);
    next.setHours(targetHour);

    // If the calculated time is in the past, move to next occurrence
    if (next <= now) {
      if (hour === '*') {
        // Runs every hour at specified minute
        next.setHours(now.getHours() + 1);
      } else if (minute === '*') {
        // Runs every minute in specified hour - move to next day
        next.setDate(next.getDate() + 1);
      } else {
        // Specific time - move to next day
        next.setDate(next.getDate() + 1);
      }
    }

    return next;
  }

  async create(tenantId: string, data: CreateJobInput, createdBy: string) {
    // Validate cron expression (basic validation)
    const cronParts = data.schedule.split(' ');
    if (cronParts.length !== 5) {
      throw new ApiError(
        'INVALID_CRON',
        'Invalid cron expression. Must have 5 parts: minute hour day month weekday',
        400
      );
    }

    const jobId = new ObjectId();
    const now = new Date();

    const job: ScheduledJobDocument = {
      _id: jobId,
      tenantId: new ObjectId(tenantId),
      branchId: data.branchId ? new ObjectId(data.branchId) : undefined,
      name: data.name,
      type: data.type,
      schedule: data.schedule,
      config: data.config || {},
      status: 'active',
      nextRun: this.parseNextRun(data.schedule),
      createdBy: new ObjectId(createdBy),
      createdAt: now,
      updatedAt: now,
    };

    await collections.scheduledJobs.insertOne(job);

    logger.info({ jobId: jobId.toString(), type: data.type, tenantId }, 'Scheduled job created');

    return this.formatJob(job as WithId<ScheduledJobDocument>);
  }

  async findById(tenantId: string, jobId: string) {
    const job = (await collections.scheduledJobs.findOne({
      _id: new ObjectId(jobId),
      tenantId: new ObjectId(tenantId),
    })) as WithId<ScheduledJobDocument> | null;

    if (!job) {
      throw new ApiError('JOB_NOT_FOUND', 'Scheduled job not found', 404);
    }

    return this.formatJob(job);
  }

  async findAll(tenantId: string, params: JobListParams = {}) {
    const { type, status, branchId, page = 1, limit = 20 } = params;
    const skip = (page - 1) * limit;

    const filter: Filter<Document> = {
      tenantId: new ObjectId(tenantId),
    };

    if (type) {
      filter.type = type;
    }

    if (status) {
      filter.status = status;
    }

    if (branchId) {
      filter.branchId = new ObjectId(branchId);
    }

    const [jobs, total] = await Promise.all([
      collections.scheduledJobs
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .toArray() as Promise<WithId<ScheduledJobDocument>[]>,
      collections.scheduledJobs.countDocuments(filter),
    ]);

    return {
      data: jobs.map((j) => this.formatJob(j)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: skip + jobs.length < total,
      },
    };
  }

  async update(tenantId: string, jobId: string, data: UpdateJobInput, updatedBy: string) {
    const existing = await collections.scheduledJobs.findOne({
      _id: new ObjectId(jobId),
      tenantId: new ObjectId(tenantId),
    });

    if (!existing) {
      throw new ApiError('JOB_NOT_FOUND', 'Scheduled job not found', 404);
    }

    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (data.name) {
      updateData.name = data.name;
    }

    if (data.schedule) {
      // Validate cron expression
      const cronParts = data.schedule.split(' ');
      if (cronParts.length !== 5) {
        throw new ApiError(
          'INVALID_CRON',
          'Invalid cron expression. Must have 5 parts: minute hour day month weekday',
          400
        );
      }
      updateData.schedule = data.schedule;
      updateData.nextRun = this.parseNextRun(data.schedule);
    }

    if (data.config) {
      updateData.config = data.config;
    }

    if (data.status) {
      updateData.status = data.status;
    }

    await collections.scheduledJobs.updateOne({ _id: new ObjectId(jobId) }, { $set: updateData });

    logger.info({ jobId, tenantId, updatedBy }, 'Scheduled job updated');

    return this.findById(tenantId, jobId);
  }

  async delete(tenantId: string, jobId: string, deletedBy: string) {
    const result = await collections.scheduledJobs.deleteOne({
      _id: new ObjectId(jobId),
      tenantId: new ObjectId(tenantId),
    });

    if (result.deletedCount === 0) {
      throw new ApiError('JOB_NOT_FOUND', 'Scheduled job not found', 404);
    }

    // Also delete related executions
    await collections.jobExecutions.deleteMany({
      jobId: new ObjectId(jobId),
    });

    logger.info({ jobId, tenantId, deletedBy }, 'Scheduled job deleted');

    return { deleted: true };
  }

  async getJobHistory(tenantId: string, jobId: string, params: { page?: number; limit?: number }) {
    const { page = 1, limit = 20 } = params;
    const skip = (page - 1) * limit;

    // Verify job exists
    const job = await collections.scheduledJobs.findOne({
      _id: new ObjectId(jobId),
      tenantId: new ObjectId(tenantId),
    });

    if (!job) {
      throw new ApiError('JOB_NOT_FOUND', 'Scheduled job not found', 404);
    }

    const [executions, total] = await Promise.all([
      collections.jobExecutions
        .find({ jobId: new ObjectId(jobId) })
        .sort({ startedAt: -1 })
        .skip(skip)
        .limit(limit)
        .toArray(),
      collections.jobExecutions.countDocuments({ jobId: new ObjectId(jobId) }),
    ]);

    return {
      data: executions.map((e) => ({
        _id: e._id.toString(),
        jobId: e.jobId.toString(),
        status: e.status,
        startedAt: e.startedAt,
        completedAt: e.completedAt,
        duration: e.completedAt
          ? Math.round((e.completedAt.getTime() - e.startedAt.getTime()) / 1000)
          : null,
        result: e.result,
        error: e.error,
      })),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: skip + executions.length < total,
      },
    };
  }

  async runJob(tenantId: string, jobId: string, _triggeredBy: string) {
    const job = (await collections.scheduledJobs.findOne({
      _id: new ObjectId(jobId),
      tenantId: new ObjectId(tenantId),
    })) as WithId<ScheduledJobDocument> | null;

    if (!job) {
      throw new ApiError('JOB_NOT_FOUND', 'Scheduled job not found', 404);
    }

    // Create execution record
    const executionId = new ObjectId();
    const now = new Date();

    const execution: JobExecutionDocument = {
      _id: executionId,
      jobId: job._id,
      tenantId: new ObjectId(tenantId),
      status: 'running',
      startedAt: now,
    };

    await collections.jobExecutions.insertOne(execution);

    logger.info({ jobId, executionId: executionId.toString(), tenantId }, 'Job execution started');

    // Execute job in background
    this.executeJob(job, executionId.toString()).catch((error) => {
      logger.error({ jobId, executionId: executionId.toString(), error }, 'Job execution failed');
    });

    return {
      executionId: executionId.toString(),
      status: 'running',
      message: 'Job execution started',
    };
  }

  private async executeJob(job: WithId<ScheduledJobDocument>, executionId: string) {
    const startTime = Date.now();
    let result: Record<string, unknown> = {};
    let error: string | undefined;
    let status: ExecutionStatus = 'success';

    try {
      switch (job.type) {
        case 'attendance_summary':
          result = await this.runAttendanceSummaryJob(job);
          break;
        case 'fee_reminder':
          result = await this.runFeeReminderJob(job);
          break;
        case 'report_generation':
          result = await this.runReportGenerationJob(job);
          break;
        case 'data_backup':
          result = await this.runDataBackupJob(job);
          break;
        default:
          throw new Error(`Unknown job type: ${job.type}`);
      }
    } catch (err) {
      status = 'failed';
      error = err instanceof Error ? err.message : 'Unknown error';
    }

    // Update execution record
    const completedAt = new Date();
    await collections.jobExecutions.updateOne(
      { _id: new ObjectId(executionId) },
      {
        $set: {
          status,
          completedAt,
          result,
          error,
        },
      }
    );

    // Update job's lastRun and nextRun
    await collections.scheduledJobs.updateOne(
      { _id: job._id },
      {
        $set: {
          lastRun: completedAt,
          nextRun: this.parseNextRun(job.schedule),
          updatedAt: new Date(),
        },
      }
    );

    logger.info(
      {
        jobId: job._id.toString(),
        executionId,
        status,
        duration: Date.now() - startTime,
      },
      'Job execution completed'
    );
  }

  // Job Implementations
  private async runAttendanceSummaryJob(
    _job: WithId<ScheduledJobDocument>
  ): Promise<Record<string, unknown>> {
    // Placeholder implementation
    // In production, this would:
    // 1. Query attendance data for the day
    // 2. Generate a summary
    // 3. Send notifications (email/SMS) to relevant users
    return {
      type: 'attendance_summary',
      processedAt: new Date(),
      message: 'Attendance summary job executed successfully',
    };
  }

  private async runFeeReminderJob(
    job: WithId<ScheduledJobDocument>
  ): Promise<Record<string, unknown>> {
    // Placeholder implementation
    // In production, this would:
    // 1. Query students with pending fees
    // 2. Send reminders via SMS/email
    // 3. Log the notifications sent
    const config = job.config as {
      daysBeforeDue?: number;
      sendSms?: boolean;
      sendEmail?: boolean;
    };

    return {
      type: 'fee_reminder',
      processedAt: new Date(),
      config: {
        daysBeforeDue: config.daysBeforeDue || 7,
        sendSms: config.sendSms || false,
        sendEmail: config.sendEmail || true,
      },
      message: 'Fee reminder job executed successfully',
    };
  }

  private async runReportGenerationJob(
    job: WithId<ScheduledJobDocument>
  ): Promise<Record<string, unknown>> {
    // Placeholder implementation
    // In production, this would:
    // 1. Generate the specified report
    // 2. Store it or send it via email
    const config = job.config as {
      reportType?: string;
      format?: string;
      recipients?: string[];
    };

    return {
      type: 'report_generation',
      processedAt: new Date(),
      config: {
        reportType: config.reportType || 'daily_summary',
        format: config.format || 'pdf',
      },
      message: 'Report generation job executed successfully',
    };
  }

  private async runDataBackupJob(
    _job: WithId<ScheduledJobDocument>
  ): Promise<Record<string, unknown>> {
    // Placeholder implementation
    // In production, this would:
    // 1. Create a backup of tenant data
    // 2. Store it in a backup location
    return {
      type: 'data_backup',
      processedAt: new Date(),
      message: 'Data backup job executed successfully',
    };
  }

  async pauseJob(tenantId: string, jobId: string, pausedBy: string) {
    return this.update(tenantId, jobId, { status: 'paused' }, pausedBy);
  }

  async resumeJob(tenantId: string, jobId: string, resumedBy: string) {
    return this.update(tenantId, jobId, { status: 'active' }, resumedBy);
  }

  private formatJob(job: WithId<ScheduledJobDocument>) {
    return {
      _id: job._id.toString(),
      tenantId: job.tenantId.toString(),
      branchId: job.branchId?.toString(),
      name: job.name,
      type: job.type,
      schedule: job.schedule,
      config: job.config,
      status: job.status,
      lastRun: job.lastRun,
      nextRun: job.nextRun,
      createdBy: job.createdBy.toString(),
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
    };
  }
}

export const schedulerService = new SchedulerService();
