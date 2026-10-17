import { Request, Response, NextFunction } from 'express';
import { ObjectId } from 'mongodb';
import { collections } from '../config/database';
import { ApiError } from './errorHandler';
import { MODULES, CORE_MODULES, type ModuleCode } from '@campus-verse/shared/constants';

// Cache tenant features for 5 minutes to reduce DB lookups
const featureCache = new Map<string, { features: string[]; expires: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Core (required) modules always bypass the subscription gate, plus a set of
// optional-but-free modules that are available to every tenant regardless of
// what's stored in their subscription.features.
const ALWAYS_AVAILABLE = [
  ...CORE_MODULES,
  'teaching',
  'courses',
  'hostel',
  'health',
  'inventory',
  'expense',
  'visitor',
  'feedback',
  'transport',
  'certificates',
  'aiAssistant',
];

/**
 * Get enabled features/modules for a tenant
 */
async function getTenantFeatures(tenantId: string): Promise<string[]> {
  // Check cache first
  const cached = featureCache.get(tenantId);
  if (cached && cached.expires > Date.now()) {
    return cached.features;
  }

  // Fetch from database
  const tenant = await collections.tenants.findOne(
    { _id: new ObjectId(tenantId) },
    { projection: { 'subscription.features': 1 } }
  );

  if (!tenant) {
    throw new ApiError('TENANT_NOT_FOUND', 'Tenant not found', 404);
  }

  const features = tenant.subscription?.features || ['core'];

  // Cache the result
  featureCache.set(tenantId, {
    features,
    expires: Date.now() + CACHE_TTL,
  });

  return features;
}

/**
 * Clear feature cache for a tenant (call after subscription update)
 */
export function clearFeatureCache(tenantId: string): void {
  featureCache.delete(tenantId);
}

/**
 * Clear all feature cache
 */
export function clearAllFeatureCache(): void {
  featureCache.clear();
}

/**
 * Middleware to require a specific module to be enabled for the tenant
 *
 * @param moduleCode - The module code to check (e.g., 'finance', 'hr', 'admissions')
 *
 * Usage:
 * router.get('/finance/transactions', authenticate, requireModule('finance'), controller.list);
 */
export function requireModule(moduleCode: ModuleCode | string) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new ApiError('AUTH_UNAUTHORIZED', 'Authentication required', 401);
      }

      const { tenantId } = req.user;

      if (!tenantId) {
        throw new ApiError('TENANT_REQUIRED', 'Tenant context required', 400);
      }

      // Core and always-available modules bypass subscription check
      if (ALWAYS_AVAILABLE.includes(moduleCode)) {
        return next();
      }

      const enabledFeatures = await getTenantFeatures(tenantId);

      // Check if the module is enabled
      if (!enabledFeatures.includes(moduleCode)) {
        const moduleName = MODULES[moduleCode as ModuleCode]?.name || moduleCode;
        throw new ApiError(
          'MODULE_NOT_ENABLED',
          `The ${moduleName} module is not enabled for your organization. Please upgrade your subscription to access this feature.`,
          403
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Middleware to require any of the specified modules to be enabled
 *
 * @param moduleCodes - Array of module codes, at least one must be enabled
 *
 * Usage:
 * router.get('/reports', authenticate, requireAnyModule(['finance', 'hr']), controller.reports);
 */
export function requireAnyModule(moduleCodes: (ModuleCode | string)[]) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new ApiError('AUTH_UNAUTHORIZED', 'Authentication required', 401);
      }

      const { tenantId } = req.user;

      if (!tenantId) {
        throw new ApiError('TENANT_REQUIRED', 'Tenant context required', 400);
      }

      // If core is one of the modules, always allow
      if (moduleCodes.includes('core')) {
        return next();
      }

      const enabledFeatures = await getTenantFeatures(tenantId);

      // Check if any of the modules is enabled
      const hasAnyModule = moduleCodes.some((code) => enabledFeatures.includes(code));

      if (!hasAnyModule) {
        const moduleNames = moduleCodes
          .map((code) => MODULES[code as ModuleCode]?.name || code)
          .join(' or ');
        throw new ApiError(
          'MODULE_NOT_ENABLED',
          `None of the required modules (${moduleNames}) are enabled for your organization.`,
          403
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Middleware to require all specified modules to be enabled
 *
 * @param moduleCodes - Array of module codes, all must be enabled
 *
 * Usage:
 * router.get('/combined', authenticate, requireAllModules(['finance', 'hr']), controller.combined);
 */
export function requireAllModules(moduleCodes: (ModuleCode | string)[]) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new ApiError('AUTH_UNAUTHORIZED', 'Authentication required', 401);
      }

      const { tenantId } = req.user;

      if (!tenantId) {
        throw new ApiError('TENANT_REQUIRED', 'Tenant context required', 400);
      }

      const enabledFeatures = await getTenantFeatures(tenantId);

      // Check if all modules are enabled
      const missingModules = moduleCodes.filter(
        (code) => code !== 'core' && !enabledFeatures.includes(code)
      );

      if (missingModules.length > 0) {
        const moduleNames = missingModules
          .map((code) => MODULES[code as ModuleCode]?.name || code)
          .join(', ');
        throw new ApiError(
          'MODULE_NOT_ENABLED',
          `The following modules are required but not enabled: ${moduleNames}`,
          403
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Helper to check if a module is enabled for a tenant (for use in services)
 */
export async function isModuleEnabled(
  tenantId: string,
  moduleCode: ModuleCode | string
): Promise<boolean> {
  if (ALWAYS_AVAILABLE.includes(moduleCode)) return true;

  const enabledFeatures = await getTenantFeatures(tenantId);
  return enabledFeatures.includes(moduleCode);
}

/**
 * Helper to get all enabled modules for a tenant
 */
export async function getEnabledModules(tenantId: string): Promise<string[]> {
  return getTenantFeatures(tenantId);
}
