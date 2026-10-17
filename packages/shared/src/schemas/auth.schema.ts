import { z } from 'zod';
import { CORE_MODULES, isValidModuleCode } from '../constants/modules';

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
});

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1, 'Reset token is required'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
        'Password must contain uppercase, lowercase, number, and special character'
      ),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
        'Password must contain uppercase, lowercase, number, and special character'
      ),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export const updateProfileSchema = z.object({
  firstName: z.string().min(1).max(50).optional(),
  lastName: z.string().min(1).max(50).optional(),
  phone: z
    .string()
    .regex(/^\+?[1-9]\d{9,14}$/, 'Invalid phone number')
    .optional(),
  avatar: z.string().url().optional(),
  preferences: z
    .object({
      language: z.string().optional(),
      notifications: z
        .object({
          email: z.boolean().optional(),
          sms: z.boolean().optional(),
          push: z.boolean().optional(),
        })
        .optional(),
    })
    .optional(),
});

// Organization Signup Schema
export const organizationSignupSchema = z
  .object({
    organizationName: z
      .string()
      .min(3, 'Organization name must be at least 3 characters')
      .max(100, 'Organization name must be at most 100 characters'),
    institutionType: z.enum(['school', 'college', 'university'], {
      required_error: 'Please select an institution type',
    }),
    firstName: z
      .string()
      .min(2, 'First name must be at least 2 characters')
      .max(50, 'First name must be at most 50 characters'),
    lastName: z
      .string()
      .min(2, 'Last name must be at least 2 characters')
      .max(50, 'Last name must be at most 50 characters'),
    email: z.string().email('Invalid email address'),
    phone: z.string().regex(/^\+?[1-9]\d{9,14}$/, 'Invalid phone number'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
        'Password must contain uppercase, lowercase, number, and special character'
      ),
    confirmPassword: z.string(),
    requestedModules: z
      .array(z.string())
      .min(1, 'At least one module is required')
      .refine(
        (modules) => modules.every((m) => isValidModuleCode(m)),
        'Invalid module code provided'
      )
      .refine(
        (modules) => CORE_MODULES.every((core) => modules.includes(core)),
        'Core modules are required'
      )
      // Must satisfy the refine above — the old default lacked admissions and
      // communications, so every signup that omitted the list was rejected.
      .default([...CORE_MODULES, 'teaching']),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

// Email Verification Schema
export const verifyEmailSchema = z.object({
  token: z.string().min(1, 'Verification token is required'),
});

// Super Admin Login Schema
export const superAdminLoginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password is required'),
});

// Reject Organization Schema
export const rejectOrganizationSchema = z.object({
  reason: z
    .string()
    .min(10, 'Reason must be at least 10 characters')
    .max(500, 'Reason must be at most 500 characters'),
});

// Approve Organization Schema (with module selection)
export const approveOrganizationSchema = z.object({
  approvedModules: z
    .array(z.string())
    .min(1, 'At least one module is required')
    .refine((modules) => modules.every((m) => isValidModuleCode(m)), 'Invalid module code provided')
    .refine(
      (modules) => CORE_MODULES.every((core) => modules.includes(core)),
      'Core modules are required'
    )
    .optional(), // omitted → falls back to the org's requested modules
  subscriptionPlan: z.enum(['starter', 'professional', 'enterprise']).optional().default('starter'),
});

// Delete Organization Schema (type-to-confirm)
export const deleteOrganizationSchema = z.object({
  confirmName: z.string().min(1, 'Type the organization name to confirm deletion'),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type OrganizationSignupInput = z.infer<typeof organizationSignupSchema>;
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;
export type SuperAdminLoginInput = z.infer<typeof superAdminLoginSchema>;
export type RejectOrganizationInput = z.infer<typeof rejectOrganizationSchema>;
export type ApproveOrganizationInput = z.infer<typeof approveOrganizationSchema>;
export type DeleteOrganizationInput = z.infer<typeof deleteOrganizationSchema>;
