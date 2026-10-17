import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { requireBranch, requirePermission } from '../../middleware/rbac';
import { requireModule } from '../../middleware/moduleGating';
import { validateBody } from '../../middleware/validate';
import {
  createAssetSchema,
  updateAssetSchema,
  createCategorySchema,
  updateCategorySchema,
  createProcurementSchema,
  updateProcurementSchema,
  issueAssetSchema,
  returnAssetSchema,
} from '@campus-verse/shared/schemas';
import { assetController } from './asset.controller';
import { categoryController } from './category.controller';
import { procurementController } from './procurement.controller';
import { issueController } from './issue.controller';
import { inventorySettingsController } from './inventorySettings.controller';

const router: ReturnType<typeof Router> = Router();

// Apply authentication and module gating
router.use(authenticate);
router.use(requireModule('inventory'));
router.use(requireBranch);

// ── Assets ──
router.get(
  '/assets/stats',
  requirePermission('inventory.assets', 'view'),
  assetController.getStats
);
router.get('/assets', requirePermission('inventory.assets', 'view'), assetController.findAll);
router.post(
  '/assets',
  requirePermission('inventory.assets', 'create'),
  validateBody(createAssetSchema),
  assetController.create
);
router.get('/assets/:id', requirePermission('inventory.assets', 'view'), assetController.findById);
router.put(
  '/assets/:id',
  requirePermission('inventory.assets', 'edit'),
  validateBody(updateAssetSchema),
  assetController.update
);
router.delete(
  '/assets/:id',
  requirePermission('inventory.assets', 'delete'),
  assetController.delete
);

// ── Categories ──
router.get(
  '/categories',
  requirePermission('inventory.categories', 'view'),
  categoryController.findAll
);
router.post(
  '/categories',
  requirePermission('inventory.categories', 'create'),
  validateBody(createCategorySchema),
  categoryController.create
);
router.put(
  '/categories/:id',
  requirePermission('inventory.categories', 'edit'),
  validateBody(updateCategorySchema),
  categoryController.update
);
router.delete(
  '/categories/:id',
  requirePermission('inventory.categories', 'delete'),
  categoryController.delete
);

// ── Procurements ──
router.get(
  '/procurements',
  requirePermission('inventory.procurement', 'view'),
  procurementController.findAll
);
router.post(
  '/procurements',
  requirePermission('inventory.procurement', 'create'),
  validateBody(createProcurementSchema),
  procurementController.create
);
router.get(
  '/procurements/:id',
  requirePermission('inventory.procurement', 'view'),
  procurementController.findById
);
router.put(
  '/procurements/:id',
  requirePermission('inventory.procurement', 'edit'),
  validateBody(updateProcurementSchema),
  procurementController.update
);
router.put(
  '/procurements/:id/approve',
  requirePermission('inventory.procurement', 'approve'),
  procurementController.approve
);
router.put(
  '/procurements/:id/receive',
  requirePermission('inventory.procurement', 'edit'),
  procurementController.receive
);

// ── Issue / Return ──
router.get('/issues/my', requirePermission('inventory.issue', 'view'), issueController.getMyAssets);
router.get('/issues', requirePermission('inventory.issue', 'view'), issueController.findAll);
router.post(
  '/issues',
  requirePermission('inventory.issue', 'create'),
  validateBody(issueAssetSchema),
  issueController.issue
);
router.put(
  '/issues/:id/return',
  requirePermission('inventory.issue', 'return'),
  validateBody(returnAssetSchema),
  issueController.returnAsset
);

// ── Settings ──
router.get(
  '/settings',
  requirePermission('inventory.settings', 'view'),
  inventorySettingsController.get
);
router.put(
  '/settings',
  requirePermission('inventory.settings', 'edit'),
  inventorySettingsController.update
);

export default router;
