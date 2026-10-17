import { ObjectId, WithId, Document, Filter } from 'mongodb';
import bcrypt from 'bcryptjs';
import { collections } from '../../config/database';
import { logger } from '../../lib/logger';
import { ApiError } from '../../middleware/errorHandler';
import { CreateUserInput, UpdateUserInput } from '@campus-verse/shared';
import { generatePassword } from '../../utils/generators';
import { roleService } from './role.service';
import { emailService } from '../../services/email.service';

interface UserDocument extends Document {
  _id: ObjectId;
  tenantId: ObjectId;
  email: string;
  phone?: string;
  passwordHash: string;
  profile: {
    firstName: string;
    lastName: string;
    displayName: string;
    avatar?: string;
    gender?: string;
  };
  roleId: ObjectId;
  accessScope: {
    type: 'global' | 'institution' | 'branch' | 'department' | 'program';
    institutionIds?: ObjectId[];
    branchIds: ObjectId[];
    departmentIds?: ObjectId[];
    programIds?: ObjectId[];
  };
  staffId?: ObjectId;
  preferences?: {
    language?: string;
    notifications?: {
      email?: boolean;
      sms?: boolean;
      push?: boolean;
    };
  };
  security?: {
    mfaEnabled: boolean;
    passwordChangedAt?: Date;
    loginAttempts: number;
    lockUntil?: Date;
    mustChangePassword?: boolean;
  };
  lastLogin?: Date;
  status: 'active' | 'inactive' | 'locked' | 'pending';
  createdBy?: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserListParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: 'active' | 'inactive' | 'locked';
  roleId?: string;
  branchId?: string;
  roleAssigned?: boolean; // Filter for users with/without role assigned
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

interface CurrentUser {
  userId: string;
  roleCode: string;
  roleLevel: number;
}

interface RoleDocument extends Document {
  _id: ObjectId;
  code: string;
  level: number;
}

class UserService {
  async create(tenantId: string, data: CreateUserInput, currentUser?: CurrentUser) {
    // Check if email already exists for this tenant
    const existingUser = await collections.users.findOne({
      tenantId: new ObjectId(tenantId),
      email: data.email.toLowerCase(),
    });

    if (existingUser) {
      throw new ApiError('DUPLICATE_EMAIL', 'A user with this email already exists', 409);
    }

    // Validate role exists
    const role = (await collections.roles.findOne({
      _id: new ObjectId(data.roleId),
      tenantId: new ObjectId(tenantId),
    })) as WithId<RoleDocument> | null;

    if (!role) {
      throw new ApiError('ROLE_NOT_FOUND', 'The specified role does not exist', 404);
    }

    // Validate that current user can assign this role
    if (currentUser) {
      const canAssign = roleService.canManageRole(currentUser, role.level, role.code);
      if (!canAssign) {
        throw new ApiError('INSUFFICIENT_PRIVILEGE', 'You cannot assign this role to users', 403);
      }
    }

    // Validate branch access
    if (data.accessScope.type === 'branch' && data.accessScope.branchIds.length > 0) {
      const branchCount = await collections.branches.countDocuments({
        _id: { $in: data.accessScope.branchIds.map((id) => new ObjectId(id)) },
        tenantId: new ObjectId(tenantId),
      });

      if (branchCount !== data.accessScope.branchIds.length) {
        throw new ApiError('INVALID_BRANCHES', 'One or more branches are invalid', 400);
      }
    }

    // Generate password if not provided
    const password = data.password || generatePassword();
    const hashedPassword = await bcrypt.hash(password, 12);

    const userId = new ObjectId();
    const now = new Date();

    const displayName =
      data.profile.displayName || `${data.profile.firstName} ${data.profile.lastName}`;

    const user: Omit<UserDocument, '_id'> & { _id: ObjectId } = {
      _id: userId,
      tenantId: new ObjectId(tenantId),
      email: data.email.toLowerCase(),
      phone: data.phone,
      passwordHash: hashedPassword,
      profile: {
        ...data.profile,
        displayName,
      },
      roleId: new ObjectId(data.roleId),
      accessScope: {
        type: data.accessScope.type,
        institutionIds: data.accessScope.institutionIds?.map((id) => new ObjectId(id)),
        branchIds: data.accessScope.branchIds.map((id) => new ObjectId(id)),
        departmentIds: data.accessScope.departmentIds?.map((id) => new ObjectId(id)),
        programIds: data.accessScope.programIds?.map((id) => new ObjectId(id)),
      },
      ...(data.validUntil && { validUntil: new Date(data.validUntil) }),
      security: {
        mfaEnabled: false,
        passwordChangedAt: now,
        loginAttempts: 0,
        mustChangePassword: !data.password, // true if temp password was generated
      },
      status: data.password ? 'active' : 'pending', // pending if temp password was generated
      createdAt: now,
      updatedAt: now,
      ...(currentUser && { createdBy: new ObjectId(currentUser.userId) }),
    };

    await collections.users.insertOne(user);

    logger.info({ userId: userId.toString(), tenantId }, 'User created');

    // Auto-link: find staff with matching email in same tenant and link userId↔staffId
    const matchingStaff = await collections.staff.findOne({
      tenantId: new ObjectId(tenantId),
      'contact.email': data.email.toLowerCase(),
      userId: { $exists: false },
    });

    if (matchingStaff) {
      await collections.staff.updateOne(
        { _id: matchingStaff._id },
        { $set: { userId, updatedAt: new Date() } }
      );
      await collections.users.updateOne(
        { _id: userId },
        { $set: { staffId: matchingStaff._id, updatedAt: new Date() } }
      );
      logger.info(
        { staffId: matchingStaff._id.toString(), userId: userId.toString(), tenantId },
        'Auto-linked user to existing staff'
      );
    }

    // Send welcome email with temp password (if password was auto-generated)
    if (!data.password) {
      // Get tenant name for email
      const tenant = await collections.tenants.findOne(
        { _id: new ObjectId(tenantId) },
        { projection: { name: 1 } }
      );

      // Send welcome email (don't await, let it happen in background)
      emailService
        .sendUserWelcomeEmail(
          data.email,
          displayName,
          password,
          tenant?.name || 'Your Organization',
          role.name
        )
        .catch((err) => {
          logger.error({ err, userId: userId.toString() }, 'Failed to send welcome email');
        });
    }

    // Return user without password (no longer return generated password since it's emailed)
    const result = this.formatUser(user as WithId<UserDocument>);
    return {
      ...result,
      emailSent: !data.password, // Indicate if welcome email was sent
    };
  }

  async findById(tenantId: string, userId: string) {
    const user = (await collections.users.findOne({
      _id: new ObjectId(userId),
      tenantId: new ObjectId(tenantId),
    })) as WithId<UserDocument> | null;

    if (!user) {
      throw new ApiError('USER_NOT_FOUND', 'User not found', 404);
    }

    // Get role details
    const role = (await collections.roles.findOne({ _id: user.roleId })) as {
      _id: ObjectId;
      name: string;
      code: string;
    } | null;

    return {
      ...this.formatUser(user),
      role: role ? { _id: role._id.toString(), name: role.name, code: role.code } : null,
    };
  }

  async findAll(tenantId: string, params: UserListParams = {}) {
    const {
      page = 1,
      limit = 20,
      search,
      status,
      roleId,
      branchId,
      roleAssigned,
      sortBy = 'profile.firstName',
      sortOrder = 'asc',
    } = params;

    const filter: Filter<Document> = {
      tenantId: new ObjectId(tenantId),
    };

    if (search) {
      filter.$or = [
        { email: { $regex: search, $options: 'i' } },
        { 'profile.firstName': { $regex: search, $options: 'i' } },
        { 'profile.lastName': { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
      ];
    }

    if (status) {
      filter.status = status;
    }

    if (branchId) {
      filter['accessScope.branchIds'] = new ObjectId(branchId);
    }

    // The Users page manages operator accounts (admins + staff). Portal
    // accounts — students and any future parent role (role level >= 20) —
    // are auto-created alongside student records and managed in their own
    // modules, so exclude them by default. Explicitly filtering by a role
    // (e.g. picking "Student" in the role dropdown) is the escape hatch.
    if (roleId) {
      filter.roleId = new ObjectId(roleId);
    } else if (roleAssigned === false) {
      filter.roleId = { $exists: false };
    } else {
      const portalRoleIds = (await collections.roles
        .find({ tenantId: new ObjectId(tenantId), level: { $gte: 20 } })
        .project({ _id: 1 })
        .toArray()) as Array<{ _id: ObjectId }>;

      if (portalRoleIds.length > 0) {
        // $nin also matches docs with no roleId, so role-less (pending) users
        // stay visible; add $exists only when explicitly requested.
        filter.roleId =
          roleAssigned === true
            ? { $exists: true, $nin: portalRoleIds.map((r) => r._id) }
            : { $nin: portalRoleIds.map((r) => r._id) };
      } else if (roleAssigned === true) {
        filter.roleId = { $exists: true };
      }
    }

    const skip = (page - 1) * limit;
    const sortDirection = sortOrder === 'asc' ? 1 : -1;

    const [users, total] = await Promise.all([
      collections.users
        .find(filter)
        .sort({ [sortBy]: sortDirection, _id: sortDirection })
        .skip(skip)
        .limit(limit)
        .toArray() as Promise<WithId<UserDocument>[]>,
      collections.users.countDocuments(filter),
    ]);

    // Get roles for all users
    const roleIds = [...new Set(users.map((u) => u.roleId.toString()))];
    const roles = (await collections.roles
      .find({ _id: { $in: roleIds.map((id) => new ObjectId(id)) } })
      .toArray()) as Array<{ _id: ObjectId; name: string; code: string }>;
    const roleMap = new Map(roles.map((r) => [r._id.toString(), r]));

    return {
      data: users.map((user) => {
        const role = roleMap.get(user.roleId.toString());
        return {
          ...this.formatUser(user),
          role: role ? { _id: role._id.toString(), name: role.name, code: role.code } : null,
        };
      }),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: skip + users.length < total,
      },
    };
  }

  async update(tenantId: string, userId: string, data: UpdateUserInput, currentUser?: CurrentUser) {
    const existingUser = (await collections.users.findOne({
      _id: new ObjectId(userId),
      tenantId: new ObjectId(tenantId),
    })) as WithId<UserDocument> | null;

    if (!existingUser) {
      throw new ApiError('USER_NOT_FOUND', 'User not found', 404);
    }

    // Get the target user's current role for validation
    const targetUserRole = (await collections.roles.findOne({
      _id: existingUser.roleId,
    })) as WithId<RoleDocument> | null;

    // Validate that current user can manage the target user (based on their current role)
    if (currentUser && targetUserRole) {
      const canManage = roleService.canManageRole(
        currentUser,
        targetUserRole.level,
        targetUserRole.code
      );
      if (!canManage) {
        throw new ApiError('INSUFFICIENT_PRIVILEGE', 'You cannot modify this user', 403);
      }
    }

    // Check email uniqueness if changing
    if (data.email && data.email.toLowerCase() !== existingUser.email) {
      const emailConflict = await collections.users.findOne({
        tenantId: new ObjectId(tenantId),
        email: data.email.toLowerCase(),
        _id: { $ne: new ObjectId(userId) },
      });

      if (emailConflict) {
        throw new ApiError('DUPLICATE_EMAIL', 'A user with this email already exists', 409);
      }
    }

    // If changing role, validate the new role assignment
    if (data.roleId && data.roleId !== existingUser.roleId.toString()) {
      const newRole = (await collections.roles.findOne({
        _id: new ObjectId(data.roleId),
        tenantId: new ObjectId(tenantId),
      })) as WithId<RoleDocument> | null;

      if (!newRole) {
        throw new ApiError('ROLE_NOT_FOUND', 'The specified role does not exist', 404);
      }

      if (currentUser) {
        const canAssign = roleService.canManageRole(currentUser, newRole.level, newRole.code);
        if (!canAssign) {
          throw new ApiError('INSUFFICIENT_PRIVILEGE', 'You cannot assign this role to users', 403);
        }
      }
    }

    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (data.email) updateData.email = data.email.toLowerCase();
    if (data.phone !== undefined) updateData.phone = data.phone;
    if (data.profile) {
      updateData['profile.firstName'] = data.profile.firstName || existingUser.profile.firstName;
      updateData['profile.lastName'] = data.profile.lastName || existingUser.profile.lastName;
      updateData['profile.displayName'] =
        data.profile.displayName ||
        `${data.profile.firstName || existingUser.profile.firstName} ${data.profile.lastName || existingUser.profile.lastName}`;
      if (data.profile.gender !== undefined) updateData['profile.gender'] = data.profile.gender;
    }
    if (data.roleId) updateData.roleId = new ObjectId(data.roleId);
    if (data.accessScope) {
      updateData['accessScope.type'] = data.accessScope.type;
      updateData['accessScope.branchIds'] = data.accessScope.branchIds.map(
        (id) => new ObjectId(id)
      );
      if (data.accessScope.institutionIds) {
        updateData['accessScope.institutionIds'] = data.accessScope.institutionIds.map(
          (id) => new ObjectId(id)
        );
      }
      if (data.accessScope.departmentIds) {
        updateData['accessScope.departmentIds'] = data.accessScope.departmentIds.map(
          (id) => new ObjectId(id)
        );
      }
      if (data.accessScope.programIds) {
        updateData['accessScope.programIds'] = data.accessScope.programIds.map(
          (id) => new ObjectId(id)
        );
      }
    }
    if (data.validUntil !== undefined) {
      updateData.validUntil = data.validUntil ? new Date(data.validUntil) : null;
    }

    await collections.users.updateOne({ _id: new ObjectId(userId) }, { $set: updateData });

    logger.info({ userId, tenantId, updatedBy: currentUser?.userId }, 'User updated');

    return this.findById(tenantId, userId);
  }

  async updateStatus(
    tenantId: string,
    userId: string,
    status: 'active' | 'inactive',
    updatedBy?: string,
    currentUser?: { userId: string; roleCode: string; roleLevel: number }
  ) {
    const user = await collections.users.findOne({
      _id: new ObjectId(userId),
      tenantId: new ObjectId(tenantId),
    });

    if (!user) {
      throw new ApiError('USER_NOT_FOUND', 'User not found', 404);
    }

    // Prevent self-deactivation
    if (updatedBy === userId && status !== 'active') {
      throw new ApiError('CANNOT_DEACTIVATE_SELF', 'You cannot deactivate your own account', 400);
    }

    // Validate role hierarchy - cannot change status of users with equal or higher privilege
    if (currentUser && user.roleId) {
      const targetRole = await collections.roles.findOne({
        _id: new ObjectId(user.roleId),
        tenantId: new ObjectId(tenantId),
      });

      if (targetRole) {
        const canManage = roleService.canManageRole(
          currentUser,
          (targetRole as unknown as { level: number }).level,
          (targetRole as unknown as { code: string }).code
        );
        if (!canManage) {
          throw new ApiError(
            'INSUFFICIENT_PRIVILEGE',
            'You cannot change the status of this user',
            403
          );
        }
      }
    }

    await collections.users.updateOne(
      { _id: new ObjectId(userId) },
      { $set: { status, updatedAt: new Date() } }
    );

    logger.info({ userId, tenantId, status, updatedBy }, 'User status updated');

    return this.findById(tenantId, userId);
  }

  async delete(tenantId: string, userId: string, deletedBy?: string) {
    const user = await collections.users.findOne({
      _id: new ObjectId(userId),
      tenantId: new ObjectId(tenantId),
    });

    if (!user) {
      throw new ApiError('USER_NOT_FOUND', 'User not found', 404);
    }

    // Prevent self-deletion
    if (deletedBy === userId) {
      throw new ApiError('CANNOT_DELETE_SELF', 'You cannot delete your own account', 400);
    }

    await collections.users.deleteOne({ _id: new ObjectId(userId) });

    logger.info({ userId, tenantId, deletedBy }, 'User deleted');

    return { success: true };
  }

  async resetPassword(tenantId: string, userId: string, resetBy?: string) {
    const user = (await collections.users.findOne({
      _id: new ObjectId(userId),
      tenantId: new ObjectId(tenantId),
    })) as WithId<UserDocument> | null;

    if (!user) {
      throw new ApiError('USER_NOT_FOUND', 'User not found', 404);
    }

    const newPassword = generatePassword();
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    await collections.users.updateOne(
      { _id: new ObjectId(userId) },
      {
        $set: {
          passwordHash: hashedPassword,
          'security.passwordChangedAt': new Date(),
          'security.loginAttempts': 0,
          'security.lockUntil': null,
          updatedAt: new Date(),
        },
      }
    );

    logger.info({ userId, tenantId, resetBy }, 'User password reset');

    // Get tenant name for email
    const tenant = await collections.tenants.findOne(
      { _id: new ObjectId(tenantId) },
      { projection: { name: 1 } }
    );

    // Send password reset email (don't await, let it happen in background)
    emailService
      .sendPasswordResetEmail(
        user.email,
        user.profile.displayName,
        newPassword,
        tenant?.name || 'Your Organization'
      )
      .catch((err) => {
        logger.error({ err, userId }, 'Failed to send password reset email');
      });

    return { emailSent: true };
  }

  private formatUser(user: WithId<UserDocument>) {
    return {
      _id: user._id.toString(),
      tenantId: user.tenantId.toString(),
      email: user.email,
      phone: user.phone,
      profile: user.profile,
      roleId: user.roleId.toString(),
      accessScope: {
        type: user.accessScope.type,
        institutionIds: user.accessScope.institutionIds?.map((id) => id.toString()),
        branchIds: user.accessScope.branchIds.map((id) => id.toString()),
        departmentIds: user.accessScope.departmentIds?.map((id) => id.toString()),
        programIds: user.accessScope.programIds?.map((id) => id.toString()),
      },
      staffId: user.staffId?.toString(),
      preferences: user.preferences,
      lastLogin: user.lastLogin,
      status: user.status,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}

export const userService = new UserService();
