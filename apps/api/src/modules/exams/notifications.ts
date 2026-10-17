import { ObjectId, WithId, Document } from 'mongodb';
import { collections } from '../../config/database';
import { logger } from '../../lib/logger';
import { smsService } from '../communication/sms.service';
import { emailService } from '../../services/email.service';
import { examSettingsService } from './settings.service';
import type { ReportCardDocument } from './reportCard.service';

interface ParentContact {
  phone?: string;
  email?: string;
  role: 'father' | 'mother' | 'guardian';
  name?: string;
}

/**
 * Resolve every parent contact for the given students by reading
 * `students.parents.{father,mother,guardian}.{phone,email,name}`.
 * Each student gets up to three contact rows (one per parent role) — the
 * caller deduplicates if needed.
 */
async function resolveParentContacts(
  tenantId: ObjectId,
  studentIds: ObjectId[]
): Promise<Map<string, ParentContact[]>> {
  if (studentIds.length === 0) return new Map();
  const students = await collections.students
    .find({ tenantId, _id: { $in: studentIds } })
    .project({ _id: 1, parents: 1 })
    .toArray();

  const map = new Map<string, ParentContact[]>();
  for (const s of students) {
    const parents = (s.parents as Record<string, Record<string, unknown> | undefined>) || {};
    const list: ParentContact[] = [];
    for (const role of ['father', 'mother', 'guardian'] as const) {
      const p = parents[role];
      if (!p) continue;
      const phone = (p.phone as string) || (p.mobile as string) || undefined;
      const email = (p.email as string) || undefined;
      if (!phone && !email) continue;
      list.push({
        role,
        phone,
        email,
        name: (p.name as string) || (p.firstName as string) || undefined,
      });
    }
    map.set((s._id as ObjectId).toString(), list);
  }
  return map;
}

/**
 * Dispatch SMS + email parent notifications for a batch of report cards
 * that were just published.
 *
 * Behaviour:
 *   - Reads `exam_settings.resultNotification.{sendSms, sendEmail}` once;
 *     skips channels that are disabled.
 *   - SMS goes through smsService.sendSMS in chunks of 200 recipients to keep
 *     each call small; category='exam'.
 *   - Email uses sendResultPublishedEmail with per-recipient personalised
 *     subject/body templates from settings.
 *   - Best-effort: errors are logged but don't fail the publish.
 */
export async function dispatchResultPublishedNotifications(
  tenantId: string,
  branchId: string,
  cards: WithId<ReportCardDocument>[],
  publishedBy: string
): Promise<{ smsSent: number; emailsSent: number; skipped: number }> {
  if (cards.length === 0) return { smsSent: 0, emailsSent: 0, skipped: 0 };

  const settings = await examSettingsService.getSettings(tenantId, branchId);
  if (!settings.resultNotification.sendSms && !settings.resultNotification.sendEmail) {
    return { smsSent: 0, emailsSent: 0, skipped: cards.length };
  }

  const tenantObjId = new ObjectId(tenantId);
  const studentIds = cards.map((c) => c.studentId);
  const contactsByStudent = await resolveParentContacts(tenantObjId, studentIds);

  type SmsRecipient = {
    phone: string;
    name?: string;
    studentId?: string;
    variables: Record<string, string>;
  };
  const smsRecipients: SmsRecipient[] = [];
  const emailRecipients: Array<{ email: string; card: WithId<ReportCardDocument> }> = [];

  for (const card of cards) {
    const contacts = contactsByStudent.get(card.studentId.toString()) || [];
    for (const c of contacts) {
      if (settings.resultNotification.sendSms && c.phone) {
        smsRecipients.push({
          phone: c.phone,
          name: c.name,
          studentId: card.studentId.toString(),
          variables: {
            studentName: card.studentName,
            examName: card.examName,
            termName: card.termName,
            percentage: String(card.overall.percentage),
            grade: card.overall.grade || '',
          },
        });
      }
      if (settings.resultNotification.sendEmail && c.email) {
        emailRecipients.push({ email: c.email, card });
      }
    }
  }

  let smsSent = 0;
  if (settings.resultNotification.sendSms && smsRecipients.length > 0) {
    const defaultMessage =
      'Dear parent, the {examName} results for {studentName} are now available on the Campus Verse student portal. Score: {percentage}% ({grade}).';
    const message = settings.resultNotification.smsTemplate?.trim() || defaultMessage;
    const chunkSize = 200;
    for (let i = 0; i < smsRecipients.length; i += chunkSize) {
      const chunk = smsRecipients.slice(i, i + chunkSize);
      try {
        await smsService.sendSMS(
          tenantId,
          branchId,
          {
            message,
            category: 'exam',
            messageType: 'transactional',
            recipients: chunk,
          },
          publishedBy
        );
        smsSent += chunk.length;
      } catch (err) {
        // sms.service.ts throws if SMS isn't enabled for the branch — that's
        // expected; log and continue.
        logger.warn({ err, chunkStart: i, chunkSize: chunk.length }, 'SMS dispatch chunk failed');
      }
    }
  }

  let emailsSent = 0;
  if (settings.resultNotification.sendEmail && emailRecipients.length > 0) {
    // Resend has a transactional cap; fan out one by one rather than batching.
    // For tenants with thousands of students, this should be moved to a queue.
    for (const r of emailRecipients) {
      try {
        const ok = await emailService.sendResultPublishedEmail({
          parentEmail: r.email,
          studentName: r.card.studentName,
          examName: r.card.examName,
          termName: r.card.termName,
          reportCardUrl: r.card.pdfUrl,
          subjectTemplate: settings.resultNotification.emailSubject,
          bodyTemplate: settings.resultNotification.emailBody,
        });
        if (ok) emailsSent += 1;
      } catch (err) {
        logger.warn({ err, email: r.email }, 'Email dispatch failed');
      }
    }
  }

  // Audit log entry.
  try {
    await collections.auditLogs.insertOne({
      _id: new ObjectId(),
      tenantId: tenantObjId,
      userId: new ObjectId(publishedBy),
      action: 'exam.results_published',
      entityType: 'report_card',
      entityIds: cards.map((c) => c._id),
      details: { cards: cards.length, smsSent, emailsSent },
      timestamp: new Date(),
    } as unknown as Document);
  } catch (err) {
    logger.warn({ err }, 'Audit log entry for result publish failed');
  }

  logger.info(
    { cards: cards.length, smsSent, emailsSent },
    'Result-published notifications dispatched'
  );
  return { smsSent, emailsSent, skipped: 0 };
}
