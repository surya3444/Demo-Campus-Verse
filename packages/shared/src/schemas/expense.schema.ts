import { z } from 'zod';

// ── Expense ──

export const createExpenseSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().max(1000).optional(),
  category: z.enum([
    'travel',
    'supplies',
    'equipment',
    'maintenance',
    'events',
    'utilities',
    'other',
  ]),
  amount: z.number().positive('Amount must be greater than 0'),
  budgetId: z
    .string()
    .regex(/^[a-f\d]{24}$/i, 'Invalid ID format')
    .optional(),
  attachments: z
    .array(
      z.object({
        name: z.string().min(1),
        url: z.string().url(),
        type: z.string(),
      })
    )
    .optional(),
});

export const updateExpenseSchema = createExpenseSchema.partial();

// ── Budget ──

export const createBudgetSchema = z.object({
  name: z.string().min(1, 'Budget name is required').max(200),
  description: z.string().max(1000).optional(),
  category: z.string().optional(),
  department: z.string().optional(),
  academicBatchId: z
    .string()
    .regex(/^[a-f\d]{24}$/i, 'Invalid ID format')
    .optional(),
  allocated: z.number().positive('Allocated amount must be greater than 0'),
  period: z.object({
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
  }),
});

export const updateBudgetSchema = createBudgetSchema.partial();

// ── Reimbursement ──

export const createReimbursementSchema = z.object({
  expenseId: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid expense ID'),
  amount: z.number().positive('Amount must be greater than 0'),
  description: z.string().max(1000).optional(),
  bankDetails: z
    .object({
      accountNumber: z.string().min(1, 'Account number is required'),
      ifscCode: z.string().min(1, 'IFSC code is required'),
      bankName: z.string().min(1, 'Bank name is required'),
    })
    .optional(),
});

// ── Type Exports ──

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>;
export type CreateBudgetInput = z.infer<typeof createBudgetSchema>;
export type UpdateBudgetInput = z.infer<typeof updateBudgetSchema>;
export type CreateReimbursementInput = z.infer<typeof createReimbursementSchema>;
