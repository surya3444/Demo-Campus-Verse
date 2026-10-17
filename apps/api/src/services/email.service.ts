import { Resend } from 'resend';
import { env } from '../config/env';
import { logger } from '../lib/logger';

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
}

async function sendEmail(options: EmailOptions): Promise<boolean> {
  if (!resend) {
    logger.warn(
      { to: options.to, subject: options.subject },
      'Email not sent - RESEND_API_KEY not configured'
    );
    return false;
  }

  try {
    const { error } = await resend.emails.send({
      from: env.EMAIL_FROM,
      to: options.to,
      subject: options.subject,
      html: options.html,
    });

    if (error) {
      logger.error({ error, to: options.to }, 'Failed to send email');
      return false;
    }

    logger.info({ to: options.to, subject: options.subject }, 'Email sent successfully');
    return true;
  } catch (error) {
    logger.error({ error, to: options.to }, 'Failed to send email');
    return false;
  }
}

export const emailService = {
  async sendVerificationEmail(
    email: string,
    token: string,
    organizationName: string
  ): Promise<boolean> {
    const verificationUrl = `${env.APP_URL.split(',')[0]}/verify-email?token=${token}`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Verify Your Email</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">Campus Verse</h1>
        </div>
        <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
          <h2 style="color: #1f2937; margin-top: 0;">Verify Your Email</h2>
          <p>Thank you for registering <strong>${organizationName}</strong> on Campus Verse!</p>
          <p>Please verify your email address by clicking the button below:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verificationUrl}" style="background: #4F46E5; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block;">Verify Email</a>
          </div>
          <p style="color: #6b7280; font-size: 14px;">If the button doesn't work, copy and paste this link into your browser:</p>
          <p style="color: #4F46E5; font-size: 14px; word-break: break-all;">${verificationUrl}</p>
          <p style="color: #6b7280; font-size: 14px;">This link will expire in 24 hours.</p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
          <p style="color: #9ca3af; font-size: 12px; text-align: center;">If you didn't create an account, please ignore this email.</p>
        </div>
      </body>
      </html>
    `;

    return sendEmail({
      to: email,
      subject: 'Verify your email - Campus Verse',
      html,
    });
  },

  async sendApprovalEmail(
    email: string,
    organizationName: string,
    adminName: string
  ): Promise<boolean> {
    const loginUrl = `${env.APP_URL.split(',')[0]}/login`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Organization Approved</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #059669 0%, #10B981 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">Campus Verse</h1>
        </div>
        <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
          <h2 style="color: #059669; margin-top: 0;">Congratulations! Your Organization is Approved</h2>
          <p>Dear ${adminName},</p>
          <p>Great news! <strong>${organizationName}</strong> has been approved on Campus Verse.</p>
          <p>You can now log in and start setting up your institution:</p>
          <ul style="color: #4b5563;">
            <li>Add your branches</li>
            <li>Set up academic batches</li>
            <li>Configure classes and sections</li>
            <li>Invite staff members</li>
          </ul>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${loginUrl}" style="background: #059669; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block;">Login to Dashboard</a>
          </div>
          <p style="color: #6b7280; font-size: 14px;">If you have any questions, feel free to reach out to our support team.</p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
          <p style="color: #9ca3af; font-size: 12px; text-align: center;">Welcome to Campus Verse!</p>
        </div>
      </body>
      </html>
    `;

    return sendEmail({
      to: email,
      subject: 'Your organization has been approved - Campus Verse',
      html,
    });
  },

  async sendRejectionEmail(
    email: string,
    organizationName: string,
    adminName: string,
    reason: string
  ): Promise<boolean> {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Organization Application Update</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">Campus Verse</h1>
        </div>
        <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
          <h2 style="color: #1f2937; margin-top: 0;">Application Update</h2>
          <p>Dear ${adminName},</p>
          <p>Thank you for your interest in Campus Verse. After reviewing your application for <strong>${organizationName}</strong>, we are unable to approve it at this time.</p>
          <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; margin: 20px 0;">
            <p style="color: #991b1b; margin: 0; font-weight: 600;">Reason:</p>
            <p style="color: #7f1d1d; margin: 8px 0 0 0;">${reason}</p>
          </div>
          <p>If you believe this was a mistake or would like to provide additional information, please contact our support team.</p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
          <p style="color: #9ca3af; font-size: 12px; text-align: center;">Thank you for your understanding.</p>
        </div>
      </body>
      </html>
    `;

    return sendEmail({
      to: email,
      subject: 'Application update - Campus Verse',
      html,
    });
  },

  async sendUserWelcomeEmail(
    email: string,
    userName: string,
    tempPassword: string,
    organizationName: string,
    roleName: string
  ): Promise<boolean> {
    const loginUrl = `${env.APP_URL.split(',')[0]}/login`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to Campus Verse</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">Campus Verse</h1>
        </div>
        <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
          <h2 style="color: #1f2937; margin-top: 0;">Welcome to ${organizationName}!</h2>
          <p>Dear ${userName},</p>
          <p>You have been added as a <strong>${roleName}</strong> on Campus Verse. Your account has been created and you can now log in using the credentials below:</p>
          <div style="background: #f3f4f6; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <p style="margin: 0;"><strong>Email:</strong> ${email}</p>
            <p style="margin: 12px 0 0 0;"><strong>Temporary Password:</strong></p>
            <p style="margin: 8px 0 0 0; font-family: monospace; font-size: 18px; color: #4F46E5; background: #e0e7ff; padding: 10px; border-radius: 4px; text-align: center;">${tempPassword}</p>
          </div>
          <div style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 12px; margin: 20px 0;">
            <p style="margin: 0; color: #92400e; font-size: 14px;">⚠️ For security reasons, please change your password after your first login.</p>
          </div>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${loginUrl}" style="background: #4F46E5; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block;">Login to Campus Verse</a>
          </div>
          <p style="color: #6b7280; font-size: 14px;">If the button doesn't work, copy and paste this link into your browser:</p>
          <p style="color: #4F46E5; font-size: 14px; word-break: break-all;">${loginUrl}</p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
          <p style="color: #9ca3af; font-size: 12px; text-align: center;">If you didn't expect this email, please contact your organization administrator.</p>
        </div>
      </body>
      </html>
    `;

    return sendEmail({
      to: email,
      subject: `Welcome to ${organizationName} - Campus Verse`,
      html,
    });
  },

  /**
   * User-initiated forgot-password flow: emails the recipient a tokenised link
   * they can click to set a new password themselves. Distinct from
   * `sendPasswordResetEmail` below, which is used by admins to deliver a
   * fresh password directly.
   */
  async sendForgotPasswordLink(email: string, token: string): Promise<boolean> {
    const resetUrl = `${env.APP_URL.split(',')[0]}/reset-password?token=${token}`;
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Reset your password</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #1e1b4b 0%, #06b6d4 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">Campus Verse</h1>
        </div>
        <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
          <h2 style="color: #1f2937; margin-top: 0;">Reset your password</h2>
          <p>We received a request to reset the password for the Campus Verse account associated with this email.</p>
          <p>Click the button below to choose a new password. The link expires in 60 minutes.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" style="display: inline-block; background: #1e1b4b; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600;">Reset password</a>
          </div>
          <p style="color: #6b7280; font-size: 13px;">If the button doesn't work, paste this URL into your browser:</p>
          <p style="font-family: monospace; font-size: 12px; color: #4f46e5; word-break: break-all;">${resetUrl}</p>
          <div style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 12px; margin: 20px 0;">
            <p style="margin: 0; color: #92400e; font-size: 14px;">If you didn't request this, you can safely ignore the email — your password won't change.</p>
          </div>
        </div>
      </body>
      </html>
    `;
    return sendEmail({ to: email, subject: 'Reset your Campus Verse password', html });
  },

  async sendPasswordResetEmail(
    email: string,
    userName: string,
    newPassword: string,
    organizationName: string
  ): Promise<boolean> {
    const loginUrl = `${env.APP_URL.split(',')[0]}/login`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Password Reset</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">Campus Verse</h1>
        </div>
        <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
          <h2 style="color: #1f2937; margin-top: 0;">Password Reset</h2>
          <p>Dear ${userName},</p>
          <p>Your password for Campus Verse has been reset by an administrator. Please use the new password below to log in:</p>
          <div style="background: #f3f4f6; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <p style="margin: 0;"><strong>Email:</strong> ${email}</p>
            <p style="margin: 12px 0 0 0;"><strong>New Password:</strong></p>
            <p style="margin: 8px 0 0 0; font-family: monospace; font-size: 18px; color: #4F46E5; background: #e0e7ff; padding: 10px; border-radius: 4px; text-align: center;">${newPassword}</p>
          </div>
          <div style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 12px; margin: 20px 0;">
            <p style="margin: 0; color: #92400e; font-size: 14px;">⚠️ For security reasons, please change your password after logging in.</p>
          </div>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${loginUrl}" style="background: #4F46E5; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block;">Login to Campus Verse</a>
          </div>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
          <p style="color: #9ca3af; font-size: 12px; text-align: center;">If you didn't request this reset, please contact your administrator immediately.</p>
        </div>
      </body>
      </html>
    `;

    return sendEmail({
      to: email,
      subject: `Password Reset - ${organizationName} - Campus Verse`,
      html,
    });
  },

  async notifySuperAdminNewSignup(organizationName: string, adminEmail: string): Promise<boolean> {
    const adminDashboardUrl = `${env.APP_URL.split(',')[0]}/admin/organizations`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>New Organization Signup</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">Campus Verse Admin</h1>
        </div>
        <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
          <h2 style="color: #1f2937; margin-top: 0;">New Organization Signup</h2>
          <p>A new organization has completed email verification and is awaiting approval:</p>
          <div style="background: #f3f4f6; border-radius: 8px; padding: 16px; margin: 20px 0;">
            <p style="margin: 0;"><strong>Organization:</strong> ${organizationName}</p>
            <p style="margin: 8px 0 0 0;"><strong>Admin Email:</strong> ${adminEmail}</p>
          </div>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${adminDashboardUrl}" style="background: #4F46E5; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block;">Review Application</a>
          </div>
        </div>
      </body>
      </html>
    `;

    return sendEmail({
      to: env.SUPER_ADMIN_EMAIL,
      subject: `New signup: ${organizationName} - Campus Verse`,
      html,
    });
  },

  /**
   * Sent to parents when a student's exam result is published.
   * `subject` and `body` accept simple {{placeholder}} templates the
   * exam-settings UI configures; defaults are used when unset.
   */
  async sendResultPublishedEmail(args: {
    parentEmail: string;
    studentName: string;
    examName: string;
    termName: string;
    reportCardUrl?: string;
    subjectTemplate?: string;
    bodyTemplate?: string;
  }): Promise<boolean> {
    const render = (tpl: string) =>
      tpl
        .replace(/\{\{studentName\}\}/g, args.studentName)
        .replace(/\{\{examName\}\}/g, args.examName)
        .replace(/\{\{termName\}\}/g, args.termName);

    const subject = args.subjectTemplate
      ? render(args.subjectTemplate)
      : `${args.examName} results published — ${args.studentName}`;

    const bodyText = args.bodyTemplate
      ? render(args.bodyTemplate)
      : `Dear parent, the ${args.examName} (${args.termName}) results for ${args.studentName} are now available. Please log in to the student portal to view the detailed report card.`;

    const linkBlock = args.reportCardUrl
      ? `
          <div style="text-align: center; margin: 28px 0;">
            <a href="${args.reportCardUrl}" style="display: inline-block; background: #04266D; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600;">View report card</a>
          </div>
          <p style="color: #6b7280; font-size: 12px;">If the button doesn't work, paste this URL into your browser:</p>
          <p style="font-family: monospace; font-size: 12px; color: #04266D; word-break: break-all;">${args.reportCardUrl}</p>
        `
      : '';

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${subject}</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #04266D 0%, #0AC5FF 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">Campus Verse</h1>
          <p style="color: rgba(255,255,255,0.85); margin: 6px 0 0; font-size: 13px;">Results announcement</p>
        </div>
        <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
          <h2 style="color: #1f2937; margin-top: 0;">${subject}</h2>
          <p>${bodyText}</p>
          ${linkBlock}
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
          <p style="color: #9ca3af; font-size: 12px;">If you didn't expect this email, please contact your school's administration.</p>
        </div>
      </body>
      </html>
    `;

    return sendEmail({ to: args.parentEmail, subject, html });
  },
};
