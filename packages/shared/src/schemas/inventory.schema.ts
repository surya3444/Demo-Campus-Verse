import { z } from 'zod';

// ── Asset Category ──

export const createCategorySchema = z.object({
  name: z.string().min(1, 'Category name is required').max(100),
  code: z.string().min(1, 'Category code is required').max(20),
  description: z.string().max(500).optional(),
  parentId: z
    .string()
    .regex(/^[a-f\d]{24}$/i, 'Invalid ID format')
    .optional(),
});

export const updateCategorySchema = createCategorySchema.partial();

// ── Asset ──

export const createAssetSchema = z.object({
  name: z.string().min(1, 'Asset name is required').max(200),
  description: z.string().max(1000).optional(),
  categoryId: z
    .string()
    .regex(/^[a-f\d]{24}$/i, 'Invalid ID format')
    .optional(),
  location: z.string().max(200).optional(),
  serialNumber: z.string().max(100).optional(),
  modelNumber: z.string().max(100).optional(),
  manufacturer: z.string().max(200).optional(),
  purchaseDate: z.coerce.date().optional(),
  purchasePrice: z.number().min(0).optional(),
  currentValue: z.number().min(0).optional(),
  warrantyExpiry: z.coerce.date().optional(),
  condition: z.enum(['new', 'good', 'fair', 'poor', 'damaged', 'disposed']).default('new'),
  status: z.enum(['available', 'issued', 'maintenance', 'disposed', 'lost']).default('available'),
  tags: z.array(z.string()).optional(),
  quantity: z.number().int().min(1).default(1),
  unit: z.string().max(50).default('piece'),
});

export const updateAssetSchema = createAssetSchema.partial();

// ── Procurement ──

export const procurementItemSchema = z.object({
  name: z.string().min(1, 'Item name is required'),
  categoryId: z
    .string()
    .regex(/^[a-f\d]{24}$/i, 'Invalid ID format')
    .optional(),
  quantity: z.number().int().min(1, 'Quantity must be at least 1'),
  unitPrice: z.number().min(0, 'Unit price must be non-negative'),
  totalPrice: z.number().min(0),
});

export const vendorSchema = z.object({
  name: z.string().min(1, 'Vendor name is required'),
  contact: z.string().optional(),
  email: z.string().email('Invalid email').optional(),
});

export const createProcurementSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().max(1000).optional(),
  items: z.array(procurementItemSchema).min(1, 'At least one item is required'),
  vendor: vendorSchema,
  expectedDate: z.coerce.date().optional(),
  remarks: z.string().max(1000).optional(),
});

export const updateProcurementSchema = createProcurementSchema.partial();

// ── Issue / Return ──

export const issueAssetSchema = z.object({
  assetId: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid asset ID'),
  issuedTo: z.object({
    userId: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid user ID'),
    userName: z.string().min(1),
    department: z.string().optional(),
  }),
  issueDate: z.coerce.date(),
  expectedReturnDate: z.coerce.date().optional(),
  conditionAtIssue: z.enum(['new', 'good', 'fair', 'poor', 'damaged']),
  remarks: z.string().max(500).optional(),
});

export const returnAssetSchema = z.object({
  conditionAtReturn: z.enum(['new', 'good', 'fair', 'poor', 'damaged']),
  returnRemarks: z.string().max(500).optional(),
});

// ── Type Exports ──

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
export type CreateAssetInput = z.infer<typeof createAssetSchema>;
export type UpdateAssetInput = z.infer<typeof updateAssetSchema>;
export type ProcurementItemInput = z.infer<typeof procurementItemSchema>;
export type VendorInput = z.infer<typeof vendorSchema>;
export type CreateProcurementInput = z.infer<typeof createProcurementSchema>;
export type UpdateProcurementInput = z.infer<typeof updateProcurementSchema>;
export type IssueAssetInput = z.infer<typeof issueAssetSchema>;
export type ReturnAssetInput = z.infer<typeof returnAssetSchema>;
