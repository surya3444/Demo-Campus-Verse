import { Request, Response, NextFunction } from 'express';
import { ObjectId } from 'mongodb';
import { collections } from '../../../config/database';
import { ApiError } from '../../../middleware/errorHandler';

type InstitutionType = 'school' | 'college' | 'university';

// Cache branch institution types for 5 minutes
const institutionTypeCache = new Map<string, { type: InstitutionType; expires: number }>();
const CACHE_TTL = 5 * 60 * 1000;

async function getBranchInstitutionType(branchId: string): Promise<InstitutionType> {
  const cached = institutionTypeCache.get(branchId);
  if (cached && cached.expires > Date.now()) {
    return cached.type;
  }

  const branch = await collections.branches.findOne(
    { _id: new ObjectId(branchId) },
    { projection: { institutionType: 1 } }
  );

  if (!branch) {
    throw new ApiError('BRANCH_NOT_FOUND', 'Branch not found', 404);
  }

  const institutionType = (branch.institutionType as InstitutionType) || 'school';

  institutionTypeCache.set(branchId, {
    type: institutionType,
    expires: Date.now() + CACHE_TTL,
  });

  return institutionType;
}

/**
 * Middleware to restrict routes based on institution type.
 * - 'placement': only college/university
 * - 'counseling': only school
 * - 'alumni': all institution types
 */
export function requireInstitutionType(featureGroup: 'placement' | 'counseling' | 'alumni') {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.branchId) {
        throw new ApiError('BRANCH_REQUIRED', 'Branch ID is required', 400);
      }

      const institutionType = await getBranchInstitutionType(req.branchId);

      if (featureGroup === 'placement') {
        if (institutionType === 'school') {
          throw new ApiError(
            'FEATURE_NOT_AVAILABLE',
            'Placement features are only available for colleges and universities',
            403
          );
        }
      } else if (featureGroup === 'counseling') {
        if (institutionType !== 'school') {
          throw new ApiError(
            'FEATURE_NOT_AVAILABLE',
            'Career counseling features are only available for schools',
            403
          );
        }
      }
      // 'alumni' is available for all institution types

      next();
    } catch (error) {
      next(error);
    }
  };
}

export function clearInstitutionTypeCache(branchId?: string): void {
  if (branchId) {
    institutionTypeCache.delete(branchId);
  } else {
    institutionTypeCache.clear();
  }
}
