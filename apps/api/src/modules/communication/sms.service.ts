import { ObjectId, WithId, Document, Filter } from 'mongodb';
import { collections } from '../../config/database';
import { logger } from '../../lib/logger';
import { ApiError } from '../../middleware/errorHandler';
import { communicationSettingsService } from './communicationSettings.service';

interface SMSLogDocument extends Document {
  _id: ObjectId;
  tenantId: ObjectId;
  branchId: ObjectId;
  templateCode?: string;
  recipients: Array<{
    phone: string;
    name?: string;
    studentId?: ObjectId;
    staffId?: ObjectId;
    status: 'queued' | 'sent' | 'delivered' | 'failed';
    deliveredAt?: Date;
    failureReason?: string;
  }>;
  message: string;
  messageType: 'transactional' | 'promotional';
  category: 'fee' | 'attendance' | 'exam' | 'event' | 'announcement' | 'general';
  variables?: Record<string, string>;
  sentBy: ObjectId;
  sentAt: Date;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  totalRecipients: number;
  successCount: number;
  failureCount: number;
  gatewayResponse?: unknown;
  createdAt: Date;
  updatedAt: Date;
}

export interface SendSMSInput {
  templateCode?: string;
  message?: string;
  recipients: Array<{
    phone: string;
    name?: string;
    studentId?: string;
    staffId?: string;
    variables?: Record<string, string>;
  }>;
  category: 'fee' | 'attendance' | 'exam' | 'event' | 'announcement' | 'general';
  messageType?: 'transactional' | 'promotional';
}

class SMSService {
  async sendSMS(
    tenantId: string,
    branchId: string,
    data: SendSMSInput,
    sentBy: string
  ) {
    const settings = await communicationSettingsService.getSettings(tenantId, branchId);

    // Check if SMS is enabled
    if (!settings.smsSettings?.isEnabled) {
      throw new ApiError('SMS_DISABLED', 'SMS is not enabled for this branch', 400);
    }

    let message = data.message || '';

    // If using template, get the template content
    if (data.templateCode) {
      const template = settings.smsTemplates?.find(t => t.code === data.templateCode);
      if (!template) {
        throw new ApiError('TEMPLATE_NOT_FOUND', 'SMS template not found', 404);
      }
      if (!template.isActive) {
        throw new ApiError('TEMPLATE_INACTIVE', 'SMS template is not active', 400);
      }
      message = template.content;
    }

    if (!message) {
      throw new ApiError('MESSAGE_REQUIRED', 'Message content is required', 400);
    }

    // Create SMS log entry
    const smsLogId = new ObjectId();
    const now = new Date();

    const recipients = data.recipients.map(r => {
      // Replace variables in message for each recipient
      let personalizedMessage = message;
      if (r.variables) {
        Object.entries(r.variables).forEach(([key, value]) => {
          personalizedMessage = personalizedMessage.replace(new RegExp(`{${key}}`, 'g'), value);
        });
      }

      return {
        phone: r.phone,
        name: r.name,
        studentId: r.studentId ? new ObjectId(r.studentId) : undefined,
        staffId: r.staffId ? new ObjectId(r.staffId) : undefined,
        status: 'queued' as const,
        personalizedMessage,
      };
    });

    const smsLog: SMSLogDocument = {
      _id: smsLogId,
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
      templateCode: data.templateCode,
      recipients: recipients.map(r => ({
        phone: r.phone,
        name: r.name,
        studentId: r.studentId,
        staffId: r.staffId,
        status: 'queued' as const,
      })),
      message,
      messageType: data.messageType || 'transactional',
      category: data.category,
      sentBy: new ObjectId(sentBy),
      sentAt: now,
      status: 'queued',
      totalRecipients: recipients.length,
      successCount: 0,
      failureCount: 0,
      createdAt: now,
      updatedAt: now,
    };

    await collections.smsLogs.insertOne(smsLog);

    // In test mode (default) or when gateway not configured, mark as sent immediately
    const isTestMode = (settings.smsSettings as unknown as { testMode?: boolean }).testMode !== false;

    if (isTestMode || !settings.smsSettings.apiKey) {
      await this.processTestMode(smsLogId.toString(), recipients);
    }

    logger.info(
      { smsLogId: smsLogId.toString(), recipientCount: recipients.length, templateCode: data.templateCode },
      'SMS queued for sending'
    );

    return {
      _id: smsLogId.toString(),
      status: isTestMode || !settings.smsSettings.apiKey ? 'completed' : 'queued',
      totalRecipients: recipients.length,
      message: isTestMode || !settings.smsSettings.apiKey
        ? 'SMS logged in test mode (gateway not configured)'
        : 'SMS queued for delivery',
    };
  }

  private async processTestMode(smsLogId: string, recipients: Array<{ phone: string }>) {
    // In test mode, mark all as "sent" without actually sending
    await collections.smsLogs.updateOne(
      { _id: new ObjectId(smsLogId) },
      {
        $set: {
          status: 'completed',
          successCount: recipients.length,
          'recipients.$[].status': 'sent',
          'recipients.$[].deliveredAt': new Date(),
          updatedAt: new Date(),
          gatewayResponse: { mode: 'test', message: 'Logged without sending' },
        },
      }
    );
  }

  async getSMSLogs(
    tenantId: string,
    branchId: string,
    params: {
      page?: number;
      limit?: number;
      status?: string;
      category?: string;
      fromDate?: string;
      toDate?: string;
    } = {}
  ) {
    const { page = 1, limit = 20, status, category, fromDate, toDate } = params;

    const filter: Filter<Document> = {
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
    };

    if (status) {
      filter.status = status;
    }

    if (category) {
      filter.category = category;
    }

    if (fromDate || toDate) {
      filter.sentAt = {};
      if (fromDate) {
        (filter.sentAt as Record<string, Date>).$gte = new Date(fromDate);
      }
      if (toDate) {
        (filter.sentAt as Record<string, Date>).$lte = new Date(toDate);
      }
    }

    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      collections.smsLogs
        .find(filter)
        .sort({ sentAt: -1 })
        .skip(skip)
        .limit(limit)
        .toArray(),
      collections.smsLogs.countDocuments(filter),
    ]);

    return {
      data: logs.map(log => this.formatLog(log as WithId<SMSLogDocument>)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getSMSStats(tenantId: string, branchId: string, params: { fromDate?: string; toDate?: string } = {}) {
    const { fromDate, toDate } = params;

    const matchStage: Record<string, unknown> = {
      tenantId: new ObjectId(tenantId),
      branchId: new ObjectId(branchId),
    };

    if (fromDate || toDate) {
      matchStage.sentAt = {};
      if (fromDate) {
        (matchStage.sentAt as Record<string, Date>).$gte = new Date(fromDate);
      }
      if (toDate) {
        (matchStage.sentAt as Record<string, Date>).$lte = new Date(toDate);
      }
    }

    const pipeline = [
      { $match: matchStage },
      {
        $group: {
          _id: null,
          totalMessages: { $sum: 1 },
          totalRecipients: { $sum: '$totalRecipients' },
          totalSuccess: { $sum: '$successCount' },
          totalFailed: { $sum: '$failureCount' },
          byCategory: {
            $push: {
              category: '$category',
              count: '$totalRecipients',
            },
          },
        },
      },
    ];

    const result = await collections.smsLogs.aggregate(pipeline).toArray();

    if (result.length === 0) {
      return {
        totalMessages: 0,
        totalRecipients: 0,
        totalSuccess: 0,
        totalFailed: 0,
        deliveryRate: '0%',
        byCategory: {},
      };
    }

    const stats = result[0];

    // Aggregate by category
    const categoryStats: Record<string, number> = {};
    (stats.byCategory as Array<{ category: string; count: number }>).forEach(item => {
      categoryStats[item.category] = (categoryStats[item.category] || 0) + item.count;
    });

    return {
      totalMessages: stats.totalMessages,
      totalRecipients: stats.totalRecipients,
      totalSuccess: stats.totalSuccess,
      totalFailed: stats.totalFailed,
      deliveryRate: stats.totalRecipients > 0
        ? `${Math.round((stats.totalSuccess / stats.totalRecipients) * 100)}%`
        : '0%',
      byCategory: categoryStats,
    };
  }

  async getSMSBalance(tenantId: string, branchId: string) {
    const settings = await communicationSettingsService.getSettings(tenantId, branchId);

    // In a real implementation, this would query the SMS gateway API
    // For now, return placeholder data indicating gateway needs configuration
    if (!settings.smsSettings?.provider || !settings.smsSettings?.apiKey) {
      return {
        balance: null,
        currency: 'INR',
        status: 'not_configured',
        message: 'SMS gateway credentials not configured',
      };
    }

    return {
      balance: null,
      currency: 'INR',
      status: 'gateway_required',
      message: 'Connect to SMS gateway to check balance',
      provider: settings.smsSettings.provider,
    };
  }

  async getTemplatesForSending(tenantId: string, branchId: string) {
    const settings = await communicationSettingsService.getSettings(tenantId, branchId);

    const activeTemplates = (settings.smsTemplates || []).filter(t => t.isActive);

    return activeTemplates.map(t => ({
      code: t.code,
      name: t.name,
      content: t.content,
      category: t.category,
      variables: t.variables,
    }));
  }

  private formatLog(log: WithId<SMSLogDocument>) {
    return {
      _id: log._id.toString(),
      templateCode: log.templateCode,
      message: log.message,
      messageType: log.messageType,
      category: log.category,
      status: log.status,
      totalRecipients: log.totalRecipients,
      successCount: log.successCount,
      failureCount: log.failureCount,
      sentBy: log.sentBy.toString(),
      sentAt: log.sentAt,
      recipients: log.recipients.map(r => ({
        phone: r.phone,
        name: r.name,
        status: r.status,
        deliveredAt: r.deliveredAt,
        failureReason: r.failureReason,
      })),
    };
  }
}

export const smsService = new SMSService();
