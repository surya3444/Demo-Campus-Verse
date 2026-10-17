import { ObjectId, WithId, Document } from 'mongodb';
import { collections } from '../../config/database';
import { logger } from '../../lib/logger';
import { ApiError } from '../../middleware/errorHandler';

// ============ Event Type ============
interface EventType {
  code: string;
  name: string;
  description?: string;
  color: string;
  icon?: string;
  requiresApproval: boolean;
  defaultDuration: number; // in minutes
  isActive: boolean;
}

// ============ SMS Template ============
interface SMSTemplate {
  _id?: string;
  code: string;
  name: string;
  content: string;
  category: 'fee' | 'attendance' | 'announcement' | 'admission' | 'hr' | 'general';
  variables: string[];
  dltTemplateId?: string;
  isActive: boolean;
  createdAt?: Date;
}

// ============ Email Template ============
interface EmailTemplate {
  _id?: string;
  code: string;
  name: string;
  subject: string;
  htmlContent: string;
  textContent?: string;
  category: 'fee' | 'attendance' | 'announcement' | 'admission' | 'hr' | 'general' | 'auth';
  variables: string[];
  isActive: boolean;
  createdAt?: Date;
}

// ============ Communication Settings Document ============
interface CommunicationSettingsDocument extends Document {
  _id: ObjectId;
  tenantId: ObjectId;
  branchId: ObjectId;

  // Event types configuration
  eventTypes: EventType[];

  // SMS Gateway settings
  smsSettings: {
    provider: 'msg91' | 'twilio' | 'gupshup' | 'custom' | 'none';
    apiKey?: string;
    senderId?: string;
    dltEntityId?: string;
    isEnabled: boolean;
    testMode?: boolean;
    maxSmsPerDay: number;
    defaultCountryCode: string;
  };

  // Email settings
  emailSettings: {
    provider: 'sendgrid' | 'ses' | 'smtp' | 'none';
    fromEmail?: string;
    fromName?: string;
    replyTo?: string;
    isEnabled: boolean;
    // SendGrid/SES specific
    apiKey?: string;
    // SMTP specific
    smtpHost?: string;
    smtpPort?: number;
    smtpSecure?: boolean;
    smtpUsername?: string;
    smtpPassword?: string;
  };

  // Email templates
  emailTemplates: EmailTemplate[];

  // WhatsApp settings
  whatsappSettings: {
    provider: 'twilio' | 'meta' | 'gupshup' | 'none';
    phoneNumber?: string;
    isEnabled: boolean;
  };

  // SMS templates
  smsTemplates: SMSTemplate[];

  // Announcement settings
  announcementSettings: {
    requireApproval: boolean;
    defaultExpiryDays: number;
    maxAttachmentSize: number; // in MB
    allowedFileTypes: string[];
    autoArchiveAfterDays: number;
  };

  // Notification preferences
  notificationDefaults: {
    channels: ('sms' | 'email' | 'push' | 'whatsapp')[];
    feeReminders: boolean;
    attendanceAlerts: boolean;
    announcementNotifications: boolean;
    eventReminders: boolean;
  };

  // Password generation settings
  passwordSettings: {
    autoGenerate: boolean;
    minLength: number;
    requireUppercase: boolean;
    requireLowercase: boolean;
    requireNumbers: boolean;
    requireSpecialChars: boolean;
    expiryDays: number; // 0 = never expires
    notifyViaEmail: boolean;
    notifyViaSMS: boolean;
    defaultPassword?: string; // for non-random passwords
  };

  createdAt: Date;
  updatedAt: Date;
}

const DEFAULT_EVENT_TYPES: EventType[] = [
  {
    code: 'HOLIDAY',
    name: 'Holiday',
    color: '#EF4444',
    requiresApproval: false,
    defaultDuration: 1440,
    isActive: true,
  },
  {
    code: 'EXAM',
    name: 'Examination',
    color: '#F59E0B',
    requiresApproval: true,
    defaultDuration: 180,
    isActive: true,
  },
  {
    code: 'MEETING',
    name: 'Meeting',
    color: '#3B82F6',
    requiresApproval: false,
    defaultDuration: 60,
    isActive: true,
  },
  {
    code: 'SPORTS',
    name: 'Sports Day',
    color: '#10B981',
    requiresApproval: true,
    defaultDuration: 480,
    isActive: true,
  },
  {
    code: 'CULTURAL',
    name: 'Cultural Event',
    color: '#8B5CF6',
    requiresApproval: true,
    defaultDuration: 240,
    isActive: true,
  },
  {
    code: 'PTM',
    name: 'Parent-Teacher Meeting',
    color: '#EC4899',
    requiresApproval: false,
    defaultDuration: 120,
    isActive: true,
  },
  {
    code: 'WORKSHOP',
    name: 'Workshop / Seminar',
    color: '#06B6D4',
    requiresApproval: true,
    defaultDuration: 180,
    isActive: true,
  },
  {
    code: 'OTHER',
    name: 'Other',
    color: '#6B7280',
    requiresApproval: false,
    defaultDuration: 60,
    isActive: true,
  },
];

const DEFAULT_SMS_TEMPLATES: SMSTemplate[] = [
  {
    code: 'FEE_REMINDER',
    name: 'Fee Reminder',
    content:
      'Dear Parent, Fee of Rs.{amount} for {studentName} is pending. Due date: {dueDate}. Please pay at the earliest. - {branchName}',
    category: 'fee',
    variables: ['amount', 'studentName', 'dueDate', 'branchName'],
    isActive: true,
  },
  {
    code: 'FEE_RECEIPT',
    name: 'Fee Receipt',
    content:
      'Dear Parent, Fee of Rs.{amount} received for {studentName}. Receipt No: {receiptNo}. Thank you! - {branchName}',
    category: 'fee',
    variables: ['amount', 'studentName', 'receiptNo', 'branchName'],
    isActive: true,
  },
  {
    code: 'ATTENDANCE_ABSENT',
    name: 'Absence Notification',
    content:
      'Dear Parent, Your ward {studentName} was marked absent on {date}. Please contact school for any concerns. - {branchName}',
    category: 'attendance',
    variables: ['studentName', 'date', 'branchName'],
    isActive: true,
  },
  {
    code: 'ANNOUNCEMENT',
    name: 'General Announcement',
    content: 'Dear Parent, {message} - {branchName}',
    category: 'announcement',
    variables: ['message', 'branchName'],
    isActive: true,
  },
  {
    code: 'ADMISSION_CONFIRM',
    name: 'Admission Confirmation',
    content:
      'Dear Parent, Admission confirmed for {studentName}. Admission No: {admissionNo}. Welcome to {branchName}!',
    category: 'admission',
    variables: ['studentName', 'admissionNo', 'branchName'],
    isActive: true,
  },
];

const DEFAULT_SMS_SETTINGS = {
  provider: 'none' as const,
  isEnabled: false,
  testMode: true, // Test mode logs SMS without actually sending
  maxSmsPerDay: 1000,
  defaultCountryCode: '+91',
  apiKey: '',
  senderId: '',
};

const DEFAULT_EMAIL_SETTINGS = {
  provider: 'none' as const,
  isEnabled: false,
};

const DEFAULT_EMAIL_TEMPLATES: EmailTemplate[] = [
  {
    code: 'WELCOME',
    name: 'Welcome Email',
    subject: 'Welcome to {organizationName}',
    htmlContent: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #4F46E5; color: white; padding: 20px; text-align: center; }
    .content { padding: 20px; background: #f9f9f9; }
    .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Welcome to {organizationName}</h1>
    </div>
    <div class="content">
      <p>Dear {userName},</p>
      <p>Welcome to {organizationName}! Your account has been created successfully.</p>
      <p><strong>Login Details:</strong></p>
      <ul>
        <li>Email: {email}</li>
        <li>Temporary Password: {password}</li>
      </ul>
      <p>Please login and change your password immediately.</p>
    </div>
    <div class="footer">
      <p>&copy; {organizationName}. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`,
    category: 'auth',
    variables: ['organizationName', 'userName', 'email', 'password'],
    isActive: true,
  },
  {
    code: 'PASSWORD_RESET',
    name: 'Password Reset',
    subject: 'Password Reset Request - {organizationName}',
    htmlContent: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #4F46E5; color: white; padding: 20px; text-align: center; }
    .content { padding: 20px; background: #f9f9f9; }
    .button { display: inline-block; background: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; }
    .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Password Reset</h1>
    </div>
    <div class="content">
      <p>Dear {userName},</p>
      <p>We received a request to reset your password. Click the button below to reset it:</p>
      <p style="text-align: center;">
        <a href="{resetLink}" class="button">Reset Password</a>
      </p>
      <p>This link will expire in 1 hour.</p>
      <p>If you didn't request this, please ignore this email.</p>
    </div>
    <div class="footer">
      <p>&copy; {organizationName}. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`,
    category: 'auth',
    variables: ['organizationName', 'userName', 'resetLink'],
    isActive: true,
  },
  {
    code: 'FEE_REMINDER',
    name: 'Fee Reminder',
    subject: 'Fee Payment Reminder - {studentName}',
    htmlContent: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #F59E0B; color: white; padding: 20px; text-align: center; }
    .content { padding: 20px; background: #f9f9f9; }
    .amount { font-size: 24px; font-weight: bold; color: #EF4444; }
    .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Fee Payment Reminder</h1>
    </div>
    <div class="content">
      <p>Dear Parent/Guardian,</p>
      <p>This is a reminder that fee payment for <strong>{studentName}</strong> is pending.</p>
      <p>Amount Due: <span class="amount">Rs. {amount}</span></p>
      <p>Due Date: <strong>{dueDate}</strong></p>
      <p>Please make the payment at the earliest to avoid any late fee charges.</p>
    </div>
    <div class="footer">
      <p>&copy; {branchName}. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`,
    category: 'fee',
    variables: ['studentName', 'amount', 'dueDate', 'branchName'],
    isActive: true,
  },
  {
    code: 'FEE_RECEIPT',
    name: 'Fee Receipt',
    subject: 'Fee Payment Receipt - {receiptNo}',
    htmlContent: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #10B981; color: white; padding: 20px; text-align: center; }
    .content { padding: 20px; background: #f9f9f9; }
    .receipt-box { background: white; border: 1px solid #ddd; padding: 20px; margin: 20px 0; }
    .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Payment Received</h1>
    </div>
    <div class="content">
      <p>Dear Parent/Guardian,</p>
      <p>Thank you for your payment. Here are the details:</p>
      <div class="receipt-box">
        <p><strong>Receipt No:</strong> {receiptNo}</p>
        <p><strong>Student:</strong> {studentName}</p>
        <p><strong>Amount Paid:</strong> Rs. {amount}</p>
        <p><strong>Payment Date:</strong> {paymentDate}</p>
        <p><strong>Payment Mode:</strong> {paymentMode}</p>
      </div>
    </div>
    <div class="footer">
      <p>&copy; {branchName}. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`,
    category: 'fee',
    variables: ['receiptNo', 'studentName', 'amount', 'paymentDate', 'paymentMode', 'branchName'],
    isActive: true,
  },
  {
    code: 'ANNOUNCEMENT',
    name: 'Announcement',
    subject: '{subject}',
    htmlContent: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #8B5CF6; color: white; padding: 20px; text-align: center; }
    .content { padding: 20px; background: #f9f9f9; }
    .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>{subject}</h1>
    </div>
    <div class="content">
      {content}
    </div>
    <div class="footer">
      <p>&copy; {branchName}. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`,
    category: 'announcement',
    variables: ['subject', 'content', 'branchName'],
    isActive: true,
  },
];

const DEFAULT_WHATSAPP_SETTINGS = {
  provider: 'none' as const,
  isEnabled: false,
};

const DEFAULT_ANNOUNCEMENT_SETTINGS = {
  requireApproval: true,
  defaultExpiryDays: 30,
  maxAttachmentSize: 10,
  allowedFileTypes: ['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png'],
  autoArchiveAfterDays: 90,
};

const DEFAULT_NOTIFICATION_DEFAULTS = {
  channels: ['sms', 'email'] as ('sms' | 'email')[],
  feeReminders: true,
  attendanceAlerts: true,
  announcementNotifications: true,
  eventReminders: true,
};

const DEFAULT_PASSWORD_SETTINGS = {
  autoGenerate: true,
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: false,
  expiryDays: 90, // password expires in 90 days
  notifyViaEmail: true,
  notifyViaSMS: true,
};

class CommunicationSettingsService {
  async getSettings(tenantId: string, branchId: string) {
    const branch = await collections.branches.findOne({
      _id: new ObjectId(branchId),
      tenantId: new ObjectId(tenantId),
    });

    if (!branch) {
      throw new ApiError('BRANCH_NOT_FOUND', 'Branch not found', 404);
    }

    let settings = (await collections.communicationSettings.findOne({
      branchId: new ObjectId(branchId),
      tenantId: new ObjectId(tenantId),
    })) as WithId<CommunicationSettingsDocument> | null;

    if (!settings) {
      const now = new Date();
      const newSettings = {
        _id: new ObjectId(),
        branchId: new ObjectId(branchId),
        tenantId: new ObjectId(tenantId),
        eventTypes: DEFAULT_EVENT_TYPES,
        smsSettings: DEFAULT_SMS_SETTINGS,
        emailSettings: DEFAULT_EMAIL_SETTINGS,
        whatsappSettings: DEFAULT_WHATSAPP_SETTINGS,
        smsTemplates: DEFAULT_SMS_TEMPLATES,
        emailTemplates: DEFAULT_EMAIL_TEMPLATES,
        announcementSettings: DEFAULT_ANNOUNCEMENT_SETTINGS,
        notificationDefaults: DEFAULT_NOTIFICATION_DEFAULTS,
        passwordSettings: DEFAULT_PASSWORD_SETTINGS,
        createdAt: now,
        updatedAt: now,
      } as CommunicationSettingsDocument;

      await collections.communicationSettings.insertOne(newSettings);
      settings = newSettings as WithId<CommunicationSettingsDocument>;
    }

    return this.formatSettings(settings);
  }

  async updateSettings(
    tenantId: string,
    branchId: string,
    data: Partial<{
      smsSettings: Partial<CommunicationSettingsDocument['smsSettings']>;
      emailSettings: Partial<CommunicationSettingsDocument['emailSettings']>;
      whatsappSettings: Partial<CommunicationSettingsDocument['whatsappSettings']>;
      announcementSettings: Partial<CommunicationSettingsDocument['announcementSettings']>;
      notificationDefaults: Partial<CommunicationSettingsDocument['notificationDefaults']>;
      passwordSettings: Partial<CommunicationSettingsDocument['passwordSettings']>;
    }>,
    updatedBy: string
  ) {
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (data.smsSettings) {
      Object.entries(data.smsSettings).forEach(([key, value]) => {
        if (value !== undefined) {
          updateData[`smsSettings.${key}`] = value;
        }
      });
    }

    if (data.emailSettings) {
      Object.entries(data.emailSettings).forEach(([key, value]) => {
        if (value !== undefined) {
          updateData[`emailSettings.${key}`] = value;
        }
      });
    }

    if (data.whatsappSettings) {
      Object.entries(data.whatsappSettings).forEach(([key, value]) => {
        if (value !== undefined) {
          updateData[`whatsappSettings.${key}`] = value;
        }
      });
    }

    if (data.announcementSettings) {
      Object.entries(data.announcementSettings).forEach(([key, value]) => {
        if (value !== undefined) {
          updateData[`announcementSettings.${key}`] = value;
        }
      });
    }

    if (data.notificationDefaults) {
      Object.entries(data.notificationDefaults).forEach(([key, value]) => {
        if (value !== undefined) {
          updateData[`notificationDefaults.${key}`] = value;
        }
      });
    }

    if (data.passwordSettings) {
      Object.entries(data.passwordSettings).forEach(([key, value]) => {
        if (value !== undefined) {
          updateData[`passwordSettings.${key}`] = value;
        }
      });
    }

    const result = await collections.communicationSettings.findOneAndUpdate(
      {
        branchId: new ObjectId(branchId),
        tenantId: new ObjectId(tenantId),
      },
      {
        $set: updateData,
        $setOnInsert: {
          branchId: new ObjectId(branchId),
          tenantId: new ObjectId(tenantId),
          eventTypes: DEFAULT_EVENT_TYPES,
          smsTemplates: DEFAULT_SMS_TEMPLATES,
          emailTemplates: DEFAULT_EMAIL_TEMPLATES,
          passwordSettings: DEFAULT_PASSWORD_SETTINGS,
          createdAt: new Date(),
        },
      },
      { upsert: true, returnDocument: 'after' }
    );

    logger.info({ branchId, tenantId, updatedBy }, 'Communication settings updated');

    return this.formatSettings(result as unknown as WithId<CommunicationSettingsDocument>);
  }

  // ============ Event Types ============
  async addEventType(tenantId: string, branchId: string, eventType: EventType, addedBy: string) {
    // Check for duplicate code
    const existingSettings = await collections.communicationSettings.findOne({
      branchId: new ObjectId(branchId),
      tenantId: new ObjectId(tenantId),
      'eventTypes.code': eventType.code,
    });

    if (existingSettings) {
      throw new ApiError('DUPLICATE_EVENT_TYPE', 'Event type with this code already exists', 409);
    }

    const result = await collections.communicationSettings.findOneAndUpdate(
      { branchId: new ObjectId(branchId), tenantId: new ObjectId(tenantId) },
      {
        $push: { eventTypes: eventType } as unknown,
        $set: { updatedAt: new Date() },
        $setOnInsert: {
          branchId: new ObjectId(branchId),
          tenantId: new ObjectId(tenantId),
          smsSettings: DEFAULT_SMS_SETTINGS,
          emailSettings: DEFAULT_EMAIL_SETTINGS,
          whatsappSettings: DEFAULT_WHATSAPP_SETTINGS,
          smsTemplates: DEFAULT_SMS_TEMPLATES,
          emailTemplates: DEFAULT_EMAIL_TEMPLATES,
          announcementSettings: DEFAULT_ANNOUNCEMENT_SETTINGS,
          notificationDefaults: DEFAULT_NOTIFICATION_DEFAULTS,
          createdAt: new Date(),
        },
      } as Document,
      { upsert: true, returnDocument: 'after' }
    );

    logger.info({ branchId, tenantId, eventType: eventType.code, addedBy }, 'Event type added');

    return this.formatSettings(result as unknown as WithId<CommunicationSettingsDocument>);
  }

  async updateEventType(
    tenantId: string,
    branchId: string,
    eventTypeCode: string,
    data: Partial<EventType>,
    updatedBy: string
  ) {
    const updateFields: Record<string, unknown> = { updatedAt: new Date() };

    if (data.name !== undefined) updateFields['eventTypes.$.name'] = data.name;
    if (data.description !== undefined) updateFields['eventTypes.$.description'] = data.description;
    if (data.color !== undefined) updateFields['eventTypes.$.color'] = data.color;
    if (data.icon !== undefined) updateFields['eventTypes.$.icon'] = data.icon;
    if (data.requiresApproval !== undefined)
      updateFields['eventTypes.$.requiresApproval'] = data.requiresApproval;
    if (data.defaultDuration !== undefined)
      updateFields['eventTypes.$.defaultDuration'] = data.defaultDuration;
    if (data.isActive !== undefined) updateFields['eventTypes.$.isActive'] = data.isActive;

    const result = await collections.communicationSettings.findOneAndUpdate(
      {
        branchId: new ObjectId(branchId),
        tenantId: new ObjectId(tenantId),
        'eventTypes.code': eventTypeCode,
      },
      { $set: updateFields },
      { returnDocument: 'after' }
    );

    if (!result) {
      throw new ApiError('EVENT_TYPE_NOT_FOUND', 'Event type not found', 404);
    }

    logger.info({ branchId, tenantId, eventTypeCode, updatedBy }, 'Event type updated');

    return this.formatSettings(result as unknown as WithId<CommunicationSettingsDocument>);
  }

  async deleteEventType(
    tenantId: string,
    branchId: string,
    eventTypeCode: string,
    deletedBy: string
  ) {
    const result = await collections.communicationSettings.findOneAndUpdate(
      { branchId: new ObjectId(branchId), tenantId: new ObjectId(tenantId) },
      {
        $pull: { eventTypes: { code: eventTypeCode } } as unknown,
        $set: { updatedAt: new Date() },
      } as Document,
      { returnDocument: 'after' }
    );

    if (!result) {
      throw new ApiError('SETTINGS_NOT_FOUND', 'Communication settings not found', 404);
    }

    logger.info({ branchId, tenantId, eventTypeCode, deletedBy }, 'Event type deleted');

    return this.formatSettings(result as unknown as WithId<CommunicationSettingsDocument>);
  }

  // ============ SMS Templates ============
  async addSMSTemplate(
    tenantId: string,
    branchId: string,
    template: Omit<SMSTemplate, '_id'>,
    addedBy: string
  ) {
    const templateWithId = {
      ...template,
      _id: new ObjectId().toString(),
      createdAt: new Date(),
    };

    const result = await collections.communicationSettings.findOneAndUpdate(
      { branchId: new ObjectId(branchId), tenantId: new ObjectId(tenantId) },
      {
        $push: { smsTemplates: templateWithId } as unknown,
        $set: { updatedAt: new Date() },
        $setOnInsert: {
          branchId: new ObjectId(branchId),
          tenantId: new ObjectId(tenantId),
          eventTypes: DEFAULT_EVENT_TYPES,
          smsSettings: DEFAULT_SMS_SETTINGS,
          emailSettings: DEFAULT_EMAIL_SETTINGS,
          whatsappSettings: DEFAULT_WHATSAPP_SETTINGS,
          announcementSettings: DEFAULT_ANNOUNCEMENT_SETTINGS,
          notificationDefaults: DEFAULT_NOTIFICATION_DEFAULTS,
          createdAt: new Date(),
        },
      } as Document,
      { upsert: true, returnDocument: 'after' }
    );

    logger.info({ branchId, tenantId, template: template.code, addedBy }, 'SMS template added');

    return this.formatSettings(result as unknown as WithId<CommunicationSettingsDocument>);
  }

  async updateSMSTemplate(
    tenantId: string,
    branchId: string,
    templateCode: string,
    data: Partial<SMSTemplate>,
    updatedBy: string
  ) {
    const updateFields: Record<string, unknown> = { updatedAt: new Date() };

    if (data.name !== undefined) updateFields['smsTemplates.$.name'] = data.name;
    if (data.content !== undefined) updateFields['smsTemplates.$.content'] = data.content;
    if (data.category !== undefined) updateFields['smsTemplates.$.category'] = data.category;
    if (data.variables !== undefined) updateFields['smsTemplates.$.variables'] = data.variables;
    if (data.dltTemplateId !== undefined)
      updateFields['smsTemplates.$.dltTemplateId'] = data.dltTemplateId;
    if (data.isActive !== undefined) updateFields['smsTemplates.$.isActive'] = data.isActive;

    const result = await collections.communicationSettings.findOneAndUpdate(
      {
        branchId: new ObjectId(branchId),
        tenantId: new ObjectId(tenantId),
        'smsTemplates.code': templateCode,
      },
      { $set: updateFields },
      { returnDocument: 'after' }
    );

    if (!result) {
      throw new ApiError('SMS_TEMPLATE_NOT_FOUND', 'SMS template not found', 404);
    }

    logger.info({ branchId, tenantId, templateCode, updatedBy }, 'SMS template updated');

    return this.formatSettings(result as unknown as WithId<CommunicationSettingsDocument>);
  }

  async deleteSMSTemplate(
    tenantId: string,
    branchId: string,
    templateCode: string,
    deletedBy: string
  ) {
    const result = await collections.communicationSettings.findOneAndUpdate(
      { branchId: new ObjectId(branchId), tenantId: new ObjectId(tenantId) },
      {
        $pull: { smsTemplates: { code: templateCode } } as unknown,
        $set: { updatedAt: new Date() },
      } as Document,
      { returnDocument: 'after' }
    );

    if (!result) {
      throw new ApiError('SETTINGS_NOT_FOUND', 'Communication settings not found', 404);
    }

    logger.info({ branchId, tenantId, templateCode, deletedBy }, 'SMS template deleted');

    return this.formatSettings(result as unknown as WithId<CommunicationSettingsDocument>);
  }

  // ============ Email Templates ============
  async addEmailTemplate(
    tenantId: string,
    branchId: string,
    template: Omit<EmailTemplate, '_id'>,
    addedBy: string
  ) {
    const templateWithId = {
      ...template,
      _id: new ObjectId().toString(),
      createdAt: new Date(),
    };

    const result = await collections.communicationSettings.findOneAndUpdate(
      { branchId: new ObjectId(branchId), tenantId: new ObjectId(tenantId) },
      {
        $push: { emailTemplates: templateWithId } as unknown,
        $set: { updatedAt: new Date() },
        $setOnInsert: {
          branchId: new ObjectId(branchId),
          tenantId: new ObjectId(tenantId),
          eventTypes: DEFAULT_EVENT_TYPES,
          smsSettings: DEFAULT_SMS_SETTINGS,
          emailSettings: DEFAULT_EMAIL_SETTINGS,
          smsTemplates: DEFAULT_SMS_TEMPLATES,
          emailTemplates: DEFAULT_EMAIL_TEMPLATES,
          announcementSettings: DEFAULT_ANNOUNCEMENT_SETTINGS,
          notificationDefaults: DEFAULT_NOTIFICATION_DEFAULTS,
          createdAt: new Date(),
        },
      } as Document,
      { upsert: true, returnDocument: 'after' }
    );

    logger.info({ branchId, tenantId, template: template.code, addedBy }, 'Email template added');

    return this.formatSettings(result as unknown as WithId<CommunicationSettingsDocument>);
  }

  async updateEmailTemplate(
    tenantId: string,
    branchId: string,
    templateCode: string,
    data: Partial<EmailTemplate>,
    updatedBy: string
  ) {
    const updateFields: Record<string, unknown> = { updatedAt: new Date() };

    if (data.name !== undefined) updateFields['emailTemplates.$.name'] = data.name;
    if (data.subject !== undefined) updateFields['emailTemplates.$.subject'] = data.subject;
    if (data.htmlContent !== undefined)
      updateFields['emailTemplates.$.htmlContent'] = data.htmlContent;
    if (data.textContent !== undefined)
      updateFields['emailTemplates.$.textContent'] = data.textContent;
    if (data.category !== undefined) updateFields['emailTemplates.$.category'] = data.category;
    if (data.variables !== undefined) updateFields['emailTemplates.$.variables'] = data.variables;
    if (data.isActive !== undefined) updateFields['emailTemplates.$.isActive'] = data.isActive;

    const result = await collections.communicationSettings.findOneAndUpdate(
      {
        branchId: new ObjectId(branchId),
        tenantId: new ObjectId(tenantId),
        'emailTemplates.code': templateCode,
      },
      { $set: updateFields },
      { returnDocument: 'after' }
    );

    if (!result) {
      throw new ApiError('EMAIL_TEMPLATE_NOT_FOUND', 'Email template not found', 404);
    }

    logger.info({ branchId, tenantId, templateCode, updatedBy }, 'Email template updated');

    return this.formatSettings(result as unknown as WithId<CommunicationSettingsDocument>);
  }

  async deleteEmailTemplate(
    tenantId: string,
    branchId: string,
    templateCode: string,
    deletedBy: string
  ) {
    const result = await collections.communicationSettings.findOneAndUpdate(
      { branchId: new ObjectId(branchId), tenantId: new ObjectId(tenantId) },
      {
        $pull: { emailTemplates: { code: templateCode } } as unknown,
        $set: { updatedAt: new Date() },
      } as Document,
      { returnDocument: 'after' }
    );

    if (!result) {
      throw new ApiError('SETTINGS_NOT_FOUND', 'Communication settings not found', 404);
    }

    logger.info({ branchId, tenantId, templateCode, deletedBy }, 'Email template deleted');

    return this.formatSettings(result as unknown as WithId<CommunicationSettingsDocument>);
  }

  // ============ Login Reports ============
  async getLoginReport(
    tenantId: string,
    _branchId: string,
    params: { startDate?: string; endDate?: string }
  ) {
    const filter: Record<string, unknown> = {
      tenantId: new ObjectId(tenantId),
    };

    if (params.startDate || params.endDate) {
      filter.lastLoginAt = {};
      if (params.startDate) {
        (filter.lastLoginAt as Record<string, unknown>).$gte = new Date(params.startDate);
      }
      if (params.endDate) {
        (filter.lastLoginAt as Record<string, unknown>).$lte = new Date(params.endDate);
      }
    }

    const users = await collections.users
      .find(filter)
      .project({
        _id: 1,
        email: 1,
        displayName: 1,
        roleCode: 1,
        lastLoginAt: 1,
        loginCount: 1,
        status: 1,
      })
      .sort({ lastLoginAt: -1 })
      .limit(500)
      .toArray();

    return {
      data: users.map((u) => ({
        _id: u._id.toString(),
        email: u.email,
        displayName: u.displayName,
        roleCode: u.roleCode,
        lastLoginAt: u.lastLoginAt,
        loginCount: u.loginCount || 0,
        status: u.status,
      })),
      total: users.length,
    };
  }

  async getNeverLoggedReport(tenantId: string, _branchId: string) {
    const users = await collections.users
      .find({
        tenantId: new ObjectId(tenantId),
        $or: [{ lastLoginAt: null }, { lastLoginAt: { $exists: false } }],
        status: 'active',
      })
      .project({
        _id: 1,
        email: 1,
        displayName: 1,
        roleCode: 1,
        createdAt: 1,
      })
      .sort({ createdAt: -1 })
      .toArray();

    return {
      data: users.map((u) => ({
        _id: u._id.toString(),
        email: u.email,
        displayName: u.displayName,
        roleCode: u.roleCode,
        createdAt: u.createdAt,
        daysSinceCreation: Math.floor(
          (Date.now() - new Date(u.createdAt).getTime()) / (1000 * 60 * 60 * 24)
        ),
      })),
      total: users.length,
    };
  }

  /**
   * Get notification report across all channels
   */
  async getNotificationReport(
    tenantId: string,
    branchId: string,
    params: { startDate?: string; endDate?: string }
  ) {
    const tenantObjId = new ObjectId(tenantId);
    const branchObjId = new ObjectId(branchId);

    const dateFilter: Record<string, unknown> = {};
    if (params.startDate) {
      dateFilter.$gte = new Date(params.startDate);
    }
    if (params.endDate) {
      dateFilter.$lte = new Date(params.endDate);
    }

    // Get announcement stats
    const announcementMatch: Record<string, unknown> = {
      tenantId: tenantObjId,
      branchId: branchObjId,
    };
    if (Object.keys(dateFilter).length > 0) {
      announcementMatch.createdAt = dateFilter;
    }

    const announcementStats = await collections.announcements
      .aggregate([
        { $match: announcementMatch },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
          },
        },
      ])
      .toArray();

    // Get event stats
    const eventMatch: Record<string, unknown> = {
      tenantId: tenantObjId,
      branchId: branchObjId,
    };
    if (Object.keys(dateFilter).length > 0) {
      eventMatch.createdAt = dateFilter;
    }

    const eventStats = await collections.events
      .aggregate([
        { $match: eventMatch },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
          },
        },
      ])
      .toArray();

    // Format stats
    const announcementsByStatus: Record<string, number> = {};
    announcementStats.forEach((s) => {
      announcementsByStatus[s._id || 'unknown'] = s.count;
    });

    const eventsByStatus: Record<string, number> = {};
    eventStats.forEach((s) => {
      eventsByStatus[s._id || 'unknown'] = s.count;
    });

    return {
      announcements: {
        total: Object.values(announcementsByStatus).reduce((a, b) => a + b, 0),
        byStatus: announcementsByStatus,
      },
      events: {
        total: Object.values(eventsByStatus).reduce((a, b) => a + b, 0),
        byStatus: eventsByStatus,
      },
      sms: {
        total: 0,
        sent: 0,
        failed: 0,
        message: 'SMS stats require SMS gateway integration',
      },
      email: {
        total: 0,
        sent: 0,
        failed: 0,
        message: 'Email stats require email gateway integration',
      },
      period: {
        startDate: params.startDate || 'all time',
        endDate: params.endDate || 'present',
      },
    };
  }

  private formatSettings(settings: WithId<CommunicationSettingsDocument>) {
    return {
      _id: settings._id.toString(),
      branchId: settings.branchId.toString(),
      tenantId: settings.tenantId.toString(),
      eventTypes: settings.eventTypes || DEFAULT_EVENT_TYPES,
      smsSettings: settings.smsSettings || DEFAULT_SMS_SETTINGS,
      emailSettings: settings.emailSettings || DEFAULT_EMAIL_SETTINGS,
      whatsappSettings: settings.whatsappSettings || DEFAULT_WHATSAPP_SETTINGS,
      smsTemplates: settings.smsTemplates || DEFAULT_SMS_TEMPLATES,
      emailTemplates: settings.emailTemplates || DEFAULT_EMAIL_TEMPLATES,
      announcementSettings: settings.announcementSettings || DEFAULT_ANNOUNCEMENT_SETTINGS,
      notificationDefaults: settings.notificationDefaults || DEFAULT_NOTIFICATION_DEFAULTS,
      passwordSettings: settings.passwordSettings || DEFAULT_PASSWORD_SETTINGS,
      createdAt: settings.createdAt,
      updatedAt: settings.updatedAt,
    };
  }
}

export const communicationSettingsService = new CommunicationSettingsService();
