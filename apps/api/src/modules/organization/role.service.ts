import { ObjectId, WithId, Document, Filter } from 'mongodb';
import { collections } from '../../config/database';
import { logger } from '../../lib/logger';
import { ApiError } from '../../middleware/errorHandler';
import { CreateRoleInput, SYSTEM_ROLES } from '@campus-verse/shared';
import {
  allPermissionKeys,
  defaultPermissions,
  resolvePermissions,
} from '../auth/permissionResolver';

interface RoleDocument extends Document {
  _id: ObjectId;
  tenantId: ObjectId;
  name: string;
  code: string;
  description?: string;
  isSystemRole: boolean;
  level: number;
  permissions: Record<string, string[]>;
  /** Set when saved in the Roles editor; see auth/permissionResolver. */
  permissionKeysSeen?: string[];
  createdBy?: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface RoleListParams {
  page?: number;
  limit?: number;
  search?: string;
  includeSystemRoles?: boolean;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

interface CurrentUser {
  userId: string;
  roleCode: string;
  roleLevel: number;
}

class RoleService {
  /**
   * Check if a user can manage a role based on their own role level
   * - Users can only manage roles with level > their own level
   * - ORG_MODERATOR cannot manage GROUP_OWNER or other ORG_MODERATOR roles
   */
  canManageRole(
    currentUser: CurrentUser,
    targetRoleLevel: number,
    targetRoleCode?: string
  ): boolean {
    // GROUP_OWNER can manage all roles
    if (currentUser.roleCode === SYSTEM_ROLES.GROUP_OWNER) {
      return true;
    }

    // ORG_MODERATOR cannot manage GROUP_OWNER or ORG_MODERATOR
    if (currentUser.roleCode === SYSTEM_ROLES.ORG_MODERATOR) {
      if (
        targetRoleCode === SYSTEM_ROLES.GROUP_OWNER ||
        targetRoleCode === SYSTEM_ROLES.ORG_MODERATOR
      ) {
        return false;
      }
    }

    // General rule: can only manage roles with higher level number (lower privilege)
    return currentUser.roleLevel < targetRoleLevel;
  }

  /**
   * Get roles that the current user can assign to others
   */
  async getAssignableRoles(tenantId: string, currentUser: CurrentUser) {
    const allRoles = (await collections.roles
      .find({ tenantId: new ObjectId(tenantId) })
      .sort({ level: 1 })
      .toArray()) as WithId<RoleDocument>[];

    const assignableRoles = allRoles.filter((role) => {
      // GROUP_OWNER can assign all roles except GROUP_OWNER itself
      if (currentUser.roleCode === SYSTEM_ROLES.GROUP_OWNER) {
        return role.code !== SYSTEM_ROLES.GROUP_OWNER;
      }

      // ORG_MODERATOR can assign all roles except GROUP_OWNER and ORG_MODERATOR
      if (currentUser.roleCode === SYSTEM_ROLES.ORG_MODERATOR) {
        return role.code !== SYSTEM_ROLES.GROUP_OWNER && role.code !== SYSTEM_ROLES.ORG_MODERATOR;
      }

      // Others can only assign roles with level > their own
      return role.level > currentUser.roleLevel;
    });

    return assignableRoles.map((role) => this.formatRole(role));
  }

  async create(tenantId: string, data: CreateRoleInput, currentUser?: CurrentUser) {
    // Validate that user can create roles with this level
    if (currentUser) {
      // Custom roles must have level > creator's level (lower privilege)
      if (data.level <= currentUser.roleLevel) {
        throw new ApiError(
          'INSUFFICIENT_PRIVILEGE',
          'You can only create roles with lower privilege than your own',
          403
        );
      }
    }

    // Check if role code already exists for this tenant
    const existingRole = await collections.roles.findOne({
      tenantId: new ObjectId(tenantId),
      code: data.code.toUpperCase(),
    });

    if (existingRole) {
      throw new ApiError('DUPLICATE_ROLE_CODE', 'A role with this code already exists', 409);
    }

    const roleId = new ObjectId();
    const now = new Date();

    const role: Omit<RoleDocument, '_id'> & { _id: ObjectId } = {
      _id: roleId,
      tenantId: new ObjectId(tenantId),
      name: data.name,
      code: data.code.toUpperCase(),
      description: data.description,
      isSystemRole: false,
      level: data.level,
      permissions: data.permissions,
      createdAt: now,
      updatedAt: now,
      ...(currentUser && { createdBy: new ObjectId(currentUser.userId) }),
    };

    await collections.roles.insertOne(role);

    logger.info({ roleId: roleId.toString(), tenantId }, 'Role created');

    return this.formatRole(role as WithId<RoleDocument>);
  }

  async findById(tenantId: string, roleId: string) {
    const role = (await collections.roles.findOne({
      _id: new ObjectId(roleId),
      tenantId: new ObjectId(tenantId),
    })) as WithId<RoleDocument> | null;

    if (!role) {
      throw new ApiError('ROLE_NOT_FOUND', 'Role not found', 404);
    }

    return this.formatRole(role);
  }

  async findAll(tenantId: string, params: RoleListParams = {}) {
    const { page = 1, limit = 50, search, sortBy = 'level', sortOrder = 'asc' } = params;

    const filter: Filter<Document> = {
      tenantId: new ObjectId(tenantId),
    };

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { code: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (page - 1) * limit;
    const sortDirection = sortOrder === 'asc' ? 1 : -1;

    const [roles, total] = await Promise.all([
      collections.roles
        .find(filter)
        .sort({ [sortBy]: sortDirection, _id: sortDirection })
        .skip(skip)
        .limit(limit)
        .toArray() as Promise<WithId<RoleDocument>[]>,
      collections.roles.countDocuments(filter),
    ]);

    const roleIds = roles.map((r) => r._id);
    const userCounts = roleIds.length
      ? await collections.users
          .aggregate<{ _id: ObjectId; count: number }>([
            {
              $match: {
                tenantId: new ObjectId(tenantId),
                roleId: { $in: roleIds },
              },
            },
            { $group: { _id: '$roleId', count: { $sum: 1 } } },
          ])
          .toArray()
      : [];
    const userCountMap = new Map(userCounts.map((x) => [x._id.toString(), x.count]));

    return {
      data: roles.map((role) => ({
        ...this.formatRole(role),
        userCount: userCountMap.get(role._id.toString()) || 0,
      })),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: skip + roles.length < total,
      },
    };
  }

  async update(
    tenantId: string,
    roleId: string,
    data: Partial<CreateRoleInput>,
    currentUser?: CurrentUser
  ) {
    const existingRole = (await collections.roles.findOne({
      _id: new ObjectId(roleId),
      tenantId: new ObjectId(tenantId),
    })) as WithId<RoleDocument> | null;

    if (!existingRole) {
      throw new ApiError('ROLE_NOT_FOUND', 'Role not found', 404);
    }

    // Check if user can manage this role
    if (currentUser && !this.canManageRole(currentUser, existingRole.level, existingRole.code)) {
      throw new ApiError('INSUFFICIENT_PRIVILEGE', 'You cannot modify this role', 403);
    }

    // System roles: only GROUP_OWNER can edit, and only permissions
    if (existingRole.isSystemRole) {
      if (!currentUser || currentUser.roleCode !== SYSTEM_ROLES.GROUP_OWNER) {
        throw new ApiError(
          'CANNOT_EDIT_SYSTEM_ROLE',
          'Only the group owner can modify system roles',
          403
        );
      }
    }

    // If changing level, ensure new level is still within user's manageable range
    // GROUP_OWNER bypasses this check
    if (
      currentUser &&
      currentUser.roleCode !== SYSTEM_ROLES.GROUP_OWNER &&
      data.level !== undefined &&
      data.level <= currentUser.roleLevel
    ) {
      throw new ApiError(
        'INSUFFICIENT_PRIVILEGE',
        'You can only set role levels lower than your own privilege',
        403
      );
    }

    // Check code uniqueness if changing
    if (data.code && data.code.toUpperCase() !== existingRole.code) {
      const codeConflict = await collections.roles.findOne({
        tenantId: new ObjectId(tenantId),
        code: data.code.toUpperCase(),
        _id: { $ne: new ObjectId(roleId) },
      });

      if (codeConflict) {
        throw new ApiError('DUPLICATE_ROLE_CODE', 'A role with this code already exists', 409);
      }
    }

    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    // For system roles, only allow permission changes
    // Saving permissions in the editor makes the saved role the truth (switched-off
    // modules stay off); only modules added to the platform later are topped up.
    if (data.permissions !== undefined) updateData.permissionKeysSeen = allPermissionKeys();

    if (existingRole.isSystemRole) {
      if (data.permissions !== undefined) updateData.permissions = data.permissions;
    } else {
      if (data.name !== undefined) updateData.name = data.name;
      if (data.code !== undefined) updateData.code = data.code.toUpperCase();
      if (data.description !== undefined) updateData.description = data.description;
      if (data.level !== undefined) updateData.level = data.level;
      if (data.permissions !== undefined) updateData.permissions = data.permissions;
    }

    await collections.roles.updateOne({ _id: new ObjectId(roleId) }, { $set: updateData });

    logger.info({ roleId, tenantId }, 'Role updated');

    return this.findById(tenantId, roleId);
  }

  async delete(tenantId: string, roleId: string, currentUser?: CurrentUser) {
    const role = (await collections.roles.findOne({
      _id: new ObjectId(roleId),
      tenantId: new ObjectId(tenantId),
    })) as WithId<RoleDocument> | null;

    if (!role) {
      throw new ApiError('ROLE_NOT_FOUND', 'Role not found', 404);
    }

    if (role.isSystemRole) {
      throw new ApiError('CANNOT_DELETE_SYSTEM_ROLE', 'System roles cannot be deleted', 400);
    }

    // Check if user can manage this role
    if (currentUser && !this.canManageRole(currentUser, role.level, role.code)) {
      throw new ApiError('INSUFFICIENT_PRIVILEGE', 'You cannot delete this role', 403);
    }

    // Check if role is assigned to any users
    const userCount = await collections.users.countDocuments({
      tenantId: new ObjectId(tenantId),
      roleId: new ObjectId(roleId),
    });

    if (userCount > 0) {
      throw new ApiError('ROLE_IN_USE', `Cannot delete role assigned to ${userCount} users`, 400);
    }

    await collections.roles.deleteOne({ _id: new ObjectId(roleId) });

    logger.info({ roleId, tenantId }, 'Role deleted');

    return { success: true };
  }

  /** Back to the built-in defaults; the role follows new platform defaults again. */
  async resetToDefaults(tenantId: string, roleId: string, currentUser?: CurrentUser) {
    const role = (await collections.roles.findOne({
      _id: new ObjectId(roleId),
      tenantId: new ObjectId(tenantId),
    })) as WithId<RoleDocument> | null;
    if (!role) throw new ApiError('ROLE_NOT_FOUND', 'Role not found', 404);
    if (currentUser && !this.canManageRole(currentUser, role.level, role.code)) {
      throw new ApiError('INSUFFICIENT_PRIVILEGE', 'You cannot modify this role', 403);
    }
    const defaults = defaultPermissions(role.code);
    if (!defaults) {
      throw new ApiError('NO_DEFAULTS', 'Custom roles have no built-in defaults to reset to', 400);
    }
    await collections.roles.updateOne(
      { _id: role._id },
      { $set: { permissions: defaults, updatedAt: new Date() }, $unset: { permissionKeysSeen: '' } }
    );
    logger.info({ roleId, tenantId }, 'Role reset to defaults');
    return this.findById(tenantId, roleId);
  }

  private formatRole(role: WithId<RoleDocument>) {
    const defaults = defaultPermissions(role.code);
    return {
      _id: role._id.toString(),
      tenantId: role.tenantId.toString(),
      name: role.name,
      code: role.code,
      description: role.description,
      isSystemRole: role.isSystemRole,
      level: role.level,
      // What the role actually grants at sign-in, so the editor shows the truth.
      permissions: resolvePermissions(role),
      /** A built-in role with defaults to reset to. */
      hasDefaults: !!defaults,
      /** Saved in the editor (otherwise it follows the built-in defaults). */
      customised: !!role.permissionKeysSeen?.length,
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
    };
  }
}

export const roleService = new RoleService();
