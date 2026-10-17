import { InstitutionType } from './organization';

export interface SuperAdmin {
  _id: string;
  email: string;
  passwordHash?: string;
  profile: {
    firstName: string;
    lastName: string;
    displayName: string;
  };
  status: 'active' | 'inactive';
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface SuperAdminTokenPayload {
  adminId: string;
  email: string;
  type: 'access' | 'refresh';
  isSuperAdmin: true;
}

export type OrganizationSignupStatus =
  | 'pending_verification'
  | 'pending_approval'
  | 'approved'
  | 'rejected'
  | 'archived';

export interface OrganizationSignup {
  _id: string;
  organizationName: string;
  institutionType: InstitutionType;
  admin: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    passwordHash: string;
  };
  emailVerified: boolean;
  status: OrganizationSignupStatus;
  requestedModules: string[];
  approvedModules?: string[];
  rejectionReason?: string;
  rejectionHistory?: Array<{
    reason: string;
    rejectedBy: string;
    rejectedAt: Date;
    comments?: string;
  }>;
  tenantId?: string;
  createdAt: Date;
  updatedAt: Date;
  verifiedAt?: Date;
  approvedAt?: Date;
  approvedBy?: string;
  rejectedAt?: Date;
  rejectedBy?: string;
  archivedAt?: Date;
  canReapply?: boolean;
  reapplyAfter?: Date;
}

export interface OrganizationSignupResponse {
  id: string;
  organizationName: string;
  institutionType: InstitutionType;
  admin: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
  };
  emailVerified: boolean;
  status: OrganizationSignupStatus;
  requestedModules: string[];
  approvedModules?: string[];
  rejectionReason?: string;
  rejectionHistory?: Array<{
    reason: string;
    rejectedAt: Date;
    comments?: string;
  }>;
  createdAt: Date;
  approvedAt?: Date;
  rejectedAt?: Date;
  archivedAt?: Date;
  canReapply?: boolean;
}

export interface SuperAdminLoginResponse {
  admin: Omit<SuperAdmin, 'passwordHash'>;
  accessToken: string;
  expiresIn: number;
}

export interface AdminDashboardStats {
  pendingApprovals: number;
  totalOrganizations: number;
  approvedThisMonth: number;
  rejectedThisMonth: number;
  recentSignups: OrganizationSignupResponse[];
}
