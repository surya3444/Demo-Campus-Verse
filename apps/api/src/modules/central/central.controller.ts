import { Request, Response, NextFunction } from 'express';
import { ObjectId } from 'mongodb';
import { collections } from '../../config/database';
import { ApiError } from '../../middleware/errorHandler';
import { success } from '../../utils/response';
import { getBranchInstitutionMap } from '../../middleware/scope';
import { centralService, resolveInstitutionGroups } from './central.service';

/**
 * The "All institutions" endpoints deliberately do NOT use requireBranch:
 * their whole purpose is to answer across every institution the caller can
 * reach. The branch set therefore comes from the access scope, never from
 * X-Branch-Id:
 *
 *   global      → every active branch of the tenant
 *   institution → active branches of the granted institutions
 *   branch      → the granted branches (a multi-campus college still gets a
 *                 useful rollup; it just has one institution in it)
 *   department/program → rejected: these scopes are narrower than a branch,
 *                 so a cross-institution rollup would over-report.
 */
async function resolveAccessibleBranchIds(req: Request): Promise<ObjectId[]> {
  const scope = req.user?.accessScope;
  const tenantId = req.tenantId!;

  if (scope?.type === 'department' || scope?.type === 'program') {
    throw new ApiError(
      'SCOPE_TOO_NARROW',
      'Cross-institution views are for branch-level access and above',
      403
    );
  }

  if (scope?.type === 'global') {
    const branches = await collections.branches
      .find({ tenantId: new ObjectId(tenantId), status: 'active' })
      .project({ _id: 1 })
      .toArray();
    return branches.map((b) => b._id as ObjectId);
  }

  if (scope?.type === 'institution') {
    const institutionIds = (scope.institutionIds ?? []).map((id) => new ObjectId(id));
    if (institutionIds.length === 0) return [];
    // Institutions sit below campuses: the grant reaches the campuses that
    // host them (Institution.branchId), and the rows narrow to the grant.
    const institutions = await collections.institutions
      .find({ tenantId: new ObjectId(tenantId), _id: { $in: institutionIds }, status: 'active' })
      .project({ branchId: 1 })
      .toArray();
    return [...new Set(institutions.map((i) => String(i.branchId)))].map((id) => new ObjectId(id));
  }

  return (scope?.branchIds ?? []).map((id) => new ObjectId(id));
}

/** Institution rows an institution-scoped caller may see; undefined = all. */
function allowedInstitutions(req: Request): string[] | undefined {
  const scope = req.user?.accessScope;
  return scope?.type === 'institution' ? (scope.institutionIds ?? []).map(String) : undefined;
}

class CentralController {
  /**
   * Which institutions this caller can roll up, and whether the mode is worth
   * offering at all. The UI hides the "All institutions" entry when
   * `available` is false — a school or a single-institution college gains
   * nothing from it.
   */
  async scope(req: Request, res: Response, next: NextFunction) {
    try {
      const branchIds = await resolveAccessibleBranchIds(req);
      const { groups } = await resolveInstitutionGroups(
        req.tenantId!,
        branchIds,
        allowedInstitutions(req)
      );
      success(res, {
        available: groups.length > 1,
        institutions: groups.map((g) => ({
          _id: g._id,
          name: g.name,
          code: g.code,
          isDefault: g.isDefault === true,
          branchIds: g.branchIds,
        })),
        branchCount: branchIds.length,
      });
    } catch (error) {
      next(error);
    }
  }

  async overview(req: Request, res: Response, next: NextFunction) {
    try {
      const branchIds = await resolveAccessibleBranchIds(req);
      success(
        res,
        await centralService.overview(req.tenantId!, branchIds, allowedInstitutions(req))
      );
    } catch (error) {
      next(error);
    }
  }

  async finance(req: Request, res: Response, next: NextFunction) {
    try {
      const branchIds = await resolveAccessibleBranchIds(req);
      success(
        res,
        await centralService.finance(req.tenantId!, branchIds, allowedInstitutions(req))
      );
    } catch (error) {
      next(error);
    }
  }

  async admissions(req: Request, res: Response, next: NextFunction) {
    try {
      const branchIds = await resolveAccessibleBranchIds(req);
      success(
        res,
        await centralService.admissions(req.tenantId!, branchIds, allowedInstitutions(req))
      );
    } catch (error) {
      next(error);
    }
  }

  async hr(req: Request, res: Response, next: NextFunction) {
    try {
      const branchIds = await resolveAccessibleBranchIds(req);
      success(res, await centralService.hr(req.tenantId!, branchIds, allowedInstitutions(req)));
    } catch (error) {
      next(error);
    }
  }

  async academics(req: Request, res: Response, next: NextFunction) {
    try {
      const branchIds = await resolveAccessibleBranchIds(req);
      success(
        res,
        await centralService.academics(req.tenantId!, branchIds, allowedInstitutions(req))
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * Branch → institution map, so a client can label branch-keyed data it
   * already holds without re-fetching every branch.
   */
  async branchMap(req: Request, res: Response, next: NextFunction) {
    try {
      const map = await getBranchInstitutionMap(req.tenantId!);
      success(res, Object.fromEntries(map));
    } catch (error) {
      next(error);
    }
  }
}

export const centralController = new CentralController();
