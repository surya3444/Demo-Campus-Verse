import { User, Branch, Tenant } from './organization';

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface TokenPayload {
  userId: string;
  tenantId: string;
  email: string;
  roleCode: string;
  roleLevel: number;
  permissions: Record<string, string[]>;
  accessScope: User['accessScope'];
  type: 'access' | 'refresh';
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface UserOrganization {
  id: string;
  name: string;
  code: string;
  institutionType: string;
  roleCode: string;
  roleLevel: number;
  logo?: string;
}

export interface AuthUser {
  id: string;
  email: string;
  phone?: string;
  profile: User['profile'];
  roleCode: string;
  roleLevel: number;
  permissions: Record<string, string[]>;
  accessScope: User['accessScope'];
  branches: (Pick<Branch, '_id' | 'name' | 'code' | 'institutionType'> & {
    logo?: string;
  })[];
  /**
   * Constituent institutions hosted on the user's accessible campuses, sorted
   * default-first. Each campus hosts one or more; schools and colleges have a
   * single hidden default per campus.
   */
  institutions: Array<{
    _id: string;
    /** Campus hosting this institution. */
    branchId?: string;
    name: string;
    code: string;
    kind?: string;
    isDefault: boolean;
    logo?: string;
  }>;
  tenant: Pick<
    Tenant,
    | '_id'
    | 'name'
    | 'code'
    | 'institutionTypes'
    | 'branding'
    | 'status'
    | 'subscription'
    | 'onboardingCompleted'
  >;
  organizations: UserOrganization[];
  mustChangePassword?: boolean;
  staffId?: string;
  studentId?: string;
}

export interface LoginResponse {
  user: AuthUser;
  tokens: AuthTokens;
}

export interface RefreshTokenResponse {
  accessToken: string;
  expiresIn: number;
}

export interface PasswordResetRequest {
  email: string;
}

export interface PasswordReset {
  token: string;
  password: string;
  confirmPassword: string;
}

export interface PasswordChange {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

// Session stored in Redis
export interface UserSession {
  userId: string;
  tenantId: string;
  refreshToken: string;
  deviceInfo?: {
    userAgent?: string;
    ip?: string;
  };
  createdAt: Date;
  lastAccessedAt: Date;
}
