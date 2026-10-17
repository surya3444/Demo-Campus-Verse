import { ObjectId } from 'mongodb';
import { collections } from '../../config/database';
import { SETUP_TASKS, type SetupStatusPayload, type SetupTaskState } from '@campus-verse/shared';

/**
 * Computes the live state of every setup task for a tenant. Status is derived
 * from collection counts (no extra state stored), with one exception:
 * tenants.setupDismissals[] holds explicit "snooze" entries set by the admin
 * so we can hide a task for 7 days without permanently marking it done.
 */

const DISMISS_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

interface DismissalEntry {
  taskId: string;
  dismissedAt: Date;
}

class SetupStatusService {
  async getStatus(tenantId: string): Promise<SetupStatusPayload> {
    const tenantObjectId = new ObjectId(tenantId);
    const tenantDoc = await collections.tenants.findOne({ _id: tenantObjectId });
    const dismissals: DismissalEntry[] = (tenantDoc?.setupDismissals ?? []).map(
      (d: { taskId: string; dismissedAt: string | Date }) => ({
        taskId: d.taskId,
        dismissedAt: new Date(d.dismissedAt),
      })
    );

    // ─── Bulk count queries in parallel ─────────────────────────────────
    const [
      sectionsCount,
      subjectsCount,
      sectionsWithTeacherCount,
      staffCount,
      feeStructuresCount,
      feeAssignmentsCount,
      admissionSourcesCount,
      communicationSettings,
    ] = await Promise.all([
      collections.sections.countDocuments({ tenantId: tenantObjectId }),
      collections.subjects.countDocuments({ tenantId: tenantObjectId }),
      collections.sections.countDocuments({
        tenantId: tenantObjectId,
        sectionTeacherId: { $exists: true, $ne: null },
      }),
      collections.staff.countDocuments({ tenantId: tenantObjectId }),
      collections.feeStructures.countDocuments({ tenantId: tenantObjectId }),
      collections.feeAssignments.countDocuments({ tenantId: tenantObjectId }),
      collections.admissionSources.countDocuments({ tenantId: tenantObjectId }),
      collections.communicationSettings.findOne({ tenantId: tenantObjectId }),
    ]);

    // ─── Derive each task's done flag ────────────────────────────────────
    const branding = tenantDoc?.branding ?? {};
    const address = tenantDoc?.contact?.address ?? {};

    const doneMap: Record<string, boolean> = {
      branding: !!(branding.logo && branding.logo.length > 0),
      address: !!(address.line1 && address.city && address.state && address.pincode),
      sections: sectionsCount > 0,
      subjects: subjectsCount > 0,
      class_teachers: sectionsWithTeacherCount > 0,
      staff: staffCount > 0,
      fee_structure: feeStructuresCount > 0,
      fee_assignment: feeAssignmentsCount > 0,
      admission_sources: admissionSourcesCount > 0,
      communications: this.isCommunicationConfigured(communicationSettings),
    };

    const now = Date.now();
    const tasks: SetupTaskState[] = SETUP_TASKS.map((task) => {
      const dismissal = dismissals.find((d) => d.taskId === task.id);
      const dismissedFresh = dismissal && now - dismissal.dismissedAt.getTime() < DISMISS_TTL_MS;

      if (doneMap[task.id]) {
        return { id: task.id, status: 'done' as const };
      }
      if (dismissedFresh && dismissal) {
        return {
          id: task.id,
          status: 'dismissed' as const,
          dismissedAt: dismissal.dismissedAt.toISOString(),
        };
      }
      return { id: task.id, status: 'pending' as const };
    });

    const required = SETUP_TASKS.filter((t) => t.required);
    const requiredDone = required.filter((t) => doneMap[t.id]).length;
    const requiredPercent =
      required.length > 0 ? Math.round((requiredDone / required.length) * 100) : 100;
    const allRequiredDone = requiredDone === required.length;

    return { tasks, requiredPercent, allRequiredDone };
  }

  async dismissTask(tenantId: string, taskId: string): Promise<void> {
    const tenantObjectId = new ObjectId(tenantId);
    const knownTaskIds = new Set(SETUP_TASKS.map((t) => t.id));
    if (!knownTaskIds.has(taskId)) {
      throw new Error(`Unknown setup task: ${taskId}`);
    }

    // Atomically replace any existing dismissal for this task.
    await collections.tenants.updateOne({ _id: tenantObjectId }, {
      $pull: { setupDismissals: { taskId } },
    } as never);
    await collections.tenants.updateOne({ _id: tenantObjectId }, {
      $push: {
        setupDismissals: { taskId, dismissedAt: new Date() },
      },
    } as never);
  }

  private isCommunicationConfigured(settings: Record<string, unknown> | null): boolean {
    if (!settings) return false;
    const sms = (settings.smsSettings ?? {}) as Record<string, unknown>;
    const email = (settings.emailSettings ?? {}) as Record<string, unknown>;
    const smsOn =
      sms.isEnabled === true && typeof sms.provider === 'string' && sms.provider !== 'none';
    const emailOn =
      email.isEnabled === true && typeof email.provider === 'string' && email.provider !== 'none';
    return smsOn || emailOn;
  }
}

export const setupStatusService = new SetupStatusService();
