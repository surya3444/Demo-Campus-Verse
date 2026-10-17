import { z } from 'zod';

export const createFeedbackTicketSchema = z.object({
  subject: z.string().min(1, 'Subject is required').max(200),
  description: z.string().min(1, 'Description is required').max(5000),
  category: z.enum([
    'academic',
    'infrastructure',
    'hostel',
    'finance',
    'hr',
    'safety',
    'harassment',
    'other',
  ]),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  isAnonymous: z.boolean().default(false),
});

export const updateFeedbackTicketSchema = z.object({
  subject: z.string().min(1).max(200).optional(),
  description: z.string().min(1).max(5000).optional(),
  category: z
    .enum([
      'academic',
      'infrastructure',
      'hostel',
      'finance',
      'hr',
      'safety',
      'harassment',
      'other',
    ])
    .optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
});

export const addFeedbackResponseSchema = z.object({
  message: z.string().min(1, 'Response message is required').max(5000),
  isInternal: z.boolean().default(false),
});

export const assignFeedbackTicketSchema = z.object({
  assignedTo: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid user ID'),
  assignedToName: z.string().min(1, 'Assignee name is required').max(200),
});

export const updateFeedbackStatusSchema = z.object({
  status: z.enum(['in_progress', 'resolved', 'closed', 'reopened']),
  resolutionNote: z.string().max(2000).optional(),
});

export const submitSatisfactionSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(1000).optional(),
});

// Type exports
export type CreateFeedbackTicketInput = z.infer<typeof createFeedbackTicketSchema>;
export type UpdateFeedbackTicketInput = z.infer<typeof updateFeedbackTicketSchema>;
export type AddFeedbackResponseInput = z.infer<typeof addFeedbackResponseSchema>;
export type AssignFeedbackTicketInput = z.infer<typeof assignFeedbackTicketSchema>;
export type UpdateFeedbackStatusInput = z.infer<typeof updateFeedbackStatusSchema>;
export type SubmitSatisfactionInput = z.infer<typeof submitSatisfactionSchema>;
