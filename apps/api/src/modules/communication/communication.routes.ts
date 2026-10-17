import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { requireBranch, requirePermission } from '../../middleware/rbac';
import { requireModule } from '../../middleware/moduleGating';
import { announcementController } from './announcement.controller';
import { eventController } from './event.controller';
import { communicationSettingsController } from './communicationSettings.controller';
import { smsController } from './sms.controller';

const router: ReturnType<typeof Router> = Router();

router.use(authenticate);
router.use(requireModule('communications'));
router.use(requireBranch);

// ============ SMS ============
router.post('/sms/send', requirePermission('communications.sms', 'send'), smsController.sendSMS);
router.get('/sms/logs', requirePermission('communications.sms', 'view'), smsController.getSMSLogs);
router.get(
  '/sms/stats',
  requirePermission('communications.sms', 'view'),
  smsController.getSMSStats
);
router.get(
  '/sms/templates',
  requirePermission('communications.sms', 'view'),
  smsController.getTemplates
);
router.get(
  '/sms/balance',
  requirePermission('communications.sms', 'view'),
  smsController.getSMSBalance
);

// ============ Announcements ============
router.get(
  '/announcements',
  requirePermission('communications.announcements', 'view'),
  announcementController.findAll
);

router.post(
  '/announcements',
  requirePermission('communications.announcements', 'create'),
  announcementController.create
);

router.get(
  '/announcements/:id',
  requirePermission('communications.announcements', 'view'),
  announcementController.findById
);

router.put(
  '/announcements/:id',
  requirePermission('communications.announcements', 'edit'),
  announcementController.update
);

router.delete(
  '/announcements/:id',
  requirePermission('communications.announcements', 'delete'),
  announcementController.delete
);

router.put(
  '/announcements/:id/publish',
  requirePermission('communications.announcements', 'edit'),
  announcementController.publish
);

router.put(
  '/announcements/:id/archive',
  requirePermission('communications.announcements', 'edit'),
  announcementController.archive
);

router.post(
  '/announcements/:id/acknowledge',
  requirePermission('communications.announcements', 'view'),
  announcementController.acknowledge
);

// ============ Events ============
router.get(
  '/events/upcoming',
  requirePermission('communications.calendar', 'view'),
  eventController.getUpcoming
);

router.get(
  '/events/calendar',
  requirePermission('communications.calendar', 'view'),
  eventController.getCalendar
);

router.get(
  '/events',
  requirePermission('communications.calendar', 'view'),
  eventController.findAll
);

router.post(
  '/events',
  requirePermission('communications.calendar', 'create'),
  eventController.create
);

router.get(
  '/events/:id',
  requirePermission('communications.calendar', 'view'),
  eventController.findById
);

router.put(
  '/events/:id',
  requirePermission('communications.calendar', 'edit'),
  eventController.update
);

router.delete(
  '/events/:id',
  requirePermission('communications.calendar', 'delete'),
  eventController.delete
);

router.put(
  '/events/:id/cancel',
  requirePermission('communications.calendar', 'edit'),
  eventController.cancel
);

// ============ Settings ============
router.get(
  '/settings',
  requirePermission('communications.settings', 'view'),
  communicationSettingsController.getSettings
);
router.put(
  '/settings',
  requirePermission('communications.settings', 'edit'),
  communicationSettingsController.updateSettings
);

// Event Types
router.post(
  '/settings/event-types',
  requirePermission('communications.settings', 'edit'),
  communicationSettingsController.addEventType
);
router.put(
  '/settings/event-types/:code',
  requirePermission('communications.settings', 'edit'),
  communicationSettingsController.updateEventType
);
router.delete(
  '/settings/event-types/:code',
  requirePermission('communications.settings', 'edit'),
  communicationSettingsController.deleteEventType
);

// SMS Templates
router.post(
  '/settings/sms-templates',
  requirePermission('communications.settings', 'edit'),
  communicationSettingsController.addSMSTemplate
);
router.put(
  '/settings/sms-templates/:code',
  requirePermission('communications.settings', 'edit'),
  communicationSettingsController.updateSMSTemplate
);
router.delete(
  '/settings/sms-templates/:code',
  requirePermission('communications.settings', 'edit'),
  communicationSettingsController.deleteSMSTemplate
);

// Email Templates
router.post(
  '/settings/email-templates',
  requirePermission('communications.settings', 'edit'),
  communicationSettingsController.addEmailTemplate
);
router.put(
  '/settings/email-templates/:code',
  requirePermission('communications.settings', 'edit'),
  communicationSettingsController.updateEmailTemplate
);
router.delete(
  '/settings/email-templates/:code',
  requirePermission('communications.settings', 'edit'),
  communicationSettingsController.deleteEmailTemplate
);

// ============ Reports ============
router.get(
  '/reports/login',
  requirePermission('communications.reports', 'view'),
  communicationSettingsController.getLoginReport
);
router.get(
  '/reports/never-logged',
  requirePermission('communications.reports', 'view'),
  communicationSettingsController.getNeverLoggedReport
);
router.get(
  '/reports/notifications',
  requirePermission('communications.reports', 'view'),
  communicationSettingsController.getNotificationReport
);

export default router;
