import { Request, Response, NextFunction } from 'express';
import { ObjectId } from 'mongodb';
import { collections } from '../../config/database';
import { success } from '../../utils/response';
import { ApiError } from '../../middleware/errorHandler';
import { logger } from '../../lib/logger';
import { institutionService } from './institution.service';

/**
 * Mirror the academic structure's top level (the department/stream entries on
 * class paths) into the HR department registry. Universities and colleges need
 * both: classes carry the department on their path, while staff, subjects and
 * the Departments overview page join against the registry. Idempotent — only
 * codes that don't already exist are inserted.
 */
async function seedDepartmentsFromClasses(tenantId: string, userId?: string): Promise<number> {
  const tenantOid = new ObjectId(tenantId);

  const classes = await collections.classes
    .find({ tenantId: tenantOid })
    .project({ branchId: 1, path: 1 })
    .toArray();

  // branchId → code → name, taken from each class's top path entry.
  const byBranch = new Map<string, Map<string, string>>();
  for (const cls of classes) {
    const top = (
      cls.path as Array<{ levelKey: string; name?: string; code?: string }> | undefined
    )?.[0];
    if (!top) continue;
    // Only hierarchies whose top level is a department/stream — a school's
    // top level is "grade", which is not a department.
    if (top.levelKey !== 'department' && top.levelKey !== 'stream') continue;
    const code = (top.code || top.name || '').trim().toUpperCase();
    const name = (top.name || top.code || '').trim();
    if (!code || !name) continue;
    const branchKey = String(cls.branchId);
    if (!byBranch.has(branchKey)) byBranch.set(branchKey, new Map());
    if (!byBranch.get(branchKey)!.has(code)) byBranch.get(branchKey)!.set(code, name);
  }
  if (byBranch.size === 0) return 0;

  const existing = await collections.departments
    .find({ tenantId: tenantOid })
    .project({ branchId: 1, code: 1 })
    .toArray();
  const existingKeys = new Set(existing.map((d) => `${String(d.branchId)}:${d.code}`));

  const now = new Date();
  const docs = [];
  for (const [branchKey, codes] of byBranch) {
    // Every department belongs to an institution from birth; a tenant being
    // onboarded only has each campus's default one.
    // Universities create their institutions first; their departments are
    // filed under those, so nothing is seeded into an implicit default.
    const institution = await institutionService.ensureDefaultUnlessUniversity(tenantId, branchKey);
    if (!institution) continue;
    for (const [code, name] of codes) {
      if (existingKeys.has(`${branchKey}:${code}`)) continue;
      docs.push({
        _id: new ObjectId(),
        tenantId: tenantOid,
        branchId: new ObjectId(branchKey),
        institutionId: institution._id,
        name,
        code,
        type: 'academic' as const,
        status: 'active' as const,
        ...(userId && { createdBy: new ObjectId(userId) }),
        createdAt: now,
        updatedAt: now,
      });
    }
  }
  if (docs.length === 0) return 0;

  await collections.departments.insertMany(docs);
  logger.info({ tenantId, count: docs.length }, 'Seeded departments from academic structure');
  return docs.length;
}

class OnboardingController {
  async getStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const tenantId = req.tenantId!;

      const tenant = await collections.tenants.findOne({ _id: new ObjectId(tenantId as string) });
      if (!tenant) {
        throw new ApiError('TENANT_NOT_FOUND', 'Tenant not found', 404);
      }

      const branchCount = await collections.branches.countDocuments({
        tenantId: new ObjectId(tenantId as string),
      });
      const hasAcademicStructure =
        (await collections.classes.countDocuments({ tenantId: new ObjectId(tenantId as string) })) >
        0;

      success(res, {
        completed: tenant.onboardingCompleted || false,
        progress: {
          branch: branchCount > 0,
          academic: hasAcademicStructure,
          modules: (tenant.subscription?.features?.length || 0) > 1,
          settings: !!tenant.settings?.timezone,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async complete(req: Request, res: Response, next: NextFunction) {
    try {
      const tenantId = req.tenantId!;

      // Validate minimum setup: at least 1 branch and 1 academic session
      const tenantOid = new ObjectId(tenantId as string);
      const [branchCount, batchCount, classCount] = await Promise.all([
        collections.branches.countDocuments({ tenantId: tenantOid }),
        collections.academicBatches.countDocuments({ tenantId: tenantOid }),
        collections.classes.countDocuments({ tenantId: tenantOid }),
      ]);
      if (branchCount === 0) {
        throw new ApiError(
          'ONBOARDING_INCOMPLETE',
          'Please create at least one branch before completing onboarding',
          400
        );
      }
      if (batchCount === 0) {
        throw new ApiError(
          'ONBOARDING_INCOMPLETE',
          'Please create at least one academic session before completing onboarding',
          400
        );
      }
      if (classCount === 0) {
        throw new ApiError(
          'ONBOARDING_INCOMPLETE',
          'Please create at least one class before completing onboarding',
          400
        );
      }

      await collections.tenants.updateOne(
        { _id: new ObjectId(tenantId as string) },
        { $set: { onboardingCompleted: true, updatedAt: new Date() } }
      );

      // Seed the HR department registry from the academic structure so the
      // Departments page and department-aware subject catalogue aren't empty
      // on day one. Non-fatal — onboarding must complete regardless.
      let departmentsCreated = 0;
      try {
        departmentsCreated = await seedDepartmentsFromClasses(tenantId as string, req.user?.userId);
      } catch (err) {
        logger.warn({ tenantId, err }, 'Department registry seeding failed after onboarding');
      }

      success(
        res,
        { completed: true, departmentsCreated },
        undefined,
        'Onboarding completed successfully'
      );
    } catch (error) {
      next(error);
    }
  }
}

export const onboardingController = new OnboardingController();
